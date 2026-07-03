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

// ── IMAGE MODELS — free, no credit card required ───────────────────────────
// Listed here for UI reference and routing
export const FREE_IMAGE_MODELS = [
  {
    id: 'pollinations-flux',
    name: 'FLUX (Pollinations)',
    provider: 'pollinations',
    description: 'Black Forest Labs FLUX via Pollinations — completely free, no key',
    free: true,
    quality: 'Excellent',
  },
  {
    id: 'pollinations-turbo',
    name: 'FLUX Turbo (Pollinations)',
    provider: 'pollinations',
    pollinationsModel: 'turbo',
    description: 'Faster FLUX variant on Pollinations — free, no key',
    free: true,
    quality: 'Fast',
  },
  {
    id: 'pollinations-stable-diffusion',
    name: 'Stable Diffusion 3.5 (Pollinations)',
    provider: 'pollinations',
    pollinationsModel: 'stable-diffusion-3.5-large',
    description: 'Stability AI SD 3.5 via Pollinations — free, no key',
    free: true,
    quality: 'Good',
  },
  {
    id: 'pollinations-gptimage',
    name: 'GPT-Image-1 (Pollinations)',
    provider: 'pollinations',
    pollinationsModel: 'gptimage',
    description: 'OpenAI GPT-Image via Pollinations — free, no key',
    free: true,
    quality: 'Premium',
  },
  {
    id: 'replicate-flux-schnell',
    name: 'FLUX Schnell (Replicate)',
    provider: 'replicate',
    description: 'Ultra-fast FLUX Schnell on Replicate — $0.003/image, $10 free trial',
    free: true,
    quality: 'Excellent',
  },
  {
    id: 'novita-flux',
    name: 'FLUX Schnell (Novita AI)',
    provider: 'novita-ai',
    description: 'FLUX Schnell on Novita AI — generous free credits',
    free: true,
    quality: 'Excellent',
  },
  {
    id: 'nvidia-flux-dev',
    name: 'FLUX Dev (NVIDIA NIM)',
    provider: 'nvidia-nim',
    description: 'FLUX Dev on NVIDIA — 1000 free credits on sign-up',
    free: true,
    quality: 'Premium',
  },
  {
    id: 'google-imagen3',
    name: 'Imagen 3 (Google AI Studio)',
    provider: 'google-ai-studio',
    description: "Google's best image model — free tier with API key",
    free: true,
    quality: 'Premium',
  },
];

// ── Pollinations.AI — Truly free, no API key needed ───────────────────────
// Returns a direct image URL — Pollinations serves images via GET redirect,
// so we just return the URL and let the browser render it directly.
function generateViaPollinations(prompt: string, model = 'flux'): string {
  const encoded = encodeURIComponent(prompt.trim());
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&enhance=true&model=${model}&seed=${Math.floor(Math.random() * 999999)}`;
}

// ── Custom Provider — Call user's OpenAI-compatible endpoint ─────────────
async function generateViaCustom(prompt: string, rawKey: string): Promise<string> {
  // Parse format: "https://base-url.com|optional-auth-key"
  const pipeIdx = rawKey.indexOf('|');
  const rawBase = (pipeIdx > -1 ? rawKey.slice(0, pipeIdx) : rawKey).trim().replace(/\/$/, '');
  const authKey = pipeIdx > -1 ? rawKey.slice(pipeIdx + 1).trim() : '';

  if (!rawBase.startsWith('http')) {
    throw new Error(
      'Custom provider: enter endpoint as "https://api.example.com|your-api-key" in API Key field.',
    );
  }

  // Try common image generation patterns for custom endpoints
  const imageEndpoints = [
    `${rawBase}/images/generations`,      // OpenAI-style
    `${rawBase}/v1/images/generations`,   // OpenAI with /v1 prefix
    `${rawBase}/generate`,                 // Short endpoint
  ];

  const authHeaders: Record<string, string> = authKey
    ? { Authorization: `Bearer ${authKey}` }
    : {};

  for (const endpoint of imageEndpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          prompt,
          model: 'auto',
          n: 1,
          size: '1024x1024',
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) continue; // Try next endpoint

      const json = await res.json() as {
        data?: { url?: string; b64_json?: string }[];
        images?: string[];
        url?: string;
        image?: string;
      };

      // Try various response formats
      const imageUrl = json.data?.[0]?.url ||
                       json.data?.[0]?.b64_json ||
                       json.images?.[0] ||
                       json.url ||
                       json.image;

      if (imageUrl) {
        // If it's base64, convert to data URL
        if (typeof imageUrl === 'string' && imageUrl.startsWith('/9j')) {
          return `data:image/jpeg;base64,${imageUrl}`;
        }
        if (typeof imageUrl === 'string' && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
          return `data:image/png;base64,${imageUrl}`;
        }
        return imageUrl as string;
      }
    } catch (_err) {
      // Continue to next endpoint
      continue;
    }
  }

  throw new Error(
    'Custom provider image generation failed. Ensure endpoint accepts POST with { prompt, model, n, size } and returns { data[0].url } or similar.',
  );
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
// ─────────────────────��───────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { prompt, provider, apiKey, imageModel } = await req.json() as {
      prompt: string;
      provider: string;
      apiKey: string;
      imageModel?: string; // optional specific model override
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required. Usage: /image a sunset over mountains' });
    }

    let url: string;

    // If imageModel maps to a specific Pollinations variant, use that
    const pollinationsModelMap: Record<string, string> = {
      'pollinations-flux':             'flux',
      'pollinations-turbo':            'turbo',
      'pollinations-stable-diffusion': 'stable-diffusion-3.5-large',
      'pollinations-gptimage':         'gptimage',
    };

    const pollinationsModel = imageModel ? pollinationsModelMap[imageModel] : undefined;

    // Provider-aware routing
    switch (provider) {
      case 'novita-ai':
        if (!apiKey?.trim()) {
          // Fall back to Pollinations if no key
          url = generateViaPollinations(prompt.trim());
        } else {
          url = await generateViaNovita(prompt.trim(), apiKey.trim());
        }
        break;
      case 'nvidia-nim':
        if (!apiKey?.trim()) {
          url = generateViaPollinations(prompt.trim());
        } else {
          url = await generateViaNvidia(prompt.trim(), apiKey.trim());
        }
        break;
      case 'google-ai-studio':
        if (!apiKey?.trim()) {
          url = generateViaPollinations(prompt.trim());
        } else {
          url = await generateViaGoogle(prompt.trim(), apiKey.trim());
        }
        break;
      case 'replicate':
        if (!apiKey?.trim()) {
          url = generateViaPollinations(prompt.trim());
        } else {
          url = await generateViaReplicate(prompt.trim(), apiKey.trim());
        }
        break;
      case 'custom':
        // Custom provider — use the same logic as chat route
        if (!apiKey?.trim()) {
          url = generateViaPollinations(prompt.trim());
        } else {
          url = await generateViaCustom(prompt.trim(), apiKey.trim());
        }
        break;
      case 'openrouter':
      case 'groq':
      case 'luma-ai':
      default:
        // Pollinations.AI — completely free, no API key or credits required.
        // If a specific imageModel was requested (pollinations-* IDs), use its model.
        url = generateViaPollinations(prompt.trim(), pollinationsModel ?? 'flux');
        break;
    }

    return NextResponse.json({ url, type: 'image' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown image generation error.';
    console.error('[api/image]', msg);
    return NextResponse.json({ error: msg });
  }
}
