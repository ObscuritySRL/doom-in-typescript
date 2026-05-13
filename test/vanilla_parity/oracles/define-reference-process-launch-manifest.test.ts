import { describe, expect, test } from 'bun:test';

import { INIT_SEQUENCE_LENGTH, REFERENCE_RUN_MANIFEST } from '../../../src/oracles/referenceRunManifest.ts';
import manifest from './define-reference-process-launch-manifest.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-004-define-reference-process-launch-manifest.md';
const INIT_STEP_LABEL_PATTERN = /^[A-Z][A-Za-z0-9_]*$/;
const VALID_RUN_MODES = new Set(['demo-playback', 'title-loop']);

interface InitStep {
  readonly label: string;
  readonly description: string;
}

interface RunModeEntry {
  readonly mode: string;
  readonly description: string;
  readonly additionalArgs: readonly string[];
}

describe('manifest identity and top-level fields', () => {
  test('declares OR-VP-LAUNCH-MANIFEST-004 oracle id, step 02-004, and oracle lane', () => {
    expect(manifest.id).toBe('OR-VP-LAUNCH-MANIFEST-004');
    expect(manifest.stepId).toBe('02-004');
    expect(manifest.stepTitle).toBe('Define Reference Process Launch Manifest');
    expect(manifest.lane).toBe('oracle');
  });

  test('pins the executable, IWAD, and empty base command line', () => {
    expect(manifest.executableFilename).toBe('DOOM.EXE');
    expect(manifest.iwadFilename).toBe('DOOM1.WAD');
    expect(manifest.baseCommandLine).toEqual([]);
  });

  test('pins the engine tic rate at 35 Hz and emulated version 1.9', () => {
    expect(manifest.ticRateHz).toBe(35);
    expect(manifest.emulatedVersion).toBe('1.9');
  });
});

describe('cross-reference with src/oracles/referenceRunManifest.ts', () => {
  test('JSON executable, IWAD, and base command line match the source-level manifest', () => {
    expect(manifest.executableFilename).toBe(REFERENCE_RUN_MANIFEST.executableFilename);
    expect(manifest.iwadFilename).toBe(REFERENCE_RUN_MANIFEST.iwadFilename);
    expect(manifest.baseCommandLine.length).toBe(REFERENCE_RUN_MANIFEST.baseCommandLine.length);
    expect(manifest.baseCommandLine).toEqual([]);
  });

  test('JSON tic rate and emulated version match the source-level manifest', () => {
    expect(manifest.ticRateHz).toBe(REFERENCE_RUN_MANIFEST.ticRateHz);
    expect(manifest.emulatedVersion).toBe(REFERENCE_RUN_MANIFEST.emulatedVersion);
  });

  test('JSON screen parameters match the source-level manifest', () => {
    expect(manifest.screen.internalWidth).toBe(REFERENCE_RUN_MANIFEST.screen.internalWidth);
    expect(manifest.screen.internalHeight).toBe(REFERENCE_RUN_MANIFEST.screen.internalHeight);
    expect(manifest.screen.displayWidth).toBe(REFERENCE_RUN_MANIFEST.screen.displayWidth);
    expect(manifest.screen.displayHeight).toBe(REFERENCE_RUN_MANIFEST.screen.displayHeight);
    expect(manifest.screen.bitsPerPixel).toBe(REFERENCE_RUN_MANIFEST.screen.bitsPerPixel);
    expect(manifest.screen.aspectRatioCorrect).toBe(REFERENCE_RUN_MANIFEST.screen.aspectRatioCorrect);
    expect(manifest.screen.screenblocks).toBe(REFERENCE_RUN_MANIFEST.screen.screenblocks);
    expect(manifest.screen.detailLevel).toBe(REFERENCE_RUN_MANIFEST.screen.detailLevel);
    expect(manifest.screen.gammaLevel).toBe(REFERENCE_RUN_MANIFEST.screen.gammaLevel);
  });

  test('JSON audio parameters match the source-level manifest', () => {
    expect(manifest.audio.sampleRate).toBe(REFERENCE_RUN_MANIFEST.audio.sampleRate);
    expect(manifest.audio.maxChannels).toBe(REFERENCE_RUN_MANIFEST.audio.maxChannels);
    expect(manifest.audio.sfxDevice).toBe(REFERENCE_RUN_MANIFEST.audio.sfxDevice);
    expect(manifest.audio.musicDevice).toBe(REFERENCE_RUN_MANIFEST.audio.musicDevice);
    expect(manifest.audio.sfxVolume).toBe(REFERENCE_RUN_MANIFEST.audio.sfxVolume);
    expect(manifest.audio.musicVolume).toBe(REFERENCE_RUN_MANIFEST.audio.musicVolume);
    expect(manifest.audio.oplIoPort).toBe(REFERENCE_RUN_MANIFEST.audio.oplIoPort);
  });

  test('JSON startup parameters match the source-level manifest', () => {
    expect(manifest.startup.skill).toBe(REFERENCE_RUN_MANIFEST.startup.skill);
    expect(manifest.startup.episode).toBe(REFERENCE_RUN_MANIFEST.startup.episode);
    expect(manifest.startup.map).toBe(REFERENCE_RUN_MANIFEST.startup.map);
    expect(manifest.startup.deathmatch).toBe(REFERENCE_RUN_MANIFEST.startup.deathmatch);
    expect(manifest.startup.playerCount).toBe(REFERENCE_RUN_MANIFEST.startup.playerCount);
    expect(manifest.startup.totalNodes).toBe(REFERENCE_RUN_MANIFEST.startup.totalNodes);
  });

  test('JSON vanilla compatibility flags match the source-level manifest', () => {
    expect(manifest.vanillaCompatibility.demoLimit).toBe(REFERENCE_RUN_MANIFEST.vanillaCompatibility.demoLimit);
    expect(manifest.vanillaCompatibility.keyboardMapping).toBe(REFERENCE_RUN_MANIFEST.vanillaCompatibility.keyboardMapping);
    expect(manifest.vanillaCompatibility.savegameLimit).toBe(REFERENCE_RUN_MANIFEST.vanillaCompatibility.savegameLimit);
  });
});

