/**
 * Weapon state machine actions (p_pspr.c).
 *
 * Implements the core psprite action functions that drive weapon behavior:
 * A_WeaponReady, A_Lower, A_Raise, A_ReFire, A_CheckReload, A_GunFlash,
 * A_Light0/1/2, P_FireWeapon, and P_DropWeapon.
 *
 * Attack-specific actions (A_Punch, A_Saw, A_FirePistol, A_FireShotgun,
 * A_FireCGun, A_FireMissile, A_FirePlasma, A_FireBFG, etc.) are deferred
 * to steps 10-005 (hitscan) and 10-006 (projectile).
 *
 * All behavior matches Chocolate Doom 2.2.1 exactly.
 *
 * @example
 * ```ts
 * import { wireWeaponStateActions, setWeaponStateContext } from "../src/player/weaponStates.ts";
 * wireWeaponStateActions();
 * setWeaponStateContext({ leveltime: 0, gamemode: "shareware", thinkerList, ... });
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import type { GameMode } from '../bootstrap/gameMode.ts';
import type { Mobj } from '../world/mobj.ts';
import type { ThinkerList } from '../world/thinkers.ts';
import type { Player, PspriteDef } from './playerSpawn.ts';

import { FRACUNIT } from '../core/fixed.ts';
import { fixedMul } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, FINEANGLES, FINEMASK, finecosine, finesine } from '../core/trig.ts';
import { BT_ATTACK } from '../input/ticcmd.ts';
import { StateNum, STATES, setMobjState } from '../world/mobj.ts';
import { PlayerState, PsprNum, WEAPONBOTTOM, WEAPONTOP, WEAPON_INFO, WeaponType, WP_NOCHANGE, LOWERSPEED, RAISESPEED, bringUpWeapon, pspriteActions, setPsprite } from './playerSpawn.ts';
import { checkAmmo } from './weapons.ts';

// ── Context ──────────────────────────────────────────────────────────

/**
 * Shared mutable state required by weapon psprite actions.
 *
 * The caller must update `leveltime` each tic before movePsprites runs.
 * Sound and noise callbacks are optional until those subsystems exist.
 */
export interface WeaponStateContext {
  leveltime: number;
  gamemode: GameMode;
  thinkerList: ThinkerList;
  startSound: ((origin: Mobj | null, soundId: number) => void) | null;
  noiseAlert: ((target: Mobj, emitter: Mobj) => void) | null;
}

/** Module-level context — set before the game loop via {@link setWeaponStateContext}. */
let context: WeaponStateContext | null = null;

/** Install the shared context that weapon actions read each tic. */
export function setWeaponStateContext(ctx: WeaponStateContext | null): void {
  context = ctx;
}

/** Retrieve the current context (for testing inspection). */
export function getWeaponStateContext(): WeaponStateContext | null {
  return context;
}

// ── SFX constants ────────────────────────────────────────────────────

/** sfx_sawidl from sounds.h — chainsaw idle loop. */
export const SFX_SAWIDL = 12;

// ── P_FireWeapon ─────────────────────────────────────────────────────

/**
 * P_FireWeapon: initiate a weapon attack.
 *
 * Checks ammo via P_CheckAmmo, sets the player mobj to S_PLAY_ATK1,
 * transitions the weapon psprite to the weapon's atkstate, and fires
 * a noise alert. Matches p_pspr.c P_FireWeapon exactly.
 *
 * @param player - The firing player.
 */
export function fireWeapon(player: Player): void {
  if (!context) return;

  if (!checkAmmo(player, context.gamemode)) return;

  if (player.mo) {
    setMobjState(player.mo, StateNum.PLAY_ATK1, context.thinkerList);
  }

  const newstate = WEAPON_INFO[player.readyweapon]!.atkstate;
  setPsprite(player, PsprNum.WEAPON, newstate);

  if (context.noiseAlert && player.mo) {
    context.noiseAlert(player.mo, player.mo);
  }
}

