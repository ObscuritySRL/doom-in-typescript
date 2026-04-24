import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import type { GameMode } from '../../src/bootstrap/gameMode.ts';
import { DoomRandom, RNG_TABLE } from '../../src/core/rng.ts';

import { MF_CORPSE, MF_NOGRAVITY, MF_SHOOTABLE, MF_SOLID, MF_TRANSLATION, MOBJINFO, Mobj, MobjType, STATES, StateNum } from '../../src/world/mobj.ts';

import {
  EXPLODE_DAMAGE,
  PAIN_DEATH_ACTION_COUNT,
  PLAYER_SCREAM_GIB_HEALTH,
  SFX_BGDTH1,
  SFX_BGDTH2,
  SFX_PDIEHI,
  SFX_PLDETH,
  SFX_PODTH1,
  SFX_PODTH2,
  SFX_PODTH3,
  SFX_SLOP,
  aExplode,
  aFall,
  aPain,
  aPlayerScream,
  aScream,
  aXScream,
  clearStateTransitionContext,
  getStateTransitionContext,
  setStateTransitionContext,
  wirePainDeathActions,
} from '../../src/ai/stateTransitions.ts';
import type { RadiusAttackCallback, StartSoundFunction, StateTransitionContext } from '../../src/ai/stateTransitions.ts';

// ── Helpers ──────────────────────────────────────────────────────────

interface Recorder {
  sounds: Array<{ origin: Mobj | null; sfxId: number }>;
  radius: Array<{ spot: Mobj; source: Mobj | null; damage: number }>;
}

interface MockOptions {
  rng?: DoomRandom;
  gameMode?: GameMode;
  startSound?: StartSoundFunction | null;
}

function makeMockContext(opts: MockOptions = {}): {
  ctx: StateTransitionContext;
  rec: Recorder;
} {
  const rec: Recorder = { sounds: [], radius: [] };

  const startSound: StartSoundFunction | null =
    opts.startSound === null
      ? null
      : (opts.startSound ??
        ((origin, sfxId) => {
          rec.sounds.push({ origin, sfxId });
        }));

  const radiusAttack: RadiusAttackCallback = (spot, source, damage) => {
    rec.radius.push({ spot, source, damage });
  };

  const ctx: StateTransitionContext = {
    rng: opts.rng ?? new DoomRandom(),
    startSound,
    radiusAttack,
    gameMode: () => opts.gameMode ?? 'registered',
  };
  return { ctx, rec };
}

function makeMobj(type: MobjType = MobjType.TROOP): Mobj {
  const mobj = new Mobj();
  mobj.type = type;
  mobj.info = MOBJINFO[type] ?? null;
  mobj.flags = MF_SHOOTABLE;
  mobj.health = 100;
  return mobj;
}

afterEach(() => {
  clearStateTransitionContext();
});

// ── Constants ────────────────────────────────────────────────────────

describe('state transition constants', () => {
  it('SFX constants match sounds.h sfxenum_t indices', () => {
    expect(SFX_SLOP).toBe(31);
    expect(SFX_PLDETH).toBe(54);
    expect(SFX_PDIEHI).toBe(55);
    expect(SFX_PODTH1).toBe(56);
    expect(SFX_PODTH2).toBe(57);
    expect(SFX_PODTH3).toBe(58);
    expect(SFX_BGDTH1).toBe(59);
    expect(SFX_BGDTH2).toBe(60);
  });

  it('EXPLODE_DAMAGE matches P_RadiusAttack(thingy, target, 128)', () => {
    expect(EXPLODE_DAMAGE).toBe(128);
  });

  it('PLAYER_SCREAM_GIB_HEALTH is -50 (strict <)', () => {
    expect(PLAYER_SCREAM_GIB_HEALTH).toBe(-50);
  });

  it('PAIN_DEATH_ACTION_COUNT is 69', () => {
    expect(PAIN_DEATH_ACTION_COUNT).toBe(69);
  });
});

