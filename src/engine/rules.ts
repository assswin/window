import { FrameType, WindowType, CasementSubtype, UPVCSeries, ProfileRule, SystemProfilePreset, AuditLogEntry } from './types';

// Helper to create rule keys
export const getRuleKey = (frameType: FrameType, windowType: WindowType, profileSeries?: UPVCSeries): string => {
  if (profileSeries === '65mm' && windowType === 'sliding') {
    if (frameType === '2-track') return '2-track_sliding_65mm';
    if (frameType === '3-track' || frameType === '3.5-track') return '3-track_sliding_65mm';
  }
  return `${frameType}_${windowType}`;
};

// 1. Preset: Workshop Reference (Based on Builder's Exact Method of Sum & Audited Standards)
export const WORKSHOP_REFERENCE_PRESET: SystemProfilePreset = {
  id: 'workshop-ref',
  name: "Builder's Method of Sum (Tamil Nadu Workshop Audited Standards)",
  description: 'Audited shop formulas: 2T (H-94, W/2-12, -94 glass, 58mm material), 2.5T (H-82, W/2-8, -94 glass, Mesh H-2, W/2-10, 58mm material), 3T (H-91, W/3-11, -94 glass, 58mm material), 4T (H-92, W/4+11, Glass -95, 58mm material), Single Window (H-64, W-64, -124 glass), Double Window (H-64, W/2-37, Mullion H-6, -126 glass), 3-Open Window (H-64, W/3-40, Glass -125, Mullion H-6), Fixed (Direct OU-96 glass).',
  version: 'v2.1-audited',
  rules: {
    '2-track_sliding_65mm': {
      id: '2-track_sliding_65mm',
      frameType: '2-track',
      windowType: 'sliding',
      name: '2 Track Sliding Window (65mm Material: H-94, W-22/2, Glass -112)',
      description: 'Sliding 2-Track (65mm Series): Shutter Height H-94, Shutter Width (W-22)/2, Glass -112mm, Material 65mm',
      heightDeductionMM: 94,
      divisionFactor: 2,
      widthDeductionMM: 22,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 112,
      mirrorWidthDeductionMM: 112,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 65,
      sashProfileWidthMM: 55,
      glassGrooveDepthMM: 10
    },
    '3-track_sliding_65mm': {
      id: '3-track_sliding_65mm',
      frameType: '3-track',
      windowType: 'sliding',
      name: '3 Track Sliding Window (65mm Material: H-88, W+48/3, Glass -112)',
      description: 'Sliding 3-Track (65mm Series): 3 Shutters Height H-88, Shutter Width (W+48)/3, Glass -112mm, Material 65mm',
      heightDeductionMM: 88,
      divisionFactor: 3,
      widthDeductionMM: 0,
      widthAdditionMM: 48,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 112,
      mirrorWidthDeductionMM: 112,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 65,
      sashProfileWidthMM: 55,
      glassGrooveDepthMM: 10
    },
    '2-track_sliding': {
      id: '2-track_sliding',
      frameType: '2-track',
      windowType: 'sliding',
      name: '2 Track Sliding Window (H-94, W/2-12, -94 Glass, Material 58mm)',
      description: 'Sliding 2-Track: Shutter Height H-94, Shutter Width W/2-12, Glass -94mm, Material 58mm',
      heightDeductionMM: 94,
      divisionFactor: 2,
      widthDeductionMM: 12,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 94,
      mirrorWidthDeductionMM: 94,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 58,
      sashProfileWidthMM: 50,
      glassGrooveDepthMM: 8,
      meshHeightDeductionMM: 2,
      meshWidthDeductionMM: 10
    },
    '2.5-track_sliding': {
      id: '2.5-track_sliding',
      frameType: '2.5-track',
      windowType: 'sliding',
      name: '2.5 Track Sliding Window (H-82, W/2-8, -94 Glass, Mesh H-2, Mesh W/2-10, Material 58mm)',
      description: 'Sliding 2.5-Track: Shutter Height H-82, Shutter Width W/2-8, Glass -94mm, Mesh H-2, Mesh W/2-10, Material 58mm',
      heightDeductionMM: 82,
      divisionFactor: 2,
      widthDeductionMM: 8,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 94,
      mirrorWidthDeductionMM: 94,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 58,
      sashProfileWidthMM: 50,
      glassGrooveDepthMM: 8,
      meshHeightDeductionMM: 2,
      meshWidthDeductionMM: 10
    },
    '3.5-track_sliding': {
      id: '3.5-track_sliding',
      frameType: '3.5-track',
      windowType: 'sliding',
      name: '3 Track Sliding Window (H-91, W/3-11, -94 Glass, Material 58mm)',
      description: 'Sliding 3/3.5-Track: Shutter Height H-91, Shutter Width W/3-11, Glass -94mm, Material 58mm',
      heightDeductionMM: 91,
      divisionFactor: 3,
      widthDeductionMM: 11,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 94,
      mirrorWidthDeductionMM: 94,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 58,
      sashProfileWidthMM: 50,
      glassGrooveDepthMM: 8,
      meshHeightDeductionMM: 2
    },
    '3-track_sliding': {
      id: '3-track_sliding',
      frameType: '3-track',
      windowType: 'sliding',
      name: '3 Track Sliding Window (H-91, W/3-11, -94 Glass, Material 58mm)',
      description: 'Sliding 3-Track: Shutter Height H-91, Shutter Width W/3-11, Glass -94mm, Material 58mm',
      heightDeductionMM: 91,
      divisionFactor: 3,
      widthDeductionMM: 11,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 94,
      mirrorWidthDeductionMM: 94,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 58,
      sashProfileWidthMM: 50,
      glassGrooveDepthMM: 8,
      meshHeightDeductionMM: 2
    },
    '4-track_sliding': {
      id: '4-track_sliding',
      frameType: '4-track',
      windowType: 'sliding',
      name: '4 Track Sliding Window (H-92, W/4+11, -95 Glass, Material 58mm)',
      description: 'Sliding 4-Track: 4 Shutters Height H-92, Shutter Width (W/4)+11, Glass -95mm, Material 58mm',
      heightDeductionMM: 92,
      divisionFactor: 4,
      widthDeductionMM: 0,
      widthAdditionMM: 11,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 95,
      mirrorWidthDeductionMM: 95,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 58,
      sashProfileWidthMM: 50,
      glassGrooveDepthMM: 8
    },
    'no-track_open': {
      id: 'no-track_open',
      frameType: 'no-track',
      windowType: 'open',
      name: 'Single Window (H-64, W-64, -124 Glass)',
      description: 'Single Window (No Track): 1 Shutter Height H-64, Width W-64, Glass -124mm',
      heightDeductionMM: 64,
      divisionFactor: 1,
      widthDeductionMM: 64,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 124,
      mirrorWidthDeductionMM: 124,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 50,
      sashProfileWidthMM: 55,
      glassGrooveDepthMM: 10
    },
    'no-track_open_double': {
      id: 'no-track_open_double',
      frameType: 'no-track',
      windowType: 'open',
      name: 'Double Window (H-64, W/2-37, Mullion H-6, -126 Glass)',
      description: 'Double Window: 2 Shutters Height H-64, Width W/2-37, Mullion H-6, Glass -126mm',
      heightDeductionMM: 64,
      divisionFactor: 2,
      widthDeductionMM: 37,
      mullionDeductionMM: 6,
      mullionSashDeductionMM: 6,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 126,
      mirrorWidthDeductionMM: 126,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 50,
      sashProfileWidthMM: 55,
      glassGrooveDepthMM: 10
    },
    'no-track_open_triple': {
      id: 'no-track_open_triple',
      frameType: 'no-track',
      windowType: 'open',
      name: '3-Open Window (H-64, W/3-40, Mullion H-6, -125 Glass)',
      description: '3-Open Window: 3 Shutters Height H-64, Width W/3-40, 2 Mullions H-6, Glass -125mm',
      heightDeductionMM: 64,
      divisionFactor: 3,
      widthDeductionMM: 40,
      mullionDeductionMM: 6,
      mullionSashDeductionMM: 6,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 125,
      mirrorWidthDeductionMM: 125,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 50,
      sashProfileWidthMM: 55,
      glassGrooveDepthMM: 10
    },
    'no-track_fixed': {
      id: 'no-track_fixed',
      frameType: 'no-track',
      windowType: 'fixed',
      name: 'Fixed Window Direct Glazing (OU-96 Glass, No Track/Sash)',
      description: 'Fixed Window (Direct Glazing): Outer Frame Only, Glass W: OU_W-96, Glass H: OU_H-96',
      heightDeductionMM: 0,
      divisionFactor: 0,
      widthDeductionMM: 0,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 96,
      mirrorWidthDeductionMM: 96,
      mirrorDeductionReference: 'frame',
      profileDepthMM: 50,
      sashProfileWidthMM: 55,
      glassGrooveDepthMM: 10
    },
    'no-track_ventilator': {
      id: 'no-track_ventilator',
      frameType: 'no-track',
      windowType: 'ventilator',
      name: 'Ventilator Frame (Direct Inch to MM, No Added MM)',
      description: 'Ventilator: Outer Frame Only, Direct Inch to MM conversion with zero added margin',
      heightDeductionMM: 0,
      divisionFactor: 0,
      widthDeductionMM: 0,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 0,
      mirrorWidthDeductionMM: 0,
      mirrorDeductionReference: 'frame',
      profileDepthMM: 50,
      sashProfileWidthMM: 55,
      glassGrooveDepthMM: 10
    },
    '2-track_open': {
      id: '2-track_open',
      frameType: '2-track',
      windowType: 'open',
      name: 'Single Open Casement Window (H-64, W-64, -124 Glass)',
      description: 'Open Window: Shutter Height H-64, Width W-64, Glass -124mm',
      heightDeductionMM: 64,
      divisionFactor: 1,
      widthDeductionMM: 64,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 124,
      mirrorWidthDeductionMM: 124,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 50,
      sashProfileWidthMM: 55,
      glassGrooveDepthMM: 10
    },
    '2-track_fixed': {
      id: '2-track_fixed',
      frameType: '2-track',
      windowType: 'fixed',
      name: 'Fixed Window Direct Glazing (OU-96 Glass)',
      description: 'Fixed Window: Direct glazing into outer frame (OU - 96)',
      heightDeductionMM: 0,
      divisionFactor: 0,
      widthDeductionMM: 0,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 96,
      mirrorWidthDeductionMM: 96,
      mirrorDeductionReference: 'frame',
      profileDepthMM: 50,
      sashProfileWidthMM: 55,
      glassGrooveDepthMM: 10
    },
    '2.5-track_open': {
      id: '2.5-track_open',
      frameType: '2.5-track',
      windowType: 'open',
      name: 'Single Open Casement Window (H-64, W-64, -124 Glass)',
      description: 'Open Window: Shutter Height H-64, Width W-64, Glass -124mm',
      heightDeductionMM: 64,
      divisionFactor: 1,
      widthDeductionMM: 64,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 124,
      mirrorWidthDeductionMM: 124,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 50,
      sashProfileWidthMM: 55,
      glassGrooveDepthMM: 10
    },
    '3-track_open': {
      id: '3-track_open',
      frameType: '3-track',
      windowType: 'open',
      name: 'Single Open Casement Window (H-64, W-64, -124 Glass)',
      description: 'Open Window: Shutter Height H-64, Width W-64, Glass -124mm',
      heightDeductionMM: 64,
      divisionFactor: 1,
      widthDeductionMM: 64,
      overlapMM: 0,
      sideClearanceMM: 0,
      mirrorHeightDeductionMM: 124,
      mirrorWidthDeductionMM: 124,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 50,
      sashProfileWidthMM: 55,
      glassGrooveDepthMM: 10
    }
  }
};

