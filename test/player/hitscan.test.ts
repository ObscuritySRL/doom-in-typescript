import { describe, expect, it, afterAll, beforeAll, beforeEach } from 'bun:test';

import type { Angle } from '../../src/core/angle.ts';
import type { Fixed } from '../../src/core/fixed.ts';
import type { Player, PspriteActionFunction } from '../../src/player/playerSpawn.ts';
import type { AimLineAttackResult, HitscanContext } from '../../src/player/hitscan.ts';

import { ANG90, ANG180 } from '../../src/core/angle.ts';
import { DoomRandom } from '../../src/core/rng.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { EMPTY_TICCMD } from '../../src/input/ticcmd.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';
import { MF_JUSTATTACKED, Mobj, STATES, StateNum } from '../../src/world/mobj.ts';
import { AmmoType, PowerType, PsprNum, WEAPON_INFO, WP_NOCHANGE, WeaponType, createPlayer, playerReborn, pspriteActions, setPsprite } from '../../src/player/playerSpawn.ts';

import {
  BULLET_AIM_NUDGE,
  BULLET_AIM_RANGE,
  HITSCAN_ACTION_COUNT,
  MELEERANGE,
  MISSILERANGE,
  SAW_ANGLE_SNAP,
  SAW_ANGLE_STEP,
  SFX_DSHTGN,
  SFX_PISTOL,
  SFX_PUNCH,
  SFX_SAWFUL,
  SFX_SAWHIT,
  SFX_SHOTGN,
  aFireCGun,
  aFirePistol,
  aFireShotgun,
  aFireShotgun2,
  aPunch,
  aSaw,
  bulletSlope,
  getBulletSlope,
  getHitscanContext,
  getLineTarget,
  gunShot,
  resetHitscanAimCache,
  setHitscanContext,
  wireHitscanActions,
} from '../../src/player/hitscan.ts';

// ── Helpers ──────────────────────────────────────────────────────────

interface LineAttackCall {
  shooter: Mobj;
  angle: Angle;
  range: Fixed;
  slope: Fixed;
  damage: number;
}

interface AimLineAttackCall {
  shooter: Mobj;
  angle: Angle;
  range: Fixed;
}

interface PointToAngle2Call {
  x1: Fixed;
  y1: Fixed;
  x2: Fixed;
  y2: Fixed;
}

interface StartSoundCall {
  origin: Mobj | null;
  sfxId: number;
}

interface CallLog {
  lineAttack: LineAttackCall[];
  aimLineAttack: AimLineAttackCall[];
  pointToAngle2: PointToAngle2Call[];
  startSound: StartSoundCall[];
}

interface TestContextOptions {
  aimResults?: AimLineAttackResult[];
  pointToAngle2Result?: Angle;
}

function createPlayerMobj(): Mobj {
  const mobj = new Mobj();
  mobj.state = STATES[StateNum.PLAY]!;
  mobj.x = 0;
  mobj.y = 0;
  mobj.z = 0;
  mobj.angle = 0;
  mobj.flags = 0;
  return mobj;
}

function createTestContext(opts?: TestContextOptions): {
  context: HitscanContext;
  log: CallLog;
  rng: DoomRandom;
} {
  const log: CallLog = {
    lineAttack: [],
    aimLineAttack: [],
    pointToAngle2: [],
    startSound: [],
  };
  const aimQueue: AimLineAttackResult[] = opts?.aimResults?.slice() ?? [];
  const rng = new DoomRandom();
  const thinkerList = new ThinkerList();
  thinkerList.init();

  const context: HitscanContext = {
    rng,
    thinkerList,
    lineAttack: (shooter, angle, range, slope, damage) => {
      log.lineAttack.push({ shooter, angle, range, slope, damage });
    },
    aimLineAttack: (shooter, angle, range) => {
      log.aimLineAttack.push({ shooter, angle, range });
      return aimQueue.shift() ?? { slope: 0, target: null };
    },
    pointToAngle2: (x1, y1, x2, y2) => {
      log.pointToAngle2.push({ x1, y1, x2, y2 });
      return (opts?.pointToAngle2Result ?? 0) >>> 0;
    },
    startSound: (origin, sfxId) => {
      log.startSound.push({ origin, sfxId });
    },
  };
  return { context, log, rng };
}

