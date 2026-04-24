/**
 * Status bar widget and face state machine (st_stuff.c).
 *
 * Implements the pure-logic half of the vanilla DOOM status bar:
 * `ST_updateFaceWidget` (the face-selection state machine),
 * `ST_calcPainOffset` (the cached pain-level lookup), `ST_updateWidgets`
 * key-box / weapon-arms / frag computations, and the per-tic tick
 * bookkeeping (`st_oldhealth`, `oldweaponsowned`).  Pixel drawing is
 * out of scope for this step; callers consume {@link StatusBarValues}
 * and render through the asset catalog from `./assets.ts`.
 *
 * Parity invariants preserved byte-for-byte:
 *
 *  - The "ouch face" bug: `plyr->health - st_oldhealth > ST_MUCHPAIN`
 *    fires only when health *increases* by more than 20 in a single
 *    tic (e.g., a medikit pickup mid-fight), not when health drops.
 *    Widely documented on doomwiki.org as an original release bug.
 *  - Key boxes retain the last seen key type forever: vanilla never
 *    resets `keyboxes[i]` to -1 after a respawn, so a player who had
 *    a red keycard and died still shows the icon on the HUD.
 *  - `oldweaponsowned` is initialized from the player's current
 *    weapons at `createStatusBarState` time, matching `ST_initData`.
 *    A refactor that leaves it all-false would trigger a spurious
 *    evil grin on the first bonus pickup of the level.
 *  - `ST_calcPainOffset` caches `lastcalc`/`oldhealth` statics; calling
 *    it twice with the same clamped health does NOT recompute.
 *  - The attacker-pain branch sets `priority = 7` *before* the
 *    much-pain check, so even a non-much-pain hit locks out the
 *    own-pain and rampage branches for this tic.
 *  - `lastAttackDown` sentinel is `-1` (not 0, not null); `-1` means
 *    "attack not held this tic", positive values count down toward
 *    the rampage face, and the post-fire reset is `1` so the next
 *    tic immediately fires again while attack stays held.
 *  - The straight-face cycle is 17 tics (`TICRATE / 2` integer-divided),
 *    NOT 35; swapping to 35 would halve the face animation rate.
 *  - `st_randomnumber` is an `M_Random()` sample (menu stream) not
 *    `P_Random()`, so face cycling never desyncs demo playback.
 *  - `keyBoxes[i]` for skulls OVERWRITES the keycard entry when both
 *    are held (because the skull check runs after the card check).
 *  - The ready-weapon ammo widget points at the `ST_LARGEAMMO = 1994`
 *    sentinel when the current weapon uses no ammo (fist / chainsaw).
 *
 * @example
 * ```ts
 * import { createStatusBarState, tickStatusBar, computeStatusBarValues } from "../src/ui/statusBar.ts";
 *
 * const state = createStatusBarState(player);
 * tickStatusBar(state, { player, godMode: false, randomNumber: 42, pointToAngle2 });
 * const values = computeStatusBarValues({ state, player, deathmatch: false, statusBarOn: true, consolePlayer: 0 });
 * ```
 */

import type { Angle } from '../core/angle.ts';
import { ANG45, ANG180 } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import type { Player } from '../player/playerSpawn.ts';
import { AM_NOAMMO, NUMAMMO, NUMWEAPONS, PowerType, WEAPON_INFO } from '../player/playerSpawn.ts';
import { MAXPLAYERS } from '../world/mobj.ts';
import { ST_DEADFACE_INDEX, ST_FACESTRIDE, ST_GODFACE_INDEX, ST_NUMPAINFACES, ST_NUMSTRAIGHTFACES, ST_NUMTURNFACES } from './assets.ts';

// ── Tic-based durations (TICRATE = 35) ───────────────────────────────

/** Number of tics each straight-facing face frame is displayed (`TICRATE/2 = 17`). */
export const ST_STRAIGHTFACECOUNT = Math.floor(35 / 2);

/** Tics to show a turn-head reaction face (`1 * TICRATE`). */
export const ST_TURNCOUNT = 35;

/** Tics to show an ouch reaction face (`1 * TICRATE`). */
export const ST_OUCHCOUNT = 35;

/** Tics to show the evil-grin face after picking up a new weapon (`2 * TICRATE`). */
export const ST_EVILGRINCOUNT = 35 * 2;

/** Tics the player must hold attack before rampage face appears (`2 * TICRATE`). */
export const ST_RAMPAGEDELAY = 35 * 2;

