import { jsPDF } from 'jspdf';
import { CalculationResult, WindowInput } from '../engine/types';

export interface WindowVariantInfo {
  letter: string;      // 'a', 'b', 'c', or '' if no variant
  siNo: string;        // '1a', '2a', '3', etc.
  windowLabel: string; // 'W1a', 'W2a', 'W3', etc.
}

export type WindowVariantInput =
  | CalculationResult
  | { input: WindowInput; convertedHeightMM?: number; convertedWidthMM?: number }
  | WindowInput;

export function extractWindowInput(item: WindowVariantInput): WindowInput {
  if (item && typeof item === 'object' && 'input' in item && item.input) {
    return item.input;
  }
  return item as WindowInput;
}

export function getWindowTypeKey(input: WindowInput): string {
  if (!input) return 'sliding_2-track';
  if (input.windowType === 'sliding') {
    return `sliding_${input.frameType || '2-track'}`;
  }
  if (input.windowType === 'open') {
    return `open_${input.casementSubtype || 'single'}`;
  }
  if (input.windowType === 'ventilator') {
    const subtype = input.ventilatorSubtype || 'normal';
    if (subtype === 'fan') {
      return `ventilator_fan_${input.ventilatorFanSide || 'left'}`;
    }
    return 'ventilator_normal';
  }
  if (input.windowType === 'fixed') {
    return 'fixed';
  }
  return input.windowType || 'sliding_2-track';
}

/**
 * Returns a normalized grouping key based on the raw user input dimensions (ignoring custom offsets).
 * This ensures different window types sharing the exact same input dimensions (e.g. 48" x 60"
 * sliding with 5mm offset and 48" x 60" ventilator with 0mm offset) are correctly matched together.
 */
export function getWindowDimensionKey(item: WindowVariantInput): string {
  const inp = extractWindowInput(item);
  if (!inp) return 'default';
  const unit = inp.unit || 'inch';

  if (unit === 'cm') {
    const rawH = inp.heightCm !== undefined && inp.heightCm !== null && inp.heightCm > 0
      ? inp.heightCm
      : (inp.heightInch ? Number((inp.heightInch * 2.54).toFixed(1)) : 0);
    const rawW = inp.widthCm !== undefined && inp.widthCm !== null && inp.widthCm > 0
      ? inp.widthCm
      : (inp.widthInch ? Number((inp.widthInch * 2.54).toFixed(1)) : 0);
    return `cm_${rawH}x${rawW}`;
  }

  if (unit === 'mm') {
    const rawH = inp.heightMM !== undefined && inp.heightMM !== null && inp.heightMM > 0
      ? inp.heightMM
      : (inp.heightInch ? Math.round(inp.heightInch * 25.4) : 0);
    const rawW = inp.widthMM !== undefined && inp.widthMM !== null && inp.widthMM > 0
      ? inp.widthMM
      : (inp.widthInch ? Math.round(inp.widthInch * 25.4) : 0);
    return `mm_${rawH}x${rawW}`;
  }

  // inch (default)
  const rawH = inp.heightInch !== undefined && inp.heightInch !== null && inp.heightInch > 0
    ? inp.heightInch
    : (inp.heightMM ? Number((inp.heightMM / 25.4).toFixed(3)) : 0);
  const rawW = inp.widthInch !== undefined && inp.widthInch !== null && inp.widthInch > 0
    ? inp.widthInch
    : (inp.widthMM ? Number((inp.widthMM / 25.4).toFixed(3)) : 0);
  const normH = Math.round(rawH * 100) / 100;
  const normW = Math.round(rawW * 100) / 100;
  return `inch_${normH}x${normW}`;
}

/**
 * Computes window variant labels based on architectural logic:
 * - If multiple windows have the EXACT SAME input dimensions (Height & Width) AND DIFFERENT window types:
 *   Append variant letter 'a', 'b', 'c'... (e.g. '1a', '2a', '3b', '8c')
 * - If windows have different input dimensions (or same type):
 *   No letter is appended (e.g. '1', '2', '3')
 *
 * Accepts CalculationResult[], WindowInput[], or { input: WindowInput }[]
 */
/**
 * Resolves base window numbers (1, 2, 3...) for an array of windows.
 * - Respects explicit `inp.windowNumber` if provided and > 0.
 * - Groups sequential manual variant letters (e.g. 'b' after 'a', 'c' after 'b') under the same base window number.
 * - Otherwise increments cleanly to the next sequential window number.
 */
export function resolveWindowNumbers(windows: WindowInput[]): number[] {
  if (!windows || windows.length === 0) return [];
  const resolved = new Array<number>(windows.length);

  for (let i = 0; i < windows.length; i++) {
    const curr = windows[i];
    const currLetter = curr?.variantLetter?.toLowerCase().trim() || '';

    if (curr?.windowNumber !== undefined && curr.windowNumber > 0) {
      resolved[i] = curr.windowNumber;
    } else if (i > 0 && currLetter && currLetter !== 'a') {
      // Continuation variant (b, c, d...) shares the base window number of the preceding window
      resolved[i] = resolved[i - 1];
    } else {
      if (i === 0) {
        resolved[0] = 1;
      } else {
        const maxPrev = Math.max(...resolved.slice(0, i));
        resolved[i] = maxPrev + 1;
      }
    }
  }

  return resolved;
}

export function computeWindowVariantLabels(
  items: Array<WindowVariantInput>
): WindowVariantInfo[] {
  if (!items || items.length === 0) return [];

  const inputs = items.map(extractWindowInput);
  const resolvedNums = resolveWindowNumbers(inputs);

  return inputs.map((inp, idx) => {
    const num = resolvedNums[idx];
    const manualLetter = inp?.variantLetter ? inp.variantLetter.toLowerCase().trim() : '';

    if (manualLetter) {
      return {
        letter: manualLetter,
        siNo: `${num}${manualLetter}`,
        windowLabel: `W${num}${manualLetter}`
      };
    }

    return {
      letter: '',
      siNo: String(num),
      windowLabel: `W${num}`
    };
  });
}

export interface LSInteriorsExportOptions {
  customerName?: string;
  date?: string;
  includeMeshColumn?: boolean;
  includeInterlockColumn?: boolean;
  includeMullionColumn?: boolean;
  mullionDeductionMM?: number; // Customizable deduction from Sash Height (default: 6 mm)
}

export interface LSFlattenedRow {
  siNo: string;
  siteHeight: string;
  siteWidth: string;
  modelName: string;
  materialMM?: string;
  outerFrameMM: string;
  sashCutMM: string;
  sashPcs?: string;
  sashHPcs?: string;
  sashWPcs?: string;
  mullionMM?: string;
  mullionPcs?: string;
  interlockMM?: string;
  mirrorCutMM: string;
  glassPcs?: string;
  glassType?: string;
  meshCutMM?: string;
  windowType?: string;
  casementSubtype?: string;
  isFixed?: boolean;
}

export type LSColumnId =
  | 'sino'
  | 'height'
  | 'x'
  | 'width'
  | 'model'
  | 'materialMM'
  | 'outerFrame'
  | 'sashCut'
  | 'sashPcs'
  | 'sashHPcs'
  | 'sashWPcs'
  | 'mullion'
  | 'mullionPcs'
  | 'interlock'
  | 'mirrorCut'
  | 'glassPcs'
  | 'glassType'
  | 'meshCut';

export const LS_COLOR_MAP: Record<LSColumnId, { pdf: [number, number, number]; canvas: string }> = {
  sino: { pdf: [15, 23, 42], canvas: '#0f172a' },
  height: { pdf: [2, 132, 199], canvas: '#0284c7' },
  x: { pdf: [71, 85, 105], canvas: '#475569' },
  width: { pdf: [3, 105, 161], canvas: '#0369a1' },
  model: { pdf: [7, 89, 133], canvas: '#075985' },
  materialMM: { pdf: [7, 89, 133], canvas: '#075985' },
  outerFrame: { pdf: [2, 132, 199], canvas: '#0284c7' },
  sashCut: { pdf: [3, 105, 161], canvas: '#0369a1' },
  sashPcs: { pdf: [3, 105, 161], canvas: '#0369a1' },
  sashHPcs: { pdf: [3, 105, 161], canvas: '#0369a1' },
  sashWPcs: { pdf: [3, 105, 161], canvas: '#0369a1' },
  mullion: { pdf: [12, 74, 110], canvas: '#0c4a6e' },
  mullionPcs: { pdf: [12, 74, 110], canvas: '#0c4a6e' },
  interlock: { pdf: [2, 132, 199], canvas: '#0284c7' },
  mirrorCut: { pdf: [3, 105, 161], canvas: '#0369a1' },
  glassPcs: { pdf: [3, 105, 161], canvas: '#0369a1' },
  glassType: { pdf: [3, 105, 161], canvas: '#0369a1' },
  meshCut: { pdf: [2, 132, 199], canvas: '#0284c7' }
};

/**
 * Blue-tone heading colors for each column in the L.S. Interiors Order Sheet.
 */
export const LS_COLUMN_COLORS_PDF: [number, number, number][] = [
  [15, 23, 42],
  [2, 132, 199],
  [71, 85, 105],
  [3, 105, 161],
  [7, 89, 133],
  [2, 132, 199],
  [3, 105, 161],
  [3, 105, 161],
  [2, 132, 199],
  [2, 132, 199]
];

export const LS_COLUMN_COLORS_CANVAS: string[] = [
  '#0f172a',
  '#0284c7',
  '#475569',
  '#0369a1',
  '#075985',
  '#0284c7',
  '#0369a1',
  '#0369a1',
  '#0284c7',
  '#0284c7'
];

export interface LSModelColor {
  pdf: [number, number, number];
  canvas: string;
  name: string;
}

export interface LSModelBgColor {
  pdf: [number, number, number];
  canvas: string;
  name: string;
}

/**
 * Subtle sky-blue row tints distinguish window models while preserving the brand palette.
 */
export const LS_MODEL_BG_COLOR_MAP: Record<string, LSModelBgColor> = {
  '2T SLIDING DOOR': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Door Ice Blue' },
  '2.5T SLIDING DOOR (MESH)': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Door Ice Blue' },
  '3T SLIDING DOOR': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Door Ice Blue' },
  'SL/SL/DOOR': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Door Ice Blue' },
  'SL/SL/DOOR/MESH': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Door Ice Blue' },
  'SL/SL/MESH/DOOR': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Door Ice Blue' },
  'SL/SL/SL/DOOR': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Door Ice Blue' },
  'DOOR': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Door Ice Blue' },
  'TRACK': { pdf: [240, 249, 255], canvas: '#f0f9ff', name: 'Track Light Blue' },
  '2T SLIDING': { pdf: [240, 249, 255], canvas: '#f0f9ff', name: 'Track Light Blue' },
  '2.5T SLIDING (MESH)': { pdf: [240, 249, 255], canvas: '#f0f9ff', name: 'Track Light Blue' },
  '3T SLIDING': { pdf: [240, 249, 255], canvas: '#f0f9ff', name: 'Track Light Blue' },
  '4T SLIDING': { pdf: [240, 249, 255], canvas: '#f0f9ff', name: 'Track Light Blue' },
  'SLIDING WINDOW': { pdf: [240, 249, 255], canvas: '#f0f9ff', name: 'Track Light Blue' },
  'FIXED WINDOW': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Fixed Ice Blue' },
  'SINGLE WINDOW': { pdf: [240, 249, 255], canvas: '#f0f9ff', name: 'Single Light Blue' },
  'SINGLE CASEMENT': { pdf: [240, 249, 255], canvas: '#f0f9ff', name: 'Single Light Blue' },
  'DOUBLE WINDOW': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Double Ice Blue' },
  'DOUBLE CASEMENT': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Double Ice Blue' },
  '3-OPEN WINDOW': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Double Ice Blue' },
  'ventilator/normal': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Ventilator Ice Blue' },
  'ventilator with fans Left': { pdf: [240, 249, 255], canvas: '#f0f9ff', name: 'Fan Left Light Blue' },
  'ventilator with fans Right': { pdf: [224, 242, 254], canvas: '#e0f2fe', name: 'Fan Right Ice Blue' },
};