// 2. Preset: Standard Indian Section (Jindal 18x50 / 25x50 Standard)
export const JINDAL_STANDARD_PRESET: SystemProfilePreset = {
  id: 'jindal-standard',
  name: 'Standard Logical Measure (YouTube / Jindal Standard)',
  description: 'Logical standard for aluminium window fabrication (40mm track deduction, 25mm overlap, 78mm glass rebate).',
  version: 'v1.0-standard',
  rules: {
    '2-track_sliding': {
      id: '2-track_sliding',
      frameType: '2-track',
      windowType: 'sliding',
      name: '2 Track Sliding Window (Standard 25×50)',
      description: 'Standard 2-track sliding, 40mm height deduction for roller clearance, 25mm interlock overlap.',
      heightDeductionMM: 40,
      divisionFactor: 2,
      widthDeductionMM: 0,
      overlapMM: 25,
      sideClearanceMM: 6,
      mirrorHeightDeductionMM: 78,
      mirrorWidthDeductionMM: 78,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 62,
      sashProfileWidthMM: 48,
      glassGrooveDepthMM: 8
    },
    '2-track_open': {
      id: '2-track_open',
      frameType: '2-track',
      windowType: 'open',
      name: '2 Track Open Window (Standard Casement)',
      description: 'Casement window with 45mm frame profile and friction stay clearance.',
      heightDeductionMM: 86,
      divisionFactor: 2,
      widthDeductionMM: 14,
      overlapMM: 0,
      sideClearanceMM: 8,
      mirrorHeightDeductionMM: 104,
      mirrorWidthDeductionMM: 104,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 50,
      sashProfileWidthMM: 52,
      glassGrooveDepthMM: 10
    },
    '2.5-track_sliding': {
      id: '2.5-track_sliding',
      frameType: '2.5-track',
      windowType: 'sliding',
      name: '2.5 Track Sliding Window (Standard + Mesh)',
      description: '2 Glass sliding shutters + 1 stainless steel mosquito mesh shutter.',
      heightDeductionMM: 42,
      divisionFactor: 2,
      widthDeductionMM: 0,
      overlapMM: 25,
      sideClearanceMM: 6,
      mirrorHeightDeductionMM: 78,
      mirrorWidthDeductionMM: 78,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 88,
      sashProfileWidthMM: 48,
      glassGrooveDepthMM: 8
    },
    '2.5-track_open': {
      id: '2.5-track_open',
      frameType: '2.5-track',
      windowType: 'open',
      name: '2.5 Track Open Window (Standard + Mesh)',
      description: 'Casement window with outer mosquito screen frame.',
      heightDeductionMM: 88,
      divisionFactor: 2,
      widthDeductionMM: 16,
      overlapMM: 0,
      sideClearanceMM: 8,
      mirrorHeightDeductionMM: 104,
      mirrorWidthDeductionMM: 104,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 75,
      sashProfileWidthMM: 52,
      glassGrooveDepthMM: 10
    },
    '3-track_sliding': {
      id: '3-track_sliding',
      frameType: '3-track',
      windowType: 'sliding',
      name: '3 Track Sliding Window (Standard 3 Track)',
      description: '3 Track 3-panel sliding with 50mm total overlap across 2 interlocks.',
      heightDeductionMM: 42,
      divisionFactor: 3,
      widthDeductionMM: 0,
      overlapMM: 25,
      sideClearanceMM: 6,
      mirrorHeightDeductionMM: 78,
      mirrorWidthDeductionMM: 78,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 106,
      sashProfileWidthMM: 48,
      glassGrooveDepthMM: 8
    },
    '3-track_open': {
      id: '3-track_open',
      frameType: '3-track',
      windowType: 'open',
      name: '3 Track Open Window (Standard 3 Sash)',
      description: '3 Panel open casement configuration with central mullions.',
      heightDeductionMM: 86,
      divisionFactor: 3,
      widthDeductionMM: 24,
      overlapMM: 0,
      sideClearanceMM: 10,
      mirrorHeightDeductionMM: 104,
      mirrorWidthDeductionMM: 104,
      mirrorDeductionReference: 'panel',
      profileDepthMM: 95,
      sashProfileWidthMM: 52,
      glassGrooveDepthMM: 10
    }
  }
};

