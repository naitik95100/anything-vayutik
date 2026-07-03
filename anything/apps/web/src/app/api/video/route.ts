import { NextResponse } from 'next/server';

async function poll(url: string, headers: Record<string, string>, maxMs = 120_000): Promise<string> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const res = await fetch(url, { headers });
    const json = await res.json() as Record<string, unknown>;
    const status = (json.task_status ?? json.status) as string | undefined;
    if (status === 'TASK_STATUS_SUCCEED' || status === 'succeed' || status === 'completed') {
      const videos = json.videos as { video_url?: string; url?: string }[] | undefined;
      const videoUrl = videos?.[0]?.video_url ?? videos?.[0]?.url;
      if (videoUrl) return videoUrl;
      throw new Error('Video task succeeded but no URL returned.');
    }
    if (status === 'TASK_STATUS_FAILED' || status === 'failed') {
      throw new Error(`Video generation failed: ${JSON.stringify(json)}`);
    }
  }
  throw new Error('Video generation timed out after 120 seconds.');
}

async function generateNovitaVideo(prompt: string, apiKey: string): Promise<string> {
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
  const json = await res.json() as { task_id?: string; message?: string };
  if (!res.ok || !json.task_id) throw new Error(`Novita video error: ${json.message ?? JSON.stringify(json)}`);
  return poll(
    `https://api.novita.ai/v3/async/task-result?task_id=${json.task_id}`,
    { Authorization: `Bearer ${apiKey}` },
  );
}

const VIDEO_GENERATORS: Record<string, (p: string, k: string) => Promise<string>> = {
  'novita-ai': generateNovitaVideo,
};

// ── POST /api/video ──────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { prompt, provider, apiKey } = await req.json() as {
      prompt: string;
      provider: string;
      apiKey: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'No prompt provided.' }, { status: 400 });
    }
    if (!apiKey?.trim()) {
      return NextResponse.json({
        error: `No API key set for "${provider}". Add it in the Keys tab.`,
      }, { status: 400 });
    }

    const generator = VIDEO_GENERATORS[provider];
    if (!generator) {
      return NextResponse.json({
        error: `Video generation requires a Novita AI key. Current provider "${provider}" does not support video generation. Switch to Novita AI in the Providers tab.`,
      }, { status: 400 });
    }

    const videoUrl = await generator(prompt.trim(), apiKey.trim());
    return NextResponse.json({ url: videoUrl, type: 'video' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/video]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