function spawnedPlayer(weapon: number = WeaponType.PISTOL, ammo: number = 50): Player {
  const player = createPlayer();
  playerReborn(player);
  player.readyweapon = weapon;
  player.pendingweapon = WP_NOCHANGE;
  player.weaponowned[weapon] = true;
  const ammoType = WEAPON_INFO[weapon]!.ammo;
  if (ammoType !== 4) {
    player.ammo[ammoType] = ammo;
  }
  player.mo = createPlayerMobj();
  player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
  setPsprite(player, PsprNum.WEAPON, WEAPON_INFO[weapon]!.readystate);
  return player;
}

function targetMobj(x: Fixed, y: Fixed): Mobj {
  const mobj = new Mobj();
  mobj.x = x;
  mobj.y = y;
  return mobj;
}

// ── Constants ────────────────────────────────────────────────────────

describe('range constants', () => {
  it('MISSILERANGE equals 32*64*FRACUNIT', () => {
    expect(MISSILERANGE).toBe(32 * 64 * FRACUNIT);
    expect(MISSILERANGE).toBe(0x800_0000);
  });

  it('MELEERANGE equals 64*FRACUNIT', () => {
    expect(MELEERANGE).toBe(64 * FRACUNIT);
    expect(MELEERANGE).toBe(0x40_0000);
  });

  it('BULLET_AIM_RANGE equals 16*64*FRACUNIT', () => {
    expect(BULLET_AIM_RANGE).toBe(16 * 64 * FRACUNIT);
    expect(BULLET_AIM_RANGE).toBe(0x400_0000);
  });

  it('BULLET_AIM_NUDGE equals 1<<26', () => {
    expect(BULLET_AIM_NUDGE).toBe(1 << 26);
    expect(BULLET_AIM_NUDGE).toBe(0x400_0000);
  });
});

describe('SFX constants', () => {
  it('SFX_PISTOL is 1 (sounds.h sfx_pistol)', () => {
    expect(SFX_PISTOL).toBe(1);
  });
  it('SFX_SHOTGN is 2 (sounds.h sfx_shotgn)', () => {
    expect(SFX_SHOTGN).toBe(2);
  });
  it('SFX_DSHTGN is 4 (sounds.h sfx_dshtgn)', () => {
    expect(SFX_DSHTGN).toBe(4);
  });
  it('SFX_SAWFUL and SFX_SAWHIT are distinct', () => {
    expect(SFX_SAWFUL).not.toBe(SFX_SAWHIT);
  });
});

describe('saw angle constants', () => {
  it('SAW_ANGLE_STEP equals ANG90/20', () => {
    expect(SAW_ANGLE_STEP).toBe((ANG90 / 20) | 0);
  });

  it('SAW_ANGLE_SNAP equals ANG90/21', () => {
    expect(SAW_ANGLE_SNAP).toBe((ANG90 / 21) | 0);
  });

  it('step is larger than snap (20 < 21 divisor)', () => {
    expect(SAW_ANGLE_STEP).toBeGreaterThan(SAW_ANGLE_SNAP);
  });
});

// ── wireHitscanActions ───────────────────────────────────────────────

describe('wireHitscanActions', () => {
  const hitscanStates: StateNum[] = [StateNum.PUNCH2, StateNum.PISTOL2, StateNum.SGUN2, StateNum.DSGUN2, StateNum.CHAIN1, StateNum.CHAIN2, StateNum.SAW1, StateNum.SAW2];
  const backup: (PspriteActionFunction | undefined)[] = [];

  beforeAll(() => {
    for (const stateNum of hitscanStates) backup.push(pspriteActions[stateNum]);
    wireHitscanActions();
  });

  afterAll(() => {
    for (let index = 0; index < hitscanStates.length; index++) {
      pspriteActions[hitscanStates[index]!] = backup[index];
    }
  });

  it('installs 8 new actions covering PUNCH2, PISTOL2, SGUN2, DSGUN2, CHAIN1+2, SAW1+2', () => {
    const wiredStates = [StateNum.PUNCH2, StateNum.PISTOL2, StateNum.SGUN2, StateNum.DSGUN2, StateNum.CHAIN1, StateNum.CHAIN2, StateNum.SAW1, StateNum.SAW2];
    for (const stateNum of wiredStates) {
      expect(pspriteActions[stateNum]).toBeDefined();
    }
    expect(HITSCAN_ACTION_COUNT).toBe(8);
  });

  it('wires A_Punch to PUNCH2', () => {
    expect(pspriteActions[StateNum.PUNCH2]).toBe(aPunch);
  });

  it('wires A_FirePistol to PISTOL2', () => {
    expect(pspriteActions[StateNum.PISTOL2]).toBe(aFirePistol);
  });

  it('wires A_FireShotgun to SGUN2', () => {
    expect(pspriteActions[StateNum.SGUN2]).toBe(aFireShotgun);
  });

  it('wires A_FireShotgun2 to DSGUN2', () => {
    expect(pspriteActions[StateNum.DSGUN2]).toBe(aFireShotgun2);
  });

  it('wires A_FireCGun to BOTH CHAIN1 and CHAIN2 (alternating flash)', () => {
    expect(pspriteActions[StateNum.CHAIN1]).toBe(aFireCGun);
    expect(pspriteActions[StateNum.CHAIN2]).toBe(aFireCGun);
  });

  it('wires A_Saw to BOTH SAW1 and SAW2', () => {
    expect(pspriteActions[StateNum.SAW1]).toBe(aSaw);
    expect(pspriteActions[StateNum.SAW2]).toBe(aSaw);
  });
});

