import { NextResponse } from 'next/server';

// Audio generation
// Primary: generate a spoken narration script via the active LLM provider,
// then the client AudioPlayer reads it aloud using the browser's Web Speech API.
// This works with EVERY provider (OpenRouter, Groq, Google, NVIDIA, etc.) since
// it just calls chat/completions — no special audio endpoint needed.

function parseError(raw: string, status: number, provider: string): string {
  try {
    const p = JSON.parse(raw);
    const msg = p?.error?.message ?? p?.message ?? p?.detail ?? raw.slice(0, 300);
    return `${provider} returned ${status}: ${msg}`;
  } catch {
    return `${provider} returned ${status}: ${raw.slice(0, 300)}`;
  }
}

// ── Per-provider base URLs for chat/completions ───────────────────────────
const PROVIDER_BASE: Record<string, string> = {
  openrouter:         'https://openrouter.ai/api/v1',
  groq:               'https://api.groq.com/openai/v1',
  'google-ai-studio': 'https://generativelanguage.googleapis.com/v1beta/openai/v1',
  'nvidia-nim':       'https://integrate.api.nvidia.com/v1',
  'novita-ai':        'https://api.novita.ai/v3/openai/v1',
};

const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  openrouter:         'meta-llama/llama-3.3-70b-instruct',
  groq:               'llama-3.3-70b-versatile',
  'google-ai-studio': 'gemini-2.5-flash',
  'nvidia-nim':       'meta/llama-3.1-8b-instruct',
  'novita-ai':        'meta-llama/llama-3.3-70b-instruct',
};

// ── Generate a narration script via the user's active LLM provider ────────
async function generateNarrationScript(
  topic: string,
  apiKey: string,
  provider: string,
  model?: string,
): Promise<string> {
  const baseUrl = PROVIDER_BASE[provider];
  if (!baseUrl) {
    // For unknown/custom providers, return a simple script
    return `Here is a fascinating exploration of "${topic}". This subject spans many interesting areas worth discovering. The more you learn about it, the more intriguing it becomes.`;
  }

  // Google AI Studio uses the key as a query param when it looks like OAuth token
  const isGoogleOAuth = provider === 'google-ai-studio' && apiKey.startsWith('AQ.');
  const authHeaders: Record<string, string> = isGoogleOAuth
    ? {} // will append ?key= below
    : { Authorization: `Bearer ${apiKey}` };

  const extraHeaders: Record<string, string> =
    provider === 'openrouter'
      ? { 'HTTP-Referer': 'https://v0-nexus99.vercel.app', 'X-Title': 'AI Nexus' }
      : {};

  const resolvedModel = model || PROVIDER_DEFAULT_MODEL[provider] || 'gpt-4o-mini';
  const urlSuffix = isGoogleOAuth ? `?key=${apiKey}` : '';
  const url = `${baseUrl}/chat/completions${urlSuffix}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [
        {
          role: 'system',
          content:
            'You write concise spoken narration scripts. No markdown, no bullet points, no asterisks — only natural flowing prose meant to be read aloud. Keep it to 2–3 paragraphs, about 150 words total.',
        },
        { role: 'user', content: `Write a short narration script to be spoken aloud about: ${topic}` },
      ],
      temperature: 0.8,
      max_tokens: 400,
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, provider));
  const json = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${provider} returned an empty narration script.`);
  return content;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/audio
// Body: { prompt: string, provider: string, apiKey: string, model?: string }
// Returns: { script: string, type: 'audio', model: string }
// The client AudioPlayer will speak the script via Web Speech API.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { prompt, provider, apiKey, model } = await req.json() as {
      prompt: string;
      provider: string;
      apiKey: string;
      model?: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required. Usage: /audio explain quantum computing' });
    }
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: `No API key set for "${provider}". Add it in the Keys tab.` });
    }

    const script = await generateNarrationScript(prompt.trim(), apiKey.trim(), provider, model);
    return NextResponse.json({ script, type: 'audio', model: PROVIDER_DEFAULT_MODEL[provider] ?? provider });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown audio generation error.';
    console.error('[api/audio]', msg);
    return NextResponse.json({ error: msg });
  }
}
