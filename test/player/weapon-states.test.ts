import { describe, expect, it, beforeEach } from 'bun:test';

import type { Player, PspriteDef } from '../../src/player/playerSpawn.ts';
import type { WeaponStateContext } from '../../src/player/weaponStates.ts';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { fixedMul } from '../../src/core/fixed.ts';
import { FINEANGLES, FINEMASK, finecosine, finesine } from '../../src/core/trig.ts';
import { BT_ATTACK } from '../../src/input/ticcmd.ts';
import { EMPTY_TICCMD } from '../../src/input/ticcmd.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';
import { Mobj, StateNum, STATES } from '../../src/world/mobj.ts';
import { AM_NOAMMO, AmmoType, PsprNum, WEAPONBOTTOM, WEAPONTOP, WEAPON_INFO, WeaponType, WP_NOCHANGE, LOWERSPEED, RAISESPEED, createPlayer, playerReborn, pspriteActions, setPsprite, PlayerState } from '../../src/player/playerSpawn.ts';

import {
  SFX_SAWIDL,
  WEAPON_STATE_ACTION_COUNT,
  aCheckReload,
  aGunFlash,
  aLight0,
  aLight1,
  aLight2,
  aLower,
  aRaise,
  aReFire,
  aWeaponReady,
  dropWeapon,
  fireWeapon,
  getWeaponStateContext,
  setWeaponStateContext,
  wireWeaponStateActions,
} from '../../src/player/weaponStates.ts';

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a player with standard post-reborn loadout. */
function spawnedPlayer(): Player {
  const player = createPlayer();
  playerReborn(player);
  return player;
}

/** Create a minimal Mobj for use as player.mo. */
function createMobj(): Mobj {
  const mobj = new Mobj();
  mobj.state = STATES[StateNum.PLAY]!;
  return mobj;
}

/** Create a ThinkerList for setMobjState calls. */
function createThinkerList(): ThinkerList {
  const list = new ThinkerList();
  list.init();
  return list;
}

/** Track calls to side-effect callbacks. */
interface CallLog {
  startSoundCalls: Array<{ soundId: number }>;
  noiseAlertCalls: number;
  setMobjStateCalls: Array<{ stateNum: number }>;
}

/** Build a test context with recording callbacks. */
function createTestContext(overrides?: Partial<WeaponStateContext>): {
  context: WeaponStateContext;
  log: CallLog;
} {
  const thinkerList = createThinkerList();
  const log: CallLog = {
    startSoundCalls: [],
    noiseAlertCalls: 0,
    setMobjStateCalls: [],
  };
  const context: WeaponStateContext = {
    leveltime: 0,
    gamemode: 'shareware',
    thinkerList,
    startSound: (origin, soundId) => {
      log.startSoundCalls.push({ soundId });
    },
    noiseAlert: (_target, _emitter) => {
      log.noiseAlertCalls++;
    },
    ...overrides,
  };
  return { context, log };
}

/** Set up a player ready to fire with a specific weapon and ammo. */
function playerWithWeapon(weapon: number, ammo?: number): Player {
  const player = spawnedPlayer();
  player.readyweapon = weapon;
  player.pendingweapon = WP_NOCHANGE;
  player.weaponowned[weapon] = true;

  const ammoType = WEAPON_INFO[weapon]!.ammo;
  if (ammoType !== AM_NOAMMO && ammo !== undefined) {
    player.ammo[ammoType] = ammo;
  }

  const mobj = createMobj();
  player.mo = mobj;

  // Set weapon psprite to ready state.
  setPsprite(player, PsprNum.WEAPON, WEAPON_INFO[weapon]!.readystate);
  return player;
}

// Wire actions once before all tests.
wireWeaponStateActions();

// ── WEAPON_STATE_ACTION_COUNT constant ───────────────────────────────

describe('WEAPON_STATE_ACTION_COUNT', () => {
  it('equals the number of pspriteActions entries wired', () => {
    let count = 0;
    for (let index = 0; index < pspriteActions.length; index++) {
      if (pspriteActions[index]) count++;
    }
    expect(count).toBe(WEAPON_STATE_ACTION_COUNT);
  });

  it('is 55', () => {
    expect(WEAPON_STATE_ACTION_COUNT).toBe(55);
  });
});