// ── Context management ──────────────────────────────────────────────

describe('context management', () => {
  it('setHitscanContext stores and getHitscanContext retrieves', () => {
    const { context } = createTestContext();
    setHitscanContext(context);
    expect(getHitscanContext()).toBe(context);
  });

  it('actions return early when context is null (no crash)', () => {
    setHitscanContext(null);
    const player = spawnedPlayer(WeaponType.PISTOL, 50);
    const psp = player.psprites[PsprNum.WEAPON]!;
    expect(() => aFirePistol(player, psp)).not.toThrow();
    expect(() => aPunch(player, psp)).not.toThrow();
    expect(() => aSaw(player, psp)).not.toThrow();
    expect(() => aFireShotgun(player, psp)).not.toThrow();
    expect(() => aFireShotgun2(player, psp)).not.toThrow();
    expect(() => aFireCGun(player, psp)).not.toThrow();
  });
});

// ── P_BulletSlope ────────────────────────────────────────────────────

describe('bulletSlope (P_BulletSlope)', () => {
  beforeEach(() => {
    resetHitscanAimCache();
  });

  it('returns on first aim when a target is found (no cascade)', () => {
    const target = targetMobj(100, 0);
    const { context, log } = createTestContext({
      aimResults: [{ slope: 12345, target }],
    });
    setHitscanContext(context);
    const mo = createPlayerMobj();
    mo.angle = ANG90;

    bulletSlope(mo);

    expect(log.aimLineAttack).toHaveLength(1);
    expect(log.aimLineAttack[0]!.angle).toBe(ANG90);
    expect(log.aimLineAttack[0]!.range).toBe(BULLET_AIM_RANGE);
    expect(getBulletSlope()).toBe(12345);
    expect(getLineTarget()).toBe(target);
  });

  it('tries +nudge angle when first aim misses', () => {
    const target = targetMobj(0, 100);
    const { context, log } = createTestContext({
      aimResults: [
        { slope: 0, target: null },
        { slope: 999, target },
      ],
    });
    setHitscanContext(context);
    const mo = createPlayerMobj();
    mo.angle = 0;

    bulletSlope(mo);

    expect(log.aimLineAttack).toHaveLength(2);
    expect(log.aimLineAttack[0]!.angle).toBe(0);
    expect(log.aimLineAttack[1]!.angle).toBe(BULLET_AIM_NUDGE);
    expect(getBulletSlope()).toBe(999);
    expect(getLineTarget()).toBe(target);
  });

  it('tries -nudge angle when both first and +nudge miss (three-shot cascade)', () => {
    const target = targetMobj(50, 50);
    const { context, log } = createTestContext({
      aimResults: [
        { slope: 0, target: null },
        { slope: 0, target: null },
        { slope: 777, target },
      ],
    });
    setHitscanContext(context);
    const mo = createPlayerMobj();
    mo.angle = 0x1000_0000;

    bulletSlope(mo);

    expect(log.aimLineAttack).toHaveLength(3);
    expect(log.aimLineAttack[0]!.angle).toBe(0x1000_0000);
    expect(log.aimLineAttack[1]!.angle).toBe((0x1000_0000 + BULLET_AIM_NUDGE) >>> 0);
    expect(log.aimLineAttack[2]!.angle).toBe((0x1000_0000 + BULLET_AIM_NUDGE - 2 * BULLET_AIM_NUDGE) >>> 0);
    expect(getBulletSlope()).toBe(777);
  });

  it('leaves linetarget null when all three aims miss', () => {
    const { context } = createTestContext({
      aimResults: [
        { slope: 0, target: null },
        { slope: 0, target: null },
        { slope: 0, target: null },
      ],
    });
    setHitscanContext(context);
    const mo = createPlayerMobj();

    bulletSlope(mo);

    expect(getLineTarget()).toBeNull();
  });
});

