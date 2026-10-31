import React, { useState, useEffect } from 'react';
import { ProfileRule } from '../engine/types';
import { RulesEngineManager, WORKSHOP_REFERENCE_PRESET } from '../engine/rules';
import { X, Check, SlidersHorizontal, Info, Sparkles, History } from 'lucide-react';
import { LanguageSwitch } from './LanguageSwitch';
import { useLanguage } from '../context/LanguageContext';

interface FormulaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRulesUpdated: () => void;
  initialTabKey?: string;
}

interface WindowConfigOption {
  key: string;
  name: string;
  tamilName: string;
  category: 'sliding' | 'open' | 'fixed' | 'ventilator';
  icon: string;
}

const STORAGE_KEY_LAST_USED_TAB = 'windowbuilder_last_used_formula_tab';

const WINDOW_CONFIG_LIST: WindowConfigOption[] = [
  { key: '2-track_sliding', name: '2 Track Sliding (58mm)', tamilName: '2 டிராக் ஸ்லைடிங் (58mm)', category: 'sliding', icon: '🪟' },
  { key: '2-track_sliding_65mm', name: '2 Track Sliding (65mm)', tamilName: '2 டிராக் ஸ்லைடிங் (65mm)', category: 'sliding', icon: '🪟' },
  { key: '2.5-track_sliding', name: '2.5 Track Sliding (Mesh)', tamilName: '2.5 டிராக் கொசுவலை', category: 'sliding', icon: '🦟' },
  { key: '3-track_sliding', name: '3 Track Sliding (58mm)', tamilName: '3 டிராக் ஸ்லைடிங் (58mm)', category: 'sliding', icon: '🪟' },
  { key: '3-track_sliding_65mm', name: '3 Track Sliding (65mm)', tamilName: '3 டிராக் ஸ்லைடிங் (65mm)', category: 'sliding', icon: '🪟' },
  { key: '4-track_sliding', name: '4 Track Sliding', tamilName: '4 டிராக் ஸ்லைடிங்', category: 'sliding', icon: '🪟' },
  { key: 'no-track_open', name: 'Single Window', tamilName: 'தனி திறக்கும் ஜன்னல் (1 Shutter)', category: 'open', icon: '🚪' },
  { key: 'no-track_open_double', name: 'Double Window', tamilName: 'இரட்டை திறக்கும் ஜன்னல் (2 Shutter + Mullion)', category: 'open', icon: '🚪' },
  { key: 'no-track_open_triple', name: '3-Open Window', tamilName: '3-திறக்கும் ஜன்னல் (3 Shutter + 2 Mullion)', category: 'open', icon: '🚪' },
  { key: 'no-track_fixed', name: 'Fixed Window Direct Glazing', tamilName: 'நிலையான ஜன்னல் (Direct Glazing)', category: 'fixed', icon: '🖼️' },
  { key: 'no-track_ventilator', name: 'Ventilator Frame', tamilName: 'வென்டிலேட்டர் (நேரடி அங்குலம் → MM)', category: 'ventilator', icon: '💨' }
];