/** Health-delta threshold that triggers the OUCH face (vanilla ouch-face bug applies). */
export const ST_MUCHPAIN = 20;

// ── Face state offsets within a pain level ───────────────────────────

/** Offset of the first turn face (right) within a pain-level row. */
export const ST_TURNOFFSET = ST_NUMSTRAIGHTFACES;

/** Offset of the OUCH face within a pain-level row. */
export const ST_OUCHOFFSET = ST_TURNOFFSET + ST_NUMTURNFACES;

/** Offset of the evil-grin face within a pain-level row. */
export const ST_EVILGRINOFFSET = ST_OUCHOFFSET + 1;

/** Offset of the rampage face within a pain-level row. */
export const ST_RAMPAGEOFFSET = ST_EVILGRINOFFSET + 1;

// ── Face priority values ─────────────────────────────────────────────

/** Priority 0 — "look" face (straight-cycle). Lowest priority. */
export const ST_FACE_PRIORITY_LOOK = 0;

/** Priority 4 — god-mode or invulnerability face. */
export const ST_FACE_PRIORITY_INVUL = 4;

/** Priority 5 — rampage (held-attack) face. */
export const ST_FACE_PRIORITY_RAMPAGE = 5;

/** Priority 6 — regular self-inflicted pain (rampage-offset face). */
export const ST_FACE_PRIORITY_OWN_PAIN = 6;

/** Priority 7 — attacker-induced pain (turn / ouch) or own much-pain. */
export const ST_FACE_PRIORITY_PAIN = 7;

/** Priority 8 — evil grin (new weapon pickup). */
export const ST_FACE_PRIORITY_EVIL_GRIN = 8;

/** Priority 9 — dead face. Second-highest slot so `priority < 10` still enters. */
export const ST_FACE_PRIORITY_DEAD = 9;

// ── Widget constants ─────────────────────────────────────────────────

/** `ST_LARGEAMMO` sentinel: no-ammo weapons point the ready-ammo widget here. */
export const ST_LARGEAMMO = 1994;

/** Number of key slots shown on the status bar (blue, yellow, red). */
export const ST_NUM_KEY_BOXES = 3;

/** Number of weapon slots shown on the arms chart (slots 2..7). */
export const ST_NUM_ARMS_SLOTS = 6;

/** `lastAttackDown` sentinel meaning "attack not held this tic". */
export const ST_LAST_ATTACK_DOWN_IDLE = -1;

// ── State types ──────────────────────────────────────────────────────

/** Mutable state for the status bar face widget. Mirrors file-static globals in st_stuff.c. */
export interface FaceWidgetState {
  /** Current face-table index (0..41), selected by the last tick. */
  faceIndex: number;
  /** Tics remaining before the current face expression expires. */
  faceCount: number;
  /** Current face priority (0..9). Higher values lock out lower-priority branches. */
  priority: number;
  /** Rampage timer: `-1` = idle, `>= 1` = tics remaining until rampage face fires. */
  lastAttackDown: number;
  /** Previous tic's health, for the ouch / much-pain delta check. Starts at `-1`. */
  oldHealth: number;
  /** Previous tic's weaponowned snapshot, for the evil-grin weapon-change detector. */
  oldWeaponsOwned: boolean[];
  /** `ST_calcPainOffset` cached result (matches static `lastcalc`). */
  painOffsetLastCalc: number;
  /** `ST_calcPainOffset` cached input health (matches static `oldhealth` local). Starts at `-1`. */
  painOffsetLastHealth: number;
}

/** Mutable state for the full status bar (face plus key-box memory). */
export interface StatusBarState {
  readonly face: FaceWidgetState;
  /** Per-color key slot (blue=0, yellow=1, red=2). `-1` means no key seen yet. */
  readonly keyBoxes: number[];
}

// ── State construction ───────────────────────────────────────────────

/**
 * Create a fresh status bar state initialized against the current player.
 *
 * Mirrors `ST_initData`: snapshots the player's current `weaponowned`
 * array into `face.oldWeaponsOwned` so the first bonus pickup does not
 * spuriously trigger the evil grin, and seeds `oldHealth = -1` so the
 * first tick does not fire the ouch branch (damagecount is 0 anyway on
 * the first tic).  Key boxes all start at `-1`.
 *
 * @throws {RangeError} If `player.weaponowned` is not exactly `NUMWEAPONS` long.
 */
