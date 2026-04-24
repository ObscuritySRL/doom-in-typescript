import { describe, expect, it } from 'bun:test';

import {
  IntermissionPhase,
  MAXPLAYERS,
  SP_ITEMS_DELTA,
  SP_KILLS_DELTA,
  SP_SECRETS_DELTA,
  SP_STATE_FINAL,
  SP_STATE_INITIAL_PAUSE,
  SP_STATE_ITEMS,
  SP_STATE_KILLS,
  SP_STATE_PAUSE_AFTER_ITEMS,
  SP_STATE_PAUSE_AFTER_KILLS,
  SP_STATE_PAUSE_AFTER_SECRETS,
  SP_STATE_PAUSE_AFTER_TIME,
  SP_STATE_SECRETS,
  SP_STATE_TIME_AND_PAR,
  SP_TIME_DELTA,
  TICRATE,
  WI_MAX_PERCENT,
  WI_NO_STATE_TICS,
  WI_PISTOL_BCNT_MASK,
  WI_POINTER_BLINK_CYCLE,
  WI_POINTER_BLINK_ON_THRESHOLD,
  WI_SHOW_NEXT_LOC_SECONDS,
  WI_SHOW_NEXT_LOC_TICS,
  WI_SP_PAUSE_TICS,
  beginIntermission,
  checkForAccelerate,
  createIntermissionState,
  tickIntermission,
} from '../../src/ui/intermission.ts';

import type { IntermissionPlayerInput, IntermissionPlayerResult, IntermissionRound, IntermissionState, IntermissionTickResult } from '../../src/ui/intermission.ts';

// ── Helpers ──────────────────────────────────────────────────────────

function defaultRound(overrides: Partial<IntermissionRound> = {}): IntermissionRound {
  return {
    episode: 1,
    lastMap: 1,
    nextMap: 2,
    maxKills: 20,
    maxItems: 10,
    maxSecrets: 3,
    parTimeTics: 30 * TICRATE,
    ...overrides,
  };
}

function defaultResult(overrides: Partial<IntermissionPlayerResult> = {}): IntermissionPlayerResult {
  return {
    killCount: 20,
    itemCount: 10,
    secretCount: 3,
    timeTics: 42 * TICRATE,
    inGame: true,
    ...overrides,
  };
}

function noInput(): readonly IntermissionPlayerInput[] {
  return [{ attack: false, use: false }];
}

function pressUse(): readonly IntermissionPlayerInput[] {
  return [{ attack: false, use: true }];
}

function releaseAll(): readonly IntermissionPlayerInput[] {
  return [{ attack: false, use: false }];
}

function tickN(state: IntermissionState, n: number): IntermissionTickResult[] {
  const results: IntermissionTickResult[] = [];
  for (let i = 0; i < n; i++) results.push(tickIntermission(state, noInput()));
  return results;
}

function beginDefault(state: IntermissionState, overrides: { round?: Partial<IntermissionRound>; result?: Partial<IntermissionPlayerResult> } = {}): void {
  beginIntermission(state, defaultRound(overrides.round), [defaultResult(overrides.result)]);
}

// ── Constants ────────────────────────────────────────────────────────

