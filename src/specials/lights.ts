/**
 * Sector light specials — the four animated-light thinkers and their
 * spawners (Chocolate Doom 2.2.1 `p_lights.c`) plus the light branch
 * of `p_spec.c` `P_SpawnSpecials`.
 *
 * Vanilla installs these once at level start: `P_SpawnSpecials` scans
 * every sector, and for each light `sector->special` id it allocates a
 * thinker (`P_Spawn{LightFlash,StrobeFlash,GlowingLight,FireFlicker}`),
 * appends it to the thinker list, and clears `sector->special` to 0
 * (case 4 re-asserts `special = 4` because that sector is also a
 * strobe-hurt damage sector handled by {@link playerInSpecialSector}).
 * Every tic the thinker list runs `thinker.function.acp1`, which for
 * these is `T_{LightFlash,StrobeFlash,Glow,FireFlicker}`; each mutates
 * its sector's `lightlevel` in place.  The software renderer re-derives
 * per-seg light diminishing from `frontsector->lightlevel` every frame,
 * so the oscillation is what makes E1M1's glow / sync-strobe sectors
 * visibly pulse.
 *
 * Parity-critical behavior preserved byte-for-byte:
 *
 * - `T_LightFlash` (special 1): `if (--count) return;` then toggle
 *   `lightlevel` between `maxlight` and `minlight`; the next interval
 *   is `(P_Random() & {min,max}time) + 1` — `mintime = 7`,
 *   `maxtime = 64`.  `P_Random` is consumed on every toggle, so the
 *   gameplay LCG stream advances on flicker tics.
 * - `T_StrobeFlash` (specials 2/3/4/12/13): `if (--count) return;`
 *   then toggle between `minlight` and `maxlight`; `count` reloads to
 *   `brighttime` (= `STROBEBRIGHT` 5) on the bright edge and
 *   `darktime` (= `FASTDARK` 15 or `SLOWDARK` 35) on the dark edge.
 *   No `P_Random` at tic time.  `P_SpawnStrobeFlash` collapses
 *   `minlight` to 0 when it equals `maxlight`, and seeds `count` from
 *   `(P_Random() & 7) + 1` when not in sync, or exactly `1` when in
 *   sync (specials 12/13) so every synced sector flips on the same
 *   tic.
 * - `T_Glow` (special 8): ramp `lightlevel` by `GLOWSPEED` (8) toward
 *   `maxlight`/`minlight`, reversing `direction` at each bound with a
 *   one-step overshoot-correction (`lightlevel += GLOWSPEED` back).
 *   No `P_Random`.  Spawned with `direction = -1` (descending first).
 * - `T_FireFlicker` (special 17, v1.4+ only): `if (--count) return;`
 *   then `amount = (P_Random() & 3) * 16`; drop to `minlight` if
 *   `lightlevel - amount < minlight`, else `maxlight - amount`;
 *   `count` always reloads to `4`.  `P_SpawnFireFlicker` sets
 *   `minlight = P_FindMinSurroundingLight(...) + 16` and `count = 4`.
 * - `P_FindMinSurroundingLight` walks `sector->lines[]` via the
 *   verbatim `getNextSector` (NULL unless `ML_TWOSIDED`), taking the
 *   minimum neighbor `lightlevel`, seeded at `max`.
 * - `P_SpawnSpecials` light dispatch order: sectors are scanned in
 *   array order, the `P_Random`-consuming spawners draw in that order,
 *   so the shared LCG stream is positioned identically to vanilla.
 *   Non-light specials (9 secret, 10 door-close-30, 14 door-raise-5m)
 *   are other modules' concern and are intentionally NOT handled here,
 *   matching the {@link playerInSpecialSector} separation note.
 *
 * Like the other specials modules this is pure: the only externality
 * is `pRandom`, one draw from the gameplay `P_Random` stream
 * (0..255), injected so the shared LCG ordering across every spawner
 * and tic is the caller's to wire (vanilla's single global stream).
 * Sector `lightlevel` / `special` are mutated in place to match
 * vanilla's direct struct writes.
 *
 * @example
 * ```ts
 * import { pSpawnSpecialsLights, tickLight } from "../src/specials/lights.ts";
 *
 * const rng = new DoomRandom();
 * const thinkers = pSpawnSpecialsLights(level.sectors, () => rng.pRandom(), gameVersionAtLeast14);
 * // each tic, in spawn order:
 * for (const thinker of thinkers) tickLight(thinker, () => rng.pRandom());
 * ```
 */

