import { describe, expect, it, afterAll, beforeAll } from 'bun:test';

import type { Angle } from '../../src/core/angle.ts';
import type { Fixed } from '../../src/core/fixed.ts';
import type { Player, PspriteActionFunction } from '../../src/player/playerSpawn.ts';
import type { ProjectileAimResult, ProjectileContext } from '../../src/player/projectiles.ts';

import { ANG90 } from '../../src/core/angle.ts';
import { fixedMul, FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom } from '../../src/core/rng.ts';
import { ANGLETOFINESHIFT, finecosine, finesine } from '../../src/core/trig.ts';
import { EMPTY_TICCMD } from '../../src/input/ticcmd.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';
import { MF_MISSILE, MOBJINFO, Mobj, MobjType, STATES, StateNum, spawnMobj } from '../../src/world/mobj.ts';
import { AmmoType, PsprNum, WEAPON_INFO, WP_NOCHANGE, WeaponType, createPlayer, playerReborn, pspriteActions, setPsprite } from '../../src/player/playerSpawn.ts';
import { BFG_CELLS_PER_SHOT } from '../../src/player/weapons.ts';

import {
  BFG_SPRAY_DAMAGE_MASK,
  BFG_SPRAY_DAMAGE_ROLLS,
  BFG_SPRAY_HALF_ARC,
  BFG_SPRAY_RAY_COUNT,
  BFG_SPRAY_RAY_STEP,
  EXTRABFG_Z_SHIFT,
  MISSILE_SPAWN_Z_OFFSET,
  MISSILE_TIC_JITTER_MASK,
  PLASMA_FLASH_JITTER_MASK,
  PROJECTILE_ACTION_COUNT,
  PROJECTILE_AIM_NUDGE,
  PROJECTILE_AIM_RANGE,
  aBFGSpray,
  aFireBFG,
  aFireMissile,
  aFirePlasma,
  checkMissileSpawn,
  explodeMissile,
  getProjectileContext,
  setProjectileContext,
  spawnPlayerMissile,
  wireProjectileActions,
} from '../../src/player/projectiles.ts';

// ── Helpers ──────────────────────────────────────────────────────────

interface AimCall {
  shooter: Mobj;
  angle: Angle;
  range: Fixed;
}

interface SpawnCall {
  x: Fixed;
  y: Fixed;
  z: Fixed;
  type: MobjType;
}

interface TryMoveCall {
  mobj: Mobj;
  x: Fixed;
  y: Fixed;
}

interface DamageCall {
  target: Mobj;
  inflictor: Mobj | null;
  source: Mobj | null;
  damage: number;
}

interface StartSoundCall {
  origin: Mobj | null;
  sfxId: number;
}

interface CallLog {
  aim: AimCall[];
  spawn: SpawnCall[];
  tryMove: TryMoveCall[];
  damage: DamageCall[];
  startSound: StartSoundCall[];
}

interface TestContextOptions {
  aimResults?: ProjectileAimResult[];
  tryMoveResults?: boolean[];
  /** When provided, returned missiles use the listed MobjType. */
  spawnType?: MobjType;
}

function createPlayerMobj(): Mobj {
  const mobj = new Mobj();
  mobj.state = STATES[StateNum.PLAY]!;
  mobj.x = 100 * FRACUNIT;
  mobj.y = 200 * FRACUNIT;
  mobj.z = 50 * FRACUNIT;
  mobj.angle = 0;
  mobj.flags = 0;
  return mobj;
}

function targetMobj(x: Fixed, y: Fixed, z: Fixed = 0, height: Fixed = 56 * FRACUNIT): Mobj {
  const mobj = new Mobj();
  mobj.x = x;
  mobj.y = y;
  mobj.z = z;
  mobj.height = height;
  return mobj;
}

function createMissileMobj(type: MobjType = MobjType.ROCKET, thinkerList?: ThinkerList): Mobj {
  const list = thinkerList ?? new ThinkerList();
  list.init();
  const rng = new DoomRandom();
  return spawnMobj(0, 0, 0, type, rng, list);
}