// Available Presets
export const ALL_PRESETS: SystemProfilePreset[] = [
  WORKSHOP_REFERENCE_PRESET,
  JINDAL_STANDARD_PRESET
];

const STORAGE_KEY_ACTIVE_PRESET = 'windowbuilder_active_preset_id';
const STORAGE_KEY_CUSTOM_RULES = 'windowbuilder_custom_rules_data';
const STORAGE_KEY_AUDIT_LOGS = 'windowbuilder_audit_logs';

export class RulesEngineManager {
  private static activePresetId: string = WORKSHOP_REFERENCE_PRESET.id;
  private static activeRules: Record<string, ProfileRule> = { ...WORKSHOP_REFERENCE_PRESET.rules };
  private static auditLogs: AuditLogEntry[] = [];

  static initialize() {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const savedPresetId = window.localStorage.getItem(STORAGE_KEY_ACTIVE_PRESET);
        if (savedPresetId) {
          const found = ALL_PRESETS.find(p => p.id === savedPresetId);
          if (found) {
            this.activePresetId = savedPresetId;
            this.activeRules = { ...found.rules };
          }
        } else {
          // Default to builder's workshop method of sum
          this.activePresetId = WORKSHOP_REFERENCE_PRESET.id;
          this.activeRules = { ...WORKSHOP_REFERENCE_PRESET.rules };
        }

        const savedCustomRules = window.localStorage.getItem(STORAGE_KEY_CUSTOM_RULES);
        if (savedCustomRules) {
          const parsed = JSON.parse(savedCustomRules);
          this.activeRules = { ...this.activeRules, ...parsed };
        }

        const savedAuditLogs = window.localStorage.getItem(STORAGE_KEY_AUDIT_LOGS);
        if (savedAuditLogs) {
          this.auditLogs = JSON.parse(savedAuditLogs);
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage, using in-memory default rules', e);
    }
  }