import { ML_TWOSIDED } from '../map/lineSectorGeometry.ts';

// ── Constants (p_spec.h) ───────────────────────────────────────────

/** `T_Glow` ramp step per tic, up or down (p_spec.h `GLOWSPEED`). */
export const GLOWSPEED = 8;

/** Strobe bright-edge dwell in tics (p_spec.h `STROBEBRIGHT`). */
export const STROBEBRIGHT = 5;

/** Fast strobe dark-edge dwell in tics (p_spec.h `FASTDARK`). */
export const FASTDARK = 15;

/** Slow strobe dark-edge dwell in tics (p_spec.h `SLOWDARK`). */
export const SLOWDARK = 35;

/** `P_SpawnLightFlash` fixed `maxtime` mask (vanilla literal `64`). */
export const LIGHTFLASH_MAXTIME = 64;

/** `P_SpawnLightFlash` fixed `mintime` mask (vanilla literal `7`). */
export const LIGHTFLASH_MINTIME = 7;

/** `T_FireFlicker` / `P_SpawnFireFlicker` `count` reload (vanilla literal `4`). */
export const FIREFLICKER_COUNT = 4;

/** `P_SpawnFireFlicker` `minlight` bias added to the surrounding min. */
export const FIREFLICKER_MINLIGHT_BIAS = 16;

// ── Sector-special ids (light branch of P_SpawnSpecials) ───────────

/**
 * The `sector->special` ids `P_SpawnSpecials` maps to a light
 * thinker.  Non-light ids (9/10/14) are deliberately absent — they
 * are owned by other specials modules.
 */
export const enum LightSectorSpecial {
  /** Random flicker — `P_SpawnLightFlash`. */
  flickering = 1,
  /** Fast strobe — `P_SpawnStrobeFlash(FASTDARK, 0)`. */
  strobeFast = 2,
  /** Slow strobe — `P_SpawnStrobeFlash(SLOWDARK, 0)`. */
  strobeSlow = 3,
  /** Fast strobe + death-slime damage — strobe spawned, `special` reset to 4. */
  strobeFastDeathSlime = 4,
  /** Glowing light — `P_SpawnGlowingLight`. */
  glowing = 8,
  /** Sync slow strobe — `P_SpawnStrobeFlash(SLOWDARK, 1)`. */
  syncStrobeSlow = 12,
  /** Sync fast strobe — `P_SpawnStrobeFlash(FASTDARK, 1)`. */
  syncStrobeFast = 13,
  /** Fire flicker (official v1.4 beta+) — `P_SpawnFireFlicker`. */
  fireFlicker = 17,
}

// ── Runtime shapes ─────────────────────────────────────────────────

/**
 * Sector subset the light thinkers read/write.  `lightlevel` is
 * mutated by every thinker; `special` is cleared by the spawners
 * (re-asserted to 4 for {@link LightSectorSpecial.strobeFastDeathSlime}).
 * `lines` is the sector's linedef list — vanilla `sector->lines[]`,
 * its length the vanilla `sector->linecount`.
 */
export interface LightSector {
  lightlevel: number;
  special: number;
  readonly lines: readonly LightLine[];
}

/**
 * Linedef subset `getNextSector` consults: the `ML_TWOSIDED` flag bit
 * and the resolved front / back sectors.  `backsector` is `null` for
 * a one-sided line (vanilla `line->backsector == NULL`).
 */
export interface LightLine {
  readonly flags: number;
  readonly frontsector: LightSector;
  readonly backsector: LightSector | null;
}

/** One draw from the gameplay `P_Random` stream, 0..255. */
export type PRandom = () => number;

/** `lightflash_t` (p_spec.h) data fields. */
export interface LightFlash {
  readonly sector: LightSector;
  count: number;
  maxlight: number;
  minlight: number;
  maxtime: number;
  mintime: number;
}

/** `strobe_t` (p_spec.h) data fields. */
export interface Strobe {
  readonly sector: LightSector;
  count: number;
  minlight: number;
  maxlight: number;
  darktime: number;
  brighttime: number;
}

