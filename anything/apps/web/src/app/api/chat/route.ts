import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Per-provider server config
// ─────────────────────────────────────────────────────────────────────────────
interface ProviderConfig {
  /** Base URL — no trailing slash. Already includes any sub-path prefix. */
  baseUrl: string;
  /** Auth header style */
  authHeader: 'bearer' | 'x-api-key';
  /** Extra static headers (e.g. OpenRouter referrer) */
  extraHeaders?: Record<string, string>;
  /** Chat completions path, defaults to /v1/chat/completions */
  chatPath?: string;
}

const CONFIGS: Record<string, ProviderConfig> = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api',
    authHeader: 'bearer',
    extraHeaders: {
      'HTTP-Referer': 'https://v0-nexus99.vercel.app',
      'X-Title': 'Nexus Vayu',
    },
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai',
    authHeader: 'bearer',
  },
  'google-ai-studio': {
    // Google's OpenAI-compatible shim — base already includes /v1beta/openai,
    // so the chat path must NOT include another /v1 prefix.
    // Final URL = https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    authHeader: 'bearer', // overridden in callOpenAICompat for this provider
    chatPath: '/chat/completions',
  },
  'nvidia-nim': {
    // Base already includes /v1, so chatPath must be just /chat/completions
    // Final URL = https://integrate.api.nvidia.com/v1/chat/completions
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    authHeader: 'bearer',
    chatPath: '/chat/completions',
  },
  'novita-ai': {
    baseUrl: 'https://api.novita.ai/v3/openai',
    authHeader: 'bearer',
  },
  litellm: {
    // User pastes their proxy URL as the API key field, optionally separated by "|" for the auth key
    // e.g. "http://localhost:4000" or "https://proxy.example.com|sk-my-proxy-key"
    baseUrl: '__proxy__', // resolved at runtime
    authHeader: 'bearer',
  },
  bytez: {
    baseUrl: 'https://api.bytez.com/models/v2',
    authHeader: 'x-api-key',
    chatPath: '/chat', // prepended with model path at runtime
  },
  // Custom provider — baseUrl and auth key are parsed from the apiKey field at runtime
  // Format: "https://your-endpoint.com|optional-auth-key"
  custom: {
    baseUrl: '__custom__',
    authHeader: 'bearer',
  },
};