export function createStatusBarState(player: Player): StatusBarState {
  if (player.weaponowned.length !== NUMWEAPONS) {
    throw new RangeError(`createStatusBarState: player.weaponowned must have ${NUMWEAPONS} entries, got ${player.weaponowned.length}`);
  }
  const face: FaceWidgetState = {
    faceIndex: 0,
    faceCount: 0,
    priority: ST_FACE_PRIORITY_LOOK,
    lastAttackDown: ST_LAST_ATTACK_DOWN_IDLE,
    oldHealth: -1,
    oldWeaponsOwned: player.weaponowned.slice(),
    painOffsetLastCalc: 0,
    painOffsetLastHealth: -1,
  };
  const keyBoxes: number[] = new Array<number>(ST_NUM_KEY_BOXES).fill(-1);
  return { face, keyBoxes };
}

// ── ST_calcPainOffset ────────────────────────────────────────────────

/**
 * Compute the face-row pain offset for a given health value.
 *
 * Formula: `ST_FACESTRIDE * floor(((100 - clamped) * ST_NUMPAINFACES) / 101)`
 * with `clamped = min(health, 100)` (no lower clamp, matching vanilla).
 * Calling the function with the same clamped health as the previous
 * call returns the cached result WITHOUT recomputing, mirroring the
 * `static lastcalc` / `static oldhealth` pattern in st_stuff.c.
 *
 * Break points with full health range: 0 at 80..100, 8 at 60..79,
 * 16 at 40..59, 24 at 20..39, 32 at 1..19 and 0.
 */
export function calcPainOffset(state: FaceWidgetState, health: number): number {
  const clamped = health > 100 ? 100 : health;
  if (clamped !== state.painOffsetLastHealth) {
    state.painOffsetLastCalc = ST_FACESTRIDE * Math.floor(((100 - clamped) * ST_NUMPAINFACES) / 101);
    state.painOffsetLastHealth = clamped;
  }
  return state.painOffsetLastCalc;
}

// ── tickFaceWidget ───────────────────────────────────────────────────

/** Context bundle passed into {@link tickFaceWidget} every tic. */
export interface FaceWidgetTickContext {
  /** The player whose face is being updated (typically `players[consoleplayer]`). */
  readonly player: Player;
  /** `plyr->cheats & CF_GODMODE` precomputed by the caller. */
  readonly godMode: boolean;
  /** Current tic's `st_randomnumber` (0..255 from the menu-stream `M_Random`). */
  readonly randomNumber: number;
  /** Injected `R_PointToAngle2`; called only when the attacker-pain branch fires. */
  readonly pointToAngle2: (x1: Fixed, y1: Fixed, x2: Fixed, y2: Fixed) => Angle;
}

/**
 * Advance the face state machine by one tic.
 *
 * Branches execute in descending priority order (9 → 4) with strict
 * `priority < N` guards so higher-priority branches lock out lower
 * ones.  After all branches, the "look" branch fires iff `faceCount`
 * hit 0, and finally `faceCount` is decremented and `oldHealth` is
 * snapshotted for next tic's delta check.
 */