// ── State wiring correctness ─────────────────────────────────────────

describe('wireWeaponStateActions', () => {
  it('wires A_WeaponReady to all 10 ready states', () => {
    const readyStates = [StateNum.PUNCH, StateNum.PISTOL, StateNum.SGUN, StateNum.DSGUN, StateNum.CHAIN, StateNum.MISSILE, StateNum.SAW, StateNum.SAWB, StateNum.PLASMA, StateNum.BFG];
    for (const stateNum of readyStates) {
      expect(pspriteActions[stateNum]).toBe(aWeaponReady);
    }
  });

  it('wires A_Lower to all 9 downstates', () => {
    const downStates = [StateNum.PUNCHDOWN, StateNum.PISTOLDOWN, StateNum.SGUNDOWN, StateNum.DSGUNDOWN, StateNum.CHAINDOWN, StateNum.MISSILEDOWN, StateNum.SAWDOWN, StateNum.PLASMADOWN, StateNum.BFGDOWN];
    for (const stateNum of downStates) {
      expect(pspriteActions[stateNum]).toBe(aLower);
    }
  });

  it('wires A_Raise to all 9 upstates', () => {
    const upStates = [StateNum.PUNCHUP, StateNum.PISTOLUP, StateNum.SGUNUP, StateNum.DSGUNUP, StateNum.CHAINUP, StateNum.MISSILEUP, StateNum.SAWUP, StateNum.PLASMAUP, StateNum.BFGUP];
    for (const stateNum of upStates) {
      expect(pspriteActions[stateNum]).toBe(aRaise);
    }
  });

  it('wires A_ReFire to all 9 refire states', () => {
    const refireStates = [StateNum.PUNCH5, StateNum.PISTOL4, StateNum.SGUN9, StateNum.DSNR2, StateNum.CHAIN3, StateNum.MISSILE3, StateNum.SAW3, StateNum.PLASMA2, StateNum.BFG4];
    for (const stateNum of refireStates) {
      expect(pspriteActions[stateNum]).toBe(aReFire);
    }
  });

  it('wires A_CheckReload to S_DSGUN6 only', () => {
    expect(pspriteActions[StateNum.DSGUN6]).toBe(aCheckReload);
  });

  it('wires A_GunFlash to S_MISSILE1 and S_BFG2', () => {
    expect(pspriteActions[StateNum.MISSILE1]).toBe(aGunFlash);
    expect(pspriteActions[StateNum.BFG2]).toBe(aGunFlash);
  });

  it('wires A_Light0 to S_LIGHTDONE only', () => {
    expect(pspriteActions[StateNum.LIGHTDONE]).toBe(aLight0);
  });

  it('wires A_Light1 to 8 flash states', () => {
    const light1States = [StateNum.PISTOLFLASH, StateNum.SGUNFLASH1, StateNum.DSGUNFLASH1, StateNum.CHAINFLASH1, StateNum.MISSILEFLASH1, StateNum.PLASMAFLASH1, StateNum.PLASMAFLASH2, StateNum.BFGFLASH1];
    for (const stateNum of light1States) {
      expect(pspriteActions[stateNum]).toBe(aLight1);
    }
  });

  it('wires A_Light2 to 6 flash states', () => {
    const light2States = [StateNum.SGUNFLASH2, StateNum.DSGUNFLASH2, StateNum.CHAINFLASH2, StateNum.MISSILEFLASH3, StateNum.MISSILEFLASH4, StateNum.BFGFLASH2];
    for (const stateNum of light2States) {
      expect(pspriteActions[stateNum]).toBe(aLight2);
    }
  });

  it('does not wire S_MISSILEFLASH2 (NULL in info.c)', () => {
    expect(pspriteActions[StateNum.MISSILEFLASH2]).toBeUndefined();
  });
});

// ── A_Light0 / A_Light1 / A_Light2 ──────────────────────────────────

