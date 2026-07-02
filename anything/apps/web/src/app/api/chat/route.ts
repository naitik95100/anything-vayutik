// Generate intelligent mock responses based on request type
function generateMockImageResponse(prompt: string): string {
  const styles = ['photorealistic', 'oil painting', 'watercolor', 'digital art', 'surreal'];
  const randomStyle = styles[Math.floor(Math.random() * styles.length)];
  return `🎨 Generated image (${randomStyle} style): "${prompt}"\n\nNote: Image generation is running in demo mode. Connect an API key to generate real images.`;
}

function generateMockVideoResponse(prompt: string): string {
  const duration = Math.floor(Math.random() * 30) + 10;
  return `🎬 Generated video: "${prompt}"\n\nVideo Duration: ${duration}s\nFormat: MP4, 1080p\n\nNote: Video generation is running in demo mode. Connect an API key to generate real videos.`;
}

function generateMockAudioResponse(topic: string): string {
  const narratives: Record<string, string> = {
    'history': `Throughout human history, remarkable innovations have shaped our world. From ancient civilizations to modern technology, each era brought revolutionary changes. The story of progress continues as we discover new frontiers of knowledge and possibility.`,
    'science': `Science is the systematic study of the natural world through observation and experimentation. It has unlocked the secrets of atoms, stars, and life itself. Every scientific breakthrough brings us closer to understanding our universe.`,
    'technology': `Technology has transformed every aspect of human life. From the printing press to artificial intelligence, each innovation has expanded our capabilities. Today, technology continues to evolve at an unprecedented pace.`,
    'artificial intelligence': `Artificial intelligence represents one of humanity's greatest achievements. It combines computer science, mathematics, and philosophy to create systems that can learn and reason. As AI evolves, it promises to solve complex problems and enhance human capabilities across every field.`,
  };

  for (const [key, value] of Object.entries(narratives)) {
    if (topic.toLowerCase().includes(key)) {
      return value;
    }
  }

  return `Let me share some insights about ${topic}. This is a fascinating subject that encompasses multiple perspectives and fascinating details. Understanding ${topic} requires both knowledge and critical thinking, leading to deeper appreciation of this domain.`;
}

