/**
 * Vanilla DOOM 1.9 P_NoiseAlert / P_RecursiveSound contract.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c:
 *   void P_NoiseAlert (mobj_t* target, mobj_t* emmiter) {
 *     soundtarget = target;
 *     validcount++;
 *     P_RecursiveSound (emmiter->subsector->sector, 0);
 *   }
 *
 *   void P_RecursiveSound (sector_t* sec, int soundblocks) {
 *     if (sec->validcount == validcount && sec->soundtraversed <= soundblocks+1)
 *       return;
 *     sec->validcount = validcount;
 *     sec->soundtraversed = soundblocks+1;
 *     sec->soundtarget = soundtarget;
 *     for each two-sided neighbor line with openrange > 0:
 *       if (line->flags & ML_SOUNDBLOCK) {
 *         if (!soundblocks) P_RecursiveSound(other, 1);
 *       } else P_RecursiveSound(other, soundblocks);
 *   }
 *
 * Parity-critical:
 *   - The "second sound block stops sound" quirk: ML_SOUNDBLOCK only stops
 *     propagation when soundblocks==0 (first crossing). Subsequent
 *     soundblock lines after the first do not bump the counter; sound dies
 *     at the second sound-block boundary.
 *   - closed doors (openrange <= 0) terminate propagation in that direction.
 *   - sec->soundtraversed records depth in lines, used by monster wake-up.
 */

export const VANILLA_ML_SOUNDBLOCK = 64;
export const VANILLA_ML_TWOSIDED = 4;

export interface SoundFloodNodeInput {
  readonly sectorIndex: number;
  readonly soundBlocksAtEntry: number;
  readonly outboundEdges: readonly { readonly neighborSectorIndex: number; readonly twoSided: boolean; readonly openRangePositive: boolean; readonly hasSoundBlock: boolean }[];
}

export interface SoundFloodNeighborStep {
  readonly neighborSectorIndex: number;
  readonly nextSoundBlocks: number;
}

export function nextSoundBlocksAfterCrossing(currentSoundBlocks: number, lineHasSoundBlock: boolean): number | null {
  if (!lineHasSoundBlock) {
    return currentSoundBlocks;
  }
  if (currentSoundBlocks === 0) {
    return 1;
  }
  return null;
}

export function vanillaSoundFloodVisitsAndStops(neighbors: SoundFloodNodeInput): readonly SoundFloodNeighborStep[] {
  const steps: SoundFloodNeighborStep[] = [];
  for (const edge of neighbors.outboundEdges) {
    if (!edge.twoSided) {
      continue;
    }
    if (!edge.openRangePositive) {
      continue;
    }
    const nextBlocks = nextSoundBlocksAfterCrossing(neighbors.soundBlocksAtEntry, edge.hasSoundBlock);
    if (nextBlocks === null) {
      continue;
    }
    steps.push({ neighborSectorIndex: edge.neighborSectorIndex, nextSoundBlocks: nextBlocks });
  }
  return steps;
}
