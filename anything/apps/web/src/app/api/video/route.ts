import { NextResponse } from 'next/server';

// Video generation — supported providers:
//  - Replicate: Wan 2.1 & LTX Video (free $10 trial credit on sign-up)
//  - Luma AI:   Dream Machine (10 free generations/month on free account)
//  - Novita AI: Wan 2.1 (paid, balance required)
//  - fal.ai:    Wan 2.1 1.3B (pay-per-use, not free)
//
// No provider offers completely unlimited free video generation via API.
// All providers listed above have a free-to-start option (credits or free quota).

function parseError(raw: string, status: number, provider: string): string {
  try {
    const p = JSON.parse(raw);
    const msg =
      p?.error?.message ??
      p?.detail ??
      p?.message ??
      (typeof p?.error === 'string' ? p.error : null) ??
      raw.slice(0, 400);
    return `${provider} returned ${status}: ${msg}`;
  } catch {
    return `${provider} returned ${status}: ${raw.slice(0, 400)}`;
  }
}

// ── Replicate — Wan 2.1 (free $10 trial credit, no billing required) ─────
// Model: wavespeedai/wan-2.1-t2v-480p  (fastest, ~60s)
async function generateViaReplicate(prompt: string, apiKey: string): Promise<string> {
  // Create prediction
  const createRes = await fetch('https://api.replicate.com/v1/models/wavespeedai/wan-2.1-t2v-480p/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Prefer: 'wait=60',  // wait up to 60s for result inline
    },
    body: JSON.stringify({ input: { prompt, num_frames: 49, fps: 16 } }),
  });
  const createRaw = await createRes.text();
  if (!createRes.ok) throw new Error(parseError(createRaw, createRes.status, 'Replicate'));

  const prediction = JSON.parse(createRaw) as {
    id?: string;
    status?: string;
    output?: string | string[];
    urls?: { get?: string };
    error?: string;
  };

  if (prediction.status === 'failed') {
    throw new Error(`Replicate prediction failed: ${prediction.error ?? 'unknown'}`);
  }

  // If completed inline, return immediately
  if (prediction.status === 'succeeded') {
    const out = prediction.output;
    const url = Array.isArray(out) ? out[0] : out;
    if (url) return url as string;
  }

  // Otherwise poll the get URL
  const pollUrl = prediction.urls?.get;
  if (!pollUrl) throw new Error(`Replicate did not return a poll URL. Response: ${createRaw.slice(0, 300)}`);

  const deadline = Date.now() + 300_000; // 5 minutes
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 6000));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const pollJson = await pollRes.json() as {
      status?: string;
      output?: string | string[];
      error?: string;
    };
    if (pollJson.status === 'succeeded') {
      const out = pollJson.output;
      const url = Array.isArray(out) ? out[0] : out;
      if (url) return url as string;
      throw new Error('Replicate succeeded but output has no URL.');
    }
    if (pollJson.status === 'failed') {
      throw new Error(`Replicate generation failed: ${pollJson.error ?? 'unknown'}`);
    }
    // starting | processing — keep polling
  }
  throw new Error('Replicate video generation timed out after 5 minutes.');
}

// ── Luma AI — Dream Machine (10 free generations/month) ──────────────────
async function generateViaLuma(prompt: string, apiKey: string): Promise<string> {
  // Submit generation request
  const submitRes = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations/video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      generation_type: 'video',
      resolution: '540p',
      duration: '5s',
    }),
  });
  const submitRaw = await submitRes.text();
  if (!submitRes.ok) throw new Error(parseError(submitRaw, submitRes.status, 'Luma AI'));

  const submitJson = JSON.parse(submitRaw) as { id?: string };
  const genId = submitJson.id;
  if (!genId) throw new Error(`Luma AI did not return a generation ID. Response: ${submitRaw.slice(0, 300)}`);

  // Poll until complete
  const deadline = Date.now() + 300_000; // 5 minutes
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${genId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const pollJson = await pollRes.json() as {
      state?: string;
      assets?: { video?: string };
      failure_reason?: string;
    };
    if (pollJson.state === 'completed') {
      const url = pollJson.assets?.video;
      if (url) return url;
      throw new Error('Luma AI completed but returned no video URL.');
    }
    if (pollJson.state === 'failed') {
      throw new Error(`Luma AI generation failed: ${pollJson.failure_reason ?? 'unknown'}`);
    }
    // queued | dreaming — keep polling
  }
  throw new Error('Luma AI video generation timed out after 5 minutes.');
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
      throw new Error('Novita succeeded but returned no video URL.');
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
      return NextResponse.json({
        error: 'Prompt is required. Usage: /video a dolphin jumping in the ocean',
      });
    }
    if (!apiKey?.trim()) {
      return NextResponse.json({
        error: `No API key set for "${provider}". Add it in the Keys tab on the right.`,
      });
    }

    let videoUrl: string;
    let modelLabel: string;

    switch (provider) {
      case 'replicate':
        videoUrl = await generateViaReplicate(prompt.trim(), apiKey.trim());
        modelLabel = 'Wan 2.1 480p (Replicate)';
        break;
      case 'luma-ai':
        videoUrl = await generateViaLuma(prompt.trim(), apiKey.trim());
        modelLabel = 'Dream Machine (Luma AI)';
        break;
      case 'novita-ai':
        videoUrl = await generateViaNovita(prompt.trim(), apiKey.trim());
        modelLabel = 'Wan 2.1 (Novita AI)';
        break;
      default:
        return NextResponse.json({
          error:
            `Video generation requires a dedicated provider. Recommended options:\n\n` +
            `1. Replicate — Free $10 credit on sign-up (no billing required to start). Get key at replicate.com/account/api-tokens\n` +
            `2. Luma AI — 10 free video generations/month. Get key at lumalabs.ai/dream-machine/api\n\n` +
            `Switch to one of these in the Providers tab, add your API key, then try again.`,
        });
    }

    return NextResponse.json({ url: videoUrl, type: 'video', model: modelLabel });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown video generation error.';
    console.error('[api/video]', msg);
    return NextResponse.json({ error: `Video error: ${msg}` });
  }
}
