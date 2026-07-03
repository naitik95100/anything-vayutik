'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, RefreshCw, Eye, Code2, MessageSquare, Plus, Trash2,
  ChevronRight, Download, Github, Sparkles, Settings, X, Check,
  FileCode, FileText, File, Palette, Zap, Monitor, Smartphone,
  Tablet, ChevronLeft, ArrowLeft, Copy,
} from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/utils/store';
import { cn } from '@/utils/cn';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ── Design system presets ──────────────────────────────────────────────────
const DESIGN_PRESETS = [
  { id: 'minimal', name: 'Minimal', desc: 'Clean white, Inter font, subtle shadows', colors: ['#fff', '#111', '#f5f5f5', '#e0e0e0'], font: 'Inter' },
  { id: 'dark-pro', name: 'Dark Pro', desc: 'Dark bg, neon accents, monospace', colors: ['#0f0f0f', '#fff', '#6ee7b7', '#374151'], font: 'JetBrains Mono' },
  { id: 'ocean', name: 'Ocean', desc: 'Deep blues and teals', colors: ['#0f172a', '#38bdf8', '#0ea5e9', '#e2e8f0'], font: 'Plus Jakarta Sans' },
  { id: 'sunset', name: 'Sunset', desc: 'Warm oranges, reds, creams', colors: ['#fff7ed', '#ea580c', '#dc2626', '#1c1917'], font: 'Sora' },
  { id: 'forest', name: 'Forest', desc: 'Earthy greens and browns', colors: ['#f0fdf4', '#166534', '#15803d', '#1c1917'], font: 'DM Sans' },
  { id: 'candy', name: 'Candy', desc: 'Bright pinks and purples', colors: ['#fdf4ff', '#a855f7', '#ec4899', '#1e1b4b'], font: 'Nunito' },
  { id: 'corporate', name: 'Corporate', desc: 'Professional blues, grays', colors: ['#f8fafc', '#1e40af', '#3b82f6', '#1e293b'], font: 'IBM Plex Sans' },
  { id: 'retro', name: 'Retro', desc: 'Vintage yellows and greens', colors: ['#fefce8', '#854d0e', '#16a34a', '#1c1917'], font: 'Space Mono' },
  { id: 'glass', name: 'Glassmorphism', desc: 'Frosted glass, blurs, gradients', colors: ['#6366f1', '#8b5cf6', '#06b6d4', '#fff'], font: 'Outfit' },
  { id: 'neon', name: 'Neon', desc: 'Black bg, electric colors', colors: ['#000', '#39ff14', '#ff0090', '#00f0ff'], font: 'Exo 2' },
  { id: 'newspaper', name: 'Newspaper', desc: 'Serif fonts, ink on paper', colors: ['#fafaf9', '#1c1917', '#78716c', '#292524'], font: 'Playfair Display' },
  { id: 'brutalist', name: 'Brutalist', desc: 'Bold borders, raw layout', colors: ['#fff', '#000', '#facc15', '#ef4444'], font: 'Space Grotesk' },
  { id: 'material', name: 'Material You', desc: 'Google Material Design 3', colors: ['#fef7ff', '#6750a4', '#7965af', '#1c1b1f'], font: 'Roboto' },
  { id: 'tailwind', name: 'Tailwind UI', desc: 'Tailwind CSS utility-first', colors: ['#f9fafb', '#4f46e5', '#6366f1', '#111827'], font: 'Inter' },
  { id: 'apple', name: 'Apple HIG', desc: 'iOS-style clean design', colors: ['#f5f5f7', '#000', '#0071e3', '#1d1d1f'], font: 'SF Pro Display' },
  { id: 'shadcn', name: 'shadcn/ui', desc: 'Radix + Tailwind component system', colors: ['#fff', '#09090b', '#71717a', '#f4f4f5'], font: 'Geist' },
];

// ── Framework presets ──────────────────────────────────────────────────────
const FRAMEWORKS = [
  { id: 'nextjs', name: 'Next.js', lang: 'TypeScript', template: getNextjsTemplate },
  { id: 'vite-react', name: 'Vite + React', lang: 'TypeScript', template: getViteTemplate },
  { id: 'vue', name: 'Vue 3', lang: 'TypeScript', template: getVueTemplate },
  { id: 'html', name: 'Plain HTML', lang: 'HTML', template: getHtmlTemplate },
];

