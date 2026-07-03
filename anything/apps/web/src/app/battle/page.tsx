'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, ArrowLeft, Swords, ChevronDown, Clock, Zap,
  RotateCcw, Settings, Trophy, Copy, Plus, Trash2,
  Paperclip, X, Image as ImageIcon, FileCode, Check,
} from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/utils/store';
import { PROVIDERS } from '@/constants/providers';
import { cn } from '@/lib/utils';

interface BattleMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ms?: number;
  images?: string[];
}

interface SlotState {
  id: string;
  provider: string;
  model: string;
  messages: BattleMsg[];
  isGenerating: boolean;
  totalMs: number;
  wins: number;
  color: SlotColor;
}

type SlotColor = 'blue' | 'rose' | 'emerald' | 'amber';

const SLOT_COLORS: SlotColor[] = ['blue', 'rose', 'emerald', 'amber'];

const COLOR_MAP: Record<SlotColor, {
  badge: string; ring: string; dot: string; userBubble: string;
  header: string; vote: string; voteActive: string; typing: string;
}> = {
  blue: {
    badge: 'bg-blue-500',
    ring: 'ring-blue-500/30',
    dot: 'bg-blue-400',
    userBubble: 'bg-blue-500/15 text-blue-100',
    header: 'bg-blue-500/8 border-b border-blue-500/15',
    vote: 'hover:bg-blue-500/15 hover:text-blue-300 hover:border-blue-500/40',
    voteActive: 'bg-blue-500/20 text-blue-300 border-blue-400/50',
    typing: 'bg-blue-400',
  },
  rose: {
    badge: 'bg-rose-500',
    ring: 'ring-rose-500/30',
    dot: 'bg-rose-400',
    userBubble: 'bg-rose-500/15 text-rose-100',
    header: 'bg-rose-500/8 border-b border-rose-500/15',
    vote: 'hover:bg-rose-500/15 hover:text-rose-300 hover:border-rose-500/40',
    voteActive: 'bg-rose-500/20 text-rose-300 border-rose-400/50',
    typing: 'bg-rose-400',
  },
  emerald: {
    badge: 'bg-emerald-500',
    ring: 'ring-emerald-500/30',
    dot: 'bg-emerald-400',
    userBubble: 'bg-emerald-500/15 text-emerald-100',
    header: 'bg-emerald-500/8 border-b border-emerald-500/15',
    vote: 'hover:bg-emerald-500/15 hover:text-emerald-300 hover:border-emerald-500/40',
    voteActive: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
    typing: 'bg-emerald-400',
  },
  amber: {
    badge: 'bg-amber-500',
    ring: 'ring-amber-500/30',
    dot: 'bg-amber-400',
    userBubble: 'bg-amber-500/15 text-amber-100',
    header: 'bg-amber-500/8 border-b border-amber-500/15',
    vote: 'hover:bg-amber-500/15 hover:text-amber-300 hover:border-amber-500/40',
    voteActive: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
    typing: 'bg-amber-400',
  },
};

const DEFAULT_MODELS: Record<string, string> = {
  openrouter: 'openai/gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
  'google-ai-studio': 'gemini-2.5-flash',
  'nvidia-nim': 'meta/llama-3.1-70b-instruct',
  'novita-ai': 'meta-llama/llama-3.3-70b-instruct',
  anthropic: 'claude-3-5-haiku-20241022',
};

const QUICK_TASKS = [
  'Write a haiku about artificial intelligence',
  'Explain quantum entanglement in one paragraph',
  'Write a React hook for local storage',
  'Give me 3 creative startup ideas',
  'Solve: What is 17 × 24? Show your work',
  'Write a sorting algorithm and explain it',
];