describe('intermission constants', () => {
  it('TICRATE is 35', () => {
    expect(TICRATE).toBe(35);
  });

  it('WI_SP_PAUSE_TICS equals TICRATE', () => {
    expect(WI_SP_PAUSE_TICS).toBe(35);
  });

  it('WI_SHOW_NEXT_LOC_TICS equals 4 * TICRATE', () => {
    expect(WI_SHOW_NEXT_LOC_SECONDS).toBe(4);
    expect(WI_SHOW_NEXT_LOC_TICS).toBe(140);
  });

  it('WI_NO_STATE_TICS is exactly 10 (vanilla literal, NOT TICRATE)', () => {
    expect(WI_NO_STATE_TICS).toBe(10);
  });

  it('sp_state constants follow odd-pause / even-count-up ordering', () => {
    expect(SP_STATE_INITIAL_PAUSE).toBe(1);
    expect(SP_STATE_KILLS).toBe(2);
    expect(SP_STATE_PAUSE_AFTER_KILLS).toBe(3);
    expect(SP_STATE_ITEMS).toBe(4);
    expect(SP_STATE_PAUSE_AFTER_ITEMS).toBe(5);
    expect(SP_STATE_SECRETS).toBe(6);
    expect(SP_STATE_PAUSE_AFTER_SECRETS).toBe(7);
    expect(SP_STATE_TIME_AND_PAR).toBe(8);
    expect(SP_STATE_PAUSE_AFTER_TIME).toBe(9);
    expect(SP_STATE_FINAL).toBe(10);
  });

  it('odd sp_state values are pause stages; even are count-ups', () => {
    expect(SP_STATE_INITIAL_PAUSE & 1).toBe(1);
    expect(SP_STATE_KILLS & 1).toBe(0);
    expect(SP_STATE_PAUSE_AFTER_KILLS & 1).toBe(1);
    expect(SP_STATE_ITEMS & 1).toBe(0);
    expect(SP_STATE_TIME_AND_PAR & 1).toBe(0);
    expect(SP_STATE_FINAL & 1).toBe(0);
  });

  it('count-up deltas match vanilla per-tic increments', () => {
    expect(SP_KILLS_DELTA).toBe(2);
    expect(SP_ITEMS_DELTA).toBe(2);
    expect(SP_SECRETS_DELTA).toBe(2);
    expect(SP_TIME_DELTA).toBe(3);
  });

  it('WI_MAX_PERCENT is 100', () => {
    expect(WI_MAX_PERCENT).toBe(100);
  });

  it('WI_PISTOL_BCNT_MASK is 3 (bcnt & 3 gate)', () => {
    expect(WI_PISTOL_BCNT_MASK).toBe(3);
  });

  it('pointer blink cycle is 32 tics with 20-tic on-threshold', () => {
    expect(WI_POINTER_BLINK_CYCLE).toBe(32);
    expect(WI_POINTER_BLINK_ON_THRESHOLD).toBe(20);
  });

  it('MAXPLAYERS is 4', () => {
    expect(MAXPLAYERS).toBe(4);
  });

  it('IntermissionPhase values match vanilla stateenum_t', () => {
    expect(IntermissionPhase.NoState).toBe(-1);
    expect(IntermissionPhase.StatCount).toBe(0);
    expect(IntermissionPhase.ShowNextLoc).toBe(1);
  });
});

// ── createIntermissionState ──────────────────────────────────────────

describe('createIntermissionState', () => {
  it('returns a fresh state with vanilla WI_initVariables defaults', () => {
    const state = createIntermissionState();
    expect(state.phase).toBe(IntermissionPhase.StatCount);
    expect(state.spState).toBe(SP_STATE_INITIAL_PAUSE);
    expect(state.cntKills).toBe(-1);
    expect(state.cntItems).toBe(-1);
    expect(state.cntSecrets).toBe(-1);
    expect(state.cntTime).toBe(-1);
    expect(state.cntPar).toBe(-1);
    expect(state.cntPause).toBe(WI_SP_PAUSE_TICS);
    expect(state.cnt).toBe(0);
    expect(state.bcnt).toBe(0);
    expect(state.acceleratestage).toBe(false);
    expect(state.pointerOn).toBe(false);
    expect(state.attackDownLatched).toEqual([false, false, false, false]);
    expect(state.useDownLatched).toEqual([false, false, false, false]);
    expect(state.playerResults).toEqual([]);
    expect(state.playerInGame).toEqual([false, false, false, false]);
    expect(state.round).toBeNull();
    expect(state.active).toBe(false);
  });

  it('fresh states are independent (mutation isolation)', () => {
    const a = createIntermissionState();
    const b = createIntermissionState();
    a.cntKills = 50;
    a.attackDownLatched[0] = true;
    expect(b.cntKills).toBe(-1);
    expect(b.attackDownLatched[0]).toBe(false);
  });
});

// ── beginIntermission ────────────────────────────────────────────────

