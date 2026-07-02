'use client';
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, Play, X, Maximize2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PREVIEW_LANGS = new Set(['html', 'css', 'javascript', 'js', 'jsx', 'tsx', 'svg']);

function buildIframeContent(code: string, lang: string): string {
  const l = lang.toLowerCase();
  if (l === 'html') return code;
  if (l === 'svg')
    return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f9f9f9">${code}</body></html>`;
  if (l === 'css')
    return `<!DOCTYPE html><html><head><style>body{margin:0;padding:20px;font-family:system-ui,sans-serif;background:#fff}${code}</style></head><body><div class="demo"><h2>CSS Preview</h2><p>Your styles are applied here.</p><button>Button</button><input placeholder="Input field"/></div></body></html>`;
  if (l === 'javascript' || l === 'js') {
    return `<!DOCTYPE html><html><head><style>body{font-family:system-ui,sans-serif;padding:20px;background:#fff;color:#111}#output{background:#f4f4f4;padding:12px;border-radius:8px;font-family:monospace;white-space:pre-wrap;font-size:13px;min-height:40px;border:1px solid #e0e0e0}</style></head><body>
<div id="output">Output will appear here...</div>
<script>
const _log=console.log;
const _info=console.info;
const _warn=console.warn;
const _err=console.error;
const out=document.getElementById('output');
function appendOut(type,...a){const t=document.createElement('div');t.style.color=type==='error'?'#e53e3e':type==='warn'?'#d69e2e':'#111';t.textContent=a.map(x=>typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' ');out.appendChild(t);}
console.log=(...a)=>{_log(...a);appendOut('log',...a)};
console.info=(...a)=>{_info(...a);appendOut('info',...a)};
console.warn=(...a)=>{_warn(...a);appendOut('warn',...a)};
console.error=(...a)=>{_err(...a);appendOut('error',...a)};
try{out.textContent='';${code}}catch(e){appendOut('error','Error: '+e.message)}
</script></body></html>`;
  }
  if (l === 'jsx' || l === 'tsx') {
    // Wrap JSX-like code in a React CDN setup
    return `<!DOCTYPE html><html><head>
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:20px;background:#fff}</style>
</head><body><div id="root"></div>
<script type="text/babel">
${code}
const rootEl = document.getElementById('root');
if(typeof App !== 'undefined'){ReactDOM.createRoot(rootEl).render(React.createElement(App));}
else{rootEl.innerHTML='<p style="color:#666">Define an <b>App</b> component to render.</p>';}
</script></body></html>`;
  }
  return `<!DOCTYPE html><html><head><style>body{font-family:monospace;padding:20px;background:#fff;color:#111;white-space:pre-wrap;font-size:13px}</style></head><body>${code}</body></html>`;
}

interface CodeBlockProps {
  code: string;
  lang: string;
}

export default function CodeBlock({ code, lang }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const canPreview = PREVIEW_LANGS.has(lang.toLowerCase());

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success('Code copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 my-2 bg-gray-950 dark:bg-gray-900">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 dark:bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {/* Traffic lights decoration */}
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <span className="ml-2 text-[11px] text-gray-400 font-mono">{lang || 'code'}</span>
        </div>
        <div className="flex items-center gap-1">
          {canPreview && (
            <button
              onClick={() => setShowPreview((p) => !p)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                showPreview ? 'bg-white text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              )}
            >
              <Play size={10} />
              {showPreview ? 'Hide Preview' : 'Run Preview'}
            </button>
          )}
          <button
            onClick={() => setCollapsed((p) => !p)}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
            title="Copy code"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Code */}
      <AnimatePresence>
        {!collapsed && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-x-auto p-4 text-xs text-gray-100 font-mono leading-relaxed max-h-80 scrollbar-thin"
            style={{ scrollbarColor: '#4b5563 transparent' }}
          >
            <code>{code}</code>
          </motion.pre>
        )}
      </AnimatePresence>

      {/* Preview */}
      <AnimatePresence>
        {showPreview && !collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-gray-700 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800">
              <span className="text-[10px] text-gray-400 font-mono">Preview</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewKey((k) => k + 1)}
                  className="p-1 rounded hover:bg-gray-700 text-gray-400 transition-colors"
                  title="Reload"
                >
                  <RotateCcw size={11} />
                </button>
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="p-1 rounded hover:bg-gray-700 text-gray-400 transition-colors"
                  title="Fullscreen"
                >
                  <Maximize2 size={11} />
                </button>
              </div>
            </div>
            <iframe
              key={previewKey}
              srcDoc={buildIframeContent(code, lang)}
              sandbox="allow-scripts allow-same-origin"
              className="w-full bg-white"
              style={{ height: 320, border: 'none' }}
              title="Code Preview"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Preview */}
      <AnimatePresence>
        {isFullscreen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
              <span className="text-sm font-semibold text-white font-mono">{lang} — Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewKey((k) => k + 1)}
                  className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <iframe
              key={previewKey + 1000}
              srcDoc={buildIframeContent(code, lang)}
              sandbox="allow-scripts allow-same-origin"
              className="flex-1 w-full bg-white"
              style={{ border: 'none' }}
              title="Code Preview Fullscreen"
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
