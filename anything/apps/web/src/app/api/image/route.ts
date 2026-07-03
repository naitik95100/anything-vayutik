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
// Returns a direct image URL that works in <img> tags.
async function generateViaPollinations(prompt: string): Promise<string> {
  const encoded = encodeURIComponent(prompt);
  // Use fetch to validate the URL resolves (it redirects to the actual image)
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&enhance=true`;
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) throw new Error(`Pollinations.AI returned ${res.status}`);
  return url;
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
      case 'openrouter':
      case 'groq':
      case 'custom':
      default:
        // Pollinations.AI — completely free, no API key or credits required
        url = await generateViaPollinations(prompt.trim());
        break;
    }

    return NextResponse.json({ url, type: 'image' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown image generation error.';
    console.error('[api/image]', msg);
    return NextResponse.json({ error: msg });
  }
}
