'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  icon: string;
  highlight?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Vayu Nexus',
    description:
      'Your all-in-one AI platform with 10+ providers — Groq, Google, NVIDIA, OpenRouter and more. All your conversations, images and audio in one place.',
    icon: '🔥',
    highlight: 'Free to start — no credit card required',
  },
  {
    title: 'Pick a Provider & Model',
    description:
      'Click the right panel to open Providers. Add your free API key (Groq is free, Google AI Studio is free, NVIDIA gives 1000 credits). Then select the model you want.',
    icon: '🔑',
    highlight: 'Most providers offer generous free tiers',
  },
  {
    title: 'Generate Images for Free',
    description:
      'Type /image followed by your prompt. Vayu Nexus uses Pollinations.AI (completely free, no key needed) as the default — or use your NVIDIA / Novita / Replicate key for premium quality.',
    icon: '🖼️',
    highlight: 'Try: /image a futuristic city at sunset',
  },
  {
    title: 'Text-to-Speech Audio',
    description:
      'Type /audio followed by any topic. Choose Google TTS (free, no key) or add your ElevenLabs key for 60+ voices including Hindi, Tamil, Telugu and more Indian languages.',
    icon: '🎙️',
    highlight: 'Try: /audio explain black holes in simple terms',
  },
  {
    title: 'Conversations & History',
    description:
      'All your chats are saved locally. Use the sidebar to switch conversations, rename, pin or star your favourites. On mobile, tap the menu icon to open the sidebar.',
    icon: '💬',
    highlight: 'Swipe or tap the hamburger menu on mobile',
  },
  {
    title: 'Slash Commands & Templates',
    description:
      'Type / to see all commands. Use /code for code generation, /image for images, /audio for speech. Access prompt templates from the Templates tab in the right panel.',
    icon: '⚡',
    highlight: 'Type / in the chat box to get started',
  },
];

const STORAGE_KEY = 'vayu_nexus_tour_done';

export function GuideTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setVisible(true);
    } catch {
      // localStorage may be unavailable in some environments
    }
  }, []);

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  }

  function next() {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      close();
    }
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1);
  }

  const current = TOUR_STEPS[step];

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="tour-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
          />

          {/* Card */}
          <motion.div
            key="tour-card"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 bottom-6 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[420px] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[91] overflow-hidden"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step
                        ? 'w-6 bg-orange-500'
                        : i < step
                          ? 'w-1.5 bg-orange-300 dark:bg-orange-700'
                          : 'w-1.5 bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={close}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Close guide"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 pb-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="text-4xl mb-3">{current.icon}</div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {current.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                    {current.description}
                  </p>
                  {current.highlight && (
                    <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl px-3 py-2 text-xs text-orange-700 dark:text-orange-300 font-medium">
                      {current.highlight}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4">
              <button
                onClick={close}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={prev}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronLeft size={14} />
                    Back
                  </button>
                )}
                <button
                  onClick={next}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
                >
                  {step < TOUR_STEPS.length - 1 ? (
                    <>
                      Next
                      <ChevronRight size={14} />
                    </>
                  ) : (
                    "Let's go!"
                  )}
                </button>
              </div>
            </div>

            {/* Step counter */}
            <div className="pb-3 text-center text-[10px] text-gray-400">
              {step + 1} of {TOUR_STEPS.length}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