function createTestContext(opts?: TestContextOptions): {
  context: ProjectileContext;
  log: CallLog;
  rng: DoomRandom;
  thinkerList: ThinkerList;
} {
  const log: CallLog = {
    aim: [],
    spawn: [],
    tryMove: [],
    damage: [],
    startSound: [],
  };
  const aimQueue: ProjectileAimResult[] = opts?.aimResults?.slice() ?? [];
  const tryMoveQueue: boolean[] = opts?.tryMoveResults?.slice() ?? [];
  const rng = new DoomRandom();
  const thinkerList = new ThinkerList();
  thinkerList.init();

  const context: ProjectileContext = {
    rng,
    thinkerList,
    aimLineAttack: (shooter, angle, range) => {
      log.aim.push({ shooter, angle, range });
      return aimQueue.shift() ?? { slope: 0, target: null };
    },
    spawnMobj: (x, y, z, type) => {
      log.spawn.push({ x, y, z, type });
      const mobj = new Mobj();
      mobj.x = x;
      mobj.y = y;
      mobj.z = z;
      mobj.type = type;
      mobj.info = MOBJINFO[type]!;
      mobj.flags = mobj.info.flags;
      mobj.height = mobj.info.height;
      mobj.radius = mobj.info.radius;
      mobj.tics = STATES[mobj.info.spawnstate]!.tics;
      mobj.state = STATES[mobj.info.spawnstate]!;
      return mobj;
    },
    tryMove: (mobj, x, y) => {
      log.tryMove.push({ mobj, x, y });
      // Default to true if the queue is exhausted.
      return tryMoveQueue.length > 0 ? tryMoveQueue.shift()! : true;
    },
    damageMobj: (target, inflictor, source, damage) => {
      log.damage.push({ target, inflictor, source, damage });
    },
    startSound: (origin, sfxId) => {
      log.startSound.push({ origin, sfxId });
    },
  };
  return { context, log, rng, thinkerList };
}

function spawnedPlayer(weapon: number, ammoCount: number): Player {
  const player = createPlayer();
  playerReborn(player);
  player.readyweapon = weapon;
  player.pendingweapon = WP_NOCHANGE;
  player.weaponowned[weapon] = true;
  const ammoType = WEAPON_INFO[weapon]!.ammo;
  if (ammoType !== 4) {
    player.ammo[ammoType] = ammoCount;
  }
  player.mo = createPlayerMobj();
  player.cmd = { ...EMPTY_TICCMD, buttons: 0 };
  setPsprite(player, PsprNum.WEAPON, WEAPON_INFO[weapon]!.readystate);
  return player;
}

// ── Constants ────────────────────────────────────────────────────────

describe('projectile constants', () => {
  it('PROJECTILE_AIM_RANGE equals 16*64*FRACUNIT', () => {
    expect(PROJECTILE_AIM_RANGE).toBe(16 * 64 * FRACUNIT);
    expect(PROJECTILE_AIM_RANGE).toBe(0x400_0000);
  });

  it('PROJECTILE_AIM_NUDGE equals 1<<26', () => {
    expect(PROJECTILE_AIM_NUDGE).toBe(1 << 26);
  });

  it('MISSILE_SPAWN_Z_OFFSET equals 32*FRACUNIT (4*8*FRACUNIT)', () => {
    expect(MISSILE_SPAWN_Z_OFFSET).toBe(32 * FRACUNIT);
    expect(MISSILE_SPAWN_Z_OFFSET).toBe(4 * 8 * FRACUNIT);
  });

  it('BFG_SPRAY_RAY_COUNT equals 40', () => {
    expect(BFG_SPRAY_RAY_COUNT).toBe(40);
  });

  it('BFG_SPRAY_HALF_ARC equals ANG90/2', () => {
    expect(BFG_SPRAY_HALF_ARC).toBe((ANG90 / 2) | 0);
  });

  it('BFG_SPRAY_RAY_STEP equals ANG90/40', () => {
    expect(BFG_SPRAY_RAY_STEP).toBe((ANG90 / 40) | 0);
  });

  it('full sweep of 40 steps covers ANG90 minus int-truncation remainder', () => {
    // ANG90 / 40 = 26843545.6, truncates to 26843545 in C integer division.
    // 40 * 26843545 = 1073741800, which is ANG90 (1073741824) - 24.
    // Vanilla relies on this exact truncation — the rightmost ray falls
    // just short of `mo.angle + ANG90/2` by (ANG90 mod 40).
    const truncationRemainder = ANG90 - BFG_SPRAY_RAY_STEP * BFG_SPRAY_RAY_COUNT;
    expect(truncationRemainder).toBe(ANG90 % 40);
  });

  it('BFG_SPRAY_DAMAGE_ROLLS equals 15 and BFG_SPRAY_DAMAGE_MASK equals 7', () => {
    expect(BFG_SPRAY_DAMAGE_ROLLS).toBe(15);
    expect(BFG_SPRAY_DAMAGE_MASK).toBe(7);
  });

  it('damage range is [15, 120] per struck target', () => {
    // Each roll is (P_Random() & 7) + 1 ∈ [1, 8]; 15 rolls → [15, 120].
    const minDamage = 1 * BFG_SPRAY_DAMAGE_ROLLS;
    const maxDamage = (BFG_SPRAY_DAMAGE_MASK + 1) * BFG_SPRAY_DAMAGE_ROLLS;
    expect(minDamage).toBe(15);
    expect(maxDamage).toBe(120);
  });

  it('EXTRABFG_Z_SHIFT equals 2 (target.height >> 2 spawn offset)', () => {
    expect(EXTRABFG_Z_SHIFT).toBe(2);
  });

  it('MISSILE_TIC_JITTER_MASK equals 3 and PLASMA_FLASH_JITTER_MASK equals 1', () => {
    expect(MISSILE_TIC_JITTER_MASK).toBe(3);
    expect(PLASMA_FLASH_JITTER_MASK).toBe(1);
  });

  it('MISSILE_TIC_JITTER_MASK yields a [0,3] jitter (inclusive)', () => {
    expect(0 & MISSILE_TIC_JITTER_MASK).toBe(0);
    expect(255 & MISSILE_TIC_JITTER_MASK).toBe(3);
  });
});