describe('A_Light0', () => {
  it('sets extralight to 0', () => {
    const player = spawnedPlayer();
    player.extralight = 2;
    const psp = player.psprites[PsprNum.FLASH]!;
    aLight0(player, psp);
    expect(player.extralight).toBe(0);
  });
});

describe('A_Light1', () => {
  it('sets extralight to 1', () => {
    const player = spawnedPlayer();
    player.extralight = 0;
    const psp = player.psprites[PsprNum.FLASH]!;
    aLight1(player, psp);
    expect(player.extralight).toBe(1);
  });
});

describe('A_Light2', () => {
  it('sets extralight to 2', () => {
    const player = spawnedPlayer();
    player.extralight = 0;
    const psp = player.psprites[PsprNum.FLASH]!;
    aLight2(player, psp);
    expect(player.extralight).toBe(2);
  });
});

// ── A_Raise ──────────────────────────────────────────────────────────

describe('A_Raise', () => {
  beforeEach(() => {
    const { context } = createTestContext();
    setWeaponStateContext(context);
  });

  it('decrements sy by RAISESPEED', () => {
    const player = spawnedPlayer();
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.sy = WEAPONBOTTOM;
    psp.state = STATES[StateNum.PISTOLUP]!;
    aRaise(player, psp);
    expect(psp.sy).toBe((WEAPONBOTTOM - RAISESPEED) | 0);
  });

  it('does not transition while sy > WEAPONTOP', () => {
    const player = spawnedPlayer();
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.sy = WEAPONTOP + RAISESPEED + RAISESPEED;
    psp.state = STATES[StateNum.PISTOLUP]!;
    const stateBefore = psp.state;
    aRaise(player, psp);
    expect(psp.state).toBe(stateBefore);
  });

  it('clamps sy and transitions to readystate when sy reaches WEAPONTOP', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.pendingweapon = WP_NOCHANGE;
    player.bob = 0;
    player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    // Set state directly to avoid triggering A_Raise via setPsprite.
    psp.state = STATES[StateNum.PISTOLUP]!;
    psp.tics = 1;
    psp.sy = WEAPONTOP + 1;
    aRaise(player, psp);
    // After clamping, setPsprite transitions to readystate which calls
    // A_WeaponReady (bob applied). With bob=0, sy stays at WEAPONTOP.
    expect(psp.state).toBe(STATES[StateNum.PISTOL]);
    expect(psp.sy).toBe(WEAPONTOP);
  });
});

// ── A_Lower ──────────────────────────────────────────────────────────

describe('A_Lower', () => {
  beforeEach(() => {
    const { context } = createTestContext();
    setWeaponStateContext(context);
  });

  it('increments sy by LOWERSPEED', () => {
    const player = spawnedPlayer();
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.sy = WEAPONTOP;
    psp.state = STATES[StateNum.PISTOLDOWN]!;
    aLower(player, psp);
    expect(psp.sy).toBe((WEAPONTOP + LOWERSPEED) | 0);
  });

  it('returns early while sy < WEAPONBOTTOM', () => {
    const player = spawnedPlayer();
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.sy = WEAPONTOP;
    psp.state = STATES[StateNum.PISTOLDOWN]!;
    const stateBefore = psp.state;
    aLower(player, psp);
    expect(psp.state).toBe(stateBefore);
  });

  it('dead player stays at WEAPONBOTTOM', () => {
    const player = spawnedPlayer();
    player.playerstate = PlayerState.DEAD;
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.sy = WEAPONBOTTOM;
    psp.state = STATES[StateNum.PISTOLDOWN]!;
    aLower(player, psp);
    expect(psp.sy).toBe(WEAPONBOTTOM);
  });

  it('zero-health living player gets S_NULL weapon', () => {
    const player = spawnedPlayer();
    player.health = 0;
    player.playerstate = PlayerState.LIVE;
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.sy = WEAPONBOTTOM;
    psp.state = STATES[StateNum.PISTOLDOWN]!;
    aLower(player, psp);
    expect(psp.state).toBeNull();
  });

  it('healthy player switches to pending weapon via bringUpWeapon', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.pendingweapon = WeaponType.SHOTGUN;
    player.weaponowned[WeaponType.SHOTGUN] = true;
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.sy = WEAPONBOTTOM;
    psp.state = STATES[StateNum.PISTOLDOWN]!;
    aLower(player, psp);
    expect(player.readyweapon).toBe(WeaponType.SHOTGUN);
    expect(player.pendingweapon).toBe(WP_NOCHANGE);
  });

  it('plays sfx_sawup via context.startSound when switching to chainsaw', () => {
    const result = createTestContext();
    setWeaponStateContext(result.context);
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.pendingweapon = WeaponType.CHAINSAW;
    player.weaponowned[WeaponType.CHAINSAW] = true;
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.sy = WEAPONBOTTOM;
    psp.state = STATES[StateNum.PISTOLDOWN]!;
    aLower(player, psp);
    // sfx_sawup is sound id 25 in sounds.h. bringUpWeapon must emit it so
    // chainsaw power-on parity is preserved when switching mid-lower.
    expect(result.log.startSoundCalls.some((c) => c.soundId === 25)).toBe(true);
  });
});

