import { describe, expect, it } from 'bun:test';

import { createHash } from 'node:crypto';

import { KEY_DOWNARROW, KEY_ESCAPE, KEY_LEFTARROW, KEY_PGDN, KEY_PGUP, KEY_RIGHTARROW, KEY_RSHIFT, KEY_TAB, KEY_UPARROW } from '../../../src/input/keyboard.ts';
import { ANGLE_TURN, EMPTY_TICCMD, FORWARD_MOVE, packTicCommand, SIDE_MOVE } from '../../../src/input/ticcmd.ts';
import { MAP_INTERNAL_DOOM_KEYS_CONTRACT, mapInternalDoomKeys } from '../../../src/playable/input/mapInternalDoomKeys.ts';

interface AuditDocumentedInputControl {
  readonly action: string;
  readonly control: string;
  readonly sourceOrder: number;
}

interface AuditExplicitNullSurface {
  readonly evidence: string;
  readonly path: null;
  readonly reason: string;
  readonly surface: string;
  readonly symbol: null;
}

interface AuditMissingLiveInputManifest {
  readonly documentedInputControls: readonly AuditDocumentedInputControl[];
  readonly explicitNullSurfaces: readonly AuditExplicitNullSurface[];
  readonly stepId: string;
}

const EXPECTED_CONTRACT = {
  auditManifestPath: 'plan_fps/manifests/01-010-audit-missing-live-input.json',
  auditedMissingSurface: 'key-translation-table',
  deterministicReplayRule: 'Map Doom internal keys to stable semantic actions and frozen ticcmd deltas without timestamps or tic mutation.',
  documentedControls: ['W/S or Up/Down', 'A/D or Left/Right', 'Q/E', 'Shift', 'Tab', 'PageUp/PageDown', 'F', 'Esc'],
  keyboardModulePath: 'src/input/keyboard.ts',
  runtimeCommand: 'bun run doom.ts',
  ticCommandModulePath: 'src/input/ticcmd.ts',
  mappings: [
    {
      action: 'move-forward',
      doomKey: 'w'.charCodeAt(0),
      doomKeyLabel: 'w',
      domain: 'gameplay',
      impulse: 'continuous',
      movementTable: 'FORWARD_MOVE',
      movementTableIndex: 0,
      ticCommandDelta: packTicCommand(FORWARD_MOVE[0], 0, 0, 0, 0, 0),
    },
    {
      action: 'move-forward',
      doomKey: KEY_UPARROW,
      doomKeyLabel: 'KEY_UPARROW',
      domain: 'gameplay',
      impulse: 'continuous',
      movementTable: 'FORWARD_MOVE',
      movementTableIndex: 0,
      ticCommandDelta: packTicCommand(FORWARD_MOVE[0], 0, 0, 0, 0, 0),
    },
    {
      action: 'move-backward',
      doomKey: 's'.charCodeAt(0),
      doomKeyLabel: 's',
      domain: 'gameplay',
      impulse: 'continuous',
      movementTable: 'FORWARD_MOVE',
      movementTableIndex: 0,
      ticCommandDelta: packTicCommand(-FORWARD_MOVE[0], 0, 0, 0, 0, 0),
    },
    {
      action: 'move-backward',
      doomKey: KEY_DOWNARROW,
      doomKeyLabel: 'KEY_DOWNARROW',
      domain: 'gameplay',
      impulse: 'continuous',
      movementTable: 'FORWARD_MOVE',
      movementTableIndex: 0,
      ticCommandDelta: packTicCommand(-FORWARD_MOVE[0], 0, 0, 0, 0, 0),
    },
    {
      action: 'turn-left',
      doomKey: 'a'.charCodeAt(0),
      doomKeyLabel: 'a',
      domain: 'gameplay',
      impulse: 'continuous',
      movementTable: 'ANGLE_TURN',
      movementTableIndex: 0,
      ticCommandDelta: packTicCommand(0, 0, ANGLE_TURN[0], 0, 0, 0),
    },
    {
      action: 'turn-left',
      doomKey: KEY_LEFTARROW,
      doomKeyLabel: 'KEY_LEFTARROW',
      domain: 'gameplay',
      impulse: 'continuous',
      movementTable: 'ANGLE_TURN',
      movementTableIndex: 0,
      ticCommandDelta: packTicCommand(0, 0, ANGLE_TURN[0], 0, 0, 0),
    },
    {
      action: 'turn-right',
      doomKey: 'd'.charCodeAt(0),
      doomKeyLabel: 'd',
      domain: 'gameplay',
      impulse: 'continuous',
      movementTable: 'ANGLE_TURN',
      movementTableIndex: 0,
      ticCommandDelta: packTicCommand(0, 0, -ANGLE_TURN[0], 0, 0, 0),
    },
    {
      action: 'turn-right',
      doomKey: KEY_RIGHTARROW,
      doomKeyLabel: 'KEY_RIGHTARROW',
      domain: 'gameplay',
      impulse: 'continuous',
      movementTable: 'ANGLE_TURN',
      movementTableIndex: 0,
      ticCommandDelta: packTicCommand(0, 0, -ANGLE_TURN[0], 0, 0, 0),
    },
    {
      action: 'strafe-left',
      doomKey: 'q'.charCodeAt(0),
      doomKeyLabel: 'q',
      domain: 'gameplay',
      impulse: 'continuous',
      movementTable: 'SIDE_MOVE',
      movementTableIndex: 0,
      ticCommandDelta: packTicCommand(0, -SIDE_MOVE[0], 0, 0, 0, 0),
    },
    {
      action: 'strafe-right',
      doomKey: 'e'.charCodeAt(0),
      doomKeyLabel: 'e',
      domain: 'gameplay',
      impulse: 'continuous',
      movementTable: 'SIDE_MOVE',
      movementTableIndex: 0,
      ticCommandDelta: packTicCommand(0, SIDE_MOVE[0], 0, 0, 0, 0),
    },
    {
      action: 'run',
      doomKey: KEY_RSHIFT,
      doomKeyLabel: 'KEY_RSHIFT',
      domain: 'gameplay',
      impulse: 'continuous',
      movementTable: 'speed-modifier',
      movementTableIndex: 1,
      ticCommandDelta: EMPTY_TICCMD,
    },
    {
      action: 'automap-toggle',
      doomKey: KEY_TAB,
      doomKeyLabel: 'KEY_TAB',
      domain: 'host',
      impulse: 'edge',
      movementTable: 'none',
      movementTableIndex: null,
      ticCommandDelta: EMPTY_TICCMD,
    },
    {
      action: 'automap-zoom-in',
      doomKey: KEY_PGUP,
      doomKeyLabel: 'KEY_PGUP',
      domain: 'host',
      impulse: 'continuous',
      movementTable: 'none',
      movementTableIndex: null,
      ticCommandDelta: EMPTY_TICCMD,
    },
    {
      action: 'automap-zoom-out',
      doomKey: KEY_PGDN,
      doomKeyLabel: 'KEY_PGDN',
      domain: 'host',
      impulse: 'continuous',
      movementTable: 'none',
      movementTableIndex: null,
      ticCommandDelta: EMPTY_TICCMD,
    },
    {
      action: 'automap-follow',
      doomKey: 'f'.charCodeAt(0),
      doomKeyLabel: 'f',
      domain: 'host',
      impulse: 'edge',
      movementTable: 'none',
      movementTableIndex: null,
      ticCommandDelta: EMPTY_TICCMD,
    },
    {
      action: 'quit',
      doomKey: KEY_ESCAPE,
      doomKeyLabel: 'KEY_ESCAPE',
      domain: 'host',
      impulse: 'edge',
      movementTable: 'none',
      movementTableIndex: null,
      ticCommandDelta: EMPTY_TICCMD,
    },
  ],
} as const;