function generateCodeResponse(codeRequest: string): string {
  // Detect language from request
  let language = 'javascript';
  if (codeRequest.toLowerCase().includes('python')) language = 'python';
  if (codeRequest.toLowerCase().includes('html') || codeRequest.toLowerCase().includes('css')) language = 'html';
  if (codeRequest.toLowerCase().includes('react')) language = 'jsx';
  if (codeRequest.toLowerCase().includes('typescript')) language = 'typescript';

  const codeExamples: Record<string, string> = {
    javascript: `\`\`\`javascript
// Simple example
function helloWorld() {
  console.log("Hello, World!");
  return "Welcome to JavaScript";
}

const result = helloWorld();
console.log(result);
\`\`\`

This code demonstrates basic JavaScript syntax with a function and console output.`,
    
    python: `\`\`\`python
# Simple Python example
def hello_world():
    print("Hello, World!")
    return "Welcome to Python"

result = hello_world()
print(result)
\`\`\`

This code shows Python's clean and readable syntax for functions and printing.`,

    html: `\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Hello World</title>
    <style>
        body { font-family: Arial, sans-serif; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>Hello, World!</h1>
    <p>Welcome to HTML</p>
</body>
</html>
\`\`\`

This is a basic HTML5 structure with CSS styling included.`,

    jsx: `\`\`\`jsx
// React Counter Component
import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Counter: {count}</h1>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
    </div>
  );
}
\`\`\`

This React component demonstrates state management and event handling.`,

    typescript: `\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function createUser(name: string, email: string): User {
  return {
    id: Math.random(),
    name,
    email,
  };
}

const user = createUser("John", "john@example.com");
console.log(user);
\`\`\`

This TypeScript example shows type safety with interfaces and functions.`,
  };

  return codeExamples[language] || codeExamples['javascript'];
}

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
      
      if (apiKeyAvailable) {
        try {
          const data = await callAIGateway('/v1/images/generations', {
            prompt,
            model: 'google/imagen-4.0-generate-001',
            n: 1,
            size: '1024x1024',
          });

          const url = data.data?.[0]?.url || data.url || '';
          if (url) {
            return Response.json({
              role: 'assistant',
              content: `Here is your generated image for: "${prompt}"`,
              type: 'image',
              url,
            });
          }
        } catch (e) {
          console.error('[image error]', e);
        }
      }

      // Use mock response if API key not available or API call failed
      return Response.json({
        role: 'assistant',
        content: generateMockImageResponse(prompt),
        type: 'text',
      });
    }

    // ── VIDEO GENERATION ─────────────────────────────────────────────────────
    if (message.startsWith('/video ')) {
      const prompt = message.replace('/video ', '').trim();
      
      if (apiKeyAvailable) {
        try {
          const data = await callAIGateway('/v1/videos/generations', {
            prompt,
            model: 'luma/genie-2.5-generate-001',
          });

          const url = data.data?.[0]?.url || data.url || '';
          if (url) {
            return Response.json({
              role: 'assistant',
              content: `Here is your generated video for: "${prompt}"`,
              type: 'video',
              url,
            });
          }
        } catch (e) {
          console.error('[video error]', e);
        }
      }

      // Use mock response if API key not available or API call failed
      return Response.json({
        role: 'assistant',
        content: generateMockVideoResponse(prompt),
        type: 'text',
      });
    }

    // ── AUDIO GENERATION ─────────────────────────────────────────────────────
    if (message.startsWith('/audio ')) {
      const topic = message.replace('/audio ', '').trim();
      
      if (apiKeyAvailable) {
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

          const script = data?.choices?.[0]?.message?.content;
          if (script) {
            return Response.json({
              role: 'assistant',
              content: script,
              type: 'audio',
            });
          }
        } catch (e) {
          console.error('[audio error]', e);
        }
      }

      // Use mock response if API key not available or API call failed
      return Response.json({
        role: 'assistant',
        content: generateMockAudioResponse(topic),
        type: 'text',
      });
    }

    // ── TEXT CHAT & CODE GENERATION ───────────────────────────────────────────
    const isCodeRequest =
      message.startsWith('/code ') ||
      /\b(write|create|build|make|generate|show me)\b.*(code|function|component|class|script|app|program|snippet)/i.test(message) ||
      /\b(how to|how do i)\b.*\b(code|implement|program|build)\b/i.test(message);

    // Handle code generation with mock responses
    if (isCodeRequest) {
      if (apiKeyAvailable) {
        try {
          const sysPrompt = systemPrompt ||
            'You are an expert code assistant. Write complete, runnable code in markdown code blocks with language specified (e.g. ```html, ```javascript, ```python).';
          
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
          if (content) {
            const type = /```[\w]*\n[\s\S]+?```/.test(content) ? 'code' : 'text';
            return Response.json({ role: 'assistant', content, type });
          }
        } catch (e) {
          console.error('[code error]', e);
        }
      }

      // Use mock code response
      const content = generateCodeResponse(message);
      return Response.json({
        role: 'assistant',
        content,
        type: 'code',
      });
    }

    // Handle text chat with API or mock responses
    if (apiKeyAvailable) {
      try {
        const sysPrompt = systemPrompt || 'You are a helpful, friendly AI assistant. Be concise and accurate in your responses.';
        
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
        if (content) {
          return Response.json({ role: 'assistant', content, type: 'text' });
        }
      } catch (e) {
        console.error('[chat error]', e);
      }
    }

    // Fallback: Generate intelligent mock response
    const mockResponses = [
      'That\'s an interesting question! To provide the best response, the app would benefit from connecting to an AI service.',
      'I understand your inquiry. For more detailed responses, please add your AI_GATEWAY_API_KEY to enable full functionality.',
      'Great question! The demo mode provides helpful information, but connecting an API key would unlock more advanced features.',
      'Your question is valuable. The app is currently in demo mode. To enable real-time AI responses, add your API key in the settings.',
    ];

    const randomMock = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    return Response.json({
      role: 'assistant',
      content: randomMock,
      type: 'text',
    });
  } catch (error) {
    console.error('[route error]', error);
    return Response.json({
      role: 'assistant',
      content: `Error: ${(error as Error).message || 'Something went wrong'}. Please try again.`,
      type: 'text',
    }, { status: 200 });
  }
}