// ── A_WeaponReady ────────────────────────────────────────────────────

describe('A_WeaponReady', () => {
  let log: CallLog;

  beforeEach(() => {
    const result = createTestContext();
    log = result.log;
    setWeaponStateContext(result.context);
  });

  it('resets player mobj from S_PLAY_ATK1 to S_PLAY', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.mo!.state = STATES[StateNum.PLAY_ATK1]!;
    const psp = player.psprites[PsprNum.WEAPON]!;
    aWeaponReady(player, psp);
    expect(player.mo!.state).toBe(STATES[StateNum.PLAY]);
  });

  it('resets player mobj from S_PLAY_ATK2 to S_PLAY', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.mo!.state = STATES[StateNum.PLAY_ATK2]!;
    const psp = player.psprites[PsprNum.WEAPON]!;
    aWeaponReady(player, psp);
    expect(player.mo!.state).toBe(STATES[StateNum.PLAY]);
  });

  it('plays sfx_sawidl for chainsaw in S_SAW state', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.CHAINSAW;
    player.weaponowned[WeaponType.CHAINSAW] = true;
    player.mo = createMobj();
    player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.state = STATES[StateNum.SAW]!;
    psp.tics = 1;
    aWeaponReady(player, psp);
    expect(log.startSoundCalls).toHaveLength(1);
    expect(log.startSoundCalls[0]!.soundId).toBe(SFX_SAWIDL);
  });

  it('does not play sfx_sawidl for chainsaw in S_SAWB state', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.CHAINSAW;
    player.weaponowned[WeaponType.CHAINSAW] = true;
    player.mo = createMobj();
    player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.state = STATES[StateNum.SAWB]!;
    psp.tics = 1;
    aWeaponReady(player, psp);
    expect(log.startSoundCalls).toHaveLength(0);
  });

  it('lowers weapon when pendingweapon is set', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.pendingweapon = WeaponType.FIST;
    const psp = player.psprites[PsprNum.WEAPON]!;
    aWeaponReady(player, psp);
    expect(psp.state).toBe(STATES[WEAPON_INFO[WeaponType.PISTOL]!.downstate]);
  });

  it('lowers weapon when health is 0', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.health = 0;
    const psp = player.psprites[PsprNum.WEAPON]!;
    aWeaponReady(player, psp);
    expect(psp.state).toBe(STATES[WEAPON_INFO[WeaponType.PISTOL]!.downstate]);
  });

  it('fires weapon on BT_ATTACK when not attackdown', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.attackdown = false;
    player.cmd = { ...EMPTY_TICCMD, buttons: BT_ATTACK };
    const psp = player.psprites[PsprNum.WEAPON]!;
    aWeaponReady(player, psp);
    expect(player.attackdown).toBe(true);
    expect(psp.state).toBe(STATES[WEAPON_INFO[WeaponType.PISTOL]!.atkstate]);
  });

  it('does not re-fire missile when attackdown is true (semi-auto)', () => {
    const player = playerWithWeapon(WeaponType.MISSILE, 10);
    player.attackdown = true;
    player.cmd = { ...EMPTY_TICCMD, buttons: BT_ATTACK };
    const psp = player.psprites[PsprNum.WEAPON]!;
    const stateBefore = psp.state;
    aWeaponReady(player, psp);
    // Should NOT fire — state unchanged, bob applied instead.
    expect(psp.state).toBe(stateBefore);
  });

  it('does not re-fire BFG when attackdown is true (semi-auto)', () => {
    const player = playerWithWeapon(WeaponType.BFG, 50);
    player.attackdown = true;
    player.cmd = { ...EMPTY_TICCMD, buttons: BT_ATTACK };
    const psp = player.psprites[PsprNum.WEAPON]!;
    const stateBefore = psp.state;
    aWeaponReady(player, psp);
    expect(psp.state).toBe(stateBefore);
  });

  it('allows re-fire for non-missile non-BFG when attackdown is true', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.attackdown = true;
    player.cmd = { ...EMPTY_TICCMD, buttons: BT_ATTACK };
    const psp = player.psprites[PsprNum.WEAPON]!;
    aWeaponReady(player, psp);
    expect(psp.state).toBe(STATES[WEAPON_INFO[WeaponType.PISTOL]!.atkstate]);
  });

  it('clears attackdown when fire button released', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.attackdown = true;
    player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
    const psp = player.psprites[PsprNum.WEAPON]!;
    aWeaponReady(player, psp);
    expect(player.attackdown).toBe(false);
  });

  it('applies weapon bob based on leveltime and player.bob', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.bob = FRACUNIT * 4;
    player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
    const psp = player.psprites[PsprNum.WEAPON]!;
    const ctx = getWeaponStateContext()!;
    ctx.leveltime = 10;
    aWeaponReady(player, psp);

    const angle = (128 * 10) & FINEMASK;
    const expectedSx = (FRACUNIT + fixedMul(player.bob, finecosine[angle]!)) | 0;
    const halfAngle = angle & (FINEANGLES / 2 - 1);
    const expectedSy = (WEAPONTOP + fixedMul(player.bob, finesine[halfAngle]!)) | 0;
    expect(psp.sx).toBe(expectedSx);
    expect(psp.sy).toBe(expectedSy);
  });

  it('bob sx centers on FRACUNIT when bob is 0', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.bob = 0;
    player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
    const psp = player.psprites[PsprNum.WEAPON]!;
    aWeaponReady(player, psp);
    expect(psp.sx).toBe(FRACUNIT);
    expect(psp.sy).toBe(WEAPONTOP);
  });
});

