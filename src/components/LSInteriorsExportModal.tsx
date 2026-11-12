import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  Calendar,
  User,
  Eye,
  Sparkles,
  Layers,
  FileText
} from 'lucide-react';
import { CalculationResult } from '../engine/types';
import {
  exportLSInteriorsToPDF,
  exportGlassOrderToPDF,
  generateLSInteriorsSheetCanvas,
  generateGlassOrderSheetCanvas,
  prepareLSGlassRows,
  has2_5TrackInResults,
  hasSlidingInResults,
  hasDoubleWindowInResults
} from '../utils/lsInteriorsSheetCanvas';
import { useLanguage } from '../context/LanguageContext';

interface LSInteriorsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: CalculationResult[];
  initialSheetType?: 'full' | 'glass';
}

export const LSInteriorsExportModal: React.FC<LSInteriorsExportModalProps> = ({
  isOpen,
  onClose,
  results,
  initialSheetType = 'full'
}) => {
  const { t } = useLanguage();
  const [sheetType, setSheetType] = useState<'full' | 'glass'>(initialSheetType);
  const [customerName, setCustomerName] = useState('');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-GB'));
  const [previewPage, setPreviewPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isOpen && initialSheetType) {
      setSheetType(initialSheetType);
    }
  }, [isOpen, initialSheetType]);

  // Logical detection: Check if any window in current batch is 2.5-track or has mesh
  const has2_5Track = has2_5TrackInResults(results);
  const [includeMeshColumn, setIncludeMeshColumn] = useState(has2_5Track);

  // Logical detection: Check if any sliding window exists in current batch
  const hasSliding = hasSlidingInResults(results);
  const [includeInterlockColumn, setIncludeInterlockColumn] = useState(hasSliding);

  // Logical detection: Check if any double window exists in current batch
  const hasDoubleWindow = hasDoubleWindowInResults(results);
  const [includeMullionColumn, setIncludeMullionColumn] = useState(hasDoubleWindow);
  const [mullionDeductionMM, setMullionDeductionMM] = useState<number>(6);

  // Synchronize column defaults when results change
  useEffect(() => {
    setIncludeMeshColumn(has2_5Track);
  }, [has2_5Track]);

  useEffect(() => {
    setIncludeInterlockColumn(hasSliding);
  }, [hasSliding]);

  useEffect(() => {
    setIncludeMullionColumn(hasDoubleWindow);
  }, [hasDoubleWindow]);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Render canvas preview whenever inputs or sheetType change
  useEffect(() => {
    if (!isOpen || !previewContainerRef.current) return;

    const canvas = sheetType === 'glass'
      ? generateGlassOrderSheetCanvas(
          results,
          {
            customerName,
            date
          },
          previewPage,
          28
        )
      : generateLSInteriorsSheetCanvas(
          results,
          {
            customerName,
            date,
            includeMeshColumn,
            includeInterlockColumn,
            includeMullionColumn,
            mullionDeductionMM
          },
          previewPage,
          28
        );

    if (canvas) {
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.display = 'block';
      canvas.style.borderRadius = '4px';
      canvas.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.4)';

      previewContainerRef.current.innerHTML = '';
      previewContainerRef.current.appendChild(canvas);
    }
  }, [
    isOpen,
    sheetType,
    results,
    customerName,
    date,
    includeMeshColumn,
    includeInterlockColumn,
    includeMullionColumn,
    mullionDeductionMM,
    previewPage
  ]);

  if (!isOpen) return null;

  const handleDownloadFullPDF = () => {
    setIsExporting(true);
    try {
      exportLSInteriorsToPDF(results, {
        customerName,
        date,
        includeMeshColumn,
        includeInterlockColumn,
        includeMullionColumn,
        mullionDeductionMM
      });
    } finally {
      setTimeout(() => setIsExporting(false), 500);
    }
  };

  const handleDownloadGlassPDF = () => {
    setIsExporting(true);
    try {
      exportGlassOrderToPDF(results, {
        customerName,
        date
      });
    } finally {
      setTimeout(() => setIsExporting(false), 500);
    }
  };

  // Pre-calculate glass summaries for the UI
  const glassRows = prepareLSGlassRows(results);
  const totalGlassPcs = glassRows.reduce((sum, r) => sum + r.rawPcs, 0);
  const totalGlassSqFt = glassRows.reduce((sum, r) => sum + r.rawSqFt, 0);
  const totalWindowsWithGlass = glassRows.filter((r) => r.hasGlass).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition ${
              sheetType === 'glass'
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                : 'bg-blue-600/20 border-blue-500/40 text-blue-400'
            }`}>
              {sheetType === 'glass' ? <FileText className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-heading tracking-wide">
                  {sheetType === 'glass'
                    ? t('L.S. INTERIORS கிளாஸ் கட்டிங் ஆர்டர் தாள் (Glass PDF)', 'L.S. INTERIORS Glass Cutting Order Sheet (PDF)')
                    : t('L.S. INTERIORS முழு ஆர்டர் தாள் (Order Sheet PDF)', 'L.S. INTERIORS Workshop Order Sheet (PDF)')}
                </h2>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                  sheetType === 'glass'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                }`}>
                  {sheetType === 'glass' ? 'Glass Factory' : 'Workshop Pad'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {sheetType === 'glass'
                  ? t(
                      'கண்ணாடி ஆலைக்கான பிரத்யேக தாள் • Glass Cut Size mm, No. of Pcs & Sq.Ft மட்டுமே அடங்கியது',
                      'Dedicated Glass Vendor Sheet • Glass Cut Size mm, No. of Pcs & Sq.Ft Only'
                    )
                  : t(
                      'நேரடி பட்டறை லாக் தாள் • Outer Frame, Sash Cut & Glass Cut தனி நிரல்கள்',
                      'Direct Workshop Log Sheet • Separate Outer Frame, Sash Cut & Glass Cut Columns'
                    )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TABS: FULL WORKSHOP SHEET vs DEDICATED GLASS CUTTING ORDER SHEET */}
        <div className="flex border-b border-slate-800 bg-slate-950/80 px-4 sm:px-6 pt-2 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSheetType('full')}
            className={`pb-2.5 px-3.5 text-xs sm:text-sm font-bold flex items-center space-x-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              sheetType === 'full'
                ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t('L.S. Interiors முழு ஆர்டர் தாள்', 'L.S. Interiors Full Sheet')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Workshop
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSheetType('glass')}
            className={`pb-2.5 px-3.5 text-xs sm:text-sm font-bold flex items-center space-x-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              sheetType === 'glass'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t('தனி கிளாஸ் கட்டிங் ஆர்டர் தாள்', 'Separate Glass Order Sheet')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Glass Factory
            </span>
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT: FORM CONTROLS (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('வாடிக்கையாளர் பெயர் (Customer Name)', 'Customer Name')}</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t('எ.கா. Sri Murugan Builders', 'e.g. Sri Murugan Builders')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {t(
                  'காலியாக விட்டால் தாளில் புள்ளியிடப்பட்ட வரியாக வரும் (....................)',
                  'If left blank, rendered as dotted underline (....................)'
                )}
              </p>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('தேதி (Date)', 'Date')}</span>
              </label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {/* CONDITIONAL SETTINGS: GLASS ORDER SHEET SPECIFIC */}
            {sheetType === 'glass' ? (
              <div className="space-y-3 animate-fade-in">
                {/* Glass Summary Stats */}
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white border-b border-emerald-800/60 pb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('கண்ணாடி மொத்த விவரங்கள் (Glass Summary)', 'Glass Summary Stats')}</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Factory Ready
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[11px] text-slate-400">{t('மொத்த கண்ணாடிகள்:', 'Total Glass Pcs:')}</div>
                      <div className="text-base font-bold text-emerald-400 font-mono">{totalGlassPcs} Nos</div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[11px] text-slate-400">{t('மொத்த பரப்பளவு:', 'Total Area:')}</div>
                      <div className="text-base font-bold text-teal-300 font-mono">{totalGlassSqFt.toFixed(2)} Sq.Ft</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-300 pt-1 flex justify-between">
                    <span>{t('கண்ணாடி உள்ள ஜன்னல்கள்:', 'Windows with Glass:')}</span>
                    <span className="font-bold text-white">{totalWindowsWithGlass} of {results.length}</span>
                  </div>
                </div>

                {/* Glass Columns List */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="font-bold text-slate-300 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('கிளாஸ் தாள் நிரல்கள் (Glass Sheet Columns - 196mm):', 'Glass Sheet Columns (196mm Total):')}</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-400 pl-2">
                    <li className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span><strong>1. Si.No (14mm):</strong> {t('வரிசை எண்', 'Serial Number')}</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span><strong>2. Win No (16mm):</strong> W1, W1a, W2</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span><strong>3. Window Model (36mm):</strong> {t('[SL/SL], [OP/DOOR (WITH BOTTOM)], [FIXED] போன்றவை', '[SL/SL], [OP/DOOR (WITH BOTTOM)], [FIXED] etc.')}</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span><strong>4. Site Size (28mm):</strong> {t('தள அளவு (Height × Width)', 'Site Size (Height × Width)')}</span>
                    </li>
                    <li className="flex items-center space-x-2 text-emerald-300 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span><strong>5. Glass Cut Size mm (42mm):</strong> {t('கண்ணாடி வெட்டு அளவு (பெரிய தடித்த எழுத்துகளில்)', 'Glass Cut Size mm (Large Bold)')}</span>
                    </li>
                    <li className="flex items-center space-x-2 text-blue-300 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span><strong>6. No. of Pcs (16mm):</strong> {t('துண்டுகள் எண்ணிக்கை (Multiplier × Qty)', 'Piece Count (Multiplier × Qty)')}</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span><strong>7. Total Sq.Ft (20mm):</strong> {t('சதுர அடி பரப்பளவு', 'Square Feet Area')}</span>
                    </li>
                    <li className="flex items-center space-x-2 text-cyan-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span><strong>8. Glass Type / Spec (24mm):</strong> {t('வாடிக்கையாளர் குறிப்பு (Client / Factory Fill)', 'Client / Factory Specification')}</span>
                    </li>
                  </ul>
                  <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-800/80 leading-relaxed">
                    {t(
                      '✓ வெளி பிரேம், சஷ் மற்றும் இன்டர்லாக் விவரங்கள் நீக்கப்பட்டு கண்ணாடி ஆலைக்கு மட்டும் அனுப்ப உகந்த தனி தாள்.',
                      '✓ Outer frames, sash profiles and interlocks omitted so glass cutting factories see only glass specifications.'
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {/* Logical Mesh Option: Shown ONLY IF user selected 2.5 track / openwindow with mesh */}
                {has2_5Track && (
                  <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/50 space-y-1.5 animate-fade-in">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeMeshColumn}
                        onChange={(e) => setIncludeMeshColumn(e.target.checked)}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                          <span>{t('2.5-டிராக் கொசு வலைக்கான தனி நிரல் சேர்க்க', 'Include 2.5-Track Wire Mesh Column')}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            New Column
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                          {t(
                            'தேர்ந்தெடுக்கப்பட்ட 2.5-டிராக் ஜன்னல்களுக்கு கொசு வலை சஷ் வெட்டு அளவு (2.5T Mesh mm) PDF அட்டவணையில் புதிய தனி நிரலாக தோன்றும்.',
                            'For selected 2.5-track windows, mosquito mesh shutter cut size (2.5T Mesh mm) will be added as a separate column.'
                          )}
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Logical Interlock Option: Shown ONLY IF user selected sliding window (2-track, 2.5-track, 3-track) */}
                {hasSliding && (
                  <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-1.5 animate-fade-in">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeInterlockColumn}
                        onChange={(e) => setIncludeInterlockColumn(e.target.checked)}
                        className="mt-0.5 rounded text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                          <span>{t('ஸ்லைடிங் இன்டர்லாக் தனி நிரல் சேர்க்க', 'Include Sliding Interlock Column')}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                            Sash H - 5 mm
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                          {t(
                            'ஸ்லைடிங் ஜன்னல்களுக்கு (2T, 2.5T, 3T) இன்டர்லாக் அளவு (Interlock mm = Sash Height - 5 mm) அட்டவணையில் தனி நிரலாக தோன்றும்.',
                            'For sliding windows (2T, 2.5T, 3T), interlock length (Interlock mm = Sash Height - 5 mm) will be added as a column.'
                          )}
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Logical Double Window Mullion Option: Shown ONLY IF user selected Double Open Window */}
                {hasDoubleWindow && (
                  <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-500/50 space-y-2.5 animate-fade-in">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeMullionColumn}
                        onChange={(e) => setIncludeMullionColumn(e.target.checked)}
                        className="mt-0.5 rounded text-teal-500 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                          <span>{t('டபுள் / 3-Open விண்டோ முல்லியன் தனி நிரல் சேர்க்க', 'Include Double / 3-Open Mullion Column')}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono">
                            H - {mullionDeductionMM} mm
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                          {t(
                            `இரட்டை மற்றும் 3-Open திறக்கும் ஜன்னல்களுக்கு (Double / 3-Open Window) பிரேம் உயரத்தில் இருந்து கழிக்கப்படும் முல்லியன் அளவு (Mullion mm = Height - ${mullionDeductionMM} mm) அட்டவணையில் தனி நிரலாக தோன்றும்.`,
                            `For Double and 3-Open windows, mullion cut size (Mullion mm = Height - ${mullionDeductionMM} mm) will be added as a column.`
                          )}
                        </p>
                      </div>
                    </label>

                    {includeMullionColumn && (
                      <div className="pt-2 border-t border-teal-800/60 flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-semibold">
                          {t('முல்லியன் கழிப்பு மிமீ (Mullion Deduction):', 'Mullion Deduction (mm):')}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-teal-300 font-bold">Height −</span>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => setMullionDeductionMM((prev) => Math.max(0, prev - 1))}
                              className="w-7 h-7 rounded bg-teal-900/80 hover:bg-teal-800 text-teal-200 font-bold flex items-center justify-center border border-teal-700 active:scale-95 transition"
                              title={t('1mm குறை', 'Decrease 1mm')}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={mullionDeductionMM}
                              onChange={(e) => setMullionDeductionMM(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-14 h-7 bg-slate-900 border border-teal-600 rounded text-center font-mono font-bold text-white text-xs focus:outline-none focus:border-teal-400"
                            />
                            <button
                              type="button"
                              onClick={() => setMullionDeductionMM((prev) => prev + 1)}
                              className="w-7 h-7 rounded bg-teal-900/80 hover:bg-teal-800 text-teal-200 font-bold flex items-center justify-center border border-teal-700 active:scale-95 transition"
                              title={t('1mm கூட்டு', 'Increase 1mm')}
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs text-slate-400 font-mono">mm</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Columns Included Information */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="font-bold text-slate-300 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>{t('PDF அட்டவணை நிரல்கள் (Automatic Columns):', 'Automatic Table Columns:')}</span>
                  </div>
                  <ul className="space-y-1 text-slate-400 pl-2">
                    <li className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span><strong>Site Size:</strong> Height × Width (Inch)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span><strong>Outer Frame mm:</strong> {t('வெளி பிரேம் வெட்டு (Height X Width)', 'Outer Frame Cut (Height × Width)')}</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span><strong>Model Name:</strong> {t('ஜன்னல் மாதிரி குறியீடு [SL/SL], [SL/SL/MESH], [OP], [FIXED]', 'Window Model Type Code [SL/SL], [SL/SL/MESH], [OP], [FIXED]')}</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span><strong>Sash Cut mm:</strong> {t('சஷ் வெட்டு அளவு (Height X Width) & சஷ் துண்டுகள் (2H + 2W = 4 Pcs / சஷ்)', 'Sash Cut Size (Height × Width) & No. of Sash Pcs (2H + 2W = 4 Pcs / Sash)')}</span>
                    </li>
                    {includeMullionColumn && (
                      <li className="flex items-center space-x-2 text-teal-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                        <span><strong>Mullion mm:</strong> {t(`முல்லியன் அளவு (H - ${mullionDeductionMM}) & No.Pcs`, `Mullion Size (H - ${mullionDeductionMM}) & No. of Pcs`)}</span>
                      </li>
                    )}
                    {includeInterlockColumn && (
                      <li className="flex items-center space-x-2 text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span><strong>Interlock mm:</strong> {t('இன்டர்லாக் அளவு (Sash H - 5)', 'Interlock Size (Sash H - 5)')}</span>
                      </li>
                    )}
                    <li className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span><strong>Glass Cut mm:</strong> {t('கண்ணாடி வெட்டு அளவு (Height X Width) & No.Pcs', 'Glass Cut Size (Height × Width) & No. of Pcs')}</span>
                    </li>
                    <li className="flex items-center space-x-2 text-cyan-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span><strong>Glass Type:</strong> {t('வாடிக்கையாளர் குறிப்பு (Client Fill - Empty Column)', 'Client Specification (Blank Column)')}</span>
                    </li>
                    {includeMeshColumn && (
                      <li className="flex items-center space-x-2 text-rose-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span><strong>2.5T Mesh mm:</strong> {t('கொசு வலை சஷ் அளவு (Height X Width)', 'Wire Mesh Shutter Size (Height × Width)')}</span>
                      </li>
                    )}
                  </ul>

                  {/* Model Unique Row Background Colors Legend */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] font-bold text-slate-300 block mb-1.5 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('வரிசை பின்னணி வண்ணங்கள் (Cell Row Background Colors):', 'Row Background Colors by Model:')}</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-amber-950 bg-amber-200 border border-amber-300">
                        Track (Light Blue)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-950 bg-emerald-200 border border-emerald-300">
                        Single Window (Sky Blue)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-teal-950 bg-teal-200 border border-teal-300">
                        Double Window (Ice Blue)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-rose-950 bg-rose-200 border border-rose-300 font-black">
                        Fixed Window (Navy Blue, Bold)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-blue-950 bg-blue-200 border border-blue-300">
                        Ventilator Normal (Deep Sky Blue)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-indigo-950 bg-indigo-200 border border-indigo-300">
                        Ventilator Fan Left (Blue)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-pink-950 bg-pink-200 border border-pink-300">
                        Ventilator Fan Right (Navy Blue)
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      {t(
                        '✓ எழுத்து நிறம் இல்லை (No Font Color): அனைத்து எண்களும் கறுப்பு மையிலும் (#0f172a), மாதிரிக்கு ஏற்ப பின்னணி வண்ணத்திலும் தோன்றும்.',
                        '✓ High-contrast black ink (#0f172a) with distinct pastel row backgrounds per window type.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Batch Info Card */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>{t('மொத்த ஜன்னல்கள்:', 'Total Windows:')}</span>
                <span className="font-bold text-white">{t(`${results.length} ஜன்னல்கள் (W1 - W${results.length})`, `${results.length} Windows (W1 - W${results.length})`)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{t('தாள் வரிசைகள்:', 'Sheet Rows:')}</span>
                <span className="font-bold text-blue-400">{t('28 வரிசைகள் / A4 பக்கம்', '28 Rows / A4 Page')}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{t('வடிவம்:', 'Format:')}</span>
                <span className="font-bold text-slate-200">
                  {sheetType === 'glass' ? t('L.S. Interiors கிளாஸ் கட்டிங் லாக்', 'L.S. Interiors Glass Cutting Log') : t('L.S. Interiors பட்டறை லாக்', 'L.S. Interiors Workshop Sheet')}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: LIVE CANVAS PREVIEW (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1.5 font-semibold text-slate-300">
                <Eye className={`w-4 h-4 ${sheetType === 'glass' ? 'text-emerald-400' : 'text-blue-400'}`} />
                <span>
                  {sheetType === 'glass'
                    ? t('கிளாஸ் தாள் நேரடி முன்னோட்டம் (Live Glass Order Preview)', 'Live Glass Order Preview')
                    : t('நேரடி தாள் முன்னோட்டம் (Live Sheet Preview)', 'Live Sheet Preview')}
                </span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {sheetType === 'glass'
                  ? t('A4 • 28 வரிசைகள் • 8 பிரத்யேக கிளாஸ் நிரல்கள்', 'A4 • 28 Rows • 8 Glass Columns')
                  : t(`A4 • 28 வரிசைகள் • ${8 + (includeMeshColumn ? 1 : 0) + (includeInterlockColumn ? 1 : 0) + (includeMullionColumn ? 1 : 0)} நிரல்கள்`, `A4 • 28 Rows • ${8 + (includeMeshColumn ? 1 : 0) + (includeInterlockColumn ? 1 : 0) + (includeMullionColumn ? 1 : 0)} Columns`)}
              </span>
            </div>

            {/* Canvas Container with Scroll */}
            <div className="relative border border-slate-700 rounded-xl bg-slate-950 p-2 overflow-y-auto max-h-[55vh] flex justify-center items-start shadow-inner">
              <div ref={previewContainerRef} className="w-full max-w-[540px] transition-all duration-200" />
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 px-5 py-3.5 border-t border-slate-800 bg-slate-950/80">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            {t('மூடு', 'Close')}
          </button>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            {/* Secondary Download Button */}
            {sheetType === 'glass' ? (
              <button
                type="button"
                onClick={handleDownloadFullPDF}
                disabled={isExporting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-blue-300 border border-blue-500/30 text-xs sm:text-sm font-semibold flex items-center justify-center space-x-1.5 transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                <span>{t('முழு தாள் PDF பதிவிறக்கு', 'Download Full Sheet PDF')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadGlassPDF}
                disabled={isExporting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-semibold flex items-center justify-center space-x-1.5 transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>{t('கிளாஸ் PDF மட்டும் பதிவிறக்கு', 'Download Glass PDF Only')}</span>
              </button>
            )}

            {/* Primary Action Button */}
            {sheetType === 'glass' ? (
              <button
                type="button"
                onClick={handleDownloadGlassPDF}
                disabled={isExporting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? t('தயாராகிறது...', 'Generating...') : t('கிளாஸ் ஆர்டர் PDF பதிவிறக்கு (A4)', 'Download Glass PDF (A4)')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadFullPDF}
                disabled={isExporting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? t('தயாராகிறது...', 'Generating...') : t('L.S. Interiors PDF பதிவிறக்கு (A4)', 'Download L.S. Interiors PDF (A4)')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