// ── P_GunShot ────────────────────────────────────────────────────────

describe('gunShot (P_GunShot)', () => {
  beforeEach(() => {
    resetHitscanAimCache();
  });

  it('uses mobj angle unchanged when accurate=true', () => {
    const { context, log, rng } = createTestContext();
    setHitscanContext(context);
    const mo = createPlayerMobj();
    mo.angle = ANG90;

    gunShot(mo, true);

    expect(log.lineAttack).toHaveLength(1);
    expect(log.lineAttack[0]!.angle).toBe(ANG90);
    expect(log.lineAttack[0]!.range).toBe(MISSILERANGE);
    expect(rng.prndindex).toBe(1); // one damage roll
  });

  it('spreads angle via pSubRandom<<18 when accurate=false', () => {
    const { context, log } = createTestContext();
    setHitscanContext(context);
    const mo = createPlayerMobj();
    mo.angle = ANG90;

    const expectedRng = new DoomRandom();
    const expectedDamage = 5 * ((expectedRng.pRandom() % 3) + 1);
    const expectedSpread = expectedRng.pSubRandom() << 18;
    const expectedAngle = (ANG90 + expectedSpread) >>> 0;

    gunShot(mo, false);

    expect(log.lineAttack[0]!.damage).toBe(expectedDamage);
    expect(log.lineAttack[0]!.angle).toBe(expectedAngle);
  });

  it('damage is in {5, 10, 15}', () => {
    const { context, log } = createTestContext();
    setHitscanContext(context);
    const mo = createPlayerMobj();
    for (let i = 0; i < 30; i++) {
      gunShot(mo, true);
    }
    for (const call of log.lineAttack) {
      expect([5, 10, 15]).toContain(call.damage);
    }
  });

  it('passes cached bulletslope to lineAttack', () => {
    const { context, log } = createTestContext();
    setHitscanContext(context);
    const mo = createPlayerMobj();
    resetHitscanAimCache();
    // Stage a known bulletslope via bulletSlope() with a forced aim result.
    const { context: ctx2, log: log2 } = createTestContext({
      aimResults: [{ slope: 0x4321, target: targetMobj(100, 0) }],
    });
    setHitscanContext(ctx2);
    bulletSlope(mo);
    expect(getBulletSlope()).toBe(0x4321);

    // Reinstall the gunshot-tracking context and fire (bulletslope is module state).
    setHitscanContext(context);
    gunShot(mo, true);
    expect(log.lineAttack[0]!.slope).toBe(0x4321);
    expect(log2.lineAttack).toHaveLength(0);
  });
});

// ── A_Punch ──────────────────────────────────────────────────────────

describe('aPunch (A_Punch)', () => {
  beforeEach(() => {
    resetHitscanAimCache();
  });

  it('normal path: fires lineAttack with MELEERANGE and subrandom-spread angle', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.FIST);
    player.mo!.angle = ANG90;

    aPunch(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.aimLineAttack).toHaveLength(1);
    expect(log.aimLineAttack[0]!.range).toBe(MELEERANGE);
    expect(log.lineAttack).toHaveLength(1);
    expect(log.lineAttack[0]!.range).toBe(MELEERANGE);
    // Damage in [2, 20] without berserk.
    expect(log.lineAttack[0]!.damage).toBeGreaterThanOrEqual(2);
    expect(log.lineAttack[0]!.damage).toBeLessThanOrEqual(20);
  });

  it('berserker (pw_strength) multiplies damage by 10', () => {
    // Paired trials share an independent RNG seed computed from the same table.
    const baselineRng = new DoomRandom();
    const baselineDamage = ((baselineRng.pRandom() % 10) + 1) << 1;

    const plainCtx = createTestContext({ aimResults: [{ slope: 0, target: null }] });
    setHitscanContext(plainCtx.context);
    const p1 = spawnedPlayer(WeaponType.FIST);
    aPunch(p1, p1.psprites[PsprNum.WEAPON]!);
    const plainDamage = plainCtx.log.lineAttack[0]!.damage;

    const berserkCtx = createTestContext({ aimResults: [{ slope: 0, target: null }] });
    setHitscanContext(berserkCtx.context);
    const p2 = spawnedPlayer(WeaponType.FIST);
    p2.powers[PowerType.STRENGTH] = 1;
    aPunch(p2, p2.psprites[PsprNum.WEAPON]!);
    const berserkDamage = berserkCtx.log.lineAttack[0]!.damage;

    expect(plainDamage).toBe(baselineDamage);
    expect(berserkDamage).toBe(baselineDamage * 10);
  });

  it('on hit: plays sfx_punch and snaps player angle to target', () => {
    const target = targetMobj(100 * FRACUNIT, 100 * FRACUNIT);
    const snapAngle = ANG90;
    const { context, log } = createTestContext({
      aimResults: [{ slope: 100, target }],
      pointToAngle2Result: snapAngle,
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.FIST);

    aPunch(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.startSound).toHaveLength(1);
    expect(log.startSound[0]!.sfxId).toBe(SFX_PUNCH);
    expect(log.pointToAngle2).toHaveLength(1);
    expect(player.mo!.angle).toBe(snapAngle);
  });

  it('on miss: no sfx_punch, angle unchanged', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.FIST);
    const angleBefore = player.mo!.angle;

    aPunch(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.startSound).toHaveLength(0);
    expect(log.pointToAngle2).toHaveLength(0);
    expect(player.mo!.angle).toBe(angleBefore);
  });

  it('RNG order: damage first, then sub-random for angle spread', () => {
    const { context, log, rng } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.FIST);

    const expected = new DoomRandom();
    const expectedDamage = ((expected.pRandom() % 10) + 1) << 1;
    const expectedSpread = expected.pSubRandom() << 18;
    const expectedAngle = (player.mo!.angle + expectedSpread) >>> 0;

    aPunch(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.lineAttack[0]!.damage).toBe(expectedDamage);
    expect(log.lineAttack[0]!.angle).toBe(expectedAngle);
    // 1 damage + 2 subrandom = 3 rolls total.
    expect(rng.prndindex).toBe(3);
  });
});

