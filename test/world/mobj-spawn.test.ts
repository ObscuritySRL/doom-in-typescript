import { describe, expect, it } from 'bun:test';

import { DoomRandom } from '../../src/core/rng.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { ThinkerList, REMOVED } from '../../src/world/thinkers.ts';
import {
  MAXPLAYERS,
  MF_COUNTKILL,
  MF_SHOOTABLE,
  MF_SOLID,
  MF_SPECIAL,
  MOBJ_CYCLE_LIMIT,
  Mobj,
  MOBJINFO,
  MobjType,
  ONCEILINGZ,
  ONFLOORZ,
  STATES,
  StateNum,
  SpriteNum,
  mobjThinker,
  removeMobj,
  setMobjState,
  spawnMobj,
} from '../../src/world/mobj.ts';

import type { ActionFunction } from '../../src/world/mobj.ts';

describe('state table integrity', () => {
  it('has exactly 967 entries (NUMSTATES)', () => {
    expect(STATES.length).toBe(StateNum.NUMSTATES);
    expect(STATES.length).toBe(967);
  });

  it('S_NULL is entry 0 with tics -1 and nextstate 0', () => {
    const s = STATES[StateNum.NULL]!;
    expect(s.tics).toBe(-1);
    expect(s.nextstate).toBe(StateNum.NULL);
  });

  it('every nextstate is a valid index', () => {
    for (let index = 0; index < STATES.length; index++) {
      const state = STATES[index]!;
      expect(state.nextstate).toBeGreaterThanOrEqual(0);
      expect(state.nextstate).toBeLessThan(StateNum.NUMSTATES);
    }
  });

  it('every sprite is a valid SpriteNum (ignoring fullbright flag)', () => {
    for (let index = 0; index < STATES.length; index++) {
      const state = STATES[index]!;
      // frame can have FF_FULLBRIGHT (0x8000) set, sprite should be clean
      expect(state.sprite).toBeGreaterThanOrEqual(0);
      expect(state.sprite).toBeLessThan(SpriteNum.NUMSPRITES);
    }
  });
});

describe('mobjinfo table integrity', () => {
  it('has exactly 137 entries (NUMMOBJTYPES)', () => {
    expect(MOBJINFO.length).toBe(MobjType.NUMMOBJTYPES);
    expect(MOBJINFO.length).toBe(137);
  });

  it('every spawnstate is a valid state index', () => {
    for (let index = 0; index < MOBJINFO.length; index++) {
      const info = MOBJINFO[index]!;
      expect(info.spawnstate).toBeGreaterThanOrEqual(0);
      expect(info.spawnstate).toBeLessThan(StateNum.NUMSTATES);
    }
  });

  it('MT_POSSESSED has doomednum 3004', () => {
    expect(MOBJINFO[MobjType.POSSESSED]!.doomednum).toBe(3004);
  });

  it('MT_PLAYER has doomednum -1 (not spawned by editor number)', () => {
    expect(MOBJINFO[MobjType.PLAYER]!.doomednum).toBe(-1);
  });

  it('MT_TROOP has doomednum 3001 and correct dimensions', () => {
    const info = MOBJINFO[MobjType.TROOP]!;
    expect(info.doomednum).toBe(3001);
    expect(info.radius).toBe(20 * FRACUNIT);
    expect(info.height).toBe(56 * FRACUNIT);
    expect(info.spawnhealth).toBe(60);
  });

  it('radius and height are in fixed-point (FRACUNIT multiples)', () => {
    for (let index = 0; index < MOBJINFO.length; index++) {
      const info = MOBJINFO[index]!;
      expect(info.radius % FRACUNIT).toBe(0);
      expect(info.height % FRACUNIT).toBe(0);
    }
  });
});