// ── P_DropWeapon ─────────────────────────────────────────────────────

/**
 * P_DropWeapon: lower the current weapon immediately.
 *
 * Called when the player dies or takes enough damage to flinch.
 * Transitions the weapon psprite to the weapon's downstate.
 * Matches p_pspr.c P_DropWeapon exactly.
 *
 * @param player - The player dropping the weapon.
 */
export function dropWeapon(player: Player): void {
  setPsprite(player, PsprNum.WEAPON, WEAPON_INFO[player.readyweapon]!.downstate);
}

// ── Action functions ─────────────────────────────────────────────────

/**
 * A_WeaponReady: idle weapon state action.
 *
 * Resets the player mobj from attack frames, plays chainsaw idle sound
 * when applicable, checks for weapon change or death (lowers weapon),
 * handles fire button (calls P_FireWeapon with semi-auto gating for
 * missile and BFG), and applies weapon bob based on leveltime.
 *
 * Parity-critical: bob uses `(128 * leveltime) & FINEMASK` for sx
 * (full cosine range) and `angle & (FINEANGLES/2 - 1)` for sy
 * (half sine range, always positive = downward bob only).
 */
export function aWeaponReady(player: Player, psp: PspriteDef): void {
  if (!context) return;

  // Reset player mobj from attack animation frames.
  if (player.mo) {
    if (player.mo.state === STATES[StateNum.PLAY_ATK1] || player.mo.state === STATES[StateNum.PLAY_ATK2]) {
      setMobjState(player.mo, StateNum.PLAY, context.thinkerList);
    }
  }

  // Chainsaw idle sound.
  if (player.readyweapon === WeaponType.CHAINSAW && psp.state === STATES[StateNum.SAW]) {
    if (context.startSound && player.mo) {
      context.startSound(player.mo, SFX_SAWIDL);
    }
  }

  // Check for weapon change or player death.
  if (player.pendingweapon !== WP_NOCHANGE || !player.health) {
    const newstate = WEAPON_INFO[player.readyweapon]!.downstate;
    setPsprite(player, PsprNum.WEAPON, newstate);
    return;
  }

  // Check for fire button.
  if (player.cmd.buttons & BT_ATTACK) {
    if (!player.attackdown || (player.readyweapon !== WeaponType.MISSILE && player.readyweapon !== WeaponType.BFG)) {
      player.attackdown = true;
      fireWeapon(player);
      return;
    }
  } else {
    player.attackdown = false;
  }

  // Weapon bob.
  const angle = (128 * context.leveltime) & FINEMASK;
  psp.sx = (FRACUNIT + fixedMul(player.bob, finecosine[angle]!)) | 0;
  const halfAngle = angle & (FINEANGLES / 2 - 1);
  psp.sy = (WEAPONTOP + fixedMul(player.bob, finesine[halfAngle]!)) | 0;
}

/**
 * A_Lower: lower the weapon toward the bottom of the screen.
 *
 * Increments sy by LOWERSPEED each tic. When sy reaches WEAPONBOTTOM,
 * dead players stay at bottom, zero-health players get S_NULL,
 * otherwise switches to the pending weapon via P_BringUpWeapon.
 */
export function aLower(player: Player, psp: PspriteDef): void {
  psp.sy = (psp.sy + LOWERSPEED) | 0;

  if (psp.sy < WEAPONBOTTOM) return;

  if (player.playerstate === PlayerState.DEAD) {
    psp.sy = WEAPONBOTTOM;
    return;
  }

  if (!player.health) {
    setPsprite(player, PsprNum.WEAPON, StateNum.NULL);
    return;
  }

  player.readyweapon = player.pendingweapon;
  bringUpWeapon(player, context?.startSound ?? undefined);
}

/**
 * A_Raise: raise the weapon from the bottom toward ready position.
 *
 * Decrements sy by RAISESPEED each tic. When sy reaches WEAPONTOP,
 * clamps and transitions to the weapon's readystate.
 */
