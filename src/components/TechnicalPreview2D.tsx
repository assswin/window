import React, { useState, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';
import { CalculationResult } from '../engine/types';
import { getLSModelName } from '../utils/lsInteriorsSheetCanvas';
import { Download, ChevronLeft, ChevronRight, Eye, Grid, Maximize2, FileSpreadsheet, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface TechnicalPreview2DProps {
  results: CalculationResult[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onExportPDF?: () => void;
  onExportLSInteriorsPDF?: () => void;
}

export const TechnicalPreview2D: React.FC<TechnicalPreview2DProps> = ({
  results,
  selectedIndex,
  onSelectIndex,
  onExportPDF,
  onExportLSInteriorsPDF
}) => {
  const { t, isTamil } = useLanguage();
  const [activeTab, setActiveTab] = useState<'elevation' | 'track_plan'>('elevation');
  const [viewMode, setViewMode] = useState<'single' | 'gallery'>('single');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!results || results.length === 0) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center text-slate-400 space-y-3">
        <Eye className="w-10 h-10 text-slate-600 mx-auto" />
        <p className="text-sm">{t('10 அளவுகளை உள்ளிட்டு சேமிக்க 2D வரைபட படங்கள் தோன்றும்.', 'Enter and save dimensions to display 2D drawings.')}</p>
      </div>
    );
  }

  const currentResult = results[selectedIndex] || results[0];

  /**
   * Render a window calculation result's SVG to high-resolution JPEG Data URL
   */
  const renderResultToImageData = (result: CalculationResult): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const svgString = renderToStaticMarkup(<WindowBlueprintSVG result={result} isTamil={isTamil} />);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);
        const image = new Image();

        image.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 2080;
            canvas.height = 1400;
            const context = canvas.getContext('2d');
            if (context) {
              context.fillStyle = '#0f172a';
              context.fillRect(0, 0, canvas.width, canvas.height);
              context.drawImage(image, 0, 0, canvas.width, canvas.height);
              const imgData = canvas.toDataURL('image/jpeg', 0.95);
              URL.revokeObjectURL(blobURL);
              resolve(imgData);
            } else {
              URL.revokeObjectURL(blobURL);
              reject(new Error('Canvas 2D context not available'));
            }
          } catch (err) {
            URL.revokeObjectURL(blobURL);
            reject(err);
          }
        };

        image.onerror = (err) => {
          URL.revokeObjectURL(blobURL);
          reject(err);
        };

        image.src = blobURL;
      } catch (err) {
        reject(err);
      }
    });
  };

  /**
   * Draw a single landscape A4 blueprint page in the jsPDF document
   */
  const drawSingleWindowBlueprintPage = (
    doc: jsPDF,
    result: CalculationResult,
    index: number,
    total: number,
    imgData: string
  ) => {
    // 1. Page background (A4 Landscape: 297 × 210 mm)
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, 297, 210, 'F');

    // 2. Elegant outer border
    doc.setDrawColor(30, 58, 138); // #1e3a8a
    doc.setLineWidth(0.6);
    doc.rect(8, 8, 281, 194);

    // 3. Header title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('L.S. INTERIORS — 2D ELEVATION BLUEPRINT', 14, 17);

    // 4. Subtitle: Window label & model
    const winLabel = result.input.windowLabel || `Window ${index + 1}`;
    const modelName = getLSModelName(result);
    doc.setFontSize(10.5);
    doc.setTextColor(56, 189, 248); // sky-400
    doc.text(`${winLabel} • ${modelName}  (Drawing ${index + 1} of ${total})`, 14, 23.5);

    // 5. Material & Type
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // slate-400
    const material = result.input.profileSeries || (result.input.windowType === 'sliding' ? '58mm' : '60mm');
    const trackLabel = result.input.windowType === 'sliding'
      ? result.input.frameType.toUpperCase().replace('-', ' ')
      : result.input.windowType.toUpperCase();
    doc.text(`Material: ${material}  |  Type: ${trackLabel}`, 14, 28);

    // 6. Top right specifications
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(248, 250, 252);
    const siteDim = `Site: ${result.input.widthInch}" W × ${result.input.heightInch}" H (${result.frame.widthMM} × ${result.frame.heightMM} mm)`;
    doc.text(siteDim, 283, 17, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    const frameCut = `Frame: ${result.frame.leftRightCutMM}H × ${result.frame.topBottomCutMM}W`;
    const sashCut = result.panel.heightMM > 0
      ? `Sash: ${result.panel.heightMM}H × ${result.panel.widthMM}W (${result.panel.count * 4} Pcs)`
      : 'Sash: -';
    const glassCut = result.mirror && result.mirror.count > 0
      ? `Glass: ${result.mirror.heightMM}H × ${result.mirror.widthMM}W (${result.mirror.count} Pcs)`
      : 'Glass: -';
    const mullionStr = result.frame.mullionCutMM ? `  |  Mullion: ${result.frame.mullionCutMM}mm` : '';
    doc.text(`${frameCut}  |  ${sashCut}  |  ${glassCut}${mullionStr}`, 283, 23.5, { align: 'right' });

    // 7. High-Resolution Blueprint Image
    doc.addImage(imgData, 'JPEG', 12, 31, 273, 163);

    // 8. Footer divider & notes
    doc.setDrawColor(30, 41, 59); // slate-800
    doc.setLineWidth(0.3);
    doc.line(14, 196, 283, 196);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated on ${new Date().toLocaleDateString('en-GB')} • WindowBuilder Pro (L.S. Interiors)`, 14, 200.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(56, 189, 248);
    doc.text(`Drawing ${index + 1} of ${total}`, 148.5, 200.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Authorized Workshop Blueprint • All ${total} Windows in Single PDF`, 283, 200.5, { align: 'right' });
  };

  /**
   * Export ALL input windows in a single multi-page PDF (Page 1 = Window 1, Page 2 = Window 2, etc.)
   */
  const handleDownloadAllPDF = async () => {
    if (!results || results.length === 0) return;
    setIsExportingPDF(true);
    setExportProgress({ current: 1, total: results.length });
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      for (let i = 0; i < results.length; i++) {
        setExportProgress({ current: i + 1, total: results.length });
        if (i > 0) {
          doc.addPage('a4', 'landscape');
        }
        const imgData = await renderResultToImageData(results[i]);
        drawSingleWindowBlueprintPage(doc, results[i], i, results.length, imgData);
      }

      const filename = results.length === 1
        ? `LS_Interiors_Window_1_2D_Blueprint.pdf`
        : `LS_Interiors_All_${results.length}_Windows_2D_Blueprint.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error('Error generating multi-window 2D Blueprint PDF:', e);
      alert(t('2D வரைபடம் PDF உருவாக்குவதில் பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.', 'Failed to generate 2D blueprint PDF. Please try again.'));
    } finally {
      setIsExportingPDF(false);
      setExportProgress(null);
    }
  };

  /**
   * Export ONLY the active/selected window as a single page PDF
   */
  const handleDownloadSinglePDF = async () => {
    if (!currentResult) return;
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      const imgData = await renderResultToImageData(currentResult);
      drawSingleWindowBlueprintPage(doc, currentResult, selectedIndex, 1, imgData);
      const winLabel = currentResult.input.windowLabel || `Window_${selectedIndex + 1}`;
      doc.save(`LS_Interiors_${winLabel}_2D_Blueprint.pdf`);
    } catch (e) {
      console.error('Error generating single window 2D Blueprint PDF:', e);
    } finally {
      setIsExportingPDF(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3 sm:p-4 space-y-3.5 text-slate-100 flex flex-col w-full">
      {/* 1. SECTION TITLE & ACTIONS */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 flex-shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white">
            {t(`3. ${results.length} ஜன்னல் 2D வரைபடங்கள்`, `3. ${results.length} Windows 2D Blueprints`)}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {t(
              'துல்லியமான uPVC விகிதாசார வரைபடம் & மிமீ அளவீடுகள்',
              'Accurate uPVC proportional CAD blueprint & mm dimensions'
            )}
          </p>
        </div>

        {/* View mode toggle: Single vs Gallery */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
          <button
            type="button"
            onClick={() => setViewMode('single')}
            className={
              'px-2 py-1 rounded transition cursor-pointer font-medium ' +
              (viewMode === 'single'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:text-white')
            }
          >
            {t('தனி (Active)', 'Single (Active)')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('gallery')}
            className={
              'px-2 py-1 rounded transition cursor-pointer font-medium ' +
              (viewMode === 'gallery'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:text-white')
            }
          >
            {t(`அனைத்து (${results.length})`, `All (${results.length})`)}
          </button>
        </div>
      </div>

      {/* 2. TOP 10 WINDOW SELECTOR PILLS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0 no-scrollbar">
        {results.map((r, idx) => {
          const isSelected = selectedIndex === idx;
          const label = 'W' + (idx + 1);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelectIndex(idx);
                setViewMode('single');
              }}
              className={
                'py-1.5 px-2.5 rounded-xl text-center border transition flex-shrink-0 cursor-pointer ' +
                (isSelected
                  ? 'bg-blue-600 border-blue-400 text-white'
                  : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-400')
              }
            >
              <span className="text-xs font-bold max-w-[90px] truncate inline-block align-middle" title={label}>
                {label}
              </span>
              <span className="text-[10px] font-mono ml-1 text-emerald-400">
                {r.convertedHeightMM + '×' + r.convertedWidthMM}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. DRAWING AREA */}
      {viewMode === 'single' ? (
        /* SINGLE WINDOW FOCUSED DRAWING */
        <div className="space-y-3 w-full">
          {/* Active window banner */}
          <div className="bg-slate-950/90 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-bold text-white">
                  {'W' + (selectedIndex + 1)}
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  {currentResult.input.unit === 'cm'
                    ? `(${currentResult.input.heightCm ?? Number((currentResult.input.heightInch * 2.54).toFixed(1))} cm H × ${currentResult.input.widthCm ?? Number((currentResult.input.widthInch * 2.54).toFixed(1))} cm W)`
                    : currentResult.input.unit === 'mm'
                      ? `(${currentResult.input.heightMM ?? Math.round(currentResult.input.heightInch * 25.4)} mm H × ${currentResult.input.widthMM ?? Math.round(currentResult.input.widthInch * 25.4)} mm W)`
                      : `(${currentResult.input.heightInch}" H × ${currentResult.input.widthInch}" W)`}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {'uPVC ' + (currentResult.input.profileSeries || '60mm') + ' • ' + (currentResult.input.windowType === 'sliding' ? currentResult.input.frameType.toUpperCase().replace('-TRACK', ' TRACK') : (currentResult.input.windowType === 'ventilator' ? 'VENTILATOR (NO TRACK)' : (currentResult.input.windowType === 'fixed' ? 'FIXED (NO TRACK)' : 'OPEN (NO TRACK)')))}
              </span>
            </div>

            {/* Front view / Track toggle */}
            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
              <button
                type="button"
                onClick={() => setActiveTab('elevation')}
                className={
                  'px-2 py-1 rounded transition cursor-pointer ' +
                  (activeTab === 'elevation' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400')
                }
              >
                Front View
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('track_plan')}
                className={
                  'px-2 py-1 rounded transition cursor-pointer ' +
                  (activeTab === 'track_plan' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400')
                }
              >
                Cross-Section
              </button>
            </div>
          </div>

          {/* Blueprint SVG Card */}
          <div className="w-full overflow-hidden flex items-center justify-center rounded-xl border border-slate-800 p-2 bg-slate-950">
            {activeTab === 'elevation' ? (
              <WindowBlueprintSVG result={currentResult} svgRef={svgRef} />
            ) : (
              <div className="w-full py-6 px-3 space-y-3 font-mono text-xs">
                <div className="text-center">
                  <span className="font-bold text-white text-sm">
                    {currentResult.input.windowType === 'sliding'
                      ? (currentResult.input.frameType.toUpperCase().replace('-', ' ') + ' TRACK CROSS-SECTION')
                      : (currentResult.input.windowType.toUpperCase() + ' WINDOW (NO TRACK) SECTION')}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {'Frame Depth: ' + currentResult.frame.profileDepthMM + ' mm | Tracks: ' + (currentResult.frame.trackCount > 0 ? currentResult.frame.trackCount : 'None (No Track)')}
                  </p>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2 max-w-xs mx-auto text-[11px]">
                  {currentResult.input.windowType === 'sliding' ? (
                    <>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">Track 1:</span>
                        <span className="text-slate-200 font-bold">Inner Sliding Panel</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">Track 2:</span>
                        <span className="text-slate-200 font-bold">Outer Sliding Panel</span>
                      </div>
                      {(currentResult.input.frameType === '3-track' || currentResult.input.frameType === '3.5-track') && (
                        <div className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400">Track 3:</span>
                          <span className="text-slate-200 font-bold">3rd Sliding Panel</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">Outer Frame:</span>
                        <span className="text-slate-200 font-bold">uPVC 50mm Chamber</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">Mullion / Stile:</span>
                        <span className="text-slate-200 font-bold">Center 2-Shutter Divide</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Summary Badges below drawing */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-mono text-slate-300">
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block font-sans">{t('வெளி பிரேம் (Frame)', 'Outer Frame')}</span>
              <span className="font-bold text-white">{currentResult.convertedHeightMM + ' × ' + currentResult.convertedWidthMM + ' mm'}</span>
            </div>
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block font-sans">{t('சஷ் அளவு (Sash)', 'Sash Size')}</span>
              <span className="font-bold text-emerald-400">
                {currentResult.input.windowType === 'ventilator' ? '-' : (currentResult.panel.heightMM + ' × ' + currentResult.panel.widthMM + ' mm')}
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block font-sans">{t('கண்ணாடி (Glass)', 'Glass Size')}</span>
              <span className="font-bold text-blue-300">
                {currentResult.input.windowType === 'ventilator' ? '-' : (currentResult.mirror.heightMM + ' × ' + currentResult.mirror.widthMM + ' mm')}
              </span>
            </div>
          </div>

          {/* Single Window Navigation */}
          <div className="flex items-center justify-between pt-1 gap-2">
            <button
              type="button"
              disabled={selectedIndex === 0}
              onClick={() => onSelectIndex(Math.max(0, selectedIndex - 1))}
              className={
                'min-h-[40px] px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer touch-manipulation flex items-center space-x-1 min-w-0 ' +
                (selectedIndex === 0
                  ? 'opacity-30 border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-300 border-slate-700 active:scale-95')
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
                  : 'bg-slate-800 text-slate-300 border-slate-700 active:scale-95')
              }
            >
              <span className="max-w-[60px] sm:max-w-[100px] truncate">
                {'W' + (selectedIndex + 2)}
              </span>
              <span>➔</span>
            </button>
          </div>
        </div>
      ) : (
        /* ALL WINDOWS GALLERY VIEW */
        <div className="space-y-3 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.map((r, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSelectIndex(idx);
                  setViewMode('single');
                }}
                className="bg-slate-950 rounded-xl p-2.5 border border-slate-800 hover:border-blue-500/50 transition cursor-pointer space-y-1.5 touch-manipulation active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white max-w-[150px] truncate" title={'W' + (idx + 1)}>
                    {'W' + (idx + 1)}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {r.convertedHeightMM + ' × ' + r.convertedWidthMM + ' mm'}
                  </span>
                </div>

                <div className="h-44 flex items-center justify-center bg-slate-900/50 rounded-lg p-1 border border-slate-850">
                  <WindowBlueprintSVG result={r} />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                  <span>
                    {r.input.unit === 'cm'
                      ? `${r.input.heightCm ?? Number((r.input.heightInch * 2.54).toFixed(1))} cm H × ${r.input.widthCm ?? Number((r.input.widthInch * 2.54).toFixed(1))} cm W • ${r.input.frameType.toUpperCase()}`
                      : r.input.unit === 'mm'
                        ? `${r.input.heightMM ?? Math.round(r.input.heightInch * 25.4)} mm H × ${r.input.widthMM ?? Math.round(r.input.widthInch * 25.4)} mm W • ${r.input.frameType.toUpperCase()}`
                        : `${r.input.heightInch}" H × ${r.input.widthInch}" W • ${r.input.frameType.toUpperCase()}`}
                  </span>
                  <span className="text-blue-400 font-bold">{t('பெரிதாக்கு (Zoom) ➔', 'Enlarge ➔')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. BOTTOM ACTION BUTTONS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 flex-shrink-0">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={handleDownloadAllPDF}
            disabled={isExportingPDF}
            className="min-h-[44px] w-full py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-1.5 border border-slate-700 transition cursor-pointer touch-manipulation disabled:opacity-50"
            title={`Export all ${results.length} window drawings into a single multi-page PDF`}
          >
            <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>
              {isExportingPDF && exportProgress
                ? `${t('தயாராகிறது', 'Generating')} (${exportProgress.current}/${exportProgress.total})...`
                : isExportingPDF
                  ? t('தயாராகிறது...', 'Generating...')
                  : t(`2D வரைபடங்கள் PDF (${results.length} ஜன்னல்கள்)`, `2D Blueprints PDF (${results.length} Windows in 1 PDF)`)}
            </span>
          </button>
          {results.length > 1 && (
            <button
              type="button"
              onClick={handleDownloadSinglePDF}
              disabled={isExportingPDF}
              className="text-[11px] text-slate-400 hover:text-sky-300 py-0.5 text-center transition cursor-pointer underline underline-offset-2 disabled:opacity-50"
            >
              {t(`தனி W${selectedIndex + 1} வரைபடம் PDF மட்டும்`, `Download Single W${selectedIndex + 1} PDF only`)}
            </button>
          )}
        </div>

        <div className="flex flex-col">
          <button
            type="button"
            onClick={onExportLSInteriorsPDF || onExportPDF}
            className="min-h-[44px] w-full py-3 px-3 rounded-xl bg-blue-700 hover:bg-blue-600 active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-1.5 border border-blue-500 shadow-md transition cursor-pointer touch-manipulation"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-200 flex-shrink-0" />
            <span>L.S. Interiors PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Reusable Window Blueprint SVG Component
 */
export const WindowBlueprintSVG: React.FC<{
  result: CalculationResult;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  isTamil?: boolean;
}> = ({ result, svgRef, isTamil: isTamilProp }) => {
  let contextIsTamil = false;
  try {
    const lang = useLanguage();
    contextIsTamil = lang.isTamil;
  } catch {
    contextIsTamil = false;
  }
  const isTamil = isTamilProp !== undefined ? isTamilProp : contextIsTamil;
  const { input, convertedWidthMM, convertedHeightMM, panel, mirror } = result;

  const svgWidth = 520;
  const svgHeight = 350;

  const marginTop = 42;
  const marginBottom = 44;
  const marginLeft = 58;
  const marginRight = 58;

  const drawAreaW = svgWidth - marginLeft - marginRight;
  const drawAreaH = svgHeight - marginTop - marginBottom;

  const ratio = convertedWidthMM / Math.max(1, convertedHeightMM);
  let frameW = drawAreaW;
  let frameH = drawAreaW / ratio;

  if (frameH > drawAreaH) {
    frameH = drawAreaH;
    frameW = drawAreaH * ratio;
  }

  frameW = Math.max(160, frameW);
  frameH = Math.max(140, frameH);

  const startX = marginLeft + (drawAreaW - frameW) / 2;
  const startY = marginTop + (drawAreaH - frameH) / 2;

  const outerProfileThick = Math.max(7, Math.min(11, frameW * 0.035));
  const innerW = frameW - 2 * outerProfileThick;
  const innerH = frameH - 2 * outerProfileThick;
  const innerX = startX + outerProfileThick;
  const innerY = startY + outerProfileThick;

  const pCount = panel.count;
  const sashW = innerW / pCount;
  const markerId = 'arrow-' + result.id;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={svgWidth}
      height={svgHeight}
      ref={svgRef}
      viewBox={'0 0 ' + svgWidth + ' ' + svgHeight}
      className="w-full h-auto max-h-[320px] select-none"
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 2 L 10 5 L 0 8 z" fill="#94a3b8" />
        </marker>
      </defs>

      {/* 1. TOP DIMENSION: WIDTH */}
      <g>
        <line x1={startX} y1={startY - 4} x2={startX} y2={startY - 22} stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
        <line x1={startX + frameW} y1={startY - 4} x2={startX + frameW} y2={startY - 22} stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
        <line
          x1={startX + 3}
          y1={startY - 16}
          x2={startX + frameW - 3}
          y2={startY - 16}
          stroke="#94a3b8"
          strokeWidth="1.2"
          markerStart={'url(#' + markerId + ')'}
          markerEnd={'url(#' + markerId + ')'}
        />
        <rect x={startX + frameW / 2 - 45} y={startY - 24} width="90" height="16" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1" />
        <text x={startX + frameW / 2} y={startY - 13} fill="#f8fafc" fontSize="9" fontWeight="bold" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
          {convertedWidthMM + ' mm (' + (input.unit === 'cm' ? `${input.widthCm ?? Number((input.widthInch * 2.54).toFixed(1))} cm` : input.unit === 'mm' ? `${input.widthMM ?? Math.round(input.widthInch * 25.4)} mm` : `${input.widthInch}"`) + ')'}
        </text>
      </g>

      {/* 2. LEFT DIMENSION: HEIGHT */}
      <g>
        <line x1={startX - 4} y1={startY} x2={startX - 22} y2={startY} stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
        <line x1={startX - 4} y1={startY + frameH} x2={startX - 22} y2={startY + frameH} stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
        <line
          x1={startX - 16}
          y1={startY + 3}
          x2={startX - 16}
          y2={startY + frameH - 3}
          stroke="#94a3b8"
          strokeWidth="1.2"
          markerStart={'url(#' + markerId + ')'}
          markerEnd={'url(#' + markerId + ')'}
        />
        <g transform={'translate(' + (startX - 24) + ', ' + (startY + frameH / 2) + ') rotate(-90)'}>
          <rect x="-45" y="-8" width="90" height="16" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1" />
          <text x="0" y="3" fill="#f8fafc" fontSize="9" fontWeight="bold" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
            {convertedHeightMM + ' mm (' + (input.unit === 'cm' ? `${input.heightCm ?? Number((input.heightInch * 2.54).toFixed(1))} cm` : input.unit === 'mm' ? `${input.heightMM ?? Math.round(input.heightInch * 25.4)} mm` : `${input.heightInch}"`) + ')'}
          </text>
        </g>
      </g>

      {/* 3. OUTER UPVC FRAME */}
      <rect x={startX} y={startY} width={frameW} height={frameH} fill="#334155" stroke="#94a3b8" strokeWidth="1.5" rx="1" />

      {/* 45° Welded Mitre Corner Lines */}
      <line x1={startX} y1={startY} x2={innerX} y2={innerY} stroke="#cbd5e1" strokeWidth="1" />
      <line x1={startX + frameW} y1={startY} x2={innerX + innerW} y2={innerY} stroke="#cbd5e1" strokeWidth="1" />
      <line x1={startX} y1={startY + frameH} x2={innerX} y2={innerY + innerH} stroke="#cbd5e1" strokeWidth="1" />
      <line x1={startX + frameW} y1={startY + frameH} x2={innerX + innerW} y2={innerY + innerH} stroke="#cbd5e1" strokeWidth="1" />

      {/* Inner Daylight Opening */}
      <rect x={innerX} y={innerY} width={innerW} height={innerH} fill="#090d16" />

      {/* 4. SASHES / SHUTTERS OR DIRECT FIXED GLAZING */}
      {pCount > 0 ? (
        <>
          {Array.from({ length: pCount }).map((_, idx) => {
            const sX = innerX + idx * sashW;
            const sashProfileThick = Math.max(5, Math.min(8, sashW * 0.05));
            const glassX = sX + sashProfileThick + 2;
            const glassY = innerY + sashProfileThick + 2;
            const glassW = Math.max(10, sashW - 2 * sashProfileThick - 4);
            const glassH = Math.max(10, innerH - 2 * sashProfileThick - 4);

            return (
              <g key={idx}>
                <rect x={sX + 2} y={innerY + 2} width={sashW - 4} height={innerH - 4} fill="#1e293b" stroke="#38bdf8" strokeWidth="1.2" rx="1" />
                <rect x={glassX} y={glassY} width={glassW} height={glassH} fill="#0284c7" fillOpacity="0.25" stroke="#0ea5e9" strokeWidth="0.8" />
                <rect x={glassX + glassW / 2 - 35} y={glassY + glassH / 2 - 12} width="70" height="24" rx="3" fill="#0f172a" fillOpacity="0.85" stroke="#38bdf8" strokeWidth="0.75" />
                <text x={glassX + glassW / 2} y={glassY + glassH / 2 - 1} fill="#38bdf8" fontSize="7.5" fontWeight="bold" fontFamily={isTamil ? "Noto Sans Tamil, sans-serif" : "Inter, sans-serif"} textAnchor="middle">
                  {(isTamil ? 'சஷ் ' : 'Sash ') + (idx + 1)}
                </text>
                <text x={glassX + glassW / 2} y={glassY + glassH / 2 + 8} fill="#ffffff" fontSize="7.5" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
                  {panel.heightMM + '×' + panel.widthMM}
                </text>
              </g>
            );
          })}

          {/* Central Mullion Profile Divider (if present in double casement) */}
          {result.frame.mullionCutMM && (
            <g>
              <rect
                x={innerX + sashW - 3}
                y={innerY}
                width={6}
                height={innerH}
                fill="#475569"
                stroke="#64748b"
                strokeWidth="1"
              />
              <rect x={innerX + sashW - 22} y={innerY + 10} width="44" height="14" rx="2" fill="#0f172a" stroke="#64748b" strokeWidth="0.5" />
              <text x={innerX + sashW} y={innerY + 20} fill="#94a3b8" fontSize="6.5" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
                {'M:' + result.frame.mullionCutMM}
              </text>
            </g>
          )}
        </>
      ) : input.windowType === 'ventilator' ? (
        <g>
          {input.ventilatorSubtype === 'fan' ? (
            (() => {
              const isRight = input.ventilatorFanSide === 'right';
              const halfW = innerW / 2;
              const dividerX = innerX + halfW;
              const fanX = isRight ? dividerX : innerX;
              const louverX = isRight ? innerX : dividerX;
              const fanCenterX = fanX + halfW / 2;
              const fanCenterY = innerY + innerH / 2;
              const fanRadius = Math.max(16, Math.min(halfW / 2 - 10, innerH / 2 - 10));

              return (
                <g>
                  {/* Center Vertical Divider Mullion */}
                  <line x1={dividerX} y1={innerY} x2={dividerX} y2={innerY + innerH} stroke="#475569" strokeWidth="2.5" />

                  {/* Louver Section: Horizontal Louver Slats */}
                  {[1, 2, 3, 4, 5].map((i) => {
                    const ly = innerY + (innerH / 6) * i;
                    return (
                      <line
                        key={i}
                        x1={louverX + 6}
                        y1={ly}
                        x2={louverX + halfW - 6}
                        y2={ly}
                        stroke="#64748b"
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                      />
                    );
                  })}
                  <text
                    x={louverX + halfW / 2}
                    y={innerY + innerH / 2}
                    fill="#94a3b8"
                    fontSize="7.5"
                    fontWeight="bold"
                    fontFamily={isTamil ? "Noto Sans Tamil, sans-serif" : "Inter, sans-serif"}
                    textAnchor="middle"
                  >
                    {isTamil ? 'லூவர்ஸ் (Louvers)' : 'Louvers'}
                  </text>

                  {/* Fan Section: Circular Exhaust Fan Opening */}
                  <circle
                    cx={fanCenterX}
                    cy={fanCenterY}
                    r={fanRadius}
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="1.8"
                  />
                  <line
                    x1={fanCenterX - fanRadius + 4}
                    y1={fanCenterY}
                    x2={fanCenterX + fanRadius - 4}
                    y2={fanCenterY}
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                  />
                  <line
                    x1={fanCenterX}
                    y1={fanCenterY - fanRadius + 4}
                    x2={fanCenterX}
                    y2={fanCenterY + fanRadius - 4}
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                  />
                  <circle cx={fanCenterX} cy={fanCenterY} r={Math.max(4, fanRadius * 0.28)} fill="#38bdf8" />
                  <text
                    x={fanCenterX}
                    y={fanCenterY + fanRadius + 11}
                    fill="#38bdf8"
                    fontSize="7"
                    fontWeight="bold"
                    fontFamily="Noto Sans Tamil, sans-serif"
                    textAnchor="middle"
                  >
                    {isRight ? 'Exhaust Fan (R)' : 'Exhaust Fan (Left)'}
                  </text>
                </g>
              );
            })()
          ) : (
            <g>
              {/* Normal Ventilator: Full Width Louvers */}
              {[1, 2, 3, 4, 5, 6].map((i) => {
                const ly = innerY + (innerH / 7) * i;
                return (
                  <line
                    key={i}
                    x1={innerX + 8}
                    y1={ly}
                    x2={innerX + innerW - 8}
                    y2={ly}
                    stroke="#64748b"
                    strokeWidth="1.8"
                    strokeDasharray="4 3"
                  />
                );
              })}
              <rect
                x={innerX + innerW / 2 - 70}
                y={innerY + innerH / 2 - 12}
                width="140"
                height="24"
                rx="3"
                fill="#0f172a"
                fillOpacity="0.85"
                stroke="#38bdf8"
                strokeWidth="0.8"
              />
              <text
                x={innerX + innerW / 2}
                y={innerY + innerH / 2 + 3}
                fill="#38bdf8"
                fontSize="8"
                fontWeight="bold"
                fontFamily={isTamil ? "Noto Sans Tamil, sans-serif" : "Inter, sans-serif"}
                textAnchor="middle"
              >
                {isTamil ? 'வென்டிலேட்டர் (Normal Louvers)' : 'Normal Louvers'}
              </text>
            </g>
          )}
        </g>
      ) : (
        <g>
          {/* Direct Frame Fixed Glazing (OU - 96mm) */}
          <rect x={innerX + 4} y={innerY + 4} width={innerW - 8} height={innerH - 8} fill="#0284c7" fillOpacity="0.25" stroke="#0ea5e9" strokeWidth="1.2" />
          <rect x={innerX + innerW / 2 - 65} y={innerY + innerH / 2 - 14} width="130" height="28" rx="3" fill="#0f172a" fillOpacity="0.9" stroke="#38bdf8" strokeWidth="0.8" />
          <text x={innerX + innerW / 2} y={innerY + innerH / 2 - 1} fill="#38bdf8" fontSize="8" fontWeight="bold" fontFamily={isTamil ? "Noto Sans Tamil, sans-serif" : "Inter, sans-serif"} textAnchor="middle">
            {isTamil ? 'நேரடி கிளேசிங் (Fixed Glass)' : 'Fixed Glazing (Direct)'}
          </text>
          <text x={innerX + innerW / 2} y={innerY + innerH / 2 + 10} fill="#ffffff" fontSize="8" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
            {mirror.heightMM + ' × ' + mirror.widthMM + ' mm'}
          </text>
        </g>
      )}

      {/* 5. BOTTOM GLASS SUMMARY */}
      <g>
        <rect x={startX + frameW / 2 - 120} y={startY + frameH + 8} width="240" height="20" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1" />
        <text x={startX + frameW / 2} y={startY + frameH + 21} fill="#cbd5e1" fontSize="8.5" fontFamily={isTamil ? "Noto Sans Tamil, monospace" : "Inter, monospace"} fontWeight="bold" textAnchor="middle">
          {input.windowType === 'ventilator'
            ? (isTamil ? 'வென்டிலேட்டர்: ' : 'Ventilator: ') + convertedHeightMM + ' × ' + convertedWidthMM + ' mm' + (isTamil ? ' (வெளி பிரேம்)' : ' (Outer Frame)')
            : (isTamil ? 'கண்ணாடி: ' : 'Glass: ') + mirror.heightMM + ' × ' + mirror.widthMM + ' mm (' + mirror.count + ' Panels)'}
        </text>
      </g>
    </svg>
  );
};
