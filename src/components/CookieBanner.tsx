import React, { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';
import { LegalTab } from './LegalModal';

export const COOKIE_CONSENT_KEY = 'windowbuilder_cookie_consent';

interface CookieBannerProps {
  onOpenLegal: (tab: LegalTab) => void;
  isOverlayActive?: boolean;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ onOpenLegal, isOverlayActive = false }) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        // Smooth delay after initial load
        const timer = setTimeout(() => setIsVisible(true), 600);
        return () => clearTimeout(timer);
      }
    } catch (_) {}
  }, []);

  const handleAccept = (choice: 'accepted' | 'essential') => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, choice);
    } catch (_) {}
    setIsVisible(false);
  };

  // Don't render if dismissed, or if any modal/overlay is currently active
  if (!isVisible || isOverlayActive) return null;

  return (
    <aside 
      aria-label="Cookie and storage notice"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl rounded-2xl p-3 sm:p-3.5 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start space-x-2">
          <Cookie className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Offline Storage Notice
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Window calculations and preferences are saved locally on your device for offline use.
            </p>
          </div>
        </div>

        <button
          onClick={() => handleAccept('essential')}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer flex-shrink-0"
          aria-label="Dismiss cookie notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between pt-1 gap-2 border-t border-slate-800 text-[11px]">
        <button
          type="button"
          onClick={() => onOpenLegal('cookies')}
          className="font-semibold text-slate-400 hover:text-slate-200 underline underline-offset-2 transition cursor-pointer"
        >
          Privacy Policy
        </button>

        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => handleAccept('essential')}
            className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition active:scale-95 border border-slate-700 cursor-pointer"
          >
            Essential
          </button>

          <button
            type="button"
            onClick={() => handleAccept('accepted')}
            className="py-1 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </aside>
  );
};
