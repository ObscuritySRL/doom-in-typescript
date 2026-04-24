/**
 * Player spawn, reset, and weapon sprite infrastructure (g_game.c, p_pspr.c/h, d_player.h).
 *
 * Implements G_PlayerReborn (reset player state after death while preserving
 * level stats), P_SetupPsprites (initialize weapon overlays at level start),
 * P_SetPsprite (weapon sprite state machine), and P_BringUpWeapon.
 *
 * Enums, constants, and the weaponinfo table match Chocolate Doom 2.2.1 exactly.
 *
 * @example
 * ```ts
 * import { createPlayer, playerReborn, PlayerState } from "../src/player/playerSpawn.ts";
 * const player = createPlayer();
 * playerReborn(player);
 * ```
 */

import type { Fixed } from '../core/fixed.ts';

import { FRACBITS, FRACUNIT } from '../core/fixed.ts';

import type { TicCommand } from '../input/ticcmd.ts';
import { EMPTY_TICCMD } from '../input/ticcmd.ts';

import type { Mobj, State } from '../world/mobj.ts';
import { MAXPLAYERS, StateNum, STATES } from '../world/mobj.ts';

// ── Enums ────────────────────────────────────────────────────────────

/** playerstate_t from d_player.h. */
export const enum PlayerState {
  LIVE = 0,
  DEAD = 1,
  REBORN = 2,
}

/** weapontype_t from doomdef.h. */
export const enum WeaponType {
  FIST = 0,
  PISTOL = 1,
  SHOTGUN = 2,
  CHAINGUN = 3,
  MISSILE = 4,
  PLASMA = 5,
  BFG = 6,
  CHAINSAW = 7,
  SUPERSHOTGUN = 8,
}

/** Number of weapon types (NUMWEAPONS from doomdef.h). */
export const NUMWEAPONS = 9;

/** Sentinel: no weapon change pending (wp_nochange from doomdef.h). */
export const WP_NOCHANGE = 10;

/** ammotype_t from doomdef.h. */
export const enum AmmoType {
  CLIP = 0,
  SHELL = 1,
  CELL = 2,
  MISL = 3,
}

/** Number of ammo types (NUMAMMO from doomdef.h). */
export const NUMAMMO = 4;

/** Sentinel: weapon uses no ammo (am_noammo from doomdef.h). */
export const AM_NOAMMO = 4;

/** powertype_t from doomdef.h. */
export const enum PowerType {
  INVULNERABILITY = 0,
  STRENGTH = 1,
  INVISIBILITY = 2,
  IRONFEET = 3,
  ALLMAP = 4,
  INFRARED = 5,
}

/** Number of power types (NUMPOWERS from doomdef.h). */
export const NUMPOWERS = 6;

/** card_t from doomdef.h. */
export const enum CardType {
  BLUECARD = 0,
  YELLOWCARD = 1,
  REDCARD = 2,
  BLUESKULL = 3,
  YELLOWSKULL = 4,
  REDSKULL = 5,
}

/** Number of key card types (NUMCARDS from doomdef.h). */
export const NUMCARDS = 6;

/** psprnum_t from p_pspr.h. */
export const enum PsprNum {
  WEAPON = 0,
  FLASH = 1,
}

/** Number of player sprite layers (NUMPSPRITES from p_pspr.h). */
export const NUMPSPRITES = 2;

// ── Weapon sprite constants ──────────────────────────────────────────

/** Weapon sprite bottom-of-screen position (WEAPONBOTTOM from p_pspr.c). */
export const WEAPONBOTTOM: Fixed = (128 * FRACUNIT) | 0;

/** Weapon sprite ready position (WEAPONTOP from p_pspr.c). */
export const WEAPONTOP: Fixed = (32 * FRACUNIT) | 0;

/** Weapon lower speed per tic (LOWERSPEED from p_pspr.c). */
export const LOWERSPEED: Fixed = (FRACUNIT * 6) | 0;

/** Weapon raise speed per tic (RAISESPEED from p_pspr.c). */
export const RAISESPEED: Fixed = (FRACUNIT * 6) | 0;

// ── Player initial values ────────────────────────────────────────────

/** deh_initial_health: starting health after respawn (DEH_DEFAULT_INITIAL_HEALTH). */
export const INITIAL_HEALTH = 100;

/** deh_initial_bullets: starting bullet count after respawn (DEH_DEFAULT_INITIAL_BULLETS). */
export const INITIAL_BULLETS = 50;

/** Default maximum ammo per type: [clip, shell, cell, misl] from p_inter.c. */
export const MAX_AMMO: readonly number[] = Object.freeze([200, 50, 300, 50]);