/**
 * Returns the dedicated light blue background tint for a window model type.
 */
export const getLSModelBgColor = (
  input: string | LSFlattenedRow | CalculationResult | undefined | null
): LSModelBgColor => {
  if (!input) {
    return { pdf: [255, 255, 255], canvas: '#ffffff', name: 'Clean White' };
  }

  let modelName = '';
  if (typeof input === 'string') {
    modelName = input.trim();
  } else if ('modelName' in input && typeof input.modelName === 'string') {
    modelName = input.modelName.trim();
  } else if ('input' in input) {
    const res = input as CalculationResult;
    if (res.input.windowType === 'ventilator') {
      if (res.input.ventilatorSubtype === 'fan') {
        return res.input.ventilatorFanSide === 'right'
          ? LS_MODEL_BG_COLOR_MAP['ventilator with fans Right']
          : LS_MODEL_BG_COLOR_MAP['ventilator with fans Left'];
      }
      return LS_MODEL_BG_COLOR_MAP['ventilator/normal'];
    }
    modelName = getLSModelName(res).trim();
  }

  // Strip prefix like "W1a • " or "W2 • " if present
  const cleanModel = modelName.replace(/^W\d+[a-z]?\s*[•\-]\s*/i, '').trim();
  const upper = cleanModel.toUpperCase();

  // 0. Door variations ([SL/SL/DOOR], DOOR)
  if (upper.includes('DOOR') || upper.includes('SL/SL/DOOR')) {
    return LS_MODEL_BG_COLOR_MAP['2T SLIDING DOOR'];
  }

  // 1. Ventilator variations (Fan Left vs Fan Right vs Normal)
  if (upper.includes('VENT') || upper.includes('FAN')) {
    if (
      upper.includes('RIGHT') ||
      upper.includes('FAN R') ||
      upper.endsWith(' R') ||
      upper.endsWith('RIGHT') ||
      upper.includes('FAN-R') ||
      upper.includes('(R)') ||
      upper.includes('(RIGHT)') ||
      upper.includes('FAN R]')
    ) {
      return LS_MODEL_BG_COLOR_MAP['ventilator with fans Right'];
    }
    if (
      upper.includes('LEFT') ||
      upper.includes('FAN L') ||
      upper.endsWith(' L') ||
      upper.endsWith('LEFT') ||
      upper.includes('FAN-L') ||
      upper.includes('(L)') ||
      upper.includes('(LEFT)') ||
      upper.includes('FAN L]')
    ) {
      return LS_MODEL_BG_COLOR_MAP['ventilator with fans Left'];
    }
    return LS_MODEL_BG_COLOR_MAP['ventilator/normal'];
  }

  // 2. Fixed Window
  if (upper.includes('FIXED')) {
    return LS_MODEL_BG_COLOR_MAP['FIXED WINDOW'];
  }

  // 3. Double & 3-Open Window variations (Open window with mullion: [OP/OP], [OP/OP/OP], DOUBLE, 3-OPEN, TRIPLE)
  if (
    upper.includes('OP/OP') ||
    upper.includes('DOUBLE') ||
    upper.includes('3-OPEN') ||
    upper.includes('TRIPLE')
  ) {
    return LS_MODEL_BG_COLOR_MAP['DOUBLE WINDOW'];
  }

  // 4. Single Window variations (Single open window: [OP], SINGLE, CASEMENT, OPEN)
  if (
    upper.includes('[OP]') ||
    upper === 'OP' ||
    upper.includes('SINGLE') ||
    upper.includes('CASEMENT') ||
    (upper.includes('OPEN') && !upper.includes('3-OPEN'))
  ) {
    return LS_MODEL_BG_COLOR_MAP['SINGLE WINDOW'];
  }

  // 5. Track / Sliding variations (2T, 2.5T, 3T, 4T, Sliding, [SL/SL], [SL/SL/MESH], [SL/SL/SL/SL])
  if (
    upper.includes('SL/') ||
    upper.includes('[SL') ||
    upper.includes('TRACK') ||
    upper.startsWith('2.5T') ||
    upper.includes('2.5T') ||
    upper.includes('MESH') ||
    upper.startsWith('3T') ||
    upper.includes('3T') ||
    upper.includes('3.5T') ||
    upper.startsWith('4T') ||
    upper.includes('4T') ||
    upper.startsWith('2T') ||
    upper.includes('2T') ||
    upper.includes('SLIDING')
  ) {
    return LS_MODEL_BG_COLOR_MAP['TRACK'];
  }

  return LS_MODEL_BG_COLOR_MAP['TRACK'];
};

/**
 * Blue-toned text colors distinguish window models in the order sheet.
 */
export const LS_MODEL_COLOR_MAP: Record<string, LSModelColor> = {
  '2T SLIDING': { pdf: [2, 132, 199], canvas: '#0284c7', name: 'Deep Sky Blue' },
  '2.5T SLIDING (MESH)': { pdf: [2, 132, 199], canvas: '#0284c7', name: 'Deep Sky Blue' },
  '3T SLIDING': { pdf: [3, 105, 161], canvas: '#0369a1', name: 'Blue' },
  '4T SLIDING': { pdf: [3, 105, 161], canvas: '#0369a1', name: 'Blue' },
  'SLIDING WINDOW': { pdf: [2, 132, 199], canvas: '#0284c7', name: 'Deep Sky Blue' },
  'FIXED WINDOW': { pdf: [7, 89, 133], canvas: '#075985', name: 'Navy Blue' },
  'SINGLE WINDOW': { pdf: [3, 105, 161], canvas: '#0369a1', name: 'Blue' },
  'SINGLE CASEMENT': { pdf: [3, 105, 161], canvas: '#0369a1', name: 'Blue' },
  'DOUBLE WINDOW': { pdf: [12, 74, 110], canvas: '#0c4a6e', name: 'Deep Navy' },
  'DOUBLE CASEMENT': { pdf: [12, 74, 110], canvas: '#0c4a6e', name: 'Deep Navy' },
  '3-OPEN WINDOW': { pdf: [12, 74, 110], canvas: '#0c4a6e', name: 'Deep Navy' },
  'ventilator/normal': { pdf: [2, 132, 199], canvas: '#0284c7', name: 'Deep Sky Blue' },
  'ventilator with fans Left': { pdf: [3, 105, 161], canvas: '#0369a1', name: 'Blue' },
  'ventilator with fans Right': { pdf: [7, 89, 133], canvas: '#075985', name: 'Navy Blue' },
};

/**
 * Returns the dedicated unique color for any window model type.
 */
export const getLSModelColor = (
  input: string | LSFlattenedRow | CalculationResult | undefined | null
): LSModelColor => {
  if (!input) {
    return { pdf: [7, 89, 133], canvas: '#075985', name: 'Navy Blue' };
  }

  let modelName = '';
  if (typeof input === 'string') {
    modelName = input.trim();
  } else if ('modelName' in input && typeof input.modelName === 'string') {
    modelName = input.modelName.trim();
  } else if ('input' in input) {
    const res = input as CalculationResult;
    if (res.input.windowType === 'ventilator') {
      if (res.input.ventilatorSubtype === 'fan') {
        return res.input.ventilatorFanSide === 'right'
          ? LS_MODEL_COLOR_MAP['ventilator with fans Right']
          : LS_MODEL_COLOR_MAP['ventilator with fans Left'];
      }
      return LS_MODEL_COLOR_MAP['ventilator/normal'];
    }
    modelName = getLSModelName(res).trim();
  }

  // Strip prefix like "W1a • " or "W2 • " if present
  const cleanModel = modelName.replace(/^W\d+[a-z]?\s*[•\-]\s*/i, '').trim();
  const upper = cleanModel.toUpperCase();

  // 1. Sliding / Track variations ([SL/SL/SL/SL], [SL/SL/MESH], [SL/SL], 4T, 3T, 2.5T, 2T)
  if (upper.includes('SL/SL/SL/SL') || upper.startsWith('4T') || upper.includes('4T') || upper.includes('4 TRACK')) {
    return LS_MODEL_COLOR_MAP['4T SLIDING'];
  }
  if (upper.includes('MESH') || upper.includes('SL/SL/MESH') || upper.startsWith('2.5T') || upper.includes('2.5T')) {
    return LS_MODEL_COLOR_MAP['2.5T SLIDING (MESH)'];
  }
  if (upper.startsWith('3T') || upper.includes('3T') || upper.includes('3.5T')) {
    return LS_MODEL_COLOR_MAP['3T SLIDING'];
  }
  if (upper.includes('SL/SL') || upper.startsWith('2T') || upper.includes('2T') || upper.includes('TRACK')) {
    return LS_MODEL_COLOR_MAP['2T SLIDING'];
  }

  // 2. Fixed Window
  if (upper.includes('FIXED')) {
    return LS_MODEL_COLOR_MAP['FIXED WINDOW'];
  }

  // 3. Open Casement / Double & 3-Open Window variations ([OP/OP], [OP/OP/OP], DOUBLE, 3-OPEN, TRIPLE)
  if (upper.includes('OP/OP') || upper.includes('DOUBLE') || upper.includes('3-OPEN') || upper.includes('TRIPLE')) {
    return LS_MODEL_COLOR_MAP['DOUBLE WINDOW'];
  }
  if (
    upper.includes('[OP]') ||
    upper === 'OP' ||
    upper.includes('SINGLE') ||
    upper.includes('CASEMENT') ||
    (upper.includes('OPEN') && !upper.includes('3-OPEN'))
  ) {
    return LS_MODEL_COLOR_MAP['SINGLE WINDOW'];
  }

  // 4. Ventilator variations (Fan Left vs Fan Right vs Normal)
  if (upper.includes('VENT') || upper.includes('VENTILATOR') || upper.includes('FAN')) {
    if (
      upper.includes('RIGHT') ||
      upper.includes('FAN R') ||
      upper.endsWith(' R') ||
      upper.endsWith('RIGHT') ||
      upper.includes('FAN-R') ||
      upper.includes('(R)') ||
      upper.includes('(RIGHT)') ||
      upper.includes('FAN R]')
    ) {
      return LS_MODEL_COLOR_MAP['ventilator with fans Right'];
    }
    if (
      upper.includes('LEFT') ||
      upper.includes('FAN L') ||
      upper.endsWith(' L') ||
      upper.endsWith('LEFT') ||
      upper.includes('FAN-L') ||
      upper.includes('(L)') ||
      upper.includes('(LEFT)') ||
      upper.includes('FAN L]')
    ) {
      return LS_MODEL_COLOR_MAP['ventilator with fans Left'];
    }
    return LS_MODEL_COLOR_MAP['ventilator/normal'];
  }

  // 5. Generic Sliding
  if (upper.includes('SLIDING') || upper.includes('SL/')) {
    return LS_MODEL_COLOR_MAP['SLIDING WINDOW'];
  }

  return { pdf: [7, 89, 133], canvas: '#075985', name: 'Navy Blue' };
};