/** `glow_t` (p_spec.h) data fields. */
export interface Glow {
  readonly sector: LightSector;
  minlight: number;
  maxlight: number;
  direction: number;
}

/** `fireflicker_t` (p_spec.h) data fields. */
export interface FireFlicker {
  readonly sector: LightSector;
  count: number;
  maxlight: number;
  minlight: number;
}

/**
 * An installed light thinker — the discriminated union models
 * vanilla's `thinker.function.acp1` indirection so {@link tickLight}
 * can dispatch the right `T_*` body in spawn order.
 */
export type LightThinker =
  | { readonly kind: 'lightflash'; readonly state: LightFlash }
  | { readonly kind: 'strobe'; readonly state: Strobe }
  | { readonly kind: 'glow'; readonly state: Glow }
  | { readonly kind: 'fireflicker'; readonly state: FireFlicker };

// ── getNextSector / P_FindMinSurroundingLight (p_spec.c) ───────────

/**
 * getNextSector (p_spec.c): the sector on the OTHER side of `line`
 * from `sec`.  NULL unless `line` is two-sided — the `ML_TWOSIDED`
 * flag is the only gate, even when a back sector physically exists.
 */
export function getNextSector(line: LightLine, sec: LightSector): LightSector | null {
  if ((line.flags & ML_TWOSIDED) === 0) {
    return null;
  }
  if (line.frontsector === sec) {
    return line.backsector;
  }
  return line.frontsector;
}

/**
 * P_FindMinSurroundingLight (p_spec.c): the minimum `lightlevel`
 * across the sectors reachable through `sector`'s two-sided lines,
 * seeded at `max` (vanilla passes the sector's own `lightlevel`).
 */
export function pFindMinSurroundingLight(sector: LightSector, max: number): number {
  let min = max;
  for (let i = 0; i < sector.lines.length; i += 1) {
    const line = sector.lines[i]!;
    const check = getNextSector(line, sector);
    if (!check) {
      continue;
    }
    if (check.lightlevel < min) {
      min = check.lightlevel;
    }
  }
  return min;
}

// ── T_LightFlash / P_SpawnLightFlash (p_lights.c) ──────────────────

/**
 * T_LightFlash (p_lights.c): random on/off flicker.  Predecrement
 * `count`; while still non-zero do nothing.  On expiry toggle
 * `lightlevel` between `maxlight` and `minlight` and reload `count`
 * from `(P_Random() & {min,max}time) + 1`.
 */
export function tLightFlash(flash: LightFlash, pRandom: PRandom): void {
  flash.count = (flash.count - 1) | 0;
  if (flash.count !== 0) {
    return;
  }
  if (flash.sector.lightlevel === flash.maxlight) {
    flash.sector.lightlevel = flash.minlight;
    flash.count = ((pRandom() & flash.mintime) + 1) | 0;
  } else {
    flash.sector.lightlevel = flash.maxlight;
    flash.count = ((pRandom() & flash.maxtime) + 1) | 0;
  }
}

/**
 * P_SpawnLightFlash (p_lights.c): clear `sector->special`, install a
 * flicker thinker seeded from the surrounding light, fixed
 * `maxtime = 64` / `mintime = 7`, first `count = (P_Random() & 64) + 1`.
 */
export function pSpawnLightFlash(sector: LightSector, pRandom: PRandom): LightFlash {
  sector.special = 0;
  const flash: LightFlash = {
    sector,
    maxlight: sector.lightlevel,
    minlight: pFindMinSurroundingLight(sector, sector.lightlevel),
    maxtime: LIGHTFLASH_MAXTIME,
    mintime: LIGHTFLASH_MINTIME,
    count: 0,
  };
  flash.count = ((pRandom() & flash.maxtime) + 1) | 0;
  return flash;
}

// ── T_StrobeFlash / P_SpawnStrobeFlash (p_lights.c) ────────────────

/**
 * T_StrobeFlash (p_lights.c): square-wave blink.  Predecrement
 * `count`; on expiry toggle between `minlight` and `maxlight`,
 * reloading `count` to `brighttime` on the bright edge and
 * `darktime` on the dark edge.  No `P_Random`.
 */
