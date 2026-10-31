import React, { useState, useEffect, useRef } from 'react';
import { FrameType, WindowType, WindowInput, UPVCSeries, GlassType, VentilatorSubtype, VentilatorFanSide, UnitType, CasementSubtype } from '../engine/types';
import { WindowCalculationEngine } from '../engine/calculator';
import { RulesEngineManager } from '../engine/rules';
import { RotateCcw, AlertCircle, Minus, Plus, ArrowRight, PlusCircle, Trash2, SlidersHorizontal } from 'lucide-react';
import { GlobalSettings, createNewWindow } from '../utils/tenWindowsData';
import { useLanguage } from '../context/LanguageContext';
import { computeWindowVariantLabels } from '../utils/lsInteriorsSheetCanvas';

export const FRACTION_OPTIONS: { label: string; value: number }[] = [
  { label: '1/2', value: 0.5 },
  { label: '1/4', value: 0.25 },
  { label: '1/8', value: 0.125 },
  { label: '2/8', value: 0.25 },
  { label: '3/8', value: 0.375 },
  { label: '4/8', value: 0.5 },
  { label: '5/8', value: 0.625 },
  { label: '6/8', value: 0.75 },
  { label: '7/8', value: 0.875 },
  { label: '3/4', value: 0.75 }
];

interface WindowInputFormProps {
  windows: WindowInput[];
  onWindowsChange?: (windows: WindowInput[]) => void;
  onSaveAndCalculateAll: (windows: WindowInput[]) => void;
  onResetAll: () => void;
  activeWindowIndex: number;
  onSelectWindowIndex: (index: number) => void;
  onAddWindow: (currentWindows?: WindowInput[]) => void;
  onDeleteWindow: (index: number) => void;
  onOpenFormulaSettings?: () => void;
  rulesVersion?: number;
}

