import { NextResponse } from 'next/server';

// ── Supported providers and their image generation configs ──────────────────
interface ImageConfig {
  generate: (prompt: string, apiKey: string) => Promise<string>; // returns image URL or base64 data URL
}

async function poll(url: string, headers: Record<string, string>, maxMs = 60_000): Promise<string> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const res = await fetch(url, { headers });
    const json = await res.json() as Record<string, unknown>;
    const status = (json.task_status ?? json.status) as string | undefined;
    if (status === 'TASK_STATUS_SUCCEED' || status === 'succeed' || status === 'completed') {
      const imgs = json.images_encoded as string[] | undefined
        ?? (json.data as { url?: string }[] | undefined)?.map((d) => d.url ?? '')
        ?? [];
      if (imgs[0]) return imgs[0].startsWith('http') ? imgs[0] : `data:image/jpeg;base64,${imgs[0]}`;
    }
    if (status === 'TASK_STATUS_FAILED' || status === 'failed') {
      throw new Error(`Image generation failed: ${JSON.stringify(json)}`);
    }
  }
  throw new Error('Image generation timed out after 60 seconds.');
}

async function generateNovita(prompt: string, apiKey: string): Promise<string> {
  // Step 1: submit task
  const res = await fetch('https://api.novita.ai/v3/async/txt2img', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      extra: { response_image_type: 'jpeg' },
      request: {
        model_name: 'flux1-schnell-fp8_2081908',
        prompt,
        negative_prompt: 'blurry, low quality, distorted',
        width: 1024,
        height: 1024,
        steps: 4,
        sampler_name: 'Euler',
        cfg_scale: 1,
        n_iter: 1,
        batch_size: 1,
        seed: -1,
      },
    }),
  });
  const json = await res.json() as { task_id?: string; message?: string };
  if (!res.ok || !json.task_id) throw new Error(`Novita error: ${json.message ?? JSON.stringify(json)}`);
  return poll(
    `https://api.novita.ai/v3/async/task-result?task_id=${json.task_id}`,
    { Authorization: `Bearer ${apiKey}` },
  );
}

async function generateOpenRouter(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://v0-nexus99.vercel.app',
      'X-Title': 'AI Nexus',
    },
    body: JSON.stringify({
      model: 'black-forest-labs/flux-schnell',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    }),
  });
  const json = await res.json() as { data?: { url?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`OpenRouter error: ${json.error?.message ?? JSON.stringify(json)}`);
  const url = json.data?.[0]?.url;
  if (!url) throw new Error('OpenRouter returned no image URL.');
  return url;
}

async function generateNvidiaFlux(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://integrate.api.nvidia.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'black-forest-labs/flux-schnell',
      prompt,
      n: 1,
      size: '1024x1024',
    }),
  });
  const json = await res.json() as { data?: { url?: string; b64_json?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`NVIDIA NIM error: ${json.error?.message ?? JSON.stringify(json)}`);
  const item = json.data?.[0];
  if (item?.url) return item.url;
  if (item?.b64_json) return `data:image/jpeg;base64,${item.b64_json}`;
  throw new Error('NVIDIA NIM returned no image.');
}

async function generateGoogleImagen(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '1:1' },
      }),
    },
  );
  const json = await res.json() as { predictions?: { bytesBase64Encoded?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`Google Imagen error: ${json.error?.message ?? JSON.stringify(json)}`);
  const b64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Google Imagen returned no image.');
  return `data:image/png;base64,${b64}`;
}

const IMAGE_GENERATORS: Record<string, (p: string, k: string) => Promise<string>> = {
  'novita-ai':         generateNovita,
  openrouter:          generateOpenRouter,
  'nvidia-nim':        generateNvidiaFlux,
  'google-ai-studio':  generateGoogleImagen,
};

// ── POST /api/image ──────────────────────────────────────────────────────────
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

    const generator = IMAGE_GENERATORS[provider];
    if (!generator) {
      // Try Novita as universal fallback
      return NextResponse.json({
        error: `Image generation is supported with: Novita AI, OpenRouter, NVIDIA NIM, or Google AI Studio. Current provider: ${provider}`,
      }, { status: 400 });
    }

    const imageUrl = await generator(prompt.trim(), apiKey.trim());
    return NextResponse.json({ url: imageUrl, type: 'image' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/image]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