// ── Weapon info table ────────────────────────────────────────────────

/** weaponinfo_t from d_items.h. */
export interface WeaponInfo {
  readonly ammo: number;
  readonly upstate: StateNum;
  readonly downstate: StateNum;
  readonly readystate: StateNum;
  readonly atkstate: StateNum;
  readonly flashstate: StateNum;
}

/** weaponinfo[] from d_items.c, indexed by WeaponType. */
export const WEAPON_INFO: readonly WeaponInfo[] = Object.freeze([
  { ammo: AM_NOAMMO, upstate: StateNum.PUNCHUP, downstate: StateNum.PUNCHDOWN, readystate: StateNum.PUNCH, atkstate: StateNum.PUNCH1, flashstate: StateNum.NULL },
  { ammo: AmmoType.CLIP, upstate: StateNum.PISTOLUP, downstate: StateNum.PISTOLDOWN, readystate: StateNum.PISTOL, atkstate: StateNum.PISTOL1, flashstate: StateNum.PISTOLFLASH },
  { ammo: AmmoType.SHELL, upstate: StateNum.SGUNUP, downstate: StateNum.SGUNDOWN, readystate: StateNum.SGUN, atkstate: StateNum.SGUN1, flashstate: StateNum.SGUNFLASH1 },
  { ammo: AmmoType.CLIP, upstate: StateNum.CHAINUP, downstate: StateNum.CHAINDOWN, readystate: StateNum.CHAIN, atkstate: StateNum.CHAIN1, flashstate: StateNum.CHAINFLASH1 },
  { ammo: AmmoType.MISL, upstate: StateNum.MISSILEUP, downstate: StateNum.MISSILEDOWN, readystate: StateNum.MISSILE, atkstate: StateNum.MISSILE1, flashstate: StateNum.MISSILEFLASH1 },
  { ammo: AmmoType.CELL, upstate: StateNum.PLASMAUP, downstate: StateNum.PLASMADOWN, readystate: StateNum.PLASMA, atkstate: StateNum.PLASMA1, flashstate: StateNum.PLASMAFLASH1 },
  { ammo: AmmoType.CELL, upstate: StateNum.BFGUP, downstate: StateNum.BFGDOWN, readystate: StateNum.BFG, atkstate: StateNum.BFG1, flashstate: StateNum.BFGFLASH1 },
  { ammo: AM_NOAMMO, upstate: StateNum.SAWUP, downstate: StateNum.SAWDOWN, readystate: StateNum.SAW, atkstate: StateNum.SAW1, flashstate: StateNum.NULL },
  { ammo: AmmoType.SHELL, upstate: StateNum.DSGUNUP, downstate: StateNum.DSGUNDOWN, readystate: StateNum.DSGUN, atkstate: StateNum.DSGUN1, flashstate: StateNum.DSGUNFLASH1 },
]);

// ── Player sprite definition ─────────────────────────────────────────

/** pspdef_t from p_pspr.h. */
export interface PspriteDef {
  state: State | null;
  tics: number;
  sx: Fixed;
  sy: Fixed;
}

/** Create a zeroed psprite slot. */
function createPspriteDef(): PspriteDef {
  return { state: null, tics: 0, sx: 0, sy: 0 };
}

// ── Player structure ─────────────────────────────────────────────────

/** Player action function signature for weapon sprite states. */
export type PspriteActionFunction = (player: Player, psp: PspriteDef) => void;

/**
 * Psprite action lookup table, indexed by StateNum.
 *
 * Populated by {@link wireWeaponStateActions} from weaponStates.ts.
 * setPsprite checks this table to invoke the correct psprite action
 * (A_WeaponReady, A_Lower, A_Raise, etc.) during state transitions.
 */
export const pspriteActions: (PspriteActionFunction | undefined)[] = [];

/**
 * player_t from d_player.h.
 *
 * Mutable game state for one player. All fields start at zero/null/false
 * defaults; {@link playerReborn} sets the canonical spawn state.
 */
export interface Player {
  mo: Mobj | null;
  playerstate: PlayerState;
  cmd: TicCommand;

  viewz: Fixed;
  viewheight: Fixed;
  deltaviewheight: Fixed;
  bob: Fixed;

  health: number;
  armorpoints: number;
  armortype: number;

  powers: number[];
  cards: boolean[];
  backpack: boolean;

  frags: number[];
  readyweapon: number;
  pendingweapon: number;
  weaponowned: boolean[];
  ammo: number[];
  maxammo: number[];

