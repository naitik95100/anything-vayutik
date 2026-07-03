'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function ReferralPopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show on first visit — check localStorage
    const hasSeenReferral = localStorage.getItem('referral-popup-seen');
    if (!hasSeenReferral) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('referral-popup-seen', 'true');
    setIsVisible(false);
  };

  const handleOpenReferral = () => {
    window.open('https://v0.app/ref/43W1M2', '_blank', 'noopener,noreferrer');
    handleDismiss();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-sm mx-4 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors z-10"
          aria-label="Close popup"
        >
          <X size={20} className="text-gray-600 dark:text-gray-400" />
        </button>

        {/* Content */}
        <div className="p-8 pt-12 text-center space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Help Us Build Better AI
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Join our community and get exclusive benefits
            </p>
          </div>

          {/* Main message */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 space-y-4">
            <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
              Register on <span className="font-bold text-blue-600 dark:text-blue-400">v0.app</span> using our referral link and get{' '}
              <span className="text-lg font-bold text-green-600 dark:text-green-400">$10 credits</span> on v0.app!
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 italic">
              Help us create more powerful AI for you.
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleOpenReferral}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Claim Your $10 Credit
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-500 dark:text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* Footer with close option */}
          <button
            onClick={handleDismiss}
            className="w-full text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Continue Using App
          </button>

          {/* Credit */}
          <p className="text-xs text-gray-500 dark:text-gray-400 pt-2">
            Thank you! App created with <span className="text-red-500">❤</span> for you by{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-300">VayuTik</span>
          </p>
        </div>
      </div>
    </div>
  );
}
