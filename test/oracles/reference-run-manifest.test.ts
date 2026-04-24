import { describe, expect, test } from 'bun:test';

import { INIT_SEQUENCE_LENGTH, REFERENCE_RUN_MANIFEST } from '../../src/oracles/referenceRunManifest.ts';
import type { AudioParameters, InitStep, ReferenceRunManifest, RunMode, RunModeConfig, ScreenParameters, StartupParameters, VanillaCompatibility } from '../../src/oracles/referenceRunManifest.ts';
import { SANDBOX_REQUIRED_FILES } from '../../src/oracles/referenceSandbox.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';

describe('REFERENCE_RUN_MANIFEST', () => {
  test('executable filename matches sandbox required files', () => {
    const executable = SANDBOX_REQUIRED_FILES.find((entry) => entry.role === 'executable');
    expect(executable).toBeDefined();
    expect(REFERENCE_RUN_MANIFEST.executableFilename).toBe(executable!.filename);
  });

  test('IWAD filename matches sandbox required files and PRIMARY_TARGET', () => {
    const iwad = SANDBOX_REQUIRED_FILES.find((entry) => entry.role === 'iwad');
    expect(iwad).toBeDefined();
    expect(REFERENCE_RUN_MANIFEST.iwadFilename).toBe(iwad!.filename);
    expect(REFERENCE_RUN_MANIFEST.iwadFilename).toBe(PRIMARY_TARGET.wadFilename);
  });

  test('base command line is empty for auto-detected IWAD', () => {
    expect(REFERENCE_RUN_MANIFEST.baseCommandLine).toHaveLength(0);
  });

  test('tic rate matches PRIMARY_TARGET', () => {
    expect(REFERENCE_RUN_MANIFEST.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
    expect(REFERENCE_RUN_MANIFEST.ticRateHz).toBe(35);
  });

  test('emulated version matches PRIMARY_TARGET', () => {
    expect(REFERENCE_RUN_MANIFEST.emulatedVersion).toBe(PRIMARY_TARGET.emulatedVersion);
    expect(REFERENCE_RUN_MANIFEST.emulatedVersion).toBe('1.9');
  });

  test('object is frozen at top level and nested objects', () => {
    expect(Object.isFrozen(REFERENCE_RUN_MANIFEST)).toBe(true);
    expect(Object.isFrozen(REFERENCE_RUN_MANIFEST.screen)).toBe(true);
    expect(Object.isFrozen(REFERENCE_RUN_MANIFEST.audio)).toBe(true);
    expect(Object.isFrozen(REFERENCE_RUN_MANIFEST.startup)).toBe(true);
    expect(Object.isFrozen(REFERENCE_RUN_MANIFEST.vanillaCompatibility)).toBe(true);
    expect(Object.isFrozen(REFERENCE_RUN_MANIFEST.baseCommandLine)).toBe(true);
    expect(Object.isFrozen(REFERENCE_RUN_MANIFEST.initSequence)).toBe(true);
    expect(Object.isFrozen(REFERENCE_RUN_MANIFEST.runModes)).toBe(true);
  });
});

describe('ScreenParameters', () => {
  const screen = REFERENCE_RUN_MANIFEST.screen;

  test("internal framebuffer is Doom's fixed 320x200", () => {
    expect(screen.internalWidth).toBe(320);
    expect(screen.internalHeight).toBe(200);
  });

  test('display output matches chocolate-doom.cfg (640x480x32)', () => {
    expect(screen.displayWidth).toBe(640);
    expect(screen.displayHeight).toBe(480);
    expect(screen.bitsPerPixel).toBe(32);
  });

  test('aspect ratio correction is enabled per chocolate-doom.cfg', () => {
    expect(screen.aspectRatioCorrect).toBe(true);
  });

  test('screenblocks is 9 per default.cfg', () => {
    expect(screen.screenblocks).toBe(9);
  });

  test('detail level 0 (high) and gamma 0 per default.cfg', () => {
    expect(screen.detailLevel).toBe(0);
    expect(screen.gammaLevel).toBe(0);
  });

  test('internal framebuffer pixel count is 64000', () => {
    expect(screen.internalWidth * screen.internalHeight).toBe(64_000);
  });

  test('display dimensions maintain 4:3 aspect ratio', () => {
    expect(screen.displayWidth / screen.displayHeight).toBeCloseTo(4 / 3);
  });
});

describe('AudioParameters', () => {
  const audio = REFERENCE_RUN_MANIFEST.audio;

  test('sample rate is 44100 Hz per chocolate-doom.cfg', () => {
    expect(audio.sampleRate).toBe(44_100);
  });

  test('max channels is 8 per default.cfg', () => {
    expect(audio.maxChannels).toBe(8);
  });

  test('SFX and music devices are both 3 per default.cfg', () => {
    expect(audio.sfxDevice).toBe(3);
    expect(audio.musicDevice).toBe(3);
  });

  test('SFX and music volumes are both 8 per default.cfg', () => {
    expect(audio.sfxVolume).toBe(8);
    expect(audio.musicVolume).toBe(8);
  });

  test('OPL I/O port is 0x388 per chocolate-doom.cfg', () => {
    expect(audio.oplIoPort).toBe(0x388);
  });

  test('volumes are within valid Doom range 0-15', () => {
    expect(audio.sfxVolume).toBeGreaterThanOrEqual(0);
    expect(audio.sfxVolume).toBeLessThanOrEqual(15);
    expect(audio.musicVolume).toBeGreaterThanOrEqual(0);
    expect(audio.musicVolume).toBeLessThanOrEqual(15);
  });
});

describe('StartupParameters', () => {
  const startup = REFERENCE_RUN_MANIFEST.startup;

  test('skill 2 (Hurt me plenty) per reference stdout', () => {
    expect(startup.skill).toBe(2);
  });

  test('episode 1, map 1 per reference stdout', () => {
    expect(startup.episode).toBe(1);
    expect(startup.map).toBe(1);
  });

  test('no deathmatch per reference stdout', () => {
    expect(startup.deathmatch).toBe(0);
  });

  test('single player, single node per reference stdout', () => {
    expect(startup.playerCount).toBe(1);
    expect(startup.totalNodes).toBe(1);
  });

  test('player count does not exceed total nodes', () => {
    expect(startup.playerCount).toBeLessThanOrEqual(startup.totalNodes);
  });
});

describe('VanillaCompatibility', () => {
  const compat = REFERENCE_RUN_MANIFEST.vanillaCompatibility;

  test('all three vanilla flags are enabled per F-023', () => {
    expect(compat.demoLimit).toBe(true);
    expect(compat.keyboardMapping).toBe(true);
    expect(compat.savegameLimit).toBe(true);
  });

  test('fields are in ASCIIbetical order', () => {
    const keys = Object.keys(compat);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });
});

describe('InitSequence', () => {
  const sequence = REFERENCE_RUN_MANIFEST.initSequence;

  test('contains exactly INIT_SEQUENCE_LENGTH steps', () => {
    expect(sequence).toHaveLength(INIT_SEQUENCE_LENGTH);
    expect(INIT_SEQUENCE_LENGTH).toBe(15);
  });

  test('every step has non-empty label and description', () => {
    for (const step of sequence) {
      expect(step.label.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  test('labels are unique', () => {
    const labels = sequence.map((step) => step.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  test('starts with Z_Init and ends with I_InitStretchTables', () => {
    expect(sequence[0].label).toBe('Z_Init');
    expect(sequence[sequence.length - 1].label).toBe('I_InitStretchTables');
  });

  test('R_Init precedes P_Init which precedes S_Init (render before play before sound)', () => {
    const labels = sequence.map((step) => step.label);
    const renderIndex = labels.indexOf('R_Init');
    const playIndex = labels.indexOf('P_Init');
    const soundIndex = labels.indexOf('S_Init');
    expect(renderIndex).toBeLessThan(playIndex);
    expect(playIndex).toBeLessThan(soundIndex);
  });

  test('W_Init (WAD) precedes R_Init (renderer needs WAD data)', () => {
    const labels = sequence.map((step) => step.label);
    expect(labels.indexOf('W_Init')).toBeLessThan(labels.indexOf('R_Init'));
  });

  test('each step object is frozen', () => {
    for (const step of sequence) {
      expect(Object.isFrozen(step)).toBe(true);
    }
  });
});

describe('RunModes', () => {
  const modes = REFERENCE_RUN_MANIFEST.runModes;

  test('contains exactly 2 run modes', () => {
    expect(modes).toHaveLength(2);
  });

  test('modes are in ASCIIbetical order', () => {
    const modeNames = modes.map((runMode) => runMode.mode);
    const sorted = [...modeNames].sort();
    expect(modeNames).toEqual(sorted);
  });

  test('includes demo-playback and title-loop', () => {
    const modeNames = modes.map((runMode) => runMode.mode);
    expect(modeNames).toContain('demo-playback');
    expect(modeNames).toContain('title-loop');
  });

  test('every mode has non-empty description', () => {
    for (const runMode of modes) {
      expect(runMode.description.length).toBeGreaterThan(0);
    }
  });

  test('each mode object is frozen with frozen additionalArgs', () => {
    for (const runMode of modes) {
      expect(Object.isFrozen(runMode)).toBe(true);
      expect(Object.isFrozen(runMode.additionalArgs)).toBe(true);
    }
  });
});

describe('compile-time interface satisfaction', () => {
  test('REFERENCE_RUN_MANIFEST satisfies ReferenceRunManifest', () => {
    const manifest: ReferenceRunManifest = REFERENCE_RUN_MANIFEST;
    expect(manifest).toBe(REFERENCE_RUN_MANIFEST);
  });

  test('screen satisfies ScreenParameters', () => {
    const screen: ScreenParameters = REFERENCE_RUN_MANIFEST.screen;
    expect(screen).toBe(REFERENCE_RUN_MANIFEST.screen);
  });

  test('audio satisfies AudioParameters', () => {
    const audio: AudioParameters = REFERENCE_RUN_MANIFEST.audio;
    expect(audio).toBe(REFERENCE_RUN_MANIFEST.audio);
  });

  test('startup satisfies StartupParameters', () => {
    const startup: StartupParameters = REFERENCE_RUN_MANIFEST.startup;
    expect(startup).toBe(REFERENCE_RUN_MANIFEST.startup);
  });

  test('vanillaCompatibility satisfies VanillaCompatibility', () => {
    const compat: VanillaCompatibility = REFERENCE_RUN_MANIFEST.vanillaCompatibility;
    expect(compat).toBe(REFERENCE_RUN_MANIFEST.vanillaCompatibility);
  });

  test('initSequence elements satisfy InitStep', () => {
    const step: InitStep = REFERENCE_RUN_MANIFEST.initSequence[0];
    expect(step).toBe(REFERENCE_RUN_MANIFEST.initSequence[0]);
  });

  test('runModes elements satisfy RunModeConfig', () => {
    const config: RunModeConfig = REFERENCE_RUN_MANIFEST.runModes[0];
    expect(config).toBe(REFERENCE_RUN_MANIFEST.runModes[0]);
  });

  test('run mode discriminant satisfies RunMode type', () => {
    const mode: RunMode = REFERENCE_RUN_MANIFEST.runModes[0].mode;
    expect(typeof mode).toBe('string');
  });
});
