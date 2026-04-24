import { describe, expect, it } from 'bun:test';

import type { InitPhase, InitStepDefinition } from '../../src/bootstrap/initOrder.ts';
import { EARLY_PHASE_COUNT, INIT_ORDER, INIT_ORDER_BY_LABEL, INIT_PHASES, INIT_STEP_COUNT, POST_IDENTIFY_PHASE_COUNT, WAD_LOAD_PHASE_COUNT, matchesManifestSequence } from '../../src/bootstrap/initOrder.ts';
import { INIT_SEQUENCE_LENGTH, REFERENCE_RUN_MANIFEST } from '../../src/oracles/referenceRunManifest.ts';

describe('INIT_PHASES', () => {
  it('contains exactly 3 phases', () => {
    expect(INIT_PHASES).toHaveLength(3);
  });

  it('is in ASCIIbetical order', () => {
    const sorted = [...INIT_PHASES].sort();
    expect(INIT_PHASES).toEqual(sorted);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(INIT_PHASES)).toBe(true);
  });
});

describe('INIT_STEP_COUNT', () => {
  it('equals 15', () => {
    expect(INIT_STEP_COUNT).toBe(15);
  });

  it('matches REFERENCE_RUN_MANIFEST INIT_SEQUENCE_LENGTH', () => {
    expect(INIT_STEP_COUNT).toBe(INIT_SEQUENCE_LENGTH);
  });
});

describe('phase count constants', () => {
  it('EARLY_PHASE_COUNT is 3', () => {
    expect(EARLY_PHASE_COUNT).toBe(3);
  });

  it('WAD_LOAD_PHASE_COUNT is 1', () => {
    expect(WAD_LOAD_PHASE_COUNT).toBe(1);
  });

  it('POST_IDENTIFY_PHASE_COUNT is 11', () => {
    expect(POST_IDENTIFY_PHASE_COUNT).toBe(11);
  });

  it('phase counts sum to INIT_STEP_COUNT', () => {
    expect(EARLY_PHASE_COUNT + WAD_LOAD_PHASE_COUNT + POST_IDENTIFY_PHASE_COUNT).toBe(INIT_STEP_COUNT);
  });
});