// ── Context round-trip ──────────────────────────────────────────────

describe('state transition context', () => {
  it('set/get round-trip', () => {
    const { ctx } = makeMockContext();
    setStateTransitionContext(ctx);
    expect(getStateTransitionContext()).toBe(ctx);
  });

  it('clearStateTransitionContext returns null', () => {
    const { ctx } = makeMockContext();
    setStateTransitionContext(ctx);
    clearStateTransitionContext();
    expect(getStateTransitionContext()).toBeNull();
  });
});

// ── A_Pain ───────────────────────────────────────────────────────────

describe('aPain', () => {
  it('plays painsound when info.painsound is non-zero', () => {
    const { ctx, rec } = makeMockContext();
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.TROOP);
    const expected = actor.info!.painsound;
    expect(expected).toBeGreaterThan(0);

    aPain(actor);

    expect(rec.sounds).toHaveLength(1);
    expect(rec.sounds[0]).toEqual({ origin: actor, sfxId: expected });
  });

  it('is silent when info.painsound is 0', () => {
    const { ctx, rec } = makeMockContext();
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.TROOP);
    actor.info = { ...actor.info!, painsound: 0 };

    aPain(actor);

    expect(rec.sounds).toHaveLength(0);
  });

  it('is safe when info is null', () => {
    const { ctx, rec } = makeMockContext();
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.TROOP);
    actor.info = null;

    expect(() => aPain(actor)).not.toThrow();
    expect(rec.sounds).toHaveLength(0);
  });

  it('is safe when context is unset', () => {
    clearStateTransitionContext();
    const actor = makeMobj(MobjType.TROOP);
    expect(() => aPain(actor)).not.toThrow();
  });

  it('consumes no RNG', () => {
    const rng = new DoomRandom();
    const { ctx } = makeMockContext({ rng });
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.TROOP);

    const before = rng.prndindex;
    aPain(actor);
    expect(rng.prndindex).toBe(before);
  });
});

// ── A_Scream ─────────────────────────────────────────────────────────