// ── A_Saw ────────────────────────────────────────────────────────────

describe('aSaw (A_Saw)', () => {
  beforeEach(() => {
    resetHitscanAimCache();
  });

  it('normal path: fires lineAttack with MELEERANGE+1', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINSAW);

    aSaw(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.aimLineAttack[0]!.range).toBe(MELEERANGE + 1);
    expect(log.lineAttack[0]!.range).toBe(MELEERANGE + 1);
  });

  it('damage is in [2, 20] with no berserk multiplier', () => {
    const { context, log } = createTestContext();
    setHitscanContext(context);
    for (let i = 0; i < 40; i++) {
      const player = spawnedPlayer(WeaponType.CHAINSAW);
      player.powers[PowerType.STRENGTH] = 1; // should be ignored
      aSaw(player, player.psprites[PsprNum.WEAPON]!);
    }
    for (const call of log.lineAttack) {
      expect(call.damage).toBeGreaterThanOrEqual(2);
      expect(call.damage).toBeLessThanOrEqual(20);
    }
  });

  it('on miss: plays sfx_sawful, does NOT set MF_JUSTATTACKED, returns early', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINSAW);
    player.mo!.flags = 0;

    aSaw(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.startSound).toHaveLength(1);
    expect(log.startSound[0]!.sfxId).toBe(SFX_SAWFUL);
    expect(player.mo!.flags & MF_JUSTATTACKED).toBe(0);
    expect(log.pointToAngle2).toHaveLength(0);
  });

  it('on hit: plays sfx_sawhit, sets MF_JUSTATTACKED, snaps angle', () => {
    const target = targetMobj(200 * FRACUNIT, 0);
    const { context, log } = createTestContext({
      aimResults: [{ slope: 50, target }],
      pointToAngle2Result: ANG90,
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINSAW);
    player.mo!.flags = 0;
    player.mo!.angle = ANG90;

    aSaw(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.startSound).toHaveLength(1);
    expect(log.startSound[0]!.sfxId).toBe(SFX_SAWHIT);
    expect(player.mo!.flags & MF_JUSTATTACKED).toBe(MF_JUSTATTACKED);
  });

  it('angle snap: small clockwise misalignment rotates by SAW_ANGLE_STEP', () => {
    // Target slightly clockwise (diff just under SAW_ANGLE_STEP in top half).
    const target = targetMobj(FRACUNIT, FRACUNIT);
    const playerAngle: Angle = 0;
    const targetAngle: Angle = (SAW_ANGLE_STEP / 2) | 0; // diff < SAW_ANGLE_STEP, diff <= ANG180
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target }],
      pointToAngle2Result: targetAngle,
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINSAW);
    player.mo!.angle = playerAngle;

    aSaw(player, player.psprites[PsprNum.WEAPON]!);

    // diff = targetAngle - 0 = SAW_ANGLE_STEP/2 < SAW_ANGLE_STEP and <= ANG180
    // → player.angle += SAW_ANGLE_STEP
    expect(player.mo!.angle).toBe((playerAngle + SAW_ANGLE_STEP) >>> 0);
  });

  it('angle snap: large clockwise misalignment uses SAW_ANGLE_SNAP', () => {
    // diff > SAW_ANGLE_STEP but <= ANG180 → snap to targetAngle - SAW_ANGLE_SNAP.
    const target = targetMobj(FRACUNIT, FRACUNIT);
    const playerAngle: Angle = 0;
    const targetAngle: Angle = ANG90;
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target }],
      pointToAngle2Result: targetAngle,
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINSAW);
    player.mo!.angle = playerAngle;

    aSaw(player, player.psprites[PsprNum.WEAPON]!);

    expect(player.mo!.angle).toBe((targetAngle - SAW_ANGLE_SNAP) >>> 0);
  });

  it('angle snap: small counter-clockwise misalignment subtracts SAW_ANGLE_STEP', () => {
    // Target slightly behind (diff > ANG180 and diff >= -SAW_ANGLE_STEP in unsigned).
    const target = targetMobj(-FRACUNIT, 0);
    const playerAngle: Angle = 0;
    const targetAngle: Angle = (0 - ((SAW_ANGLE_STEP / 2) | 0)) >>> 0; // just ccw
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target }],
      pointToAngle2Result: targetAngle,
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINSAW);
    player.mo!.angle = playerAngle;

    aSaw(player, player.psprites[PsprNum.WEAPON]!);

    // diff = targetAngle > ANG180, and diff >= negStep (= 0xFFFF.. - SAW_ANGLE_STEP)
    // → player.angle -= SAW_ANGLE_STEP
    expect(player.mo!.angle).toBe((playerAngle - SAW_ANGLE_STEP) >>> 0);
  });

  it('angle snap: large counter-clockwise misalignment uses SAW_ANGLE_SNAP (+)', () => {
    const target = targetMobj(0, -FRACUNIT);
    const playerAngle: Angle = 0;
    const targetAngle: Angle = (ANG180 + ANG90) >>> 0; // 270° CCW
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target }],
      pointToAngle2Result: targetAngle,
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINSAW);
    player.mo!.angle = playerAngle;

    aSaw(player, player.psprites[PsprNum.WEAPON]!);

    // diff > ANG180 and diff < negStep → snap to targetAngle + SAW_ANGLE_SNAP
    expect(player.mo!.angle).toBe((targetAngle + SAW_ANGLE_SNAP) >>> 0);
  });
});

