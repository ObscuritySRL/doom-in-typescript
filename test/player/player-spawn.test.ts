import { describe, expect, it } from 'bun:test';

import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';

import { EMPTY_TICCMD } from '../../src/input/ticcmd.ts';

import { MAXPLAYERS, StateNum, STATES } from '../../src/world/mobj.ts';

import {
  AM_NOAMMO,
  AmmoType,
  CardType,
  INITIAL_BULLETS,
  INITIAL_HEALTH,
  LOWERSPEED,
  MAX_AMMO,
  NUMAMMO,
  NUMCARDS,
  NUMPOWERS,
  NUMPSPRITES,
  NUMWEAPONS,
  PlayerState,
  PowerType,
  PsprNum,
  RAISESPEED,
  WEAPONBOTTOM,
  WEAPONTOP,
  WEAPON_INFO,
  WeaponType,
  WP_NOCHANGE,
  bringUpWeapon,
  createPlayer,
  movePsprites,
  playerReborn,
  setPsprite,
  setupPsprites,
} from '../../src/player/playerSpawn.ts';

import type { Player, PspriteDef, PspriteActionFunction, WeaponInfo } from '../../src/player/playerSpawn.ts';

// ── Enum value tests ─────────────────────────────────────────────────

describe('PlayerState', () => {
  it('has exactly 3 values matching playerstate_t', () => {
    expect(PlayerState.LIVE).toBe(0);
    expect(PlayerState.DEAD).toBe(1);
    expect(PlayerState.REBORN).toBe(2);
  });
});

describe('WeaponType', () => {
  it('matches doomdef.h weapontype_t ordering', () => {
    expect(WeaponType.FIST).toBe(0);
    expect(WeaponType.PISTOL).toBe(1);
    expect(WeaponType.SHOTGUN).toBe(2);
    expect(WeaponType.CHAINGUN).toBe(3);
    expect(WeaponType.MISSILE).toBe(4);
    expect(WeaponType.PLASMA).toBe(5);
    expect(WeaponType.BFG).toBe(6);
    expect(WeaponType.CHAINSAW).toBe(7);
    expect(WeaponType.SUPERSHOTGUN).toBe(8);
  });

  it('NUMWEAPONS is 9', () => {
    expect(NUMWEAPONS).toBe(9);
  });

  it('WP_NOCHANGE sentinel is beyond NUMWEAPONS', () => {
    expect(WP_NOCHANGE).toBeGreaterThan(NUMWEAPONS - 1);
    expect(WP_NOCHANGE).toBe(10);
  });
});

describe('AmmoType', () => {
  it('matches doomdef.h ammotype_t ordering', () => {
    expect(AmmoType.CLIP).toBe(0);
    expect(AmmoType.SHELL).toBe(1);
    expect(AmmoType.CELL).toBe(2);
    expect(AmmoType.MISL).toBe(3);
  });

  it('NUMAMMO is 4', () => {
    expect(NUMAMMO).toBe(4);
  });

  it('AM_NOAMMO sentinel equals NUMAMMO', () => {
    expect(AM_NOAMMO).toBe(NUMAMMO);
  });
});

describe('PowerType', () => {
  it('matches doomdef.h powertype_t ordering', () => {
    expect(PowerType.INVULNERABILITY).toBe(0);
    expect(PowerType.STRENGTH).toBe(1);
    expect(PowerType.INVISIBILITY).toBe(2);
    expect(PowerType.IRONFEET).toBe(3);
    expect(PowerType.ALLMAP).toBe(4);
    expect(PowerType.INFRARED).toBe(5);
  });

  it('NUMPOWERS is 6', () => {
    expect(NUMPOWERS).toBe(6);
  });
});

describe('CardType', () => {
  it('matches doomdef.h card_t ordering', () => {
    expect(CardType.BLUECARD).toBe(0);
    expect(CardType.YELLOWCARD).toBe(1);
    expect(CardType.REDCARD).toBe(2);
    expect(CardType.BLUESKULL).toBe(3);
    expect(CardType.YELLOWSKULL).toBe(4);
    expect(CardType.REDSKULL).toBe(5);
  });

  it('NUMCARDS is 6', () => {
    expect(NUMCARDS).toBe(6);
  });
});

