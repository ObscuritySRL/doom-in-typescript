import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import type { Angle } from '../../src/core/angle.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom, RNG_TABLE } from '../../src/core/rng.ts';

import type { GameMode } from '../../src/bootstrap/gameMode.ts';

import { MF_CORPSE, MF_NOGRAVITY, MF_SHOOTABLE, MF_SOLID, MOBJINFO, Mobj, MobjType, STATES, StateNum, mobjThinker } from '../../src/world/mobj.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';

import type { PlayerLike } from '../../src/ai/targeting.ts';

import {
  ANG90,
  ANG180,
  ANG270,
  BOSS_DEATH_BABY_TAG,
  BOSS_DEATH_FATSO_TAG,
  BOSS_DEATH_TAG,
  BOSS_SPECIALS_ACTION_COUNT,
  BRAIN_EXPLODE_X_SCATTER,
  BRAIN_ROCKET_MOMZ_MUL,
  BRAIN_ROCKET_TIC_JITTER_MASK,
  BRAIN_ROCKET_Z_BASE,
  BRAIN_ROCKET_Z_RAND_MUL,
  BRAIN_SCREAM_X_END,
  BRAIN_SCREAM_X_START,
  BRAIN_SCREAM_X_STEP,
  BRAIN_SCREAM_Y_OFFSET,
  KEEN_DIE_DOOR_TAG,
  MAX_BRAIN_TARGETS,
  SFX_BOSCUB,
  SFX_BOSDTH,
  SFX_BOSPIT,
  SFX_BOSPN,
  SFX_BOSSIT,
  SFX_BSPWLK,
  SFX_HOOF,
  SFX_METAL,
  SFX_TELEPT,
  SK_EASY,
  aBabyMetal,
  aBossDeath,
  aBrainAwake,
  aBrainDie,
  aBrainExplode,
  aBrainPain,
  aBrainScream,
  aBrainSpit,
  aHoof,
  aKeenDie,
  aMetal,
  aPainDie,
  aSpawnFly,
  aSpawnSound,
  clearBossSpecialsContext,
  getBossSpecialsContext,
  getBrainTargets,
  pickSpawnFlyType,
  resetBrainSpitEasy,
  resetBrainTargets,
  setBossSpecialsContext,
  wireBossSpecialsActions,
} from '../../src/ai/bossSpecials.ts';
import type { BossDoorType, BossFloorType, BossSpecialsContext } from '../../src/ai/bossSpecials.ts';

// ── Recorder + mock context ─────────────────────────────────────────

interface Recorder {
  sounds: Array<{ origin: Mobj | null; sfxId: number }>;
  doors: Array<{ tag: number; type: BossDoorType }>;
  floors: Array<{ tag: number; type: BossFloorType }>;
  exits: number;
  spawned: Array<{ x: number; y: number; z: number; type: MobjType; mobj: Mobj }>;
  missiles: Array<{ source: Mobj; dest: Mobj; type: MobjType; mobj: Mobj }>;
  painSkulls: Array<{ actor: Mobj; angle: Angle }>;
  chases: Array<Mobj>;
  lookForPlayers: Array<{ actor: Mobj; allaround: boolean }>;
  teleports: Array<{ thing: Mobj; x: number; y: number }>;
  removed: Array<Mobj>;
  setStates: Array<{ mobj: Mobj; state: StateNum }>;
}

interface MockOptions {
  rng?: DoomRandom;
  thinkerList?: ThinkerList;
  gameMode?: GameMode;
  isUltimateOrLater?: boolean;
  gameepisode?: number;
  gamemap?: number;
  gameskill?: number;
  players?: PlayerLike[];
  playeringame?: boolean[];
  // Behavior overrides:
  spawnMobjImpl?: (x: number, y: number, z: number, type: MobjType) => Mobj;
  spawnMissileImpl?: (source: Mobj, dest: Mobj, type: MobjType) => Mobj;
  lookForPlayersResult?: boolean;
  setMobjStateImpl?: (mobj: Mobj, state: StateNum) => boolean;
}

function makePlayer(health = 100): PlayerLike {
  return { mo: null, health };
}

function makeMockContext(opts: MockOptions = {}): {
  ctx: BossSpecialsContext;
  rec: Recorder;
} {
  const rec: Recorder = {
    sounds: [],
    doors: [],
    floors: [],
    exits: 0,
    spawned: [],
    missiles: [],
    painSkulls: [],
    chases: [],
    lookForPlayers: [],
    teleports: [],
    removed: [],
    setStates: [],
  };

  const ctx: BossSpecialsContext = {
    rng: opts.rng ?? new DoomRandom(),
    thinkerList: opts.thinkerList ?? new ThinkerList(),
    startSound: (origin, sfxId) => {
      rec.sounds.push({ origin, sfxId });
    },
    spawnMobj: (x, y, z, type) => {
      const m =
        opts.spawnMobjImpl?.(x, y, z, type) ??
        (() => {
          const mo = new Mobj();
          mo.x = x;
          mo.y = y;
          mo.z = z;
          mo.type = type;
          mo.info = MOBJINFO[type] ?? null;
          mo.action = mobjThinker;
          mo.tics = 0;
          return mo;
        })();
      rec.spawned.push({ x, y, z, type, mobj: m });
      return m;
    },
    gameMode: () => opts.gameMode ?? 'registered',
    isUltimateOrLater: () => opts.isUltimateOrLater ?? false,
    gameepisode: () => opts.gameepisode ?? 1,
    gamemap: () => opts.gamemap ?? 1,
    gameskill: () => opts.gameskill ?? 2,
    players: opts.players ?? [makePlayer(100)],
    playeringame: opts.playeringame ?? [true],
    exitLevel: () => {
      rec.exits++;
    },
    doDoor: (tag, type) => {
      rec.doors.push({ tag, type });
      return true;
    },
    doFloor: (tag, type) => {
      rec.floors.push({ tag, type });
      return true;
    },
    spawnMissile: (source, dest, type) => {
      const m =
        opts.spawnMissileImpl?.(source, dest, type) ??
        (() => {
          const mo = new Mobj();
          mo.type = type;
          mo.info = MOBJINFO[type] ?? null;
          mo.target = source;
          mo.momy = 1;
          mo.state = STATES[1] ?? null;
          return mo;
        })();
      rec.missiles.push({ source, dest, type, mobj: m });
      return m;
    },
    painShootSkullAction: (actor, angle) => {
      rec.painSkulls.push({ actor, angle });
    },
    chaseAction: (actor) => {
      rec.chases.push(actor);
    },
    lookForPlayers: (actor, allaround) => {
      rec.lookForPlayers.push({ actor, allaround });
      return opts.lookForPlayersResult ?? true;
    },
    teleportMove: (thing, x, y) => {
      rec.teleports.push({ thing, x, y });
      return true;
    },
    removeMobj: (mobj) => {
      rec.removed.push(mobj);
    },
    setMobjState: (mobj, state) => {
      if (opts.setMobjStateImpl) return opts.setMobjStateImpl(mobj, state);
      const st = STATES[state];
      if (st) {
        mobj.state = st;
        mobj.tics = st.tics;
      }
      rec.setStates.push({ mobj, state });
      return true;
    },
  };

  return { ctx, rec };
}

