/**
 * Item pickups (p_inter.c).
 *
 * Implements P_TouchSpecialThing and its four helpers — P_GiveBody,
 * P_GiveArmor, P_GiveCard, P_GivePower — reproducing the full pickup
 * dispatch from Chocolate Doom 2.2.1's p_inter.c.
 *
 * Ammo, weapon, and backpack pickups delegate to {@link giveAmmo},
 * {@link giveWeapon}, and {@link giveBackpack} from weapons.ts. The
 * sprite-to-pickup switch, delta-height clamp, dead-toucher guard,
 * and the shared bonuscount / itemcount / sound / removeMobj tail
 * all live here.
 *
 * All behavior matches Chocolate Doom 2.2.1 exactly.
 *
 * @example
 * ```ts
 * import { setPickupContext, touchSpecialThing } from "../src/player/pickups.ts";
 * setPickupContext({ gameMode, gameskill, netgame, deathmatch, isConsolePlayer, thinkerList, startSound });
 * touchSpecialThing(special, toucher);
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import type { GameMode } from '../bootstrap/gameMode.ts';
import type { Mobj } from '../world/mobj.ts';
import type { ThinkerList } from '../world/thinkers.ts';
import type { Player } from './playerSpawn.ts';

import { FRACUNIT } from '../core/fixed.ts';
import { MF_COUNTITEM, MF_DROPPED, MF_SHADOW, SpriteNum, removeMobj } from '../world/mobj.ts';
import { AmmoType, CardType, PowerType, WeaponType } from './playerSpawn.ts';
import { BONUSADD, giveAmmo, giveBackpack, giveWeapon } from './weapons.ts';

// ── Health constants ─────────────────────────────────────────────────

/** MAXHEALTH from p_local.h — cap for P_GiveBody (stimpack, medikit). */
export const MAXHEALTH = 100;

/** deh_max_health: cap for SPR_BON1 health bonus overfill. */
export const DEH_MAX_HEALTH = 200;

/** deh_max_armor: cap for SPR_BON2 armor bonus overfill. */
export const DEH_MAX_ARMOR = 200;

/** deh_max_soulsphere: cap for SPR_SOUL overfill. */
export const DEH_MAX_SOULSPHERE = 200;

/** deh_soulsphere_health: HP added by SPR_SOUL. */
export const DEH_SOULSPHERE_HEALTH = 100;

/** deh_megasphere_health: HP set by SPR_MEGA (commercial only). */
export const DEH_MEGASPHERE_HEALTH = 200;

/** deh_green_armor_class: SPR_ARM1 armor class. */
export const DEH_GREEN_ARMOR_CLASS = 1;

/** deh_blue_armor_class: SPR_ARM2 armor class. */
export const DEH_BLUE_ARMOR_CLASS = 2;

// ── Reach constants ──────────────────────────────────────────────────

/** P_TouchSpecialThing rejects pickups more than 8 units below the toucher. */
export const PICKUP_Z_FLOOR_MARGIN: Fixed = (8 * FRACUNIT) | 0;

// ── Power durations (doomdef.h) ──────────────────────────────────────

/** TICRATE: 35 tics per second. */
export const TICRATE = 35;

/** INVULNTICS: 30 * TICRATE = 1050. */
export const INVULNTICS = 30 * TICRATE;

/** INVISTICS: 60 * TICRATE = 2100. */
export const INVISTICS = 60 * TICRATE;

/** INFRATICS: 120 * TICRATE = 4200. */
export const INFRATICS = 120 * TICRATE;

/** IRONTICS: 60 * TICRATE = 2100. */
export const IRONTICS = 60 * TICRATE;

/** Health given by SPR_PSTR berserk pack (calls P_GiveBody(player, 100)). */
export const BERSERK_HEALTH = 100;

// ── Sound IDs (sounds.h) ─────────────────────────────────────────────

/** sfx_itemup — generic pickup sound. */
export const SFX_ITEMUP = 32;