describe('beginIntermission', () => {
  it('seeds round + player results and arms StatCount / spState=1', () => {
    const state = createIntermissionState();
    const round = defaultRound();
    const result = defaultResult();
    beginIntermission(state, round, [result]);
    expect(state.phase).toBe(IntermissionPhase.StatCount);
    expect(state.spState).toBe(SP_STATE_INITIAL_PAUSE);
    expect(state.cntPause).toBe(WI_SP_PAUSE_TICS);
    expect(state.cnt).toBe(0);
    expect(state.bcnt).toBe(0);
    expect(state.acceleratestage).toBe(false);
    expect(state.round).toBe(round);
    expect(state.playerResults).toEqual([result]);
    expect(state.playerInGame[0]).toBe(true);
    expect(state.playerInGame[1]).toBe(false);
    expect(state.active).toBe(true);
  });

  it('all count-ups start at -1 (vanilla sentinel)', () => {
    const state = createIntermissionState();
    beginDefault(state);
    expect(state.cntKills).toBe(-1);
    expect(state.cntItems).toBe(-1);
    expect(state.cntSecrets).toBe(-1);
    expect(state.cntTime).toBe(-1);
    expect(state.cntPar).toBe(-1);
  });

  it('resets any pre-existing accelerate latch + bcnt + cnt', () => {
    const state = createIntermissionState();
    state.acceleratestage = true;
    state.bcnt = 99;
    state.cnt = 77;
    state.attackDownLatched[0] = true;
    state.useDownLatched[1] = true;
    beginDefault(state);
    expect(state.acceleratestage).toBe(false);
    expect(state.bcnt).toBe(0);
    expect(state.cnt).toBe(0);
    expect(state.attackDownLatched).toEqual([false, false, false, false]);
    expect(state.useDownLatched).toEqual([false, false, false, false]);
  });

  it('rejects invalid round fields with RangeError', () => {
    const state = createIntermissionState();
    expect(() => beginIntermission(state, defaultRound({ episode: 0 }), [defaultResult()])).toThrow(RangeError);
    expect(() => beginIntermission(state, defaultRound({ lastMap: 0 }), [defaultResult()])).toThrow(RangeError);
    expect(() => beginIntermission(state, defaultRound({ nextMap: -1 }), [defaultResult()])).toThrow(RangeError);
    expect(() => beginIntermission(state, defaultRound({ maxKills: -1 }), [defaultResult()])).toThrow(RangeError);
    expect(() => beginIntermission(state, defaultRound({ parTimeTics: -5 }), [defaultResult()])).toThrow(RangeError);
  });

  it('rejects results array exceeding MAXPLAYERS', () => {
    const state = createIntermissionState();
    const tooMany = Array.from({ length: MAXPLAYERS + 1 }, () => defaultResult());
    expect(() => beginIntermission(state, defaultRound(), tooMany)).toThrow(RangeError);
  });
});

// ── checkForAccelerate ───────────────────────────────────────────────

describe('checkForAccelerate edge detection', () => {
  it('fires on rising edge of attack', () => {
    const state = createIntermissionState();
    beginDefault(state);
    checkForAccelerate(state, [{ attack: true, use: false }]);
    expect(state.acceleratestage).toBe(true);
    expect(state.attackDownLatched[0]).toBe(true);
  });

  it('does NOT fire again while attack is held', () => {
    const state = createIntermissionState();
    beginDefault(state);
    checkForAccelerate(state, [{ attack: true, use: false }]);
    state.acceleratestage = false;
    checkForAccelerate(state, [{ attack: true, use: false }]);
    expect(state.acceleratestage).toBe(false);
  });

  it('fires again on second press after release', () => {
    const state = createIntermissionState();
    beginDefault(state);
    checkForAccelerate(state, [{ attack: true, use: false }]);
    state.acceleratestage = false;
    checkForAccelerate(state, [{ attack: false, use: false }]);
    expect(state.attackDownLatched[0]).toBe(false);
    checkForAccelerate(state, [{ attack: true, use: false }]);
    expect(state.acceleratestage).toBe(true);
  });

  it('fires on rising edge of use (independent of attack)', () => {
    const state = createIntermissionState();
    beginDefault(state);
    checkForAccelerate(state, [{ attack: false, use: true }]);
    expect(state.acceleratestage).toBe(true);
    expect(state.useDownLatched[0]).toBe(true);
    expect(state.attackDownLatched[0]).toBe(false);
  });

  it('skips players not in game', () => {
    const state = createIntermissionState();
    beginDefault(state);
    state.playerInGame[0] = false;
    checkForAccelerate(state, [{ attack: true, use: false }]);
    expect(state.acceleratestage).toBe(false);
    expect(state.attackDownLatched[0]).toBe(false);
  });

  it('tolerates inputs shorter than MAXPLAYERS (missing treated as false)', () => {
    const state = createIntermissionState();
    beginDefault(state);
    state.playerInGame[1] = true; // second player also in game
    checkForAccelerate(state, [{ attack: false, use: false }]);
    expect(state.acceleratestage).toBe(false);
    expect(state.attackDownLatched[1]).toBe(false);
  });
});