const DEFAULT_MODELS: Record<string, string> = {
  openrouter:         'meta-llama/llama-3.3-70b-instruct',
  groq:               'llama-3.3-70b-versatile',
  'google-ai-studio': 'gemini-2.5-flash',
  'nvidia-nim':       'meta/llama-3.1-8b-instruct',
  'novita-ai':        'meta-llama/llama-3.3-70b-instruct',
  litellm:            'gpt-4o',
  bytez:              'meta-llama/Llama-3.2-3B-Instruct',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function parseError(raw: string, status: number, provider: string): string {
  try {
    const p = JSON.parse(raw);
    const msg =
      p?.error?.message ??
      p?.message ??
      p?.detail ??
      p?.error ??
      raw.slice(0, 300);
    return `${provider} returned ${status}: ${msg}`;
  } catch {
    return `${provider} returned ${status}: ${raw.slice(0, 300)}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bytez — non-standard path and body format
// ─────────────────────────────────────────────────────────────────────────────
async function callBytez(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
): Promise<string> {
  // Bytez endpoint: /models/v2/{org}/{model}/chat
  // model IDs already include org slash, e.g. "meta-llama/Llama-3.2-3B-Instruct"
  const modelPath = model.includes('/') ? model : `meta-llama/${model}`;
  const url = `https://api.bytez.com/models/v2/${modelPath}/chat`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      messages,
      params: { max_new_tokens: maxTokens, temperature },
      stream: false,
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, 'Bytez'));

  const json = JSON.parse(raw);
  // Bytez may return OpenAI format or { output: string }
  const content =
    json?.choices?.[0]?.message?.content ??
    json?.output ??
    json?.generated_text;
  if (content !== undefined) return String(content);
  throw new Error(`Bytez returned an unexpected response format: ${raw.slice(0, 200)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom provider — user pastes "https://base-url.com|optional-auth-key"
// Auto-detects provider from URL; falls back to Bearer auth
// ─────────────────────────────────────────────────────────────────────────────
async function callCustom(
  rawKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
): Promise<string> {
  // Format: "https://base-url.com|your-api-key"  (pipe separates URL from key)
  // The URL may already include a path — we detect whether to append /v1/chat/completions
  const pipeIdx = rawKey.indexOf('|');
  const rawBase = (pipeIdx > -1 ? rawKey.slice(0, pipeIdx) : rawKey).trim().replace(/\/$/, '');
  const authKey = pipeIdx > -1 ? rawKey.slice(pipeIdx + 1).trim() : '';

  if (!rawBase.startsWith('http')) {
    throw new Error(
      'Custom provider: enter your endpoint as "https://api.example.com|your-api-key" in the API Key field.',
    );
  }

  // Detect provider-specific auth headers
  const isAnthropic = rawBase.includes('anthropic.com');
  const isGoogle    = rawBase.includes('googleapis.com') || rawBase.includes('generativelanguage');
  const authHeaders: Record<string, string> = isAnthropic
    ? { 'x-api-key': authKey, 'anthropic-version': '2023-06-01' }
    : isGoogle
      ? { 'x-goog-api-key': authKey }
      : authKey
        ? { Authorization: `Bearer ${authKey}` }
        : {};

  // Use a sensible model fallback when model is "auto" or empty
  const resolvedModel = (!model || model === 'auto') ? 'gpt-4o-mini' : model;

  // Try candidate URL paths in priority order.
  // If the base already ends with /chat/completions, use it directly.
  // Known provider shapes:
  //   OpenRouter:  https://openrouter.ai        → /api/v1/chat/completions
  //   MuleRouter:  https://api.mulerouter.ai     → /chat/completions (no /v1)
  //   OpenAI-compat: most                        → /v1/chat/completions
  let candidateUrls: string[];
  if (rawBase.endsWith('/chat/completions')) {
    candidateUrls = [rawBase];
  } else if (rawBase.endsWith('/v1')) {
    candidateUrls = [`${rawBase}/chat/completions`];
  } else if (rawBase.endsWith('/api')) {
    // e.g. https://openrouter.ai/api → /api/v1/chat/completions
    candidateUrls = [
      `${rawBase}/v1/chat/completions`,
      `${rawBase}/chat/completions`,
    ];
  } else if (rawBase.includes('openrouter.ai')) {
    candidateUrls = [
      `https://openrouter.ai/api/v1/chat/completions`,
    ];
  } else {
    candidateUrls = [
      `${rawBase}/v1/chat/completions`,
      `${rawBase}/chat/completions`,
      `${rawBase}/api/v1/chat/completions`,
    ];
  }

  const body = JSON.stringify({
    model: resolvedModel,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  });

  let lastErr = '';
  for (const url of candidateUrls) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body,
    });
    const raw = await res.text();
    // If server returns HTML (wrong path, reverse-proxy error page) treat as 404
    const isHtml = raw.trimStart().startsWith('<');
    if (!res.ok || isHtml) {
      lastErr = isHtml
        ? `Custom provider returned an HTML page at ${url} — wrong path? Try another endpoint format.`
        : parseError(raw, res.status, 'Custom Provider');
      // On 404 or HTML, try the next candidate URL
      if (res.status === 404 || isHtml) continue;
      // Any other error (401, 400, 500) — throw immediately
      throw new Error(lastErr);
    }
    const json = JSON.parse(raw);
    const content =
      json?.choices?.[0]?.message?.content ??
      json?.choices?.[0]?.text ??
      json?.response ??
      json?.content;
    if (content !== undefined) return String(content);
    throw new Error(`Custom provider returned an unexpected format: ${raw.slice(0, 200)}`);
  }

  throw new Error(lastErr || 'Custom provider: all endpoint paths returned 404. Check your base URL.');
}