/**
 * Sanitizes strings for standard PDF WinAnsi / Latin-1 fonts
 */
export const cleanText = (str: string | number | undefined | null): string => {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/→/g, '->')
    .replace(/×/g, 'x')
    .replace(/²/g, '2')
    .replace(/±/g, '+/-')
    .replace(/’/g, "'")
    .replace(/‘/g, "'")
    .replace(/”/g, '"')
    .replace(/“/g, '"')
    .replace(/•/g, '-')
    .trim();
};

/**
 * Formats cut dimensions for vector PDF cells cleanly (e.g. "1442 x 1149")
 * Removes redundant 'H' and 'W' labels because the sub-column header directly above already specifies "Height X Width",
 * enabling massive, high-contrast bold fonts (+40% larger) that workshop cutters can read clearly.
 */
export const formatCellCutText = (rawText: string | undefined | null): string => {
  if (!rawText) return '-';
  const cleaned = cleanText(rawText);
  if (!cleaned || cleaned === '-') return '-';
  return cleaned
    .replace(/\s*H\s*[x×]\s*/i, ' x ')
    .replace(/\s*W$/i, '')
    .trim();
};

/**
 * Formats cut dimensions for Canvas PNG / Preview cells cleanly (e.g. "1442 × 1149")
 */
export const formatCanvasCellCutText = (rawText: string | undefined | null): string => {
  if (!rawText) return '-';
  const str = String(rawText).trim();
  if (!str || str === '-') return '-';
  return str
    .replace(/\s*H\s*[x×]\s*/i, ' × ')
    .replace(/\s*W$/i, '')
    .trim();
};

/**
 * Formats inch number into fractional workshop format e.g. 48 1/8", 48 1/2", 36"
 */
export const formatInchWithFraction = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val) || val <= 0) return '';
  const whole = Math.floor(val);
  const frac = val - whole;

  if (frac < 0.01) return `${whole}"`;

  // Standard workshop eighths check
  const eighths = Math.round(frac * 8);
  if (Math.abs(frac - eighths / 8) < 0.02) {
    if (eighths === 8) return `${whole + 1}"`;
    if (eighths === 4) return whole > 0 ? `${whole} 1/2"` : `1/2"`;
    if (eighths === 2) return whole > 0 ? `${whole} 1/4"` : `1/4"`;
    if (eighths === 6) return whole > 0 ? `${whole} 3/4"` : `3/4"`;
    return whole > 0 ? `${whole} ${eighths}/8"` : `${eighths}/8"`;
  }

  return `${parseFloat(val.toFixed(2))}"`;
};

/**
 * Returns workshop-recognized model name for a calculation result
 */
export const getLSModelName = (r: CalculationResult, customSuffix?: string): string => {
  const { frameType, windowType, casementSubtype, ventilatorSubtype, ventilatorFanSide } = r.input;
  let base = '';

  if (windowType === 'ventilator') {
    if (ventilatorSubtype === 'fan') {
      const side = ventilatorFanSide === 'right' ? 'Right' : 'Left';
      base = `ventilator with fans ${side}`;
    } else {
      base = 'ventilator/normal';
    }
  } else if (windowType === 'sliding') {
    if (r.input.profileSeries === '85mm' || r.frame?.profileDepthMM === 85) {
      if (frameType === '2.5-track') {
        base = '2.5T SLIDING DOOR (MESH)';
      } else if (frameType === '3-track' || frameType === '3.5-track') {
        base = '3T SLIDING DOOR';
      } else {
        base = '2T SLIDING DOOR';
      }
    } else if (frameType === '2-track') {
      base = '2T SLIDING';
    } else if (frameType === '2.5-track') {
      base = '2.5T SLIDING (MESH)';
    } else if (frameType === '3-track' || frameType === '3.5-track') {
      base = '3T SLIDING';
    } else if (frameType === '4-track') {
      base = '4T SLIDING';
    } else {
      base = 'SLIDING WINDOW';
    }
  } else if (windowType === 'open') {
    if (casementSubtype === 'triple') {
      base = '3-OPEN WINDOW';
    } else if (casementSubtype === 'double') {
      base = 'DOUBLE WINDOW';
    } else {
      base = 'SINGLE WINDOW';
    }
  } else if (windowType === 'fixed') {
    base = 'FIXED WINDOW';
  } else {
    base = 'WINDOW';
  }

  if (customSuffix) {
    return `${base} ${customSuffix}`;
  }
  return base;
};

/**
 * Standardized short form codes for L.S. Interiors Order Sheet (Vector PDF & Canvas PNG)
 * - sliding window (2 track) -> [SL/SL]
 * - sliding window (2.5 track mesh) -> [SL/SL/MESH]
 * - sliding window (3 track) -> [SL/SL/SL]
 * - sliding window (4 track) -> [SL/SL/SL/SL]
 * - open window (single window) -> [OP]
 * - open window (double window) -> [OP/OP]
 * - open window (3-open window) -> [OP/OP/OP]
 * - fixed window -> [FIXED]
 * - ventilator -> [VENT] (or [VENT/FAN R] / [VENT/FAN L])
 */
export const getLSModelShortForm = (
  input: CalculationResult | WindowInput | string
): string => {
  if (typeof input === 'string') {
    const clean = input.replace(/^W\d+[a-z]?\s*[•\-]\s*/i, '').trim().toUpperCase();
    if (clean.includes('SL/SL/DOOR/MESH') || clean.includes('SL/SL/MESH/DOOR') || (clean.includes('DOOR') && clean.includes('MESH'))) return '[SL/SL/DOOR/MESH]';
    if (clean.includes('SL/SL/SL/DOOR') || (clean.includes('DOOR') && (clean.includes('3T') || clean.includes('3 TRACK') || clean.includes('3-TRACK')))) return '[SL/SL/SL/DOOR]';
    if (clean.includes('DOOR') || clean.includes('SL/SL/DOOR') || clean.includes('85MM')) return '[SL/SL/DOOR]';
    if (clean.includes('MESH') || clean.includes('2.5T')) return '[SL/SL/MESH]';
    if (clean.includes('4T') || clean.includes('4 TRACK') || clean.includes('SL/SL/SL/SL')) return '[SL/SL/SL/SL]';
    if (clean.includes('3T') || clean.includes('3.5T') || clean.includes('3 TRACK') || clean.includes('SL/SL/SL')) return '[SL/SL/SL]';
    if (clean.includes('2T') || clean.includes('SLIDING') || clean.includes('SL/SL')) return '[SL/SL]';
    if (clean.includes('3-OPEN') || clean.includes('TRIPLE') || clean.includes('OP/OP/OP')) return '[OP/OP/OP]';
    if (clean.includes('DOUBLE') || clean.includes('OP/OP')) return '[OP/OP]';
    if (clean.includes('SINGLE') || clean.includes('CASEMENT') || clean.includes('OPEN') || clean === '[OP]' || clean === 'OP') return '[OP]';
    if (clean.includes('FIXED')) return '[FIXED]';
    if (clean.includes('VENTILATOR') || clean.includes('VENT') || clean.includes('FAN')) {
      if (clean.includes('RIGHT') || clean.includes('FAN R')) return '[VENT/FAN R]';
      if (clean.includes('LEFT') || clean.includes('FAN L')) return '[VENT/FAN L]';
      if (clean.includes('FAN')) return '[VENT/FAN]';
      return '[VENT]';
    }
    return '[' + clean + ']';
  }

  const winInput: WindowInput = 'input' in input ? input.input : input;
  const { frameType, windowType, casementSubtype, ventilatorSubtype, ventilatorFanSide } = winInput;

  if (windowType === 'sliding') {
    if (winInput.profileSeries === '85mm') {
      if (frameType === '2.5-track') return '[SL/SL/DOOR/MESH]';
      if (frameType === '3-track' || frameType === '3.5-track') return '[SL/SL/SL/DOOR]';
      return '[SL/SL/DOOR]';
    }
    if (frameType === '2-track') return '[SL/SL]';
    if (frameType === '2.5-track') return '[SL/SL/MESH]';
    if (frameType === '3-track' || frameType === '3.5-track') return '[SL/SL/SL]';
    if (frameType === '4-track') return '[SL/SL/SL/SL]';
    return '[SL/SL]';
  }

  if (windowType === 'open') {
    if (casementSubtype === 'triple') return '[OP/OP/OP]';
    if (casementSubtype === 'double') return '[OP/OP]';
    return '[OP]';
  }

  if (windowType === 'fixed') {
    return '[FIXED]';
  }

  if (windowType === 'ventilator') {
    if (ventilatorSubtype === 'fan') {
      return ventilatorFanSide === 'right' ? '[VENT/FAN R]' : '[VENT/FAN L]';
    }
    return '[VENT]';
  }

  return '[WIN]';
};

/**
 * Checks if a batch of results contains any 2.5-track or mosquito mesh window
 */
export const has2_5TrackInResults = (results: CalculationResult[]): boolean => {
  if (!results || results.length === 0) return false;
  return results.some(
    (r) => r.input.frameType === '2.5-track' || (r.additionalPanels && r.additionalPanels.length > 0)
  );
};

/**
 * Checks if a batch of results contains any sliding window (2-track, 2.5-track, 3-track, 3.5-track)
 */
export const hasSlidingInResults = (results: CalculationResult[]): boolean => {
  if (!results || results.length === 0) return false;
  return results.some((r) => r.input.windowType === 'sliding');
};

/**
 * Checks if a batch of results contains any double window or 3-open window (open casement with mullion)
 */
export const hasDoubleWindowInResults = (results: CalculationResult[]): boolean => {
  if (!results || results.length === 0) return false;
  return results.some(
    (r) => r.input.windowType === 'open' && (r.input.casementSubtype === 'double' || r.input.casementSubtype === 'triple')
  );
};

/**
 * Converts CalculationResults into printable rows for L.S. Interiors order sheet
 * Includes: Site Size, Model Name, Outer Frame mm, Sash Cut mm, optional Mullion mm, optional Interlock mm, Mirror Cut mm, and optional 2.5T Mesh mm
 */
