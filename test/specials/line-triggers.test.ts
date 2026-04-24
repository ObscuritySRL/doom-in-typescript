import { describe, expect, it } from 'bun:test';

import { ML_SECRET } from '../../src/map/lineSectorGeometry.ts';
import type { LineTriggerCallbacks, LineTriggerLine, LineTriggerThing } from '../../src/specials/lineTriggers.ts';
import { GameVersion, MONSTER_CROSS_SPECIALS, MONSTER_SHOOT_SPECIALS, MONSTER_USE_SPECIALS, NON_TRIGGER_PROJECTILE_TYPES, pCrossSpecialLine, pShootSpecialLine, pUseSpecialLine } from '../../src/specials/lineTriggers.ts';
import { MobjType } from '../../src/world/mobj.ts';

// ── Harness ─────────────────────────────────────────────────────────

interface CallEvent {
  readonly method: string;
  readonly args: readonly unknown[];
}

function makeHarness(returnValues: Partial<Record<string, number>> = {}): {
  callbacks: LineTriggerCallbacks;
  events: CallEvent[];
} {
  const events: CallEvent[] = [];
  const rec = (method: string, args: unknown[], defaultReturn: number | void = undefined) => {
    events.push({ method, args });
    if (defaultReturn === undefined) return undefined;
    const override = returnValues[method];
    return override !== undefined ? override : defaultReturn;
  };
  const callbacks: LineTriggerCallbacks = {
    evDoDoor: (line, type) => rec('evDoDoor', [line, type], 1) as number,
    evDoLockedDoor: (line, type, thing) => rec('evDoLockedDoor', [line, type, thing], 1) as number,
    evVerticalDoor: (line, thing) => {
      rec('evVerticalDoor', [line, thing]);
    },
    evDoPlat: (line, type, amount) => rec('evDoPlat', [line, type, amount], 1) as number,
    evStopPlat: (line) => {
      rec('evStopPlat', [line]);
    },
    evDoFloor: (line, type) => rec('evDoFloor', [line, type], 1) as number,
    evDoCeiling: (line, type) => rec('evDoCeiling', [line, type], 1) as number,
    evCeilingCrushStop: (line) => rec('evCeilingCrushStop', [line], 1) as number,
    evBuildStairs: (line, type) => rec('evBuildStairs', [line, type], 1) as number,
    evDoDonut: (line) => rec('evDoDonut', [line], 1) as number,
    evTeleport: (line, side, thing) => rec('evTeleport', [line, side, thing], 1) as number,
    evLightTurnOn: (line, bright) => {
      rec('evLightTurnOn', [line, bright]);
    },
    evStartLightStrobing: (line) => {
      rec('evStartLightStrobing', [line]);
    },
    evTurnTagLightsOff: (line) => {
      rec('evTurnTagLightsOff', [line]);
    },
    changeSwitchTexture: (line, useAgain) => {
      rec('changeSwitchTexture', [line, useAgain]);
    },
    gExitLevel: () => {
      rec('gExitLevel', []);
    },
    gSecretExitLevel: () => {
      rec('gSecretExitLevel', []);
    },
  };
  return { callbacks, events };
}

function makeLine(special: number, flags = 0, tag = 0): LineTriggerLine {
  return { special, flags, tag, frontFloorpic: 0, frontSpecial: 0 };
}

function makePlayer(): LineTriggerThing {
  return { type: MobjType.POSSESSED, player: {} };
}

function makeMonster(type: MobjType = MobjType.POSSESSED): LineTriggerThing {
  return { type, player: null };
}

// ── Eligibility constants ───────────────────────────────────────────

describe('line trigger eligibility constants', () => {
  it('pins the non-trigger projectile type list to the six vanilla entries', () => {
    expect([...NON_TRIGGER_PROJECTILE_TYPES]).toEqual([MobjType.ROCKET, MobjType.PLASMA, MobjType.BFG, MobjType.TROOPSHOT, MobjType.HEADSHOT, MobjType.BRUISERSHOT]);
  });

  it('pins the monster cross eligibility set to {39, 97, 125, 126, 4, 10, 88}', () => {
    expect([...MONSTER_CROSS_SPECIALS]).toEqual([39, 97, 125, 126, 4, 10, 88]);
  });

  it('pins the monster use eligibility set to {1, 32, 33, 34}', () => {
    expect([...MONSTER_USE_SPECIALS]).toEqual([1, 32, 33, 34]);
  });

  it('pins the monster shoot eligibility set to {46}', () => {
    expect([...MONSTER_SHOOT_SPECIALS]).toEqual([46]);
  });
});