function getNextjsTemplate(preset: typeof DESIGN_PRESETS[0]) {
  const [bg, primary, accent, text] = preset.colors;
  return {
    'app/page.tsx': `'use client';\n\nexport default function Home() {\n  return (\n    <main style={{ background: '${bg}', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '${preset.font}, sans-serif' }}>\n      <div style={{ textAlign: 'center', color: '${text}' }}>\n        <h1 style={{ fontSize: 48, fontWeight: 700, color: '${primary}', marginBottom: 16 }}>Hello World</h1>\n        <p style={{ fontSize: 18, color: '${accent}', marginBottom: 32 }}>Built with Next.js + ${preset.name} design system</p>\n        <button style={{ background: '${primary}', color: '${bg}', padding: '12px 28px', borderRadius: 8, border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Get Started</button>\n      </div>\n    </main>\n  );\n}\n`,
    'app/layout.tsx': `import type { Metadata } from 'next';\nexport const metadata: Metadata = { title: 'My App', description: 'Built with Nexus Vayu Builder' };\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html lang="en"><body>{children}</body></html>;\n}\n`,
    'package.json': `{\n  "name": "my-nextjs-app",\n  "version": "0.1.0",\n  "scripts": { "dev": "next dev", "build": "next build", "start": "next start" },\n  "dependencies": { "next": "^15.0.0", "react": "^19.0.0", "react-dom": "^19.0.0" },\n  "devDependencies": { "typescript": "^5", "@types/node": "^22", "@types/react": "^19" }\n}\n`,
    'tsconfig.json': `{\n  "compilerOptions": { "target": "ES2017", "lib": ["dom", "esnext"], "jsx": "preserve", "module": "esnext", "moduleResolution": "bundler", "strict": true, "noEmit": true },\n  "include": ["**/*.ts", "**/*.tsx"]\n}\n`,
  };
}

function getViteTemplate(preset: typeof DESIGN_PRESETS[0]) {
  const [bg, primary, accent, text] = preset.colors;
  return {
    'src/App.tsx': `import './App.css';\nexport default function App() {\n  return (\n    <div className="app">\n      <h1 style={{ color: '${primary}' }}>Hello World</h1>\n      <p style={{ color: '${accent}' }}>Built with Vite + React + ${preset.name}</p>\n      <button>Get Started</button>\n    </div>\n  );\n}\n`,
    'src/App.css': `.app { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${bg}; color: ${text}; font-family: '${preset.font}', sans-serif; } h1 { font-size: 3rem; font-weight: 700; } button { background: ${primary}; color: ${bg}; padding: 12px 28px; border-radius: 8px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 1.5rem; }\n`,
    'src/main.tsx': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);\n`,
    'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width" /><title>My App</title></head>\n  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>\n</html>\n`,
    'package.json': `{\n  "name": "my-vite-app",\n  "version": "0.1.0",\n  "scripts": { "dev": "vite", "build": "vite build" },\n  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" },\n  "devDependencies": { "@vitejs/plugin-react": "^4", "typescript": "^5", "vite": "^6" }\n}\n`,
  };
}

function getVueTemplate(preset: typeof DESIGN_PRESETS[0]) {
  const [bg, primary, accent, text] = preset.colors;
  return {
    'src/App.vue': `<template>\n  <div class="app">\n    <h1>Hello World</h1>\n    <p>Built with Vue 3 + ${preset.name}</p>\n    <button>Get Started</button>\n  </div>\n</template>\n\n<script setup lang="ts">\n// Your Vue 3 app\n</script>\n\n<style scoped>\n.app { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${bg}; color: ${text}; font-family: '${preset.font}', sans-serif; }\nh1 { font-size: 3rem; font-weight: 700; color: ${primary}; }\np { color: ${accent}; }\nbutton { background: ${primary}; color: ${bg}; padding: 12px 28px; border-radius: 8px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 1.5rem; }\n</style>\n`,
    'src/main.ts': `import { createApp } from 'vue';\nimport App from './App.vue';\ncreateApp(App).mount('#app');\n`,
    'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width" /><title>My App</title></head>\n  <body><div id="app"></div><script type="module" src="/src/main.ts"></script></body>\n</html>\n`,
    'package.json': `{\n  "name": "my-vue-app",\n  "scripts": { "dev": "vite", "build": "vite build" },\n  "dependencies": { "vue": "^3.5.0" },\n  "devDependencies": { "@vitejs/plugin-vue": "^5", "typescript": "^5", "vite": "^6" }\n}\n`,
  };
}

