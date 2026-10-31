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
export function computeWindowVariantLabels(
  items: Array<WindowVariantInput>
): WindowVariantInfo[] {
  if (!items || items.length === 0) return [];

  const dimGroups = new Map<string, number[]>();
  items.forEach((item, idx) => {
    const dimKey = getWindowDimensionKey(item);
    if (!dimGroups.has(dimKey)) {
      dimGroups.set(dimKey, []);
    }
    dimGroups.get(dimKey)!.push(idx);
  });

  const results: WindowVariantInfo[] = new Array(items.length);

  dimGroups.forEach((indices) => {
    // Collect distinct window types in this dimension group (in order of first appearance)
    const typeOrder: string[] = [];
    indices.forEach((idx) => {
      const inp = extractWindowInput(items[idx]);
      const tk = getWindowTypeKey(inp);
      if (!typeOrder.includes(tk)) {
        typeOrder.push(tk);
      }
    });

    const hasVariants = typeOrder.length > 1;

    indices.forEach((idx) => {
      const num = idx + 1;
      const inp = extractWindowInput(items[idx]);
      const manualLetter = inp?.variantLetter ? inp.variantLetter.toLowerCase().trim() : '';

      if (manualLetter) {
        // User manually selected a letter option (a to z)
        results[idx] = {
          letter: manualLetter,
          siNo: `${num}${manualLetter}`,
          windowLabel: `W${num}${manualLetter}`
        };
      } else if (hasVariants) {
        const tk = getWindowTypeKey(inp);
        const letterCode = String.fromCharCode(97 + typeOrder.indexOf(tk)); // 'a', 'b', 'c'...
        results[idx] = {
          letter: letterCode,
          siNo: `${num}${letterCode}`,
          windowLabel: `W${num}${letterCode}`
        };
      } else {
        results[idx] = {
          letter: '',
          siNo: String(num),
          windowLabel: `W${num}`
        };
      }
    });
  });

  return results;
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
  sino: { pdf: [30, 41, 59], canvas: '#1e293b' },       // 0: Slate Navy
  height: { pdf: [185, 28, 28], canvas: '#b91c1c' },   // 1: Crimson Red
  x: { pdf: [100, 116, 139], canvas: '#64748b' },      // 2: Slate Gray
  width: { pdf: [109, 40, 217], canvas: '#6d28d9' },   // 3: Royal Purple
  model: { pdf: [180, 83, 9], canvas: '#b45309' },     // 4: Amber Brown
  materialMM: { pdf: [180, 83, 9], canvas: '#b45309' }, // 4b: Amber Brown (Material mm)
  outerFrame: { pdf: [29, 78, 216], canvas: '#1d4ed8' }, // 5: Deep Royal Blue
  sashCut: { pdf: [4, 120, 87], canvas: '#047857' },    // 6: Forest Emerald
  sashPcs: { pdf: [4, 120, 87], canvas: '#047857' },    // 6b: Forest Emerald (No. of Sash Pcs)
  sashHPcs: { pdf: [4, 120, 87], canvas: '#047857' },   // 6c: Forest Emerald (Sash H Pcs)
  sashWPcs: { pdf: [4, 120, 87], canvas: '#047857' },   // 6d: Forest Emerald (Sash W Pcs)
  mullion: { pdf: [15, 118, 110], canvas: '#0f766e' },  // 7: Deep Pine Teal (Matches Double Window)
  mullionPcs: { pdf: [15, 118, 110], canvas: '#0f766e' }, // 7b: Deep Pine Teal (Mullion No.Pcs)
  interlock: { pdf: [194, 65, 12], canvas: '#c2410c' }, // 8: Russet Orange
  mirrorCut: { pdf: [14, 116, 144], canvas: '#0e7490' }, // 9: Glass Deep Cyan
  glassPcs: { pdf: [14, 116, 144], canvas: '#0e7490' },  // 9b: Glass Deep Cyan (Glass No.Pcs)
  glassType: { pdf: [14, 116, 144], canvas: '#0e7490' }, // 9c: Glass Deep Cyan (Glass Type / Client Fill)
  meshCut: { pdf: [190, 24, 93], canvas: '#be185d' }    // 10: Rose Magenta
};

/**
 * Unique distinct colors for each column in L.S. Interiors Order Sheet:
 * 0: Si.No.           - Slate Navy ([30, 41, 59] / #1e293b)
 * 1: Height           - Crimson Red ([185, 28, 28] / #b91c1c)
 * 2: X                - Slate Gray ([100, 116, 139] / #64748b)
 * 3: Width            - Royal Purple ([109, 40, 217] / #6d28d9)
 * 4: Model Name       - Amber Brown ([180, 83, 9] / #b45309)
 * 5: Outer Frame mm   - Deep Royal Blue ([29, 78, 216] / #1d4ed8)
 * 6: Sash Cut mm      - Forest Emerald ([4, 120, 87] / #047857)
 * 7: Mirror Cut mm    - Glass Deep Cyan ([14, 116, 144] / #0e7490)
 * 8: 2.5T Mesh mm     - Rose Magenta ([190, 24, 93] / #be185d)
 * 9: Interlock mm     - Russet Orange ([194, 65, 12] / #c2410c)
 */
export const LS_COLUMN_COLORS_PDF: [number, number, number][] = [
  [30, 41, 59],    // 0: Si.No.
  [185, 28, 28],   // 1: Height
  [100, 116, 139], // 2: X
  [109, 40, 217],  // 3: Width
  [180, 83, 9],    // 4: Model Name
  [29, 78, 216],   // 5: Outer Frame mm
  [4, 120, 87],    // 6: Sash Cut mm
  [14, 116, 144],  // 7: Mirror Cut mm
  [190, 24, 93],   // 8: 2.5T Mesh mm
  [194, 65, 12]    // 9: Interlock mm
];

