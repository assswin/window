import React from 'react';
import { CalculationResult } from '../engine/types';
import { X, Trash2, FileSpreadsheet, ArrowRight, Calendar, Bookmark, FolderOpen } from 'lucide-react';
import { exportLSInteriorsToPDF } from '../utils/lsInteriorsSheetCanvas';
import { useLanguage } from '../context/LanguageContext';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedCalculations: CalculationResult[];
  onSelectCalculation: (calc: CalculationResult) => void;
  onDeleteCalculation: (id: string) => void;
  onClearAll: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  savedCalculations,
  onSelectCalculation,
  onDeleteCalculation,
  onClearAll
}) => {
  const { t } = useLanguage();

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <Bookmark className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                {t('சேமித்த ஆர்டர்கள் வரலாறு', 'Saved Calculation History')}
              </h2>
              <p className="text-xs text-slate-400">
                {savedCalculations.length} {t('பதிவுகள் உள்ளன', 'saved entries')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {savedCalculations.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <FolderOpen className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-400">
                {t('சேமித்த பதிவுகள் எதுவும் இல்லை', 'No saved calculations yet')}
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {t(
                  'ஜன்னல் அளவுகளை கணக்கிட்ட பின், பதிவுகளை இங்கே சேமிக்கலாம்.',
                  'After calculating window dimensions, tap "Save" to keep records here.'
                )}
              </p>
            </div>
          ) : (
            savedCalculations.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition space-y-2.5"
              >
                {/* Top Row: Type & Date */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-1.5 font-medium flex-wrap gap-y-1">
                    {item.input.windowLabel && (
                      <span className="font-bold text-white text-xs px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900">
                        {item.input.windowLabel}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase text-[10px]">
                      {item.input.frameType.replace('-', ' ')}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase text-[10px]">
                      {item.input.windowType}
                    </span>
                  </div>
                  <span className="text-slate-500 flex items-center space-x-1 font-mono text-[10px]">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                  </span>
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Input (H × W):</span>
                    <span className="text-white font-bold">
                      {item.input.heightInch}" × {item.input.widthInch}"
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      ({item.convertedHeightMM} × {item.convertedWidthMM} mm)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Shutter Cut (H × W):</span>
                    <span className="text-white font-bold">
                      {item.panel.heightMM} × {item.panel.widthMM} mm
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {item.panel.count} Panes
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      onSelectCalculation(item);
                      onClose();
                    }}
                    className="text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Load</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => exportLSInteriorsToPDF([item])}
                      title="L.S. Interiors Order Sheet PDF"
                      className="p-1.5 rounded-lg bg-blue-900/50 text-blue-300 hover:text-white hover:bg-blue-800 border border-blue-700/60 transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteCalculation(item.id)}
                      title="Delete Entry"
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-700 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {savedCalculations.length > 0 && (
          <div className="p-3 border-t border-slate-800 bg-slate-950">
            <button
              onClick={() => {
                if (confirm(t('சேமித்த அனைத்து பதிவுகளையும் நீக்கவா?', 'Clear all saved calculations?'))) {
                  onClearAll();
                }
              }}
              className="w-full py-2 text-xs font-bold text-red-400 hover:bg-red-950/40 rounded-lg transition border border-red-900/40"
            >
              {t('அனைத்து பதிவுகளையும் நீக்குக', 'Clear All Saved Calculations')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
