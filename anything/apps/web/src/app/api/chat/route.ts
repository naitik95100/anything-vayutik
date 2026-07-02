// Demo responses for when API key is not configured
const DEMO_RESPONSES: Record<string, string> = {
  image: 'Image generation requires the AI_GATEWAY_API_KEY to be set. Once configured, you can use /image <prompt> to generate beautiful images.',
  video: 'Video generation requires the AI_GATEWAY_API_KEY to be set. Once configured, you can use /video <prompt> to create videos.',
  audio: 'Audio script generation requires the AI_GATEWAY_API_KEY to be set. Once configured, you can use /audio <topic> to create narration scripts.',
  code: 'Code generation requires the AI_GATEWAY_API_KEY to be set. Once configured, you can use /code or natural language to get code examples.',
  chat: 'Chat functionality requires the AI_GATEWAY_API_KEY to be set. To enable it, add your API key to the environment variables.',
};

async function callAIGateway(endpoint: string, body: any) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error('API_KEY_NOT_SET');
  }

  const res = await fetch(`https://ai-gateway.vercel.sh${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`API Error ${res.status}: ${raw.slice(0, 200)}`);
  }

  return JSON.parse(raw);
}

export async function POST(request: Request) {
  try {
    const { message, provider, history, systemPrompt, temperature, maxTokens, apiKey, model } =
      await request.json();

    const apiKeyAvailable = !!process.env.AI_GATEWAY_API_KEY;

    // ── IMAGE GENERATION ─────────────────────────────────────────────────────
    if (message.startsWith('/image ') || message.startsWith('/imagine ')) {
      const prompt = message.replace(/^\/(image|imagine)\s+/, '').trim();
      
      if (!apiKeyAvailable) {
        return Response.json({
          role: 'assistant',
          content: DEMO_RESPONSES.image,
          type: 'text',
        });
      }

      try {
        const data = await callAIGateway('/v1/images/generations', {
          prompt,
          model: 'google/imagen-4.0-generate-001',
          n: 1,
          size: '1024x1024',
        });

        const url = data.data?.[0]?.url || data.url || '';
        if (!url) throw new Error('No image URL in response');

        return Response.json({
          role: 'assistant',
          content: `Here is your generated image for: "${prompt}"`,
          type: 'image',
          url,
        });
      } catch (e) {
        console.error('[image error]', e);
        return Response.json({
          role: 'assistant',
          content: `Image generation failed: ${(e as Error).message}`,
          type: 'text',
        });
      }
    }

    // ── VIDEO GENERATION ─────────────────────────────────────────────────────
    if (message.startsWith('/video ')) {
      const prompt = message.replace('/video ', '').trim();
      
      if (!apiKeyAvailable) {
        return Response.json({
          role: 'assistant',
          content: DEMO_RESPONSES.video,
          type: 'text',
        });
      }

      try {
        const data = await callAIGateway('/v1/videos/generations', {
          prompt,
          model: 'luma/genie-2.5-generate-001',
        });

        const url = data.data?.[0]?.url || data.url || '';
        if (!url) throw new Error('No video URL in response');

        return Response.json({
          role: 'assistant',
          content: `Here is your generated video for: "${prompt}"`,
          type: 'video',
          url,
        });
      } catch (e) {
        console.error('[video error]', e);
        return Response.json({
          role: 'assistant',
          content: `Video generation failed: ${(e as Error).message}`,
          type: 'text',
        });
      }
    }

    // ── AUDIO GENERATION ─────────────────────────────────────────────────────
    if (message.startsWith('/audio ')) {
      const topic = message.replace('/audio ', '').trim();
      
      if (!apiKeyAvailable) {
        return Response.json({
          role: 'assistant',
          content: DEMO_RESPONSES.audio,
          type: 'text',
        });
      }

      try {
        const data = await callAIGateway('/v1/chat/completions', {
          model: 'google/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: `Create a clear, engaging spoken narration script about: "${topic}". Write naturally as if being spoken aloud. Keep it to 2-3 paragraphs (30-60 seconds).`,
          }],
          temperature: 0.7,
          max_tokens: 1024,
        });

        const script = data?.choices?.[0]?.message?.content || topic;
        return Response.json({
          role: 'assistant',
          content: script,
          type: 'audio',
        });
      } catch (e) {
        console.error('[audio error]', e);
        return Response.json({
          role: 'assistant',
          content: `Audio generation failed: ${(e as Error).message}`,
          type: 'text',
        });
      }
    }

    // ── TEXT CHAT & CODE GENERATION ───────────────────────────────────────────
    if (!apiKeyAvailable) {
      return Response.json({
        role: 'assistant',
        content: DEMO_RESPONSES.chat,
        type: 'text',
      });
    }

    const isCodeRequest =
      message.startsWith('/code ') ||
      /\b(write|create|build|make|generate|show me)\b.*(code|function|component|class|script|app|program|snippet)/i.test(message) ||
      /\b(how to|how do i)\b.*\b(code|implement|program|build)\b/i.test(message);

    const sysPrompt = systemPrompt ||
      `You are an expert AI assistant. Be helpful, accurate, and concise.${
        isCodeRequest ? ' When writing code, wrap it in markdown code blocks with language specified (e.g. ```html, ```javascript, ```python). Write complete, runnable code.' : ''
      }`;

    try {
      const data = await callAIGateway('/v1/chat/completions', {
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: sysPrompt },
          ...(history || []).map((m: any) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: message },
        ],
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 2048,
      });

      const content = data?.choices?.[0]?.message?.content || '';
      if (!content) throw new Error('Empty response from AI');

      const hasCodeBlock = /```[\w]*\n[\s\S]+?```/.test(content);
      const type = hasCodeBlock ? 'code' : 'text';

      return Response.json({ role: 'assistant', content, type });
    } catch (e) {
      console.error('[chat error]', e);
      return Response.json({
        role: 'assistant',
        content: `Chat failed: ${(e as Error).message}`,
        type: 'text',
      });
    }
  } catch (error) {
    console.error('[route error]', error);
    return Response.json({
      role: 'assistant',
      content: `Error: ${(error as Error).message || 'Something went wrong'}. Please try again.`,
      type: 'text',
    }, { status: 200 });
  }
}