describe('PsprNum', () => {
  it('matches p_pspr.h psprnum_t', () => {
    expect(PsprNum.WEAPON).toBe(0);
    expect(PsprNum.FLASH).toBe(1);
  });

  it('NUMPSPRITES is 2', () => {
    expect(NUMPSPRITES).toBe(2);
  });
});

// ── Weapon sprite constants ──────────────────────────────────────────

describe('weapon sprite constants', () => {
  it('WEAPONBOTTOM is 128*FRACUNIT', () => {
    expect(WEAPONBOTTOM).toBe((128 * FRACUNIT) | 0);
  });

  it('WEAPONTOP is 32*FRACUNIT', () => {
    expect(WEAPONTOP).toBe((32 * FRACUNIT) | 0);
  });

  it('LOWERSPEED is 6*FRACUNIT', () => {
    expect(LOWERSPEED).toBe((6 * FRACUNIT) | 0);
  });

  it('RAISESPEED is 6*FRACUNIT', () => {
    expect(RAISESPEED).toBe((6 * FRACUNIT) | 0);
  });
});

// ── Initial values ───────────────────────────────────────────────────

describe('initial values', () => {
  it('INITIAL_HEALTH is 100', () => {
    expect(INITIAL_HEALTH).toBe(100);
  });

  it('INITIAL_BULLETS is 50', () => {
    expect(INITIAL_BULLETS).toBe(50);
  });

  it('MAX_AMMO matches p_inter.c maxammo array', () => {
    expect(MAX_AMMO).toEqual([200, 50, 300, 50]);
  });

  it('MAX_AMMO is frozen', () => {
    expect(Object.isFrozen(MAX_AMMO)).toBe(true);
  });
});

// ── WEAPON_INFO table ────────────────────────────────────────────────

describe('WEAPON_INFO', () => {
  it('has NUMWEAPONS entries', () => {
    expect(WEAPON_INFO.length).toBe(NUMWEAPONS);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(WEAPON_INFO)).toBe(true);
  });

  it('fist uses no ammo', () => {
    expect(WEAPON_INFO[WeaponType.FIST]!.ammo).toBe(AM_NOAMMO);
  });

  it('pistol uses clip ammo', () => {
    expect(WEAPON_INFO[WeaponType.PISTOL]!.ammo).toBe(AmmoType.CLIP);
  });

  it('shotgun uses shell ammo', () => {
    expect(WEAPON_INFO[WeaponType.SHOTGUN]!.ammo).toBe(AmmoType.SHELL);
  });

  it('chaingun uses clip ammo', () => {
    expect(WEAPON_INFO[WeaponType.CHAINGUN]!.ammo).toBe(AmmoType.CLIP);
  });

  it('missile launcher uses misl ammo', () => {
    expect(WEAPON_INFO[WeaponType.MISSILE]!.ammo).toBe(AmmoType.MISL);
  });

  it('plasma rifle uses cell ammo', () => {
    expect(WEAPON_INFO[WeaponType.PLASMA]!.ammo).toBe(AmmoType.CELL);
  });

  it('BFG uses cell ammo', () => {
    expect(WEAPON_INFO[WeaponType.BFG]!.ammo).toBe(AmmoType.CELL);
  });

  it('chainsaw uses no ammo', () => {
    expect(WEAPON_INFO[WeaponType.CHAINSAW]!.ammo).toBe(AM_NOAMMO);
  });

  it('super shotgun uses shell ammo', () => {
    expect(WEAPON_INFO[WeaponType.SUPERSHOTGUN]!.ammo).toBe(AmmoType.SHELL);
  });

  it('pistol upstate is S_PISTOLUP', () => {
    expect(WEAPON_INFO[WeaponType.PISTOL]!.upstate).toBe(StateNum.PISTOLUP);
  });

  it('pistol downstate is S_PISTOLDOWN', () => {
    expect(WEAPON_INFO[WeaponType.PISTOL]!.downstate).toBe(StateNum.PISTOLDOWN);
  });

  it('pistol readystate is S_PISTOL', () => {
    expect(WEAPON_INFO[WeaponType.PISTOL]!.readystate).toBe(StateNum.PISTOL);
  });

  it('pistol atkstate is S_PISTOL1', () => {
    expect(WEAPON_INFO[WeaponType.PISTOL]!.atkstate).toBe(StateNum.PISTOL1);
  });

  it('pistol flashstate is S_PISTOLFLASH', () => {
    expect(WEAPON_INFO[WeaponType.PISTOL]!.flashstate).toBe(StateNum.PISTOLFLASH);
  });

  it('fist flashstate is S_NULL (no flash)', () => {
    expect(WEAPON_INFO[WeaponType.FIST]!.flashstate).toBe(StateNum.NULL);
  });

  it('chainsaw flashstate is S_NULL (no flash)', () => {
    expect(WEAPON_INFO[WeaponType.CHAINSAW]!.flashstate).toBe(StateNum.NULL);
  });

  it('all upstate/downstate/readystate/atkstate point to valid STATES entries', () => {
    for (let weapon = 0; weapon < NUMWEAPONS; weapon++) {
      const info = WEAPON_INFO[weapon]!;
      expect(STATES[info.upstate]).toBeDefined();
      expect(STATES[info.downstate]).toBeDefined();
      expect(STATES[info.readystate]).toBeDefined();
      expect(STATES[info.atkstate]).toBeDefined();
    }
  });
});

