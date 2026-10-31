import React, { useState, useEffect, useRef } from 'react';
import { WindowInput, CalculationResult } from './engine/types';
import { WindowCalculationEngine } from './engine/calculator';
import { Header } from './components/Header';
import { WindowInputForm } from './components/WindowInputForm';
import { CalculationResultCard } from './components/CalculationResultCard';
import { TechnicalPreview2D } from './components/TechnicalPreview2D';
import { HistoryDrawer } from './components/HistoryDrawer';
import { GoldenTestModal } from './components/GoldenTestModal';
import { FormulaSettingsModal } from './components/FormulaSettingsModal';
import { LSInteriorsExportModal } from './components/LSInteriorsExportModal';
import { LegalModal, LegalTab } from './components/LegalModal';
import { useLanguage } from './context/LanguageContext';
import {
  loadStored10Windows,
  saveStored10Windows,
  DEFAULT_10_WINDOWS,
  STORAGE_KEY_SAVED_CALCS,
  createNewWindow
} from './utils/tenWindowsData';
import { computeWindowVariantLabels } from './utils/lsInteriorsSheetCanvas';
import {
  SlidersHorizontal,
  Scissors,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  FileSpreadsheet
} from 'lucide-react';

// Pure helper to safely calculate results for all windows with variant labels (e.g. W1a, W2b)
export const calculateResultsSafely = (windowList: WindowInput[]): CalculationResult[] => {
  const baseResults = windowList.map((w, idx) => {
    const windowLabel = 'W' + (idx + 1);
    const safeWin = {
      ...w,
      windowLabel,
      widthInch: w.widthInch && w.widthInch > 0 ? w.widthInch : 48,
      heightInch: w.heightInch && w.heightInch > 0 ? w.heightInch : 60
    };
    try {
      const calculated = WindowCalculationEngine.calculate(safeWin);
      return {
        ...calculated,
        id: windowLabel,
        input: {
          ...calculated.input,
          windowLabel
        }
      };
    } catch (_) {
      const fallbackWin = { ...safeWin, widthInch: 48, heightInch: 60, windowLabel };
      const calculated = WindowCalculationEngine.calculate(fallbackWin);
      return {
        ...calculated,
        id: windowLabel,
        input: {
          ...calculated.input,
          windowLabel
        }
      };
    }
  });

  const variantLabels = computeWindowVariantLabels(baseResults);
  return baseResults.map((res, idx) => {
    const v = variantLabels[idx];
    const finalLabel = v?.windowLabel || res.input.windowLabel || `W${idx + 1}`;
    return {
      ...res,
      id: finalLabel,
      input: {
        ...res.input,
        windowLabel: finalLabel
      }
    };
  });
};

