import { WindowInput, FrameType, WindowType, UPVCSeries, GlassType, UnitType } from '../engine/types';

export const STORAGE_KEY_10_INPUTS = 'windowbuilder_windows_inputs';
export const STORAGE_KEY_SAVED_CALCS = 'windowbuilder_saved_calculations';
export const STORAGE_KEY_GLOBAL_SETTINGS = 'windowbuilder_global_settings';
export const STORAGE_KEY_DELETED_WINDOWS = 'windowbuilder_deleted_windows';
export const STORAGE_KEY_RESET_BACKUP = 'windowbuilder_reset_backup';

export interface DeletedWindowEntry {
  id: string;
  window: WindowInput;
  originalIndex: number;
  deletedAt: number;
  displayLabel: string;
  dimensionSummary: string;
  typeSummary: string;
}

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

export const createNewWindow = (
  index: number,
  settings?: Partial<GlobalSettings> & {
    windowNumber?: number;
    variantLetter?: string;
    windowLabel?: string;
  }
): WindowInput => {
  const unit = settings?.inputUnit ?? 'inch';
  const winNum = settings?.windowNumber ?? (index + 1);
  const variant = settings?.variantLetter ?? '';
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
    windowNumber: winNum,
    variantLetter: variant,
    windowLabel: settings?.windowLabel || (variant ? `W${winNum}${variant}` : `W${winNum}`),
    quantity: 1
  };
};

export const STORAGE_VERSION = 'v2_single_window_default';
export const STORAGE_KEY_VERSION = 'windowbuilder_storage_version';

export const DEFAULT_INITIAL_WINDOWS: WindowInput[] = [
  {
    widthInch: 48,
    heightInch: 60,
    widthCm: 121.9,
    heightCm: 152.4,
    widthMM: 1219,
    heightMM: 1524,
    frameType: '2-track',
    windowType: 'sliding',
    unit: 'inch',
    conversionFactor: 25.4,
    customOffsetMM: 5,
    weldingAllowanceMM: 0,
    profileSeries: '60mm',
    reinforcementSteel: false,
    glassType: '5mm_single',
    windowNumber: 1,
    variantLetter: '',
    windowLabel: 'W1',
    quantity: 1
  }
];

// Alias for backwards-compatibility
export const DEFAULT_10_WINDOWS: WindowInput[] = DEFAULT_INITIAL_WINDOWS;

export const isLegacy10DefaultWindows = (windows: WindowInput[]): boolean => {
  if (!Array.isArray(windows) || windows.length !== 10) return false;
  const legacyDims = [
    [48, 60],
    [72, 60],
    [48, 48],
    [48, 48],
    [60, 48],
    [30, 48],
    [48, 36],
    [72, 48],
    [36, 36],
    [24, 36]
  ];
  return windows.every((w, idx) => {
    const expected = legacyDims[idx];
    return w.widthInch === expected[0] && w.heightInch === expected[1];
  });
};

export const loadStored10Windows = (): WindowInput[] => {
  try {
    const version = localStorage.getItem(STORAGE_KEY_VERSION);
    const raw = localStorage.getItem(STORAGE_KEY_10_INPUTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // If it's the old 10 default windows seed, discard them and start only with Window 1
        if (version !== STORAGE_VERSION && isLegacy10DefaultWindows(parsed)) {
          localStorage.setItem(STORAGE_KEY_VERSION, STORAGE_VERSION);
          saveStored10Windows(DEFAULT_INITIAL_WINDOWS);
          return DEFAULT_INITIAL_WINDOWS;
        }

        localStorage.setItem(STORAGE_KEY_VERSION, STORAGE_VERSION);
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
            windowNumber: w.windowNumber,
            variantLetter: w.variantLetter,
            windowLabel: w.windowLabel || ('W' + (i + 1))
          };
        });
      }
    }
  } catch (_) {}

  try {
    localStorage.setItem(STORAGE_KEY_VERSION, STORAGE_VERSION);
    saveStored10Windows(DEFAULT_INITIAL_WINDOWS);
  } catch (_) {}
  return DEFAULT_INITIAL_WINDOWS;
};

export const saveStored10Windows = (windows: WindowInput[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_10_INPUTS, JSON.stringify(windows));
  } catch (_) {}
};

export const loadDeletedWindows = (): DeletedWindowEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_WINDOWS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
};

export const saveDeletedWindows = (entries: DeletedWindowEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_WINDOWS, JSON.stringify(entries.slice(0, 30)));
  } catch (_) {}
};

export const loadResetBackup = (): WindowInput[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RESET_BACKUP);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return null;
};

export const saveResetBackup = (windows: WindowInput[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_RESET_BACKUP, JSON.stringify(windows));
  } catch (_) {}
};
