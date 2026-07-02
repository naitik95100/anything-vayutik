async function callAIGateway(endpoint: string, body: unknown) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI_GATEWAY_API_KEY is not set. Please add it in your project environment variables (Settings → Vars).'
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
    throw new Error(`AI Gateway responded with ${res.status}: ${raw.slice(0, 300)}`);
  }

  return JSON.parse(raw);
}

export async function POST(request: Request) {
  try {
    const { message, history, systemPrompt, temperature, maxTokens } =
      await request.json();

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

      const data = await callAIGateway('/v1/chat/completions', {
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: `Create a clear, engaging spoken narration script about: "${topic}". Write naturally as if being spoken aloud. Keep it to 2-3 paragraphs (30-60 seconds).`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      });

      const script = data?.choices?.[0]?.message?.content || '';
      if (!script) throw new Error('No audio script returned from the API.');

      return Response.json({
        role: 'assistant',
        content: script,
        type: 'audio',
      });
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

    const data = await callAIGateway('/v1/chat/completions', {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: sysPrompt },
        ...(history || []).map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: message },
      ],
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 2048,
    });

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