export const App: React.FC = () => {
  const { t } = useLanguage();

  // Windows Input State (Synchronized with variant labels on first mount)
  const [windows, setWindows] = useState<WindowInput[]>(() => {
    try {
      const stored = loadStored10Windows();
      const initialResults = calculateResultsSafely(stored);
      return stored.map((w, idx) => ({
        ...w,
        windowLabel: initialResults[idx]?.input.windowLabel || `W${idx + 1}`
      }));
    } catch (_) {
      return DEFAULT_10_WINDOWS;
    }
  });
  const [activeWindowIndex, setActiveWindowIndex] = useState<number>(0);

  // Windows Calculated Results (Initialized directly with variant labels)
  const [results, setResults] = useState<CalculationResult[]>(() => {
    try {
      const initialWins = loadStored10Windows();
      return calculateResultsSafely(initialWins);
    } catch (_) {
      return [];
    }
  });

  // Horizontal Phone Carousel: 0: Inputs | 1: Measure Output (mm) | 2: 2D Image
  const [activeScreenIndex, setActiveScreenIndex] = useState<number>(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const rightColumnScrollRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef<boolean>(false);

  // Modals state
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isFormulaSettingsOpen, setIsFormulaSettingsOpen] = useState<boolean>(false);
  const [isLSInteriorsModalOpen, setIsLSInteriorsModalOpen] = useState<boolean>(false);
  const [desktopView, setDesktopView] = useState<'cut' | 'cad' | 'split'>('cut');

  const handleSwitchDesktopView = (view: 'cut' | 'cad' | 'split') => {
    setDesktopView(view);
    if (rightColumnScrollRef.current) {
      rightColumnScrollRef.current.scrollTop = 0;
    }
  };
  const [rulesVersion, setRulesVersion] = useState<number>(0);
  const [isTestsOpen, setIsTestsOpen] = useState<boolean>(false);
  const [isLegalOpen, setIsLegalOpen] = useState<boolean>(false);
  const [legalTab, setLegalTab] = useState<LegalTab>('terms');

  // Saved calculations
  const [savedCalculations, setSavedCalculations] = useState<CalculationResult[]>([]);

  // Load saved history on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(STORAGE_KEY_SAVED_CALCS);
      if (storedHistory) {
        setSavedCalculations(JSON.parse(storedHistory));
      }
    } catch (_) {}

    // Synchronize variant labels on mount
    try {
      const initialWins = loadStored10Windows();
      const initialResults = calculateResultsSafely(initialWins);
      const syncedWins = initialWins.map((w, idx) => ({
        ...w,
        windowLabel: initialResults[idx]?.input.windowLabel || `W${idx + 1}`
      }));
      setWindows(syncedWins);
      setResults(initialResults);
    } catch (_) {}
  }, []);

  // Smooth Horizontal Scroll helper
  const scrollToScreen = (index: number) => {
    setActiveScreenIndex(index);
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const screenWidth = container.clientWidth;
    isProgrammaticScroll.current = true;
    container.scrollTo({
      left: index * screenWidth,
      behavior: 'smooth'
    });
    setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 450);
  };

  // Track horizontal scroll position on touch swipe
  const handleScroll = () => {
    if (isProgrammaticScroll.current || !carouselRef.current) return;
    const container = carouselRef.current;
    const screenWidth = container.clientWidth;
    if (screenWidth > 0) {
      const newIndex = Math.round(container.scrollLeft / screenWidth);
      if (newIndex !== activeScreenIndex && newIndex >= 0 && newIndex <= 2) {
        setActiveScreenIndex(newIndex);
      }
    }
  };



  // Real-time synchronization when any window input changes in WindowInputForm
  const handleWindowsChange = (updatedWindows: WindowInput[]) => {
    const updatedResults = calculateResultsSafely(updatedWindows);
    const syncedWindows = updatedWindows.map((win, idx) => ({
      ...win,
      windowLabel: updatedResults[idx]?.input.windowLabel || `W${idx + 1}`
    }));
    setWindows(syncedWindows);
    saveStored10Windows(syncedWindows);
    setResults(updatedResults);
  };

  // Open L.S. Interiors Order Sheet Modal with guaranteed live, fresh calculations
  const handleOpenLSInteriorsModal = () => {
    const freshResults = calculateResultsSafely(windows);
    setResults(freshResults);
    setIsLSInteriorsModalOpen(true);
  };

  // Primary action: Save all windows & calculate all outputs
  const handleSaveAndCalculateAll = (updatedWindows: WindowInput[]) => {
    const newResults = calculateResultsSafely(updatedWindows);
    const syncedWindows = updatedWindows.map((win, idx) => ({
      ...win,
      windowLabel: newResults[idx]?.input.windowLabel || `W${idx + 1}`
    }));
    setWindows(syncedWindows);
    saveStored10Windows(syncedWindows);
    setResults(newResults);

    // Save active window result to history
    if (newResults[activeWindowIndex]) {
      const activeRes = newResults[activeWindowIndex];
      const updatedHistory = [activeRes, ...savedCalculations.filter((c) => c.id !== activeRes.id)].slice(0, 50);
      setSavedCalculations(updatedHistory);
      try {
        localStorage.setItem(STORAGE_KEY_SAVED_CALCS, JSON.stringify(updatedHistory));
      } catch (_) {}
    }

    // Automatically glide horizontally to Screen 1: Measure Output (mm)
    scrollToScreen(1);
  };

  // Reset to standard dimensions
  const handleResetAll = () => {
    const defaultResults = calculateResultsSafely(DEFAULT_10_WINDOWS);
    const syncedWins = DEFAULT_10_WINDOWS.map((w, idx) => ({
      ...w,
      windowLabel: defaultResults[idx]?.input.windowLabel || `W${idx + 1}`
    }));
    setWindows(syncedWins);
    saveStored10Windows(syncedWins);
    setResults(defaultResults);
    setActiveWindowIndex(0);
  };

  // Re-calculate all current windows when formula deduction numbers are customized
  const handleRulesUpdated = () => {
    setRulesVersion((v) => v + 1);
    const updatedResults = calculateResultsSafely(windows);
    const syncedWins = windows.map((w, idx) => ({
      ...w,
      windowLabel: updatedResults[idx]?.input.windowLabel || `W${idx + 1}`
    }));
    setWindows(syncedWins);
    setResults(updatedResults);
  };

  // Add new window (e.g. W11, W12)
  const handleAddWindow = (currentWindows?: WindowInput[]) => {
    const baseWindows = currentWindows && currentWindows.length > 0 ? currentWindows : windows;
    const nextIdx = baseWindows.length;
    const firstWin = baseWindows[0];
    const newWin = createNewWindow(nextIdx, {
      conversionFactor: firstWin?.conversionFactor ?? 25.4,
      customOffsetMM: Math.max(0, firstWin?.customOffsetMM ?? 5),
      weldingAllowanceMM: 0,
      profileSeries: firstWin?.profileSeries ?? '60mm',
      reinforcementSteel: firstWin?.reinforcementSteel ?? false,
      glassType: firstWin?.glassType ?? '5mm_single',
      inputUnit: firstWin?.unit ?? 'inch'
    });
    const updated = [...baseWindows, newWin];
    const updatedResults = calculateResultsSafely(updated);
    const syncedWins = updated.map((w, idx) => ({
      ...w,
      windowLabel: updatedResults[idx]?.input.windowLabel || `W${idx + 1}`
    }));
    setWindows(syncedWins);
    saveStored10Windows(syncedWins);
    setResults(updatedResults);
    setActiveWindowIndex(nextIdx);
  };

  // Delete window (if more than 1)
  const handleDeleteWindow = (index: number) => {
    if (windows.length <= 1) return;
    const updated = windows.filter((_, i) => i !== index);
    const updatedResults = calculateResultsSafely(updated);
    const syncedWins = updated.map((w, idx) => ({
      ...w,
      windowLabel: updatedResults[idx]?.input.windowLabel || `W${idx + 1}`
    }));
    setWindows(syncedWins);
    saveStored10Windows(syncedWins);
    setResults(updatedResults);
    setActiveWindowIndex((prev) => Math.min(prev, syncedWins.length - 1));
  };

  const handleExportPDF = () => {
    handleOpenLSInteriorsModal();
  };

  const handleDeleteHistory = (id: string) => {
    const updated = savedCalculations.filter((c) => c.id !== id);
    setSavedCalculations(updated);
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_CALCS, JSON.stringify(updated));
    } catch (_) {}
  };

  const handleClearHistory = () => {
    setSavedCalculations([]);
    try {
      localStorage.removeItem(STORAGE_KEY_SAVED_CALCS);
    } catch (_) {}
  };

  const handleSelectFromHistory = (calc: CalculationResult) => {
    const foundIdx = results.findIndex((r) => r.id === calc.id);
    if (foundIdx !== -1) {
      setActiveWindowIndex(foundIdx);
    }
    scrollToScreen(1);
  };

  const handleOpenLegal = (tab: LegalTab) => {
    setLegalTab(tab);
    setIsLegalOpen(true);
  };

  const screenTabs = [
    { label: t('1. அளவு உள்ளீடு', '1. Inputs'), count: windows.length, icon: SlidersHorizontal },
    { label: t('2. வெட்டு அளவுகள்', '2. Cut (mm)'), count: results.length, icon: Scissors },
    { label: t('3. 2D வரைபடம்', '3. 2D CAD'), count: results.length, icon: Eye }
  ];

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* 1. Header (Sticky Top) */}
      <Header
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenFormulaSettings={() => setIsFormulaSettingsOpen(true)}
        onOpenTests={() => setIsTestsOpen(true)}
        onOpenLSInteriorsModal={handleOpenLSInteriorsModal}
        historyCount={savedCalculations.length}
      />

      {/* 2. MOBILE-ONLY Horizontal Phone Nav Pills (< lg screens) */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 flex-shrink-0 select-none">
        <button
          type="button"
          onClick={() => scrollToScreen(Math.max(0, activeScreenIndex - 1))}
          disabled={activeScreenIndex === 0}
          className={
            'w-8 h-8 sm:w-9 sm:h-9 rounded-lg border transition flex items-center justify-center flex-shrink-0 cursor-pointer ' +
            (activeScreenIndex === 0
              ? 'opacity-25 border-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-slate-800 text-slate-200 border-slate-700 active:scale-95')
          }
          title="Previous Screen"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 grid grid-cols-3 gap-1 sm:gap-1.5">
          {screenTabs.map((tab, idx) => {
            const isActive = activeScreenIndex === idx;
            const Icon = tab.icon;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => scrollToScreen(idx)}
                className={
                  'py-2 px-1 sm:px-2 rounded-xl text-center flex items-center justify-center space-x-1 sm:space-x-1.5 transition border cursor-pointer touch-manipulation ' +
                  (isActive
                    ? 'bg-blue-600 border-blue-500 text-white font-bold'
                    : 'bg-slate-950 hover:bg-slate-850 border-slate-800 text-slate-300 hover:text-white')
                }
              >
                <Icon className={'w-3.5 h-3.5 flex-shrink-0 ' + (isActive ? 'text-white' : 'text-slate-400')} />
                <span className="text-xs font-heading font-semibold truncate">
                  {tab.label}
                </span>
                <span
                  className={
                    'text-[10px] px-1.5 py-0.5 rounded font-mono font-bold hidden xs:inline-block ' +
                    (isActive
                      ? 'bg-blue-900 text-white'
                      : 'bg-slate-800 text-slate-200')
                  }
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollToScreen(Math.min(2, activeScreenIndex + 1))}
          disabled={activeScreenIndex === 2}
          className={
            'w-8 h-8 sm:w-9 sm:h-9 rounded-lg border transition flex items-center justify-center flex-shrink-0 cursor-pointer ' +
            (activeScreenIndex === 2
              ? 'opacity-25 border-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-slate-800 text-slate-200 border-slate-700 active:scale-95')
          }
          title="Next Screen"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 3. MOBILE-ONLY Horizontal Phone Responsive Carousel (< lg screens) */}
      <main
        ref={carouselRef}
        onScroll={handleScroll}
        className="lg:hidden flex-1 flex flex-row overflow-x-auto snap-x snap-mandatory overflow-y-hidden select-none no-scrollbar touch-pan-x w-full"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* SCREEN 1: INPUTS */}
        <section className="w-full min-w-full flex-shrink-0 snap-center h-full overflow-y-auto overflow-x-hidden p-2 sm:p-4 md:p-6 overscroll-contain">
          <div className="w-full max-w-xl md:max-w-2xl mx-auto min-h-full flex flex-col justify-start pb-8">
            <WindowInputForm
              windows={windows}
              onWindowsChange={handleWindowsChange}
              onSaveAndCalculateAll={handleSaveAndCalculateAll}
              onResetAll={handleResetAll}
              activeWindowIndex={activeWindowIndex}
              onSelectWindowIndex={setActiveWindowIndex}
              onAddWindow={handleAddWindow}
              onDeleteWindow={handleDeleteWindow}
              onOpenFormulaSettings={() => setIsFormulaSettingsOpen(true)}
              rulesVersion={rulesVersion}
            />
          </div>
        </section>

        {/* SCREEN 2: MEASURE OUTPUTS (MM) */}
        <section className="w-full min-w-full flex-shrink-0 snap-center h-full overflow-y-auto overflow-x-hidden p-2 sm:p-4 md:p-6 overscroll-contain">
          <div className="w-full max-w-xl md:max-w-2xl mx-auto min-h-full flex flex-col justify-start pb-8">
            <CalculationResultCard
              results={results}
              selectedIndex={activeWindowIndex}
              onSelectIndex={setActiveWindowIndex}
              onViewImages={() => scrollToScreen(2)}
              onExportPDF={handleExportPDF}
              onExportLSInteriorsPDF={handleOpenLSInteriorsModal}
            />
          </div>
        </section>

        {/* SCREEN 3: 2D CAD BLUEPRINT IMAGES */}
        <section className="w-full min-w-full flex-shrink-0 snap-center h-full overflow-y-auto overflow-x-hidden p-2 sm:p-4 md:p-6 overscroll-contain">
          <div className="w-full max-w-xl md:max-w-2xl mx-auto min-h-full flex flex-col justify-start pb-8 space-y-3">
            <TechnicalPreview2D
              results={results}
              selectedIndex={activeWindowIndex}
              onSelectIndex={setActiveWindowIndex}
              onExportPDF={handleExportPDF}
              onExportLSInteriorsPDF={handleOpenLSInteriorsModal}
            />

            {/* Quick legal/policy footer at bottom of drawing */}
            <div className="pt-2 pb-4 flex items-center justify-center space-x-3 text-[10px] text-slate-500">
              <button
                type="button"
                onClick={() => handleOpenLegal('terms')}
                className="hover:text-slate-300 transition cursor-pointer flex items-center space-x-1"
              >
                <FileText className="w-3 h-3" />
                <span>Terms</span>
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => handleOpenLegal('privacy')}
                className="hover:text-slate-300 transition cursor-pointer flex items-center space-x-1"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>Privacy</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 4. TRUE DESKTOP TWO-PANE WORKSPACE STUDIO (>= lg screens: 1024px, 1080p, 2K, 4K) */}
      <div className="hidden lg:flex flex-1 min-h-0 w-full max-w-7xl 2xl:max-w-[1700px] mx-auto overflow-hidden">
        {/* LEFT COLUMN: INPUTS & SETTINGS */}
        <section className="w-1/2 xl:w-[48%] h-full overflow-y-auto border-r border-slate-800/80 p-4 xl:p-6 overscroll-contain">
          <div className="w-full max-w-3xl mx-auto pb-24">
            <WindowInputForm
              windows={windows}
              onWindowsChange={handleWindowsChange}
              onSaveAndCalculateAll={handleSaveAndCalculateAll}
              onResetAll={handleResetAll}
              activeWindowIndex={activeWindowIndex}
              onSelectWindowIndex={setActiveWindowIndex}
              onAddWindow={handleAddWindow}
              onDeleteWindow={handleDeleteWindow}
              onOpenFormulaSettings={() => setIsFormulaSettingsOpen(true)}
              rulesVersion={rulesVersion}
            />
          </div>
        </section>

        {/* RIGHT COLUMN: CALCULATION RESULTS & 2D BLUEPRINT */}
        <section className="w-1/2 xl:w-[52%] h-full flex flex-col overflow-hidden bg-slate-950/40">
          {/* Top Desktop Studio Toolbar (Opaque & Non-Bleeding) */}
          <div className="px-3 sm:px-4 py-2 border-b border-slate-800 bg-slate-900 z-10 shadow-sm flex items-center justify-between gap-2 flex-shrink-0 select-none">
            {/* View Switcher Tabs */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800/90 shadow-inner flex-shrink-0">
              <button
                type="button"
                onClick={() => handleSwitchDesktopView('cut')}
                className={
                  'px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-heading font-bold flex items-center space-x-1.5 whitespace-nowrap transition cursor-pointer ' +
                  (desktopView === 'cut'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850')
                }
              >
                <Scissors className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{t('வெட்டு அளவுகள்', 'Cutting Specs')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchDesktopView('cad')}
                className={
                  'px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-heading font-bold flex items-center space-x-1.5 whitespace-nowrap transition cursor-pointer ' +
                  (desktopView === 'cad'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850')
                }
              >
                <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{t('2D வரைபடம்', '2D Drawings')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchDesktopView('split')}
                className={
                  'px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-heading font-bold flex items-center space-x-1.5 whitespace-nowrap transition cursor-pointer ' +
                  (desktopView === 'split'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850')
                }
              >
                <SlidersHorizontal className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{t('இரண்டும்', 'Split View')}</span>
              </button>
            </div>

            {/* Direct L.S. Interiors Order Sheet PDF Action (Visible on xl+ screens where width permits) */}
            <button
              type="button"
              onClick={handleOpenLSInteriorsModal}
              className="hidden xl:flex px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs font-bold items-center space-x-1.5 border border-blue-400 shadow-md transition cursor-pointer touch-manipulation whitespace-nowrap flex-shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-200 flex-shrink-0" />
              <span>{t('PDF ஆர்டர் தாள்', 'PDF Order Sheet')}</span>
            </button>
          </div>

          {/* Scrollable Right Pane Content */}
          <div ref={rightColumnScrollRef} className="flex-1 overflow-y-auto p-4 xl:p-6 overscroll-contain">
            <div className="w-full max-w-3xl mx-auto space-y-6 pb-24">
              {(desktopView === 'cut' || desktopView === 'split') && (
                <CalculationResultCard
                  results={results}
                  selectedIndex={activeWindowIndex}
                  onSelectIndex={setActiveWindowIndex}
                  onViewImages={() => setDesktopView('cad')}
                  onExportPDF={handleExportPDF}
                  onExportLSInteriorsPDF={handleOpenLSInteriorsModal}
                />
              )}

              {(desktopView === 'cad' || desktopView === 'split') && (
                <TechnicalPreview2D
                  results={results}
                  selectedIndex={activeWindowIndex}
                  onSelectIndex={setActiveWindowIndex}
                  onExportPDF={handleExportPDF}
                  onExportLSInteriorsPDF={handleOpenLSInteriorsModal}
                />
              )}

              {/* Desktop Footer Legal Links */}
              <div className="pt-4 border-t border-slate-850 flex items-center justify-between text-xs text-slate-500">
                <span>© {new Date().getFullYear()} L.S. INTERIORS • Desktop Edition</span>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => handleOpenLegal('terms')}
                    className="hover:text-slate-300 transition cursor-pointer"
                  >
                    Terms
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleOpenLegal('privacy')}
                    className="hover:text-slate-300 transition cursor-pointer"
                  >
                    Privacy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        savedCalculations={savedCalculations}
        onSelectCalculation={handleSelectFromHistory}
        onDeleteCalculation={handleDeleteHistory}
        onClearAll={handleClearHistory}
      />

      {/* Golden Test Verification Modal */}
      <GoldenTestModal
        isOpen={isTestsOpen}
        onClose={() => setIsTestsOpen(false)}
      />

      {/* L.S. INTERIORS Workshop Order Sheet PDF Modal */}
      <LSInteriorsExportModal
        isOpen={isLSInteriorsModalOpen}
        onClose={() => setIsLSInteriorsModalOpen(false)}
        results={results}
      />

      {/* Customizable Formula Numbers Modal (Fixed operations, editable deduction values) */}
      <FormulaSettingsModal
        isOpen={isFormulaSettingsOpen}
        onClose={() => setIsFormulaSettingsOpen(false)}
        onRulesUpdated={handleRulesUpdated}
        initialTabKey={(() => {
          const activeWin = windows[activeWindowIndex];
          if (!activeWin) return '2-track_sliding';
          if (activeWin.windowType === 'sliding') {
            if (activeWin.profileSeries === '65mm') {
              if (activeWin.frameType === '3.5-track' || activeWin.frameType === '3-track') return '3-track_sliding_65mm';
              return '2-track_sliding_65mm';
            }
            if (activeWin.frameType === '2.5-track') return '2.5-track_sliding';
            if (activeWin.frameType === '3.5-track' || activeWin.frameType === '3-track') return '3-track_sliding';
            if (activeWin.frameType === '4-track') return '4-track_sliding';
            return '2-track_sliding';
          }
          if (activeWin.windowType === 'ventilator') return 'no-track_ventilator';
          if (activeWin.windowType === 'fixed') return 'no-track_fixed';
          if (activeWin.casementSubtype === 'triple') return 'no-track_open_triple';
          if (activeWin.casementSubtype === 'double') return 'no-track_open_double';
          return 'no-track_open';
        })()}
      />

      {/* Legal & Privacy Policy Modal */}
      <LegalModal
        isOpen={isLegalOpen}
        onClose={() => setIsLegalOpen(false)}
        initialTab={legalTab}
      />
    </div>
  );
};