  attackdown: boolean;
  usedown: boolean;
  cheats: number;
  refire: number;

  killcount: number;
  itemcount: number;
  secretcount: number;

  message: string | null;
  damagecount: number;
  bonuscount: number;
  attacker: Mobj | null;

  extralight: number;
  fixedcolormap: number;
  colormap: number;

  psprites: PspriteDef[];
  didsecret: boolean;
}

/**
 * Allocate a fresh player with all fields at their zero/null/false defaults.
 *
 * The resulting player is NOT ready for gameplay until {@link playerReborn}
 * is called to set initial health, weapons, and ammo.
 *
 * @example
 * ```ts
 * const player = createPlayer();
 * playerReborn(player);
 * ```
 */
export function createPlayer(): Player {
  return {
    mo: null,
    playerstate: PlayerState.LIVE,
    cmd: EMPTY_TICCMD,

    viewz: 0,
    viewheight: 0,
    deltaviewheight: 0,
    bob: 0,

    health: 0,
    armorpoints: 0,
    armortype: 0,

    powers: new Array<number>(NUMPOWERS).fill(0),
    cards: new Array<boolean>(NUMCARDS).fill(false),
    backpack: false,

    frags: new Array<number>(MAXPLAYERS).fill(0),
    readyweapon: WeaponType.PISTOL,
    pendingweapon: WeaponType.PISTOL,
    weaponowned: new Array<boolean>(NUMWEAPONS).fill(false),
    ammo: new Array<number>(NUMAMMO).fill(0),
    maxammo: new Array<number>(NUMAMMO).fill(0),

    attackdown: false,
    usedown: false,
    cheats: 0,
    refire: 0,

    killcount: 0,
    itemcount: 0,
    secretcount: 0,

    message: null,
    damagecount: 0,
    bonuscount: 0,
    attacker: null,

    extralight: 0,
    fixedcolormap: 0,
    colormap: 0,

    psprites: [createPspriteDef(), createPspriteDef()],
    didsecret: false,
  };
}

// ── P_SetPsprite ─────────────────────────────────────────────────────

/**
 * P_SetPsprite: set a player sprite to a given state.
 *
 * Chains through 0-tic states immediately (calling their actions),
 * stopping when a state with tics > 0 is reached or the state becomes
 * null (stnum === 0 / S_NULL removes the psprite).
 *
 * Parity-critical: misc1/misc2 non-zero sets sx/sy (coordinate override),
 * matching the original coordinate-set path in P_SetPsprite.
 *
 * @param player - The owning player.
 * @param position - PsprNum.WEAPON or PsprNum.FLASH.
 * @param stnum - Target StateNum.
 */
export function setPsprite(player: Player, position: PsprNum, stnum: StateNum): void {
  const psp = player.psprites[position]!;

  let currentState = stnum;
  do {
    if (!currentState) {
      psp.state = null;
      break;
    }

    const state = STATES[currentState]!;
    psp.state = state;
    psp.tics = state.tics;

    if (state.misc1) {
      psp.sx = state.misc1 << FRACBITS;
      psp.sy = state.misc2 << FRACBITS;
    }

    const psprAction = pspriteActions[currentState];
    if (psprAction) {
      psprAction(player, psp);
      if (!psp.state) break;
    }

    currentState = psp.state.nextstate;
  } while (!psp.tics);
}

// ── P_BringUpWeapon ──────────────────────────────────────────────────

/**
 * P_BringUpWeapon: start raising the pending weapon from the bottom.
 *
 * Matches p_pspr.c P_BringUpWeapon exactly:
 * 1. If no pending weapon, use readyweapon.
 * 2. Chainsaw plays sfx_sawup (deferred to sound callback).
 * 3. Set weapon sy to WEAPONBOTTOM.
 * 4. Set weapon sprite to the pending weapon's upstate.
 * 5. Clear pending weapon to wp_nochange.
 *
 * @param player - The player bringing up the weapon.
 * @param startSoundCallback - Optional callback for chainsaw sound.
 */
export function bringUpWeapon(player: Player, startSoundCallback?: (mobj: Mobj | null, sound: number) => void): void {
  if (player.pendingweapon === WP_NOCHANGE) {
    player.pendingweapon = player.readyweapon;
  }

  if (player.pendingweapon === WeaponType.CHAINSAW && startSoundCallback && player.mo) {
    startSoundCallback(player.mo, 25);
  }

  const newstate = WEAPON_INFO[player.pendingweapon]!.upstate;

  player.pendingweapon = WP_NOCHANGE;
  player.psprites[PsprNum.WEAPON]!.sy = WEAPONBOTTOM;

  setPsprite(player, PsprNum.WEAPON, newstate);
}

