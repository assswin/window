// WindowBuilder Core Types & Calculation Interfaces

export type FrameType = '2-track' | '2.5-track' | '3.5-track' | '3-track' | '4-track' | 'no-track';
export type WindowType = 'sliding' | 'open' | 'fixed' | 'ventilator';
export type UnitType = 'inch' | 'cm' | 'mm';
export type UPVCSeries = '58mm' | '60mm' | '65mm' | '80mm' | '88mm';
export type GlassType = '5mm_single' | '6mm_toughened' | 'double_glazed';

export type CasementSubtype = 'single' | 'double' | 'triple';
export type VentilatorSubtype = 'normal' | 'fan';
export type VentilatorFanSide = 'left' | 'right';

export interface WindowInput {
  widthInch: number;
  heightInch: number;
  widthCm?: number;
  heightCm?: number;
  widthMM?: number;
  heightMM?: number;
  mirrorInch?: number | null; // optional manual override
  frameType: FrameType;
  windowType: WindowType;
  casementSubtype?: CasementSubtype; // 'single' (1-shutter), 'double' (2-shutter with mullion), or 'triple' (3-shutter with 2 mullions)
  ventilatorSubtype?: VentilatorSubtype; // 'normal' (standard louver) or 'fan' (exhaust fan provision)
  ventilatorFanSide?: VentilatorFanSide; // 'left' or 'right' exhaust fan placement
  unit: UnitType;

  // Customizable formula parameters
  conversionFactor?: number; // default 25.4 (multiplier)
  customOffsetMM?: number; // default 0 mm (additional user margin: min 0, no negative integers, default 0)
  weldingAllowanceMM?: number; // default 0 mm (exact Method of Sum cutting without added burn-off)
  profileSeries?: UPVCSeries; // default '60mm' (uPVC series)
  reinforcementSteel?: boolean; // default false (GI steel reinforcement omitted per builder specification)
  glassType?: GlassType; // default '5mm_single'
  windowLabel?: string; // e.g. 'W1 - Hall'
  variantLetter?: string; // optional manual variant letter 'a' to 'z'
  quantity?: number; // default 1
}

export interface CalculationStep {
  label: string;
  formula: string;
  calculation: string;
  result: string;
  note?: string;
}

export interface ReinforcementSteelCut {
  component: string;
  count: number;
  lengthMM: number;
  cutAngle: '90_degree';
  specification: string;
}

export interface GlassBeadOutput {
  verticalCutMM: number;
  horizontalCutMM: number;
  cutAngle: '45_degree';
  totalPcs: number;
}

export interface FrameOutput {
  widthMM: number;
  heightMM: number;
  topBottomCutMM: number;
  leftRightCutMM: number;
  cutAngle: '45_degree' | '90_degree';
  weldingAllowanceMM: number;
  profileDepthMM: number;
  trackCount: number;
  mullionCutMM?: number; // Central mullion profile cut (Sash Height - 6 mm for double open window)
  steelCutTopBottomMM: number;
  steelCutLeftRightMM: number;
}

export interface PanelOutput {
  count: number;
  widthMM: number;
  heightMM: number;
  shutterType: string;
  cutAngle: '45_degree' | '90_degree';
  weldingAllowanceMM: number;
  interlockOverlapMM: number;
  verticalStyleCutMM: number;
  topBottomRailCutMM: number;
  steelCutVerticalMM: number;
  steelCutHorizontalMM: number;
  interlockMM?: number; // Interlock profile cut length for sliding windows (Sash H - 5 mm)
}

export interface MirrorOutput {
  count: number;
  widthMM: number;
  heightMM: number;
  sqFeet: number;
  sqMeters: number;
  glassType?: string;
  beading?: GlassBeadOutput;
  note?: string;
}

export interface CalculationResult {
  id: string;
  timestamp: string;
  input: WindowInput;
  convertedWidthMM: number;
  convertedHeightMM: number;
  convertedMirrorMM?: number | null;
  ruleVersion: string;
  ruleProfileName: string;
  frame: FrameOutput;
  panel: PanelOutput;
  mirror: MirrorOutput;
  interlockMM?: number; // Interlock profile cut length for sliding windows (Sash Height - 5 mm)
  mullionMM?: number; // Central mullion cut length for double open window (Sash Height - 6 mm)
  reinforcementSteel?: ReinforcementSteelCut[];
  reinforcements?: ReinforcementSteelCut[];
  glassBeads?: GlassBeadOutput;
  additionalPanels?: PanelOutput[]; // e.g. mosquito mesh panel in 2.5/3 track
  steps: CalculationStep[];
  notes: string[];
}

export interface ProjectWindowItem {
  id: string; // 'W1', 'W2' ... 'W10'
  name: string;
  label?: string;
  input: WindowInput;
  result: CalculationResult | null;
}

export interface ProfileRule {
  id: string;
  frameType: FrameType;
  windowType: WindowType;
  name: string;
  description: string;
  
  // Height deductions
  heightDeductionMM: number; // Subtracted from total height to get shutter height
  
  // Width calculations
  divisionFactor: number;    // Number of panels (e.g. 2 for 2-track, 3 for 3-track, 4 for 4-track)
  widthDeductionMM: number;  // Net deduction for overlap
  widthAdditionMM?: number;  // Net addition for overlap e.g. (W/4) + 11
  overlapMM: number;         // Overlap per interlock
  sideClearanceMM: number;   // Side frame clearance
  
  // Mirror/Glass deductions
  mirrorHeightDeductionMM: number; // Subtracted from panel height or frame height
  mirrorWidthDeductionMM: number;  // Subtracted from panel width or frame width
  mirrorDeductionReference: 'panel' | 'frame'; // Base reference for glass deduction
  
  // Profile specs
  profileDepthMM: number;
  sashProfileWidthMM: number;
  glassGrooveDepthMM: number;
  mullionDeductionMM?: number; // Deduction for mullion profile height from outer height (e.g. 44mm)
  mullionSashDeductionMM?: number; // Deduction for mullion profile from sash height (e.g. 6mm, customizable)
  meshHeightDeductionMM?: number; // Deduction for mosquito mesh height (e.g. 2mm)
  meshWidthDeductionMM?: number; // Deduction for mosquito mesh width (e.g. 10mm: (W/2) - 10)
}

export interface SystemProfilePreset {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: Record<string, ProfileRule>; // key: `${frameType}_${windowType}`
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  adminUser: string;
  action: string;
  targetRule: string;
  oldValue: string;
  newValue: string;
}
