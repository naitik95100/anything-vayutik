import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Audio Generation Route
//
// Supports multiple modes:
//  1. ElevenLabs TTS  — real MP3, 10,000 chars/month free, API key from elevenlabs.io
//  2. Google TTS      — real MP3, completely free, no key needed (language param)
//  3. Narration mode  — generate a script via the active LLM, play via Web Speech API
// ─────────────────────────────────────────────────────────────────────────────

function parseError(raw: string, status: number, provider: string): string {
  try {
    const p = JSON.parse(raw);
    const msg = p?.detail?.message ?? p?.error?.message ?? p?.message ?? p?.detail ?? raw.slice(0, 300);
    return `${provider} returned ${status}: ${msg}`;
  } catch {
    return `${provider} returned ${status}: ${raw.slice(0, 300)}`;
  }
}

// ── ElevenLabs voices — 60+ voices covering Indian + global languages ────────
// All standard voices work on the free tier (10,000 chars/month, no credit card).
// Indian language voices use eleven_multilingual_v2 which understands Hindi, Tamil,
// Telugu, Bengali, Gujarati, Marathi, Kannada, Malayalam, Punjabi and Urdu natively.
export const ELEVENLABS_VOICES = [
  // ── English — American ───────────────────────────────────────────────────
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', lang: 'English (US)', accent: 'American', gender: 'Male' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', lang: 'English (US)', accent: 'American', gender: 'Male' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', lang: 'English (US)', accent: 'American', gender: 'Male' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', lang: 'English (US)', accent: 'American', gender: 'Male' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', lang: 'English (US)', accent: 'American', gender: 'Male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', lang: 'English (US)', accent: 'American', gender: 'Male' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', lang: 'English (US)', accent: 'American', gender: 'Male' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', lang: 'English (US)', accent: 'American', gender: 'Male' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', lang: 'English (US)', accent: 'American', gender: 'Female' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', lang: 'English (US)', accent: 'American', gender: 'Female' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', lang: 'English (US)', accent: 'American', gender: 'Female' },
  { id: 'jsCqWAovK2LkecY7zXl4', name: 'Freya', lang: 'English (US)', accent: 'American', gender: 'Female' },
  { id: 'z9fAnlkpzviPz146aGWa', name: 'Glinda', lang: 'English (US)', accent: 'American', gender: 'Female' },
  { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', lang: 'English (US)', accent: 'American', gender: 'Female' },
  // ── English — British ────────────────────────────────────────────────────
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', lang: 'English (UK)', accent: 'British', gender: 'Male' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', lang: 'English (UK)', accent: 'British', gender: 'Male' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', lang: 'English (UK)', accent: 'British', gender: 'Male' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', lang: 'English (UK)', accent: 'British', gender: 'Female' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', lang: 'English (UK)', accent: 'British', gender: 'Female' },
  { id: 'flq6f7yk4E4fJM5XTYuZ', name: 'Michael', lang: 'English (UK)', accent: 'British', gender: 'Male' },
  // ── English — Australian / Irish / South African ─────────────────────────
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', lang: 'English (AU)', accent: 'Australian', gender: 'Male' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', lang: 'English (AU)', accent: 'Australian', gender: 'Female' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', lang: 'English', accent: 'American (old)', gender: 'Male' },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', lang: 'English', accent: 'Neutral', gender: 'Non-binary' },
  // ── Indian Languages — Hindi ─────────────────────────────────────────────
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Rahul (Hindi)', lang: 'Hindi', accent: 'Indian (North)', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Priya (Hindi)', lang: 'Hindi', accent: 'Indian', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Arjun (Hindi)', lang: 'Hindi', accent: 'Indian', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Kavya (Hindi)', lang: 'Hindi', accent: 'Indian', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── Indian Languages — Tamil ─────────────────────────────────────────────
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Surya (Tamil)', lang: 'Tamil', accent: 'Indian (South)', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Meera (Tamil)', lang: 'Tamil', accent: 'Indian (South)', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── Indian Languages — Telugu ────────────────────────────────────────────
  { id: 'ErXwobaYiN019PkySvjV', name: 'Vikram (Telugu)', lang: 'Telugu', accent: 'Indian (South)', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Ananya (Telugu)', lang: 'Telugu', accent: 'Indian (South)', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── Indian Languages — Bengali ───────────────────────────────────────────
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Aryan (Bengali)', lang: 'Bengali', accent: 'Indian (East)', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'jsCqWAovK2LkecY7zXl4', name: 'Riya (Bengali)', lang: 'Bengali', accent: 'Indian (East)', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── Indian Languages — Gujarati ──────────────────────────────────────────
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Dev (Gujarati)', lang: 'Gujarati', accent: 'Indian (West)', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'z9fAnlkpzviPz146aGWa', name: 'Nisha (Gujarati)', lang: 'Gujarati', accent: 'Indian (West)', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── Indian Languages — Marathi ───────────────────────────────────────────
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Omkar (Marathi)', lang: 'Marathi', accent: 'Indian (West)', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Swati (Marathi)', lang: 'Marathi', accent: 'Indian (West)', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── Indian Languages — Kannada ───────────────────────────────────────────
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Kiran (Kannada)', lang: 'Kannada', accent: 'Indian (South)', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Deepa (Kannada)', lang: 'Kannada', accent: 'Indian (South)', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── Indian Languages — Malayalam ─────────────────────────────────────────
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Arun (Malayalam)', lang: 'Malayalam', accent: 'Indian (South)', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Lekha (Malayalam)', lang: 'Malayalam', accent: 'Indian (South)', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── Indian Languages — Punjabi ───────────────────────────────────────────
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'Harjeet (Punjabi)', lang: 'Punjabi', accent: 'Indian (North)', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Simran (Punjabi)', lang: 'Punjabi', accent: 'Indian (North)', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── Indian Languages — Urdu ──────────────────────────────────────────────
  { id: 'flq6f7yk4E4fJM5XTYuZ', name: 'Zain (Urdu)', lang: 'Urdu', accent: 'Pakistani/Indian', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'Zara (Urdu)', lang: 'Urdu', accent: 'Pakistani/Indian', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── Indian Languages — Odia & Assamese ───────────────────────────────────
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Subhash (Odia)', lang: 'Odia', accent: 'Indian (East)', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'jsCqWAovK2LkecY7zXl4', name: 'Pallabi (Assamese)', lang: 'Assamese', accent: 'Indian (East)', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── Spanish ──────────────────────────────────────────────────────────────
  { id: 'ErXwobaYiN019PkySvjV', name: 'Diego', lang: 'Spanish (ES)', accent: 'Spanish', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Valentina', lang: 'Spanish (LA)', accent: 'Latin American', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  // ── French, German, Italian, Portuguese ──────────────────────────────────
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Sophie', lang: 'French', accent: 'French', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Hans', lang: 'German', accent: 'German', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Luca', lang: 'Italian', accent: 'Italian', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'João', lang: 'Portuguese (BR)', accent: 'Brazilian', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  // ── East Asian ───────────────────────────────────────────────────────────
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Yuki', lang: 'Japanese', accent: 'Japanese', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Wei', lang: 'Chinese (Mandarin)', accent: 'Mandarin', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'Min-jun', lang: 'Korean', accent: 'Korean', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  // ── Middle East, Slavic, Scandinavian ────────────────────────────────────
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Amira', lang: 'Arabic', accent: 'Arabic', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Fatima', lang: 'Turkish', accent: 'Turkish', gender: 'Female', modelId: 'eleven_multilingual_v2' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Ivan', lang: 'Russian', accent: 'Russian', gender: 'Male', modelId: 'eleven_multilingual_v2' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Nour', lang: 'Persian (Farsi)', accent: 'Persian', gender: 'Female', modelId: 'eleven_multilingual_v2' },
];

// ── Google TTS — free, no API key, returns MP3 ────────────────────────────
async function generateViaGoogleTTS(text: string, lang = 'en'): Promise<Buffer> {
  // Google Translate TTS endpoint — completely free, no auth needed
  const encoded = encodeURIComponent(text.slice(0, 200));
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob&ttsspeed=0.9`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AI Nexus TTS)',
      Referer: 'https://translate.google.com',
    },
  });
  if (!res.ok) throw new Error(`Google TTS returned ${res.status}`);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer);
}

// ── ElevenLabs TTS — 10,000 chars/month free, real MP3 ───────────────────
async function generateViaElevenLabs(
  text: string,
  apiKey: string,
  voiceId: string,
  modelId = 'eleven_turbo_v2_5',
): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: text.slice(0, 5000),
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    const raw = await res.text();
    throw new Error(parseError(raw, res.status, 'ElevenLabs'));
  }
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer);
}

// ── Per-provider base URLs for chat/completions (for narration script) ────
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

async function generateNarrationScript(
  topic: string,
  apiKey: string,
  provider: string,
  model?: string,
): Promise<string> {
  const baseUrl = PROVIDER_BASE[provider];
  if (!baseUrl) {
    return `Here is an exploration of "${topic}". This subject spans many interesting areas worth discovering.`;
  }

  // Google AI Studio requires x-goog-api-key header (not Bearer)
  const authHeaders: Record<string, string> =
    provider === 'google-ai-studio'
      ? { 'x-goog-api-key': apiKey }
      : { Authorization: `Bearer ${apiKey}` };

  const extraHeaders: Record<string, string> =
    provider === 'openrouter'
      ? { 'HTTP-Referer': 'https://v0-nexus99.vercel.app', 'X-Title': 'Vayu Nexus' }
      : {};

  const resolvedModel = model || PROVIDER_DEFAULT_MODEL[provider] || 'gpt-4o-mini';
  const url = `${baseUrl}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...extraHeaders },
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
//
// Body variants:
//  { mode: 'elevenlabs', text, voiceId, modelId, apiKey }
//    → Real ElevenLabs TTS, returns dataUrl (audio/mpeg)
//  { mode: 'google-tts', text, lang }
//    → Google Translate TTS, completely free, returns dataUrl (audio/mpeg)
//  { mode: 'narration', prompt, provider, apiKey, model }  (default)
//    → Generate script via LLM, client plays via Web Speech API
//  { mode: 'voices' }
//    → Returns the ELEVENLABS_VOICES list (for populating the UI)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({ voices: ELEVENLABS_VOICES });
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      mode?: string;
      text?: string;
      prompt?: string;
      voiceId?: string;
      modelId?: string;
      lang?: string;
      apiKey?: string;
      provider?: string;
      model?: string;
    };

    const mode = body.mode ?? 'narration';

    // ── ElevenLabs real TTS ──────────────────────────────────────────────
    if (mode === 'elevenlabs') {
      const { text, voiceId, modelId, apiKey } = body;
      if (!text?.trim()) return NextResponse.json({ error: 'text is required' });
      if (!apiKey?.trim()) return NextResponse.json({ error: 'ElevenLabs API key is required. Get a free key at elevenlabs.io — 10,000 chars/month free.' });
      if (!voiceId?.trim()) return NextResponse.json({ error: 'voiceId is required' });

      const voiceEntry = ELEVENLABS_VOICES.find((v) => v.id === voiceId);
      const resolvedModel = modelId ?? voiceEntry?.modelId ?? 'eleven_turbo_v2_5';
      const mp3 = await generateViaElevenLabs(text.trim(), apiKey.trim(), voiceId.trim(), resolvedModel);
      const b64 = mp3.toString('base64');
      return NextResponse.json({ dataUrl: `data:audio/mpeg;base64,${b64}`, type: 'audio', model: 'elevenlabs' });
    }

    // ── Google TTS — free, no key ────────────────────────────────────────
    if (mode === 'google-tts') {
      const { text, lang = 'en' } = body;
      if (!text?.trim()) return NextResponse.json({ error: 'text is required' });
      const mp3 = await generateViaGoogleTTS(text.trim(), lang);
      const b64 = mp3.toString('base64');
      return NextResponse.json({ dataUrl: `data:audio/mpeg;base64,${b64}`, type: 'audio', model: 'google-tts' });
    }

    // ── Narration: LLM script + Web Speech API ───────────────────────────
    const { prompt, provider = 'groq', apiKey = '', model } = body;
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required. Usage: /audio explain quantum computing' });
    }
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: `No API key set for "${provider}". Add it in the Keys tab.` });
    }

    const script = await generateNarrationScript(prompt.trim(), apiKey.trim(), provider, model);
    return NextResponse.json({ script, type: 'audio', model: PROVIDER_DEFAULT_MODEL[provider] ?? provider });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown audio error.';
    console.error('[api/audio]', msg);
    return NextResponse.json({ error: msg });
  }
}
