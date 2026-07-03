import { NextResponse } from 'next/server';

// Video generation — Novita AI (Wan 2.1) is the primary working provider.
// OpenRouter does NOT have a real video generation endpoint as of July 2025.
// We show a clear helpful message for unsupported providers.

function parseError(raw: string, status: number, provider: string): string {
  try {
    const p = JSON.parse(raw);
    const msg = p?.error?.message ?? p?.message ?? p?.detail ?? raw.slice(0, 300);
    return `${provider} returned ${status}: ${msg}`;
  } catch {
    return `${provider} returned ${status}: ${raw.slice(0, 300)}`;
  }
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
  const json = JSON.parse(raw) as { task_id?: string };
  if (!json.task_id) throw new Error(`Novita did not return a task_id: ${raw.slice(0, 200)}`);
  return pollNovitaVideo(json.task_id, apiKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/video
// Body: { prompt, provider, apiKey, model? }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { prompt, provider, apiKey } = await req.json() as {
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

    // Only Novita AI supports real video generation right now.
    // OpenRouter does not have a working /videos/generations endpoint as of July 2025.
    if (provider === 'novita-ai') {
      const videoUrl = await generateViaNovita(prompt.trim(), apiKey.trim());
      return NextResponse.json({ url: videoUrl, type: 'video', model: 'Wan 2.1 (Novita)' });
    }

    // For all other providers, return a clear actionable message
    return NextResponse.json({
      error: `Video generation requires Novita AI. Switch to Novita AI in the Providers tab and add your free API key from novita.ai — Wan 2.1 generates real MP4 videos. OpenRouter and other providers do not support video generation at this time.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown video generation error.';
    console.error('[api/video]', msg);
    return NextResponse.json({ error: msg });
  }
}
