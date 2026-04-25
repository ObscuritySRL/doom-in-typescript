import { describe, expect, test } from 'bun:test';

import { KEY_ESCAPE, KEY_PGUP, KEY_RSHIFT, KEY_UPARROW } from '../../../src/input/keyboard.ts';
import { EMPTY_TICCMD, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
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
  test('exports the exact Bun-only contract', async () => {
    expect(INJECT_DEMO_SCRIPTED_INPUT_CONTRACT).toEqual(EXPECTED_CONTRACT);
    expect(await sha256Hex(JSON.stringify(INJECT_DEMO_SCRIPTED_INPUT_CONTRACT))).toBe(EXPECTED_CONTRACT_HASH);
  });

  test('links the contract to the 01-010 live-input audit manifest', async () => {
    const auditManifest = parseAuditManifest(await Bun.file('plan_fps/manifests/01-010-audit-missing-live-input.json').text());

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
});

interface AuditManifestSurface {
  readonly surface: string;
}

interface AuditManifestShape {
  readonly explicitNullSurfaces: readonly AuditManifestSurface[];
  readonly stepId: string;
}

function parseAuditManifest(value: string): AuditManifestShape {
  return JSON.parse(value) as AuditManifestShape;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
