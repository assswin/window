import {
  WindowInput,
  CalculationResult,
  ProfileRule,
  CalculationStep,
  FrameOutput,
  PanelOutput,
  MirrorOutput,
  ReinforcementSteelCut,
  GlassBeadOutput
} from './types';
import { RulesEngineManager } from './rules';

export class WindowCalculationEngine {
  /**
   * Validates raw user input values.
   * Returns null if valid, or an error string if invalid.
   */
  static validateInput(input: Partial<WindowInput>): string | null {
    const unit = input.unit || 'inch';

    if (unit === 'cm') {
      const w = input.widthCm ?? (input.widthInch ? input.widthInch * 2.54 : undefined);
      if (w === undefined || w === null || isNaN(w)) {
        return 'Please enter a valid window width in cm.';
      }
      if (w <= 0) {
        return 'Window width must be greater than 0 cm.';
      }
      if (w > 1000) {
        return 'Window width exceeds maximum limit (1000 cm). Please check dimensions.';
      }

      const h = input.heightCm ?? (input.heightInch ? input.heightInch * 2.54 : undefined);
      if (h === undefined || h === null || isNaN(h)) {
        return 'Please enter a valid window height in cm.';
      }
      if (h <= 0) {
        return 'Window height must be greater than 0 cm.';
      }
      if (h > 800) {
        return 'Window height exceeds maximum limit (800 cm). Please check dimensions.';
      }
    } else if (unit === 'mm') {
      const w = input.widthMM ?? (input.widthInch ? input.widthInch * 25.4 : undefined);
      if (w === undefined || w === null || isNaN(w)) {
        return 'Please enter a valid window width in mm.';
      }
      if (w <= 0) {
        return 'Window width must be greater than 0 mm.';
      }
      if (w > 10000) {
        return 'Window width exceeds maximum limit (10000 mm). Please check dimensions.';
      }

      const h = input.heightMM ?? (input.heightInch ? input.heightInch * 25.4 : undefined);
      if (h === undefined || h === null || isNaN(h)) {
        return 'Please enter a valid window height in mm.';
      }
      if (h <= 0) {
        return 'Window height must be greater than 0 mm.';
      }
      if (h > 8000) {
        return 'Window height exceeds maximum limit (8000 mm). Please check dimensions.';
      }
    } else {
      if (input.widthInch === undefined || input.widthInch === null || isNaN(input.widthInch)) {
        return 'Please enter a valid window width in inches.';
      }
      if (input.widthInch <= 0) {
        return 'Window width must be greater than 0 inches.';
      }
      if (input.widthInch > 400) {
        return 'Window width exceeds maximum limit (400 inches). Please check dimensions.';
      }

      if (input.heightInch === undefined || input.heightInch === null || isNaN(input.heightInch)) {
        return 'Please enter a valid window height in inches.';
      }
      if (input.heightInch <= 0) {
        return 'Window height must be greater than 0 inches.';
      }
      if (input.heightInch > 300) {
        return 'Window height exceeds maximum limit (300 inches). Please check dimensions.';
      }
    }

    if (input.mirrorInch !== undefined && input.mirrorInch !== null) {
      if (isNaN(input.mirrorInch) || input.mirrorInch <= 0) {
        return 'Mirror measurement must be a valid positive number in inches.';
      }
      if (input.widthInch && input.heightInch && (input.mirrorInch > input.widthInch || input.mirrorInch > input.heightInch)) {
        return 'Mirror measurement cannot exceed total window dimensions.';
      }
    }

    if (input.windowType === 'sliding') {
      if (!input.frameType) {
        return 'Please select a frame type (2 Track, 2.5 Track, or 3.5 Track).';
      }
    } else {
      // Open window, fixed window, or ventilator: no track
      input.frameType = 'no-track';
    }

    if (!input.windowType) {
      return 'Please select a window type (Sliding, Open Window, Fixed Window, or Ventilator).';
    }

    return null;
  }

  /**
   * Decomposes inch dimension according to the workshop formula:
   * • Base Formula: (Value in inches) × 25.4 + offset
   * • Handling 1/8 fractions: Convert the even eighths (2/8 = 0.25, 4/8 = 0.5, 6/8 = 0.75) inside the main formula,
   *   and add 3.5 mm at the end for the remaining 1/8:
   *   ○ For X 1/8: (X × 25.4) + offset + 3.5
   *   ○ For X 3/8: ((X + 0.25) × 25.4) + offset + 3.5
   *   ○ For X 5/8: ((X + 0.5) × 25.4) + offset + 3.5
   *   ○ For X 7/8: ((X + 0.75) × 25.4) + offset + 3.5
   * • Standard fractions (1/4 = 0.25, 1/2 = 0.5, 3/4 = 0.75):
   *   (X.decimal × 25.4) + offset
   */
  static getConversionComponents(inch: number | undefined | null): {
    baseInch: number;
    fractionType: 'whole' | 'even' | 'odd';
    extraMM: number;
    fractionLabel: string;
    evenPart: number;
  } {
    if (inch === undefined || inch === null || isNaN(inch)) {
      return { baseInch: 0, fractionType: 'whole', extraMM: 0, fractionLabel: '', evenPart: 0 };
    }
    const whole = Math.floor(inch);
    const frac = Math.round((inch - whole) * 1000) / 1000;

    // Check for odd eighths (1/8, 3/8, 5/8, 7/8)
    if (Math.abs(frac - 0.125) < 0.0001) {
      return { baseInch: whole, fractionType: 'odd', extraMM: 3.5, fractionLabel: '1/8', evenPart: 0 };
    }
    if (Math.abs(frac - 0.375) < 0.0001) {
      return { baseInch: whole + 0.25, fractionType: 'odd', extraMM: 3.5, fractionLabel: '3/8', evenPart: 0.25 };
    }
    if (Math.abs(frac - 0.625) < 0.0001) {
      return { baseInch: whole + 0.5, fractionType: 'odd', extraMM: 3.5, fractionLabel: '5/8', evenPart: 0.5 };
    }
    if (Math.abs(frac - 0.875) < 0.0001) {
      return { baseInch: whole + 0.75, fractionType: 'odd', extraMM: 3.5, fractionLabel: '7/8', evenPart: 0.75 };
    }

    // Even eighths (2/8 = 0.25, 4/8 = 0.5, 6/8 = 0.75) or whole inches
    return {
      baseInch: inch,
      fractionType: frac > 0.0001 ? 'even' : 'whole',
      extraMM: 0,
      fractionLabel: '',
      evenPart: frac
    };
  }