// ── First-tick music cue ─────────────────────────────────────────────

describe('tickIntermission first-tick music cue', () => {
  it('emits mus_inter exactly once on the first tick (bcnt === 1)', () => {
    const state = createIntermissionState();
    beginDefault(state);
    const first = tickIntermission(state, noInput());
    expect(first.music).toBe('mus_inter');
    expect(state.bcnt).toBe(1);

    const second = tickIntermission(state, noInput());
    expect(second.music).toBeNull();
  });

  it('no-op with all-defaults when state is not active', () => {
    const state = createIntermissionState();
    const r = tickIntermission(state, noInput());
    expect(r.music).toBeNull();
    expect(r.sounds).toEqual([]);
    expect(r.worldDone).toBe(false);
    expect(state.bcnt).toBe(0);
  });
});

// ── sp_state=1 initial pause ────────────────────────────────────────

describe('sp_state 1 initial pause', () => {
  it('counts down cntPause over TICRATE=35 tics then transitions to SP_STATE_KILLS', () => {
    const state = createIntermissionState();
    beginDefault(state);
    expect(state.cntPause).toBe(35);

    for (let i = 0; i < 34; i++) tickIntermission(state, noInput());
    expect(state.spState).toBe(SP_STATE_INITIAL_PAUSE);
    expect(state.cntPause).toBe(1);

    tickIntermission(state, noInput());
    expect(state.spState).toBe(SP_STATE_KILLS);
    expect(state.cntPause).toBe(WI_SP_PAUSE_TICS);
  });
});

// ── sp_state=2 kills count-up ────────────────────────────────────────

describe('sp_state 2 kills count-up', () => {
  it('increments cntKills by SP_KILLS_DELTA=2 per tic toward target', () => {
    const state = createIntermissionState();
    beginDefault(state, { round: { maxKills: 10 }, result: { killCount: 5 } }); // target = 50%
    // Skip initial pause
    tickN(state, 35);
    expect(state.spState).toBe(SP_STATE_KILLS);
    expect(state.cntKills).toBe(-1);

    tickIntermission(state, noInput()); // cnt = 1
    expect(state.cntKills).toBe(1);
    tickIntermission(state, noInput()); // cnt = 3
    expect(state.cntKills).toBe(3);
  });

  it('plays sfx_pistol on bcnt & 3 === 0 during count-up', () => {
    const state = createIntermissionState();
    beginDefault(state, { round: { maxKills: 100 }, result: { killCount: 100 } });
    // Skip initial pause (35 tics): bcnt will be 35 after
    tickN(state, 35);
    expect(state.bcnt).toBe(35);

    const r1 = tickIntermission(state, noInput()); // bcnt = 36 → 36 & 3 = 0 → pistol
    expect(r1.sounds).toContain('pistol');

    const r2 = tickIntermission(state, noInput()); // bcnt = 37 → 1 → no pistol
    expect(r2.sounds).not.toContain('pistol');
  });

  it('clamps cntKills to target, plays barexp, advances to PAUSE_AFTER_KILLS', () => {
    const state = createIntermissionState();
    beginDefault(state, { round: { maxKills: 4 }, result: { killCount: 1 } }); // target = 25
    tickN(state, 35);
    expect(state.spState).toBe(SP_STATE_KILLS);

    let lastResult: IntermissionTickResult | null = null;
    while (state.spState === SP_STATE_KILLS) {
      lastResult = tickIntermission(state, noInput());
    }
    expect(state.cntKills).toBe(25);
    expect(lastResult!.sounds).toContain('barexp');
    expect(state.spState).toBe(SP_STATE_PAUSE_AFTER_KILLS);
  });

  it('substitutes 100% when maxKills is 0 (divide-by-zero guard)', () => {
    const state = createIntermissionState();
    beginDefault(state, { round: { maxKills: 0 }, result: { killCount: 0 } });
    tickN(state, 35);
    expect(state.spState).toBe(SP_STATE_KILLS);

    while (state.spState === SP_STATE_KILLS) tickIntermission(state, noInput());
    expect(state.cntKills).toBe(WI_MAX_PERCENT);
    expect(state.spState).toBe(SP_STATE_PAUSE_AFTER_KILLS);
  });
});

