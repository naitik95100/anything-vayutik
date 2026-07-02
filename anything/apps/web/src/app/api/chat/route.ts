export async function POST(request: Request) {
  try {
    const { message, provider, history, systemPrompt, temperature, maxTokens, apiKey, model } =
      await request.json();

    const BASE = process.env.NEXT_PUBLIC_CREATE_BASE_URL;
    const TOKEN = process.env.ANYTHING_PROJECT_TOKEN;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    };

    // ── IMAGE GENERATION ─────────────────────────────────────────────────────
    if (message.startsWith('/image ') || message.startsWith('/imagine ')) {
      const prompt = message.replace(/^\/(image|imagine)\s+/, '').trim();
      try {
        const res = await fetch(`${BASE}/integrations/asset-generation`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt, imageSize: '2K', aspectRatio: '1:1', persist: true }),
        });
        const raw = await res.text();
        console.log('[image] status:', res.status, 'body:', raw.slice(0, 400));
        if (!res.ok) throw new Error(`asset-generation ${res.status}: ${raw.slice(0, 200)}`);
        const data = JSON.parse(raw);
        const url = data.imageUrl || data.url || data.image_url || data.src || '';
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
        const res = await fetch(`${BASE}/integrations/video-generation`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt, mode: 'text-to-video' }),
        });
        const raw = await res.text();
        console.log('[video] status:', res.status, 'body:', raw.slice(0, 400));
        if (!res.ok) throw new Error(`video-generation ${res.status}: ${raw.slice(0, 200)}`);
        const data = JSON.parse(raw);
        const url = data.videoUrl || data.url || data.video_url || data.src || '';
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
      const geminiRes = await fetch(`${BASE}/integrations/google-gemini-2-5-flash`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: [{ role: 'user', content: audioPrompt }] }),
      });
      const raw = await geminiRes.text();
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
      `You are an expert AI assistant powered by ${provider}. Be helpful, accurate, and concise.
${isCodeRequest ? 'When writing code, always wrap it in proper markdown code blocks with the language specified (e.g. \`\`\`html, \`\`\`javascript, \`\`\`python). For HTML/CSS/JS: write complete, self-contained code that can run immediately. Include all needed CSS and JS inline.' : ''}`;

    if (provider === 'nvidia-nim') {
      const key = apiKey || process.env.NVIDIA_API_KEY;
      if (!key) {
        throw new Error('NVIDIA API Key is missing. Please add it in settings.');
      }
      
      const nimModel = model || 'nvidia/llama-3.1-nemotron-70b';
      
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: nimModel,
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
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[nvidia-nim error]', response.status, errText);
        throw new Error(`NVIDIA NIM API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';
      
      const hasCodeBlock = /```[\w]*\n[\s\S]+?```/.test(content);
      const type = hasCodeBlock ? 'code' : 'text';

      return Response.json({ role: 'assistant', content, type });
    }

    const geminiRes = await fetch(`${BASE}/integrations/google-gemini-2-5-flash`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [
          { role: 'system', content: sysPrompt },
          ...(history || []).map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: message },
        ],
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 4096,
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[gemini error]', geminiRes.status, errText.slice(0, 400));
      throw new Error(`AI error ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const content =
      geminiData?.choices?.[0]?.message?.content ||
      geminiData?.text ||
      geminiData?.content ||
      geminiData?.response ||
      '';

    if (!content) {
      console.error('[gemini] empty response:', JSON.stringify(geminiData).slice(0, 400));
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