  static inchToMM(inch: number, factor = 25.4, offset = 0): number {
    const { baseInch, extraMM } = this.getConversionComponents(inch);
    return Math.round(baseInch * factor + offset + extraMM);
  }

  static inchToMMExact(inch: number, factor = 25.4, offset = 0): number {
    const { baseInch, extraMM } = this.getConversionComponents(inch);
    return Number((baseInch * factor + offset + extraMM).toFixed(2));
  }

  static cmToMM(cm: number, offset = 0): number {
    return Math.round(cm * 10 + offset);
  }

  static cmToMMExact(cm: number, offset = 0): number {
    return Number((cm * 10 + offset).toFixed(2));
  }

  static mmToMM(mm: number, offset = 0): number {
    return Math.round(mm + offset);
  }

  static unitToMM(val: number, unit: string = 'inch', factor = 25.4, offset = 0): number {
    if (unit === 'cm') return this.cmToMM(val, offset);
    if (unit === 'mm') return this.mmToMM(val, offset);
    return this.inchToMM(val, factor, offset);
  }

  static getConversionStepDetails(
    dimName: 'Width' | 'Height',
    inch: number,
    factor: number,
    offset: number
  ): {
    formula: string;
    calculation: string;
    note: string;
  } {
    const { baseInch, fractionType, extraMM, fractionLabel, evenPart } = this.getConversionComponents(inch);
    const whole = Math.floor(inch);
    const offsetFormula = offset > 0 ? ` + ${offset}` : '';
    const offsetDesc = offset > 0 ? ` (Includes +${offset} mm workshop offset)` : '';

    if (fractionType === 'odd') {
      const innerFormula = evenPart > 0 ? `((${whole} + ${evenPart}) × ${factor})` : `(${whole} × ${factor})`;
      const baseProduct = Number((baseInch * factor).toFixed(2));
      const exactVal = Number((baseInch * factor + offset + extraMM).toFixed(2));

      return {
        formula: `${innerFormula}${offsetFormula} + ${extraMM}`,
        calculation: `${innerFormula}${offsetFormula} + ${extraMM} = ${baseProduct}${offsetFormula} + ${extraMM} = ${exactVal} mm`,
        note: `uPVC outer ${dimName.toLowerCase()} (Shop 1/8 rule: even eighth converted + 3.5 mm for remaining 1/8)${offsetDesc}.`
      };
    }

    const exactVal = Number((inch * factor + offset).toFixed(2));
    return {
      formula: `${dimName} (inch) × ${factor}${offsetFormula}`,
      calculation: `${inch}" × ${factor}${offsetFormula} = ${exactVal} mm`,
      note: `uPVC outer ${dimName.toLowerCase()}${offsetDesc}.`
    };
  }

