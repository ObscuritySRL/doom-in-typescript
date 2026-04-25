import { describe, expect, test } from 'bun:test';

import { KEY_ESCAPE, KEY_PGUP, KEY_RSHIFT, KEY_UPARROW } from '../../../src/input/keyboard.ts';
import { EMPTY_TICCMD, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import type { DemoScriptedInputEvent } from '../../../src/playable/input/injectDemoScriptedInput.ts';
import { INJECT_DEMO_SCRIPTED_INPUT_CONTRACT, injectDemoScriptedInput } from '../../../src/playable/input/injectDemoScriptedInput.ts';

const EXPECTED_CONTRACT = {
  auditManifestStepId: '01-010',
  injectionStage: 'post-translation-doom-key',
  neutralTicCommandSize: 8,
  replayCompatibility: 'deterministic',
  runtimeCommand: 'bun run doom.ts',
  scriptedEventTypes: ['keydown', 'keyup'],
  supportedDoomKeys: [0x77, 0x73, 0xad, 0xaf, 0x61, 0x64, 0xac, 0xae, 0x71, 0x65, 0xb6, 0x09, 0xc9, 0xd1, 0x66, 0x1b],
} as const;

const EXPECTED_CONTRACT_HASH = '1cfafbebd26737413b6d070051087ac70ee155354ad12b7e3124dd43002d15d4';

describe('injectDemoScriptedInput', () => {
  test('exports the exact Bun-only contract', () => {
    expect(INJECT_DEMO_SCRIPTED_INPUT_CONTRACT).toEqual(EXPECTED_CONTRACT);
    expect(sha256Hex(JSON.stringify(INJECT_DEMO_SCRIPTED_INPUT_CONTRACT))).toBe(EXPECTED_CONTRACT_HASH);
    expect(Object.isFrozen(INJECT_DEMO_SCRIPTED_INPUT_CONTRACT)).toBe(true);
    expect(Object.isFrozen(INJECT_DEMO_SCRIPTED_INPUT_CONTRACT.scriptedEventTypes)).toBe(true);
    expect(Object.isFrozen(INJECT_DEMO_SCRIPTED_INPUT_CONTRACT.supportedDoomKeys)).toBe(true);
  });

  test('links the contract to the 01-010 live-input audit manifest', async () => {
    const auditManifest = (await Bun.file('plan_fps/manifests/01-010-audit-missing-live-input.json').json()) as AuditManifestShape;

    expect(auditManifest.stepId).toBe(INJECT_DEMO_SCRIPTED_INPUT_CONTRACT.auditManifestStepId);
    expect(auditManifest.explicitNullSurfaces.some(({ surface }) => surface === 'per-tic-input-accumulation')).toBe(true);
    expect(auditManifest.explicitNullSurfaces.some(({ surface }) => surface === 'input-event-source')).toBe(true);
  });

  test('injects only the scripted events for the requested tic and advances held keys', () => {
    const scriptedInput = injectDemoScriptedInput({
      currentTic: 3,
      heldKeys: [KEY_UPARROW],
      nextScriptIndex: 1,
      runtimeCommand: 'bun run doom.ts',
      scriptedEvents: [
        { doomKey: KEY_UPARROW, tic: 1, type: 'keydown' },
        { doomKey: KEY_RSHIFT, tic: 3, type: 'keydown' },
        { doomKey: KEY_PGUP, tic: 3, type: 'keydown' },
        { doomKey: KEY_PGUP, tic: 4, type: 'keyup' },
      ],
    });

    expect(scriptedInput).toEqual({
      currentTic: 3,
      heldKeys: [KEY_UPARROW, KEY_RSHIFT, KEY_PGUP].sort((left, right) => left - right),
      injectedEvents: [
        { doomKey: KEY_RSHIFT, tic: 3, type: 'keydown' },
        { doomKey: KEY_PGUP, tic: 3, type: 'keydown' },
      ],
      nextScriptIndex: 3,
      ticCommand: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
    });
    expect(Object.isFrozen(scriptedInput)).toBe(true);
    expect(Object.isFrozen(scriptedInput.heldKeys)).toBe(true);
    expect(Object.isFrozen(scriptedInput.injectedEvents)).toBe(true);

    for (const injectedEvent of scriptedInput.injectedEvents) {
      expect(Object.isFrozen(injectedEvent)).toBe(true);
    }

    expect(scriptedInput.heldKeys).toEqual([...scriptedInput.heldKeys].sort((left, right) => left - right));
  });

  test('releases scripted keys deterministically on keyup events', () => {
    const scriptedInput = injectDemoScriptedInput({
      currentTic: 7,
      heldKeys: [KEY_RSHIFT, KEY_UPARROW],
      nextScriptIndex: 0,
      runtimeCommand: 'bun run doom.ts',
      scriptedEvents: [
        { doomKey: KEY_RSHIFT, tic: 7, type: 'keyup' },
        { doomKey: KEY_ESCAPE, tic: 8, type: 'keydown' },
      ],
    });

    expect(scriptedInput).toEqual({
      currentTic: 7,
      heldKeys: [KEY_UPARROW],
      injectedEvents: [{ doomKey: KEY_RSHIFT, tic: 7, type: 'keyup' }],
      nextScriptIndex: 1,
      ticCommand: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
    });
  });

  test('returns an empty injection when scriptedEvents is empty', () => {
    const scriptedInput = injectDemoScriptedInput({
      currentTic: 0,
      heldKeys: [],
      nextScriptIndex: 0,
      runtimeCommand: 'bun run doom.ts',
      scriptedEvents: [],
    });

    expect(scriptedInput).toEqual({
      currentTic: 0,
      heldKeys: [],
      injectedEvents: [],
      nextScriptIndex: 0,
      ticCommand: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
    });
    expect(Object.isFrozen(scriptedInput.injectedEvents)).toBe(true);
    expect(Object.isFrozen(scriptedInput.heldKeys)).toBe(true);
  });

  test('returns an empty injection when nextScriptIndex equals scriptedEvents.length', () => {
    const scriptedInput = injectDemoScriptedInput({
      currentTic: 5,
      heldKeys: [KEY_UPARROW],
      nextScriptIndex: 1,
      runtimeCommand: 'bun run doom.ts',
      scriptedEvents: [{ doomKey: KEY_UPARROW, tic: 4, type: 'keydown' }],
    });

    expect(scriptedInput.injectedEvents).toEqual([]);
    expect(scriptedInput.nextScriptIndex).toBe(1);
    expect(scriptedInput.heldKeys).toEqual([KEY_UPARROW]);
  });

  test('breaks early without throwing when only future-tic events remain', () => {
    const scriptedInput = injectDemoScriptedInput({
      currentTic: 2,
      heldKeys: [],
      nextScriptIndex: 0,
      runtimeCommand: 'bun run doom.ts',
      scriptedEvents: [{ doomKey: KEY_UPARROW, tic: 5, type: 'keydown' }],
    });

    expect(scriptedInput.injectedEvents).toEqual([]);
    expect(scriptedInput.nextScriptIndex).toBe(0);
  });

  test('preserves source order across multiple same-tic events', () => {
    const scriptedInput = injectDemoScriptedInput({
      currentTic: 4,
      heldKeys: [],
      nextScriptIndex: 0,
      runtimeCommand: 'bun run doom.ts',
      scriptedEvents: [
        { doomKey: KEY_UPARROW, tic: 4, type: 'keydown' },
        { doomKey: KEY_RSHIFT, tic: 4, type: 'keydown' },
        { doomKey: KEY_PGUP, tic: 4, type: 'keydown' },
      ],
    });

    expect(scriptedInput.injectedEvents.map(({ doomKey }) => doomKey)).toEqual([KEY_UPARROW, KEY_RSHIFT, KEY_PGUP]);
    expect(scriptedInput.nextScriptIndex).toBe(3);
  });

  test('rejects non-Bun runtime commands', () => {
    expect(() =>
      injectDemoScriptedInput({
        currentTic: 0,
        heldKeys: [],
        nextScriptIndex: 0,
        runtimeCommand: 'bun run src/main.ts',
        scriptedEvents: [],
      }),
    ).toThrow('injectDemoScriptedInput requires bun run doom.ts');
  });

  test('rejects out-of-order or unsupported scripted events', () => {
    expect(() =>
      injectDemoScriptedInput({
        currentTic: 2,
        heldKeys: [],
        nextScriptIndex: 0,
        runtimeCommand: 'bun run doom.ts',
        scriptedEvents: [{ doomKey: KEY_UPARROW, tic: 1, type: 'keydown' }],
      }),
    ).toThrow('Demo scripted input events must stay ordered by tic.');

    expect(() =>
      injectDemoScriptedInput({
        currentTic: 2,
        heldKeys: [],
        nextScriptIndex: 0,
        runtimeCommand: 'bun run doom.ts',
        scriptedEvents: [{ doomKey: 0x70, tic: 2, type: 'keydown' }],
      }),
    ).toThrow('Demo scripted input only supports Doom keys from the documented control set.');
  });

  test.each([
    { case: 'negative', currentTic: -1 },
    { case: 'non-integer', currentTic: 1.5 },
    { case: 'NaN', currentTic: Number.NaN },
  ])('rejects $case currentTic ($currentTic)', ({ currentTic }) => {
    expect(() =>
      injectDemoScriptedInput({
        currentTic,
        heldKeys: [],
        nextScriptIndex: 0,
        runtimeCommand: 'bun run doom.ts',
        scriptedEvents: [],
      }),
    ).toThrow('Demo scripted input requires a non-negative current tic.');
  });

  test.each([
    { case: 'negative', nextScriptIndex: -1 },
    { case: 'non-integer', nextScriptIndex: 0.5 },
    { case: 'over the scripted event range', nextScriptIndex: 2 },
  ])('rejects $case nextScriptIndex ($nextScriptIndex)', ({ nextScriptIndex }) => {
    expect(() =>
      injectDemoScriptedInput({
        currentTic: 0,
        heldKeys: [],
        nextScriptIndex,
        runtimeCommand: 'bun run doom.ts',
        scriptedEvents: [{ doomKey: KEY_UPARROW, tic: 0, type: 'keydown' }],
      }),
    ).toThrow('Demo scripted input requires a next script index within the scripted event range.');
  });

  test('rejects scripted events with negative or non-integer tics', () => {
    expect(() =>
      injectDemoScriptedInput({
        currentTic: 0,
        heldKeys: [],
        nextScriptIndex: 0,
        runtimeCommand: 'bun run doom.ts',
        scriptedEvents: [{ doomKey: KEY_UPARROW, tic: -1, type: 'keydown' } as DemoScriptedInputEvent],
      }),
    ).toThrow('Demo scripted input events require non-negative integer tic values.');

    expect(() =>
      injectDemoScriptedInput({
        currentTic: 0,
        heldKeys: [],
        nextScriptIndex: 0,
        runtimeCommand: 'bun run doom.ts',
        scriptedEvents: [{ doomKey: KEY_UPARROW, tic: 1.5, type: 'keydown' } as DemoScriptedInputEvent],
      }),
    ).toThrow('Demo scripted input events require non-negative integer tic values.');
  });

  test('rejects scripted events with unsupported types', () => {
    expect(() =>
      injectDemoScriptedInput({
        currentTic: 0,
        heldKeys: [],
        nextScriptIndex: 0,
        runtimeCommand: 'bun run doom.ts',
        scriptedEvents: [{ doomKey: KEY_UPARROW, tic: 0, type: 'mousedown' as 'keydown' }],
      }),
    ).toThrow('Demo scripted input only supports keydown and keyup events.');
  });

  test('rejects unsupported held keys', () => {
    expect(() =>
      injectDemoScriptedInput({
        currentTic: 0,
        heldKeys: [0x70],
        nextScriptIndex: 0,
        runtimeCommand: 'bun run doom.ts',
        scriptedEvents: [],
      }),
    ).toThrow('Demo scripted input only supports Doom keys from the documented control set.');
  });
});

interface AuditManifestSurface {
  readonly surface: string;
}

interface AuditManifestShape {
  readonly explicitNullSurfaces: readonly AuditManifestSurface[];
  readonly stepId: string;
}

function sha256Hex(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}
