'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Square, Volume2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

// Stable waveform heights based on index only — no Math.random() in render
function getBarHeight(index: number): number {
  const v = Math.sin(index * 0.7 + 1.3) * 0.35 + 0.55;
  return Math.max(0.15, Math.min(0.95, v));
}

interface AudioPlayerProps {
  text: string;
  className?: string;
}

export default function AudioPlayer({ text, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [rate, setRate] = useState(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stable bar heights — computed once, no randomness
  const barHeights = useMemo(() => Array.from({ length: 28 }, (_, i) => getBarHeight(i)), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
      setVoices(v.slice(0, 8));
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const stop = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    utteranceRef.current = null;
  }, []);

  const play = useCallback(() => {
    if (typeof window === 'undefined') return;
    stop();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voices[selectedVoice]) utterance.voice = voices[selectedVoice];
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  }, [text, voices, selectedVoice, rate, stop]);

  const pause = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  const downloadScript = useCallback(() => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-audio-script.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [text]);

  useEffect(
    () => () => {
      if (typeof window !== 'undefined') window.speechSynthesis.cancel();
    },
    []
  );

  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900',
        className
      )}
    >
      {/* Waveform visualization — stable heights, animate only when playing */}
      <div className="px-4 pt-4 pb-2 flex items-end gap-0.5 h-14">
        {barHeights.map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 bg-black dark:bg-white rounded-full"
            style={{ originY: 1 }}
            animate={
              isPlaying && !isPaused ? { scaleY: [h * 0.4, h, h * 0.4] } : { scaleY: h * 0.35 }
            }
            transition={
              isPlaying && !isPaused
                ? {
                    duration: 0.6 + (i % 5) * 0.08,
                    repeat: Infinity,
                    delay: (i % 7) * 0.05,
                    ease: 'easeInOut',
                  }
                : { duration: 0.3 }
            }
          />
        ))}
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={isPlaying ? pause : play}
            className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black hover:opacity-80 transition-opacity flex-shrink-0"
          >
            {isPlaying && !isPaused ? (
              <Pause size={18} />
            ) : (
              <Play size={18} className="translate-x-0.5" />
            )}
          </button>
          {isPlaying && (
            <button
              onClick={stop}
              className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Square size={13} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Volume2 size={12} />
              AI Audio Script
              {isPaused && <span className="text-gray-400 font-normal text-[10px]">Paused</span>}
              {isPlaying && !isPaused && (
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="text-gray-400 font-normal text-[10px]"
                >
                  Playing...
                </motion.span>
              )}
            </div>
            <div className="text-[10px] text-gray-500 truncate mt-0.5">{text.slice(0, 70)}…</div>
          </div>
          <button
            onClick={downloadScript}
            title="Download script"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Download size={14} />
          </button>
        </div>

        {/* Speed + Voice */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Speed
            </span>
            <select
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 text-[10px] outline-none text-gray-900 dark:text-white"
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
          </label>
          {voices.length > 0 && (
            <label className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 flex-shrink-0">
                Voice
              </span>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(parseInt(e.target.value))}
                className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 text-[10px] outline-none text-gray-900 dark:text-white truncate"
              >
                {voices.map((v, i) => (
                  <option key={i} value={i}>
                    {v.name.replace('Google ', '').replace('Microsoft ', '')}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