export const WindowInputForm: React.FC<WindowInputFormProps> = ({
  windows: initialWindows,
  onWindowsChange,
  onSaveAndCalculateAll,
  onResetAll,
  activeWindowIndex,
  onSelectWindowIndex,
  onAddWindow,
  onDeleteWindow,
  onOpenFormulaSettings,
  rulesVersion
}) => {
  const { t } = useLanguage();
  const [windows, setWindows] = useState<WindowInput[]>(initialWindows);
  const lastEmittedRef = useRef<WindowInput[] | null>(null);

  const [activeUnit, setActiveUnit] = useState<UnitType>(() => initialWindows[0]?.unit || 'inch');

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(() => {
    return {
      conversionFactor: initialWindows[0]?.conversionFactor ?? 25.4,
      customOffsetMM: Math.max(0, initialWindows[0]?.customOffsetMM ?? 0),
      weldingAllowanceMM: 0,
      profileSeries: initialWindows[0]?.profileSeries ?? '60mm',
      reinforcementSteel: false,
      glassType: initialWindows[0]?.glassType ?? '5mm_single',
      inputUnit: initialWindows[0]?.unit ?? 'inch'
    };
  });

  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [error, setError] = useState<string | null>(null);
  const [openOptionIndex, setOpenOptionIndex] = useState<number | null>(null);

  // Synchronize when external props change (e.g. from handleAddWindow, handleDeleteWindow, handleResetAll)
  useEffect(() => {
    if (initialWindows === lastEmittedRef.current) return;
    setWindows(initialWindows);
    if (initialWindows[0]?.unit && initialWindows[0].unit !== activeUnit) {
      setActiveUnit(initialWindows[0].unit);
    }
  }, [initialWindows]);

  // Real-time variant labels dynamically computed from current window inputs
  const variantLabels = computeWindowVariantLabels(windows);

  // Update global formula and propagate to all windows
  const updateGlobalSetting = <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
    const updatedSettings = { ...globalSettings, [key]: value };
    setGlobalSettings(updatedSettings);

    const updated = windows.map((win) => ({
      ...win,
      [key]: value
    }));
    const variants = computeWindowVariantLabels(updated);
    const updatedWithLabels = updated.map((win, i) => ({
      ...win,
      windowLabel: variants[i]?.windowLabel || ('W' + (i + 1))
    }));
    lastEmittedRef.current = updatedWithLabels;
    setWindows(updatedWithLabels);
    onWindowsChange?.(updatedWithLabels);
  };

  // Switch input format design: Inch, CM, MM
  const switchUnit = (newUnit: UnitType) => {
    setActiveUnit(newUnit);
    updateGlobalSetting('inputUnit', newUnit);
    const updated = windows.map((w) => {
      const wInch = w.widthInch || 48;
      const hInch = w.heightInch || 60;
      const wCm = w.widthCm ?? Number((wInch * 2.54).toFixed(1));
      const hCm = w.heightCm ?? Number((hInch * 2.54).toFixed(1));
      const wMM = w.widthMM ?? Math.round(wInch * 25.4);
      const hMM = w.heightMM ?? Math.round(hInch * 25.4);
      return {
        ...w,
        unit: newUnit,
        widthCm: wCm,
        heightCm: hCm,
        widthMM: wMM,
        heightMM: hMM
      };
    });
    const variants = computeWindowVariantLabels(updated);
    const updatedWithLabels = updated.map((win, i) => ({
      ...win,
      windowLabel: variants[i]?.windowLabel || ('W' + (i + 1))
    }));
    lastEmittedRef.current = updatedWithLabels;
    setWindows(updatedWithLabels);
    onWindowsChange?.(updatedWithLabels);
  };

  // Adjust global factor
  const adjustGlobalFactor = (delta: number) => {
    const next = Math.max(10, Math.min(50, Math.round((globalSettings.conversionFactor + delta) * 10) / 10));
    updateGlobalSetting('conversionFactor', next);
  };

  // Adjust global offset (added mm: no negative integer, min 0, initialize 0)
  const adjustGlobalOffset = (delta: number) => {
    const current = Math.max(0, globalSettings.customOffsetMM || 0);
    const next = Math.max(0, Math.min(50, current + delta));
    updateGlobalSetting('customOffsetMM', next);
  };

  // Update single window field
  const updateWindow = (index: number, updates: Partial<WindowInput>) => {
    setError(null);
    const updated = windows.map((win, i) => (i === index ? { ...win, ...updates } : win));
    const variants = computeWindowVariantLabels(updated);
    const updatedWithLabels = updated.map((win, i) => ({
      ...win,
      windowLabel: variants[i]?.windowLabel || ('W' + (i + 1))
    }));
    lastEmittedRef.current = updatedWithLabels;
    setWindows(updatedWithLabels);
    onWindowsChange?.(updatedWithLabels);
  };

  // Adjust width or height of a specific window (with 44px min touch target)
  const adjustDimension = (index: number, dim: 'width' | 'height', delta: number) => {
    setError(null);
    const win = windows[index];
    if (activeUnit === 'cm') {
      const curCm = (dim === 'width' ? win.widthCm : win.heightCm) ?? Number(((dim === 'width' ? win.widthInch : win.heightInch) * 2.54).toFixed(1));
      const nextCm = Math.max(1, Math.min(1000, Math.round((curCm + delta) * 10) / 10));
      const nextMM = Math.round(nextCm * 10);
      const nextInch = Number((nextCm / 2.54).toFixed(3));
      updateWindow(index, dim === 'width'
        ? { widthCm: nextCm, widthMM: nextMM, widthInch: nextInch }
        : { heightCm: nextCm, heightMM: nextMM, heightInch: nextInch }
      );
    } else if (activeUnit === 'mm') {
      const curMM = (dim === 'width' ? win.widthMM : win.heightMM) ?? Math.round((dim === 'width' ? win.widthInch : win.heightInch) * 25.4);
      const nextMM = Math.max(10, Math.min(10000, curMM + (delta * 10)));
      const nextCm = Number((nextMM / 10).toFixed(1));
      const nextInch = Number((nextMM / 25.4).toFixed(3));
      updateWindow(index, dim === 'width'
        ? { widthMM: nextMM, widthCm: nextCm, widthInch: nextInch }
        : { heightMM: nextMM, heightCm: nextCm, heightInch: nextInch }
      );
    } else {
      // inch
      const current = (dim === 'width' ? win.widthInch : win.heightInch) || (dim === 'width' ? 48 : 60);
      const next = Math.max(1, Math.min(dim === 'width' ? 400 : 300, Math.round((current + delta) * 1000) / 1000));
      const nextCm = Number((next * 2.54).toFixed(2));
      const nextMM = Math.round(next * 25.4);
      updateWindow(index, dim === 'width'
        ? { widthInch: next, widthCm: nextCm, widthMM: nextMM }
        : { heightInch: next, heightCm: nextCm, heightMM: nextMM }
      );
    }
  };

  // Track explicitly selected fraction chip label per window and dimension, e.g. "0_height": "3/8"
  const [activeFractionChips, setActiveFractionChips] = useState<Record<string, string>>({});

  const handleFractionClick = (index: number, dim: 'width' | 'height', chip: { label: string; value: number }) => {
    setError(null);
    const win = windows[index];
    const current = (dim === 'width' ? win.widthInch : win.heightInch) || 0;
    const whole = Math.floor(current);
    const currentFraction = Math.round((current - whole) * 1000) / 1000;

    const key = `${index}_${dim}`;
    const activeLabel = activeFractionChips[key];

    let nextInch: number;
    // If the same fraction is clicked again, toggle it off back to whole inches
    if (Math.abs(currentFraction - chip.value) < 0.0001 && (!activeLabel || activeLabel === chip.label)) {
      nextInch = whole;
      setActiveFractionChips((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    } else {
      // Set the fraction exactly on top of the whole inch part with 3 decimal precision
      nextInch = Math.round((whole + chip.value) * 1000) / 1000;
      setActiveFractionChips((prev) => ({
        ...prev,
        [key]: chip.label
      }));
    }

    const nextCm = Number((nextInch * 2.54).toFixed(2));
    const nextMM = Math.round(nextInch * 25.4);
    updateWindow(index, dim === 'width'
      ? { widthInch: nextInch, widthCm: nextCm, widthMM: nextMM }
      : { heightInch: nextInch, heightCm: nextCm, heightMM: nextMM }
    );
  };

  const isChipActive = (index: number, dim: 'width' | 'height', chip: { label: string; value: number }, currentInch: number) => {
    const current = currentInch || 0;
    const whole = Math.floor(current);
    const currentFraction = Math.round((current - whole) * 1000) / 1000;
    if (Math.abs(currentFraction - chip.value) >= 0.0001) {
      return false;
    }
    const key = `${index}_${dim}`;
    const activeLabel = activeFractionChips[key];
    const recordedChip = FRACTION_OPTIONS.find((c) => c.label === activeLabel);
    if (recordedChip && Math.abs(recordedChip.value - currentFraction) < 0.0001) {
      return activeLabel === chip.label;
    }
    // Default fallback when fraction matches without explicit chip label recorded
    if (chip.value === 0.25) return chip.label === '1/4';
    if (chip.value === 0.5) return chip.label === '1/2';
    if (chip.value === 0.75) return chip.label === '3/4';
    return true;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate all windows
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      if (activeUnit === 'cm') {
        const wVal = w.widthCm ?? (w.widthInch * 2.54);
        const hVal = w.heightCm ?? (w.heightInch * 2.54);
        if (!wVal || isNaN(wVal) || wVal <= 0) {
          setError(t(`W${i + 1}: தயவுசெய்து சரியான அகலத்தை உள்ளிடவும் (செ.மீ).`, `W${i + 1}: Please enter a valid width (CM).`));
          onSelectWindowIndex(i);
          return;
        }
        if (!hVal || isNaN(hVal) || hVal <= 0) {
          setError(t(`W${i + 1}: தயவுசெய்து சரியான உயரத்தை உள்ளிடவும் (செ.மீ).`, `W${i + 1}: Please enter a valid height (CM).`));
          onSelectWindowIndex(i);
          return;
        }
      } else if (activeUnit === 'mm') {
        const wVal = w.widthMM ?? (w.widthInch * 25.4);
        const hVal = w.heightMM ?? (w.heightInch * 25.4);
        if (!wVal || isNaN(wVal) || wVal <= 0) {
          setError(t(`W${i + 1}: தயவுசெய்து சரியான அகலத்தை உள்ளிடவும் (மி.மீ).`, `W${i + 1}: Please enter a valid width (MM).`));
          onSelectWindowIndex(i);
          return;
        }
        if (!hVal || isNaN(hVal) || hVal <= 0) {
          setError(t(`W${i + 1}: தயவுசெய்து சரியான உயரத்தை உள்ளிடவும் (மி.மீ).`, `W${i + 1}: Please enter a valid height (MM).`));
          onSelectWindowIndex(i);
          return;
        }
      } else {
        if (!w.widthInch || isNaN(w.widthInch) || w.widthInch <= 0) {
          setError(t(`W${i + 1}: தயவுசெய்து சரியான அகலத்தை உள்ளிடவும் (அங்குலம்).`, `W${i + 1}: Please enter a valid width (Inches).`));
          onSelectWindowIndex(i);
          return;
        }
        if (!w.heightInch || isNaN(w.heightInch) || w.heightInch <= 0) {
          setError(t(`W${i + 1}: தயவுசெய்து சரியான உயரத்தை உள்ளிடவும் (அங்குலம்).`, `W${i + 1}: Please enter a valid height (Inches).`));
          onSelectWindowIndex(i);
          return;
        }
      }
    }

    const variants = computeWindowVariantLabels(windows);
    const preparedWindows = windows.map((w, idx) => ({
      ...w,
      windowLabel: variants[idx]?.windowLabel || ('W' + (idx + 1)),
      unit: activeUnit
    }));
    onSaveAndCalculateAll(preparedWindows);
  };

  // Small box with option button (a to z) for architectural window labeling
  const renderOptionButtonBox = (winIndex: number, currentWin: WindowInput) => {
    const isMenuOpen = openOptionIndex === winIndex;
    const currentLetter = (currentWin.variantLetter || '').toLowerCase();
    const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));

    return (
      <div className="relative inline-flex items-center">
        {/* Small Box Container */}
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-wider">
            {t('விருப்பம்', 'Option')}:
          </span>

          {/* Option Button with Selected Letter & Dropdown Arrow */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenOptionIndex(isMenuOpen ? null : winIndex);
            }}
            className="px-2 py-0.5 rounded bg-blue-950/90 hover:bg-blue-900 border border-blue-600/80 text-blue-300 font-mono font-bold text-xs flex items-center gap-1 cursor-pointer transition active:scale-95 shadow-sm"
            title={t('விருப்ப எழுத்து (a to z) தேர்வு செய்க', 'Select Option Button (a to z)')}
          >
            <span className={currentLetter ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
              {currentLetter ? currentLetter : '-'}
            </span>
            <span className="text-[9px] text-blue-400">▾</span>
          </button>
        </div>

        {/* Dropdown Menu Popup with (a to z) Buttons */}
        {isMenuOpen && (
          <>
            {/* Click-outside backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpenOptionIndex(null)}
            />

            <div className="absolute left-0 top-full mt-1.5 z-50 p-2.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl w-[270px] space-y-2 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-xs font-bold text-white flex items-center gap-1">
                  <span>🔤</span>
                  <span>{t('விருப்ப எழுத்து (a to z)', 'Option Button (a to z)')}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    updateWindow(winIndex, { variantLetter: '' });
                    setOpenOptionIndex(null);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                >
                  {t('நீக்கு (-)', 'None (-)')}
                </button>
              </div>

              {/* 7-column Grid of Buttons for letters 'a' through 'z' */}
              <div className="grid grid-cols-7 gap-1">
                {alphabet.map((char) => {
                  const isSelected = currentLetter === char;
                  return (
                    <button
                      key={char}
                      type="button"
                      onClick={() => {
                        updateWindow(winIndex, { variantLetter: char });
                        setOpenOptionIndex(null);
                      }}
                      className={
                        'h-7 rounded text-xs font-mono font-bold transition flex items-center justify-center cursor-pointer ' +
                        (isSelected
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/40 ring-2 ring-blue-400'
                          : 'bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800')
                      }
                      title={`Select option ${char} (W${winIndex + 1}${char})`}
                    >
                      {char}
                    </button>
                  );
                })}
              </div>

              {/* Direct Select dropdown for fast picking */}
              <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">{t('டிராப்டவுன்:', 'Dropdown:')}</span>
                <select
                  value={currentLetter}
                  onChange={(e) => {
                    updateWindow(winIndex, { variantLetter: e.target.value });
                    setOpenOptionIndex(null);
                  }}
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-blue-300 cursor-pointer"
                >
                  <option value="">- {t('இல்லை (None)', 'None')} -</option>
                  {alphabet.map((char) => (
                    <option key={char} value={char}>
                      {char} ({char.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const activeWin = windows[activeWindowIndex] || windows[0] || createNewWindow(0);
  const isVentilator = activeWin.windowType === 'ventilator';
  const addedMM = Math.max(0, globalSettings.customOffsetMM || 0);
  const effectiveAddedMM = isVentilator ? 0 : addedMM;

  const activeValW = activeUnit === 'cm'
    ? (activeWin.widthCm ?? Number((activeWin.widthInch * 2.54).toFixed(1)))
    : activeUnit === 'mm'
      ? (activeWin.widthMM ?? Math.round(activeWin.widthInch * 25.4))
      : activeWin.widthInch;

  const activeValH = activeUnit === 'cm'
    ? (activeWin.heightCm ?? Number((activeWin.heightInch * 2.54).toFixed(1)))
    : activeUnit === 'mm'
      ? (activeWin.heightMM ?? Math.round(activeWin.heightInch * 25.4))
      : activeWin.heightInch;

  const activeLiveWMM = WindowCalculationEngine.unitToMM(
    activeValW,
    activeUnit,
    globalSettings.conversionFactor,
    effectiveAddedMM
  );
  const activeLiveHMM = WindowCalculationEngine.unitToMM(
    activeValH,
    activeUnit,
    globalSettings.conversionFactor,
    effectiveAddedMM
  );

  return (
    <form
      onSubmit={handleFormSubmit}
      className="w-full bg-slate-900 rounded-xl border border-slate-800 p-3 sm:p-4 space-y-4 text-slate-100 flex flex-col"
    >
      {/* 1. SECTION TITLE & ACTIONS */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-shrink-0">
        <div>
          <h2 className="text-base font-heading font-bold text-white">
            {t(`1. ஜன்னல் அளவுகள் (W1 - W${windows.length})`, `1. Window Dimensions (W1 - W${windows.length})`)}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {t('அளவுகளை உள்ளிட்டு சேமிக்க வெட்டு அளவுகள் பெறுக', 'Enter dimensions to calculate cutting sizes')}
          </p>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => onAddWindow(windows)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition cursor-pointer active:scale-95 touch-manipulation"
            title={t('புதிய ஜன்னல் சேர்க்க', 'Add new window')}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Add</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFractionChips({});
              onResetAll();
            }}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition cursor-pointer active:scale-95 touch-manipulation"
            title={t('இயல்புநிலைக்கு மீட்டமைக்க', 'Reset to default W1-W10')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{t('மீட்டமை', 'Reset')}</span>
          </button>
        </div>
      </div>

      {/* 2. MEASUREMENT FORMAT & FORMULA CONTROLS */}
      <div className="border border-slate-800 bg-slate-950 rounded-lg p-3 text-xs space-y-2.5">
        {/* Format Selector: Inch, CM, MM */}
        <div className="space-y-1.5 pb-2.5 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>{t('அளவீடு வடிவம் தேர்வு:', 'Measurement Format:')}</span>
            </label>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              {activeUnit === 'cm'
                ? 'cm → mm (cm × 10)'
                : activeUnit === 'mm'
                  ? 'mm → mm'
                  : 'Inch → mm (× 25.4)'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {[
              { id: 'inch' as UnitType, label: t('அங்குலம் (Inch)', 'Inch'), sub: 'Inch → mm (× 25.4)' },
              { id: 'cm' as UnitType, label: t('சென்டிமீட்டர் (CM)', 'CM'), sub: 'cm × 10 → mm' },
              { id: 'mm' as UnitType, label: t('மில்லிமீட்டர் (MM)', 'MM'), sub: 'mm → mm (Direct)' }
            ].map((u) => {
              const isSelected = activeUnit === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => switchUnit(u.id)}
                  className={
                    'py-2 px-1 sm:px-2 rounded-lg text-center border transition cursor-pointer active:scale-95 touch-manipulation ' +
                    (isSelected
                      ? 'bg-blue-600 border-blue-400 text-white font-bold shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700')
                  }
                >
                  <div className="text-xs font-bold leading-tight truncate">{u.label}</div>
                  <div className="text-[10px] font-mono opacity-80 mt-0.5 truncate">{u.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Formula Display */}
        <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
          <span className="font-mono text-slate-200">
            {activeUnit === 'cm'
              ? (isVentilator
                  ? t('சூத்திரம்: செ.மீ × 10 = மிமீ (வென்டிலேட்டர்: கூடுதல் mm இல்லை)', 'Formula: CM × 10 = MM (Ventilator: No added mm)')
                  : (addedMM > 0
                      ? t(`சூத்திரம்: (செ.மீ × 10) + ${addedMM}mm`, `Formula: (CM × 10) + ${addedMM}mm`)
                      : t('சூத்திரம்: செ.மீ × 10 = மிமீ', 'Formula: CM × 10 = MM')))
              : activeUnit === 'mm'
                ? (isVentilator
                    ? t('சூத்திரம்: நேரடி மிமீ (வென்டிலேட்டர்: கூடுதல் mm இல்லை)', 'Formula: Direct MM (Ventilator: No added mm)')
                    : (addedMM > 0
                        ? t(`சூத்திரம்: மிமீ + ${addedMM}mm`, `Formula: MM + ${addedMM}mm`)
                        : t('சூத்திரம்: நேரடி மிமீ (mm to mm)', 'Formula: Direct MM (mm to mm)')))
                : (isVentilator
                    ? t(`சூத்திரம்: அங்குலம் × ${globalSettings.conversionFactor} (வென்டிலேட்டர்: கூடுதல் mm இல்லை)`, `Formula: Inch × ${globalSettings.conversionFactor} (Ventilator: No added mm)`)
                    : (addedMM > 0
                        ? t(`சூத்திரம்: (அங்குலம் × ${globalSettings.conversionFactor}) + ${addedMM}mm`, `Formula: (Inch × ${globalSettings.conversionFactor}) + ${addedMM}mm`)
                        : t(`சூத்திரம்: அங்குலம் × ${globalSettings.conversionFactor}`, `Formula: Inch × ${globalSettings.conversionFactor}`)))}
          </span>
          <span className="text-emerald-400 font-mono font-bold">
            uPVC {globalSettings.profileSeries}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {/* Factor Multiplier (for inch) or Method note (for cm/mm) */}
          {activeUnit === 'inch' ? (
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800 flex items-center justify-between">
              <span className="text-slate-300 text-xs">{t('மாற்றக் காரணி (1" = mm):', 'Conversion Factor (1" = mm):')}</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => adjustGlobalFactor(-0.1)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs active:scale-95 touch-manipulation cursor-pointer"
                  aria-label="Decrease factor"
                >
                  -
                </button>
                <span className="text-white font-mono font-bold text-xs sm:text-sm px-1">
                  {globalSettings.conversionFactor}
                </span>
                <button
                  type="button"
                  onClick={() => adjustGlobalFactor(0.1)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs active:scale-95 touch-manipulation cursor-pointer"
                  aria-label="Increase factor"
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800 flex items-center justify-between">
              <span className="text-slate-300 text-xs">
                {activeUnit === 'cm' ? t('மாற்ற முறை (CM → MM):', 'Conversion Method (CM → MM):') : t('மாற்ற முறை (MM → MM):', 'Conversion Method (MM → MM):')}
              </span>
              <span className="text-emerald-400 font-mono font-bold text-xs sm:text-sm">
                {activeUnit === 'cm' ? 'cm × 10 = mm' : t('1 mm = 1 mm (நேரடி)', '1 mm = 1 mm (Direct)')}
              </span>
            </div>
          )}

          {/* Added MM (no negative integers: min 0, default 0) */}
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300 text-xs">{t('கூடுதல் அளவு (Added mm):', 'Added Offset (Added mm):')}</span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => adjustGlobalOffset(-1)}
                disabled={addedMM <= 0}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded font-bold flex items-center justify-center text-xs active:scale-95 touch-manipulation cursor-pointer ${
                  addedMM <= 0
                    ? 'bg-slate-900 text-slate-600 cursor-not-allowed opacity-40'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
                aria-label="Decrease offset"
              >
                -
              </button>
              <span className="text-emerald-400 font-mono font-bold text-xs sm:text-sm px-1">
                {addedMM > 0 ? `+${addedMM}` : '0'} mm
              </span>
              <button
                type="button"
                onClick={() => adjustGlobalOffset(1)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs active:scale-95 touch-manipulation cursor-pointer"
                aria-label="Increase offset"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Formula Number Customization Link */}
        {onOpenFormulaSettings && (
          <button
            type="button"
            onClick={onOpenFormulaSettings}
            className="w-full py-2 px-3 rounded-lg bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 hover:text-white border border-blue-800/70 text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer active:scale-95 touch-manipulation"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('சூத்திர எண்களை மாற்ற (Customize Formula Numbers)', 'Customize Formula Numbers')}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-200 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. WINDOW SELECTOR TABS & VIEW TOGGLE */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-heading font-semibold text-slate-300">
          {t(`ஜன்னல் தேர்வு (${windows.length} Windows):`, `Select Window (${windows.length} Windows):`)}
        </span>
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('single')}
            className={
              'px-2.5 py-1 rounded transition cursor-pointer font-medium flex items-center space-x-1 ' +
              (viewMode === 'single'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:text-white')
            }
          >
            <span>{t('தனி', 'Single')}</span>
            <span>{'(' + (variantLabels[activeWindowIndex]?.windowLabel || ('W' + (activeWindowIndex + 1))) + ')'}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={
              'px-2.5 py-1 rounded transition cursor-pointer font-medium ' +
              (viewMode === 'all'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:text-white')
            }
          >
            {t(`அனைத்தும் (${windows.length})`, `All (${windows.length})`)}
          </button>
        </div>
      </div>

      {/* Horizontal Window Selector Pills (Smooth Touch Scroll) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar touch-pan-x">
        {windows.map((win, idx) => {
          const isSelected = activeWindowIndex === idx;
          const winOffset = win.windowType === 'ventilator' ? 0 : addedMM;
          const curValW = activeUnit === 'cm'
            ? (win.widthCm ?? Number((win.widthInch * 2.54).toFixed(1)))
            : activeUnit === 'mm'
              ? (win.widthMM ?? Math.round(win.widthInch * 25.4))
              : win.widthInch;
          const curValH = activeUnit === 'cm'
            ? (win.heightCm ?? Number((win.heightInch * 2.54).toFixed(1)))
            : activeUnit === 'mm'
              ? (win.heightMM ?? Math.round(win.heightInch * 25.4))
              : win.heightInch;
          const wMM = WindowCalculationEngine.unitToMM(curValW, activeUnit, globalSettings.conversionFactor, winOffset);
          const hMM = WindowCalculationEngine.unitToMM(curValH, activeUnit, globalSettings.conversionFactor, winOffset);
          const displayLabel = variantLabels[idx]?.windowLabel || win.windowLabel || ('W' + (idx + 1));

          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelectWindowIndex(idx);
                setViewMode('single');
              }}
              className={
                'py-1.5 px-2.5 rounded-lg text-center border transition flex-shrink-0 cursor-pointer touch-manipulation active:scale-95 ' +
                (isSelected
                  ? 'bg-blue-600 border-blue-500 text-white font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white')
              }
            >
              <div className="text-xs font-heading font-bold leading-tight" title={displayLabel}>
                {displayLabel}
              </div>
              <div className="text-[10px] font-mono truncate text-slate-300">{hMM + '×' + wMM}</div>
            </button>
          );
        })}

        {/* Add Window Button Pill */}
        <button
          type="button"
          onClick={() => onAddWindow(windows)}
          className="py-1.5 px-2.5 rounded-lg text-center border border-dashed border-emerald-500/60 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 transition flex-shrink-0 cursor-pointer active:scale-95 touch-manipulation"
          title={t('புதிய ஜன்னல் சேர்க்க', 'Add New Window')}
        >
          <div className="text-xs font-bold flex items-center space-x-1">
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </div>
          <div className="text-[10px] text-emerald-400">{'W' + (windows.length + 1)}</div>
        </button>
      </div>

      {/* 4. WINDOW INPUT FORM CONTENT */}
      {viewMode === 'single' ? (
        /* SINGLE WINDOW FOCUSED INPUT CARD */
        <div className="bg-slate-950 rounded-lg p-3 sm:p-4 border border-slate-800 space-y-3.5">
          {/* Active Window Header: Badge, Title, Live mm & Delete */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-950/80 border border-blue-800/60 text-blue-300 font-mono text-xs font-bold flex-shrink-0">
                {variantLabels[activeWindowIndex]?.windowLabel || ('W' + (activeWindowIndex + 1))}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-200">
                {t(`ஜன்னல் ${variantLabels[activeWindowIndex]?.windowLabel || (activeWindowIndex + 1)}`, `Window ${variantLabels[activeWindowIndex]?.windowLabel || (activeWindowIndex + 1)}`)}
              </span>
              <span className="text-xs font-mono text-blue-400 font-semibold">
                ({activeWin.windowType === 'sliding'
                  ? (activeWin.profileSeries === '65mm'
                      ? `${activeWin.frameType.toUpperCase().replace('-TRACK', 'T')} (65MM)`
                      : activeWin.frameType.toUpperCase().replace('-TRACK', 'T'))
                  : (activeWin.windowType === 'ventilator'
                      ? (activeWin.ventilatorSubtype === 'fan' ? `VENTILATOR FAN ${activeWin.ventilatorFanSide === 'right' ? 'R' : 'L'}` : 'VENTILATOR')
                      : 'NO TRACK')})
              </span>

              {/* Small tiny box: Select button with options a to z */}
              <div className="inline-flex items-center gap-1 flex-shrink-0" title={t('துணை வகை எழுத்து தேர்வு (a முதல் z)', 'Select variant letter (a to z)')}>
                <select
                  value={activeWin.variantLetter || ''}
                  onChange={(e) => updateWindow(activeWindowIndex, { variantLetter: e.target.value })}
                  aria-label="Window variant letter"
                  className="h-6 px-1.5 py-0 bg-slate-900 hover:bg-slate-800 text-blue-300 hover:text-white border border-blue-500/50 hover:border-blue-400 rounded text-xs font-mono font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 transition shadow-inner"
                >
                  <option value="" className="bg-slate-950 text-slate-400">-</option>
                  {'abcdefghijklmnopqrstuvwxyz'.split('').map((letter) => (
                    <option key={letter} value={letter} className="bg-slate-950 text-blue-300 font-bold font-mono">
                      {letter}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              <div className="text-right">
                <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400 block leading-tight">
                  {activeLiveHMM + ' × ' + activeLiveWMM + ' mm'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block">
                  {activeUnit === 'cm'
                    ? `${activeValH} cm H × ${activeValW} cm W`
                    : activeUnit === 'mm'
                      ? `${activeValH} mm H × ${activeValW} mm W`
                      : `${activeWin.heightInch}" H × ${activeWin.widthInch}" W`}
                </span>
              </div>

              {windows.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteWindow(activeWindowIndex)}
                  className="p-1.5 px-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-xs transition cursor-pointer active:scale-95 touch-manipulation flex items-center space-x-1 flex-shrink-0"
                  title={'Delete ' + (variantLabels[activeWindowIndex]?.windowLabel || ('W' + (activeWindowIndex + 1)))}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{t('நீக்கு', 'Delete')}</span>
                </button>
              )}
            </div>
          </div>

          {/* HEIGHT INPUT - 44px Touch Targets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200">
                {activeUnit === 'cm'
                  ? t('உயரம் (செ.மீ):', 'Height (CM):')
                  : activeUnit === 'mm'
                    ? t('உயரம் (மி.மீ):', 'Height (MM):')
                    : t('உயரம் (அங்குலம்):', 'Height (Inches):')}
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {'= ' + activeLiveHMM + ' mm'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => adjustDimension(activeWindowIndex, 'height', -1)}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white flex items-center justify-center font-bold text-lg transition border border-slate-700 touch-manipulation cursor-pointer flex-shrink-0"
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
                <input
                  type="number"
                  step={activeUnit === 'cm' ? '0.5' : activeUnit === 'mm' ? '1' : '0.125'}
                  value={activeValH}
                  onChange={(e) => {
                    const rawVal = parseFloat(e.target.value) || 0;
                    if (activeUnit === 'cm') {
                      const mmVal = Math.round(rawVal * 10);
                      const inVal = Number((rawVal / 2.54).toFixed(3));
                      updateWindow(activeWindowIndex, { heightCm: rawVal, heightMM: mmVal, heightInch: inVal });
                    } else if (activeUnit === 'mm') {
                      const cmVal = Number((rawVal / 10).toFixed(1));
                      const inVal = Number((rawVal / 25.4).toFixed(3));
                      updateWindow(activeWindowIndex, { heightMM: rawVal, heightCm: cmVal, heightInch: inVal });
                    } else {
                      const cmVal = Number((rawVal * 2.54).toFixed(1));
                      const mmVal = Math.round(rawVal * 25.4);
                      updateWindow(activeWindowIndex, { heightInch: rawVal, heightCm: cmVal, heightMM: mmVal });
                    }
                  }}
                  className="w-full h-11 sm:h-12 bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl text-center font-mono text-lg font-bold text-white focus:outline-none"
                  placeholder={activeUnit === 'cm' ? '150' : activeUnit === 'mm' ? '1500' : '60'}
                />
                <span className="absolute right-3 top-3.5 text-xs font-bold text-slate-400 uppercase">
                  {activeUnit}
                </span>
              </div>
              <button
                type="button"
                onClick={() => adjustDimension(activeWindowIndex, 'height', 1)}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white flex items-center justify-center font-bold text-lg transition border border-slate-700 touch-manipulation cursor-pointer flex-shrink-0"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Height Fraction Options Grid - ONLY IN INCH MODE */}
            {activeUnit === 'inch' && (
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {FRACTION_OPTIONS.map((chip) => {
                  const active = isChipActive(activeWindowIndex, 'height', chip, activeWin.heightInch);
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleFractionClick(activeWindowIndex, 'height', chip)}
                      className={
                        'py-1.5 px-1 rounded-lg border text-xs font-mono font-bold transition cursor-pointer touch-manipulation text-center ' +
                        (active
                          ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700')
                      }
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* WIDTH INPUT - 44px Touch Targets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200">
                {activeUnit === 'cm'
                  ? t('அகலம் (செ.மீ):', 'Width (CM):')
                  : activeUnit === 'mm'
                    ? t('அகலம் (மி.மீ):', 'Width (MM):')
                    : t('அகலம் (அங்குலம்):', 'Width (Inches):')}
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {'= ' + activeLiveWMM + ' mm'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => adjustDimension(activeWindowIndex, 'width', -1)}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white flex items-center justify-center font-bold text-lg transition border border-slate-700 touch-manipulation cursor-pointer flex-shrink-0"
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
                <input
                  type="number"
                  step={activeUnit === 'cm' ? '0.5' : activeUnit === 'mm' ? '1' : '0.125'}
                  value={activeValW}
                  onChange={(e) => {
                    const rawVal = parseFloat(e.target.value) || 0;
                    if (activeUnit === 'cm') {
                      const mmVal = Math.round(rawVal * 10);
                      const inVal = Number((rawVal / 2.54).toFixed(3));
                      updateWindow(activeWindowIndex, { widthCm: rawVal, widthMM: mmVal, widthInch: inVal });
                    } else if (activeUnit === 'mm') {
                      const cmVal = Number((rawVal / 10).toFixed(1));
                      const inVal = Number((rawVal / 25.4).toFixed(3));
                      updateWindow(activeWindowIndex, { widthMM: rawVal, widthCm: cmVal, widthInch: inVal });
                    } else {
                      const cmVal = Number((rawVal * 2.54).toFixed(1));
                      const mmVal = Math.round(rawVal * 25.4);
                      updateWindow(activeWindowIndex, { widthInch: rawVal, widthCm: cmVal, widthMM: mmVal });
                    }
                  }}
                  className="w-full h-11 sm:h-12 bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl text-center font-mono text-lg font-bold text-white focus:outline-none"
                  placeholder={activeUnit === 'cm' ? '120' : activeUnit === 'mm' ? '1200' : '48'}
                />
                <span className="absolute right-3 top-3.5 text-xs font-bold text-slate-400 uppercase">
                  {activeUnit}
                </span>
              </div>
              <button
                type="button"
                onClick={() => adjustDimension(activeWindowIndex, 'width', 1)}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white flex items-center justify-center font-bold text-lg transition border border-slate-700 touch-manipulation cursor-pointer flex-shrink-0"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Width Fraction Options Grid - ONLY IN INCH MODE */}
            {activeUnit === 'inch' && (
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {FRACTION_OPTIONS.map((chip) => {
                  const active = isChipActive(activeWindowIndex, 'width', chip, activeWin.widthInch);
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleFractionClick(activeWindowIndex, 'width', chip)}
                      className={
                        'py-1.5 px-1 rounded-lg border text-xs font-mono font-bold transition cursor-pointer touch-manipulation text-center ' +
                        (active
                          ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700')
                      }
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* FRAME TRACK & WINDOW TYPE */}
          <div className="space-y-3 pt-1">
            {/* 1. Window Type Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-300 font-bold">{t('வகை:', 'Window Type:')}</label>
                <span className="text-[11px] font-mono text-blue-400 font-normal">
                  {activeWin.windowType === 'sliding' ? t('ஸ்லைடிங் (Sliding)', 'Sliding') : activeWin.windowType === 'open' ? t('திறக்கும் (Open)', 'Open (Casement)') : activeWin.windowType === 'fixed' ? t('நிலையானது (Fixed)', 'Fixed') : t('வென்டிலேட்டர் (Ventilator)', 'Ventilator')}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                {[
                  { type: 'sliding' as WindowType, label: t('ஸ்லைடிங்', 'Sliding'), sub: t('(Sliding)', '') },
                  { type: 'open' as WindowType, label: t('திறக்கும்', 'Open (Casement)'), sub: t('(Open)', '') },
                  { type: 'fixed' as WindowType, label: t('நிலையானது', 'Fixed'), sub: t('(Fixed)', '') },
                  { type: 'ventilator' as WindowType, label: t('வென்டிலேட்டர்', 'Ventilator'), sub: t('(Ventilator)', '') }
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => updateWindow(activeWindowIndex, {
                      windowType: item.type,
                      frameType: item.type === 'sliding'
                        ? (activeWin.frameType === 'no-track' ? '2-track' : activeWin.frameType)
                        : 'no-track',
                      ventilatorSubtype: item.type === 'ventilator' ? (activeWin.ventilatorSubtype || 'normal') : activeWin.ventilatorSubtype,
                      ventilatorFanSide: item.type === 'ventilator' ? (activeWin.ventilatorFanSide || 'left') : activeWin.ventilatorFanSide
                    })}
                    className={
                      'py-2 px-1 sm:px-1.5 rounded-xl text-xs font-bold border transition cursor-pointer active:scale-95 touch-manipulation flex flex-col items-center justify-center min-w-0 ' +
                      (activeWin.windowType === item.type
                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white')
                    }
                  >
                    <span className="leading-tight text-xs font-semibold truncate max-w-full text-center">{item.label}</span>
                    {item.sub && (
                      <span className="text-[10px] font-normal opacity-80 mt-0.5 truncate max-w-full text-center">{item.sub}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Track or Subtype Options */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-bold block">
                {activeWin.windowType === 'sliding'
                  ? t('டிராக் பிரேம் தேர்வு (Sliding Track):', 'Track Frame Selection:')
                  : (activeWin.windowType === 'open'
                    ? t('சஷ் கட்டமைப்பு (Open Window Sashes):', 'Casement Sash Configuration:')
                    : (activeWin.windowType === 'ventilator'
                      ? t('வென்டிலேட்டர் கட்டமைப்பு (Ventilator Options):', 'Ventilator Configuration:')
                      : t('பிரேம் வகை (Frame Glazing):', 'Frame Glazing:')))}
              </label>

              {activeWin.windowType === 'sliding' ? (
                <div className="space-y-2">
                  {/* Material Depth Selector: 58mm Standard vs 65mm Special */}
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">
                        {t('மெட்டீரியல் வகை (Material Series):', 'Material Series (Thickness):')}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900/60">
                        {activeWin.profileSeries === '65mm' ? '65 mm Material' : '58 mm Material'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateWindow(activeWindowIndex, { profileSeries: '58mm' })}
                        className={
                          'py-1.5 px-2 rounded-md text-xs font-bold border transition cursor-pointer active:scale-95 text-center ' +
                          (activeWin.profileSeries !== '65mm'
                            ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white')
                        }
                      >
                        <div className="leading-tight">58 mm Material</div>
                        <div className="text-[9.5px] opacity-80 font-normal">
                          {t('ஸ்டாண்டர்ட் (2T, 2.5T, 3T, 4T)', 'Standard (2T, 2.5T, 3T, 4T)')}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const updates: Partial<WindowInput> = { profileSeries: '65mm' };
                          if (activeWin.frameType === '2.5-track' || activeWin.frameType === '4-track') {
                            updates.frameType = '2-track';
                          }
                          updateWindow(activeWindowIndex, updates);
                        }}
                        className={
                          'py-1.5 px-2 rounded-md text-xs font-bold border transition cursor-pointer active:scale-95 text-center ' +
                          (activeWin.profileSeries === '65mm'
                            ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white')
                        }
                      >
                        <div className="leading-tight">65 mm Material</div>
                        <div className="text-[9.5px] opacity-80 font-normal">
                          {t('ஹெவி (2 Track & 3 Track)', 'Heavy (2 Track & 3 Track)')}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Track Frame Buttons */}
                  {activeWin.profileSeries === '65mm' ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: '2-track' as FrameType, label: '2 Track', desc: t('2 சஷ் (2 Panels)', '2 Panels') },
                        { id: '3.5-track' as FrameType, label: '3 Track', desc: t('3 சஷ் (3 Panels)', '3 Panels') }
                      ].map((tItem) => (
                        <button
                          key={tItem.id}
                          type="button"
                          onClick={() => updateWindow(activeWindowIndex, { frameType: tItem.id })}
                          className={
                            'py-2 px-1.5 rounded-lg text-xs font-bold border transition cursor-pointer active:scale-95 touch-manipulation text-center ' +
                            ((activeWin.frameType === tItem.id || (tItem.id === '3.5-track' && activeWin.frameType === '3-track'))
                              ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white')
                          }
                        >
                          <div className="leading-tight">{tItem.label}</div>
                          <div className="text-[10px] opacity-75 font-normal mt-0.5">{tItem.desc}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: '2-track' as FrameType, label: '2 Track', desc: t('2 சஷ்', '2 Panels') },
                        { id: '2.5-track' as FrameType, label: '2.5 Track', desc: t('வலை சஷ்', 'Mesh Panel') },
                        { id: '3.5-track' as FrameType, label: '3 Track', desc: t('3 சஷ்', '3 Panels') },
                        { id: '4-track' as FrameType, label: '4 Track', desc: t('4 சஷ்', '4 Panels') }
                      ].map((tItem) => (
                        <button
                          key={tItem.id}
                          type="button"
                          onClick={() => updateWindow(activeWindowIndex, { frameType: tItem.id })}
                          className={
                            'py-2 px-1 rounded-lg text-xs font-bold border transition cursor-pointer active:scale-95 touch-manipulation text-center ' +
                            ((activeWin.frameType === tItem.id || (tItem.id === '3.5-track' && activeWin.frameType === '3-track'))
                              ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white')
                          }
                        >
                          <div className="leading-tight">{tItem.label}</div>
                          <div className="text-[10px] opacity-75 font-normal mt-0.5">{tItem.desc}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeWin.windowType === 'open' ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'single' as CasementSubtype, label: t('1 சஷ் (Single)', 'Single Casement'), desc: t('மைய முல்லியன் இல்லை', 'No Center Mullion') },
                    { id: 'double' as CasementSubtype, label: t('2 சஷ் (Double)', 'Double Casement'), desc: t('1 முல்லியன் (Mullion)', '1 Center Mullion') },
                    { id: 'triple' as CasementSubtype, label: t('3 சஷ் (3-Open)', '3-Open Casement'), desc: t('2 முல்லியன் (2 Mullions)', '2 Mullion Dividers') }
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => updateWindow(activeWindowIndex, { casementSubtype: c.id })}
                      className={
                        'py-2 px-1 text-center rounded-lg text-xs font-bold border transition cursor-pointer active:scale-95 touch-manipulation ' +
                        (((activeWin.casementSubtype === c.id) || (!activeWin.casementSubtype && c.id === 'single'))
                          ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white')
                      }
                    >
                      <div className="leading-tight">{c.label}</div>
                      <div className="text-[10px] opacity-75 font-normal mt-0.5">{c.desc}</div>
                    </button>
                  ))}
                </div>
              ) : activeWin.windowType === 'ventilator' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'normal' as VentilatorSubtype, label: t('சாதாரண (Normal)', 'Normal Louvers') },
                      { id: 'fan' as VentilatorSubtype, label: t('மின்விசிறி (Fan)', 'Exhaust Fan') }
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => updateWindow(activeWindowIndex, {
                          ventilatorSubtype: v.id,
                          ventilatorFanSide: v.id === 'fan' ? (activeWin.ventilatorFanSide || 'left') : undefined
                        })}
                        className={
                          'py-2 px-1 text-center rounded-lg text-xs font-bold border transition cursor-pointer active:scale-95 touch-manipulation ' +
                          (((activeWin.ventilatorSubtype === v.id) || (!activeWin.ventilatorSubtype && v.id === 'normal'))
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white')
                        }
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>

                  {/* When Fan is chosen: Left vs Right Fan Side */}
                  {activeWin.ventilatorSubtype === 'fan' && (
                    <div className="flex items-center space-x-2 pt-0.5">
                      <span className="text-xs text-slate-400 font-sans flex-shrink-0">{t('ஃபேன் இடம்:', 'Fan Side:')}</span>
                      <div className="grid grid-cols-2 gap-1.5 flex-1">
                        {[
                          { id: 'left' as VentilatorFanSide, label: t('இடது (Left)', 'Left') },
                          { id: 'right' as VentilatorFanSide, label: t('வலது (Right)', 'Right') }
                        ].map((side) => (
                          <button
                            key={side.id}
                            type="button"
                            onClick={() => updateWindow(activeWindowIndex, { ventilatorFanSide: side.id })}
                            className={
                              'py-1.5 px-2 text-center rounded-lg text-xs font-bold border transition cursor-pointer active:scale-95 touch-manipulation ' +
                              (((activeWin.ventilatorFanSide === side.id) || (!activeWin.ventilatorFanSide && side.id === 'left'))
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white')
                            }
                          >
                            {side.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-2.5 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono flex items-center justify-between">
                  <span>{t('நேரடி கிளேசிங் (Direct Glazing)', 'Direct Frame Glazing')}</span>
                  <span className="text-[10px] text-emerald-400 font-bold">{t('OU - 96 mm (சஷ் இல்லை)', 'OU - 96 mm (No Sash)')}</span>
                </div>
              )}
            </div>
          </div>



          {/* Active Window Quick Nav */}
          <div className="flex items-center justify-between pt-1 gap-2">
            <button
              type="button"
              disabled={activeWindowIndex === 0}
              onClick={() => onSelectWindowIndex(Math.max(0, activeWindowIndex - 1))}
              className={
                'px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer touch-manipulation flex items-center space-x-1 min-w-0 ' +
                (activeWindowIndex === 0
                  ? 'opacity-25 border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-300 border-slate-700 active:scale-95')
              }
            >
              <span>⬅️</span>
              <span className="max-w-[60px] sm:max-w-[100px] truncate">
                {variantLabels[activeWindowIndex - 1]?.windowLabel || ('W' + activeWindowIndex)}
              </span>
            </button>
            <span className="text-xs text-slate-300 font-mono font-bold text-center px-1 truncate min-w-0">
              {(variantLabels[activeWindowIndex]?.windowLabel || ('W' + (activeWindowIndex + 1))) + ' (' + (activeWindowIndex + 1) + '/' + windows.length + ')'}
            </span>
            <button
              type="button"
              disabled={activeWindowIndex === windows.length - 1}
              onClick={() => onSelectWindowIndex(Math.min(windows.length - 1, activeWindowIndex + 1))}
              className={
                'px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer touch-manipulation flex items-center space-x-1 min-w-0 ' +
                (activeWindowIndex === windows.length - 1
                  ? 'opacity-25 border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-300 border-slate-700 active:scale-95')
              }
            >
              <span className="max-w-[60px] sm:max-w-[100px] truncate">
                {variantLabels[activeWindowIndex + 1]?.windowLabel || ('W' + (activeWindowIndex + 2))}
              </span>
              <span>➔</span>
            </button>
          </div>
        </div>
      ) : (
        /* ALL WINDOWS LIST VIEW */
        <div className="space-y-2">
          {windows.map((win, idx) => {
            const winOffset = win.windowType === 'ventilator' ? 0 : addedMM;
            const curValW = activeUnit === 'cm'
              ? (win.widthCm ?? Number((win.widthInch * 2.54).toFixed(1)))
              : activeUnit === 'mm'
                ? (win.widthMM ?? Math.round(win.widthInch * 25.4))
                : win.widthInch;
            const curValH = activeUnit === 'cm'
              ? (win.heightCm ?? Number((win.heightInch * 2.54).toFixed(1)))
              : activeUnit === 'mm'
                ? (win.heightMM ?? Math.round(win.heightInch * 25.4))
                : win.heightInch;
            const wMM = WindowCalculationEngine.unitToMM(curValW, activeUnit, globalSettings.conversionFactor, winOffset);
            const hMM = WindowCalculationEngine.unitToMM(curValH, activeUnit, globalSettings.conversionFactor, winOffset);

            return (
              <div
                key={idx}
                className="bg-slate-950 rounded-lg p-3 border border-slate-800 space-y-2.5"
              >
                {/* Responsive Card Header: Window # and dimensions */}
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/60">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/60 flex-shrink-0">
                      {variantLabels[idx]?.windowLabel || win.windowLabel || ('W' + (idx + 1))}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {t(`ஜன்னல் ${variantLabels[idx]?.windowLabel || (idx + 1)}`, `Window ${variantLabels[idx]?.windowLabel || (idx + 1)}`)}
                    </span>
                    {/* Small tiny box: Select button with options a to z */}
                    <div className="inline-flex items-center gap-1 flex-shrink-0" title={t('துணை வகை எழுத்து தேர்வு (a முதல் z)', 'Select variant letter (a to z)')}>
                      <select
                        value={win.variantLetter || ''}
                        onChange={(e) => updateWindow(idx, { variantLetter: e.target.value })}
                        aria-label="Window variant letter"
                        className="h-5 px-1 py-0 bg-slate-900 hover:bg-slate-800 text-blue-300 hover:text-white border border-blue-500/50 rounded text-[11px] font-mono font-bold cursor-pointer focus:outline-none"
                      >
                        <option value="" className="bg-slate-950 text-slate-400">-</option>
                        {'abcdefghijklmnopqrstuvwxyz'.split('').map((letter) => (
                          <option key={letter} value={letter} className="bg-slate-950 text-blue-300 font-bold font-mono">
                            {letter}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {hMM + ' × ' + wMM + ' mm'}
                    </span>
                    {windows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteWindow(idx)}
                        className="p-1 px-2 rounded bg-rose-950/50 hover:bg-rose-900 text-rose-300 border border-rose-800/50 text-xs transition cursor-pointer flex items-center space-x-1"
                        title={'Delete ' + (variantLabels[idx]?.windowLabel || ('W' + (idx + 1)))}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[10px]">{t('நீக்கு', 'Delete')}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Height */}
                  <div>
                    <label className="text-xs text-slate-300 block mb-0.5">
                      {activeUnit === 'cm'
                        ? t('உயரம் H (செ.மீ):', 'Height H (CM):')
                        : activeUnit === 'mm'
                          ? t('உயரம் H (மி.மீ):', 'Height H (MM):')
                          : t('உயரம் H (அங்குலம்):', 'Height H (Inch):')}
                    </label>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectWindowIndex(idx);
                          adjustDimension(idx, 'height', -1);
                        }}
                        className="w-9 h-9 min-w-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center active:scale-95 touch-manipulation cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step={activeUnit === 'cm' ? '0.5' : activeUnit === 'mm' ? '1' : '0.125'}
                        value={curValH}
                        onFocus={() => onSelectWindowIndex(idx)}
                        onChange={(e) => {
                          onSelectWindowIndex(idx);
                          const rawVal = parseFloat(e.target.value) || 0;
                          if (activeUnit === 'cm') {
                            const mmVal = Math.round(rawVal * 10);
                            const inVal = Number((rawVal / 2.54).toFixed(3));
                            updateWindow(idx, { heightCm: rawVal, heightMM: mmVal, heightInch: inVal });
                          } else if (activeUnit === 'mm') {
                            const cmVal = Number((rawVal / 10).toFixed(1));
                            const inVal = Number((rawVal / 25.4).toFixed(3));
                            updateWindow(idx, { heightMM: rawVal, heightCm: cmVal, heightInch: inVal });
                          } else {
                            const cmVal = Number((rawVal * 2.54).toFixed(1));
                            const mmVal = Math.round(rawVal * 25.4);
                            updateWindow(idx, { heightInch: rawVal, heightCm: cmVal, heightMM: mmVal });
                          }
                        }}
                        className="flex-1 h-9 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono text-xs font-bold text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onSelectWindowIndex(idx);
                          adjustDimension(idx, 'height', 1);
                        }}
                        className="w-9 h-9 min-w-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center active:scale-95 touch-manipulation cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Width */}
                  <div>
                    <label className="text-xs text-slate-300 block mb-0.5">
                      {activeUnit === 'cm'
                        ? t('அகலம் W (செ.மீ):', 'Width W (CM):')
                        : activeUnit === 'mm'
                          ? t('அகலம் W (மி.மீ):', 'Width W (MM):')
                          : t('அகலம் W (அங்குலம்):', 'Width W (Inch):')}
                    </label>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectWindowIndex(idx);
                          adjustDimension(idx, 'width', -1);
                        }}
                        className="w-9 h-9 min-w-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center active:scale-95 touch-manipulation cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step={activeUnit === 'cm' ? '0.5' : activeUnit === 'mm' ? '1' : '0.125'}
                        value={curValW}
                        onFocus={() => onSelectWindowIndex(idx)}
                        onChange={(e) => {
                          onSelectWindowIndex(idx);
                          const rawVal = parseFloat(e.target.value) || 0;
                          if (activeUnit === 'cm') {
                            const mmVal = Math.round(rawVal * 10);
                            const inVal = Number((rawVal / 2.54).toFixed(3));
                            updateWindow(idx, { widthCm: rawVal, widthMM: mmVal, widthInch: inVal });
                          } else if (activeUnit === 'mm') {
                            const cmVal = Number((rawVal / 10).toFixed(1));
                            const inVal = Number((rawVal / 25.4).toFixed(3));
                            updateWindow(idx, { widthMM: rawVal, widthCm: cmVal, widthInch: inVal });
                          } else {
                            const cmVal = Number((rawVal * 2.54).toFixed(1));
                            const mmVal = Math.round(rawVal * 25.4);
                            updateWindow(idx, { widthInch: rawVal, widthCm: cmVal, widthMM: mmVal });
                          }
                        }}
                        className="flex-1 h-9 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono text-xs font-bold text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onSelectWindowIndex(idx);
                          adjustDimension(idx, 'width', 1);
                        }}
                        className="w-9 h-9 min-w-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center active:scale-95 touch-manipulation cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300 pt-1 border-t border-slate-850">
                  <span>
                    {win.windowType === 'ventilator'
                      ? `VENTILATOR • ${win.ventilatorSubtype === 'fan' ? `FAN (${win.ventilatorFanSide === 'right' ? 'R' : 'LEFT'})` : 'NORMAL'}`
                      : `${win.frameType.toUpperCase()} • ${win.windowType.toUpperCase()}${win.windowType === 'sliding' && win.profileSeries === '65mm' ? ' • 65MM' : ''}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectWindowIndex(idx);
                      setViewMode('single');
                    }}
                    className="text-blue-400 font-bold hover:underline"
                  >
                    Edit Details ➔
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add Window Button at bottom of list */}
          <button
            type="button"
            onClick={() => onAddWindow(windows)}
            className="w-full py-3 rounded-lg border border-dashed border-emerald-500/60 bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-300 text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t(`+ புதிய ஜன்னல் சேர்க்க (W${windows.length + 1})`, `+ Add Window (W${windows.length + 1})`)}</span>
          </button>
        </div>
      )}

      {/* 5. PRIMARY ACTION BUTTON: STORE & GENERATE OUTPUTS */}
      <div className="pt-2">
        <button
          type="submit"
          className="w-full py-3.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-heading font-bold text-sm sm:text-base flex items-center justify-center space-x-2 border border-blue-500 transition cursor-pointer touch-manipulation"
        >
          <span>💾</span>
          <span>{t(`அளவுகள் சேமித்து வெளியீடு பெறுக (${windows.length} ஜன்னல்கள்)`, `Save & Calculate All (${windows.length} Windows)`)}</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </form>
  );
};