describe('spawnMobj', () => {
  it('creates a Mobj instance added to the thinker list', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    expect(mobj).toBeInstanceOf(Mobj);
    expect(list.isEmpty).toBe(false);
  });

  it('sets position from arguments', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(100 * FRACUNIT, 200 * FRACUNIT, ONFLOORZ, MobjType.POSSESSED, rng, list);

    expect(mobj.x).toBe(100 * FRACUNIT);
    expect(mobj.y).toBe(200 * FRACUNIT);
  });

  it('populates fields from mobjinfo', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);
    const info = MOBJINFO[MobjType.POSSESSED]!;

    expect(mobj.type).toBe(MobjType.POSSESSED);
    expect(mobj.info).toBe(info);
    expect(mobj.radius).toBe(info.radius);
    expect(mobj.height).toBe(info.height);
    expect(mobj.flags).toBe(info.flags);
    expect(mobj.health).toBe(info.spawnhealth);
  });

  it('sets initial state from mobjinfo.spawnstate', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);
    const expectedState = STATES[MOBJINFO[MobjType.POSSESSED]!.spawnstate]!;

    expect(mobj.state).toBe(expectedState);
    expect(mobj.sprite).toBe(expectedState.sprite);
    expect(mobj.frame).toBe(expectedState.frame);
    expect(mobj.tics).toBe(expectedState.tics);
  });

  it('sets reactiontime from mobjinfo on non-nightmare skill', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list, 2);

    expect(mobj.reactiontime).toBe(MOBJINFO[MobjType.POSSESSED]!.reactiontime);
  });

  it('skips reactiontime on nightmare skill (5)', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list, 5);

    expect(mobj.reactiontime).toBe(0);
  });

  it('sets lastlook from P_Random() % MAXPLAYERS', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    expect(mobj.lastlook).toBeGreaterThanOrEqual(0);
    expect(mobj.lastlook).toBeLessThan(MAXPLAYERS);
  });

  it('consumes exactly one P_Random call for lastlook', () => {
    const rng1 = new DoomRandom();
    const rng2 = new DoomRandom();
    const list = new ThinkerList();

    const expectedLastlook = rng1.pRandom() % MAXPLAYERS;
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng2, list);

    expect(mobj.lastlook).toBe(expectedLastlook);
    expect(rng2.prndindex).toBe(rng1.prndindex);
  });

  it('places on floor when z is ONFLOORZ', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    // Without subsector set, floorz defaults to 0
    expect(mobj.z).toBe(0);
  });

  it('places at explicit z when not a sentinel value', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, 42 * FRACUNIT, MobjType.POSSESSED, rng, list);

    expect(mobj.z).toBe(42 * FRACUNIT);
  });

  it('sets thinker action to mobjThinker', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    expect(mobj.action).toBe(mobjThinker);
  });

  it('MT_POSSESSED has MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL flags', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    expect(mobj.flags & MF_SOLID).toBeTruthy();
    expect(mobj.flags & MF_SHOOTABLE).toBeTruthy();
    expect(mobj.flags & MF_COUNTKILL).toBeTruthy();
    expect(mobj.flags & MF_SPECIAL).toBeFalsy();
  });
});

describe('setMobjState', () => {
  it('transitions to the specified state', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    const result = setMobjState(mobj, StateNum.POSS_STND2, list);

    expect(result).toBe(true);
    expect(mobj.state).toBe(STATES[StateNum.POSS_STND2]!);
  });

  it('returns false and removes mobj when transitioning to S_NULL', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    const result = setMobjState(mobj, StateNum.NULL, list);

    expect(result).toBe(false);
    expect(mobj.action).toBe(REMOVED);
  });

  it('calls the state action function', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);
    let called = false;

    const targetState = StateNum.POSS_STND;
    const originalAction = STATES[targetState]!.action;
    STATES[targetState]!.action = () => {
      called = true;
    };

    setMobjState(mobj, targetState, list);
    expect(called).toBe(true);

    // Restore
    STATES[targetState]!.action = originalAction;
  });

  it('chains through 0-tic states', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    // S_LIGHTDONE is tics=0, nextstate=S_NULL -- it should chain to S_NULL
    // and remove the mobj
    const result = setMobjState(mobj, StateNum.LIGHTDONE, list);

    expect(result).toBe(false);
  });

  it('updates sprite, frame, and tics from the new state', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    setMobjState(mobj, StateNum.POSS_STND2, list);
    const st = STATES[StateNum.POSS_STND2]!;

    expect(mobj.sprite).toBe(st.sprite);
    expect(mobj.frame).toBe(st.frame);
    expect(mobj.tics).toBe(st.tics);
  });
});