// ── sp_state 4/6 items/secrets count-ups ─────────────────────────────

describe('items and secrets count-ups', () => {
  function runToItemsPhase(state: IntermissionState): void {
    tickN(state, 35); // sp_state 1 → 2
    while (state.spState === SP_STATE_KILLS) tickIntermission(state, noInput());
    tickN(state, 35); // sp_state 3 → 4
    expect(state.spState).toBe(SP_STATE_ITEMS);
  }

  it('items count-up uses SP_ITEMS_DELTA=2 and clamps to target', () => {
    const state = createIntermissionState();
    beginDefault(state, { round: { maxItems: 10 }, result: { itemCount: 7 } }); // target = 70
    runToItemsPhase(state);
    expect(state.cntItems).toBe(-1);

    while (state.spState === SP_STATE_ITEMS) tickIntermission(state, noInput());
    expect(state.cntItems).toBe(70);
    expect(state.spState).toBe(SP_STATE_PAUSE_AFTER_ITEMS);
  });

  it('secrets count-up uses SP_SECRETS_DELTA=2 and clamps', () => {
    const state = createIntermissionState();
    beginDefault(state, { round: { maxSecrets: 4 }, result: { secretCount: 1 } }); // target = 25
    runToItemsPhase(state);
    while (state.spState === SP_STATE_ITEMS) tickIntermission(state, noInput());
    tickN(state, 35); // sp_state 5 → 6
    expect(state.spState).toBe(SP_STATE_SECRETS);

    while (state.spState === SP_STATE_SECRETS) tickIntermission(state, noInput());
    expect(state.cntSecrets).toBe(25);
    expect(state.spState).toBe(SP_STATE_PAUSE_AFTER_SECRETS);
  });
});

// ── sp_state 8 time and par ──────────────────────────────────────────

describe('sp_state 8 time and par', () => {
  function runToTimePhase(state: IntermissionState): void {
    while (state.spState !== SP_STATE_TIME_AND_PAR) {
      tickIntermission(state, noInput());
    }
  }

  it('advances BOTH cntTime and cntPar by SP_TIME_DELTA=3 per tic', () => {
    const state = createIntermissionState();
    beginDefault(state, { round: { parTimeTics: 20 * TICRATE }, result: { timeTics: 42 * TICRATE } });
    runToTimePhase(state);
    expect(state.cntTime).toBe(-1);
    expect(state.cntPar).toBe(-1);

    tickIntermission(state, noInput());
    expect(state.cntTime).toBe(2); // -1 + 3
    expect(state.cntPar).toBe(2);

    tickIntermission(state, noInput());
    expect(state.cntTime).toBe(5);
    expect(state.cntPar).toBe(5);
  });

  it('clamps cntTime to stime/TICRATE but does NOT advance while par still running', () => {
    const state = createIntermissionState();
    // time target = 5 seconds, par target = 30 seconds → time saturates first
    beginDefault(state, {
      round: { parTimeTics: 30 * TICRATE },
      result: { timeTics: 5 * TICRATE },
    });
    runToTimePhase(state);

    let tics = 0;
    while (state.spState === SP_STATE_TIME_AND_PAR && tics < 500) {
      tickIntermission(state, noInput());
      tics++;
    }
    expect(state.cntTime).toBe(5);
    expect(state.cntPar).toBe(30);
    expect(state.spState).toBe(SP_STATE_PAUSE_AFTER_TIME);
  });

  it('emits barexp when BOTH targets are reached (sp_state advance)', () => {
    const state = createIntermissionState();
    beginDefault(state, {
      round: { parTimeTics: 1 * TICRATE },
      result: { timeTics: 1 * TICRATE },
    });
    runToTimePhase(state);

    let lastResult: IntermissionTickResult | null = null;
    while (state.spState === SP_STATE_TIME_AND_PAR) {
      lastResult = tickIntermission(state, noInput());
    }
    expect(lastResult!.sounds).toContain('barexp');
  });
});

