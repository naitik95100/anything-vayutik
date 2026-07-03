// ─────────────────────────────────────────────────────────────────────────────
// Provider base URLs. Every key is the `id` from providers.ts.
// The base URL already includes any prefix that belongs before /v1/...
// so the final call is always: baseUrl + "/v1/chat/completions"
// (unless overridden in CUSTOM_PATH below).
// ─────────────────────────────────────────────────────────────────────────────
const PROVIDER_BASE_URLS: Record<string, string> = {
  // OpenAI
  'openai-gpt4o':     'https://api.openai.com',

  // Anthropic  (uses x-api-key + anthropic-version, handled below)
  'anthropic-claude': 'https://api.anthropic.com',

  // Google Gemini  (OpenAI-compatible shim — /v1beta/openai/v1/chat/completions)
  'google-gemini':    'https://generativelanguage.googleapis.com/v1beta/openai',

  // Groq
  groq:               'https://api.groq.com/openai',

  // Mistral / Codestral
  'mistral-ai':       'https://api.mistral.ai',
  codestral:          'https://codestral.mistral.ai',

  // Perplexity
  perplexity:         'https://api.perplexity.ai',

  // DeepSeek
  deepseek:           'https://api.deepseek.com',
  'deepseek-coder':   'https://api.deepseek.com',

  // xAI / Grok
  'xai-grok':         'https://api.x.ai',

  // Cohere
  cohere:             'https://api.cohere.ai/compatibility',

  // Together AI  (hosts Llama, Gemma, WizardCoder, StarCoder, Code Llama…)
  'together-ai':      'https://api.together.xyz',
  'meta-llama':       'https://api.together.xyz',
  'google-gemma':     'https://api.together.xyz',
  'code-llama':       'https://api.together.xyz',
  starcoder:          'https://api.together.xyz',
  'wizard-coder':     'https://api.together.xyz',

  // AI21 Labs
  'ai21-labs':        'https://api.ai21.com/studio',

  // Alibaba Qwen
  qwen:               'https://dashscope-intl.aliyuncs.com/compatible-mode',

  // Microsoft Phi  — hosted on HuggingFace inference
  'microsoft-phi':    'https://api-inference.huggingface.co/v1',

  // Upstage Solar
  'upstage-solar':    'https://api.upstage.ai',

  // Moonshot Kimi
  'moonshot-kimi':    'https://api.moonshot.cn',

  // NVIDIA NIM  — note: base already ends at /v1 so path becomes /v1/chat/completions
  'nvidia-nim':       'https://integrate.api.nvidia.com/v1',

  // HuggingFace
  huggingface:        'https://api-inference.huggingface.co/v1',

  // Azure OpenAI  — user must supply full endpoint as apiKey or endpoint param
  'azure-openai':     '', // handled via CUSTOM_PATH with env-level override

  // Amazon Bedrock / Vertex AI  — complex auth, degrade gracefully
  'amazon-bedrock':   '',
  'vertex-ai':        '',

  // Replicate  (OpenAI-compatible proxy)
  replicate:          'https://openai.on-replicate.com',
};

// Correct default model IDs that actually exist on each provider
const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  'openai-gpt4o':     'gpt-4o',
  'anthropic-claude': 'claude-3-5-sonnet-20241022',
  'google-gemini':    'gemini-2.5-flash',
  groq:               'llama-3.3-70b-versatile',
  'mistral-ai':       'mistral-large-latest',
  codestral:          'codestral-latest',
  perplexity:         'llama-3.1-sonar-large-128k-online',
  deepseek:           'deepseek-chat',
  'deepseek-coder':   'deepseek-coder-v2',
  'xai-grok':         'grok-3',
  cohere:             'command-r-plus-08-2024',
  'together-ai':      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  'meta-llama':       'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  'google-gemma':     'google/gemma-3-27b-it',
  'code-llama':       'codellama/CodeLlama-70b-Instruct-hf',
  starcoder:          'bigcode/starcoder2-15b-instruct-v0.1',
  'wizard-coder':     'WizardLM/WizardCoder-Python-34B-V1.0',
  'ai21-labs':        'jamba-1.5-large',
  qwen:               'qwen-plus',
  'microsoft-phi':    'microsoft/Phi-3.5-MoE-instruct',
  'moonshot-kimi':    'moonshot-v1-8k',
  'nvidia-nim':       'nvidia/llama-3.1-nemotron-70b-instruct',
  huggingface:        'meta-llama/Meta-Llama-3-70B-Instruct',
  replicate:          'meta/llama-2-70b-chat',
};

// Providers that use x-api-key header instead of Authorization: Bearer
const XAPI_KEY_PROVIDERS = new Set(['anthropic-claude', 'anthropic']);

