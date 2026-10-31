import { WindowInput, FrameType, WindowType, UPVCSeries, GlassType, UnitType } from '../engine/types';

export const STORAGE_KEY_10_INPUTS = 'windowbuilder_windows_inputs';
export const STORAGE_KEY_SAVED_CALCS = 'windowbuilder_saved_calculations';
export const STORAGE_KEY_GLOBAL_SETTINGS = 'windowbuilder_global_settings';

export interface GlobalSettings {
  conversionFactor: number;
  customOffsetMM: number;
  weldingAllowanceMM: number;
  profileSeries: UPVCSeries;
  reinforcementSteel: boolean;
  glassType: GlassType;
  inputUnit: UnitType;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  conversionFactor: 25.4,
  customOffsetMM: 5,
  weldingAllowanceMM: 0,
  profileSeries: '60mm',
  reinforcementSteel: false,
  glassType: '5mm_single',
  inputUnit: 'inch'
};

export const createNewWindow = (index: number, settings?: Partial<GlobalSettings>): WindowInput => {
  const unit = settings?.inputUnit ?? 'inch';
  return {
    widthInch: 48,
    heightInch: 60,
    widthCm: 121.9,
    heightCm: 152.4,
    widthMM: 1219,
    heightMM: 1524,
    frameType: '2-track',
    windowType: 'sliding',
    unit,
    conversionFactor: settings?.conversionFactor ?? 25.4,
    customOffsetMM: Math.max(0, settings?.customOffsetMM ?? 5),
    weldingAllowanceMM: settings?.weldingAllowanceMM ?? 0,
    profileSeries: settings?.profileSeries ?? '60mm',
    reinforcementSteel: settings?.reinforcementSteel ?? false,
    glassType: settings?.glassType ?? '5mm_single',
    windowLabel: 'W' + (index + 1),
    quantity: 1
  };
};

export const DEFAULT_10_WINDOWS: WindowInput[] = [
  {
    widthInch: 48,
    heightInch: 60,
    frameType: '2-track',
    windowType: 'sliding',
    unit: 'inch',
    conversionFactor: 25.4,
    customOffsetMM: 5,
    weldingAllowanceMM: 0,
    profileSeries: '60mm',
    reinforcementSteel: false,
    glassType: '5mm_single',
    windowLabel: 'W1',
    quantity: 1
  },
  {
    widthInch: 72,
    heightInch: 60,
    frameType: '3.5-track',
    windowType: 'sliding',
    unit: 'inch',
    conversionFactor: 25.4,
    customOffsetMM: 5,
    weldingAllowanceMM: 0,
    profileSeries: '60mm',
    reinforcementSteel: false,
    glassType: '5mm_single',
    windowLabel: 'W2',
    quantity: 1
  },
  {
    widthInch: 48,
    heightInch: 48,
    frameType: '2.5-track',
    windowType: 'sliding',
    unit: 'inch',
    conversionFactor: 25.4,
    customOffsetMM: 5,
    weldingAllowanceMM: 0,
    profileSeries: '60mm',
    reinforcementSteel: false,
    glassType: '5mm_single',
    windowLabel: 'W3',
    quantity: 1
  },
  {
    widthInch: 48,
    heightInch: 48,
    frameType: '2-track',
    windowType: 'sliding',
    unit: 'inch',
    conversionFactor: 25.4,
    customOffsetMM: 5,
    weldingAllowanceMM: 0,
    profileSeries: '60mm',
    reinforcementSteel: false,
    glassType: '5mm_single',
    windowLabel: 'W4',
    quantity: 1
  },
  {
    widthInch: 60,
    heightInch: 48,
    frameType: '2-track',
    windowType: 'sliding',
    unit: 'inch',
    conversionFactor: 25.4,
    customOffsetMM: 5,
    weldingAllowanceMM: 0,
    profileSeries: '60mm',
    reinforcementSteel: false,
    glassType: '5mm_single',
    windowLabel: 'W5',
    quantity: 1
  },
  {
    widthInch: 30,
    heightInch: 48,
    frameType: '2-track',
    windowType: 'sliding',
    unit: 'inch',
    conversionFactor: 25.4,
    customOffsetMM: 5,
    weldingAllowanceMM: 0,
    profileSeries: '60mm',
    reinforcementSteel: false,
    glassType: '5mm_single',
    windowLabel: 'W6',
    quantity: 1
  },
  {
    widthInch: 48,
    heightInch: 36,
    frameType: '2-track',
    windowType: 'sliding',
    unit: 'inch',
    conversionFactor: 25.4,
    customOffsetMM: 5,
    weldingAllowanceMM: 0,
    profileSeries: '60mm',
    reinforcementSteel: false,
    glassType: '5mm_single',
    windowLabel: 'W7',
    quantity: 1
  },
  {
    widthInch: 72,
    heightInch: 48,
    frameType: '3.5-track',
    windowType: 'sliding',
    unit: 'inch',
    conversionFactor: 25.4,
    customOffsetMM: 5,
    weldingAllowanceMM: 0,
    profileSeries: '60mm',
    reinforcementSteel: false,
    glassType: '5mm_single',
    windowLabel: 'W8',
    quantity: 1
  },
  {
    widthInch: 36,
    heightInch: 36,
    frameType: 'no-track',
    windowType: 'open',
    unit: 'inch',
    conversionFactor: 25.4,
    customOffsetMM: 5,
    weldingAllowanceMM: 0,
    profileSeries: '60mm',
    reinforcementSteel: false,
    glassType: '5mm_single',
    windowLabel: 'W9',
    quantity: 1
  },
  {
    widthInch: 24,
    heightInch: 36,
    frameType: 'no-track',
    windowType: 'fixed',
    unit: 'inch',
    conversionFactor: 25.4,
    customOffsetMM: 5,
    weldingAllowanceMM: 0,
    profileSeries: '60mm',
    reinforcementSteel: false,
    glassType: '5mm_single',
    windowLabel: 'W10',
    quantity: 1
  }
];

export const loadStored10Windows = (): WindowInput[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_10_INPUTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Output mm default +5mm; if added mm is missing or negative integer, initialize to 0
        return parsed.map((w, i) => {
          const wInch = w.widthInch || 48;
          const hInch = w.heightInch || 60;
          return {
            ...w,
            unit: (w.unit === 'cm' || w.unit === 'mm' || w.unit === 'inch') ? w.unit : 'inch',
            widthCm: w.widthCm ?? Number((wInch * 2.54).toFixed(1)),
            heightCm: w.heightCm ?? Number((hInch * 2.54).toFixed(1)),
            widthMM: w.widthMM ?? Math.round(wInch * 25.4),
            heightMM: w.heightMM ?? Math.round(hInch * 25.4),
            customOffsetMM: w.windowType === 'ventilator' ? 0 : Math.max(0, w.customOffsetMM !== undefined ? Number(w.customOffsetMM) || 0 : 5),
            weldingAllowanceMM: 0,
            reinforcementSteel: false,
            windowLabel: 'W' + (i + 1)
          };
        });
      }
    }
  } catch (_) {}
  return DEFAULT_10_WINDOWS;
};

export const saveStored10Windows = (windows: WindowInput[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_10_INPUTS, JSON.stringify(windows));
  } catch (_) {}
};