export function aRaise(player: Player, psp: PspriteDef): void {
  psp.sy = (psp.sy - RAISESPEED) | 0;

  if (psp.sy > WEAPONTOP) return;

  psp.sy = WEAPONTOP;

  const newstate = WEAPON_INFO[player.readyweapon]!.readystate;
  setPsprite(player, PsprNum.WEAPON, newstate);
}

/**
 * A_ReFire: check whether the player should continue firing.
 *
 * If the fire button is held, no weapon change is pending, and the
 * player is alive, increments refire counter and calls P_FireWeapon.
 * Otherwise resets refire to 0 and calls P_CheckAmmo to potentially
 * switch weapons.
 */
export function aReFire(player: Player, _psp: PspriteDef): void {
  if (!context) return;

  if (player.cmd.buttons & BT_ATTACK && player.pendingweapon === WP_NOCHANGE && player.health) {
    player.refire++;
    fireWeapon(player);
  } else {
    player.refire = 0;
    checkAmmo(player, context.gamemode);
  }
}

/**
 * A_CheckReload: verify the player has enough ammo to continue.
 *
 * Used by the super shotgun after the reload animation to trigger
 * a weapon switch if ammo ran out. Simply calls P_CheckAmmo.
 */
export function aCheckReload(player: Player, _psp: PspriteDef): void {
  if (!context) return;
  checkAmmo(player, context.gamemode);
}

/**
 * A_GunFlash: start the muzzle flash overlay and attack animation.
 *
 * Sets the player mobj to S_PLAY_ATK2 and transitions the flash
 * psprite layer to the weapon's flashstate.
 */
export function aGunFlash(player: Player, _psp: PspriteDef): void {
  if (!context) return;

  if (player.mo) {
    setMobjState(player.mo, StateNum.PLAY_ATK2, context.thinkerList);
  }

  setPsprite(player, PsprNum.FLASH, WEAPON_INFO[player.readyweapon]!.flashstate);
}

/**
 * A_Light0: reset extra light to 0 (muzzle flash ended).
 *
 * Wired to S_LIGHTDONE — the terminal flash state that all flash
 * chains eventually reach.
 */
export function aLight0(player: Player, _psp: PspriteDef): void {
  player.extralight = 0;
}

/**
 * A_Light1: set extra light to 1 (dim muzzle flash).
 */
export function aLight1(player: Player, _psp: PspriteDef): void {
  player.extralight = 1;
}

/**
 * A_Light2: set extra light to 2 (bright muzzle flash).
 */
export function aLight2(player: Player, _psp: PspriteDef): void {
  player.extralight = 2;
}

// ── State action wiring ──────────────────────────────────────────────

/**
 * Total number of weapon state actions wired by {@link wireWeaponStateActions}.
 *
 * This count covers A_WeaponReady, A_Lower, A_Raise, A_ReFire,
 * A_CheckReload, A_GunFlash, A_Light0, A_Light1, and A_Light2
 * across all 9 weapons plus S_LIGHTDONE.
 */
export const WEAPON_STATE_ACTION_COUNT = 55;

/**
 * Wire all weapon state machine actions into the psprite action table.
 *
 * Must be called once before the game loop starts. Attack-specific
 * actions (A_Punch, A_Saw, A_FirePistol, etc.) are NOT wired here;
 * they are deferred to steps 10-005 and 10-006.
 *
 * @example
 * ```ts
 * import { wireWeaponStateActions } from "../src/player/weaponStates.ts";
 * wireWeaponStateActions();
 * ```
 */