// ── wireProjectileActions ────────────────────────────────────────────

describe('wireProjectileActions', () => {
  const wiredStates: StateNum[] = [StateNum.MISSILE2, StateNum.PLASMA1, StateNum.BFG3];
  const backupPspr: (PspriteActionFunction | undefined)[] = [];
  const backupMobjAction = STATES[StateNum.BFGLAND5]!.action;

  beforeAll(() => {
    for (const stateNum of wiredStates) backupPspr.push(pspriteActions[stateNum]);
    wireProjectileActions();
  });

  afterAll(() => {
    for (let index = 0; index < wiredStates.length; index++) {
      pspriteActions[wiredStates[index]!] = backupPspr[index];
    }
    STATES[StateNum.BFGLAND5]!.action = backupMobjAction;
  });

  it('PROJECTILE_ACTION_COUNT equals 4', () => {
    expect(PROJECTILE_ACTION_COUNT).toBe(4);
  });

  it('wires A_FireMissile to MISSILE2', () => {
    expect(pspriteActions[StateNum.MISSILE2]).toBe(aFireMissile);
  });

  it('wires A_FirePlasma to PLASMA1', () => {
    expect(pspriteActions[StateNum.PLASMA1]).toBe(aFirePlasma);
  });

  it('wires A_FireBFG to BFG3', () => {
    expect(pspriteActions[StateNum.BFG3]).toBe(aFireBFG);
  });

  it('wires A_BFGSpray to BFGLAND5 mobj state (not a psprite state)', () => {
    expect(STATES[StateNum.BFGLAND5]!.action).toBe(aBFGSpray);
  });
});

// ── Context management ─────────────────────────────────────────────

describe('context management', () => {
  it('setProjectileContext stores and getProjectileContext retrieves', () => {
    const { context } = createTestContext();
    setProjectileContext(context);
    expect(getProjectileContext()).toBe(context);
  });

  it('actions return early when context is null (no crash)', () => {
    setProjectileContext(null as unknown as ProjectileContext);
    const player = spawnedPlayer(WeaponType.MISSILE, 10);
    const psp = player.psprites[PsprNum.WEAPON]!;
    expect(() => aFireMissile(player, psp)).not.toThrow();
    expect(() => aFirePlasma(player, psp)).not.toThrow();
    expect(() => aFireBFG(player, psp)).not.toThrow();
    expect(() => aBFGSpray(createPlayerMobj())).not.toThrow();
    expect(() => explodeMissile(createMissileMobj())).not.toThrow();
    expect(() => checkMissileSpawn(createMissileMobj())).not.toThrow();
  });
});

// ── P_ExplodeMissile ─────────────────────────────────────────────────

describe('explodeMissile (P_ExplodeMissile)', () => {
  it('zeros momx/momy/momz', () => {
    const { context, thinkerList } = createTestContext();
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);
    rocket.momx = 100;
    rocket.momy = 200;
    rocket.momz = 300;

    explodeMissile(rocket);

    expect(rocket.momx).toBe(0);
    expect(rocket.momy).toBe(0);
    expect(rocket.momz).toBe(0);
  });

  it('transitions the missile to its info.deathstate', () => {
    const { context, thinkerList } = createTestContext();
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);

    explodeMissile(rocket);

    const expectedDeathstate = MOBJINFO[MobjType.ROCKET]!.deathstate;
    expect(rocket.state).toBe(STATES[expectedDeathstate]!);
  });

  it('clears MF_MISSILE flag', () => {
    const { context, thinkerList } = createTestContext();
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);
    expect(rocket.flags & MF_MISSILE).toBe(MF_MISSILE); // precondition

    explodeMissile(rocket);

    expect(rocket.flags & MF_MISSILE).toBe(0);
  });

  it('consumes exactly one P_Random for tic jitter', () => {
    const { context, thinkerList, rng } = createTestContext();
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);

    const before = rng.prndindex;
    explodeMissile(rocket);
    expect((rng.prndindex - before) & 0xff).toBe(1);
  });

  it('clamps tics to >= 1 after jitter', () => {
    const { context, thinkerList } = createTestContext();
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);
    // Deathstate tics may be short; even if jitter drops below 1,
    // the clamp guarantees the mobj doesn't skip straight to nextstate.
    explodeMissile(rocket);
    expect(rocket.tics).toBeGreaterThanOrEqual(1);
  });

  it('plays info.deathsound on the missile when non-zero', () => {
    const { context, log, thinkerList } = createTestContext();
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);

    explodeMissile(rocket);

    const deathsound = MOBJINFO[MobjType.ROCKET]!.deathsound;
    expect(log.startSound).toHaveLength(1);
    expect(log.startSound[0]!.sfxId).toBe(deathsound);
    expect(log.startSound[0]!.origin).toBe(rocket);
  });

  it('does NOT play deathsound when info.deathsound == 0 (e.g. EXTRABFG)', () => {
    const { context, log, thinkerList } = createTestContext();
    setProjectileContext(context);
    const extrabfg = createMissileMobj(MobjType.EXTRABFG, thinkerList);

    explodeMissile(extrabfg);

    expect(log.startSound).toHaveLength(0);
  });
});