// ── pCrossSpecialLine: eligibility gates ────────────────────────────

describe('pCrossSpecialLine eligibility gates', () => {
  it('rejects projectiles on doom_1_9 even if the special matches monster-cross list', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(39);
    const rocket = makeMonster(MobjType.ROCKET);
    pCrossSpecialLine(line, 0, rocket, callbacks);
    expect(events).toEqual([]);
    expect(line.special).toBe(39);
  });

  it('applies the pre-1.2 gate: special > 98 && special !== 104 early-returns', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(125);
    const rocket = makeMonster(MobjType.ROCKET);
    pCrossSpecialLine(line, 0, rocket, callbacks, GameVersion.doom_1_2);
    expect(events).toEqual([]);
    expect(line.special).toBe(125);
  });

  it('pre-1.2 gate: player on special 104 passes the early filter and dispatches', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(104);
    pCrossSpecialLine(line, 0, makePlayer(), callbacks, GameVersion.doom_1_2);
    expect(events.map((e) => e.method)).toEqual(['evTurnTagLightsOff']);
    expect(line.special).toBe(0);
  });

  it('pre-1.2 gate: projectile filter is skipped — a rocket on special 4 still dispatches', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(4);
    const rocket = makeMonster(MobjType.ROCKET);
    pCrossSpecialLine(line, 0, rocket, callbacks, GameVersion.doom_1_2);
    expect(events.map((e) => e.method)).toEqual(['evDoDoor']);
    expect(line.special).toBe(0);
  });

  it('rejects non-player crossing a non-monster-cross special', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(2);
    pCrossSpecialLine(line, 0, makeMonster(), callbacks);
    expect(events).toEqual([]);
    expect(line.special).toBe(2);
  });

  it('accepts a player crossing any special', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(2);
    pCrossSpecialLine(line, 0, makePlayer(), callbacks);
    expect(events.map((e) => e.method)).toEqual(['evDoDoor']);
    expect(line.special).toBe(0);
  });
});

// ── pCrossSpecialLine: trigger vs retrigger ─────────────────────────

describe('pCrossSpecialLine trigger/retrigger semantics', () => {
  it('clears line.special=0 after a TRIGGER dispatch (case 2)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(2);
    pCrossSpecialLine(line, 0, makePlayer(), callbacks);
    expect(events[0].method).toBe('evDoDoor');
    expect(line.special).toBe(0);
  });

  it('leaves line.special intact after a RETRIGGER dispatch (case 86)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(86);
    pCrossSpecialLine(line, 0, makePlayer(), callbacks);
    expect(events[0].method).toBe('evDoDoor');
    expect(line.special).toBe(86);
  });

  it('exits via case 52 WITHOUT clearing line.special (engine transitions maps first)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(52);
    pCrossSpecialLine(line, 0, makePlayer(), callbacks);
    expect(events.map((e) => e.method)).toEqual(['gExitLevel']);
    expect(line.special).toBe(52);
  });

  it('secret-exits via case 124 WITHOUT clearing line.special', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(124);
    pCrossSpecialLine(line, 0, makePlayer(), callbacks);
    expect(events.map((e) => e.method)).toEqual(['gSecretExitLevel']);
    expect(line.special).toBe(124);
  });

  it('case 40 dispatches BOTH evDoCeiling and evDoFloor before resetting special', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(40);
    pCrossSpecialLine(line, 0, makePlayer(), callbacks);
    expect(events.map((e) => e.method)).toEqual(['evDoCeiling', 'evDoFloor']);
    expect(line.special).toBe(0);
  });
});

// ── pCrossSpecialLine: monster-only teleports ───────────────────────