function makeMobj(type: MobjType = MobjType.PAIN): Mobj {
  const m = new Mobj();
  m.type = type;
  m.info = MOBJINFO[type] ?? null;
  m.flags = MF_SHOOTABLE;
  m.health = 100;
  m.action = mobjThinker;
  return m;
}

afterEach(() => {
  clearBossSpecialsContext();
  resetBrainTargets();
  resetBrainSpitEasy();
});

// ── Constants ────────────────────────────────────────────────────────

describe('boss-specials constants', () => {
  it('SFX constants match canonical sounds.h sfxenum_t indices', () => {
    expect(SFX_TELEPT).toBe(35);
    expect(SFX_BSPWLK).toBe(79);
    expect(SFX_HOOF).toBe(84);
    expect(SFX_METAL).toBe(85);
    expect(SFX_BOSPIT).toBe(94);
    expect(SFX_BOSCUB).toBe(95);
    expect(SFX_BOSSIT).toBe(96);
    expect(SFX_BOSPN).toBe(97);
    expect(SFX_BOSDTH).toBe(98);
  });

  it('door tag constants are 666/667 as canonical', () => {
    expect(KEEN_DIE_DOOR_TAG).toBe(666);
    expect(BOSS_DEATH_FATSO_TAG).toBe(666);
    expect(BOSS_DEATH_BABY_TAG).toBe(667);
    expect(BOSS_DEATH_TAG).toBe(666);
  });

  it('brain rocket geometry matches p_enemy.c spec', () => {
    expect(BRAIN_SCREAM_X_START).toBe(-196 * FRACUNIT);
    expect(BRAIN_SCREAM_X_END).toBe(320 * FRACUNIT);
    expect(BRAIN_SCREAM_X_STEP).toBe(8 * FRACUNIT);
    expect(BRAIN_SCREAM_Y_OFFSET).toBe(-320 * FRACUNIT);
    expect(BRAIN_EXPLODE_X_SCATTER).toBe(2048);
    expect(BRAIN_ROCKET_Z_BASE).toBe(128);
    expect(BRAIN_ROCKET_Z_RAND_MUL).toBe(2 * FRACUNIT);
    expect(BRAIN_ROCKET_MOMZ_MUL).toBe(512);
    expect(BRAIN_ROCKET_TIC_JITTER_MASK).toBe(7);
  });

  it('ANG90/ANG180/ANG270 are 32-bit fixed-point angles', () => {
    expect(ANG90).toBe(0x40000000);
    expect(ANG180).toBe(0x80000000);
    expect(ANG270).toBe(0xc0000000);
  });

  it('MAX_BRAIN_TARGETS is 32 (matches vanilla static array size)', () => {
    expect(MAX_BRAIN_TARGETS).toBe(32);
  });

  it('SK_EASY is 1 (sk_easy from doomdef.h)', () => {
    expect(SK_EASY).toBe(1);
  });

  it('BOSS_SPECIALS_ACTION_COUNT is 24', () => {
    expect(BOSS_SPECIALS_ACTION_COUNT).toBe(24);
  });
});

// ── Context round-trip ──────────────────────────────────────────────

describe('boss-specials context', () => {
  it('set/get round-trip', () => {
    const { ctx } = makeMockContext();
    setBossSpecialsContext(ctx);
    expect(getBossSpecialsContext()).toBe(ctx);
  });

  it('clearBossSpecialsContext returns null', () => {
    const { ctx } = makeMockContext();
    setBossSpecialsContext(ctx);
    clearBossSpecialsContext();
    expect(getBossSpecialsContext()).toBeNull();
  });
});

// ── A_KeenDie ───────────────────────────────────────────────────────

describe('aKeenDie', () => {
  it('clears MF_SOLID on the dying Keen', () => {
    const { ctx } = makeMockContext();
    setBossSpecialsContext(ctx);
    const keen = makeMobj(MobjType.KEEN);
    keen.flags = MF_SOLID | MF_SHOOTABLE;
    aKeenDie(keen);
    expect(keen.flags & MF_SOLID).toBe(0);
    expect(keen.flags & MF_SHOOTABLE).toBe(MF_SHOOTABLE);
  });

  it("opens door tag 666 with type 'open' when only Keen in level", () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list });
    setBossSpecialsContext(ctx);
    const keen = makeMobj(MobjType.KEEN);
    list.add(keen);
    aKeenDie(keen);
    expect(rec.doors).toHaveLength(1);
    expect(rec.doors[0]).toEqual({ tag: 666, type: 'open' });
  });

  it('does NOT open door when another Keen is alive (health > 0)', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list });
    setBossSpecialsContext(ctx);
    const dying = makeMobj(MobjType.KEEN);
    const alive = makeMobj(MobjType.KEEN);
    alive.health = 100;
    list.add(dying);
    list.add(alive);
    aKeenDie(dying);
    expect(rec.doors).toHaveLength(0);
  });

  it('opens door when other Keen has health 0 (dead) — strict > 0 test', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list });
    setBossSpecialsContext(ctx);
    const dying = makeMobj(MobjType.KEEN);
    const dead = makeMobj(MobjType.KEEN);
    dead.health = 0;
    list.add(dying);
    list.add(dead);
    aKeenDie(dying);
    expect(rec.doors).toHaveLength(1);
  });

  it('ignores other mobjs of different type', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list });
    setBossSpecialsContext(ctx);
    const dying = makeMobj(MobjType.KEEN);
    const troop = makeMobj(MobjType.TROOP);
    troop.health = 100;
    list.add(dying);
    list.add(troop);
    aKeenDie(dying);
    expect(rec.doors).toHaveLength(1);
  });

  it("does NOT count dying Keen as 'other' (same-instance check)", () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list });
    setBossSpecialsContext(ctx);
    const dying = makeMobj(MobjType.KEEN);
    dying.health = 100;
    list.add(dying);
    aKeenDie(dying);
    expect(rec.doors).toHaveLength(1);
  });

  it('consumes no RNG', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const { ctx } = makeMockContext({ rng, thinkerList: list });
    setBossSpecialsContext(ctx);
    const keen = makeMobj(MobjType.KEEN);
    list.add(keen);
    const before = rng.prndindex;
    aKeenDie(keen);
    expect(rng.prndindex).toBe(before);
  });

  it('is safe when context is unset', () => {
    clearBossSpecialsContext();
    const keen = makeMobj(MobjType.KEEN);
    expect(() => aKeenDie(keen)).not.toThrow();
  });
});

// ── A_PainDie ───────────────────────────────────────────────────────