// ── Model selector dropdown ────────────────────────────────────────────────
function ModelSelector({ slot, onChangeProvider, onChangeModel }: {
  slot: SlotState;
  onChangeProvider: (p: string) => void;
  onChangeModel: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'provider' | 'model'>('provider');
  const provider = PROVIDERS.find((p) => p.id === slot.provider);
  const c = COLOR_MAP[slot.color];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10',
          'border border-white/10 hover:border-white/20 text-xs font-medium transition-all w-full',
        )}
      >
        <span className={cn('w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0', c.badge)}>
          {slot.id}
        </span>
        <span className="flex-1 text-left text-white/90 truncate">{provider?.name ?? slot.provider}</span>
        <span className="text-white/40 text-[10px] truncate max-w-[90px]">{slot.model.split('/').pop()}</span>
        <ChevronDown size={11} className="text-white/30 flex-shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full mt-2 left-0 right-0 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="flex border-b border-white/10">
                {(['provider', 'model'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'flex-1 py-2.5 text-xs font-semibold capitalize transition-colors',
                      tab === t ? 'text-white bg-white/8' : 'text-white/40 hover:text-white/70',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
                {tab === 'provider' && PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onChangeProvider(p.id); setTab('model'); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs rounded-xl transition-colors flex items-center justify-between',
                      p.id === slot.provider ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/6 hover:text-white/90',
                    )}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-[10px] text-white/25">{p.modelList.length} models</span>
                  </button>
                ))}
                {tab === 'model' && (provider?.modelList ?? []).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onChangeModel(m.id); setOpen(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs rounded-xl transition-colors',
                      m.id === slot.model ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/6 hover:text-white/90',
                    )}
                  >
                    <div className="font-medium">{m.name}</div>
                    {m.contextWindow && (
                      <div className="text-[10px] text-white/30 mt-0.5">{m.contextWindow} context</div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── CopyButton ─────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-white/30 hover:text-white/70 transition-all"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
}

// ── Battle column ──────────────────────────────────────────────────────────
function BattleColumn({ slot, voted, onVote, onClear, onChangeProvider, onChangeModel }: {
  slot: SlotState;
  voted: boolean;
  onVote: () => void;
  onClear: () => void;
  onChangeProvider: (p: string) => void;
  onChangeModel: (m: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const c = COLOR_MAP[slot.color];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [slot.messages, slot.isGenerating]);

  const provider = PROVIDERS.find((p) => p.id === slot.provider);
  const avgMs = slot.messages.filter((m) => m.role === 'assistant').length > 0
    ? slot.totalMs / slot.messages.filter((m) => m.role === 'assistant').length
    : 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 border-r border-white/5 last:border-r-0">
      {/* Column header */}
      <div className={cn('flex-shrink-0 px-3 pt-3 pb-2', c.header)}>
        <ModelSelector
          slot={slot}
          onChangeProvider={onChangeProvider}
          onChangeModel={onChangeModel}
        />
        {/* Stats row */}
        <div className="flex items-center gap-3 mt-2 px-1">
          {slot.wins > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
              <Trophy size={10} /> {slot.wins} {slot.wins === 1 ? 'win' : 'wins'}
            </div>
          )}
          {avgMs > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-white/30">
              <Clock size={9} /> {(avgMs / 1000).toFixed(2)}s avg
            </div>
          )}
          <div className="flex-1" />
          <button
            onClick={onClear}
            className="p-1 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/6 transition-colors"
            title="Clear messages"
          >
            <RotateCcw size={11} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {slot.messages.length === 0 && !slot.isGenerating && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-bold mb-3', c.badge)}>
              {slot.id}
            </div>
            <p className="text-white/20 text-xs">Waiting for task…</p>
          </div>
        )}

        {slot.messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 mt-0.5 text-white',
              msg.role === 'user' ? c.badge : 'bg-white/10',
            )}>
              {msg.role === 'user' ? 'U' : 'AI'}
            </div>
            <div className={cn(
              'max-w-[90%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed group relative',
              msg.role === 'user'
                ? cn(c.userBubble, 'rounded-tr-sm')
                : 'bg-white/6 text-white/85 rounded-tl-sm border border-white/6',
            )}>
              {msg.images && msg.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {msg.images.map((src, idx) => (
                    <img key={idx} src={src} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/10" />
                  ))}
                </div>
              )}
              <pre className="whitespace-pre-wrap font-sans break-words">{msg.content}</pre>
              {msg.ms && msg.role === 'assistant' && (
                <div className="flex items-center gap-1 mt-1.5 text-[9px] text-white/25">
                  <Zap size={8} /> {(msg.ms / 1000).toFixed(2)}s
                </div>
              )}
              <div className="absolute top-1.5 right-1.5">
                <CopyButton text={msg.content} />
              </div>
            </div>
          </div>
        ))}

        {slot.isGenerating && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold text-white/60 flex-shrink-0">
              AI
            </div>
            <div className="bg-white/6 border border-white/6 rounded-2xl rounded-tl-sm px-3 py-2.5">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className={cn('w-1.5 h-1.5 rounded-full', c.dot)}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                    transition={{ duration: 1.2, delay: i * 0.18, repeat: Infinity }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vote bar */}
      {slot.messages.some((m) => m.role === 'assistant') && (
        <div className="flex-shrink-0 px-3 pb-3">
          <button
            onClick={onVote}
            disabled={voted}
            className={cn(
              'w-full py-2 rounded-xl text-[11px] font-semibold transition-all border',
              voted
                ? cn('border', c.voteActive)
                : cn('border-white/8 text-white/35 bg-white/3', c.vote),
            )}
          >
            {voted
              ? <span className="flex items-center justify-center gap-1.5"><Trophy size={11} /> Winner!</span>
              : 'Vote best response'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function BattlePage() {
  const { apiKeys } = useStore();

  const makeSlot = (id: string, provider: string, color: SlotColor): SlotState => ({
    id,
    provider,
    model: DEFAULT_MODELS[provider] ?? PROVIDERS.find((p) => p.id === provider)?.modelList[0]?.id ?? '',
    messages: [],
    isGenerating: false,
    totalMs: 0,
    wins: 0,
    color,
  });

  const [slots, setSlots] = useState<SlotState[]>([
    makeSlot('A', 'openrouter', 'blue'),
    makeSlot('B', 'groq', 'rose'),
  ]);
  const [task, setTask] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [voted, setVoted] = useState<string | null>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const updateSlot = useCallback((id: string, patch: Partial<SlotState>) => {
    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const sendToSlot = useCallback(async (slot: SlotState, userMsg: string, images: string[]) => {
    const apiKey = apiKeys[slot.provider] ?? '';
    const start = Date.now();
    const userEntry: BattleMsg = {
      id: `${slot.id}-u-${Date.now()}`,
      role: 'user',
      content: userMsg,
      images,
    };

    setSlots((prev) => prev.map((s) =>
      s.id === slot.id ? { ...s, isGenerating: true, messages: [...s.messages, userEntry] } : s
    ));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          provider: slot.provider,
          apiKey,
          history: slot.messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          systemPrompt: systemPrompt || undefined,
          temperature,
          maxTokens,
          model: slot.model,
          images: images.length > 0 ? images : undefined,
        }),
      });
      const data = await res.json() as { content?: string; error?: string };
      const ms = Date.now() - start;
      const content = data.content ?? data.error ?? 'No response.';
      const aiEntry: BattleMsg = { id: `${slot.id}-a-${Date.now()}`, role: 'assistant', content, ms };
      setSlots((prev) => prev.map((s) =>
        s.id === slot.id ? { ...s, isGenerating: false, messages: [...s.messages, aiEntry], totalMs: s.totalMs + ms } : s
      ));
    } catch (err) {
      const ms = Date.now() - start;
      const content = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      const errEntry: BattleMsg = { id: `${slot.id}-e-${Date.now()}`, role: 'assistant', content, ms };
      setSlots((prev) => prev.map((s) =>
        s.id === slot.id ? { ...s, isGenerating: false, messages: [...s.messages, errEntry], totalMs: s.totalMs + ms } : s
      ));
    }
  }, [apiKeys, temperature, maxTokens, systemPrompt]);

  const handleRun = useCallback(async () => {
    if (!task.trim() || isRunning) return;
    const userTask = task.trim();
    const imgs = [...attachedImages];
    setTask('');
    setAttachedImages([]);
    setIsRunning(true);
    setVoted(null);
    setRounds((r) => r + 1);
    // Capture snapshot of slots before parallel execution
    const snapshot = slots;
    await Promise.all(snapshot.map((s) => sendToSlot(s, userTask, imgs)));
    setIsRunning(false);
  }, [task, isRunning, slots, attachedImages, sendToSlot]);

  const handleVote = useCallback((id: string) => {
    setVoted(id);
    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, wins: s.wins + 1 } : s));
  }, []);

  const addSlot = () => {
    if (slots.length >= 4) return;
    const usedIds = new Set(slots.map((s) => s.id));
    const id = ['A', 'B', 'C', 'D'].find((x) => !usedIds.has(x)) ?? 'D';
    const usedColors = new Set(slots.map((s) => s.color));
    const color = SLOT_COLORS.find((c) => !usedColors.has(c)) ?? 'amber';
    setSlots((prev) => [...prev, makeSlot(id, 'openrouter', color)]);
  };

  const removeSlot = (id: string) => {
    if (slots.length <= 2) return;
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const handleImageAttach = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setAttachedImages((prev) => [...prev, url]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCodeAttach = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setTask((prev) => prev + (prev ? '\n\n' : '') + `\`\`\`${file.name}\n${content}\n\`\`\``);
      };
      reader.readAsText(file);
    });
  };

  const winner = slots.reduce((a, b) => a.wins > b.wins ? a : b, slots[0]);

  return (
    <div className="h-screen bg-[#0d0d1a] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-[#0f0f20] flex-shrink-0">
        <Link href="/" className="p-1.5 rounded-xl hover:bg-white/8 text-white/40 hover:text-white transition-colors flex-shrink-0">
          <ArrowLeft size={16} />
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Swords size={14} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">Model Battle</div>
            <div className="text-[10px] text-white/30 mt-0.5">
              {rounds > 0 ? `Round ${rounds} · ${slots.length} models` : `${slots.length} models ready`}
            </div>
          </div>
        </div>

        {/* Round / winner badge */}
        {rounds > 0 && winner.wins > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-semibold">
            <Trophy size={10} /> Model {winner.id} leading
          </div>
        )}

        <div className="flex-1" />

        {/* Slot controls */}
        <div className="flex items-center gap-2">
          {slots.length < 4 && (
            <button
              onClick={addSlot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-white/15 hover:border-white/30 text-white/40 hover:text-white/80 text-xs transition-colors"
            >
              <Plus size={12} /> Add model
            </button>
          )}
          {slots.length > 2 && (
            <button
              onClick={() => removeSlot(slots[slots.length - 1].id)}
              className="p-1.5 rounded-xl text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Remove last model"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={cn('p-1.5 rounded-xl transition-colors', showSettings ? 'bg-white/10 text-white' : 'text-white/30 hover:bg-white/8 hover:text-white')}
            title="Settings"
          >
            <Settings size={15} />
          </button>
          <button
            onClick={() => {
              setSlots((s) => s.map((x) => ({ ...x, messages: [], totalMs: 0, isGenerating: false, wins: 0 })));
              setRounds(0);
              setVoted(null);
            }}
            className="p-1.5 rounded-xl text-white/30 hover:text-white hover:bg-white/8 transition-colors"
            title="Reset all"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </header>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-[#0f0f20] border-b border-white/8 overflow-hidden flex-shrink-0"
          >
            <div className="px-4 py-3 flex items-center gap-5 flex-wrap">
              <label className="flex items-center gap-2.5">
                <span className="text-[11px] text-white/40 w-20">Temperature</span>
                <input
                  type="range" min={0} max={2} step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-24 h-1 accent-amber-400"
                />
                <span className="text-[11px] text-amber-400 font-mono w-7">{temperature.toFixed(1)}</span>
              </label>
              <label className="flex items-center gap-2.5">
                <span className="text-[11px] text-white/40 w-20">Max tokens</span>
                <select
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="bg-white/6 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none"
                >
                  {[256, 512, 1024, 2048, 4096].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                <span className="text-[11px] text-white/40 whitespace-nowrap">System prompt</span>
                <input
                  type="text"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Optional system prompt…"
                  className="flex-1 bg-white/6 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-white/25 placeholder-white/25"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battle columns */}
      <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-white/5">
        {slots.map((slot) => (
          <BattleColumn
            key={slot.id}
            slot={slot}
            voted={voted === slot.id}
            onVote={() => handleVote(slot.id)}
            onClear={() => updateSlot(slot.id, { messages: [], totalMs: 0, isGenerating: false })}
            onChangeProvider={(p) => updateSlot(slot.id, {
              provider: p,
              model: DEFAULT_MODELS[p] ?? PROVIDERS.find((x) => x.id === p)?.modelList[0]?.id ?? '',
            })}
            onChangeModel={(m) => updateSlot(slot.id, { model: m })}
          />
        ))}
      </div>

      {/* Stats bar */}
      {rounds > 0 && (
        <div className="flex-shrink-0 px-4 py-1.5 border-t border-white/5 bg-[#0f0f20] flex items-center gap-5 text-[10px] text-white/30">
          <span>Rounds: <strong className="text-white/60">{rounds}</strong></span>
          {slots.map((s) => {
            const count = s.messages.filter((m) => m.role === 'assistant').length;
            const avg = count > 0 ? (s.totalMs / count / 1000).toFixed(2) : '—';
            return (
              <span key={s.id}>
                Model {s.id}: <strong className="text-white/60">{avg}s avg</strong>
                {s.wins > 0 && <span className="ml-1 text-amber-400">· {s.wins}W</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Task input */}
      <div className="flex-shrink-0 border-t border-white/8 bg-[#0f0f20] px-4 py-3">
        {/* Attached images preview */}
        {attachedImages.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {attachedImages.map((src, idx) => (
              <div key={idx} className="relative group">
                <img src={src} alt="" className="w-14 h-14 object-cover rounded-xl border border-white/10" />
                <button
                  onClick={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-white/90 text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          {/* Hidden inputs */}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { handleImageAttach(e.target.files); if (fileRef.current) fileRef.current.value = ''; }} />
          <input ref={codeRef} type="file" accept=".ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.cs,.cpp,.c,.html,.css,.json,.md,.txt" multiple className="hidden"
            onChange={(e) => { handleCodeAttach(e.target.files); if (codeRef.current) codeRef.current.value = ''; }} />

          {/* Attach buttons */}
          <div className="flex flex-col gap-1.5 flex-shrink-0 mb-1">
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/35 hover:text-white/80 transition-colors border border-white/8 relative"
              title="Attach image"
            >
              <ImageIcon size={14} />
              {attachedImages.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {attachedImages.length}
                </span>
              )}
            </button>
            <button
              onClick={() => codeRef.current?.click()}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/35 hover:text-white/80 transition-colors border border-white/8"
              title="Attach code file"
            >
              <FileCode size={14} />
            </button>
          </div>

          {/* Textarea */}
          <div className="flex-1 bg-white/5 border border-white/10 hover:border-white/20 focus-within:border-white/25 rounded-2xl px-4 py-3 transition-colors">
            <textarea
              ref={inputRef}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleRun();
                }
              }}
              placeholder="Enter a task for all models to compete on… (⌘+Enter)"
              rows={2}
              disabled={isRunning}
              className="w-full bg-transparent text-sm text-white/90 placeholder-white/20 outline-none resize-none"
            />
          </div>

          {/* Run button */}
          <motion.button
            onClick={handleRun}
            disabled={!task.trim() || isRunning}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-400 to-orange-500 disabled:opacity-30 rounded-2xl text-black font-bold text-sm transition-all flex-shrink-0 shadow-lg shadow-amber-500/20"
          >
            {isRunning
              ? <><span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Running</>
              : <><Swords size={15} /> Battle!</>
            }
          </motion.button>
        </div>

        {/* Quick prompts */}
        <div className="flex items-center gap-2 mt-2.5 max-w-4xl mx-auto overflow-x-auto pb-0.5 no-scrollbar">
          {QUICK_TASKS.map((p) => (
            <button
              key={p}
              onClick={() => setTask(p)}
              className="text-[10px] px-2.5 py-1.5 bg-white/4 hover:bg-white/8 text-white/35 hover:text-white/70 rounded-lg border border-white/8 whitespace-nowrap transition-colors flex-shrink-0"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