// ── G_PlayerReborn ───────────────────────────────────────────────────

/**
 * G_PlayerReborn: reset a player after death, preserving level stats.
 *
 * Saves frags, killcount, itemcount, and secretcount, then zeroes all
 * player state and restores the saved values. Sets the canonical spawn
 * loadout: pistol + fist, 50 bullets, 100 health, full max ammo.
 *
 * Parity-critical: attackdown and usedown are set to true so the player
 * does not immediately fire or use on the first frame after respawn
 * (the C code sets them to 1 which is truthy in the button checks).
 *
 * @param player - The player to reset.
 *
 * @example
 * ```ts
 * import { playerReborn } from "../src/player/playerSpawn.ts";
 * playerReborn(player);
 * ```
 */
export function playerReborn(player: Player): void {
  const savedFrags = player.frags.slice();
  const savedKillcount = player.killcount;
  const savedItemcount = player.itemcount;
  const savedSecretcount = player.secretcount;

  // Zero all fields (mirrors memset(p, 0, sizeof(*p)))
  player.mo = null;
  player.playerstate = PlayerState.LIVE;
  player.cmd = EMPTY_TICCMD;

  player.viewz = 0;
  player.viewheight = 0;
  player.deltaviewheight = 0;
  player.bob = 0;

  player.health = INITIAL_HEALTH;
  player.armorpoints = 0;
  player.armortype = 0;

  player.powers.fill(0);
  player.cards.fill(false);
  player.backpack = false;

  for (let index = 0; index < MAXPLAYERS; index++) {
    player.frags[index] = savedFrags[index]!;
  }

  player.readyweapon = WeaponType.PISTOL;
  player.pendingweapon = WeaponType.PISTOL;
  player.weaponowned.fill(false);
  player.weaponowned[WeaponType.FIST] = true;
  player.weaponowned[WeaponType.PISTOL] = true;

  player.ammo.fill(0);
  player.ammo[AmmoType.CLIP] = INITIAL_BULLETS;

  for (let index = 0; index < NUMAMMO; index++) {
    player.maxammo[index] = MAX_AMMO[index]!;
  }

  player.attackdown = true;
  player.usedown = true;
  player.cheats = 0;
  player.refire = 0;

  player.killcount = savedKillcount;
  player.itemcount = savedItemcount;
  player.secretcount = savedSecretcount;

  player.message = null;
  player.damagecount = 0;
  player.bonuscount = 0;
  player.attacker = null;

  player.extralight = 0;
  player.fixedcolormap = 0;
  player.colormap = 0;

  for (let index = 0; index < NUMPSPRITES; index++) {
    player.psprites[index]!.state = null;
    player.psprites[index]!.tics = 0;
    player.psprites[index]!.sx = 0;
    player.psprites[index]!.sy = 0;
  }

  player.didsecret = false;
}

// ── P_SetupPsprites ──────────────────────────────────────────────────

/**
 * P_SetupPsprites: called at start of level for each player.
 *
 * Clears all psprites, then raises the ready weapon from the bottom.
 * Matches p_pspr.c P_SetupPsprites exactly.
 *
 * @param player - The player to set up weapon sprites for.
 */
export function setupPsprites(player: Player): void {
  for (let index = 0; index < NUMPSPRITES; index++) {
    player.psprites[index]!.state = null;
  }

  player.pendingweapon = player.readyweapon;
  bringUpWeapon(player);
}

// ── P_MovePsprites ───────────────────────────────────────────────────

/**
 * P_MovePsprites: called every tic by player thinking routine.
 *
 * Ticks down each active psprite and transitions when tics reach 0.
 * Flash sprite position is synced to weapon sprite position.
 * Matches p_pspr.c P_MovePsprites exactly.
 *
 * @param player - The player whose weapon sprites to advance.
 */
export function movePsprites(player: Player): void {
  for (let index = 0; index < NUMPSPRITES; index++) {
    const psp = player.psprites[index]!;

    if (psp.state) {
      if (psp.tics !== -1) {
        psp.tics--;
        if (!psp.tics) {
          setPsprite(player, index as PsprNum, psp.state.nextstate);
        }
      }
    }
  }

  player.psprites[PsprNum.FLASH]!.sx = player.psprites[PsprNum.WEAPON]!.sx;
  player.psprites[PsprNum.FLASH]!.sy = player.psprites[PsprNum.WEAPON]!.sy;
}