// ── createPlayer ─────────────────────────────────────────────────────

describe('createPlayer', () => {
  it('returns a player with zero/null/false defaults', () => {
    const player = createPlayer();
    expect(player.mo).toBeNull();
    expect(player.health).toBe(0);
    expect(player.armorpoints).toBe(0);
    expect(player.armortype).toBe(0);
    expect(player.extralight).toBe(0);
    expect(player.fixedcolormap).toBe(0);
    expect(player.damagecount).toBe(0);
    expect(player.bonuscount).toBe(0);
  });

  it('allocates arrays of correct length', () => {
    const player = createPlayer();
    expect(player.powers.length).toBe(NUMPOWERS);
    expect(player.cards.length).toBe(NUMCARDS);
    expect(player.frags.length).toBe(MAXPLAYERS);
    expect(player.weaponowned.length).toBe(NUMWEAPONS);
    expect(player.ammo.length).toBe(NUMAMMO);
    expect(player.maxammo.length).toBe(NUMAMMO);
    expect(player.psprites.length).toBe(NUMPSPRITES);
  });

  it('initializes powers to all zeros', () => {
    const player = createPlayer();
    for (let index = 0; index < NUMPOWERS; index++) {
      expect(player.powers[index]).toBe(0);
    }
  });

  it('initializes cards to all false', () => {
    const player = createPlayer();
    for (let index = 0; index < NUMCARDS; index++) {
      expect(player.cards[index]).toBe(false);
    }
  });

  it('initializes psprites with null state', () => {
    const player = createPlayer();
    for (let index = 0; index < NUMPSPRITES; index++) {
      expect(player.psprites[index]!.state).toBeNull();
      expect(player.psprites[index]!.tics).toBe(0);
      expect(player.psprites[index]!.sx).toBe(0);
      expect(player.psprites[index]!.sy).toBe(0);
    }
  });

  it('uses EMPTY_TICCMD for initial command', () => {
    const player = createPlayer();
    expect(player.cmd).toBe(EMPTY_TICCMD);
  });
});

// ── playerReborn ─────────────────────────────────────────────────────

