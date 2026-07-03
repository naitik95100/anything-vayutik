import { NextResponse } from 'next/server';

// Video generation via OpenRouter (Veo 3 Fast, HappyHorse 1.1) and Novita AI (Wan 2.1)
// All routes use the user's own API key.

function parseError(raw: string, status: number, provider: string): string {
  try {
    const p = JSON.parse(raw);
    const msg = p?.error?.message ?? p?.message ?? p?.detail ?? raw.slice(0, 300);
    return `${provider} returned ${status}: ${msg}`;
  } catch {
    return `${provider} returned ${status}: ${raw.slice(0, 300)}`;
  }
}

// ── OpenRouter — Veo 3 Fast / HappyHorse 1.1 / Grok Video ────────────────
// OpenRouter uses a generations endpoint that returns a URL directly.
async function generateViaOpenRouter(prompt: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/videos/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://v0-nexus99.vercel.app',
      'X-Title': 'AI Nexus',
    },
    body: JSON.stringify({ model, prompt, n: 1 }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, 'OpenRouter'));
  const json = JSON.parse(raw) as { data?: { url?: string; b64_json?: string }[]; id?: string };

  // Direct URL response
  const item = json.data?.[0];
  if (item?.url) return item.url;
  if (item?.b64_json) return `data:video/mp4;base64,${item.b64_json}`;

  // Some video models on OR return a generation ID — poll for result
  if (json.id) return pollOpenRouterGeneration(json.id, apiKey);

  throw new Error('OpenRouter returned no video data.');
}

async function pollOpenRouterGeneration(id: string, apiKey: string): Promise<string> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const res = await fetch(`https://openrouter.ai/api/v1/generations/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) continue;
    const json = await res.json() as {
      status?: string;
      data?: { url?: string }[];
      url?: string;
    };
    if (json.status === 'completed' || json.status === 'succeeded') {
      const url = json.data?.[0]?.url ?? json.url;
      if (url) return url;
    }
    if (json.status === 'failed') throw new Error('OpenRouter video generation failed.');
  }
  throw new Error('OpenRouter video generation timed out after 120 seconds.');
}

// ── Novita AI — Wan 2.1 txt2video with polling ────────────────────────────
async function pollNovitaVideo(taskId: string, apiKey: string): Promise<string> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`https://api.novita.ai/v3/async/task-result?task_id=${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const json = await res.json() as {
      task?: { status?: string };
      videos?: { video_url?: string }[];
    };
    const status = json?.task?.status;
    if (status === 'TASK_STATUS_SUCCEED') {
      const url = json.videos?.[0]?.video_url;
      if (url) return url;
      throw new Error('Novita video task succeeded but returned no URL.');
    }
    if (status === 'TASK_STATUS_FAILED') throw new Error('Novita video generation failed.');
  }
  throw new Error('Novita video generation timed out after 3 minutes.');
}

async function generateViaNovita(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.novita.ai/v3/async/txt2video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model_name: 'wan2.1-t2v-480p',
      prompt,
      negative_prompt: 'blurry, low quality, static, worst quality',
      width: 832,
      height: 480,
      steps: 20,
      seed: -1,
      num_frames: 49,
      guidance_scale: 5,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, 'Novita'));
  const json = JSON.parse(raw) as { task_id?: string; message?: string };
  if (!json.task_id) throw new Error(`Novita did not return a task_id: ${raw.slice(0, 200)}`);
  return pollNovitaVideo(json.task_id, apiKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// Model → generation strategy map
// ─────────────────────────────────────────────────────────────────────────────
const VIDEO_MODEL_CONFIGS: Record<string, { fn: (p: string, k: string) => Promise<string>; label: string }> = {
  'google/veo-3-fast':       { fn: (p, k) => generateViaOpenRouter(p, k, 'google/veo-3-fast'),        label: 'Google Veo 3 Fast' },
  'alibaba/happyhorse-1.1':  { fn: (p, k) => generateViaOpenRouter(p, k, 'alibaba/happyhorse-1.1'),   label: 'HappyHorse 1.1' },
  'x-ai/grok-2-aurora':      { fn: (p, k) => generateViaOpenRouter(p, k, 'x-ai/grok-2-aurora'),       label: 'Grok 2 Aurora' },
  'wan2.1-t2v-480p':         { fn: generateViaNovita,                                                  label: 'Wan 2.1 (Novita)' },
};

// Default per provider
const PROVIDER_DEFAULT_VIDEO: Record<string, string> = {
  openrouter:    'google/veo-3-fast',
  'novita-ai':   'wan2.1-t2v-480p',
  'nvidia-nim':  'google/veo-3-fast', // route through openrouter
  custom:        'google/veo-3-fast',
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/video
// Body: { prompt, provider, apiKey, model? }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { prompt, provider, apiKey, model } = await req.json() as {
      prompt: string;
      provider: string;
      apiKey: string;
      model?: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required. Usage: /video a dolphin jumping in the ocean' });
    }
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: `No API key set for "${provider}". Add it in the Keys tab.` });
    }

    // Determine which video model to use
    const resolvedModel = model || PROVIDER_DEFAULT_VIDEO[provider] || 'google/veo-3-fast';
    const config = VIDEO_MODEL_CONFIGS[resolvedModel];

    if (!config) {
      return NextResponse.json({
        error: `No video generation config for model "${resolvedModel}". Use /video with OpenRouter (Veo 3 Fast, HappyHorse 1.1) or Novita AI (Wan 2.1).`,
      });
    }

    const videoUrl = await config.fn(prompt.trim(), apiKey.trim());
    return NextResponse.json({ url: videoUrl, type: 'video', model: config.label });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown video generation error.';
    console.error('[api/video]', msg);
    return NextResponse.json({ error: msg });
  }
}