export const FormulaSettingsModal: React.FC<FormulaSettingsModalProps> = ({
  isOpen,
  onClose,
  onRulesUpdated,
  initialTabKey,
}) => {
  const { t, isTamil } = useLanguage();
  const [activeTabKey, setActiveTabKey] = useState<string>(initialTabKey || '2-track_sliding');
  const [rules, setRules] = useState<Record<string, ProfileRule>>({});
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Initialize rules from RulesEngineManager on open (always retrieves last used formula)
  useEffect(() => {
    if (isOpen) {
      RulesEngineManager.initialize();
      setRules(RulesEngineManager.getAllActiveRules());
      setIsSaved(false);
      if (initialTabKey) {
        setActiveTabKey(initialTabKey);
        try {
          localStorage.setItem(STORAGE_KEY_LAST_USED_TAB, initialTabKey);
        } catch (_) {}
      } else {
        try {
          const lastTab = localStorage.getItem(STORAGE_KEY_LAST_USED_TAB);
          if (lastTab && WINDOW_CONFIG_LIST.some((w) => w.key === lastTab)) {
            setActiveTabKey(lastTab);
          }
        } catch (_) {}
      }
    }
  }, [isOpen, initialTabKey]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentRule = rules[activeTabKey] || WORKSHOP_REFERENCE_PRESET.rules[activeTabKey];

  const handleTabSelect = (tabKey: string) => {
    setActiveTabKey(tabKey);
    try {
      localStorage.setItem(STORAGE_KEY_LAST_USED_TAB, tabKey);
    } catch (_) {}
  };

  const updateCurrentRuleField = (field: keyof ProfileRule, val: number) => {
    setIsSaved(false);
    setRules((prev) => {
      const copy = { ...prev };
      const current = copy[activeTabKey] || { ...WORKSHOP_REFERENCE_PRESET.rules[activeTabKey] };
      const updatedRule: ProfileRule = {
        ...current,
        [field]: val,
      };
      copy[activeTabKey] = updatedRule;

      // Keep 3.5-track_sliding in sync with 3-track_sliding
      if (activeTabKey === '3-track_sliding') {
        const current3_5 = copy['3.5-track_sliding'] || { ...WORKSHOP_REFERENCE_PRESET.rules['3.5-track_sliding'] };
        const updated3_5: ProfileRule = {
          ...current3_5,
          [field]: val,
        };
        copy['3.5-track_sliding'] = updated3_5;
        try {
          RulesEngineManager.updateRule('3.5-track_sliding', updated3_5, 'User');
        } catch (_) {}
      }

      // Auto-save so last used formula is instantly remembered & retrieved
      try {
        RulesEngineManager.updateRule(activeTabKey, updatedRule, 'User');
      } catch (_) {}

      return copy;
    });

    // Trigger live recalculation so windows update in real-time
    onRulesUpdated();
  };

  const handleSaveAll = () => {
    // Commit all modified rules into RulesEngineManager (persists to localStorage)
    Object.entries(rules).forEach(([key, rule]) => {
      try {
        RulesEngineManager.updateRule(key, rule, 'User');
      } catch (_) {}
    });

    setIsSaved(true);
    onRulesUpdated();
    setTimeout(() => {
      onClose();
    }, 450);
  };

  // Helper live formula description
  const getLiveFormulaTag = () => {
    if (!currentRule) return '';
    if (activeTabKey === '2-track_sliding') {
      return `H-${currentRule.heightDeductionMM} | W/2-${currentRule.widthDeductionMM} | Glass -${currentRule.mirrorHeightDeductionMM} | 58mm`;
    }
    if (activeTabKey === '2-track_sliding_65mm') {
      return `H-${currentRule.heightDeductionMM} | (W-${currentRule.widthDeductionMM})/2 | Glass -${currentRule.mirrorHeightDeductionMM} | 65mm`;
    }
    if (activeTabKey === '2.5-track_sliding') {
      return `H-${currentRule.heightDeductionMM} | W/2-${currentRule.widthDeductionMM} | Mesh H-${currentRule.meshHeightDeductionMM ?? 2} | Mesh W/2-${currentRule.meshWidthDeductionMM ?? 10} | Glass -${currentRule.mirrorHeightDeductionMM} | 58mm`;
    }
    if (activeTabKey === '3-track_sliding') {
      return `H-${currentRule.heightDeductionMM} | W/3-${currentRule.widthDeductionMM} | Glass -${currentRule.mirrorHeightDeductionMM} | 58mm`;
    }
    if (activeTabKey === '3-track_sliding_65mm') {
      const wAdd = currentRule.widthAdditionMM ?? 48;
      return `H-${currentRule.heightDeductionMM} | (W+${wAdd})/3 | Glass -${currentRule.mirrorHeightDeductionMM} | 65mm`;
    }
    if (activeTabKey === '4-track_sliding') {
      const wAdd = currentRule.widthAdditionMM ?? 11;
      return `H-${currentRule.heightDeductionMM} | W/4+${wAdd} | Glass -${currentRule.mirrorHeightDeductionMM} | 58mm`;
    }
    if (activeTabKey === 'no-track_open') {
      return `H-${currentRule.heightDeductionMM} | W-${currentRule.widthDeductionMM} | Glass -${currentRule.mirrorHeightDeductionMM}`;
    }
    if (activeTabKey === 'no-track_open_double') {
      return `H-${currentRule.heightDeductionMM} | W/2-${currentRule.widthDeductionMM} | Mullion H-${currentRule.mullionDeductionMM ?? (currentRule.mullionSashDeductionMM ?? 6)} | Glass -${currentRule.mirrorHeightDeductionMM}`;
    }
    if (activeTabKey === 'no-track_open_triple') {
      return `H-${currentRule.heightDeductionMM} | W/3-${currentRule.widthDeductionMM} | Mullion H-${currentRule.mullionDeductionMM ?? (currentRule.mullionSashDeductionMM ?? 6)} | Glass -${currentRule.mirrorHeightDeductionMM}`;
    }
    if (activeTabKey === 'no-track_fixed') {
      return `Direct Glazing: W-${currentRule.mirrorWidthDeductionMM ?? 96} | H-${currentRule.mirrorHeightDeductionMM ?? 96}`;
    }
    if (activeTabKey === 'no-track_ventilator') {
      return 'Direct Inch → MM | Outer Frame Only (No Added MM)';
    }
    return '';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 overflow-y-auto backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-2xl sm:max-w-3xl rounded-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <SlidersHorizontal className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-heading font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>{t('சூத்திர எண்கள் மாற்றம்', 'Formula Settings')}</span>
                <span className="text-xs font-normal text-blue-400 font-sans hidden xs:inline">
                  • {t('எண்களை தனிப்பயனாக்கு', 'Customize Formula Numbers')}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t(
                  'செயல்பாடுகள் மாறாது (H -, W/2 - நிலையானது). எண்களை மட்டும் மாற்றலாம்.',
                  'Operations are fixed (H -, W/2 -). Customize deduction numbers only.'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* APP LANGUAGE SETTING (ENGLISH & TAMIL SWITCH BUTTON) */}
        <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-200">
              {t('செயலி மொழி (App Language):', 'App Language Settings:')}
            </span>
            <span className="text-[11px] text-slate-400">
              {t('ஆங்கிலம் / தமிழ் மாற்று பொத்தான்', 'English / Tamil Switch Button')}
            </span>
          </div>
          <LanguageSwitch variant="full" />
        </div>

        {/* WINDOW CONFIG SELECTOR TABS */}
        <div className="bg-slate-950/70 border-b border-slate-800 px-3 py-2 flex items-center gap-1.5 overflow-x-auto flex-shrink-0">
          {WINDOW_CONFIG_LIST.map((item) => {
            const isSelected = activeTabKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleTabSelect(item.key)}
                className={
                  'py-1.5 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center space-x-1.5 flex-shrink-0 ' +
                  (isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/20'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800')
                }
              >
                <span>{item.icon}</span>
                <span>{isTamil ? item.tamilName : item.name}</span>
              </button>
            );
          })}
        </div>

        {/* MODAL BODY (FORMULA DEDUCTION NUMBERS FOR ACTIVE WINDOW TYPE) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Active Window Header Card */}
          <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs text-blue-400 font-bold uppercase tracking-wider block">
                {isTamil
                  ? WINDOW_CONFIG_LIST.find((w) => w.key === activeTabKey)?.tamilName
                  : WINDOW_CONFIG_LIST.find((w) => w.key === activeTabKey)?.category.toUpperCase()}
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">
                {WINDOW_CONFIG_LIST.find((w) => w.key === activeTabKey)?.name}
              </h3>
            </div>
            <div className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {getLiveFormulaTag()}
              </span>
            </div>
          </div>

          {/* DEDUCTIONS EDITOR */}
          {currentRule && (
            <div className="space-y-3.5">
              {/* Ventilator Standard Info Banner */}
              {activeTabKey === 'no-track_ventilator' && (
                <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                    <Info className="w-5 h-5 flex-shrink-0" />
                    <span>{t('வென்டிலேட்டர் நிலையான சூத்திரம் (Ventilator Standard)', 'Ventilator Standard Formula')}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {t(
                      'வென்டிலேட்டருக்கு நேரடி அங்குலம் முதல் மிமீ வரை மாற்றம் மட்டுமே செய்யப்படுகிறது (1" = 25.4 மிமீ). இதில் கூடுதல் மார்ஜின் mm சேர்க்கப்படாது. சஷ் பிரேம் அல்லது கண்ணாடி வெட்டு அளவுகள் தேவையில்லை.',
                      'For ventilators, direct inch to mm conversion is performed (1" = 25.4 mm). No extra deduction margins are applied. Sash frame or glass cut sizes are not required.'
                    )}
                  </p>
                </div>
              )}

              {/* 1. SHUTTER HEIGHT DEDUCTION (Not needed for direct fixed window or ventilator) */}
              {activeTabKey !== 'no-track_fixed' && activeTabKey !== 'no-track_ventilator' && (
                <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 space-y-2">
                  <div className="flex items-start sm:items-center justify-between gap-1.5 flex-wrap">
                    <div>
                      <label className="text-xs font-bold text-slate-200 block">
                        {t('1. சஷ் உயரம் கழிப்பு (Shutter Height Deduction):', '1. Shutter Height Deduction:')}
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {t('மொத்த உயரத்தில் (H) இருந்து கழிக்கப்படும் மிமீ அளவு', 'Deduction in mm subtracted from total outer height (H)')}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900">
                      {'Shutter H = H - ' + currentRule.heightDeductionMM}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-sm font-mono text-slate-300 font-bold">H −</span>
                    <div className="flex items-center space-x-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentRuleField(
                            'heightDeductionMM',
                            Math.max(0, currentRule.heightDeductionMM - 1)
                          )
                        }
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="250"
                        value={currentRule.heightDeductionMM}
                        onChange={(e) =>
                          updateCurrentRuleField(
                            'heightDeductionMM',
                            Math.max(0, parseInt(e.target.value) || 0)
                          )
                        }
                        className="flex-1 h-10 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono text-base font-bold text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentRuleField(
                            'heightDeductionMM',
                            currentRule.heightDeductionMM + 1
                          )
                        }
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-bold text-slate-400">mm</span>
                  </div>
                </div>
              )}

              {/* 2. SHUTTER WIDTH DEDUCTION / ADDITION */}
              {activeTabKey !== 'no-track_fixed' && activeTabKey !== 'no-track_ventilator' && (
                <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 space-y-2">
                  <div className="flex items-start sm:items-center justify-between gap-1.5 flex-wrap">
                    <div>
                      <label className="text-xs font-bold text-slate-200 block">
                        {activeTabKey === '4-track_sliding'
                          ? t('2. சஷ் அகலம் கூட்டல் (Shutter Width Addition):', '2. Shutter Width Addition:')
                          : t('2. சஷ் அகலம் கழிப்பு (Shutter Width Deduction):', '2. Shutter Width Deduction:')}
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {activeTabKey === '4-track_sliding'
                          ? t('அகலத்தில் (W/4) உடன் கூட்டப்படும் மிமீ அளவு', 'Addition in mm added to width quarter (W / 4)')
                          : (activeTabKey === '3-track_sliding_65mm'
                            ? t('அகலத்தில் (W) கூட்டப்பட்டு 3 ஆல் வகுக்கப்படும் மிமீ ((W + 48) / 3)', 'Addition in mm added to width before dividing by 3 ((W + 48) / 3)')
                            : (activeTabKey === '2-track_sliding_65mm'
                              ? t('அகலத்தில் (W) கழிக்கப்பட்டு 2 ஆல் வகுக்கப்படும் மிமீ ((W - 22) / 2)', 'Deduction in mm subtracted from width before dividing by 2 ((W - 22) / 2)')
                              : t('அகலத்தில் (W) இருந்து கழிக்கப்படும் மிமீ அளவு', 'Deduction in mm subtracted from width (W)')))}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900">
                      {activeTabKey === 'no-track_open'
                        ? 'Shutter W = W - ' + currentRule.widthDeductionMM
                        : (activeTabKey === '2-track_sliding_65mm'
                          ? 'Shutter W = (W - ' + currentRule.widthDeductionMM + ') / 2'
                          : (activeTabKey === '3-track_sliding_65mm'
                            ? 'Shutter W = (W + ' + (currentRule.widthAdditionMM ?? 48) + ') / 3'
                            : (activeTabKey === '3-track_sliding' || activeTabKey === 'no-track_open_triple'
                              ? 'Shutter W = (W / 3) - ' + currentRule.widthDeductionMM
                              : (activeTabKey === '4-track_sliding'
                                ? 'Shutter W = (W / 4) + ' + (currentRule.widthAdditionMM ?? 11)
                                : 'Shutter W = (W / 2) - ' + currentRule.widthDeductionMM))))}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-sm font-mono text-slate-300 font-bold">
                      {activeTabKey === 'no-track_open'
                        ? 'W −'
                        : (activeTabKey === '2-track_sliding_65mm'
                          ? '(W −'
                          : (activeTabKey === '3-track_sliding_65mm'
                            ? '(W +'
                            : (activeTabKey === '3-track_sliding' || activeTabKey === 'no-track_open_triple'
                              ? '(W / 3) −'
                              : (activeTabKey === '4-track_sliding' ? '(W / 4) +' : '(W / 2) −'))))}
                    </span>
                    <div className="flex items-center space-x-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeTabKey === '4-track_sliding' || activeTabKey === '3-track_sliding_65mm') {
                            const defVal = activeTabKey === '3-track_sliding_65mm' ? 48 : 11;
                            updateCurrentRuleField(
                              'widthAdditionMM',
                              Math.max(0, (currentRule.widthAdditionMM ?? defVal) - 1)
                            );
                          } else {
                            updateCurrentRuleField(
                              'widthDeductionMM',
                              Math.max(0, currentRule.widthDeductionMM - 1)
                            );
                          }
                        }}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="250"
                        value={
                          activeTabKey === '4-track_sliding'
                            ? (currentRule.widthAdditionMM ?? 11)
                            : (activeTabKey === '3-track_sliding_65mm'
                              ? (currentRule.widthAdditionMM ?? 48)
                              : currentRule.widthDeductionMM)
                        }
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          if (activeTabKey === '4-track_sliding' || activeTabKey === '3-track_sliding_65mm') {
                            updateCurrentRuleField('widthAdditionMM', val);
                          } else {
                            updateCurrentRuleField('widthDeductionMM', val);
                          }
                        }}
                        className="flex-1 h-10 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono text-base font-bold text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (activeTabKey === '4-track_sliding' || activeTabKey === '3-track_sliding_65mm') {
                            const defVal = activeTabKey === '3-track_sliding_65mm' ? 48 : 11;
                            updateCurrentRuleField(
                              'widthAdditionMM',
                              (currentRule.widthAdditionMM ?? defVal) + 1
                            );
                          } else {
                            updateCurrentRuleField(
                              'widthDeductionMM',
                              currentRule.widthDeductionMM + 1
                            );
                          }
                        }}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-bold text-slate-400 font-mono">
                      {activeTabKey === '2-track_sliding_65mm'
                        ? ') / 2 mm'
                        : (activeTabKey === '3-track_sliding_65mm' ? ') / 3 mm' : 'mm')}
                    </span>
                  </div>
                </div>
              )}

              {/* Sliding Material Specification Banner (2T, 2.5T, 3T, 4T: 58mm vs 65mm Material) */}
              {(activeTabKey === '2-track_sliding' ||
                activeTabKey === '2-track_sliding_65mm' ||
                activeTabKey === '2.5-track_sliding' ||
                activeTabKey === '3-track_sliding' ||
                activeTabKey === '3-track_sliding_65mm' ||
                activeTabKey === '4-track_sliding') && (
                <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-200 block">
                      {t('மெட்டீரியல் விவரக்குறிப்பு (Material Profile Depth):', 'Material Profile Depth:')}
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {activeTabKey.includes('65mm')
                        ? t('ஸ்லைடிங் விண்டோ மெட்டீரியல் தடிமன் (Material 65mm)', 'Sliding window material profile thickness (65mm)')
                        : t('ஸ்லைடிங் விண்டோ மெட்டீரியல் தடிமன் (Material 58mm)', 'Sliding window material profile thickness (58mm)')}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/50 px-2.5 py-1 rounded border border-amber-900">
                    {activeTabKey.includes('65mm') ? '65 mm Material' : `${currentRule.profileDepthMM ?? 58} mm Material`}
                  </span>
                </div>
              )}

              {/* 3. GLASS / MIRROR DEDUCTION */}
              {activeTabKey !== 'no-track_ventilator' && (
                <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 space-y-2">
                  <div className="flex items-start sm:items-center justify-between gap-1.5 flex-wrap">
                    <div>
                      <label className="text-xs font-bold text-slate-200 block">
                        {activeTabKey === 'no-track_fixed'
                          ? t('கண்ணாடி அளவு கழிப்பு (Direct Outer Frame Glass Deduction):', 'Glass Deduction (Direct Outer Frame):')
                          : t('3. கண்ணாடி அளவு கழிப்பு (Glass / Mirror Deduction from Shutter):', '3. Glass / Mirror Deduction (from Shutter):')}
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {activeTabKey === 'no-track_fixed'
                          ? t('வெளிப்புற ஃபிரேமில் இருந்து கண்ணாடிக்கு கழிக்கப்படும் மிமீ (OU - deduction)', 'Deduction in mm from outer frame (OU - deduction)')
                          : t('சஷ் அளவிலிருந்து கண்ணாடிக்கு கழிக்கப்படும் மிமீ அளவு', 'Deduction in mm subtracted from shutter size')}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900">
                      {activeTabKey === 'no-track_fixed'
                        ? 'Glass = OU - ' + (currentRule.mirrorHeightDeductionMM ?? 96)
                        : 'Glass = Shutter - ' + currentRule.mirrorHeightDeductionMM}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-sm font-mono text-slate-300 font-bold">
                      {activeTabKey === 'no-track_fixed' ? 'OU −' : 'Shutter −'}
                    </span>
                    <div className="flex items-center space-x-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(0, currentRule.mirrorHeightDeductionMM - 1);
                          updateCurrentRuleField('mirrorHeightDeductionMM', next);
                          updateCurrentRuleField('mirrorWidthDeductionMM', next);
                        }}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="250"
                        value={currentRule.mirrorHeightDeductionMM}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          updateCurrentRuleField('mirrorHeightDeductionMM', val);
                          updateCurrentRuleField('mirrorWidthDeductionMM', val);
                        }}
                        className="flex-1 h-10 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono text-base font-bold text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = currentRule.mirrorHeightDeductionMM + 1;
                          updateCurrentRuleField('mirrorHeightDeductionMM', next);
                          updateCurrentRuleField('mirrorWidthDeductionMM', next);
                        }}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-bold text-slate-400">mm</span>
                  </div>
                </div>
              )}

              {/* 4. SPECIAL COMPONENT: 2.5 TRACK MESH HEIGHT DEDUCTION */}
              {activeTabKey === '2.5-track_sliding' && (
                <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 space-y-2">
                  <div className="flex items-start sm:items-center justify-between gap-1.5 flex-wrap">
                    <div>
                      <label className="text-xs font-bold text-slate-200 block">
                        {t('4. கொசுவலை சஷ் உயரம் கழிப்பு (Mosquito Mesh Shutter Height):', '4. Mosquito Mesh Shutter Height Deduction:')}
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {t('கண்ணாடி சஷ் உயரத்திலிருந்து கொசுவலை சஷ்க்கு கழிக்கப்படும் மிமீ', 'Deduction in mm subtracted from glass shutter height')}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900">
                      {'Mesh H = Shutter H - ' + (currentRule.meshHeightDeductionMM ?? 2)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-sm font-mono text-slate-300 font-bold">Shutter H −</span>
                    <div className="flex items-center space-x-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentRuleField(
                            'meshHeightDeductionMM',
                            Math.max(0, (currentRule.meshHeightDeductionMM ?? 2) - 1)
                          )
                        }
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={currentRule.meshHeightDeductionMM ?? 2}
                        onChange={(e) =>
                          updateCurrentRuleField(
                            'meshHeightDeductionMM',
                            Math.max(0, parseInt(e.target.value) || 0)
                          )
                        }
                        className="flex-1 h-10 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono text-base font-bold text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentRuleField(
                            'meshHeightDeductionMM',
                            (currentRule.meshHeightDeductionMM ?? 2) + 1
                          )
                        }
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-bold text-slate-400">mm</span>
                  </div>
                </div>
              )}

              {/* 5. SPECIAL COMPONENT: 2.5 TRACK MESH WIDTH DEDUCTION */}
              {activeTabKey === '2.5-track_sliding' && (
                <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 space-y-2">
                  <div className="flex items-start sm:items-center justify-between gap-1.5 flex-wrap">
                    <div>
                      <label className="text-xs font-bold text-slate-200 block">
                        {t('5. கொசுவலை சஷ் அகலம் கழிப்பு (Mosquito Mesh Shutter Width):', '5. Mosquito Mesh Shutter Width Deduction:')}
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {t('மொத்த அகல பாதியிலிருந்து கொசுவலை சஷ்க்கு கழிக்கப்படும் மிமீ ((W / 2) - deduction)', 'Deduction in mm subtracted from half outer width ((W / 2) - deduction)')}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900">
                      {'Mesh W = (W / 2) - ' + (currentRule.meshWidthDeductionMM ?? 10)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-sm font-mono text-slate-300 font-bold">(W / 2) −</span>
                    <div className="flex items-center space-x-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentRuleField(
                            'meshWidthDeductionMM',
                            Math.max(0, (currentRule.meshWidthDeductionMM ?? 10) - 1)
                          )
                        }
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={currentRule.meshWidthDeductionMM ?? 10}
                        onChange={(e) =>
                          updateCurrentRuleField(
                            'meshWidthDeductionMM',
                            Math.max(0, parseInt(e.target.value) || 0)
                          )
                        }
                        className="flex-1 h-10 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono text-base font-bold text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentRuleField(
                            'meshWidthDeductionMM',
                            (currentRule.meshWidthDeductionMM ?? 10) + 1
                          )
                        }
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-bold text-slate-400">mm</span>
                  </div>
                </div>
              )}

              {/* 5. SPECIAL COMPONENT: CASEMENT MULLION DEDUCTION (DOUBLE / 3-OPEN) */}
              {(activeTabKey === 'no-track_open_double' || activeTabKey === 'no-track_open_triple') && (
                <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 space-y-2">
                  <div className="flex items-start sm:items-center justify-between gap-1.5 flex-wrap">
                    <div>
                      <label className="text-xs font-bold text-slate-200 block">
                        {t('4. மத்திய முல்லியன் கழிப்பு (Central Mullion Deduction):', '4. Central Mullion Deduction:')}
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {activeTabKey === 'no-track_open_triple'
                          ? t('3-Open ஜன்னலுக்கு 2 முல்லியன்கள்: பிரேம் உயரத்தில் (Frame Height) இருந்து முல்லியன் வெட்டுக்கு கழிக்கப்படும் மிமீ (இயல்பு: 6 மிமீ)', '2 Mullions for 3-Open Window: Deduction in mm from Frame Height for mullion cut (Default: 6 mm)')
                          : t('இரட்டை ஜன்னலுக்கு 1 முல்லியன்: பிரேம் உயரத்தில் (Frame Height) இருந்து முல்லியன் வெட்டுக்கு கழிக்கப்படும் மிமீ (இயல்பு: 6 மிமீ)', '1 Mullion for Double Window: Deduction in mm from Frame Height for mullion cut (Default: 6 mm)')}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/50 px-2 py-0.5 rounded border border-teal-900">
                      {'Mullion Cut = Height - ' + (currentRule.mullionDeductionMM ?? (currentRule.mullionSashDeductionMM ?? 6))}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-sm font-mono text-slate-300 font-bold">Height −</span>
                    <div className="flex items-center space-x-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          const currentDed = currentRule.mullionSashDeductionMM ?? (currentRule.mullionDeductionMM === 44 ? 6 : (currentRule.mullionDeductionMM ?? 6));
                          const nextVal = Math.max(0, currentDed - 1);
                          updateCurrentRuleField('mullionSashDeductionMM', nextVal);
                          updateCurrentRuleField('mullionDeductionMM', nextVal);
                        }}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={currentRule.mullionSashDeductionMM ?? (currentRule.mullionDeductionMM === 44 ? 6 : (currentRule.mullionDeductionMM ?? 6))}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          updateCurrentRuleField('mullionSashDeductionMM', val);
                          updateCurrentRuleField('mullionDeductionMM', val);
                        }}
                        className="flex-1 h-10 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono text-base font-bold text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const currentDed = currentRule.mullionSashDeductionMM ?? (currentRule.mullionDeductionMM === 44 ? 6 : (currentRule.mullionDeductionMM ?? 6));
                          const nextVal = currentDed + 1;
                          updateCurrentRuleField('mullionSashDeductionMM', nextVal);
                          updateCurrentRuleField('mullionDeductionMM', nextVal);
                        }}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm cursor-pointer active:scale-95 transition"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-bold text-slate-400">mm</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER ACTIONS */}
        <div className="p-3 sm:p-3.5 border-t border-slate-800 bg-slate-950 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 flex-shrink-0 flex-wrap">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span className="flex items-center space-x-1">
              <History className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('கடைசியாகப் பயன்படுத்திய ஃபார்முலா தானாகப் பெறப்படும்', 'Last used formula automatically retrieved')}</span>
            </span>
          </div>

          <div className="flex items-center space-x-2 flex-wrap sm:flex-nowrap justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer text-center"
            >
              {t('ரத்து (Cancel)', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer active:scale-95 shadow-md shadow-blue-500/20"
            >
              {isSaved ? <Check className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4" />}
              <span>{t('சேமி & பயன்படுத்து', 'Save & Apply')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
