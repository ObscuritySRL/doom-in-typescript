/**
 * Vanilla DOOM 1.9 P_LineOpening calculation.
 *
 * For a two-sided line, computes openrange / opentop / openbottom from the
 * front and back sector heights. Single-sided lines yield openrange = 0
 * (the player cannot pass). openrange = min(frontCeiling, backCeiling) -
 * max(frontFloor, backFloor); negative ranges clamp to 0.
 */

export interface LineOpeningInput {
  readonly frontFloorHeight: number;
  readonly frontCeilingHeight: number;
  readonly backFloorHeight: number | null;
  readonly backCeilingHeight: number | null;
}

export interface LineOpening {
  readonly openTop: number;
  readonly openBottom: number;
  readonly openRange: number;
  readonly lowFloor: number;
}

export function computeLineOpening(input: LineOpeningInput): LineOpening {
  if (input.backFloorHeight === null || input.backCeilingHeight === null) {
    return Object.freeze({ openTop: 0, openBottom: 0, openRange: 0, lowFloor: 0 });
  }
  const openTop = Math.min(input.frontCeilingHeight, input.backCeilingHeight);
  const openBottom = Math.max(input.frontFloorHeight, input.backFloorHeight);
  const lowFloor = Math.min(input.frontFloorHeight, input.backFloorHeight);
  const openRange = Math.max(0, openTop - openBottom);
  return Object.freeze({ openTop, openBottom, openRange, lowFloor });
}