  static getActivePresetId(): string {
    return this.activePresetId;
  }

  static setActivePreset(presetId: string, adminUser = 'Admin') {
    const preset = ALL_PRESETS.find(p => p.id === presetId);
    if (!preset) throw new Error(`Unknown preset ${presetId}`);

    const oldPreset = this.activePresetId;
    this.activePresetId = preset.id;
    this.activeRules = { ...preset.rules };

    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PRESET, preset.id);
      localStorage.removeItem(STORAGE_KEY_CUSTOM_RULES); // reset custom overrides
    } catch (_) {}

    this.logAudit(adminUser, 'SWITCH_PRESET', 'System Preset', oldPreset, preset.name);
  }

  static getRule(
    frameType: FrameType,
    windowType: WindowType,
    casementSubtype?: CasementSubtype,
    profileSeries?: UPVCSeries
  ): ProfileRule {
    const isSliding = windowType === 'sliding';
    let key: string;
    if (isSliding) {
      if (profileSeries === '65mm') {
        if (frameType === '2-track') key = '2-track_sliding_65mm';
        else if (frameType === '3-track' || frameType === '3.5-track') key = '3-track_sliding_65mm';
        else key = getRuleKey(frameType, windowType);
      } else {
        key = getRuleKey(frameType, windowType);
      }
    } else {
      key = windowType === 'open'
        ? (casementSubtype === 'triple' ? 'no-track_open_triple' : casementSubtype === 'double' ? 'no-track_open_double' : 'no-track_open')
        : `no-track_${windowType}`;
    }
    let rule = this.activeRules[key];
    if (!rule) {
      key = getRuleKey(frameType, windowType, profileSeries);
      rule = this.activeRules[key] || WORKSHOP_REFERENCE_PRESET.rules[key] || Object.values(WORKSHOP_REFERENCE_PRESET.rules)[0];
    }
    return rule;
  }

  static getAllActiveRules(): Record<string, ProfileRule> {
    return { ...this.activeRules };
  }

  static updateRule(key: string, updated: Partial<ProfileRule>, adminUser = 'Admin') {
    const existing = this.activeRules[key] || WORKSHOP_REFERENCE_PRESET.rules[key];
    if (!existing) throw new Error(`Rule not found for key ${key}`);

    const oldStr = JSON.stringify(existing);
    const merged: ProfileRule = { ...existing, ...updated };
    this.activeRules[key] = merged;

    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_RULES, JSON.stringify(this.activeRules));
    } catch (_) {}

    this.logAudit(adminUser, 'UPDATE_RULE', key, oldStr, JSON.stringify(merged));
  }

  static resetToDefault(adminUser = 'Admin') {
    this.activePresetId = WORKSHOP_REFERENCE_PRESET.id;
    this.activeRules = { ...WORKSHOP_REFERENCE_PRESET.rules };
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET);
      localStorage.removeItem(STORAGE_KEY_CUSTOM_RULES);
    } catch (_) {}

    this.logAudit(adminUser, 'RESET_RULES', 'All Rules', 'Custom Modifications', 'Workshop Reference Default');
  }

  static getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  private static logAudit(adminUser: string, action: string, targetRule: string, oldValue: string, newValue: string) {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      adminUser,
      action,
      targetRule,
      oldValue,
      newValue
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 100) {
      this.auditLogs = this.auditLogs.slice(0, 100);
    }
    try {
      localStorage.setItem(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(this.auditLogs));
    } catch (_) {}
  }
}

// Auto initialize on module import
RulesEngineManager.initialize();