describe('removeMobj', () => {
  it('marks the thinker for deferred removal', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    removeMobj(mobj, list);

    expect(mobj.action).toBe(REMOVED);
  });

  it('mobj is unlinked after ThinkerList.run()', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    removeMobj(mobj, list);
    list.run();

    expect(list.isEmpty).toBe(true);
  });
});

describe('mobjThinker', () => {
  it('decrements tics each call', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);
    const initialTics = mobj.tics;

    mobjThinker(mobj);

    expect(mobj.tics).toBe(initialTics - 1);
  });

  it('does not decrement when tics is -1 (infinite duration)', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    mobj.tics = -1;
    mobjThinker(mobj);

    expect(mobj.tics).toBe(-1);
  });

  it('transitions to nextstate when tics reaches 0', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    // Set tics to 1 so next call triggers transition
    mobj.tics = 1;
    const expectedNext = mobj.state!.nextstate;
    const expectedState = STATES[expectedNext]!;

    mobjThinker(mobj);

    expect(mobj.state).toBe(expectedState);
    expect(mobj.tics).toBe(expectedState.tics);
  });

  it('marks REMOVED when nextstate is S_NULL', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    // Point the current state's nextstate to S_NULL temporarily
    const originalState = mobj.state!;
    mobj.state = { ...originalState, nextstate: StateNum.NULL };
    mobj.tics = 1;

    mobjThinker(mobj);

    expect(mobj.action).toBe(REMOVED);
  });

  it('does not modify state when tics > 1', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONFLOORZ, MobjType.POSSESSED, rng, list);

    mobj.tics = 5;
    const stateBefore = mobj.state;
    const spriteBefore = mobj.sprite;

    mobjThinker(mobj);

    expect(mobj.state).toBe(stateBefore);
    expect(mobj.sprite).toBe(spriteBefore);
    expect(mobj.tics).toBe(4);
  });
});

describe('parity edge cases', () => {
  it('ONFLOORZ equals INT_MIN (-0x80000000)', () => {
    expect(ONFLOORZ).toBe(-0x8000_0000);
  });

  it('ONCEILINGZ equals INT_MAX (0x7FFFFFFF)', () => {
    expect(ONCEILINGZ).toBe(0x7fff_ffff);
  });

  it('S_POSS_STND uses SPR_POSS (29) with 10-tic duration', () => {
    const state = STATES[StateNum.POSS_STND]!;
    expect(state.sprite).toBe(SpriteNum.POSS);
    expect(state.tics).toBe(10);
    expect(state.nextstate).toBe(StateNum.POSS_STND2);
  });

  it('S_POSS_STND and S_POSS_STND2 form a 2-state idle loop', () => {
    const stnd1 = STATES[StateNum.POSS_STND]!;
    const stnd2 = STATES[StateNum.POSS_STND2]!;

    expect(stnd1.nextstate).toBe(StateNum.POSS_STND2);
    expect(stnd2.nextstate).toBe(StateNum.POSS_STND);
  });

  it('MT_BARREL (doomednum 2035) is present in mobjinfo', () => {
    const info = MOBJINFO[MobjType.BARREL]!;
    expect(info.doomednum).toBe(2035);
    expect(info.spawnhealth).toBe(20);
  });

  it('ONCEILINGZ placement subtracts height', () => {
    const rng = new DoomRandom();
    const list = new ThinkerList();
    const mobj = spawnMobj(0, 0, ONCEILINGZ, MobjType.POSSESSED, rng, list);

    // Without subsector, ceilingz defaults to 0, so z = 0 - height
    const expectedZ = 0 - MOBJINFO[MobjType.POSSESSED]!.height;
    expect(mobj.z).toBe(expectedZ);
  });
});
