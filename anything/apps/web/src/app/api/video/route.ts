import { NextResponse } from 'next/server';

// Video generation — supported providers and their models:
//  - fal.ai:    Wan 2.1 1.3B (FREE tier, requires fal.ai API key)
//  - Novita AI: Wan 2.1 (PAID, requires balance)
// OpenRouter does NOT have a real video generation endpoint.

function parseError(raw: string, status: number, provider: string): string {
  try {
    const p = JSON.parse(raw);
    const msg = p?.error?.message ?? p?.message ?? p?.detail ?? raw.slice(0, 300);
    return `${provider} returned ${status}: ${msg}`;
  } catch {
    return `${provider} returned ${status}: ${raw.slice(0, 300)}`;
  }
}

// ── fal.ai — Wan 2.1 1.3B (free tier) ────────────────────────────────────
async function generateViaFal(prompt: string, apiKey: string): Promise<string> {
  // Submit the request
  const submitRes = await fetch('https://queue.fal.run/fal-ai/wan/v2.1/1.3b/text-to-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      num_frames: 25,
      frames_per_second: 16,
      resolution: '480p',
      num_inference_steps: 30,
    }),
  });
  const submitRaw = await submitRes.text();
  if (!submitRes.ok) throw new Error(parseError(submitRaw, submitRes.status, 'fal.ai'));
  const submitJson = JSON.parse(submitRaw) as { request_id?: string; status_url?: string };
  const requestId = submitJson.request_id;
  if (!requestId) throw new Error(`fal.ai did not return a request_id: ${submitRaw.slice(0, 200)}`);

  // Poll for result
  const statusUrl = submitJson.status_url ?? `https://queue.fal.run/fal-ai/wan/v2.1/1.3b/text-to-video/requests/${requestId}`;
  const deadline = Date.now() + 240_000; // 4 minute timeout
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    const statusJson = await statusRes.json() as {
      status?: string;
      video?: { url?: string };
      output?: { video?: { url?: string } };
      error?: string;
    };
    const status = statusJson.status;
    if (status === 'COMPLETED' || statusJson.video?.url || statusJson.output?.video?.url) {
      const url = statusJson.video?.url ?? statusJson.output?.video?.url;
      if (url) return url;
      throw new Error('fal.ai completed but returned no video URL.');
    }
    if (status === 'FAILED') {
      throw new Error(`fal.ai video generation failed: ${statusJson.error ?? 'unknown error'}`);
    }
    // IN_QUEUE or IN_PROGRESS — keep polling
  }
  throw new Error('fal.ai video generation timed out after 4 minutes.');
}

// ── Novita AI — Wan 2.1 (paid, requires balance) ─────────────────────────
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

    let videoUrl: string;
    let modelLabel: string;

    switch (provider) {
      case 'fal-ai':
        videoUrl = await generateViaFal(prompt.trim(), apiKey.trim());
        modelLabel = 'Wan 2.1 1.3B (fal.ai)';
        break;
      case 'novita-ai':
        videoUrl = await generateViaNovita(prompt.trim(), apiKey.trim());
        modelLabel = 'Wan 2.1 (Novita AI)';
        break;
      default:
        return NextResponse.json({
          error: `Video generation is supported on fal.ai (free tier) and Novita AI (paid). Switch to one of those providers in the Providers tab and add your API key. fal.ai offers a free tier — get a key at fal.ai/dashboard.`,
        });
    }

    return NextResponse.json({ url: videoUrl, type: 'video', model: modelLabel });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown video generation error.';
    console.error('[api/video]', msg);
    return NextResponse.json({ error: msg });
  }
}