describe('pCrossSpecialLine monster-only teleports (125/126)', () => {
  it('case 125 with a player does nothing and leaves the line armed', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(125);
    pCrossSpecialLine(line, 0, makePlayer(), callbacks);
    expect(events).toEqual([]);
    expect(line.special).toBe(125);
  });

  it('case 125 with a monster teleports and clears special (one-shot)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(125);
    pCrossSpecialLine(line, 0, makeMonster(), callbacks);
    expect(events.map((e) => e.method)).toEqual(['evTeleport']);
    expect(line.special).toBe(0);
  });

  it('case 126 with a monster teleports but leaves special intact (retrigger)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(126);
    pCrossSpecialLine(line, 0, makeMonster(), callbacks);
    expect(events.map((e) => e.method)).toEqual(['evTeleport']);
    expect(line.special).toBe(126);
  });

  it('case 126 with a player does nothing (monster-only inner gate)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(126);
    pCrossSpecialLine(line, 0, makePlayer(), callbacks);
    expect(events).toEqual([]);
    expect(line.special).toBe(126);
  });
});

// ── pShootSpecialLine ───────────────────────────────────────────────

describe('pShootSpecialLine', () => {
  it('case 24 dispatches evDoFloor and flips switch unconditionally (useAgain=0)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(24);
    pShootSpecialLine(makePlayer(), line, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evDoFloor', 'changeSwitchTexture']);
    const flip = events.find((e) => e.method === 'changeSwitchTexture')!;
    expect(flip.args[1]).toBe(0);
  });

  it('case 46 dispatches evDoDoor and flips switch unconditionally (useAgain=1)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(46);
    pShootSpecialLine(makePlayer(), line, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evDoDoor', 'changeSwitchTexture']);
    const flip = events.find((e) => e.method === 'changeSwitchTexture')!;
    expect(flip.args[1]).toBe(1);
  });

  it('case 47 dispatches evDoPlat and flips switch unconditionally (useAgain=0)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(47);
    pShootSpecialLine(makePlayer(), line, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evDoPlat', 'changeSwitchTexture']);
  });

  it('unconditional switch flip: flips even when EV_* returns 0', () => {
    const { callbacks, events } = makeHarness({ evDoFloor: 0 });
    const line = makeLine(24);
    pShootSpecialLine(makePlayer(), line, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evDoFloor', 'changeSwitchTexture']);
  });

  it('rejects monster shot on a non-46 special', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(24);
    pShootSpecialLine(makeMonster(), line, callbacks);
    expect(events).toEqual([]);
  });

  it('accepts monster shot on case 46', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(46);
    pShootSpecialLine(makeMonster(), line, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evDoDoor', 'changeSwitchTexture']);
  });
});

// ── pUseSpecialLine: side-1 gate ────────────────────────────────────

describe('pUseSpecialLine side-1 (back-side) gate', () => {
  it('rejects side=1 use for any special other than 124', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(11);
    expect(pUseSpecialLine(makePlayer(), line, 1, callbacks)).toBe(false);
    expect(events).toEqual([]);
  });

  it('accepts side=1 use for special 124 but dispatches nothing (no matching case)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(124);
    expect(pUseSpecialLine(makePlayer(), line, 1, callbacks)).toBe(true);
    expect(events).toEqual([]);
  });
});

// ── pUseSpecialLine: monster eligibility ────────────────────────────

describe('pUseSpecialLine monster eligibility', () => {
  it('rejects a monster on a non-{1,32,33,34} special', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(29);
    expect(pUseSpecialLine(makeMonster(), line, 0, callbacks)).toBe(false);
    expect(events).toEqual([]);
  });

  it('rejects a monster when ML_SECRET flag is set, even on special 1', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(1, ML_SECRET);
    expect(pUseSpecialLine(makeMonster(), line, 0, callbacks)).toBe(false);
    expect(events).toEqual([]);
  });

  it('accepts a monster on special 1 without ML_SECRET flag', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(1);
    expect(pUseSpecialLine(makeMonster(), line, 0, callbacks)).toBe(true);
    expect(events.map((e) => e.method)).toEqual(['evVerticalDoor']);
  });
});

// ── pUseSpecialLine: MANUALS ────────────────────────────────────────