// ── sp_state 10 final wait ───────────────────────────────────────────

describe('sp_state 10 final wait for user input', () => {
  function runToFinal(state: IntermissionState): void {
    let tics = 0;
    while (state.spState !== SP_STATE_FINAL && tics < 2000) {
      tickIntermission(state, noInput());
      tics++;
    }
    expect(state.spState).toBe(SP_STATE_FINAL);
  }

  it('idles indefinitely without user input', () => {
    const state = createIntermissionState();
    beginDefault(state);
    runToFinal(state);
    const bcntAtFinal = state.bcnt;

    for (let i = 0; i < 50; i++) tickIntermission(state, noInput());
    expect(state.spState).toBe(SP_STATE_FINAL);
    expect(state.phase).toBe(IntermissionPhase.StatCount);
    expect(state.bcnt).toBe(bcntAtFinal + 50);
  });

  it('user use-press fires sgcock and transitions to ShowNextLoc', () => {
    const state = createIntermissionState();
    beginDefault(state);
    runToFinal(state);
    const result = tickIntermission(state, pressUse());
    expect(result.sounds).toContain('sgcock');
    expect(state.phase).toBe(IntermissionPhase.ShowNextLoc);
    expect(state.cnt).toBe(WI_SHOW_NEXT_LOC_TICS);
    expect(state.acceleratestage).toBe(false);
  });
});

// ── Acceleration during count-up skips to final ──────────────────────

describe('acceleration during count-up', () => {
  it('skips to target values, plays barexp, sets spState = SP_STATE_FINAL', () => {
    const state = createIntermissionState();
    beginDefault(state, {
      round: { maxKills: 10, maxItems: 10, maxSecrets: 5, parTimeTics: 30 * TICRATE },
      result: { killCount: 7, itemCount: 5, secretCount: 2, timeTics: 42 * TICRATE },
    });
    // Advance into sp_state=2 kills
    tickN(state, 35);
    expect(state.spState).toBe(SP_STATE_KILLS);

    const result = tickIntermission(state, pressUse());
    expect(result.sounds).toContain('barexp');
    expect(state.spState).toBe(SP_STATE_FINAL);
    expect(state.cntKills).toBe(70);
    expect(state.cntItems).toBe(50);
    expect(state.cntSecrets).toBe(40);
    expect(state.cntTime).toBe(42);
    expect(state.cntPar).toBe(30);
  });

  it('does NOT fire during SP_STATE_FINAL itself (that branch uses sgcock)', () => {
    const state = createIntermissionState();
    beginDefault(state);
    // Move to final by normal flow
    let tics = 0;
    while (state.spState !== SP_STATE_FINAL && tics < 2000) {
      tickIntermission(state, noInput());
      tics++;
    }
    const result = tickIntermission(state, pressUse());
    expect(result.sounds).toContain('sgcock');
    expect(result.sounds).not.toContain('barexp');
  });
});

// ── ShowNextLoc phase ────────────────────────────────────────────────