// ── fireWeapon ───────────────────────────────────────────────────────

describe('fireWeapon', () => {
  let log: CallLog;

  beforeEach(() => {
    const result = createTestContext();
    log = result.log;
    setWeaponStateContext(result.context);
  });

  it('transitions to atkstate and sets player mobj to S_PLAY_ATK1', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    fireWeapon(player);
    expect(player.mo!.state).toBe(STATES[StateNum.PLAY_ATK1]);
    expect(player.psprites[PsprNum.WEAPON]!.state).toBe(STATES[WEAPON_INFO[WeaponType.PISTOL]!.atkstate]);
  });

  it('does nothing when ammo is insufficient', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 0);
    const stateBefore = player.psprites[PsprNum.WEAPON]!.state;
    fireWeapon(player);
    // checkAmmo triggers weapon switch, but fireWeapon returns without atkstate.
    // The weapon should have been lowered by checkAmmo.
    expect(player.psprites[PsprNum.WEAPON]!.state).not.toBe(STATES[WEAPON_INFO[WeaponType.PISTOL]!.atkstate]);
  });

  it('fires noiseAlert callback', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    fireWeapon(player);
    expect(log.noiseAlertCalls).toBe(1);
  });

  it('does not fire noiseAlert when no ammo', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 0);
    fireWeapon(player);
    expect(log.noiseAlertCalls).toBe(0);
  });

  it('works for fist (AM_NOAMMO) without ammo check failure', () => {
    const player = playerWithWeapon(WeaponType.FIST);
    fireWeapon(player);
    expect(player.psprites[PsprNum.WEAPON]!.state).toBe(STATES[WEAPON_INFO[WeaponType.FIST]!.atkstate]);
  });
});