function getHtmlTemplate(preset: typeof DESIGN_PRESETS[0]) {
  const [bg, primary, accent, text] = preset.colors;
  return {
    'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>My App</title>\n  <style>\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: ${bg}; color: ${text}; font-family: '${preset.font}', system-ui, sans-serif; }\n    .container { text-align: center; padding: 2rem; }\n    h1 { font-size: 3rem; font-weight: 700; color: ${primary}; margin-bottom: 1rem; }\n    p { font-size: 1.125rem; color: ${accent}; margin-bottom: 2rem; }\n    button { background: ${primary}; color: ${bg}; padding: 12px 28px; border-radius: 8px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; transition: opacity .2s; }\n    button:hover { opacity: 0.85; }\n  </style>\n</head>\n<body>\n  <div class="container">\n    <h1>Hello World</h1>\n    <p>Built with ${preset.name} design system</p>\n    <button onclick="alert('Hello!')">Get Started</button>\n  </div>\n</body>\n</html>\n`,
    'style.css': `/* Additional styles */\n`,
    'script.js': `// Your JavaScript here\nconsole.log('App loaded');\n`,
  };
}

function getFileIcon(filename: string) {
  if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return <FileCode size={12} className="text-blue-400" />;
  if (filename.endsWith('.vue')) return <FileCode size={12} className="text-green-400" />;
  if (filename.endsWith('.css')) return <Palette size={12} className="text-pink-400" />;
  if (filename.endsWith('.html')) return <FileText size={12} className="text-orange-400" />;
  if (filename.endsWith('.json')) return <File size={12} className="text-yellow-400" />;
  return <File size={12} className="text-gray-400" />;
}

function getMonacoLang(filename: string): string {
  if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return 'typescript';
  if (filename.endsWith('.vue')) return 'html';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.html')) return 'html';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.js')) return 'javascript';
  return 'plaintext';
}

// ── Build the preview HTML from the file map ───────────────────────────────
function buildPreviewHtml(files: Record<string, string>, framework: string): string {
  // For plain HTML, just use index.html directly
  if (framework === 'html') {
    return files['index.html'] ?? '<p>No index.html found.</p>';
  }
  // For React/Vue/Next, synthesise a preview from the main component
  const mainFile =
    files['src/App.tsx'] ||
    files['src/App.vue'] ||
    files['app/page.tsx'] ||
    Object.values(files)[0] ||
    '';

  // Extract JSX/template-like content and styles
  const cssFile = Object.entries(files).find(([k]) => k.endsWith('.css'))?.[1] ?? '';
  const [bg, primary, accent, textColor] = ['#fff', '#111', '#666', '#111'];

  // Simple heuristic: find <main> or return tags from the code and render inline
  const bodyMatch = mainFile.match(/return\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*\}/);
  const templateMatch = mainFile.match(/<template>([\s\S]*?)<\/template>/);
  const content = bodyMatch?.[1] || templateMatch?.[1] || mainFile.slice(0, 2000);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width" />
<title>Preview</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: ${bg}; color: ${textColor}; font-family: system-ui, sans-serif; min-height: 100vh; }
${cssFile}
</style>
</head>
<body>
<div id="root">
  <div style="padding:2rem; text-align:center; color: ${primary};">
    <h2 style="font-size:1.5rem; font-weight:700; margin-bottom:1rem;">Live Preview</h2>
    <p style="color:${accent}; font-size:0.875rem;">This preview shows your app layout. Use the Code tab to edit files.</p>
    <pre style="text-align:left; background:#f5f5f5; padding:1rem; border-radius:8px; margin-top:1rem; overflow:auto; font-size:0.75rem; max-height:400px;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>