// ── A_FirePistol ─────────────────────────────────────────────────────

describe('aFirePistol (A_FirePistol)', () => {
  beforeEach(() => {
    resetHitscanAimCache();
  });

  it('plays sfx_pistol, transitions to PLAY_ATK2, decrements clip, fires one shot', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.PISTOL, 50);

    aFirePistol(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.startSound[0]!.sfxId).toBe(SFX_PISTOL);
    expect(player.mo!.state).toBe(STATES[StateNum.PLAY_ATK2]);
    expect(player.ammo[AmmoType.CLIP]).toBe(49);
    expect(log.lineAttack).toHaveLength(1);
    expect(log.lineAttack[0]!.range).toBe(MISSILERANGE);
  });

  it('accurate when refire=0, spread when refire>0', () => {
    const { context: ctxA, log: logA } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(ctxA);
    const accurate = spawnedPlayer(WeaponType.PISTOL, 50);
    accurate.mo!.angle = ANG90;
    accurate.refire = 0;
    aFirePistol(accurate, accurate.psprites[PsprNum.WEAPON]!);
    expect(logA.lineAttack[0]!.angle).toBe(ANG90);

    const { context: ctxB, log: logB } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(ctxB);
    const spread = spawnedPlayer(WeaponType.PISTOL, 50);
    spread.mo!.angle = ANG90;
    spread.refire = 1;
    aFirePistol(spread, spread.psprites[PsprNum.WEAPON]!);
    // With spread, angle should differ from exact facing (unless the spread rolls
    // happen to be equal — very unlikely with this seed).
    expect(logB.lineAttack[0]!.angle).not.toBe(ANG90);
  });

  it('advances flash psprite to pistol flashstate', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.PISTOL, 50);

    aFirePistol(player, player.psprites[PsprNum.WEAPON]!);

    expect(player.psprites[PsprNum.FLASH]!.state).toBe(STATES[WEAPON_INFO[WeaponType.PISTOL]!.flashstate]);
  });
});

