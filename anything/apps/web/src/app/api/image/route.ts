import { NextResponse } from 'next/server';

function parseError(raw: string, status: number, provider: string): string {
  try {
    const p = JSON.parse(raw);
    const msg = p?.error?.message ?? p?.message ?? p?.detail ?? raw.slice(0, 300);
    return `${provider} returned ${status}: ${msg}`;
  } catch {
    return `${provider} returned ${status}: ${raw.slice(0, 300)}`;
  }
}

// ── Pollinations.AI — Truly free, no API key needed ───────────────────────
// Returns a direct image URL — Pollinations serves images via GET redirect,
// so we just return the URL and let the browser render it directly.
function generateViaPollinations(prompt: string): string {
  const encoded = encodeURIComponent(prompt.trim());
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&enhance=true&model=flux`;
}

// ── Replicate — FLUX Schnell image (free $10 trial credit) ───────────────
async function generateViaReplicate(prompt: string, apiKey: string): Promise<string> {
  const createRes = await fetch(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Prefer: 'wait=60',
      },
      body: JSON.stringify({ input: { prompt, num_outputs: 1, output_format: 'webp' } }),
    },
  );
  const createRaw = await createRes.text();
  if (!createRes.ok) throw new Error(parseError(createRaw, createRes.status, 'Replicate'));

  const prediction = JSON.parse(createRaw) as {
    status?: string;
    output?: string | string[];
    urls?: { get?: string };
    error?: string;
  };

  if (prediction.status === 'succeeded') {
    const out = prediction.output;
    const url = Array.isArray(out) ? out[0] : out;
    if (url) return url as string;
  }

  // Poll if not completed inline
  const pollUrl = prediction.urls?.get;
  if (!pollUrl) throw new Error(`Replicate returned no poll URL: ${createRaw.slice(0, 300)}`);

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const pollRes = await fetch(pollUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
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
      throw new Error(`Replicate image failed: ${pollJson.error ?? 'unknown'}`);
    }
  }
  throw new Error('Replicate image generation timed out.');
}

// ── Novita AI — async txt2img + polling ───────────────────────────────────
async function pollNovitaImage(taskId: string, apiKey: string): Promise<string> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`https://api.novita.ai/v3/async/task-result?task_id=${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const json = await res.json() as {
      task?: { status?: string };
      images?: { image_url?: string }[];
      images_encoded?: string[];
    };
    const status = json?.task?.status;
    if (status === 'TASK_STATUS_SUCCEED') {
      const url = json.images?.[0]?.image_url;
      const b64 = json.images_encoded?.[0];
      if (url) return url;
      if (b64) return `data:image/jpeg;base64,${b64}`;
      throw new Error('Novita succeeded but returned no image data.');
    }
    if (status === 'TASK_STATUS_FAILED') throw new Error('Novita image generation failed.');
  }
  throw new Error('Novita image generation timed out after 90 seconds.');
}

async function generateViaNovita(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.novita.ai/v3/async/txt2img', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      extra: { response_image_type: 'jpeg' },
      request: {
        model_name: 'flux1-schnell-fp8_2081908',
        prompt,
        negative_prompt: 'blurry, low quality',
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
  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, 'Novita'));
  const json = JSON.parse(raw) as { task_id?: string; message?: string };
  if (!json.task_id) throw new Error(`Novita did not return a task_id: ${raw.slice(0, 200)}`);
  return pollNovitaImage(json.task_id, apiKey);
}

// ── NVIDIA NIM — FLUX Dev ─────────────────────────────────────────────────
async function generateViaNvidia(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://integrate.api.nvidia.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'black-forest-labs/flux-dev',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, 'NVIDIA NIM'));
  const json = JSON.parse(raw) as { data?: { url?: string; b64_json?: string }[] };
  const item = json.data?.[0];
  if (item?.url) return item.url;
  if (item?.b64_json) return `data:image/jpeg;base64,${item.b64_json}`;
  throw new Error('NVIDIA NIM returned no image data.');
}

// ── Google AI Studio — Imagen 3 ───────────────────────────────────────────
async function generateViaGoogle(prompt: string, apiKey: string): Promise<string> {
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
  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, 'Google Imagen'));
  const json = JSON.parse(raw) as { predictions?: { bytesBase64Encoded?: string; mimeType?: string }[] };
  const pred = json.predictions?.[0];
  if (!pred?.bytesBase64Encoded) throw new Error('Google Imagen returned no image data.');
  return `data:${pred.mimeType ?? 'image/png'};base64,${pred.bytesBase64Encoded}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/image
// Body: { prompt: string, provider: string, apiKey: string }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { prompt, provider, apiKey } = await req.json() as {
      prompt: string;
      provider: string;
      apiKey: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required. Usage: /image a sunset over mountains' });
    }
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: `No API key set for "${provider}". Add it in the Keys tab on the right panel.` });
    }

    let url: string;

    switch (provider) {
      case 'novita-ai':
        url = await generateViaNovita(prompt.trim(), apiKey.trim());
        break;
      case 'nvidia-nim':
        url = await generateViaNvidia(prompt.trim(), apiKey.trim());
        break;
      case 'google-ai-studio':
        url = await generateViaGoogle(prompt.trim(), apiKey.trim());
        break;
      case 'replicate':
        url = await generateViaReplicate(prompt.trim(), apiKey.trim());
        break;
      case 'openrouter':
      case 'groq':
      case 'luma-ai':
      case 'custom':
      default:
        // Pollinations.AI — completely free, no API key or credits required.
        // Returns a URL the browser loads directly as <img src>.
        url = generateViaPollinations(prompt.trim());
        break;
    }

    return NextResponse.json({ url, type: 'image' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown image generation error.';
    console.error('[api/image]', msg);
    return NextResponse.json({ error: msg });
  }
}
