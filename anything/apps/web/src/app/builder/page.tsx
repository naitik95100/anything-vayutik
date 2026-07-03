'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, RefreshCw, Eye, Code2, MessageSquare, Plus, Trash2,
  Download, GitBranch, Sparkles, X, Check,
  FileCode, FileText, File, Palette, Zap, Monitor, Smartphone,
  Tablet, ArrowLeft, Copy, Paperclip, Image as ImageIcon,
  ChevronDown, FolderOpen, Settings, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/utils/store';
import { PROVIDERS } from '@/constants/providers';
import { cn } from '@/lib/utils';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ── Design system presets ──────────────────────────────────────────────────
const DESIGN_PRESETS = [
  { id: 'minimal', name: 'Minimal', desc: 'Clean white, subtle shadows', colors: ['#ffffff', '#111111', '#f5f5f5', '#e0e0e0'], font: 'Inter' },
  { id: 'dark-pro', name: 'Dark Pro', desc: 'Dark bg, neon accents', colors: ['#0f0f0f', '#ffffff', '#6ee7b7', '#374151'], font: 'JetBrains Mono' },
  { id: 'ocean', name: 'Ocean', desc: 'Deep blues and teals', colors: ['#0f172a', '#38bdf8', '#0ea5e9', '#e2e8f0'], font: 'Plus Jakarta Sans' },
  { id: 'sunset', name: 'Sunset', desc: 'Warm oranges and reds', colors: ['#fff7ed', '#ea580c', '#dc2626', '#1c1917'], font: 'Sora' },
  { id: 'forest', name: 'Forest', desc: 'Earthy greens and browns', colors: ['#f0fdf4', '#166534', '#15803d', '#1c1917'], font: 'DM Sans' },
  { id: 'candy', name: 'Candy', desc: 'Bright pinks and purples', colors: ['#fdf4ff', '#a855f7', '#ec4899', '#1e1b4b'], font: 'Nunito' },
  { id: 'corporate', name: 'Corporate', desc: 'Professional blues', colors: ['#f8fafc', '#1e40af', '#3b82f6', '#1e293b'], font: 'IBM Plex Sans' },
  { id: 'retro', name: 'Retro', desc: 'Vintage yellows and greens', colors: ['#fefce8', '#854d0e', '#16a34a', '#1c1917'], font: 'Space Mono' },
  { id: 'glass', name: 'Glassmorphism', desc: 'Frosted glass effects', colors: ['#6366f1', '#8b5cf6', '#06b6d4', '#ffffff'], font: 'Outfit' },
  { id: 'neon', name: 'Neon', desc: 'Black bg, electric colors', colors: ['#000000', '#39ff14', '#ff0090', '#00f0ff'], font: 'Exo 2' },
  { id: 'newspaper', name: 'Newspaper', desc: 'Serif fonts, ink on paper', colors: ['#fafaf9', '#1c1917', '#78716c', '#292524'], font: 'Playfair Display' },
  { id: 'brutalist', name: 'Brutalist', desc: 'Bold borders, raw layout', colors: ['#ffffff', '#000000', '#facc15', '#ef4444'], font: 'Space Grotesk' },
  { id: 'material', name: 'Material You', desc: 'Google Material Design 3', colors: ['#fef7ff', '#6750a4', '#7965af', '#1c1b1f'], font: 'Roboto' },
  { id: 'tailwind', name: 'Tailwind UI', desc: 'Tailwind utility-first', colors: ['#f9fafb', '#4f46e5', '#6366f1', '#111827'], font: 'Inter' },
  { id: 'apple', name: 'Apple HIG', desc: 'iOS-style clean design', colors: ['#f5f5f7', '#000000', '#0071e3', '#1d1d1f'], font: 'SF Pro Display' },
  { id: 'shadcn', name: 'shadcn/ui', desc: 'Radix + Tailwind system', colors: ['#ffffff', '#09090b', '#71717a', '#f4f4f5'], font: 'Geist' },
];

// ── Framework presets ──────────────────────────────────────────────────────
const FRAMEWORKS = [
  { id: 'html', name: 'HTML', lang: 'HTML', ext: 'html' },
  { id: 'react', name: 'React', lang: 'TypeScript', ext: 'tsx' },
  { id: 'nextjs', name: 'Next.js', lang: 'TypeScript', ext: 'tsx' },
  { id: 'vue', name: 'Vue 3', lang: 'TypeScript', ext: 'vue' },
];