export function tickFaceWidget(state: FaceWidgetState, ctx: FaceWidgetTickContext): void {
  const plyr = ctx.player;

  if (state.priority < 10) {
    if (plyr.health === 0) {
      state.priority = ST_FACE_PRIORITY_DEAD;
      state.faceIndex = ST_DEADFACE_INDEX;
      state.faceCount = 1;
    }
  }

  if (state.priority < 9) {
    if (plyr.bonuscount > 0) {
      let doEvilGrin = false;
      for (let i = 0; i < NUMWEAPONS; i++) {
        if (state.oldWeaponsOwned[i] !== plyr.weaponowned[i]) {
          doEvilGrin = true;
          state.oldWeaponsOwned[i] = plyr.weaponowned[i]!;
        }
      }
      if (doEvilGrin) {
        state.priority = ST_FACE_PRIORITY_EVIL_GRIN;
        state.faceCount = ST_EVILGRINCOUNT;
        state.faceIndex = calcPainOffset(state, plyr.health) + ST_EVILGRINOFFSET;
      }
    }
  }

  if (state.priority < 8) {
    if (plyr.damagecount > 0 && plyr.attacker !== null && plyr.attacker !== plyr.mo && plyr.mo !== null) {
      state.priority = ST_FACE_PRIORITY_PAIN;
      if (plyr.health - state.oldHealth > ST_MUCHPAIN) {
        state.faceCount = ST_TURNCOUNT;
        state.faceIndex = calcPainOffset(state, plyr.health) + ST_OUCHOFFSET;
      } else {
        const playerAngle = plyr.mo.angle >>> 0;
        const badGuyAngle = ctx.pointToAngle2(plyr.mo.x, plyr.mo.y, plyr.attacker.x, plyr.attacker.y) >>> 0;
        let diffAngle: number;
        let turnFlag: boolean;
        if (badGuyAngle > playerAngle) {
          diffAngle = (badGuyAngle - playerAngle) >>> 0;
          turnFlag = diffAngle > ANG180;
        } else {
          diffAngle = (playerAngle - badGuyAngle) >>> 0;
          turnFlag = diffAngle <= ANG180;
        }
        state.faceCount = ST_TURNCOUNT;
        state.faceIndex = calcPainOffset(state, plyr.health);
        if (diffAngle < ANG45) {
          state.faceIndex += ST_RAMPAGEOFFSET;
        } else if (turnFlag) {
          state.faceIndex += ST_TURNOFFSET;
        } else {
          state.faceIndex += ST_TURNOFFSET + 1;
        }
      }
    }
  }

  if (state.priority < 7) {
    if (plyr.damagecount > 0) {
      if (plyr.health - state.oldHealth > ST_MUCHPAIN) {
        state.priority = ST_FACE_PRIORITY_PAIN;
        state.faceCount = ST_TURNCOUNT;
        state.faceIndex = calcPainOffset(state, plyr.health) + ST_OUCHOFFSET;
      } else {
        state.priority = ST_FACE_PRIORITY_OWN_PAIN;
        state.faceCount = ST_TURNCOUNT;
        state.faceIndex = calcPainOffset(state, plyr.health) + ST_RAMPAGEOFFSET;
      }
    }
  }

  if (state.priority < 6) {
    if (plyr.attackdown) {
      if (state.lastAttackDown === ST_LAST_ATTACK_DOWN_IDLE) {
        state.lastAttackDown = ST_RAMPAGEDELAY;
      } else {
        state.lastAttackDown--;
        if (state.lastAttackDown === 0) {
          state.priority = ST_FACE_PRIORITY_RAMPAGE;
          state.faceIndex = calcPainOffset(state, plyr.health) + ST_RAMPAGEOFFSET;
          state.faceCount = 1;
          state.lastAttackDown = 1;
        }
      }
    } else {
      state.lastAttackDown = ST_LAST_ATTACK_DOWN_IDLE;
    }
  }

  if (state.priority < 5) {
    if (ctx.godMode || plyr.powers[PowerType.INVULNERABILITY]! > 0) {
      state.priority = ST_FACE_PRIORITY_INVUL;
      state.faceIndex = ST_GODFACE_INDEX;
      state.faceCount = 1;
    }
  }

  if (state.faceCount === 0) {
    state.faceIndex = calcPainOffset(state, plyr.health) + (ctx.randomNumber % ST_NUMSTRAIGHTFACES);
    state.faceCount = ST_STRAIGHTFACECOUNT;
    state.priority = ST_FACE_PRIORITY_LOOK;
  }

  state.faceCount--;

  state.oldHealth = plyr.health;
}

// ── Key box update ───────────────────────────────────────────────────

/**
 * Update the three key-box slots from the player's cards array.
 *
 * For each color slot (blue=0, yellow=1, red=2) we first check the
 * keycard (`cards[i]`) and then the skull (`cards[i + 3]`).  Because
 * the skull check runs second, holding both a keycard and a skull of
 * the same color leaves the skull index (`i + 3`) in the slot — the
 * keycard value is overwritten.  Slots are never reset to `-1`, so a
 * key seen once persists on the HUD for the rest of the session even
 * after death and respawn (vanilla quirk).
 */
export function updateKeyBoxes(state: StatusBarState, player: Player): void {
  for (let i = 0; i < ST_NUM_KEY_BOXES; i++) {
    if (player.cards[i]) {
      state.keyBoxes[i] = i;
    }
    if (player.cards[i + 3]) {
      state.keyBoxes[i] = i + 3;
    }
  }
}

// ── Combined tick ────────────────────────────────────────────────────

/**
 * Advance all status-bar state (key boxes + face widget) by one tic.
 *
 * Equivalent to the portion of `ST_Ticker` that calls `ST_updateWidgets`
 * (which internally runs the key-box update loop and `ST_updateFaceWidget`)
 * followed by the `st_oldhealth = plyr->health` snapshot.  Palette-effect
 * and chat-message updates belong to other step files.
 */
