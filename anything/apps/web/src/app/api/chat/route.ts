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
};

const DEFAULT_MODELS: Record<string, string> = {
  openrouter:         'openai/gpt-4o-mini',
  groq:               'llama-3.3-70b-versatile',
  'google-ai-studio': 'gemini-2.0-flash',
  'nvidia-nim':       'meta/llama-3.3-70b-instruct',
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

  const authHeaders: Record<string, string> =
    cfg.authHeader === 'x-api-key'
      ? { 'x-api-key': apiKey }
      : { Authorization: `Bearer ${apiKey}` };

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
        content: `Provider "${provider}" is not supported. Choose from: OpenRouter, Groq, Google AI Studio, NVIDIA NIM, Novita AI, LiteLLM, or Bytez.`,
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
        ? 'You are an expert programmer. Provide complete, runnable code inside markdown fenced code blocks with the correct language identifier.'
        : 'You are a helpful, knowledgeable AI assistant. Be accurate, concise and friendly.');

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