// ── Build a preview-ready HTML document ───────────────────────────────────
// For HTML framework: use index.html directly.
// For React/Next/Vue: wrap components with Babel standalone + CDN React.
function buildPreviewHtml(files: Record<string, string>, framework: string, preset: typeof DESIGN_PRESETS[0]): string {
  const [bg, primary, accent, textCol] = preset.colors;
  const cssEntries = Object.entries(files).filter(([k]) => k.endsWith('.css'));
  const cssContent = cssEntries.map(([, v]) => v).join('\n');

  if (framework === 'html') {
    const html = files['index.html'] ?? '';
    // Inject CSS files if present
    if (cssContent && !html.includes('<style>')) {
      return html.replace('</head>', `<style>${cssContent}</style></head>`);
    }
    return html || `<!DOCTYPE html><html><body style="background:${bg};color:${textCol};font-family:${preset.font},system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><h1 style="color:${primary}">Hello World</h1></body></html>`;
  }

  // For React/Next/Vue — find the main component file
  const mainEntry =
    files['src/App.tsx'] ||
    files['src/App.jsx'] ||
    files['app/page.tsx'] ||
    files['pages/index.tsx'] ||
    files['src/App.vue'] ||
    Object.entries(files).find(([k]) => k.endsWith('.tsx') || k.endsWith('.jsx') || k.endsWith('.vue'))?.[1] ||
    '';

  // Strip imports / exports so Babel can run the component standalone
  let componentCode = mainEntry
    .replace(/^import\s+.*?from\s+['"][^'"]*['"];?\s*$/gm, '')
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+/gm, '');

  // Remove TypeScript type annotations that Babel standalone can't handle well
  componentCode = componentCode
    .replace(/:\s*React\.FC(\s*=)/g, '$1')
    .replace(/<[A-Z][A-Za-z]*>\s*\(/g, '(');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Preview — ${preset.name}</title>
<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: ${bg}; color: ${textCol}; font-family: '${preset.font}', system-ui, sans-serif; min-height: 100vh; }
  ${cssContent}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react,typescript">
const { useState, useEffect, useRef, useCallback } = React;
${componentCode}

// Try to find and render the main component
const candidates = [
  typeof App !== 'undefined' ? App : null,
  typeof Home !== 'undefined' ? Home : null,
  typeof Page !== 'undefined' ? Page : null,
  typeof Index !== 'undefined' ? Index : null,
];
const Main = candidates.find(Boolean);
if (Main) {
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Main));
} else {
  document.getElementById('root').innerHTML = '<div style="padding:2rem;text-align:center"><p style="color:${primary};font-size:1.2rem;font-weight:600">Component loaded. Define a default export named App, Home, or Page to render it here.</p></div>';
}
</script>
</body>
</html>`;
}

// ── Template generators ────────────────────────────────────────────────────
function getTemplate(frameworkId: string, preset: typeof DESIGN_PRESETS[0]): Record<string, string> {
  const [bg, primary, accent, textCol] = preset.colors;
  const style = `background:${bg};color:${textCol};font-family:'${preset.font}',system-ui,sans-serif`;

  if (frameworkId === 'html') {
    return {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App — ${preset.name}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="container">
    <h1>Hello World</h1>
    <p>Built with ${preset.name} design system</p>
    <button onclick="alert('Hello!')">Get Started</button>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
      'style.css': `* { margin: 0; padding: 0; box-sizing: border-box; }
