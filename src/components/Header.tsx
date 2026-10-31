import React from 'react';
import { Layers, History, SlidersHorizontal, FileSpreadsheet } from 'lucide-react';
import { LanguageSwitch } from './LanguageSwitch';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenTests?: () => void;
  onOpenFormulaSettings?: () => void;
  onOpenLSInteriorsModal?: () => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHistory,
  onOpenFormulaSettings,
  onOpenLSInteriorsModal,
  historyCount
}) => {
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3">
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          <Layers className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div>
            <h1 className="text-sm sm:text-lg font-heading font-bold text-white tracking-tight leading-none flex items-center gap-2">
              <span>L.S. INTERIORS</span>
              <span className="text-xs font-normal text-slate-400 font-sans hidden md:inline border-l border-slate-700 pl-2">
                {t('uPVC ஜன்னல் கால்குலேட்டர்', 'uPVC Window Calculator')}
              </span>
            </h1>
          </div>
        </div>

        {/* Action Buttons & Language Switcher */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5">
          {/* Translate / Language Switch Button */}
          <LanguageSwitch variant="compact" />

          {onOpenLSInteriorsModal && (
            <button
              onClick={onOpenLSInteriorsModal}
              title={t('L.S. Interiors ஆர்டர் தாள் PDF', 'L.S. Interiors Order Sheet PDF')}
              aria-label="Export L.S. Interiors Order Sheet"
              className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold border border-blue-400 shadow transition cursor-pointer active:scale-95 touch-manipulation"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">L.S. Interiors PDF</span>
              <span className="sm:hidden text-[11px]">PDF</span>
            </button>
          )}

          {onOpenFormulaSettings && (
            <button
              onClick={onOpenFormulaSettings}
              title={t('சூத்திர எண்களை மாற்ற (Formula Settings)', 'Customize Formula Settings')}
              aria-label="Customize Formula Numbers"
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation"
            >
              <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            </button>
          )}

          {/* History Button */}
          <button
            onClick={onOpenHistory}
            title={t('சேமித்த ஆர்டர்கள்', 'Saved Window Orders')}
            aria-label="Open saved calculations history"
            className="relative p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation"
          >
            <History className="w-4 h-4 text-slate-200" />
            {historyCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] font-mono font-bold flex items-center justify-center border border-slate-900">
                {historyCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