/** sfx_wpnup — weapon pickup sound. */
export const SFX_WPNUP = 33;

/** sfx_getpow — power-up and soulsphere pickup sound. */
export const SFX_GETPOW = 93;

// ── Pickup message IDs ───────────────────────────────────────────────

/**
 * Opaque message identifiers set on player.message by P_TouchSpecialThing.
 *
 * Each enum value is the canonical Chocolate Doom `GOT*` DEH string ID
 * reproduced here for parity testing; the runtime string table is layered
 * on top by the UI (d_englsh.h / dehacked). Using numeric IDs keeps this
 * module decoupled from the text layer while preserving the distinct
 * message branches in the vanilla dispatch.
 */
export const enum PickupMessage {
  NONE = 0,
  GOTARMOR,
  GOTMEGA,
  GOTHTHBONUS,
  GOTARMBONUS,
  GOTSUPER,
  GOTMSPHERE,
  GOTBLUECARD,
  GOTYELWCARD,
  GOTREDCARD,
  GOTBLUESKUL,
  GOTYELWSKUL,
  GOTREDSKULL,
  GOTSTIM,
  GOTMEDINEED,
  GOTMEDIKIT,
  GOTINVUL,
  GOTBERSERK,
  GOTINVIS,
  GOTSUIT,
  GOTMAP,
  GOTVISOR,
  GOTCLIP,
  GOTCLIPBOX,
  GOTROCKET,
  GOTROCKBOX,
  GOTCELL,
  GOTCELLBOX,
  GOTSHELLS,
  GOTSHELLBOX,
  GOTBACKPACK,
  GOTBFG9000,
  GOTCHAINGUN,
  GOTCHAINSAW,
  GOTLAUNCHER,
  GOTPLASMA,
  GOTSHOTGUN,
  GOTSHOTGUN2,
}

// ── Callback types ───────────────────────────────────────────────────

/** Callback matching S_StartSound(origin, sfxId). */
export type StartSoundFunction = (origin: Mobj | null, sfxId: number) => void;

// ── Pickup context ───────────────────────────────────────────────────

/**
 * Shared dependencies required by P_TouchSpecialThing.
 *
 * Mirrors the C globals `gamemode`, `gameskill`, `netgame`, `deathmatch`,
 * and `consoleplayer` plus the `S_StartSound` and `P_RemoveMobj` calls
 * made at the tail of the dispatch.
 */
export interface PickupContext {
  gameMode: GameMode;
  gameskill: number;
  netgame: boolean;
  deathmatch: number;
  isConsolePlayer: boolean;
  thinkerList: ThinkerList;
  startSound: StartSoundFunction | null;
}

let context: PickupContext | null = null;

/** Install the shared context used by P_TouchSpecialThing. */
export function setPickupContext(ctx: PickupContext): void {
  context = ctx;
}

/** Retrieve the current context (for testing inspection). */
export function getPickupContext(): PickupContext | null {
  return context;
}

/** Clear the shared context. Test-only helper. */
export function clearPickupContext(): void {
  context = null;
}

// ── P_GiveBody ───────────────────────────────────────────────────────

/**
 * P_GiveBody: heal the player up to MAXHEALTH (100).
 *
 * Returns false when the player is already at or above MAXHEALTH.
 *
 * Parity-critical: mirrors `player->mo->health = player->health`
 * after clamping so the mobj health stays in sync.
 *
 * @param player - Player receiving the heal.
 * @param num - Health amount to add.
 * @returns Whether the pickup should be consumed.
 */
export function giveBody(player: Player, num: number): boolean {
  if (player.health >= MAXHEALTH) return false;

  player.health = (player.health + num) | 0;
  if (player.health > MAXHEALTH) player.health = MAXHEALTH;

  if (player.mo) player.mo.health = player.health;

  return true;
}

// ── P_GiveArmor ──────────────────────────────────────────────────────

/**
 * P_GiveArmor: grant an armor class if the player's current armor
 * is strictly less than `armortype * 100`.
 *
 * @param player - Player receiving the armor.
 * @param armortype - Armor class (1 = green, 2 = blue/mega).
 * @returns Whether the pickup should be consumed.
 */
