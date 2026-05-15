import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { VANILLA_MOVEMENT_ENTRY_POINTS, changeSector, checkPosition, evTeleport, explodeMissile, slideMove, teleportMove, thingHeightClip, tryMove, xyMovement, zMovement } from '../../../src/vanilla/wireCollisionAndMovement.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireCollisionAndMovement.ts');

describe('plan_final map: wire-collision-and-movement', () => {
  test('src/vanilla/wireCollisionAndMovement.ts exists, is a regular file, and cites plan_final step 08-003', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('08-003');
    expect(fileText).toContain('VANILLA_MOVEMENT_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only world primitives without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../world/checkPosition.ts'");
    expect(fileText).toContain("from '../world/tryMove.ts'");
    expect(fileText).toContain("from '../world/slideMove.ts'");
    expect(fileText).toContain("from '../world/xyMovement.ts'");
    expect(fileText).toContain("from '../world/zMovement.ts'");
    expect(fileText).toContain("from '../world/sectorChange.ts'");
    expect(fileText).toContain("from '../world/teleport.ts'");
  });

  test('VANILLA_MOVEMENT_ENTRY_POINTS pins the nine canonical entry-point names in canonical order', () => {
    expect(VANILLA_MOVEMENT_ENTRY_POINTS).toEqual(['checkPosition', 'tryMove', 'slideMove', 'xyMovement', 'zMovement', 'changeSector', 'thingHeightClip', 'teleportMove', 'evTeleport']);
    expect(Object.isFrozen(VANILLA_MOVEMENT_ENTRY_POINTS)).toBe(true);
  });

  test('every wired movement entry point is re-exported as a callable function', () => {
    expect(typeof checkPosition).toBe('function');
    expect(typeof tryMove).toBe('function');
    expect(typeof slideMove).toBe('function');
    expect(typeof xyMovement).toBe('function');
    expect(typeof zMovement).toBe('function');
    expect(typeof changeSector).toBe('function');
    expect(typeof thingHeightClip).toBe('function');
    expect(typeof teleportMove).toBe('function');
    expect(typeof evTeleport).toBe('function');
    expect(typeof explodeMissile).toBe('function');
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const checkPositionSource = await import('../../../src/world/checkPosition.ts');
    const tryMoveSource = await import('../../../src/world/tryMove.ts');
    const xyMovementSource = await import('../../../src/world/xyMovement.ts');
    expect(checkPosition).toBe(checkPositionSource.checkPosition);
    expect(tryMove).toBe(tryMoveSource.tryMove);
    expect(xyMovement).toBe(xyMovementSource.xyMovement);
  });
});
