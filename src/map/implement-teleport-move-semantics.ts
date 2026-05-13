/**
 * Vanilla DOOM 1.9 P_TeleportMove contract.
 *
 * P_TeleportMove forcibly places a thing at the destination without checking
 * lines (no collision narrowing). It still calls a reduced P_CheckPosition
 * that allows blocking things to be killed (telefragged). The destination is
 * always committed unless the destination cell is itself outside the map.
 */

export const VANILLA_TELEFRAG_DAMAGE = 10000;

export interface TeleportMoveInput {
  readonly destinationX: number;
  readonly destinationY: number;
  readonly destinationCellInRange: boolean;
  readonly otherThingsAtDestination: number;
  readonly teleporterIsVoodooSafe: boolean;
}

export interface TeleportMoveResult {
  readonly committed: boolean;
  readonly telefragVictimCount: number;
}

export function evaluateTeleportMove(input: TeleportMoveInput): TeleportMoveResult {
  if (!input.destinationCellInRange) {
    return Object.freeze({ committed: false, telefragVictimCount: 0 });
  }
  const telefragVictimCount = input.teleporterIsVoodooSafe ? 0 : input.otherThingsAtDestination;
  return Object.freeze({ committed: true, telefragVictimCount });
}