export function tickStatusBar(state: StatusBarState, ctx: FaceWidgetTickContext): void {
  updateKeyBoxes(state, ctx.player);
  tickFaceWidget(state.face, ctx);
}

// ── Widget snapshot ──────────────────────────────────────────────────

/** Displayable values derived from {@link StatusBarState} plus {@link Player}. */
export interface StatusBarValues {
  /** Ready-ammo readout. `ST_LARGEAMMO` for fist/chainsaw. */
  readonly ready: number;
  /** Player health in range 0..200 (can be above 100 with powerups). */
  readonly health: number;
  /** Player armor points (0..200). */
  readonly armor: number;
  /** `plyr->armortype`: 0=none, 1=green, 2=blue. */
  readonly armorType: number;
  /** Frag total: sum of frags against non-console players minus self-suicides. */
  readonly frags: number;
  /** `st_fragson`: frag widget visible iff deathmatch && statusBarOn. */
  readonly fragsVisible: boolean;
  /** `st_armson`: weapon-slot widgets visible iff !deathmatch && statusBarOn. */
  readonly armsVisible: boolean;
  /** Per-slot ownership: index 0 → pistol (slot 2), …, index 5 → BFG (slot 7). */
  readonly armsOwned: readonly boolean[];
  /** Current ammo count per AmmoType (length 4). */
  readonly currentAmmo: readonly number[];
  /** Max ammo count per AmmoType (length 4). */
  readonly maxAmmo: readonly number[];
  /** Per-color key slot: -1 if no key seen, else card index 0..5. */
  readonly keyBoxes: readonly number[];
  /** Current face-table index (0..41) as selected by the face state machine. */
  readonly faceIndex: number;
}

/** Input bundle for {@link computeStatusBarValues}. */
export interface StatusBarValuesContext {
  readonly state: StatusBarState;
  readonly player: Player;
  readonly deathmatch: boolean;
  readonly statusBarOn: boolean;
  readonly consolePlayer: number;
}

/**
 * Produce a frozen snapshot of the current status-bar display values.
 *
 * Pure — does NOT mutate state or player.  The `ready` field follows
 * the `weaponinfo[readyweapon].ammo == am_noammo` branch: a fist or
 * chainsaw returns `ST_LARGEAMMO` (the vanilla "draw nothing" sentinel),
 * otherwise the caller's current ammo count for the selected ammo type.
 *
 * Frags total is `sum(frags[i] for i != consolePlayer) - frags[consolePlayer]`
 * so suicides reduce the displayed frag count.
 */
export function computeStatusBarValues(ctx: StatusBarValuesContext): Readonly<StatusBarValues> {
  const plyr = ctx.player;
  const weaponAmmoType = WEAPON_INFO[plyr.readyweapon]!.ammo;
  const ready = weaponAmmoType === AM_NOAMMO ? ST_LARGEAMMO : plyr.ammo[weaponAmmoType]!;

  let frags = 0;
  for (let i = 0; i < MAXPLAYERS; i++) {
    if (i !== ctx.consolePlayer) {
      frags += plyr.frags[i]!;
    } else {
      frags -= plyr.frags[i]!;
    }
  }

  const armsOwned: boolean[] = new Array<boolean>(ST_NUM_ARMS_SLOTS);
  for (let slot = 0; slot < ST_NUM_ARMS_SLOTS; slot++) {
    armsOwned[slot] = plyr.weaponowned[slot + 1] === true;
  }

  const currentAmmo: number[] = new Array<number>(NUMAMMO);
  const maxAmmo: number[] = new Array<number>(NUMAMMO);
  for (let i = 0; i < NUMAMMO; i++) {
    currentAmmo[i] = plyr.ammo[i]!;
    maxAmmo[i] = plyr.maxammo[i]!;
  }

  return Object.freeze({
    ready,
    health: plyr.health,
    armor: plyr.armorpoints,
    armorType: plyr.armortype,
    frags,
    fragsVisible: ctx.statusBarOn && ctx.deathmatch,
    armsVisible: ctx.statusBarOn && !ctx.deathmatch,
    armsOwned: Object.freeze(armsOwned),
    currentAmmo: Object.freeze(currentAmmo),
    maxAmmo: Object.freeze(maxAmmo),
    keyBoxes: Object.freeze(ctx.state.keyBoxes.slice()),
    faceIndex: ctx.state.face.faceIndex,
  });
}
