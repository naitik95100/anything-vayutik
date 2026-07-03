// Map every provider ID (from the frontend) to its OpenAI-compatible base URL.
// Providers that use a non-standard auth header are listed in SPECIAL_AUTH.
const PROVIDER_BASE_URLS: Record<string, string> = {
  // ── Text / LLM providers ─────────────────────────────────────────────
  'openai-gpt4o':    'https://api.openai.com',
  openai:            'https://api.openai.com',
  'anthropic-claude':'https://api.anthropic.com',
  anthropic:         'https://api.anthropic.com',
  'google-gemini':   'https://generativelanguage.googleapis.com/v1beta/openai',
  groq:              'https://api.groq.com/openai',
  mistral:           'https://api.mistral.ai',
  'mistral-ai':      'https://api.mistral.ai',
  perplexity:        'https://api.perplexity.ai',
  deepseek:          'https://api.deepseek.com',
  'deepseek-coder':  'https://api.deepseek.com',
  'xai-grok':        'https://api.x.ai',
  cohere:            'https://api.cohere.ai/compatibility',
  'together-ai':     'https://api.together.xyz',
  'meta-llama':      'https://api.together.xyz',
  'ai21-labs':       'https://api.ai21.com/studio',
  qwen:              'https://dashscope-intl.aliyuncs.com/compatible-mode',
  'microsoft-phi':   'https://api.openai.com',
  'google-gemma':    'https://api.together.xyz',
  'upstage-solar':   'https://api.upstage.ai',
  'moonshot-kimi':   'https://api.moonshot.cn',
  'nvidia-nim':      'https://integrate.api.nvidia.com',
  'code-llama':      'https://api.together.xyz',
  'codestral':       'https://codestral.mistral.ai',
  'starcoder':       'https://api.together.xyz',
  'wizard-coder':    'https://api.together.xyz',
  'inflection-pi':   'https://api.inflection.ai',
  'aleph-alpha':     'https://api.aleph-alpha.com',
  huggingface:       'https://api-inference.huggingface.co/v1',
};

// Providers that use x-api-key header instead of Authorization: Bearer
const XAPI_KEY_PROVIDERS = new Set(['anthropic-claude', 'anthropic']);

// Providers whose /v1/chat/completions path differs
const CUSTOM_PATH: Record<string, string> = {
  'upstage-solar': '/v1/solar/chat/completions',
  'inflection-pi': '/v1/chat',
};

async function callChatCompletion(
  provider: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature = 0.7,
  maxTokens = 2048
) {
  const baseUrl = PROVIDER_BASE_URLS[provider];

  if (baseUrl) {
    if (!apiKey) {
      throw new Error(
        `No API key configured for "${provider}". Open the Keys tab on the right and paste your key.`
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
    if (!res.ok) {
      let detail = raw.slice(0, 500);
      try {
        const parsed = JSON.parse(raw);
        detail = parsed?.error?.message ?? detail;
      } catch { /* keep raw */ }
      throw new Error(`${provider} returned ${res.status}: ${detail}`);
    }
    return JSON.parse(raw);
  }

  // Unknown provider — fall back to Vercel AI Gateway
  const gatewayKey = apiKey || process.env.AI_GATEWAY_API_KEY;
  if (!gatewayKey) {
    throw new Error(
      'No API key available. Add your key in the Keys tab, or set AI_GATEWAY_API_KEY in Settings → Vars.'
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
  if (!res.ok) {
    let detail = raw.slice(0, 500);
    try {
      const parsed = JSON.parse(raw);
      detail = parsed?.error?.message ?? detail;
    } catch { /* keep raw */ }
    throw new Error(`AI Gateway returned ${res.status}: ${detail}`);
  }
  return JSON.parse(raw);
}

async function callAIGateway(endpoint: string, body: unknown) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI_GATEWAY_API_KEY is not set. Add it in Settings → Vars to enable image/video generation.'
    );
  }
  const res = await fetch(`https://ai-gateway.vercel.sh${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 500);
    try {
      const parsed = JSON.parse(raw);
      detail = parsed?.error?.message ?? detail;
    } catch { /* keep raw */ }
    throw new Error(`AI Gateway returned ${res.status}: ${detail}`);
  }
  return JSON.parse(raw);
}

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

    const resolvedProvider = (provider ?? 'openai-gpt4o') as string;
    const resolvedModel    = (model ?? 'gpt-4o') as string;
    const resolvedApiKey   = ((apiKey as string) ?? '').trim();

    // ── IMAGE GENERATION ───────────────────────────────────────────────────
    if (message.startsWith('/image ') || message.startsWith('/imagine ')) {
      const prompt = message.replace(/^\/(image|imagine)\s+/, '').trim();
      const data = await callAIGateway('/v1/images/generations', {
        prompt,
        model: 'google/imagen-4.0-generate-001',
        n: 1,
        size: '1024x1024',
      });
      const url = data?.data?.[0]?.url ?? data?.url ?? '';
      if (!url) throw new Error('No image URL in the API response.');
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
      const data = await callAIGateway('/v1/videos/generations', {
        prompt,
        model: 'luma/genie-2.5-generate-001',
      });
      const url = data?.data?.[0]?.url ?? data?.url ?? '';
      if (!url) throw new Error('No video URL in the API response.');
      return Response.json({
        role: 'assistant',
        content: `Here is your generated video for: "${prompt}"`,
        type: 'video',
        url,
      });
    }

    // ── AUDIO GENERATION ──────────────────────────────────────────────────
    if (message.startsWith('/audio ')) {
      const topic = message.replace('/audio ', '').trim();
      const data = await callChatCompletion(
        resolvedProvider,
        resolvedApiKey,
        resolvedModel,
        [{ role: 'user', content: `Write a clear 2–3 paragraph narration script (30–60 seconds when read aloud) about: "${topic}". Write it as natural spoken words, no bullet points.` }],
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
    // Return 200 with the error in content so the frontend can display it
    return Response.json({ role: 'assistant', content: `Error: ${msg}`, type: 'text' });
  }
}