describe('aPainDie', () => {
  it('clears MF_SOLID on the dying pain elemental', () => {
    const { ctx } = makeMockContext();
    setBossSpecialsContext(ctx);
    const pain = makeMobj(MobjType.PAIN);
    pain.flags = MF_SOLID | MF_SHOOTABLE;
    aPainDie(pain);
    expect(pain.flags & MF_SOLID).toBe(0);
  });

  it('fires three lost souls at +ANG90, +ANG180, +ANG270 in that order', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    const pain = makeMobj(MobjType.PAIN);
    pain.angle = 0;
    aPainDie(pain);
    expect(rec.painSkulls).toHaveLength(3);
    expect(rec.painSkulls[0]!.angle).toBe(ANG90);
    expect(rec.painSkulls[1]!.angle).toBe(ANG180);
    expect(rec.painSkulls[2]!.angle).toBe(ANG270);
  });

  it("preserves pain elemental's last orientation (no A_FaceTarget)", () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    const pain = makeMobj(MobjType.PAIN);
    const base = 0x12345678 as Angle;
    pain.angle = base;
    aPainDie(pain);
    // Each angle should be (base + offset) mod 2^32.
    const m32 = (n: number): number => n >>> 0;
    expect(rec.painSkulls[0]!.angle).toBe(m32(base + ANG90));
    expect(rec.painSkulls[1]!.angle).toBe(m32(base + ANG180));
    expect(rec.painSkulls[2]!.angle).toBe(m32(base + ANG270));
  });

  it('calls painShootSkull with the actor itself as the actor argument', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    const pain = makeMobj(MobjType.PAIN);
    aPainDie(pain);
    for (const call of rec.painSkulls) {
      expect(call.actor).toBe(pain);
    }
  });

  it('is safe when context is unset', () => {
    clearBossSpecialsContext();
    const pain = makeMobj(MobjType.PAIN);
    expect(() => aPainDie(pain)).not.toThrow();
  });
});

// ── A_BossDeath ─────────────────────────────────────────────────────

describe('aBossDeath', () => {
  describe('commercial mode (Doom 2 MAP07)', () => {
    it('FATSO on map 7 lowers floor with tag 666', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'commercial',
        gamemap: 7,
      });
      setBossSpecialsContext(ctx);
      const fatso = makeMobj(MobjType.FATSO);
      fatso.health = 0;
      aBossDeath(fatso);
      expect(rec.floors).toEqual([{ tag: 666, type: 'lowerFloorToLowest' }]);
      expect(rec.doors).toHaveLength(0);
      expect(rec.exits).toBe(0);
    });

    it('BABY on map 7 raises floor with tag 667', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'commercial',
        gamemap: 7,
      });
      setBossSpecialsContext(ctx);
      const baby = makeMobj(MobjType.BABY);
      baby.health = 0;
      aBossDeath(baby);
      expect(rec.floors).toEqual([{ tag: 667, type: 'raiseToTexture' }]);
      expect(rec.exits).toBe(0);
    });

    it('FATSO on map 6 does nothing (commercial requires map 7)', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'commercial',
        gamemap: 6,
      });
      setBossSpecialsContext(ctx);
      const fatso = makeMobj(MobjType.FATSO);
      fatso.health = 0;
      aBossDeath(fatso);
      expect(rec.floors).toHaveLength(0);
      expect(rec.exits).toBe(0);
    });

    it('CYBORG on map 7 does nothing (only FATSO/BABY trigger)', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'commercial',
        gamemap: 7,
      });
      setBossSpecialsContext(ctx);
      const cyber = makeMobj(MobjType.CYBORG);
      cyber.health = 0;
      aBossDeath(cyber);
      expect(rec.floors).toHaveLength(0);
      expect(rec.doors).toHaveLength(0);
      expect(rec.exits).toBe(0);
    });
  });

  describe('non-commercial pre-ultimate (Doom 1 v1.9)', () => {
    it('ep1 map8 BRUISER lowers floor 666', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'registered',
        isUltimateOrLater: false,
        gameepisode: 1,
        gamemap: 8,
      });
      setBossSpecialsContext(ctx);
      const baron = makeMobj(MobjType.BRUISER);
      baron.health = 0;
      aBossDeath(baron);
      expect(rec.floors).toEqual([{ tag: 666, type: 'lowerFloorToLowest' }]);
      expect(rec.exits).toBe(0);
    });

    it('ep1 map7 BRUISER does nothing (only map 8 in pre-ultimate)', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'registered',
        isUltimateOrLater: false,
        gameepisode: 1,
        gamemap: 7,
      });
      setBossSpecialsContext(ctx);
      const baron = makeMobj(MobjType.BRUISER);
      baron.health = 0;
      aBossDeath(baron);
      expect(rec.floors).toHaveLength(0);
      expect(rec.exits).toBe(0);
    });

    it('ep2 map8 BRUISER does nothing (BRUISER+ep!=1 rejected)', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'registered',
        isUltimateOrLater: false,
        gameepisode: 2,
        gamemap: 8,
      });
      setBossSpecialsContext(ctx);
      const baron = makeMobj(MobjType.BRUISER);
      baron.health = 0;
      aBossDeath(baron);
      expect(rec.floors).toHaveLength(0);
      expect(rec.exits).toBe(0);
    });

    it('ep2 map8 CYBORG calls exitLevel (default fall-through)', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'registered',
        isUltimateOrLater: false,
        gameepisode: 2,
        gamemap: 8,
      });
      setBossSpecialsContext(ctx);
      const cyber = makeMobj(MobjType.CYBORG);
      cyber.health = 0;
      aBossDeath(cyber);
      expect(rec.floors).toHaveLength(0);
      expect(rec.exits).toBe(1);
    });

    it('ep3 map8 SPIDER calls exitLevel', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'registered',
        isUltimateOrLater: false,
        gameepisode: 3,
        gamemap: 8,
      });
      setBossSpecialsContext(ctx);
      const spider = makeMobj(MobjType.SPIDER);
      spider.health = 0;
      aBossDeath(spider);
      expect(rec.exits).toBe(1);
    });
  });

  describe('non-commercial ultimate (Ultimate Doom rework)', () => {
    it('ep1 map8 BRUISER lowers floor (only BRUISER triggers in ep1)', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'retail',
        isUltimateOrLater: true,
        gameepisode: 1,
        gamemap: 8,
      });
      setBossSpecialsContext(ctx);
      const baron = makeMobj(MobjType.BRUISER);
      baron.health = 0;
      aBossDeath(baron);
      expect(rec.floors).toEqual([{ tag: 666, type: 'lowerFloorToLowest' }]);
    });

    it('ep1 map8 CYBORG does nothing (ultimate gates by type)', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'retail',
        isUltimateOrLater: true,
        gameepisode: 1,
        gamemap: 8,
      });
      setBossSpecialsContext(ctx);
      const cyber = makeMobj(MobjType.CYBORG);
      cyber.health = 0;
      aBossDeath(cyber);
      expect(rec.floors).toHaveLength(0);
      expect(rec.exits).toBe(0);
    });

    it('ep2 map8 CYBORG calls exitLevel', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'retail',
        isUltimateOrLater: true,
        gameepisode: 2,
        gamemap: 8,
      });
      setBossSpecialsContext(ctx);
      const cyber = makeMobj(MobjType.CYBORG);
      cyber.health = 0;
      aBossDeath(cyber);
      expect(rec.exits).toBe(1);
    });

    it('ep3 map8 SPIDER calls exitLevel', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'retail',
        isUltimateOrLater: true,
        gameepisode: 3,
        gamemap: 8,
      });
      setBossSpecialsContext(ctx);
      const spider = makeMobj(MobjType.SPIDER);
      spider.health = 0;
      aBossDeath(spider);
      expect(rec.exits).toBe(1);
    });

    it('ep4 map6 CYBORG opens door blazeOpen with tag 666', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'retail',
        isUltimateOrLater: true,
        gameepisode: 4,
        gamemap: 6,
      });
      setBossSpecialsContext(ctx);
      const cyber = makeMobj(MobjType.CYBORG);
      cyber.health = 0;
      aBossDeath(cyber);
      expect(rec.doors).toEqual([{ tag: 666, type: 'blazeOpen' }]);
      expect(rec.floors).toHaveLength(0);
      expect(rec.exits).toBe(0);
    });

    it('ep4 map8 SPIDER lowers floor with tag 666', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'retail',
        isUltimateOrLater: true,
        gameepisode: 4,
        gamemap: 8,
      });
      setBossSpecialsContext(ctx);
      const spider = makeMobj(MobjType.SPIDER);
      spider.health = 0;
      aBossDeath(spider);
      expect(rec.floors).toEqual([{ tag: 666, type: 'lowerFloorToLowest' }]);
    });

    it('ep4 map8 CYBORG does nothing (only SPIDER@map8 in ep4)', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'retail',
        isUltimateOrLater: true,
        gameepisode: 4,
        gamemap: 8,
      });
      setBossSpecialsContext(ctx);
      const cyber = makeMobj(MobjType.CYBORG);
      cyber.health = 0;
      aBossDeath(cyber);
      expect(rec.floors).toHaveLength(0);
      expect(rec.doors).toHaveLength(0);
      expect(rec.exits).toBe(0);
    });

    it('ep5 map8 anything calls exitLevel (default branch)', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'retail',
        isUltimateOrLater: true,
        gameepisode: 5,
        gamemap: 8,
      });
      setBossSpecialsContext(ctx);
      const cyber = makeMobj(MobjType.CYBORG);
      cyber.health = 0;
      aBossDeath(cyber);
      expect(rec.exits).toBe(1);
    });
  });

  describe('living-player gate', () => {
    it('returns silently when no players are alive (registered ep1 map8)', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'registered',
        gameepisode: 1,
        gamemap: 8,
        players: [makePlayer(0), makePlayer(-1)],
        playeringame: [true, true],
      });
      setBossSpecialsContext(ctx);
      const baron = makeMobj(MobjType.BRUISER);
      baron.health = 0;
      aBossDeath(baron);
      expect(rec.floors).toHaveLength(0);
      expect(rec.exits).toBe(0);
    });

    it('returns silently when only living players are not in-game', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'registered',
        gameepisode: 1,
        gamemap: 8,
        players: [makePlayer(100), makePlayer(0)],
        playeringame: [false, true],
      });
      setBossSpecialsContext(ctx);
      const baron = makeMobj(MobjType.BRUISER);
      baron.health = 0;
      aBossDeath(baron);
      expect(rec.floors).toHaveLength(0);
    });

    it('triggers when at least one player is alive AND in-game', () => {
      const { ctx, rec } = makeMockContext({
        gameMode: 'registered',
        gameepisode: 1,
        gamemap: 8,
        players: [makePlayer(0), makePlayer(50), makePlayer(0)],
        playeringame: [true, true, true],
      });
      setBossSpecialsContext(ctx);
      const baron = makeMobj(MobjType.BRUISER);
      baron.health = 0;
      aBossDeath(baron);
      expect(rec.floors).toHaveLength(1);
    });
  });

  describe('surviving-boss gate', () => {
    it('returns silently when another boss of same type is alive', () => {
      const list = new ThinkerList();
      const { ctx, rec } = makeMockContext({
        gameMode: 'commercial',
        gamemap: 7,
        thinkerList: list,
      });
      setBossSpecialsContext(ctx);
      const dying = makeMobj(MobjType.FATSO);
      dying.health = 0;
      const survivor = makeMobj(MobjType.FATSO);
      survivor.health = 100;
      list.add(dying);
      list.add(survivor);
      aBossDeath(dying);
      expect(rec.floors).toHaveLength(0);
    });

    it("triggers when surviving 'boss' is a different type", () => {
      const list = new ThinkerList();
      const { ctx, rec } = makeMockContext({
        gameMode: 'commercial',
        gamemap: 7,
        thinkerList: list,
      });
      setBossSpecialsContext(ctx);
      const dying = makeMobj(MobjType.FATSO);
      dying.health = 0;
      const baby = makeMobj(MobjType.BABY);
      baby.health = 100;
      list.add(dying);
      list.add(baby);
      aBossDeath(dying);
      expect(rec.floors).toHaveLength(1);
    });

    it('does NOT count the dying boss itself (same-instance check)', () => {
      const list = new ThinkerList();
      const { ctx, rec } = makeMockContext({
        gameMode: 'commercial',
        gamemap: 7,
        thinkerList: list,
      });
      setBossSpecialsContext(ctx);
      const dying = makeMobj(MobjType.FATSO);
      dying.health = 100;
      list.add(dying);
      aBossDeath(dying);
      expect(rec.floors).toHaveLength(1);
    });
  });

  it('consumes no RNG', () => {
    const rng = new DoomRandom();
    const { ctx } = makeMockContext({
      rng,
      gameMode: 'commercial',
      gamemap: 7,
    });
    setBossSpecialsContext(ctx);
    const fatso = makeMobj(MobjType.FATSO);
    fatso.health = 0;
    const before = rng.prndindex;
    aBossDeath(fatso);
    expect(rng.prndindex).toBe(before);
  });

  it('is safe when context is unset', () => {
    clearBossSpecialsContext();
    const fatso = makeMobj(MobjType.FATSO);
    expect(() => aBossDeath(fatso)).not.toThrow();
  });
});