export const prepareLSRows = (
  results: CalculationResult[],
  options: LSInteriorsExportOptions = {}
): LSFlattenedRow[] => {
  const hasMesh = options.includeMeshColumn ?? false;
  const hasInterlock = options.includeInterlockColumn ?? hasSlidingInResults(results);
  const hasMullion = options.includeMullionColumn ?? hasDoubleWindowInResults(results);
  const mullionDed = options.mullionDeductionMM !== undefined ? options.mullionDeductionMM : 6;
  const rows: LSFlattenedRow[] = [];

  const variantLabels = computeWindowVariantLabels(results);

  results.forEach((r, idx) => {
    const variant = variantLabels[idx] || {
      letter: '',
      siNo: String(idx + 1),
      windowLabel: `W${idx + 1}`
    };
    const siteH = r.input.unit === 'cm'
      ? `${r.input.heightCm ?? Number((r.input.heightInch * 2.54).toFixed(1))} cm`
      : r.input.unit === 'mm'
        ? `${r.input.heightMM ?? Math.round(r.input.heightInch * 25.4)} mm`
        : formatInchWithFraction(r.input.heightInch);

    const siteW = r.input.unit === 'cm'
      ? `${r.input.widthCm ?? Number((r.input.widthInch * 2.54).toFixed(1))} cm`
      : r.input.unit === 'mm'
        ? `${r.input.widthMM ?? Math.round(r.input.widthInch * 25.4)} mm`
        : formatInchWithFraction(r.input.widthInch);

    // Outer Frame cut mm: Jambs (H) x Top/Bottom Track (W)
    const outerFrame = `${r.frame.leftRightCutMM} H × ${r.frame.topBottomCutMM} W`;

    // Sash / Shutter cut mm: Vertical Styles (H) x Rails (W)
    const sashCut =
      r.panel && r.panel.count > 0
        ? `${r.panel.heightMM} H × ${r.panel.widthMM} W`
        : '-';

    // Number of sash pieces:
    // Each sash has 4 profile pieces: 2 Height (vertical stiles) + 2 Width (horizontal rails)
    // Separate counts: H Pcs = panelCount × 2 × qty, W Pcs = panelCount × 2 × qty
    const qty = r.input.quantity && r.input.quantity > 0 ? r.input.quantity : 1;
    const sashPcsCount =
      r.panel && r.panel.count > 0
        ? String(r.panel.count * 4 * qty)
        : '-';
    const sashHPcsCount =
      r.panel && r.panel.count > 0
        ? String(r.panel.count * 2 * qty)
        : '-';
    const sashWPcsCount =
      r.panel && r.panel.count > 0
        ? String(r.panel.count * 2 * qty)
        : '-';

    // Mullion cut mm: Frame Height - 6 mm (customizable: Height - 6, no sash height), applicable to open window double & 3-open
    let mullionCut: string | undefined = undefined;
    let mullionPcs: string | undefined = undefined;
    if (hasMullion) {
      if (r.input.windowType === 'open' && (r.input.casementSubtype === 'double' || r.input.casementSubtype === 'triple') && r.frame && r.frame.heightMM > 0) {
        const val = Math.max(0, r.frame.heightMM - mullionDed);
        mullionCut = `${val} mm`;
        const multiplier = r.input.casementSubtype === 'triple' ? 2 : 1;
        mullionPcs = String(multiplier * (r.input.quantity && r.input.quantity > 0 ? r.input.quantity : 1));
      } else {
        mullionCut = '-';
        mullionPcs = '-';
      }
    }

    // Interlock cut mm: Sash Height - 5 mm (applicable only to sliding windows: 2-track, 2.5-track, 3-track)
    let interlockCut: string | undefined = undefined;
    if (hasInterlock) {
      if (r.input.windowType === 'sliding' && r.panel && r.panel.count > 0) {
        const val = r.interlockMM ?? Math.max(0, r.panel.heightMM - 5);
        interlockCut = `${val} mm`;
      } else {
        interlockCut = '-';
      }
    }

    // Mirror / Glass cut mm: Glass Height x Glass Width
    const mirrorCut =
      r.input.windowType === 'ventilator' || !r.mirror || r.mirror.count === 0
        ? '-'
        : `${r.mirror.heightMM} H × ${r.mirror.widthMM} W`;

    // Number of glass pieces:
    const glassPcsCount =
      r.input.windowType === 'ventilator' || !r.mirror || r.mirror.count === 0
        ? '-'
        : String(r.mirror.count * (r.input.quantity && r.input.quantity > 0 ? r.input.quantity : 1));

    // Optional 2.5T Mesh Sash Cut mm: Mesh Height x Mesh Width
    let meshCut: string | undefined = undefined;
    if (hasMesh) {
      if (r.additionalPanels && r.additionalPanels.length > 0) {
        const mesh = r.additionalPanels[0];
        meshCut = `${mesh.heightMM} H × ${mesh.widthMM} W`;
      } else {
        meshCut = '-';
      }
    }

    // Material mm: 65 mm for 65mm sliding windows, 58 mm for other sliding windows, '-' for others
    const isSliding = r.input.windowType === 'sliding';
    const is85mmSliding = isSliding && (r.input.profileSeries === '85mm' || r.frame.profileDepthMM === 85);
    const is65mmSliding = !is85mmSliding && isSliding && (r.input.profileSeries === '65mm' || r.frame.profileDepthMM === 65);
    const materialMM = is85mmSliding ? '85 mm' : (is65mmSliding ? '65 mm' : (isSliding ? '58 mm' : '-'));

    const isFixed = r.input.windowType === 'fixed';
    const modelShortForm = getLSModelShortForm(r);

    rows.push({
      siNo: variant.siNo,
      siteHeight: siteH,
      siteWidth: siteW,
      modelName: modelShortForm,
      materialMM: materialMM,
      outerFrameMM: outerFrame,
      sashCutMM: sashCut,
      sashPcs: sashPcsCount,
      sashHPcs: sashHPcsCount,
      sashWPcs: sashWPcsCount,
      mullionMM: mullionCut,
      mullionPcs: mullionPcs,
      interlockMM: interlockCut,
      mirrorCutMM: mirrorCut,
      glassPcs: glassPcsCount,
      glassType: '', // Empty column: clients fill it out
      meshCutMM: meshCut,
      windowType: r.input.windowType,
      casementSubtype: r.input.casementSubtype,
      isFixed
    });
  });

  return rows;
};

/**
 * Draws a True Vector L.S. Interiors Page directly in jsPDF (Infinite Resolution / Razor-sharp Print Quality)
 */