// ── A_FireShotgun ────────────────────────────────────────────────────

describe('aFireShotgun (A_FireShotgun)', () => {
  beforeEach(() => {
    resetHitscanAimCache();
  });

  it('fires exactly 7 pellets, all with accurate=false', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.SHOTGUN, 10);
    player.mo!.angle = ANG90;

    aFireShotgun(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.lineAttack).toHaveLength(7);
    // Each pellet should have at least one angle != ANG90 (spread).
    const spreadCount = log.lineAttack.filter((c) => c.angle !== ANG90).length;
    expect(spreadCount).toBeGreaterThan(0);
  });

  it('plays sfx_shotgn and decrements shells by 1', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.SHOTGUN, 10);

    aFireShotgun(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.startSound[0]!.sfxId).toBe(SFX_SHOTGN);
    expect(player.ammo[AmmoType.SHELL]).toBe(9);
  });

  it('all 7 pellets share the same cached bulletslope', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0xabcd, target: targetMobj(100, 0) }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.SHOTGUN, 10);

    aFireShotgun(player, player.psprites[PsprNum.WEAPON]!);

    for (const pellet of log.lineAttack) {
      expect(pellet.slope).toBe(0xabcd);
    }
  });
});

// ── A_FireShotgun2 ───────────────────────────────────────────────────

describe('aFireShotgun2 (A_FireShotgun2)', () => {
  beforeEach(() => {
    resetHitscanAimCache();
  });

  it('fires exactly 20 pellets', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.SUPERSHOTGUN, 10);

    aFireShotgun2(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.lineAttack).toHaveLength(20);
  });

  it('plays sfx_dshtgn and decrements shells by 2', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.SUPERSHOTGUN, 10);

    aFireShotgun2(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.startSound[0]!.sfxId).toBe(SFX_DSHTGN);
    expect(player.ammo[AmmoType.SHELL]).toBe(8);
  });

  it('RNG consumption: 3 rolls per pellet (damage + angle sub + slope sub) after aim', () => {
    const { context, rng } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.SUPERSHOTGUN, 10);
    aFireShotgun2(player, player.psprites[PsprNum.WEAPON]!);

    // 20 pellets * (1 damage + 2 angle + 2 slope) = 100 pRandom calls.
    // prndindex wraps mod 256.
    expect(rng.prndindex).toBe(100 & 0xff);
  });

  it('per-pellet slope jitter uses shift 5, angle uses shift 19', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0x4242, target: targetMobj(100, 0) }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.SUPERSHOTGUN, 10);
    player.mo!.angle = ANG90;

    aFireShotgun2(player, player.psprites[PsprNum.WEAPON]!);

    // Reproduce the expected first pellet using a sibling RNG.
    const seedRng = new DoomRandom();
    const damage0 = 5 * ((seedRng.pRandom() % 3) + 1);
    const angle0 = (ANG90 + (seedRng.pSubRandom() << 19)) >>> 0;
    const slope0 = (0x4242 + (seedRng.pSubRandom() << 5)) | 0;

    expect(log.lineAttack[0]!.damage).toBe(damage0);
    expect(log.lineAttack[0]!.angle).toBe(angle0);
    expect(log.lineAttack[0]!.slope).toBe(slope0);
  });
});

// ── A_FireCGun ───────────────────────────────────────────────────────

describe('aFireCGun (A_FireCGun)', () => {
  beforeEach(() => {
    resetHitscanAimCache();
  });

  it('fires one bullet and decrements one clip', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINGUN, 20);

    aFireCGun(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.lineAttack).toHaveLength(1);
    expect(player.ammo[AmmoType.CLIP]).toBe(19);
  });

  it('plays sfx_pistol BEFORE ammo check (fires sound even at 0 ammo)', () => {
    const { context, log } = createTestContext();
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINGUN, 0);
    const stateBefore = player.mo!.state;

    aFireCGun(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.startSound).toHaveLength(1);
    expect(log.startSound[0]!.sfxId).toBe(SFX_PISTOL);
    // No shot fired, no state transition.
    expect(log.lineAttack).toHaveLength(0);
    expect(player.mo!.state).toBe(stateBefore);
  });

  it('CHAIN1 state → flashstate + 0 (first flash frame)', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINGUN, 20);
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.state = STATES[StateNum.CHAIN1]!;

    aFireCGun(player, psp);

    expect(player.psprites[PsprNum.FLASH]!.state).toBe(STATES[WEAPON_INFO[WeaponType.CHAINGUN]!.flashstate]);
  });

  it('CHAIN2 state → flashstate + 1 (second flash frame)', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINGUN, 20);
    const psp = player.psprites[PsprNum.WEAPON]!;
    psp.state = STATES[StateNum.CHAIN2]!;

    aFireCGun(player, psp);

    expect(player.psprites[PsprNum.FLASH]!.state).toBe(STATES[WEAPON_INFO[WeaponType.CHAINGUN]!.flashstate + 1]);
  });

  it('transitions player mobj to PLAY_ATK2 when ammo>0', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINGUN, 20);

    aFireCGun(player, player.psprites[PsprNum.WEAPON]!);

    expect(player.mo!.state).toBe(STATES[StateNum.PLAY_ATK2]);
  });
});