describe('aScream', () => {
  it('is silent when info.deathsound is 0 (no RNG)', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.TROOP);
    actor.info = { ...actor.info!, deathsound: 0 };

    const before = rng.prndindex;
    aScream(actor);

    expect(rec.sounds).toHaveLength(0);
    expect(rng.prndindex).toBe(before);
  });

  it('plays deathsound verbatim with zero RNG for non-cycling sounds', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.TROOP);
    const expected = actor.info!.deathsound;
    expect(expected).not.toBe(0);
    expect(expected < SFX_PODTH1 || expected > SFX_BGDTH2).toBe(true);

    const before = rng.prndindex;
    aScream(actor);

    expect(rec.sounds).toHaveLength(1);
    expect(rec.sounds[0]).toEqual({ origin: actor, sfxId: expected });
    expect(rng.prndindex).toBe(before);
  });

  it('cycles podth1/2/3 with exactly 1 RNG (roll=8 → podth1+8%3=podth3)', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.TROOP);
    actor.info = { ...actor.info!, deathsound: SFX_PODTH1 };

    aScream(actor);

    expect(rng.prndindex).toBe(1);
    expect(rec.sounds).toHaveLength(1);
    expect(rec.sounds[0]!.sfxId).toBe(SFX_PODTH1 + (RNG_TABLE[1]! % 3));
    expect(rec.sounds[0]!.sfxId).toBe(SFX_PODTH3);
  });

  it('cycles podth1/2/3 when deathsound is podth2 or podth3 (vanilla parity)', () => {
    for (const seed of [SFX_PODTH2, SFX_PODTH3]) {
      const rng = new DoomRandom();
      const { ctx, rec } = makeMockContext({ rng });
      setStateTransitionContext(ctx);
      const actor = makeMobj(MobjType.TROOP);
      actor.info = { ...actor.info!, deathsound: seed };

      aScream(actor);

      expect(rng.prndindex).toBe(1);
      expect(rec.sounds[0]!.sfxId).toBe(SFX_PODTH1 + (RNG_TABLE[1]! % 3));
    }
  });

  it('cycles bgdth1/2 with exactly 1 RNG (roll=8 → bgdth1+8%2=bgdth1)', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.POSSESSED);
    actor.info = { ...actor.info!, deathsound: SFX_BGDTH1 };

    aScream(actor);

    expect(rng.prndindex).toBe(1);
    expect(rec.sounds).toHaveLength(1);
    expect(rec.sounds[0]!.sfxId).toBe(SFX_BGDTH1 + (RNG_TABLE[1]! % 2));
    expect(rec.sounds[0]!.sfxId).toBe(SFX_BGDTH1);
  });

  it('cycles bgdth1/2 when deathsound is bgdth2 too', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.POSSESSED);
    actor.info = { ...actor.info!, deathsound: SFX_BGDTH2 };

    aScream(actor);

    expect(rng.prndindex).toBe(1);
    expect(rec.sounds[0]!.sfxId).toBe(SFX_BGDTH1 + (RNG_TABLE[1]! % 2));
  });

  it('uses null origin for MT_SPIDER (mastermind world-relative roar)', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.SPIDER);
    expect(actor.info!.deathsound).not.toBe(0);

    aScream(actor);

    expect(rec.sounds).toHaveLength(1);
    expect(rec.sounds[0]!.origin).toBeNull();
    expect(rec.sounds[0]!.sfxId).toBe(actor.info!.deathsound);
  });

  it('uses null origin for MT_CYBORG (cyberdemon world-relative roar)', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.CYBORG);
    expect(actor.info!.deathsound).not.toBe(0);

    aScream(actor);

    expect(rec.sounds).toHaveLength(1);
    expect(rec.sounds[0]!.origin).toBeNull();
    expect(rec.sounds[0]!.sfxId).toBe(actor.info!.deathsound);
  });

  it('uses actor as origin for non-boss types (cacodemon)', () => {
    const { ctx, rec } = makeMockContext();
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.HEAD);

    aScream(actor);

    expect(rec.sounds).toHaveLength(1);
    expect(rec.sounds[0]!.origin).toBe(actor);
  });

  it('is safe when info is null', () => {
    const { ctx, rec } = makeMockContext();
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.TROOP);
    actor.info = null;

    expect(() => aScream(actor)).not.toThrow();
    expect(rec.sounds).toHaveLength(0);
  });

  it('is safe when context is unset', () => {
    clearStateTransitionContext();
    const actor = makeMobj(MobjType.TROOP);
    expect(() => aScream(actor)).not.toThrow();
  });

  it('is safe when startSound is null', () => {
    const rng = new DoomRandom();
    const { ctx } = makeMockContext({ rng, startSound: null });
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.TROOP);
    actor.info = { ...actor.info!, deathsound: SFX_PODTH1 };

    expect(() => aScream(actor)).not.toThrow();
    expect(rng.prndindex).toBe(1);
  });
});

// ── A_XScream ────────────────────────────────────────────────────────

describe('aXScream', () => {
  it('plays SFX_SLOP on the actor (no RNG)', () => {
    const rng = new DoomRandom();
    const { ctx, rec } = makeMockContext({ rng });
    setStateTransitionContext(ctx);
    const actor = makeMobj(MobjType.TROOP);

    const before = rng.prndindex;
    aXScream(actor);

    expect(rec.sounds).toHaveLength(1);
    expect(rec.sounds[0]).toEqual({ origin: actor, sfxId: SFX_SLOP });
    expect(rng.prndindex).toBe(before);
  });

  it('does not vary by monster type', () => {
    for (const t of [MobjType.PLAYER, MobjType.SPIDER, MobjType.CYBORG, MobjType.WOLFSS]) {
      const { ctx, rec } = makeMockContext();
      setStateTransitionContext(ctx);
      const actor = makeMobj(t);
      aXScream(actor);
      expect(rec.sounds[0]).toEqual({ origin: actor, sfxId: SFX_SLOP });
    }
  });

  it('is safe when context is unset', () => {
    clearStateTransitionContext();
    const actor = makeMobj(MobjType.TROOP);
    expect(() => aXScream(actor)).not.toThrow();
  });
});