export const renderLSInteriorsVectorPage = (
  doc: jsPDF,
  pageRows: LSFlattenedRow[],
  options: LSInteriorsExportOptions = {}
): void => {
  const inkDark: [number, number, number] = [15, 41, 82]; // #0f2952 (deep navy)
  const inkGrid: [number, number, number] = [30, 58, 138]; // #1e3a8a

  const marginX = 7;
  const marginTop = 8;
  const boxW = 196; // Exact total table width in mm (A4 width 210mm - 14mm margins)
  const headerH = 14;
  const tableHeaderH = 9.8;
  const rowH = 9.18;
  const numRows = 28;
  const totalBoxH = headerH + tableHeaderH + numRows * rowH; // 280.84 mm

  // 1. Outer Border Box (Vector Rectangle) - Crisp 0.55mm Frame
  doc.setDrawColor(...inkDark);
  doc.setLineWidth(0.55);
  doc.rect(marginX, marginTop, boxW, totalBoxH);

  // 2. Header Bottom Divider Line
  const headerBottomY = marginTop + headerH;
  doc.setLineWidth(0.42);
  doc.line(marginX, headerBottomY, marginX + boxW, headerBottomY);

  // 3. Header Text - Responsive Branding with Anti-Collision Protection
  const customerName = options.customerName?.trim() || '';
  const dateStr = options.date?.trim() || new Date().toLocaleDateString('en-GB');

  // Customer Name (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...inkDark);
  doc.text('Customer Name :', marginX + 3, marginTop + headerH / 2, { baseline: 'middle' });

  if (customerName) {
    let custSize = 11.5;
    doc.setFontSize(custSize);
    doc.setTextColor(29, 78, 216); // blue-700
    const custClean = cleanText(customerName);
    // Center title begins at x=70mm. marginX + 36 = 43mm. Max allowed customer width is 26mm.
    while (doc.getTextWidth(custClean) > 26 && custSize > 6.5) {
      custSize -= 0.4;
      doc.setFontSize(custSize);
    }
    doc.text(custClean, marginX + 36, marginTop + headerH / 2, { baseline: 'middle' });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(100, 116, 139);
    doc.text('.....................................', marginX + 36, marginTop + headerH / 2, { baseline: 'middle' });
  }

  // L.S.INTERIORS (Center Title - Exactly centered at x=105mm)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...inkDark);
  doc.text('L.S.INTERIORS', 105, marginTop + headerH / 2, { align: 'center', baseline: 'middle' });

  // Date (Right - exactly inside right border)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...inkDark);
  if (dateStr) {
    doc.text(`Date :  ${cleanText(dateStr)}`, marginX + boxW - 3, marginTop + headerH / 2, { align: 'right', baseline: 'middle' });
  } else {
    doc.text('Date : ........................', marginX + boxW - 3, marginTop + headerH / 2, { align: 'right', baseline: 'middle' });
  }

  // 4. Columns & Widths - ALL CONFIGURATIONS SUM TO EXACTLY 196 MM
  const includeMesh = options.includeMeshColumn ?? false;
  const includeInterlock = options.includeInterlockColumn ?? (pageRows.some(r => r.interlockMM !== undefined) || false);
  const includeMullion = options.includeMullionColumn ?? (pageRows.some(r => r.mullionMM !== undefined) || false);
  const mullionDed = options.mullionDeductionMM ?? 6;
  const mullionSubHeader = `H - ${mullionDed}`;

  interface ColumnDef {
    id: LSColumnId;
    header: string;
    subHeader?: string;
    width: number;
    colorPdf: [number, number, number];
  }

  let cols: ColumnDef[] = [];

  if (includeMullion && includeInterlock && includeMesh) {
    // 17 Columns (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 7, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 11, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 11, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 20, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 10, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 17, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 15, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 13, colorPdf: LS_COLOR_MAP.mullion.pdf },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 7, colorPdf: LS_COLOR_MAP.mullionPcs.pdf },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 14, colorPdf: LS_COLOR_MAP.interlock.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 17, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 7, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 11, colorPdf: LS_COLOR_MAP.glassType.pdf },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'H × W', width: 14, colorPdf: LS_COLOR_MAP.meshCut.pdf }
    ];
  } else if (includeMullion && includeInterlock && !includeMesh) {
    // 16 Columns (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 7, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 12, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 12, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 21, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 11, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 18, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 16, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 14, colorPdf: LS_COLOR_MAP.mullion.pdf },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.mullionPcs.pdf },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 15, colorPdf: LS_COLOR_MAP.interlock.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 18, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 14, colorPdf: LS_COLOR_MAP.glassType.pdf }
    ];
  } else if (includeMullion && !includeInterlock && includeMesh) {
    // 16 Columns (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 7, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 12, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 12, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 21, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 11, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 18, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 16, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 14, colorPdf: LS_COLOR_MAP.mullion.pdf },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.mullionPcs.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 18, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 14, colorPdf: LS_COLOR_MAP.glassType.pdf },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'H × W', width: 15, colorPdf: LS_COLOR_MAP.meshCut.pdf }
    ];
  } else if (!includeMullion && includeInterlock && includeMesh) {
    // 15 Columns (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 7, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 12, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 12, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 22, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 11, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 20, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 17, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 16, colorPdf: LS_COLOR_MAP.interlock.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 19, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 14, colorPdf: LS_COLOR_MAP.glassType.pdf },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'H × W', width: 16, colorPdf: LS_COLOR_MAP.meshCut.pdf }
    ];
  } else if (includeMullion && !includeInterlock && !includeMesh) {
    // 15 Columns (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 7, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 12, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 12, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 22, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 11, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 20, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 17, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 15, colorPdf: LS_COLOR_MAP.mullion.pdf },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.mullionPcs.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 20, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 22, colorPdf: LS_COLOR_MAP.glassType.pdf }
    ];
  } else if (!includeMullion && includeInterlock && !includeMesh) {
    // 14 Columns (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 8, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 13, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 13, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 22, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 11, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 21, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 18, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 17, colorPdf: LS_COLOR_MAP.interlock.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 20, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 23, colorPdf: LS_COLOR_MAP.glassType.pdf }
    ];
  } else if (!includeMullion && !includeInterlock && includeMesh) {
    // 14 Columns (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 8, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 13, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 13, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 22, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 11, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 21, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 18, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 21, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 21, colorPdf: LS_COLOR_MAP.glassType.pdf },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'H × W', width: 18, colorPdf: LS_COLOR_MAP.meshCut.pdf }
    ];
  } else {
    // 13 Columns Standard (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 8, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 13, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 13, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 23, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 12, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 22, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 19, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 9, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 22, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 9, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 33, colorPdf: LS_COLOR_MAP.glassType.pdf }
    ];
  }

  const modelColumnIndex = cols.findIndex((col) => col.id === 'model');
  const materialColumnIndex = cols.findIndex((col) => col.id === 'materialMM');
  const outerFrameColumnIndex = cols.findIndex((col) => col.id === 'outerFrame');
  if (
    modelColumnIndex >= 0 &&
    materialColumnIndex === modelColumnIndex + 1 &&
    outerFrameColumnIndex >= 0
  ) {
    const [modelColumn, materialColumn] = cols.splice(modelColumnIndex, 2);
    const updatedOuterFrameIndex = cols.findIndex((col) => col.id === 'outerFrame');
    cols.splice(updatedOuterFrameIndex + 1, 0, modelColumn, materialColumn);
  }

  const colX: number[] = [marginX];
  for (let i = 0; i < cols.length; i++) {
    colX.push(colX[i] + cols[i].width);
  }

  // Table Header Row Bottom Divider Line
  const tableHeaderTopY = headerBottomY;
  const tableHeaderBottomY = tableHeaderTopY + tableHeaderH;
  const subHeaderDividerY = tableHeaderTopY + 4.9;

  // Crisp Light Slate Background for Table Header Row
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, tableHeaderTopY, boxW, tableHeaderH, 'F');

  doc.setDrawColor(...inkDark);
  doc.setLineWidth(0.42);
  doc.line(marginX, tableHeaderBottomY, marginX + boxW, tableHeaderBottomY);

  // Divider line dividing main column and sub-column (colX[4] to marginX + boxW)
  doc.setLineWidth(0.32);
  doc.line(colX[4], subHeaderDividerY, marginX + boxW, subHeaderDividerY);

  // Column Headers Text with Proportional Safe Scaling (No Letter Overlays)
  for (let c = 0; c < cols.length; c++) {
    const col = cols[c];
    const centerX = colX[c] + col.width / 2;
    const colColor = col.colorPdf;

    if (col.id === 'model' && cols[c + 1]?.id === 'materialMM') {
      // Main grouped header spanning across both model and materialMM
      const combinedW = cols[c].width + cols[c + 1].width;
      const combinedCenterX = colX[c] + combinedW / 2;
      doc.setFont('helvetica', 'bold');
      let headerSize = 7.5;
      doc.setFontSize(headerSize);
      while (doc.getTextWidth(cleanText(col.header)) > (combinedW - 2.5) && headerSize > 4.5) {
        headerSize -= 0.2;
        doc.setFontSize(headerSize);
      }
      doc.setTextColor(...colColor);
      doc.text(cleanText(col.header), combinedCenterX, tableHeaderTopY + 2.6, { align: 'center', baseline: 'middle' });

      // Sub-column header for Type
      doc.setFont('helvetica', 'bold');
      let typeFontSize = 6.8;
      doc.setFontSize(typeFontSize);
      const typeText = cleanText(col.subHeader || 'Type');
      while (doc.getTextWidth(typeText) > (col.width - 2.0) && typeFontSize > 4.0) {
        typeFontSize -= 0.2;
        doc.setFontSize(typeFontSize);
      }
      doc.text(typeText, centerX, subHeaderDividerY + 2.5, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'materialMM') {
      // Sub-column header for material mm - Single Clean Line (No Vertical Letter Overlay)
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colColor);
      let subFontSize = 5.8;
      doc.setFontSize(subFontSize);
      const matLabel = 'Material mm';
      while (doc.getTextWidth(matLabel) > (col.width - 1.2) && subFontSize > 3.8) {
        subFontSize -= 0.2;
        doc.setFontSize(subFontSize);
      }
      doc.text(matLabel, centerX, subHeaderDividerY + 2.5, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'sashCut' && cols[c + 1]?.id === 'sashHPcs') {
      // Main grouped header spanning sashCut + sashHPcs + sashWPcs
      const sashGroupCols = [cols[c]];
      if (cols[c + 1]?.id === 'sashHPcs') sashGroupCols.push(cols[c + 1]);
      if (cols[c + 2]?.id === 'sashWPcs') sashGroupCols.push(cols[c + 2]);
      const combinedW = sashGroupCols.reduce((s, cc) => s + cc.width, 0);
      const combinedCenterX = colX[c] + combinedW / 2;
      doc.setFont('helvetica', 'bold');
      let headerSize = 7.5;
      doc.setFontSize(headerSize);
      while (doc.getTextWidth(cleanText(col.header)) > (combinedW - 2.5) && headerSize > 4.5) {
        headerSize -= 0.2;
        doc.setFontSize(headerSize);
      }
      doc.setTextColor(...colColor);
      doc.text(cleanText(col.header), combinedCenterX, tableHeaderTopY + 2.6, { align: 'center', baseline: 'middle' });

      // Sub-column header for sash cut
      doc.setFont('helvetica', 'bold');
      let subFontSize = 6.2;
      doc.setFontSize(subFontSize);
      const subText = cleanText(col.subHeader || 'H × W');
      while (doc.getTextWidth(subText) > (col.width - 1.8) && subFontSize > 3.8) {
        subFontSize -= 0.2;
        doc.setFontSize(subFontSize);
      }
      doc.text(subText, centerX, subHeaderDividerY + 2.5, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'sashHPcs' || col.id === 'sashWPcs') {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colColor);
      const label = col.id === 'sashHPcs' ? 'H Pcs' : 'W Pcs';
      let subFontSize = 5.6;
      doc.setFontSize(subFontSize);
      while (doc.getTextWidth(label) > (col.width - 1.2) && subFontSize > 3.6) {
        subFontSize -= 0.2;
        doc.setFontSize(subFontSize);
      }
      doc.text(label, centerX, subHeaderDividerY + 2.5, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'mullion' && cols[c + 1]?.id === 'mullionPcs') {
      const combinedW = cols[c].width + cols[c + 1].width;
      const combinedCenterX = colX[c] + combinedW / 2;
      doc.setFont('helvetica', 'bold');
      let headerSize = 7.5;
      doc.setFontSize(headerSize);
      while (doc.getTextWidth(cleanText(col.header)) > (combinedW - 2.5) && headerSize > 4.5) {
        headerSize -= 0.2;
        doc.setFontSize(headerSize);
      }
      doc.setTextColor(...colColor);
      doc.text(cleanText(col.header), combinedCenterX, tableHeaderTopY + 2.6, { align: 'center', baseline: 'middle' });

      doc.setFont('helvetica', 'bold');
      let subFontSize = 6.2;
      doc.setFontSize(subFontSize);
      const subText = cleanText(col.subHeader || '');
      while (doc.getTextWidth(subText) > (col.width - 1.8) && subFontSize > 3.8) {
        subFontSize -= 0.2;
        doc.setFontSize(subFontSize);
      }
      doc.text(subText, centerX, subHeaderDividerY + 2.5, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'mullionPcs' || col.id === 'glassPcs') {
      doc.setFont('helvetica', 'bold');
      let pcsFontSize = 5.8;
      doc.setFontSize(pcsFontSize);
      const pcsText = cleanText(col.subHeader || 'No.Pcs');
      while (doc.getTextWidth(pcsText) > (col.width - 1.2) && pcsFontSize > 3.6) {
        pcsFontSize -= 0.2;
        doc.setFontSize(pcsFontSize);
      }
      doc.setTextColor(...colColor);
      doc.text(pcsText, centerX, subHeaderDividerY + 2.5, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'mirrorCut' && cols[c + 1]?.id === 'glassPcs') {
      const combinedW = cols[c].width + cols[c + 1].width;
      const combinedCenterX = colX[c] + combinedW / 2;
      doc.setFont('helvetica', 'bold');
      let headerSize = 7.5;
      doc.setFontSize(headerSize);
      while (doc.getTextWidth(cleanText(col.header)) > (combinedW - 2.5) && headerSize > 4.5) {
        headerSize -= 0.2;
        doc.setFontSize(headerSize);
      }
      doc.setTextColor(...colColor);
      doc.text(cleanText(col.header), combinedCenterX, tableHeaderTopY + 2.6, { align: 'center', baseline: 'middle' });

      doc.setFont('helvetica', 'bold');
      let subFontSize = 6.2;
      doc.setFontSize(subFontSize);
      const subText = cleanText(col.subHeader || 'H × W');
      while (doc.getTextWidth(subText) > (col.width - 1.8) && subFontSize > 3.8) {
        subFontSize -= 0.2;
        doc.setFontSize(subFontSize);
      }
      doc.text(subText, centerX, subHeaderDividerY + 2.5, { align: 'center', baseline: 'middle' });
    } else if (col.subHeader) {
      doc.setFont('helvetica', 'bold');
      let headerFontSize = 7.0;
      doc.setFontSize(headerFontSize);
      const headerText = cleanText(col.header);
      while (doc.getTextWidth(headerText) > (col.width - 1.8) && headerFontSize > 4.2) {
        headerFontSize -= 0.2;
        doc.setFontSize(headerFontSize);
      }
      doc.setTextColor(...colColor);
      doc.text(headerText, centerX, tableHeaderTopY + 2.6, { align: 'center', baseline: 'middle' });

      let subFontSize = 6.0;
      doc.setFontSize(subFontSize);
      const subText = cleanText(col.subHeader);
      while (doc.getTextWidth(subText) > (col.width - 1.8) && subFontSize > 3.8) {
        subFontSize -= 0.2;
        doc.setFontSize(subFontSize);
      }
      doc.setTextColor(...colColor);
      doc.text(subText, centerX, subHeaderDividerY + 2.5, { align: 'center', baseline: 'middle' });
    } else {
      // Single full-height header
      doc.setFont('helvetica', 'bold');
      let fullFontSize = 7.8;
      doc.setFontSize(fullFontSize);
      const headerText = cleanText(col.header);
      while (doc.getTextWidth(headerText) > (col.width - 1.6) && fullFontSize > 4.0) {
        fullFontSize -= 0.2;
        doc.setFontSize(fullFontSize);
      }
      doc.setTextColor(...colColor);
      doc.text(headerText, centerX, tableHeaderTopY + tableHeaderH / 2, { align: 'center', baseline: 'middle' });
    }
  }

  // 5. High-Precision Responsive Cell Drawing (Zero Overlay, Values Never Cross Column Lines)
  const drawCellText = (
    text: string,
    centerX: number,
    centerY: number,
    baseFontSize: number,
    maxWidth: number,
    color: [number, number, number],
    align: 'center' | 'left' = 'center',
    leftX?: number,
    isBold: boolean = false
  ) => {
    if (!text || text === '') return;
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    let currentSize = baseFontSize;
    doc.setFontSize(currentSize);
    let textW = doc.getTextWidth(text);
    // Instant proportional auto-scaling: guarantees text never crosses the column line
    if (textW > maxWidth && maxWidth > 0) {
      currentSize = Math.max(3.2, currentSize * (maxWidth / textW));
      doc.setFontSize(currentSize);
      textW = doc.getTextWidth(text);
      while (textW > maxWidth && currentSize > 2.8) {
        currentSize -= 0.15;
        doc.setFontSize(currentSize);
        textW = doc.getTextWidth(text);
      }
    }
    doc.setTextColor(...color);
    if (align === 'center') {
      doc.text(text, centerX, centerY, { align: 'center', baseline: 'middle' });
    } else {
      doc.text(text, leftX ?? (centerX - maxWidth / 2), centerY, { align: 'left', baseline: 'middle' });
    }
  };

  const cellTextColorPdf: [number, number, number] = [15, 23, 42];

  // 6. Data Rows (28 Rows) - Formed as Prominent Enclosed Boxes with Unique Model Background Colors
  for (let r = 0; r < numRows; r++) {
    const rowTopY = tableHeaderBottomY + r * rowH;
    const rowBottomY = rowTopY + rowH;
    const centerY = rowTopY + rowH / 2;

    const row = pageRows[r];
    const isFixed = Boolean(row && (row.isFixed ?? (row.windowType === 'fixed' || row.modelName?.toUpperCase().includes('FIXED'))));

    if (row) {
      const bg = getLSModelBgColor(row);
      doc.setFillColor(...bg.pdf);
      doc.rect(marginX, rowTopY, boxW, rowH, 'F');
    }

    doc.setDrawColor(...inkDark);
    doc.setLineWidth(0.38);
    doc.line(marginX, rowBottomY, marginX + boxW, rowBottomY);

    // Multiplier 'X' in Column 2
    doc.setFont('helvetica', isFixed ? 'bold' : 'normal');
    doc.setFontSize(10.5);
    if (row) {
      doc.setTextColor(...cellTextColorPdf);
    } else {
      doc.setTextColor(203, 213, 225);
    }
    doc.text('X', colX[2] + cols[2].width / 2, centerY, { align: 'center', baseline: 'middle' });

    if (row) {
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        const centerX = colX[c] + col.width / 2;
        // Safe inner boundary: guaranteed 1.2mm minimum margin from column lines
        const availableW = Math.max(2.0, col.width - 2.4);
        const baseSize = 8.0;

        switch (col.id) {
          case 'sino':
            if (row.siNo) {
              drawCellText(row.siNo, centerX, centerY, 8.5, availableW, cellTextColorPdf, 'center', undefined, isFixed);
            }
            break;
          case 'height':
            if (row.siteHeight) {
              drawCellText(cleanText(row.siteHeight), centerX, centerY, 8.0, availableW, cellTextColorPdf, 'center', undefined, isFixed);
            }
            break;
          case 'x':
            break;
          case 'width':
            if (row.siteWidth) {
              drawCellText(cleanText(row.siteWidth), centerX, centerY, 8.0, availableW, cellTextColorPdf, 'center', undefined, isFixed);
            }
            break;
          case 'model':
            if (row.modelName) {
              const isDoor = row.modelName.includes('DOOR');
              const modelColor = isDoor
                ? ([2, 132, 199] as [number, number, number])
                : cellTextColorPdf;
              drawCellText(
                cleanText(row.modelName),
                centerX,
                centerY,
                7.2,
                availableW,
                modelColor,
                'center',
                undefined,
                isFixed || isDoor
              );
            }
            break;
          case 'materialMM':
            if (row.materialMM) {
              drawCellText(
                cleanText(row.materialMM),
                centerX,
                centerY,
                7.8,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'outerFrame':
            if (row.outerFrameMM) {
              drawCellText(
                formatCellCutText(row.outerFrameMM),
                centerX,
                centerY,
                7.8,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'sashCut':
            if (row.sashCutMM) {
              drawCellText(
                formatCellCutText(row.sashCutMM),
                centerX,
                centerY,
                7.8,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'sashHPcs':
            if (row.sashHPcs) {
              drawCellText(
                row.sashHPcs,
                centerX,
                centerY,
                7.5,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'sashWPcs':
            if (row.sashWPcs) {
              drawCellText(
                row.sashWPcs,
                centerX,
                centerY,
                7.5,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'mullion':
            if (row.mullionMM) {
              drawCellText(
                formatCellCutText(row.mullionMM),
                centerX,
                centerY,
                7.8,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'mullionPcs':
            if (row.mullionPcs) {
              drawCellText(
                row.mullionPcs,
                centerX,
                centerY,
                7.8,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'interlock':
            if (row.interlockMM) {
              drawCellText(
                formatCellCutText(row.interlockMM),
                centerX,
                centerY,
                7.8,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'mirrorCut':
            if (row.mirrorCutMM) {
              drawCellText(
                formatCellCutText(row.mirrorCutMM),
                centerX,
                centerY,
                7.8,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'glassPcs':
            if (row.glassPcs) {
              drawCellText(
                row.glassPcs,
                centerX,
                centerY,
                7.8,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'glassType':
            if (row.glassType) {
              drawCellText(
                row.glassType,
                centerX,
                centerY,
                7.5,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'meshCut':
            if (includeMesh && row.meshCutMM) {
              drawCellText(
                formatCellCutText(row.meshCutMM),
                centerX,
                centerY,
                7.8,
                availableW,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
        }
      }
    }
  }

  // 7. Vertical Column Dividers - Precise Alignment
  doc.setDrawColor(...inkDark);
  doc.setLineWidth(0.38);
  for (let c = 1; c < colX.length - 1; c++) {
    const isSubColDivider =
      (cols[c - 1]?.id === 'model' && cols[c]?.id === 'materialMM') ||
      (cols[c - 1]?.id === 'sashCut' && cols[c]?.id === 'sashHPcs') ||
      (cols[c - 1]?.id === 'sashHPcs' && cols[c]?.id === 'sashWPcs') ||
      (cols[c - 1]?.id === 'mullion' && cols[c]?.id === 'mullionPcs') ||
      (cols[c - 1]?.id === 'mirrorCut' && cols[c]?.id === 'glassPcs');
    const startY = isSubColDivider ? subHeaderDividerY : tableHeaderTopY;
    doc.line(colX[c], startY, colX[c], marginTop + totalBoxH);
  }
};
export const generateLSInteriorsSheetCanvas = (
  results: CalculationResult[],
  options: LSInteriorsExportOptions = {},
  pageIndex: number = 0,
  pageSize: number = 28
): HTMLCanvasElement | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  // Ultra-crisp 300 DPI A4 resolution (2480 × 3508 px)
  const width = 2480;
  const height = 3508;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // High-res pixel scale
  const marginX = 76;
  const marginTop = 84;
  const boxW = width - marginX * 2; // 2328 px
  const headerH = 160;
  const tableHeaderH = 104;
  const rowH = 107.5;
  const numRows = pageSize; // 28 rows
  const tableH = tableHeaderH + numRows * rowH; // 3114 px
  const totalBoxH = headerH + tableH; // 3274 px

  const inkDark = '#0f2952';

  // Outer Rectangle Border - 6px Bold Frame
  ctx.strokeStyle = inkDark;
  ctx.lineWidth = 6;
  ctx.strokeRect(marginX, marginTop, boxW, totalBoxH);

  // Header Section Divider Line
  const headerBottomY = marginTop + headerH;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(marginX, headerBottomY);
  ctx.lineTo(marginX + boxW, headerBottomY);
  ctx.stroke();

  // Header Content - Responsive Anti-Collision Branding & Typography
  const customerName = options.customerName?.trim() || '';
  const dateStr = options.date?.trim() || new Date().toLocaleDateString('en-GB');

  // Customer Name (Left)
  ctx.fillStyle = inkDark;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 36px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText('Customer Name :', marginX + 32, marginTop + headerH / 2);

  if (customerName) {
    let custSize = 38;
    ctx.font = `bold ${custSize}px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.fillStyle = '#1d4ed8';
    const custClean = cleanText(customerName);
    // Center title is at width / 2 = 1240. MarginX + 340 = 416. Max available is ~450px.
    const maxCustW = width / 2 - (marginX + 340) - 70;
    while (ctx.measureText(custClean).width > maxCustW && custSize > 18) {
      custSize -= 1;
      ctx.font = `bold ${custSize}px "Plus Jakarta Sans", Arial, sans-serif`;
    }
    ctx.fillText(custClean, marginX + 340, marginTop + headerH / 2);
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = '36px monospace';
    ctx.fillText('....................................', marginX + 340, marginTop + headerH / 2);
  }

  // L.S.INTERIORS (Center Title - Exactly centered at width / 2)
  ctx.fillStyle = inkDark;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 78px "Plus Jakarta Sans", "Arial Black", sans-serif';
  ctx.fillText('L.S.INTERIORS', width / 2, marginTop + headerH / 2);

  // Date (Right)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 36px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillStyle = inkDark;

  if (dateStr) {
    ctx.fillText(`Date :  ${dateStr}`, marginX + boxW - 32, marginTop + headerH / 2);
  } else {
    ctx.fillText('Date : ........................', marginX + boxW - 32, marginTop + headerH / 2);
  }

  // Columns & Widths - ALL CONFIGURATIONS SUM TO EXACTLY 2328 PX MATCHING boxW
  const includeMesh = options.includeMeshColumn ?? false;
  const includeInterlock = options.includeInterlockColumn ?? hasSlidingInResults(results);
  const includeMullion = options.includeMullionColumn ?? hasDoubleWindowInResults(results);
  const mullionDed = options.mullionDeductionMM ?? 6;
  const mullionSubHeader = `H - ${mullionDed}`;

  interface CanvasColumnDef {
    id: LSColumnId;
    header: string;
    subHeader?: string;
    width: number;
    colorCanvas: string;
  }

  let cols: CanvasColumnDef[] = [];

  if (includeMullion && includeInterlock && includeMesh) {
    // 17 Columns (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 83, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 131, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 48, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 131, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 238, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 119, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 202, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 178, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 154, colorCanvas: LS_COLOR_MAP.mullion.canvas },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 83, colorCanvas: LS_COLOR_MAP.mullionPcs.canvas },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 166, colorCanvas: LS_COLOR_MAP.interlock.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 202, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 83, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 131, colorCanvas: LS_COLOR_MAP.glassType.canvas },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'H × W', width: 165, colorCanvas: LS_COLOR_MAP.meshCut.canvas }
    ];
  } else if (includeMullion && includeInterlock && !includeMesh) {
    // 16 Columns (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 83, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 143, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 48, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 143, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 249, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 131, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 214, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 190, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 166, colorCanvas: LS_COLOR_MAP.mullion.canvas },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.mullionPcs.canvas },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 178, colorCanvas: LS_COLOR_MAP.interlock.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 214, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 165, colorCanvas: LS_COLOR_MAP.glassType.canvas }
    ];
  } else if (includeMullion && !includeInterlock && includeMesh) {
    // 16 Columns (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 83, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 143, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 48, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 143, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 249, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 131, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 214, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 190, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 166, colorCanvas: LS_COLOR_MAP.mullion.canvas },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.mullionPcs.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 214, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 166, colorCanvas: LS_COLOR_MAP.glassType.canvas },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'H × W', width: 177, colorCanvas: LS_COLOR_MAP.meshCut.canvas }
    ];
  } else if (!includeMullion && includeInterlock && includeMesh) {
    // 15 Columns (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 83, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 143, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 48, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 143, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 261, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 131, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 238, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 202, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 190, colorCanvas: LS_COLOR_MAP.interlock.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 226, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 166, colorCanvas: LS_COLOR_MAP.glassType.canvas },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'H × W', width: 188, colorCanvas: LS_COLOR_MAP.meshCut.canvas }
    ];
  } else if (includeMullion && !includeInterlock && !includeMesh) {
    // 15 Columns (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 83, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 143, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 48, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 143, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 261, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 131, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 238, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 202, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 178, colorCanvas: LS_COLOR_MAP.mullion.canvas },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.mullionPcs.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 238, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 259, colorCanvas: LS_COLOR_MAP.glassType.canvas }
    ];
  } else if (!includeMullion && includeInterlock && !includeMesh) {
    // 14 Columns (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 95, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 154, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 48, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 154, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 261, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 131, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 249, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 214, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 202, colorCanvas: LS_COLOR_MAP.interlock.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 238, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 273, colorCanvas: LS_COLOR_MAP.glassType.canvas }
    ];
  } else if (!includeMullion && !includeInterlock && includeMesh) {
    // 14 Columns (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 95, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 154, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 48, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 154, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 261, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 131, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 249, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 214, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 249, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 249, colorCanvas: LS_COLOR_MAP.glassType.canvas },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'H × W', width: 215, colorCanvas: LS_COLOR_MAP.meshCut.canvas }
    ];
  } else {
    // 13 Columns Standard (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 95, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 154, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 48, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 154, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 273, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 143, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'H × W', width: 261, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'H × W', width: 226, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 107, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'H × W', width: 261, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 107, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 392, colorCanvas: LS_COLOR_MAP.glassType.canvas }
    ];
  }

  const modelColumnIndex = cols.findIndex((col) => col.id === 'model');
  const materialColumnIndex = cols.findIndex((col) => col.id === 'materialMM');
  const outerFrameColumnIndex = cols.findIndex((col) => col.id === 'outerFrame');
  if (
    modelColumnIndex >= 0 &&
    materialColumnIndex === modelColumnIndex + 1 &&
    outerFrameColumnIndex >= 0
  ) {
    const [modelColumn, materialColumn] = cols.splice(modelColumnIndex, 2);
    const updatedOuterFrameIndex = cols.findIndex((col) => col.id === 'outerFrame');
    cols.splice(updatedOuterFrameIndex + 1, 0, modelColumn, materialColumn);
  }

  const colX: number[] = [marginX];
  for (let i = 0; i < cols.length; i++) {
    colX.push(colX[i] + cols[i].width);
  }

  // Table Header Row Bottom Line
  const tableHeaderTopY = headerBottomY;
  const tableHeaderBottomY = tableHeaderTopY + tableHeaderH;
  const subHeaderDividerY = tableHeaderTopY + tableHeaderH / 2;

  // Crisp Light Slate Background for Table Header Row
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(marginX, tableHeaderTopY, boxW, tableHeaderH);

  ctx.lineWidth = 4.0;
  ctx.strokeStyle = inkDark;
  ctx.beginPath();
  ctx.moveTo(marginX, tableHeaderBottomY);
  ctx.lineTo(marginX + boxW, tableHeaderBottomY);
  ctx.stroke();

  // Horizontal divider line dividing main column and sub-column (across model and cut columns: colX[4] to marginX + boxW)
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = inkDark;
  ctx.beginPath();
  ctx.moveTo(colX[4], subHeaderDividerY);
  ctx.lineTo(marginX + boxW, subHeaderDividerY);
  ctx.stroke();

  // Column Headers Text - Clean Legibility Typography
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let c = 0; c < cols.length; c++) {
    const col = cols[c];
    const centerX = colX[c] + col.width / 2;
    const colColor = col.colorCanvas;

    if (col.id === 'model' && cols[c + 1]?.id === 'materialMM') {
      // Main grouped header spanning across both model (Type) and materialMM
      const combinedW = cols[c].width + cols[c + 1].width;
      const combinedCenterX = colX[c] + combinedW / 2;
      ctx.fillStyle = colColor;
      let headerSize = cols.length >= 11 ? 22 : 24;
      ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      while (ctx.measureText(col.header).width > (combinedW - 20) && headerSize > 13) {
        headerSize -= 1;
        ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(col.header, combinedCenterX, tableHeaderTopY + 26);

      // Sub-column header for model type
      let typeSize = cols.length >= 11 ? 17 : 19;
      ctx.font = `bold ${typeSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const typeText = col.subHeader || 'Type';
      while (ctx.measureText(typeText).width > (col.width - 12) && typeSize > 11) {
        typeSize -= 1;
        ctx.font = `bold ${typeSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(typeText, centerX, subHeaderDividerY + 26);
    } else if (col.id === 'materialMM') {
      // Sub-column header for material mm (single clean line, anti-collision)
      ctx.fillStyle = colColor;
      let matSize = cols.length >= 11 ? 16 : 18;
      ctx.font = `bold ${matSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const matSubText = col.subHeader || 'Material mm';
      while (ctx.measureText(matSubText).width > (col.width - 10) && matSize > 10) {
        matSize -= 1;
        ctx.font = `bold ${matSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(matSubText, centerX, subHeaderDividerY + 26);
    } else if (col.id === 'sashCut' && cols[c + 1]?.id === 'sashHPcs') {
      // Main grouped header spanning across sashCut + sashHPcs + sashWPcs
      const sashGroupColsC = [cols[c]];
      if (cols[c + 1]?.id === 'sashHPcs') sashGroupColsC.push(cols[c + 1]);
      if (cols[c + 2]?.id === 'sashWPcs') sashGroupColsC.push(cols[c + 2]);
      const combinedW = sashGroupColsC.reduce((s, cc) => s + cc.width, 0);
      const combinedCenterX = colX[c] + combinedW / 2;
      ctx.fillStyle = colColor;
      let headerSize = cols.length >= 11 ? 22 : 24;
      ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      while (ctx.measureText(col.header).width > (combinedW - 20) && headerSize > 13) {
        headerSize -= 1;
        ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(col.header, combinedCenterX, tableHeaderTopY + 26);

      // Sub-column header for sash cut (H × W)
      let subSize = cols.length >= 11 ? 17 : 19;
      ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const subText = col.subHeader || '';
      while (ctx.measureText(subText).width > (col.width - 12) && subSize > 11) {
        subSize -= 1;
        ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(subText, centerX, subHeaderDividerY + 26);
    } else if (col.id === 'sashHPcs' || col.id === 'sashWPcs') {
      // Sub-column header for sash H Pcs / W Pcs
      ctx.fillStyle = colColor;
      const label = col.id === 'sashHPcs' ? 'H Pcs' : 'W Pcs';
      let pcsSize = 16;
      ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      while (ctx.measureText(label).width > (col.width - 10) && pcsSize > 9) {
        pcsSize -= 1;
        ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(label, centerX, subHeaderDividerY + 26);
    } else if (col.id === 'sashPcs') {
      // Sub-column header for sash pieces (No.Pcs)
      ctx.fillStyle = colColor;
      let pcsSize = cols.length >= 11 ? 16 : 18;
      ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const pcsText = col.subHeader || 'No.Pcs';
      while (ctx.measureText(pcsText).width > (col.width - 10) && pcsSize > 9) {
        pcsSize -= 1;
        ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(pcsText, centerX, subHeaderDividerY + 26);
    } else if (col.id === 'mullion' && cols[c + 1]?.id === 'mullionPcs') {
      // Main grouped header spanning across both mullion and mullionPcs
      const combinedW = cols[c].width + cols[c + 1].width;
      const combinedCenterX = colX[c] + combinedW / 2;
      ctx.fillStyle = colColor;
      let headerSize = cols.length >= 11 ? 22 : 24;
      ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      while (ctx.measureText(col.header).width > (combinedW - 20) && headerSize > 13) {
        headerSize -= 1;
        ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(col.header, combinedCenterX, tableHeaderTopY + 26);

      // Sub-column header for mullion cut (H - deduction)
      let subSize = cols.length >= 11 ? 17 : 19;
      ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const subText = col.subHeader || '';
      while (ctx.measureText(subText).width > (col.width - 12) && subSize > 11) {
        subSize -= 1;
        ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(subText, centerX, subHeaderDividerY + 26);
    } else if (col.id === 'mullionPcs') {
      // Sub-column header for mullion pieces (No.Pcs)
      ctx.fillStyle = colColor;
      let pcsSize = cols.length >= 11 ? 16 : 18;
      ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const pcsText = col.subHeader || 'No.Pcs';
      while (ctx.measureText(pcsText).width > (col.width - 10) && pcsSize > 9) {
        pcsSize -= 1;
        ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(pcsText, centerX, subHeaderDividerY + 26);
    } else if (col.id === 'mirrorCut' && cols[c + 1]?.id === 'glassPcs') {
      // Main grouped header spanning across both mirrorCut and glassPcs
      const combinedW = cols[c].width + cols[c + 1].width;
      const combinedCenterX = colX[c] + combinedW / 2;
      ctx.fillStyle = colColor;
      let headerSize = cols.length >= 11 ? 22 : 24;
      ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      while (ctx.measureText(col.header).width > (combinedW - 20) && headerSize > 13) {
        headerSize -= 1;
        ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(col.header, combinedCenterX, tableHeaderTopY + 26);

      // Sub-column header for glass cut (H × W)
      let subSize = cols.length >= 11 ? 17 : 19;
      ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const subText = col.subHeader || '';
      while (ctx.measureText(subText).width > (col.width - 12) && subSize > 11) {
        subSize -= 1;
        ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(subText, centerX, subHeaderDividerY + 26);
    } else if (col.id === 'glassPcs') {
      // Sub-column header for glass pieces (No.Pcs)
      ctx.fillStyle = colColor;
      let pcsSize = cols.length >= 11 ? 16 : 18;
      ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const pcsText = col.subHeader || 'No.Pcs';
      while (ctx.measureText(pcsText).width > (col.width - 10) && pcsSize > 9) {
        pcsSize -= 1;
        ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(pcsText, centerX, subHeaderDividerY + 26);
    } else if (col.subHeader) {
      // Main cut column header
      ctx.fillStyle = colColor;
      let headerSize = cols.length >= 11 ? 20 : 22;
      ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const headerText = col.header;
      while (ctx.measureText(headerText).width > (col.width - 14) && headerSize > 11) {
        headerSize -= 1;
        ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(headerText, centerX, tableHeaderTopY + 26);

      // Sub-column header
      ctx.fillStyle = colColor;
      let subSize = cols.length >= 11 ? 16 : 18;
      ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const subText = col.subHeader;
      while (ctx.measureText(subText).width > (col.width - 12) && subSize > 10) {
        subSize -= 1;
        ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(subText, centerX, subHeaderDividerY + 26);
    } else {
      // Single full-height header (Si.No., Height, X, Width)
      ctx.fillStyle = colColor;
      let fullSize = cols.length >= 11 ? 22 : 24;
      ctx.font = `bold ${fullSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const headerText = col.header;
      while (ctx.measureText(headerText).width > (col.width - 12) && fullSize > 11) {
        fullSize -= 1;
        ctx.font = `bold ${fullSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(headerText, centerX, tableHeaderTopY + tableHeaderH / 2);
    }
  }

  // Helper for drawing row cell text on canvas with boundary protection & proportional auto-scaling
  const drawCanvasCellText = (
    text: string,
    centerX: number,
    centerY: number,
    baseFontPx: number,
    fontFamily: string,
    maxWidth: number,
    color: string,
    align: CanvasTextAlign = 'center',
    leftX?: number,
    isBold: boolean = false
  ) => {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    let size = baseFontPx;
    const weight = isBold ? 'bold' : '600';
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    let textW = ctx.measureText(text).width;
    if (textW > maxWidth && textW > 0) {
      size = Math.max(9, Math.floor(size * (maxWidth / textW)));
      ctx.font = `${weight} ${size}px ${fontFamily}`;
      textW = ctx.measureText(text).width;
      while (textW > maxWidth && size > 8) {
        size -= 1;
        ctx.font = `${weight} ${size}px ${fontFamily}`;
        textW = ctx.measureText(text).width;
      }
    }
    ctx.fillText(text, align === 'center' ? centerX : (leftX ?? centerX - maxWidth / 2), centerY);
  };

  // High-contrast, sharp dark charcoal ink for all cell data
  const cellTextColorCanvas = '#0f172a';

  // Data Rows (28 Rows) - Formed as Prominent Enclosed Boxes with Unique Model Background Colors
  const effectiveOptions: LSInteriorsExportOptions = {
    ...options,
    includeInterlockColumn: includeInterlock,
    includeMullionColumn: includeMullion,
    mullionDeductionMM: mullionDed
  };
  const flattenedRows = prepareLSRows(results, effectiveOptions);
  const startIdx = pageIndex * pageSize;
  const endIdx = startIdx + pageSize;
  const pageRows = flattenedRows.slice(startIdx, endIdx);

  ctx.lineWidth = 3.5;
  ctx.strokeStyle = inkDark;

  for (let r = 0; r < numRows; r++) {
    const rowTopY = tableHeaderBottomY + r * rowH;
    const rowBottomY = rowTopY + rowH;
    const centerY = rowTopY + rowH / 2;

    // Active Row Data & Fixed Window Detection
    const rowData = pageRows[r];
    const isFixed = Boolean(rowData && (rowData.isFixed ?? (rowData.windowType === 'fixed' || rowData.modelName?.toUpperCase().includes('FIXED'))));

    // Fill Row / Cell Background with Window Type's Unique Color
    if (rowData) {
      const bg = getLSModelBgColor(rowData);
      ctx.fillStyle = bg.canvas;
      ctx.fillRect(marginX, rowTopY, boxW, rowH);
    }

    // Horizontal divider line forming crisp framed boxes
    ctx.beginPath();
    ctx.moveTo(marginX, rowBottomY);
    ctx.lineTo(marginX + boxW, rowBottomY);
    ctx.stroke();

    // Column 2 ('X') centered - 36px
    ctx.fillStyle = rowData ? cellTextColorCanvas : '#cbd5e1';
    ctx.font = `${isFixed ? 'bold' : '600'} 36px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('X', colX[2] + cols[2].width / 2, centerY);

    if (rowData) {
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        const centerX = colX[c] + col.width / 2;
        // Strictly reserve 12px margin on left and right borders of cell
        const availableW = Math.max(16, col.width - 24);

        switch (col.id) {
          case 'sino':
            if (rowData.siNo) {
              drawCanvasCellText(
                rowData.siNo,
                centerX,
                centerY,
                28,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'height':
            if (rowData.siteHeight) {
              drawCanvasCellText(
                rowData.siteHeight,
                centerX,
                centerY,
                28,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'x':
            // Already drawn
            break;
          case 'width':
            if (rowData.siteWidth) {
              drawCanvasCellText(
                rowData.siteWidth,
                centerX,
                centerY,
                28,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'model':
            if (rowData.modelName) {
              const isDoor = rowData.modelName.includes('DOOR');
              const modelColorCanvas = isDoor ? '#0284c7' : cellTextColorCanvas;
              drawCanvasCellText(
                rowData.modelName,
                centerX,
                centerY,
                22,
                '"Plus Jakarta Sans", Arial, sans-serif',
                availableW,
                modelColorCanvas,
                'center',
                undefined,
                isFixed || isDoor
              );
            }
            break;
          case 'materialMM':
            if (rowData.materialMM) {
              drawCanvasCellText(
                rowData.materialMM,
                centerX,
                centerY,
                24,
                '"Plus Jakarta Sans", Arial, sans-serif',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'outerFrame':
            if (rowData.outerFrameMM) {
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.outerFrameMM),
                centerX,
                centerY,
                26,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'sashCut':
            if (rowData.sashCutMM) {
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.sashCutMM),
                centerX,
                centerY,
                26,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'sashHPcs':
            if (rowData.sashHPcs) {
              drawCanvasCellText(
                rowData.sashHPcs,
                centerX,
                centerY,
                25,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'sashWPcs':
            if (rowData.sashWPcs) {
              drawCanvasCellText(
                rowData.sashWPcs,
                centerX,
                centerY,
                25,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'sashPcs':
            if (rowData.sashPcs) {
              drawCanvasCellText(
                rowData.sashPcs,
                centerX,
                centerY,
                25,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'mullion':
            if (rowData.mullionMM) {
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.mullionMM),
                centerX,
                centerY,
                26,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'mullionPcs':
            if (rowData.mullionPcs) {
              drawCanvasCellText(
                rowData.mullionPcs,
                centerX,
                centerY,
                26,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'interlock':
            if (rowData.interlockMM) {
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.interlockMM),
                centerX,
                centerY,
                26,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'mirrorCut':
            if (rowData.mirrorCutMM) {
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.mirrorCutMM),
                centerX,
                centerY,
                26,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'glassPcs':
            if (rowData.glassPcs) {
              drawCanvasCellText(
                rowData.glassPcs,
                centerX,
                centerY,
                26,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'glassType':
            if (rowData.glassType) {
              drawCanvasCellText(
                rowData.glassType,
                centerX,
                centerY,
                23,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'meshCut':
            if (includeMesh && rowData.meshCutMM) {
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.meshCutMM),
                centerX,
                centerY,
                26,
                '"JetBrains Mono", monospace',
                availableW,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
        }
      }
    }
  }

  // Vertical Column Dividers - Precise Alignment
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = inkDark;
  for (let c = 1; c < colX.length - 1; c++) {
    const isSubColDivider =
      (cols[c - 1]?.id === 'model' && cols[c]?.id === 'materialMM') ||
      (cols[c - 1]?.id === 'sashCut' && cols[c]?.id === 'sashHPcs') ||
      (cols[c - 1]?.id === 'sashHPcs' && cols[c]?.id === 'sashWPcs') ||
      (cols[c - 1]?.id === 'mullion' && cols[c]?.id === 'mullionPcs') ||
      (cols[c - 1]?.id === 'mirrorCut' && cols[c]?.id === 'glassPcs');
    const startY = isSubColDivider ? subHeaderDividerY : tableHeaderTopY;
    ctx.beginPath();
    ctx.moveTo(colX[c], startY);
    ctx.lineTo(colX[c], tableHeaderBottomY + numRows * rowH);
    ctx.stroke();
  }

  return canvas;
};
export const generateLSInteriorsSheetImage = (
  results: CalculationResult[],
  options: LSInteriorsExportOptions = {},
  pageIndex: number = 0,
  pageSize: number = 28
): string | null => {
  const canvas = generateLSInteriorsSheetCanvas(results, options, pageIndex, pageSize);
  if (!canvas) return null;
  return canvas.toDataURL('image/png');
};

/**
 * Exports complete L.S. INTERIORS Workshop Order Sheet as TRUE VECTOR PDF
 * Infinite resolution: Lines and fonts rendered natively in vector paths for razor-sharp physical printouts
 */
export const exportLSInteriorsToPDF = (
  results: CalculationResult[],
  options: LSInteriorsExportOptions = {}
): void => {
  if (!results || results.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const effectiveOptions: LSInteriorsExportOptions = {
    ...options,
    includeInterlockColumn: options.includeInterlockColumn ?? hasSlidingInResults(results),
    includeMullionColumn: options.includeMullionColumn ?? hasDoubleWindowInResults(results),
    mullionDeductionMM: options.mullionDeductionMM ?? 6
  };

  const pageSize = 28;
  const flattened = prepareLSRows(results, effectiveOptions);
  const totalPages = Math.max(1, Math.ceil(flattened.length / pageSize));

  for (let p = 0; p < totalPages; p++) {
    if (p > 0) {
      doc.addPage();
    }
    const pageRows = flattened.slice(p * pageSize, (p + 1) * pageSize);
    renderLSInteriorsVectorPage(doc, pageRows, effectiveOptions);
  }

  const custClean = options.customerName ? `${cleanText(options.customerName).replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
  const dateClean = cleanText(options.date || new Date().toISOString().slice(0, 10)).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `LS_Interiors_Order_Sheet_${custClean}${dateClean}.pdf`;
  doc.save(filename);
};