</div>
</body>
</html>`;
}

// ── Chat message type ──────────────────────────────────────────────────────
interface BuilderMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function BuilderPage() {
  const { apiKeys, selectedProvider, customProviders } = useStore();

  const [framework, setFramework] = useState('nextjs');
  const [selectedPreset, setSelectedPreset] = useState(DESIGN_PRESETS[0]);
  const [files, setFiles] = useState<Record<string, string>>(() =>
    getNextjsTemplate(DESIGN_PRESETS[0])
  );
  const [activeFile, setActiveFile] = useState('app/page.tsx');
  const [messages, setMessages] = useState<BuilderMsg[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'code' | 'preview'>('chat');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [showFrameworkPicker, setShowFrameworkPicker] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [selectedBuilderModel, setSelectedBuilderModel] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');
  const [showGithubPanel, setShowGithubPanel] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Infer API key for current provider
  const apiKey = apiKeys[selectedProvider] ?? '';

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Apply framework template on change
  const applyFramework = useCallback((fwId: string, preset: typeof DESIGN_PRESETS[0]) => {
    const fw = FRAMEWORKS.find((f) => f.id === fwId) ?? FRAMEWORKS[0];
    const newFiles = fw.template(preset);
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

  // Send AI prompt and apply generated code to files
  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return;
    const userMsg: BuilderMsg = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsGenerating(true);

    const fw = FRAMEWORKS.find((f) => f.id === framework) ?? FRAMEWORKS[0];
    const fileList = Object.entries(files)
      .map(([name, code]) => `## ${name}\n\`\`\`\n${code}\n\`\`\``)
      .join('\n\n');

    const systemPrompt = `You are an expert full-stack developer specializing in ${fw.name} (${fw.lang}). 
The user is building an app using the "${selectedPreset.name}" design system.
Design colors: bg=${selectedPreset.colors[0]}, primary=${selectedPreset.colors[1]}, accent=${selectedPreset.colors[2]}, text=${selectedPreset.colors[3]}
Font: ${selectedPreset.font}

Current files:
${fileList}

When the user asks for changes, respond with the complete updated file contents in this exact format:
<file name="FILENAME">
COMPLETE FILE CONTENT HERE
</file>

You MUST include the full file content — never truncate. After the file blocks, briefly explain what you changed.
Only include files that changed. Maintain consistency with the ${selectedPreset.name} design system.`;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          provider: selectedProvider,
          apiKey,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          systemPrompt,
          temperature,
          maxTokens: 8192,
          model: selectedBuilderModel || undefined,
        }),
      });
      const data = await res.json() as { content?: string };
      const aiContent = data.content ?? 'No response.';

      // Parse <file name="...">...</file> blocks and update the file map
      const fileRegex = /<file\s+name="([^"]+)">([\s\S]*?)<\/file>/g;
      let match;
      let updatedAny = false;
      const newFiles = { ...files };
      while ((match = fileRegex.exec(aiContent)) !== null) {
        const [, fname, fcontent] = match;
        newFiles[fname.trim()] = fcontent.trim();
        updatedAny = true;
      }

      // Also catch markdown code blocks with filenames in comments
      if (!updatedAny) {
        const mdRegex = /```(?:\w+)?\s*\/\/ ([^\n]+)\n([\s\S]*?)```/g;
        while ((match = mdRegex.exec(aiContent)) !== null) {
          const [, fname, fcontent] = match;
          if (fname.includes('.')) {
            newFiles[fname.trim()] = fcontent.trim();
            updatedAny = true;
          }
        }
      }

      if (updatedAny) setFiles(newFiles);

      const aiMsg: BuilderMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: aiContent };
      setMessages((prev) => [...prev, aiMsg]);

      // Auto-switch to code tab if files were updated
      if (updatedAny) setActiveTab('code');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Error: ${msg}` }]);
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, files, framework, selectedPreset, selectedProvider, apiKey, messages, temperature, selectedBuilderModel]);

  // Download as ZIP
  const handleDownload = useCallback(async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    Object.entries(files).forEach(([name, content]) => zip.file(name, content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-app.zip';
    a.click();
    URL.revokeObjectURL(url);
  }, [files]);

  // Publish to GitHub
  const handleGithubPublish = useCallback(async () => {
    if (!githubToken || !githubRepo) {
      setPublishMsg('Enter a GitHub token and repo name (e.g. username/repo)');
      return;
    }
    setIsPublishing(true);
    setPublishMsg('');
    try {
      const [owner, repo] = githubRepo.split('/');
      // Create repo if needed
      await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${githubToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: repo, auto_init: true }),
      });
      // Push each file
      for (const [path, content] of Object.entries(files)) {
        const b64 = btoa(unescape(encodeURIComponent(content)));
        // Check if file exists to get sha
        const existing = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
          headers: { Authorization: `Bearer ${githubToken}` },
        });
        const existingJson = existing.ok ? await existing.json() as { sha?: string } : null;

        await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${githubToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Add ${path} via Nexus Vayu Builder`,
            content: b64,
            ...(existingJson?.sha ? { sha: existingJson.sha } : {}),
          }),
        });
      }
      setPublishMsg(`Published to https://github.com/${githubRepo}`);
    } catch (err) {
      setPublishMsg(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setIsPublishing(false);
    }
  }, [githubToken, githubRepo, files]);

  const previewHtml = buildPreviewHtml(files, framework);
  const previewWidth = previewMode === 'desktop' ? '100%' : previewMode === 'tablet' ? 768 : 375;

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <Link href="/" className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <Code2 size={18} className="text-orange-400" />
          <span className="font-bold text-sm">App Builder</span>
          <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Beta</span>
        </div>

        <div className="flex items-center gap-2 ml-2">
          {/* Framework selector */}
          <div className="relative">
            <button
              onClick={() => setShowFrameworkPicker(!showFrameworkPicker)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors"
            >
              <Zap size={11} className="text-yellow-400" />
              {FRAMEWORKS.find((f) => f.id === framework)?.name}
              <ChevronRight size={10} className="text-gray-500 rotate-90" />
            </button>
            <AnimatePresence>
              {showFrameworkPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1 left-0 bg-gray-800 border border-gray-700 rounded-xl p-1 z-50 min-w-[140px] shadow-xl"
                >
                  {FRAMEWORKS.map((fw) => (
                    <button
                      key={fw.id}
                      onClick={() => handleFrameworkChange(fw.id)}
                      className={cn('w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center gap-2', fw.id === framework ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-gray-700 text-gray-300')}
                    >
                      {fw.name}
                      <span className="text-[9px] text-gray-500">{fw.lang}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Design preset selector */}
          <div className="relative">
            <button
              onClick={() => setShowPresetPicker(!showPresetPicker)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors"
            >
              <div className="flex gap-0.5">
                {selectedPreset.colors.slice(0, 3).map((c, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full border border-gray-600" style={{ background: c }} />
                ))}
              </div>
              {selectedPreset.name}
              <ChevronRight size={10} className="text-gray-500 rotate-90" />
            </button>
            <AnimatePresence>
              {showPresetPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1 left-0 bg-gray-800 border border-gray-700 rounded-xl p-2 z-50 w-72 shadow-xl grid grid-cols-2 gap-1"
                >
                  {DESIGN_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetChange(preset)}
                      className={cn('text-left px-2.5 py-2 rounded-lg transition-colors', preset.id === selectedPreset.id ? 'bg-orange-500/20 border border-orange-500/40' : 'hover:bg-gray-700')}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {preset.colors.slice(0, 4).map((c, i) => (
                          <div key={i} className="w-2 h-2 rounded-full" style={{ background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
                        ))}
                      </div>
                      <div className="text-[11px] font-semibold text-white">{preset.name}</div>
                      <div className="text-[9px] text-gray-400 truncate">{preset.font}</div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowGithubPanel(!showGithubPanel)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors"
          >
            <Github size={13} />
            Publish
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs font-semibold text-white transition-colors"
          >
            <Download size={13} />
            Download
          </button>
        </div>
      </header>

      {/* GitHub panel */}
      <AnimatePresence>
        {showGithubPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="bg-gray-900 border-b border-gray-800 overflow-hidden"
          >
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <Github size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="password"
                placeholder="GitHub Personal Access Token (repo scope)"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-gray-500 w-64 font-mono"
              />
              <input
                type="text"
                placeholder="username/repo-name"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-gray-500 w-48 font-mono"
              />
              <button
                onClick={handleGithubPublish}
                disabled={isPublishing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg text-xs font-semibold text-white transition-colors"
              >
                {isPublishing ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                {isPublishing ? 'Publishing…' : 'Push to GitHub'}
              </button>
              {publishMsg && <span className={cn('text-xs', publishMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400')}>{publishMsg}</span>}
              <button onClick={() => setShowGithubPanel(false)} className="ml-auto text-gray-500 hover:text-gray-300">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: AI Chat */}
        <div className="w-80 flex-shrink-0 border-r border-gray-800 flex flex-col bg-gray-900">
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Sparkles size={28} className="text-orange-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-white mb-1">AI App Builder</p>
                <p className="text-xs text-gray-500 mb-4">Describe what you want to build</p>
                <div className="grid gap-2">
                  {['Add a hero section with CTA', 'Create a pricing table', 'Build a login form', 'Add dark mode toggle'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs text-gray-300 transition-colors border border-gray-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5', msg.role === 'user' ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-200')}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed', msg.role === 'user' ? 'bg-orange-500/20 text-orange-100 rounded-tr-sm' : 'bg-gray-800 text-gray-200 rounded-tl-sm')}>
                  <pre className="whitespace-pre-wrap font-sans">{msg.content.slice(0, 600)}{msg.content.length > 600 ? '…' : ''}</pre>
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold">AI</div>
                <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Settings row */}
          <div className="px-3 py-2 border-t border-gray-800 flex items-center gap-2">
            <span className="text-[9px] text-gray-500">Temp</span>
            <input type="range" min={0} max={1} step={0.05} value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="flex-1 h-1 accent-orange-500" />
            <span className="text-[9px] text-gray-400 w-6">{temperature.toFixed(1)}</span>
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-gray-800">
            <div className="flex gap-2 bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2 focus-within:border-gray-500 transition-colors">
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
                className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 outline-none resize-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
                className="self-end p-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 rounded-xl text-white transition-colors"
              >
                {isGenerating ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Code Editor + Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center border-b border-gray-800 bg-gray-900 px-2 flex-shrink-0">
            {(['code', 'preview'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn('flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2', activeTab === tab ? 'text-white border-orange-500' : 'text-gray-500 border-transparent hover:text-gray-300')}
              >
                {tab === 'code' ? <Code2 size={12} /> : <Eye size={12} />}
                {tab}
              </button>
            ))}

            {activeTab === 'preview' && (
              <div className="ml-auto flex items-center gap-1 mr-2">
                {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([mode, Icon]) => (
                  <button
                    key={mode}
                    onClick={() => setPreviewMode(mode)}
                    className={cn('p-1.5 rounded-lg transition-colors', previewMode === mode ? 'text-orange-400 bg-orange-500/10' : 'text-gray-500 hover:text-gray-300')}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'code' && (
              <div className="ml-auto flex items-center gap-2 mr-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(files[activeFile] ?? '');
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-white transition-colors"
                >
                  <Copy size={10} /> Copy
                </button>
                <button
                  onClick={() => {
                    const newName = prompt('New file name (e.g. src/components/Button.tsx):');
                    if (newName && newName.trim()) {
                      setFiles((f) => ({ ...f, [newName.trim()]: '// New file\n' }));
                      setActiveFile(newName.trim());
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-white transition-colors"
                >
                  <Plus size={10} /> New file
                </button>
              </div>
            )}
          </div>

          {activeTab === 'code' && (
            <div className="flex flex-1 overflow-hidden">
              {/* File tree */}
              <div className="w-44 flex-shrink-0 border-r border-gray-800 bg-gray-900 overflow-y-auto py-2">
                {Object.keys(files).map((fname) => (
                  <button
                    key={fname}
                    onClick={() => setActiveFile(fname)}
                    className={cn('w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-[11px] transition-colors group', activeFile === fname ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200')}
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
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all"
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
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="flex-1 overflow-auto bg-gray-800 flex items-start justify-center p-4">
              <div
                style={{ width: typeof previewWidth === 'number' ? previewWidth : '100%', maxWidth: '100%' }}
                className="bg-white rounded-xl overflow-hidden shadow-2xl transition-all duration-300"
              >
                <iframe
                  srcDoc={previewHtml}
                  title="App Preview"
                  className="w-full"
                  style={{ height: 600, border: 'none' }}
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