// ── Parity-sensitive edge cases ─────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  beforeEach(() => {
    resetHitscanAimCache();
  });

  it('A_Punch uses MELEERANGE (not MELEERANGE+1)', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.FIST);
    aPunch(player, player.psprites[PsprNum.WEAPON]!);
    expect(log.aimLineAttack[0]!.range).toBe(MELEERANGE);
    expect(log.lineAttack[0]!.range).toBe(MELEERANGE);
  });

  it('A_Saw uses MELEERANGE+1 (edge-inclusive boundary)', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINSAW);
    aSaw(player, player.psprites[PsprNum.WEAPON]!);
    expect(log.aimLineAttack[0]!.range).toBe(MELEERANGE + 1);
    expect(log.lineAttack[0]!.range).toBe(MELEERANGE + 1);
  });

  it('A_FireShotgun2 uses <<19 for angle spread (vs <<18 for shotgun)', () => {
    // The first P_Random call is damage; the second is angle spread.
    // Angle should shift by (subrandom << 19) not << 18.
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.SUPERSHOTGUN, 10);
    player.mo!.angle = 0;
    aFireShotgun2(player, player.psprites[PsprNum.WEAPON]!);

    const seed = new DoomRandom();
    seed.pRandom(); // consume damage roll for pellet 0
    const angle0 = seed.pSubRandom() << 19;
    expect(log.lineAttack[0]!.angle).toBe(angle0 >>> 0);
  });

  it('A_FireCGun early-returns before ammo decrement when clip=0', () => {
    const { context } = createTestContext();
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINGUN, 0);
    aFireCGun(player, player.psprites[PsprNum.WEAPON]!);
    // Ammo stays at 0 (would be -1 if decrement ran).
    expect(player.ammo[AmmoType.CLIP]).toBe(0);
  });

  it('bulletSlope cascade: all three aim attempts use BULLET_AIM_RANGE', () => {
    const { context, log } = createTestContext({
      aimResults: [
        { slope: 0, target: null },
        { slope: 0, target: null },
        { slope: 0, target: null },
      ],
    });
    setHitscanContext(context);
    const mo = createPlayerMobj();
    bulletSlope(mo);
    for (const call of log.aimLineAttack) {
      expect(call.range).toBe(BULLET_AIM_RANGE);
    }
  });

  it('A_Punch does NOT transition player mobj state (stays in current)', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.FIST);
    const stateBefore = player.mo!.state;
    aPunch(player, player.psprites[PsprNum.WEAPON]!);
    expect(player.mo!.state).toBe(stateBefore);
  });

  it('A_Saw does NOT transition player mobj state (stays in current)', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: null }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.CHAINSAW);
    const stateBefore = player.mo!.state;
    aSaw(player, player.psprites[PsprNum.WEAPON]!);
    expect(player.mo!.state).toBe(stateBefore);
  });

  it('A_FireShotgun2 does NOT call P_GunShot (independent per-pellet RNG)', () => {
    // P_GunShot would consume 1 damage + 2 spread rolls per pellet = 3 pRandoms.
    // A_FireShotgun2 consumes the same 3 per pellet but with different shifts.
    // We can't distinguish by RNG count alone — this test just confirms 20 pellets
    // each with their own slope (proving the per-pellet slope branch ran).
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0x1000, target: targetMobj(0, 100) }],
    });
    setHitscanContext(context);
    const player = spawnedPlayer(WeaponType.SUPERSHOTGUN, 10);
    aFireShotgun2(player, player.psprites[PsprNum.WEAPON]!);

    const distinctSlopes = new Set(log.lineAttack.map((c) => c.slope));
    // Overwhelmingly likely >1 distinct slope across 20 pellets.
    expect(distinctSlopes.size).toBeGreaterThan(1);
  });
});