export function giveArmor(player: Player, armortype: number): boolean {
  const hits = (armortype * 100) | 0;
  if (player.armorpoints >= hits) return false;

  player.armortype = armortype;
  player.armorpoints = hits;

  return true;
}

// ── P_GiveCard ───────────────────────────────────────────────────────

/**
 * P_GiveCard: add a keycard or skull key to the player's inventory.
 *
 * Parity-critical: vanilla sets `player->bonuscount = BONUSADD` (raw
 * assignment), not `+=`. The generic tail of P_TouchSpecialThing then
 * adds another BONUSADD for a total of 2 * BONUSADD = 12 on card pickup.
 *
 * @param player - Player receiving the card.
 * @param card - Card type (0–5).
 */
export function giveCard(player: Player, card: CardType): void {
  if (player.cards[card]) return;
  player.bonuscount = BONUSADD;
  player.cards[card] = true;
}

// ── P_GivePower ──────────────────────────────────────────────────────

/**
 * P_GivePower: grant a timed power-up.
 *
 * - INVULNERABILITY: sets INVULNTICS (30 s).
 * - INVISIBILITY: sets INVISTICS (60 s) and ORs MF_SHADOW onto the mobj.
 * - INFRARED: sets INFRATICS (120 s).
 * - IRONFEET: sets IRONTICS (60 s).
 * - STRENGTH (berserk): calls giveBody(100) and sets powers[STRENGTH]=1.
 *   Always returns true even if already held (vanilla behavior — the
 *   berserk heal always fires).
 * - Anything else: set to 1 if not already held, else return false.
 *
 * @param player - Player receiving the power-up.
 * @param power - PowerType index.
 * @returns Whether the pickup should be consumed.
 */
export function givePower(player: Player, power: number): boolean {
  if (power === PowerType.INVULNERABILITY) {
    player.powers[power] = INVULNTICS;
    return true;
  }

  if (power === PowerType.INVISIBILITY) {
    player.powers[power] = INVISTICS;
    if (player.mo) player.mo.flags = player.mo.flags | MF_SHADOW | 0;
    return true;
  }

  if (power === PowerType.INFRARED) {
    player.powers[power] = INFRATICS;
    return true;
  }

  if (power === PowerType.IRONFEET) {
    player.powers[power] = IRONTICS;
    return true;
  }

  if (power === PowerType.STRENGTH) {
    giveBody(player, BERSERK_HEALTH);
    player.powers[power] = 1;
    return true;
  }

  if (player.powers[power]) return false;

  player.powers[power] = 1;
  return true;
}

// ── P_TouchSpecialThing ──────────────────────────────────────────────

/**
 * Outcome reported by {@link touchSpecialThing} for test inspection.
 *
 * `consumed` = whether the special was removed from the map.
 * `message` = which PickupMessage (if any) was written onto player.message.
 * `sound` = the SFX id that was passed to the startSound callback (0 if silent).
 */
export interface TouchSpecialResult {
  consumed: boolean;
  message: PickupMessage;
  sound: number;
}