// ── A_PlayerScream ───────────────────────────────────────────────────

describe('aPlayerScream', () => {
  it('plays SFX_PLDETH on non-commercial regardless of health', () => {
    for (const mode of ['shareware', 'registered', 'retail', 'indetermined'] as GameMode[]) {
      for (const health of [100, 0, -50, -51, -100]) {
        const { ctx, rec } = makeMockContext({ gameMode: mode });
        setStateTransitionContext(ctx);
        const mo = makeMobj(MobjType.PLAYER);
        mo.health = health;
        aPlayerScream(mo);
        expect(rec.sounds[0]).toEqual({ origin: mo, sfxId: SFX_PLDETH });
      }
    }
  });

  it('plays SFX_PLDETH on commercial when health > -50', () => {
    const { ctx, rec } = makeMockContext({ gameMode: 'commercial' });
    setStateTransitionContext(ctx);
    const mo = makeMobj(MobjType.PLAYER);
    mo.health = 100;
    aPlayerScream(mo);
    expect(rec.sounds[0]!.sfxId).toBe(SFX_PLDETH);
  });

  it('plays SFX_PLDETH on commercial when health == -50 (strict <)', () => {
    const { ctx, rec } = makeMockContext({ gameMode: 'commercial' });
    setStateTransitionContext(ctx);
    const mo = makeMobj(MobjType.PLAYER);
    mo.health = -50;
    aPlayerScream(mo);
    expect(rec.sounds[0]!.sfxId).toBe(SFX_PLDETH);
  });

  it('plays SFX_PDIEHI on commercial when health == -51 (just past threshold)', () => {
    const { ctx, rec } = makeMockContext({ gameMode: 'commercial' });
    setStateTransitionContext(ctx);
    const mo = makeMobj(MobjType.PLAYER);
    mo.health = -51;
    aPlayerScream(mo);
    expect(rec.sounds[0]!.sfxId).toBe(SFX_PDIEHI);
  });

  it('plays SFX_PDIEHI on commercial when health is deeply negative', () => {
    const { ctx, rec } = makeMockContext({ gameMode: 'commercial' });
    setStateTransitionContext(ctx);
    const mo = makeMobj(MobjType.PLAYER);
    mo.health = -200;
    aPlayerScream(mo);
    expect(rec.sounds[0]!.sfxId).toBe(SFX_PDIEHI);
  });

  it('plays sound on the player (origin = mo)', () => {
    const { ctx, rec } = makeMockContext({ gameMode: 'commercial' });
    setStateTransitionContext(ctx);
    const mo = makeMobj(MobjType.PLAYER);
    mo.health = -100;
    aPlayerScream(mo);
    expect(rec.sounds[0]!.origin).toBe(mo);
  });

  it('consumes no RNG', () => {
    const rng = new DoomRandom();
    const { ctx } = makeMockContext({ rng, gameMode: 'commercial' });
    setStateTransitionContext(ctx);
    const mo = makeMobj(MobjType.PLAYER);
    mo.health = -100;

    const before = rng.prndindex;
    aPlayerScream(mo);
    expect(rng.prndindex).toBe(before);
  });

  it('is safe when context is unset', () => {
    clearStateTransitionContext();
    const mo = makeMobj(MobjType.PLAYER);
    expect(() => aPlayerScream(mo)).not.toThrow();
  });
});

// ── A_Fall ───────────────────────────────────────────────────────────