describe('init sequence shape and ordering', () => {
  test('init sequence has the source-level pinned length of 15 steps', () => {
    expect(manifest.initSequence).toHaveLength(INIT_SEQUENCE_LENGTH);
    expect(manifest.initSequence).toHaveLength(REFERENCE_RUN_MANIFEST.initSequence.length);
  });

  test('every init step label and description matches the source-level manifest in order', () => {
    const sourceInitSequence = REFERENCE_RUN_MANIFEST.initSequence;
    for (let initStepIndex = 0; initStepIndex < manifest.initSequence.length; initStepIndex += 1) {
      const jsonStep = manifest.initSequence[initStepIndex] as InitStep;
      const sourceStep = sourceInitSequence[initStepIndex] as InitStep;
      expect(jsonStep.label).toBe(sourceStep.label);
      expect(jsonStep.description).toBe(sourceStep.description);
    }
  });

  test('every init step label matches the [A-Z][A-Za-z0-9_]* pattern', () => {
    for (const step of manifest.initSequence as readonly InitStep[]) {
      expect(step.label).toMatch(INIT_STEP_LABEL_PATTERN);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  test('init step labels are unique', () => {
    const labels = (manifest.initSequence as readonly InitStep[]).map((step) => step.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('run modes shape and parity with the source-level manifest', () => {
  test('runModes has exactly two modes: demo-playback and title-loop, sorted', () => {
    expect(manifest.runModes).toHaveLength(2);
    const modes = (manifest.runModes as readonly RunModeEntry[]).map((entry) => entry.mode);
    expect(modes).toEqual(['demo-playback', 'title-loop']);
    for (const modeName of modes) {
      expect(VALID_RUN_MODES.has(modeName)).toBe(true);
    }
  });

  test('every run mode has a non-empty description and frozen additionalArgs array', () => {
    for (const entry of manifest.runModes as readonly RunModeEntry[]) {
      expect(entry.description.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.additionalArgs)).toBe(true);
    }
  });

  test('every run mode entry matches the source-level manifest', () => {
    const sourceRunModes = REFERENCE_RUN_MANIFEST.runModes;
    expect(manifest.runModes).toHaveLength(sourceRunModes.length);
    for (let runModeIndex = 0; runModeIndex < manifest.runModes.length; runModeIndex += 1) {
      const jsonEntry = manifest.runModes[runModeIndex] as RunModeEntry;
      const sourceEntry = sourceRunModes[runModeIndex];
      expect(jsonEntry.mode).toBe(sourceEntry.mode);
      expect(jsonEntry.description).toBe(sourceEntry.description);
      expect(jsonEntry.additionalArgs.length).toBe(sourceEntry.additionalArgs.length);
      for (let argIndex = 0; argIndex < jsonEntry.additionalArgs.length; argIndex += 1) {
        expect(jsonEntry.additionalArgs[argIndex]).toBe(sourceEntry.additionalArgs[argIndex]);
      }
    }
  });
});

describe('alignment with plan_vanilla_parity step 02-004', () => {
  test('step file write lock pins the manifest json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-reference-process-launch-manifest.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-reference-process-launch-manifest.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('step file lists DOOM.EXE and DOOM1.WAD among its research sources', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- doom/DOOM.EXE');
    expect(stepFileText).toContain('- doom/DOOM1.WAD');
  });
});

describe('failure-mode validation invariants', () => {
  test('init step label pattern rejects malformed labels', () => {
    expect('z_init').not.toMatch(INIT_STEP_LABEL_PATTERN);
    expect('1_Init').not.toMatch(INIT_STEP_LABEL_PATTERN);
    expect('Z-Init').not.toMatch(INIT_STEP_LABEL_PATTERN);
    expect('').not.toMatch(INIT_STEP_LABEL_PATTERN);
  });

  test('valid run modes set rejects unknown modes', () => {
    expect(VALID_RUN_MODES.has('save-load')).toBe(false);
    expect(VALID_RUN_MODES.has('')).toBe(false);
    expect(VALID_RUN_MODES.has('demo')).toBe(false);
  });

  test('tic rate must be a positive integer matching vanilla DOOM 1.9 (35 Hz)', () => {
    expect(manifest.ticRateHz).toBeGreaterThan(0);
    expect(Number.isInteger(manifest.ticRateHz)).toBe(true);
    expect(manifest.ticRateHz).toBe(35);
  });
});