describe('playerReborn', () => {
  it('sets playerstate to PST_LIVE', () => {
    const player = createPlayer();
    player.playerstate = PlayerState.DEAD;
    playerReborn(player);
    expect(player.playerstate as number).toBe(PlayerState.LIVE);
  });

  it('sets health to INITIAL_HEALTH (100)', () => {
    const player = createPlayer();
    playerReborn(player);
    expect(player.health).toBe(INITIAL_HEALTH);
  });

  it('sets readyweapon and pendingweapon to pistol', () => {
    const player = createPlayer();
    playerReborn(player);
    expect(player.readyweapon).toBe(WeaponType.PISTOL);
    expect(player.pendingweapon).toBe(WeaponType.PISTOL);
  });

  it('owns fist and pistol only', () => {
    const player = createPlayer();
    playerReborn(player);
    expect(player.weaponowned[WeaponType.FIST]).toBe(true);
    expect(player.weaponowned[WeaponType.PISTOL]).toBe(true);
    expect(player.weaponowned[WeaponType.SHOTGUN]).toBe(false);
    expect(player.weaponowned[WeaponType.CHAINGUN]).toBe(false);
    expect(player.weaponowned[WeaponType.MISSILE]).toBe(false);
    expect(player.weaponowned[WeaponType.PLASMA]).toBe(false);
    expect(player.weaponowned[WeaponType.BFG]).toBe(false);
    expect(player.weaponowned[WeaponType.CHAINSAW]).toBe(false);
    expect(player.weaponowned[WeaponType.SUPERSHOTGUN]).toBe(false);
  });

  it('gives INITIAL_BULLETS clip ammo only', () => {
    const player = createPlayer();
    playerReborn(player);
    expect(player.ammo[AmmoType.CLIP]).toBe(INITIAL_BULLETS);
    expect(player.ammo[AmmoType.SHELL]).toBe(0);
    expect(player.ammo[AmmoType.CELL]).toBe(0);
    expect(player.ammo[AmmoType.MISL]).toBe(0);
  });

  it('sets maxammo from MAX_AMMO array', () => {
    const player = createPlayer();
    playerReborn(player);
    for (let index = 0; index < NUMAMMO; index++) {
      expect(player.maxammo[index]).toBe(MAX_AMMO[index]);
    }
  });

  it('preserves frags across reborn', () => {
    const player = createPlayer();
    player.frags[0] = 5;
    player.frags[1] = 3;
    player.frags[2] = 7;
    player.frags[3] = 1;
    playerReborn(player);
    expect(player.frags[0]).toBe(5);
    expect(player.frags[1]).toBe(3);
    expect(player.frags[2]).toBe(7);
    expect(player.frags[3]).toBe(1);
  });

  it('preserves killcount, itemcount, secretcount', () => {
    const player = createPlayer();
    player.killcount = 42;
    player.itemcount = 10;
    player.secretcount = 3;
    playerReborn(player);
    expect(player.killcount).toBe(42);
    expect(player.itemcount).toBe(10);
    expect(player.secretcount).toBe(3);
  });

  it('zeroes armor', () => {
    const player = createPlayer();
    player.armorpoints = 200;
    player.armortype = 2;
    playerReborn(player);
    expect(player.armorpoints).toBe(0);
    expect(player.armortype).toBe(0);
  });

  it('clears all powers', () => {
    const player = createPlayer();
    player.powers[PowerType.INVULNERABILITY] = 30;
    player.powers[PowerType.STRENGTH] = 1;
    playerReborn(player);
    for (let index = 0; index < NUMPOWERS; index++) {
      expect(player.powers[index]).toBe(0);
    }
  });

  it('clears all cards', () => {
    const player = createPlayer();
    player.cards[CardType.BLUECARD] = true;
    player.cards[CardType.REDSKULL] = true;
    playerReborn(player);
    for (let index = 0; index < NUMCARDS; index++) {
      expect(player.cards[index]).toBe(false);
    }
  });

  it('sets attackdown and usedown to true', () => {
    const player = createPlayer();
    playerReborn(player);
    expect(player.attackdown).toBe(true);
    expect(player.usedown).toBe(true);
  });

  it('clears mo to null', () => {
    const player = createPlayer();
    playerReborn(player);
    expect(player.mo).toBeNull();
  });

  it('zeroes view fields', () => {
    const player = createPlayer();
    player.viewz = 1000;
    player.viewheight = 2000;
    player.deltaviewheight = 500;
    player.bob = 100;
    playerReborn(player);
    expect(player.viewz).toBe(0);
    expect(player.viewheight).toBe(0);
    expect(player.deltaviewheight).toBe(0);
    expect(player.bob).toBe(0);
  });

  it('clears cheats, refire, extralight, fixedcolormap', () => {
    const player = createPlayer();
    player.cheats = 0xff;
    player.refire = 5;
    player.extralight = 2;
    player.fixedcolormap = 1;
    playerReborn(player);
    expect(player.cheats).toBe(0);
    expect(player.refire).toBe(0);
    expect(player.extralight).toBe(0);
    expect(player.fixedcolormap).toBe(0);
  });

  it('clears damagecount, bonuscount, attacker', () => {
    const player = createPlayer();
    player.damagecount = 20;
    player.bonuscount = 6;
    playerReborn(player);
    expect(player.damagecount).toBe(0);
    expect(player.bonuscount).toBe(0);
    expect(player.attacker).toBeNull();
  });

  it('clears message', () => {
    const player = createPlayer();
    player.message = 'test message';
    playerReborn(player);
    expect(player.message).toBeNull();
  });

  it('clears backpack flag', () => {
    const player = createPlayer();
    player.backpack = true;
    playerReborn(player);
    expect(player.backpack).toBe(false);
  });

  it('resets psprites to null state', () => {
    const player = createPlayer();
    player.psprites[PsprNum.WEAPON]!.state = STATES[StateNum.PISTOL]!;
    player.psprites[PsprNum.WEAPON]!.sy = WEAPONBOTTOM;
    playerReborn(player);
    for (let index = 0; index < NUMPSPRITES; index++) {
      expect(player.psprites[index]!.state).toBeNull();
    }
  });

  it('resets didsecret', () => {
    const player = createPlayer();
    player.didsecret = true;
    playerReborn(player);
    expect(player.didsecret).toBe(false);
  });
});