// ── A_ReFire ─────────────────────────────────────────────────────────

describe('A_ReFire', () => {
  beforeEach(() => {
    const { context } = createTestContext();
    setWeaponStateContext(context);
  });

  it('increments refire and fires when holding BT_ATTACK', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.refire = 0;
    player.cmd = { ...EMPTY_TICCMD, buttons: BT_ATTACK };
    const psp = player.psprites[PsprNum.WEAPON]!;
    aReFire(player, psp);
    expect(player.refire).toBe(1);
  });

  it('resets refire to 0 when not holding fire', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.refire = 5;
    player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
    const psp = player.psprites[PsprNum.WEAPON]!;
    aReFire(player, psp);
    expect(player.refire).toBe(0);
  });

  it('resets refire when pendingweapon is set despite BT_ATTACK', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.refire = 3;
    player.pendingweapon = WeaponType.SHOTGUN;
    player.cmd = { ...EMPTY_TICCMD, buttons: BT_ATTACK };
    const psp = player.psprites[PsprNum.WEAPON]!;
    aReFire(player, psp);
    expect(player.refire).toBe(0);
  });

  it('resets refire when health is 0 despite BT_ATTACK', () => {
    const player = playerWithWeapon(WeaponType.PISTOL, 50);
    player.refire = 3;
    player.health = 0;
    player.cmd = { ...EMPTY_TICCMD, buttons: BT_ATTACK };
    const psp = player.psprites[PsprNum.WEAPON]!;
    aReFire(player, psp);
    expect(player.refire).toBe(0);
  });
});

// ── A_CheckReload ────────────────────────────────────────────────────

describe('A_CheckReload', () => {
  beforeEach(() => {
    const { context } = createTestContext();
    setWeaponStateContext(context);
  });

  it('triggers weapon switch when no ammo for SSG', () => {
    const player = playerWithWeapon(WeaponType.SUPERSHOTGUN, 0);
    const psp = player.psprites[PsprNum.WEAPON]!;
    aCheckReload(player, psp);
    // checkAmmo should have switched to a weapon with ammo.
    expect(player.pendingweapon !== WP_NOCHANGE || player.readyweapon !== WeaponType.SUPERSHOTGUN).toBe(true);
  });

  it('does not switch when SSG has enough ammo', () => {
    const player = playerWithWeapon(WeaponType.SUPERSHOTGUN, 10);
    player.pendingweapon = WP_NOCHANGE;
    const psp = player.psprites[PsprNum.WEAPON]!;
    aCheckReload(player, psp);
    // checkAmmo returns true, no weapon switch.
    expect(player.pendingweapon).toBe(WP_NOCHANGE);
  });
});

// ── A_GunFlash ───────────────────────────────────────────────────────

describe('A_GunFlash', () => {
  beforeEach(() => {
    const { context } = createTestContext();
    setWeaponStateContext(context);
  });

  it('sets player mobj to S_PLAY_ATK2', () => {
    const player = playerWithWeapon(WeaponType.MISSILE, 10);
    const psp = player.psprites[PsprNum.WEAPON]!;
    aGunFlash(player, psp);
    expect(player.mo!.state).toBe(STATES[StateNum.PLAY_ATK2]);
  });

  it('sets flash psprite to weapon flashstate', () => {
    const player = playerWithWeapon(WeaponType.MISSILE, 10);
    const psp = player.psprites[PsprNum.WEAPON]!;
    aGunFlash(player, psp);
    const flashState = player.psprites[PsprNum.FLASH]!.state;
    expect(flashState).toBe(STATES[WEAPON_INFO[WeaponType.MISSILE]!.flashstate]);
  });

  it('sets extralight via flash state action (Light1 for missile)', () => {
    const player = playerWithWeapon(WeaponType.MISSILE, 10);
    player.extralight = 0;
    const psp = player.psprites[PsprNum.WEAPON]!;
    aGunFlash(player, psp);
    // S_MISSILEFLASH1 has A_Light1, which sets extralight = 1.
    expect(player.extralight).toBe(1);
  });
});

