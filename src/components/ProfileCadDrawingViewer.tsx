import React, { useState, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Download,
  FileText,
  Layers,
  Info,
  CheckCircle2,
  X,
  Printer
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useLanguage } from '../context/LanguageContext';
import { CalculationResult } from '../engine/types';
import {
  UPVC_16_PROFILES,
  UPVCProfileSpec,
  UPVC_PROFILE_CAD_IMAGE_DATA,
  UPVC_PROFILE_CAD_IMAGE_PATH,
  getMatchingProfilesForResult
} from '../data/upvcProfilesData';

interface ProfileCadDrawingViewerProps {
  currentResult?: CalculationResult;
  cadTheme?: 'white' | 'blueprint';
}

export const ProfileCadDrawingViewer: React.FC<ProfileCadDrawingViewerProps> = ({
  currentResult,
  cadTheme = 'white'
}) => {
  const { t, isTamil } = useLanguage();
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedProfileCode, setSelectedProfileCode] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  const isWhite = cadTheme === 'white';

  // Matching profiles for current window
  const matchingProfiles = currentResult
    ? getMatchingProfilesForResult(currentResult.input.windowType, currentResult.input.frameType)
    : [];
  const matchingCodes = new Set(matchingProfiles.map((p) => p.code));

  const selectedProfile = UPVC_16_PROFILES.find((p) => p.code === selectedProfileCode) || null;

  const filteredProfiles = activeCategoryFilter === 'all'
    ? UPVC_16_PROFILES
    : activeCategoryFilter === 'matching'
      ? UPVC_16_PROFILES.filter((p) => matchingCodes.has(p.code))
      : UPVC_16_PROFILES.filter((p) => p.category === activeCategoryFilter);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3.0));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.6));
  const handleResetZoom = () => setZoomLevel(1);

  // Download raw JPG drawing
  const handleDownloadImage = () => {
    const link = document.createElement('a');
    link.href = UPVC_PROFILE_CAD_IMAGE_DATA;
    link.download = 'LS_Interiors_16_uPVC_Profiles_2D_CAD_Drawing.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Landscape A4 Engineering CAD Blueprint PDF
  const handleDownloadPDF = () => {
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // Page 1: High-Resolution 2D CAD Blueprint Drawing
      doc.setFillColor(isWhite ? 255 : 10, isWhite ? 255 : 15, isWhite ? 255 : 26);
      doc.rect(0, 0, 297, 210, 'F');

      // Outer Technical Border
      doc.setDrawColor(isWhite ? 30 : 30, isWhite ? 58 : 58, isWhite ? 138 : 138);
      doc.setLineWidth(0.6);
      doc.rect(6, 6, 285, 198);

      // Title Block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(isWhite ? 15 : 255, isWhite ? 41 : 255, isWhite ? 82 : 255);
      doc.text('L.S. INTERIORS — OFFICIAL 16 uPVC PROFILE SECTIONS 2D CAD BLUEPRINT', 12, 13);

      doc.setFontSize(8.5);
      doc.setTextColor(2, 132, 199);
      doc.text('STANDARD 5.9 MTR EXTRUSION CROSS-SECTIONS & GI STEEL REINFORCEMENT SPECIFICATIONS (GC-03 TO GC-18)', 12, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(isWhite ? 100 : 180, isWhite ? 116 : 190, isWhite ? 139 : 205);
      doc.text(`Sheet: 1 of 2  •  Date: ${new Date().toLocaleDateString('en-GB')}  •  Scale: Exact Factory Extrusions (mm)`, 285, 13, { align: 'right' });

      // Embed Drawing Image cleanly
      // Image aspect ratio: 782 / 1024 = 0.7636
      // In A4 landscape: available height is ~170mm. Available width is 275mm.
      const imgH = 170;
      const imgW = imgH * (782 / 1024); // ~130 mm
      const imgX = (297 - imgW) / 2;
      doc.addImage(UPVC_PROFILE_CAD_IMAGE_DATA, 'JPEG', imgX, 22, imgW, imgH);

      // Footer
      doc.setLineWidth(0.3);
      doc.setDrawColor(200, 200, 200);
      doc.line(10, 197, 287, 197);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('WindowBuilder Pro • Authorized L.S. Interiors Fabrication Standard (GC-03 to GC-18)', 12, 201);
      doc.text('All dimensions in millimeters (mm)  •  Standard Extrusion Profile Length: 5.9 Meters', 285, 201, { align: 'right' });

      // Page 2: Full 16-Profile Technical Specification Table
      doc.addPage('a4', 'landscape');
      doc.setFillColor(isWhite ? 255 : 10, isWhite ? 255 : 15, isWhite ? 255 : 26);
      doc.rect(0, 0, 297, 210, 'F');
      doc.setDrawColor(isWhite ? 30 : 30, isWhite ? 58 : 58, isWhite ? 138 : 138);
      doc.setLineWidth(0.6);
      doc.rect(6, 6, 285, 198);

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(isWhite ? 15 : 255, isWhite ? 41 : 255, isWhite ? 82 : 255);
      doc.text('L.S. INTERIORS — 16 uPVC PROFILES ENGINEERING SPECIFICATION SCHEDULE', 12, 13);

      doc.setFontSize(8.5);
      doc.setTextColor(2, 132, 199);
      doc.text('TECHNICAL WEIGHT (KG/M), GI STEEL REINFORCEMENT CHAMBERS & PROFILE DIMENSIONS', 12, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(isWhite ? 100 : 180, isWhite ? 116 : 190, isWhite ? 139 : 205);
      doc.text('Sheet: 2 of 2  •  Factory Extrusion Reference Table', 285, 13, { align: 'right' });

      // Table Header (y = 23 mm)
      const tY = 23;
      doc.setFillColor(224, 242, 254);
      doc.rect(10, tY, 277, 8, 'F');
      doc.setDrawColor(30, 58, 138);
      doc.setLineWidth(0.35);
      doc.rect(10, tY, 277, 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 41, 82);
      doc.text('CODE', 13, tY + 5);
      doc.text('PROFILE NAME', 32, tY + 5);
      doc.text('CATEGORY', 82, tY + 5);
      doc.text('LENGTH', 110, tY + 5);
      doc.text('WEIGHT', 130, tY + 5);
      doc.text('GI STEEL CHAMBER', 155, tY + 5);
      doc.text('PROFILE DIMENSIONS', 195, tY + 5);
      doc.text('RECOMMENDED APPLICATIONS', 242, tY + 5);

      // Table Rows
      let rowY = tY + 8;
      const rowH = 9.8;

      UPVC_16_PROFILES.forEach((p, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(10, rowY, 277, rowH, 'F');
        }
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.rect(10, rowY, 277, rowH);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(29, 78, 216);
        doc.text(p.code, 13, rowY + 6);

        doc.setTextColor(15, 23, 42);
        doc.text(p.name, 32, rowY + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.0);
        doc.setTextColor(71, 85, 105);
        doc.text(p.category.toUpperCase(), 82, rowY + 6);
        doc.text(`${p.lengthMtr} MTR`, 110, rowY + 6);
        doc.text(`${p.weightKgM.toFixed(3)} KG/M`, 130, rowY + 6);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(p.steelChamberMM ? 220 : 150, p.steelChamberMM ? 38 : 150, p.steelChamberMM ? 38 : 150);
        doc.text(p.steelChamberMM || 'None (Unreinforced)', 155, rowY + 6);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(p.outerDimensionsMM, 195, rowY + 6);

        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        const appText = p.matchingWindowTypes.join(', ').toUpperCase();
        doc.text(appText || 'Universal', 242, rowY + 6);

        rowY += rowH;
      });

      // Footer
      doc.setLineWidth(0.3);
      doc.setDrawColor(200, 200, 200);
      doc.line(10, 197, 287, 197);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('WindowBuilder Pro • L.S. Interiors uPVC Workshop Engineering Standard', 12, 201);
      doc.text(`Generated on ${new Date().toLocaleDateString('en-GB')}`, 285, 201, { align: 'right' });

      doc.save('LS_Interiors_16_uPVC_Profiles_2D_CAD_Blueprint.pdf');
    } catch (e) {
      console.error('Error generating Profile Sections CAD PDF:', e);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="w-full space-y-3 animate-fade-in">
      {/* 1. TOP TOOLBAR & CONTROLS */}
      <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 flex items-center justify-between flex-wrap gap-2.5">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>{t('16 uPVC ப்ரொஃபைல் குறுக்குவெட்டு 2D CAD வரைபடம்', '16 uPVC Extrusion Profiles 2D CAD Cross-Sections')}</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-400/30 font-mono font-bold">
                GC-03 → GC-18
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {t(
                'தொழிற்சாலை ஸ்டாண்டர்ட் அளவுகள், எடை (KG/M) & GI ஸ்டீல் சேம்பர் அளவுகள்',
                'Factory Millimeter Dimensions, Weight (KG/M) & GI Steel Reinforcement Chambers'
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons: Zoom, Fullscreen, Download */}
        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-slate-300">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              title={t('பெரிதாக்கத்தை குறை (Zoom Out)', 'Zoom Out')}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1.5 font-bold text-amber-400">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              title={t('பெரிதாக்கு (Zoom In)', 'Zoom In')}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer text-slate-400 hover:text-sky-300"
              title={t('மீட்டமை (100% Reset)', 'Reset 100%')}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
            title={t('முழுத்திரை பார்வை (Full Screen)', 'Full Screen View')}
          >
            <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">{t('முழுத்திரை', 'Fullscreen')}</span>
          </button>

          {/* Download JPG */}
          <button
            type="button"
            onClick={handleDownloadImage}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
            title={t('வரைபட படத்தை பதிவிறக்கு (Download JPG)', 'Download CAD Drawing (JPG)')}
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">JPG</span>
          </button>

          {/* Download PDF */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            title={t('ப்ளூபிரிண்ட் PDF பதிவிறக்கு (Download Blueprint PDF)', 'Download Profile Blueprint (PDF)')}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isExportingPDF ? t('உருவாகிறது...', 'Exporting...') : 'CAD PDF'}</span>
          </button>
        </div>
      </div>

      {/* 2. MATCHING PROFILES BANNER (FOR CURRENT WINDOW) */}
      {currentResult && (
        <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-slate-300 font-medium">
                {t('தற்போதைய ஜன்னல் பயன்பாட்டு ப்ரொஃபைல்கள்:', 'Active Window Required Profiles:')}{' '}
              </span>
              <span className="font-bold text-white font-mono">
                {currentResult.input.windowLabel || currentResult.id} (
                {currentResult.input.windowType === 'sliding'
                  ? `${currentResult.input.profileSeries || '58mm'} ${currentResult.input.frameType.toUpperCase()}`
                  : currentResult.input.windowType.toUpperCase()}
                )
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {matchingProfiles.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setSelectedProfileCode(p.code)}
                className={
                  'px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer ' +
                  (selectedProfileCode === p.code
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                    : 'bg-blue-900/60 text-blue-200 border-blue-700/60 hover:bg-blue-800')
                }
                title={`${p.code}: ${p.name}`}
              >
                {p.code}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. MAIN CAD DRAWING VIEWPORT */}
      <div
        className={
          'relative w-full rounded-2xl border overflow-auto p-3 sm:p-5 flex items-center justify-center transition-colors min-h-[460px] sm:min-h-[580px] ' +
          (isWhite
            ? 'bg-slate-100 border-slate-300 shadow-inner'
            : 'bg-slate-950 border-slate-800 shadow-2xl')
        }
      >
        <div
          className="transition-transform duration-150 origin-center max-w-full flex justify-center"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <img
            src={UPVC_PROFILE_CAD_IMAGE_DATA}
            alt="16 uPVC Profile Sections 2D CAD Blueprint (GC-03 to GC-18)"
            className="rounded-lg shadow-xl border border-slate-400/40 object-contain max-h-[750px] w-auto pointer-events-auto select-none"
            loading="eager"
          />
        </div>

        {/* Floating Zoom Indicator Pill */}
        <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-sm text-slate-300 text-[10px] font-mono px-2.5 py-1 rounded-full border border-slate-700 pointer-events-none">
          {Math.round(zoomLevel * 100)}% CAD Scale
        </div>
      </div>

      {/* 4. PROFILE SPECIFICATIONS QUICK INSPECTOR GRID */}
      <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-3">
        {/* Category Filter Pills */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('16 ப்ரொஃபைல் விவர அட்டவணை (Quick Inspector):', '16 Profiles Quick Inspector:')}</span>
          </div>

          <div className="flex items-center gap-1 flex-wrap text-[10px]">
            {[
              { id: 'all', label: t('அனைத்தும் (16)', 'All (16)') },
              { id: 'matching', label: t('தற்போதைய ஜன்னல்', 'Matching Window') },
              { id: 'frame', label: t('பிரேம்', 'Frames') },
              { id: 'sash', label: t('சஷ்', 'Sashes') },
              { id: 'interlock', label: t('இன்டர்லாக்', 'Interlocks') },
              { id: 'mesh', label: t('கொசுவலை', 'Mesh') },
              { id: 'bead', label: t('பீடிங்', 'Beads') },
              { id: 'mullion', label: t('மல்லியன்', 'Mullions') }
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={
                  'px-2 py-0.5 rounded transition cursor-pointer font-medium ' +
                  (activeCategoryFilter === cat.id
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800')
                }
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 16 Profile Interactive Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {filteredProfiles.map((p) => {
            const isMatch = matchingCodes.has(p.code);
            const isSelected = selectedProfileCode === p.code;
            return (
              <button
                key={p.code}
                type="button"
                onClick={() => setSelectedProfileCode(isSelected ? null : p.code)}
                className={
                  'p-2 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ' +
                  (isSelected
                    ? 'bg-amber-950/80 border-amber-400 text-white shadow-md ring-1 ring-amber-400'
                    : isMatch
                      ? 'bg-blue-950/50 border-blue-600/70 text-slate-200 hover:bg-blue-900/60'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200')
                }
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-400">{p.code}</span>
                    {isMatch && (
                      <span className="text-[9px] bg-emerald-900/80 text-emerald-300 px-1 py-0.2 rounded font-sans">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-white leading-tight mt-1 truncate" title={p.name}>
                    {p.name}
                  </div>
                </div>
                <div className="mt-2 text-[9px] font-mono text-slate-400 space-y-0.5 border-t border-slate-800/80 pt-1">
                  <div>{p.weightKgM.toFixed(3)} kg/m</div>
                  <div className="text-emerald-400 truncate">{p.steelChamberMM || 'No Steel'}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Profile Detail Drawer */}
        {selectedProfile && (
          <div className="mt-3 p-3.5 rounded-xl bg-slate-900 border border-amber-500/40 text-slate-200 space-y-2 animate-fade-in relative">
            <button
              type="button"
              onClick={() => setSelectedProfileCode(null)}
              className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                {selectedProfile.code}
              </span>
              <h4 className="text-sm font-bold text-white">
                {selectedProfile.name}
              </h4>
              <span className="text-[10px] text-amber-300 font-sans">
                ({selectedProfile.tamilName})
              </span>
            </div>

            <p className="text-xs text-slate-300">
              {isTamil ? selectedProfile.tamilDescription : selectedProfile.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-sans">{t('நிலையான நீளம் (Length)', 'Length')}</span>
                <span className="font-bold text-white">{selectedProfile.lengthMtr} MTR (5900 mm)</span>
              </div>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-sans">{t('எடை (Weight / Mtr)', 'Weight / Mtr')}</span>
                <span className="font-bold text-emerald-400">{selectedProfile.weightKgM.toFixed(3)} KG/M</span>
              </div>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-sans">{t('GI ஸ்டீல் சேம்பர் (Reinforcement)', 'GI Steel Chamber')}</span>
                <span className="font-bold text-rose-400">{selectedProfile.steelChamberMM || t('ஸ்டீல் தேவையில்லை', 'None (Unreinforced)')}</span>
              </div>
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-sans">{t('வெளிப்புற பரிமாணங்கள் (Outer mm)', 'Outer Dimensions')}</span>
                <span className="font-bold text-sky-400">{selectedProfile.outerDimensionsMM}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. FULLSCREEN EXPANDED MODAL */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-3 sm:p-5 animate-fade-in">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-base font-bold text-white">
                  {t('16 uPVC ப்ரொஃபைல் குறுக்குவெட்டு முழு வரைபடம்', '16 uPVC Profile Sections Official 2D CAD Blueprint')}
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  GC-03 to GC-18 • High Resolution Factory CAD Drawing
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleDownloadImage}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>JPG</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>CAD PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Image Viewport */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <img
              src={UPVC_PROFILE_CAD_IMAGE_DATA}
              alt="16 uPVC Profile Sections Full CAD Drawing"
              className="max-h-[88vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-700"
            />
          </div>
        </div>
      )}
    </div>
  );
};