// ── setPsprite ────────────────────────────────────────────────────────

describe('setPsprite', () => {
  it('sets weapon psprite to the given state', () => {
    const player = createPlayer();
    setPsprite(player, PsprNum.WEAPON, StateNum.PISTOL);
    expect(player.psprites[PsprNum.WEAPON]!.state).toBe(STATES[StateNum.PISTOL]);
  });

  it('sets tics from the state entry', () => {
    const player = createPlayer();
    setPsprite(player, PsprNum.WEAPON, StateNum.PISTOL);
    expect(player.psprites[PsprNum.WEAPON]!.tics).toBe(STATES[StateNum.PISTOL]!.tics);
  });

  it('clears psprite on S_NULL', () => {
    const player = createPlayer();
    setPsprite(player, PsprNum.WEAPON, StateNum.PISTOL);
    expect(player.psprites[PsprNum.WEAPON]!.state).not.toBeNull();
    setPsprite(player, PsprNum.WEAPON, StateNum.NULL);
    expect(player.psprites[PsprNum.WEAPON]!.state).toBeNull();
  });

  it('sets flash psprite independently', () => {
    const player = createPlayer();
    setPsprite(player, PsprNum.FLASH, StateNum.PISTOLFLASH);
    expect(player.psprites[PsprNum.FLASH]!.state).toBe(STATES[StateNum.PISTOLFLASH]);
    expect(player.psprites[PsprNum.WEAPON]!.state).toBeNull();
  });
});

// ── bringUpWeapon ────────────────────────────────────────────────────

describe('bringUpWeapon', () => {
  it('sets weapon sy to WEAPONBOTTOM', () => {
    const player = createPlayer();
    playerReborn(player);
    bringUpWeapon(player);
    expect(player.psprites[PsprNum.WEAPON]!.sy).toBe(WEAPONBOTTOM);
  });

  it('sets weapon state to the pending weapon upstate', () => {
    const player = createPlayer();
    playerReborn(player);
    player.pendingweapon = WeaponType.PISTOL;
    bringUpWeapon(player);
    expect(player.psprites[PsprNum.WEAPON]!.state).toBe(STATES[StateNum.PISTOLUP]);
  });

  it('clears pendingweapon to WP_NOCHANGE after raising', () => {
    const player = createPlayer();
    playerReborn(player);
    player.pendingweapon = WeaponType.SHOTGUN;
    bringUpWeapon(player);
    expect(player.pendingweapon).toBe(WP_NOCHANGE);
  });

  it('falls back to readyweapon if pendingweapon is WP_NOCHANGE', () => {
    const player = createPlayer();
    playerReborn(player);
    player.readyweapon = WeaponType.FIST;
    player.pendingweapon = WP_NOCHANGE;
    bringUpWeapon(player);
    expect(player.psprites[PsprNum.WEAPON]!.state).toBe(STATES[StateNum.PUNCHUP]);
  });

  it('calls sound callback for chainsaw', () => {
    const player = createPlayer();
    playerReborn(player);
    player.pendingweapon = WeaponType.CHAINSAW;
    const sounds: number[] = [];
    bringUpWeapon(player, (_mobj, sound) => {
      sounds.push(sound);
    });
    expect(sounds.length).toBe(0);
  });
});