/**
 * P_TouchSpecialThing: resolve a pickup collision.
 *
 * Reproduces p_inter.c exactly:
 * 1. Reject if the vertical delta is > toucher.height or < -8*FRACUNIT.
 * 2. Reject if the toucher is dead (health <= 0 — sliding corpse).
 * 3. Dispatch on special.sprite into ~40 cases, each calling the
 *    appropriate give helper and setting player.message / sound.
 * 4. On success: optionally increment itemcount, remove the special,
 *    add BONUSADD to bonuscount, and play the selected sound.
 *
 * Key parity quirks preserved:
 * - Default branch in vanilla calls I_Error; this implementation returns
 *   early without consuming the pickup (tests cover this explicitly).
 * - Card pickups in netgame return BEFORE the generic tail so the card
 *   persists for other players (no removeMobj, no bonuscount add).
 * - SPR_MEGA is silently rejected (return without consume) outside
 *   commercial, matching the vanilla `if (gamemode != commercial) return`.
 * - Megasphere always gives armor class 2 regardless of deh_blue_armor_class.
 * - Berserk switches to fist if currently holding a different weapon.
 * - Dropped CLIP gives num=0 (half-clip); placed CLIP gives num=1.
 * - Dropped weapons pass through MF_DROPPED to giveWeapon (half-ammo).
 * - The ammo/armor-bonus overfill path writes to mo.health/armorpoints
 *   and can exceed 100 up to the deh caps.
 *
 * @param special - The pickup mobj (must have MF_SPECIAL).
 * @param toucher - The player mobj colliding with it.
 * @returns Pickup outcome (for tests; the caller does not need to inspect).
 */
