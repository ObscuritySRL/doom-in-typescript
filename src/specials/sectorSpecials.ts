/**
 * Per-tic sector special dispatch for the player-in-sector path
 * (p_spec.c `P_PlayerInSpecialSector`).
 *
 * Vanilla calls this routine every tic for every player whose origin
 * is currently inside a special sector.  The dispatch covers the six
 * sector-special ids that touch the player directly: damage floors
 * (5, 7, 4, 16), the secret marker (9), and the E1M8 exit-damage
 * finale (11).  All other sector ids are rendering-only (animated
 * lights, strobe, door-in-N-seconds) and are installed by the
 * one-shot `P_SpawnSpecials` scan at level start, not by this tick
 * function; invoking this routine on an unknown id is a vanilla
 * `I_Error`.
 *
 * Parity-critical behavior preserved byte-for-byte from Chocolate
 * Doom 2.2.1:
 *
 * - Airborne check is `player->mo->z !== sector->floorheight`.  A
 *   jumping, rising, or falling player in a damage sector takes no
 *   damage and a secret sector is not collected until the player's
 *   feet actually touch the floor of that sector.
 * - The damage-tick gate is `(leveltime & 0x1f) === 0`.  A player who
 *   enters a damage sector on a non-tick tic waits up to 31 tics for
 *   the first hit.  The gate is shared by every damaging case and is
 *   re-tested every tic, so a player who leaves between ticks simply
 *   skips the hit.
 * - Cases 5 (hellslime) and 7 (nukage) gate on `!pw_ironfeet` only —
 *   the radiation suit suppresses damage completely.
 * - Cases 4 (strobe hurt) and 16 (super hellslime) share a body via
 *   vanilla C fall-through.  The gate is `!pw_ironfeet || random<5`:
 *   the suit ONLY reduces the hit rate to roughly 1-in-51, it does
 *   not eliminate it.  The 5/256 test runs every tic regardless of
 *   the leveltime gate, so the random stream is consumed when
 *   ironfeet is active even on non-damage tics.
 * - Case 9 (secret) is consumed immediately: `player.secretcount++`
 *   and `sector.special = 0`.  The airborne guard still applies — a
 *   secret is NOT credited unless the player's feet touch the floor.
 *   Clearing `special` to 0 means the sector will be ignored by
 *   subsequent ticks (the caller's sector-special iteration in
 *   `P_PlayerInSpecialSector` only reaches here when `special !== 0`).
 * - Case 11 (exit super damage) has four steps every tic in order:
 *   (1) clear `CF_GODMODE` from `player.cheats` so godmode cannot
 *   prevent the finale from killing the player; (2) if the leveltime
 *   gate fires, damage 20 regardless of the ironfeet suit; (3)
 *   compare `player.health <= 10` and call `exitLevel()` when true.
 *   The health check sees the post-damage health on tick tics and the
 *   pre-damage health otherwise.  A player who enters this sector
 *   already at 10 HP exits on their first in-sector tic even without
 *   damage being applied.
 * - The random stream and leveltime are both externalities: the
 *   caller supplies `P_Random()` via the `random` callback and the
 *   current leveltime as a plain integer.  This keeps the sector
 *   module free of host-clock and RNG-state coupling while letting
 *   tests drive both deterministically.
 *
 * Side effects (damage application, level exit) flow through
 * {@link SectorSpecialCallbacks} so the specials module stays
 * decoupled from `P_DamageMobj` and `G_ExitLevel`.  The player's
 * `cheats`, `secretcount`, and `sector.special` fields are mutated
 * in place to match vanilla's direct-struct writes.
 *
 * @example
 * ```ts
 * import {
 *   CF_GODMODE,
 *   DAMAGE_TICK_MASK,
 *   playerInSpecialSector,
 * } from "../src/specials/sectorSpecials.ts";
 *
 * playerInSpecialSector(player, sector, leveltime, {
 *   damage: (amount) => P_DamageMobj(player.mo, null, null, amount),
 *   exitLevel: () => G_ExitLevel(),
 *   random: () => P_Random(),
 * });
 * ```
 */

import { PowerType } from '../player/playerSpawn.ts';

// ── Constants ──────────────────────────────────────────────────────

/**
 * Bitmask of the leveltime damage-tick gate.  Vanilla computes
 * `!(leveltime & 0x1f)` so a damage fires exactly once every 32
 * tics — ~0.91 s at the 35 Hz game clock.  Exposed for tests that
 * need to assert the 32-tic cadence.
 */
export const DAMAGE_TICK_MASK = 0x1f;

/**
 * CF_GODMODE from d_player.h cheat_t.  Cleared from `player.cheats`
 * on every tic the player stands on a special-11 sector so the E1M8
 * finale cannot be no-clipped via IDDQD.
 */
export const CF_GODMODE = 2;

/**
 * P_Random-comparable threshold for the case-4/16 ironfeet bypass.
 * Vanilla writes `P_Random()<5`, so suited players still take the
 * strobe/super-hellslime hit with probability 5/256.
 */
export const IRONFEET_BYPASS_THRESHOLD = 5;

/**
 * Health threshold for the case-11 finale exit.  A player whose
 * health drops to 10 or below on any tic in this sector triggers
 * `G_ExitLevel()`.
 */
export const EXIT_DAMAGE_HEALTH_THRESHOLD = 10;

/** case 5 — hellslime 10/tick. */
export const DAMAGE_HELLSLIME = 10;

/** case 7 — nukage 5/tick. */
export const DAMAGE_NUKAGE = 5;

/** case 4 / case 16 — strobe and super-hellslime 20/tick. */
export const DAMAGE_STROBE_SUPER = 20;

/** case 11 — E1M8 finale 20/tick. */
export const DAMAGE_EXIT_SUPER = 20;