describe('pUseSpecialLine MANUALS', () => {
  it('calls evVerticalDoor with no switch flip for case 1', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(1);
    pUseSpecialLine(makePlayer(), line, 0, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evVerticalDoor']);
    expect(line.special).toBe(1);
  });

  it('calls evVerticalDoor for case 31 (open-stay manual)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(31);
    pUseSpecialLine(makePlayer(), line, 0, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evVerticalDoor']);
  });

  it('calls evVerticalDoor for cases 117 and 118 (blaze manuals)', () => {
    const { callbacks: cb1, events: e1 } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(117), 0, cb1);
    expect(e1.map((e) => e.method)).toEqual(['evVerticalDoor']);

    const { callbacks: cb2, events: e2 } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(118), 0, cb2);
    expect(e2.map((e) => e.method)).toEqual(['evVerticalDoor']);
  });
});

// ── pUseSpecialLine: SWITCHES ───────────────────────────────────────

describe('pUseSpecialLine SWITCHES (useAgain=0)', () => {
  it('case 7: switch flip guarded on evBuildStairs return value (success)', () => {
    const { callbacks, events } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(7), 0, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evBuildStairs', 'changeSwitchTexture']);
    expect(events[1].args[1]).toBe(0);
  });

  it('case 7: switch flip skipped when evBuildStairs returns 0', () => {
    const { callbacks, events } = makeHarness({ evBuildStairs: 0 });
    pUseSpecialLine(makePlayer(), makeLine(7), 0, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evBuildStairs']);
  });

  it('case 11: switch flips UNCONDITIONALLY before exit, even when callbacks defer', () => {
    const { callbacks, events } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(11), 0, callbacks);
    expect(events.map((e) => e.method)).toEqual(['changeSwitchTexture', 'gExitLevel']);
    expect(events[0].args[1]).toBe(0);
  });

  it('case 51: switch flips UNCONDITIONALLY before secret exit', () => {
    const { callbacks, events } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(51), 0, callbacks);
    expect(events.map((e) => e.method)).toEqual(['changeSwitchTexture', 'gSecretExitLevel']);
    expect(events[0].args[1]).toBe(0);
  });

  it('case 9: guarded on evDoDonut return value', () => {
    const { callbacks: cbOk, events: evOk } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(9), 0, cbOk);
    expect(evOk.map((e) => e.method)).toEqual(['evDoDonut', 'changeSwitchTexture']);

    const { callbacks: cbNo, events: evNo } = makeHarness({ evDoDonut: 0 });
    pUseSpecialLine(makePlayer(), makeLine(9), 0, cbNo);
    expect(evNo.map((e) => e.method)).toEqual(['evDoDonut']);
  });

  it('cases 133/135/137: dispatch locked blaze door, guarded on return', () => {
    for (const special of [133, 135, 137]) {
      const { callbacks, events } = makeHarness();
      pUseSpecialLine(makePlayer(), makeLine(special), 0, callbacks);
      expect(events.map((e) => e.method)).toEqual(['evDoLockedDoor', 'changeSwitchTexture']);
      expect(events[1].args[1]).toBe(0);
    }
  });
});

// ── pUseSpecialLine: BUTTONS ────────────────────────────────────────

describe('pUseSpecialLine BUTTONS (useAgain=1)', () => {
  it('case 42: switch flip guarded on evDoDoor return', () => {
    const { callbacks, events } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(42), 0, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evDoDoor', 'changeSwitchTexture']);
    expect(events[1].args[1]).toBe(1);
  });

  it('case 42: no flip when evDoDoor returns 0', () => {
    const { callbacks, events } = makeHarness({ evDoDoor: 0 });
    pUseSpecialLine(makePlayer(), makeLine(42), 0, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evDoDoor']);
  });

  it('case 138: light-on flips switch UNCONDITIONALLY (evLightTurnOn is void)', () => {
    const { callbacks, events } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(138), 0, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evLightTurnOn', 'changeSwitchTexture']);
    expect(events[0].args[1]).toBe(255);
    expect(events[1].args[1]).toBe(1);
  });

  it('case 139: light-off flips switch UNCONDITIONALLY with brightness 35', () => {
    const { callbacks, events } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(139), 0, callbacks);
    expect(events.map((e) => e.method)).toEqual(['evLightTurnOn', 'changeSwitchTexture']);
    expect(events[0].args[1]).toBe(35);
    expect(events[1].args[1]).toBe(1);
  });

  it('cases 99/134/136: dispatch locked blaze door as BUTTON, guarded on return', () => {
    for (const special of [99, 134, 136]) {
      const { callbacks, events } = makeHarness();
      pUseSpecialLine(makePlayer(), makeLine(special), 0, callbacks);
      expect(events.map((e) => e.method)).toEqual(['evDoLockedDoor', 'changeSwitchTexture']);
      expect(events[1].args[1]).toBe(1);
    }
  });
});