// ── P_CheckMissileSpawn ─────────────────────────────────────────────

describe('checkMissileSpawn (P_CheckMissileSpawn)', () => {
  it('advances position by half-momentum', () => {
    const { context, thinkerList } = createTestContext({ tryMoveResults: [true] });
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);
    rocket.x = 100;
    rocket.y = 200;
    rocket.z = 300;
    rocket.momx = 10;
    rocket.momy = 20;
    rocket.momz = 30;

    checkMissileSpawn(rocket);

    expect(rocket.x).toBe(100 + (10 >> 1));
    expect(rocket.y).toBe(200 + (20 >> 1));
    expect(rocket.z).toBe(300 + (30 >> 1));
  });

  it('calls tryMove at the advanced position', () => {
    const { context, log, thinkerList } = createTestContext({ tryMoveResults: [true] });
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);
    rocket.x = 0;
    rocket.y = 0;
    rocket.momx = 200;
    rocket.momy = 400;

    checkMissileSpawn(rocket);

    expect(log.tryMove).toHaveLength(1);
    expect(log.tryMove[0]!.x).toBe(100);
    expect(log.tryMove[0]!.y).toBe(200);
  });

  it('explodes the missile when tryMove returns false', () => {
    const { context, thinkerList } = createTestContext({ tryMoveResults: [false] });
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);
    rocket.momx = 50;
    rocket.momy = 75;

    checkMissileSpawn(rocket);

    expect(rocket.flags & MF_MISSILE).toBe(0);
    expect(rocket.momx).toBe(0);
    expect(rocket.momy).toBe(0);
  });

  it('does NOT explode when tryMove succeeds', () => {
    const { context, thinkerList } = createTestContext({ tryMoveResults: [true] });
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);

    checkMissileSpawn(rocket);

    expect(rocket.flags & MF_MISSILE).toBe(MF_MISSILE);
  });

  it('consumes exactly one P_Random for tic jitter (not two)', () => {
    const { context, rng, thinkerList } = createTestContext({ tryMoveResults: [true] });
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);

    const before = rng.prndindex;
    checkMissileSpawn(rocket);
    expect((rng.prndindex - before) & 0xff).toBe(1);
  });

  it('tic clamp: tics stays >= 1 even when initial is small and jitter is 3', () => {
    const { context, thinkerList } = createTestContext({ tryMoveResults: [true] });
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);
    rocket.tics = 1;

    checkMissileSpawn(rocket);

    expect(rocket.tics).toBeGreaterThanOrEqual(1);
  });
});

// ── P_SpawnPlayerMissile ────────────────────────────────────────────