// ── dropWeapon ───────────────────────────────────────────────────────

describe('dropWeapon', () => {
  beforeEach(() => {
    const { context } = createTestContext();
    setWeaponStateContext(context);
  });

  it('transitions to weapon downstate', () => {
    const player = playerWithWeapon(WeaponType.SHOTGUN, 10);
    dropWeapon(player);
    expect(player.psprites[PsprNum.WEAPON]!.state).toBe(STATES[WEAPON_INFO[WeaponType.SHOTGUN]!.downstate]);
  });
});

// ── SFX_SAWIDL constant ─────────────────────────────────────────────

describe('SFX_SAWIDL', () => {
  it('equals 12 matching sounds.h sfx_sawidl', () => {
    expect(SFX_SAWIDL).toBe(12);
  });
});

// ── Full raise/lower cycle ───────────────────────────────────────────

describe('full raise/lower weapon cycle', () => {
  beforeEach(() => {
    const { context } = createTestContext();
    setWeaponStateContext(context);
  });

  it('raise cycle completes in exactly (WEAPONBOTTOM - WEAPONTOP) / RAISESPEED tics', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.pendingweapon = WP_NOCHANGE;
    player.bob = 0;
    player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    // Set state directly to avoid triggering A_Raise via setPsprite.
    psp.state = STATES[StateNum.PISTOLUP]!;
    psp.tics = 1;
    psp.sy = WEAPONBOTTOM;

    let ticCount = 0;
    while (psp.sy > WEAPONTOP && ticCount <= 100) {
      aRaise(player, psp);
      ticCount++;
    }

    const expected = ((WEAPONBOTTOM - WEAPONTOP) / RAISESPEED) | 0;
    expect(ticCount).toBe(expected);
    // After clamping, A_WeaponReady bob with bob=0 leaves sy at WEAPONTOP.
    expect(psp.sy).toBe(WEAPONTOP);
  });

  it('lower cycle reaches WEAPONBOTTOM and triggers weapon switch', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.pendingweapon = WeaponType.FIST;
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    setPsprite(player, PsprNum.WEAPON, WEAPON_INFO[WeaponType.PISTOL]!.downstate);
    psp.sy = WEAPONTOP;

    let ticCount = 0;
    while (player.readyweapon === WeaponType.PISTOL) {
      aLower(player, psp);
      ticCount++;
      if (ticCount > 100) break;
    }

    expect(player.readyweapon).toBe(WeaponType.FIST);
    expect(ticCount).toBeLessThanOrEqual(100);
  });
});

// ── Context management ───────────────────────────────────────────────

describe('context management', () => {
  it('setWeaponStateContext stores and getWeaponStateContext retrieves', () => {
    const { context } = createTestContext();
    setWeaponStateContext(context);
    expect(getWeaponStateContext()).toBe(context);
  });

  it('actions are safe when context is null', () => {
    setWeaponStateContext(null);
    const player = spawnedPlayer();
    const psp = player.psprites[PsprNum.WEAPON]!;
    // These should return early without crashing.
    expect(() => aWeaponReady(player, psp)).not.toThrow();
    expect(() => aReFire(player, psp)).not.toThrow();
    expect(() => aCheckReload(player, psp)).not.toThrow();
    expect(() => aGunFlash(player, psp)).not.toThrow();
    expect(() => fireWeapon(player)).not.toThrow();
  });
});