// ── A_Hoof / A_Metal / A_BabyMetal ──────────────────────────────────

describe('aHoof', () => {
  it('plays sfx_hoof on the actor (NOT world-relative) and calls chase', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    const cyber = makeMobj(MobjType.CYBORG);
    aHoof(cyber);
    expect(rec.sounds).toEqual([{ origin: cyber, sfxId: SFX_HOOF }]);
    expect(rec.chases).toEqual([cyber]);
  });

  it('is safe when context is unset', () => {
    clearBossSpecialsContext();
    const cyber = makeMobj(MobjType.CYBORG);
    expect(() => aHoof(cyber)).not.toThrow();
  });
});

describe('aMetal', () => {
  it('plays sfx_metal on the actor and calls chase', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    const spider = makeMobj(MobjType.SPIDER);
    aMetal(spider);
    expect(rec.sounds).toEqual([{ origin: spider, sfxId: SFX_METAL }]);
    expect(rec.chases).toEqual([spider]);
  });
});

describe('aBabyMetal', () => {
  it('plays sfx_bspwlk on the actor and calls chase', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    const baby = makeMobj(MobjType.BABY);
    aBabyMetal(baby);
    expect(rec.sounds).toEqual([{ origin: baby, sfxId: SFX_BSPWLK }]);
    expect(rec.chases).toEqual([baby]);
  });
});

// ── A_BrainAwake ────────────────────────────────────────────────────