describe('aFall', () => {
  it('clears MF_SOLID when set', () => {
    const actor = makeMobj(MobjType.TROOP);
    actor.flags = MF_SOLID | MF_SHOOTABLE;
    aFall(actor);
    expect(actor.flags & MF_SOLID).toBe(0);
  });

  it('preserves all other flag bits (MF_CORPSE, MF_SHOOTABLE, MF_NOGRAVITY, MF_TRANSLATION)', () => {
    const actor = makeMobj(MobjType.TROOP);
    actor.flags = MF_SOLID | MF_SHOOTABLE | MF_CORPSE | MF_NOGRAVITY | MF_TRANSLATION;
    aFall(actor);
    expect(actor.flags & MF_SOLID).toBe(0);
    expect(actor.flags & MF_SHOOTABLE).toBe(MF_SHOOTABLE);
    expect(actor.flags & MF_CORPSE).toBe(MF_CORPSE);
    expect(actor.flags & MF_NOGRAVITY).toBe(MF_NOGRAVITY);
    expect(actor.flags & MF_TRANSLATION).toBe(MF_TRANSLATION);
  });

  it('is idempotent when MF_SOLID already cleared', () => {
    const actor = makeMobj(MobjType.TROOP);
    actor.flags = MF_SHOOTABLE | MF_CORPSE;
    const before = actor.flags;
    aFall(actor);
    aFall(actor);
    expect(actor.flags).toBe(before);
  });

  it('does not require context (pure flag mutation)', () => {
    clearStateTransitionContext();
    const actor = makeMobj(MobjType.TROOP);
    actor.flags = MF_SOLID;
    expect(() => aFall(actor)).not.toThrow();
    expect(actor.flags).toBe(0);
  });
});

// ── A_Explode ────────────────────────────────────────────────────────

describe('aExplode', () => {
  it('calls radiusAttack(thingy, thingy.target, EXPLODE_DAMAGE)', () => {
    const { ctx, rec } = makeMockContext();
    setStateTransitionContext(ctx);
    const thingy = makeMobj(MobjType.ROCKET);
    const target = makeMobj(MobjType.PLAYER);
    thingy.target = target;

    aExplode(thingy);

    expect(rec.radius).toHaveLength(1);
    expect(rec.radius[0]).toEqual({
      spot: thingy,
      source: target,
      damage: EXPLODE_DAMAGE,
    });
  });

  it('forwards null target (barrel that exploded undamaged)', () => {
    const { ctx, rec } = makeMockContext();
    setStateTransitionContext(ctx);
    const barrel = makeMobj(MobjType.BARREL);
    barrel.target = null;

    aExplode(barrel);

    expect(rec.radius).toHaveLength(1);
    expect(rec.radius[0]).toEqual({
      spot: barrel,
      source: null,
      damage: EXPLODE_DAMAGE,
    });
  });

  it('consumes no RNG', () => {
    const rng = new DoomRandom();
    const { ctx } = makeMockContext({ rng });
    setStateTransitionContext(ctx);
    const thingy = makeMobj(MobjType.ROCKET);

    const before = rng.prndindex;
    aExplode(thingy);
    expect(rng.prndindex).toBe(before);
  });

  it('is safe when context is unset', () => {
    clearStateTransitionContext();
    const thingy = makeMobj(MobjType.ROCKET);
    expect(() => aExplode(thingy)).not.toThrow();
  });
});

// ── wirePainDeathActions ─────────────────────────────────────────────