  /**
   * Deterministic uPVC calculation engine.
   * Completely separated from UI.
   */
  static calculate(input: WindowInput, customRule?: ProfileRule): CalculationResult {
    const validationError = this.validateInput(input);
    if (validationError) {
      throw new Error(validationError);
    }

    // 1. Fetch rule
    const rule = customRule || RulesEngineManager.getRule(input.frameType, input.windowType, input.casementSubtype, input.profileSeries);

    // 2. Unit conversion with customizable multiplier and offset
    // Rule: If added mm is not provided (undefined/null/NaN) or is a negative integer (< 0), initialize to 0
    // User constraint: For ventilator, calculation is simple only inch to mm with NO ADDED MM (offset = 0)
    const factor = input.conversionFactor ?? 25.4;
    const rawOffset = (input.customOffsetMM === undefined || input.customOffsetMM === null || isNaN(input.customOffsetMM) || input.customOffsetMM < 0)
      ? 0
      : Math.round(input.customOffsetMM);
    const offset = input.windowType === 'ventilator' ? 0 : rawOffset;
    const weldingAllowance = input.weldingAllowanceMM ?? 0;

    let exactWidthMM: number;
    let convertedWidthMM: number;
    let exactHeightMM: number;
    let convertedHeightMM: number;

    const unit = input.unit || 'inch';

    if (unit === 'cm') {
      const wCm = input.widthCm !== undefined && input.widthCm !== null
        ? input.widthCm
        : (input.widthInch ? Number((input.widthInch * 2.54).toFixed(2)) : 0);
      const hCm = input.heightCm !== undefined && input.heightCm !== null
        ? input.heightCm
        : (input.heightInch ? Number((input.heightInch * 2.54).toFixed(2)) : 0);
      convertedWidthMM = Math.round(wCm * 10 + offset);
      exactWidthMM = Number((wCm * 10 + offset).toFixed(2));
      convertedHeightMM = Math.round(hCm * 10 + offset);
      exactHeightMM = Number((hCm * 10 + offset).toFixed(2));
      if (!input.widthInch && wCm > 0) input.widthInch = Number((wCm / 2.54).toFixed(3));
      if (!input.heightInch && hCm > 0) input.heightInch = Number((hCm / 2.54).toFixed(3));
      if (input.widthCm === undefined) input.widthCm = wCm;
      if (input.heightCm === undefined) input.heightCm = hCm;
    } else if (unit === 'mm') {
      const wMM = input.widthMM !== undefined && input.widthMM !== null
        ? input.widthMM
        : (input.widthInch ? this.inchToMM(input.widthInch, factor, 0) : 0);
      const hMM = input.heightMM !== undefined && input.heightMM !== null
        ? input.heightMM
        : (input.heightInch ? this.inchToMM(input.heightInch, factor, 0) : 0);
      convertedWidthMM = Math.round(wMM + offset);
      exactWidthMM = Number((wMM + offset).toFixed(2));
      convertedHeightMM = Math.round(hMM + offset);
      exactHeightMM = Number((hMM + offset).toFixed(2));
      if (!input.widthInch && wMM > 0) input.widthInch = Number((wMM / 25.4).toFixed(3));
      if (!input.heightInch && hMM > 0) input.heightInch = Number((hMM / 25.4).toFixed(3));
      if (input.widthMM === undefined) input.widthMM = wMM;
      if (input.heightMM === undefined) input.heightMM = hMM;
    } else {
      // 'inch' (default)
      exactWidthMM = this.inchToMMExact(input.widthInch, factor, offset);
      convertedWidthMM = this.inchToMM(input.widthInch, factor, offset);
      exactHeightMM = this.inchToMMExact(input.heightInch, factor, offset);
      convertedHeightMM = this.inchToMM(input.heightInch, factor, offset);
      if (input.widthCm === undefined && input.widthInch) input.widthCm = Number((input.widthInch * 2.54).toFixed(2));
      if (input.heightCm === undefined && input.heightInch) input.heightCm = Number((input.heightInch * 2.54).toFixed(2));
      if (input.widthMM === undefined && input.widthInch) input.widthMM = Math.round(input.widthInch * 25.4);
      if (input.heightMM === undefined && input.heightInch) input.heightMM = Math.round(input.heightInch * 25.4);
    }

    const convertedMirrorMM = input.mirrorInch ? this.inchToMM(input.mirrorInch, factor, 0) : null;

    const steps: CalculationStep[] = [];

    let widthStep: { label: string; formula: string; calculation: string; note: string };
    let heightStep: { label: string; formula: string; calculation: string; note: string };

    if (unit === 'cm') {
      const wCm = input.widthCm ?? Number((input.widthInch * 2.54).toFixed(2));
      const hCm = input.heightCm ?? Number((input.heightInch * 2.54).toFixed(2));
      const offsetFormula = offset > 0 ? ` + ${offset}mm` : '';
      widthStep = {
        label: 'Width Conversion (CM → MM)',
        formula: `Width (cm) × 10${offsetFormula}`,
        calculation: `${wCm} cm × 10${offsetFormula} = ${convertedWidthMM} mm`,
        note: `uPVC outer width (CM to MM: cm × 10${offset > 0 ? ` + ${offset}mm offset` : ''}).`
      };
      heightStep = {
        label: 'Height Conversion (CM → MM)',
        formula: `Height (cm) × 10${offsetFormula}`,
        calculation: `${hCm} cm × 10${offsetFormula} = ${convertedHeightMM} mm`,
        note: `uPVC outer height (CM to MM: cm × 10${offset > 0 ? ` + ${offset}mm offset` : ''}).`
      };
    } else if (unit === 'mm') {
      const wMM = input.widthMM ?? convertedWidthMM;
      const hMM = input.heightMM ?? convertedHeightMM;
      const offsetFormula = offset > 0 ? ` + ${offset}mm` : '';
      widthStep = {
        label: 'Width Conversion (MM → MM)',
        formula: `Width (mm)${offsetFormula}`,
        calculation: `${wMM} mm${offsetFormula} = ${convertedWidthMM} mm`,
        note: `uPVC outer width (MM to MM direct conversion${offset > 0 ? ` + ${offset}mm offset` : ''}).`
      };
      heightStep = {
        label: 'Height Conversion (MM → MM)',
        formula: `Height (mm)${offsetFormula}`,
        calculation: `${hMM} mm${offsetFormula} = ${convertedHeightMM} mm`,
        note: `uPVC outer height (MM to MM direct conversion${offset > 0 ? ` + ${offset}mm offset` : ''}).`
      };
    } else {
      const wDetail = input.windowType === 'ventilator'
        ? {
            formula: `Width (inch) × ${factor} (No Added MM)`,
            calculation: `${input.widthInch}" × ${factor} = ${convertedWidthMM} mm`,
            note: 'uPVC ventilator outer width (Direct Inch → MM conversion with zero added margin).'
          }
        : this.getConversionStepDetails('Width', input.widthInch, factor, offset);
      const hDetail = input.windowType === 'ventilator'
        ? {
            formula: `Height (inch) × ${factor} (No Added MM)`,
            calculation: `${input.heightInch}" × ${factor} = ${convertedHeightMM} mm`,
            note: 'uPVC ventilator outer height (Direct Inch → MM conversion with zero added margin).'
          }
        : this.getConversionStepDetails('Height', input.heightInch, factor, offset);

      widthStep = { label: 'Width Conversion (Inch → MM)', ...wDetail };
      heightStep = { label: 'Height Conversion (Inch → MM)', ...hDetail };
    }

    steps.push({
      label: widthStep.label,
      formula: widthStep.formula,
      calculation: widthStep.calculation,
      result: `${convertedWidthMM} mm`,
      note: widthStep.note
    });

    steps.push({
      label: heightStep.label,
      formula: heightStep.formula,
      calculation: heightStep.calculation,
      result: `${convertedHeightMM} mm`,
      note: heightStep.note
    });

    // 3. uPVC Outer Frame & Track Calculations
    const isSliding = input.windowType ==='sliding';
    let trackCountNumber = 0;
    if (isSliding) {
      if (input.frameType === '2-track') trackCountNumber = 2;
      else if (input.frameType === '2.5-track') trackCountNumber = 2.5;
      else if (input.frameType === '3.5-track' || input.frameType === '3-track') trackCountNumber = 3.5;
      else if (input.frameType === '4-track') trackCountNumber = 4;
      else trackCountNumber = 2;
    }

    const frameTopBottomCutMM = convertedWidthMM + weldingAllowance;
    const frameLeftRightCutMM = convertedHeightMM + weldingAllowance;
    const steelCutTopBottomMM = Math.max(10, convertedWidthMM - 40);
    const steelCutLeftRightMM = Math.max(10, convertedHeightMM - 40);

    // Mullion for open casement windows (Outer Frame Height - 6 mm, customizable: double = 1 Pc, triple = 2 Pcs)
    const isDoubleCasement = input.windowType === 'open' && input.casementSubtype === 'double';
    const isTripleCasement = input.windowType === 'open' && input.casementSubtype === 'triple';
    const hasCasementMullion = isDoubleCasement || isTripleCasement;
    const mullionDed = rule.mullionDeductionMM ?? (rule.mullionSashDeductionMM ?? 6);
    const casementSashHeightMM = Math.max(10, convertedHeightMM - (rule.heightDeductionMM ?? 64));
    const mullionCutMM = hasCasementMullion ? Math.max(10, convertedHeightMM - mullionDed) : undefined;

    const frame: FrameOutput = {
      widthMM: convertedWidthMM,
      heightMM: convertedHeightMM,
      topBottomCutMM: frameTopBottomCutMM,
      leftRightCutMM: frameLeftRightCutMM,
      cutAngle: '45_degree',
      weldingAllowanceMM: weldingAllowance,
      profileDepthMM: rule.profileDepthMM,
      trackCount: trackCountNumber,
      mullionCutMM,
      steelCutTopBottomMM,
      steelCutLeftRightMM
    };

    steps.push({
      label: 'uPVC Outer Frame Cutting (45° Mitre Welded)',
      formula: weldingAllowance > 0
        ? `Cut Size = Dimension + Welding Allowance (${weldingAllowance} mm)`
        : 'Cut Size = Exact Outer Dimension',
      calculation: weldingAllowance > 0
        ? `Top/Bottom: ${convertedWidthMM} + ${weldingAllowance} = ${frameTopBottomCutMM} mm | Jambs: ${convertedHeightMM} + ${weldingAllowance} = ${frameLeftRightCutMM} mm`
        : `Top/Bottom: ${convertedWidthMM} mm (2 Pcs) | Jambs: ${convertedHeightMM} mm (2 Pcs)`,
      result: `${frameTopBottomCutMM} mm (W) × ${frameLeftRightCutMM} mm (H)`,
      note: '45° mitre cut for uPVC outer frame.'
    });

    if (mullionCutMM !== undefined) {
      const mullionPcs = isTripleCasement ? 2 : 1;
      steps.push({
        label: isTripleCasement ? 'Central Mullion Profile Cut (90° Straight Cut - 2 Pcs)' : 'Central Mullion Profile Cut (90° Straight Cut)',
        formula: `Height - ${mullionDed} mm`,
        calculation: `H - ${mullionDed} = ${convertedHeightMM} - ${mullionDed} = ${mullionCutMM} mm (${mullionPcs} ${mullionPcs > 1 ? 'Pcs' : 'Pc'})`,
        result: `${mullionCutMM} mm`,
        note: isTripleCasement
          ? `Center vertical dividers between 3-open window sashes (Height - ${mullionDed} mm, 2 Pcs).`
          : `Center vertical divider between double window sashes (Height - ${mullionDed} mm).`
      });
    }

    // 4. Panel (Shutter / Sash) Calculations using Audited Workshop Standards:
    // Legend: W = Width mm, H = Height mm
    // - Sliding 2-Track: H - 94, W/2 - 12, Glass: Sh - 94
    // - Sliding 2.5-Track: H - 82, W/2 - 8, Mesh: W × (H - 2), Glass: Sh - 94
    // - Sliding 3-Track: H - 91, W/3 - 11, Glass: Sh - 94
    // - Casement Single: H - 64, W - 64, Glass: Sh - 124
    // - Casement Double: H - 64, W/2 - 37, Mullion: Sash H - 6, Glass: Sh - 126
    // - Fixed Window: Direct Frame Glazing (OU - 96 mm), 0 Sash Panels
    let panelHeightMM: number;
    let panelWidthMM: number;
    let panelCount: number;
    let mirrorDeductionMM: number;
    let formulaDesc: string;
    let widthFormulaStr: string;
    let heightFormulaStr: string;
    let shutterType: string;

    if (input.windowType === 'ventilator') {
      // Ventilator: Direct outer frame sizing only, no sash shutter profiles
      panelHeightMM = 0;
      panelWidthMM = 0;
      panelCount = 0;
      mirrorDeductionMM = 0;
      formulaDesc = 'Ventilator: Direct Inch to MM Outer Frame | No Sash Shutter';
      heightFormulaStr = '-';
      widthFormulaStr = '-';
      shutterType = 'Ventilator Outer Frame (No Sash)';
    } else if (input.windowType === 'fixed') {
      // Direct frame glazing fixed window (no sash profile)
      const fixedGlassDedH = rule.mirrorHeightDeductionMM ?? 96;
      const fixedGlassDedW = rule.mirrorWidthDeductionMM ?? 96;
      panelHeightMM = Math.max(10, convertedHeightMM - fixedGlassDedH);
      panelWidthMM = Math.max(10, convertedWidthMM - fixedGlassDedW);
      panelCount = 0;
      mirrorDeductionMM = fixedGlassDedH;
      formulaDesc = `Fixed Window Direct Glazing: OU-${fixedGlassDedH} Glass | No Sash`;
      heightFormulaStr = `Direct Outer Frame Deduction: H - ${fixedGlassDedH} = ${convertedHeightMM} - ${fixedGlassDedH} = ${panelHeightMM} mm`;
      widthFormulaStr = `Direct Outer Frame Deduction: W - ${fixedGlassDedW} = ${convertedWidthMM} - ${fixedGlassDedW} = ${panelWidthMM} mm`;
      shutterType = 'Direct Outer Frame Glazing (No Sash)';
    } else if (input.windowType === 'open') {
      if (input.casementSubtype === 'triple') {
        // 3-Open casement window (H-64, W/3-40, Glass -125, Mullion H-6)
        const wDed = rule.widthDeductionMM ?? 40;
        const hDed = rule.heightDeductionMM ?? 64;
        panelHeightMM = Math.max(10, convertedHeightMM - hDed);
        panelWidthMM = Math.max(10, Math.round((convertedWidthMM / 3) - wDed));
        panelCount = 3;
        mirrorDeductionMM = rule.mirrorHeightDeductionMM ?? 125;
        formulaDesc = `3-Open Window: H-${hDed} | W/3-${wDed} | -${mirrorDeductionMM} Glass | M: H-${mullionDed}`;
        heightFormulaStr = `H - ${hDed} = ${convertedHeightMM} - ${hDed} = ${panelHeightMM} mm`;
        widthFormulaStr = `(W / 3) - ${wDed} = (${convertedWidthMM} / 3) - ${wDed} = ${panelWidthMM} mm`;
        shutterType = 'uPVC 3-Open Window Sash';
      } else if (input.casementSubtype === 'double') {
        // Double open window
        const wDed = rule.widthDeductionMM ?? 37;
        const hDed = rule.heightDeductionMM ?? 64;
        panelHeightMM = Math.max(10, convertedHeightMM - hDed);
        panelWidthMM = Math.max(10, Math.round((convertedWidthMM / 2) - wDed));
        panelCount = 2;
        mirrorDeductionMM = rule.mirrorHeightDeductionMM ?? 126;
        formulaDesc = `Double Window: H-${hDed} | W/2-${wDed} | -${mirrorDeductionMM} Glass | M: H-${mullionDed}`;
        heightFormulaStr = `H - ${hDed} = ${convertedHeightMM} - ${hDed} = ${panelHeightMM} mm`;
        widthFormulaStr = `(W / 2) - ${wDed} = (${convertedWidthMM} / 2) - ${wDed} = ${panelWidthMM} mm`;
        shutterType = 'uPVC Double Window Sash';
      } else {
        // Single open window (default)
        const wDed = rule.widthDeductionMM ?? 64;
        const hDed = rule.heightDeductionMM ?? 64;
        panelHeightMM = Math.max(10, convertedHeightMM - hDed);
        panelWidthMM = Math.max(10, convertedWidthMM - wDed);
        panelCount = 1;
        mirrorDeductionMM = rule.mirrorHeightDeductionMM ?? 124;
        formulaDesc = `Single Window: H-${hDed} | W-${wDed} | -${mirrorDeductionMM} Glass`;
        heightFormulaStr = `H - ${hDed} = ${convertedHeightMM} - ${hDed} = ${panelHeightMM} mm`;
        widthFormulaStr = `W - ${wDed} = ${convertedWidthMM} - ${wDed} = ${panelWidthMM} mm`;
        shutterType = 'uPVC Single Window Sash';
      }
    } else {
      // Sliding window
      const is65mm = input.profileSeries === '65mm' || rule.profileDepthMM === 65 || rule.id.includes('65mm');

      if (is65mm && input.frameType === '2-track') {
        const hDed = rule.heightDeductionMM ?? 94;
        const wDed = rule.widthDeductionMM ?? 22;
        panelHeightMM = Math.max(10, convertedHeightMM - hDed);
        panelWidthMM = Math.max(10, Math.round((convertedWidthMM - wDed) / 2));
        panelCount = 2;
        mirrorDeductionMM = rule.mirrorHeightDeductionMM ?? 112;
        formulaDesc = `2 Track Sliding (65mm): H-${hDed} | (W-${wDed})/2 | -${mirrorDeductionMM} Glass | 65mm`;
        heightFormulaStr = `H - ${hDed} = ${convertedHeightMM} - ${hDed} = ${panelHeightMM} mm`;
        widthFormulaStr = `(W - ${wDed}) / 2 = (${convertedWidthMM} - ${wDed}) / 2 = ${panelWidthMM} mm`;
        shutterType = 'uPVC 65mm Sliding Glass Sash';
      } else if (is65mm && (input.frameType === '3.5-track' || input.frameType === '3-track')) {
        const hDed = rule.heightDeductionMM ?? 88;
        const wAdd = rule.widthAdditionMM ?? 48;
        panelHeightMM = Math.max(10, convertedHeightMM - hDed);
        panelWidthMM = Math.max(10, Math.round((convertedWidthMM + wAdd) / 3));
        panelCount = 3;
        mirrorDeductionMM = rule.mirrorHeightDeductionMM ?? 112;
        formulaDesc = `3 Track Sliding (65mm): H-${hDed} | (W+${wAdd})/3 | -${mirrorDeductionMM} Glass | 65mm`;
        heightFormulaStr = `H - ${hDed} = ${convertedHeightMM} - ${hDed} = ${panelHeightMM} mm`;
        widthFormulaStr = `(W + ${wAdd}) / 3 = (${convertedWidthMM} + ${wAdd}) / 3 = ${panelWidthMM} mm`;
        shutterType = 'uPVC 65mm Sliding Glass Sash';
      } else if (input.frameType === '4-track') {
        const hDed = rule.heightDeductionMM ?? 92;
        const wAdd = rule.widthAdditionMM ?? (rule.widthDeductionMM && rule.widthDeductionMM !== 0 ? -rule.widthDeductionMM : 11);
        panelHeightMM = Math.max(10, convertedHeightMM - hDed);
        panelWidthMM = Math.max(10, Math.round((convertedWidthMM / 4) + wAdd));
        panelCount = 4;
        mirrorDeductionMM = rule.mirrorHeightDeductionMM ?? 95;
        formulaDesc = `4 Track Sliding: H-${hDed} | W/4+${wAdd} | -${mirrorDeductionMM} Glass | 58mm`;
        heightFormulaStr = `H - ${hDed} = ${convertedHeightMM} - ${hDed} = ${panelHeightMM} mm`;
        widthFormulaStr = `(W / 4) + ${wAdd} = (${convertedWidthMM} / 4) + ${wAdd} = ${panelWidthMM} mm`;
        shutterType = 'uPVC 4-Track Sliding Glass Sash';
      } else if (input.frameType === '2.5-track') {
        const hDed = rule.heightDeductionMM ?? 82;
        const wDed = rule.widthDeductionMM ?? 8;
        panelHeightMM = Math.max(10, convertedHeightMM - hDed);
        panelWidthMM = Math.max(10, Math.round((convertedWidthMM / 2) - wDed));
        panelCount = 2;
        mirrorDeductionMM = rule.mirrorHeightDeductionMM ?? 94;
        formulaDesc = `2.5 Track Sliding: H-${hDed} | W/2-${wDed} | -${mirrorDeductionMM} Glass | 58mm`;
        heightFormulaStr = `H - ${hDed} = ${convertedHeightMM} - ${hDed} = ${panelHeightMM} mm`;
        widthFormulaStr = `(W / 2) - ${wDed} = (${convertedWidthMM} / 2) - ${wDed} = ${panelWidthMM} mm`;
        shutterType = 'uPVC Sliding Glass Sash';
      } else if (input.frameType === '3.5-track' || input.frameType === '3-track') {
        const hDed = rule.heightDeductionMM ?? 91;
        const wDed = rule.widthDeductionMM ?? 11;
        panelHeightMM = Math.max(10, convertedHeightMM - hDed);
        panelWidthMM = Math.max(10, Math.round((convertedWidthMM / 3) - wDed));
        panelCount = 3;
        mirrorDeductionMM = rule.mirrorHeightDeductionMM ?? 94;
        formulaDesc = `3 Track Sliding: H-${hDed} | W/3-${wDed} | -${mirrorDeductionMM} Glass | 58mm`;
        heightFormulaStr = `H - ${hDed} = ${convertedHeightMM} - ${hDed} = ${panelHeightMM} mm`;
        widthFormulaStr = `(W / 3) - ${wDed} = (${convertedWidthMM} / 3) - ${wDed} = ${panelWidthMM} mm`;
        shutterType = 'uPVC Sliding Glass Sash';
      } else {
        // Default: 2-track sliding (Audited standard: H-94, W/2-12)
        const hDed = rule.heightDeductionMM ?? 94;
        const wDed = rule.widthDeductionMM ?? 12;
        panelHeightMM = Math.max(10, convertedHeightMM - hDed);
        panelWidthMM = Math.max(10, Math.round((convertedWidthMM / 2) - wDed));
        panelCount = 2;
        mirrorDeductionMM = rule.mirrorHeightDeductionMM ?? 94;
        formulaDesc = `2 Track Sliding: H-${hDed} | W/2-${wDed} | -${mirrorDeductionMM} Glass | 58mm`;
        heightFormulaStr = `H - ${hDed} = ${convertedHeightMM} - ${hDed} = ${panelHeightMM} mm`;
        widthFormulaStr = `(W / 2) - ${wDed} = (${convertedWidthMM} / 2) - ${wDed} = ${panelWidthMM} mm`;
        shutterType = 'uPVC Sliding Glass Sash';
      }
    }

    if (panelCount > 0) {
      steps.push({
        label: 'Panel (Shutter) Height',
        formula: formulaDesc.split('|')[0].trim() + ' (Legend: H=Height mm)',
        calculation: heightFormulaStr,
        result: `${panelHeightMM} mm`,
        note: 'Deduction provides clearance for top track guide and bottom rollers / frame rebate.'
      });

      steps.push({
        label: 'Panel (Shutter) Width',
        formula: formulaDesc.split('|')[1].trim() + ' (Legend: W=Width mm)',
        calculation: widthFormulaStr,
        result: `${panelWidthMM} mm`,
        note: `${panelCount} Sashes with interlock overlaps and edge clearances.`
      });
    }

    const verticalStyleCutMM = panelCount > 0 ? panelHeightMM + weldingAllowance : 0;
    const topBottomRailCutMM = panelCount > 0 ? panelWidthMM + weldingAllowance : 0;
    const steelCutVerticalMM = panelCount > 0 ? Math.max(10, panelHeightMM - 40) : 0;
    const steelCutHorizontalMM = panelCount > 0 ? Math.max(10, panelWidthMM - 40) : 0;

    // Interlock calculation: Only applies to sliding windows (2-track, 2.5-track, 3-track)
    // Formula: Sash Height mm - 5 mm (panel.heightMM - 5)
    const interlockMM = (isSliding && panelCount > 0) ? Math.max(0, panelHeightMM - 5) : undefined;

    // Central Mullion Cut for open casement windows (Height - 6 mm, customizable: double/triple)
    const mullionMM = (hasCasementMullion && convertedHeightMM > 0)
      ? Math.max(10, convertedHeightMM - mullionDed)
      : undefined;

    const panel: PanelOutput = {
      count: panelCount,
      widthMM: panelWidthMM,
      heightMM: panelHeightMM,
      shutterType,
      cutAngle: '45_degree',
      weldingAllowanceMM: weldingAllowance,
      interlockOverlapMM: rule.overlapMM,
      verticalStyleCutMM,
      topBottomRailCutMM,
      steelCutVerticalMM,
      steelCutHorizontalMM,
      interlockMM
    };

    if (panelCount > 0) {
      steps.push({
        label: 'uPVC Sash Profile Cutting (45° Mitre Welded)',
        formula: weldingAllowance > 0
          ? `Sash Cut = Panel Dimension + Welding Allowance (${weldingAllowance} mm)`
          : 'Sash Cut = Exact Method of Sum Dimension',
        calculation: weldingAllowance > 0
          ? `Vertical Stile: ${panelHeightMM} + ${weldingAllowance} = ${verticalStyleCutMM} mm | Rail: ${panelWidthMM} + ${weldingAllowance} = ${topBottomRailCutMM} mm`
          : `Vertical Stile (Height): ${panelHeightMM} mm (${panelCount * 2} Pcs) | Horizontal Rail (Width): ${panelWidthMM} mm (${panelCount * 2} Pcs)`,
        result: `${topBottomRailCutMM} mm (W) × ${verticalStyleCutMM} mm (H)`,
        note: `45° mitre cut for uPVC sashes (${panelCount * 2} vertical, ${panelCount * 2} horizontal pieces).`
      });
    }

    if (isSliding && interlockMM !== undefined) {
      steps.push({
        label: 'Sliding Interlock Profile Cut',
        formula: 'Sash Height - 5 mm',
        calculation: `${panelHeightMM} - 5 = ${interlockMM} mm`,
        result: `${interlockMM} mm`,
        note: 'Vertical interlock profile cut for sliding window shutter interlocking (2-track, 2.5-track, 3-track).'
      });
    }

    // 5. GI Steel Reinforcement Cuts (90° Straight Cut - Optional)
    const reinforcementSteel: ReinforcementSteelCut[] = [];
    if (input.reinforcementSteel === true) {
      reinforcementSteel.push({
        component: 'Outer Frame Top & Bottom Track Steel',
        count: 2,
        lengthMM: steelCutTopBottomMM,
        cutAngle: '90_degree',
        specification: 'GI Steel Box / U-Section (Frame Cut - 40 mm)'
      });
      reinforcementSteel.push({
        component: 'Outer Frame Left & Right Jamb Steel',
        count: 2,
        lengthMM: steelCutLeftRightMM,
        cutAngle: '90_degree',
        specification: 'GI Steel Box / U-Section (Frame Cut - 40 mm)'
      });
      if (panelCount > 0) {
        reinforcementSteel.push({
          component: 'Sash Vertical Stile Steel',
          count: panelCount * 2,
          lengthMM: steelCutVerticalMM,
          cutAngle: '90_degree',
          specification: 'GI Steel Sash Profile (Sash Height - 40 mm)'
        });
        reinforcementSteel.push({
          component: 'Sash Horizontal Rail Steel',
          count: panelCount * 2,
          lengthMM: steelCutHorizontalMM,
          cutAngle: '90_degree',
          specification: 'GI Steel Sash Profile (Sash Width - 40 mm)'
        });
      }

      steps.push({
        label: 'GI Steel Reinforcement Cuts (90° Straight Cut)',
        formula: 'Profile Cut Length - 40 mm (Corner Weld Clearance)',
        calculation: `Frame Steel: ${steelCutTopBottomMM} mm (W) & ${steelCutLeftRightMM} mm (H)` + (panelCount > 0 ? ` | Sash Steel: ${steelCutHorizontalMM} mm (W) & ${steelCutVerticalMM} mm (H)` : ''),
        result: `${steelCutTopBottomMM} / ${steelCutLeftRightMM}` + (panelCount > 0 ? ` / ${steelCutHorizontalMM} / ${steelCutVerticalMM} mm` : ' mm'),
        note: 'Inserted inside uPVC chambers before corner welding to provide structural wind-load rigidity.'
      });
    }

    // 6. Mirror / Glass & Glass Beading Calculations
    let mirrorWidthMM: number;
    let mirrorHeightMM: number;
    let mirrorNote = '';
    const glassCount = input.windowType === 'fixed' ? 1 : (input.windowType === 'ventilator' ? 0 : panelCount);

    if (input.windowType === 'ventilator') {
      mirrorHeightMM = 0;
      mirrorWidthMM = 0;
      mirrorNote = 'No glass cut required for ventilator frame.';
      steps.push({
        label: 'Ventilator Glazing Schedule',
        formula: 'Ventilator Frame (No Glass Cut)',
        calculation: '0 mm × 0 mm',
        result: '-',
        note: 'No glass cut required per workshop standard.'
      });
    } else if (input.windowType === 'fixed') {
      const fixedGlassDedH = rule.mirrorHeightDeductionMM ?? 96;
      const fixedGlassDedW = rule.mirrorWidthDeductionMM ?? 96;
      mirrorHeightMM = Math.max(10, convertedHeightMM - fixedGlassDedH);
      mirrorWidthMM = Math.max(10, convertedWidthMM - fixedGlassDedW);
      mirrorNote = `Direct outer frame glazing: 1 pane of glass at ${mirrorWidthMM} × ${mirrorHeightMM} mm (OU - ${fixedGlassDedH}mm deduction).`;
      steps.push({
        label: 'Glass Cutting Size (Direct Outer Frame Glazing)',
        formula: `Outer Frame Dimension - ${fixedGlassDedH} mm (Formula: OU - ${fixedGlassDedH})`,
        calculation: `W: ${convertedWidthMM} - ${fixedGlassDedW} = ${mirrorWidthMM} mm | H: ${convertedHeightMM} - ${fixedGlassDedH} = ${mirrorHeightMM} mm`,
        result: `${mirrorWidthMM} × ${mirrorHeightMM} mm`,
        note: 'Direct frame glazing into outer uPVC chamber with glass bead retention.'
      });
    } else if (convertedMirrorMM !== null) {
      // User provided explicit mirror dimension
      mirrorWidthMM = convertedMirrorMM;
      mirrorHeightMM = Math.max(10, panelHeightMM - mirrorDeductionMM);
      mirrorNote = 'Calculated using custom user-specified mirror dimension input.';
      steps.push({
        label: 'Mirror / Glass Dimensions (Manual Input Applied)',
        formula: 'Specified Mirror Input converted to MM',
        calculation: `User input ${input.mirrorInch}" → ${convertedMirrorMM} mm (Width)`,
        result: `${mirrorWidthMM} × ${mirrorHeightMM} mm`,
        note: mirrorNote
      });
    } else {
      mirrorHeightMM = Math.max(10, panelHeightMM - mirrorDeductionMM);
      mirrorWidthMM = Math.max(10, panelWidthMM - mirrorDeductionMM);
      mirrorNote = `Cut ${glassCount} panes of glass at ${mirrorWidthMM} × ${mirrorHeightMM} mm (-${mirrorDeductionMM}mm glass deduction from shutter).`;
      steps.push({
        label: 'Glass Cutting Size (Deduction from Shutter)',
        formula: `Shutter Dimension - ${mirrorDeductionMM} mm (Formula: -${mirrorDeductionMM} glass)`,
        calculation: `W: ${panelWidthMM} - ${mirrorDeductionMM} = ${mirrorWidthMM} mm | H: ${panelHeightMM} - ${mirrorDeductionMM} = ${mirrorHeightMM} mm`,
        result: `${mirrorWidthMM} × ${mirrorHeightMM} mm`,
        note: `Builder deduction: -${mirrorDeductionMM}mm from shutter size for glass rebate and gasket clearance.`
      });
    }

    const totalAreaSqM = Number(((mirrorWidthMM * mirrorHeightMM * glassCount) / 1_000_000).toFixed(2));
    const totalAreaSqFt = Number((totalAreaSqM * 10.7639).toFixed(2));

    const beading: GlassBeadOutput = {
      verticalCutMM: mirrorHeightMM,
      horizontalCutMM: mirrorWidthMM,
      cutAngle: '45_degree',
      totalPcs: glassCount * 4
    };

    const mirror: MirrorOutput = {
      count: glassCount,
      widthMM: mirrorWidthMM,
      heightMM: mirrorHeightMM,
      sqMeters: totalAreaSqM,
      sqFeet: totalAreaSqFt,
      glassType: input.glassType === '6mm_toughened' ? '6mm Toughened' : input.glassType === 'double_glazed' ? '18mm DGU' : '5mm Clear Float',
      beading,
      note: mirrorNote
    };

    // 7. Additional Panels for 2.5 Track (Mosquito Mesh Panel)
    const additionalPanels: PanelOutput[] = [];
    if (input.frameType === '2.5-track') {
      const meshHeightDed = rule.meshHeightDeductionMM ?? 2;
      const meshWidthDed = rule.meshWidthDeductionMM ?? 10;
      const meshH = Math.max(10, panelHeightMM - meshHeightDed);
      const meshW = Math.max(10, Math.round((convertedWidthMM / 2) - meshWidthDed));

      const meshPanel: PanelOutput = {
        count: 1,
        widthMM: meshW,
        heightMM: meshH,
        shutterType: 'Mosquito Mesh Shutter (SS 304)',
        cutAngle: '45_degree',
        weldingAllowanceMM: weldingAllowance,
        interlockOverlapMM: 0,
        verticalStyleCutMM: meshH + weldingAllowance,
        topBottomRailCutMM: meshW + weldingAllowance,
        steelCutVerticalMM: Math.max(10, meshH - 40),
        steelCutHorizontalMM: Math.max(10, meshW - 40)
      };
      additionalPanels.push(meshPanel);

      steps.push({
        label: '2.5 Track Mosquito Mesh Shutter',
        formula: `Mesh Panel Width = (W / 2) - ${meshWidthDed} mm, Height = Shutter Height - ${meshHeightDed} mm`,
        calculation: `W: (${convertedWidthMM} / 2) - ${meshWidthDed} = ${meshW} mm | H: ${panelHeightMM} - ${meshHeightDed} = ${meshH} mm (1 Shutter)`,
        result: `${meshW} × ${meshH} mm`,
        note: 'High-durability stainless steel 304 insect barrier screen with nylon track rollers.'
      });
    }

    return {
      id: `calc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      input,
      convertedWidthMM,
      convertedHeightMM,
      convertedMirrorMM,
      ruleVersion: 'v2.0-upvc',
      ruleProfileName: rule.name,
      frame,
      panel,
      mirror,
      interlockMM,
      mullionMM,
      reinforcementSteel: reinforcementSteel.length > 0 ? reinforcementSteel : undefined,
      reinforcements: reinforcementSteel.length > 0 ? reinforcementSteel : undefined,
      glassBeads: mirror.beading,
      additionalPanels: additionalPanels.length > 0 ? additionalPanels : undefined,
      steps,
      notes: [
        'uPVC fabrication calculation with 45° mitre corner welding burn-off allowance.',
        'Display values rounded to nearest 1 mm per Indian uPVC Window Fabrication Standard.'
      ]
    };
  }
}