describe('aBrainAwake', () => {
  it('scans MT_BOSSTARGET spots from thinker list and seeds braintargets', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list });
    setBossSpecialsContext(ctx);
    const t1 = makeMobj(MobjType.BOSSTARGET);
    const t2 = makeMobj(MobjType.BOSSTARGET);
    const t3 = makeMobj(MobjType.BOSSTARGET);
    list.add(t1);
    list.add(t2);
    list.add(t3);
    const brain = makeMobj(MobjType.BOSSBRAIN);
    aBrainAwake(brain);
    const snap = getBrainTargets();
    expect(snap.count).toBe(3);
    expect(snap.targets[0]).toBe(t1);
    expect(snap.targets[1]).toBe(t2);
    expect(snap.targets[2]).toBe(t3);
    expect(snap.cursor).toBe(0);
    expect(rec.sounds).toEqual([{ origin: null, sfxId: SFX_BOSSIT }]);
  });

  it('ignores non-BOSSTARGET thinkers', () => {
    const list = new ThinkerList();
    const { ctx } = makeMockContext({ thinkerList: list });
    setBossSpecialsContext(ctx);
    list.add(makeMobj(MobjType.TROOP));
    list.add(makeMobj(MobjType.BOSSTARGET));
    list.add(makeMobj(MobjType.SPIDER));
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    expect(getBrainTargets().count).toBe(1);
  });

  it('caps at MAX_BRAIN_TARGETS=32 (vanilla overrun → silent drop)', () => {
    const list = new ThinkerList();
    const { ctx } = makeMockContext({ thinkerList: list });
    setBossSpecialsContext(ctx);
    for (let i = 0; i < 50; i++) list.add(makeMobj(MobjType.BOSSTARGET));
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    expect(getBrainTargets().count).toBe(MAX_BRAIN_TARGETS);
  });

  it('resets count and cursor each call (level transition)', () => {
    const list = new ThinkerList();
    const { ctx } = makeMockContext({ thinkerList: list });
    setBossSpecialsContext(ctx);
    list.add(makeMobj(MobjType.BOSSTARGET));
    list.add(makeMobj(MobjType.BOSSTARGET));
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    expect(getBrainTargets().count).toBe(2);
    list.init();
    list.add(makeMobj(MobjType.BOSSTARGET));
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    expect(getBrainTargets().count).toBe(1);
    expect(getBrainTargets().cursor).toBe(0);
  });

  it('plays sfx_bossit world-relative (origin null)', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list });
    setBossSpecialsContext(ctx);
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    expect(rec.sounds[0]!.origin).toBeNull();
  });

  it('consumes no RNG', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const { ctx } = makeMockContext({ rng, thinkerList: list });
    setBossSpecialsContext(ctx);
    const before = rng.prndindex;
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    expect(rng.prndindex).toBe(before);
  });
});

// ── A_BrainPain ─────────────────────────────────────────────────────

describe('aBrainPain', () => {
  it('plays sfx_bospn world-relative (origin null)', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    aBrainPain(makeMobj(MobjType.BOSSBRAIN));
    expect(rec.sounds).toEqual([{ origin: null, sfxId: SFX_BOSPN }]);
  });

  it('consumes no RNG', () => {
    const rng = new DoomRandom();
    const { ctx } = makeMockContext({ rng });
    setBossSpecialsContext(ctx);
    const before = rng.prndindex;
    aBrainPain(makeMobj(MobjType.BOSSBRAIN));
    expect(rng.prndindex).toBe(before);
  });

  it('is safe when context is unset', () => {
    clearBossSpecialsContext();
    expect(() => aBrainPain(makeMobj(MobjType.BOSSBRAIN))).not.toThrow();
  });
});

// ── A_BrainScream ───────────────────────────────────────────────────

describe('aBrainScream', () => {
  it("spawns 65 rockets across the brain's front (x range -196 to 320 step 8)", () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setBossSpecialsContext(ctx);
    const brain = makeMobj(MobjType.BOSSBRAIN);
    brain.x = 0;
    brain.y = 0;
    aBrainScream(brain);
    const rockets = rec.spawned.filter((s) => s.type === MobjType.ROCKET);
    expect(rockets).toHaveLength(65);
    expect(rockets[0]!.x).toBe(BRAIN_SCREAM_X_START);
    // Last rocket is at -196 + 64*8 = 316 (in fixed-point: 316*FRACUNIT).
    expect(rockets[64]!.x).toBe(316 * FRACUNIT);
    for (const r of rockets) {
      expect(r.y).toBe(BRAIN_SCREAM_Y_OFFSET);
    }
  });

  it('consumes 3 P_Random per rocket (z, momz, jitter) — 195 total', () => {
    const rng = new DoomRandom();
    const { ctx } = makeMockContext({ rng });
    setBossSpecialsContext(ctx);
    const before = rng.prndindex;
    aBrainScream(makeMobj(MobjType.BOSSBRAIN));
    const after = rng.prndindex;
    // pRandom() walks the 256-entry table mod 256.
    expect((after - before + 256) & 0xff).toBe(195 & 0xff);
  });

  it('plays sfx_bosdth world-relative as final action', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    aBrainScream(makeMobj(MobjType.BOSSBRAIN));
    const last = rec.sounds[rec.sounds.length - 1]!;
    expect(last).toEqual({ origin: null, sfxId: SFX_BOSDTH });
  });

  it('transitions every rocket to BRAINEXPLODE1', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    aBrainScream(makeMobj(MobjType.BOSSBRAIN));
    expect(rec.setStates).toHaveLength(65);
    for (const s of rec.setStates) {
      expect(s.state).toBe(StateNum.BRAINEXPLODE1);
    }
  });

  it('first rocket: z=128+RNG_TABLE[1]*2*FRACUNIT, momz=RNG_TABLE[2]*512', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setBossSpecialsContext(ctx);
    aBrainScream(makeMobj(MobjType.BOSSBRAIN));
    const first = rec.spawned[0]!.mobj;
    expect(first.z).toBe(128 + RNG_TABLE[1]! * 2 * FRACUNIT);
    expect(first.momz).toBe(RNG_TABLE[2]! * 512);
  });

  it('rocket tics floor at 1 if jitter would drive negative', () => {
    const { ctx, rec } = makeMockContext({
      // Force tics=2 then jitter & 7 — third pRandom value walks the table.
      setMobjStateImpl: (mobj, _state) => {
        mobj.tics = 2;
        return true;
      },
    });
    setBossSpecialsContext(ctx);
    aBrainScream(makeMobj(MobjType.BOSSBRAIN));
    for (const s of rec.spawned) {
      expect(s.mobj.tics).toBeGreaterThanOrEqual(1);
    }
  });

  it('uses brain.x/y as origin (not world (0,0))', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    const brain = makeMobj(MobjType.BOSSBRAIN);
    brain.x = 1024 * FRACUNIT;
    brain.y = 2048 * FRACUNIT;
    aBrainScream(brain);
    const rockets = rec.spawned.filter((s) => s.type === MobjType.ROCKET);
    expect(rockets[0]!.x).toBe(1024 * FRACUNIT + BRAIN_SCREAM_X_START);
    for (const r of rockets) {
      expect(r.y).toBe(2048 * FRACUNIT + BRAIN_SCREAM_Y_OFFSET);
    }
  });
});

