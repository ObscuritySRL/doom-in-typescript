/**
 * Vanilla DOOM 1.9 P_CheckPosition contract.
 *
 * P_CheckPosition is the read-only collision test that fills in:
 *   tmflags, tmthing, tmx/y, tmbbox, ceilingline, tmceilingz, tmfloorz,
 *   tmdropoffz, numspechit, spechit[]
 * It returns true if the thing can fit at (x,y) with no blocking lines or
 * monsters. P_TryMove uses these tm* globals to decide whether to commit
 * the move.
 *
 * This module pins the canonical decision contract as pure data: the
 * inputs are the thing's radius and the line/blocker information, the
 * output is "can fit" plus the recorded tm* fields.
 */

export interface CheckPositionInput {
  readonly thingRadius: number;
  readonly proposedX: number;
  readonly proposedY: number;
  readonly thingHeight: number;
  readonly highestFloorEncountered: number;
  readonly lowestCeilingEncountered: number;
  readonly lowestDropoffEncountered: number;
  readonly anyBlockingThing: boolean;
}

export interface CheckPositionResult {
  readonly canFit: boolean;
  readonly tmFloorZ: number;
  readonly tmCeilingZ: number;
  readonly tmDropoffZ: number;
  readonly verticalSpace: number;
}

export function evaluateCheckPosition(input: CheckPositionInput): CheckPositionResult {
  const verticalSpace = input.lowestCeilingEncountered - input.highestFloorEncountered;
  const canFit = !input.anyBlockingThing && verticalSpace >= input.thingHeight;
  return Object.freeze({
    canFit,
    tmFloorZ: input.highestFloorEncountered,
    tmCeilingZ: input.lowestCeilingEncountered,
    tmDropoffZ: input.lowestDropoffEncountered,
    verticalSpace,
  });
}