describe('wirePainDeathActions', () => {
  const wiredStates = [
    StateNum.PLAY_PAIN2,
    StateNum.PLAY_DIE2,
    StateNum.PLAY_DIE3,
    StateNum.PLAY_XDIE2,
    StateNum.PLAY_XDIE3,
    StateNum.POSS_PAIN2,
    StateNum.POSS_DIE2,
    StateNum.POSS_DIE3,
    StateNum.POSS_XDIE2,
    StateNum.POSS_XDIE3,
    StateNum.SPOS_PAIN2,
    StateNum.SPOS_DIE2,
    StateNum.SPOS_DIE3,
    StateNum.SPOS_XDIE2,
    StateNum.SPOS_XDIE3,
    StateNum.VILE_PAIN2,
    StateNum.VILE_DIE2,
    StateNum.VILE_DIE3,
    StateNum.SKEL_PAIN2,
    StateNum.SKEL_DIE3,
    StateNum.SKEL_DIE4,
    StateNum.FATT_PAIN2,
    StateNum.FATT_DIE2,
    StateNum.FATT_DIE3,
    StateNum.CPOS_PAIN2,
    StateNum.CPOS_DIE2,
    StateNum.CPOS_DIE3,
    StateNum.CPOS_XDIE2,
    StateNum.CPOS_XDIE3,
    StateNum.TROO_PAIN2,
    StateNum.TROO_DIE2,
    StateNum.TROO_XDIE2,
    StateNum.TROO_XDIE4,
    StateNum.SARG_PAIN2,
    StateNum.SARG_DIE2,
    StateNum.SARG_DIE4,
    StateNum.HEAD_PAIN2,
    StateNum.HEAD_DIE2,
    StateNum.HEAD_DIE5,
    StateNum.BOSS_PAIN2,
    StateNum.BOSS_DIE2,
    StateNum.BOSS_DIE4,
    StateNum.BOS2_PAIN2,
    StateNum.BOS2_DIE2,
    StateNum.BOS2_DIE4,
    StateNum.SKULL_PAIN2,
    StateNum.SKULL_DIE2,
    StateNum.SKULL_DIE4,
    StateNum.SPID_PAIN2,
    StateNum.SPID_DIE1,
    StateNum.SPID_DIE2,
    StateNum.BSPI_PAIN2,
    StateNum.BSPI_DIE1,
    StateNum.BSPI_DIE2,
    StateNum.CYBER_PAIN,
    StateNum.CYBER_DIE2,
    StateNum.CYBER_DIE6,
    StateNum.PAIN_PAIN2,
    StateNum.PAIN_DIE2,
    StateNum.SSWV_PAIN2,
    StateNum.SSWV_DIE2,
    StateNum.SSWV_DIE3,
    StateNum.SSWV_XDIE2,
    StateNum.SSWV_XDIE3,
    StateNum.COMMKEEN3,
    StateNum.KEENPAIN2,
    StateNum.EXPLODE1,
    StateNum.BEXP2,
    StateNum.BEXP4,
  ] as const;

  let saved: Map<StateNum, ((mobj: Mobj) => void) | null>;

  beforeEach(() => {
    saved = new Map();
    for (const s of wiredStates) {
      saved.set(s, STATES[s]!.action);
    }
  });

  afterEach(() => {
    for (const [s, action] of saved) {
      STATES[s]!.action = action;
    }
  });

  it('wires all PAIN_DEATH_ACTION_COUNT (69) STATES entries', () => {
    expect(wiredStates.length).toBe(PAIN_DEATH_ACTION_COUNT);
    wirePainDeathActions();
    for (const s of wiredStates) {
      expect(STATES[s]!.action).not.toBeNull();
    }
  });

  it('wires aPain to every painstate-2 frame', () => {
    wirePainDeathActions();
    const painStates = [
      StateNum.PLAY_PAIN2,
      StateNum.POSS_PAIN2,
      StateNum.SPOS_PAIN2,
      StateNum.VILE_PAIN2,
      StateNum.SKEL_PAIN2,
      StateNum.FATT_PAIN2,
      StateNum.CPOS_PAIN2,
      StateNum.TROO_PAIN2,
      StateNum.SARG_PAIN2,
      StateNum.HEAD_PAIN2,
      StateNum.BOSS_PAIN2,
      StateNum.BOS2_PAIN2,
      StateNum.SKULL_PAIN2,
      StateNum.SPID_PAIN2,
      StateNum.BSPI_PAIN2,
      StateNum.CYBER_PAIN,
      StateNum.PAIN_PAIN2,
      StateNum.SSWV_PAIN2,
      StateNum.KEENPAIN2,
    ];
    for (const s of painStates) {
      expect(STATES[s]!.action).toBe(aPain);
    }
  });

  it('wires aScream to monster death-chain frames', () => {
    wirePainDeathActions();
    const screamStates = [
      StateNum.POSS_DIE2,
      StateNum.SPOS_DIE2,
      StateNum.VILE_DIE2,
      StateNum.SKEL_DIE3,
      StateNum.FATT_DIE2,
      StateNum.CPOS_DIE2,
      StateNum.TROO_DIE2,
      StateNum.SARG_DIE2,
      StateNum.HEAD_DIE2,
      StateNum.BOSS_DIE2,
      StateNum.BOS2_DIE2,
      StateNum.SKULL_DIE2,
      StateNum.SPID_DIE1,
      StateNum.BSPI_DIE1,
      StateNum.CYBER_DIE2,
      StateNum.PAIN_DIE2,
      StateNum.SSWV_DIE2,
      StateNum.COMMKEEN3,
      StateNum.BEXP2,
    ];
    for (const s of screamStates) {
      expect(STATES[s]!.action).toBe(aScream);
    }
  });

  it('wires aXScream to extreme-death frames only', () => {
    wirePainDeathActions();
    const xscreamStates = [StateNum.PLAY_XDIE2, StateNum.POSS_XDIE2, StateNum.SPOS_XDIE2, StateNum.CPOS_XDIE2, StateNum.TROO_XDIE2, StateNum.SSWV_XDIE2];
    for (const s of xscreamStates) {
      expect(STATES[s]!.action).toBe(aXScream);
    }
  });

  it('wires aFall to corpse-settle frames in both ordinary and extreme death chains', () => {
    wirePainDeathActions();
    const fallStates = [
      StateNum.PLAY_DIE3,
      StateNum.PLAY_XDIE3,
      StateNum.POSS_DIE3,
      StateNum.POSS_XDIE3,
      StateNum.SPOS_DIE3,
      StateNum.SPOS_XDIE3,
      StateNum.VILE_DIE3,
      StateNum.SKEL_DIE4,
      StateNum.FATT_DIE3,
      StateNum.CPOS_DIE3,
      StateNum.CPOS_XDIE3,
      StateNum.TROO_XDIE4,
      StateNum.SARG_DIE4,
      StateNum.HEAD_DIE5,
      StateNum.BOSS_DIE4,
      StateNum.BOS2_DIE4,
      StateNum.SKULL_DIE4,
      StateNum.SPID_DIE2,
      StateNum.BSPI_DIE2,
      StateNum.CYBER_DIE6,
      StateNum.SSWV_DIE3,
      StateNum.SSWV_XDIE3,
    ];
    for (const s of fallStates) {
      expect(STATES[s]!.action).toBe(aFall);
    }
  });

  it('wires aExplode to S_EXPLODE1 (rocket) and S_BEXP4 (barrel)', () => {
    wirePainDeathActions();
    expect(STATES[StateNum.EXPLODE1]!.action).toBe(aExplode);
    expect(STATES[StateNum.BEXP4]!.action).toBe(aExplode);
  });

  it('wires aPlayerScream to PLAY_DIE2 only', () => {
    wirePainDeathActions();
    expect(STATES[StateNum.PLAY_DIE2]!.action).toBe(aPlayerScream);
  });

  it('is idempotent (second call reassigns same pointers)', () => {
    wirePainDeathActions();
    const firstSnapshot = wiredStates.map((s) => STATES[s]!.action);
    wirePainDeathActions();
    const secondSnapshot = wiredStates.map((s) => STATES[s]!.action);
    for (let i = 0; i < firstSnapshot.length; i++) {
      expect(secondSnapshot[i]).toBe(firstSnapshot[i]!);
    }
  });
});
