'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, RefreshCw, ArrowLeft, Swords, ChevronDown,
  Clock, Zap, RotateCcw, Settings, Trophy, Copy, Check,
  Plus, Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/utils/store';
import { PROVIDERS } from '@/constants/providers';
import { cn } from '@/utils/cn';

// ── Types ──────────────────────────────────────────────────────────────────
interface BattleMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ms?: number; // response time in milliseconds
}

interface SlotState {
  provider: string;
  model: string;
  messages: BattleMsg[];
  isGenerating: boolean;
  totalMs: number;
  wins: number;
}

const DEFAULT_PROVIDERS = ['openrouter', 'groq'];
const DEFAULT_MODELS: Record<string, string> = {
  openrouter: 'openai/gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
  'google-ai-studio': 'gemini-2.5-flash',
  'nvidia-nim': 'meta/llama-3.1-70b-instruct',
  'novita-ai': 'meta-llama/llama-3.3-70b-instruct',
};

// ── Provider / Model selector dropdown ────────────────────────────────────
function SlotSelector({
  slot,
  index,
  onChangeProvider,
  onChangeModel,
}: {
  slot: SlotState;
  index: number;
  onChangeProvider: (p: string) => void;
  onChangeModel: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'provider' | 'model'>('provider');
  const provider = PROVIDERS.find((p) => p.id === slot.provider);
  const colors = index === 0 ? 'text-blue-400 border-blue-500/30 bg-blue-500/5' : 'text-red-400 border-red-500/30 bg-red-500/5';
  const accent = index === 0 ? 'bg-blue-500' : 'bg-red-500';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors', colors)}
      >
        <span className={cn('w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center', accent)}>{index + 1}</span>
        <span className="max-w-[120px] truncate">{provider?.name ?? slot.provider}</span>
        <span className="text-gray-500 text-[9px] truncate max-w-[80px]">{slot.model.split('/').pop()}</span>
        <ChevronDown size={11} className="text-gray-500 flex-shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 w-72 overflow-hidden"
            >
              <div className="flex border-b border-gray-700">
                {(['provider', 'model'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn('flex-1 py-2 text-xs font-semibold capitalize transition-colors', tab === t ? 'text-white bg-gray-800' : 'text-gray-500 hover:text-gray-300')}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="max-h-56 overflow-y-auto p-1">
                {tab === 'provider' && PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onChangeProvider(p.id); setTab('model'); }}
                    className={cn('w-full text-left px-3 py-2 text-xs rounded-xl transition-colors flex items-center justify-between', p.id === slot.provider ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white')}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-[9px] text-gray-500">{p.models.length} models</span>
                  </button>
                ))}
                {tab === 'model' && (provider?.modelList ?? []).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onChangeModel(m.id); setOpen(false); }}
                    className={cn('w-full text-left px-3 py-2 text-xs rounded-xl transition-colors', m.id === slot.model ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white')}
                  >
                    <div className="font-medium">{m.name}</div>
                    {m.contextWindow && <div className="text-[9px] text-gray-500">Context: {m.contextWindow}</div>}
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

// ── Single battle column ───────────────────────────────────────────────────
function BattleColumn({
  slot,
  index,
  onClear,
  onVote,
  voted,
}: {
  slot: SlotState;
  index: number;
  onClear: () => void;
  onVote: () => void;
  voted: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const accent = index === 0 ? 'from-blue-600 to-blue-500' : 'from-red-600 to-red-500';
  const bgAccent = index === 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20';
  const dotColor = index === 0 ? 'bg-blue-400' : 'bg-red-400';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [slot.messages, slot.isGenerating]);

  return (
    <div className="flex-1 flex flex-col border-r last:border-r-0 border-gray-800 overflow-hidden">
      {/* Column header */}
      <div className={cn('flex items-center justify-between px-3 py-2 border-b border-gray-800', bgAccent)}>
        <div className="flex items-center gap-2">
          <div className={cn('w-5 h-5 rounded-full bg-gradient-to-br text-white text-[9px] font-bold flex items-center justify-center', accent)}>
            {index + 1}
          </div>
          <span className="text-xs font-semibold text-white truncate max-w-[100px]">
            {PROVIDERS.find((p) => p.id === slot.provider)?.name ?? slot.provider}
          </span>
          <span className="text-[9px] text-gray-500 truncate max-w-[80px]">{slot.model.split('/').pop()}</span>
        </div>
        <div className="flex items-center gap-2">
          {slot.totalMs > 0 && (
            <div className="flex items-center gap-1 text-[9px] text-gray-500">
              <Clock size={9} />
              {(slot.totalMs / 1000).toFixed(1)}s
            </div>
          )}
          {slot.wins > 0 && (
            <div className="flex items-center gap-1 text-[9px] text-yellow-400">
              <Trophy size={9} />
              {slot.wins}
            </div>
          )}
          <button onClick={onClear} className="p-1 rounded-lg hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors">
            <RotateCcw size={11} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-950">
        {slot.messages.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-xs">
            Waiting for task…
          </div>
        )}
        {slot.messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
            <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 mt-0.5', msg.role === 'user' ? (index === 0 ? 'bg-blue-500' : 'bg-red-500') : 'bg-gray-700')}>
              {msg.role === 'user' ? 'U' : 'AI'}
            </div>
            <div className={cn('max-w-[88%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed group relative', msg.role === 'user' ? (index === 0 ? 'bg-blue-500/15 text-blue-100 rounded-tr-sm' : 'bg-red-500/15 text-red-100 rounded-tr-sm') : 'bg-gray-800 text-gray-200 rounded-tl-sm')}>
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              {msg.ms && msg.role === 'assistant' && (
                <div className="flex items-center gap-1 mt-1.5 text-[9px] text-gray-500">
                  <Zap size={8} /> {(msg.ms / 1000).toFixed(2)}s
                </div>
              )}
              <button
                onClick={() => navigator.clipboard.writeText(msg.content)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-white transition-all"
              >
                <Copy size={9} />
              </button>
            </div>
          </div>
        ))}
        {slot.isGenerating && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[8px] font-bold flex-shrink-0">AI</div>
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                    className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vote button */}
      {slot.messages.some((m) => m.role === 'assistant') && (
        <div className="px-3 py-2 border-t border-gray-800">
          <button
            onClick={onVote}
            disabled={voted}
            className={cn('w-full py-1.5 rounded-xl text-[11px] font-semibold transition-all', voted ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700')}
          >
            {voted ? <span className="flex items-center justify-center gap-1"><Trophy size={10} /> Winner!</span> : 'Vote for this response'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Battle Page ───────────────────────────────────────────────────────
export default function BattlePage() {
  const { apiKeys, customProviders } = useStore();
  const [slots, setSlots] = useState<SlotState[]>([
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', messages: [], isGenerating: false, totalMs: 0, wins: 0 },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', messages: [], isGenerating: false, totalMs: 0, wins: 0 },
  ]);
  const [task, setTask] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [voted, setVoted] = useState<number | null>(null);
  const [history, setHistory] = useState<{ task: string; results: { provider: string; model: string; content: string; ms: number }[] }[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const updateSlot = useCallback((index: number, patch: Partial<SlotState>) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }, []);

  const sendToSlot = useCallback(async (index: number, userMsg: string) => {
    const slot = slots[index];
    const apiKey = apiKeys[slot.provider] ?? '';
    const start = Date.now();

    // Add user message
    const userEntry: BattleMsg = { id: `${index}-u-${Date.now()}`, role: 'user', content: userMsg };
    setSlots((prev) => prev.map((s, i) => i === index ? { ...s, isGenerating: true, messages: [...s.messages, userEntry] } : s));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          provider: slot.provider,
          apiKey,
          history: slot.messages.filter((m) => m.role !== 'user' || m.content !== userMsg).slice(-10).map((m) => ({ role: m.role, content: m.content })),
          systemPrompt: systemPrompt || undefined,
          temperature,
          maxTokens,
          model: slot.model,
        }),
      });
      const data = await res.json() as { content?: string };
      const ms = Date.now() - start;
      const aiEntry: BattleMsg = { id: `${index}-a-${Date.now()}`, role: 'assistant', content: data.content ?? 'No response.', ms };
      setSlots((prev) => prev.map((s, i) => i === index ? {
        ...s,
        isGenerating: false,
        messages: [...s.messages, aiEntry],
        totalMs: s.totalMs + ms,
      } : s));
    } catch (err) {
      const ms = Date.now() - start;
      const errEntry: BattleMsg = { id: `${index}-e-${Date.now()}`, role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown'}`, ms };
      setSlots((prev) => prev.map((s, i) => i === index ? { ...s, isGenerating: false, messages: [...s.messages, errEntry], totalMs: s.totalMs + ms } : s));
    }
  }, [slots, apiKeys, temperature, maxTokens, systemPrompt]);

  const handleRun = useCallback(async () => {
    if (!task.trim() || isRunning) return;
    const userTask = task.trim();
    setTask('');
    setIsRunning(true);
    setVoted(null);
    setRounds((r) => r + 1);

    // Fire all slots in parallel
    await Promise.all(slots.map((_, i) => sendToSlot(i, userTask)));
    setIsRunning(false);
  }, [task, isRunning, slots, sendToSlot]);

  const handleVote = useCallback((index: number) => {
    setVoted(index);
    updateSlot(index, { wins: slots[index].wins + 1 });
  }, [slots, updateSlot]);

  const addSlot = () => {
    if (slots.length >= 4) return;
    setSlots((prev) => [...prev, {
      provider: 'openrouter',
      model: 'anthropic/claude-haiku-3-5',
      messages: [],
      isGenerating: false,
      totalMs: 0,
      wins: 0,
    }]);
  };

  const removeSlot = (index: number) => {
    if (slots.length <= 2) return;
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <Link href="/" className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <Swords size={18} className="text-yellow-400" />
          <span className="font-bold text-sm">Model Battle</span>
          <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Round {rounds}</span>
        </div>

        {/* Slot selectors */}
        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          {slots.map((slot, i) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <SlotSelector
                slot={slot}
                index={i}
                onChangeProvider={(p) => updateSlot(i, { provider: p, model: DEFAULT_MODELS[p] ?? PROVIDERS.find((x) => x.id === p)?.models[0] ?? '' })}
                onChangeModel={(m) => updateSlot(i, { model: m })}
              />
              {slots.length > 2 && (
                <button onClick={() => removeSlot(i)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
          {slots.length < 4 && (
            <button onClick={addSlot} className="flex items-center gap-1 px-2.5 py-1.5 border border-dashed border-gray-700 hover:border-gray-500 rounded-xl text-[11px] text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0">
              <Plus size={11} /> Add model
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn('p-1.5 rounded-lg transition-colors', showSettings ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800 hover:text-white')}
          >
            <Settings size={15} />
          </button>
          <button
            onClick={() => { setSlots((s) => s.map((x) => ({ ...x, messages: [], totalMs: 0, isGenerating: false }))); setRounds(0); setVoted(null); }}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-white transition-colors"
            title="Clear all"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </header>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="bg-gray-900 border-b border-gray-800 overflow-hidden"
          >
            <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-16">Temperature</span>
                <input type="range" min={0} max={2} step={0.05} value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="w-20 h-1 accent-yellow-500" />
                <span className="text-[10px] text-yellow-400 w-6">{temperature.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-16">Max tokens</span>
                <select value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white outline-none">
                  {[256, 512, 1024, 2048, 4096].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <span className="text-[10px] text-gray-400 whitespace-nowrap">System prompt</span>
                <input
                  type="text"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Optional system prompt…"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-gray-500 min-w-[180px]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battle columns */}
      <div className="flex flex-1 overflow-hidden">
        {slots.map((slot, i) => (
          <BattleColumn
            key={i}
            slot={slot}
            index={i}
            onClear={() => updateSlot(i, { messages: [], totalMs: 0, isGenerating: false })}
            onVote={() => handleVote(i)}
            voted={voted === i}
          />
        ))}
      </div>

      {/* Stats bar */}
      {rounds > 0 && (
        <div className="px-4 py-1.5 border-t border-gray-800 bg-gray-900 flex items-center gap-4 text-[10px] text-gray-500 flex-shrink-0">
          <span>Rounds: <strong className="text-gray-300">{rounds}</strong></span>
          {slots.map((s, i) => (
            <span key={i}>
              Model {i + 1} avg:{' '}
              <strong className={i === 0 ? 'text-blue-400' : 'text-red-400'}>
                {s.messages.filter((m) => m.role === 'assistant').length > 0
                  ? (s.totalMs / s.messages.filter((m) => m.role === 'assistant').length / 1000).toFixed(2)
                  : '—'}s
              </strong>
            </span>
          ))}
          {voted !== null && <span className="text-yellow-400 flex items-center gap-1"><Trophy size={10} /> Model {voted + 1} leading with {slots[voted].wins} vote{slots[voted].wins !== 1 ? 's' : ''}</span>}
        </div>
      )}

      {/* Task input */}
      <div className="px-4 py-3 border-t border-gray-800 bg-gray-900 flex-shrink-0">
        <div className="flex items-end gap-3 max-w-2xl mx-auto">
          <div className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl px-4 py-2.5 focus-within:border-gray-500 transition-colors">
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
              placeholder="Enter a task for all models to compete on… (⌘+Enter to run)"
              rows={2}
              disabled={isRunning}
              className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none resize-none"
            />
          </div>
          <motion.button
            onClick={handleRun}
            disabled={!task.trim() || isRunning}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 rounded-2xl text-black font-bold text-sm transition-colors flex-shrink-0"
          >
            {isRunning ? <RefreshCw size={15} className="animate-spin" /> : <Swords size={15} />}
            {isRunning ? 'Running…' : 'Battle!'}
          </motion.button>
        </div>

        {/* Quick prompts */}
        <div className="flex items-center gap-2 mt-2 max-w-2xl mx-auto overflow-x-auto pb-0.5">
          {[
            'Write a haiku about AI',
            'Explain quantum computing simply',
            'Write a React counter component',
            'List 5 productivity hacks',
            'Solve: if 2x + 3 = 11, find x',
          ].map((p) => (
            <button
              key={p}
              onClick={() => setTask(p)}
              className="text-[10px] px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg border border-gray-700 whitespace-nowrap transition-colors flex-shrink-0"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
