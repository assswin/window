import React, { useState } from 'react';
import { CalculationResult } from '../engine/types';
import { RulesEngineManager } from '../engine/rules';
import { useLanguage } from '../context/LanguageContext';
import {
  FileSpreadsheet,
  Copy,
  Check,
  Scissors,
  Eye
} from 'lucide-react';

interface CalculationResultCardProps {
  results: CalculationResult[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onViewImages: () => void;
  onExportPDF?: () => void;
  onExportLSInteriorsPDF?: () => void;
}

export const CalculationResultCard: React.FC<CalculationResultCardProps> = ({
  results,
  selectedIndex,
  onSelectIndex,
  onViewImages,
  onExportPDF,
  onExportLSInteriorsPDF
}) => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!results || results.length === 0) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center text-slate-400 space-y-3">
        <Scissors className="w-10 h-10 text-slate-600 mx-auto" />
        <p className="text-sm">{t('10 அளவுகளை உள்ளிட்டு சேமிக்க வெட்டு அளவுகள் தோன்றும்.', 'Enter and save dimensions to calculate cutting sizes.')}</p>
      </div>
    );
  }

  const currentResult = results[selectedIndex] || results[0];
  const { input, convertedWidthMM, convertedHeightMM, frame, panel, mirror } = currentResult;

  const activeRule = RulesEngineManager.getRule(
    input.frameType,
    input.windowType,
    input.casementSubtype,
    input.profileSeries
  );

  const getFormulaPillText = () => {
    if (input.windowType === 'ventilator') {
      const fanInfo = input.ventilatorSubtype === 'fan' ? `Fan (${input.ventilatorFanSide === 'right' ? 'Right' : 'Left'})` : 'Normal';
      return `Ventilator / ${fanInfo} | Direct Inch -> MM (No Added MM)`;
    }
    if (input.windowType === 'sliding') {
      const is65mm = input.profileSeries === '65mm' || activeRule.profileDepthMM === 65;
      if (is65mm && input.frameType === '2-track') {
        return `H-${activeRule.heightDeductionMM} | (W-${activeRule.widthDeductionMM})/2 | -${activeRule.mirrorHeightDeductionMM} glass | 65mm`;
      }
      if (is65mm && (input.frameType === '3.5-track' || input.frameType === '3-track')) {
        const wAdd = activeRule.widthAdditionMM ?? 48;
        return `H-${activeRule.heightDeductionMM} | (W+${wAdd})/3 | -${activeRule.mirrorHeightDeductionMM} glass | 65mm`;
      }
      if (input.frameType === '4-track') {
        const wAdd = activeRule.widthAdditionMM ?? 11;
        return `H-${activeRule.heightDeductionMM} | W/4+${wAdd} | -${activeRule.mirrorHeightDeductionMM} glass | 58mm`;
      }
      if (input.frameType === '2.5-track') {
        const meshDeduction = activeRule.meshHeightDeductionMM ?? 2;
        const meshWDeduction = activeRule.meshWidthDeductionMM ?? 10;
        return `H-${activeRule.heightDeductionMM} | W/2-${activeRule.widthDeductionMM} | Mesh H-${meshDeduction}, W/2-${meshWDeduction} | -${activeRule.mirrorHeightDeductionMM} glass | 58mm`;
      }
      if (input.frameType === '3.5-track' || input.frameType === '3-track') {
        return `H-${activeRule.heightDeductionMM} | W/3-${activeRule.widthDeductionMM} | -${activeRule.mirrorHeightDeductionMM} glass | 58mm`;
      }
      return `H-${activeRule.heightDeductionMM} | W/2-${activeRule.widthDeductionMM} | -${activeRule.mirrorHeightDeductionMM} glass | 58mm`;
    }
    if (input.windowType === 'fixed') {
      return `Direct OU-${activeRule.mirrorHeightDeductionMM} glass`;
    }
    if (input.casementSubtype === 'triple') {
      const mullionDed = activeRule.mullionDeductionMM ?? (activeRule.mullionSashDeductionMM ?? 6);
      return `H-${activeRule.heightDeductionMM} | W/3-${activeRule.widthDeductionMM} | M: H-${mullionDed} | -${activeRule.mirrorHeightDeductionMM}`;
    }
    if (input.casementSubtype === 'double') {
      const mullionDed = activeRule.mullionDeductionMM ?? (activeRule.mullionSashDeductionMM ?? 6);
      return `H-${activeRule.heightDeductionMM} | W/2-${activeRule.widthDeductionMM} | M: H-${mullionDed} | -${activeRule.mirrorHeightDeductionMM}`;
    }
    return `H-${activeRule.heightDeductionMM} | W-${activeRule.widthDeductionMM} | -${activeRule.mirrorHeightDeductionMM}`;
  };

  const handleCopySingle = async (res: CalculationResult, idx: number) => {
    const title = 'W' + (idx + 1);
    const text = `${title} (${res.convertedHeightMM} × ${res.convertedWidthMM} mm)\n` +
      `Frame: ${res.frame.leftRightCutMM} mm (H) × ${res.frame.topBottomCutMM} mm (W)\n` +
      (res.input.windowType === 'ventilator'
        ? 'Ventilator: No Sash Shutter\n'
        : (res.panel.count > 0 ? `Sash (${res.panel.count * 4} Pcs • 2H+2W): ${res.panel.heightMM} × ${res.panel.widthMM} mm\n` : `Direct Glazing (No Sash)\n`)) +
      (res.interlockMM !== undefined ? `Interlock: ${res.interlockMM} mm (Sash H - 5)\n` : '') +
      (res.mullionMM !== undefined ? `Mullion (${res.input.casementSubtype === 'triple' ? '2 Pcs' : '1 Pc'}): ${res.mullionMM} mm (Sash H - 6)\n` : (res.frame.mullionCutMM ? `Mullion: ${res.frame.mullionCutMM} mm\n` : '')) +
      (res.input.windowType === 'ventilator'
        ? 'Glass: None (-)'
        : `Glass (${res.mirror.count} Pcs): ${res.mirror.heightMM} × ${res.mirror.widthMM} mm`);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 sm:p-4 space-y-4 text-slate-100 flex flex-col w-full">
      {/* 1. SECTION TITLE & VIEW TOGGLE */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
        <div>
          <h2 className="text-base font-heading font-bold text-white">
            {t(`2. வெட்டு அளவுகள் (மிமீ) • ${results.length} ஜன்னல்கள்`, `2. Cutting Sizes (mm) • ${results.length} Windows`)}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {t(
              'அனைத்து ஜன்னல்களுக்கான துல்லியமான uPVC பட்டறை வெட்டு அளவுகள்',
              'Accurate uPVC workshop cutting sizes for all windows'
            )}
          </p>
        </div>

        {/* View mode toggle: Table Summary vs Single Detail */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('summary')}
            className={
              'px-2.5 py-1 rounded transition cursor-pointer font-medium ' +
              (viewMode === 'summary'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:text-white')
            }
          >
            {t('அட்டவணை', 'Table')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('detail')}
            className={
              'px-2.5 py-1 rounded transition cursor-pointer font-medium flex items-center space-x-1 ' +
              (viewMode === 'detail'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:text-white')
            }
          >
            <span>{t('விவரம்', 'Detail')}</span>
            <span className="max-w-[70px] sm:max-w-[120px] truncate">
              {'(' + ('W' + (selectedIndex + 1)) + ')'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. TOP 10 WINDOW SELECTOR PILLS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0 no-scrollbar touch-pan-x">
        <button
          type="button"
          onClick={() => setViewMode('summary')}
          className={
            'py-1.5 px-2.5 rounded-lg text-center text-xs font-bold border transition flex-shrink-0 cursor-pointer ' +
            (viewMode === 'summary'
              ? 'bg-blue-600 border-blue-500 text-white font-bold'
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white')
          }
        >
          {t(`அனைத்தும் (${results.length})`, `All (${results.length})`)}
        </button>

        {results.map((r, idx) => {
          const isSelected = viewMode === 'detail' && selectedIndex === idx;
          const label = 'W' + (idx + 1);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelectIndex(idx);
                setViewMode('detail');
              }}
              className={
                'py-1.5 px-2.5 rounded-lg text-center border transition flex-shrink-0 cursor-pointer ' +
                (isSelected
                  ? 'bg-blue-600 border-blue-500 text-white font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white')
              }
            >
              <span className="text-xs font-heading font-bold max-w-[90px] truncate inline-block align-middle" title={label}>
                {label}
              </span>
              <span className="text-xs font-mono ml-1.5 text-emerald-400">
                {r.convertedHeightMM + '×' + r.convertedWidthMM}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. CONTENT AREA */}
      {viewMode === 'summary' ? (
        /* MASTER CUTTING TABLE FOR ALL WINDOWS */
        <div className="space-y-2 w-full">
          <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
            <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-heading font-bold text-white">
                {t('மாஸ்டர் வெட்டு பட்டியல் (Master Cutting Summary)', 'Master Cutting Summary')}
              </span>
              <span className="text-xs text-blue-300 font-mono font-bold">{results.length + ' Windows'}</span>
            </div>

            <div className="divide-y divide-slate-800">
              {results.map((r, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onSelectIndex(idx);
                    setViewMode('detail');
                  }}
                  className="p-3 hover:bg-slate-900/70 transition cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-heading font-bold text-white">
                      {'W' + (idx + 1)}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {r.convertedHeightMM + ' × ' + r.convertedWidthMM + ' mm'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono bg-slate-900 p-2.5 rounded border border-slate-800">
                    <div>
                      <span className="text-xs text-slate-300 block font-sans">{t('ஜாம்ப் (Jambs):', 'Jambs (Vertical):')}</span>
                      <strong className="text-white font-bold">{r.frame.leftRightCutMM + ' mm'}</strong>
                      <span className="text-xs text-slate-400 block">45° Mitre (2 Nos)</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-300 block font-sans">{t('பிரேம் (Top/Bot):', 'Frame (Top/Bottom):')}</span>
                      <strong className="text-white font-bold">{r.frame.topBottomCutMM + ' mm'}</strong>
                      <span className="text-xs text-slate-400 block">45° Mitre (2 Nos)</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-xs text-slate-300 block font-sans">{t('சஷ் (Sash H × W):', 'Sash (H × W):')}</span>
                      <strong className="text-emerald-400 font-bold">{r.panel.heightMM + ' × ' + r.panel.widthMM + ' mm'}</strong>
                      <span className="text-xs text-slate-400 block">{'(' + r.panel.count + ' Sashes)'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-300 pt-0.5">
                    <span>{t('கண்ணாடி: ', 'Glass: ')}<strong className="text-emerald-400 font-bold">{r.mirror.heightMM + ' × ' + r.mirror.widthMM + ' mm'}</strong></span>
                    <span className="text-blue-400 font-bold ml-auto sm:ml-0">{t('விவரம் ➔', 'Detail ➔')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* INDIVIDUAL WINDOW DETAILED CUTTING CARD */
        <div className="space-y-3.5 w-full">
          {/* Header Bar */}
          <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-sm font-heading font-bold text-white">
                  {'W' + (selectedIndex + 1)}
                </span>
                {(() => {
                  let badgeColorClass = 'bg-slate-900 text-slate-300 border-slate-700';
                  let badgeText = '';

                  if (currentResult.input.windowType === 'sliding') {
                    badgeColorClass = 'bg-amber-950/80 text-amber-300 border-amber-800/80';
                    badgeText = currentResult.input.frameType.toUpperCase().replace('-TRACK', ' TRACK');
                  } else if (currentResult.input.windowType === 'ventilator') {
                    if (currentResult.input.ventilatorSubtype === 'fan') {
                      const isRight = currentResult.input.ventilatorFanSide === 'right';
                      badgeColorClass = isRight
                        ? 'bg-pink-950/80 text-pink-300 border-pink-800/80'
                        : 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80';
                      badgeText = `VENTILATOR (FAN ${isRight ? 'R' : 'LEFT'})`;
                    } else {
                      badgeColorClass = 'bg-sky-950/80 text-sky-300 border-sky-800/80';
                      badgeText = 'VENTILATOR (NORMAL)';
                    }
                  } else if (currentResult.input.windowType === 'fixed') {
                    badgeColorClass = 'bg-rose-950/80 text-rose-300 border-rose-800/80 font-black';
                    badgeText = 'FIXED (NO TRACK)';
                  } else if (currentResult.input.windowType === 'open') {
                    if (currentResult.input.casementSubtype === 'triple') {
                      badgeColorClass = 'bg-teal-950/80 text-teal-300 border-teal-800/80';
                      badgeText = '3-OPEN WINDOW';
                    } else if (currentResult.input.casementSubtype === 'double') {
                      badgeColorClass = 'bg-teal-950/80 text-teal-300 border-teal-800/80';
                      badgeText = 'DOUBLE WINDOW';
                    } else {
                      badgeColorClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80';
                      badgeText = 'SINGLE WINDOW';
                    }
                  }

                  return (
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${badgeColorClass}`}>
                      {badgeText}
                    </span>
                  );
                })()}
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-800">
                  {getFormulaPillText()}
                </span>
              </div>
              <div className="text-xs text-slate-300 font-mono mt-1">
                {t('அளவு: ', 'Size: ')}
                <strong className="text-white">
                  {input.unit === 'cm'
                    ? `${input.heightCm ?? Number((input.heightInch * 2.54).toFixed(1))} cm H × ${input.widthCm ?? Number((input.widthInch * 2.54).toFixed(1))} cm W`
                    : input.unit === 'mm'
                      ? `${input.heightMM ?? Math.round(input.heightInch * 25.4)} mm H × ${input.widthMM ?? Math.round(input.widthInch * 25.4)} mm W`
                      : `${input.heightInch}" H × ${input.widthInch}" W`}
                </strong>{' '}
                ➔ <strong className="text-emerald-400">{convertedHeightMM + ' × ' + convertedWidthMM + ' mm'}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                const text = `Window ${selectedIndex + 1} (${convertedHeightMM} × ${convertedWidthMM} mm)\nFrame: ${frame.leftRightCutMM} mm (H) × ${frame.topBottomCutMM} mm (W)\n` +
                  (panel.count > 0 ? `Sash (${panel.count * 4} Pcs • 2H+2W): ${panel.heightMM} × ${panel.widthMM} mm\n` : `Direct Glazing (No Sash)\n`) +
                  (currentResult.interlockMM !== undefined ? `Interlock: ${currentResult.interlockMM} mm (Sash H - 5)\n` : '') +
                  (currentResult.mullionMM !== undefined ? `Mullion (Sash H - 6, ${currentResult.input.casementSubtype === 'triple' ? '2 Pcs' : '1 Pc'}): ${currentResult.mullionMM} mm\n` : (frame.mullionCutMM ? `Mullion: ${frame.mullionCutMM} mm\n` : '')) +
                  (currentResult.additionalPanels?.[0] ? `Mesh: ${currentResult.additionalPanels[0].heightMM} × ${currentResult.additionalPanels[0].widthMM} mm\n` : '') +
                  `Glass (${mirror.count} Pcs): ${mirror.heightMM} × ${mirror.widthMM} mm (${mirror.sqFeet} sq.ft)`;
                try {
                  await navigator.clipboard.writeText(text);
                  setCopiedIndex(selectedIndex);
                  setTimeout(() => setCopiedIndex(null), 2500);
                } catch (_) {}
              }}
              className="min-h-[36px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 flex items-center space-x-1 cursor-pointer touch-manipulation active:scale-95"
            >
              {copiedIndex === selectedIndex ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedIndex === selectedIndex ? t('நகலெடுக்கப்பட்டது', 'Copied') : t('நகலெடு', 'Copy')}</span>
            </button>
          </div>

          {/* 1. OUTER FRAME MM */}
          <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
              <span className="text-xs font-heading font-bold text-white">
                {t('வெளி பிரேம் (Outer Frame 45° Mitre)', 'Outer Frame (45° Mitre Cut)')}
              </span>
              <span className="text-xs font-mono text-blue-300">
                {frame.weldingAllowanceMM > 0 ? '+' + frame.weldingAllowanceMM + 'mm weld' : t('நேரடி அளவு (Exact)', 'Exact Dimensions')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-slate-300 text-xs block font-sans">{t('இடது & வலது ஜாம்ப்:', 'Left & Right Jambs:')}</span>
                <span className="text-base font-bold text-white">{frame.leftRightCutMM + ' mm'}</span>
                <span className="text-xs text-slate-400 block mt-0.5">2 Pieces (45° Mitre)</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-slate-300 text-xs block font-sans">{t('மேல் & கீழ் டிராக்:', 'Top & Bottom Tracks:')}</span>
                <span className="text-base font-bold text-white">{frame.topBottomCutMM + ' mm'}</span>
                <span className="text-xs text-slate-400 block mt-0.5">2 Pieces (45° Mitre)</span>
              </div>
            </div>

            {frame.mullionCutMM && (
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-300 text-xs block font-sans">{t('மைய முல்லியன் சுயவிவரம் (Central Mullion):', 'Central Mullion Profile:')}</span>
                  <span className="text-xs text-slate-400">{`${input.casementSubtype === 'triple' ? '2 Pieces' : '1 Piece'} (90° Straight Cut • Sash H - ${activeRule.mullionSashDeductionMM ?? (activeRule.mullionDeductionMM === 44 ? 6 : (activeRule.mullionDeductionMM ?? 6))} mm)`}</span>
                </div>
                <span className="text-base font-bold text-emerald-400">{frame.mullionCutMM + ' mm'}</span>
              </div>
            )}
          </div>

          {/* 2. SASH PROFILES MM */}
          {panel.count > 0 ? (
            <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                <span className="text-xs font-heading font-bold text-white">
                  {t(`சஷ் அளவுகள் (${panel.count} Sashes • Shutter Cut Sizes)`, `Sash Dimensions (${panel.count} Sashes • Cut Sizes)`)}
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {panel.heightMM + ' × ' + panel.widthMM + ' mm'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-xs block font-sans">{t('சஷ் உயரம் (Height):', 'Sash Height:')}</span>
                    <span className="text-[11px] text-emerald-400 font-mono">
                      {`H - ${activeRule.heightDeductionMM}`}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-emerald-400 block mt-0.5">{panel.heightMM + ' mm'}</span>
                  <span className="text-xs text-slate-400 block mt-0.5">{t(`செங்குத்து ஸ்டைல் (${panel.count * 2} Pcs • 45°)`, `Vertical Stiles (${panel.count * 2} Pcs • 45°)`)}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-xs block font-sans">{t('சஷ் அகலம் (Width):', 'Sash Width:')}</span>
                    <span className="text-[11px] text-emerald-400 font-mono">
                      {input.windowType === 'sliding'
                        ? (input.frameType === '4-track'
                          ? `W/4 + ${activeRule.widthAdditionMM ?? 11}`
                          : (input.frameType === '3.5-track' || input.frameType === '3-track'
                            ? `W/3 - ${activeRule.widthDeductionMM}`
                            : `W/2 - ${activeRule.widthDeductionMM}`))
                        : (input.casementSubtype === 'triple'
                          ? `W/3 - ${activeRule.widthDeductionMM}`
                          : (input.casementSubtype === 'double' ? `W/2 - ${activeRule.widthDeductionMM}` : `W - ${activeRule.widthDeductionMM}`))}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-emerald-400 block mt-0.5">{panel.widthMM + ' mm'}</span>
                  <span className="text-xs text-slate-400 block mt-0.5">{t(`கிடைமட்ட ரெயில் (${panel.count * 2} Pcs • 45°)`, `Horizontal Rails (${panel.count * 2} Pcs • 45°)`)}</span>
                </div>
              </div>

              {input.windowType === 'sliding' && currentResult.interlockMM !== undefined && (
                <div className="bg-slate-900 p-2.5 rounded border border-amber-900/40 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-amber-300 text-xs block font-sans font-semibold">{t('இன்டர்லாக் வெட்டு (Interlock Cut):', 'Interlock Cut:')}</span>
                    <span className="text-xs text-slate-400">Sash Height - 5 mm ({panel.heightMM} - 5)</span>
                  </div>
                  <span className="text-base font-bold text-amber-400">{currentResult.interlockMM} mm</span>
                </div>
              )}

              {input.windowType === 'open' && (input.casementSubtype === 'double' || input.casementSubtype === 'triple') && currentResult.mullionMM !== undefined && (
                <div className="bg-slate-900 p-2.5 rounded border border-teal-900/40 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-teal-300 text-xs block font-sans font-semibold">
                      {t(`முல்லியன் வெட்டு (Mullion Cut • ${input.casementSubtype === 'triple' ? '2 Pcs' : '1 Pc'}):`, `Mullion Cut (${input.casementSubtype === 'triple' ? '2 Pcs' : '1 Pc'}):`)}
                    </span>
                    <span className="text-xs text-slate-400">{`Sash Height - ${activeRule.mullionSashDeductionMM ?? 6} mm (${panel.heightMM} - ${activeRule.mullionSashDeductionMM ?? 6})`}</span>
                  </div>
                  <span className="text-base font-bold text-teal-400">{currentResult.mullionMM} mm</span>
                </div>
              )}

              {currentResult.additionalPanels && currentResult.additionalPanels.length > 0 && (
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-slate-300 text-xs block font-sans">{t('கொசு வலை சஷ் (SS Mesh Shutter):', 'Wire Mesh Sash (SS Mesh):')}</span>
                    <span className="text-xs text-slate-400">{`1 Piece (Mesh W/2-${activeRule.meshWidthDeductionMM ?? 10} × Mesh H-${activeRule.meshHeightDeductionMM ?? 2}mm)`}</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">
                    {currentResult.additionalPanels[0].heightMM + ' × ' + currentResult.additionalPanels[0].widthMM + ' mm'}
                  </span>
                </div>
              )}
            </div>
          ) : input.windowType === 'ventilator' ? (
            <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-xs font-mono flex items-center justify-between">
              <div>
                <span className="text-white font-bold block font-sans">
                  {input.ventilatorSubtype === 'fan'
                    ? t(`வென்டிலேட்டர் மின்விசிறி (${input.ventilatorFanSide === 'right' ? 'வலது' : 'இடது'})`, `Ventilator Exhaust Fan (${input.ventilatorFanSide === 'right' ? 'Right' : 'Left'})`)
                    : t('வென்டிலேட்டர் (Ventilator Normal)', 'Ventilator (Normal Louvers)')}
                </span>
                <span className="text-slate-400">{t('வெளி பிரேம் மட்டும் (நேரடி அங்குலம் → MM, கூடுதல் mm இல்லை)', 'Outer frame only (Direct inches to mm, no added mm)')}</span>
              </div>
              <span className="text-emerald-400 font-bold text-xs bg-slate-900 px-2 py-1 rounded border border-slate-800">
                {t('சஷ் ப்ரொஃபைல் இல்லை (-)', 'No Sash Profile (-)')}
              </span>
            </div>
          ) : (
            <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-xs font-mono flex items-center justify-between">
              <div>
                <span className="text-white font-bold block font-sans">{t('நிலையான ஜன்னல் (Fixed Direct Glazing):', 'Fixed Window (Direct Glazing):')}</span>
                <span className="text-slate-400">{t('வெளி பிரேமில் நேரடியாக கண்ணாடி பொருத்துதல் (சஷ் ப்ரொஃபைல் வெட்டு தேவையில்லை)', 'Direct glass glazing onto outer frame (No sash profile required)')}</span>
              </div>
              <span className="text-emerald-400 font-bold text-xs bg-slate-900 px-2 py-1 rounded border border-slate-800">
                {`OU - ${activeRule.mirrorHeightDeductionMM} mm`}
              </span>
            </div>
          )}

          {/* 3. GLASS CUT SIZE */}
          <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="text-xs font-heading font-bold text-white">
                {t('கண்ணாடி வெட்டு அளவு (Glass Cut Size)', 'Glass Cut Dimensions')}
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {input.windowType === 'ventilator'
                  ? t('கண்ணாடி இல்லை (-)', 'No Glass (-)')
                  : input.windowType === 'fixed'
                    ? `OU - ${activeRule.mirrorHeightDeductionMM} mm`
                    : `-${activeRule.mirrorHeightDeductionMM} mm`}
              </span>
            </div>
            {input.windowType === 'ventilator' ? (
              <div className="text-xs font-mono py-1 text-slate-400 flex items-center justify-between">
                <span>{t('வென்டிலேட்டருக்கு கண்ணாடி வெட்டு தேவையில்லை', 'No glass cutting required for ventilator')}</span>
                <span className="text-emerald-400 font-bold">-</span>
              </div>
            ) : (
              <div className="text-xs font-mono flex items-center justify-between pt-1">
                <div>
                  <div className="text-emerald-400 font-bold text-base">{mirror.heightMM + ' × ' + mirror.widthMM + ' mm'}</div>
                  <div className="text-slate-300 text-xs">{mirror.count + ' Panels • ' + mirror.sqFeet + ' sq.ft'}</div>
                </div>
                <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                  {input.glassType || '5mm Single'}
                </span>
              </div>
            )}
          </div>

          {/* Navigation between W1..W10 */}
          <div className="flex items-center justify-between pt-1 gap-2">
            <button
              type="button"
              disabled={selectedIndex === 0}
              onClick={() => onSelectIndex(Math.max(0, selectedIndex - 1))}
              className={
                'min-h-[40px] px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer touch-manipulation flex items-center space-x-1 min-w-0 ' +
                (selectedIndex === 0
                  ? 'opacity-30 border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-200 border-slate-700 active:scale-95')
              }
            >
              <span>⬅️</span>
              <span className="max-w-[60px] sm:max-w-[100px] truncate">
                {'W' + selectedIndex}
              </span>
            </button>
            <span className="text-xs text-slate-300 font-mono font-bold text-center px-1 truncate min-w-0">
              {'W' + (selectedIndex + 1) + ' (' + (selectedIndex + 1) + '/' + results.length + ')'}
            </span>
            <button
              type="button"
              disabled={selectedIndex === results.length - 1}
              onClick={() => onSelectIndex(Math.min(results.length - 1, selectedIndex + 1))}
              className={
                'min-h-[40px] px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer touch-manipulation flex items-center space-x-1 min-w-0 ' +
                (selectedIndex === results.length - 1
                  ? 'opacity-30 border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-200 border-slate-700 active:scale-95')
              }
            >
              <span className="max-w-[60px] sm:max-w-[100px] truncate">
                {'W' + (selectedIndex + 2)}
              </span>
              <span>➔</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. BOTTOM ACTION BUTTONS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 flex-shrink-0">
        <button
          type="button"
          onClick={onExportLSInteriorsPDF || onExportPDF}
          className="min-h-[44px] py-3 px-3 rounded-xl bg-blue-700 hover:bg-blue-600 active:scale-[0.99] text-white font-heading font-bold text-xs sm:text-sm flex items-center justify-center space-x-1.5 border border-blue-500 shadow-md transition cursor-pointer touch-manipulation"
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-200 flex-shrink-0" />
          <span>{t('L.S. Interiors ஆர்டர் தாள் PDF', 'L.S. Interiors Order Sheet PDF')}</span>
        </button>

        <button
          type="button"
          onClick={onViewImages}
          className="min-h-[44px] py-3 px-3 rounded-xl bg-slate-850 hover:bg-slate-800 active:scale-[0.99] text-blue-400 font-heading font-bold text-xs sm:text-sm flex items-center justify-center space-x-1.5 border border-slate-700 transition cursor-pointer touch-manipulation"
        >
          <Eye className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span>{t(`${results.length} வரைபட படங்கள் ➔`, `View ${results.length} 2D Drawings ➔`)}</span>
        </button>
      </div>
    </div>
  );
};