describe('spawnPlayerMissile (P_SpawnPlayerMissile)', () => {
  it('spawns missile at source.xy with z + MISSILE_SPAWN_Z_OFFSET', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();
    source.x = 5 * FRACUNIT;
    source.y = 7 * FRACUNIT;
    source.z = 11 * FRACUNIT;

    spawnPlayerMissile(source, MobjType.ROCKET);

    expect(log.spawn).toHaveLength(1);
    expect(log.spawn[0]!.x).toBe(source.x);
    expect(log.spawn[0]!.y).toBe(source.y);
    expect(log.spawn[0]!.z).toBe((source.z + MISSILE_SPAWN_Z_OFFSET) | 0);
    expect(log.spawn[0]!.type).toBe(MobjType.ROCKET);
  });

  it('first-aim hit: no cascade, single aimLineAttack call', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 1234, target: targetMobj(100, 0) }],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();
    source.angle = ANG90;

    spawnPlayerMissile(source, MobjType.ROCKET);

    expect(log.aim).toHaveLength(1);
    expect(log.aim[0]!.angle).toBe(ANG90);
    expect(log.aim[0]!.range).toBe(PROJECTILE_AIM_RANGE);
  });

  it('first-aim miss → tries +nudge and uses its target', () => {
    const { context, log } = createTestContext({
      aimResults: [
        { slope: 0, target: null },
        { slope: 7777, target: targetMobj(0, 100) },
      ],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();
    source.angle = 0;

    spawnPlayerMissile(source, MobjType.ROCKET);

    expect(log.aim).toHaveLength(2);
    expect(log.aim[0]!.angle).toBe(0);
    expect(log.aim[1]!.angle).toBe(PROJECTILE_AIM_NUDGE);
  });

  it('first and +nudge miss → tries -nudge', () => {
    const { context, log } = createTestContext({
      aimResults: [
        { slope: 0, target: null },
        { slope: 0, target: null },
        { slope: 999, target: targetMobj(0, 100) },
      ],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();
    source.angle = 0x1000_0000;

    spawnPlayerMissile(source, MobjType.ROCKET);

    expect(log.aim).toHaveLength(3);
    expect(log.aim[0]!.angle).toBe(0x1000_0000);
    expect(log.aim[1]!.angle).toBe((0x1000_0000 + PROJECTILE_AIM_NUDGE) >>> 0);
    expect(log.aim[2]!.angle).toBe((0x1000_0000 + PROJECTILE_AIM_NUDGE - 2 * PROJECTILE_AIM_NUDGE) >>> 0);
  });

  it('all three aims miss → angle resets to source.angle and slope is 0', () => {
    const { context, log } = createTestContext({
      aimResults: [
        { slope: 1, target: null },
        { slope: 2, target: null },
        { slope: 3, target: null },
      ],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();
    source.angle = ANG90;

    const missile = spawnPlayerMissile(source, MobjType.ROCKET);

    expect(log.aim).toHaveLength(3);
    // Final angle/slope: angle reset to source.angle, slope = 0.
    expect(missile.angle).toBe(ANG90);
    // momz comes from fixedMul(speed, 0) = 0.
    expect(missile.momz).toBe(0);
  });

  it('plays info.seesound on the missile when non-zero', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();

    spawnPlayerMissile(source, MobjType.ROCKET);

    const seesound = MOBJINFO[MobjType.ROCKET]!.seesound;
    expect(seesound).toBeGreaterThan(0);
    expect(log.startSound).toHaveLength(1);
    expect(log.startSound[0]!.sfxId).toBe(seesound);
  });

  it('does NOT play seesound for BFG (info.seesound == 0)', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();

    spawnPlayerMissile(source, MobjType.BFG);

    expect(MOBJINFO[MobjType.BFG]!.seesound).toBe(0);
    expect(log.startSound).toHaveLength(0);
  });

  it('missile.target is set to the shooter', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();

    const missile = spawnPlayerMissile(source, MobjType.ROCKET);

    expect(missile.target).toBe(source);
  });

  it('missile.angle is set to the locked-on autoaim angle', () => {
    const { context } = createTestContext({
      aimResults: [
        { slope: 0, target: null },
        { slope: 0, target: targetMobj(0, 100) },
      ],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();
    source.angle = 0;

    const missile = spawnPlayerMissile(source, MobjType.ROCKET);

    expect(missile.angle).toBe(PROJECTILE_AIM_NUDGE);
  });

  it('momx/momy come from speed * finecosine/finesine[angle>>19]', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();
    source.angle = ANG90;

    const missile = spawnPlayerMissile(source, MobjType.ROCKET);

    const speed = MOBJINFO[MobjType.ROCKET]!.speed;
    const fineIndex = ANG90 >>> ANGLETOFINESHIFT;
    expect(missile.momx).toBe(fixedMul(speed, finecosine[fineIndex]!));
    expect(missile.momy).toBe(fixedMul(speed, finesine[fineIndex]!));
  });

  it('momz = speed * slope', () => {
    const slope = 0x8000; // 0.5 in fixed-point
    const { context } = createTestContext({
      aimResults: [{ slope, target: targetMobj(100, 0) }],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();

    const missile = spawnPlayerMissile(source, MobjType.ROCKET);

    const speed = MOBJINFO[MobjType.ROCKET]!.speed;
    expect(missile.momz).toBe(fixedMul(speed, slope));
  });

  it('calls checkMissileSpawn after launch (tryMove observed)', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();

    spawnPlayerMissile(source, MobjType.ROCKET);

    // checkMissileSpawn always invokes tryMove at the half-advanced position.
    expect(log.tryMove).toHaveLength(1);
  });
});

// ── A_FireMissile ───────────────────────────────────────────────────

describe('aFireMissile (A_FireMissile)', () => {
  it('decrements MISL ammo by 1', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const player = spawnedPlayer(WeaponType.MISSILE, 10);

    aFireMissile(player, player.psprites[PsprNum.WEAPON]!);

    expect(player.ammo[AmmoType.MISL]).toBe(9);
  });

  it('spawns a MT_ROCKET with the player as source', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const player = spawnedPlayer(WeaponType.MISSILE, 10);

    aFireMissile(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.spawn).toHaveLength(1);
    expect(log.spawn[0]!.type).toBe(MobjType.ROCKET);
  });
});

// ── A_FirePlasma ────────────────────────────────────────────────────

describe('aFirePlasma (A_FirePlasma)', () => {
  it('decrements CELL ammo by 1', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const player = spawnedPlayer(WeaponType.PLASMA, 100);

    aFirePlasma(player, player.psprites[PsprNum.WEAPON]!);

    expect(player.ammo[AmmoType.CELL]).toBe(99);
  });

  it('advances flash psprite to flashstate + (P_Random() & 1)', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const player = spawnedPlayer(WeaponType.PLASMA, 100);

    // Derive expected flash offset: the first pRandom of the action.
    const expected = new DoomRandom();
    const flashOffset = expected.pRandom() & PLASMA_FLASH_JITTER_MASK;
    const flashstate = WEAPON_INFO[WeaponType.PLASMA]!.flashstate;

    aFirePlasma(player, player.psprites[PsprNum.WEAPON]!);

    expect(player.psprites[PsprNum.FLASH]!.state).toBe(STATES[flashstate + flashOffset]!);
  });

  it('RNG order: flash jitter BEFORE autoaim cascade', () => {
    const { context, log, rng } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const player = spawnedPlayer(WeaponType.PLASMA, 100);

    const before = rng.prndindex;
    aFirePlasma(player, player.psprites[PsprNum.WEAPON]!);

    // One pRandom for flash + one for checkMissileSpawn tic jitter = 2.
    expect((rng.prndindex - before) & 0xff).toBe(2);
    expect(log.aim).toHaveLength(1); // first aim hit
  });

  it('spawns a MT_PLASMA', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const player = spawnedPlayer(WeaponType.PLASMA, 100);

    aFirePlasma(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.spawn[0]!.type).toBe(MobjType.PLASMA);
  });
});