body { min-height: 100vh; display: flex; align-items: center; justify-content: center; ${style}; }
.container { text-align: center; padding: 2rem; }
h1 { font-size: 3rem; font-weight: 700; color: ${primary}; margin-bottom: 1rem; }
p { font-size: 1.125rem; color: ${accent}; margin-bottom: 2rem; }
button { background: ${primary}; color: ${bg}; padding: 12px 28px; border-radius: 8px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; transition: opacity .2s; }
button:hover { opacity: 0.85; }`,
      'script.js': `// JavaScript for ${preset.name} app\nconsole.log('App ready!');`,
    };
  }

  if (frameworkId === 'vue') {
    return {
      'src/App.vue': `<template>
  <div class="app">
    <h1>Hello World</h1>
    <p>Built with Vue 3 + ${preset.name}</p>
    <button @click="count++">Count: {{ count }}</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const count = ref(0);
</script>

<style scoped>
.app { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; ${style}; }
h1 { font-size: 3rem; font-weight: 700; color: ${primary}; margin-bottom: 1rem; }
p { font-size: 1.125rem; color: ${accent}; margin-bottom: 2rem; }
button { background: ${primary}; color: ${bg}; padding: 12px 28px; border-radius: 8px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
button:hover { opacity: 0.85; }
</style>`,
      'src/main.ts': `import { createApp } from 'vue';
import App from './App.vue';
createApp(App).mount('#app');`,
      'package.json': `{
  "name": "my-vue-app",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": { "vue": "^3.5.0" },
  "devDependencies": { "@vitejs/plugin-vue": "^5", "typescript": "^5", "vite": "^6" }
}`,
    };
  }

  if (frameworkId === 'nextjs') {
    return {
      'app/page.tsx': `'use client';
import { useState } from 'react';

export default function Home() {
  const [count, setCount] = useState(0);
  return (
    <main style={{ ${style}, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, fontWeight: 700, color: '${primary}', marginBottom: 16 }}>Hello World</h1>
        <p style={{ fontSize: 18, color: '${accent}', marginBottom: 32 }}>Built with Next.js + ${preset.name}</p>
        <button
          onClick={() => setCount(c => c + 1)}
          style={{ background: '${primary}', color: '${bg}', padding: '12px 28px', borderRadius: 8, border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
        >
          Count: {count}
        </button>
      </div>
    </main>
  );
}`,
      'app/layout.tsx': `import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'My App', description: 'Built with Nexus Vayu Builder' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}`,
      'package.json': `{
  "name": "my-nextjs-app",
  "version": "0.1.0",
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start" },
  "dependencies": { "next": "^15.0.0", "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": { "typescript": "^5", "@types/node": "^22", "@types/react": "^19" }
}`,
    };
  }

  // React (Vite)
  return {
    'src/App.tsx': `import { useState } from 'react';
import './App.css';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="app">
      <h1>Hello World</h1>
      <p>Built with React + ${preset.name}</p>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </div>
  );
}`,
    'src/App.css': `.app { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; ${style}; }
h1 { font-size: 3rem; font-weight: 700; color: ${primary}; margin-bottom: 1rem; }
p { font-size: 1.125rem; color: ${accent}; margin-bottom: 2rem; }
button { background: ${primary}; color: ${bg}; padding: 12px 28px; border-radius: 8px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; transition: opacity .2s; }
button:hover { opacity: 0.85; }`,
    'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);`,
    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>My App</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>`,
    'package.json': `{
  "name": "my-react-app",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": { "@vitejs/plugin-react": "^4", "typescript": "^5", "vite": "^6" }
}`,
  };
}

function getFileIcon(filename: string) {
  if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return <FileCode size={12} className="text-blue-400 flex-shrink-0" />;
  if (filename.endsWith('.vue')) return <FileCode size={12} className="text-green-400 flex-shrink-0" />;
  if (filename.endsWith('.css')) return <Palette size={12} className="text-pink-400 flex-shrink-0" />;
  if (filename.endsWith('.html')) return <FileText size={12} className="text-orange-400 flex-shrink-0" />;
  if (filename.endsWith('.json')) return <File size={12} className="text-yellow-400 flex-shrink-0" />;
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return <FileCode size={12} className="text-yellow-300 flex-shrink-0" />;
  return <File size={12} className="text-gray-400 flex-shrink-0" />;
}

function getMonacoLang(filename: string): string {
  if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return 'typescript';
  if (filename.endsWith('.vue') || filename.endsWith('.html')) return 'html';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
  if (filename.endsWith('.py')) return 'python';
  return 'plaintext';
}

interface BuilderMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

// ── GitHub push helper ─────────────────────────────────────────────────────
async function pushToGitHub(
  token: string,
  owner: string,
  repo: string,
  files: Record<string, string>,
  onStatus: (msg: string) => void,
): Promise<{ success: boolean; url: string }> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // 1. Check if repo exists, create if not
  onStatus('Checking repository…');
  const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!checkRes.ok) {
    onStatus('Creating repository…');
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: repo, auto_init: true, private: false }),
    });
    if (!createRes.ok) {
      const err = await createRes.json() as { message?: string };
      throw new Error(`Failed to create repo: ${err.message ?? createRes.status}`);
    }
    // Wait for repo to initialise
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 2. Get default branch
  onStatus('Reading repository…');
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  const repoData = await repoRes.json() as { default_branch?: string };
  const branch = repoData.default_branch ?? 'main';

  // 3. Push each file
  let pushed = 0;
  for (const [path, content] of Object.entries(files)) {
    onStatus(`Pushing ${path} (${++pushed}/${Object.keys(files).length})…`);

    // Encode content as base64 (handles unicode)
    const b64 = btoa(unescape(encodeURIComponent(content)));

    // Get existing SHA if the file already exists
    let sha: string | undefined;
    const existRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers });
    if (existRes.ok) {
      const existData = await existRes.json() as { sha?: string };
      sha = existData.sha;
    }

    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Add ${path} via Nexus Vayu Builder`,
        content: b64,
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.json() as { message?: string };
      throw new Error(`Failed to push ${path}: ${err.message ?? putRes.status}`);
    }
  }

  return { success: true, url: `https://github.com/${owner}/${repo}` };
}

