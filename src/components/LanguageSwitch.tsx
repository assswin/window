import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Languages } from 'lucide-react';

interface LanguageSwitchProps {
  variant?: 'compact' | 'full';
  showIcon?: boolean;
  className?: string;
}

export const LanguageSwitch: React.FC<LanguageSwitchProps> = ({
  variant = 'compact',
  showIcon = true,
  className = ''
}) => {
  const { language, setLanguage, toggleLanguage, isTamil, isEnglish } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language Switcher"
      className={`inline-flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-700/80 shadow-inner select-none ${className}`}
    >
      {showIcon && (
        <button
          type="button"
          onClick={toggleLanguage}
          title={isTamil ? 'Switch to English' : 'தமிழுக்கு மாறவும்'}
          className="p-1 text-slate-400 hover:text-blue-400 transition cursor-pointer flex items-center justify-center"
        >
          <Languages className="w-3.5 h-3.5" />
        </button>
      )}

      {/* English Option */}
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2 py-1 rounded-md text-xs font-bold transition-all duration-200 cursor-pointer touch-manipulation ${
          isEnglish
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'
        }`}
        title="Switch to English"
      >
        {variant === 'full' ? 'English' : 'EN'}
      </button>

      {/* Tamil Option */}
      <button
        type="button"
        onClick={() => setLanguage('ta')}
        className={`px-2 py-1 rounded-md text-xs font-bold transition-all duration-200 cursor-pointer touch-manipulation font-sans ${
          isTamil
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'
        }`}
        title="தமிழுக்கு மாற்றவும் (Switch to Tamil)"
      >
        தமிழ்
      </button>
    </div>
  );
};
