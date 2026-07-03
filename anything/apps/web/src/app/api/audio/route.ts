import { NextResponse } from 'next/server';

// Audio generation — Google Lyria 2 via OpenRouter
// Returns a base64 data URI (audio/wav or audio/mp3) that the AudioPlayer component renders.

function parseError(raw: string, status: number, provider: string): string {
  try {
    const p = JSON.parse(raw);
    const msg = p?.error?.message ?? p?.message ?? p?.detail ?? raw.slice(0, 300);
    return `${provider} returned ${status}: ${msg}`;
  } catch {
    return `${provider} returned ${status}: ${raw.slice(0, 300)}`;
  }
}

// ── OpenRouter — Google Lyria 2 (music/audio generation) ─────────────────
async function generateViaLyria(prompt: string, apiKey: string): Promise<{ dataUrl: string; script?: string }> {
  const res = await fetch('https://openrouter.ai/api/v1/audio/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://v0-nexus99.vercel.app',
      'X-Title': 'AI Nexus',
    },
    body: JSON.stringify({
      model: 'google/lyria-2',
      prompt,
      n: 1,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, 'Lyria 2 (OpenRouter)'));

  const json = JSON.parse(raw) as {
    data?: { url?: string; b64_json?: string; audio_url?: string }[];
    audio?: string;
    url?: string;
  };

  // Various response shapes OpenRouter may return
  const item = json.data?.[0];
  if (item?.url) return { dataUrl: item.url };
  if (item?.audio_url) return { dataUrl: item.audio_url };
  if (item?.b64_json) return { dataUrl: `data:audio/wav;base64,${item.b64_json}` };
  if (json.audio) return { dataUrl: `data:audio/wav;base64,${json.audio}` };
  if (json.url) return { dataUrl: json.url };

  throw new Error('Lyria 2 returned no audio data. The model may still be in limited preview on OpenRouter.');
}

// ── Fallback: LLM-generated narration script (for non-OpenRouter providers)
// The client-side AudioPlayer will speak this text via the Web Speech API.
async function generateNarrationScript(topic: string, apiKey: string, provider: string): Promise<string> {
  const baseUrls: Record<string, string> = {
    groq: 'https://api.groq.com/openai',
    'google-ai-studio': 'https://generativelanguage.googleapis.com/v1beta/openai',
    'nvidia-nim': 'https://integrate.api.nvidia.com/v1',
    'novita-ai': 'https://api.novita.ai/v3/openai',
    litellm: '__skip__',
    bytez: '__skip__',
  };

  const defaultModels: Record<string, string> = {
    groq: 'llama-3.3-70b-versatile',
    'google-ai-studio': 'gemini-2.0-flash',
    'nvidia-nim': 'meta/llama-3.3-70b-instruct',
    'novita-ai': 'meta-llama/llama-3.3-70b-instruct',
  };

  const baseUrl = baseUrls[provider] ?? 'https://openrouter.ai/api';
  if (baseUrl === '__skip__') {
    return `Here is a narration about "${topic}": ${topic}. This topic is fascinating and worth exploring in depth. The Web Speech API will read this aloud.`;
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://v0-nexus99.vercel.app', 'X-Title': 'AI Nexus' } : {}),
    },
    body: JSON.stringify({
      model: defaultModels[provider] ?? 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You write concise spoken narration scripts. No markdown, no bullet points, only flowing prose meant to be read aloud. Keep it to 2-3 paragraphs.',
        },
        { role: 'user', content: `Write a narration script about: ${topic}` },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(parseError(raw, res.status, provider));
  const json = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? topic;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/audio
// Body: { prompt: string, provider: string, apiKey: string, model?: string }
// Returns: { dataUrl?, script?, type: 'audio' } | { error: string }
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
      return NextResponse.json({ error: 'Prompt is required. Usage: /audio jazz music with piano' });
    }
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: `No API key set for "${provider}". Add it in the Keys tab.` });
    }

    // Use Lyria 2 if model is audio generation or provider is OpenRouter
    const isLyriaRequest =
      model === 'google/lyria-2' ||
      provider === 'openrouter' ||
      provider === 'custom';

    if (isLyriaRequest) {
      const { dataUrl, script } = await generateViaLyria(prompt.trim(), apiKey.trim());
      return NextResponse.json({ dataUrl, script, type: 'audio', model: 'google/lyria-2' });
    }

    // For all other providers — generate a narration script, speak via Web Speech API on client
    const script = await generateNarrationScript(prompt.trim(), apiKey.trim(), provider);
    return NextResponse.json({ script, type: 'audio', model: 'tts-browser' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown audio generation error.';
    console.error('[api/audio]', msg);
    return NextResponse.json({ error: msg });
  }
}