// ─────────────────────────────────────────────────────────────────────────────
// LiteLLM proxy — user's proxy URL is in the apiKey field
// ─────────────────────────────────────────────────────────────────────────────
async function callLiteLLM(
  rawKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
): Promise<string> {
  // Format: "https://proxy.example.com|optional-auth-key"
  const [proxyUrl, authKey = 'no-key'] = rawKey.split('|').map((s) => s.trim());
  const base = proxyUrl.replace(/\/$/, '');
  const url = `${base}/v1/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authKey}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, 'LiteLLM'));

  const json = JSON.parse(raw);
  const content = json?.choices?.[0]?.message?.content;
  if (content !== undefined) return String(content);
  throw new Error(`LiteLLM returned an unexpected format: ${raw.slice(0, 200)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard OpenAI-compatible call
// ─────────────────────────────────────────────────────────────────────────────
async function callOpenAICompat(
  cfg: ProviderConfig,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
  providerId: string,
): Promise<string> {
  const path = cfg.chatPath ?? '/v1/chat/completions';
  const url = `${cfg.baseUrl}${path}`;

  // Google AI Studio: the OpenAI-compatible shim requires the key as
  // "x-goog-api-key" header — not "Authorization: Bearer" and not "?key=".
  // This works for both AIza... API keys and AQ.Ab... OAuth tokens.
  let authHeaders: Record<string, string>;
  if (providerId === 'google-ai-studio') {
    authHeaders = { 'x-goog-api-key': apiKey };
  } else if (cfg.authHeader === 'x-api-key') {
    authHeaders = { 'x-api-key': apiKey };
  } else {
    authHeaders = { Authorization: `Bearer ${apiKey}` };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(cfg.extraHeaders ?? {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, providerId));

  // Guard against HTML error pages (wrong endpoint, reverse proxy, etc.)
  if (raw.trimStart().startsWith('<')) {
    throw new Error(
      `${providerId} returned an HTML page instead of JSON. ` +
      `The endpoint URL may be wrong. Configured base: ${cfg.baseUrl}${cfg.chatPath ?? '/v1/chat/completions'}`,
    );
  }

  const json = JSON.parse(raw);
  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text;
  if (content !== undefined) return String(content);
  throw new Error(`Unexpected response format from ${providerId}: ${raw.slice(0, 200)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      message = '',
      provider: rawProvider = 'groq',
      apiKey: rawApiKey = '',
      history = [],
      systemPrompt,
      temperature = 0.7,
      maxTokens = 2048,
      model: rawModel,
      images = [], // base64 data URLs for vision models
    } = body as {
      message: string;
      provider: string;
      apiKey: string;
      history: { role: string; content: string }[];
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      model?: string;
      images?: string[];
    };

    const provider = rawProvider.trim();
    const apiKey   = rawApiKey.trim();
    const model    = (rawModel ?? '').trim() || DEFAULT_MODELS[provider] || 'gpt-4o-mini';

    // ── Guard: no API key ──────────────────────────────────────────────────
    if (!apiKey) {
      return NextResponse.json({
        content: `No API key set for "${provider}". Click the Keys tab in the right panel, select the provider, and paste your API key.`,
        type: 'text',
      });
    }

    // ── Guard: unknown provider ────────────────────────────────────────────
    // Allow both "custom" and "custom-*" (named custom providers)
    const isCustom = provider === 'custom' || provider.startsWith('custom-');
    const cfg = CONFIGS[provider] ?? (isCustom ? CONFIGS.custom : undefined);
    if (!cfg) {
      return NextResponse.json({
        content: `Provider "${provider}" is not configured. Supported providers: OpenRouter, Groq, Google AI Studio, NVIDIA NIM, Novita AI, LiteLLM, Bytez, or Custom. Use the Providers tab to select one.`,
        type: 'text',
      });
    }

    // ── Build messages array ───────────────────────────────────────────────
    const isCodeRequest =
      /\b(write|create|build|make|generate|show me)\b.*(code|function|component|class|script|app|program|snippet)/i.test(message) ||
      /\b(how to|how do i)\b.*\b(code|implement|program|build)\b/i.test(message);

    const systemContent =
      systemPrompt?.trim() ||
      (isCodeRequest
        ? `You are an elite full-stack engineer. When writing code:
- For HTML requests: produce a SINGLE complete self-contained HTML file with embedded CSS and JavaScript. Use modern CSS (flexbox/grid), smooth animations, and a polished professional UI. Never use placeholder comments — always write the full working implementation.
- For React/Next.js: write complete components with all imports, hooks, and logic included.
- For any language: produce production-quality code that actually runs — no TODOs, no placeholders, no omissions.
- Always wrap code in markdown fenced blocks with the correct language tag (\`\`\`html, \`\`\`jsx, \`\`\`python, etc.).
- After the code block, briefly explain what it does and how to use it.`
        : 'You are a helpful, knowledgeable AI assistant. Be accurate, concise and friendly. Format responses with clear structure when helpful.');

    // Build the user message — if images are attached, use the OpenAI vision
    // multipart content array format (works with GPT-4o, Gemini, Claude via OR).
    const userContent: string | { type: string; text?: string; image_url?: { url: string } }[] =
      images.length > 0
        ? [
            { type: 'text', text: message },
            ...images.map((dataUrl: string) => ({
              type: 'image_url',
              image_url: { url: dataUrl },
            })),
          ]
        : message;

    const messages: { role: string; content: unknown }[] = [
      { role: 'system', content: systemContent },
      ...history
        .slice(-20)
        .filter((m: { role: string; content: string }) => m.role && m.content)
        .map((m: { role: string; content: string }) => ({ role: m.role, content: String(m.content) })),
      { role: 'user', content: userContent },
    ];

    // ── Dispatch to correct handler ────────────────────────────────────────
    let content: string;

    if (provider === 'bytez') {
      content = await callBytez(apiKey, model, messages, temperature, maxTokens);
    } else if (provider === 'litellm') {
      content = await callLiteLLM(apiKey, model, messages, temperature, maxTokens);
    } else if (isCustom) {
      content = await callCustom(apiKey, model, messages, temperature, maxTokens);
    } else {
      content = await callOpenAICompat(cfg, apiKey, model, messages, temperature, maxTokens, provider);
    }

    // Detect code in response for correct rendering type
    const hasCodeBlock = /```[\w]*\n[\s\S]+?```/.test(content);
    const type = isCodeRequest && hasCodeBlock ? 'code' : 'text';

    return NextResponse.json({ content, type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('[chat/route]', msg);
    return NextResponse.json({ content: `Error: ${msg}`, type: 'text' });
  }
}