export const LS_COLUMN_COLORS_CANVAS: string[] = [
  '#1e293b', // 0: Si.No.
  '#b91c1c', // 1: Height
  '#64748b', // 2: X
  '#6d28d9', // 3: Width
  '#b45309', // 4: Model Name
  '#1d4ed8', // 5: Outer Frame mm
  '#047857', // 6: Sash Cut mm
  '#0e7490', // 7: Mirror Cut mm
  '#be185d', // 8: 2.5T Mesh mm
  '#c2410c'  // 9: Interlock mm
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
 * Unique background tint colors for each window model type in L.S. Interiors Order Sheet:
 * - TRACK WINDOWS (2T, 2.5T, 3T Sliding): Warm Soft Orange tint ([254, 215, 170] / #fed7aa)
 * - SINGLE CASEMENT: Soft Mint Green tint ([187, 247, 208] / #bbf7d0)
 * - DOUBLE CASEMENT: Soft Teal tint ([153, 246, 228] / #99f6e4)
 * - FIXED WINDOW: Soft Rose Red tint ([254, 205, 211] / #fecdd3)
 * - VENTILATOR NORMAL: Soft Sky Blue tint ([191, 219, 254] / #bfdbfe)
 * - VENTILATOR FAN LEFT: Soft Lavender tint ([199, 210, 254] / #c7d2fe)
 * - VENTILATOR FAN RIGHT: Soft Pink tint ([251, 207, 232] / #fbcfe8)
 */
export const LS_MODEL_BG_COLOR_MAP: Record<string, LSModelBgColor> = {
  'TRACK': { pdf: [254, 215, 170], canvas: '#fed7aa', name: 'Track Warm Orange' },
  '2T SLIDING': { pdf: [254, 215, 170], canvas: '#fed7aa', name: 'Track Warm Orange' },
  '2.5T SLIDING (MESH)': { pdf: [254, 215, 170], canvas: '#fed7aa', name: 'Track Warm Orange' },
  '3T SLIDING': { pdf: [254, 215, 170], canvas: '#fed7aa', name: 'Track Warm Orange' },
  '4T SLIDING': { pdf: [254, 215, 170], canvas: '#fed7aa', name: 'Track Warm Orange' },
  'SLIDING WINDOW': { pdf: [254, 215, 170], canvas: '#fed7aa', name: 'Track Warm Orange' },
  'FIXED WINDOW': { pdf: [254, 205, 211], canvas: '#fecdd3', name: 'Fixed Soft Rose' },
  'SINGLE WINDOW': { pdf: [187, 247, 208], canvas: '#bbf7d0', name: 'Single Mint Green' },
  'SINGLE CASEMENT': { pdf: [187, 247, 208], canvas: '#bbf7d0', name: 'Single Mint Green' },
  'DOUBLE WINDOW': { pdf: [153, 246, 228], canvas: '#99f6e4', name: 'Double Soft Teal' },
  'DOUBLE CASEMENT': { pdf: [153, 246, 228], canvas: '#99f6e4', name: 'Double Soft Teal' },
  '3-OPEN WINDOW': { pdf: [153, 246, 228], canvas: '#99f6e4', name: 'Double Soft Teal' },
  'ventilator/normal': { pdf: [191, 219, 254], canvas: '#bfdbfe', name: 'Ventilator Sky Blue' },
  'ventilator with fans Left': { pdf: [199, 210, 254], canvas: '#c7d2fe', name: 'Fan Left Lavender' },
  'ventilator with fans Right': { pdf: [251, 207, 232], canvas: '#fbcfe8', name: 'Fan Right Soft Pink' },
};

/**
 * Returns the dedicated unique background tint color for any window model type.
 * Ensures:
 * - Track windows (2-track, 2.5-track, 3-track sliding): Track unique color (#fed7aa / [254, 215, 170])
 * - Single windows (single open casement): Single unique color (#bbf7d0 / [187, 247, 208])
 * - Double windows (double open casement): Double unique color (#99f6e4 / [153, 246, 228])
 * - Fixed windows: Fixed unique color (#fecdd3 / [254, 205, 211])
 * - Ventilators: Unique soft tint (Blue, Lavender, Pink)
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
 * Unique distinct colors for each window model type in L.S. Interiors Order Sheet:
 * - 2T SLIDING: Vibrant Orange ([234, 88, 12] / #ea580c)
 * - 2.5T SLIDING (MESH): Vibrant Orange ([234, 88, 12] / #ea580c)
 * - 3T SLIDING: Amber Orange ([217, 119, 6] / #d97706)
 * - FIXED WINDOW: Crimson Dark Red ([185, 28, 28] / #b91c1c - bold thick letters)
 * - SINGLE CASEMENT: Vibrant Forest Emerald ([4, 120, 87] / #047857)
 * - DOUBLE CASEMENT: Deep Pine Teal ([15, 118, 110] / #0f766e)
 * - ventilator/normal: Royal Blue ([29, 78, 216] / #1d4ed8)
 * - ventilator with fans Left: Indigo Violet ([79, 70, 229] / #4f46e5)
 * - ventilator with fans Right: Rose Magenta ([190, 24, 93] / #be185d)
 */
export const LS_MODEL_COLOR_MAP: Record<string, LSModelColor> = {
  '2T SLIDING': { pdf: [234, 88, 12], canvas: '#ea580c', name: 'Vibrant Orange' },
  '2.5T SLIDING (MESH)': { pdf: [234, 88, 12], canvas: '#ea580c', name: 'Vibrant Orange' },
  '3T SLIDING': { pdf: [217, 119, 6], canvas: '#d97706', name: 'Amber Orange' },
  '4T SLIDING': { pdf: [217, 119, 6], canvas: '#d97706', name: 'Amber Orange' },
  'SLIDING WINDOW': { pdf: [234, 88, 12], canvas: '#ea580c', name: 'Vibrant Orange' },
  'FIXED WINDOW': { pdf: [185, 28, 28], canvas: '#b91c1c', name: 'Crimson Red' },
  'SINGLE WINDOW': { pdf: [4, 120, 87], canvas: '#047857', name: 'Forest Emerald' },
  'SINGLE CASEMENT': { pdf: [4, 120, 87], canvas: '#047857', name: 'Forest Emerald' },
  'DOUBLE WINDOW': { pdf: [15, 118, 110], canvas: '#0f766e', name: 'Deep Teal' },
  'DOUBLE CASEMENT': { pdf: [15, 118, 110], canvas: '#0f766e', name: 'Deep Teal' },
  '3-OPEN WINDOW': { pdf: [15, 118, 110], canvas: '#0f766e', name: 'Deep Teal' },
  'ventilator/normal': { pdf: [29, 78, 216], canvas: '#1d4ed8', name: 'Royal Blue' },
  'ventilator with fans Left': { pdf: [79, 70, 229], canvas: '#4f46e5', name: 'Indigo Violet' },
  'ventilator with fans Right': { pdf: [190, 24, 93], canvas: '#be185d', name: 'Rose Magenta' },
};

/**
 * Returns the dedicated unique color for any window model type.
 */
export const getLSModelColor = (
  input: string | LSFlattenedRow | CalculationResult | undefined | null
): LSModelColor => {
  if (!input) {
    return { pdf: [180, 83, 9], canvas: '#b45309', name: 'Amber Bronze' };
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

  return { pdf: [180, 83, 9], canvas: '#b45309', name: 'Amber Bronze' };
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
    if (frameType === '2-track') {
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
    const is65mmSliding = isSliding && (r.input.profileSeries === '65mm' || r.frame.profileDepthMM === 65);
    const materialMM = is65mmSliding ? '65 mm' : (isSliding ? '58 mm' : '-');

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
  const boxW = 196;
  const headerH = 14;
  const tableHeaderH = 9.8;
  const rowH = 9.18;
  const numRows = 28;
  const totalBoxH = headerH + tableHeaderH + numRows * rowH; // 14 + 9.8 + 257.04 = 280.84 mm

  // 1. Outer Border Box (Vector Rectangle) - Crisp 0.55mm Ultra-High Contrast Frame
  doc.setDrawColor(...inkDark);
  doc.setLineWidth(0.55);
  doc.rect(marginX, marginTop, boxW, totalBoxH);

  // 2. Header Bottom Divider Line
  const headerBottomY = marginTop + headerH;
  doc.setLineWidth(0.42);
  doc.line(marginX, headerBottomY, marginX + boxW, headerBottomY);

  // 3. Header Text - BIG, High-Impact Branding & Client Info
  const customerName = options.customerName?.trim() || '';
  const dateStr = options.date?.trim() || new Date().toLocaleDateString('en-GB');

  // Customer Name (Left - Big 11.5pt Bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...inkDark);
  doc.text('Customer Name :', marginX + 3, marginTop + headerH / 2, { baseline: 'middle' });

  if (customerName) {
    doc.setFontSize(13.0);
    doc.setTextColor(29, 78, 216); // blue-700
    doc.text(cleanText(customerName), marginX + 39, marginTop + headerH / 2, { baseline: 'middle' });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(100, 116, 139);
    doc.text('..........................................................', marginX + 39, marginTop + headerH / 2, { baseline: 'middle' });
  }

  // L.S.INTERIORS (Center, Huge 26pt Bold Vector Title)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...inkDark);
  doc.text('L.S.INTERIORS', 105, marginTop + headerH / 2, { align: 'center', baseline: 'middle' });

  // Date (Right - Big 11.5pt Bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...inkDark);
  if (dateStr) {
    doc.text(`Date :  ${cleanText(dateStr)}`, marginX + boxW - 3, marginTop + headerH / 2, { align: 'right', baseline: 'middle' });
  } else {
    doc.text('Date : ........................', marginX + boxW - 3, marginTop + headerH / 2, { align: 'right', baseline: 'middle' });
  }

  // 4. Columns & Widths
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
    // 16 Columns: Standard + Material mm + Sash No.Pcs + Mullion + Mullion No.Pcs + Interlock + Glass + Glass No.Pcs + Glass Type + 2.5T Mesh (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 6, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 11, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 11, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 22, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 12, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height X Width', width: 17, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height X Width', width: 15, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 4, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 3, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 12, colorPdf: LS_COLOR_MAP.mullion.pdf },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 7, colorPdf: LS_COLOR_MAP.mullionPcs.pdf },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 15, colorPdf: LS_COLOR_MAP.interlock.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height X Width', width: 16, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 7, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 12, colorPdf: LS_COLOR_MAP.glassType.pdf },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'Height X Width', width: 16, colorPdf: LS_COLOR_MAP.meshCut.pdf }
    ];
  } else if (includeMullion && includeInterlock && !includeMesh) {
    // 15 Columns: Standard + Material mm + Sash No.Pcs + Mullion + Mullion No.Pcs + Interlock + Glass + Glass No.Pcs + Glass Type (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 7, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 12, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 12, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 23, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 12, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height X Width', width: 19, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height X Width', width: 17, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 4, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 3, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 13, colorPdf: LS_COLOR_MAP.mullion.pdf },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 7, colorPdf: LS_COLOR_MAP.mullionPcs.pdf },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 16, colorPdf: LS_COLOR_MAP.interlock.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height X Width', width: 18, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 7, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 18, colorPdf: LS_COLOR_MAP.glassType.pdf }
    ];
  } else if (includeMullion && !includeInterlock && includeMesh) {
    // 15 Columns: Standard + Material mm + Sash No.Pcs + Mullion + Mullion No.Pcs + Glass + Glass No.Pcs + Glass Type + 2.5T Mesh (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 7, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 12, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 12, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 23, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 12, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height X Width', width: 19, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height X Width', width: 17, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 4, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 3, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 13, colorPdf: LS_COLOR_MAP.mullion.pdf },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 7, colorPdf: LS_COLOR_MAP.mullionPcs.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height X Width', width: 18, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 7, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 18, colorPdf: LS_COLOR_MAP.glassType.pdf },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'Height X Width', width: 18, colorPdf: LS_COLOR_MAP.meshCut.pdf }
    ];
  } else if (!includeMullion && includeInterlock && includeMesh) {
    // 14 Columns: Standard + Material mm + Sash No.Pcs + Interlock + Glass + Glass No.Pcs + Glass Type + 2.5T Mesh (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 7, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 12, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 12, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 24, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 13, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height X Width', width: 19, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height X Width', width: 17, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 4, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 3, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 16, colorPdf: LS_COLOR_MAP.interlock.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height X Width', width: 18, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 18, colorPdf: LS_COLOR_MAP.glassType.pdf },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'Height X Width', width: 19, colorPdf: LS_COLOR_MAP.meshCut.pdf }
    ];
  } else if (includeMullion && !includeInterlock && !includeMesh) {
    // 14 Columns: Standard + Material mm + Sash No.Pcs + Mullion + Mullion No.Pcs + Glass + Glass No.Pcs + Glass Type (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 7, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 12, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 12, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 24, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 13, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height X Width', width: 20, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height X Width', width: 18, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 4, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 4, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 14, colorPdf: LS_COLOR_MAP.mullion.pdf },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.mullionPcs.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height X Width', width: 20, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 20, colorPdf: LS_COLOR_MAP.glassType.pdf }
    ];
  } else if (!includeMullion && includeInterlock && !includeMesh) {
    // 13 Columns: Standard + Material mm + Sash No.Pcs + Interlock + Glass + Glass No.Pcs + Glass Type (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 8, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 13, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 13, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 25, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 14, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height X Width', width: 21, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height X Width', width: 18, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 4, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 4, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 17, colorPdf: LS_COLOR_MAP.interlock.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height X Width', width: 19, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 24, colorPdf: LS_COLOR_MAP.glassType.pdf }
    ];
  } else if (!includeMullion && !includeInterlock && includeMesh) {
    // 13 Columns: Standard + Material mm + Sash No.Pcs + Glass + Glass No.Pcs + Glass Type + 2.5T Mesh (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 8, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 13, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 13, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 25, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 14, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height X Width', width: 21, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height X Width', width: 18, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 4, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 4, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height X Width', width: 20, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 8, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 21, colorPdf: LS_COLOR_MAP.glassType.pdf },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'Height X Width', width: 20, colorPdf: LS_COLOR_MAP.meshCut.pdf }
    ];
  } else {
    // 12 Columns: Standard + Material mm + Sash No.Pcs + Glass + Glass No.Pcs + Glass Type (Sum = 196 mm)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 8, colorPdf: LS_COLOR_MAP.sino.pdf },
      { id: 'height', header: 'Height', width: 13, colorPdf: LS_COLOR_MAP.height.pdf },
      { id: 'x', header: 'X', width: 4, colorPdf: LS_COLOR_MAP.x.pdf },
      { id: 'width', header: 'Width', width: 13, colorPdf: LS_COLOR_MAP.width.pdf },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 26, colorPdf: LS_COLOR_MAP.model.pdf },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 15, colorPdf: LS_COLOR_MAP.materialMM.pdf },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height X Width', width: 22, colorPdf: LS_COLOR_MAP.outerFrame.pdf },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height X Width', width: 19, colorPdf: LS_COLOR_MAP.sashCut.pdf },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 5, colorPdf: LS_COLOR_MAP.sashHPcs.pdf },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 4, colorPdf: LS_COLOR_MAP.sashWPcs.pdf },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height X Width', width: 21, colorPdf: LS_COLOR_MAP.mirrorCut.pdf },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 9, colorPdf: LS_COLOR_MAP.glassPcs.pdf },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 30, colorPdf: LS_COLOR_MAP.glassType.pdf }
    ];
  }

  const colX: number[] = [marginX];
  for (let i = 0; i < cols.length; i++) {
    colX.push(colX[i] + cols[i].width);
  }

  // Table Header Row Bottom Divider Line
  const tableHeaderTopY = headerBottomY;
  const tableHeaderBottomY = tableHeaderTopY + tableHeaderH;
  const subHeaderDividerY = tableHeaderTopY + 5.0;

  // Crisp Light Slate Background for Table Header Row
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, tableHeaderTopY, boxW, tableHeaderH, 'F');

  doc.setDrawColor(...inkDark);
  doc.setLineWidth(0.42);
  doc.line(marginX, tableHeaderBottomY, marginX + boxW, tableHeaderBottomY);

  // Separate horizontal divider line dividing main column and sub-column (across model and cut columns: colX[4] to marginX + boxW)
  doc.setLineWidth(0.32);
  doc.line(colX[4], subHeaderDividerY, marginX + boxW, subHeaderDividerY);

  // Column Headers Text - Unique color per column with big, high-legibility typography
  for (let c = 0; c < cols.length; c++) {
    const col = cols[c];
    const centerX = colX[c] + col.width / 2;
    const colColor = col.colorPdf;

    if (col.id === 'model' && cols[c + 1]?.id === 'materialMM') {
      // Main grouped header spanning across both model (Type) and materialMM
      const combinedW = cols[c].width + cols[c + 1].width;
      const combinedCenterX = colX[c] + combinedW / 2;
      doc.setFont('helvetica', 'bold');
      let headerSize = cols.length >= 11 ? 8.0 : (cols.length >= 10 ? 8.4 : 9.0);
      doc.setFontSize(headerSize);
      while (doc.getTextWidth(cleanText(col.header)) > (combinedW - 2.0) && headerSize > 5.0) {
        headerSize -= 0.2;
        doc.setFontSize(headerSize);
      }
      doc.setTextColor(...colColor);
      doc.text(cleanText(col.header), combinedCenterX, tableHeaderTopY + 2.8, { align: 'center', baseline: 'middle' });

      // Sub-column header for model type
      doc.setFont('helvetica', 'bold');
      let typeFontSize = cols.length >= 11 ? 7.0 : (cols.length >= 10 ? 7.4 : 8.0);
      doc.setFontSize(typeFontSize);
      const typeText = cleanText(col.subHeader || 'Type');
      while (doc.getTextWidth(typeText) > (col.width - 1.5) && typeFontSize > 4.5) {
        typeFontSize -= 0.2;
        doc.setFontSize(typeFontSize);
      }
      doc.text(typeText, centerX, subHeaderDividerY + 2.8, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'materialMM') {
      // Sub-column header for material mm
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colColor);
      if (col.width <= 15) {
        // Stack as two lines: "Material" on top, "mm" below
        let line1Size = 5.6;
        doc.setFontSize(line1Size);
        while (doc.getTextWidth('Material') > (col.width - 1.5) && line1Size > 4.0) {
          line1Size -= 0.2;
          doc.setFontSize(line1Size);
        }
        doc.text('Material', centerX, subHeaderDividerY + 1.8, { align: 'center', baseline: 'middle' });

        let line2Size = 5.2;
        doc.setFontSize(line2Size);
        while (doc.getTextWidth('mm') > (col.width - 1.5) && line2Size > 4.0) {
          line2Size -= 0.2;
          doc.setFontSize(line2Size);
        }
        doc.text('mm', centerX, subHeaderDividerY + 3.6, { align: 'center', baseline: 'middle' });
      } else {
        // Single line
        let subFontSize = cols.length >= 11 ? 6.8 : (cols.length >= 10 ? 7.2 : 7.8);
        doc.setFontSize(subFontSize);
        const subText = cleanText(col.subHeader || 'Material mm');
        while (doc.getTextWidth(subText) > (col.width - 1.5) && subFontSize > 4.5) {
          subFontSize -= 0.2;
          doc.setFontSize(subFontSize);
        }
        doc.text(subText, centerX, subHeaderDividerY + 2.8, { align: 'center', baseline: 'middle' });
      }
    } else if (col.id === 'sashCut' && cols[c + 1]?.id === 'sashHPcs') {
      // Main grouped header spanning across sashCut + sashHPcs + sashWPcs
      const sashGroupCols = [cols[c]];
      if (cols[c + 1]?.id === 'sashHPcs') sashGroupCols.push(cols[c + 1]);
      if (cols[c + 2]?.id === 'sashWPcs') sashGroupCols.push(cols[c + 2]);
      const combinedW = sashGroupCols.reduce((s, cc) => s + cc.width, 0);
      const combinedCenterX = colX[c] + combinedW / 2;
      doc.setFont('helvetica', 'bold');
      let headerSize = cols.length >= 11 ? 8.0 : (cols.length >= 10 ? 8.4 : 9.0);
      doc.setFontSize(headerSize);
      while (doc.getTextWidth(cleanText(col.header)) > (combinedW - 2.0) && headerSize > 5.0) {
        headerSize -= 0.2;
        doc.setFontSize(headerSize);
      }
      doc.setTextColor(...colColor);
      doc.text(cleanText(col.header), combinedCenterX, tableHeaderTopY + 2.8, { align: 'center', baseline: 'middle' });

      // Sub-column header for sash cut (Height X Width)
      doc.setFont('helvetica', 'bold');
      let subFontSize = cols.length >= 11 ? 6.5 : (cols.length >= 10 ? 7.0 : 7.5);
      doc.setFontSize(subFontSize);
      const subText = cleanText(col.subHeader || '');
      while (doc.getTextWidth(subText) > (col.width - 1.5) && subFontSize > 4.2) {
        subFontSize -= 0.2;
        doc.setFontSize(subFontSize);
      }
      doc.text(subText, centerX, subHeaderDividerY + 2.8, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'sashHPcs' || col.id === 'sashWPcs') {
      // Sub-column header for sash H Pcs / W Pcs
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colColor);
      const label = col.id === 'sashHPcs' ? 'H Pcs' : 'W Pcs';
      let subFontSize = 5.2;
      doc.setFontSize(subFontSize);
      while (doc.getTextWidth(label) > (col.width - 0.8) && subFontSize > 3.5) {
        subFontSize -= 0.2;
        doc.setFontSize(subFontSize);
      }
      doc.text(label, centerX, subHeaderDividerY + 2.8, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'mullion' && cols[c + 1]?.id === 'mullionPcs') {
      // Main grouped header spanning across both mullion (cut size) and mullionPcs (number of pieces)
      const combinedW = cols[c].width + cols[c + 1].width;
      const combinedCenterX = colX[c] + combinedW / 2;
      doc.setFont('helvetica', 'bold');
      let headerSize = cols.length >= 11 ? 8.0 : (cols.length >= 10 ? 8.4 : 9.0);
      doc.setFontSize(headerSize);
      while (doc.getTextWidth(cleanText(col.header)) > (combinedW - 2.0) && headerSize > 5.0) {
        headerSize -= 0.2;
        doc.setFontSize(headerSize);
      }
      doc.setTextColor(...colColor);
      doc.text(cleanText(col.header), combinedCenterX, tableHeaderTopY + 2.8, { align: 'center', baseline: 'middle' });

      // Sub-column header for mullion cut (Sash H - 6)
      doc.setFont('helvetica', 'bold');
      let subFontSize = cols.length >= 11 ? 6.5 : (cols.length >= 10 ? 7.0 : 7.5);
      doc.setFontSize(subFontSize);
      const subText = cleanText(col.subHeader || '');
      while (doc.getTextWidth(subText) > (col.width - 1.5) && subFontSize > 4.2) {
        subFontSize -= 0.2;
        doc.setFontSize(subFontSize);
      }
      doc.text(subText, centerX, subHeaderDividerY + 2.8, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'mullionPcs') {
      // Sub-column header for mullion pieces (No.Pcs)
      doc.setFont('helvetica', 'bold');
      let pcsFontSize = cols.length >= 11 ? 6.2 : (cols.length >= 10 ? 6.8 : 7.4);
      doc.setFontSize(pcsFontSize);
      const pcsText = cleanText(col.subHeader || 'No.Pcs');
      while (doc.getTextWidth(pcsText) > (col.width - 1.2) && pcsFontSize > 4.2) {
        pcsFontSize -= 0.2;
        doc.setFontSize(pcsFontSize);
      }
      doc.setTextColor(...colColor);
      doc.text(pcsText, centerX, subHeaderDividerY + 2.8, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'mirrorCut' && cols[c + 1]?.id === 'glassPcs') {
      // Main grouped header spanning across both mirrorCut (cut size) and glassPcs (number of pieces)
      const combinedW = cols[c].width + cols[c + 1].width;
      const combinedCenterX = colX[c] + combinedW / 2;
      doc.setFont('helvetica', 'bold');
      let headerSize = cols.length >= 11 ? 8.0 : (cols.length >= 10 ? 8.4 : 9.0);
      doc.setFontSize(headerSize);
      while (doc.getTextWidth(cleanText(col.header)) > (combinedW - 2.0) && headerSize > 5.0) {
        headerSize -= 0.2;
        doc.setFontSize(headerSize);
      }
      doc.setTextColor(...colColor);
      doc.text(cleanText(col.header), combinedCenterX, tableHeaderTopY + 2.8, { align: 'center', baseline: 'middle' });

      // Sub-column header for glass cut (Height X Width)
      doc.setFont('helvetica', 'bold');
      let subFontSize = cols.length >= 11 ? 6.5 : (cols.length >= 10 ? 7.0 : 7.5);
      doc.setFontSize(subFontSize);
      const subText = cleanText(col.subHeader || '');
      while (doc.getTextWidth(subText) > (col.width - 1.5) && subFontSize > 4.2) {
        subFontSize -= 0.2;
        doc.setFontSize(subFontSize);
      }
      doc.text(subText, centerX, subHeaderDividerY + 2.8, { align: 'center', baseline: 'middle' });
    } else if (col.id === 'glassPcs') {
      // Sub-column header for glass pieces (No.Pcs)
      doc.setFont('helvetica', 'bold');
      let pcsFontSize = cols.length >= 11 ? 6.2 : (cols.length >= 10 ? 6.8 : 7.4);
      doc.setFontSize(pcsFontSize);
      const pcsText = cleanText(col.subHeader || 'No.Pcs');
      while (doc.getTextWidth(pcsText) > (col.width - 1.2) && pcsFontSize > 4.2) {
        pcsFontSize -= 0.2;
        doc.setFontSize(pcsFontSize);
      }
      doc.setTextColor(...colColor);
      doc.text(pcsText, centerX, subHeaderDividerY + 2.8, { align: 'center', baseline: 'middle' });
    } else if (col.subHeader) {
      // Main column header (Top cell - auto-scaled to col.width - 1.5)
      doc.setFont('helvetica', 'bold');
      let headerFontSize = cols.length >= 11 ? 7.5 : (cols.length >= 10 ? 8.2 : 9.0);
      doc.setFontSize(headerFontSize);
      const headerText = cleanText(col.header);
      while (doc.getTextWidth(headerText) > (col.width - 1.5) && headerFontSize > 4.5) {
        headerFontSize -= 0.2;
        doc.setFontSize(headerFontSize);
      }
      doc.setTextColor(...colColor);
      doc.text(headerText, centerX, tableHeaderTopY + 2.8, { align: 'center', baseline: 'middle' });

      // Sub-column header (Bottom cell, below separate line - auto-scaled to col.width - 1.5)
      doc.setFont('helvetica', 'bold');
      let subFontSize = cols.length >= 11 ? 6.5 : (cols.length >= 10 ? 7.0 : 7.8);
      doc.setFontSize(subFontSize);
      const subText = cleanText(col.subHeader);
      while (doc.getTextWidth(subText) > (col.width - 1.5) && subFontSize > 4.2) {
        subFontSize -= 0.2;
        doc.setFontSize(subFontSize);
      }
      doc.setTextColor(...colColor);
      doc.text(subText, centerX, subHeaderDividerY + 2.8, { align: 'center', baseline: 'middle' });
    } else {
      // Single full-height header (Si.No., Height, X, Width - auto-scaled to col.width - 1.2)
      doc.setFont('helvetica', 'bold');
      let fullFontSize = cols.length >= 11 ? 8.2 : (cols.length >= 10 ? 8.8 : 9.8);
      doc.setFontSize(fullFontSize);
      const headerText = cleanText(col.header);
      while (doc.getTextWidth(headerText) > (col.width - 1.2) && fullFontSize > 4.5) {
        fullFontSize -= 0.2;
        doc.setFontSize(fullFontSize);
      }
      doc.setTextColor(...colColor);
      doc.text(headerText, centerX, tableHeaderTopY + tableHeaderH / 2, { align: 'center', baseline: 'middle' });
    }
  }

  // Helper for drawing cell text with boundary protection
  // isBold = true (Thick letter for Fixed window), isBold = false (Lite thick letter for other windows)
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
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    let currentSize = baseFontSize;
    doc.setFontSize(currentSize);
    let textW = doc.getTextWidth(text);
    while (textW > maxWidth && currentSize > 4.5) {
      currentSize -= 0.2;
      doc.setFontSize(currentSize);
      textW = doc.getTextWidth(text);
    }
    doc.setTextColor(...color);
    if (align === 'center') {
      doc.text(text, centerX, centerY, { align: 'center', baseline: 'middle' });
    } else {
      doc.text(text, leftX ?? (centerX - maxWidth / 2), centerY, { align: 'left', baseline: 'middle' });
    }
  };

  // High-contrast, sharp dark charcoal ink for all cell data ("no font color")
  const cellTextColorPdf: [number, number, number] = [15, 23, 42];

  // 5. Data Rows (28 Rows) - Formed as Prominent Enclosed Boxes with Unique Model Background Colors
  // Thick letter applied ONLY to Fixed Window; other windows use Lite Thick letter (helvetica normal)
  for (let r = 0; r < numRows; r++) {
    const rowTopY = tableHeaderBottomY + r * rowH;
    const rowBottomY = rowTopY + rowH;
    const centerY = rowTopY + rowH / 2;

    // Active Row Data & Fixed Window Detection
    const row = pageRows[r];
    const isFixed = Boolean(row && (row.isFixed ?? (row.windowType === 'fixed' || row.modelName?.toUpperCase().includes('FIXED'))));

    // Fill Row / Cell Background with Window Type's Unique Color
    if (row) {
      const bg = getLSModelBgColor(row);
      doc.setFillColor(...bg.pdf);
      doc.rect(marginX, rowTopY, boxW, rowH, 'F');
    }

    // Horizontal Box Border Line: Strong 0.38mm dark navy line forming crisp framed boxes
    doc.setDrawColor(...inkDark);
    doc.setLineWidth(0.38);
    doc.line(marginX, rowBottomY, marginX + boxW, rowBottomY);

    // Multiplier 'X' in Column 2 (thick letter for fixed window, lite thick for others; dark ink if active, light gray if empty)
    doc.setFont('helvetica', isFixed ? 'bold' : 'normal');
    doc.setFontSize(13);
    if (row) {
      doc.setTextColor(...cellTextColorPdf);
    } else {
      doc.setTextColor(203, 213, 225); // light gray for empty sheet rows
    }
    doc.text('X', colX[2] + cols[2].width / 2, centerY, { align: 'center', baseline: 'middle' });

    if (row) {
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        const centerX = colX[c] + col.width / 2;
        const availableW = col.width - 1.5;

        switch (col.id) {
          case 'sino':
            if (row.siNo) {
              drawCellText(row.siNo, centerX, centerY, 13.0, availableW, cellTextColorPdf, 'center', undefined, isFixed);
            }
            break;
          case 'height':
            if (row.siteHeight) {
              drawCellText(cleanText(row.siteHeight), centerX, centerY, 12.0, availableW, cellTextColorPdf, 'center', undefined, isFixed);
            }
            break;
          case 'x':
            // Already drawn above
            break;
          case 'width':
            if (row.siteWidth) {
              drawCellText(cleanText(row.siteWidth), centerX, centerY, 12.0, availableW, cellTextColorPdf, 'center', undefined, isFixed);
            }
            break;
          case 'model':
            if (row.modelName) {
              const baseSize = cols.length >= 10 ? 9.2 : (cols.length === 9 ? 10.0 : 11.0);
              drawCellText(
                cleanText(row.modelName),
                centerX,
                centerY,
                baseSize,
                col.width - 2.0,
                cellTextColorPdf,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'materialMM':
            if (row.materialMM) {
              const baseSize = cols.length >= 10 ? 10.5 : (cols.length === 9 ? 11.5 : 12.0);
              drawCellText(
                cleanText(row.materialMM),
                centerX,
                centerY,
                baseSize,
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
              const baseSize = cols.length >= 10 ? 11.0 : (cols.length === 9 ? 12.0 : 13.0);
              drawCellText(
                formatCellCutText(row.outerFrameMM),
                centerX,
                centerY,
                baseSize,
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
              const baseSize = cols.length >= 10 ? 11.0 : (cols.length === 9 ? 12.0 : 13.0);
              drawCellText(
                formatCellCutText(row.sashCutMM),
                centerX,
                centerY,
                baseSize,
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
              const baseSize = cols.length >= 10 ? 11.0 : (cols.length === 9 ? 12.0 : 13.0);
              drawCellText(
                row.sashHPcs,
                centerX,
                centerY,
                baseSize,
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
              const baseSize = cols.length >= 10 ? 11.0 : (cols.length === 9 ? 12.0 : 13.0);
              drawCellText(
                row.sashWPcs,
                centerX,
                centerY,
                baseSize,
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
              const baseSize = cols.length >= 10 ? 11.5 : (cols.length === 9 ? 12.5 : 13.0);
              drawCellText(
                formatCellCutText(row.mullionMM),
                centerX,
                centerY,
                baseSize,
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
              const baseSize = cols.length >= 10 ? 11.5 : (cols.length === 9 ? 12.5 : 13.0);
              drawCellText(
                row.mullionPcs,
                centerX,
                centerY,
                baseSize,
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
              const baseSize = cols.length >= 10 ? 11.5 : (cols.length === 9 ? 12.5 : 13.0);
              drawCellText(
                formatCellCutText(row.interlockMM),
                centerX,
                centerY,
                baseSize,
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
              const baseSize = cols.length >= 10 ? 11.0 : (cols.length === 9 ? 12.0 : 13.0);
              drawCellText(
                formatCellCutText(row.mirrorCutMM),
                centerX,
                centerY,
                baseSize,
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
              const baseSize = cols.length >= 10 ? 11.5 : (cols.length === 9 ? 12.5 : 13.0);
              drawCellText(
                row.glassPcs,
                centerX,
                centerY,
                baseSize,
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
              const baseSize = cols.length >= 10 ? 10.0 : (cols.length === 9 ? 11.0 : 12.0);
              drawCellText(
                row.glassType,
                centerX,
                centerY,
                baseSize,
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
              const baseSize = cols.length >= 10 ? 11.0 : (cols.length === 9 ? 12.0 : 13.0);
              drawCellText(
                formatCellCutText(row.meshCutMM),
                centerX,
                centerY,
                baseSize,
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

  // 6. Vertical Column Dividers - Strong 0.38mm dark navy lines forming full enclosed cell boxes
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

/**
 * Draws High-Definition 300 DPI Canvas (2480 × 3508 px) for on-screen live preview & PNG download
 */
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

  // High-res pixel scale (2x of standard 1240 × 1754)
  const marginX = 76;
  const marginTop = 84;
  const boxW = width - marginX * 2; // 2328 px
  const headerH = 160;
  const tableHeaderH = 104;
  const rowH = 107.5;
  const numRows = pageSize; // 28 rows
  const tableH = tableHeaderH + numRows * rowH; // 104 + 3010 = 3114 px
  const totalBoxH = headerH + tableH; // 3274 px

  const inkDark = '#0f2952';
  const inkGrid = '#1e3a8a';

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

  // Header Content - Big Bold Branding & Typography
  const customerName = options.customerName?.trim() || '';
  const dateStr = options.date?.trim() || new Date().toLocaleDateString('en-GB');

  // Customer Name (Left - Big 38px Bold)
  ctx.fillStyle = inkDark;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 38px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText('Customer Name :', marginX + 32, marginTop + headerH / 2);

  if (customerName) {
    ctx.font = 'bold 42px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillStyle = '#1d4ed8';
    ctx.fillText(customerName, marginX + 360, marginTop + headerH / 2);
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = '36px monospace';
    ctx.fillText('........................................', marginX + 360, marginTop + headerH / 2);
  }

  // L.S.INTERIORS (Center Title - Huge 80px Heavy Black)
  ctx.fillStyle = inkDark;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 80px "Plus Jakarta Sans", "Arial Black", sans-serif';
  ctx.fillText('L.S.INTERIORS', width / 2, marginTop + headerH / 2);

  // Date (Right - Big 38px Bold)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 38px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillStyle = inkDark;

  if (dateStr) {
    ctx.fillText(`Date :  ${dateStr}`, marginX + boxW - 32, marginTop + headerH / 2);
  } else {
    ctx.fillText('Date : ........................', marginX + boxW - 32, marginTop + headerH / 2);
  }

  // Columns & Widths
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
    // 16 Columns: Standard + Material mm + Sash No.Pcs + Mullion + Mullion No.Pcs + Interlock + Glass + Glass No.Pcs + Glass Type + 2.5T Mesh (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 80, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 130, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 50, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 130, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 265, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 140, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height × Width', width: 205, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height × Width', width: 185, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 43, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 42, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 135, colorCanvas: LS_COLOR_MAP.mullion.canvas },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 85, colorCanvas: LS_COLOR_MAP.mullionPcs.canvas },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 180, colorCanvas: LS_COLOR_MAP.interlock.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height × Width', width: 195, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 85, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 160, colorCanvas: LS_COLOR_MAP.glassType.canvas },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'Height × Width', width: 218, colorCanvas: LS_COLOR_MAP.meshCut.canvas }
    ];
  } else if (includeMullion && includeInterlock && !includeMesh) {
    // 15 Columns: Standard + Material mm + Sash No.Pcs + Mullion + Mullion No.Pcs + Interlock + Glass + Glass No.Pcs + Glass Type (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 85, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 140, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 50, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 140, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 275, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 145, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height × Width', width: 225, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height × Width', width: 195, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 43, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 42, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 145, colorCanvas: LS_COLOR_MAP.mullion.canvas },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 85, colorCanvas: LS_COLOR_MAP.mullionPcs.canvas },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 190, colorCanvas: LS_COLOR_MAP.interlock.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height × Width', width: 210, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 85, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 273, colorCanvas: LS_COLOR_MAP.glassType.canvas }
    ];
  } else if (includeMullion && !includeInterlock && includeMesh) {
    // 15 Columns: Standard + Material mm + Sash No.Pcs + Mullion + Mullion No.Pcs + Glass + Glass No.Pcs + Glass Type + 2.5T Mesh (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 85, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 140, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 50, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 140, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 275, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 145, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height × Width', width: 225, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height × Width', width: 195, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 43, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 42, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 145, colorCanvas: LS_COLOR_MAP.mullion.canvas },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 85, colorCanvas: LS_COLOR_MAP.mullionPcs.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height × Width', width: 210, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 85, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 245, colorCanvas: LS_COLOR_MAP.glassType.canvas },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'Height × Width', width: 218, colorCanvas: LS_COLOR_MAP.meshCut.canvas }
    ];
  } else if (!includeMullion && includeInterlock && includeMesh) {
    // 14 Columns: Standard + Material mm + Sash No.Pcs + Interlock + Glass + Glass No.Pcs + Glass Type + 2.5T Mesh (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 85, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 140, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 50, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 140, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 285, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 155, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height × Width', width: 230, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height × Width', width: 200, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 45, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 45, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 190, colorCanvas: LS_COLOR_MAP.interlock.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height × Width', width: 210, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 90, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 225, colorCanvas: LS_COLOR_MAP.glassType.canvas },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'Height × Width', width: 228, colorCanvas: LS_COLOR_MAP.meshCut.canvas }
    ];
  } else if (includeMullion && !includeInterlock && !includeMesh) {
    // 14 Columns: Standard + Material mm + Sash No.Pcs + Mullion + Mullion No.Pcs + Glass + Glass No.Pcs + Glass Type (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 85, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 140, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 50, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 140, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 285, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 155, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height × Width', width: 235, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height × Width', width: 205, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 48, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 47, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mullion', header: 'Mullion mm', subHeader: mullionSubHeader, width: 155, colorCanvas: LS_COLOR_MAP.mullion.canvas },
      { id: 'mullionPcs', header: 'Mullion mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.mullionPcs.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height × Width', width: 235, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 358, colorCanvas: LS_COLOR_MAP.glassType.canvas }
    ];
  } else if (!includeMullion && includeInterlock && !includeMesh) {
    // 13 Columns: Standard + Material mm + Sash No.Pcs + Interlock + Glass + Glass No.Pcs + Glass Type (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 95, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 155, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 50, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 155, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 295, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 165, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height × Width', width: 245, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height × Width', width: 215, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 48, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 47, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'interlock', header: 'Interlock mm', subHeader: 'Sash H - 5', width: 200, colorCanvas: LS_COLOR_MAP.interlock.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height × Width', width: 230, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 333, colorCanvas: LS_COLOR_MAP.glassType.canvas }
    ];
  } else if (!includeMullion && !includeInterlock && includeMesh) {
    // 13 Columns: Standard + Material mm + Sash No.Pcs + Glass + Glass No.Pcs + Glass Type + 2.5T Mesh (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 95, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 155, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 50, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 155, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 295, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 165, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height × Width', width: 245, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height × Width', width: 215, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 48, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 47, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height × Width', width: 235, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 95, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 285, colorCanvas: LS_COLOR_MAP.glassType.canvas },
      { id: 'meshCut', header: '2.5T Mesh mm', subHeader: 'Height × Width', width: 243, colorCanvas: LS_COLOR_MAP.meshCut.canvas }
    ];
  } else {
    // 12 Columns: Standard + Material mm + Sash No.Pcs + Glass + Glass No.Pcs + Glass Type (Sum = 2328 px)
    cols = [
      { id: 'sino', header: 'Si.No.', width: 105, colorCanvas: LS_COLOR_MAP.sino.canvas },
      { id: 'height', header: 'Height', width: 165, colorCanvas: LS_COLOR_MAP.height.canvas },
      { id: 'x', header: 'X', width: 50, colorCanvas: LS_COLOR_MAP.x.canvas },
      { id: 'width', header: 'Width', width: 165, colorCanvas: LS_COLOR_MAP.width.canvas },
      { id: 'model', header: 'Model Name', subHeader: 'Type', width: 310, colorCanvas: LS_COLOR_MAP.model.canvas },
      { id: 'materialMM', header: 'Model Name', subHeader: 'Material mm', width: 175, colorCanvas: LS_COLOR_MAP.materialMM.canvas },
      { id: 'outerFrame', header: 'Outer Frame mm', subHeader: 'Height × Width', width: 265, colorCanvas: LS_COLOR_MAP.outerFrame.canvas },
      { id: 'sashCut', header: 'Sash Cut mm', subHeader: 'Height × Width', width: 235, colorCanvas: LS_COLOR_MAP.sashCut.canvas },
      { id: 'sashHPcs', header: 'Sash Cut mm', subHeader: 'H Pcs', width: 53, colorCanvas: LS_COLOR_MAP.sashHPcs.canvas },
      { id: 'sashWPcs', header: 'Sash Cut mm', subHeader: 'W Pcs', width: 52, colorCanvas: LS_COLOR_MAP.sashWPcs.canvas },
      { id: 'mirrorCut', header: 'Glass Cut mm', subHeader: 'Height × Width', width: 255, colorCanvas: LS_COLOR_MAP.mirrorCut.canvas },
      { id: 'glassPcs', header: 'Glass Cut mm', subHeader: 'No.Pcs', width: 105, colorCanvas: LS_COLOR_MAP.glassPcs.canvas },
      { id: 'glassType', header: 'Glass Type', subHeader: 'Client Fill', width: 393, colorCanvas: LS_COLOR_MAP.glassType.canvas }
    ];
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

  // Separate horizontal divider line dividing main column and sub-column (across model and cut columns: colX[4] to marginX + boxW)
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = inkDark;
  ctx.beginPath();
  ctx.moveTo(colX[4], subHeaderDividerY);
  ctx.lineTo(marginX + boxW, subHeaderDividerY);
  ctx.stroke();

  // Column Headers Text - Big High-Legibility Typography with Unique Column Color
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
      let headerSize = cols.length >= 11 ? 24 : (cols.length >= 10 ? 26 : 28);
      ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      while (ctx.measureText(col.header).width > (combinedW - 20) && headerSize > 14) {
        headerSize -= 1;
        ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(col.header, combinedCenterX, tableHeaderTopY + 26);

      // Sub-column header for model type
      let typeSize = cols.length >= 11 ? 19 : (cols.length >= 10 ? 21 : 23);
      ctx.font = `bold ${typeSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const typeText = col.subHeader || 'Type';
      while (ctx.measureText(typeText).width > (col.width - 12) && typeSize > 12) {
        typeSize -= 1;
        ctx.font = `bold ${typeSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(typeText, centerX, subHeaderDividerY + 26);
    } else if (col.id === 'materialMM') {
      // Sub-column header for material mm
      ctx.fillStyle = colColor;
      if (col.width <= 160) {
        // Stack as two lines: "Material" on top, "mm" below
        let line1Size = 16;
        ctx.font = `bold ${line1Size}px "Plus Jakarta Sans", Arial, sans-serif`;
        while (ctx.measureText('Material').width > (col.width - 12) && line1Size > 10) {
          line1Size -= 1;
          ctx.font = `bold ${line1Size}px "Plus Jakarta Sans", Arial, sans-serif`;
        }
        ctx.fillText('Material', centerX, subHeaderDividerY + 16);

        let line2Size = 15;
        ctx.font = `bold ${line2Size}px "Plus Jakarta Sans", Arial, sans-serif`;
        while (ctx.measureText('mm').width > (col.width - 12) && line2Size > 10) {
          line2Size -= 1;
          ctx.font = `bold ${line2Size}px "Plus Jakarta Sans", Arial, sans-serif`;
        }
        ctx.fillText('mm', centerX, subHeaderDividerY + 34);
      } else {
        let matSize = cols.length >= 11 ? 18 : (cols.length >= 10 ? 20 : 22);
        ctx.font = `bold ${matSize}px "Plus Jakarta Sans", Arial, sans-serif`;
        const matSubText = col.subHeader || 'Material mm';
        while (ctx.measureText(matSubText).width > (col.width - 12) && matSize > 12) {
          matSize -= 1;
          ctx.font = `bold ${matSize}px "Plus Jakarta Sans", Arial, sans-serif`;
        }
        ctx.fillText(matSubText, centerX, subHeaderDividerY + 26);
      }
    } else if (col.id === 'sashCut' && cols[c + 1]?.id === 'sashHPcs') {
      // Main grouped header spanning across sashCut + sashHPcs + sashWPcs
      const sashGroupColsC = [cols[c]];
      if (cols[c + 1]?.id === 'sashHPcs') sashGroupColsC.push(cols[c + 1]);
      if (cols[c + 2]?.id === 'sashWPcs') sashGroupColsC.push(cols[c + 2]);
      const combinedW = sashGroupColsC.reduce((s, cc) => s + cc.width, 0);
      const combinedCenterX = colX[c] + combinedW / 2;
      ctx.fillStyle = colColor;
      let headerSize = cols.length >= 11 ? 24 : (cols.length >= 10 ? 26 : 28);
      ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      while (ctx.measureText(col.header).width > (combinedW - 20) && headerSize > 14) {
        headerSize -= 1;
        ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(col.header, combinedCenterX, tableHeaderTopY + 26);

      // Sub-column header for sash cut (Height × Width)
      let subSize = cols.length >= 11 ? 18 : (cols.length >= 10 ? 20 : 22);
      ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const subText = col.subHeader || '';
      while (ctx.measureText(subText).width > (col.width - 12) && subSize > 11) {
        subSize -= 1;
        ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(subText, centerX, subHeaderDividerY + 26);
    } else if (col.id === 'sashPcs') {
      // Sub-column header for sash pieces (No. of Sash Pcs)
      ctx.fillStyle = colColor;
      if (col.width <= 130) {
        // Stack as two lines: "No. of" on top, "Sash Pcs" below
        let line1Size = 15;
        ctx.font = `bold ${line1Size}px "Plus Jakarta Sans", Arial, sans-serif`;
        while (ctx.measureText('No. of').width > (col.width - 10) && line1Size > 9) {
          line1Size -= 1;
          ctx.font = `bold ${line1Size}px "Plus Jakarta Sans", Arial, sans-serif`;
        }
        ctx.fillText('No. of', centerX, subHeaderDividerY + 16);

        let line2Size = 14;
        ctx.font = `bold ${line2Size}px "Plus Jakarta Sans", Arial, sans-serif`;
        while (ctx.measureText('Sash Pcs').width > (col.width - 10) && line2Size > 9) {
          line2Size -= 1;
          ctx.font = `bold ${line2Size}px "Plus Jakarta Sans", Arial, sans-serif`;
        }
        ctx.fillText('Sash Pcs', centerX, subHeaderDividerY + 34);
      } else {
        let pcsSize = cols.length >= 11 ? 17 : (cols.length >= 10 ? 19 : 21);
        ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
        const pcsText = col.subHeader || 'No. of Sash Pcs';
        while (ctx.measureText(pcsText).width > (col.width - 10) && pcsSize > 11) {
          pcsSize -= 1;
          ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
        }
        ctx.fillText(pcsText, centerX, subHeaderDividerY + 26);
      }
    } else if (col.id === 'mullion' && cols[c + 1]?.id === 'mullionPcs') {
      // Main grouped header spanning across both mullion (cut size) and mullionPcs (number of pieces)
      const combinedW = cols[c].width + cols[c + 1].width;
      const combinedCenterX = colX[c] + combinedW / 2;
      ctx.fillStyle = colColor;
      let headerSize = cols.length >= 11 ? 24 : (cols.length >= 10 ? 26 : 28);
      ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      while (ctx.measureText(col.header).width > (combinedW - 20) && headerSize > 14) {
        headerSize -= 1;
        ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(col.header, combinedCenterX, tableHeaderTopY + 26);

      // Sub-column header for mullion cut (Sash H - 6)
      let subSize = cols.length >= 11 ? 18 : (cols.length >= 10 ? 20 : 22);
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
      let pcsSize = cols.length >= 11 ? 17 : (cols.length >= 10 ? 19 : 21);
      ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const pcsText = col.subHeader || 'No.Pcs';
      while (ctx.measureText(pcsText).width > (col.width - 10) && pcsSize > 11) {
        pcsSize -= 1;
        ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(pcsText, centerX, subHeaderDividerY + 26);
    } else if (col.id === 'mirrorCut' && cols[c + 1]?.id === 'glassPcs') {
      // Main grouped header spanning across both mirrorCut (cut size) and glassPcs (number of pieces)
      const combinedW = cols[c].width + cols[c + 1].width;
      const combinedCenterX = colX[c] + combinedW / 2;
      ctx.fillStyle = colColor;
      let headerSize = cols.length >= 11 ? 24 : (cols.length >= 10 ? 26 : 28);
      ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      while (ctx.measureText(col.header).width > (combinedW - 20) && headerSize > 14) {
        headerSize -= 1;
        ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(col.header, combinedCenterX, tableHeaderTopY + 26);

      // Sub-column header for glass cut (Height x Width)
      let subSize = cols.length >= 11 ? 18 : (cols.length >= 10 ? 20 : 22);
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
      let pcsSize = cols.length >= 11 ? 17 : (cols.length >= 10 ? 19 : 21);
      ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const pcsText = col.subHeader || 'No.Pcs';
      while (ctx.measureText(pcsText).width > (col.width - 10) && pcsSize > 11) {
        pcsSize -= 1;
        ctx.font = `bold ${pcsSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(pcsText, centerX, subHeaderDividerY + 26);
    } else if (col.subHeader) {
      // Main cut column header (Top cell - 24px - 32px Bold)
      ctx.fillStyle = colColor;
      let headerSize = cols.length >= 11 ? 22 : (cols.length >= 10 ? 24 : (cols.length === 9 ? 28 : 32));
      ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const headerText = col.header;
      while (ctx.measureText(headerText).width > (col.width - 14) && headerSize > 12) {
        headerSize -= 1;
        ctx.font = `bold ${headerSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(headerText, centerX, tableHeaderTopY + 26);

      // Sub-column header (Bottom cell, below separate line - 18px - 28px Bold)
      ctx.fillStyle = colColor;
      let subSize = cols.length >= 11 ? 18 : (cols.length >= 10 ? 20 : (cols.length === 9 ? 24 : 28));
      ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const subText = col.subHeader;
      while (ctx.measureText(subText).width > (col.width - 12) && subSize > 11) {
        subSize -= 1;
        ctx.font = `bold ${subSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(subText, centerX, subHeaderDividerY + 26);
    } else {
      // Single full-height header (Si.No., Height, X, Width, Model Name - 24px - 38px Bold)
      ctx.fillStyle = colColor;
      let fullSize = cols.length >= 11 ? 24 : (cols.length >= 10 ? 26 : (cols.length === 9 ? 34 : 38));
      ctx.font = `bold ${fullSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      const headerText = col.header;
      while (ctx.measureText(headerText).width > (col.width - 12) && fullSize > 12) {
        fullSize -= 1;
        ctx.font = `bold ${fullSize}px "Plus Jakarta Sans", Arial, sans-serif`;
      }
      ctx.fillText(headerText, centerX, tableHeaderTopY + tableHeaderH / 2);
    }
  }

  // Helper for drawing row cell text on canvas with boundary protection
  // isBold = true (Thick letter for Fixed window), isBold = false (Lite thick letter for other windows)
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
    while (textW > maxWidth && size > 12) {
      size -= 1;
      ctx.font = `${weight} ${size}px ${fontFamily}`;
      textW = ctx.measureText(text).width;
    }
    ctx.fillText(text, align === 'center' ? centerX : (leftX ?? centerX - maxWidth / 2), centerY);
  };

  // High-contrast, sharp dark charcoal ink for all cell data ("no font color")
  const cellTextColorCanvas = '#0f172a';

  // Data Rows (28 Rows) - Formed as Prominent Enclosed Boxes with Unique Model Background Colors
  // Thick letter applied ONLY to Fixed Window; other windows use Lite Thick letter (600 semi-bold)
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

    // Column 2 ('X') centered - 44px (bold for fixed, 600 lite-thick for others; dark ink if active, light gray if empty)
    ctx.fillStyle = rowData ? cellTextColorCanvas : '#cbd5e1';
    ctx.font = `${isFixed ? 'bold' : '600'} 44px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('X', colX[2] + cols[2].width / 2, centerY);

    if (rowData) {
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        const centerX = colX[c] + col.width / 2;
        const availableW = col.width - 16;

        switch (col.id) {
          case 'sino':
            if (rowData.siNo) {
              drawCanvasCellText(
                rowData.siNo,
                centerX,
                centerY,
                42,
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
                40,
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
                40,
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
              const baseFontPx = cols.length >= 10 ? 30 : (cols.length === 9 ? 32 : 36);
              drawCanvasCellText(
                rowData.modelName,
                centerX,
                centerY,
                baseFontPx,
                '"Plus Jakarta Sans", Arial, sans-serif',
                col.width - 20,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'materialMM':
            if (rowData.materialMM) {
              const baseFontPx = cols.length >= 10 ? 32 : (cols.length === 9 ? 34 : 38);
              drawCanvasCellText(
                rowData.materialMM,
                centerX,
                centerY,
                baseFontPx,
                '"Plus Jakarta Sans", Arial, sans-serif',
                col.width - 15,
                cellTextColorCanvas,
                'center',
                undefined,
                isFixed
              );
            }
            break;
          case 'outerFrame':
            if (rowData.outerFrameMM) {
              const baseFontPx = cols.length >= 10 ? 34 : (cols.length === 9 ? 36 : 40);
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.outerFrameMM),
                centerX,
                centerY,
                baseFontPx,
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
              const baseFontPx = cols.length >= 10 ? 34 : (cols.length === 9 ? 36 : 40);
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.sashCutMM),
                centerX,
                centerY,
                baseFontPx,
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
              const baseFontPx = cols.length >= 10 ? 34 : (cols.length === 9 ? 36 : 40);
              drawCanvasCellText(
                rowData.sashHPcs,
                centerX,
                centerY,
                baseFontPx,
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
              const baseFontPxW = cols.length >= 10 ? 34 : (cols.length === 9 ? 36 : 40);
              drawCanvasCellText(
                rowData.sashWPcs,
                centerX,
                centerY,
                baseFontPxW,
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
              const baseFontPx = cols.length >= 10 ? 36 : (cols.length === 9 ? 38 : 42);
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.mullionMM),
                centerX,
                centerY,
                baseFontPx,
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
              const baseFontPx = cols.length >= 10 ? 36 : (cols.length === 9 ? 38 : 42);
              drawCanvasCellText(
                rowData.mullionPcs,
                centerX,
                centerY,
                baseFontPx,
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
              const baseFontPx = cols.length >= 10 ? 36 : (cols.length === 9 ? 38 : 42);
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.interlockMM),
                centerX,
                centerY,
                baseFontPx,
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
              const baseFontPx = cols.length >= 10 ? 34 : (cols.length === 9 ? 36 : 40);
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.mirrorCutMM),
                centerX,
                centerY,
                baseFontPx,
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
              const baseFontPx = cols.length >= 10 ? 36 : (cols.length === 9 ? 38 : 42);
              drawCanvasCellText(
                rowData.glassPcs,
                centerX,
                centerY,
                baseFontPx,
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
              const baseFontPx = cols.length >= 10 ? 32 : (cols.length === 9 ? 34 : 38);
              drawCanvasCellText(
                rowData.glassType,
                centerX,
                centerY,
                baseFontPx,
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
              const baseFontPx = cols.length >= 10 ? 34 : 36;
              drawCanvasCellText(
                formatCanvasCellCutText(rowData.meshCutMM),
                centerX,
                centerY,
                baseFontPx,
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

  // Vertical Column Dividers - Strong 3.5px dark navy lines forming full enclosed cell boxes
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

/**
 * Returns 300 DPI PNG Data URL for a single L.S. Interiors order sheet page
 */
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