export function tStrobeFlash(flash: Strobe): void {
  flash.count = (flash.count - 1) | 0;
  if (flash.count !== 0) {
    return;
  }
  if (flash.sector.lightlevel === flash.minlight) {
    flash.sector.lightlevel = flash.maxlight;
    flash.count = flash.brighttime;
  } else {
    flash.sector.lightlevel = flash.minlight;
    flash.count = flash.darktime;
  }
}

/**
 * P_SpawnStrobeFlash (p_lights.c): `darktime = fastOrSlow`,
 * `brighttime = STROBEBRIGHT`, `maxlight = lightlevel`,
 * `minlight = P_FindMinSurroundingLight(...)`; collapse `minlight` to
 * 0 when it equals `maxlight`; clear `sector->special`; first `count`
 * is `(P_Random() & 7) + 1` when not in sync, else exactly `1`.
 */
export function pSpawnStrobeFlash(sector: LightSector, fastOrSlow: number, inSync: number, pRandom: PRandom): Strobe {
  const flash: Strobe = {
    sector,
    darktime: fastOrSlow,
    brighttime: STROBEBRIGHT,
    maxlight: sector.lightlevel,
    minlight: pFindMinSurroundingLight(sector, sector.lightlevel),
    count: 0,
  };

  if (flash.minlight === flash.maxlight) {
    flash.minlight = 0;
  }

  // nothing special about it during gameplay
  sector.special = 0;

  if (!inSync) {
    flash.count = ((pRandom() & 7) + 1) | 0;
  } else {
    flash.count = 1;
  }
  return flash;
}

// ── T_Glow / P_SpawnGlowingLight (p_lights.c) ──────────────────────

/**
 * T_Glow (p_lights.c): triangle-wave ramp by `GLOWSPEED`.  At the
 * bound the one extra step is undone and `direction` flips, so the
 * ramp never overshoots past `min`/`maxlight`.  No `P_Random`.
 */
export function tGlow(g: Glow): void {
  switch (g.direction) {
    case -1:
      // DOWN
      g.sector.lightlevel -= GLOWSPEED;
      if (g.sector.lightlevel <= g.minlight) {
        g.sector.lightlevel += GLOWSPEED;
        g.direction = 1;
      }
      break;

    case 1:
      // UP
      g.sector.lightlevel += GLOWSPEED;
      if (g.sector.lightlevel >= g.maxlight) {
        g.sector.lightlevel -= GLOWSPEED;
        g.direction = -1;
      }
      break;

    default:
      break;
  }
}

/**
 * P_SpawnGlowingLight (p_lights.c): `minlight` from the surrounding
 * light, `maxlight = lightlevel`, `direction = -1` (descend first),
 * clear `sector->special`.
 */
export function pSpawnGlowingLight(sector: LightSector): Glow {
  const g: Glow = {
    sector,
    minlight: pFindMinSurroundingLight(sector, sector.lightlevel),
    maxlight: sector.lightlevel,
    direction: -1,
  };
  sector.special = 0;
  return g;
}

// ── T_FireFlicker / P_SpawnFireFlicker (p_lights.c) ────────────────

/**
 * T_FireFlicker (p_lights.c): predecrement `count`; on expiry draw
 * `amount = (P_Random() & 3) * 16` and drop to `minlight` when
 * `lightlevel - amount` would fall below it, else to
 * `maxlight - amount`; `count` always reloads to `4`.
 */
export function tFireFlicker(flick: FireFlicker, pRandom: PRandom): void {
  flick.count = (flick.count - 1) | 0;
  if (flick.count !== 0) {
    return;
  }

  const amount = (pRandom() & 3) * 16;

  if (flick.sector.lightlevel - amount < flick.minlight) {
    flick.sector.lightlevel = flick.minlight;
  } else {
    flick.sector.lightlevel = flick.maxlight - amount;
  }

  flick.count = FIREFLICKER_COUNT;
}

/**
 * P_SpawnFireFlicker (p_lights.c): clear `sector->special`,
 * `maxlight = lightlevel`,
 * `minlight = P_FindMinSurroundingLight(...) + 16`, `count = 4`.
 */