// ── A_BrainExplode ──────────────────────────────────────────────────

describe('aBrainExplode', () => {
  it('spawns one rocket scattered around mo.x', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    aBrainExplode(makeMobj(MobjType.BOSSBRAIN));
    const rockets = rec.spawned.filter((s) => s.type === MobjType.ROCKET);
    expect(rockets).toHaveLength(1);
  });

  it('y is exactly mo.y (no scatter on y)', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    const brain = makeMobj(MobjType.BOSSBRAIN);
    brain.x = 100;
    brain.y = 200;
    aBrainExplode(brain);
    expect(rec.spawned[0]!.y).toBe(200);
  });

  it('consumes 5 P_Random total (subrandom 2 + z + momz + jitter)', () => {
    const rng = new DoomRandom();
    const { ctx } = makeMockContext({ rng });
    setBossSpecialsContext(ctx);
    const before = rng.prndindex;
    aBrainExplode(makeMobj(MobjType.BOSSBRAIN));
    expect(rng.prndindex).toBe(before + 5);
  });

  it('x = mo.x + (P_Random()-P_Random())*2048, RNG order matches vanilla', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setBossSpecialsContext(ctx);
    const brain = makeMobj(MobjType.BOSSBRAIN);
    brain.x = 0;
    aBrainExplode(brain);
    // pSubRandom = pRandom() - pRandom() = RNG_TABLE[1] - RNG_TABLE[2].
    const expectedScatter = (RNG_TABLE[1]! - RNG_TABLE[2]!) * BRAIN_EXPLODE_X_SCATTER;
    expect(rec.spawned[0]!.x).toBe(expectedScatter);
  });

  it('does NOT play any sound (death-loop frames only)', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    aBrainExplode(makeMobj(MobjType.BOSSBRAIN));
    expect(rec.sounds).toHaveLength(0);
  });
});

// ── A_BrainDie ──────────────────────────────────────────────────────

describe('aBrainDie', () => {
  it('calls exitLevel exactly once', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    aBrainDie(makeMobj(MobjType.BOSSBRAIN));
    expect(rec.exits).toBe(1);
  });

  it('consumes no RNG', () => {
    const rng = new DoomRandom();
    const { ctx } = makeMockContext({ rng });
    setBossSpecialsContext(ctx);
    const before = rng.prndindex;
    aBrainDie(makeMobj(MobjType.BOSSBRAIN));
    expect(rng.prndindex).toBe(before);
  });

  it('is safe when context is unset', () => {
    clearBossSpecialsContext();
    expect(() => aBrainDie(makeMobj(MobjType.BOSSBRAIN))).not.toThrow();
  });
});

// ── A_BrainSpit ─────────────────────────────────────────────────────

describe('aBrainSpit', () => {
  function seedTargets(list: ThinkerList, n: number): Mobj[] {
    const targets: Mobj[] = [];
    for (let i = 0; i < n; i++) {
      const t = makeMobj(MobjType.BOSSTARGET);
      t.x = i * 1000;
      t.y = (i + 1) * 1000;
      list.add(t);
      targets.push(t);
    }
    return targets;
  }

  it('throws when numbraintargets is 0 (vanilla NULL deref)', () => {
    const { ctx } = makeMockContext({ gameskill: 3 });
    setBossSpecialsContext(ctx);
    const brain = makeMobj(MobjType.BOSSBRAIN);
    expect(() => aBrainSpit(brain)).toThrow();
  });

  it('on Easy: every other call is silent (toggle-skip)', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list, gameskill: SK_EASY });
    setBossSpecialsContext(ctx);
    seedTargets(list, 2);
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    rec.sounds.length = 0;
    rec.missiles.length = 0;
    const brain = makeMobj(MobjType.BOSSBRAIN);
    // Call 1: easy was 0, toggles to 1, fires.
    aBrainSpit(brain);
    expect(rec.missiles).toHaveLength(1);
    // Call 2: easy was 1, toggles to 0, skipped.
    aBrainSpit(brain);
    expect(rec.missiles).toHaveLength(1);
    // Call 3: fires again.
    aBrainSpit(brain);
    expect(rec.missiles).toHaveLength(2);
  });

  it('on Normal+: fires every call regardless of toggle', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list, gameskill: 2 });
    setBossSpecialsContext(ctx);
    seedTargets(list, 2);
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    rec.missiles.length = 0;
    const brain = makeMobj(MobjType.BOSSBRAIN);
    aBrainSpit(brain);
    aBrainSpit(brain);
    aBrainSpit(brain);
    expect(rec.missiles).toHaveLength(3);
  });

  it('on Very Easy (skill=0): also skip-cycles', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list, gameskill: 0 });
    setBossSpecialsContext(ctx);
    seedTargets(list, 1);
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    rec.missiles.length = 0;
    const brain = makeMobj(MobjType.BOSSBRAIN);
    aBrainSpit(brain);
    aBrainSpit(brain);
    expect(rec.missiles).toHaveLength(1);
  });

  it('spawnMissile invoked with (brain, targ, MT_SPAWNSHOT)', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list, gameskill: 2 });
    setBossSpecialsContext(ctx);
    const targets = seedTargets(list, 1);
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    rec.missiles.length = 0;
    const brain = makeMobj(MobjType.BOSSBRAIN);
    aBrainSpit(brain);
    expect(rec.missiles).toHaveLength(1);
    expect(rec.missiles[0]!.source).toBe(brain);
    expect(rec.missiles[0]!.dest).toBe(targets[0]!);
    expect(rec.missiles[0]!.type).toBe(MobjType.SPAWNSHOT);
  });

  it('overrides newmobj.target = targ (not the brain)', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list, gameskill: 2 });
    setBossSpecialsContext(ctx);
    const targets = seedTargets(list, 1);
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    rec.missiles.length = 0;
    const brain = makeMobj(MobjType.BOSSBRAIN);
    aBrainSpit(brain);
    expect(rec.missiles[0]!.mobj.target).toBe(targets[0]!);
  });

  it('sets reactiontime = ((targ.y - mo.y) / momy) / state.tics', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({
      thinkerList: list,
      gameskill: 2,
      spawnMissileImpl: (source, _dest, type) => {
        const m = new Mobj();
        m.type = type;
        m.target = source;
        m.momy = 5;
        m.state = { ...STATES[1]!, tics: 2 };
        return m;
      },
    });
    setBossSpecialsContext(ctx);
    const targets = seedTargets(list, 1);
    targets[0]!.y = 100;
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    rec.missiles.length = 0;
    const brain = makeMobj(MobjType.BOSSBRAIN);
    brain.y = 0;
    aBrainSpit(brain);
    // (100 - 0)/5 = 20; 20 / 2 = 10.
    expect(rec.missiles[0]!.mobj.reactiontime).toBe(10);
  });

  it('plays sfx_bospit world-relative (origin null)', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list, gameskill: 2 });
    setBossSpecialsContext(ctx);
    seedTargets(list, 1);
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    rec.sounds.length = 0;
    aBrainSpit(makeMobj(MobjType.BOSSBRAIN));
    const spitSounds = rec.sounds.filter((s) => s.sfxId === SFX_BOSPIT);
    expect(spitSounds).toHaveLength(1);
    expect(spitSounds[0]!.origin).toBeNull();
  });

  it('round-robins through braintargets[]', () => {
    const list = new ThinkerList();
    const { ctx, rec } = makeMockContext({ thinkerList: list, gameskill: 2 });
    setBossSpecialsContext(ctx);
    const targets = seedTargets(list, 3);
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    rec.missiles.length = 0;
    const brain = makeMobj(MobjType.BOSSBRAIN);
    aBrainSpit(brain);
    aBrainSpit(brain);
    aBrainSpit(brain);
    aBrainSpit(brain);
    expect(rec.missiles[0]!.dest).toBe(targets[0]!);
    expect(rec.missiles[1]!.dest).toBe(targets[1]!);
    expect(rec.missiles[2]!.dest).toBe(targets[2]!);
    expect(rec.missiles[3]!.dest).toBe(targets[0]!); // wraps
  });

  it('consumes no RNG', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const { ctx } = makeMockContext({ rng, thinkerList: list, gameskill: 2 });
    setBossSpecialsContext(ctx);
    seedTargets(list, 1);
    aBrainAwake(makeMobj(MobjType.BOSSBRAIN));
    const before = rng.prndindex;
    aBrainSpit(makeMobj(MobjType.BOSSBRAIN));
    expect(rng.prndindex).toBe(before);
  });
});