// ── Parity-sensitive edge cases ──────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  beforeEach(() => {
    const { context } = createTestContext();
    setWeaponStateContext(context);
  });

  it('A_WeaponReady bob angle uses (128 * leveltime) & FINEMASK', () => {
    const player = playerWithWeapon(WeaponType.FIST);
    player.bob = FRACUNIT;
    player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
    const ctx = getWeaponStateContext()!;
    const psp = player.psprites[PsprNum.WEAPON]!;

    // leveltime=64 → angle = (128*64)&8191 = 8192&8191 = 0
    ctx.leveltime = 64;
    aWeaponReady(player, psp);
    const angle0 = (128 * 64) & FINEMASK;
    expect(angle0).toBe(0);
    expect(psp.sx).toBe((FRACUNIT + fixedMul(FRACUNIT, finecosine[0]!)) | 0);
  });

  it('A_WeaponReady sy half-angle masks to [0, FINEANGLES/2 - 1]', () => {
    const player = playerWithWeapon(WeaponType.FIST);
    player.bob = FRACUNIT;
    player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
    const ctx = getWeaponStateContext()!;
    const psp = player.psprites[PsprNum.WEAPON]!;

    // Angle > FINEANGLES/2: leveltime=48 → angle=(128*48)&8191=6144
    ctx.leveltime = 48;
    aWeaponReady(player, psp);
    const angle = (128 * 48) & FINEMASK;
    const halfAngle = angle & (FINEANGLES / 2 - 1);
    expect(halfAngle).toBe(angle - 4096);
    expect(psp.sy).toBe((WEAPONTOP + fixedMul(FRACUNIT, finesine[halfAngle]!)) | 0);
  });

  it('A_Lower strict less-than check: sy < WEAPONBOTTOM returns early', () => {
    const player = spawnedPlayer();
    player.mo = createMobj();
    player.pendingweapon = WeaponType.FIST;
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.state = STATES[StateNum.PISTOLDOWN]!;
    psp.sy = WEAPONBOTTOM - LOWERSPEED - 1;
    aLower(player, psp);
    // After adding LOWERSPEED, sy = WEAPONBOTTOM - 1, still < WEAPONBOTTOM.
    expect(psp.sy).toBe(WEAPONBOTTOM - 1);
    // No weapon switch yet.
    expect(player.readyweapon).toBe(WeaponType.PISTOL);
  });

  it('A_Raise strict greater-than check: sy > WEAPONTOP returns early', () => {
    const player = spawnedPlayer();
    player.mo = createMobj();
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.state = STATES[StateNum.PISTOLUP]!;
    psp.sy = WEAPONTOP + RAISESPEED + 1;
    aRaise(player, psp);
    // After subtracting RAISESPEED, sy = WEAPONTOP + 1, still > WEAPONTOP.
    expect(psp.sy).toBe(WEAPONTOP + 1);
  });

  it('S_MISSILEFLASH2 has no psprite action (NULL in info.c)', () => {
    expect(pspriteActions[StateNum.MISSILEFLASH2]).toBeUndefined();
  });

  it('S_CHAIN3 has A_ReFire at 0 tics (chains immediately via setPsprite)', () => {
    expect(STATES[StateNum.CHAIN3]!.tics).toBe(0);
    expect(pspriteActions[StateNum.CHAIN3]).toBe(aReFire);
  });

  it('S_MISSILE3 has A_ReFire at 0 tics', () => {
    expect(STATES[StateNum.MISSILE3]!.tics).toBe(0);
    expect(pspriteActions[StateNum.MISSILE3]).toBe(aReFire);
  });

  it('S_SAW3 has A_ReFire at 0 tics', () => {
    expect(STATES[StateNum.SAW3]!.tics).toBe(0);
    expect(pspriteActions[StateNum.SAW3]).toBe(aReFire);
  });

  it('A_ReFire increments refire counter before calling fireWeapon', () => {
    const player = playerWithWeapon(WeaponType.FIST);
    player.refire = 0;
    player.cmd = { ...EMPTY_TICCMD, buttons: BT_ATTACK };
    const psp = player.psprites[PsprNum.WEAPON]!;
    aReFire(player, psp);
    expect(player.refire).toBe(1);
    aReFire(player, psp);
    expect(player.refire).toBe(2);
  });

  it('PLASMAFLASH1 and PLASMAFLASH2 both wire A_Light1 (not Light1+Light2)', () => {
    expect(pspriteActions[StateNum.PLASMAFLASH1]).toBe(aLight1);
    expect(pspriteActions[StateNum.PLASMAFLASH2]).toBe(aLight1);
  });

  it('S_SAWB has A_WeaponReady (two-frame chainsaw idle animation)', () => {
    expect(pspriteActions[StateNum.SAWB]).toBe(aWeaponReady);
  });
});