// ── Main component ─────────────────────────────────────────────────────────
export default function BuilderPage() {
  const { apiKeys, selectedProvider } = useStore();

  const [framework, setFramework] = useState('react');
  const [selectedPreset, setSelectedPreset] = useState(DESIGN_PRESETS[0]);
  const [files, setFiles] = useState<Record<string, string>>(() => getTemplate('react', DESIGN_PRESETS[0]));
  const [activeFile, setActiveFile] = useState('src/App.tsx');
  const [messages, setMessages] = useState<BuilderMsg[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [temperature, setTemperature] = useState(0.7);
  const [showSettings, setShowSettings] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [showFrameworkPicker, setShowFrameworkPicker] = useState(false);

  // GitHub state
  const [githubToken, setGithubToken] = useState('');
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState('');
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [showGithub, setShowGithub] = useState(false);

  // Attachments
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const apiKey = apiKeys[selectedProvider] ?? '';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const applyFramework = useCallback((fwId: string, preset: typeof DESIGN_PRESETS[0]) => {
    const newFiles = getTemplate(fwId, preset);
    setFiles(newFiles);
    setActiveFile(Object.keys(newFiles)[0]);
  }, []);

  const handlePresetChange = (preset: typeof DESIGN_PRESETS[0]) => {
    setSelectedPreset(preset);
    applyFramework(framework, preset);
    setShowPresetPicker(false);
  };

  const handleFrameworkChange = (fwId: string) => {
    setFramework(fwId);
    applyFramework(fwId, selectedPreset);
    setShowFrameworkPicker(false);
  };

  // Build preview HTML — recomputed only when files or framework change
  const previewHtml = useMemo(
    () => buildPreviewHtml(files, framework, selectedPreset),
    [files, framework, selectedPreset],
  );

  // ── AI send ──────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return;
    const imgs = [...attachedImages];
    const userMsg: BuilderMsg = { id: Date.now().toString(), role: 'user', content: input.trim(), images: imgs };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachedImages([]);
    setIsGenerating(true);

    const fw = FRAMEWORKS.find((f) => f.id === framework) ?? FRAMEWORKS[0];
    const fileList = Object.entries(files)
      .map(([name, code]) => `## ${name}\n\`\`\`${getMonacoLang(name)}\n${code}\n\`\`\``)
      .join('\n\n');

    const systemPrompt = `You are an expert full-stack developer specializing in ${fw.name} (${fw.lang}).
The user is building an app using the "${selectedPreset.name}" design system.
Colors — bg: ${selectedPreset.colors[0]}, primary: ${selectedPreset.colors[1]}, accent: ${selectedPreset.colors[2]}, text: ${selectedPreset.colors[3]}.
Font: ${selectedPreset.font}.

Current project files:
${fileList}

Rules:
1. When you modify files, wrap the FULL file content in: <file name="FILENAME">CONTENT</file>
2. NEVER truncate file content — always include the complete file.
3. Only include files that changed.
4. After the file blocks, write a short explanation of what you changed.
5. Keep the ${selectedPreset.name} design system colors and font.`;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          provider: selectedProvider,
          apiKey,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          systemPrompt,
          temperature,
          maxTokens: 8192,
          images: imgs.length > 0 ? imgs : undefined,
        }),
      });
      const data = await res.json() as { content?: string; error?: string };
      const aiContent = data.content ?? data.error ?? 'No response.';

      // Parse <file name="...">...</file> blocks
      const fileRegex = /<file\s+name="([^"]+)">([\s\S]*?)<\/file>/g;
      let match;
      const newFiles = { ...files };
      let updatedAny = false;
      while ((match = fileRegex.exec(aiContent)) !== null) {
        const [, fname, fcontent] = match;
        newFiles[fname.trim()] = fcontent.replace(/^\n/, '').replace(/\n$/, '');
        updatedAny = true;
      }

      if (updatedAny) {
        setFiles(newFiles);
        // Switch to preview after code is updated
        setActiveTab('preview');
        setActiveFile(Object.keys(newFiles).find((k) => k === activeFile) ?? Object.keys(newFiles)[0]);
      }

      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: aiContent }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Error: ${msg}` }]);
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, files, framework, selectedPreset, selectedProvider, apiKey, messages, temperature, attachedImages, activeFile]);

  // ── Download ZIP ──────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    Object.entries(files).forEach(([name, content]) => zip.file(name, content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${githubRepo || 'my-app'}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [files, githubRepo]);

  // ── GitHub publish ────────────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!githubToken.trim()) { setPublishStatus('Please enter your GitHub Personal Access Token.'); return; }
    const repoName = githubRepo.trim() || 'my-nexus-app';
    // Determine owner from token — call /user to get login
    setIsPublishing(true);
    setPublishStatus('');
    setPublishSuccess(null);
    try {
      let owner = githubOwner.trim();
      if (!owner) {
        const userRes = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' },
        });
        if (!userRes.ok) throw new Error('Invalid token or network error — could not fetch GitHub user.');
        const userData = await userRes.json() as { login?: string };
        owner = userData.login ?? '';
        if (!owner) throw new Error('Could not determine GitHub username from token.');
        setGithubOwner(owner);
      }

      const result = await pushToGitHub(githubToken, owner, repoName, files, setPublishStatus);
      setPublishSuccess(result.url);
      setPublishStatus('');
    } catch (err) {
      setPublishStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsPublishing(false);
    }
  }, [githubToken, githubOwner, githubRepo, files]);

  // ── Attach images ─────────────────────────────────────────────────────────
  const handleImageAttach = (fl: FileList | null) => {
    if (!fl) return;
    Array.from(fl).forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setAttachedImages((prev) => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  // ── Import code files into the editor ────────────────────────────────────
  const handleCodeImport = (fl: FileList | null) => {
    if (!fl) return;
    Array.from(fl).forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFiles((prev) => ({ ...prev, [f.name]: content }));
        setActiveFile(f.name);
      };
      reader.readAsText(f);
    });
  };

  // ── Import entire GitHub repo (single file reference) ────────────────────
  const handleGithubImport = useCallback(async () => {
    const repoUrl = prompt('Enter GitHub repo URL (e.g. https://github.com/owner/repo):');
    if (!repoUrl) return;
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/);
    if (!match) { alert('Invalid GitHub URL.'); return; }
    const [, owner, repo] = match;
    try {
      const headers: Record<string, string> = githubToken ? { Authorization: `Bearer ${githubToken}` } : {};
      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers });
      if (!treeRes.ok) throw new Error('Could not fetch repo tree. Make sure it is public or token has access.');
      const treeData = await treeRes.json() as { tree?: { path?: string; type?: string }[] };
      const codeExts = ['.tsx', '.ts', '.jsx', '.js', '.vue', '.css', '.html', '.json', '.py', '.md'];
      const codeFiles = (treeData.tree ?? [])
        .filter((f) => f.type === 'blob' && f.path && codeExts.some((e) => f.path!.endsWith(e)))
        .slice(0, 30); // cap at 30 files

      const fetched: Record<string, string> = {};
      await Promise.all(
        codeFiles.map(async (f) => {
          const raw = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${f.path}`, { headers });
          if (raw.ok) fetched[f.path!] = await raw.text();
        })
      );
      if (Object.keys(fetched).length === 0) throw new Error('No code files found.');
      setFiles(fetched);
      setActiveFile(Object.keys(fetched)[0]);
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Imported ${Object.keys(fetched).length} files from ${owner}/${repo}. You can now ask me to modify them.`,
      }]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed.');
    }
  }, [githubToken]);

  const previewWidth = previewMode === 'desktop' ? '100%' : previewMode === 'tablet' ? 768 : 375;
  const fw = FRAMEWORKS.find((f) => f.id === framework) ?? FRAMEWORKS[0];

  return (
    <div className="h-screen bg-[#0d0d18] text-white flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-white/8 bg-[#0f0f20] flex-shrink-0">
        <Link href="/" className="p-1.5 rounded-xl hover:bg-white/8 text-white/40 hover:text-white transition-colors flex-shrink-0">
          <ArrowLeft size={16} />
        </Link>

        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center flex-shrink-0">
          <Code2 size={12} className="text-white" />
        </div>
        <span className="font-bold text-sm text-white">App Builder</span>

        {/* Framework */}
        <div className="relative ml-2">
          <button
            onClick={() => { setShowFrameworkPicker((v) => !v); setShowPresetPicker(false); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/6 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium transition-colors"
          >
            <Zap size={11} className="text-yellow-400" />
            {fw.name}
            <ChevronDown size={10} className="text-white/30" />
          </button>
          <AnimatePresence>
            {showFrameworkPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFrameworkPicker(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full mt-1.5 left-0 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl z-50 p-1.5 min-w-[140px] overflow-hidden"
                >
                  {FRAMEWORKS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleFrameworkChange(f.id)}
                      className={cn('w-full text-left px-3 py-2 text-xs rounded-xl transition-colors flex items-center justify-between gap-2',
                        f.id === framework ? 'bg-orange-500/20 text-orange-300' : 'text-white/60 hover:bg-white/6 hover:text-white')}
                    >
                      <span className="font-medium">{f.name}</span>
                      <span className="text-white/25 text-[10px]">{f.lang}</span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Design preset */}
        <div className="relative">
          <button
            onClick={() => { setShowPresetPicker((v) => !v); setShowFrameworkPicker(false); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/6 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium transition-colors"
          >
            <div className="flex gap-0.5">
              {selectedPreset.colors.slice(0, 3).map((c, i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full border border-white/10" style={{ background: c }} />
              ))}
            </div>
            {selectedPreset.name}
            <ChevronDown size={10} className="text-white/30" />
          </button>
          <AnimatePresence>
            {showPresetPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPresetPicker(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full mt-1.5 left-0 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl z-50 p-2 w-72 grid grid-cols-2 gap-1.5 overflow-hidden"
                >
                  {DESIGN_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handlePresetChange(p)}
                      className={cn('text-left px-2.5 py-2 rounded-xl transition-colors border',
                        p.id === selectedPreset.id ? 'border-orange-500/40 bg-orange-500/10' : 'border-transparent hover:bg-white/6 hover:border-white/10')}
                    >
                      <div className="flex gap-1 mb-1">
                        {p.colors.map((c, i) => (
                          <div key={i} className="w-2 h-2 rounded-full" style={{ background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
                        ))}
                      </div>
                      <div className="text-[11px] font-semibold text-white/90">{p.name}</div>
                      <div className="text-[9px] text-white/30 truncate">{p.font}</div>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleGithubImport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/6 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-white/60 hover:text-white transition-colors"
            title="Import from GitHub"
          >
            <FolderOpen size={12} /> Import
          </button>
          <button
            onClick={() => setShowGithub((v) => !v)}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 border rounded-xl text-xs font-medium transition-colors',
              showGithub ? 'bg-white/10 border-white/20 text-white' : 'bg-white/6 border-white/10 text-white/60 hover:text-white hover:bg-white/10')}
          >
            <GitBranch size={12} /> Publish
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-400 rounded-xl text-xs font-semibold text-white transition-colors shadow-md shadow-orange-500/20"
          >
            <Download size={12} /> ZIP
          </button>
        </div>
      </header>

      {/* ── GitHub panel ── */}
      <AnimatePresence>
        {showGithub && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-[#0f0f20] border-b border-white/8 overflow-hidden flex-shrink-0"
          >
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <GitBranch size={13} className="text-white/30 flex-shrink-0" />
                <input
                  type="password"
                  placeholder="GitHub Personal Access Token (needs repo scope)"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="bg-white/6 border border-white/10 focus:border-white/25 rounded-xl px-3 py-1.5 text-xs text-white outline-none font-mono placeholder-white/25 w-72"
                />
                <input
                  type="text"
                  placeholder="username (auto-detected if blank)"
                  value={githubOwner}
                  onChange={(e) => setGithubOwner(e.target.value)}
                  className="bg-white/6 border border-white/10 focus:border-white/25 rounded-xl px-3 py-1.5 text-xs text-white outline-none placeholder-white/25 w-44"
                />
                <input
                  type="text"
                  placeholder="repo-name"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  className="bg-white/6 border border-white/10 focus:border-white/25 rounded-xl px-3 py-1.5 text-xs text-white outline-none placeholder-white/25 w-36"
                />
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl text-xs font-semibold text-white transition-colors"
                >
                  {isPublishing
                    ? <><span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Pushing…</>
                    : <><Check size={12} /> Push to GitHub</>
                  }
                </button>
                <button onClick={() => setShowGithub(false)} className="ml-auto text-white/25 hover:text-white/60">
                  <X size={14} />
                </button>
              </div>
              {publishStatus && (
                <div className={cn('flex items-center gap-2 text-xs px-1', publishStatus.startsWith('Error') ? 'text-rose-400' : 'text-white/50')}>
                  {publishStatus.startsWith('Error') && <AlertCircle size={11} />}
                  {publishStatus}
                </div>
              )}
              {publishSuccess && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 px-1">
                  <Check size={11} />
                  Published!{' '}
                  <a href={publishSuccess} target="_blank" rel="noreferrer" className="underline hover:text-emerald-300">
                    {publishSuccess}
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main layout: chat + editor/preview ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left: AI Chat ── */}
        <div className="w-72 flex-shrink-0 border-r border-white/8 flex flex-col bg-[#0f0f20]">
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 px-2">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center mx-auto mb-3">
                  <Sparkles size={18} className="text-white" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">AI App Builder</p>
                <p className="text-xs text-white/30 mb-5">Describe what you want to build or modify</p>
                <div className="space-y-2">
                  {[
                    'Add a hero section with CTA button',
                    'Create a dark mode toggle',
                    'Add an animated pricing table',
                    'Build a contact form with validation',
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="w-full text-left px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/8 hover:border-white/15 rounded-xl text-xs text-white/50 hover:text-white/80 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5 text-white',
                  msg.role === 'user' ? 'bg-orange-500' : 'bg-white/10',
                )}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                <div className={cn(
                  'max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-orange-500/15 text-orange-100 rounded-tr-sm'
                    : 'bg-white/6 text-white/80 rounded-tl-sm border border-white/6',
                )}>
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {msg.images.map((src, i) => (
                        <img key={i} src={src} alt="" className="w-14 h-14 rounded-lg object-cover border border-white/10" />
                      ))}
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap font-sans break-words">
                    {msg.content.length > 500 ? msg.content.slice(0, 500) + '…' : msg.content}
                  </pre>
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/50">AI</div>
                <div className="bg-white/6 border border-white/6 rounded-2xl rounded-tl-sm px-3 py-2.5">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 bg-orange-400 rounded-full"
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{ duration: 1.2, delay: i * 0.18, repeat: Infinity }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Settings row */}
          <div className="px-3 py-2 border-t border-white/6">
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="flex items-center gap-2 w-full text-left text-xs text-white/30 hover:text-white/60 transition-colors py-1"
            >
              <Settings size={11} />
              <span>Temperature: {temperature.toFixed(1)}</span>
            </button>
            {showSettings && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="flex-1 h-1 accent-orange-400"
                />
                <span className="text-[10px] text-orange-400 font-mono w-6 text-right">{temperature.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-white/6">
            {/* Attached images preview */}
            {attachedImages.length > 0 && (
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {attachedImages.map((src, idx) => (
                  <div key={idx} className="relative group">
                    <img src={src} alt="" className="w-12 h-12 object-cover rounded-lg border border-white/10" />
                    <button
                      onClick={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-white/90 text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={7} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden file inputs */}
            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { handleImageAttach(e.target.files); if (imageInputRef.current) imageInputRef.current.value = ''; }} />
            <input ref={codeInputRef} type="file" accept=".ts,.tsx,.js,.jsx,.py,.go,.rs,.css,.html,.json,.md,.vue,.txt" multiple className="hidden"
              onChange={(e) => { handleCodeImport(e.target.files); if (codeInputRef.current) codeInputRef.current.value = ''; }} />

            <div className="bg-white/5 border border-white/10 focus-within:border-white/20 rounded-2xl px-3 py-2 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Describe changes… (⌘+Enter)"
                rows={2}
                disabled={isGenerating}
                className="w-full bg-transparent text-xs text-white/90 placeholder-white/25 outline-none resize-none"
              />
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="p-1 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/8 transition-colors"
                    title="Attach image"
                  >
                    <ImageIcon size={12} />
                  </button>
                  <button
                    onClick={() => codeInputRef.current?.click()}
                    className="p-1 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/8 transition-colors"
                    title="Import code file into editor"
                  >
                    <FileCode size={12} />
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isGenerating}
                  className="p-1.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-30 rounded-xl text-white transition-colors"
                >
                  {isGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Editor + Preview ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center border-b border-white/8 bg-[#0f0f20] px-2 flex-shrink-0">
            {(['code', 'preview'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2',
                  activeTab === tab ? 'text-white border-orange-500' : 'text-white/35 border-transparent hover:text-white/70',
                )}
              >
                {tab === 'code' ? <Code2 size={12} /> : <Eye size={12} />}
                {tab === 'code' ? 'Code' : 'Preview'}
              </button>
            ))}

            {activeTab === 'preview' && (
              <div className="ml-auto flex items-center gap-0.5 mr-2">
                {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([mode, Icon]) => (
                  <button
                    key={mode}
                    onClick={() => setPreviewMode(mode)}
                    className={cn('p-1.5 rounded-lg transition-colors', previewMode === mode ? 'text-orange-400 bg-orange-500/10' : 'text-white/25 hover:text-white/60')}
                  >
                    <Icon size={14} />
                  </button>
                ))}
                <button
                  onClick={() => setActiveTab('code')}
                  className="ml-2 p-1.5 rounded-lg text-white/25 hover:text-white/60 transition-colors"
                  title="Back to code"
                >
                  <Code2 size={14} />
                </button>
              </div>
            )}

            {activeTab === 'code' && (
              <div className="ml-auto flex items-center gap-2 mr-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(files[activeFile] ?? ''); }}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/30 hover:text-white/70 transition-colors"
                >
                  <Copy size={10} /> Copy
                </button>
                <button
                  onClick={() => {
                    const name = prompt('New file name (e.g. src/components/Button.tsx):');
                    if (name?.trim()) { setFiles((f) => ({ ...f, [name.trim()]: '' })); setActiveFile(name.trim()); }
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/30 hover:text-white/70 transition-colors"
                >
                  <Plus size={10} /> New file
                </button>
              </div>
            )}
          </div>

          {/* Code editor panel */}
          {activeTab === 'code' && (
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* File tree */}
              <div className="w-44 flex-shrink-0 border-r border-white/6 bg-[#0b0b18] overflow-y-auto py-2">
                <div className="px-3 py-1 text-[10px] text-white/20 font-semibold uppercase tracking-wider mb-1">Files</div>
                {Object.keys(files).map((fname) => (
                  <button
                    key={fname}
                    onClick={() => setActiveFile(fname)}
                    className={cn(
                      'w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-[11px] transition-colors group',
                      activeFile === fname ? 'bg-white/8 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/70',
                    )}
                  >
                    {getFileIcon(fname)}
                    <span className="truncate flex-1">{fname.split('/').pop()}</span>
                    {Object.keys(files).length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = Object.keys(files).find((f) => f !== fname);
                          setFiles((f) => { const n = { ...f }; delete n[fname]; return n; });
                          if (activeFile === fname && next) setActiveFile(next);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400 transition-all flex-shrink-0"
                      >
                        <Trash2 size={9} />
                      </button>
                    )}
                  </button>
                ))}
              </div>

              {/* Monaco editor */}
              <div className="flex-1 overflow-hidden">
                <MonacoEditor
                  key={activeFile}
                  height="100%"
                  language={getMonacoLang(activeFile)}
                  value={files[activeFile] ?? ''}
                  onChange={(val) => setFiles((f) => ({ ...f, [activeFile]: val ?? '' }))}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    folding: true,
                    tabSize: 2,
                    formatOnPaste: true,
                    automaticLayout: true,
                  }}
                />
              </div>
            </div>
          )}

          {/* Preview panel */}
          {activeTab === 'preview' && (
            <div className="flex-1 overflow-auto bg-[#0b0b18] flex items-start justify-center p-6">
              <div
                style={{ width: typeof previewWidth === 'number' ? previewWidth : '100%', maxWidth: '100%' }}
                className="rounded-2xl overflow-hidden shadow-2xl border border-white/8 transition-all duration-300 bg-white"
              >
                <iframe
                  srcDoc={previewHtml}
                  title="App Preview"
                  className="w-full"
                  style={{ height: 'calc(100vh - 180px)', border: 'none', display: 'block' }}
                  sandbox="allow-scripts allow-same-origin allow-modals allow-popups"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
