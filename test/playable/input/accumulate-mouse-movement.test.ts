import { describe, expect, it } from 'bun:test';

import { createHash } from 'node:crypto';

import { EMPTY_TICCMD, MOUSE_STRAFE_MULTIPLIER, MOUSE_TURN_MULTIPLIER, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import { ACCUMULATE_MOUSE_MOVEMENT_CONTRACT, accumulateMouseMovement } from '../../../src/playable/input/accumulateMouseMovement.ts';

interface AuditMissingLiveInputManifest {
  readonly commandContracts: {
    readonly target: {
      readonly runtimeCommand: string;
    };
  };
  readonly explicitNullSurfaces: ReadonlyArray<{
    readonly evidence: string;
    readonly path: null;
    readonly reason: string;
    readonly surface: string;
    readonly symbol: null;
  }>;
}

function isAuditMissingLiveInputManifest(value: unknown): value is AuditMissingLiveInputManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const manifestRecord = value as Record<string, unknown>;
  if (typeof manifestRecord.commandContracts !== 'object' || manifestRecord.commandContracts === null) {
    return false;
  }

  const commandContractsRecord = manifestRecord.commandContracts as Record<string, unknown>;
  if (typeof commandContractsRecord.target !== 'object' || commandContractsRecord.target === null) {
    return false;
  }

  const targetRecord = commandContractsRecord.target as Record<string, unknown>;
  if (typeof targetRecord.runtimeCommand !== 'string') {
    return false;
  }

  if (!Array.isArray(manifestRecord.explicitNullSurfaces)) {
    return false;
  }

  return manifestRecord.explicitNullSurfaces.every((explicitNullSurface) => {
    if (typeof explicitNullSurface !== 'object' || explicitNullSurface === null) {
      return false;
    }

    const explicitNullSurfaceRecord = explicitNullSurface as Record<string, unknown>;
    return (
      typeof explicitNullSurfaceRecord.evidence === 'string' &&
      explicitNullSurfaceRecord.path === null &&
      typeof explicitNullSurfaceRecord.reason === 'string' &&
      typeof explicitNullSurfaceRecord.surface === 'string' &&
      explicitNullSurfaceRecord.symbol === null
    );
  });
}

describe('ACCUMULATE_MOUSE_MOVEMENT_CONTRACT', () => {
  it('locks the exact Bun-only contract and stable hash', () => {
    expect(ACCUMULATE_MOUSE_MOVEMENT_CONTRACT).toEqual({
      auditManifestPath: 'plan_fps/manifests/01-010-audit-missing-live-input.json',
      movementPolicy: {
        forwardMovementExpression: 'forwardmove -= mouseY',
        horizontalPolicy: 'strafe modifier routes mouseX to sidemove; otherwise mouseX routes to angleturn',
        mouseStrafeMultiplier: MOUSE_STRAFE_MULTIPLIER,
        mouseTurnMultiplier: MOUSE_TURN_MULTIPLIER,
      },
      replayCompatibility: {
        ticCommandSize: TICCMD_SIZE,
        usesTimestamp: false,
        zeroBaseline: EMPTY_TICCMD,
      },
      runtimeCommand: 'bun run doom.ts',
      stepId: '06-007',
      stepTitle: 'accumulate-mouse-movement',
    });

    const contractHash = createHash('sha256').update(JSON.stringify(ACCUMULATE_MOUSE_MOVEMENT_CONTRACT)).digest('hex');
    expect(contractHash).toBe('8faa1ead8a1aa97a69c67089248a754282f174456f9c6b72af1edc54aecbf6d1');
  });

  it('links to the 01-010 audit gap for per-tic input accumulation', async () => {
    const auditManifestValue = JSON.parse(await Bun.file(ACCUMULATE_MOUSE_MOVEMENT_CONTRACT.auditManifestPath).text()) as unknown;

    expect(isAuditMissingLiveInputManifest(auditManifestValue)).toBe(true);
    if (!isAuditMissingLiveInputManifest(auditManifestValue)) {
      throw new Error('Unexpected 01-010 audit manifest schema.');
    }

    expect(auditManifestValue.commandContracts.target.runtimeCommand).toBe(ACCUMULATE_MOUSE_MOVEMENT_CONTRACT.runtimeCommand);
    expect(auditManifestValue.explicitNullSurfaces.find(({ surface }) => surface === 'per-tic-input-accumulation')).toEqual({
      evidence: 'src/main.ts passes a session to runLauncherWindow and does not expose per-tic input state accumulation.',
      path: null,
      reason: 'No per-tic input accumulation surface is visible within the 01-010 read scope.',
      surface: 'per-tic-input-accumulation',
      symbol: null,
    });
  });
});

describe('accumulateMouseMovement', () => {
  it('routes mouse X into turning and mouse Y into forward movement without a strafe modifier', () => {
    expect(
      accumulateMouseMovement({
        mouseX: 4,
        mouseY: -3,
        runtimeCommand: 'bun run doom.ts',
        strafeModifierActive: false,
      }),
    ).toEqual({
      horizontalAxisTarget: 'angleturn',
      mouseX: 4,
      mouseY: -3,
      strafeModifierActive: false,
      ticCommand: {
        angleturn: -(4 * MOUSE_TURN_MULTIPLIER),
        buttons: 0,
        chatchar: 0,
        consistancy: 0,
        forwardmove: 3,
        sidemove: 0,
      },
    });
  });

  it('routes mouse X into strafe movement and clamps packed tic deltas with a strafe modifier', () => {
    expect(
      accumulateMouseMovement({
        mouseX: 40,
        mouseY: 70,
        runtimeCommand: 'bun run doom.ts',
        strafeModifierActive: true,
      }),
    ).toEqual({
      horizontalAxisTarget: 'sidemove',
      mouseX: 40,
      mouseY: 70,
      strafeModifierActive: true,
      ticCommand: {
        angleturn: 0,
        buttons: 0,
        chatchar: 0,
        consistancy: 0,
        forwardmove: -50,
        sidemove: 50,
      },
    });
  });

  it('rejects a non-playable runtime command', () => {
    expect(() =>
      accumulateMouseMovement({
        mouseX: 1,
        mouseY: 2,
        runtimeCommand: 'bun run src/main.ts',
        strafeModifierActive: false,
      }),
    ).toThrow('accumulateMouseMovement only supports bun run doom.ts.');
  });

  it('rejects non-integer mouse deltas', () => {
    expect(() =>
      accumulateMouseMovement({
        mouseX: 1.5,
        mouseY: 0,
        runtimeCommand: 'bun run doom.ts',
        strafeModifierActive: false,
      }),
    ).toThrow('Mouse movement deltas must be signed integers.');
  });
});