export function pSpawnFireFlicker(sector: LightSector): FireFlicker {
  // Note that we are resetting sector attributes.
  // Nothing special about it during gameplay.
  sector.special = 0;
  return {
    sector,
    maxlight: sector.lightlevel,
    minlight: pFindMinSurroundingLight(sector, sector.lightlevel) + FIREFLICKER_MINLIGHT_BIAS,
    count: FIREFLICKER_COUNT,
  };
}

// ── tickLight (thinker.function.acp1 dispatch) ─────────────────────

/**
 * Run one tic of an installed light thinker — the `T_*` body that
 * vanilla reaches through `thinker.function.acp1`.  Callers must run
 * the thinkers in spawn order each tic so the shared `P_Random`
 * stream stays positioned exactly as in vanilla.
 */
export function tickLight(thinker: LightThinker, pRandom: PRandom): void {
  switch (thinker.kind) {
    case 'lightflash':
      tLightFlash(thinker.state, pRandom);
      return;
    case 'strobe':
      tStrobeFlash(thinker.state);
      return;
    case 'glow':
      tGlow(thinker.state);
      return;
    case 'fireflicker':
      tFireFlicker(thinker.state, pRandom);
      return;
    default: {
      const unreachable: never = thinker;
      return unreachable;
    }
  }
}

// ── P_SpawnSpecials (light branch, p_spec.c) ───────────────────────

/**
 * The light branch of `P_SpawnSpecials` (p_spec.c).  Scans `sectors`
 * in array order; for each light `sector->special` allocates the
 * matching thinker (clearing `special`, re-asserting 4 for
 * death-slime strobe), returning the thinkers in spawn order.  The
 * `P_Random`-consuming spawners draw in this exact order, so the
 * shared LCG stream ends positioned identically to vanilla.
 *
 * `gameVersionAtLeast14` is the `gameversion > exe_doom_1_2` gate
 * vanilla applies to the v1.4-beta `fireFlicker` (17) special; on an
 * older game version a special-17 sector spawns no thinker.
 * Non-light specials are skipped here (other modules install them).
 */
export function pSpawnSpecialsLights(sectors: readonly LightSector[], pRandom: PRandom, gameVersionAtLeast14: boolean): LightThinker[] {
  const thinkers: LightThinker[] = [];

  for (let i = 0; i < sectors.length; i += 1) {
    const sector = sectors[i]!;
    if (!sector.special) {
      continue;
    }

    switch (sector.special) {
      case LightSectorSpecial.flickering:
        // FLICKERING LIGHTS
        thinkers.push({ kind: 'lightflash', state: pSpawnLightFlash(sector, pRandom) });
        break;

      case LightSectorSpecial.strobeFast:
        // STROBE FAST
        thinkers.push({ kind: 'strobe', state: pSpawnStrobeFlash(sector, FASTDARK, 0, pRandom) });
        break;

      case LightSectorSpecial.strobeSlow:
        // STROBE SLOW
        thinkers.push({ kind: 'strobe', state: pSpawnStrobeFlash(sector, SLOWDARK, 0, pRandom) });
        break;

      case LightSectorSpecial.strobeFastDeathSlime:
        // STROBE FAST/DEATH SLIME
        thinkers.push({ kind: 'strobe', state: pSpawnStrobeFlash(sector, FASTDARK, 0, pRandom) });
        sector.special = 4;
        break;

      case LightSectorSpecial.glowing:
        // GLOWING LIGHT
        thinkers.push({ kind: 'glow', state: pSpawnGlowingLight(sector) });
        break;

      case LightSectorSpecial.syncStrobeSlow:
        // SYNC STROBE SLOW
        thinkers.push({ kind: 'strobe', state: pSpawnStrobeFlash(sector, SLOWDARK, 1, pRandom) });
        break;

      case LightSectorSpecial.syncStrobeFast:
        // SYNC STROBE FAST
        thinkers.push({ kind: 'strobe', state: pSpawnStrobeFlash(sector, FASTDARK, 1, pRandom) });
        break;

      case LightSectorSpecial.fireFlicker:
        // first introduced in official v1.4 beta
        if (gameVersionAtLeast14) {
          thinkers.push({ kind: 'fireflicker', state: pSpawnFireFlicker(sector) });
        }
        break;

      default:
        // Non-light specials (9 secret, 10 door-close-30,
        // 14 door-raise-5m) are installed by other modules.
        break;
    }
  }

  return thinkers;
}
