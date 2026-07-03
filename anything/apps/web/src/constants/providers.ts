export type ProviderCategory = 'text' | 'image' | 'video' | 'audio' | 'multimodal' | 'code';
export type ModelCapability = 'text' | 'code' | 'image' | 'video' | 'audio' | 'vision' | 'reasoning';

export interface ModelEntry {
  id: string;
  name: string;
  capabilities: ModelCapability[];
  contextWindow?: string;
  description?: string;
  free?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  company: string;
  domain: string;
  description: string;
  modelList: ModelEntry[];
  /** Legacy — first model id, used as default */
  models: string[];
  category: ProviderCategory;
  contextWindow?: string;
  tags: string[];
  placeholderKey: string;
  badge?: string;
  free?: boolean;
  keyLink: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper to derive the legacy `models` array from modelList
// ─────────────────────────────────────────────────────────────────────────────
function ids(list: ModelEntry[]): string[] {
  return list.map((m) => m.id);
}

export const PROVIDERS: Provider[] = [
  // ── 1. OPENROUTER ──────────────────────────────────────────────────────────
  {
    id: 'openrouter',
    name: 'OpenRouter',
    company: 'OpenRouter',
    domain: 'openrouter.ai',
    description:
      'Single API routing to 200+ models: GPT-4o, Claude, Gemini, Llama, Mistral, DeepSeek and more. Pay-as-you-go with free tier models.',
    keyLink: 'https://openrouter.ai/keys',
    placeholderKey: 'sk-or-v1-...',
    badge: 'Hub',
    category: 'multimodal',
    contextWindow: '200K',
    tags: ['200+ Models', 'Free Tier', 'Unified API'],
    modelList: [
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        capabilities: ['text', 'code', 'vision'],
        contextWindow: '128K',
        description: "OpenAI's flagship multimodal model",
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: 'Fast, affordable GPT-4o variant',
        free: true,
      },
      {
        id: 'anthropic/claude-opus-4',
        name: 'Claude Opus 4',
        capabilities: ['text', 'code', 'vision', 'reasoning'],
        contextWindow: '200K',
        description: "Anthropic's most powerful model",
      },
      {
        id: 'anthropic/claude-sonnet-4',
        name: 'Claude Sonnet 4',
        capabilities: ['text', 'code', 'vision'],
        contextWindow: '200K',
        description: "Anthropic's best coding & reasoning model",
      },
      {
        id: 'anthropic/claude-haiku-3-5',
        name: 'Claude Haiku 3.5',
        capabilities: ['text', 'code'],
        contextWindow: '200K',
        description: 'Fast and affordable Claude model',
      },
      {
        id: 'google/gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        capabilities: ['text', 'code', 'vision', 'reasoning'],
        contextWindow: '1M',
        description: "Google's most capable Gemini via OpenRouter",
      },
      {
        id: 'google/gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        capabilities: ['text', 'code', 'vision'],
        contextWindow: '1M',
        description: 'Fast Gemini 2.5 via OpenRouter',
        free: true,
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct',
        name: 'Llama 3.3 70B',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Meta's latest open-source frontier model",
        free: true,
      },
      {
        id: 'meta-llama/llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: 'Fast and lightweight Llama model',
        free: true,
      },
      {
        id: 'deepseek/deepseek-r1',
        name: 'DeepSeek R1',
        capabilities: ['text', 'code', 'reasoning'],
        contextWindow: '64K',
        description: 'Chain-of-thought reasoning model',
        free: true,
      },
      {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek V3',
        capabilities: ['text', 'code'],
        contextWindow: '64K',
        description: 'Fast and capable DeepSeek chat model',
        free: true,
      },
      {
        id: 'mistralai/mistral-large',
        name: 'Mistral Large',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Mistral's frontier model",
      },
      {
        id: 'x-ai/grok-3',
        name: 'Grok 3',
        capabilities: ['text', 'code', 'reasoning'],
        contextWindow: '131K',
        description: "xAI's flagship model with real-time X data",
      },
      {
        id: 'x-ai/grok-3-mini',
        name: 'Grok 3 Mini',
        capabilities: ['text', 'code'],
        contextWindow: '131K',
        description: "xAI's fast and affordable Grok model",
        free: true,
      },
      {
        id: 'qwen/qwen3-235b-a22b',
        name: 'Qwen3 235B',
        capabilities: ['text', 'code', 'reasoning'],
        contextWindow: '128K',
        description: "Alibaba's largest Qwen3 model",
        free: true,
      },
      {
        id: 'microsoft/phi-4',
        name: 'Phi-4',
        capabilities: ['text', 'code', 'reasoning'],
        contextWindow: '16K',
        description: "Microsoft's small but mighty SLM",
        free: true,
      },
      // ── Image: use /image command — Pollinations.AI generates free images ──
    ],
    get models() { return ids(this.modelList); },
  },

