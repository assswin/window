import React, { useState, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';
import { CalculationResult } from '../engine/types';
import { getLSModelName } from '../utils/lsInteriorsSheetCanvas';
import { 
  Download, 
  Eye, 
  FileText, 
  FileSpreadsheet, 
  Layers, 
  Maximize2, 
  Sun, 
  Moon, 
  Grid3X3, 
  Columns, 
  SplitSquareVertical, 
  SplitSquareHorizontal,
  Compass
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export type CadViewMode = 'all_in_one' | 'elevation' | 'section_a' | 'section_b';
export type CadTheme = 'white' | 'blueprint';

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
  const [cadView, setCadView] = useState<CadViewMode>('all_in_one');
  const [cadTheme, setCadTheme] = useState<CadTheme>('white');
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
        const svgString = renderToStaticMarkup(
          <WindowBlueprintSVG 
            result={result} 
            isTamil={isTamil} 
            activeCadView="all_in_one" 
            cadTheme={cadTheme} 
          />
        );
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);
        const image = new Image();

        image.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 2400;
            canvas.height = 1600;
            const context = canvas.getContext('2d');
            if (context) {
              context.fillStyle = cadTheme === 'white' ? '#ffffff' : '#090d16';
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
    const isWhite = cadTheme === 'white';
    // 1. Page background (A4 Landscape: 297 × 210 mm)
    doc.setFillColor(isWhite ? 255 : 9, isWhite ? 255 : 13, isWhite ? 255 : 22);
    doc.rect(0, 0, 297, 210, 'F');

    // 2. Outer Technical Border
    doc.setDrawColor(isWhite ? 30 : 30, isWhite ? 41 : 58, isWhite ? 59 : 138);
    doc.setLineWidth(0.6);
    doc.rect(6, 6, 285, 198);

    // Row 1 (y = 13 mm): Header Title & Site Dimensions (Zero Overlap)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(isWhite ? 15 : 255, isWhite ? 23 : 255, isWhite ? 42 : 255);
    doc.text('L.S. INTERIORS — 2D ARCHITECTURAL CAD BLUEPRINT', 12, 13);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(isWhite ? 15 : 248, isWhite ? 23 : 250, isWhite ? 42 : 252);
    const siteDim = `Site: ${result.input.widthInch}" W × ${result.input.heightInch}" H (${result.convertedWidthMM} × ${result.convertedHeightMM} mm)`;
    doc.text(siteDim, 285, 13, { align: 'right' });

    // Row 2 (y = 18 mm): Window Label & Model Name (Left) + Drawing Count (Right)
    const winLabel = result.input.windowLabel || `Window ${index + 1}`;
    const modelName = getLSModelName(result);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(isWhite ? 2 : 56, isWhite ? 132 : 189, isWhite ? 199 : 248);
    doc.text(`${winLabel} • ${modelName}`, 12, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(isWhite ? 2 : 56, isWhite ? 132 : 189, isWhite ? 199 : 248);
    doc.text(`Drawing ${index + 1} of ${total}`, 285, 18, { align: 'right' });

    // Row 3 (y = 23 mm): Complete Fabrication Cuts Row
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(isWhite ? 80 : 160, isWhite ? 95 : 175, isWhite ? 115 : 195);
    const material = result.input.profileSeries || (result.input.windowType === 'sliding' ? '58mm' : '60mm');
    const frameCut = `Frame: ${result.frame.leftRightCutMM}H × ${result.frame.topBottomCutMM}W`;
    const sashCut = result.panel.heightMM > 0
      ? `Sash: ${result.panel.heightMM}H × ${result.panel.widthMM}W`
      : 'Sash: Direct';
    const glassCut = result.mirror && result.mirror.count > 0
      ? `Glass: ${result.mirror.heightMM}H × ${result.mirror.widthMM}W`
      : 'Glass: -';
    const meshCut = result.additionalPanels?.[0]
      ? `  |  Mesh: ${result.additionalPanels[0].heightMM}H × ${result.additionalPanels[0].widthMM}W`
      : '';
    const mullionCut = (result.input.windowType === 'open' && (result.input.casementSubtype === 'double' || result.input.casementSubtype === 'triple'))
      ? `  |  Mullion: ${result.mullionMM || result.frame.mullionCutMM || (result.convertedHeightMM - 6)} mm`
      : '';
    doc.text(`Material: ${material}  |  ${frameCut}  |  ${sashCut}  |  ${glassCut}${meshCut}${mullionCut}`, 12, 23);

    // High-Resolution Blueprint Image (Cleanly bounded from y=26 to y=194)
    doc.addImage(imgData, 'JPEG', 10, 26, 277, 168);

    // Footer divider & notes (y = 196.5 mm)
    doc.setDrawColor(isWhite ? 226 : 30, isWhite ? 232 : 41, isWhite ? 240 : 59);
    doc.setLineWidth(0.3);
    doc.line(10, 196.5, 285, 196.5);

    doc.setFontSize(6.8);
    doc.setTextColor(isWhite ? 100 : 100, isWhite ? 116 : 116, isWhite ? 139 : 139);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-GB')} • WindowBuilder Pro (L.S. Interiors)`, 12, 200.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isWhite ? 2 : 56, isWhite ? 132 : 189, isWhite ? 199 : 248);
    doc.text(`Drawing ${index + 1} of ${total} • Architectural CAD Blueprint`, 148.5, 200.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(isWhite ? 100 : 100, isWhite ? 116 : 116, isWhite ? 139 : 139);
    doc.text(`Authorized Workshop CAD • ${total} Windows`, 285, 200.5, { align: 'right' });
  };

  /**
   * Export ALL input windows in a single multi-page PDF
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
        ? `LS_Interiors_Window_1_2D_CAD.pdf`
        : `LS_Interiors_All_${results.length}_Windows_2D_CAD.pdf`;
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
      doc.save(`LS_Interiors_${winLabel}_2D_CAD.pdf`);
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
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 flex-shrink-0 flex-wrap gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>{t(`3. ${results.length} ஜன்னல் 2D வரைபடங்கள் (CAD)`, `3. ${results.length} Windows 2D CAD Blueprints`)}</span>
              <span className="text-[10px] bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/40 font-mono font-bold">
                PRO CAD
              </span>
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {t(
              'எலிவேஷன் & செக்ஷன் A-A, B-B குறுக்குவெட்டு வரைபடங்கள்',
              'Elevation & Cross-Sections (Section A-A & Section B-B) Architectural CAD'
            )}
          </p>
        </div>

        {/* View Controls: Theme & Single/Gallery */}
        <div className="flex items-center space-x-2">
          {/* Theme switch (White CAD vs Blueprint Dark) */}
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
            <button
              type="button"
              onClick={() => setCadTheme('white')}
              className={
                'px-2 py-1 rounded transition cursor-pointer flex items-center space-x-1 ' +
                (cadTheme === 'white'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white')
              }
              title="Architectural White CAD (Clean Paper White, like AutoCAD)"
            >
              <Sun className="w-3 h-3" />
              <span>CAD White</span>
            </button>
            <button
              type="button"
              onClick={() => setCadTheme('blueprint')}
              className={
                'px-2 py-1 rounded transition cursor-pointer flex items-center space-x-1 ' +
                (cadTheme === 'blueprint'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white')
              }
              title="Blueprint Navy (Classic Dark CAD)"
            >
              <Moon className="w-3 h-3" />
              <span>Blueprint</span>
            </button>
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
              {t('தனி (Active)', 'Single')}
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
              {t(`அனைத்தும் (${results.length})`, `All (${results.length})`)}
            </button>
          </div>
        </div>
      </div>

      {/* 2. TOP 10 WINDOW SELECTOR PILLS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0 no-scrollbar">
        {results.map((r, idx) => {
          const isSelected = selectedIndex === idx;
          const label = r.input?.windowLabel || r.id || ('W' + (idx + 1));
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
                  ? 'bg-blue-600 border-blue-400 text-white shadow-xs'
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
          {/* Active window banner with Architectural CAD View Switcher */}
          <div className="bg-slate-950/90 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-bold text-white">
                  {currentResult.input?.windowLabel || currentResult.id || ('W' + (selectedIndex + 1))}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {currentResult.convertedHeightMM + ' × ' + currentResult.convertedWidthMM + ' mm'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {currentResult.input.unit === 'cm'
                    ? `(${currentResult.input.heightCm ?? Number((currentResult.input.heightInch * 2.54).toFixed(1))} cm H × ${currentResult.input.widthCm ?? Number((currentResult.input.widthInch * 2.54).toFixed(1))} cm W)`
                    : currentResult.input.unit === 'mm'
                      ? `(${currentResult.input.heightMM ?? Math.round(currentResult.input.heightInch * 25.4)} mm H × ${currentResult.input.widthMM ?? Math.round(currentResult.input.widthInch * 25.4)} mm W)`
                      : `(${currentResult.input.heightInch}" H × ${currentResult.input.widthInch}" W)`}
                </span>
              </div>
              <span className="text-[10px] text-blue-300 block mt-0.5">
                {'uPVC ' + (currentResult.input.profileSeries || '60mm') + ' • ' + (
                  currentResult.input.windowType === 'sliding' 
                    ? (currentResult.input.profileSeries === '85mm' 
                        ? (currentResult.input.frameType === '2.5-track' ? '2.5T SLIDING DOOR (MESH)' : ((currentResult.input.frameType === '3-track' || currentResult.input.frameType === '3.5-track') ? '3T SLIDING DOOR' : '2T SLIDING DOOR'))
                        : currentResult.input.frameType.toUpperCase().replace('-TRACK', ' TRACK')) 
                    : (currentResult.input.windowType === 'ventilator' 
                        ? (currentResult.input.ventilatorSubtype === 'fan' ? `VENTILATOR • FAN (${(currentResult.input.ventilatorFanSide || 'left').toUpperCase()})` : 'VENTILATOR • LOUVER')
                        : (currentResult.input.windowType === 'fixed' 
                            ? 'FIXED DIRECT GLAZING' 
                            : (currentResult.input.casementSubtype === 'triple' 
                                ? '3-OPEN CASEMENT (2 MULLIONS)' 
                                : (currentResult.input.casementSubtype === 'double' ? 'DOUBLE CASEMENT (MULLION)' : 'SINGLE CASEMENT'))))
                )}
              </span>
            </div>

            {/* Architectural CAD View Selection Pills */}
            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] flex-wrap gap-0.5">
              <button
                type="button"
                onClick={() => setCadView('all_in_one')}
                className={
                  'px-2 py-1 rounded transition cursor-pointer flex items-center space-x-1 ' +
                  (cadView === 'all_in_one' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white')
                }
                title="All-in-One Sheet: Elevation + Section A-A + Section B-B"
              >
                <Grid3X3 className="w-3 h-3" />
                <span>All-in-One CAD</span>
              </button>
              <button
                type="button"
                onClick={() => setCadView('elevation')}
                className={
                  'px-2 py-1 rounded transition cursor-pointer flex items-center space-x-1 ' +
                  (cadView === 'elevation' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white')
                }
                title="Front Elevation View"
              >
                <Columns className="w-3 h-3" />
                <span>Elevation</span>
              </button>
              <button
                type="button"
                onClick={() => setCadView('section_a')}
                className={
                  'px-2 py-1 rounded transition cursor-pointer flex items-center space-x-1 ' +
                  (cadView === 'section_a' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white')
                }
                title="Section A-A: Horizontal Plan Cross-Section"
              >
                <SplitSquareHorizontal className="w-3 h-3" />
                <span>Section A-A (Plan)</span>
              </button>
              <button
                type="button"
                onClick={() => setCadView('section_b')}
                className={
                  'px-2 py-1 rounded transition cursor-pointer flex items-center space-x-1 ' +
                  (cadView === 'section_b' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white')
                }
                title="Section B-B: Vertical Cross-Section"
              >
                <SplitSquareVertical className="w-3 h-3" />
                <span>Section B-B (Vertical)</span>
              </button>
            </div>
          </div>

          {/* Blueprint SVG Card */}
          <div className={'w-full overflow-hidden flex items-center justify-center rounded-xl border border-slate-800 p-2 sm:p-3 transition-colors ' + (cadTheme === 'white' ? 'bg-white shadow-inner' : 'bg-slate-950')}>
            <WindowBlueprintSVG 
              result={currentResult} 
              svgRef={svgRef} 
              activeCadView={cadView}
              cadTheme={cadTheme}
              isTamil={isTamil}
            />
          </div>

          {/* Summary Badges below drawing */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-mono text-slate-300">
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block font-sans">{t('வெளி பிரேம் (Frame Cut)', 'Outer Frame 45°')}</span>
              <span className="font-bold text-white">{currentResult.convertedHeightMM + ' × ' + currentResult.convertedWidthMM + ' mm'}</span>
            </div>
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block font-sans">{t('சஷ் அளவு (Sash Cut)', 'Sash Cut')}</span>
              <span className="font-bold text-emerald-400">
                {currentResult.input.windowType === 'ventilator' || currentResult.input.windowType === 'fixed'
                  ? '-' 
                  : (currentResult.panel.heightMM + ' × ' + currentResult.panel.widthMM + ' mm')}
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block font-sans">{t('கண்ணாடி (Glass Cut)', 'Glass Cut')}</span>
              <span className="font-bold text-sky-400">
                {currentResult.input.windowType === 'ventilator' ? '-' : (currentResult.mirror.heightMM + ' × ' + currentResult.mirror.widthMM + ' mm')}
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block font-sans">
                {currentResult.input.windowType === 'open' && (currentResult.input.casementSubtype === 'double' || currentResult.input.casementSubtype === 'triple')
                  ? t('முல்லியன் (Mullion Cut)', 'Mullion Cut')
                  : currentResult.input.windowType === 'fixed'
                    ? t('கிளேசிங் பீட் (Glazing Bead)', 'Glazing Bead')
                    : currentResult.input.windowType === 'ventilator'
                      ? t('காற்றோட்டம் (Air Aperture)', 'Airflow Aperture')
                      : t('கொசுவலை (Mesh Sash)', 'Mosquito Mesh')}
              </span>
              <span className="font-bold text-amber-400">
                {currentResult.input.windowType === 'open' && (currentResult.input.casementSubtype === 'double' || currentResult.input.casementSubtype === 'triple')
                  ? `${currentResult.mullionMM || currentResult.frame.mullionCutMM || (currentResult.convertedHeightMM - 6)} mm (${currentResult.input.casementSubtype === 'triple' ? '2 Pcs' : '1 Pc'})`
                  : currentResult.input.windowType === 'fixed'
                    ? `45° Mitre (${(currentResult.mirror.heightMM * 2 + currentResult.mirror.widthMM * 2)} mm)`
                    : currentResult.input.windowType === 'ventilator'
                      ? `${currentResult.convertedHeightMM - 88} × ${currentResult.convertedWidthMM - 88} mm`
                      : (currentResult.additionalPanels?.[0] ? `${currentResult.additionalPanels[0].heightMM} × ${currentResult.additionalPanels[0].widthMM} mm` : '-')}
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
                {selectedIndex > 0 ? (results[selectedIndex - 1]?.input?.windowLabel || results[selectedIndex - 1]?.id || `W${selectedIndex}`) : `W${selectedIndex}`}
              </span>
            </button>
            <span className="text-xs text-slate-300 font-mono font-bold text-center px-1 truncate min-w-0">
              {`${currentResult.input?.windowLabel || currentResult.id || ('W' + (selectedIndex + 1))} (${selectedIndex + 1}/${results.length})`}
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
                {selectedIndex < results.length - 1 ? (results[selectedIndex + 1]?.input?.windowLabel || results[selectedIndex + 1]?.id || `W${selectedIndex + 2}`) : `W${selectedIndex + 2}`}
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
                  <span className="text-xs font-bold text-white max-w-[150px] truncate" title={r.input?.windowLabel || r.id || ('W' + (idx + 1))}>
                    {r.input?.windowLabel || r.id || ('W' + (idx + 1))}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {r.convertedHeightMM + ' × ' + r.convertedWidthMM + ' mm'}
                  </span>
                </div>

                <div className={'h-52 flex items-center justify-center rounded-lg p-1 border border-slate-800 overflow-hidden ' + (cadTheme === 'white' ? 'bg-white' : 'bg-slate-900/60')}>
                  <WindowBlueprintSVG result={r} activeCadView="all_in_one" cadTheme={cadTheme} isTamil={isTamil} />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                  <span className="truncate max-w-[200px]">
                    {r.input.unit === 'cm'
                      ? `${r.input.heightCm ?? Number((r.input.heightInch * 2.54).toFixed(1))}cm × ${r.input.widthCm ?? Number((r.input.widthInch * 2.54).toFixed(1))}cm • ${r.input.frameType}`
                      : `${r.input.heightInch}" × ${r.input.widthInch}" • ${r.input.frameType}`}
                  </span>
                  <span className="text-blue-400 font-bold flex-shrink-0">{t('பெரிதாக்கு (Zoom) ➔', 'Enlarge ➔')}</span>
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
                  : t(`2D CAD வரைபடங்கள் PDF (${results.length} ஜன்னல்கள்)`, `2D CAD Blueprints PDF (${results.length} Windows)`)}
            </span>
          </button>
          {results.length > 1 && (
            <button
              type="button"
              onClick={handleDownloadSinglePDF}
              disabled={isExportingPDF}
              className="text-[11px] text-slate-400 hover:text-sky-300 py-0.5 text-center transition cursor-pointer underline underline-offset-2 disabled:opacity-50"
            >
              {t(`தனி W${selectedIndex + 1} CAD PDF மட்டும்`, `Download Single W${selectedIndex + 1} CAD PDF`)}
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
            <span>L.S. Interiors Order Sheet PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * =========================================================================
 * ARCHITECTURAL 2D CAD BLUEPRINT SVG COMPONENT
 * Implements Elevation + Section A-A + Section B-B matching the reference
 * =========================================================================
 */
export const WindowBlueprintSVG: React.FC<{
  result: CalculationResult;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  isTamil?: boolean;
  activeCadView?: CadViewMode;
  cadTheme?: CadTheme;
}> = ({ 
  result, 
  svgRef, 
  isTamil: isTamilProp, 
  activeCadView = 'all_in_one',
  cadTheme = 'white'
}) => {
  let contextIsTamil = false;
  try {
    const lang = useLanguage();
    contextIsTamil = lang.isTamil;
  } catch {
    contextIsTamil = false;
  }
  const isTamil = isTamilProp !== undefined ? isTamilProp : contextIsTamil;
  const { input, convertedWidthMM, convertedHeightMM, panel, mirror, additionalPanels } = result;

  const isWhite = cadTheme === 'white';
  const isAllInOne = activeCadView === 'all_in_one';
  const isElevationOnly = activeCadView === 'elevation';
  const isSectionAOnly = activeCadView === 'section_a';
  const isSectionBOnly = activeCadView === 'section_b';

  // 1. Color Palette Definitions based on CAD Theme
  const c = {
    bg: isWhite ? '#ffffff' : '#0b1329',
    sheetBorder: isWhite ? '#334155' : '#1e3a8a',
    gridLine: isWhite ? '#f1f5f9' : '#0f172a',
    lineDark: isWhite ? '#0f172a' : '#f8fafc',
    lineMedium: isWhite ? '#334155' : '#94a3b8',
    lineLight: isWhite ? '#64748b' : '#64748b',
    profileFill: isWhite ? '#f8fafc' : '#1e293b',
    profileFillDark: isWhite ? '#e2e8f0' : '#0f172a',
    profileStroke: isWhite ? '#0f172a' : '#38bdf8',
    steelFill: isWhite ? '#2563eb' : '#1d4ed8', // Galvanized steel reinforcement
    steelTint: isWhite ? '#dbeafe' : '#1e3a8a',
    glassFill: isWhite ? '#e0f2fe' : '#0369a1',
    glassFillOpacity: isWhite ? 0.65 : 0.35,
    glassStroke: isWhite ? '#0284c7' : '#38bdf8',
    meshPatternColor: isWhite ? '#1e293b' : '#38bdf8',
    meshBg: isWhite ? '#f1f5f9' : '#0f172a',
    sectionLine: '#ef4444', // Red Section line A-A & B-B
    sectionText: '#ef4444',
    dimLine: isWhite ? '#475569' : '#94a3b8',
    dimText: isWhite ? '#0f172a' : '#f8fafc',
    dimBadgeBg: isWhite ? '#ffffff' : '#090d16',
    dimBadgeBorder: isWhite ? '#94a3b8' : '#334155',
    arrowFill: isWhite ? '#2563eb' : '#38bdf8',
    rollerWheel: isWhite ? '#e2e8f0' : '#475569',
    rollerStroke: isWhite ? '#0f172a' : '#f8fafc',
    titleBg: isWhite ? '#f8fafc' : '#0f172a',
    titleBorder: isWhite ? '#cbd5e1' : '#1e3a8a',
    gasket: isWhite ? '#0f172a' : '#38bdf8',
    beadFill: isWhite ? '#f1f5f9' : '#1e293b',
    fanAccent: isWhite ? '#ea580c' : '#fb923c'
  };

  const svgW = 940;
  const svgH = 630;
  const uniqueId = `cad-${result.id || Math.random().toString(36).substring(2, 7)}`;

  // Window System Identification
  const isSliding = input.windowType === 'sliding';
  const isOpen = input.windowType === 'open';
  const isFixed = input.windowType === 'fixed';
  const isVentilator = input.windowType === 'ventilator';
  const isDoor = input.profileSeries === '85mm';
  const isMeshWindow = isSliding && (input.frameType === '2.5-track' || (additionalPanels && additionalPanels.length > 0));

  const casementSubtype = input.casementSubtype || 'single';
  const ventilatorSubtype = input.ventilatorSubtype || 'normal';
  const ventilatorFanSide = input.ventilatorFanSide || 'left';

  // -------------------------------------------------------------
  // CALCULATE PROPORTIONS & GEOMETRY FOR ALL-IN-ONE LAYOUT
  // -------------------------------------------------------------
  const elevMaxW = isElevationOnly ? 720 : 470;
  const elevMaxH = isElevationOnly ? 490 : 380;
  const elevLeft = isElevationOnly ? 110 : 50;
  const elevTop = isElevationOnly ? 70 : 65;

  const aspect = convertedWidthMM / Math.max(1, convertedHeightMM);
  let elevW = elevMaxW;
  let elevH = elevMaxW / aspect;
  if (elevH > elevMaxH) {
    elevH = elevMaxH;
    elevW = elevMaxH * aspect;
  }
  elevW = Math.max(180, Math.min(elevMaxW, elevW));
  elevH = Math.max(160, Math.min(elevMaxH, elevH));

  // Center elevation within its allocated zone
  const actualElevX = elevLeft + (elevMaxW - elevW) / 2;
  const actualElevY = elevTop + (elevMaxH - elevH) / 2;

  // Frame profiles thicknesses
  const frameThick = Math.max(8, Math.min(14, elevW * 0.038));
  const innerElevX = actualElevX + frameThick;
  const innerElevY = actualElevY + frameThick;
  const innerElevW = elevW - frameThick * 2;
  const innerElevH = elevH - frameThick * 2;

  // Sashes division
  const panelCount = isSliding
    ? Math.max(1, panel.count || (isMeshWindow ? 2 : 2))
    : isOpen
      ? (casementSubtype === 'triple' ? 3 : casementSubtype === 'double' ? 2 : 1)
      : 0;

  const singleSashW = panelCount > 0 ? innerElevW / panelCount : innerElevW;

  // Section Cut Coordinates on Elevation
  const secLineAY = actualElevY + elevH * 0.52; // Horizontal line A-A
  const secLineBX = isSliding
    ? (isMeshWindow 
        ? innerElevX + singleSashW * 1.5 // through mesh panel
        : innerElevX + (panelCount > 1 ? singleSashW * 1.5 : singleSashW * 0.5))
    : isOpen
      ? (casementSubtype === 'double' || casementSubtype === 'triple'
          ? actualElevX + elevW * 0.28 // through left casement sash
          : actualElevX + elevW * 0.5)
      : isVentilator
        ? (ventilatorSubtype === 'fan' ? actualElevX + elevW * 0.72 : actualElevX + elevW * 0.5)
        : actualElevX + elevW * 0.5; // Fixed window

  // -------------------------------------------------------------
  // SECTION B-B (VERTICAL SECTION) GEOMETRY (Top-Right)
  // -------------------------------------------------------------
  const secBX = isSectionBOnly ? 320 : 570;
  const secBW = isSectionBOnly ? 300 : 310;
  const secBY = isSectionBOnly ? 80 : actualElevY;
  const secBH = isSectionBOnly ? 480 : elevH;

  const headProfileH = Math.max(26, frameThick * 2.2);
  const sillProfileH = Math.max(30, frameThick * 2.6);
  const secTopSashH = Math.max(20, frameThick * 1.8);
  const secBotSashH = Math.max(22, frameThick * 2.0);
  const secBreakY = secBY + secBH * 0.5;

  // -------------------------------------------------------------
  // SECTION A-A (HORIZONTAL SECTION) GEOMETRY (Bottom)
  // -------------------------------------------------------------
  const secAX = isSectionAOnly ? 60 : actualElevX;
  const secAW = isSectionAOnly ? 820 : elevW;
  const secAY = isSectionAOnly ? 160 : actualElevY + elevH + 46;
  const secAH = isSectionAOnly ? 300 : 80;
  const jambProfileW = Math.max(26, frameThick * 2.2);
  const midX = secAX + secAW / 2;
  const rightStileX = secAX + secAW - 8 - jambProfileW - 29;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={svgW}
      height={svgH}
      ref={svgRef}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-auto select-none font-sans"
    >
      <defs>
        {/* Diamond Wire Mesh Hatch Pattern */}
        <pattern
          id={`${uniqueId}-diamond-mesh`}
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 0 5 L 5 0 L 10 5 L 5 10 Z"
            fill="none"
            stroke={c.meshPatternColor}
            strokeWidth="0.85"
            strokeOpacity="0.85"
          />
          <path
            d="M 0 0 L 10 10 M 10 0 L 0 10"
            fill="none"
            stroke={c.meshPatternColor}
            strokeWidth="0.65"
            strokeOpacity="0.6"
          />
        </pattern>

        {/* Section Red Cut Arrow Marker */}
        <marker
          id={`${uniqueId}-sec-arrow`}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 2 L 10 5 L 0 8 z" fill={c.sectionLine} />
        </marker>

        {/* Dimension Arrow Marker */}
        <marker
          id={`${uniqueId}-dim-arrow`}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 2 L 10 5 L 0 8 z" fill={c.dimLine} />
        </marker>

        {/* Sliding Direction Blue Arrow Marker */}
        <marker
          id={`${uniqueId}-slide-arrow`}
          viewBox="0 0 12 12"
          refX="6"
          refY="6"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M 1 2 L 11 6 L 1 10 z" fill={c.arrowFill} />
        </marker>
      </defs>

      {/* 0. DRAWING SHEET BACKGROUND & CAD TITLE BLOCK BORDER */}
      <rect x="0" y="0" width={svgW} height={svgH} fill={c.bg} />

      <rect
        x="12"
        y="12"
        width={svgW - 24}
        height={svgH - 24}
        fill="none"
        stroke={c.sheetBorder}
        strokeWidth="1.2"
      />
      <rect
        x="16"
        y="16"
        width={svgW - 32}
        height={svgH - 32}
        fill="none"
        stroke={c.sheetBorder}
        strokeWidth="0.6"
      />

      {/* TOP TITLE BLOCK BANNER */}
      <g>
        <rect
          x="16"
          y="16"
          width={svgW - 32}
          height="34"
          fill={c.titleBg}
          stroke={c.titleBorder}
          strokeWidth="0.8"
        />
        <text
          x="28"
          y="31"
          fill={c.lineDark}
          fontSize="11"
          fontWeight="bold"
          fontFamily="monospace"
          letterSpacing="0.5"
        >
          L.S. INTERIORS • ARCHITECTURAL 2D CAD BLUEPRINT
        </text>
        <text
          x="28"
          y="43"
          fill={c.steelFill}
          fontSize="9.5"
          fontWeight="600"
        >
          {`${result.input.windowLabel || 'Window 1'} • ${getLSModelName(result)}  [${result.convertedHeightMM} × ${result.convertedWidthMM} mm]`}
        </text>

        {/* Top-Right Info in Title Block */}
        <text
          x={svgW - 28}
          y="31"
          fill={c.lineDark}
          fontSize="9.5"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="end"
        >
          {`PROFILE: ${result.input.profileSeries || (isSliding ? '58mm' : '60mm')}  |  SCALE: PROPORTIONAL (NTS)`}
        </text>
        <text
          x={svgW - 28}
          y="43"
          fill={c.lineMedium}
          fontSize="8.5"
          fontFamily="monospace"
          textAnchor="end"
        >
          {isFixed
            ? `Direct Glass: ${mirror.heightMM || '-'}×${mirror.widthMM || '-'} mm  |  Glazing Bead: 45° Mitre`
            : isVentilator
              ? `Type: ${ventilatorSubtype === 'fan' ? `Exhaust Fan (${ventilatorFanSide.toUpperCase()}) + Louvers` : 'Glass Louvers (Airflow)'}  |  Clear: ${convertedHeightMM - 88}×${convertedWidthMM - 88} mm`
              : isOpen
                ? `Sash: ${panel.heightMM || '-'}×${panel.widthMM || '-'} mm  |  Glass: ${mirror.heightMM || '-'}×${mirror.widthMM || '-'} mm${(casementSubtype === 'double' || casementSubtype === 'triple') ? `  |  Mullion: ${result.mullionMM || result.frame.mullionCutMM || (convertedHeightMM - 6)} mm` : ''}`
                : `Sash: ${panel.heightMM || '-'}×${panel.widthMM || '-'} mm  |  Glass: ${mirror.heightMM || '-'}×${mirror.widthMM || '-'} mm${additionalPanels?.[0] ? `  |  Mesh: ${additionalPanels[0].heightMM}×${additionalPanels[0].widthMM} mm` : ''}`}
        </text>
      </g>

      {/* ============================================================= */}
      {/* 1. FRONT ELEVATION VIEW                                      */}
      {/* ============================================================= */}
      {(isAllInOne || isElevationOnly) && (
        <g id="front-elevation-group">
          {/* Subtitle label */}
          <text
            x={actualElevX + elevW / 2}
            y={actualElevY - 26}
            fill={c.lineDark}
            fontSize="10"
            fontWeight="bold"
            letterSpacing="0.8"
            textAnchor="middle"
          >
            {isTamil 
              ? `முகப்பு வரைபடம் (FRONT ELEVATION - ${getLSModelName(result)})` 
              : `FRONT ELEVATION - ${getLSModelName(result)} (OUTSIDE VIEW)`}
          </text>

          {/* OVERALL WIDTH DIMENSION (TOP) */}
          <g>
            <line
              x1={actualElevX}
              y1={actualElevY - 4}
              x2={actualElevX}
              y2={actualElevY - 18}
              stroke={c.dimLine}
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <line
              x1={actualElevX + elevW}
              y1={actualElevY - 4}
              x2={actualElevX + elevW}
              y2={actualElevY - 18}
              stroke={c.dimLine}
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <line
              x1={actualElevX + 4}
              y1={actualElevY - 13}
              x2={actualElevX + elevW - 4}
              y2={actualElevY - 13}
              stroke={c.dimLine}
              strokeWidth="1"
              markerStart={`url(#${uniqueId}-dim-arrow)`}
              markerEnd={`url(#${uniqueId}-dim-arrow)`}
            />
            <rect
              x={actualElevX + elevW / 2 - 45}
              y={actualElevY - 21}
              width="90"
              height="15"
              rx="2"
              fill={c.dimBadgeBg}
              stroke={c.dimBadgeBorder}
              strokeWidth="0.6"
            />
            <text
              x={actualElevX + elevW / 2}
              y={actualElevY - 10}
              fill={c.dimText}
              fontSize="8.5"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {`W: ${convertedWidthMM} mm (${input.widthInch}")`}
            </text>
          </g>

          {/* OVERALL HEIGHT DIMENSION (LEFT) */}
          <g>
            <line
              x1={actualElevX - 4}
              y1={actualElevY}
              x2={actualElevX - 18}
              y2={actualElevY}
              stroke={c.dimLine}
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <line
              x1={actualElevX - 4}
              y1={actualElevY + elevH}
              x2={actualElevX - 18}
              y2={actualElevY + elevH}
              stroke={c.dimLine}
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <line
              x1={actualElevX - 13}
              y1={actualElevY + 4}
              x2={actualElevX - 13}
              y2={actualElevY + elevH - 4}
              stroke={c.dimLine}
              strokeWidth="1"
              markerStart={`url(#${uniqueId}-dim-arrow)`}
              markerEnd={`url(#${uniqueId}-dim-arrow)`}
            />
            <g transform={`translate(${actualElevX - 20}, ${actualElevY + elevH / 2}) rotate(-90)`}>
              <rect
                x="-45"
                y="-7.5"
                width="90"
                height="15"
                rx="2"
                fill={c.dimBadgeBg}
                stroke={c.dimBadgeBorder}
                strokeWidth="0.6"
              />
              <text
                x="0"
                y="3"
                fill={c.dimText}
                fontSize="8.5"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {`H: ${convertedHeightMM} mm (${input.heightInch}")`}
              </text>
            </g>
          </g>

          {/* OUTER UPVC FRAME MITRE BOX */}
          <rect
            x={actualElevX}
            y={actualElevY}
            width={elevW}
            height={elevH}
            fill={c.profileFill}
            stroke={c.profileStroke}
            strokeWidth="1.5"
          />

          {/* 45° Welded Mitre Corner Lines */}
          <line x1={actualElevX} y1={actualElevY} x2={innerElevX} y2={innerElevY} stroke={c.lineMedium} strokeWidth="1" />
          <line x1={actualElevX + elevW} y1={actualElevY} x2={innerElevX + innerElevW} y2={innerElevY} stroke={c.lineMedium} strokeWidth="1" />
          <line x1={actualElevX} y1={actualElevY + elevH} x2={innerElevX} y2={innerElevY + innerElevH} stroke={c.lineMedium} strokeWidth="1" />
          <line x1={actualElevX + elevW} y1={actualElevY + elevH} x2={innerElevX + innerElevW} y2={innerElevY + innerElevH} stroke={c.lineMedium} strokeWidth="1" />

          {/* Inner Frame Chamber boundary */}
          <rect
            x={innerElevX}
            y={innerElevY}
            width={innerElevW}
            height={innerElevH}
            fill={isWhite ? '#f8fafc' : '#070b14'}
            stroke={c.profileStroke}
            strokeWidth="1"
          />

          {/* ========================================================= */}
          {/* SPECIFIC ELEVATION CONTENT BASED ON WINDOW TYPE           */}
          {/* ========================================================= */}
          {isSliding ? (
            /* A. SLIDING WINDOW ELEVATION */
            <g id="elev-sliding-panels">
              {Array.from({ length: panelCount }).map((_, pIdx) => {
                const sX = innerElevX + pIdx * singleSashW;
                const sashProfileThick = Math.max(6, Math.min(10, singleSashW * 0.05));
                const isMeshPanel = isMeshWindow && pIdx === panelCount - 1;

                const gX = sX + sashProfileThick;
                const gY = innerElevY + sashProfileThick;
                const gW = Math.max(10, singleSashW - sashProfileThick * 2);
                const gH = Math.max(10, innerElevH - sashProfileThick * 2);

                return (
                  <g key={`elev-sliding-sash-${pIdx}`}>
                    <rect
                      x={sX + 1}
                      y={innerElevY + 1}
                      width={singleSashW - 2}
                      height={innerElevH - 2}
                      fill={c.profileFillDark}
                      stroke={c.profileStroke}
                      strokeWidth="1.2"
                    />
                    <line x1={sX + 1} y1={innerElevY + 1} x2={gX} y2={gY} stroke={c.lineMedium} strokeWidth="0.8" />
                    <line x1={sX + singleSashW - 1} y1={innerElevY + 1} x2={gX + gW} y2={gY} stroke={c.lineMedium} strokeWidth="0.8" />
                    <line x1={sX + 1} y1={innerElevY + innerElevH - 1} x2={gX} y2={gY + gH} stroke={c.lineMedium} strokeWidth="0.8" />
                    <line x1={sX + singleSashW - 1} y1={innerElevY + innerElevH - 1} x2={gX + gW} y2={gY + gH} stroke={c.lineMedium} strokeWidth="0.8" />

                    {isMeshPanel ? (
                      <g>
                        <rect x={gX} y={gY} width={gW} height={gH} fill={c.meshBg} stroke={c.lineMedium} strokeWidth="0.8" />
                        <rect x={gX} y={gY} width={gW} height={gH} fill={`url(#${uniqueId}-diamond-mesh)`} stroke="none" />
                        <line
                          x1={gX + gW * 0.65}
                          y1={gY + gH * 0.5}
                          x2={gX + gW * 0.35}
                          y2={gY + gH * 0.5}
                          stroke={c.arrowFill}
                          strokeWidth="1.8"
                          markerEnd={`url(#${uniqueId}-slide-arrow)`}
                        />
                        <rect
                          x={gX + gW / 2 - 38}
                          y={gY + gH / 2 - 13}
                          width="76"
                          height="26"
                          rx="3"
                          fill={c.dimBadgeBg}
                          stroke={c.dimBadgeBorder}
                          strokeWidth="0.75"
                          fillOpacity="0.92"
                        />
                        <text x={gX + gW / 2} y={gY + gH / 2 - 2} fill={c.steelFill} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                          {isDoor ? 'DOOR MESH (SS)' : 'MOSQUITO MESH'}
                        </text>
                        <text x={gX + gW / 2} y={gY + gH / 2 + 8} fill={c.lineDark} fontSize="7" fontFamily="monospace" textAnchor="middle">
                          {additionalPanels?.[0] ? `${additionalPanels[0].heightMM}×${additionalPanels[0].widthMM}` : `${panel.heightMM}×${panel.widthMM}`}
                        </text>
                      </g>
                    ) : (
                      <g>
                        <rect x={gX} y={gY} width={gW} height={gH} fill={c.glassFill} fillOpacity={c.glassFillOpacity} stroke={c.glassStroke} strokeWidth="1" />
                        <line x1={gX + 12} y1={gY + 8} x2={gX + 32} y2={gY + 45} stroke="#ffffff" strokeWidth="1" strokeOpacity="0.5" />
                        <line x1={gX + 18} y1={gY + 8} x2={gX + 42} y2={gY + 50} stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.4" />
                        <line
                          x1={gX + gW * 0.35}
                          y1={gY + gH * 0.5}
                          x2={gX + gW * 0.65}
                          y2={gY + gH * 0.5}
                          stroke={c.arrowFill}
                          strokeWidth="1.8"
                          markerEnd={`url(#${uniqueId}-slide-arrow)`}
                        />
                        <rect
                          x={gX + gW / 2 - 38}
                          y={gY + gH / 2 - 13}
                          width="76"
                          height="26"
                          rx="3"
                          fill={c.dimBadgeBg}
                          stroke={c.dimBadgeBorder}
                          strokeWidth="0.75"
                          fillOpacity="0.92"
                        />
                        <text x={gX + gW / 2} y={gY + gH / 2 - 2} fill={c.steelFill} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                          {`${isDoor ? 'DOOR SASH' : 'SASH'} ${pIdx + 1}`}
                        </text>
                        <text x={gX + gW / 2} y={gY + gH / 2 + 8} fill={c.lineDark} fontSize="7" fontFamily="monospace" textAnchor="middle">
                          {`${panel.heightMM}×${panel.widthMM}`}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          ) : isOpen ? (
            /* B. OPEN CASEMENT WINDOW ELEVATION */
            <g id="elev-open-casement">
              {casementSubtype === 'single' ? (
                // B.1 SINGLE OPEN WINDOW
                (() => {
                  const sashThick = Math.max(8, frameThick * 1.1);
                  const gX = innerElevX + sashThick;
                  const gY = innerElevY + sashThick;
                  const gW = innerElevW - sashThick * 2;
                  const gH = innerElevH - sashThick * 2;
                  return (
                    <g>
                      {/* Casement Sash Frame */}
                      <rect
                        x={innerElevX + 2}
                        y={innerElevY + 2}
                        width={innerElevW - 4}
                        height={innerElevH - 4}
                        fill={c.profileFillDark}
                        stroke={c.profileStroke}
                        strokeWidth="1.3"
                      />
                      {/* 45° Mitres */}
                      <line x1={innerElevX + 2} y1={innerElevY + 2} x2={gX} y2={gY} stroke={c.lineMedium} strokeWidth="0.8" />
                      <line x1={innerElevX + innerElevW - 2} y1={innerElevY + 2} x2={gX + gW} y2={gY} stroke={c.lineMedium} strokeWidth="0.8" />
                      <line x1={innerElevX + 2} y1={innerElevY + innerElevH - 2} x2={gX} y2={gY + gH} stroke={c.lineMedium} strokeWidth="0.8" />
                      <line x1={innerElevX + innerElevW - 2} y1={innerElevY + innerElevH - 2} x2={gX + gW} y2={gY + gH} stroke={c.lineMedium} strokeWidth="0.8" />
                      {/* Glass */}
                      <rect x={gX} y={gY} width={gW} height={gH} fill={c.glassFill} fillOpacity={c.glassFillOpacity} stroke={c.glassStroke} strokeWidth="1" />
                      <line x1={gX + 16} y1={gY + 12} x2={gX + 46} y2={gY + 60} stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.5" />
                      {/* Casement Opening Swing Triangle (Dashed) */}
                      <path
                        d={`M ${gX + 4} ${gY + 4} L ${gX + gW - 6} ${gY + gH / 2} L ${gX + 4} ${gY + gH - 4}`}
                        fill="none"
                        stroke={c.steelFill}
                        strokeWidth="1.2"
                        strokeDasharray="5 3"
                      />
                      {/* Casement Handle Symbol on Right Stile */}
                      <rect x={innerElevX + innerElevW - sashThick + 2} y={innerElevY + innerElevH / 2 - 10} width="4" height="20" rx="1.5" fill={c.lineDark} />
                      {/* Badge */}
                      <rect x={gX + gW / 2 - 45} y={gY + gH / 2 - 13} width="90" height="26" rx="3" fill={c.dimBadgeBg} stroke={c.dimBadgeBorder} strokeWidth="0.75" />
                      <text x={gX + gW / 2} y={gY + gH / 2 - 2} fill={c.steelFill} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                        CASEMENT SASH
                      </text>
                      <text x={gX + gW / 2} y={gY + gH / 2 + 8} fill={c.lineDark} fontSize="7" fontFamily="monospace" textAnchor="middle">
                        {`${panel.heightMM} × ${panel.widthMM} mm`}
                      </text>
                    </g>
                  );
                })()
              ) : casementSubtype === 'double' ? (
                // B.2 DOUBLE OPEN WINDOW (WITH CENTRAL MULLION)
                (() => {
                  const mullionW = Math.max(12, Math.min(20, innerElevW * 0.05));
                  const mullionX = innerElevX + (innerElevW - mullionW) / 2;
                  const bayW = (innerElevW - mullionW) / 2;
                  const sashThick = Math.max(7, frameThick * 0.95);
                  const mullionCut = result.mullionMM || result.frame.mullionCutMM || (convertedHeightMM - 6);

                  return (
                    <g>
                      {/* Left Sash */}
                      {(() => {
                        const sX = innerElevX + 2;
                        const sW = bayW - 2;
                        const gX = sX + sashThick;
                        const gY = innerElevY + sashThick;
                        const gW = sW - sashThick * 2;
                        const gH = innerElevH - sashThick * 2;
                        return (
                          <g>
                            <rect x={sX} y={innerElevY + 2} width={sW} height={innerElevH - 4} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1.2" />
                            <rect x={gX} y={gY} width={gW} height={gH} fill={c.glassFill} fillOpacity={c.glassFillOpacity} stroke={c.glassStroke} strokeWidth="1" />
                            {/* Swing towards center */}
                            <path d={`M ${gX + 4} ${gY + 4} L ${gX + gW - 4} ${gY + gH / 2} L ${gX + 4} ${gY + gH - 4}`} fill="none" stroke={c.steelFill} strokeWidth="1.2" strokeDasharray="5 3" />
                            {/* Handle on center stile */}
                            <rect x={sX + sW - sashThick + 1} y={innerElevY + innerElevH / 2 - 8} width="3.5" height="16" rx="1" fill={c.lineDark} />
                            <rect x={gX + gW / 2 - 38} y={gY + gH / 2 - 13} width="76" height="26" rx="3" fill={c.dimBadgeBg} stroke={c.dimBadgeBorder} strokeWidth="0.75" />
                            <text x={gX + gW / 2} y={gY + gH / 2 - 2} fill={c.steelFill} fontSize="7.5" fontWeight="bold" textAnchor="middle">SASH 1 (LEFT)</text>
                            <text x={gX + gW / 2} y={gY + gH / 2 + 8} fill={c.lineDark} fontSize="7" fontFamily="monospace" textAnchor="middle">{`${panel.heightMM}×${panel.widthMM}`}</text>
                          </g>
                        );
                      })()}

                      {/* CENTRAL MULLION PROFILE (T-PROFILE DIVISION) */}
                      <g id="center-mullion-profile">
                        <rect x={mullionX} y={innerElevY} width={mullionW} height={innerElevH} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.3" />
                        <rect x={mullionX + 3} y={innerElevY + 6} width={mullionW - 6} height={innerElevH - 12} fill={c.steelFill} fillOpacity="0.75" />
                        <g transform={`translate(${mullionX + mullionW / 2}, ${innerElevY + innerElevH / 2}) rotate(-90)`}>
                          <rect x="-42" y="-7.5" width="84" height="15" rx="2" fill={c.dimBadgeBg} stroke={c.dimBadgeBorder} strokeWidth="0.6" />
                          <text x="0" y="3" fill={c.steelFill} fontSize="7" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                            {`MULLION: ${mullionCut} mm`}
                          </text>
                        </g>
                      </g>

                      {/* Right Sash */}
                      {(() => {
                        const sX = mullionX + mullionW;
                        const sW = bayW - 2;
                        const gX = sX + sashThick;
                        const gY = innerElevY + sashThick;
                        const gW = sW - sashThick * 2;
                        const gH = innerElevH - sashThick * 2;
                        return (
                          <g>
                            <rect x={sX} y={innerElevY + 2} width={sW} height={innerElevH - 4} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1.2" />
                            <rect x={gX} y={gY} width={gW} height={gH} fill={c.glassFill} fillOpacity={c.glassFillOpacity} stroke={c.glassStroke} strokeWidth="1" />
                            {/* Swing towards center */}
                            <path d={`M ${gX + gW - 4} ${gY + 4} L ${gX + 4} ${gY + gH / 2} L ${gX + gW - 4} ${gY + gH - 4}`} fill="none" stroke={c.steelFill} strokeWidth="1.2" strokeDasharray="5 3" />
                            {/* Handle on center stile */}
                            <rect x={sX + 2} y={innerElevY + innerElevH / 2 - 8} width="3.5" height="16" rx="1" fill={c.lineDark} />
                            <rect x={gX + gW / 2 - 38} y={gY + gH / 2 - 13} width="76" height="26" rx="3" fill={c.dimBadgeBg} stroke={c.dimBadgeBorder} strokeWidth="0.75" />
                            <text x={gX + gW / 2} y={gY + gH / 2 - 2} fill={c.steelFill} fontSize="7.5" fontWeight="bold" textAnchor="middle">SASH 2 (RIGHT)</text>
                            <text x={gX + gW / 2} y={gY + gH / 2 + 8} fill={c.lineDark} fontSize="7" fontFamily="monospace" textAnchor="middle">{`${panel.heightMM}×${panel.widthMM}`}</text>
                          </g>
                        );
                      })()}
                    </g>
                  );
                })()
              ) : (
                // B.3 3-OPEN WINDOW (WITH 2 VERTICAL MULLIONS)
                (() => {
                  const mullionW = Math.max(10, Math.min(16, innerElevW * 0.04));
                  const bayW = (innerElevW - mullionW * 2) / 3;
                  const sashThick = Math.max(6, frameThick * 0.9);
                  const mullionCut = result.mullionMM || result.frame.mullionCutMM || (convertedHeightMM - 6);

                  return (
                    <g>
                      {[0, 1, 2].map((idx) => {
                        const sX = innerElevX + idx * (bayW + mullionW);
                        const gX = sX + sashThick;
                        const gY = innerElevY + sashThick;
                        const gW = bayW - sashThick * 2;
                        const gH = innerElevH - sashThick * 2;
                        return (
                          <g key={`triple-sash-${idx}`}>
                            <rect x={sX + 1} y={innerElevY + 2} width={bayW - 2} height={innerElevH - 4} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1.2" />
                            <rect x={gX} y={gY} width={gW} height={gH} fill={c.glassFill} fillOpacity={c.glassFillOpacity} stroke={c.glassStroke} strokeWidth="1" />
                            <path d={`M ${gX + 3} ${gY + 3} L ${gX + gW - 3} ${gY + gH / 2} L ${gX + 3} ${gY + gH - 3}`} fill="none" stroke={c.steelFill} strokeWidth="1" strokeDasharray="4 2" />
                            <rect x={gX + gW / 2 - 32} y={gY + gH / 2 - 12} width="64" height="24" rx="2" fill={c.dimBadgeBg} stroke={c.dimBadgeBorder} strokeWidth="0.6" />
                            <text x={gX + gW / 2} y={gY + gH / 2 - 2} fill={c.steelFill} fontSize="7" fontWeight="bold" textAnchor="middle">{`SASH ${idx + 1}`}</text>
                            <text x={gX + gW / 2} y={gY + gH / 2 + 7} fill={c.lineDark} fontSize="6.5" fontFamily="monospace" textAnchor="middle">{`${panel.heightMM}×${panel.widthMM}`}</text>
                          </g>
                        );
                      })}
                      {/* Mullion 1 & Mullion 2 */}
                      {[1, 2].map((mIdx) => {
                        const mX = innerElevX + mIdx * bayW + (mIdx - 1) * mullionW;
                        return (
                          <g key={`mullion-${mIdx}`}>
                            <rect x={mX} y={innerElevY} width={mullionW} height={innerElevH} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
                            <rect x={mX + 2} y={innerElevY + 6} width={mullionW - 4} height={innerElevH - 12} fill={c.steelFill} fillOpacity="0.75" />
                            <text x={mX + mullionW / 2} y={innerElevY + 16} fill="#ffffff" fontSize="5.5" fontWeight="bold" textAnchor="middle">M</text>
                          </g>
                        );
                      })}
                      <rect x={actualElevX + elevW / 2 - 45} y={innerElevY + innerElevH - 18} width="90" height="14" rx="2" fill={c.dimBadgeBg} stroke={c.dimBadgeBorder} strokeWidth="0.6" />
                      <text x={actualElevX + elevW / 2} y={innerElevY + innerElevH - 8} fill={c.steelFill} fontSize="7" fontWeight="bold" textAnchor="middle">
                        {`2 MULLIONS: ${mullionCut} mm` }
                      </text>
                    </g>
                  );
                })()
              )}
            </g>
          ) : isFixed ? (
            /* C. FIXED WINDOW ELEVATION (DIRECT GLAZING) */
            <g id="elev-fixed-glazing">
              {/* Snap-in Glazing Bead Line */}
              <rect
                x={innerElevX + 8}
                y={innerElevY + 8}
                width={innerElevW - 16}
                height={innerElevH - 16}
                fill="none"
                stroke={c.beadFill}
                strokeWidth="2.5"
              />
              <line x1={innerElevX} y1={innerElevY} x2={innerElevX + 8} y2={innerElevY + 8} stroke={c.lineMedium} strokeWidth="0.8" />
              <line x1={innerElevX + innerElevW} y1={innerElevY} x2={innerElevX + innerElevW - 8} y2={innerElevY + 8} stroke={c.lineMedium} strokeWidth="0.8" />
              <line x1={innerElevX} y1={innerElevY + innerElevH} x2={innerElevX + 8} y2={innerElevY + innerElevH - 8} stroke={c.lineMedium} strokeWidth="0.8" />
              <line x1={innerElevX + innerElevW} y1={innerElevY + innerElevH} x2={innerElevX + innerElevW - 8} y2={innerElevY + innerElevH - 8} stroke={c.lineMedium} strokeWidth="0.8" />

              {/* Panoramic Glass Pane */}
              <rect
                x={innerElevX + 9}
                y={innerElevY + 9}
                width={innerElevW - 18}
                height={innerElevH - 18}
                fill={c.glassFill}
                fillOpacity={c.glassFillOpacity}
                stroke={c.glassStroke}
                strokeWidth="1.2"
              />
              {/* Architectural Reflection Sheen Lines */}
              <line x1={innerElevX + 25} y1={innerElevY + 20} x2={innerElevX + 70} y2={innerElevY + 110} stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.6" />
              <line x1={innerElevX + 35} y1={innerElevY + 20} x2={innerElevX + 85} y2={innerElevY + 120} stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.4" />
              <line x1={innerElevX + innerElevW - 80} y1={innerElevY + innerElevH - 110} x2={innerElevX + innerElevW - 35} y2={innerElevY + innerElevH - 20} stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.5" />

              {/* Fixed Direct Glazing Architectural Badge */}
              <rect
                x={innerElevX + innerElevW / 2 - 80}
                y={innerElevY + innerElevH / 2 - 24}
                width="160"
                height="48"
                rx="4"
                fill={c.dimBadgeBg}
                stroke={c.dimBadgeBorder}
                strokeWidth="0.85"
                fillOpacity="0.95"
              />
              <text x={innerElevX + innerElevW / 2} y={innerElevY + innerElevH / 2 - 8} fill={c.steelFill} fontSize="8.5" fontWeight="bold" textAnchor="middle">
                FIXED DIRECT GLAZING
              </text>
              <text x={innerElevX + innerElevW / 2} y={innerElevY + innerElevH / 2 + 5} fill={c.lineDark} fontSize="7.5" fontFamily="monospace" textAnchor="middle">
                {`Glass Cut: ${mirror.heightMM} × ${mirror.widthMM} mm`}
              </text>
              <text x={innerElevX + innerElevW / 2} y={innerElevY + innerElevH / 2 + 17} fill={c.lineMedium} fontSize="7" textAnchor="middle">
                {`Area: ${mirror.sqFeet} Sq.Ft • Snap-in Bead 45°`}
              </text>
            </g>
          ) : (
            /* D. VENTILATOR ELEVATION */
            <g id="elev-ventilator">
              {ventilatorSubtype === 'fan' ? (
                // D.1 VENTILATOR WITH EXHAUST FAN PROVISION
                (() => {
                  const bayW = (innerElevW - 12) / 2;
                  const fanOnLeft = ventilatorFanSide === 'left';
                  const fanX = fanOnLeft ? innerElevX + 2 : innerElevX + bayW + 10;
                  const louverX = fanOnLeft ? innerElevX + bayW + 10 : innerElevX + 2;
                  const mullionX = innerElevX + bayW + 2;
                  const fanRadius = Math.min(bayW * 0.36, innerElevH * 0.36);

                  return (
                    <g>
                      {/* Fan Zone Bay */}
                      <rect x={fanX} y={innerElevY + 2} width={bayW} height={innerElevH - 4} fill={c.meshBg} stroke={c.profileStroke} strokeWidth="1" />
                      {/* Circular Exhaust Fan Cut-out Hole */}
                      <circle cx={fanX + bayW / 2} cy={innerElevY + innerElevH / 2} r={fanRadius} fill={c.dimBadgeBg} stroke={c.fanAccent} strokeWidth="1.8" />
                      <circle cx={fanX + bayW / 2} cy={innerElevY + innerElevH / 2} r="5" fill={c.fanAccent} />
                      {/* Crosshairs & fan blades */}
                      <line x1={fanX + bayW / 2 - fanRadius} y1={innerElevY + innerElevH / 2} x2={fanX + bayW / 2 + fanRadius} y2={innerElevY + innerElevH / 2} stroke={c.fanAccent} strokeWidth="0.8" strokeDasharray="3 2" />
                      <line x1={fanX + bayW / 2} y1={innerElevY + innerElevH / 2 - fanRadius} x2={fanX + bayW / 2} y2={innerElevY + innerElevH / 2 + fanRadius} stroke={c.fanAccent} strokeWidth="0.8" strokeDasharray="3 2" />
                      <path d={`M ${fanX + bayW / 2} ${innerElevY + innerElevH / 2} Q ${fanX + bayW / 2 + fanRadius * 0.5} ${innerElevY + innerElevH / 2 - fanRadius * 0.5} ${fanX + bayW / 2} ${innerElevY + innerElevH / 2 - fanRadius + 3}`} fill="none" stroke={c.fanAccent} strokeWidth="1.2" />
                      <path d={`M ${fanX + bayW / 2} ${innerElevY + innerElevH / 2} Q ${fanX + bayW / 2 - fanRadius * 0.5} ${innerElevY + innerElevH / 2 + fanRadius * 0.5} ${fanX + bayW / 2} ${innerElevY + innerElevH / 2 + fanRadius - 3}`} fill="none" stroke={c.fanAccent} strokeWidth="1.2" />
                      <rect x={fanX + bayW / 2 - 45} y={innerElevY + innerElevH / 2 + fanRadius + 4} width="90" height="15" rx="2" fill={c.dimBadgeBg} stroke={c.dimBadgeBorder} strokeWidth="0.6" />
                      <text x={fanX + bayW / 2} y={innerElevY + innerElevH / 2 + fanRadius + 14} fill={c.fanAccent} fontSize="7" fontWeight="bold" textAnchor="middle">
                        EXHAUST FAN (Ø 175 mm)
                      </text>

                      {/* Intermediate Dividing Mullion */}
                      <rect x={mullionX} y={innerElevY} width="8" height={innerElevH} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />

                      {/* Louver Zone Bay */}
                      <rect x={louverX} y={innerElevY + 2} width={bayW} height={innerElevH - 4} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
                      {[1, 2, 3, 4, 5].map((i) => {
                        const ly = innerElevY + (innerElevH / 6) * i;
                        return (
                          <line key={`fan-louver-${i}`} x1={louverX + 4} y1={ly} x2={louverX + bayW - 4} y2={ly} stroke={c.lineDark} strokeWidth="2" strokeDasharray="6 3" />
                        );
                      })}
                      <rect x={louverX + bayW / 2 - 35} y={innerElevY + innerElevH / 2 - 10} width="70" height="20" rx="2" fill={c.dimBadgeBg} stroke={c.dimBadgeBorder} strokeWidth="0.6" />
                      <text x={louverX + bayW / 2} y={innerElevY + innerElevH / 2 + 3} fill={c.steelFill} fontSize="7" fontWeight="bold" textAnchor="middle">
                        AIR LOUVERS
                      </text>
                    </g>
                  );
                })()
              ) : (
                // D.2 NORMAL VENTILATOR (ALL LOUVER BLADES)
                <g>
                  {/* Louver blades */}
                  {[1, 2, 3, 4, 5, 6].map((i) => {
                    const ly = innerElevY + (innerElevH / 7) * i;
                    return (
                      <g key={`norm-louver-${i}`}>
                        <rect x={innerElevX + 6} y={ly - 4} width={innerElevW - 12} height="8" rx="1.5" fill={c.glassFill} fillOpacity="0.4" stroke={c.glassStroke} strokeWidth="0.8" />
                        <line x1={innerElevX + 6} y1={ly} x2={innerElevX + innerElevW - 6} y2={ly} stroke={c.lineDark} strokeWidth="1.2" strokeDasharray="5 2" />
                      </g>
                    );
                  })}
                  {/* Louver side clip galleries */}
                  <rect x={innerElevX + 2} y={innerElevY + 4} width="4" height={innerElevH - 8} fill={c.lineDark} rx="1" />
                  <rect x={innerElevX + innerElevW - 6} y={innerElevY + 4} width="4" height={innerElevH - 8} fill={c.lineDark} rx="1" />
                  <rect x={innerElevX + innerElevW / 2 - 70} y={innerElevY + innerElevH / 2 - 16} width="140" height="32" rx="3" fill={c.dimBadgeBg} stroke={c.dimBadgeBorder} strokeWidth="0.75" />
                  <text x={innerElevX + innerElevW / 2} y={innerElevY + innerElevH / 2 - 3} fill={c.steelFill} fontSize="8" fontWeight="bold" textAnchor="middle">
                    VENTILATOR (AIR LOUVERS)
                  </text>
                  <text x={innerElevX + innerElevW / 2} y={innerElevY + innerElevH / 2 + 9} fill={c.lineDark} fontSize="7" fontFamily="monospace" textAnchor="middle">
                    {`Clear Opening: ${convertedHeightMM - 88} × ${convertedWidthMM - 88} mm`}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* ========================================================= */}
          {/* SECTION CUTTING PLANES (A-A & B-B) ON ELEVATION           */}
          {/* ========================================================= */}
          <g id="cutting-plane-aa">
            <line
              x1={actualElevX - 18}
              y1={secLineAY}
              x2={actualElevX + elevW + 18}
              y2={secLineAY}
              stroke={c.sectionLine}
              strokeWidth="1.2"
              strokeDasharray="5 3"
            />
            {/* Left Section A Indicator */}
            <line
              x1={actualElevX - 18}
              y1={secLineAY}
              x2={actualElevX - 18}
              y2={secLineAY + 14}
              stroke={c.sectionLine}
              strokeWidth="1.6"
              markerEnd={`url(#${uniqueId}-sec-arrow)`}
            />
            <circle cx={actualElevX - 26} cy={secLineAY} r="7" fill={c.bg} stroke={c.sectionLine} strokeWidth="1" />
            <text x={actualElevX - 26} y={secLineAY + 3} fill={c.sectionText} fontSize="8.5" fontWeight="bold" textAnchor="middle">
              A
            </text>

            {/* Right Section A Indicator */}
            <line
              x1={actualElevX + elevW + 18}
              y1={secLineAY}
              x2={actualElevX + elevW + 18}
              y2={secLineAY + 14}
              stroke={c.sectionLine}
              strokeWidth="1.6"
              markerEnd={`url(#${uniqueId}-sec-arrow)`}
            />
            <circle cx={actualElevX + elevW + 26} cy={secLineAY} r="7" fill={c.bg} stroke={c.sectionLine} strokeWidth="1" />
            <text x={actualElevX + elevW + 26} y={secLineAY + 3} fill={c.sectionText} fontSize="8.5" fontWeight="bold" textAnchor="middle">
              A
            </text>
          </g>

          <g id="cutting-plane-bb">
            <line
              x1={secLineBX}
              y1={actualElevY - 18}
              x2={secLineBX}
              y2={actualElevY + elevH + 18}
              stroke={c.sectionLine}
              strokeWidth="1.2"
              strokeDasharray="5 3"
            />
            {/* Top Section B Indicator */}
            <line
              x1={secLineBX}
              y1={actualElevY - 18}
              x2={secLineBX + 14}
              y2={actualElevY - 18}
              stroke={c.sectionLine}
              strokeWidth="1.6"
              markerEnd={`url(#${uniqueId}-sec-arrow)`}
            />
            <circle cx={secLineBX} cy={actualElevY - 26} r="7" fill={c.bg} stroke={c.sectionLine} strokeWidth="1" />
            <text x={secLineBX} y={actualElevY - 23} fill={c.sectionText} fontSize="8.5" fontWeight="bold" textAnchor="middle">
              B
            </text>

            {/* Bottom Section B Indicator */}
            <line
              x1={secLineBX}
              y1={actualElevY + elevH + 18}
              x2={secLineBX + 14}
              y2={actualElevY + elevH + 18}
              stroke={c.sectionLine}
              strokeWidth="1.6"
              markerEnd={`url(#${uniqueId}-sec-arrow)`}
            />
            <circle cx={secLineBX} cy={actualElevY + elevH + 26} r="7" fill={c.bg} stroke={c.sectionLine} strokeWidth="1" />
            <text x={secLineBX} y={actualElevY + elevH + 29} fill={c.sectionText} fontSize="8.5" fontWeight="bold" textAnchor="middle">
              B
            </text>
          </g>
        </g>
      )}

      {/* ============================================================= */}
      {/* 2. SECTION B-B (VERTICAL CROSS-SECTION THROUGH HEAD & SILL)   */}
      {/* ============================================================= */}
      {(isAllInOne || isSectionBOnly) && (
        <g id="section-bb-group" transform={isSectionBOnly ? `translate(0, 0)` : ''}>
          {/* Header Title */}
          <text
            x={secBX + secBW / 2}
            y={secBY - 26}
            fill={c.lineDark}
            fontSize="10"
            fontWeight="bold"
            letterSpacing="0.8"
            textAnchor="middle"
          >
            {isTamil ? 'செக்ஷன் B-B (குறுக்குவெட்டுத் தோற்றம்)' : 'Section B-B'}
          </text>
          <text
            x={secBX + secBW / 2}
            y={secBY - 14}
            fill={c.lineLight}
            fontSize="7"
            textAnchor="middle"
          >
            {isFixed 
              ? 'VERTICAL SECTION (FIXED HEAD & SNAP-IN GLAZING BEADS)'
              : isVentilator
                ? 'VERTICAL SECTION (VENTILATOR HEAD, LOUVERS & WEATHER SILL)'
                : isOpen
                  ? 'VERTICAL SECTION (CASEMENT HEAD, REBATE & WEATHER SILL)'
                  : 'VERTICAL SECTION (HEAD, SASH & TRACK SILL)'}
          </text>

          {/* Container box */}
          <rect
            x={secBX}
            y={secBY}
            width={secBW}
            height={secBH}
            fill={isWhite ? '#ffffff' : '#070b14'}
            stroke={c.titleBorder}
            strokeWidth="0.8"
            rx="2"
          />

          {isSliding ? (
            /* 2.A SLIDING SECTION B-B */
            <g id="sec-b-sliding">
              {/* Head Profile */}
              <rect x={secBX + 20} y={secBY + 8} width={secBW - 40} height={headProfileH} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <line x1={secBX + 20 + (secBW - 40) * 0.33} y1={secBY + 8} x2={secBX + 20 + (secBW - 40) * 0.33} y2={secBY + 8 + headProfileH} stroke={c.lineMedium} strokeWidth="0.8" />
              <line x1={secBX + 20 + (secBW - 40) * 0.66} y1={secBY + 8} x2={secBX + 20 + (secBW - 40) * 0.66} y2={secBY + 8 + headProfileH} stroke={c.lineMedium} strokeWidth="0.8" />
              <rect x={secBX + 20 + (secBW - 40) * 0.36} y={secBY + 12} width={(secBW - 40) * 0.28} height={headProfileH - 8} fill={c.steelFill} fillOpacity="0.8" />
              <text x={secBX + secBW / 2} y={secBY + 8 + headProfileH / 2 + 3} fill="#ffffff" fontSize="6" fontWeight="bold" fontFamily="monospace" textAnchor="middle">STEEL</text>
              <text x={secBX + 12} y={secBY + 8 + headProfileH / 2} fill={c.lineMedium} fontSize="6.5" textAnchor="end">Head</text>

              {/* Top Sash Rails */}
              <rect x={secBX + 35} y={secBY + 8 + headProfileH + 4} width={45} height={secTopSashH} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
              <rect x={secBX + 42} y={secBY + 8 + headProfileH + 7} width={16} height={secTopSashH - 6} fill={c.steelFill} fillOpacity="0.75" />
              <rect x={secBX + 95} y={secBY + 8 + headProfileH + 4} width={45} height={secTopSashH} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
              <rect x={secBX + 102} y={secBY + 8 + headProfileH + 7} width={16} height={secTopSashH - 6} fill={c.steelFill} fillOpacity="0.75" />
              {isMeshWindow && (
                <rect x={secBX + 155} y={secBY + 8 + headProfileH + 4} width={32} height={secTopSashH - 4} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="0.9" />
              )}

              {/* Spanning glass & mesh ribbons */}
              <rect x={secBX + 55} y={secBY + 8 + headProfileH + 4 + secTopSashH} width={4} height={secBH - headProfileH - sillProfileH - secTopSashH - secBotSashH - 16} fill={c.glassFill} stroke={c.glassStroke} strokeWidth="0.75" />
              <rect x={secBX + 115} y={secBY + 8 + headProfileH + 4 + secTopSashH} width={4} height={secBH - headProfileH - sillProfileH - secTopSashH - secBotSashH - 16} fill={c.glassFill} stroke={c.glassStroke} strokeWidth="0.75" />
              {isMeshWindow && (
                <line x1={secBX + 171} y1={secBY + 8 + headProfileH + 4 + secTopSashH - 4} x2={secBX + 171} y2={secBY + secBH - sillProfileH - 4 - secBotSashH + 4} stroke={c.meshPatternColor} strokeWidth="1.5" strokeDasharray="2 2" />
              )}

              {/* Break lines */}
              <path d={`M ${secBX + 25} ${secBreakY - 6} L ${secBX + 80} ${secBreakY - 6} L ${secBX + 90} ${secBreakY - 14} L ${secBX + 100} ${secBreakY + 2} L ${secBX + 110} ${secBreakY - 6} L ${secBX + secBW - 25} ${secBreakY - 6}`} fill="none" stroke={c.lineDark} strokeWidth="1" />
              <path d={`M ${secBX + 25} ${secBreakY + 6} L ${secBX + 80} ${secBreakY + 6} L ${secBX + 90} ${secBreakY - 2} L ${secBX + 100} ${secBreakY + 14} L ${secBX + 110} ${secBreakY + 6} L ${secBX + secBW - 25} ${secBreakY + 6}`} fill="none" stroke={c.lineDark} strokeWidth="1" />

              {/* Bottom Sash Rails with Rollers */}
              <rect x={secBX + 35} y={secBY + secBH - sillProfileH - 4 - secBotSashH} width={45} height={secBotSashH} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
              <circle cx={secBX + 57.5} cy={secBY + secBH - sillProfileH - 4} r="6.5" fill={c.rollerWheel} stroke={c.rollerStroke} strokeWidth="1" />
              <circle cx={secBX + 57.5} cy={secBY + secBH - sillProfileH - 4} r="2" fill={c.steelFill} />

              <rect x={secBX + 95} y={secBY + secBH - sillProfileH - 4 - secBotSashH} width={45} height={secBotSashH} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
              <circle cx={secBX + 117.5} cy={secBY + secBH - sillProfileH - 4} r="6.5" fill={c.rollerWheel} stroke={c.rollerStroke} strokeWidth="1" />
              <circle cx={secBX + 117.5} cy={secBY + secBH - sillProfileH - 4} r="2" fill={c.steelFill} />

              {isMeshWindow && (
                <g>
                  <rect x={secBX + 155} y={secBY + secBH - sillProfileH - 4 - secBotSashH + 4} width={32} height={secBotSashH - 4} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="0.9" />
                  <circle cx={secBX + 171} cy={secBY + secBH - sillProfileH - 4} r="5" fill={c.rollerWheel} stroke={c.rollerStroke} strokeWidth="0.8" />
                </g>
              )}

              {/* Sill Multi-track Profile */}
              <rect x={secBX + 20} y={secBY + secBH - sillProfileH - 4} width={secBW - 40} height={sillProfileH} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <path d={`M ${secBX + 54} ${secBY + secBH - sillProfileH - 4} L ${secBX + 54} ${secBY + secBH - sillProfileH - 8} L ${secBX + 61} ${secBY + secBH - sillProfileH - 8} L ${secBX + 61} ${secBY + secBH - sillProfileH - 4} Z`} fill={c.steelFill} stroke={c.profileStroke} strokeWidth="0.8" />
              <path d={`M ${secBX + 114} ${secBY + secBH - sillProfileH - 4} L ${secBX + 114} ${secBY + secBH - sillProfileH - 8} L ${secBX + 121} ${secBY + secBH - sillProfileH - 8} L ${secBX + 121} ${secBY + secBH - sillProfileH - 4} Z`} fill={c.steelFill} stroke={c.profileStroke} strokeWidth="0.8" />
              {isMeshWindow && (
                <path d={`M ${secBX + 168} ${secBY + secBH - sillProfileH - 4} L ${secBX + 168} ${secBY + secBH - sillProfileH - 7} L ${secBX + 174} ${secBY + secBH - sillProfileH - 7} L ${secBX + 174} ${secBY + secBH - sillProfileH - 4} Z`} fill={c.steelFill} stroke={c.profileStroke} strokeWidth="0.8" />
              )}
              <line x1={secBX + 20 + (secBW - 40) * 0.33} y1={secBY + secBH - sillProfileH - 4} x2={secBX + 20 + (secBW - 40) * 0.33} y2={secBY + secBH - 4} stroke={c.lineMedium} strokeWidth="0.8" />
              <line x1={secBX + 20 + (secBW - 40) * 0.66} y1={secBY + secBH - sillProfileH - 4} x2={secBX + 20 + (secBW - 40) * 0.66} y2={secBY + secBH - 4} stroke={c.lineMedium} strokeWidth="0.8" />
              <rect x={secBX + 20 + (secBW - 40) * 0.36} y={secBY + secBH - sillProfileH} width={(secBW - 40) * 0.28} height={sillProfileH - 8} fill={c.steelFill} fillOpacity="0.8" />
              <circle cx={secBX + 32} cy={secBY + secBH - 14} r="3" fill="none" stroke={c.dimLine} strokeWidth="0.8" />
              <text x={secBX + 12} y={secBY + secBH - sillProfileH / 2} fill={c.lineMedium} fontSize="6.5" textAnchor="end">Sill</text>

              <text x={secBX + 57.5} y={secBY + secBH + 12} fill={c.lineDark} fontSize="7" fontWeight="bold" textAnchor="middle">Track 1</text>
              <text x={secBX + 117.5} y={secBY + secBH + 12} fill={c.lineDark} fontSize="7" fontWeight="bold" textAnchor="middle">Track 2</text>
              {isMeshWindow && <text x={secBX + 171} y={secBY + secBH + 12} fill={c.steelFill} fontSize="7" fontWeight="bold" textAnchor="middle">Mesh Track</text>}
            </g>
          ) : isOpen ? (
            /* 2.B CASEMENT SECTION B-B (NO ROLLERS, REBATED WEATHER SILL) */
            <g id="sec-b-casement">
              {/* Casement Head Frame Profile */}
              <rect x={secBX + 20} y={secBY + 8} width={secBW - 40} height={headProfileH} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={secBX + 30} y={secBY + 12} width={secBW - 60} height={headProfileH - 8} fill={c.steelFill} fillOpacity="0.75" />
              <text x={secBX + secBW / 2} y={secBY + 8 + headProfileH / 2 + 3} fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">STEEL (CASEMENT HEAD)</text>
              {/* EPDM Gasket Line */}
              <line x1={secBX + 25} y1={secBY + 8 + headProfileH} x2={secBX + secBW - 25} y2={secBY + 8 + headProfileH} stroke={c.gasket} strokeWidth="2" strokeDasharray="3 1" />

              {/* Casement Sash Top Rail */}
              <rect x={secBX + 40} y={secBY + 8 + headProfileH + 4} width={secBW - 80} height={secTopSashH} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1.1" />
              <rect x={secBX + 55} y={secBY + 8 + headProfileH + 7} width={secBW - 110} height={secTopSashH - 6} fill={c.steelFill} fillOpacity="0.7" />
              {/* Snap-in Glazing Bead Top */}
              <rect x={secBX + secBW / 2 + 5} y={secBY + 8 + headProfileH + 4 + secTopSashH - 6} width="16" height="6" fill={c.beadFill} stroke={c.profileStroke} strokeWidth="0.8" />
              <text x={secBX + 35} y={secBY + 8 + headProfileH + secTopSashH / 2 + 4} fill={c.lineMedium} fontSize="6" textAnchor="end">Top Rail</text>

              {/* Glass Ribbon Span */}
              <rect x={secBX + secBW / 2 - 2.5} y={secBY + 8 + headProfileH + 4 + secTopSashH} width="5" height={secBH - headProfileH - sillProfileH - secTopSashH - secBotSashH - 16} fill={c.glassFill} stroke={c.glassStroke} strokeWidth="0.8" />
              <line x1={secBX + secBW / 2 + 8} y1={secBY + 8 + headProfileH + 4 + secTopSashH + 15} x2={secBX + secBW / 2 + 25} y2={secBY + 8 + headProfileH + 4 + secTopSashH + 45} stroke="#ffffff" strokeWidth="1" strokeOpacity="0.5" />

              {/* Break lines */}
              <path d={`M ${secBX + 25} ${secBreakY - 6} L ${secBX + 80} ${secBreakY - 6} L ${secBX + 90} ${secBreakY - 14} L ${secBX + 100} ${secBreakY + 2} L ${secBX + 110} ${secBreakY - 6} L ${secBX + secBW - 25} ${secBreakY - 6}`} fill="none" stroke={c.lineDark} strokeWidth="1" />
              <path d={`M ${secBX + 25} ${secBreakY + 6} L ${secBX + 80} ${secBreakY + 6} L ${secBX + 90} ${secBreakY - 2} L ${secBX + 100} ${secBreakY + 14} L ${secBX + 110} ${secBreakY + 6} L ${secBX + secBW - 25} ${secBreakY + 6}`} fill="none" stroke={c.lineDark} strokeWidth="1" />

              {/* Casement Sash Bottom Rail with Drip Edge */}
              <rect x={secBX + 40} y={secBY + secBH - sillProfileH - 4 - secBotSashH} width={secBW - 80} height={secBotSashH} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1.1" />
              <rect x={secBX + 55} y={secBY + secBH - sillProfileH - 4 - secBotSashH + 3} width={secBW - 110} height={secBotSashH - 6} fill={c.steelFill} fillOpacity="0.7" />
              {/* Drip nose */}
              <path d={`M ${secBX + 40} ${secBY + secBH - sillProfileH - 4} L ${secBX + 32} ${secBY + secBH - sillProfileH - 1} L ${secBX + 40} ${secBY + secBH - sillProfileH - 1} Z`} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="0.8" />
              <text x={secBX + 35} y={secBY + secBH - sillProfileH - secBotSashH / 2} fill={c.lineMedium} fontSize="6" textAnchor="end">Bot Rail</text>

              {/* Lower EPDM compression gasket */}
              <line x1={secBX + 25} y1={secBY + secBH - sillProfileH - 4} x2={secBX + secBW - 25} y2={secBY + secBH - sillProfileH - 4} stroke={c.gasket} strokeWidth="2" strokeDasharray="3 1" />

              {/* Casement Outer Frame Sill with Drainage Slope */}
              <rect x={secBX + 20} y={secBY + secBH - sillProfileH - 4} width={secBW - 40} height={sillProfileH} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={secBX + 30} y={secBY + secBH - sillProfileH} width={secBW - 60} height={sillProfileH - 8} fill={c.steelFill} fillOpacity="0.75" />
              {/* Drainage weep slot */}
              <rect x={secBX + 28} y={secBY + secBH - 14} width="14" height="4" rx="1" fill="none" stroke={c.dimLine} strokeWidth="0.8" />
              <text x={secBX + secBW / 2} y={secBY + secBH - sillProfileH / 2 + 2} fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">DRAINAGE SILL</text>
              <text x={secBX + 12} y={secBY + secBH - sillProfileH / 2} fill={c.lineMedium} fontSize="6.5" textAnchor="end">Sill</text>

              <text x={secBX + secBW / 2} y={secBY + secBH + 12} fill={c.steelFill} fontSize="7" fontWeight="bold" textAnchor="middle">EPDM Compression Rebates • Zero Rollers</text>
            </g>
          ) : isFixed ? (
            /* 2.C FIXED WINDOW SECTION B-B (SNAP-IN GLAZING BEADS, DIRECT GLASS) */
            <g id="sec-b-fixed">
              {/* Fixed Frame Head Profile */}
              <rect x={secBX + 20} y={secBY + 8} width={secBW - 40} height={headProfileH} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={secBX + 30} y={secBY + 12} width={secBW - 60} height={headProfileH - 8} fill={c.steelFill} fillOpacity="0.75" />
              <text x={secBX + secBW / 2} y={secBY + 8 + headProfileH / 2 + 3} fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">STEEL (FIXED HEAD)</text>
              <text x={secBX + 12} y={secBY + 8 + headProfileH / 2} fill={c.lineMedium} fontSize="6.5" textAnchor="end">Head</text>

              {/* Snap-in Glazing Bead Top */}
              <rect x={secBX + secBW / 2 + 4} y={secBY + 8 + headProfileH} width="22" height="14" fill={c.beadFill} stroke={c.profileStroke} strokeWidth="1" />
              <line x1={secBX + secBW / 2 + 4} y1={secBY + 8 + headProfileH} x2={secBX + secBW / 2 + 4} y2={secBY + 8 + headProfileH + 14} stroke={c.gasket} strokeWidth="2.5" />
              <text x={secBX + secBW / 2 + 30} y={secBY + 8 + headProfileH + 10} fill={c.steelFill} fontSize="6" fontWeight="bold">Top Bead</text>

              {/* Continuous Unbroken Direct Glass Pane */}
              <rect x={secBX + secBW / 2 - 3} y={secBY + 8 + headProfileH} width="6" height={secBH - headProfileH - sillProfileH - 16} fill={c.glassFill} stroke={c.glassStroke} strokeWidth="1" />
              <line x1={secBX + secBW / 2 + 8} y1={secBY + 8 + headProfileH + 30} x2={secBX + secBW / 2 + 28} y2={secBY + 8 + headProfileH + 80} stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.6" />

              {/* Break lines */}
              <path d={`M ${secBX + 25} ${secBreakY - 6} L ${secBX + 80} ${secBreakY - 6} L ${secBX + 90} ${secBreakY - 14} L ${secBX + 100} ${secBreakY + 2} L ${secBX + 110} ${secBreakY - 6} L ${secBX + secBW - 25} ${secBreakY - 6}`} fill="none" stroke={c.lineDark} strokeWidth="1" />
              <path d={`M ${secBX + 25} ${secBreakY + 6} L ${secBX + 80} ${secBreakY + 6} L ${secBX + 90} ${secBreakY - 2} L ${secBX + 100} ${secBreakY + 14} L ${secBX + 110} ${secBreakY + 6} L ${secBX + secBW - 25} ${secBreakY + 6}`} fill="none" stroke={c.lineDark} strokeWidth="1" />

              {/* Neoprene Setting Block under glass bottom */}
              <rect x={secBX + secBW / 2 - 8} y={secBY + secBH - sillProfileH - 12} width="16" height="4" fill="#0f172a" />
              <text x={secBX + secBW / 2 - 12} y={secBY + secBH - sillProfileH - 10} fill={c.lineMedium} fontSize="5.5" textAnchor="end">Setting Block</text>

              {/* Snap-in Glazing Bead Bottom */}
              <rect x={secBX + secBW / 2 + 4} y={secBY + secBH - sillProfileH - 22} width="22" height="14" fill={c.beadFill} stroke={c.profileStroke} strokeWidth="1" />
              <line x1={secBX + secBW / 2 + 4} y1={secBY + secBH - sillProfileH - 22} x2={secBX + secBW / 2 + 4} y2={secBY + secBH - sillProfileH - 8} stroke={c.gasket} strokeWidth="2.5" />
              <text x={secBX + secBW / 2 + 30} y={secBY + secBH - sillProfileH - 13} fill={c.steelFill} fontSize="6" fontWeight="bold">Bot Bead</text>

              {/* Fixed Frame Sill Profile */}
              <rect x={secBX + 20} y={secBY + secBH - sillProfileH - 4} width={secBW - 40} height={sillProfileH} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={secBX + 30} y={secBY + secBH - sillProfileH} width={secBW - 60} height={sillProfileH - 8} fill={c.steelFill} fillOpacity="0.75" />
              <circle cx={secBX + 32} cy={secBY + secBH - 14} r="3" fill="none" stroke={c.dimLine} strokeWidth="0.8" />
              <text x={secBX + secBW / 2} y={secBY + secBH - sillProfileH / 2 + 3} fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">FIXED SILL</text>
              <text x={secBX + 12} y={secBY + secBH - sillProfileH / 2} fill={c.lineMedium} fontSize="6.5" textAnchor="end">Sill</text>

              <text x={secBX + secBW / 2} y={secBY + secBH + 12} fill={c.steelFill} fontSize="7" fontWeight="bold" textAnchor="middle">Direct Glazed • No Sash Frame • No Rollers</text>
            </g>
          ) : (
            /* 2.D VENTILATOR SECTION B-B (INCLINED LOUVER BLADES, AIRFLOW) */
            <g id="sec-b-ventilator">
              {/* Ventilator Head Profile */}
              <rect x={secBX + 20} y={secBY + 8} width={secBW - 40} height={headProfileH} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={secBX + 30} y={secBY + 12} width={secBW - 60} height={headProfileH - 8} fill={c.steelFill} fillOpacity="0.75" />
              <text x={secBX + secBW / 2} y={secBY + 8 + headProfileH / 2 + 3} fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">VENTILATOR HEAD</text>
              <text x={secBX + 12} y={secBY + 8 + headProfileH / 2} fill={c.lineMedium} fontSize="6.5" textAnchor="end">Head</text>

              {/* Inclined Louver Blades (4 blades showing air gap) */}
              {[0, 1, 2, 3].map((bIdx) => {
                const bY = secBY + 8 + headProfileH + 20 + bIdx * ((secBH - headProfileH - sillProfileH - 60) / 3);
                return (
                  <g key={`sec-b-louver-${bIdx}`}>
                    {/* Inclined Glass Blade (30° angle) */}
                    <polygon
                      points={`${secBX + 80},${bY - 14} ${secBX + 170},${bY + 8} ${secBX + 168},${bY + 14} ${secBX + 78},${bY - 8}`}
                      fill={c.glassFill}
                      stroke={c.glassStroke}
                      strokeWidth="1"
                    />
                    {/* Pivot clamp */}
                    <circle cx={secBX + 125} cy={bY} r="3.5" fill={c.lineDark} />
                    {/* Airflow curved streamline arrow */}
                    <path
                      d={`M ${secBX + 60} ${bY + 12} Q ${secBX + 110} ${bY + 18} ${secBX + 195} ${bY - 6}`}
                      fill="none"
                      stroke={c.steelFill}
                      strokeWidth="1"
                      strokeDasharray="3 2"
                      markerEnd={`url(#${uniqueId}-slide-arrow)`}
                    />
                  </g>
                );
              })}

              {/* Break lines */}
              <path d={`M ${secBX + 25} ${secBreakY - 6} L ${secBX + 80} ${secBreakY - 6} L ${secBX + 90} ${secBreakY - 14} L ${secBX + 100} ${secBreakY + 2} L ${secBX + 110} ${secBreakY - 6} L ${secBX + secBW - 25} ${secBreakY - 6}`} fill="none" stroke={c.lineDark} strokeWidth="1" />
              <path d={`M ${secBX + 25} ${secBreakY + 6} L ${secBX + 80} ${secBreakY + 6} L ${secBX + 90} ${secBreakY - 2} L ${secBX + 100} ${secBreakY + 14} L ${secBX + 110} ${secBreakY + 6} L ${secBX + secBW - 25} ${secBreakY + 6}`} fill="none" stroke={c.lineDark} strokeWidth="1" />

              {/* Ventilator Sill with Raised Water Stop */}
              <rect x={secBX + 20} y={secBY + secBH - sillProfileH - 4} width={secBW - 40} height={sillProfileH} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              {/* Stepped Water Barrier */}
              <rect x={secBX + 140} y={secBY + secBH - sillProfileH - 9} width="16" height="5" fill={c.steelFill} />
              <text x={secBX + secBW / 2} y={secBY + secBH - sillProfileH / 2 + 3} fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">WEATHER SILL</text>
              <text x={secBX + 12} y={secBY + secBH - sillProfileH / 2} fill={c.lineMedium} fontSize="6.5" textAnchor="end">Sill</text>

              <text x={secBX + secBW / 2} y={secBY + secBH + 12} fill={c.steelFill} fontSize="7" fontWeight="bold" textAnchor="middle">Natural Airflow • Inclined Louvers • Weather Step</text>
            </g>
          )}
        </g>
      )}

      {/* ============================================================= */}
      {/* 3. SECTION A-A (HORIZONTAL PLAN CROSS-SECTION)               */}
      {/* ============================================================= */}
      {(isAllInOne || isSectionAOnly) && (
        <g id="section-aa-group" transform={isSectionAOnly ? `translate(0, 0)` : ''}>
          {/* Header Title */}
          <text
            x={secAX + secAW / 2}
            y={secAY - 10}
            fill={c.lineDark}
            fontSize="10"
            fontWeight="bold"
            letterSpacing="0.8"
            textAnchor="middle"
          >
            {isTamil ? 'செக்ஷன் A-A (கிடைமட்ட பிளான் தோற்றம்)' : 'Section A-A'}
          </text>
          <text
            x={secAX + secAW / 2}
            y={secAY - 1}
            fill={c.lineLight}
            fontSize="7"
            textAnchor="middle"
          >
            {isFixed
              ? 'HORIZONTAL PLAN SECTION (FIXED JAMBS & DIRECT CONTINUOUS GLAZING)'
              : isVentilator
                ? 'HORIZONTAL PLAN SECTION (VENTILATOR JAMBS & LOUVER GALLERY)'
                : isOpen
                  ? 'HORIZONTAL PLAN SECTION (JAMBS, CASEMENT STILES & T-MULLION)'
                  : 'HORIZONTAL PLAN SECTION (JAMBS, STILES & INTERLOCK HOOKS)'}
          </text>

          {/* Container box */}
          <rect
            x={secAX}
            y={secAY + 2}
            width={secAW}
            height={secAH}
            fill={isWhite ? '#ffffff' : '#070b14'}
            stroke={c.titleBorder}
            strokeWidth="0.8"
            rx="2"
          />

          {isSliding ? (
            /* 3.A SLIDING SECTION A-A (INTERLOCK HOOKS) */
            <g id="sec-a-sliding">
              {/* Left Jamb */}
              <rect x={secAX + 8} y={secAY + 14} width={jambProfileW} height={secAH - 28} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={secAX + 12} y={secAY + 20} width={jambProfileW - 8} height={(secAH - 28) * 0.4} fill={c.steelFill} fillOpacity="0.8" />
              <line x1={secAX + 8} y1={secAY + 8} x2={secAX + 8} y2={secAY + secAH - 8} stroke={c.lineDark} strokeWidth="1.5" />
              <text x={secAX + 8 + jambProfileW / 2} y={secAY + secAH - 6} fill={c.lineMedium} fontSize="6.5" textAnchor="middle">Left Jamb</text>

              {/* Left Stile with Woolpile */}
              <rect x={secAX + 8 + jambProfileW + 3} y={secAY + 22} width={26} height={26} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
              <line x1={secAX + 8 + jambProfileW + 1} y1={secAY + 24} x2={secAX + 8 + jambProfileW + 1} y2={secAY + 46} stroke={c.lineDark} strokeWidth="2" strokeDasharray="2 1" />

              {/* Glass Span 1 */}
              <rect x={secAX + 8 + jambProfileW + 29} y={secAY + 33} width={(secAW / 2) - jambProfileW - 44} height={4} fill={c.glassFill} stroke={c.glassStroke} strokeWidth="0.75" />

              {/* Center Interlock J-Hooks */}
              <rect x={midX - 22} y={secAY + 22} width={22} height={26} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
              <path d={`M ${midX} ${secAY + 24} L ${midX + 6} ${secAY + 24} L ${midX + 6} ${secAY + 36} L ${midX + 2} ${secAY + 36}`} fill="none" stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={midX} y={secAY + 34} width={22} height={26} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
              <path d={`M ${midX} ${secAY + 58} L ${midX - 6} ${secAY + 58} L ${midX - 6} ${secAY + 46} L ${midX - 2} ${secAY + 46}`} fill="none" stroke={c.profileStroke} strokeWidth="1.2" />
              <line x1={midX - 3} y1={secAY + 26} x2={midX - 3} y2={secAY + 44} stroke={c.lineDark} strokeWidth="2" strokeDasharray="2 1" />
              <text x={midX} y={secAY + 70} fill={c.steelFill} fontSize="6.5" fontWeight="bold" textAnchor="middle">Interlock Hooks</text>

              {/* Glass Span 2 */}
              <rect x={midX + 22} y={secAY + 45} width={rightStileX - (midX + 22)} height={4} fill={c.glassFill} stroke={c.glassStroke} strokeWidth="0.75" />
              {isMeshWindow && (
                <line x1={midX - 10} y1={secAY + 18} x2={secAX + secAW - 8 - jambProfileW - 4} y2={secAY + 18} stroke={c.meshPatternColor} strokeWidth="1.5" strokeDasharray="2 2" />
              )}

              {/* Right Stile & Right Jamb */}
              <rect x={secAX + secAW - 8 - jambProfileW - 29} y={secAY + 34} width={26} height={26} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
              <rect x={secAX + secAW - 8 - jambProfileW} y={secAY + 14} width={jambProfileW} height={secAH - 28} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={secAX + secAW - 8 - jambProfileW + 4} y={secAY + 20} width={jambProfileW - 8} height={(secAH - 28) * 0.4} fill={c.steelFill} fillOpacity="0.8" />
              <line x1={secAX + secAW - 8} y1={secAY + 8} x2={secAX + secAW - 8} y2={secAY + secAH - 8} stroke={c.lineDark} strokeWidth="1.5" />
              <text x={secAX + secAW - 8 - jambProfileW / 2} y={secAY + secAH - 6} fill={c.lineMedium} fontSize="6.5" textAnchor="middle">Right Jamb</text>
            </g>
          ) : isOpen ? (
            /* 3.B CASEMENT SECTION A-A (T-MULLION / CASEMENT STILES & GASKETS) */
            <g id="sec-a-casement">
              {/* Left Jamb (Hinge Side) */}
              <rect x={secAX + 8} y={secAY + 14} width={jambProfileW} height={secAH - 28} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={secAX + 12} y={secAY + 20} width={jambProfileW - 8} height={(secAH - 28) * 0.45} fill={c.steelFill} fillOpacity="0.8" />
              <line x1={secAX + 8} y1={secAY + 8} x2={secAX + 8} y2={secAY + secAH - 8} stroke={c.lineDark} strokeWidth="1.5" />
              <line x1={secAX + 8 + jambProfileW} y1={secAY + 20} x2={secAX + 8 + jambProfileW} y2={secAY + secAH - 20} stroke={c.gasket} strokeWidth="2" strokeDasharray="3 1" />
              <text x={secAX + 8 + jambProfileW / 2} y={secAY + secAH - 6} fill={c.lineMedium} fontSize="6" textAnchor="middle">Hinge Jamb</text>

              {casementSubtype === 'single' ? (
                // 3.B.1 SINGLE CASEMENT PLAN
                <g>
                  {/* Left Sash Stile */}
                  <rect x={secAX + 8 + jambProfileW + 2} y={secAY + 24} width="24" height={secAH - 48} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1.1" />
                  {/* Single Continuous Glass Pane with Glazing Beads */}
                  <rect x={secAX + 8 + jambProfileW + 26} y={secAY + secAH / 2 - 2} width={secAW - jambProfileW * 2 - 68} height="4" fill={c.glassFill} stroke={c.glassStroke} strokeWidth="0.8" />
                  {/* Right Sash Closing Stile with Espag Handle */}
                  <rect x={secAX + secAW - 8 - jambProfileW - 26} y={secAY + 24} width="24" height={secAH - 48} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1.1" />
                  {/* Espag handle projecting */}
                  <rect x={secAX + secAW - 8 - jambProfileW - 28} y={secAY + secAH / 2 - 5} width="4" height="10" rx="1" fill={c.lineDark} />
                  <text x={secAX + secAW / 2} y={secAY + 68} fill={c.steelFill} fontSize="6.5" fontWeight="bold" textAnchor="middle">
                    {`Single Operable Casement (${panel.heightMM}×${panel.widthMM} mm)`}
                  </text>
                </g>
              ) : (
                // 3.B.2 DOUBLE / TRIPLE WITH CENTRAL T-MULLION
                <g>
                  {/* Left Sash Hinged Stile */}
                  <rect x={secAX + 8 + jambProfileW + 2} y={secAY + 24} width="22" height={secAH - 48} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
                  {/* Glass Pane 1 */}
                  <rect x={secAX + 8 + jambProfileW + 24} y={secAY + secAH / 2 - 2} width={midX - (secAX + 8 + jambProfileW + 40)} height="4" fill={c.glassFill} stroke={c.glassStroke} strokeWidth="0.8" />
                  {/* Left Sash Closing Stile */}
                  <rect x={midX - 32} y={secAY + 24} width="18" height={secAH - 48} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />

                  {/* CENTRAL T-MULLION PROFILE */}
                  <rect x={midX - 12} y={secAY + 14} width="24" height={secAH - 28} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.3" />
                  <rect x={midX - 8} y={secAY + 20} width="16" height={(secAH - 28) * 0.55} fill={c.steelFill} fillOpacity="0.85" />
                  {/* Double Gaskets on Mullion faces */}
                  <line x1={midX - 12} y1={secAY + 20} x2={midX - 12} y2={secAY + secAH - 20} stroke={c.gasket} strokeWidth="2" strokeDasharray="3 1" />
                  <line x1={midX + 12} y1={secAY + 20} x2={midX + 12} y2={secAY + secAH - 20} stroke={c.gasket} strokeWidth="2" strokeDasharray="3 1" />
                  <text x={midX} y={secAY + secAH - 6} fill={c.steelFill} fontSize="6" fontWeight="bold" textAnchor="middle">T-Mullion</text>

                  {/* Right Sash Closing Stile */}
                  <rect x={midX + 14} y={secAY + 24} width="18" height={secAH - 48} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
                  {/* Glass Pane 2 */}
                  <rect x={midX + 32} y={secAY + secAH / 2 - 2} width={secAX + secAW - 8 - jambProfileW - 24 - (midX + 32)} height="4" fill={c.glassFill} stroke={c.glassStroke} strokeWidth="0.8" />
                  {/* Right Sash Hinged Stile */}
                  <rect x={secAX + secAW - 8 - jambProfileW - 24} y={secAY + 24} width="22" height={secAH - 48} fill={c.profileFillDark} stroke={c.profileStroke} strokeWidth="1" />
                </g>
              )}

              {/* Right Jamb */}
              <rect x={secAX + secAW - 8 - jambProfileW} y={secAY + 14} width={jambProfileW} height={secAH - 28} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={secAX + secAW - 8 - jambProfileW + 4} y={secAY + 20} width={jambProfileW - 8} height={(secAH - 28) * 0.45} fill={c.steelFill} fillOpacity="0.8" />
              <line x1={secAX + secAW - 8} y1={secAY + 8} x2={secAX + secAW - 8} y2={secAY + secAH - 8} stroke={c.lineDark} strokeWidth="1.5" />
              <line x1={secAX + secAW - 8 - jambProfileW} y1={secAY + 20} x2={secAX + secAW - 8 - jambProfileW} y2={secAY + secAH - 20} stroke={c.gasket} strokeWidth="2" strokeDasharray="3 1" />
              <text x={secAX + secAW - 8 - jambProfileW / 2} y={secAY + secAH - 6} fill={c.lineMedium} fontSize="6" textAnchor="middle">Lock Jamb</text>
            </g>
          ) : isFixed ? (
            /* 3.C FIXED SECTION A-A (DIRECT GLAZING BEADS, UNBROKEN GLASS) */
            <g id="sec-a-fixed">
              {/* Left Fixed Jamb */}
              <rect x={secAX + 8} y={secAY + 14} width={jambProfileW} height={secAH - 28} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={secAX + 12} y={secAY + 20} width={jambProfileW - 8} height={(secAH - 28) * 0.5} fill={c.steelFill} fillOpacity="0.8" />
              <line x1={secAX + 8} y1={secAY + 8} x2={secAX + 8} y2={secAY + secAH - 8} stroke={c.lineDark} strokeWidth="1.5" />
              <text x={secAX + 8 + jambProfileW / 2} y={secAY + secAH - 6} fill={c.lineMedium} fontSize="6" textAnchor="middle">Left Fixed Jamb</text>

              {/* Snap-in Glazing Bead Left */}
              <rect x={secAX + 8 + jambProfileW} y={secAY + 22} width="16" height={secAH - 44} fill={c.beadFill} stroke={c.profileStroke} strokeWidth="1" />
              <line x1={secAX + 8 + jambProfileW + 16} y1={secAY + 22} x2={secAX + 8 + jambProfileW + 16} y2={secAY + secAH - 22} stroke={c.gasket} strokeWidth="2.5" />

              {/* Continuous Unbroken Direct Glass Pane Across Entire Width */}
              <rect
                x={secAX + 8 + jambProfileW + 16}
                y={secAY + secAH / 2 - 3}
                width={secAW - (jambProfileW * 2 + 48)}
                height="6"
                fill={c.glassFill}
                stroke={c.glassStroke}
                strokeWidth="1"
              />

              {/* Snap-in Glazing Bead Right */}
              <rect x={secAX + secAW - 8 - jambProfileW - 16} y={secAY + 22} width="16" height={secAH - 44} fill={c.beadFill} stroke={c.profileStroke} strokeWidth="1" />
              <line x1={secAX + secAW - 8 - jambProfileW - 16} y1={secAY + 22} x2={secAX + secAW - 8 - jambProfileW - 16} y2={secAY + secAH - 22} stroke={c.gasket} strokeWidth="2.5" />

              {/* Right Fixed Jamb */}
              <rect x={secAX + secAW - 8 - jambProfileW} y={secAY + 14} width={jambProfileW} height={secAH - 28} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <rect x={secAX + secAW - 8 - jambProfileW + 4} y={secAY + 20} width={jambProfileW - 8} height={(secAH - 28) * 0.5} fill={c.steelFill} fillOpacity="0.8" />
              <line x1={secAX + secAW - 8} y1={secAY + 8} x2={secAX + secAW - 8} y2={secAY + secAH - 8} stroke={c.lineDark} strokeWidth="1.5" />
              <text x={secAX + secAW - 8 - jambProfileW / 2} y={secAY + secAH - 6} fill={c.lineMedium} fontSize="6" textAnchor="middle">Right Fixed Jamb</text>

              <rect x={midX - 70} y={secAY + 62} width="140" height="14" rx="2" fill={c.dimBadgeBg} stroke={c.dimBadgeBorder} strokeWidth="0.6" />
              <text x={midX} y={secAY + 72} fill={c.steelFill} fontSize="6.5" fontWeight="bold" textAnchor="middle">
                {`Direct Continuous Glazing (${mirror.widthMM} mm W)`}
              </text>
            </g>
          ) : (
            /* 3.D VENTILATOR SECTION A-A (LOUVER GALLERY & FAN PORT) */
            <g id="sec-a-ventilator">
              {/* Left Jamb */}
              <rect x={secAX + 8} y={secAY + 14} width={jambProfileW} height={secAH - 28} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <line x1={secAX + 8} y1={secAY + 8} x2={secAX + 8} y2={secAY + secAH - 8} stroke={c.lineDark} strokeWidth="1.5" />
              {/* Left Gallery Clip */}
              <rect x={secAX + 8 + jambProfileW} y={secAY + 24} width="10" height={secAH - 48} fill={c.lineDark} rx="1" />
              <text x={secAX + 8 + jambProfileW / 2} y={secAY + secAH - 6} fill={c.lineMedium} fontSize="6" textAnchor="middle">Left Clip</text>

              {ventilatorSubtype === 'fan' ? (
                // Fan + Louver Plan Section
                <g>
                  {ventilatorFanSide === 'left' ? (
                    <g>
                      {/* Fan cut-out section on left */}
                      <rect x={secAX + 8 + jambProfileW + 12} y={secAY + secAH / 2 - 2} width={(midX - (secAX + 8 + jambProfileW + 12)) * 0.3} height="4" fill={c.fanAccent} />
                      <circle cx={secAX + 8 + jambProfileW + (midX - (secAX + 8 + jambProfileW)) * 0.5} cy={secAY + secAH / 2} r="14" fill="none" stroke={c.fanAccent} strokeWidth="1.5" strokeDasharray="3 2" />
                      <rect x={midX - (midX - (secAX + 8 + jambProfileW + 12)) * 0.3} y={secAY + secAH / 2 - 2} width={(midX - (secAX + 8 + jambProfileW + 12)) * 0.3} height="4" fill={c.fanAccent} />
                      <text x={secAX + 8 + jambProfileW + (midX - (secAX + 8 + jambProfileW)) * 0.5} y={secAY + 68} fill={c.fanAccent} fontSize="6" fontWeight="bold" textAnchor="middle">Fan Port (Ø 175mm)</text>

                      {/* Divider */}
                      <rect x={midX - 6} y={secAY + 14} width="12" height={secAH - 28} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1" />

                      {/* Louver blade on right */}
                      <rect x={midX + 10} y={secAY + secAH / 2 - 2.5} width={secAX + secAW - 8 - jambProfileW - 20 - midX} height="5" fill={c.glassFill} stroke={c.glassStroke} strokeWidth="0.8" rx="1.5" />
                      <text x={midX + (secAX + secAW - 8 - jambProfileW - midX) * 0.5} y={secAY + 68} fill={c.steelFill} fontSize="6" fontWeight="bold" textAnchor="middle">Glass Louver Blade</text>
                    </g>
                  ) : (
                    <g>
                      {/* Louver blade on left */}
                      <rect x={secAX + 8 + jambProfileW + 12} y={secAY + secAH / 2 - 2.5} width={midX - (secAX + 8 + jambProfileW + 22)} height="5" fill={c.glassFill} stroke={c.glassStroke} strokeWidth="0.8" rx="1.5" />
                      <text x={secAX + 8 + jambProfileW + (midX - (secAX + 8 + jambProfileW)) * 0.5} y={secAY + 68} fill={c.steelFill} fontSize="6" fontWeight="bold" textAnchor="middle">Glass Louver Blade</text>

                      {/* Divider */}
                      <rect x={midX - 6} y={secAY + 14} width="12" height={secAH - 28} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1" />

                      {/* Fan cut-out on right */}
                      <circle cx={midX + (secAX + secAW - 8 - jambProfileW - midX) * 0.5} cy={secAY + secAH / 2} r="14" fill="none" stroke={c.fanAccent} strokeWidth="1.5" strokeDasharray="3 2" />
                      <text x={midX + (secAX + secAW - 8 - jambProfileW - midX) * 0.5} y={secAY + 68} fill={c.fanAccent} fontSize="6" fontWeight="bold" textAnchor="middle">Fan Port (Ø 175mm)</text>
                    </g>
                  )}
                </g>
              ) : (
                // Normal Louver Plan Section
                <g>
                  <rect x={secAX + 8 + jambProfileW + 12} y={secAY + secAH / 2 - 2.5} width={secAW - (jambProfileW * 2 + 40)} height="5" rx="2" fill={c.glassFill} stroke={c.glassStroke} strokeWidth="0.8" />
                  <text x={midX} y={secAY + 68} fill={c.steelFill} fontSize="6.5" fontWeight="bold" textAnchor="middle">Continuous 4mm Glass Louver Blade</text>
                </g>
              )}

              {/* Right Gallery Clip */}
              <rect x={secAX + secAW - 8 - jambProfileW - 10} y={secAY + 24} width="10" height={secAH - 48} fill={c.lineDark} rx="1" />
              {/* Right Jamb */}
              <rect x={secAX + secAW - 8 - jambProfileW} y={secAY + 14} width={jambProfileW} height={secAH - 28} fill={c.profileFill} stroke={c.profileStroke} strokeWidth="1.2" />
              <line x1={secAX + secAW - 8} y1={secAY + 8} x2={secAX + secAW - 8} y2={secAY + secAH - 8} stroke={c.lineDark} strokeWidth="1.5" />
              <text x={secAX + secAW - 8 - jambProfileW / 2} y={secAY + secAH - 6} fill={c.lineMedium} fontSize="6" textAnchor="middle">Right Clip</text>
            </g>
          )}
        </g>
      )}

      {/* ============================================================= */}
      {/* 4. SHEET FOOTER BAR (MULTI-TIERED TO PREVENT ANY TEXT OVERLAY) */}
      {/* ============================================================= */}
      <g id="cad-sheet-footer">
        <line
          x1="16"
          y1={svgH - 26}
          x2={svgW - 16}
          y2={svgH - 26}
          stroke={c.titleBorder}
          strokeWidth="0.8"
        />
        {/* Row 1: Technical Cut Specifications */}
        <text
          x="28"
          y={svgH - 16}
          fill={c.lineMedium}
          fontSize="7.0"
          fontFamily="monospace"
        >
          {isFixed
            ? `FRAME CUT: ${result.frame.topBottomCutMM}W × ${result.frame.leftRightCutMM}H (45° Mitre) | DIRECT GLASS: ${mirror.heightMM}H × ${mirror.widthMM}W | BEAD: 45° MITRED`
            : isVentilator
              ? `FRAME CUT: ${result.frame.topBottomCutMM}W × ${result.frame.leftRightCutMM}H (45° Mitre) | TYPE: ${ventilatorSubtype === 'fan' ? `FAN PROVISION (${ventilatorFanSide.toUpperCase()}) + LOUVERS` : 'VENTILATOR GLASS LOUVERS'}`
              : isOpen
                ? `FRAME CUT: ${result.frame.topBottomCutMM}W × ${result.frame.leftRightCutMM}H (45° Mitre) | SASH: ${panel.heightMM}H × ${panel.widthMM}W | GLASS: ${mirror.heightMM}H × ${mirror.widthMM}W${(casementSubtype === 'double' || casementSubtype === 'triple') ? ` | MULLION: ${result.mullionMM || result.frame.mullionCutMM || (convertedHeightMM - 6)} mm` : ''}`
                : `FRAME CUT: ${result.frame.topBottomCutMM}W × ${result.frame.leftRightCutMM}H (45° Mitre) | SASH: ${panel.heightMM}H × ${panel.widthMM}W | GLASS: ${mirror.heightMM}H × ${mirror.widthMM}W${additionalPanels?.[0] ? ` | MESH: ${additionalPanels[0].heightMM}H × ${additionalPanels[0].widthMM}W` : ''}`}
        </text>
        {/* Row 2: Right-aligned Authorized Studio Branding */}
        <text
          x={svgW - 28}
          y={svgH - 7}
          fill={c.steelFill}
          fontSize="6.8"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="end"
        >
          {`AUTHENTIC uPVC FABRICATION BLUEPRINT • L.S. INTERIORS`}
        </text>
      </g>
    </svg>
  );
};
