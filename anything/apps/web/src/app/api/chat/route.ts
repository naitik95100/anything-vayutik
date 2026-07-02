// OpenAI-compatible base URLs for each provider
const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com',
  groq: 'https://api.groq.com/openai',
  mistral: 'https://api.mistral.ai',
  perplexity: 'https://api.perplexity.ai',
  deepseek: 'https://api.deepseek.com',
  'xai-grok': 'https://api.x.ai',
  cohere: 'https://api.cohere.ai/compatibility',
  'together-ai': 'https://api.together.xyz',
  'ai21-labs': 'https://api.ai21.com/studio',
  qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode',
  'google-gemini': 'https://generativelanguage.googleapis.com/v1beta/openai',
  anthropic: 'https://api.anthropic.com',
  'microsoft-phi': 'https://api.openai.com',
  'meta-llama': 'https://api.together.xyz',
};

async function callChatCompletion(
  provider: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature = 0.7,
  maxTokens = 2048
) {
  // Use the provider's own base URL, fall back to AI Gateway
  const baseUrl = PROVIDER_BASE_URLS[provider];

  if (baseUrl) {
    if (!apiKey) {
      throw new Error(
        `No API key found for "${provider}". Please add your key in the Keys tab on the right panel.`
      );
    }
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`${provider} API error ${res.status}: ${raw.slice(0, 400)}`);
    }
    return JSON.parse(raw);
  }

  // Unknown provider — try via AI Gateway
  const gatewayKey = apiKey || process.env.AI_GATEWAY_API_KEY;
  if (!gatewayKey) {
    throw new Error('No API key available. Please add a key in the Keys tab.');
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
    throw new Error(`AI Gateway error ${res.status}: ${raw.slice(0, 400)}`);
  }
  return JSON.parse(raw);
}

async function callAIGateway(endpoint: string, body: unknown) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI_GATEWAY_API_KEY is not set. Please add it in Settings → Vars.'
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
    throw new Error(`AI Gateway responded with ${res.status}: ${raw.slice(0, 400)}`);
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

    const resolvedProvider = (provider ?? 'openai') as string;
    const resolvedModel = (model ?? 'gpt-4o') as string;
    const resolvedApiKey = ((apiKey as string) ?? '').trim();

    // ── IMAGE GENERATION ───────────────────────────────────────────────────
    if (message.startsWith('/image ') || message.startsWith('/imagine ')) {
      const prompt = message.replace(/^\/(image|imagine)\s+/, '').trim();

      const data = await callAIGateway('/v1/images/generations', {
        prompt,
        model: 'google/imagen-4.0-generate-001',
        n: 1,
        size: '1024x1024',
      });

      const url = data?.data?.[0]?.url || data?.url || '';
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

      const data = await callAIGateway('/v1/videos/generations', {
        prompt,
        model: 'luma/genie-2.5-generate-001',
      });

      const url = data?.data?.[0]?.url || data?.url || '';
      if (!url) throw new Error('No video URL returned from the API.');

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
        [
          {
            role: 'user',
            content: `Create a clear, engaging spoken narration script about: "${topic}". Write naturally as if being spoken aloud. Keep it to 2-3 paragraphs (30-60 seconds when read aloud).`,
          },
        ],
        0.7,
        1024
      );

      const script = data?.choices?.[0]?.message?.content || '';
      if (!script) throw new Error('No audio script returned from the API.');

      return Response.json({ role: 'assistant', content: script, type: 'audio' });
    }

    // ── TEXT CHAT & CODE GENERATION ────────────────────────────────────────
    const isCodeRequest =
      message.startsWith('/code ') ||
      /\b(write|create|build|make|generate|show me)\b.*(code|function|component|class|script|app|program|snippet)/i.test(
        message
      ) ||
      /\b(how to|how do i)\b.*\b(code|implement|program|build)\b/i.test(message);

    const sysPrompt =
      systemPrompt ||
      (isCodeRequest
        ? 'You are an expert code assistant. Write complete, runnable code in markdown code blocks with the language specified (e.g. ```html, ```javascript, ```python).'
        : 'You are a helpful, friendly AI assistant. Be concise and accurate in your responses.');

    const data = await callChatCompletion(
      resolvedProvider,
      resolvedApiKey,
      resolvedModel,
      [
        { role: 'system', content: sysPrompt },
        ...(history || []).map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: message },
      ],
      temperature ?? 0.7,
      maxTokens ?? 2048
    );

    const content = data?.choices?.[0]?.message?.content || '';
    if (!content) throw new Error('No content returned from the API.');

    const type =
      isCodeRequest && /```[\w]*\n[\s\S]+?```/.test(content) ? 'code' : 'text';

    return Response.json({ role: 'assistant', content, type });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('[chat route error]', message);
    return Response.json(
      { role: 'assistant', content: `Error: ${message}`, type: 'text' },
      { status: 500 }
    );
  }
}
