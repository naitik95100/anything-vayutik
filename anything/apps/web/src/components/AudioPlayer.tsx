'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Square, Volume2, Download, Globe, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/utils/store';
import { ELEVENLABS_VOICES } from '@/app/api/audio/route';

// Stable waveform bar heights (deterministic — no random)
function getBarHeight(i: number) {
  return Math.max(0.15, Math.min(0.95, Math.sin(i * 0.7 + 1.3) * 0.35 + 0.55));
}

// Language groups for Google TTS (free)
const GOOGLE_TTS_LANGS = [
  // Indian languages
  { code: 'hi', name: 'Hindi (हिंदी)' },
  { code: 'ta', name: 'Tamil (தமிழ்)' },
  { code: 'te', name: 'Telugu (తెలుగు)' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
  { code: 'mr', name: 'Marathi (मराठी)' },
  { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', name: 'Malayalam (മലയാളം)' },
  { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'ur', name: 'Urdu (اردو)' },
  // Global
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese (Mandarin)' },
  { code: 'ar', name: 'Arabic' },
  { code: 'tr', name: 'Turkish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
];

type AudioMode = 'webspeech' | 'google-tts' | 'elevenlabs';

interface AudioPlayerProps {
  text: string;
  className?: string;
}

export default function AudioPlayer({ text, className }: AudioPlayerProps) {
  const { apiKeys } = useStore();
  const elevenlabsKey = apiKeys['elevenlabs'] ?? '';

  const [mode, setMode] = useState<AudioMode>(elevenlabsKey ? 'elevenlabs' : 'webspeech');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Web Speech state
  const [wsVoices, setWsVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [wsVoiceIdx, setWsVoiceIdx] = useState(0);
  const [wsRate, setWsRate] = useState(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Google TTS state
  const [gttsLang, setGttsLang] = useState('en');

  // ElevenLabs state
  const [elVoiceId, setElVoiceId] = useState(ELEVENLABS_VOICES[0]?.id ?? '');
  const [elModel, setElModel] = useState('eleven_turbo_v2_5');

  // Audio element for Google TTS / ElevenLabs
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const barHeights = useMemo(() => Array.from({ length: 28 }, (_, i) => getBarHeight(i)), []);

  // Load Web Speech voices — all languages, not just English
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      setWsVoices(all.slice(0, 30));
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  const stopAll = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
    utteranceRef.current = null;
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  // ── Web Speech play ───────────────────────────────────────────────────────
  const playWebSpeech = useCallback(() => {
    if (typeof window === 'undefined') return;
    stopAll();
    const u = new SpeechSynthesisUtterance(text);
    if (wsVoices[wsVoiceIdx]) u.voice = wsVoices[wsVoiceIdx];
    u.rate = wsRate;
    u.pitch = 1;
    u.onend = () => { setIsPlaying(false); setIsPaused(false); };
    u.onerror = () => { setIsPlaying(false); setIsPaused(false); };
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    setIsPlaying(true);
    setIsLoading(false);
  }, [text, wsVoices, wsVoiceIdx, wsRate, stopAll]);

  const pauseWebSpeech = useCallback(() => {
    if (isPaused) { window.speechSynthesis.resume(); setIsPaused(false); }
    else { window.speechSynthesis.pause(); setIsPaused(true); }
  }, [isPaused]);

  // ── Google TTS play ───────────────────────────────────────────────────────
  const playGoogleTTS = useCallback(async () => {
    stopAll();
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'google-tts', text: text.slice(0, 200), lang: gttsLang }),
      });
      const data = await res.json() as { dataUrl?: string; error?: string };
      if (data.error) throw new Error(data.error);
      if (!data.dataUrl) throw new Error('No audio returned');
      const audio = new Audio(data.dataUrl);
      audioRef.current = audio;
      audio.onended = () => { setIsPlaying(false); setIsLoading(false); };
      audio.onerror = () => { setIsPlaying(false); setIsLoading(false); setError('Playback failed'); };
      await audio.play();
      setIsPlaying(true);
      setIsLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setIsLoading(false);
    }
  }, [text, gttsLang, stopAll]);

  // ── ElevenLabs play ───────────────────────────────────────────────────────
  const playElevenLabs = useCallback(async () => {
    if (!elevenlabsKey) {
      setError('Add your ElevenLabs API key in the Keys tab. Get a free key at elevenlabs.io');
      return;
    }
    stopAll();
    setIsLoading(true);
    setError('');
    try {
      const voiceEntry = ELEVENLABS_VOICES.find((v) => v.id === elVoiceId);
      const resolvedModel = voiceEntry?.modelId ?? elModel;
      const res = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'elevenlabs',
          text,
          voiceId: elVoiceId,
          modelId: resolvedModel,
          apiKey: elevenlabsKey,
        }),
      });
      const data = await res.json() as { dataUrl?: string; error?: string };
      if (data.error) throw new Error(data.error);
      if (!data.dataUrl) throw new Error('No audio returned from ElevenLabs');
      const audio = new Audio(data.dataUrl);
      audioRef.current = audio;
      audio.onended = () => { setIsPlaying(false); setIsLoading(false); };
      audio.onerror = () => { setIsPlaying(false); setIsLoading(false); setError('Playback failed'); };
      await audio.play();
      setIsPlaying(true);
      setIsLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [text, elVoiceId, elModel, elevenlabsKey, stopAll]);

  const handlePlay = () => {
    if (mode === 'webspeech') {
      if (isPlaying) pauseWebSpeech();
      else playWebSpeech();
    } else if (mode === 'google-tts') {
      if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false); }
      else playGoogleTTS();
    } else {
      if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false); }
      else playElevenLabs();
    }
  };

  const downloadScript = useCallback(() => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ai-script.txt'; a.click();
    URL.revokeObjectURL(url);
  }, [text]);

  const downloadAudio = useCallback(() => {
    if (!audioRef.current?.src || !audioRef.current.src.startsWith('data:')) return;
    const a = document.createElement('a');
    a.href = audioRef.current.src;
    a.download = 'ai-audio.mp3'; a.click();
  }, []);

  const modeLabel = mode === 'elevenlabs' ? 'ElevenLabs' : mode === 'google-tts' ? 'Google TTS (Free)' : 'Web Speech';

  return (
    <div className={cn('rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900', className)}>
      {/* Waveform */}
      <div className="px-4 pt-4 pb-2 flex items-end gap-0.5 h-14">
        {barHeights.map((h, i) => (
          <motion.div
            key={i}
            className={cn('flex-1 rounded-full', mode === 'elevenlabs' ? 'bg-purple-500' : mode === 'google-tts' ? 'bg-blue-500' : 'bg-black dark:bg-white')}
            style={{ originY: 1 }}
            animate={isPlaying && !isPaused ? { scaleY: [h * 0.4, h, h * 0.4] } : { scaleY: h * 0.35 }}
            transition={isPlaying && !isPaused ? { duration: 0.6 + (i % 5) * 0.08, repeat: Infinity, delay: (i % 7) * 0.05, ease: 'easeInOut' } : { duration: 0.3 }}
          />
        ))}
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Mode selector */}
        <div className="flex gap-1">
          {(['webspeech', 'google-tts', 'elevenlabs'] as AudioMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { stopAll(); setMode(m); setError(''); }}
              className={cn(
                'flex-1 py-1 rounded-lg text-[10px] font-semibold border transition-all',
                mode === m
                  ? m === 'elevenlabs'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : m === 'google-tts'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-black dark:bg-white text-white dark:text-black border-transparent'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
              )}
            >
              {m === 'webspeech' ? 'Browser' : m === 'google-tts' ? 'Google TTS' : 'ElevenLabs'}
            </button>
          ))}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlay}
            disabled={isLoading}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-white transition-opacity flex-shrink-0',
              mode === 'elevenlabs' ? 'bg-purple-600 hover:bg-purple-700' : mode === 'google-tts' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-black dark:bg-white dark:text-black hover:opacity-80',
              isLoading && 'opacity-60 cursor-wait'
            )}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : isPlaying && !isPaused ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
          </button>

          {isPlaying && (
            <button onClick={stopAll} className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Square size={13} />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Volume2 size={12} />
              {modeLabel}
              {isLoading && <span className="text-[10px] text-gray-400 font-normal">Generating...</span>}
              {isPlaying && !isPaused && !isLoading && (
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-[10px] text-gray-400 font-normal">Playing...</motion.span>
              )}
            </div>
            <div className="text-[10px] text-gray-500 truncate mt-0.5">{text.slice(0, 60)}…</div>
          </div>

          <button onClick={mode === 'webspeech' ? downloadScript : downloadAudio} title="Download" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors">
            <Download size={14} />
          </button>
        </div>

        {/* Error */}
        {error && <p className="text-[11px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}

        {/* Web Speech controls */}
        {mode === 'webspeech' && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Speed</span>
              <select value={wsRate} onChange={(e) => setWsRate(parseFloat(e.target.value))} className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 text-[10px] outline-none text-gray-900 dark:text-white">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => <option key={s} value={s}>{s}x</option>)}
              </select>
            </label>
            {wsVoices.length > 0 && (
              <label className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 flex-shrink-0">Voice</span>
                <select value={wsVoiceIdx} onChange={(e) => setWsVoiceIdx(parseInt(e.target.value))} className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 text-[10px] outline-none text-gray-900 dark:text-white truncate">
                  {wsVoices.map((v, i) => <option key={i} value={i}>{v.name.replace('Google ', '').replace('Microsoft ', '')} ({v.lang})</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        {/* Google TTS controls */}
        {mode === 'google-tts' && (
          <div className="flex items-center gap-1.5">
            <Globe size={12} className="text-blue-500 flex-shrink-0" />
            <label className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 flex-shrink-0">Language</span>
              <select value={gttsLang} onChange={(e) => setGttsLang(e.target.value)} className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 text-[10px] outline-none text-gray-900 dark:text-white">
                {GOOGLE_TTS_LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </label>
            <span className="text-[9px] text-blue-500 font-semibold bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">FREE</span>
          </div>
        )}

        {/* ElevenLabs controls */}
        {mode === 'elevenlabs' && (
          <div className="space-y-2">
            {!elevenlabsKey && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                Add your ElevenLabs key in the Keys tab. <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer" className="underline font-semibold">Get 10,000 free chars/month</a>
              </p>
            )}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 flex-shrink-0">Voice</span>
                <select value={elVoiceId} onChange={(e) => setElVoiceId(e.target.value)} className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 text-[10px] outline-none text-gray-900 dark:text-white truncate">
                  {ELEVENLABS_VOICES.map((v) => <option key={`${v.id}-${v.name}`} value={v.id}>{v.name} — {v.lang}</option>)}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 flex-shrink-0">Model</span>
                <select value={elModel} onChange={(e) => setElModel(e.target.value)} className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 text-[10px] outline-none text-gray-900 dark:text-white">
                  <option value="eleven_turbo_v2_5">Turbo v2.5 (fastest)</option>
                  <option value="eleven_multilingual_v2">Multilingual v2 (29 langs)</option>
                  <option value="eleven_monolingual_v1">English v1</option>
                </select>
              </label>
              <span className="text-[9px] text-purple-600 font-semibold bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded-full flex-shrink-0">10K/mo Free</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