// ── Sector special ids ─────────────────────────────────────────────

/**
 * Sector-special ids that {@link playerInSpecialSector} dispatches on.
 * Matches the vanilla `switch (sector->special)` cases in
 * p_spec.c; all other ids are rendering-only and never reach this
 * routine because the caller gates on `sector.special !== 0` AND
 * the lighting/timer specials are consumed at level start.
 */
export const enum SectorSpecial {
  strobeHurt = 4,
  hellslimeDamage = 5,
  nukageDamage = 7,
  secretSector = 9,
  exitSuperDamage = 11,
  superHellslimeDamage = 16,
}

// ── Runtime shapes ─────────────────────────────────────────────────

/**
 * Mobj subset the sector-special dispatch touches.  Only `z` is
 * read — vanilla compares `player->mo->z` against the sector's
 * `floorheight` for the airborne guard.
 */
export interface SectorSpecialMobj {
  readonly z: number;
}

/**
 * Player subset the sector-special dispatch touches.  Fields:
 *
 * - `mo.z` — airborne guard (read-only on this module).
 * - `powers[PowerType.IRONFEET]` — radiation-suit timer; non-zero
 *   suppresses damage in cases 5/7 and randomizes cases 4/16.
 * - `cheats` — CF_GODMODE is cleared on every case-11 tic.
 * - `health` — compared against {@link EXIT_DAMAGE_HEALTH_THRESHOLD}
 *   post-damage-application for the case-11 exit gate.  Declared
 *   mutable because vanilla `P_DamageMobj` writes the player-branch
 *   `player->health` field directly; in our split that write lives
 *   inside the caller's `damage` callback and must land on the same
 *   object before the post-damage health check reads it.
 * - `secretcount` — incremented on case 9.
 */
export interface SectorSpecialPlayer {
  readonly mo: SectorSpecialMobj;
  readonly powers: readonly number[];
  cheats: number;
  health: number;
  secretcount: number;
}

/**
 * Sector subset the dispatch reads/writes.  `floorheight` is the
 * airborne-guard comparator; `special` is read to pick the switch
 * case and is cleared to 0 when case 9 (secret) consumes the
 * sector.
 */
export interface SectorSpecialSector {
  readonly floorheight: number;
  special: number;
}

// ── Callbacks ──────────────────────────────────────────────────────

/**
 * Side-effect bridge for sector specials.
 *
 * - `damage(amount)` — applied to `player.mo` with null source and
 *   inflictor, matching vanilla `P_DamageMobj(player->mo, NULL,
 *   NULL, amount)`.  The caller owns the damage pipeline; this
 *   module never reaches into it directly.
 * - `exitLevel()` — triggers `G_ExitLevel()` for the case-11
 *   finale.  Vanilla does not debounce this; the caller is
 *   expected to be idempotent.
 * - `random()` — one draw from the `P_Random` stream, range
 *   0..255.  Consumed every tic in cases 4/16 regardless of the
 *   leveltime gate; see the case-4/16 note above for the random
 *   stream impact.
 */
export interface SectorSpecialCallbacks {
  damage(amount: number): void;
  exitLevel(): void;
  random(): number;
}

// ── playerInSpecialSector (P_PlayerInSpecialSector) ────────────────

/**
 * One-tic dispatch of the player-in-sector special logic.  Mirrors
 * vanilla `P_PlayerInSpecialSector(player)` with the leveltime and
 * random-stream pulled out as explicit arguments so tests can drive
 * both deterministically.
 *
 * Early-exits without any callback invocation when the player's mobj
 * z is not touching `sector.floorheight`.  Otherwise dispatches on
 * `sector.special` and applies the vanilla case behavior described
 * in the module header.  Unknown non-zero specials throw —
 * matching vanilla's `I_Error` — so that a malformed map or an
 * out-of-range sector id is caught loudly rather than silently
 * ignored.  The caller is expected to skip the call entirely when
 * `sector.special === 0`.
 */
export function playerInSpecialSector(player: SectorSpecialPlayer, sector: SectorSpecialSector, leveltime: number, callbacks: SectorSpecialCallbacks): void {
  if (player.mo.z !== sector.floorheight) {
    return;
  }

  const tickGate = (leveltime & DAMAGE_TICK_MASK) === 0;

  switch (sector.special) {
    case SectorSpecial.hellslimeDamage: {
      if (!player.powers[PowerType.IRONFEET]) {
        if (tickGate) {
          callbacks.damage(DAMAGE_HELLSLIME);
        }
      }
      return;
    }

    case SectorSpecial.nukageDamage: {
      if (!player.powers[PowerType.IRONFEET]) {
        if (tickGate) {
          callbacks.damage(DAMAGE_NUKAGE);
        }
      }
      return;
    }

    case SectorSpecial.superHellslimeDamage:
    case SectorSpecial.strobeHurt: {
      if (!player.powers[PowerType.IRONFEET] || callbacks.random() < IRONFEET_BYPASS_THRESHOLD) {
        if (tickGate) {
          callbacks.damage(DAMAGE_STROBE_SUPER);
        }
      }
      return;
    }

    case SectorSpecial.secretSector: {
      player.secretcount = (player.secretcount + 1) | 0;
      sector.special = 0;
      return;
    }

    case SectorSpecial.exitSuperDamage: {
      player.cheats = player.cheats & ~CF_GODMODE;
      if (tickGate) {
        callbacks.damage(DAMAGE_EXIT_SUPER);
      }
      if (player.health <= EXIT_DAMAGE_HEALTH_THRESHOLD) {
        callbacks.exitLevel();
      }
      return;
    }

    default:
      throw new Error(`P_PlayerInSpecialSector: unknown special ${sector.special}`);
  }
}