// ── pUseSpecialLine: plat amounts for cases 14/15/66/67 ─────────────

describe('pUseSpecialLine plat raise-and-change amount argument', () => {
  it('case 14 uses amount=32 (SWITCH)', () => {
    const { callbacks, events } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(14), 0, callbacks);
    expect(events[0].method).toBe('evDoPlat');
    expect(events[0].args[2]).toBe(32);
  });

  it('case 15 uses amount=24 (SWITCH)', () => {
    const { callbacks, events } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(15), 0, callbacks);
    expect(events[0].method).toBe('evDoPlat');
    expect(events[0].args[2]).toBe(24);
  });

  it('case 66 uses amount=24 (BUTTON)', () => {
    const { callbacks, events } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(66), 0, callbacks);
    expect(events[0].method).toBe('evDoPlat');
    expect(events[0].args[2]).toBe(24);
  });

  it('case 67 uses amount=32 (BUTTON)', () => {
    const { callbacks, events } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(67), 0, callbacks);
    expect(events[0].method).toBe('evDoPlat');
    expect(events[0].args[2]).toBe(32);
  });

  it('case 62 BUTTON plat uses amount=1 (the vanilla tag-forwarding quirk)', () => {
    const { callbacks, events } = makeHarness();
    pUseSpecialLine(makePlayer(), makeLine(62), 0, callbacks);
    expect(events[0].method).toBe('evDoPlat');
    expect(events[0].args[2]).toBe(1);
  });
});

// ── Light brightness argument for cross-specials ────────────────────

describe('pCrossSpecialLine light brightness arguments', () => {
  it('case 12 requests brightness 0 (match nearest)', () => {
    const { callbacks, events } = makeHarness();
    pCrossSpecialLine(makeLine(12), 0, makePlayer(), callbacks);
    expect(events[0].method).toBe('evLightTurnOn');
    expect(events[0].args[1]).toBe(0);
  });

  it('case 13 requests brightness 255 (full bright)', () => {
    const { callbacks, events } = makeHarness();
    pCrossSpecialLine(makeLine(13), 0, makePlayer(), callbacks);
    expect(events[0].method).toBe('evLightTurnOn');
    expect(events[0].args[1]).toBe(255);
  });

  it('case 35 requests brightness 35 (min bright)', () => {
    const { callbacks, events } = makeHarness();
    pCrossSpecialLine(makeLine(35), 0, makePlayer(), callbacks);
    expect(events[0].method).toBe('evLightTurnOn');
    expect(events[0].args[1]).toBe(35);
  });

  it('cases 79/80/81 retriggers fire evLightTurnOn with 35/0/255', () => {
    const cases: [number, number][] = [
      [79, 35],
      [80, 0],
      [81, 255],
    ];
    for (const [special, bright] of cases) {
      const { callbacks, events } = makeHarness();
      pCrossSpecialLine(makeLine(special), 0, makePlayer(), callbacks);
      expect(events[0].method).toBe('evLightTurnOn');
      expect(events[0].args[1]).toBe(bright);
      expect(events.length).toBe(1);
    }
  });
});

// ── All unknown specials default to no-op ───────────────────────────

describe('unknown specials are a no-op', () => {
  it('pCrossSpecialLine silently ignores unknown special (e.g. 200)', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(200);
    pCrossSpecialLine(line, 0, makePlayer(), callbacks);
    expect(events).toEqual([]);
    expect(line.special).toBe(200);
  });

  it('pUseSpecialLine returns true for unknown special and dispatches nothing', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(200);
    expect(pUseSpecialLine(makePlayer(), line, 0, callbacks)).toBe(true);
    expect(events).toEqual([]);
  });

  it('pShootSpecialLine silently ignores unknown special', () => {
    const { callbacks, events } = makeHarness();
    const line = makeLine(200);
    pShootSpecialLine(makePlayer(), line, callbacks);
    expect(events).toEqual([]);
  });
});
