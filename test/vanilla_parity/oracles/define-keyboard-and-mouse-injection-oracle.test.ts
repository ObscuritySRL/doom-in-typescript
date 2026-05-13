import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import injection from './define-keyboard-and-mouse-injection-oracle.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-010-define-keyboard-and-mouse-injection-oracle.md';
const VALID_INPUT_TYPES = new Set(['INPUT_KEYBOARD', 'INPUT_MOUSE', 'INPUT_HARDWARE']);
const VALID_MOTION_MODES = new Set(['relative', 'absolute']);

describe('injection identity and metadata', () => {
  test('declares OR-VP-INJECTION-010 oracle id, step 02-010, and oracle lane', () => {
    expect(injection.id).toBe('OR-VP-INJECTION-010');
    expect(injection.stepId).toBe('02-010');
    expect(injection.stepTitle).toBe('Define Keyboard And Mouse Injection Oracle');
    expect(injection.lane).toBe('oracle');
  });

  test('pins Win64 host and the SendInput Windows API', () => {
    expect(injection.hostOperatingSystem).toBe('Win64');
    expect(injection.windowsApi).toBe('user32!SendInput');
  });

  test('pins DOOM.EXE as the target process executable with foreground required', () => {
    expect(injection.targetProcess.executableFilename).toBe('DOOM.EXE');
    expect(injection.targetProcess.foregroundRequired).toBe(true);
    expect(injection.targetProcess.windowClassNamePattern.length).toBeGreaterThan(0);
  });

  test('pins the 02-009 input stream format as the upstream source', () => {
    expect(injection.inputStreamSource).toBe('test/vanilla_parity/oracles/define-deterministic-input-stream-format.json');
    expect(existsSync(injection.inputStreamSource)).toBe(true);
  });

  test('pins the canonical 35 Hz tic rate anchor', () => {
    expect(injection.ticRateHzAnchor).toBe(35);
  });
});

describe('keyboard injection protocol', () => {
  test('uses INPUT_KEYBOARD with scancode-mode flags', () => {
    expect(VALID_INPUT_TYPES.has(injection.keyboardInjection.inputType)).toBe(true);
    expect(injection.keyboardInjection.inputType).toBe('INPUT_KEYBOARD');
    expect(injection.keyboardInjection.flagsForKeyDown).toContain('KEYEVENTF_SCANCODE');
    expect(injection.keyboardInjection.flagsForKeyUp).toContain('KEYEVENTF_KEYUP');
    expect(injection.keyboardInjection.flagsForKeyUp).toContain('KEYEVENTF_SCANCODE');
  });

  test('scan code field maps to KEYBDINPUT.wScan', () => {
    expect(injection.keyboardInjection.scanCodeFieldName).toBe('wScan');
  });

  test('extended flag is enabled for arrow keys', () => {
    expect(injection.keyboardInjection.useExtendedFlagForArrowKeys).toBe(true);
  });
});

describe('mouse injection protocol', () => {
  test('uses INPUT_MOUSE with relative motion', () => {
    expect(VALID_INPUT_TYPES.has(injection.mouseInjection.inputType)).toBe(true);
    expect(injection.mouseInjection.inputType).toBe('INPUT_MOUSE');
    expect(VALID_MOTION_MODES.has(injection.mouseInjection.motionMode)).toBe(true);
    expect(injection.mouseInjection.motionMode).toBe('relative');
    expect(injection.mouseInjection.motionFlags).toContain('MOUSEEVENTF_MOVE');
  });

  test('button flags cover left, right, and middle down/up', () => {
    expect(injection.mouseInjection.buttonFlags.button0Down).toBe('MOUSEEVENTF_LEFTDOWN');
    expect(injection.mouseInjection.buttonFlags.button0Up).toBe('MOUSEEVENTF_LEFTUP');
    expect(injection.mouseInjection.buttonFlags.button1Down).toBe('MOUSEEVENTF_RIGHTDOWN');
    expect(injection.mouseInjection.buttonFlags.button1Up).toBe('MOUSEEVENTF_RIGHTUP');
    expect(injection.mouseInjection.buttonFlags.button2Down).toBe('MOUSEEVENTF_MIDDLEDOWN');
    expect(injection.mouseInjection.buttonFlags.button2Up).toBe('MOUSEEVENTF_MIDDLEUP');
  });

  test('delta axis scaling is 1 in both X and Y by default', () => {
    expect(injection.mouseInjection.deltaScaleAxisX).toBe(1);
    expect(injection.mouseInjection.deltaScaleAxisY).toBe(1);
  });
});

describe('tic batching rule', () => {
  test('declares the deterministic per-tic batching rule', () => {
    expect(injection.ticBatchingRule.length).toBeGreaterThan(0);
    expect(injection.ticBatchingRule).toContain('tic');
  });
});

describe('alignment with plan_vanilla_parity step 02-010', () => {
  test('step file write lock pins the injection json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-keyboard-and-mouse-injection-oracle.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-keyboard-and-mouse-injection-oracle.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('invalid input types are rejected', () => {
    expect(VALID_INPUT_TYPES.has('INPUT_TOUCH')).toBe(false);
    expect(VALID_INPUT_TYPES.has('')).toBe(false);
  });

  test('invalid motion modes are rejected', () => {
    expect(VALID_MOTION_MODES.has('clamped')).toBe(false);
    expect(VALID_MOTION_MODES.has('')).toBe(false);
  });

  test('downstream follow-ups list is non-empty and unique', () => {
    expect(injection.downstreamFollowUps.length).toBeGreaterThan(0);
    expect(new Set(injection.downstreamFollowUps).size).toBe(injection.downstreamFollowUps.length);
  });
});
