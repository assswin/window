import React from 'react';
import { RotateCcw, Trash2, X, Check, Clock, AlertTriangle, Layers } from 'lucide-react';
import { DeletedWindowEntry } from '../utils/tenWindowsData';
import { useLanguage } from '../context/LanguageContext';

interface RestoreDeletedModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletedWindows: DeletedWindowEntry[];
  onRestoreWindow: (id: string) => void;
  onRestoreAll: () => void;
  onPermanentlyDelete: (id: string) => void;
  onClearAll: () => void;
}

export const RestoreDeletedModal: React.FC<RestoreDeletedModalProps> = ({
  isOpen,
  onClose,
  deletedWindows,
  onRestoreWindow,
  onRestoreAll,
  onPermanentlyDelete,
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

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return t('சற்று முன்', 'Just now');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} ${t('நிமிடம் முன்', 'min ago')}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${t('மணி நேரம் முன்', 'hr ago')}`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 font-bold border border-amber-500/40">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{t('நீக்கப்பட்ட ஜன்னல்கள் மீட்டெடுப்பு', 'Restore Deleted Windows')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/70 font-mono font-bold">
                  {deletedWindows.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t(
                  'தவறுதலாக நீக்கப்பட்ட எந்த ஜன்னலின் அளவுகளையும் உடனடியாக மீட்டெடுக்கலாம்',
                  'Recover any accidentally deleted window inputs with 1 click'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 overscroll-contain">
          {deletedWindows.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-500 mx-auto flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {t('நீக்கப்பட்ட ஜன்னல்கள் எதுவும் இல்லை', 'No Recently Deleted Windows')}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {t(
                  'நீங்கள் ஏதேனும் ஜன்னலை நீக்கினால், அது இங்கு சேமிக்கப்பட்டு மீட்டெடுக்க தயாராக இருக்கும்.',
                  'When you delete a window from the schedule, it will appear here so you can recover its data anytime.'
                )}
              </p>
            </div>
          ) : (
            deletedWindows.map((entry) => {
              const win = entry.window;
              return (
                <div
                  key={entry.id}
                  className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-blue-950/90 border border-blue-800/80 text-blue-300 font-mono text-xs font-bold flex-shrink-0 mt-0.5">
                      {entry.displayLabel}
                    </span>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-200">
                          {entry.typeSummary}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          • {entry.dimensionSummary}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{formatTimeAgo(entry.deletedAt)}</span>
                        </span>
                        <span>•</span>
                        <span className="text-slate-400">
                          {win.profileSeries || '58mm'} • {win.unit || 'inch'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t border-slate-900 sm:border-0">
                    <button
                      type="button"
                      onClick={() => onRestoreWindow(entry.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
                      title={t('இந்த ஜன்னலை அட்டவணையில் சேர்க்க', 'Restore this window')}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('மீட்டெடு', 'Restore')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onPermanentlyDelete(entry.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                      title={t('நிரந்தரமாக நீக்கு', 'Remove permanently')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        {deletedWindows.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 px-2 py-1 rounded transition cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>{t('பட்டியலை அழி', 'Clear All')}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
              >
                {t('மூடு', 'Close')}
              </button>

              <button
                type="button"
                onClick={onRestoreAll}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t(`அனைத்தையும் மீட்டெடு (${deletedWindows.length})`, `Restore All (${deletedWindows.length})`)}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