// ── A_FireBFG ───────────────────────────────────────────────────────

describe('aFireBFG (A_FireBFG)', () => {
  it('decrements CELL ammo by BFG_CELLS_PER_SHOT (40)', () => {
    const { context } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const player = spawnedPlayer(WeaponType.BFG, 100);

    aFireBFG(player, player.psprites[PsprNum.WEAPON]!);

    expect(BFG_CELLS_PER_SHOT).toBe(40);
    expect(player.ammo[AmmoType.CELL]).toBe(60);
  });

  it('spawns a MT_BFG', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const player = spawnedPlayer(WeaponType.BFG, 100);

    aFireBFG(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.spawn[0]!.type).toBe(MobjType.BFG);
  });

  it('no seesound is played on BFG spawn (info.seesound == 0)', () => {
    const { context, log } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const player = spawnedPlayer(WeaponType.BFG, 100);

    aFireBFG(player, player.psprites[PsprNum.WEAPON]!);

    expect(log.startSound).toHaveLength(0);
  });
});

// ── A_BFGSpray ──────────────────────────────────────────────────────

describe('aBFGSpray (A_BFGSpray)', () => {
  function setupBFGProjectile(): { bfg: Mobj; shooter: Mobj } {
    const shooter = createPlayerMobj();
    const bfg = new Mobj();
    bfg.angle = 0;
    bfg.x = 500 * FRACUNIT;
    bfg.y = 500 * FRACUNIT;
    bfg.target = shooter; // player who fired the BFG
    return { bfg, shooter };
  }

  it('casts exactly BFG_SPRAY_RAY_COUNT (40) rays', () => {
    const missedResults: ProjectileAimResult[] = [];
    for (let i = 0; i < BFG_SPRAY_RAY_COUNT; i++) {
      missedResults.push({ slope: 0, target: null });
    }
    const { context, log } = createTestContext({ aimResults: missedResults });
    setProjectileContext(context);
    const { bfg } = setupBFGProjectile();

    aBFGSpray(bfg);

    expect(log.aim).toHaveLength(BFG_SPRAY_RAY_COUNT);
  });

  it('ray angles span [mo.angle - ANG90/2, mo.angle + ANG90/2)', () => {
    const missedResults: ProjectileAimResult[] = [];
    for (let i = 0; i < BFG_SPRAY_RAY_COUNT; i++) {
      missedResults.push({ slope: 0, target: null });
    }
    const { context, log } = createTestContext({ aimResults: missedResults });
    setProjectileContext(context);
    const { bfg } = setupBFGProjectile();
    bfg.angle = ANG90;

    aBFGSpray(bfg);

    for (let i = 0; i < BFG_SPRAY_RAY_COUNT; i++) {
      const expectedAngle = (ANG90 - BFG_SPRAY_HALF_ARC + BFG_SPRAY_RAY_STEP * i) >>> 0;
      expect(log.aim[i]!.angle).toBe(expectedAngle);
    }
  });

  it('passes mo.target (player) as the aim shooter, not mo itself', () => {
    const missedResults: ProjectileAimResult[] = [];
    for (let i = 0; i < BFG_SPRAY_RAY_COUNT; i++) {
      missedResults.push({ slope: 0, target: null });
    }
    const { context, log } = createTestContext({ aimResults: missedResults });
    setProjectileContext(context);
    const { bfg, shooter } = setupBFGProjectile();

    aBFGSpray(bfg);

    for (const call of log.aim) {
      expect(call.shooter).toBe(shooter);
    }
  });

  it('missed rays skip damage roll and spawn (no RNG consumed beyond aim)', () => {
    const missedResults: ProjectileAimResult[] = [];
    for (let i = 0; i < BFG_SPRAY_RAY_COUNT; i++) {
      missedResults.push({ slope: 0, target: null });
    }
    const { context, log, rng } = createTestContext({ aimResults: missedResults });
    setProjectileContext(context);
    const { bfg } = setupBFGProjectile();

    const before = rng.prndindex;
    aBFGSpray(bfg);

    expect(log.spawn).toHaveLength(0);
    expect(log.damage).toHaveLength(0);
    expect(rng.prndindex).toBe(before); // no P_Random calls
  });

  it('on hit: spawns MT_EXTRABFG at target.xy with z + height>>2', () => {
    const target = targetMobj(10 * FRACUNIT, 20 * FRACUNIT, 30 * FRACUNIT, 56 * FRACUNIT);
    const results: ProjectileAimResult[] = [];
    for (let i = 0; i < BFG_SPRAY_RAY_COUNT; i++) {
      // First ray hits, rest miss.
      results.push(i === 0 ? { slope: 0, target } : { slope: 0, target: null });
    }
    const { context, log } = createTestContext({ aimResults: results });
    setProjectileContext(context);
    const { bfg } = setupBFGProjectile();

    aBFGSpray(bfg);

    expect(log.spawn).toHaveLength(1);
    expect(log.spawn[0]!.x).toBe(target.x);
    expect(log.spawn[0]!.y).toBe(target.y);
    expect(log.spawn[0]!.z).toBe((target.z + (target.height >> EXTRABFG_Z_SHIFT)) | 0);
    expect(log.spawn[0]!.type).toBe(MobjType.EXTRABFG);
  });

  it('damage is sum of 15 rolls of ((P_Random()&7)+1), range [15,120]', () => {
    const target = targetMobj(100, 0, 0, 64 * FRACUNIT);
    const results: ProjectileAimResult[] = [];
    for (let i = 0; i < BFG_SPRAY_RAY_COUNT; i++) {
      results.push({ slope: 0, target });
    }
    const { context, log } = createTestContext({ aimResults: results });
    setProjectileContext(context);
    const { bfg } = setupBFGProjectile();

    aBFGSpray(bfg);

    expect(log.damage).toHaveLength(BFG_SPRAY_RAY_COUNT);
    for (const call of log.damage) {
      expect(call.damage).toBeGreaterThanOrEqual(15);
      expect(call.damage).toBeLessThanOrEqual(120);
    }
  });

  it('damage uses mo.target as BOTH inflictor and source', () => {
    const target = targetMobj(100, 0);
    const results: ProjectileAimResult[] = [{ slope: 0, target }];
    for (let i = 1; i < BFG_SPRAY_RAY_COUNT; i++) {
      results.push({ slope: 0, target: null });
    }
    const { context, log } = createTestContext({ aimResults: results });
    setProjectileContext(context);
    const { bfg, shooter } = setupBFGProjectile();

    aBFGSpray(bfg);

    expect(log.damage).toHaveLength(1);
    expect(log.damage[0]!.target).toBe(target);
    expect(log.damage[0]!.inflictor).toBe(shooter);
    expect(log.damage[0]!.source).toBe(shooter);
  });

  it('consumes 15 P_Randoms per hit ray', () => {
    const target = targetMobj(100, 0);
    const hits = 3;
    const results: ProjectileAimResult[] = [];
    for (let i = 0; i < BFG_SPRAY_RAY_COUNT; i++) {
      results.push(i < hits ? { slope: 0, target } : { slope: 0, target: null });
    }
    const { context, rng } = createTestContext({ aimResults: results });
    setProjectileContext(context);
    const { bfg } = setupBFGProjectile();

    const before = rng.prndindex;
    aBFGSpray(bfg);
    expect((rng.prndindex - before) & 0xff).toBe(hits * BFG_SPRAY_DAMAGE_ROLLS);
  });

  it('reproduces exact damage value from a fresh RNG', () => {
    const target = targetMobj(100, 0);
    const results: ProjectileAimResult[] = [{ slope: 0, target }];
    for (let i = 1; i < BFG_SPRAY_RAY_COUNT; i++) {
      results.push({ slope: 0, target: null });
    }
    const { context, log, rng } = createTestContext({ aimResults: results });
    setProjectileContext(context);
    const { bfg } = setupBFGProjectile();
    // rng has prndindex = 0 initially.
    void rng; // satisfy unused warning in strict mode

    const expectedRng = new DoomRandom();
    let expectedDamage = 0;
    for (let j = 0; j < BFG_SPRAY_DAMAGE_ROLLS; j++) {
      expectedDamage += (expectedRng.pRandom() & BFG_SPRAY_DAMAGE_MASK) + 1;
    }

    aBFGSpray(bfg);

    expect(log.damage[0]!.damage).toBe(expectedDamage);
  });

  it('null mo.target early-returns (no aims, no spawns, no damage)', () => {
    const { context, log } = createTestContext();
    setProjectileContext(context);
    const bfg = new Mobj();
    bfg.angle = 0;
    bfg.target = null;

    aBFGSpray(bfg);

    expect(log.aim).toHaveLength(0);
    expect(log.spawn).toHaveLength(0);
    expect(log.damage).toHaveLength(0);
  });
});