// ── A_SpawnSound ────────────────────────────────────────────────────

describe('aSpawnSound', () => {
  it('plays sfx_boscub on the cube and delegates to aSpawnFly', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    const cube = makeMobj(MobjType.SPAWNSHOT);
    cube.reactiontime = 5;
    aSpawnSound(cube);
    expect(rec.sounds[0]).toEqual({ origin: cube, sfxId: SFX_BOSCUB });
    // aSpawnFly decremented reactiontime.
    expect(cube.reactiontime).toBe(4);
  });

  it('is safe when context is unset', () => {
    clearBossSpecialsContext();
    const cube = makeMobj(MobjType.SPAWNSHOT);
    expect(() => aSpawnSound(cube)).not.toThrow();
  });
});

// ── A_SpawnFly ──────────────────────────────────────────────────────

describe('aSpawnFly', () => {
  it('decrements reactiontime by 1 and returns silently when > 0', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setBossSpecialsContext(ctx);
    const cube = makeMobj(MobjType.SPAWNSHOT);
    cube.reactiontime = 3;
    const before = rng.prndindex;
    aSpawnFly(cube);
    expect(cube.reactiontime).toBe(2);
    expect(rec.spawned).toHaveLength(0);
    expect(rng.prndindex).toBe(before);
  });

  it('throws when reactiontime hits 0 with no target (P_SubstNullMobj guard)', () => {
    const { ctx } = makeMockContext();
    setBossSpecialsContext(ctx);
    const cube = makeMobj(MobjType.SPAWNSHOT);
    cube.reactiontime = 1;
    cube.target = null;
    expect(() => aSpawnFly(cube)).toThrow();
  });

  it('on hit-zero: spawns SPAWNFIRE at target.x/y/z, plays sfx_telept on fog', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    const cube = makeMobj(MobjType.SPAWNSHOT);
    cube.reactiontime = 1;
    const target = makeMobj(MobjType.BOSSTARGET);
    target.x = 100;
    target.y = 200;
    target.z = 50;
    cube.target = target;
    aSpawnFly(cube);
    const fogs = rec.spawned.filter((s) => s.type === MobjType.SPAWNFIRE);
    expect(fogs).toHaveLength(1);
    expect(fogs[0]!.x).toBe(100);
    expect(fogs[0]!.y).toBe(200);
    expect(fogs[0]!.z).toBe(50);
    const teleSounds = rec.sounds.filter((s) => s.sfxId === SFX_TELEPT);
    expect(teleSounds).toHaveLength(1);
    expect(teleSounds[0]!.origin).toBe(fogs[0]!.mobj);
  });

  it('rolls 1 P_Random for monster type via pickSpawnFlyType', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setBossSpecialsContext(ctx);
    const cube = makeMobj(MobjType.SPAWNSHOT);
    cube.reactiontime = 1;
    const target = makeMobj(MobjType.BOSSTARGET);
    cube.target = target;
    aSpawnFly(cube);
    // RNG_TABLE[1]=8, which falls in r<50 → MT_TROOP.
    const monsters = rec.spawned.filter((s) => s.type !== MobjType.SPAWNFIRE);
    expect(monsters).toHaveLength(1);
    expect(monsters[0]!.type).toBe(MobjType.TROOP);
    expect(rng.prndindex).toBe(1);
  });

  it('calls lookForPlayers(newmobj, true); on success transitions to seestate', () => {
    const { ctx, rec } = makeMockContext({ lookForPlayersResult: true });
    setBossSpecialsContext(ctx);
    const cube = makeMobj(MobjType.SPAWNSHOT);
    cube.reactiontime = 1;
    cube.target = makeMobj(MobjType.BOSSTARGET);
    aSpawnFly(cube);
    expect(rec.lookForPlayers).toHaveLength(1);
    expect(rec.lookForPlayers[0]!.allaround).toBe(true);
    expect(rec.setStates).toHaveLength(1);
    const expectedSee = (MOBJINFO[MobjType.TROOP]?.seestate ?? StateNum.NULL) as StateNum;
    expect(rec.setStates[0]!.state).toBe(expectedSee);
  });

  it('does NOT transition when lookForPlayers returns false', () => {
    const { ctx, rec } = makeMockContext({ lookForPlayersResult: false });
    setBossSpecialsContext(ctx);
    const cube = makeMobj(MobjType.SPAWNSHOT);
    cube.reactiontime = 1;
    cube.target = makeMobj(MobjType.BOSSTARGET);
    aSpawnFly(cube);
    expect(rec.setStates).toHaveLength(0);
  });

  it('teleportMoves the new monster (telefrag) and removes the cube', () => {
    const { ctx, rec } = makeMockContext();
    setBossSpecialsContext(ctx);
    const cube = makeMobj(MobjType.SPAWNSHOT);
    cube.reactiontime = 1;
    cube.target = makeMobj(MobjType.BOSSTARGET);
    aSpawnFly(cube);
    expect(rec.teleports).toHaveLength(1);
    expect(rec.removed).toEqual([cube]);
  });

  it('is safe when context is unset', () => {
    clearBossSpecialsContext();
    const cube = makeMobj(MobjType.SPAWNSHOT);
    cube.reactiontime = 5;
    expect(() => aSpawnFly(cube)).not.toThrow();
  });
});

// ── pickSpawnFlyType ────────────────────────────────────────────────