describe('INIT_ORDER', () => {
  it('has INIT_STEP_COUNT entries', () => {
    expect(INIT_ORDER).toHaveLength(INIT_STEP_COUNT);
  });

  it('is frozen at both array and entry level', () => {
    expect(Object.isFrozen(INIT_ORDER)).toBe(true);
    for (const step of INIT_ORDER) {
      expect(Object.isFrozen(step)).toBe(true);
    }
  });

  it('has sequential 0-based indices', () => {
    for (let index = 0; index < INIT_ORDER.length; index++) {
      expect(INIT_ORDER[index]!.index).toBe(index);
    }
  });

  it('has unique labels', () => {
    const labels = INIT_ORDER.map((step) => step.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('has non-empty labels and descriptions', () => {
    for (const step of INIT_ORDER) {
      expect(step.label.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  it('assigns only valid phases', () => {
    const validPhases = new Set<string>(INIT_PHASES);
    for (const step of INIT_ORDER) {
      expect(validPhases.has(step.phase)).toBe(true);
    }
  });

  it('groups phases contiguously (early → wad-load → post-identify)', () => {
    const phases = INIT_ORDER.map((step) => step.phase);
    const phaseOrder: InitPhase[] = ['early', 'wad-load', 'post-identify'];
    let phaseIndex = 0;
    for (const phase of phases) {
      if (phase !== phaseOrder[phaseIndex]) {
        phaseIndex++;
        expect(phase).toBe(phaseOrder[phaseIndex]);
      }
    }
    expect(phaseIndex).toBe(phaseOrder.length - 1);
  });

  it('has exactly EARLY_PHASE_COUNT early steps', () => {
    const earlySteps = INIT_ORDER.filter((step) => step.phase === 'early');
    expect(earlySteps).toHaveLength(EARLY_PHASE_COUNT);
  });

  it('has exactly WAD_LOAD_PHASE_COUNT wad-load steps', () => {
    const wadSteps = INIT_ORDER.filter((step) => step.phase === 'wad-load');
    expect(wadSteps).toHaveLength(WAD_LOAD_PHASE_COUNT);
  });

  it('has exactly POST_IDENTIFY_PHASE_COUNT post-identify steps', () => {
    const postSteps = INIT_ORDER.filter((step) => step.phase === 'post-identify');
    expect(postSteps).toHaveLength(POST_IDENTIFY_PHASE_COUNT);
  });

  it('starts with Z_Init and ends with I_InitStretchTables', () => {
    expect(INIT_ORDER[0]!.label).toBe('Z_Init');
    expect(INIT_ORDER[INIT_ORDER.length - 1]!.label).toBe('I_InitStretchTables');
  });

  it('places W_Init as the sole wad-load step at index 3', () => {
    const wadStep = INIT_ORDER.find((step) => step.phase === 'wad-load');
    expect(wadStep).toBeDefined();
    expect(wadStep!.label).toBe('W_Init');
    expect(wadStep!.index).toBe(3);
  });
});

describe('cross-reference with REFERENCE_RUN_MANIFEST', () => {
  it('labels match the manifest initSequence in order', () => {
    const manifestLabels = REFERENCE_RUN_MANIFEST.initSequence.map((step) => step.label);
    const orderLabels = INIT_ORDER.map((step) => step.label);
    expect(orderLabels).toEqual(manifestLabels);
  });

  it('descriptions match the manifest initSequence in order', () => {
    const manifestDescriptions = REFERENCE_RUN_MANIFEST.initSequence.map((step) => step.description);
    const orderDescriptions = INIT_ORDER.map((step) => step.description);
    expect(orderDescriptions).toEqual(manifestDescriptions);
  });

  it('matchesManifestSequence returns true for INIT_ORDER vs manifest', () => {
    expect(matchesManifestSequence(INIT_ORDER, REFERENCE_RUN_MANIFEST.initSequence)).toBe(true);
  });

  it('matchesManifestSequence returns false for reversed order', () => {
    const reversed = [...INIT_ORDER].reverse();
    expect(matchesManifestSequence(reversed, REFERENCE_RUN_MANIFEST.initSequence)).toBe(false);
  });

  it('matchesManifestSequence returns false for length mismatch', () => {
    expect(matchesManifestSequence(INIT_ORDER.slice(0, 5), REFERENCE_RUN_MANIFEST.initSequence)).toBe(false);
  });
});

describe('INIT_ORDER_BY_LABEL', () => {
  it('has INIT_STEP_COUNT entries', () => {
    expect(INIT_ORDER_BY_LABEL.size).toBe(INIT_STEP_COUNT);
  });

  it('maps each label to the correct step', () => {
    for (const step of INIT_ORDER) {
      const looked = INIT_ORDER_BY_LABEL.get(step.label);
      expect(looked).toBeDefined();
      expect(looked!.index).toBe(step.index);
      expect(looked!.description).toBe(step.description);
      expect(looked!.phase).toBe(step.phase);
    }
  });

  it('returns undefined for unknown labels', () => {
    expect(INIT_ORDER_BY_LABEL.get('X_Nonexistent')).toBeUndefined();
  });
});

describe('parity-sensitive edge cases', () => {
  it('OPL_Init immediately follows I_Init (sub-init side effect)', () => {
    const iInitIndex = INIT_ORDER_BY_LABEL.get('I_Init')!.index;
    const oplInitIndex = INIT_ORDER_BY_LABEL.get('OPL_Init')!.index;
    expect(oplInitIndex).toBe(iInitIndex + 1);
    expect(INIT_ORDER[iInitIndex]!.phase).toBe('post-identify');
    expect(INIT_ORDER[oplInitIndex]!.phase).toBe('post-identify');
  });

  it('M_LoadDefaults precedes W_Init (config must load before WAD)', () => {
    const configIndex = INIT_ORDER_BY_LABEL.get('M_LoadDefaults')!.index;
    const wadIndex = INIT_ORDER_BY_LABEL.get('W_Init')!.index;
    expect(configIndex).toBeLessThan(wadIndex);
  });

  it('R_Init precedes P_Init (renderer before playloop)', () => {
    const renderIndex = INIT_ORDER_BY_LABEL.get('R_Init')!.index;
    const playIndex = INIT_ORDER_BY_LABEL.get('P_Init')!.index;
    expect(renderIndex).toBeLessThan(playIndex);
  });

  it('S_Init precedes D_CheckNetGame (sound before network check)', () => {
    const soundIndex = INIT_ORDER_BY_LABEL.get('S_Init')!.index;
    const netCheckIndex = INIT_ORDER_BY_LABEL.get('D_CheckNetGame')!.index;
    expect(soundIndex).toBeLessThan(netCheckIndex);
  });

  it('I_InitStretchTables is last (Chocolate Doom aspect-ratio correction)', () => {
    const stretchStep = INIT_ORDER_BY_LABEL.get('I_InitStretchTables')!;
    expect(stretchStep.index).toBe(INIT_STEP_COUNT - 1);
    expect(stretchStep.phase).toBe('post-identify');
  });

  it('early phase completes before any post-identify step', () => {
    const maxEarlyIndex = Math.max(...INIT_ORDER.filter((step) => step.phase === 'early').map((step) => step.index));
    const minPostIndex = Math.min(...INIT_ORDER.filter((step) => step.phase === 'post-identify').map((step) => step.index));
    expect(maxEarlyIndex).toBeLessThan(minPostIndex);
  });

  it('compile-time InitStepDefinition satisfaction', () => {
    const step: InitStepDefinition = INIT_ORDER[0]!;
    expect(typeof step.index).toBe('number');
    expect(typeof step.label).toBe('string');
    expect(typeof step.description).toBe('string');
    expect(typeof step.phase).toBe('string');
  });
});