  // ── 2. GROQ ────────────────────────────────────────────────────────────────
  {
    id: 'groq',
    name: 'Groq',
    company: 'Groq',
    domain: 'groq.com',
    description:
      'Ultra-fast LPU inference — 300+ tokens/sec. Near-instant responses with open-source models. Free tier available.',
    keyLink: 'https://console.groq.com/keys',
    placeholderKey: 'gsk_...',
    badge: 'Fastest',
    free: true,
    category: 'text',
    contextWindow: '128K',
    tags: ['Ultra Fast', 'Free Tier', 'LPU'],
    modelList: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Meta's latest 70B — best all-round on Groq",
        free: true,
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: 'Fastest Llama on Groq, near-instant replies',
        free: true,
      },
      {
        id: 'llama3-70b-8192',
        name: 'Llama 3 70B',
        capabilities: ['text', 'code'],
        contextWindow: '8K',
        description: 'Llama 3 70B on Groq LPU',
        free: true,
      },
      {
        id: 'llama3-8b-8192',
        name: 'Llama 3 8B',
        capabilities: ['text', 'code'],
        contextWindow: '8K',
        description: 'Llama 3 8B — ultra-fast on Groq',
        free: true,
      },
      {
        id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        name: 'Llama 4 Maverick 17B',
        capabilities: ['text', 'code', 'vision'],
        contextWindow: '128K',
        description: "Meta's Llama 4 Maverick on Groq",
        free: true,
      },
      {
        id: 'meta-llama/llama-4-scout-17b-16e-instruct',
        name: 'Llama 4 Scout 17B',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Meta's Llama 4 Scout — efficient MoE",
        free: true,
      },
      {
        id: 'moonshotai/kimi-k2-instruct',
        name: 'Kimi K2',
        capabilities: ['text', 'code', 'reasoning'],
        contextWindow: '128K',
        description: "Moonshot AI's Kimi K2 reasoning model",
        free: true,
      },
      {
        id: 'llama-guard-3-8b',
        name: 'Llama Guard 3 8B',
        capabilities: ['text'],
        contextWindow: '8K',
        description: 'Content safety classification',
        free: true,
      },
    ],
    get models() { return ids(this.modelList); },
  },

  // ── 3. GOOGLE AI STUDIO ────────────────────────────────────────────────────
  {
    id: 'google-ai-studio',
    name: 'Google AI Studio',
    company: 'Google',
    domain: 'aistudio.google.com',
    description:
      "Google's Gemini API — multimodal models with 1M–2M context. Free tier with generous limits. Supports text, vision, code and audio.",
    keyLink: 'https://aistudio.google.com/app/apikey',
    placeholderKey: 'AIza... or AQ.Ab...',
    badge: 'Free',
    free: true,
    category: 'multimodal',
    contextWindow: '2M',
    tags: ['Free Tier', 'Multimodal', '2M Context'],
    modelList: [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        capabilities: ['text', 'code', 'vision', 'reasoning'],
        contextWindow: '1M',
        description: "Google's most capable model with deep reasoning",
        free: true,
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        capabilities: ['text', 'code', 'vision'],
        contextWindow: '1M',
        description: 'Fast, affordable Gemini — best price/performance',
        free: true,
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        capabilities: ['text', 'code'],
        contextWindow: '1M',
        description: 'Lightest Gemini 2.5 for high-volume tasks',
        free: true,
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        capabilities: ['text', 'code', 'vision', 'audio'],
        contextWindow: '1M',
        description: 'Next-gen multimodal with real-time capabilities',
        free: true,
      },
      {
        id: 'gemini-2.0-flash-lite',
        name: 'Gemini 2.0 Flash Lite',
        capabilities: ['text', 'code'],
        contextWindow: '1M',
        description: 'Smallest and fastest Gemini 2.0',
        free: true,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        capabilities: ['text', 'code', 'vision', 'audio'],
        contextWindow: '2M',
        description: '2M context window multimodal model',
        free: true,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        capabilities: ['text', 'code', 'vision'],
        contextWindow: '1M',
        description: 'Fast and capable Gemini 1.5 variant',
        free: true,
      },
    ],
    get models() { return ids(this.modelList); },
  },

  // ── 4. NVIDIA NIM ──────────────────────────────────────────────────────────
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    company: 'NVIDIA',
    domain: 'build.nvidia.com',
    description:
      'NVIDIA-optimized inference for cutting-edge open models. Free 1000 credits on sign-up. Llama, Mistral, DeepSeek, Gemma and more at blazing GPU speed.',
    keyLink: 'https://build.nvidia.com/settings/api-key',
    placeholderKey: 'nvapi-...',
    badge: 'GPU',
    free: true,
    category: 'multimodal',
    contextWindow: '128K',
    tags: ['GPU Accelerated', 'Free Credits', 'Open Models'],
    modelList: [
      {
        id: 'meta/llama-3.3-70b-instruct',
        name: 'Llama 3.3 70B Instruct',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Meta's latest 70B on NVIDIA hardware",
        free: true,
      },
      {
        id: 'meta/llama-3.1-405b-instruct',
        name: 'Llama 3.1 405B Instruct',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: 'Largest open-source model on NIM',
      },
      {
        id: 'meta/llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B Instruct',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: 'Fastest Llama on NIM',
        free: true,
      },
      {
        id: 'deepseek-ai/deepseek-r1',
        name: 'DeepSeek R1',
        capabilities: ['text', 'code', 'reasoning'],
        contextWindow: '64K',
        description: 'DeepSeek R1 reasoning model on NVIDIA',
        free: true,
      },
      {
        id: 'deepseek-ai/deepseek-r1-distill-llama-70b',
        name: 'DeepSeek R1 Distill 70B',
        capabilities: ['text', 'code', 'reasoning'],
        contextWindow: '128K',
        description: 'Distilled reasoning model',
        free: true,
      },
      {
        id: 'mistralai/mistral-large-2-instruct',
        name: 'Mistral Large 2',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Mistral's best model on NIM",
      },
      {
        id: 'mistralai/mixtral-8x22b-instruct-v0.1',
        name: 'Mixtral 8x22B',
        capabilities: ['text', 'code'],
        contextWindow: '64K',
        description: 'Large MoE model optimized by NVIDIA',
      },
      {
        id: 'google/gemma-3-27b-it',
        name: 'Gemma 3 27B',
        capabilities: ['text', 'code', 'vision'],
        contextWindow: '128K',
        description: "Google's open Gemma 3 model",
        free: true,
      },
      {
        id: 'qwen/qwen2.5-72b-instruct',
        name: 'Qwen 2.5 72B',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Alibaba's multilingual model on NIM",
        free: true,
      },
      {
        id: 'nvidia/llama-3.1-nemotron-70b-instruct',
        name: 'Nemotron 70B',
        capabilities: ['text', 'code', 'reasoning'],
        contextWindow: '128K',
        description: "NVIDIA's fine-tuned reasoning model",
        free: true,
      },
      {
        id: 'microsoft/phi-3.5-mini-instruct',
        name: 'Phi-3.5 Mini',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Microsoft's efficient SLM on NIM",
        free: true,
      },
    ],
    get models() { return ids(this.modelList); },
  },

  // ── 5. NOVITA AI ───────────────────────────────────────────────────────────
  {
    id: 'novita-ai',
    name: 'Novita AI',
    company: 'Novita AI',
    domain: 'novita.ai',
    description:
      'Affordable inference API for 100+ open-source models. Text, image generation (SDXL, Flux), and video — all in one API at the lowest cost.',
    keyLink: 'https://novita.ai/settings#key-management',
    placeholderKey: 'novita-...',
    badge: 'Cheap',
    category: 'multimodal',
    contextWindow: '128K',
    tags: ['Affordable', 'Image Gen', '100+ Models'],
    modelList: [
      {
        id: 'meta-llama/llama-3.3-70b-instruct',
        name: 'Llama 3.3 70B',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Meta's latest flagship open model",
      },
      {
        id: 'meta-llama/llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: 'Fast and affordable Llama model',
      },
      {
        id: 'deepseek/deepseek-r1',
        name: 'DeepSeek R1',
        capabilities: ['text', 'code', 'reasoning'],
        contextWindow: '64K',
        description: 'Full reasoning model',
      },
      {
        id: 'deepseek/deepseek-v3',
        name: 'DeepSeek V3',
        capabilities: ['text', 'code'],
        contextWindow: '64K',
        description: 'Fast chat model from DeepSeek',
      },
      {
        id: 'qwen/qwen2.5-72b-instruct',
        name: 'Qwen 2.5 72B',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Alibaba's bilingual frontier model",
      },
      {
        id: 'mistralai/mistral-large-2411',
        name: 'Mistral Large',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Mistral's best general model",
      },
      {
        id: 'microsoft/phi-4',
        name: 'Phi-4',
        capabilities: ['text', 'code', 'reasoning'],
        contextWindow: '16K',
        description: "Microsoft's small reasoning model",
      },
      {
        id: 'google/gemma-2-27b-it',
        name: 'Gemma 2 27B',
        capabilities: ['text', 'code'],
        contextWindow: '8K',
        description: "Google's open Gemma 2 model",
      },
    ],
    get models() { return ids(this.modelList); },
  },

  // ── 6. LITELLM ─────────────────────────────────────────────────────────────
  {
    id: 'litellm',
    name: 'LiteLLM',
    company: 'BerriAI',
    domain: 'litellm.ai',
    description:
      'Open-source proxy supporting 100+ LLMs with a unified OpenAI-compatible API. Self-host or use a hosted proxy URL. Works with all major providers.',
    keyLink: 'https://docs.litellm.ai/docs/',
    placeholderKey: 'sk-... (your proxy key)',
    category: 'text',
    contextWindow: '200K',
    tags: ['Self-hosted', 'Proxy', '100+ LLMs'],
    modelList: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o (via proxy)',
        capabilities: ['text', 'code', 'vision'],
        contextWindow: '128K',
        description: 'Route GPT-4o through your LiteLLM proxy',
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet (via proxy)',
        capabilities: ['text', 'code'],
        contextWindow: '200K',
        description: 'Route Claude through your LiteLLM proxy',
      },
      {
        id: 'gemini/gemini-2.0-flash',
        name: 'Gemini 2.0 Flash (via proxy)',
        capabilities: ['text', 'code', 'vision'],
        contextWindow: '1M',
        description: 'Route Gemini through your LiteLLM proxy',
      },
      {
        id: 'together_ai/meta-llama/Llama-3-70b-chat-hf',
        name: 'Llama 3 70B (via proxy)',
        capabilities: ['text', 'code'],
        contextWindow: '8K',
        description: 'Route Together AI models through proxy',
      },
      {
        id: 'ollama/llama3',
        name: 'Ollama Llama 3 (local)',
        capabilities: ['text', 'code'],
        description: 'Local Llama 3 via Ollama proxy',
      },
      {
        id: 'ollama/mistral',
        name: 'Ollama Mistral (local)',
        capabilities: ['text', 'code'],
        description: 'Local Mistral via Ollama proxy',
      },
    ],
    get models() { return ids(this.modelList); },
  },

  // ── 7. BYTEZ ───────────────────────────────────────────────────────────────
  {
    id: 'bytez',
    name: 'Bytez',
    company: 'Bytez',
    domain: 'bytez.com',
    description:
      'Run any HuggingFace model with a simple API key — no GPU setup needed. 1000+ models for text, image classification, translation and code.',
    keyLink: 'https://bytez.com/docs/get-started',
    placeholderKey: 'by-...',
    badge: 'New',
    category: 'multimodal',
    contextWindow: '32K',
    tags: ['HuggingFace Hub', '1000+ Models', 'No GPU Needed'],
    modelList: [
      {
        id: 'meta-llama/Llama-3.2-3B-Instruct',
        name: 'Llama 3.2 3B Instruct',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: 'Lightweight Llama for fast inference',
      },
      {
        id: 'meta-llama/Llama-3.1-8B-Instruct',
        name: 'Llama 3.1 8B Instruct',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: 'Popular open-source model from Meta',
      },
      {
        id: 'mistralai/Mistral-7B-Instruct-v0.3',
        name: 'Mistral 7B Instruct',
        capabilities: ['text', 'code'],
        contextWindow: '32K',
        description: 'Efficient Mistral 7B instruction model',
      },
      {
        id: 'google/gemma-2-9b-it',
        name: 'Gemma 2 9B',
        capabilities: ['text', 'code'],
        contextWindow: '8K',
        description: "Google's open Gemma 2 9B model",
      },
      {
        id: 'microsoft/Phi-3.5-mini-instruct',
        name: 'Phi-3.5 Mini Instruct',
        capabilities: ['text', 'code', 'reasoning'],
        contextWindow: '128K',
        description: "Microsoft's efficient SLM",
      },
      {
        id: 'Qwen/Qwen2.5-7B-Instruct',
        name: 'Qwen 2.5 7B',
        capabilities: ['text', 'code'],
        contextWindow: '128K',
        description: "Alibaba's 7B model",
      },
      {
        id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
        name: 'DeepSeek R1 Distill 7B',
        capabilities: ['text', 'reasoning'],
        contextWindow: '32K',
        description: 'Compact reasoning model',
      },
      {
        id: 'HuggingFaceH4/zephyr-7b-beta',
        name: 'Zephyr 7B Beta',
        capabilities: ['text'],
        contextWindow: '8K',
        description: 'Fine-tuned Mistral for chat',
      },
    ],
    get models() { return ids(this.modelList); },
  },

  // ── 8. CUSTOM PROVIDER ────────────────────────────────────────────────────
  {
    id: 'custom',
    name: 'Custom Provider',
    company: 'Custom',
    domain: '',
    description:
      'Connect any OpenAI-compatible API. Enter your endpoint URL and API key — the provider is auto-detected from the URL and shown with the correct name and icon.',
    keyLink: '',
    placeholderKey: 'https://api.example.com|sk-your-key',
    badge: 'Custom',
    category: 'text',
    contextWindow: 'varies',
    tags: ['Any Provider', 'OpenAI-Compatible', 'Self-hosted'],
    modelList: [
      {
        id: 'auto',
        name: 'Auto (detected from URL)',
        capabilities: ['text', 'code'],
        description: 'Model is determined by what your endpoint supports',
      },
    ],
    get models() { return ids(this.modelList); },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY ICON / COLOR helpers (used in the drawer model list)
// ─────────────────────────────────────────────────────────────────────────────
export const CAPABILITY_COLORS: Record<ModelCapability, string> = {
  text:      'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  code:      'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  image:     'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
  video:     'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  audio:     'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  vision:    'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  reasoning: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
};

// Detect a known provider name + favicon domain from a custom base URL
export function detectCustomProvider(url: string): { name: string; domain: string } {
  const lower = url.toLowerCase();
  if (lower.includes('openai.com'))        return { name: 'OpenAI',       domain: 'openai.com' };
  if (lower.includes('anthropic.com'))     return { name: 'Anthropic',    domain: 'anthropic.com' };
  if (lower.includes('groq.com'))          return { name: 'Groq',         domain: 'groq.com' };
  if (lower.includes('openrouter.ai'))     return { name: 'OpenRouter',   domain: 'openrouter.ai' };
  if (lower.includes('googleapis.com'))    return { name: 'Google',       domain: 'google.com' };
  if (lower.includes('nvidia.com'))        return { name: 'NVIDIA',       domain: 'nvidia.com' };
  if (lower.includes('novita.ai'))         return { name: 'Novita AI',    domain: 'novita.ai' };
  if (lower.includes('together.ai') || lower.includes('together.xyz')) return { name: 'Together AI', domain: 'together.ai' };
  if (lower.includes('mistral.ai'))        return { name: 'Mistral',      domain: 'mistral.ai' };
  if (lower.includes('cohere.com'))        return { name: 'Cohere',       domain: 'cohere.com' };
  if (lower.includes('perplexity.ai'))     return { name: 'Perplexity',   domain: 'perplexity.ai' };
  if (lower.includes('deepseek.com'))      return { name: 'DeepSeek',     domain: 'deepseek.com' };
  if (lower.includes('huggingface.co'))    return { name: 'HuggingFace',  domain: 'huggingface.co' };
  if (lower.includes('ollama'))            return { name: 'Ollama',       domain: 'ollama.com' };
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return { name: 'Local API', domain: '' };
  // Try to extract domain from URL
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return { name, domain: hostname };
  } catch {
    return { name: 'Custom API', domain: '' };
  }
}

export const PROMPT_TEMPLATES = [
  { label: 'Explain like I\'m 5', value: 'Explain this to me like I\'m 5 years old: ' },
  { label: 'Write code', value: 'Write clean, production-ready code for: ' },
  { label: 'Debug this', value: 'Find and fix the bug in this code:\n\n' },
  { label: 'Summarize', value: 'Summarize the following in 3 bullet points:\n\n' },
  { label: 'Translate to Spanish', value: 'Translate the following to Spanish:\n\n' },
  { label: 'Write an email', value: 'Write a professional email about: ' },
];

export const KEYBOARD_SHORTCUTS = [
  { keys: ['⌘', 'Enter'], description: 'Send message' },
  { keys: ['⌘', 'K'], description: 'New conversation' },
  { keys: ['⌘', 'B'], description: 'Toggle sidebar' },
  { keys: ['⌘', '/'], description: 'Open shortcuts' },
  { keys: ['Esc'], description: 'Close panels' },
];