export function touchSpecialThing(special: Mobj, toucher: Mobj): TouchSpecialResult {
  const noop: TouchSpecialResult = {
    consumed: false,
    message: PickupMessage.NONE,
    sound: 0,
  };

  const delta = (special.z - toucher.z) | 0;
  if (delta > toucher.height || delta < -PICKUP_Z_FLOOR_MARGIN) {
    return noop;
  }

  if (toucher.health <= 0) return noop;

  if (!context) return noop;

  if (!isPlayer(toucher.player)) return noop;
  const player = toucher.player;

  let sound = SFX_ITEMUP;
  let message: PickupMessage = PickupMessage.NONE;

  switch (special.sprite) {
    // ── Armor ──
    case SpriteNum.ARM1:
      if (!giveArmor(player, DEH_GREEN_ARMOR_CLASS)) return noop;
      message = PickupMessage.GOTARMOR;
      break;

    case SpriteNum.ARM2:
      if (!giveArmor(player, DEH_BLUE_ARMOR_CLASS)) return noop;
      message = PickupMessage.GOTMEGA;
      break;

    // ── Bonus items ──
    case SpriteNum.BON1:
      player.health = (player.health + 1) | 0;
      if (player.health > DEH_MAX_HEALTH) player.health = DEH_MAX_HEALTH;
      if (player.mo) player.mo.health = player.health;
      message = PickupMessage.GOTHTHBONUS;
      break;

    case SpriteNum.BON2:
      player.armorpoints = (player.armorpoints + 1) | 0;
      if (player.armorpoints > DEH_MAX_ARMOR) player.armorpoints = DEH_MAX_ARMOR;
      if (!player.armortype) player.armortype = 1;
      message = PickupMessage.GOTARMBONUS;
      break;

    case SpriteNum.SOUL:
      player.health = (player.health + DEH_SOULSPHERE_HEALTH) | 0;
      if (player.health > DEH_MAX_SOULSPHERE) player.health = DEH_MAX_SOULSPHERE;
      if (player.mo) player.mo.health = player.health;
      message = PickupMessage.GOTSUPER;
      sound = SFX_GETPOW;
      break;

    case SpriteNum.MEGA:
      if (context.gameMode !== 'commercial') return noop;
      player.health = DEH_MEGASPHERE_HEALTH;
      if (player.mo) player.mo.health = player.health;
      giveArmor(player, 2);
      message = PickupMessage.GOTMSPHERE;
      sound = SFX_GETPOW;
      break;

    // ── Cards (netgame: never consume) ──
    case SpriteNum.BKEY:
      if (!player.cards[CardType.BLUECARD]) message = PickupMessage.GOTBLUECARD;
      giveCard(player, CardType.BLUECARD);
      if (context.netgame) return { consumed: false, message, sound };
      break;

    case SpriteNum.YKEY:
      if (!player.cards[CardType.YELLOWCARD]) message = PickupMessage.GOTYELWCARD;
      giveCard(player, CardType.YELLOWCARD);
      if (context.netgame) return { consumed: false, message, sound };
      break;

    case SpriteNum.RKEY:
      if (!player.cards[CardType.REDCARD]) message = PickupMessage.GOTREDCARD;
      giveCard(player, CardType.REDCARD);
      if (context.netgame) return { consumed: false, message, sound };
      break;

    case SpriteNum.BSKU:
      if (!player.cards[CardType.BLUESKULL]) message = PickupMessage.GOTBLUESKUL;
      giveCard(player, CardType.BLUESKULL);
      if (context.netgame) return { consumed: false, message, sound };
      break;

    case SpriteNum.YSKU:
      if (!player.cards[CardType.YELLOWSKULL]) message = PickupMessage.GOTYELWSKUL;
      giveCard(player, CardType.YELLOWSKULL);
      if (context.netgame) return { consumed: false, message, sound };
      break;

    case SpriteNum.RSKU:
      if (!player.cards[CardType.REDSKULL]) message = PickupMessage.GOTREDSKULL;
      giveCard(player, CardType.REDSKULL);
      if (context.netgame) return { consumed: false, message, sound };
      break;

    // ── Medikits ──
    case SpriteNum.STIM:
      if (!giveBody(player, 10)) return noop;
      message = PickupMessage.GOTSTIM;
      break;

    case SpriteNum.MEDI: {
      const neededMedikit = player.health < 25;
      if (!giveBody(player, 25)) return noop;
      message = neededMedikit ? PickupMessage.GOTMEDINEED : PickupMessage.GOTMEDIKIT;
      break;
    }

    // ── Power-ups ──
    case SpriteNum.PINV:
      if (!givePower(player, PowerType.INVULNERABILITY)) return noop;
      message = PickupMessage.GOTINVUL;
      sound = SFX_GETPOW;
      break;

    case SpriteNum.PSTR:
      if (!givePower(player, PowerType.STRENGTH)) return noop;
      message = PickupMessage.GOTBERSERK;
      if (player.readyweapon !== WeaponType.FIST) {
        player.pendingweapon = WeaponType.FIST;
      }
      sound = SFX_GETPOW;
      break;

    case SpriteNum.PINS:
      if (!givePower(player, PowerType.INVISIBILITY)) return noop;
      message = PickupMessage.GOTINVIS;
      sound = SFX_GETPOW;
      break;

    case SpriteNum.SUIT:
      if (!givePower(player, PowerType.IRONFEET)) return noop;
      message = PickupMessage.GOTSUIT;
      sound = SFX_GETPOW;
      break;

    case SpriteNum.PMAP:
      if (!givePower(player, PowerType.ALLMAP)) return noop;
      message = PickupMessage.GOTMAP;
      sound = SFX_GETPOW;
      break;

    case SpriteNum.PVIS:
      if (!givePower(player, PowerType.INFRARED)) return noop;
      message = PickupMessage.GOTVISOR;
      sound = SFX_GETPOW;
      break;

    // ── Ammo ──
    case SpriteNum.CLIP: {
      const clipAmount = (special.flags & MF_DROPPED) !== 0 ? 0 : 1;
      if (!giveAmmo(player, AmmoType.CLIP, clipAmount, context.gameskill)) return noop;
      message = PickupMessage.GOTCLIP;
      break;
    }

    case SpriteNum.AMMO:
      if (!giveAmmo(player, AmmoType.CLIP, 5, context.gameskill)) return noop;
      message = PickupMessage.GOTCLIPBOX;
      break;

    case SpriteNum.ROCK:
      if (!giveAmmo(player, AmmoType.MISL, 1, context.gameskill)) return noop;
      message = PickupMessage.GOTROCKET;
      break;

    case SpriteNum.BROK:
      if (!giveAmmo(player, AmmoType.MISL, 5, context.gameskill)) return noop;
      message = PickupMessage.GOTROCKBOX;
      break;

    case SpriteNum.CELL:
      if (!giveAmmo(player, AmmoType.CELL, 1, context.gameskill)) return noop;
      message = PickupMessage.GOTCELL;
      break;

    case SpriteNum.CELP:
      if (!giveAmmo(player, AmmoType.CELL, 5, context.gameskill)) return noop;
      message = PickupMessage.GOTCELLBOX;
      break;

    case SpriteNum.SHEL:
      if (!giveAmmo(player, AmmoType.SHELL, 1, context.gameskill)) return noop;
      message = PickupMessage.GOTSHELLS;
      break;

    case SpriteNum.SBOX:
      if (!giveAmmo(player, AmmoType.SHELL, 5, context.gameskill)) return noop;
      message = PickupMessage.GOTSHELLBOX;
      break;

    case SpriteNum.BPAK:
      giveBackpack(player, context.gameskill);
      message = PickupMessage.GOTBACKPACK;
      break;

    // ── Weapons ──
    case SpriteNum.BFUG:
      if (!giveWeaponPickup(player, WeaponType.BFG, false)) return noop;
      message = PickupMessage.GOTBFG9000;
      sound = SFX_WPNUP;
      break;

    case SpriteNum.MGUN:
      if (!giveWeaponPickup(player, WeaponType.CHAINGUN, (special.flags & MF_DROPPED) !== 0)) return noop;
      message = PickupMessage.GOTCHAINGUN;
      sound = SFX_WPNUP;
      break;

    case SpriteNum.CSAW:
      if (!giveWeaponPickup(player, WeaponType.CHAINSAW, false)) return noop;
      message = PickupMessage.GOTCHAINSAW;
      sound = SFX_WPNUP;
      break;

    case SpriteNum.LAUN:
      if (!giveWeaponPickup(player, WeaponType.MISSILE, false)) return noop;
      message = PickupMessage.GOTLAUNCHER;
      sound = SFX_WPNUP;
      break;

    case SpriteNum.PLAS:
      if (!giveWeaponPickup(player, WeaponType.PLASMA, false)) return noop;
      message = PickupMessage.GOTPLASMA;
      sound = SFX_WPNUP;
      break;

    case SpriteNum.SHOT:
      if (!giveWeaponPickup(player, WeaponType.SHOTGUN, (special.flags & MF_DROPPED) !== 0)) return noop;
      message = PickupMessage.GOTSHOTGUN;
      sound = SFX_WPNUP;
      break;

    case SpriteNum.SGN2:
      if (!giveWeaponPickup(player, WeaponType.SUPERSHOTGUN, (special.flags & MF_DROPPED) !== 0)) return noop;
      message = PickupMessage.GOTSHOTGUN2;
      sound = SFX_WPNUP;
      break;

    default:
      return noop;
  }

  if ((special.flags & MF_COUNTITEM) !== 0) {
    player.itemcount = (player.itemcount + 1) | 0;
  }

  removeMobj(special, context.thinkerList);
  player.bonuscount = (player.bonuscount + BONUSADD) | 0;

  if (context.isConsolePlayer && context.startSound) {
    context.startSound(null, sound);
  }

  return { consumed: true, message, sound };
}

/**
 * Wrap giveWeapon with the pickup context's netgame/deathmatch/skill
 * values and a sfx_wpnup callback for the console player.
 *
 * Kept internal: every weapon branch of P_TouchSpecialThing uses the
 * same parameters, so this centralizes the context plumbing.
 */
function giveWeaponPickup(player: Player, weapon: WeaponType, dropped: boolean): boolean {
  const ctx = context!;
  return giveWeapon(player, weapon, dropped, ctx.netgame, ctx.deathmatch, ctx.isConsolePlayer, ctx.gameskill, ctx.startSound ? () => ctx.startSound!(null, SFX_WPNUP) : undefined);
}

/**
 * Type predicate narrowing from {@link Mobj.player} (declared `unknown` to
 * avoid a circular type reference) to the structural {@link Player} shape.
 *
 * A value that is a non-null object carrying a `psprites` field is treated
 * as a Player; the generic unknown is then narrowed for the dispatch body.
 */
function isPlayer(value: unknown): value is Player {
  return value !== null && typeof value === 'object' && 'psprites' in value;
}