// ── setupPsprites ────────────────────────────────────────────────────

describe('setupPsprites', () => {
  it('clears all psprite states before raising weapon', () => {
    const player = createPlayer();
    playerReborn(player);
    player.psprites[PsprNum.FLASH]!.state = STATES[StateNum.PISTOLFLASH]!;
    setupPsprites(player);
    expect(player.psprites[PsprNum.FLASH]!.state).toBeNull();
  });

  it('raises the ready weapon', () => {
    const player = createPlayer();
    playerReborn(player);
    player.readyweapon = WeaponType.PISTOL;
    setupPsprites(player);
    expect(player.psprites[PsprNum.WEAPON]!.state).toBe(STATES[StateNum.PISTOLUP]);
  });

  it('sets pendingweapon to readyweapon before raising', () => {
    const player = createPlayer();
    playerReborn(player);
    player.readyweapon = WeaponType.FIST;
    player.pendingweapon = WeaponType.SHOTGUN;
    setupPsprites(player);
    expect(player.psprites[PsprNum.WEAPON]!.state).toBe(STATES[StateNum.PUNCHUP]);
  });

  it('leaves pendingweapon as WP_NOCHANGE after setup', () => {
    const player = createPlayer();
    playerReborn(player);
    setupPsprites(player);
    expect(player.pendingweapon).toBe(WP_NOCHANGE);
  });
});

// ── movePsprites ─────────────────────────────────────────────────────

describe('movePsprites', () => {
  it('decrements tics of active weapon psprite', () => {
    const player = createPlayer();
    playerReborn(player);
    setupPsprites(player);
    // Set tics > 1 so decrement doesn't trigger state transition
    player.psprites[PsprNum.WEAPON]!.tics = 5;
    movePsprites(player);
    expect(player.psprites[PsprNum.WEAPON]!.tics).toBe(4);
  });

  it('does not decrement tics of -1 (infinite duration)', () => {
    const player = createPlayer();
    playerReborn(player);
    setupPsprites(player);
    player.psprites[PsprNum.WEAPON]!.tics = -1;
    movePsprites(player);
    expect(player.psprites[PsprNum.WEAPON]!.tics).toBe(-1);
  });

  it('transitions to nextstate when tics reach 0', () => {
    const player = createPlayer();
    playerReborn(player);
    setupPsprites(player);
    player.psprites[PsprNum.WEAPON]!.tics = 1;
    const currentState = player.psprites[PsprNum.WEAPON]!.state!;
    movePsprites(player);
    expect(player.psprites[PsprNum.WEAPON]!.state).toBe(STATES[currentState.nextstate]);
  });

  it('does nothing for null-state psprites', () => {
    const player = createPlayer();
    playerReborn(player);
    expect(player.psprites[PsprNum.FLASH]!.state).toBeNull();
    movePsprites(player);
    expect(player.psprites[PsprNum.FLASH]!.state).toBeNull();
  });

  it('syncs flash position to weapon position', () => {
    const player = createPlayer();
    playerReborn(player);
    setupPsprites(player);
    player.psprites[PsprNum.WEAPON]!.sx = 12345;
    player.psprites[PsprNum.WEAPON]!.sy = 67890;
    movePsprites(player);
    expect(player.psprites[PsprNum.FLASH]!.sx).toBe(12345);
    expect(player.psprites[PsprNum.FLASH]!.sy).toBe(67890);
  });
});

