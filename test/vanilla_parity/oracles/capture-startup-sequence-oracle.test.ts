import { describe, expect, test } from 'bun:test';

import { INIT_SEQUENCE_LENGTH, REFERENCE_RUN_MANIFEST } from '../../../src/oracles/referenceRunManifest.ts';
import capture from './capture-startup-sequence-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-016-capture-startup-sequence-oracle.md';
const PHASE_LABEL_PATTERN = /^[A-Z][A-Za-z0-9_]*$/;

interface InitStep {
  readonly label: string;
  readonly description: string;
}

describe('capture identity and metadata', () => {
  test('declares OR-VP-STARTUP-SEQ-016 oracle id, step 02-016, and oracle lane', () => {
    expect(capture.id).toBe('OR-VP-STARTUP-SEQ-016');
    expect(capture.stepId).toBe('02-016');
    expect(capture.stepTitle).toBe('Capture Startup Sequence Oracle');
    expect(capture.lane).toBe('oracle');
  });

  test('points to the existing referenceRunManifest source module', () => {
    expect(capture.sourceModule).toBe('src/oracles/referenceRunManifest.ts');
  });

  test('capture method describes the observed-stdout origin', () => {
    expect(capture.captureMethod).toContain('stdout');
    expect(capture.captureMethod).toContain('DOOM.EXE');
  });

  test('pins DOOM.EXE / DOOM1.WAD and the 35 Hz tic anchor', () => {
    expect(capture.executableFilename).toBe('DOOM.EXE');
    expect(capture.iwadFilename).toBe('DOOM1.WAD');
    expect(capture.ticRateHzAnchor).toBe(35);
  });
});

describe('init sequence parity with src/oracles/referenceRunManifest.ts', () => {
  test('declared init sequence length matches INIT_SEQUENCE_LENGTH and the captured array length', () => {
    expect(capture.initSequenceLength).toBe(INIT_SEQUENCE_LENGTH);
    expect(capture.initSequenceLength).toBe(15);
    expect(capture.initSequence).toHaveLength(capture.initSequenceLength);
  });

  test('every captured init step label and description matches the source-level manifest in order', () => {
    const sourceInitSequence = REFERENCE_RUN_MANIFEST.initSequence;
    for (let stepIndex = 0; stepIndex < capture.initSequence.length; stepIndex += 1) {
      const capturedStep = capture.initSequence[stepIndex] as InitStep;
      const sourceStep = sourceInitSequence[stepIndex] as InitStep;
      expect(capturedStep.label).toBe(sourceStep.label);
      expect(capturedStep.description).toBe(sourceStep.description);
    }
  });

  test('every captured init step label matches the [A-Z][A-Za-z0-9_]* pattern', () => {
    for (const step of capture.initSequence as readonly InitStep[]) {
      expect(step.label).toMatch(PHASE_LABEL_PATTERN);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  test('init step labels are unique', () => {
    const labels = (capture.initSequence as readonly InitStep[]).map((step) => step.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  test('first observed phase is Z_Init and last is I_InitStretchTables', () => {
    expect(capture.initSequence[0]?.label).toBe('Z_Init');
    expect(capture.initSequence[capture.initSequence.length - 1]?.label).toBe('I_InitStretchTables');
  });
});

describe('alignment with plan_vanilla_parity step 02-016', () => {
  test('step file write lock pins the capture json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-startup-sequence-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-startup-sequence-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('step file lists DOOM.EXE among its research sources', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- doom/DOOM.EXE');
  });
});

describe('failure-mode validation invariants', () => {
  test('phase label pattern rejects malformed labels', () => {
    expect('z_init').not.toMatch(PHASE_LABEL_PATTERN);
    expect('1_Init').not.toMatch(PHASE_LABEL_PATTERN);
    expect('Z-Init').not.toMatch(PHASE_LABEL_PATTERN);
  });

  test('an init sequence length of 14 or 16 would break parity with vanilla', () => {
    expect(capture.initSequenceLength).not.toBe(14);
    expect(capture.initSequenceLength).not.toBe(16);
  });
});
