/**
 * Vanilla DOOM 1.9 intermission map-graphic contract.
 *
 * From Chocolate Doom 2.2.1 wi_stuff.c WI_loadData / WI_drawShowNextLoc / WI_drawAnimatedBack:
 *
 *   // Per-episode background lump (loaded by WI_loadData):
 *   //   E1 -> "WIMAP0"
 *   //   E2 -> "WIMAP1"
 *   //   E3 -> "WIMAP2"
 *   //   E4 (Ultimate) -> "INTERPIC"
 *
 *   // "You are here" marker (WI_drawShowNextLoc):
 *   //   alternates between "WIURH0" and "WIURH1" every 9 tics (in steady state)
 *
 *   // Splat (visited locations): "WISPLAT"
 *
 *   // Episode-1 animation frame lumps: WIA0_0_X, WIA0_1_X, WIA0_2_X (X = 0..animFrames)
 *   // Episode-2 animation frame lumps: WIA1_X
 *   // Episode-3 animation frame lumps: WIA2_X
 *
 * Notes for parity:
 *   - Doom II uses INTERPIC for the intermission background regardless of map.
 *   - The "you are here" marker blink toggles every 9 tics (WI_drawShowNextLoc condition).
 *   - The WISPLAT marker is drawn at each previously-completed location.
 *   - Episode-4 (Thy Flesh Consumed) reuses INTERPIC because it shipped after the original
 *     E1-E3 art was finalized.
 *   - WI_loadData call-order: load background, load splat, load you-are-here, load anim frames.
 */

export type VanillaIntermissionEpisode = 1 | 2 | 3 | 4;

export interface VanillaIntermissionBackgroundInput {
  readonly episode: VanillaIntermissionEpisode;
  readonly isCommercial: boolean;
}

export function getVanillaIntermissionBackgroundLump(input: VanillaIntermissionBackgroundInput): string {
  if (input.isCommercial) {
    return 'INTERPIC';
  }
  switch (input.episode) {
    case 1:
      return 'WIMAP0';
    case 2:
      return 'WIMAP1';
    case 3:
      return 'WIMAP2';
    case 4:
      return 'INTERPIC';
    default: {
      const exhaustive: never = input.episode;
      throw new Error(`unreachable episode ${String(exhaustive)}`);
    }
  }
}

export const VANILLA_INTERMISSION_SPLAT_LUMP = 'WISPLAT';
export const VANILLA_INTERMISSION_YOU_ARE_HERE_LUMPS: readonly string[] = Object.freeze(['WIURH0', 'WIURH1']);
export const VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS = 9;

export interface YouAreHereBlinkInput {
  readonly bcntFromOpen: number;
}

export function getVanillaYouAreHereLump(input: YouAreHereBlinkInput): string {
  const phase = Math.trunc(input.bcntFromOpen / VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS) & 1;
  return VANILLA_INTERMISSION_YOU_ARE_HERE_LUMPS[phase]!;
}
