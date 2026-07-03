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
      'X-Title': 'AI Nexus',
    },
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai',
    authHeader: 'bearer',
  },
  'google-ai-studio': {
    // Google provides an OpenAI-compatible shim
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    authHeader: 'bearer',
  },
  'nvidia-nim': {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    authHeader: 'bearer',
    chatPath: '/chat/completions', // base already has /v1, so final = /v1/chat/completions
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
  // Parse format: "https://base-url.com|optional-auth-key"
  // If no "|", treat the whole string as the URL and use no auth
  const pipeIdx = rawKey.indexOf('|');
  const baseUrl  = (pipeIdx > -1 ? rawKey.slice(0, pipeIdx) : rawKey).trim().replace(/\/$/, '');
  const authKey  = pipeIdx > -1 ? rawKey.slice(pipeIdx + 1).trim() : '';

  if (!baseUrl.startsWith('http')) {
    throw new Error(
      'Custom provider: enter your endpoint as "https://api.example.com|your-api-key" in the API Key field.',
    );
  }

  // Detect if Anthropic — uses x-api-key header
  const isAnthropic = baseUrl.includes('anthropic.com');
  const authHeaders: Record<string, string> = isAnthropic
    ? { 'x-api-key': authKey, 'anthropic-version': '2023-06-01' }
    : authKey
      ? { Authorization: `Bearer ${authKey}` }
      : {};

  const url = `${baseUrl}/v1/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, 'Custom Provider'));

  const json = JSON.parse(raw);
  const content = json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text;
  if (content !== undefined) return String(content);
  throw new Error(`Custom provider returned an unexpected format: ${raw.slice(0, 200)}`);
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

  // Google AI Studio: new OAuth tokens start with "AQ." and must be sent as ?key= URL param,
  // not as a Bearer header (which causes 403 PERMISSION_DENIED).
  // Standard AIza... API keys also work via ?key= param.
  const isGoogleStudio = providerId === 'google-ai-studio';
  const urlSuffix = isGoogleStudio ? `?key=${encodeURIComponent(apiKey)}` : '';
  const url = `${cfg.baseUrl}${path}${urlSuffix}`;

  let authHeaders: Record<string, string>;
  if (isGoogleStudio) {
    authHeaders = {}; // key is in URL param
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
    } = body as {
      message: string;
      provider: string;
      apiKey: string;
      history: { role: string; content: string }[];
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      model?: string;
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
    const cfg = CONFIGS[provider];
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

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemContent },
      ...history
        .slice(-20)
        .filter((m: { role: string; content: string }) => m.role && m.content)
        .map((m: { role: string; content: string }) => ({ role: m.role, content: String(m.content) })),
      { role: 'user', content: message },
    ];

    // ── Dispatch to correct handler ────────────────────────────────────────
    let content: string;

    if (provider === 'bytez') {
      content = await callBytez(apiKey, model, messages, temperature, maxTokens);
    } else if (provider === 'litellm') {
      content = await callLiteLLM(apiKey, model, messages, temperature, maxTokens);
    } else if (provider === 'custom') {
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