const EXPECTED_CONTRACT_HASH = '91942e1644e6e9aef2d6b107b6af1dbc5c8323a10e4e7b6b64e465486dd68c77';

function computeHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isAuditDocumentedInputControl(value: unknown): value is AuditDocumentedInputControl {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.action === 'string' && typeof candidate.control === 'string' && typeof candidate.sourceOrder === 'number';
}

function isAuditExplicitNullSurface(value: unknown): value is AuditExplicitNullSurface {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.evidence === 'string' && candidate.path === null && typeof candidate.reason === 'string' && typeof candidate.surface === 'string' && candidate.symbol === null;
}

function isAuditMissingLiveInputManifest(value: unknown): value is AuditMissingLiveInputManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.documentedInputControls) &&
    candidate.documentedInputControls.every(isAuditDocumentedInputControl) &&
    Array.isArray(candidate.explicitNullSurfaces) &&
    candidate.explicitNullSurfaces.every(isAuditExplicitNullSurface) &&
    typeof candidate.stepId === 'string'
  );
}

describe('mapInternalDoomKeys', () => {
  it('exports the exact Bun-only contract', () => {
    expect(MAP_INTERNAL_DOOM_KEYS_CONTRACT).toEqual(EXPECTED_CONTRACT);
  });

  it('locks the stable contract hash', () => {
    expect(computeHash(MAP_INTERNAL_DOOM_KEYS_CONTRACT)).toBe(EXPECTED_CONTRACT_HASH);
  });

  it('matches the 01-010 audit manifest controls and missing surface', async () => {
    const manifestValue: unknown = await Bun.file(MAP_INTERNAL_DOOM_KEYS_CONTRACT.auditManifestPath).json();
    expect(isAuditMissingLiveInputManifest(manifestValue)).toBe(true);
    if (!isAuditMissingLiveInputManifest(manifestValue)) {
      throw new Error('Expected a valid 01-010 audit manifest shape.');
    }

    const documentedControls = manifestValue.documentedInputControls.toSorted((leftControl, rightControl) => leftControl.sourceOrder - rightControl.sourceOrder).map((control) => control.control);
    expect(documentedControls).toEqual([...MAP_INTERNAL_DOOM_KEYS_CONTRACT.documentedControls]);
    expect(manifestValue.stepId).toBe('01-010');
    expect(manifestValue.explicitNullSurfaces).toContainEqual({
      evidence: 'src/main.ts HELP_TEXT documents control labels but defines no Doom key mapping table.',
      path: null,
      reason: 'No key translation table is visible within the 01-010 read scope.',
      surface: 'key-translation-table',
      symbol: null,
    });
  });

  it('maps gameplay movement and run keys to deterministic ticcmd metadata', () => {
    expect(mapInternalDoomKeys({ doomKey: 'w'.charCodeAt(0), runtimeCommand: MAP_INTERNAL_DOOM_KEYS_CONTRACT.runtimeCommand })).toEqual(EXPECTED_CONTRACT.mappings[0]);
    expect(mapInternalDoomKeys({ doomKey: KEY_LEFTARROW, runtimeCommand: MAP_INTERNAL_DOOM_KEYS_CONTRACT.runtimeCommand })).toEqual(EXPECTED_CONTRACT.mappings[5]);
    expect(mapInternalDoomKeys({ doomKey: 'e'.charCodeAt(0), runtimeCommand: MAP_INTERNAL_DOOM_KEYS_CONTRACT.runtimeCommand })).toEqual(EXPECTED_CONTRACT.mappings[9]);
    expect(mapInternalDoomKeys({ doomKey: KEY_RSHIFT, runtimeCommand: MAP_INTERNAL_DOOM_KEYS_CONTRACT.runtimeCommand })).toEqual(EXPECTED_CONTRACT.mappings[10]);
  });

  it('maps host control keys and leaves unmapped keys null', () => {
    expect(mapInternalDoomKeys({ doomKey: KEY_TAB, runtimeCommand: MAP_INTERNAL_DOOM_KEYS_CONTRACT.runtimeCommand })).toEqual(EXPECTED_CONTRACT.mappings[11]);
    expect(mapInternalDoomKeys({ doomKey: KEY_PGDN, runtimeCommand: MAP_INTERNAL_DOOM_KEYS_CONTRACT.runtimeCommand })).toEqual(EXPECTED_CONTRACT.mappings[13]);
    expect(mapInternalDoomKeys({ doomKey: KEY_ESCAPE, runtimeCommand: MAP_INTERNAL_DOOM_KEYS_CONTRACT.runtimeCommand })).toEqual(EXPECTED_CONTRACT.mappings[15]);
    expect(mapInternalDoomKeys({ doomKey: 'g'.charCodeAt(0), runtimeCommand: MAP_INTERNAL_DOOM_KEYS_CONTRACT.runtimeCommand })).toBeNull();
  });

  it('rejects unsupported runtime commands', () => {
    expect(() => mapInternalDoomKeys({ doomKey: KEY_UPARROW, runtimeCommand: 'bun run src/main.ts' })).toThrow('Unsupported runtime command: bun run src/main.ts. Expected bun run doom.ts.');
  });
});