// ── Parity-sensitive edge cases ─────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('PROJECTILE_AIM_RANGE matches BULLET_AIM_RANGE value (both 16*64*FRACUNIT)', () => {
    // Documents a parity quirk: both hitscan bullet autoaim and projectile
    // autoaim share the same range constant in vanilla Doom (p_map.c).
    expect(PROJECTILE_AIM_RANGE).toBe(16 * 64 * FRACUNIT);
  });

  it('spawnPlayerMissile: +nudge miss then -nudge sets angle = source.angle - (1<<26)', () => {
    const { context } = createTestContext({
      aimResults: [
        { slope: 0, target: null },
        { slope: 0, target: null },
        { slope: 0, target: targetMobj(0, 100) },
      ],
    });
    setProjectileContext(context);
    const source = createPlayerMobj();
    source.angle = 0;

    const missile = spawnPlayerMissile(source, MobjType.ROCKET);

    expect(missile.angle).toBe((0 - PROJECTILE_AIM_NUDGE) >>> 0);
  });

  it('aFireMissile: no extra RNG beyond checkMissileSpawn (hit on first aim → 1 P_Random)', () => {
    const { context, rng } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const player = spawnedPlayer(WeaponType.MISSILE, 10);

    const before = rng.prndindex;
    aFireMissile(player, player.psprites[PsprNum.WEAPON]!);
    expect((rng.prndindex - before) & 0xff).toBe(1);
  });

  it('aFireBFG: exactly one P_Random (checkMissileSpawn tic jitter, no flash roll)', () => {
    const { context, rng } = createTestContext({
      aimResults: [{ slope: 0, target: targetMobj(100, 0) }],
      tryMoveResults: [true],
    });
    setProjectileContext(context);
    const player = spawnedPlayer(WeaponType.BFG, 100);

    const before = rng.prndindex;
    aFireBFG(player, player.psprites[PsprNum.WEAPON]!);
    expect((rng.prndindex - before) & 0xff).toBe(1);
  });

  it('explodeMissile preserves x/y/z position (only zeros momentum)', () => {
    const { context, thinkerList } = createTestContext();
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);
    rocket.x = 123;
    rocket.y = 456;
    rocket.z = 789;

    explodeMissile(rocket);

    expect(rocket.x).toBe(123);
    expect(rocket.y).toBe(456);
    expect(rocket.z).toBe(789);
  });

  it('checkMissileSpawn negative-momentum half-advance uses arithmetic shift', () => {
    // -10 >> 1 === -5 (toward negative infinity), not -5 via truncation.
    // Vanilla relies on this signed shift.
    const { context, thinkerList } = createTestContext({ tryMoveResults: [true] });
    setProjectileContext(context);
    const rocket = createMissileMobj(MobjType.ROCKET, thinkerList);
    rocket.x = 0;
    rocket.y = 0;
    rocket.z = 0;
    rocket.momx = -10;
    rocket.momy = -20;
    rocket.momz = -30;

    checkMissileSpawn(rocket);

    expect(rocket.x).toBe(-5);
    expect(rocket.y).toBe(-10);
    expect(rocket.z).toBe(-15);
  });

  it('aBFGSpray ray 0 uses angle = mo.angle - ANG90/2 (leftmost ray)', () => {
    const missedResults: ProjectileAimResult[] = [];
    for (let i = 0; i < BFG_SPRAY_RAY_COUNT; i++) {
      missedResults.push({ slope: 0, target: null });
    }
    const { context, log } = createTestContext({ aimResults: missedResults });
    setProjectileContext(context);
    const bfg = new Mobj();
    bfg.angle = ANG90;
    bfg.target = createPlayerMobj();

    aBFGSpray(bfg);

    expect(log.aim[0]!.angle).toBe((ANG90 - BFG_SPRAY_HALF_ARC) >>> 0);
  });
});
