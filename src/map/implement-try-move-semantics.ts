/**
 * Vanilla DOOM 1.9 P_TryMove contract.
 *
 * P_TryMove calls P_CheckPosition; if !canFit, it returns false. Otherwise it
 * unlinks the thing, updates x/y, and re-links into the new sector/blockmap.
 * On non-monster things, dropoff checks (no MF_DROPOFF bit) reject moves
 * where the floor drops by > 24 units.
 */

import { evaluateCheckPosition } from './implement-check-position-semantics.ts';
import type { CheckPositionInput, CheckPositionResult } from './implement-check-position-semantics.ts';

export const VANILLA_DROPOFF_LIMIT = 24;

export interface TryMoveInput {
  readonly check: CheckPositionInput;
  readonly thingIsMonster: boolean;
  readonly thingHasDropoffFlag: boolean;
  readonly currentFloorZ: number;
}

export interface TryMoveResult {
  readonly committed: boolean;
  readonly checkResult: CheckPositionResult;
  readonly blockedByDropoff: boolean;
}

export function evaluateTryMove(input: TryMoveInput): TryMoveResult {
  const checkResult = evaluateCheckPosition(input.check);
  if (!checkResult.canFit) {
    return Object.freeze({ committed: false, checkResult, blockedByDropoff: false });
  }
  const dropoffDistance = input.currentFloorZ - checkResult.tmDropoffZ;
  const blockedByDropoff = input.thingIsMonster && !input.thingHasDropoffFlag && dropoffDistance > VANILLA_DROPOFF_LIMIT;
  return Object.freeze({
    committed: !blockedByDropoff,
    checkResult,
    blockedByDropoff,
  });
}
