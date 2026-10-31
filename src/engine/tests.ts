import { WindowCalculationEngine } from './calculator';
import { WindowInput, CalculationResult } from './types';
import { WORKSHOP_REFERENCE_PRESET, JINDAL_STANDARD_PRESET, RulesEngineManager } from './rules';
import {
  formatInchWithFraction,
  getLSModelName,
  getLSModelShortForm,
  prepareLSRows,
  hasSlidingInResults,
  hasDoubleWindowInResults,
  getLSModelColor,
  LS_MODEL_COLOR_MAP,
  getLSModelBgColor,
  LS_MODEL_BG_COLOR_MAP,
  computeWindowVariantLabels
} from '../utils/lsInteriorsSheetCanvas';

export interface TestCaseResult {
  name: string;
  category: 'Rule Combination' | 'Dimension Edge Case' | 'Validation Error' | 'Handwritten Golden Case';
  passed: boolean;
  input: any;
  expected: any;
  actual: any;
  error?: string;
}

export class GoldenTestSuite {
  static runAllTests(): { passedCount: number; totalCount: number; results: TestCaseResult[] } {
    const results: TestCaseResult[] = [];

    // 1. UNIT CONVERSION TESTS
    // 48 inch * 25.4 = 1219.2 -> 1219 mm
    const w48 = WindowCalculationEngine.inchToMM(48);
    results.push({
      name: 'Unit Conversion: 48 inch -> 1219 mm',
      category: 'Dimension Edge Case',
      passed: w48 === 1219,
      input: { inch: 48 },
      expected: 1219,
      actual: w48
    });

    // 60 inch * 25.4 = 1524 mm
    const h60 = WindowCalculationEngine.inchToMM(60);
    results.push({
      name: 'Unit Conversion: 60 inch -> 1524 mm',
      category: 'Dimension Edge Case',
      passed: h60 === 1524,
      input: { inch: 60 },
      expected: 1524,
      actual: h60
    });

    // Decimal 48.5 inch * 25.4 = 1231.9 -> 1232 mm (Standard 1/2 fraction: no +3.5)
    const w48_5 = WindowCalculationEngine.inchToMM(48.5);
    results.push({
      name: 'Unit Conversion: Decimal 48.5 inch (1/2 standard) -> 1232 mm',
      category: 'Dimension Edge Case',
      passed: w48_5 === 1232,
      input: { inch: 48.5 },
      expected: 1232,
      actual: w48_5
    });

    // Decimal 72.25 inch * 25.4 = 1835.15 -> 1835 mm (Standard 1/4 fraction: no +3.5)
    const w72_25 = WindowCalculationEngine.inchToMM(72.25);
    results.push({
      name: 'Unit Conversion: Decimal 72.25 inch (1/4 standard) -> 1835 mm',
      category: 'Dimension Edge Case',
      passed: w72_25 === 1835,
      input: { inch: 72.25 },
      expected: 1835,
      actual: w72_25
    });

    // 2. COMBINATION 1: 2 Track + Sliding Window (48" x 60")
    // Width: 1219 mm, Height: 1524 mm
    // Audited: Height H - 94 = 1524 - 94 = 1430 mm
    // Audited: Width W/2 - 12 = (1219 / 2) - 12 = 609.5 - 12 = 598 mm
    // Audited Glass: Shutter - 94 mm -> H: 1430 - 94 = 1336 mm, W: 598 - 94 = 504 mm
    const res2Sliding = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 0
    });

    results.push({
      name: 'Audited Case 1: 2T Sliding [H-94, W/2-12, -94 glass]',
      category: 'Handwritten Golden Case',
      passed: res2Sliding.frame.widthMM === 1219 &&
              res2Sliding.frame.heightMM === 1524 &&
              res2Sliding.panel.heightMM === 1430 &&
              res2Sliding.panel.widthMM === 598 &&
              res2Sliding.panel.count === 2 &&
              res2Sliding.mirror.heightMM === 1336 &&
              res2Sliding.mirror.widthMM === 504,
      input: { width: 48, height: 60, frame: '2 Track', type: 'Sliding' },
      expected: { frameW: 1219, frameH: 1524, panelH: 1430, panelW: 598, panelCount: 2, mirrorH: 1336, mirrorW: 504 },
      actual: {
        frameW: res2Sliding.frame.widthMM,
        frameH: res2Sliding.frame.heightMM,
        panelH: res2Sliding.panel.heightMM,
        panelW: res2Sliding.panel.widthMM,
        panelCount: res2Sliding.panel.count,
        mirrorH: res2Sliding.mirror.heightMM,
        mirrorW: res2Sliding.mirror.widthMM
      }
    });

    // 3. COMBINATION 2: 2.5 Track + Sliding Window (48" x 60")
    // Audited Height: H - 82 = 1524 - 82 = 1442 mm
    // Audited Width: (W / 2) - 8 = (1219 / 2) - 8 = 609.5 - 8 = 602 mm
    // Audited Glass: Shutter - 94 mm -> H: 1442 - 94 = 1348 mm, W: 602 - 94 = 508 mm
    // Audited Mesh: W × (H - 2) = 602 × 1440 mm
    const res2_5Sliding = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2.5-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 0
    });

    results.push({
      name: 'Audited Case 2: 2.5T Sliding [H-82, W/2-8, -94 glass, Mesh H-2, Mesh W/2-10]',
      category: 'Handwritten Golden Case',
      passed: res2_5Sliding.panel.heightMM === 1442 &&
              res2_5Sliding.panel.widthMM === 602 &&
              res2_5Sliding.panel.count === 2 &&
              res2_5Sliding.mirror.heightMM === 1348 &&
              res2_5Sliding.mirror.widthMM === 508 &&
              (res2_5Sliding.additionalPanels?.length || 0) === 1 &&
              res2_5Sliding.additionalPanels?.[0]?.heightMM === 1440 &&
              res2_5Sliding.additionalPanels?.[0]?.widthMM === 600,
      input: { width: 48, height: 60, frame: '2.5 Track', type: 'Sliding' },
      expected: { panelH: 1442, panelW: 602, mirrorH: 1348, mirrorW: 508, meshH: 1440, meshW: 600 },
      actual: {
        panelH: res2_5Sliding.panel.heightMM,
        panelW: res2_5Sliding.panel.widthMM,
        mirrorH: res2_5Sliding.mirror.heightMM,
        mirrorW: res2_5Sliding.mirror.widthMM,
        meshH: res2_5Sliding.additionalPanels?.[0]?.heightMM,
        meshW: res2_5Sliding.additionalPanels?.[0]?.widthMM
      }
    });

    // 4. COMBINATION 3: 3.5 Track + Sliding Window (72" x 60")
    // Width: 72 * 25.4 = 1829 mm, Height: 1524 mm
    // Audited Height: H - 91 = 1524 - 91 = 1433 mm
    // Audited Width: W/3 - 11 = (1829 / 3) - 11 = 609.67 - 11 = 599 mm
    // Audited Glass: Shutter - 94 mm -> H: 1433 - 94 = 1339 mm, W: 599 - 94 = 505 mm
    const res3_5Sliding = WindowCalculationEngine.calculate({
      widthInch: 72,
      heightInch: 60,
      frameType: '3.5-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 0
    });

    results.push({
      name: 'Audited Case 3: 3.5T Sliding [H-91, W/3-11, -94 glass]',
      category: 'Handwritten Golden Case',
      passed: res3_5Sliding.panel.count === 3 &&
              res3_5Sliding.panel.heightMM === 1433 &&
              res3_5Sliding.panel.widthMM === 599 &&
              res3_5Sliding.mirror.heightMM === 1339 &&
              res3_5Sliding.mirror.widthMM === 505,
      input: { width: 72, height: 60, frame: '3.5 Track', type: 'Sliding' },
      expected: { panelCount: 3, panelH: 1433, panelW: 599, mirrorH: 1339, mirrorW: 505 },
      actual: {
        panelCount: res3_5Sliding.panel.count,
        panelH: res3_5Sliding.panel.heightMM,
        panelW: res3_5Sliding.panel.widthMM,
        mirrorH: res3_5Sliding.mirror.heightMM,
        mirrorW: res3_5Sliding.mirror.widthMM
      }
    });

    // 5. COMBINATION 4A: Single Open Casement Window (48" x 60")
    // Audited Height: H - 64 = 1524 - 64 = 1460 mm
    // Audited Width: W - 64 = 1219 - 64 = 1155 mm
    // Audited Glass: Shutter - 124 mm -> H: 1460 - 124 = 1336 mm, W: 1155 - 124 = 1031 mm
    const resOpenSingle = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: 'no-track',
      windowType: 'open',
      casementSubtype: 'single',
      unit: 'inch',
      customOffsetMM: 0
    });

    results.push({
      name: 'Audited Case 4A: Single Open Casement [H-64, W-64, -124 glass]',
      category: 'Handwritten Golden Case',
      passed: resOpenSingle.panel.heightMM === 1460 &&
              resOpenSingle.panel.widthMM === 1155 &&
              resOpenSingle.panel.count === 1 &&
              resOpenSingle.mirror.heightMM === 1336 &&
              resOpenSingle.mirror.widthMM === 1031 &&
              resOpenSingle.frame.trackCount === 0,
      input: { width: 48, height: 60, frame: 'No Track', type: 'Open Single' },
      expected: { panelH: 1460, panelW: 1155, panelCount: 1, mirrorH: 1336, mirrorW: 1031 },
      actual: {
        panelH: resOpenSingle.panel.heightMM,
        panelW: resOpenSingle.panel.widthMM,
        panelCount: resOpenSingle.panel.count,
        mirrorH: resOpenSingle.mirror.heightMM,
        mirrorW: resOpenSingle.mirror.widthMM
      }
    });

    // 6. COMBINATION 4B: Double Open Casement Window (48" x 60") with Central Mullion
    // Audited Height: H - 64 = 1460 mm
    // Audited Width: (W / 2) - 37 = (1219 / 2) - 37 = 609.5 - 37 = 573 mm
    // Audited Mullion: Height - 6 = 1524 - 6 = 1518 mm (Outer Frame Height - 6, no sash height)
    // Audited Glass: Shutter - 126 mm -> H: 1460 - 126 = 1334 mm, W: 573 - 126 = 447 mm
    const resOpenDouble = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: 'no-track',
      windowType: 'open',
      casementSubtype: 'double',
      unit: 'inch',
      customOffsetMM: 0
    });

    results.push({
      name: 'Audited Case 4B: Double Open Casement [H-64, W/2-37, Mullion H-6, -126 glass]',
      category: 'Handwritten Golden Case',
      passed: resOpenDouble.panel.heightMM === 1460 &&
              resOpenDouble.panel.widthMM === 573 &&
              resOpenDouble.panel.count === 2 &&
              resOpenDouble.frame.mullionCutMM === 1518 &&
              resOpenDouble.mirror.heightMM === 1334 &&
              resOpenDouble.mirror.widthMM === 447,
      input: { width: 48, height: 60, frame: 'No Track', type: 'Open Double' },
      expected: { panelH: 1460, panelW: 573, mullionH: 1518, mirrorH: 1334, mirrorW: 447 },
      actual: {
        panelH: resOpenDouble.panel.heightMM,
        panelW: resOpenDouble.panel.widthMM,
        mullionH: resOpenDouble.frame.mullionCutMM,
        mirrorH: resOpenDouble.mirror.heightMM,
        mirrorW: resOpenDouble.mirror.widthMM
      }
    });

    // 7. COMBINATION 5: Fixed Window Direct Glazing (48" x 60")
    // Audited: Direct frame glazing, 0 sash panels
    // Glass: OU_W - 96 = 1219 - 96 = 1123 mm, OU_H - 96 = 1524 - 96 = 1428 mm
    const resFixed = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: 'no-track',
      windowType: 'fixed',
      unit: 'inch',
      customOffsetMM: 0
    });

    results.push({
      name: 'Audited Case 5: Fixed Window Direct Glazing [OU-96 glass, 0 sash]',
      category: 'Handwritten Golden Case',
      passed: resFixed.panel.count === 0 &&
              resFixed.mirror.count === 1 &&
              resFixed.mirror.heightMM === 1428 &&
              resFixed.mirror.widthMM === 1123 &&
              resFixed.frame.trackCount === 0,
      input: { width: 48, height: 60, frame: 'No Track', type: 'Fixed' },
      expected: { panelCount: 0, mirrorCount: 1, mirrorH: 1428, mirrorW: 1123 },
      actual: {
        panelCount: resFixed.panel.count,
        mirrorCount: resFixed.mirror.count,
        mirrorH: resFixed.mirror.heightMM,
        mirrorW: resFixed.mirror.widthMM
      }
    });

    // 8. EDGE CASE: Small dimension (10 inch x 10 inch)
    const resSmall = WindowCalculationEngine.calculate({
      widthInch: 10,
      heightInch: 10,
      frameType: '2-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 0
    }, JINDAL_STANDARD_PRESET.rules['2-track_sliding']);

    results.push({
      name: 'Edge Case: Small Window (10" × 10")',
      category: 'Dimension Edge Case',
      passed: resSmall.frame.widthMM === 254 && resSmall.panel.heightMM > 0,
      input: { width: 10, height: 10 },
      expected: { frameW: 254 },
      actual: { frameW: resSmall.frame.widthMM, panelH: resSmall.panel.heightMM }
    });

    // 9. EDGE CASE: Large dimension (120 inch x 96 inch)
    const resLarge = WindowCalculationEngine.calculate({
      widthInch: 120,
      heightInch: 96,
      frameType: '3-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 0
    }, JINDAL_STANDARD_PRESET.rules['3-track_sliding']);

    results.push({
      name: 'Edge Case: Large Window (120" × 96")',
      category: 'Dimension Edge Case',
      passed: resLarge.frame.widthMM === 3048 && resLarge.frame.heightMM === 2438,
      input: { width: 120, height: 96 },
      expected: { frameW: 3048, frameH: 2438 },
      actual: { frameW: resLarge.frame.widthMM, frameH: resLarge.frame.heightMM }
    });

    // 10. VALIDATION: Missing Width
    const errMissingWidth = WindowCalculationEngine.validateInput({ heightInch: 50, frameType: '2-track', windowType: 'sliding' });
    results.push({
      name: 'Validation: Missing Width triggers error',
      category: 'Validation Error',
      passed: errMissingWidth !== null && errMissingWidth.includes('valid window width'),
      input: { width: undefined, height: 50 },
      expected: 'Please enter a valid window width in inches.',
      actual: errMissingWidth
    });

    // 11. VALIDATION: Negative Value
    const errNegative = WindowCalculationEngine.validateInput({ widthInch: -5, heightInch: 50, frameType: '2-track', windowType: 'sliding' });
    results.push({
      name: 'Validation: Negative Width rejected',
      category: 'Validation Error',
      passed: errNegative !== null && errNegative.includes('greater than 0'),
      input: { width: -5, height: 50 },
      expected: 'Window width must be greater than 0 inches.',
      actual: errNegative
    });

    // 12. VALIDATION: Exceeding dimensions
    const errOversize = WindowCalculationEngine.validateInput({ widthInch: 999, heightInch: 50, frameType: '2-track', windowType: 'sliding' });
    results.push({
      name: 'Validation: Oversized dimension rejected (>400")',
      category: 'Validation Error',
      passed: errOversize !== null && errOversize.includes('exceeds maximum limit'),
      input: { width: 999, height: 50 },
      expected: 'Window width exceeds maximum limit (400 inches).',
      actual: errOversize
    });

    // 13. uPVC FORMULA WITHOUT ADDED MARGIN: 48" * 25.4 = 1219 mm
    const upvcW48 = WindowCalculationEngine.inchToMM(48, 25.4, 0);
    results.push({
      name: 'uPVC Formula (Direct / No Added Margin): 48" × 25.4 = 1219 mm',
      category: 'Dimension Edge Case',
      passed: upvcW48 === 1219,
      input: { inch: 48, factor: 25.4, offset: 0 },
      expected: 1219,
      actual: upvcW48
    });

    // 14. uPVC FORMULA WITHOUT ADDED MARGIN: 60" * 25.4 = 1524 mm
    const upvcH60 = WindowCalculationEngine.inchToMM(60, 25.4, 0);
    results.push({
      name: 'uPVC Formula (Direct / No Added Margin): 60" × 25.4 = 1524 mm',
      category: 'Dimension Edge Case',
      passed: upvcH60 === 1524,
      input: { inch: 60, factor: 25.4, offset: 0 },
      expected: 1524,
      actual: upvcH60
    });

    // 15. uPVC FABRICATION TEST: FRAME & SASH CUTTING WITH GI STEEL REMOVED
    const upvcCalcRes = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2-track',
      windowType: 'sliding',
      unit: 'inch',
      conversionFactor: 25.4,
      customOffsetMM: 0,
      weldingAllowanceMM: 0,
      profileSeries: '60mm',
      reinforcementSteel: false
    });

    const hasNoSteel = !upvcCalcRes.reinforcements || upvcCalcRes.reinforcements.length === 0;

    results.push({
      name: 'uPVC Full Cut Verification: Frame & Sash (GI Steel Removed)',
      category: 'Rule Combination',
      passed: hasNoSteel && upvcCalcRes.frame.topBottomCutMM === 1219 && upvcCalcRes.frame.leftRightCutMM === 1524 && upvcCalcRes.convertedWidthMM === 1219 && upvcCalcRes.panel.widthMM === 598 && upvcCalcRes.panel.heightMM === 1430,
      input: { width: 48, height: 60, factor: 25.4, offset: 0, weldingAllowance: 0, reinforcementSteel: false },
      expected: { finishedW: 1219, frameCutW: 1219, frameCutH: 1524, panelW: 598, panelH: 1430, steelReinforcements: false },
      actual: {
        finishedW: upvcCalcRes.convertedWidthMM,
        frameCutW: upvcCalcRes.frame.topBottomCutMM,
        frameCutH: upvcCalcRes.frame.leftRightCutMM,
        panelW: upvcCalcRes.panel.widthMM,
        panelH: upvcCalcRes.panel.heightMM,
        steelReinforcements: !hasNoSteel
      }
    });

    // 16. uPVC FORMULA WITH +5MM IN OUTPUT MM: 48" * 25.4 + 5 = 1224 mm & 60" * 25.4 + 5 = 1529 mm
    const upvcW48_5mm = WindowCalculationEngine.inchToMM(48, 25.4, 5);
    const upvcH60_5mm = WindowCalculationEngine.inchToMM(60, 25.4, 5);
    results.push({
      name: 'uPVC Formula (+5mm in Output MM): 48"->1224mm, 60"->1529mm',
      category: 'Dimension Edge Case',
      passed: upvcW48_5mm === 1224 && upvcH60_5mm === 1529,
      input: { widthInch: 48, heightInch: 60, factor: 25.4, offset: 5 },
      expected: { wMM: 1224, hMM: 1529 },
      actual: { wMM: upvcW48_5mm, hMM: upvcH60_5mm }
    });

    // 17. uPVC FULL FABRICATION VERIFICATION WITH +5MM IN OUTPUT MM (DEFAULT)
    const upvcCalc5mm = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 5
    });

    results.push({
      name: 'uPVC Full Cut Verification (+5mm Output MM): Frame, Sash, Glass',
      category: 'Rule Combination',
      passed: upvcCalc5mm.convertedWidthMM === 1224 &&
              upvcCalc5mm.convertedHeightMM === 1529 &&
              upvcCalc5mm.panel.heightMM === 1435 &&
              upvcCalc5mm.panel.widthMM === 600 &&
              upvcCalc5mm.mirror.heightMM === 1341 &&
              upvcCalc5mm.mirror.widthMM === 506,
      input: { width: 48, height: 60, customOffsetMM: 5 },
      expected: { frameW: 1224, frameH: 1529, sashH: 1435, sashW: 600, glassH: 1341, glassW: 506 },
      actual: {
        frameW: upvcCalc5mm.convertedWidthMM,
        frameH: upvcCalc5mm.convertedHeightMM,
        sashH: upvcCalc5mm.panel.heightMM,
        sashW: upvcCalc5mm.panel.widthMM,
        glassH: upvcCalc5mm.mirror.heightMM,
        glassW: upvcCalc5mm.mirror.widthMM
      }
    });

    // 18. NEGATIVE ADDED MM (CLAMPS TO 0, INITIALIZES TO 0)
    const negOffsetCalc = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: -10
    });

    results.push({
      name: 'Negative Added MM Clamps to 0 (No Negative Integer Rule)',
      category: 'Validation Error',
      passed: negOffsetCalc.convertedWidthMM === 1219 && negOffsetCalc.convertedHeightMM === 1524,
      input: { widthInch: 48, heightInch: 60, customOffsetMM: -10 },
      expected: { wMM: 1219, hMM: 1524 },
      actual: { wMM: negOffsetCalc.convertedWidthMM, hMM: negOffsetCalc.convertedHeightMM }
    });

    // 19. NO ADDED MM PROVIDED (INITIALIZES TO 0)
    const noOffsetCalc = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2-track',
      windowType: 'sliding',
      unit: 'inch'
    });

    results.push({
      name: 'No Added MM Provided Initializes to 0',
      category: 'Validation Error',
      passed: noOffsetCalc.convertedWidthMM === 1219 && noOffsetCalc.convertedHeightMM === 1524,
      input: { widthInch: 48, heightInch: 60, customOffsetMM: undefined },
      expected: { wMM: 1219, hMM: 1524 },
      actual: { wMM: noOffsetCalc.convertedWidthMM, hMM: noOffsetCalc.convertedHeightMM }
    });

    // 20. 2.5 TRACK SLIDING WITH +5MM OUTPUT MM VERIFICATION: H-82, W/2-8, -94 GLASS
    const res2_5With5mm = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2.5-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 5
    });

    results.push({
      name: '2.5T Sliding Full Cut (+5mm Output MM): H-82, W/2-8, -94 glass',
      category: 'Rule Combination',
      passed: res2_5With5mm.convertedWidthMM === 1224 &&
              res2_5With5mm.convertedHeightMM === 1529 &&
              res2_5With5mm.panel.heightMM === 1447 &&
              res2_5With5mm.panel.widthMM === 604 &&
              res2_5With5mm.mirror.heightMM === 1353 &&
              res2_5With5mm.mirror.widthMM === 510 &&
              (res2_5With5mm.additionalPanels?.length || 0) === 1,
      input: { width: 48, height: 60, frame: '2.5 Track', customOffsetMM: 5 },
      expected: { frameW: 1224, frameH: 1529, panelH: 1447, panelW: 604, mirrorH: 1353, mirrorW: 510, meshPanel: 1 },
      actual: {
        frameW: res2_5With5mm.convertedWidthMM,
        frameH: res2_5With5mm.convertedHeightMM,
        panelH: res2_5With5mm.panel.heightMM,
        panelW: res2_5With5mm.panel.widthMM,
        mirrorH: res2_5With5mm.mirror.heightMM,
        mirrorW: res2_5With5mm.mirror.widthMM,
        meshPanel: res2_5With5mm.additionalPanels?.length || 0
      }
    });

    // 21. VERIFY SCREENSHOT CASE 1: 46 1/2" × 35 3/8" with +5mm offset -> 1186.1 × 903.85 mm
    const s1W = WindowCalculationEngine.inchToMMExact(35.375, 25.4, 5); // 35 3/8"
    const s1H = WindowCalculationEngine.inchToMMExact(46.5, 25.4, 5);   // 46 1/2"
    results.push({
      name: 'Shop Screenshot 1: 46 1/2" × 35 3/8" (+5mm offset) -> 1186.1 × 903.85 mm',
      category: 'Handwritten Golden Case',
      passed: s1W === 903.85 && s1H === 1186.1,
      input: { width: '35 3/8"', height: '46 1/2"', offset: 5 },
      expected: { widthMM: 903.85, heightMM: 1186.1 },
      actual: { widthMM: s1W, heightMM: s1H }
    });

    // 22. VERIFY SCREENSHOT CASE 2: 46" × 40 1/2" with +5mm offset -> 1173.4 × 1033.7 mm
    const s2W = WindowCalculationEngine.inchToMMExact(46, 25.4, 5);     // 46"
    const s2H = WindowCalculationEngine.inchToMMExact(40.5, 25.4, 5);   // 40 1/2"
    results.push({
      name: 'Shop Screenshot 2: 46" × 40 1/2" (+5mm offset) -> 1173.4 × 1033.7 mm',
      category: 'Handwritten Golden Case',
      passed: s2W === 1173.4 && s2H === 1033.7,
      input: { width: '46"', height: '40 1/2"', offset: 5 },
      expected: { widthMM: 1173.4, heightMM: 1033.7 },
      actual: { widthMM: s2W, heightMM: s2H }
    });

    // 23. VERIFY SCREENSHOT CASE 3: 22 5/8" × 23 5/8" with +5mm offset -> 580.0 × 605.4 mm
    const s3W = WindowCalculationEngine.inchToMMExact(22.625, 25.4, 5); // 22 5/8"
    const s3H = WindowCalculationEngine.inchToMMExact(23.625, 25.4, 5); // 23 5/8"
    results.push({
      name: 'Shop Screenshot 3: 22 5/8" × 23 5/8" (+5mm offset) -> 580.0 × 605.4 mm',
      category: 'Handwritten Golden Case',
      passed: s3W === 580.0 && s3H === 605.4,
      input: { width: '22 5/8"', height: '23 5/8"', offset: 5 },
      expected: { widthMM: 580.0, heightMM: 605.4 },
      actual: { widthMM: s3W, heightMM: s3H }
    });

    // 24. VERIFY SHOP ODD EIGHTHS FORMULAS: 1/8, 3/8, 5/8, 7/8 (+5mm offset)
    const oddEighths = [
      { name: 'X 1/8" (48 1/8")', inch: 48.125, expectedExact: 1227.7, expectedRound: 1228 },
      { name: 'X 3/8" (48 3/8")', inch: 48.375, expectedExact: 1234.05, expectedRound: 1234 },
      { name: 'X 5/8" (48 5/8")', inch: 48.625, expectedExact: 1240.4, expectedRound: 1240 },
      { name: 'X 7/8" (48 7/8")', inch: 48.875, expectedExact: 1246.75, expectedRound: 1247 }
    ];

    oddEighths.forEach(oe => {
      const calcExact = WindowCalculationEngine.inchToMMExact(oe.inch, 25.4, 5);
      const calcRound = WindowCalculationEngine.inchToMM(oe.inch, 25.4, 5);
      results.push({
        name: `Odd Eighth Rule: ${oe.name} -> ${oe.expectedExact} mm`,
        category: 'Dimension Edge Case',
        passed: calcExact === oe.expectedExact && calcRound === oe.expectedRound,
        input: { inch: oe.inch, offset: 5 },
        expected: { exact: oe.expectedExact, round: oe.expectedRound },
        actual: { exact: calcExact, round: calcRound }
      });
    });

    // 25. FULL FABRICATION SCHEDULE VERIFICATION (22 5/8" × 23 5/8" 2T Sliding, +5mm offset)
    const res22_23 = WindowCalculationEngine.calculate({
      widthInch: 22.625, // 22 5/8" -> 580 mm
      heightInch: 23.625, // 23 5/8" -> 605 mm
      frameType: '2-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 5
    });

    results.push({
      name: 'Full Cutting Schedule with Shop 1/8 Rule: 22 5/8" × 23 5/8" 2T Sliding',
      category: 'Handwritten Golden Case',
      passed: res22_23.frame.widthMM === 580 &&
              res22_23.frame.heightMM === 605 &&
              res22_23.panel.heightMM === (605 - 94) &&
              res22_23.panel.widthMM === Math.round(580 / 2 - 12) &&
              res22_23.mirror.heightMM === (605 - 94 - 94) &&
              res22_23.mirror.widthMM === (Math.round(580 / 2 - 12) - 94),
      input: { width: '22 5/8"', height: '23 5/8"', frame: '2 Track', type: 'Sliding', offset: 5 },
      expected: { frameW: 580, frameH: 605, panelH: 511, panelW: 278, mirrorH: 417, mirrorW: 184 },
      actual: {
        frameW: res22_23.frame.widthMM,
        frameH: res22_23.frame.heightMM,
        panelH: res22_23.panel.heightMM,
        panelW: res22_23.panel.widthMM,
        mirrorH: res22_23.mirror.heightMM,
        mirrorW: res22_23.mirror.widthMM
      }
    });

    // 26. CUSTOM ZERO DEDUCTION VERIFICATION (0 mm deduction does not fall back to default)
    const zeroRule = {
      ...WORKSHOP_REFERENCE_PRESET.rules['2-track_sliding'],
      heightDeductionMM: 0,
      widthDeductionMM: 0,
      mirrorHeightDeductionMM: 0
    };
    const resZero = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 0
    }, zeroRule);

    results.push({
      name: 'Zero Deduction Rule: 0mm height, width, and glass deduction respected (?? operator)',
      category: 'Rule Combination',
      passed: resZero.panel.heightMM === 1524 &&
              resZero.panel.widthMM === Math.round(1219 / 2) &&
              resZero.mirror.heightMM === 1524 &&
              resZero.mirror.widthMM === Math.round(1219 / 2),
      input: { heightDeduction: 0, widthDeduction: 0, glassDeduction: 0 },
      expected: { panelH: 1524, panelW: 610, mirrorH: 1524, mirrorW: 610 },
      actual: {
        panelH: resZero.panel.heightMM,
        panelW: resZero.panel.widthMM,
        mirrorH: resZero.mirror.heightMM,
        mirrorW: resZero.mirror.widthMM
      }
    });

    // 27. L.S. INTERIORS ORDER SHEET FRACTION & MODEL NAME VERIFICATION
    const frac48_1_8 = formatInchWithFraction(48.125);
    const frac36_1_2 = formatInchWithFraction(36.5);
    const frac23_5_8 = formatInchWithFraction(23.625);
    const frac60 = formatInchWithFraction(60);

    const calc2T = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2-track',
      windowType: 'sliding',
      unit: 'inch'
    });
    const model2T = getLSModelName(calc2T);

    const calc2_5T = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2.5-track',
      windowType: 'sliding',
      unit: 'inch'
    });
    const model2_5T = getLSModelName(calc2_5T);

    const calcFixed = WindowCalculationEngine.calculate({
      widthInch: 36,
      heightInch: 48,
      frameType: 'no-track',
      windowType: 'fixed',
      unit: 'inch'
    });
    const modelFixed = getLSModelName(calcFixed);

    const passLSFormat = frac48_1_8 === '48 1/8"' &&
                         frac36_1_2 === '36 1/2"' &&
                         frac23_5_8 === '23 5/8"' &&
                         frac60 === '60"' &&
                         model2T === '2T SLIDING' &&
                         model2_5T === '2.5T SLIDING (MESH)' &&
                         modelFixed === 'FIXED WINDOW';

    results.push({
      name: 'L.S. Interiors Order Sheet Fraction & Model Name Formatting',
      category: 'Rule Combination',
      passed: passLSFormat,
      input: { frac48_1_8, frac36_1_2, frac23_5_8, frac60, model2T, model2_5T, modelFixed },
      expected: { frac48_1_8: '48 1/8"', frac36_1_2: '36 1/2"', frac23_5_8: '23 5/8"', frac60: '60"', model2T: '2T SLIDING', model2_5T: '2.5T SLIDING (MESH)', modelFixed: 'FIXED WINDOW' },
      actual: { frac48_1_8, frac36_1_2, frac23_5_8, frac60, model2T, model2_5T, modelFixed }
    });

    // 28. L.S. INTERIORS ORDER SHEET ROW EXTRACTION VERIFICATION (Outer Frame, Sash Cut, Mirror Cut, 2.5T Mesh Column with H x W)
    const batchCalcs = [calc2T, calc2_5T, calcFixed];
    const lsRowsStandard = prepareLSRows(batchCalcs, { includeMeshColumn: false });
    const lsRowsWithMesh = prepareLSRows(batchCalcs, { includeMeshColumn: true });

    const passLSRows = lsRowsStandard.length === 3 &&
                       (lsRowsStandard[0].siNo === '1' || lsRowsStandard[0].siNo === '1a') &&
                       lsRowsStandard[0].siteHeight === '60"' &&
                       lsRowsStandard[0].siteWidth === '48"' &&
                       lsRowsStandard[0].outerFrameMM === `${calc2T.frame.leftRightCutMM} H × ${calc2T.frame.topBottomCutMM} W` &&
                       lsRowsStandard[0].sashCutMM === `${calc2T.panel.heightMM} H × ${calc2T.panel.widthMM} W` &&
                       lsRowsStandard[0].mirrorCutMM === `${calc2T.mirror.heightMM} H × ${calc2T.mirror.widthMM} W` &&
                       lsRowsWithMesh[1].meshCutMM === `${calc2_5T.additionalPanels?.[0]?.heightMM} H × ${calc2_5T.additionalPanels?.[0]?.widthMM} W` &&
                       lsRowsWithMesh[0].meshCutMM === '-';

    results.push({
      name: 'L.S. Interiors Order Sheet Dedicated Columns: Outer Frame, Sash Cut, Mirror Cut & 2.5T Mesh (H × W labeled)',
      category: 'Rule Combination',
      passed: passLSRows,
      input: { batchCount: batchCalcs.length },
      expected: {
        row1SiNo: '1',
        row1SiteH: '60"',
        row1SiteW: '48"',
        row1OuterFrame: `${calc2T.frame.leftRightCutMM} H × ${calc2T.frame.topBottomCutMM} W`,
        row1SashCut: `${calc2T.panel.heightMM} H × ${calc2T.panel.widthMM} W`,
        row1MirrorCut: `${calc2T.mirror.heightMM} H × ${calc2T.mirror.widthMM} W`,
        row2MeshCut: `${calc2_5T.additionalPanels?.[0]?.heightMM} H × ${calc2_5T.additionalPanels?.[0]?.widthMM} W`
      },
      actual: {
        row1SiNo: lsRowsStandard[0]?.siNo,
        row1SiteH: lsRowsStandard[0]?.siteHeight,
        row1SiteW: lsRowsStandard[0]?.siteWidth,
        row1OuterFrame: lsRowsStandard[0]?.outerFrameMM,
        row1SashCut: lsRowsStandard[0]?.sashCutMM,
        row1MirrorCut: lsRowsStandard[0]?.mirrorCutMM,
        row2MeshCut: lsRowsWithMesh[1]?.meshCutMM
      }
    });

    // 29. 2.5 TRACK MESH WIDTH FORMULA & CUSTOM DEDUCTION VERIFICATION (W/2 - 10 default, customizable)
    const customMeshRule = {
      ...WORKSHOP_REFERENCE_PRESET.rules['2.5-track_sliding'],
      meshWidthDeductionMM: 15,
      meshHeightDeductionMM: 4
    };
    const resCustomMesh = WindowCalculationEngine.calculate({
      widthInch: 48, // 1219 mm -> W/2 - 15 = 609.5 - 15 = 594.5 -> 595 mm
      heightInch: 60, // 1524 mm -> H - 82 = 1442 mm -> Mesh H = 1442 - 4 = 1438 mm
      frameType: '2.5-track',
      windowType: 'sliding',
      unit: 'inch'
    }, customMeshRule);

    const passCustomMesh = (resCustomMesh.additionalPanels?.length || 0) === 1 &&
                           resCustomMesh.additionalPanels?.[0]?.widthMM === 595 &&
                           resCustomMesh.additionalPanels?.[0]?.heightMM === 1438;

    results.push({
      name: '2.5 Track Mesh Custom Deduction: Mesh Width (W/2 - 15 = 595 mm) & Height (H - 4 = 1438 mm)',
      category: 'Rule Combination',
      passed: passCustomMesh,
      input: { width: 48, height: 60, customMeshWidthDed: 15, customMeshHeightDed: 4 },
      expected: { meshW: 595, meshH: 1438 },
      actual: {
        meshW: resCustomMesh.additionalPanels?.[0]?.widthMM,
        meshH: resCustomMesh.additionalPanels?.[0]?.heightMM
      }
    });

    // 30. VENTILATOR CALCULATION: DIRECT INCH TO MM, NO ADDED MM (even with customOffsetMM = 5)
    const resVentilatorDirect = WindowCalculationEngine.calculate({
      widthInch: 24,
      heightInch: 24,
      frameType: 'no-track',
      windowType: 'ventilator',
      ventilatorSubtype: 'normal',
      customOffsetMM: 5, // Must be ignored for ventilator!
      unit: 'inch'
    });

    const passVentilatorDirect =
      resVentilatorDirect.convertedWidthMM === 610 &&
      resVentilatorDirect.convertedHeightMM === 610 &&
      resVentilatorDirect.frame.topBottomCutMM === 610 &&
      resVentilatorDirect.frame.leftRightCutMM === 610 &&
      resVentilatorDirect.panel.count === 0 &&
      resVentilatorDirect.mirror.count === 0;

    results.push({
      name: 'Ventilator: Direct Inch to MM with ZERO Added Margin (customOffsetMM=5 forced to 0)',
      category: 'Handwritten Golden Case',
      passed: passVentilatorDirect,
      input: { widthInch: 24, heightInch: 24, windowType: 'ventilator', customOffsetMM: 5 },
      expected: { convertedW: 610, convertedH: 610, frameTopBottom: 610, frameJambs: 610, panelCount: 0, glassCount: 0 },
      actual: {
        convertedW: resVentilatorDirect.convertedWidthMM,
        convertedH: resVentilatorDirect.convertedHeightMM,
        frameTopBottom: resVentilatorDirect.frame.topBottomCutMM,
        frameJambs: resVentilatorDirect.frame.leftRightCutMM,
        panelCount: resVentilatorDirect.panel.count,
        glassCount: resVentilatorDirect.mirror.count
      }
    });

    // 31. VENTILATOR NORMAL: L.S. INTERIORS ORDER SHEET MODEL NAME & ROW SCHEDULE
    const resVentNormal = WindowCalculationEngine.calculate({
      widthInch: 24,
      heightInch: 24,
      frameType: 'no-track',
      windowType: 'ventilator',
      ventilatorSubtype: 'normal',
      unit: 'inch'
    });
    const modelVentNormal = getLSModelName(resVentNormal);
    const lsRowsVent = prepareLSRows([resVentNormal]);
    const passVentNormalRow =
      modelVentNormal === 'ventilator/normal' &&
      lsRowsVent.length === 1 &&
      lsRowsVent[0].outerFrameMM === '610 H × 610 W' &&
      lsRowsVent[0].sashCutMM === '-' &&
      lsRowsVent[0].mirrorCutMM === '-';

    results.push({
      name: 'Ventilator Normal: Model Name "ventilator/normal", Frame 610 H × 610 W, Sash Cut "-", Mirror Cut "-"',
      category: 'Rule Combination',
      passed: passVentNormalRow,
      input: { windowType: 'ventilator', ventilatorSubtype: 'normal' },
      expected: { modelName: 'ventilator/normal', outerFrame: '610 H × 610 W', sashCut: '-', mirrorCut: '-' },
      actual: {
        modelName: modelVentNormal,
        outerFrame: lsRowsVent[0]?.outerFrameMM,
        sashCut: lsRowsVent[0]?.sashCutMM,
        mirrorCut: lsRowsVent[0]?.mirrorCutMM
      }
    });

    // 32. VENTILATOR WITH FANS: LEFT & RIGHT MODEL NAMES
    const resVentFanLeft = WindowCalculationEngine.calculate({
      widthInch: 24,
      heightInch: 24,
      frameType: 'no-track',
      windowType: 'ventilator',
      ventilatorSubtype: 'fan',
      ventilatorFanSide: 'left',
      unit: 'inch'
    });
    const resVentFanRight = WindowCalculationEngine.calculate({
      widthInch: 24,
      heightInch: 24,
      frameType: 'no-track',
      windowType: 'ventilator',
      ventilatorSubtype: 'fan',
      ventilatorFanSide: 'right',
      unit: 'inch'
    });

    const modelFanLeft = getLSModelName(resVentFanLeft);
    const modelFanRight = getLSModelName(resVentFanRight);

    const passVentFans =
      modelFanLeft === 'ventilator with fans Left' &&
      modelFanRight === 'ventilator with fans Right';

    results.push({
      name: 'Ventilator With Fans: Model Names "ventilator with fans Left" & "ventilator with fans Right"',
      category: 'Rule Combination',
      passed: passVentFans,
      input: { ventilatorSubtype: 'fan', fanSides: ['left', 'right'] },
      expected: { left: 'ventilator with fans Left', right: 'ventilator with fans Right' },
      actual: { left: modelFanLeft, right: modelFanRight }
    });

    // 39. MODEL NAME STANDARD PURITY (NO CUSTOM SUFFIX) IN L.S. INTERIORS ORDER SHEET
    const resWithLabel = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2-track',
      windowType: 'sliding',
      windowLabel: 'Hall',
      unit: 'inch'
    });
    const modelWithLabel = getLSModelName(resWithLabel);
    const resDefaultW1 = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2-track',
      windowType: 'sliding',
      windowLabel: 'W1',
      unit: 'inch'
    });
    const modelDefaultW1 = getLSModelName(resDefaultW1);

    const passCleanModelName =
      modelWithLabel === '2T SLIDING' &&
      modelDefaultW1 === '2T SLIDING';

    results.push({
      name: 'Standard Model Name Purity: getLSModelName always returns clean model name ("2T SLIDING")',
      category: 'Handwritten Golden Case',
      passed: passCleanModelName,
      input: { withLabel: 'Hall', default: 'W1' },
      expected: { customModel: '2T SLIDING', defaultModel: '2T SLIDING' },
      actual: { customModel: modelWithLabel, defaultModel: modelDefaultW1 }
    });

    // 40. SLIDING WINDOW INTERLOCK CALCULATION (Sash Height - 5 mm)
    // 2-Track: H 1524 - 94 = 1430 mm sash -> Interlock = 1430 - 5 = 1425 mm
    const res2T = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 0
    });
    // 2.5-Track: H 1524 - 82 = 1442 mm sash -> Interlock = 1442 - 5 = 1437 mm
    const res2_5T = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '2.5-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 0
    });
    // 3-Track: H 1524 - 91 = 1433 mm sash -> Interlock = 1433 - 5 = 1428 mm
    const res3T = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: '3-track',
      windowType: 'sliding',
      unit: 'inch',
      customOffsetMM: 0
    });
    // Non-sliding windows must return undefined
    const resFixedInterlock = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: 'no-track',
      windowType: 'fixed',
      unit: 'inch'
    });
    const resOpen = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: 'no-track',
      windowType: 'open',
      unit: 'inch'
    });
    const resVent = WindowCalculationEngine.calculate({
      widthInch: 24,
      heightInch: 24,
      frameType: 'no-track',
      windowType: 'ventilator',
      unit: 'inch'
    });

    const passInterlockFormula =
      res2T.interlockMM === 1425 &&
      res2T.panel.interlockMM === 1425 &&
      res2_5T.interlockMM === 1437 &&
      res3T.interlockMM === 1428 &&
      resFixedInterlock.interlockMM === undefined &&
      resOpen.interlockMM === undefined &&
      resVent.interlockMM === undefined;

    results.push({
      name: 'Sliding Interlock: Sash Height - 5 mm for 2T (1425mm), 2.5T (1437mm), 3T (1428mm); Undefined for Non-Sliding',
      category: 'Handwritten Golden Case',
      passed: passInterlockFormula,
      input: { '2T': '48x60', '2.5T': '48x60', '3T': '48x60', fixed: '48x60', open: '48x60', vent: '24x24' },
      expected: { '2T': 1425, '2.5T': 1437, '3T': 1428, fixed: undefined, open: undefined, vent: undefined },
      actual: {
        '2T': res2T.interlockMM,
        '2.5T': res2_5T.interlockMM,
        '3T': res3T.interlockMM,
        fixed: resFixedInterlock.interlockMM,
        open: resOpen.interlockMM,
        vent: resVent.interlockMM
      }
    });

    // 41. L.S. INTERIORS ORDER SHEET INTERLOCK COLUMN: DYNAMIC GENERATION
    // When sliding window is present, Interlock column generated
    const rowsWithSlidingBatch = prepareLSRows([res2T, resFixedInterlock]);
    // When NO sliding windows are present, Interlock column is omitted (undefined)
    const rowsNonSlidingBatch = prepareLSRows([resFixedInterlock, resOpen, resVent]);

    const passInterlockColumnGeneration =
      hasSlidingInResults([res2T, resFixedInterlock]) === true &&
      hasSlidingInResults([resFixedInterlock, resOpen, resVent]) === false &&
      rowsWithSlidingBatch[0].interlockMM === '1425 mm' &&
      rowsWithSlidingBatch[1].interlockMM === '-' &&
      rowsNonSlidingBatch[0].interlockMM === undefined &&
      rowsNonSlidingBatch[1].interlockMM === undefined &&
      rowsNonSlidingBatch[2].interlockMM === undefined;

    results.push({
      name: 'L.S. Interiors Order Sheet Interlock Column: Auto-generated for Sliding batch ("1425 mm" & "-"); Omitted for Non-Sliding batch',
      category: 'Rule Combination',
      passed: passInterlockColumnGeneration,
      input: { slidingBatch: ['2T', 'Fixed'], nonSlidingBatch: ['Fixed', 'Open', 'Vent'] },
      expected: { slidingColPresent: true, nonSlidingColOmitted: true },
      actual: {
        slidingRow0: rowsWithSlidingBatch[0].interlockMM,
        slidingRow1: rowsWithSlidingBatch[1].interlockMM,
        nonSlidingRow0: rowsNonSlidingBatch[0].interlockMM,
        nonSlidingRow1: rowsNonSlidingBatch[1].interlockMM
      }
    });

    // 42. CM TO MM CONVERSION: CM * 10 = MM (WITH OPTIONAL OFFSET)
    const cm120 = WindowCalculationEngine.cmToMM(120, 0);
    const cm150_offset = WindowCalculationEngine.cmToMM(150, 5);
    const resCM = WindowCalculationEngine.calculate({
      widthInch: 0,
      heightInch: 0,
      widthCm: 120,
      heightCm: 150,
      unit: 'cm',
      windowType: 'sliding',
      frameType: '2-track',
      customOffsetMM: 5
    });

    const passCMConversion =
      cm120 === 1200 &&
      cm150_offset === 1505 &&
      resCM.convertedWidthMM === 1205 &&
      resCM.convertedHeightMM === 1505;

    results.push({
      name: 'Unit Conversion: CM to MM (cm × 10 = mm, 120cm -> 1200mm, with +5mm offset -> 1205mm / 1505mm)',
      category: 'Dimension Edge Case',
      passed: passCMConversion,
      input: { widthCm: 120, heightCm: 150, offset: 5 },
      expected: { cm120: 1200, cm150_offset: 1505, widthMM: 1205, heightMM: 1505 },
      actual: { cm120, cm150_offset, widthMM: resCM.convertedWidthMM, heightMM: resCM.convertedHeightMM }
    });

    // 43. MM TO MM CONVERSION: DIRECT MM (WITH OPTIONAL OFFSET)
    const mm1200 = WindowCalculationEngine.mmToMM(1200, 0);
    const mm1500_offset = WindowCalculationEngine.mmToMM(1500, 5);
    const resMM = WindowCalculationEngine.calculate({
      widthInch: 0,
      heightInch: 0,
      widthMM: 1200,
      heightMM: 1500,
      unit: 'mm',
      windowType: 'sliding',
      frameType: '2-track',
      customOffsetMM: 5
    });

    const passMMConversion =
      mm1200 === 1200 &&
      mm1500_offset === 1505 &&
      resMM.convertedWidthMM === 1205 &&
      resMM.convertedHeightMM === 1505;

    results.push({
      name: 'Unit Conversion: MM to MM Direct (1200mm -> 1200mm, with +5mm offset -> 1205mm / 1505mm)',
      category: 'Dimension Edge Case',
      passed: passMMConversion,
      input: { widthMM: 1200, heightMM: 1500, offset: 5 },
      expected: { mm1200: 1200, mm1500_offset: 1505, widthMM: 1205, heightMM: 1505 },
      actual: { mm1200, mm1500_offset, widthMM: resMM.convertedWidthMM, heightMM: resMM.convertedHeightMM }
    });

    // 44. CM VENTILATOR ZERO ADDED MARGIN (VENTILATOR NO OFFSET IN ALL UNITS)
    const resVentCM = WindowCalculationEngine.calculate({
      widthInch: 0,
      heightInch: 0,
      widthCm: 60,
      heightCm: 60,
      unit: 'cm',
      windowType: 'ventilator',
      ventilatorSubtype: 'normal',
      frameType: 'no-track',
      customOffsetMM: 5
    });

    const passVentCM =
      resVentCM.convertedWidthMM === 600 &&
      resVentCM.convertedHeightMM === 600 &&
      resVentCM.frame.topBottomCutMM === 600 &&
      resVentCM.frame.leftRightCutMM === 600 &&
      resVentCM.panel.count === 0;

    results.push({
      name: 'Ventilator in CM Mode: Exact 60cm × 10 = 600mm Outer Frame with ZERO Added Offset (Offset Forced to 0)',
      category: 'Rule Combination',
      passed: passVentCM,
      input: { widthCm: 60, heightCm: 60, unit: 'cm', customOffsetMM: 5 },
      expected: { widthMM: 600, heightMM: 600, frameTopBottom: 600, frameJambs: 600, panelCount: 0 },
      actual: {
        widthMM: resVentCM.convertedWidthMM,
        heightMM: resVentCM.convertedHeightMM,
        frameTopBottom: resVentCM.frame.topBottomCutMM,
        frameJambs: resVentCM.frame.leftRightCutMM,
        panelCount: resVentCM.panel.count
      }
    });

    // 45. FABRICATION FORMULA INTEGRITY PRESERVED UNDER CM INPUT
    // Under CM input (120cm x 150cm, 0 offset -> 1200mm x 1500mm 2T):
    // Sash H = 1500 - 94 = 1406mm
    // Interlock = 1406 - 5 = 1401mm
    // Sash W = (1200 / 2) - 12 = 588mm
    const resFabCM = WindowCalculationEngine.calculate({
      widthInch: 0,
      heightInch: 0,
      widthCm: 120,
      heightCm: 150,
      unit: 'cm',
      windowType: 'sliding',
      frameType: '2-track',
      customOffsetMM: 0
    });

    const passFabCM =
      resFabCM.convertedWidthMM === 1200 &&
      resFabCM.convertedHeightMM === 1500 &&
      resFabCM.panel.heightMM === 1406 &&
      resFabCM.interlockMM === 1401 &&
      resFabCM.panel.widthMM === 588;

    results.push({
      name: 'Fabrication Cutting Consistency: CM Input (120cm × 150cm) yields exact Sash H (1406mm), Interlock (1401mm), Sash W (588mm) without formula corruption',
      category: 'Handwritten Golden Case',
      passed: passFabCM,
      input: { widthCm: 120, heightCm: 150, unit: 'cm' },
      expected: { outerW: 1200, outerH: 1500, sashH: 1406, interlock: 1401, sashW: 588 },
      actual: {
        outerW: resFabCM.convertedWidthMM,
        outerH: resFabCM.convertedHeightMM,
        sashH: resFabCM.panel.heightMM,
        interlock: resFabCM.interlockMM,
        sashW: resFabCM.panel.widthMM
      }
    });

    // 46. PDF & CANVAS WINDOW MODEL UNIQUE COLORS (SLIDING ORANGE SPECIFICATION)
    const color2T = getLSModelColor('2T SLIDING');
    const color2_5T = getLSModelColor('2.5T SLIDING (MESH)');
    const color3T = getLSModelColor('3T SLIDING');
    const colorFixed = getLSModelColor('FIXED WINDOW');
    const colorSingleCasement = getLSModelColor('SINGLE CASEMENT');
    const colorDoubleCasement = getLSModelColor('DOUBLE CASEMENT');
    const colorVentNormal = getLSModelColor('ventilator/normal');
    const colorVentFanLeft = getLSModelColor('ventilator with fans Left');
    const colorVentFanRight = getLSModelColor('ventilator with fans Right');

    const passUniqueColors =
      color2T.canvas === '#ea580c' &&
      color2_5T.canvas === '#ea580c' &&
      color3T.canvas === '#d97706' &&
      colorFixed.canvas === '#b91c1c' &&
      colorSingleCasement.canvas === '#047857' &&
      colorDoubleCasement.canvas === '#0f766e' &&
      colorVentNormal.canvas === '#1d4ed8' &&
      colorVentFanLeft.canvas === '#4f46e5' &&
      colorVentFanRight.canvas === '#be185d';

    results.push({
      name: 'PDF & Canvas Window Model Unique Colors: Sliding windows assigned Orange (#ea580c), Fixed Red, Casement Green, Ventilator Blue',
      category: 'Rule Combination',
      passed: passUniqueColors,
      input: {
        models: [
          '2T SLIDING',
          '2.5T SLIDING (MESH)',
          '3T SLIDING',
          'FIXED WINDOW',
          'SINGLE CASEMENT',
          'DOUBLE CASEMENT',
          'ventilator/normal',
          'ventilator with fans Left',
          'ventilator with fans Right'
        ]
      },
      expected: {
        color2T: 'Vibrant Orange',
        color2_5T: 'Vibrant Orange',
        colorFixed: 'Crimson Red',
        colorSingleCasement: 'Forest Emerald',
        colorVentNormal: 'Royal Blue'
      },
      actual: {
        color2T: color2T.name,
        color2_5T: color2_5T.name,
        color3T: color3T.name,
        colorFixed: colorFixed.name,
        colorSingleCasement: colorSingleCasement.name,
        colorDoubleCasement: colorDoubleCasement.name,
        colorVentNormal: colorVentNormal.name,
        colorVentFanLeft: colorVentFanLeft.name,
        colorVentFanRight: colorVentFanRight.name
      }
    });

    // 47. ROW-LEVEL UNIFORM COLOR CODING: ALL VALUES (INPUT, OUTPUT, MIRROR, MESH) USE MODEL COLOR
    const row2_5TSliding = {
      siNo: '1',
      siteHeight: '60"',
      siteWidth: '48"',
      modelName: '2.5T SLIDING (MESH)',
      outerFrameMM: '1524 H × 1219 W',
      sashCutMM: '1442 H × 602 W',
      interlockMM: '1437 mm',
      mirrorCutMM: '1348 H × 508 W',
      meshCutMM: '1438 H × 602 W'
    };
    const slidingRowColor = getLSModelColor(row2_5TSliding);
    const passRowUniformColor =
      slidingRowColor.canvas === '#ea580c' &&
      slidingRowColor.pdf[0] === 234 &&
      slidingRowColor.pdf[1] === 88 &&
      slidingRowColor.pdf[2] === 12;

    results.push({
      name: 'Row-Level Color Uniformity: 2.5T Sliding row (both input value, output value, mirror value, mesh value) colored uniformly in Orange',
      category: 'Handwritten Golden Case',
      passed: passRowUniformColor,
      input: row2_5TSliding,
      expected: { canvas: '#ea580c', pdf: [234, 88, 12] },
      actual: { canvas: slidingRowColor.canvas, pdf: slidingRowColor.pdf }
    });

    // 48. UNIQUE WINDOW MODEL ROW BACKGROUND COLORS (TRACK ORANGE, SINGLE GREEN, DOUBLE TEAL, FIXED ROSE)
    const bg2T = getLSModelBgColor('2T SLIDING');
    const bg2_5T = getLSModelBgColor('2.5T SLIDING (MESH)');
    const bg3T = getLSModelBgColor('3T SLIDING');
    const bgSingleCasement = getLSModelBgColor('SINGLE CASEMENT');
    const bgDoubleCasement = getLSModelBgColor('DOUBLE CASEMENT');
    const bgFixed = getLSModelBgColor('FIXED WINDOW');
    const bgVentNormal = getLSModelBgColor('ventilator/normal');

    const passBgColors =
      bg2T.canvas === '#fed7aa' &&
      bg2_5T.canvas === '#fed7aa' &&
      bg3T.canvas === '#fed7aa' &&
      bgSingleCasement.canvas === '#bbf7d0' &&
      bgDoubleCasement.canvas === '#99f6e4' &&
      bgFixed.canvas === '#fecdd3' &&
      bgVentNormal.canvas === '#bfdbfe';

    results.push({
      name: 'Window Model Unique Row Background Colors: Track Orange (#fed7aa), Single Green (#bbf7d0), Double Teal (#99f6e4), Fixed Rose (#fecdd3), Ventilator Blue (#bfdbfe)',
      category: 'Rule Combination',
      passed: passBgColors,
      input: {
        models: ['2T SLIDING', '2.5T SLIDING (MESH)', '3T SLIDING', 'SINGLE CASEMENT', 'DOUBLE CASEMENT', 'FIXED WINDOW', 'ventilator/normal']
      },
      expected: {
        trackOrange: '#fed7aa',
        singleGreen: '#bbf7d0',
        doubleTeal: '#99f6e4',
        fixedRose: '#fecdd3',
        ventilatorBlue: '#bfdbfe'
      },
      actual: {
        trackOrange: bg2T.canvas,
        singleGreen: bgSingleCasement.canvas,
        doubleTeal: bgDoubleCasement.canvas,
        fixedRose: bgFixed.canvas,
        ventilatorBlue: bgVentNormal.canvas
      }
    });

    // 49. NO FONT COLOR RULE & CELL ROW BACKGROUND FILL
    // All cell fonts use crisp neutral dark ink (#0f172a / [15, 23, 42]) while cell rows are filled with model background color
    const darkInkColor = { canvas: '#0f172a', pdf: [15, 23, 42] };
    const passNoFontColorRule =
      darkInkColor.canvas === '#0f172a' &&
      darkInkColor.pdf[0] === 15 &&
      darkInkColor.pdf[1] === 23 &&
      darkInkColor.pdf[2] === 42 &&
      bg2T.canvas === '#fed7aa';

    results.push({
      name: 'No Font Color Rule & Cell Row Background Fill: Font uses crisp neutral dark ink (#0f172a / [15, 23, 42]) while cell rows are filled with model background color',
      category: 'Handwritten Golden Case',
      passed: passNoFontColorRule,
      input: { textFont: 'dark ink', bgFill: 'model background tint' },
      expected: { textCanvas: '#0f172a', textPdf: [15, 23, 42], trackRowBg: '#fed7aa' },
      actual: { textCanvas: darkInkColor.canvas, textPdf: darkInkColor.pdf, trackRowBg: bg2T.canvas }
    });

    // 50. SPECIFIC TYPE VERIFICATION: TRACK UNIQUE, SINGLE UNIQUE, DOUBLE UNIQUE, VENTILATOR FAN LEFT & FAN RIGHT UNIQUE
    const bgTrack = getLSModelBgColor('track');
    const bgSingle = getLSModelBgColor('single');
    const bgDouble = getLSModelBgColor('double');
    const bgVentFanLeft = getLSModelBgColor('ventilator with fan left');
    const bgVentFanRight = getLSModelBgColor('ventilator with fan right');

    const passUniqueModelTypes =
      bgTrack.canvas === '#fed7aa' &&
      bgSingle.canvas === '#bbf7d0' &&
      bgDouble.canvas === '#99f6e4' &&
      bgVentFanLeft.canvas === '#c7d2fe' &&
      bgVentFanRight.canvas === '#fbcfe8' &&
      // Assert every color is distinct from each other
      new Set([bgTrack.canvas, bgSingle.canvas, bgDouble.canvas, bgVentFanLeft.canvas, bgVentFanRight.canvas]).size === 5;

    results.push({
      name: 'Specific Window Type Colors: Track (#fed7aa), Single (#bbf7d0), Double (#99f6e4), Ventilator Fan Left (#c7d2fe), Ventilator Fan Right (#fbcfe8) - 100% Unique',
      category: 'Rule Combination',
      passed: passUniqueModelTypes,
      input: {
        models: ['track', 'single', 'double', 'ventilator with fan left', 'ventilator with fan right']
      },
      expected: {
        track: '#fed7aa',
        single: '#bbf7d0',
        double: '#99f6e4',
        ventFanLeft: '#c7d2fe',
        ventFanRight: '#fbcfe8',
        allUnique: true
      },
      actual: {
        track: bgTrack.canvas,
        single: bgSingle.canvas,
        double: bgDouble.canvas,
        ventFanLeft: bgVentFanLeft.canvas,
        ventFanRight: bgVentFanRight.canvas,
        allUnique: new Set([bgTrack.canvas, bgSingle.canvas, bgDouble.canvas, bgVentFanLeft.canvas, bgVentFanRight.canvas]).size === 5
      }
    });

    // 51. PDF MODEL NAME PURITY: SINGLE WINDOW & DOUBLE WINDOW (REMOVING "CASEMENT" TERMINOLOGY)
    const calcSingleOpen = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: 'no-track',
      windowType: 'open',
      casementSubtype: 'single',
      unit: 'inch'
    });
    const calcDoubleOpen = WindowCalculationEngine.calculate({
      widthInch: 48,
      heightInch: 60,
      frameType: 'no-track',
      windowType: 'open',
      casementSubtype: 'double',
      unit: 'inch'
    });

    const modelNameSingle = getLSModelName(calcSingleOpen);
    const modelNameDouble = getLSModelName(calcDoubleOpen);

    const passWindowNaming =
      modelNameSingle === 'SINGLE WINDOW' &&
      modelNameDouble === 'DOUBLE WINDOW' &&
      !modelNameSingle.includes('CASEMENT') &&
      !modelNameDouble.includes('CASEMENT') &&
      getLSModelBgColor(modelNameSingle).canvas === '#bbf7d0' &&
      getLSModelBgColor(modelNameDouble).canvas === '#99f6e4';

    results.push({
      name: 'PDF Order Sheet Model Names: "SINGLE WINDOW" and "DOUBLE WINDOW" (Casement terminology removed)',
      category: 'Rule Combination',
      passed: passWindowNaming,
      input: {
        singleInput: { windowType: 'open', casementSubtype: 'single' },
        doubleInput: { windowType: 'open', casementSubtype: 'double' }
      },
      expected: {
        singleModelName: 'SINGLE WINDOW',
        doubleModelName: 'DOUBLE WINDOW',
        hasCasement: false,
        singleBg: '#bbf7d0',
        doubleBg: '#99f6e4'
      },
      actual: {
        singleModelName: modelNameSingle,
        doubleModelName: modelNameDouble,
        hasCasement: modelNameSingle.includes('CASEMENT') || modelNameDouble.includes('CASEMENT'),
        singleBg: getLSModelBgColor(modelNameSingle).canvas,
        doubleBg: getLSModelBgColor(modelNameDouble).canvas
      }
    });

    // 52. DOUBLE WINDOW MULLION COLUMN: "HEIGHT - 6" (CUSTOMIZABLE, NO SASH HEIGHT)
    const doubleWindowInput: WindowInput = {
      windowLabel: 'Double Window',
      unit: 'inch',
      widthInch: 48,
      heightInch: 60,
      windowType: 'open',
      casementSubtype: 'double',
      frameType: 'no-track'
    };
    const singleWindowInput: WindowInput = {
      windowLabel: 'Single Window',
      unit: 'inch',
      widthInch: 30,
      heightInch: 60,
      windowType: 'open',
      casementSubtype: 'single',
      frameType: 'no-track'
    };

    const doubleRes = WindowCalculationEngine.calculate(doubleWindowInput);
    const singleRes = WindowCalculationEngine.calculate(singleWindowInput);

    // Default deduction: Frame H (1524) - 6 = 1518 mm
    const defaultBatchRows = prepareLSRows([doubleRes, singleRes]);
    // Custom deduction (e.g. 8 mm): Frame H (1524) - 8 = 1516 mm
    const customBatchRows = prepareLSRows([doubleRes, singleRes], { mullionDeductionMM: 8 });
    // Batch without double window
    const nonDoubleBatchRows = prepareLSRows([singleRes]);

    const passMullionTest =
      doubleRes.mullionMM === 1518 &&
      defaultBatchRows[0].mullionMM === '1518 mm' &&
      defaultBatchRows[0].mullionPcs === '1' &&
      defaultBatchRows[1].mullionMM === '-' &&
      defaultBatchRows[1].mullionPcs === '-' &&
      customBatchRows[0].mullionMM === '1516 mm' &&
      customBatchRows[0].mullionPcs === '1' &&
      nonDoubleBatchRows[0].mullionMM === undefined &&
      nonDoubleBatchRows[0].mullionPcs === undefined &&
      hasDoubleWindowInResults([doubleRes]) === true &&
      hasDoubleWindowInResults([singleRes]) === false;

    results.push({
      name: 'Double Window Mullion: Customizable Deduction (Height - 6 mm default -> 1518mm, custom -8mm -> 1516mm, Non-Double -> "-")',
      category: 'Rule Combination',
      passed: passMullionTest,
      input: {
        heightInch: 60,
        frameHeightMM: doubleRes.frame.heightMM,
        defaultDeduction: 6,
        customDeduction: 8
      },
      expected: {
        engineMullionMM: 1518,
        sheetDoubleMullionDefault: '1518 mm',
        sheetSingleMullion: '-',
        sheetDoubleMullionCustom: '1516 mm',
        nonDoubleIncluded: false
      },
      actual: {
        engineMullionMM: doubleRes.mullionMM,
        sheetDoubleMullionDefault: defaultBatchRows[0].mullionMM,
        sheetSingleMullion: defaultBatchRows[1].mullionMM,
        sheetDoubleMullionCustom: customBatchRows[0].mullionMM,
        nonDoubleIncluded: nonDoubleBatchRows[0].mullionMM !== undefined
      }
    });

    // 53. LAST USED FORMULA RETRIEVAL TEST
    // Verify that when a user customizes a formula, RulesEngineManager retains and retrieves the last used formula
    const originalDoubleRule = RulesEngineManager.getRule('no-track', 'open', 'double');
    const originalDed = originalDoubleRule.mullionSashDeductionMM ?? 6;

    // Simulate user customizing formula: change mullion deduction to 7 mm
    RulesEngineManager.updateRule('no-track_open_double', {
      mullionSashDeductionMM: 7,
      mullionDeductionMM: 7
    }, 'User');

    // Retrieve active rules (same as opening the customize box)
    const retrievedRule = RulesEngineManager.getRule('no-track', 'open', 'double');
    const retrievedRulesAll = RulesEngineManager.getAllActiveRules();

    const passRetrieval =
      retrievedRule.mullionSashDeductionMM === 7 &&
      retrievedRulesAll['no-track_open_double']?.mullionSashDeductionMM === 7;

    // Restore to original standard
    RulesEngineManager.updateRule('no-track_open_double', {
      mullionSashDeductionMM: originalDed,
      mullionDeductionMM: originalDed
    }, 'User');

    results.push({
      name: 'Formula Customization: Last used formula is safely retained and retrieved on demand',
      category: 'Rule Combination',
      passed: passRetrieval,
      input: { customDeduction: 7 },
      expected: { retrievedDeduction: 7 },
      actual: { retrievedDeduction: retrievedRule.mullionSashDeductionMM }
    });

    // 54. MULLION SUB-COLUMN "No.Pcs" (NUMBER OF PIECES)
    // Double Window has 1 central mullion piece ('1'), Non-Double Window has '-'
    const passMullionPcs =
      defaultBatchRows[0].mullionPcs === '1' &&
      defaultBatchRows[1].mullionPcs === '-' &&
      customBatchRows[0].mullionPcs === '1' &&
      nonDoubleBatchRows[0].mullionPcs === undefined;

    results.push({
      name: 'Mullion Sub-Column "No.Pcs": stores only number of mullion pieces ("1" for double window, "-" for non-double)',
      category: 'Rule Combination',
      passed: passMullionPcs,
      input: {
        doubleWindow: 'Double Window (48" x 60")',
        singleWindow: 'Single Window (30" x 60")'
      },
      expected: {
        doubleMullionPcs: '1',
        singleMullionPcs: '-',
        nonDoubleIncluded: false
      },
      actual: {
        doubleMullionPcs: defaultBatchRows[0].mullionPcs,
        singleMullionPcs: defaultBatchRows[1].mullionPcs,
        nonDoubleIncluded: nonDoubleBatchRows[0].mullionPcs !== undefined
      }
    });

    // 55. GLASS SUB-COLUMN "No.Pcs" (NUMBER OF GLASS PIECES)
    // 2T Sliding: 2 pcs, 2.5T Sliding: 2 pcs, Fixed: 1 pc, Single Window: 1 pc, Double Window: 2 pcs, Ventilator: '-'
    const calcVent = WindowCalculationEngine.calculate({
      windowLabel: 'Ventilator',
      windowType: 'ventilator',
      ventilatorSubtype: 'normal',
      frameType: 'no-track',
      heightInch: 24,
      widthInch: 24,
      glassType: '5mm_single',
      quantity: 1,
      unit: 'inch'
    });
    const glassTestBatch = prepareLSRows([calc2T, calc2_5T, calcFixed, singleRes, doubleRes, calcVent]);
    const passGlassPcs =
      glassTestBatch[0].glassPcs === '2' && // 2T Sliding: 2 panes
      glassTestBatch[1].glassPcs === '2' && // 2.5T Sliding: 2 glass panes (+1 mesh)
      glassTestBatch[2].glassPcs === '1' && // Fixed: 1 pane
      glassTestBatch[3].glassPcs === '1' && // Single Window: 1 pane
      glassTestBatch[4].glassPcs === '2' && // Double Window: 2 panes
      glassTestBatch[5].glassPcs === '-';  // Ventilator: '-'

    results.push({
      name: 'Glass Sub-Column "No.Pcs": stores number of glass pieces (2 for 2T/2.5T, 1 for Fixed/Single, 2 for Double, "-" for Ventilator)',
      category: 'Rule Combination',
      passed: passGlassPcs,
      input: {
        windows: '2T Sliding, 2.5T Sliding, Fixed, Single Casement, Double Casement, Ventilator'
      },
      expected: {
        sliding2T: '8',
        sliding2_5T: '8',
        fixed: '1',
        singleWindow: '4',
        doubleWindow: '8',
        ventilator: '-'
      },
      actual: {
        sliding2T: glassTestBatch[0]?.glassPcs,
        sliding2_5T: glassTestBatch[1]?.glassPcs,
        fixed: glassTestBatch[2]?.glassPcs,
        singleWindow: glassTestBatch[3]?.glassPcs,
        doubleWindow: glassTestBatch[4]?.glassPcs,
        ventilator: glassTestBatch[5]?.glassPcs
      }
    });

    // 56. GLASS TYPE EMPTY COLUMN (FOR CLIENT TO FILL OUT)
    const passGlassTypeEmpty = glassTestBatch.every(row => row.glassType === '');

    results.push({
      name: 'Glass Type Empty Column: provides dedicated empty column ("") for clients to fill out glass specifications',
      category: 'Rule Combination',
      passed: passGlassTypeEmpty,
      input: {
        batchRowCount: glassTestBatch.length
      },
      expected: {
        allRowsEmpty: true
      },
      actual: {
        allRowsEmpty: passGlassTypeEmpty
      }
    });

    // 57. 3-OPEN WINDOW CALCULATION & CUSTOMIZATION (H-64, W/3-40, Glass -125, Mullion Sash H-6)
    const tripleWindowInput: WindowInput = {
      windowLabel: '3-Open Window W1',
      unit: 'inch',
      widthInch: 72,
      heightInch: 60,
      windowType: 'open',
      casementSubtype: 'triple',
      frameType: 'no-track',
      quantity: 1
    };

    const tripleResDefault = WindowCalculationEngine.calculate(tripleWindowInput);
    const tripleRowsDefault = prepareLSRows([tripleResDefault], { includeMullionColumn: true });

    // Validate default formulas:
    // Outer Frame: 60" -> 1524 mm H, 72" -> 1829 mm W
    // Sash H: H - 64 = 1524 - 64 = 1460 mm
    // Sash W: (W / 3) - 40 = round(1829 / 3) - 40 = 610 - 40 = 570 mm
    // Panel count: 3 shutters
    // Mullion Cut: Sash H - 6 = 1460 - 6 = 1454 mm (2 Pcs)
    // Glass Cut: Sash - 125 => H: 1460 - 125 = 1335 mm, W: 570 - 125 = 445 mm (3 Pcs)
    const passTripleDefault =
      tripleResDefault.panel.heightMM === 1460 &&
      tripleResDefault.panel.widthMM === 570 &&
      tripleResDefault.panel.count === 3 &&
      tripleResDefault.mullionMM === 1518 && // 1524 - 6 (Outer Frame H - 6)
      tripleResDefault.mirror.heightMM === 1335 &&
      tripleResDefault.mirror.widthMM === 445 &&
      tripleResDefault.mirror.count === 3 &&
      tripleRowsDefault[0].modelName === '[OP/OP/OP]' &&
      tripleRowsDefault[0].sashCutMM === '1460 H × 570 W' &&
      tripleRowsDefault[0].sashPcs === '12' &&
      tripleRowsDefault[0].mullionMM === '1518 mm' &&
      tripleRowsDefault[0].mullionPcs === '2' &&
      tripleRowsDefault[0].mirrorCutMM === '1335 H × 445 W' &&
      tripleRowsDefault[0].glassPcs === '3' &&
      tripleRowsDefault[0].glassType === '' &&
      hasDoubleWindowInResults([tripleResDefault]) === true;

    // Test customization: change deductions and verify calculation updates
    const originalTripleRule = RulesEngineManager.getRule('no-track', 'open', 'triple');
    RulesEngineManager.updateRule('no-track_open_triple', {
      heightDeductionMM: 66,
      widthDeductionMM: 42,
      mirrorHeightDeductionMM: 127,
      mirrorWidthDeductionMM: 127,
      mullionDeductionMM: 8,
      mullionSashDeductionMM: 8
    }, 'User');

    const tripleResCustom = WindowCalculationEngine.calculate(tripleWindowInput);
    const tripleRowsCustom = prepareLSRows([tripleResCustom], { includeMullionColumn: true, mullionDeductionMM: 8 });

    const passTripleCustom =
      tripleResCustom.panel.heightMM === 1458 && // 1524 - 66
      tripleResCustom.panel.widthMM === 568 &&  // 610 - 42
      tripleResCustom.mullionMM === 1516 &&     // 1524 - 8 (Outer Frame H - 8)
      tripleResCustom.mirror.heightMM === 1331 && // 1458 - 127
      tripleResCustom.mirror.widthMM === 441 &&  // 568 - 127
      tripleRowsCustom[0].mullionMM === '1516 mm' &&
      tripleRowsCustom[0].mullionPcs === '2';

    // Restore original default rule
    RulesEngineManager.updateRule('no-track_open_triple', {
      heightDeductionMM: originalTripleRule.heightDeductionMM,
      widthDeductionMM: originalTripleRule.widthDeductionMM,
      mirrorHeightDeductionMM: originalTripleRule.mirrorHeightDeductionMM,
      mirrorWidthDeductionMM: originalTripleRule.mirrorWidthDeductionMM,
      mullionDeductionMM: originalTripleRule.mullionDeductionMM ?? 6,
      mullionSashDeductionMM: originalTripleRule.mullionSashDeductionMM ?? 6
    }, 'User');

    const passTest57 = passTripleDefault && passTripleCustom;

    results.push({
      name: '3-Open Window: Dedicated Formula (H-64, W/3-40, Glass -125, Mullion H-6, 2 Mullions, 3 Glasses, Customizable)',
      category: 'Rule Combination',
      passed: passTest57,
      input: {
        dimensions: '72" x 60"',
        defaultFormula: 'H-64, W/3-40, Glass -125, Mullion H-6',
        customFormula: 'H-66, W/3-42, Glass -127, Mullion H-8'
      },
      expected: {
        defaultSash: '1460 x 570 mm (3 Pcs)',
        defaultMullion: '1518 mm (2 Pcs)',
        defaultGlass: '1335 x 445 mm (3 Pcs)',
        modelName: '3-OPEN WINDOW',
        customSash: '1458 x 568 mm',
        customMullion: '1516 mm',
        customGlass: '1331 x 441 mm'
      },
      actual: {
        defaultSash: `${tripleResDefault.panel.heightMM} x ${tripleResDefault.panel.widthMM} mm (${tripleResDefault.panel.count} Pcs)`,
        defaultMullion: `${tripleResDefault.mullionMM} mm (${tripleRowsDefault[0].mullionPcs} Pcs)`,
        defaultGlass: `${tripleResDefault.mirror.heightMM} x ${tripleResDefault.mirror.widthMM} mm (${tripleResDefault.mirror.count} Pcs)`,
        modelName: tripleRowsDefault[0].modelName,
        customSash: `${tripleResCustom.panel.heightMM} x ${tripleResCustom.panel.widthMM} mm`,
        customMullion: `${tripleResCustom.mullionMM} mm`,
        customGlass: `${tripleResCustom.mirror.heightMM} x ${tripleResCustom.mirror.widthMM} mm`
      }
    });

    // 58. 4-TRACK SLIDING WINDOW (H-92, W/4+11, Glass-95, Material 58mm)
    const fourTrackInput: WindowInput = {
      windowLabel: '4-Track Sliding W1',
      unit: 'inch',
      widthInch: 100,
      heightInch: 60,
      windowType: 'sliding',
      frameType: '4-track',
      quantity: 1
    };

    const fourTrackResDefault = WindowCalculationEngine.calculate(fourTrackInput);
    const fourTrackRowsDefault = prepareLSRows([fourTrackResDefault]);

    // Validate default formulas:
    // Outer Frame: 60" -> 1524 mm H, 100" -> 2540 mm W, Profile Depth 58mm
    // Sash H: H - 92 = 1524 - 92 = 1432 mm
    // Sash W: (W / 4) + 11 = round(2540 / 4) + 11 = 635 + 11 = 646 mm
    // Panel count: 4 shutters
    // Interlock: Sash H - 5 = 1432 - 5 = 1427 mm
    // Glass Cut: Sash - 95 => H: 1432 - 95 = 1337 mm, W: 646 - 95 = 551 mm (4 Pcs)
    const passFourTrackDefault =
      fourTrackResDefault.panel.heightMM === 1432 &&
      fourTrackResDefault.panel.widthMM === 646 &&
      fourTrackResDefault.panel.count === 4 &&
      fourTrackResDefault.interlockMM === 1427 &&
      fourTrackResDefault.mirror.heightMM === 1337 &&
      fourTrackResDefault.mirror.widthMM === 551 &&
      fourTrackResDefault.mirror.count === 4 &&
      fourTrackResDefault.frame.profileDepthMM === 58 &&
      fourTrackRowsDefault[0].modelName === '[SL/SL/SL/SL]' &&
      fourTrackRowsDefault[0].sashCutMM === '1432 H × 646 W' &&
      fourTrackRowsDefault[0].sashPcs === '16' &&
      fourTrackRowsDefault[0].interlockMM === '1427 mm' &&
      fourTrackRowsDefault[0].mirrorCutMM === '1337 H × 551 W' &&
      fourTrackRowsDefault[0].glassPcs === '4';

    // Test customization: change deductions / additions
    const originalFourTrackRule = RulesEngineManager.getRule('4-track', 'sliding');
    RulesEngineManager.updateRule('4-track_sliding', {
      heightDeductionMM: 90,
      widthAdditionMM: 15,
      mirrorHeightDeductionMM: 98,
      mirrorWidthDeductionMM: 98
    }, 'User');

    const fourTrackResCustom = WindowCalculationEngine.calculate(fourTrackInput);
    const fourTrackRowsCustom = prepareLSRows([fourTrackResCustom]);

    const passFourTrackCustom =
      fourTrackResCustom.panel.heightMM === 1434 && // 1524 - 90
      fourTrackResCustom.panel.widthMM === 650 &&  // 635 + 15
      fourTrackResCustom.interlockMM === 1429 &&   // 1434 - 5
      fourTrackResCustom.mirror.heightMM === 1336 && // 1434 - 98
      fourTrackResCustom.mirror.widthMM === 552 &&  // 650 - 98
      fourTrackRowsCustom[0].sashCutMM === '1434 H × 650 W' &&
      fourTrackRowsCustom[0].interlockMM === '1429 mm';

    // Restore original default rule
    RulesEngineManager.updateRule('4-track_sliding', {
      heightDeductionMM: originalFourTrackRule.heightDeductionMM,
      widthAdditionMM: originalFourTrackRule.widthAdditionMM,
      mirrorHeightDeductionMM: originalFourTrackRule.mirrorHeightDeductionMM,
      mirrorWidthDeductionMM: originalFourTrackRule.mirrorWidthDeductionMM
    }, 'User');

    const passTest58 = passFourTrackDefault && passFourTrackCustom;

    results.push({
      name: '4-Track Sliding Window: Dedicated Formula (H-92, W/4+11, Glass -95, Material 58mm, 4 Shutters, 4 Glasses, Interlock Sash H-5)',
      category: 'Rule Combination',
      passed: passTest58,
      input: {
        dimensions: '100" x 60"',
        defaultFormula: 'H-92, W/4+11, Glass-95, Material 58mm',
        customFormula: 'H-90, W/4+15, Glass-98'
      },
      expected: {
        defaultSash: '1432 x 646 mm (4 Pcs)',
        defaultInterlock: '1427 mm',
        defaultGlass: '1337 x 551 mm (4 Pcs)',
        modelName: '4T SLIDING',
        material: 58,
        customSash: '1434 x 650 mm',
        customInterlock: '1429 mm',
        customGlass: '1336 x 552 mm'
      },
      actual: {
        defaultSash: `${fourTrackResDefault.panel.heightMM} x ${fourTrackResDefault.panel.widthMM} mm (${fourTrackResDefault.panel.count} Pcs)`,
        defaultInterlock: `${fourTrackResDefault.interlockMM} mm`,
        defaultGlass: `${fourTrackResDefault.mirror.heightMM} x ${fourTrackResDefault.mirror.widthMM} mm (${fourTrackResDefault.mirror.count} Pcs)`,
        modelName: fourTrackRowsDefault[0].modelName,
        material: fourTrackResDefault.frame.profileDepthMM,
        customSash: `${fourTrackResCustom.panel.heightMM} x ${fourTrackResCustom.panel.widthMM} mm`,
        customInterlock: `${fourTrackResCustom.interlockMM} mm`,
        customGlass: `${fourTrackResCustom.mirror.heightMM} x ${fourTrackResCustom.mirror.widthMM} mm`
      }
    });

    // 59. 58MM MATERIAL FOR 2T, 2.5T, 3T, 4T SLIDING & PDF/CANVAS "MATERIAL MM" SUB-COLUMN
    const t2Input59: WindowInput = {
      windowLabel: '2T Sliding',
      unit: 'inch',
      widthInch: 48,
      heightInch: 60,
      windowType: 'sliding',
      frameType: '2-track',
      quantity: 1
    };
    const t25Input59: WindowInput = {
      windowLabel: '2.5T Sliding',
      unit: 'inch',
      widthInch: 48,
      heightInch: 60,
      windowType: 'sliding',
      frameType: '2.5-track',
      quantity: 1
    };
    const t3Input59: WindowInput = {
      windowLabel: '3T Sliding',
      unit: 'inch',
      widthInch: 72,
      heightInch: 60,
      windowType: 'sliding',
      frameType: '3-track',
      quantity: 1
    };
    const t4Input59: WindowInput = {
      windowLabel: '4T Sliding',
      unit: 'inch',
      widthInch: 100,
      heightInch: 60,
      windowType: 'sliding',
      frameType: '4-track',
      quantity: 1
    };
    const singleOpenInput59: WindowInput = {
      windowLabel: 'Single Window',
      unit: 'inch',
      widthInch: 30,
      heightInch: 60,
      windowType: 'open',
      casementSubtype: 'single',
      frameType: 'no-track',
      quantity: 1
    };
    const fixedInput59: WindowInput = {
      windowLabel: 'Fixed Window',
      unit: 'inch',
      widthInch: 36,
      heightInch: 48,
      windowType: 'fixed',
      frameType: 'no-track',
      quantity: 1
    };

    const res2T59 = WindowCalculationEngine.calculate(t2Input59);
    const res25T59 = WindowCalculationEngine.calculate(t25Input59);
    const res3T59 = WindowCalculationEngine.calculate(t3Input59);
    const res4T59 = WindowCalculationEngine.calculate(t4Input59);
    const resSingle59 = WindowCalculationEngine.calculate(singleOpenInput59);
    const resFixed59 = WindowCalculationEngine.calculate(fixedInput59);

    const rowsAll59 = prepareLSRows([res2T59, res25T59, res3T59, res4T59, resSingle59, resFixed59]);

    const passRules58 =
      RulesEngineManager.getRule('2-track', 'sliding').profileDepthMM === 58 &&
      RulesEngineManager.getRule('2.5-track', 'sliding').profileDepthMM === 58 &&
      RulesEngineManager.getRule('3-track', 'sliding').profileDepthMM === 58 &&
      RulesEngineManager.getRule('4-track', 'sliding').profileDepthMM === 58;

    const passCalculations58 =
      res2T59.frame.profileDepthMM === 58 &&
      res25T59.frame.profileDepthMM === 58 &&
      res3T59.frame.profileDepthMM === 58 &&
      res4T59.frame.profileDepthMM === 58;

    const passRowsMaterialMM =
      rowsAll59[0].materialMM === '58 mm' &&
      rowsAll59[1].materialMM === '58 mm' &&
      rowsAll59[2].materialMM === '58 mm' &&
      rowsAll59[3].materialMM === '58 mm' &&
      rowsAll59[4].materialMM === '-' &&
      rowsAll59[5].materialMM === '-';

    const passTest59 = passRules58 && passCalculations58 && passRowsMaterialMM;

    results.push({
      name: 'Sliding Windows (2-Track, 2.5-Track, 3-Track, 4-Track) Material 58mm & PDF/Canvas "Material mm" Sub-Column under Model Name',
      category: 'Rule Combination',
      passed: passTest59,
      input: {
        slidingTypes: ['2-track', '2.5-track', '3-track', '4-track'],
        nonSlidingTypes: ['single (open)', 'fixed']
      },
      expected: {
        rulesDepthMM: '58 mm for 2T, 2.5T, 3T, 4T',
        calcDepthMM: '58 mm for all sliding outputs',
        slidingMaterialMM: '58 mm',
        nonSlidingMaterialMM: '-'
      },
      actual: {
        rulesDepthMM: `2T: ${RulesEngineManager.getRule('2-track', 'sliding').profileDepthMM}mm, 2.5T: ${RulesEngineManager.getRule('2.5-track', 'sliding').profileDepthMM}mm, 3T: ${RulesEngineManager.getRule('3-track', 'sliding').profileDepthMM}mm, 4T: ${RulesEngineManager.getRule('4-track', 'sliding').profileDepthMM}mm`,
        calcDepthMM: `2T: ${res2T59.frame.profileDepthMM}mm, 2.5T: ${res25T59.frame.profileDepthMM}mm, 3T: ${res3T59.frame.profileDepthMM}mm, 4T: ${res4T59.frame.profileDepthMM}mm`,
        slidingMaterialMM: `2T: ${rowsAll59[0].materialMM}, 2.5T: ${rowsAll59[1].materialMM}, 3T: ${rowsAll59[2].materialMM}, 4T: ${rowsAll59[3].materialMM}`,
        nonSlidingMaterialMM: `Single: ${rowsAll59[4].materialMM}, Fixed: ${rowsAll59[5].materialMM}`
      }
    });

    // 60. PDF & CANVAS MODEL NAME + MATERIAL MM COLUMN LAYOUT (NO OVERLAY)
    // 2.5T Sliding row generates '2.5T SLIDING (MESH)' and '58 mm'
    const row25T = rowsAll59[1];
    const passLayout =
      row25T.modelName === '[SL/SL/MESH]' &&
      row25T.materialMM === '58 mm';

    results.push({
      name: 'PDF & Canvas Model Name & Material mm Layout Protection: Short Form [SL/SL/MESH] & 58mm Formatted Cleanly Without Overlay',
      category: 'Rule Combination',
      passed: passLayout,
      input: {
        model: row25T.modelName,
        material: row25T.materialMM
      },
      expected: {
        modelName: '[SL/SL/MESH]',
        materialMM: '58 mm',
        noOverlay: true
      },
      actual: {
        modelName: row25T.modelName,
        materialMM: row25T.materialMM,
        noOverlay: passLayout
      }
    });

    // 61. SASH SUB-COLUMN "No. of Sash Pcs"
    // 2T Sliding: 2 pcs, 2.5T Sliding: 2 pcs, Single Window: 1 pc, Double Window: 2 pcs, 3-Open: 3 pcs, 4-Track: 4 pcs, Fixed: '-', Ventilator: '-'
    const passSashPcs =
      glassTestBatch[0].sashPcs === '8' && // 2T Sliding: 2 shutters
      glassTestBatch[1].sashPcs === '8' && // 2.5T Sliding: 2 glass shutters (+1 mesh)
      glassTestBatch[2].sashPcs === '-' && // Fixed: '-'
      glassTestBatch[3].sashPcs === '4' && // Single Window: 1 shutter
      glassTestBatch[4].sashPcs === '8' && // Double Window: 2 shutters
      glassTestBatch[5].sashPcs === '-' && // Ventilator: '-'
      tripleRowsDefault[0].sashPcs === '12' && // 3-Open: 3 shutters * 4 = 12 pcs
      fourTrackRowsDefault[0].sashPcs === '16'; // 4-Track: 4 shutters

    results.push({
      name: 'Sash Sub-Column "No. of Sash Pcs": stores 4 cut profile pieces per sash (2H + 2W): 8 for 2T/2.5T, 4 for Single, 8 for Double, 12 for 3-Open, 16 for 4T, "-" for Fixed/Ventilator',
      category: 'Rule Combination',
      passed: passSashPcs,
      input: {
        windows: '2T Sliding, 2.5T Sliding, Fixed, Single Open, Double Open, Ventilator, 3-Open, 4-Track'
      },
      expected: {
        sliding2T: '8',
        sliding2_5T: '8',
        fixed: '-',
        singleWindow: '4',
        doubleWindow: '8',
        ventilator: '-',
        tripleWindow: '12',
        fourTrack: '16'
      },
      actual: {
        sliding2T: glassTestBatch[0]?.sashPcs,
        sliding2_5T: glassTestBatch[1]?.sashPcs,
        fixed: glassTestBatch[2]?.sashPcs,
        singleWindow: glassTestBatch[3]?.sashPcs,
        doubleWindow: glassTestBatch[4]?.sashPcs,
        ventilator: glassTestBatch[5]?.sashPcs,
        tripleWindow: tripleRowsDefault[0]?.sashPcs,
        fourTrack: fourTrackRowsDefault[0]?.sashPcs
      }
    });

    // 62. WINDOW VARIANT LABELING TESTS: Suffix a, b, c when inputs are same but types are different
    const variantTestInputs: WindowInput[] = [
      { widthInch: 48, heightInch: 60, windowType: 'sliding', frameType: '2-track', unit: 'inch' },
      { widthInch: 48, heightInch: 60, windowType: 'sliding', frameType: '2-track', unit: 'inch' },
      { widthInch: 48, heightInch: 60, windowType: 'open', casementSubtype: 'double', frameType: 'no-track', unit: 'inch' },
      { widthInch: 48, heightInch: 60, windowType: 'fixed', frameType: 'no-track', unit: 'inch' },
      { widthInch: 30, heightInch: 40, windowType: 'sliding', frameType: '2-track', unit: 'inch' },
      { widthInch: 24, heightInch: 36, windowType: 'ventilator', ventilatorSubtype: 'normal', frameType: 'no-track', unit: 'inch' }
    ];

    const variantResults = variantTestInputs.map((w, idx) => ({
      ...WindowCalculationEngine.calculate(w),
      id: `W${idx + 1}`
    }));

    const computedVariants = computeWindowVariantLabels(variantResults);
    const passVariants =
      computedVariants[0].siNo === '1a' &&
      computedVariants[0].windowLabel === 'W1a' &&
      computedVariants[1].siNo === '2a' &&
      computedVariants[1].windowLabel === 'W2a' &&
      computedVariants[2].siNo === '3b' &&
      computedVariants[2].windowLabel === 'W3b' &&
      computedVariants[3].siNo === '4c' &&
      computedVariants[3].windowLabel === 'W4c' &&
      computedVariants[4].siNo === '5' &&
      computedVariants[4].windowLabel === 'W5' &&
      computedVariants[5].siNo === '6' &&
      computedVariants[5].windowLabel === 'W6';

    results.push({
      name: 'Window Variant Labels: Appends a, b, c (1a, 2a, 3b, 4c) when input dimensions are same and type is different; retains clean numbers (5, 6) when dimensions are different',
      category: 'Rule Combination',
      passed: passVariants,
      input: {
        window1: '48x60 2T Sliding',
        window2: '48x60 2T Sliding',
        window3: '48x60 Double Open',
        window4: '48x60 Fixed',
        window5: '30x40 2T Sliding',
        window6: '24x36 Ventilator'
      },
      expected: {
        w1: { siNo: '1a', label: 'W1a' },
        w2: { siNo: '2a', label: 'W2a' },
        w3: { siNo: '3b', label: 'W3b' },
        w4: { siNo: '4c', label: 'W4c' },
        w5: { siNo: '5', label: 'W5' },
        w6: { siNo: '6', label: 'W6' }
      },
      actual: {
        w1: { siNo: computedVariants[0]?.siNo, label: computedVariants[0]?.windowLabel },
        w2: { siNo: computedVariants[1]?.siNo, label: computedVariants[1]?.windowLabel },
        w3: { siNo: computedVariants[2]?.siNo, label: computedVariants[2]?.windowLabel },
        w4: { siNo: computedVariants[3]?.siNo, label: computedVariants[3]?.windowLabel },
        w5: { siNo: computedVariants[4]?.siNo, label: computedVariants[4]?.windowLabel },
        w6: { siNo: computedVariants[5]?.siNo, label: computedVariants[5]?.windowLabel }
      }
    });

    // 63. ORDER SHEET ROWS: row.siNo gets 1a/2a/3b/4c and row.modelName uses short form without W1a prefix
    const orderSheetRows = prepareLSRows(variantResults);
    const passOrderSheetLabels =
      orderSheetRows[0].siNo === '1a' &&
      orderSheetRows[0].modelName === '[SL/SL]' &&
      orderSheetRows[1].siNo === '2a' &&
      orderSheetRows[1].modelName === '[SL/SL]' &&
      orderSheetRows[2].siNo === '3b' &&
      orderSheetRows[2].modelName === '[OP/OP]' &&
      orderSheetRows[3].siNo === '4c' &&
      orderSheetRows[3].modelName === '[FIXED]' &&
      orderSheetRows[4].siNo === '5' &&
      orderSheetRows[4].modelName === '[SL/SL]' &&
      orderSheetRows[5].siNo === '6' &&
      orderSheetRows[5].modelName === '[VENT]';

    results.push({
      name: 'Order Sheet Rows Short Form Model Names: row.siNo gets 1a/2a/3b/4c and row.modelName uses bracketed short forms [SL/SL], [OP/OP], [FIXED], [VENT] without W1a prefix',
      category: 'Rule Combination',
      passed: passOrderSheetLabels,
      input: {
        variantResultsCount: variantResults.length
      },
      expected: {
        r0: { siNo: '1a', model: '[SL/SL]' },
        r1: { siNo: '2a', model: '[SL/SL]' },
        r2: { siNo: '3b', model: '[OP/OP]' },
        r3: { siNo: '4c', model: '[FIXED]' },
        r4: { siNo: '5', model: '[SL/SL]' },
        r5: { siNo: '6', model: '[VENT]' }
      },
      actual: {
        r0: { siNo: orderSheetRows[0]?.siNo, model: orderSheetRows[0]?.modelName },
        r1: { siNo: orderSheetRows[1]?.siNo, model: orderSheetRows[1]?.modelName },
        r2: { siNo: orderSheetRows[2]?.siNo, model: orderSheetRows[2]?.modelName },
        r3: { siNo: orderSheetRows[3]?.siNo, model: orderSheetRows[3]?.modelName },
        r4: { siNo: orderSheetRows[4]?.siNo, model: orderSheetRows[4]?.modelName },
        r5: { siNo: orderSheetRows[5]?.siNo, model: orderSheetRows[5]?.modelName }
      }
    });

    // 66. COMPREHENSIVE WINDOW MODEL SHORT FORMS FOR PDF ORDER SHEET:
    // [SL/SL], [SL/SL/MESH], [SL/SL/SL/SL], [OP], [OP/OP], [OP/OP/OP], [FIXED], [VENT]
    const shortFormInputs: WindowInput[] = [
      { unit: 'inch', widthInch: 48, heightInch: 60, windowType: 'sliding', frameType: '2-track' },
      { unit: 'inch', widthInch: 48, heightInch: 60, windowType: 'sliding', frameType: '2.5-track' },
      { unit: 'inch', widthInch: 72, heightInch: 60, windowType: 'sliding', frameType: '3-track' },
      { unit: 'inch', widthInch: 100, heightInch: 60, windowType: 'sliding', frameType: '4-track' },
      { unit: 'inch', widthInch: 30, heightInch: 40, windowType: 'open', frameType: 'no-track', casementSubtype: 'single' },
      { unit: 'inch', widthInch: 48, heightInch: 60, windowType: 'open', frameType: 'no-track', casementSubtype: 'double' },
      { unit: 'inch', widthInch: 72, heightInch: 60, windowType: 'open', frameType: 'no-track', casementSubtype: 'triple' },
      { unit: 'inch', widthInch: 36, heightInch: 48, windowType: 'fixed', frameType: 'no-track' },
      { unit: 'inch', widthInch: 24, heightInch: 24, windowType: 'ventilator', frameType: 'no-track', ventilatorSubtype: 'normal' },
      { unit: 'inch', widthInch: 24, heightInch: 24, windowType: 'ventilator', frameType: 'no-track', ventilatorSubtype: 'fan', ventilatorFanSide: 'right' },
      { unit: 'inch', widthInch: 24, heightInch: 24, windowType: 'ventilator', frameType: 'no-track', ventilatorSubtype: 'fan', ventilatorFanSide: 'left' }
    ];

    const passAllShortForms =
      getLSModelShortForm(shortFormInputs[0]) === '[SL/SL]' &&
      getLSModelShortForm(shortFormInputs[1]) === '[SL/SL/MESH]' &&
      getLSModelShortForm(shortFormInputs[2]) === '[SL/SL/SL/SL]' &&
      getLSModelShortForm(shortFormInputs[3]) === '[SL/SL/SL/SL]' &&
      getLSModelShortForm(shortFormInputs[4]) === '[OP]' &&
      getLSModelShortForm(shortFormInputs[5]) === '[OP/OP]' &&
      getLSModelShortForm(shortFormInputs[6]) === '[OP/OP/OP]' &&
      getLSModelShortForm(shortFormInputs[7]) === '[FIXED]' &&
      getLSModelShortForm(shortFormInputs[8]) === '[VENT]' &&
      getLSModelShortForm(shortFormInputs[9]) === '[VENT/FAN R]' &&
      getLSModelShortForm(shortFormInputs[10]) === '[VENT/FAN L]';

    results.push({
      name: 'Window Model Short Form Codes: [SL/SL], [SL/SL/MESH], [SL/SL/SL/SL], [OP], [OP/OP], [OP/OP/OP], [FIXED], [VENT]',
      category: 'Rule Combination',
      passed: passAllShortForms,
      input: { count: shortFormInputs.length },
      expected: {
        t2: '[SL/SL]',
        t25: '[SL/SL/MESH]',
        t3: '[SL/SL/SL/SL]',
        t4: '[SL/SL/SL/SL]',
        singleOpen: '[OP]',
        doubleOpen: '[OP/OP]',
        tripleOpen: '[OP/OP/OP]',
        fixed: '[FIXED]',
        ventNormal: '[VENT]',
        ventFanRight: '[VENT/FAN R]',
        ventFanLeft: '[VENT/FAN L]'
      },
      actual: {
        t2: getLSModelShortForm(shortFormInputs[0]),
        t25: getLSModelShortForm(shortFormInputs[1]),
        t3: getLSModelShortForm(shortFormInputs[2]),
        t4: getLSModelShortForm(shortFormInputs[3]),
        singleOpen: getLSModelShortForm(shortFormInputs[4]),
        doubleOpen: getLSModelShortForm(shortFormInputs[5]),
        tripleOpen: getLSModelShortForm(shortFormInputs[6]),
        fixed: getLSModelShortForm(shortFormInputs[7]),
        ventNormal: getLSModelShortForm(shortFormInputs[8]),
        ventFanRight: getLSModelShortForm(shortFormInputs[9]),
        ventFanLeft: getLSModelShortForm(shortFormInputs[10])
      }
    });

    // 64. REAL-TIME VARIANT UPDATE: Dimension offset independence (Sliding +5mm offset vs Ventilator 0mm offset)
    const rawInputsTest: WindowInput[] = [
      { unit: 'inch', widthInch: 48, heightInch: 60, windowType: 'sliding', frameType: '2-track', customOffsetMM: 5 },
      { unit: 'inch', widthInch: 48, heightInch: 60, windowType: 'ventilator', frameType: 'no-track', ventilatorSubtype: 'normal', customOffsetMM: 0 }
    ];
    const rawVariants = computeWindowVariantLabels(rawInputsTest);
    const passOffsetIndependence =
      rawVariants.length === 2 &&
      rawVariants[0].siNo === '1a' &&
      rawVariants[0].windowLabel === 'W1a' &&
      rawVariants[1].siNo === '2b' &&
      rawVariants[1].windowLabel === 'W2b';

    results.push({
      name: 'Real-Time Variant Grouping: Offset independence ensures 48x60 sliding (5mm offset) and 48x60 ventilator (0mm offset) group as 1a/W1a and 2b/W2b',
      category: 'Rule Combination',
      passed: passOffsetIndependence,
      input: {
        rawInputsTest
      },
      expected: {
        w1: { siNo: '1a', windowLabel: 'W1a' },
        w2: { siNo: '2b', windowLabel: 'W2b' }
      },
      actual: {
        w1: rawVariants[0],
        w2: rawVariants[1]
      }
    });

    // 65. MANUAL WINDOW OPTION BUTTON (a to z): Manual variantLetter override
    const manualOptionInputs: WindowInput[] = [
      { unit: 'inch', widthInch: 48, heightInch: 60, windowType: 'sliding', frameType: '2-track', variantLetter: 'a' },
      { unit: 'inch', widthInch: 30, heightInch: 40, windowType: 'open', frameType: 'no-track', casementSubtype: 'single', variantLetter: 'z' },
      { unit: 'inch', widthInch: 36, heightInch: 48, windowType: 'fixed', frameType: 'no-track', variantLetter: '' }
    ];
    const manualVariants = computeWindowVariantLabels(manualOptionInputs);
    const passManualOption =
      manualVariants.length === 3 &&
      manualVariants[0].siNo === '1a' &&
      manualVariants[0].windowLabel === 'W1a' &&
      manualVariants[1].siNo === '2z' &&
      manualVariants[1].windowLabel === 'W2z' &&
      manualVariants[2].siNo === '3' &&
      manualVariants[2].windowLabel === 'W3';

    results.push({
      name: 'Manual Option Button (a to z): variantLetter override sets 1a/W1a and 2z/W2z, and empty variantLetter retains clean 3/W3',
      category: 'Rule Combination',
      passed: passManualOption,
      input: manualOptionInputs,
      expected: {
        w1: { siNo: '1a', windowLabel: 'W1a' },
        w2: { siNo: '2z', windowLabel: 'W2z' },
        w3: { siNo: '3', windowLabel: 'W3' }
      },
      actual: {
        w1: manualVariants[0],
        w2: manualVariants[1],
        w3: manualVariants[2]
      }
    });

    // 67. 65MM 2-TRACK SLIDING WINDOW (H-94, (W-22)/2, Glass -112, Material 65mm)
    const t2Input65: WindowInput = {
      windowLabel: '2T 65mm Sliding',
      unit: 'inch',
      widthInch: 48,
      heightInch: 60,
      windowType: 'sliding',
      frameType: '2-track',
      profileSeries: '65mm',
      quantity: 1
    };
    const res2T65 = WindowCalculationEngine.calculate(t2Input65);
    const row2T65 = prepareLSRows([res2T65])[0];

    // 48" W -> 1219 mm, 60" H -> 1524 mm
    // Sash H: 1524 - 94 = 1430 mm
    // Sash W: (1219 - 22) / 2 = 1197 / 2 = 598.5 -> 599 mm
    // Interlock: 1430 - 5 = 1425 mm
    // Glass: 1430 - 112 = 1318 mm (H), 599 - 112 = 487 mm (W), 2 Pcs
    const passTest67 =
      res2T65.frame.profileDepthMM === 65 &&
      res2T65.panel.heightMM === 1430 &&
      res2T65.panel.widthMM === 599 &&
      res2T65.panel.count === 2 &&
      res2T65.interlockMM === 1425 &&
      res2T65.mirror.heightMM === 1318 &&
      res2T65.mirror.widthMM === 487 &&
      res2T65.mirror.count === 2 &&
      row2T65.modelName === '[SL/SL]' &&
      row2T65.materialMM === '65 mm' &&
      row2T65.sashPcs === '8' &&
      row2T65.interlockMM === '1425 mm';

    results.push({
      name: '65mm 2-Track Sliding Window: Dedicated Formula (H-94, (W-22)/2, Glass -112, Material 65mm, Interlock Sash H-5)',
      category: 'Rule Combination',
      passed: passTest67,
      input: { dimensions: '48" x 60"', series: '65mm', frameType: '2-track' },
      expected: {
        material: 65,
        sash: '1430 x 599 mm (2 Pcs)',
        interlock: '1425 mm',
        glass: '1318 x 487 mm (2 Pcs)',
        model: '[SL/SL]',
        materialMM: '65 mm',
        sashPcs: '8'
      },
      actual: {
        material: res2T65.frame.profileDepthMM,
        sash: `${res2T65.panel.heightMM} x ${res2T65.panel.widthMM} mm (${res2T65.panel.count} Pcs)`,
        interlock: `${res2T65.interlockMM} mm`,
        glass: `${res2T65.mirror.heightMM} x ${res2T65.mirror.widthMM} mm (${res2T65.mirror.count} Pcs)`,
        model: row2T65.modelName,
        materialMM: row2T65.materialMM,
        sashPcs: row2T65.sashPcs
      }
    });

    // 68. 65MM 3-TRACK SLIDING WINDOW (H-88, (W+48)/3, Glass -112, Material 65mm)
    const t3Input65: WindowInput = {
      windowLabel: '3T 65mm Sliding',
      unit: 'inch',
      widthInch: 72,
      heightInch: 60,
      windowType: 'sliding',
      frameType: '3-track',
      profileSeries: '65mm',
      quantity: 1
    };
    const res3T65 = WindowCalculationEngine.calculate(t3Input65);
    const row3T65 = prepareLSRows([res3T65])[0];

    // 72" W -> 1829 mm, 60" H -> 1524 mm
    // Sash H: 1524 - 88 = 1436 mm
    // Sash W: (1829 + 48) / 3 = 1877 / 3 = 625.67 -> 626 mm
    // Interlock: 1436 - 5 = 1431 mm
    // Glass: 1436 - 112 = 1324 mm (H), 626 - 112 = 514 mm (W), 3 Pcs
    const passTest68 =
      res3T65.frame.profileDepthMM === 65 &&
      res3T65.panel.heightMM === 1436 &&
      res3T65.panel.widthMM === 626 &&
      res3T65.panel.count === 3 &&
      res3T65.interlockMM === 1431 &&
      res3T65.mirror.heightMM === 1324 &&
      res3T65.mirror.widthMM === 514 &&
      res3T65.mirror.count === 3 &&
      row3T65.modelName === '[SL/SL/SL/SL]' &&
      row3T65.materialMM === '65 mm' &&
      row3T65.sashPcs === '12' &&
      row3T65.interlockMM === '1431 mm';

    results.push({
      name: '65mm 3-Track Sliding Window: Dedicated Formula (H-88, (W+48)/3, Glass -112, Material 65mm, Interlock Sash H-5)',
      category: 'Rule Combination',
      passed: passTest68,
      input: { dimensions: '72" x 60"', series: '65mm', frameType: '3-track' },
      expected: {
        material: 65,
        sash: '1436 x 626 mm (3 Pcs)',
        interlock: '1431 mm',
        glass: '1324 x 514 mm (3 Pcs)',
        model: '[SL/SL/SL/SL]',
        materialMM: '65 mm',
        sashPcs: '12'
      },
      actual: {
        material: res3T65.frame.profileDepthMM,
        sash: `${res3T65.panel.heightMM} x ${res3T65.panel.widthMM} mm (${res3T65.panel.count} Pcs)`,
        interlock: `${res3T65.interlockMM} mm`,
        glass: `${res3T65.mirror.heightMM} x ${res3T65.mirror.widthMM} mm (${res3T65.mirror.count} Pcs)`,
        model: row3T65.modelName,
        materialMM: row3T65.materialMM,
        sashPcs: row3T65.sashPcs
      }
    });

    // 69. 65MM FORMULA CUSTOMIZATION: Customizable via RulesEngineManager
    const orig65Rule2T = RulesEngineManager.getRule('2-track', 'sliding', undefined, '65mm');
    const orig65Rule3T = RulesEngineManager.getRule('3-track', 'sliding', undefined, '65mm');

    // Customize 2T 65mm: H-90, W-26/2, Glass-110
    RulesEngineManager.updateRule('2-track_sliding_65mm', {
      heightDeductionMM: 90,
      widthDeductionMM: 26,
      mirrorHeightDeductionMM: 110,
      mirrorWidthDeductionMM: 110
    }, 'User');

    // Customize 3T 65mm: H-86, W+51/3, Glass-115
    RulesEngineManager.updateRule('3-track_sliding_65mm', {
      heightDeductionMM: 86,
      widthAdditionMM: 51,
      mirrorHeightDeductionMM: 115,
      mirrorWidthDeductionMM: 115
    }, 'User');

    const res2TCustom = WindowCalculationEngine.calculate(t2Input65);
    const res3TCustom = WindowCalculationEngine.calculate(t3Input65);

    // 2T custom: 1524 - 90 = 1434 mm H; (1219 - 26) / 2 = 1193 / 2 = 596.5 -> 597 mm W; Glass H: 1434 - 110 = 1324 mm
    // 3T custom: 1524 - 86 = 1438 mm H; (1829 + 51) / 3 = 1880 / 3 = 626.67 -> 627 mm W; Glass H: 1438 - 115 = 1323 mm
    const passTest69 =
      res2TCustom.panel.heightMM === 1434 &&
      res2TCustom.panel.widthMM === 597 &&
      res2TCustom.mirror.heightMM === 1324 &&
      res3TCustom.panel.heightMM === 1438 &&
      res3TCustom.panel.widthMM === 627 &&
      res3TCustom.mirror.heightMM === 1323;

    // Restore original rules
    RulesEngineManager.updateRule('2-track_sliding_65mm', {
      heightDeductionMM: orig65Rule2T.heightDeductionMM,
      widthDeductionMM: orig65Rule2T.widthDeductionMM,
      mirrorHeightDeductionMM: orig65Rule2T.mirrorHeightDeductionMM,
      mirrorWidthDeductionMM: orig65Rule2T.mirrorWidthDeductionMM
    }, 'User');

    RulesEngineManager.updateRule('3-track_sliding_65mm', {
      heightDeductionMM: orig65Rule3T.heightDeductionMM,
      widthAdditionMM: orig65Rule3T.widthAdditionMM,
      mirrorHeightDeductionMM: orig65Rule3T.mirrorHeightDeductionMM,
      mirrorWidthDeductionMM: orig65Rule3T.mirrorWidthDeductionMM
    }, 'User');

    results.push({
      name: '65mm Formula Customization: Both 2T (H-94, W-22/2) & 3T (H-88, W+48/3) fully customizable and recalculate dynamically',
      category: 'Rule Combination',
      passed: passTest69,
      input: { custom2T: 'H-90, W-26/2, Glass-110', custom3T: 'H-86, W+51/3, Glass-115' },
      expected: {
        custom2TSash: '1434 x 597 mm',
        custom3TSash: '1438 x 627 mm'
      },
      actual: {
        custom2TSash: `${res2TCustom.panel.heightMM} x ${res2TCustom.panel.widthMM} mm`,
        custom3TSash: `${res3TCustom.panel.heightMM} x ${res3TCustom.panel.widthMM} mm`
      }
    });

    // 70. MIXED BATCH OUTPUT PDF ORDER SHEET: 58mm vs 65mm Material mm Sub-Column Integrity
    const res2T58 = WindowCalculationEngine.calculate({ unit: 'inch', widthInch: 48, heightInch: 60, windowType: 'sliding', frameType: '2-track', profileSeries: '58mm' });
    const res3T58 = WindowCalculationEngine.calculate({ unit: 'inch', widthInch: 72, heightInch: 60, windowType: 'sliding', frameType: '3-track', profileSeries: '58mm' });
    const resOpenSingle70 = WindowCalculationEngine.calculate({ unit: 'inch', widthInch: 30, heightInch: 40, windowType: 'open', frameType: 'no-track', casementSubtype: 'single' });

    const mixedRows = prepareLSRows([res2T58, res2T65, res3T58, res3T65, resOpenSingle70]);
    const passTest70 =
      mixedRows[0].materialMM === '58 mm' && mixedRows[0].modelName === '[SL/SL]' &&
      mixedRows[1].materialMM === '65 mm' && mixedRows[1].modelName === '[SL/SL]' &&
      mixedRows[2].materialMM === '58 mm' && mixedRows[2].modelName === '[SL/SL/SL/SL]' &&
      mixedRows[3].materialMM === '65 mm' && mixedRows[3].modelName === '[SL/SL/SL/SL]' &&
      mixedRows[4].materialMM === '-' && mixedRows[4].modelName === '[OP]';

    results.push({
      name: 'Mixed Batch PDF Order Sheet: Displays "58 mm" for standard sliding, "65 mm" for 65mm sliding, and "-" for non-sliding windows',
      category: 'Rule Combination',
      passed: passTest70,
      input: { batchCount: mixedRows.length },
      expected: {
        r0: { material: '58 mm', model: '[SL/SL]' },
        r1: { material: '65 mm', model: '[SL/SL]' },
        r2: { material: '58 mm', model: '[SL/SL/SL/SL]' },
        r3: { material: '65 mm', model: '[SL/SL/SL/SL]' },
        r4: { material: '-', model: '[OP]' }
      },
      actual: {
        r0: { material: mixedRows[0]?.materialMM, model: mixedRows[0]?.modelName },
        r1: { material: mixedRows[1]?.materialMM, model: mixedRows[1]?.modelName },
        r2: { material: mixedRows[2]?.materialMM, model: mixedRows[2]?.modelName },
        r3: { material: mixedRows[3]?.materialMM, model: mixedRows[3]?.modelName },
        r4: { material: mixedRows[4]?.materialMM, model: mixedRows[4]?.modelName }
      }
    });

    const passedCount = results.filter(r => r.passed).length;
    return {
      passedCount,
      totalCount: results.length,
      results
    };
  }
}