describe('ShowNextLoc phase', () => {
  function reachShowNextLoc(state: IntermissionState): void {
    let tics = 0;
    while (state.spState !== SP_STATE_FINAL && tics < 2000) {
      tickIntermission(state, noInput());
      tics++;
    }
    tickIntermission(state, pressUse());
    tickIntermission(state, releaseAll());
    expect(state.phase).toBe(IntermissionPhase.ShowNextLoc);
  }

  it('counts down cnt from 140 toward 0', () => {
    const state = createIntermissionState();
    beginDefault(state);
    reachShowNextLoc(state);
    const startCnt = state.cnt;
    tickIntermission(state, noInput());
    expect(state.cnt).toBe(startCnt - 1);
  });

  it('pointerOn toggles via (cnt & 31) < 20 predicate', () => {
    const state = createIntermissionState();
    beginDefault(state);
    reachShowNextLoc(state);

    // cnt was loaded to 140, decremented to 139 on reachShowNextLoc's release tick; capture it.
    // Walk one full 32-tic blink cycle and compare against predicate.
    const observations: { cnt: number; pointerOn: boolean }[] = [];
    for (let i = 0; i < WI_POINTER_BLINK_CYCLE; i++) {
      tickIntermission(state, noInput());
      observations.push({ cnt: state.cnt, pointerOn: state.pointerOn });
    }
    for (const obs of observations) {
      const expected = (obs.cnt & (WI_POINTER_BLINK_CYCLE - 1)) < WI_POINTER_BLINK_ON_THRESHOLD;
      expect(obs.pointerOn).toBe(expected);
    }
  });

  it('auto-transitions to NoState when cnt reaches 0', () => {
    const state = createIntermissionState();
    beginDefault(state);
    reachShowNextLoc(state);
    while (state.phase === IntermissionPhase.ShowNextLoc) tickIntermission(state, noInput());
    expect(state.phase).toBe(IntermissionPhase.NoState);
    expect(state.cnt).toBe(WI_NO_STATE_TICS);
    expect(state.acceleratestage).toBe(false);
  });

  it('accelerate transitions to NoState immediately', () => {
    const state = createIntermissionState();
    beginDefault(state);
    reachShowNextLoc(state);
    expect(state.cnt).toBeGreaterThan(5);
    tickIntermission(state, pressUse());
    expect(state.phase).toBe(IntermissionPhase.NoState);
  });
});

// ── NoState phase ────────────────────────────────────────────────────

describe('NoState phase', () => {
  function reachNoState(state: IntermissionState): void {
    let tics = 0;
    while (state.spState !== SP_STATE_FINAL && tics < 2000) {
      tickIntermission(state, noInput());
      tics++;
    }
    tickIntermission(state, pressUse());
    tickIntermission(state, releaseAll());
    // Force-accelerate ShowNextLoc → NoState
    tickIntermission(state, pressUse());
    expect(state.phase).toBe(IntermissionPhase.NoState);
    expect(state.cnt).toBe(WI_NO_STATE_TICS);
  }

  it('counts down cnt from 10 over exactly 10 tics then worldDone fires', () => {
    const state = createIntermissionState();
    beginDefault(state);
    reachNoState(state);

    // 9 tics bring cnt from 10 down to 1 (no worldDone)
    for (let i = 0; i < 9; i++) {
      const r = tickIntermission(state, noInput());
      expect(r.worldDone).toBe(false);
    }
    expect(state.cnt).toBe(1);

    // 10th tic brings cnt to 0 and fires worldDone
    const finalResult = tickIntermission(state, noInput());
    expect(finalResult.worldDone).toBe(true);
    expect(state.cnt).toBe(0);
    expect(state.active).toBe(false);
  });

  it('after worldDone fires, subsequent ticks are no-ops', () => {
    const state = createIntermissionState();
    beginDefault(state);
    reachNoState(state);
    while (state.active) tickIntermission(state, noInput());
    const after = tickIntermission(state, noInput());
    expect(after.worldDone).toBe(false);
    expect(after.sounds).toEqual([]);
    expect(after.music).toBeNull();
  });
});

// ── End-to-end smoke test ────────────────────────────────────────────

describe('end-to-end shareware E1M1 intermission', () => {
  it('plays the full pipeline and reports worldDone on NoState expiry', () => {
    const state = createIntermissionState();
    beginDefault(state);

    let music: string | null = null;
    let pistolCount = 0;
    let barexpCount = 0;
    let sgcockCount = 0;
    let worldDoneTic = -1;
    let tic = 0;
    const MAX_TICS = 5000;

    while (tic < MAX_TICS) {
      const inputs = state.spState === SP_STATE_FINAL ? pressUse() : noInput();
      const r = tickIntermission(state, inputs);
      if (r.music !== null) music = r.music;
      for (const s of r.sounds) {
        if (s === 'pistol') pistolCount++;
        if (s === 'barexp') barexpCount++;
        if (s === 'sgcock') sgcockCount++;
      }
      if (r.worldDone) {
        worldDoneTic = tic;
        break;
      }
      tic++;
    }

    expect(music).toBe('mus_inter');
    expect(pistolCount).toBeGreaterThan(0);
    expect(barexpCount).toBeGreaterThanOrEqual(4); // kills, items, secrets, time/par
    expect(sgcockCount).toBe(1);
    expect(worldDoneTic).toBeGreaterThan(0);
    expect(state.active).toBe(false);
  });
});