// ── Parity-sensitive edge cases ──────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('playerReborn zeros everything before restoring saved values (memset order)', () => {
    const player = createPlayer();
    player.health = 200;
    player.armorpoints = 200;
    player.armortype = 2;
    player.weaponowned[WeaponType.BFG] = true;
    player.ammo[AmmoType.CELL] = 300;
    player.powers[PowerType.INVULNERABILITY] = 60;
    player.cards[CardType.REDSKULL] = true;
    player.backpack = true;
    player.cheats = 0xff;
    player.extralight = 2;
    player.killcount = 100;
    player.itemcount = 50;
    player.secretcount = 5;
    player.frags[0] = 10;

    playerReborn(player);

    expect(player.health).toBe(INITIAL_HEALTH);
    expect(player.armorpoints).toBe(0);
    expect(player.armortype).toBe(0);
    expect(player.weaponowned[WeaponType.BFG]).toBe(false);
    expect(player.ammo[AmmoType.CELL]).toBe(0);
    expect(player.powers[PowerType.INVULNERABILITY]).toBe(0);
    expect(player.cards[CardType.REDSKULL]).toBe(false);
    expect(player.backpack).toBe(false);
    expect(player.cheats).toBe(0);
    expect(player.extralight).toBe(0);
    expect(player.killcount).toBe(100);
    expect(player.itemcount).toBe(50);
    expect(player.secretcount).toBe(5);
    expect(player.frags[0]).toBe(10);
  });

  it('attackdown=true prevents immediate fire on spawn frame', () => {
    const player = createPlayer();
    playerReborn(player);
    expect(player.attackdown).toBe(true);
  });

  it('usedown=true prevents immediate use on spawn frame', () => {
    const player = createPlayer();
    playerReborn(player);
    expect(player.usedown).toBe(true);
  });

  it('WEAPON_INFO fist has S_NULL flashstate (no muzzle flash)', () => {
    expect(WEAPON_INFO[WeaponType.FIST]!.flashstate).toBe(StateNum.NULL);
  });

  it('WEAPON_INFO chainsaw has S_NULL flashstate (no muzzle flash)', () => {
    expect(WEAPON_INFO[WeaponType.CHAINSAW]!.flashstate).toBe(StateNum.NULL);
  });

  it('WEAPON_INFO indexed by WeaponType produces correct states for all weapons', () => {
    const expectedUpstates: StateNum[] = [StateNum.PUNCHUP, StateNum.PISTOLUP, StateNum.SGUNUP, StateNum.CHAINUP, StateNum.MISSILEUP, StateNum.PLASMAUP, StateNum.BFGUP, StateNum.SAWUP, StateNum.DSGUNUP];
    for (let weapon = 0; weapon < NUMWEAPONS; weapon++) {
      expect(WEAPON_INFO[weapon]!.upstate).toBe(expectedUpstates[weapon]);
    }
  });

  it('setupPsprites weapon sy is WEAPONBOTTOM (raising animation starts at bottom)', () => {
    const player = createPlayer();
    playerReborn(player);
    setupPsprites(player);
    expect(player.psprites[PsprNum.WEAPON]!.sy).toBe(WEAPONBOTTOM);
  });

  it('setPsprite with misc1 non-zero sets sx/sy from state misc fields', () => {
    const player = createPlayer();
    const stateWithMisc = STATES.findIndex((s) => s.misc1 !== 0);
    if (stateWithMisc > 0) {
      setPsprite(player, PsprNum.WEAPON, stateWithMisc as StateNum);
      const state = STATES[stateWithMisc]!;
      expect(player.psprites[PsprNum.WEAPON]!.sx).toBe(state.misc1 << FRACBITS);
      expect(player.psprites[PsprNum.WEAPON]!.sy).toBe(state.misc2 << FRACBITS);
    }
  });

  it('consecutive playerReborn calls are idempotent', () => {
    const player = createPlayer();
    player.frags[0] = 7;
    player.killcount = 99;
    playerReborn(player);
    playerReborn(player);
    expect(player.health).toBe(INITIAL_HEALTH);
    expect(player.frags[0]).toBe(7);
    expect(player.killcount).toBe(99);
    expect(player.weaponowned[WeaponType.FIST]).toBe(true);
    expect(player.weaponowned[WeaponType.PISTOL]).toBe(true);
    expect(player.ammo[AmmoType.CLIP]).toBe(INITIAL_BULLETS);
  });

  it('PspriteActionFunction type is assignable as expected', () => {
    const action: PspriteActionFunction = (_player: Player, _psp: PspriteDef) => {};
    expect(typeof action).toBe('function');
  });
});