describe('pickSpawnFlyType', () => {
  it('matches the vanilla weighted distribution at boundaries', () => {
    expect(pickSpawnFlyType(0)).toBe(MobjType.TROOP);
    expect(pickSpawnFlyType(49)).toBe(MobjType.TROOP);
    expect(pickSpawnFlyType(50)).toBe(MobjType.SERGEANT);
    expect(pickSpawnFlyType(89)).toBe(MobjType.SERGEANT);
    expect(pickSpawnFlyType(90)).toBe(MobjType.SHADOWS);
    expect(pickSpawnFlyType(119)).toBe(MobjType.SHADOWS);
    expect(pickSpawnFlyType(120)).toBe(MobjType.PAIN);
    expect(pickSpawnFlyType(129)).toBe(MobjType.PAIN);
    expect(pickSpawnFlyType(130)).toBe(MobjType.HEAD);
    expect(pickSpawnFlyType(159)).toBe(MobjType.HEAD);
    expect(pickSpawnFlyType(160)).toBe(MobjType.VILE);
    expect(pickSpawnFlyType(161)).toBe(MobjType.VILE);
    expect(pickSpawnFlyType(162)).toBe(MobjType.UNDEAD);
    expect(pickSpawnFlyType(171)).toBe(MobjType.UNDEAD);
    expect(pickSpawnFlyType(172)).toBe(MobjType.BABY);
    expect(pickSpawnFlyType(191)).toBe(MobjType.BABY);
    expect(pickSpawnFlyType(192)).toBe(MobjType.FATSO);
    expect(pickSpawnFlyType(221)).toBe(MobjType.FATSO);
    expect(pickSpawnFlyType(222)).toBe(MobjType.KNIGHT);
    expect(pickSpawnFlyType(245)).toBe(MobjType.KNIGHT);
    expect(pickSpawnFlyType(246)).toBe(MobjType.BRUISER);
    expect(pickSpawnFlyType(255)).toBe(MobjType.BRUISER);
  });

  it('VILE and (162-171=)UNDEAD slots are tiny (rare arch-vile spawn)', () => {
    let vileCount = 0;
    let undeadCount = 0;
    for (let r = 0; r < 256; r++) {
      const t = pickSpawnFlyType(r);
      if (t === MobjType.VILE) vileCount++;
      if (t === MobjType.UNDEAD) undeadCount++;
    }
    expect(vileCount).toBe(2);
    expect(undeadCount).toBe(10);
  });
});

// ── wireBossSpecialsActions ─────────────────────────────────────────

describe('wireBossSpecialsActions', () => {
  const wiredStates = [
    StateNum.PAIN_DIE5,
    StateNum.COMMKEEN11,
    StateNum.FATT_DIE10,
    StateNum.BOSS_DIE7,
    StateNum.SPID_DIE11,
    StateNum.BSPI_DIE7,
    StateNum.CYBER_DIE10,
    StateNum.CYBER_RUN1,
    StateNum.SPID_RUN1,
    StateNum.SPID_RUN5,
    StateNum.SPID_RUN9,
    StateNum.CYBER_RUN7,
    StateNum.BSPI_RUN1,
    StateNum.BSPI_RUN7,
    StateNum.BRAINEYESEE,
    StateNum.BRAINEYE1,
    StateNum.BRAIN_PAIN,
    StateNum.BRAIN_DIE1,
    StateNum.BRAIN_DIE4,
    StateNum.BRAINEXPLODE3,
    StateNum.SPAWN1,
    StateNum.SPAWN2,
    StateNum.SPAWN3,
    StateNum.SPAWN4,
  ] as const;

  let saved: Map<StateNum, ((mobj: Mobj) => void) | null>;

  beforeEach(() => {
    saved = new Map();
    for (const s of wiredStates) saved.set(s, STATES[s]!.action);
  });

  afterEach(() => {
    for (const [s, action] of saved) STATES[s]!.action = action;
  });

  it('wires exactly BOSS_SPECIALS_ACTION_COUNT (24) STATES entries', () => {
    expect(wiredStates.length).toBe(BOSS_SPECIALS_ACTION_COUNT);
    wireBossSpecialsActions();
    for (const s of wiredStates) expect(STATES[s]!.action).not.toBeNull();
  });

  it('wires aPainDie to PAIN_DIE5 and aKeenDie to COMMKEEN11', () => {
    wireBossSpecialsActions();
    expect(STATES[StateNum.PAIN_DIE5]!.action).toBe(aPainDie);
    expect(STATES[StateNum.COMMKEEN11]!.action).toBe(aKeenDie);
  });

  it('wires aBossDeath to all 5 boss-end death frames', () => {
    wireBossSpecialsActions();
    expect(STATES[StateNum.FATT_DIE10]!.action).toBe(aBossDeath);
    expect(STATES[StateNum.BOSS_DIE7]!.action).toBe(aBossDeath);
    expect(STATES[StateNum.SPID_DIE11]!.action).toBe(aBossDeath);
    expect(STATES[StateNum.BSPI_DIE7]!.action).toBe(aBossDeath);
    expect(STATES[StateNum.CYBER_DIE10]!.action).toBe(aBossDeath);
  });

  it('wires aHoof/aMetal/aBabyMetal to RUN frames (mid-step footfalls)', () => {
    wireBossSpecialsActions();
    expect(STATES[StateNum.CYBER_RUN1]!.action).toBe(aHoof);
    expect(STATES[StateNum.SPID_RUN1]!.action).toBe(aMetal);
    expect(STATES[StateNum.SPID_RUN5]!.action).toBe(aMetal);
    expect(STATES[StateNum.SPID_RUN9]!.action).toBe(aMetal);
    expect(STATES[StateNum.CYBER_RUN7]!.action).toBe(aMetal);
    expect(STATES[StateNum.BSPI_RUN1]!.action).toBe(aBabyMetal);
    expect(STATES[StateNum.BSPI_RUN7]!.action).toBe(aBabyMetal);
  });

  it('wires brain action functions to the correct brain frames', () => {
    wireBossSpecialsActions();
    expect(STATES[StateNum.BRAINEYESEE]!.action).toBe(aBrainAwake);
    expect(STATES[StateNum.BRAINEYE1]!.action).toBe(aBrainSpit);
    expect(STATES[StateNum.BRAIN_PAIN]!.action).toBe(aBrainPain);
    expect(STATES[StateNum.BRAIN_DIE1]!.action).toBe(aBrainScream);
    expect(STATES[StateNum.BRAIN_DIE4]!.action).toBe(aBrainDie);
    expect(STATES[StateNum.BRAINEXPLODE3]!.action).toBe(aBrainExplode);
  });

  it('wires aSpawnSound to SPAWN1 and aSpawnFly to SPAWN2/3/4', () => {
    wireBossSpecialsActions();
    expect(STATES[StateNum.SPAWN1]!.action).toBe(aSpawnSound);
    expect(STATES[StateNum.SPAWN2]!.action).toBe(aSpawnFly);
    expect(STATES[StateNum.SPAWN3]!.action).toBe(aSpawnFly);
    expect(STATES[StateNum.SPAWN4]!.action).toBe(aSpawnFly);
  });

  it('is idempotent (second call reassigns same pointers)', () => {
    wireBossSpecialsActions();
    const first = wiredStates.map((s) => STATES[s]!.action);
    wireBossSpecialsActions();
    const second = wiredStates.map((s) => STATES[s]!.action);
    for (let i = 0; i < first.length; i++) expect(second[i]).toBe(first[i]!);
  });
});

// keep MF_CORPSE / MF_NOGRAVITY imports referenced (paired with MF_SOLID)
void MF_CORPSE;
void MF_NOGRAVITY;
