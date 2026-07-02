export async function POST(request: Request) {
  try {
    const { message, provider, history, systemPrompt, temperature, maxTokens, apiKey, model } =
      await request.json();

    // ── IMAGE GENERATION ─────────────────────────────────────────────────────
    if (message.startsWith('/image ') || message.startsWith('/imagine ')) {
      const prompt = message.replace(/^\/(image|imagine)\s+/, '').trim();
      try {
        const res = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
          },
          body: JSON.stringify({
            prompt,
            model: 'google/imagen-4.0-generate-001',
            n: 1,
            size: '1024x1024',
          }),
        });
        const raw = await res.text();
        console.log('[image] status:', res.status, 'body:', raw.slice(0, 400));
        if (!res.ok) throw new Error(`image-generation ${res.status}: ${raw.slice(0, 200)}`);
        const data = JSON.parse(raw);
        const url = data.data?.[0]?.url || data.url || data.imageUrl || data.image_url || '';
        if (!url) throw new Error('No image URL in response: ' + raw.slice(0, 200));
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
          content: `Image generation failed: ${(e as Error).message}. Try a different prompt or check the service.`,
          type: 'text',
        });
      }
    }

    // ── VIDEO GENERATION ─────────────────────────────────────────────────────
    if (message.startsWith('/video ')) {
      const prompt = message.replace('/video ', '').trim();
      try {
        const res = await fetch('https://ai-gateway.vercel.sh/v1/videos/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
          },
          body: JSON.stringify({
            prompt,
            model: 'google/veo-3.1-generate-001',
          }),
        });
        const raw = await res.text();
        console.log('[video] status:', res.status, 'body:', raw.slice(0, 400));
        if (!res.ok) throw new Error(`video-generation ${res.status}: ${raw.slice(0, 200)}`);
        const data = JSON.parse(raw);
        const url = data.data?.[0]?.url || data.url || data.videoUrl || data.video_url || '';
        if (!url) throw new Error('No video URL in response: ' + raw.slice(0, 200));
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
          content: `Video generation failed: ${(e as Error).message}. Video generation can take up to 2 minutes — please try again.`,
          type: 'text',
        });
      }
    }

    // ── AUDIO GENERATION (TTS script) ─────────────────────────────────────────
    if (message.startsWith('/audio ')) {
      const topic = message.replace('/audio ', '').trim();
      const audioPrompt = `Create a clear, engaging spoken narration script about: "${topic}". 
Write it naturally as if being spoken aloud — conversational, vivid, and informative. 
Keep it to 2-3 paragraphs (about 30-60 seconds of speech). Do NOT include stage directions or formatting markers, just the pure spoken text.`;
      
      const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: audioPrompt }],
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 1024,
        }),
      });
      
      const raw = await res.text();
      if (!res.ok) throw new Error(`AI error ${res.status}: ${raw.slice(0, 200)}`);
      const data = JSON.parse(raw);
      const script = data?.choices?.[0]?.message?.content || data?.text || data?.content || topic;
      return Response.json({ role: 'assistant', content: script, type: 'audio' });
    }

    // ── CODE GENERATION ───────────────────────────────────────────────────────
    const isCodeRequest =
      message.startsWith('/code ') ||
      /\b(write|create|build|make|generate|show me)\b.*(code|function|component|class|script|app|program|snippet)/i.test(
        message
      ) ||
      /\b(how to|how do i)\b.*\b(code|implement|program|build)\b/i.test(message);

    const sysPrompt =
      systemPrompt ||
      `You are an expert AI assistant. Be helpful, accurate, and concise.
${isCodeRequest ? 'When writing code, always wrap it in proper markdown code blocks with the language specified (e.g. ```html, ```javascript, ```python). For HTML/CSS/JS: write complete, self-contained code that can run immediately. Include all needed CSS and JS inline.' : ''}`;

    // Use Vercel AI Gateway
    const aiRes = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
      },
      body: JSON.stringify({
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
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[ai error]', aiRes.status, errText.slice(0, 400));
      throw new Error(`AI error ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const content =
      aiData?.choices?.[0]?.message?.content ||
      aiData?.text ||
      aiData?.content ||
      aiData?.response ||
      '';

    if (!content) {
      console.error('[ai] empty response:', JSON.stringify(aiData).slice(0, 400));
      throw new Error('Empty response from AI');
    }

    const hasCodeBlock = /```[\w]*\n[\s\S]+?```/.test(content);
    const type = hasCodeBlock ? 'code' : 'text';

    return Response.json({ role: 'assistant', content, type });
  } catch (error) {
    console.error('[chat route error]', error);
    return Response.json(
      {
        role: 'assistant',
        content: `Error: ${(error as Error).message || 'Something went wrong'}. Please try again.`,
        type: 'text',
      },
      { status: 200 }
    );
  }
}