export function wireWeaponStateActions(): void {
  // S_LIGHTDONE — terminal flash state.
  pspriteActions[StateNum.LIGHTDONE] = aLight0;

  // Fist (wp_fist).
  pspriteActions[StateNum.PUNCH] = aWeaponReady;
  pspriteActions[StateNum.PUNCHDOWN] = aLower;
  pspriteActions[StateNum.PUNCHUP] = aRaise;
  pspriteActions[StateNum.PUNCH5] = aReFire;

  // Pistol (wp_pistol).
  pspriteActions[StateNum.PISTOL] = aWeaponReady;
  pspriteActions[StateNum.PISTOLDOWN] = aLower;
  pspriteActions[StateNum.PISTOLUP] = aRaise;
  pspriteActions[StateNum.PISTOL4] = aReFire;
  pspriteActions[StateNum.PISTOLFLASH] = aLight1;

  // Shotgun (wp_shotgun).
  pspriteActions[StateNum.SGUN] = aWeaponReady;
  pspriteActions[StateNum.SGUNDOWN] = aLower;
  pspriteActions[StateNum.SGUNUP] = aRaise;
  pspriteActions[StateNum.SGUN9] = aReFire;
  pspriteActions[StateNum.SGUNFLASH1] = aLight1;
  pspriteActions[StateNum.SGUNFLASH2] = aLight2;

  // Super Shotgun (wp_supershotgun).
  pspriteActions[StateNum.DSGUN] = aWeaponReady;
  pspriteActions[StateNum.DSGUNDOWN] = aLower;
  pspriteActions[StateNum.DSGUNUP] = aRaise;
  pspriteActions[StateNum.DSGUN6] = aCheckReload;
  pspriteActions[StateNum.DSNR2] = aReFire;
  pspriteActions[StateNum.DSGUNFLASH1] = aLight1;
  pspriteActions[StateNum.DSGUNFLASH2] = aLight2;

  // Chaingun (wp_chaingun).
  pspriteActions[StateNum.CHAIN] = aWeaponReady;
  pspriteActions[StateNum.CHAINDOWN] = aLower;
  pspriteActions[StateNum.CHAINUP] = aRaise;
  pspriteActions[StateNum.CHAIN3] = aReFire;
  pspriteActions[StateNum.CHAINFLASH1] = aLight1;
  pspriteActions[StateNum.CHAINFLASH2] = aLight2;

  // Rocket Launcher (wp_missile).
  pspriteActions[StateNum.MISSILE] = aWeaponReady;
  pspriteActions[StateNum.MISSILEDOWN] = aLower;
  pspriteActions[StateNum.MISSILEUP] = aRaise;
  pspriteActions[StateNum.MISSILE1] = aGunFlash;
  pspriteActions[StateNum.MISSILE3] = aReFire;
  pspriteActions[StateNum.MISSILEFLASH1] = aLight1;
  pspriteActions[StateNum.MISSILEFLASH3] = aLight2;
  pspriteActions[StateNum.MISSILEFLASH4] = aLight2;

  // Chainsaw (wp_chainsaw).
  pspriteActions[StateNum.SAW] = aWeaponReady;
  pspriteActions[StateNum.SAWB] = aWeaponReady;
  pspriteActions[StateNum.SAWDOWN] = aLower;
  pspriteActions[StateNum.SAWUP] = aRaise;
  pspriteActions[StateNum.SAW3] = aReFire;

  // Plasma Rifle (wp_plasma).
  pspriteActions[StateNum.PLASMA] = aWeaponReady;
  pspriteActions[StateNum.PLASMADOWN] = aLower;
  pspriteActions[StateNum.PLASMAUP] = aRaise;
  pspriteActions[StateNum.PLASMA2] = aReFire;
  pspriteActions[StateNum.PLASMAFLASH1] = aLight1;
  pspriteActions[StateNum.PLASMAFLASH2] = aLight1;

  // BFG 9000 (wp_bfg).
  pspriteActions[StateNum.BFG] = aWeaponReady;
  pspriteActions[StateNum.BFGDOWN] = aLower;
  pspriteActions[StateNum.BFGUP] = aRaise;
  pspriteActions[StateNum.BFG2] = aGunFlash;
  pspriteActions[StateNum.BFG4] = aReFire;
  pspriteActions[StateNum.BFGFLASH1] = aLight1;
  pspriteActions[StateNum.BFGFLASH2] = aLight2;
}
