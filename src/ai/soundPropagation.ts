/**
 * Recursive sound propagation (p_enemy.c P_NoiseAlert / P_RecursiveSound).
 *
 * When the player fires a weapon (or another mobj calls P_NoiseAlert)
 * the noise floods outward through two-sided linedefs with positive
 * openings, marking each traversed sector with the wake-up target.
 * Sleeping monsters later check `sector.soundtarget` inside A_Look and
 * begin to chase.  Line-of-sight is intentionally NOT consulted here —
 * vanilla never calls P_CheckSight from the recursion.
 *
 * ML_SOUNDBLOCK linedefs partition the map into at-most-two sound
 * reaches.  The first crossing bumps soundblocks 0 → 1; a second
 * crossing short-circuits because `if (!soundblocks)` is false.  This
 * is why small "quiet" side rooms stay asleep when the player fires
 * from two soundblock-bounded rooms away.
 *
 * @example
 * ```ts
 * import { createSoundState, noiseAlert } from "../src/ai/soundPropagation.ts";
 * const soundState = createSoundState(mapData.sectors.length);
 * noiseAlert(playerMobj, playerSectorIndex, mapData, soundState);
 * // soundState.sectorSoundTarget[i] now holds the wake-up target for every flooded sector
 * ```
 */

import type { MapData } from '../map/mapSetup.ts';
import { ML_SOUNDBLOCK, ML_TWOSIDED } from '../map/lineSectorGeometry.ts';
import type { Mobj } from '../world/mobj.ts';

/**
 * Per-sector sound-propagation state matching the `validcount`,
 * `soundtraversed`, and `soundtarget` fields on `sector_t` in
 * Chocolate Doom's p_enemy.c / r_defs.h.
 *
 * `validcount` is the monotonic generation counter incremented exactly
 * once per {@link noiseAlert} call (matching `validcount++` at the top
 * of P_NoiseAlert).  `sectorValidcount[i]` stamps the most recent
 * generation that visited sector `i`; when the stamp equals the current
 * generation, `sectorSoundTraversed[i]` carries the `soundblocks + 1`
 * depth reached on that visit, and `sectorSoundTarget[i]` carries the
 * wake-up source.  Stale entries for earlier generations are naturally
 * invalidated by the stamp mismatch — the arrays are never cleared.
 */
export interface SoundState {
  /** Current generation counter (advanced once per noiseAlert). */
  validcount: number;
  /** Per-sector generation stamp. */
  readonly sectorValidcount: Int32Array;
  /** Per-sector `soundblocks + 1` for the current generation. */
  readonly sectorSoundTraversed: Int32Array;
  /** Per-sector wake-up target pointer; valid only when the matching stamp equals `validcount`. */
  readonly sectorSoundTarget: (Mobj | null)[];
}

/**
 * Allocate a zero-initialized {@link SoundState} sized for `sectorCount`.
 *
 * @param sectorCount - Number of sectors in the active map.
 * @returns Fresh state ready for the first {@link noiseAlert} call.
 *
 * @example
 * ```ts
 * const state = createSoundState(mapData.sectors.length);
 * ```
 */
export function createSoundState(sectorCount: number): SoundState {
  return {
    validcount: 0,
    sectorValidcount: new Int32Array(sectorCount),
    sectorSoundTraversed: new Int32Array(sectorCount),
    sectorSoundTarget: new Array<Mobj | null>(sectorCount).fill(null),
  };
}

/**
 * Flood sound outward from the emitter's sector, marking each visited
 * sector with `target` as the wake-up source.  Mirrors P_NoiseAlert:
 * increments `validcount`, then kicks off {@link recursiveSound} from
 * `emitterSectorIndex` with `soundblocks = 0`.
 *
 * @param target - The wake-up target (normally the player who fired).
 * @param emitterSectorIndex - Sector index the emitter is standing in.
 * @param mapData - Parsed map snapshot (sectorGroups, lineSectors, linedefs, sectors).
 * @param state - Mutable sound-propagation state for the active level.
 *
 * @example
 * ```ts
 * noiseAlert(player, playerSectorIndex, mapData, state);
 * ```
 */
export function noiseAlert(target: Mobj, emitterSectorIndex: number, mapData: MapData, state: SoundState): void {
  state.validcount = (state.validcount + 1) | 0;
  recursiveSound(target, emitterSectorIndex, 0, mapData, state);
}

/**
 * Depth-first propagation step.  Matches the branch ordering of
 * P_RecursiveSound exactly:
 *
 * 1. Bail out when the sector was already visited this generation to
 *    equal-or-better depth (`soundtraversed <= soundblocks + 1`).
 * 2. Stamp the sector with the current generation, soundblocks+1, and
 *    the wake-up target.
 * 3. Walk the sector's linedefs in the on-disk order captured by
 *    `sectorGroups[i].lineIndices`.  Skip non-two-sided lines and
 *    closed openings (`openrange <= 0`).  Resolve the other sector
 *    from the precomputed `lineSectors` pair.
 * 4. Cross ML_SOUNDBLOCK lines only when `soundblocks === 0` and
 *    recurse with `soundblocks = 1`; otherwise recurse with the
 *    unchanged soundblocks.
 *
 * The `openrange` test from P_LineOpening is inlined here because
 * P_LineOpening allocates a LineOpening object on every call and
 * this is the innermost hot loop of sound propagation.
 */
function recursiveSound(target: Mobj, sectorIndex: number, soundBlocks: number, mapData: MapData, state: SoundState): void {
  if (state.sectorValidcount[sectorIndex] === state.validcount && state.sectorSoundTraversed[sectorIndex] <= soundBlocks + 1) {
    return;
  }

  state.sectorValidcount[sectorIndex] = state.validcount;
  state.sectorSoundTraversed[sectorIndex] = soundBlocks + 1;
  state.sectorSoundTarget[sectorIndex] = target;

  const lineIndices = mapData.sectorGroups[sectorIndex]!.lineIndices;
  const linedefs = mapData.linedefs;
  const lineSectors = mapData.lineSectors;
  const sectors = mapData.sectors;
  const count = lineIndices.length;

  for (let i = 0; i < count; i++) {
    const lineIndex = lineIndices[i]!;
    const line = linedefs[lineIndex]!;
    if ((line.flags & ML_TWOSIDED) === 0) {
      continue;
    }

    const ls = lineSectors[lineIndex]!;
    const backsectorIndex = ls.backsector;
    if (backsectorIndex === -1) {
      continue;
    }
    const frontsectorIndex = ls.frontsector;
    const front = sectors[frontsectorIndex]!;
    const back = sectors[backsectorIndex]!;

    const openTop = front.ceilingheight < back.ceilingheight ? front.ceilingheight : back.ceilingheight;
    const openBottom = front.floorheight > back.floorheight ? front.floorheight : back.floorheight;
    if (((openTop - openBottom) | 0) <= 0) {
      continue;
    }

    const other = frontsectorIndex === sectorIndex ? backsectorIndex : frontsectorIndex;

    if ((line.flags & ML_SOUNDBLOCK) !== 0) {
      if (soundBlocks === 0) {
        recursiveSound(target, other, 1, mapData, state);
      }
    } else {
      recursiveSound(target, other, soundBlocks, mapData, state);
    }
  }
}