// Providers that need a custom path instead of /v1/chat/completions
const CUSTOM_PATH: Record<string, string> = {
  'upstage-solar':    '/v1/chat/completions', // standard, explicit
  'inflection-pi':    '/v1/chat',
  'nvidia-nim':       '/chat/completions',    // base already has /v1 so final = /v1/chat/completions
};

// Image-generation providers and their direct API config
interface ImageProviderConfig {
  url: string;
  buildBody: (model: string, prompt: string) => Record<string, unknown>;
  extractUrl: (data: Record<string, unknown>) => string;
  authHeader?: 'authorization' | 'x-api-key';
}

const IMAGE_PROVIDERS: Record<string, ImageProviderConfig> = {
  'stability-ai': {
    url: 'https://api.stability.ai/v2beta/stable-image/generate/core',
    buildBody: (_model, prompt) => ({ prompt, output_format: 'webp' }),
    extractUrl: (d) => {
      // Stability returns base64 image in d.image
      if (d.image) return `data:image/webp;base64,${d.image}`;
      return (d as Record<string, unknown>).url as string ?? '';
    },
    authHeader: 'authorization',
  },
  dalle3: {
    url: 'https://api.openai.com/v1/images/generations',
    buildBody: (model, prompt) => ({ model: model || 'dall-e-3', prompt, n: 1, size: '1024x1024' }),
    extractUrl: (d) => ((d as Record<string, unknown[]>).data as Record<string,string>[])?.[0]?.url ?? '',
  },
  flux: {
    url: 'https://api.us1.bfl.ai/v1/flux-pro-1.1',
    buildBody: (_model, prompt) => ({ prompt, width: 1024, height: 1024 }),
    extractUrl: (d) => (d.sample as string) ?? '',
  },
  ideogram: {
    url: 'https://api.ideogram.ai/generate',
    buildBody: (model, prompt) => ({
      image_request: { prompt, model: model || 'V_2', aspect_ratio: 'ASPECT_1_1' },
    }),
    extractUrl: (d) => ((d as Record<string,unknown>).data as Record<string,string>[])?.[0]?.url ?? '',
    authHeader: 'x-api-key',
  },
  midjourney: {
    // Midjourney uses imagine.api as a common proxy
    url: 'https://api.userapi.ai/midjourney/v2/imagine',
    buildBody: (_model, prompt) => ({ prompt }),
    extractUrl: (d) => (d.result as string) ?? (d.uri as string) ?? '',
    authHeader: 'x-api-key',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: safe JSON parsing
// ─────────────────────────────────────────────────────────────────────────────
function extractError(raw: string): string {
  try {
    const p = JSON.parse(raw);
    return p?.error?.message ?? p?.message ?? raw.slice(0, 400);
  } catch {
    return raw.slice(0, 400);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Call any chat-completion provider
// ─────────────────────────────────────────────────────────────────────────────
async function callChatCompletion(
  provider: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature = 0.7,
  maxTokens = 2048
) {
  const baseUrl = PROVIDER_BASE_URLS[provider];

  // Provider with empty base URL = no direct API support yet
  if (baseUrl === '') {
    throw new Error(
      `"${provider}" requires complex authentication (AWS IAM / GCP credentials) that cannot be configured via a simple API key. Use a supported provider instead.`
    );
  }

  if (baseUrl) {
    if (!apiKey) {
      throw new Error(
        `No API key configured for "${provider}". Open the Keys tab and paste your key.`
      );
    }

    const path = CUSTOM_PATH[provider] ?? '/v1/chat/completions';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (XAPI_KEY_PROVIDERS.has(provider)) {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });

    const raw = await res.text();
    if (!res.ok) throw new Error(`${provider} returned ${res.status}: ${extractError(raw)}`);
    return JSON.parse(raw);
  }

  // Unknown provider — fall back to Vercel AI Gateway
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (!gatewayKey) {
    throw new Error(
      `Provider "${provider}" is not directly supported. Set AI_GATEWAY_API_KEY in Settings → Vars to enable gateway fallback.`
    );
  }
  const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gatewayKey}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`AI Gateway returned ${res.status}: ${extractError(raw)}`);
  return JSON.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Call an image-generation provider directly, or fall back to AI Gateway
// ─────────────────────────────────────────────────────────────────────────────
async function callImageGeneration(
  provider: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const cfg = IMAGE_PROVIDERS[provider];

  if (cfg && apiKey) {
    const authHeader = cfg.authHeader === 'x-api-key' ? 'x-api-key' : 'Authorization';
    const authValue  = cfg.authHeader === 'x-api-key' ? apiKey : `Bearer ${apiKey}`;

    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        [authHeader]: authValue,
      },
      body: JSON.stringify(cfg.buildBody(model, prompt)),
    });

    const raw = await res.text();
    if (!res.ok) throw new Error(`${provider} returned ${res.status}: ${extractError(raw)}`);
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); } catch { data = {}; }
    const url = cfg.extractUrl(data);
    if (url) return url;
    throw new Error(`${provider} returned no image URL.`);
  }

  // Fall back to Vercel AI Gateway
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (!gatewayKey) {
    throw new Error(
      'No image API key configured. Open the Keys tab and add a key for your image provider, or set AI_GATEWAY_API_KEY in Settings → Vars.'
    );
  }
  const res = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gatewayKey}`,
    },
    body: JSON.stringify({ prompt, model: 'google/imagen-4.0-generate-001', n: 1, size: '1024x1024' }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`AI Gateway returned ${res.status}: ${extractError(raw)}`);
  const data = JSON.parse(raw);
  return data?.data?.[0]?.url ?? data?.url ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const {
      message,
      history,
      systemPrompt,
      temperature,
      maxTokens,
      provider,
      apiKey,
      model,
    } = await request.json();

    const resolvedProvider = (provider as string) || 'openai-gpt4o';
    const resolvedApiKey   = ((apiKey as string) || '').trim();
    const resolvedModel    = ((model as string) || PROVIDER_DEFAULT_MODELS[resolvedProvider] || 'gpt-4o');

    // ── IMAGE GENERATION (via /image or /imagine command, or image-category provider) ──
    if (
      message.startsWith('/image ') ||
      message.startsWith('/imagine ') ||
      resolvedProvider in IMAGE_PROVIDERS
    ) {
      const rawPrompt = message
        .replace(/^\/(image|imagine)\s+/, '')
        .trim();
      const prompt = rawPrompt || message;

      const url = await callImageGeneration(resolvedProvider, resolvedApiKey, resolvedModel, prompt);
      if (!url) throw new Error('No image URL returned from the API.');
      return Response.json({
        role: 'assistant',
        content: `Here is your generated image for: "${prompt}"`,
        type: 'image',
        url,
      });
    }

    // ── VIDEO GENERATION ───────────────────────────────────────────────────
    if (message.startsWith('/video ')) {
      const prompt = message.replace('/video ', '').trim();
      const gatewayKey = process.env.AI_GATEWAY_API_KEY;
      if (!gatewayKey) throw new Error('Set AI_GATEWAY_API_KEY in Settings → Vars to enable video generation.');
      const res = await fetch('https://ai-gateway.vercel.sh/v1/videos/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gatewayKey}` },
        body: JSON.stringify({ prompt, model: 'luma/genie-2.5-generate-001' }),
      });
      const raw = await res.text();
      if (!res.ok) throw new Error(`Video generation returned ${res.status}: ${extractError(raw)}`);
      const data = JSON.parse(raw);
      const url = data?.data?.[0]?.url ?? data?.url ?? '';
      if (!url) throw new Error('No video URL returned from the API.');
      return Response.json({
        role: 'assistant',
        content: `Here is your generated video for: "${prompt}"`,
        type: 'video',
        url,
      });
    }

    // ── AUDIO NARRATION ──────────────────────────────────────────────────
    if (message.startsWith('/audio ')) {
      const topic = message.replace('/audio ', '').trim();
      const data = await callChatCompletion(
        resolvedProvider,
        resolvedApiKey,
        resolvedModel,
        [{ role: 'user', content: `Write a clear 2-3 paragraph narration script (30-60 seconds when read aloud) about: "${topic}". Write it as natural spoken words with no bullet points.` }],
        0.7,
        1024
      );
      const script = data?.choices?.[0]?.message?.content ?? '';
      if (!script) throw new Error('No audio script returned from the API.');
      return Response.json({ role: 'assistant', content: script, type: 'audio' });
    }

    // ── TEXT CHAT & CODE GENERATION ────────────────────────────────────────
    const isCodeRequest =
      message.startsWith('/code ') ||
      /\b(write|create|build|make|generate|show me)\b.*(code|function|component|class|script|app|program|snippet)/i.test(message) ||
      /\b(how to|how do i)\b.*\b(code|implement|program|build)\b/i.test(message);

    const sysPrompt =
      systemPrompt ||
      (isCodeRequest
        ? 'You are an expert programmer. Provide complete, runnable code inside markdown fenced code blocks with the language identifier (e.g. ```python, ```javascript).'
        : 'You are a helpful, knowledgeable AI assistant. Be concise, accurate, and friendly.');

    const data = await callChatCompletion(
      resolvedProvider,
      resolvedApiKey,
      resolvedModel,
      [
        { role: 'system', content: sysPrompt },
        ...(history ?? []).map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: message },
      ],
      temperature ?? 0.7,
      maxTokens ?? 2048
    );

    const content = data?.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('Empty response from the API.');

    const type = isCodeRequest && /```[\w]*\n[\s\S]+?```/.test(content) ? 'code' : 'text';
    return Response.json({ role: 'assistant', content, type });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('[chat route]', msg);
    return Response.json({ role: 'assistant', content: `Error: ${msg}`, type: 'text' });
  }
}
