import { describe, expect, it } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { CardType, createPlayer } from '../../src/player/playerSpawn.ts';
import type { Player } from '../../src/player/playerSpawn.ts';
import { ThinkerList, REMOVED, ThinkerNode } from '../../src/world/thinkers.ts';
import type { ThinkFunction } from '../../src/world/thinkers.ts';
import {
  CLOSE30_TICS,
  DOOR_CEILING_OFFSET,
  DoorDirection,
  PD_BLUEK,
  PD_BLUEO,
  PD_REDK,
  PD_REDO,
  PD_YELLOWK,
  PD_YELLOWO,
  PlaneMoveResult,
  RAISE_IN_5MINS_TICS,
  SFX_BDCLS,
  SFX_BDOPN,
  SFX_DORCLS,
  SFX_DOROPN,
  SFX_OOF,
  TICRATE,
  VDOORSPEED,
  VDOORWAIT,
  VerticalDoor,
  VerticalDoorType,
  evDoDoor,
  evDoLockedDoor,
  evVerticalDoor,
  spawnDoorCloseIn30,
  spawnDoorRaiseIn5Mins,
  tVerticalDoor,
} from '../../src/specials/doors.ts';
import type { DoorCallbacks, DoorSector } from '../../src/specials/doors.ts';

// ── Harness helpers ─────────────────────────────────────────────────

interface SoundEvent {
  readonly kind: 'sector' | 'player';
  readonly sfx: number;
  readonly sector?: DoorSector;
}

function makeSector(options: { ceilingheight: number; floorheight: number; tag?: number; special?: number }): DoorSector {
  return {
    ceilingheight: options.ceilingheight,
    floorheight: options.floorheight,
    special: options.special ?? 0,
    specialdata: null,
    tag: options.tag ?? 0,
  };
}

function makePlayer(cards: readonly CardType[] = []): Player {
  const player = createPlayer();
  for (const card of cards) player.cards[card] = true;
  return player;
}

class DirectionCarrier extends ThinkerNode {
  direction = 0;
}

class WaitCarrier extends ThinkerNode {
  wait = 0;
}

interface Harness {
  readonly callbacks: DoorCallbacks;
  readonly sounds: SoundEvent[];
  neighborCeiling: number;
  blockMove: boolean;
  reportCrush: boolean;
}

function makeHarness(
  options: {
    neighborCeiling?: number;
    blockMove?: boolean;
    reportCrush?: boolean;
  } = {},
): Harness {
  const sounds: SoundEvent[] = [];
  const state = {
    neighborCeiling: options.neighborCeiling ?? 128 * FRACUNIT,
    blockMove: options.blockMove ?? false,
    reportCrush: options.reportCrush ?? false,
  };
  const callbacks: DoorCallbacks = {
    movePlane(sector, speed, destheight, _crush, floorOrCeiling, direction) {
      // Doors only ever move the ceiling.
      if (floorOrCeiling !== 1) {
        throw new Error('door moved a floor plane — not vanilla');
      }
      if (state.blockMove && state.reportCrush) {
        return PlaneMoveResult.crushed;
      }
      if (state.blockMove) {
        return PlaneMoveResult.crushed;
      }
      if (direction === 1) {
        const next = sector.ceilingheight + speed;
        if (next >= destheight) {
          sector.ceilingheight = destheight;
          return PlaneMoveResult.pastdest;
        }
        sector.ceilingheight = next;
        return PlaneMoveResult.ok;
      }
      const next = sector.ceilingheight - speed;
      if (next <= destheight) {
        sector.ceilingheight = destheight;
        return PlaneMoveResult.pastdest;
      }
      sector.ceilingheight = next;
      return PlaneMoveResult.ok;
    },
    findLowestCeilingSurrounding() {
      return state.neighborCeiling;
    },
    startSectorSound(sector, sfx) {
      sounds.push({ kind: 'sector', sfx, sector });
    },
    startPlayerSound(sfx) {
      sounds.push({ kind: 'player', sfx });
    },
  };
  return {
    callbacks,
    sounds,
    get neighborCeiling() {
      return state.neighborCeiling;
    },
    set neighborCeiling(value: number) {
      state.neighborCeiling = value;
    },
    get blockMove() {
      return state.blockMove;
    },
    set blockMove(value: boolean) {
      state.blockMove = value;
    },
    get reportCrush() {
      return state.reportCrush;
    },
    set reportCrush(value: boolean) {
      state.reportCrush = value;
    },
  };
}

// ── Constants ───────────────────────────────────────────────────────

describe('door constants', () => {
  it('pins vanilla VDOORSPEED, VDOORWAIT, and timers', () => {
    expect(VDOORSPEED).toBe(FRACUNIT * 2);
    expect(VDOORWAIT).toBe(150);
    expect(CLOSE30_TICS).toBe(30 * TICRATE);
    expect(RAISE_IN_5MINS_TICS).toBe(5 * 60 * TICRATE);
    expect(DOOR_CEILING_OFFSET).toBe(4 * FRACUNIT);
  });

  it('exposes sfxenum_t indices matching sounds.h', () => {
    expect(SFX_DOROPN).toBe(20);
    expect(SFX_DORCLS).toBe(21);
    expect(SFX_OOF).toBe(34);
    expect(SFX_BDOPN).toBe(86);
    expect(SFX_BDCLS).toBe(87);
  });

  it('DoorDirection codes match T_MovePlane direction arg', () => {
    expect(DoorDirection.closing).toBe(-1);
    expect(DoorDirection.waiting).toBe(0);
    expect(DoorDirection.opening).toBe(1);
    expect(DoorDirection.initialWait).toBe(2);
  });
});

// ── T_VerticalDoor: opening branch ──────────────────────────────────

describe('T_VerticalDoor opening branch', () => {
  it('raises ceilingheight one speed per tic until pastdest', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.normal, harness.callbacks);
    door.direction = DoorDirection.opening;
    door.topheight = (VDOORSPEED * 3) | 0;
    door.speed = VDOORSPEED;
    door.topwait = VDOORWAIT;

    tVerticalDoor(door);
    expect(sector.ceilingheight).toBe(VDOORSPEED);
    expect<DoorDirection>(door.direction).toBe(DoorDirection.opening);
    tVerticalDoor(door);
    expect(sector.ceilingheight).toBe((VDOORSPEED * 2) | 0);
    expect<DoorDirection>(door.direction).toBe(DoorDirection.opening);
    tVerticalDoor(door);
    expect(sector.ceilingheight).toBe(door.topheight);
    // On pastdest, a normal door transitions to waiting with topwait.
    expect<DoorDirection>(door.direction).toBe(DoorDirection.waiting);
    expect(door.topcountdown).toBe(VDOORWAIT);
  });

  it('removes open-only thinkers after pastdest and clears specialdata', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.open, harness.callbacks);
    sector.specialdata = door;
    door.direction = DoorDirection.opening;
    door.topheight = VDOORSPEED;
    door.speed = VDOORSPEED;

    tVerticalDoor(door);

    expect(door.action).toBe(REMOVED);
    expect(sector.specialdata).toBeNull();
  });

  it('removes blazeOpen thinkers after pastdest without waiting', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.blazeOpen, harness.callbacks);
    sector.specialdata = door;
    door.direction = DoorDirection.opening;
    door.topheight = VDOORSPEED;
    door.speed = (VDOORSPEED * 4) | 0;

    tVerticalDoor(door);

    expect(door.action).toBe(REMOVED);
    expect(sector.specialdata).toBeNull();
  });

  it('blazeRaise pauses at topwait after pastdest without removing', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.blazeRaise, harness.callbacks);
    sector.specialdata = door;
    door.direction = DoorDirection.opening;
    door.topheight = VDOORSPEED;
    door.speed = VDOORSPEED;
    door.topwait = VDOORWAIT;

    tVerticalDoor(door);

    expect<DoorDirection>(door.direction).toBe(DoorDirection.waiting);
    expect(door.topcountdown).toBe(VDOORWAIT);
    expect(sector.specialdata).toBe(door);
  });

  it('close30ThenOpen removes on pastdest when opening (end of cycle)', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.close30ThenOpen, harness.callbacks);
    sector.specialdata = door;
    door.direction = DoorDirection.opening;
    door.topheight = VDOORSPEED;
    door.speed = VDOORSPEED;

    tVerticalDoor(door);

    expect(door.action).toBe(REMOVED);
    expect(sector.specialdata).toBeNull();
  });
});

// ── T_VerticalDoor: waiting branch ─────────────────────────────────

describe('T_VerticalDoor waiting branch', () => {
  it('normal door waits `topwait` tics then starts closing with sfx_dorcls', () => {
    const sector = makeSector({ ceilingheight: 10 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.normal, harness.callbacks);
    door.direction = DoorDirection.waiting;
    door.topcountdown = 3;

    tVerticalDoor(door);
    expect(door.topcountdown).toBe(2);
    expect<DoorDirection>(door.direction).toBe(DoorDirection.waiting);
    tVerticalDoor(door);
    tVerticalDoor(door);
    expect(door.topcountdown).toBe(0);
    expect<DoorDirection>(door.direction).toBe(DoorDirection.closing);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_DORCLS, sector }]);
  });

  it('blazeRaise plays sfx_bdcls when countdown hits zero', () => {
    const sector = makeSector({ ceilingheight: 10 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.blazeRaise, harness.callbacks);
    door.direction = DoorDirection.waiting;
    door.topcountdown = 1;

    tVerticalDoor(door);

    expect<DoorDirection>(door.direction).toBe(DoorDirection.closing);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_BDCLS, sector }]);
  });

  it('close30ThenOpen reverses to opening with sfx_doropn after wait', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.close30ThenOpen, harness.callbacks);
    door.direction = DoorDirection.waiting;
    door.topcountdown = 1;

    tVerticalDoor(door);

    expect<DoorDirection>(door.direction).toBe(DoorDirection.opening);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_DOROPN, sector }]);
  });

  it('unsupported types (open, close, blazeOpen, blazeClose) no-op on waiting expiry', () => {
    // In vanilla these types never enter the waiting state, but the
    // `default: break;` branch must silently ignore the expired timer
    // without mutating direction.
    for (const type of [VerticalDoorType.open, VerticalDoorType.close, VerticalDoorType.blazeOpen, VerticalDoorType.blazeClose, VerticalDoorType.raiseIn5Mins]) {
      const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
      const harness = makeHarness();
      const door = new VerticalDoor(sector, type, harness.callbacks);
      door.direction = DoorDirection.waiting;
      door.topcountdown = 1;

      tVerticalDoor(door);

      expect(door.direction).toBe(DoorDirection.waiting);
      expect(harness.sounds).toHaveLength(0);
    }
  });
});

// ── T_VerticalDoor: initialWait branch ─────────────────────────────

describe('T_VerticalDoor initialWait branch', () => {
  it('raiseIn5Mins converts to a normal opening door with sfx_doropn', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.raiseIn5Mins, harness.callbacks);
    door.direction = DoorDirection.initialWait;
    door.topcountdown = 1;
    door.topheight = 8 * FRACUNIT;

    tVerticalDoor(door);

    expect<DoorDirection>(door.direction).toBe(DoorDirection.opening);
    expect(door.type).toBe(VerticalDoorType.normal);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_DOROPN, sector }]);
  });

  it('decrements topcountdown without firing when it is still positive', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.raiseIn5Mins, harness.callbacks);
    door.direction = DoorDirection.initialWait;
    door.topcountdown = 5;

    tVerticalDoor(door);
    tVerticalDoor(door);

    expect(door.direction).toBe(DoorDirection.initialWait);
    expect(door.topcountdown).toBe(3);
    expect(harness.sounds).toHaveLength(0);
  });
});

// ── T_VerticalDoor: closing branch ─────────────────────────────────

describe('T_VerticalDoor closing branch', () => {
  it('lowers ceilingheight one speed per tic until pastdest', () => {
    const sector = makeSector({
      ceilingheight: VDOORSPEED * 2,
      floorheight: 0,
    });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.normal, harness.callbacks);
    sector.specialdata = door;
    door.direction = DoorDirection.closing;
    door.speed = VDOORSPEED;

    tVerticalDoor(door);
    expect(sector.ceilingheight).toBe(VDOORSPEED);
    tVerticalDoor(door);
    expect(sector.ceilingheight).toBe(0);
    expect(door.action).toBe(REMOVED);
    expect(sector.specialdata).toBeNull();
  });

  it('blazeRaise and blazeClose play sfx_bdcls on pastdest close', () => {
    for (const type of [VerticalDoorType.blazeRaise, VerticalDoorType.blazeClose]) {
      const sector = makeSector({ ceilingheight: VDOORSPEED, floorheight: 0 });
      const harness = makeHarness();
      const door = new VerticalDoor(sector, type, harness.callbacks);
      sector.specialdata = door;
      door.direction = DoorDirection.closing;
      door.speed = VDOORSPEED;

      tVerticalDoor(door);

      expect(door.action).toBe(REMOVED);
      expect(sector.specialdata).toBeNull();
      expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_BDCLS, sector }]);
    }
  });

  it('close30ThenOpen pauses at waiting with CLOSE30_TICS after pastdest', () => {
    const sector = makeSector({ ceilingheight: VDOORSPEED, floorheight: 0 });
    const harness = makeHarness();
    const door = new VerticalDoor(sector, VerticalDoorType.close30ThenOpen, harness.callbacks);
    sector.specialdata = door;
    door.direction = DoorDirection.closing;
    door.speed = VDOORSPEED;

    tVerticalDoor(door);

    expect<DoorDirection>(door.direction).toBe(DoorDirection.waiting);
    expect(door.topcountdown).toBe(CLOSE30_TICS);
    expect(sector.specialdata).toBe(door);
    expect(door.action).not.toBe(REMOVED);
  });

  it('crush reverses normal/close30ThenOpen/blazeRaise with sfx_doropn (parity quirk)', () => {
    // Vanilla uses sfx_doropn on crush-reverse even for blazeRaise.
    for (const type of [VerticalDoorType.normal, VerticalDoorType.close30ThenOpen, VerticalDoorType.blazeRaise]) {
      const sector = makeSector({ ceilingheight: VDOORSPEED * 4, floorheight: 0 });
      const harness = makeHarness({ blockMove: true, reportCrush: true });
      const door = new VerticalDoor(sector, type, harness.callbacks);
      sector.specialdata = door;
      door.direction = DoorDirection.closing;
      door.speed = VDOORSPEED;

      tVerticalDoor(door);

      expect<DoorDirection>(door.direction).toBe(DoorDirection.opening);
      expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_DOROPN, sector }]);
      expect(door.action).not.toBe(REMOVED);
      expect(sector.specialdata).toBe(door);
    }
  });

  it('crush does NOT reverse close and blazeClose (vanilla stays closing)', () => {
    for (const type of [VerticalDoorType.close, VerticalDoorType.blazeClose]) {
      const sector = makeSector({ ceilingheight: VDOORSPEED * 4, floorheight: 0 });
      const harness = makeHarness({ blockMove: true, reportCrush: true });
      const door = new VerticalDoor(sector, type, harness.callbacks);
      sector.specialdata = door;
      door.direction = DoorDirection.closing;
      door.speed = VDOORSPEED;

      tVerticalDoor(door);

      expect(door.direction).toBe(DoorDirection.closing);
      expect(harness.sounds).toHaveLength(0);
      expect(door.action).not.toBe(REMOVED);
    }
  });
});

// ── evDoDoor ───────────────────────────────────────────────────────

describe('evDoDoor', () => {
  it('creates one door per matching-tag sector and skips sectors with specialdata', () => {
    const open = makeSector({
      ceilingheight: 0,
      floorheight: 0,
      tag: 5,
    });
    const skip = makeSector({
      ceilingheight: 0,
      floorheight: 0,
      tag: 5,
    });
    const other = makeSector({
      ceilingheight: 0,
      floorheight: 0,
      tag: 6,
    });
    skip.specialdata = new VerticalDoor(skip, VerticalDoorType.normal, makeHarness().callbacks);
    const harness = makeHarness({ neighborCeiling: 64 * FRACUNIT });
    const list = new ThinkerList();

    const created = evDoDoor(5, VerticalDoorType.normal, [open, skip, other], list, harness.callbacks);

    expect(created).toBe(1);
    expect(open.specialdata).not.toBeNull();
    expect(other.specialdata).toBeNull();
    const door = open.specialdata as VerticalDoor;
    expect(door.type).toBe(VerticalDoorType.normal);
    expect(door.direction).toBe(DoorDirection.opening);
    expect(door.speed).toBe(VDOORSPEED);
    expect(door.topheight).toBe((64 * FRACUNIT - DOOR_CEILING_OFFSET) | 0);
  });

  it('returns 0 when no sector matches the tag', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0, tag: 9 });
    const harness = makeHarness();
    const list = new ThinkerList();
    expect(evDoDoor(7, VerticalDoorType.normal, [sector], list, harness.callbacks)).toBe(0);
    expect(sector.specialdata).toBeNull();
  });

  it('blazeRaise and blazeOpen use VDOORSPEED*4 and sfx_bdopn (when moving)', () => {
    for (const type of [VerticalDoorType.blazeRaise, VerticalDoorType.blazeOpen]) {
      const sector = makeSector({
        ceilingheight: 0,
        floorheight: 0,
        tag: 1,
      });
      const harness = makeHarness({ neighborCeiling: 64 * FRACUNIT });
      const list = new ThinkerList();

      evDoDoor(1, type, [sector], list, harness.callbacks);

      const door = sector.specialdata as VerticalDoor;
      expect(door.speed).toBe(VDOORSPEED * 4);
      expect(door.direction).toBe(DoorDirection.opening);
      expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_BDOPN, sector }]);
    }
  });

  it('silent open when topheight equals current ceiling (already at the cap)', () => {
    const neighbor = 64 * FRACUNIT;
    const sector = makeSector({
      ceilingheight: (neighbor - DOOR_CEILING_OFFSET) | 0,
      floorheight: 0,
      tag: 2,
    });
    const harness = makeHarness({ neighborCeiling: neighbor });
    const list = new ThinkerList();

    evDoDoor(2, VerticalDoorType.normal, [sector], list, harness.callbacks);

    const door = sector.specialdata as VerticalDoor;
    expect(door.topheight).toBe(sector.ceilingheight);
    expect(harness.sounds).toHaveLength(0);
  });

  it('close and blazeClose always play their sound and face downward', () => {
    const tagForClose = 3;
    for (const [type, sfx] of [
      [VerticalDoorType.close, SFX_DORCLS],
      [VerticalDoorType.blazeClose, SFX_BDCLS],
    ] as const) {
      const sector = makeSector({
        ceilingheight: 64 * FRACUNIT,
        floorheight: 0,
        tag: tagForClose,
      });
      const harness = makeHarness({ neighborCeiling: 64 * FRACUNIT });
      const list = new ThinkerList();

      evDoDoor(tagForClose, type, [sector], list, harness.callbacks);

      const door = sector.specialdata as VerticalDoor;
      expect(door.direction).toBe(DoorDirection.closing);
      expect(harness.sounds).toEqual([{ kind: 'sector', sfx, sector }]);
      if (type === VerticalDoorType.blazeClose) {
        expect(door.speed).toBe(VDOORSPEED * 4);
      }
    }
  });

  it('close30ThenOpen sets topheight to current ceiling and plays sfx_dorcls', () => {
    const sector = makeSector({
      ceilingheight: 64 * FRACUNIT,
      floorheight: 0,
      tag: 4,
    });
    const harness = makeHarness({ neighborCeiling: 200 * FRACUNIT });
    const list = new ThinkerList();

    evDoDoor(4, VerticalDoorType.close30ThenOpen, [sector], list, harness.callbacks);

    const door = sector.specialdata as VerticalDoor;
    expect(door.topheight).toBe(sector.ceilingheight);
    expect(door.direction).toBe(DoorDirection.closing);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_DORCLS, sector }]);
  });
});

// ── evVerticalDoor ─────────────────────────────────────────────────

describe('evVerticalDoor', () => {
  it('denies blue-locked line 26 when the player has no blue card/skull', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const list = new ThinkerList();
    const player = makePlayer();
    const line = { special: 26 };

    const result = evVerticalDoor(line, sector, player, list, harness.callbacks);

    expect(result).toBe(0);
    expect(player.message).toBe(PD_BLUEK);
    expect(harness.sounds).toEqual([{ kind: 'player', sfx: SFX_OOF }]);
    expect(sector.specialdata).toBeNull();
  });

  it('accepts blue-locked line 32 with a bluecard and opens a one-shot door', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness({ neighborCeiling: 64 * FRACUNIT });
    const list = new ThinkerList();
    const player = makePlayer([CardType.BLUECARD]);
    const line = { special: 32 };

    const result = evVerticalDoor(line, sector, player, list, harness.callbacks);

    expect(result).toBe(1);
    expect(line.special).toBe(0);
    const door = sector.specialdata as VerticalDoor;
    expect(door.type).toBe(VerticalDoorType.open);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_DOROPN, sector }]);
  });

  it('red-locked line 28 checks redcard/redskull and picks PD_REDK', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const list = new ThinkerList();
    const player = makePlayer([CardType.BLUECARD, CardType.YELLOWCARD]);
    const line = { special: 28 };

    expect(evVerticalDoor(line, sector, player, list, harness.callbacks)).toBe(0);
    expect(player.message).toBe(PD_REDK);
    expect(harness.sounds).toEqual([{ kind: 'player', sfx: SFX_OOF }]);

    player.cards[CardType.REDSKULL] = true;
    harness.sounds.length = 0;
    player.message = null;
    const result = evVerticalDoor(line, sector, player, list, harness.callbacks);
    expect(result).toBe(1);
    expect(player.message).toBeNull();
  });

  it('yellow-locked line 27/34 picks PD_YELLOWK on denial', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const list = new ThinkerList();
    const player = makePlayer();

    for (const special of [27, 34]) {
      harness.sounds.length = 0;
      player.message = null;
      const line = { special };
      expect(evVerticalDoor(line, sector, player, list, harness.callbacks)).toBe(0);
      expect<string | null>(player.message).toBe(PD_YELLOWK);
    }
  });

  it('monsters (player=null) cannot activate a locked door', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const list = new ThinkerList();
    const line = { special: 26 };

    const result = evVerticalDoor(line, sector, null, list, harness.callbacks);

    expect(result).toBe(0);
    expect(sector.specialdata).toBeNull();
  });

  it('plays sfx_bdopn for blaze line 117, sfx_doropn for line 1', () => {
    for (const [special, sfx] of [
      [1, SFX_DOROPN],
      [117, SFX_BDOPN],
    ] as const) {
      const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
      const harness = makeHarness({ neighborCeiling: 64 * FRACUNIT });
      const list = new ThinkerList();
      const line = { special };

      evVerticalDoor(line, sector, makePlayer(), list, harness.callbacks);

      expect(harness.sounds.find((e) => e.kind === 'sector')?.sfx).toBe(sfx);
      const door = sector.specialdata as VerticalDoor;
      if (special === 117) {
        expect(door.speed).toBe(VDOORSPEED * 4);
        expect(door.type).toBe(VerticalDoorType.blazeRaise);
      } else {
        expect(door.speed).toBe(VDOORSPEED);
        expect(door.type).toBe(VerticalDoorType.normal);
      }
    }
  });

  it('one-shot lines 31-34, 118 zero line.special; repeatable 1/26/27/28/117 do not', () => {
    const oneShot = [31, 32, 33, 34, 118];
    const repeatable = [1, 26, 27, 28, 117];

    for (const special of oneShot) {
      const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
      const harness = makeHarness({ neighborCeiling: 64 * FRACUNIT });
      const list = new ThinkerList();
      const player = makePlayer([CardType.BLUECARD, CardType.REDCARD, CardType.YELLOWCARD]);
      const line = { special };
      evVerticalDoor(line, sector, player, list, harness.callbacks);
      expect(line.special).toBe(0);
    }
    for (const special of repeatable) {
      const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
      const harness = makeHarness({ neighborCeiling: 64 * FRACUNIT });
      const list = new ThinkerList();
      const player = makePlayer([CardType.BLUECARD, CardType.REDCARD, CardType.YELLOWCARD]);
      const line = { special };
      evVerticalDoor(line, sector, player, list, harness.callbacks);
      expect(line.special).toBe(special);
    }
  });

  it('re-activates a rising door on line 1: player flips to closing', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness({ neighborCeiling: 64 * FRACUNIT });
    const list = new ThinkerList();
    const player = makePlayer();

    const line = { special: 1 };
    evVerticalDoor(line, sector, player, list, harness.callbacks);
    const door = sector.specialdata as VerticalDoor;
    expect(door.direction).toBe(DoorDirection.opening);

    const line2 = { special: 1 };
    const result = evVerticalDoor(line2, sector, player, list, harness.callbacks);
    expect(result).toBe(1);
    expect(door.direction).toBe(DoorDirection.closing);
    // specialdata must remain the same thinker (no new creation).
    expect(sector.specialdata).toBe(door);
  });

  it('re-activates a closing door on line 1: flips back to opening even for monsters', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const list = new ThinkerList();
    const door = new VerticalDoor(sector, VerticalDoorType.normal, harness.callbacks);
    door.direction = DoorDirection.closing;
    sector.specialdata = door;

    const result = evVerticalDoor({ special: 1 }, sector, null, list, harness.callbacks);

    expect(result).toBe(1);
    expect<DoorDirection>(door.direction).toBe(DoorDirection.opening);
  });

  it('monsters cannot close an already-open door (JDC guard)', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const list = new ThinkerList();
    const door = new VerticalDoor(sector, VerticalDoorType.normal, harness.callbacks);
    door.direction = DoorDirection.waiting;
    sector.specialdata = door;

    const result = evVerticalDoor({ special: 1 }, sector, null, list, harness.callbacks);

    expect(result).toBe(0);
    expect(door.direction).toBe(DoorDirection.waiting);
  });

  it('re-opens an occupied repeatable line by mutating a non-door direction carrier', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const list = new ThinkerList();
    const thinker = new DirectionCarrier();
    thinker.direction = DoorDirection.closing;
    sector.specialdata = thinker;

    const result = evVerticalDoor({ special: 1 }, sector, null, list, harness.callbacks);

    expect(result).toBe(1);
    expect(thinker.direction).toBe(DoorDirection.opening);
    expect(sector.specialdata).toBe(thinker);
    expect(harness.sounds).toHaveLength(0);
  });

  it('closes an occupied repeatable line by mutating a non-door wait carrier', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0 });
    const harness = makeHarness();
    const list = new ThinkerList();
    const thinker = new WaitCarrier();
    thinker.wait = 5;
    sector.specialdata = thinker;

    const result = evVerticalDoor({ special: 117 }, sector, makePlayer(), list, harness.callbacks);

    expect(result).toBe(1);
    expect(thinker.wait).toBe(DoorDirection.closing);
    expect(sector.specialdata).toBe(thinker);
    expect(harness.sounds).toHaveLength(0);
  });
});

// ── evDoLockedDoor ─────────────────────────────────────────────────

describe('evDoLockedDoor', () => {
  it('denies on missing blue key for line 99/133 with PD_BLUEO', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0, tag: 7 });
    const harness = makeHarness({ neighborCeiling: 64 * FRACUNIT });
    const list = new ThinkerList();
    const player = makePlayer([CardType.REDCARD]);

    for (const special of [99, 133]) {
      harness.sounds.length = 0;
      player.message = null;
      sector.specialdata = null;
      const result = evDoLockedDoor({ special }, VerticalDoorType.blazeOpen, 7, player, [sector], list, harness.callbacks);
      expect(result).toBe(0);
      expect<string | null>(player.message).toBe(PD_BLUEO);
      expect(harness.sounds).toEqual([{ kind: 'player', sfx: SFX_OOF }]);
      expect(sector.specialdata).toBeNull();
    }
  });

  it('admits with matching red card on line 134 and opens a blazeOpen door', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0, tag: 11 });
    const harness = makeHarness({ neighborCeiling: 64 * FRACUNIT });
    const list = new ThinkerList();
    const player = makePlayer([CardType.REDSKULL]);

    const result = evDoLockedDoor({ special: 134 }, VerticalDoorType.blazeOpen, 11, player, [sector], list, harness.callbacks);

    expect(result).toBe(1);
    const door = sector.specialdata as VerticalDoor;
    expect(door.type).toBe(VerticalDoorType.blazeOpen);
    expect(door.speed).toBe(VDOORSPEED * 4);
  });

  it('denies when no player is involved (e.g. monster trigger)', () => {
    const sector = makeSector({ ceilingheight: 0, floorheight: 0, tag: 3 });
    const harness = makeHarness();
    const list = new ThinkerList();
    const result = evDoLockedDoor({ special: 133 }, VerticalDoorType.blazeOpen, 3, null, [sector], list, harness.callbacks);
    expect(result).toBe(0);
    expect(sector.specialdata).toBeNull();
  });

  it('uses PD_YELLOWO for 136/137 and PD_REDO for 134/135', () => {
    const player = makePlayer();
    const harness = makeHarness();
    const list = new ThinkerList();
    const sector = makeSector({ ceilingheight: 0, floorheight: 0, tag: 1 });

    for (const special of [134, 135]) {
      harness.sounds.length = 0;
      player.message = null;
      sector.specialdata = null;
      evDoLockedDoor({ special }, VerticalDoorType.blazeOpen, 1, player, [sector], list, harness.callbacks);
      expect<string | null>(player.message).toBe(PD_REDO);
    }
    for (const special of [136, 137]) {
      harness.sounds.length = 0;
      player.message = null;
      sector.specialdata = null;
      evDoLockedDoor({ special }, VerticalDoorType.blazeOpen, 1, player, [sector], list, harness.callbacks);
      expect<string | null>(player.message).toBe(PD_YELLOWO);
    }
  });
});

// ── Spawners ───────────────────────────────────────────────────────

describe('spawnDoorCloseIn30', () => {
  it('arms a normal door in the waiting state with 30-second timer', () => {
    const sector = makeSector({
      ceilingheight: 64 * FRACUNIT,
      floorheight: 0,
      special: 10,
    });
    const harness = makeHarness();
    const list = new ThinkerList();

    const door = spawnDoorCloseIn30(sector, list, harness.callbacks);

    expect(door.type).toBe(VerticalDoorType.normal);
    expect(door.direction).toBe(DoorDirection.waiting);
    expect(door.topcountdown).toBe(CLOSE30_TICS);
    expect(door.topwait).toBe(VDOORWAIT);
    expect(sector.special).toBe(0);
    expect(sector.specialdata).toBe(door);
  });

  it('fires a close after CLOSE30_TICS and plays sfx_dorcls', () => {
    const sector = makeSector({
      ceilingheight: 64 * FRACUNIT,
      floorheight: 0,
      special: 10,
    });
    const harness = makeHarness();
    const list = new ThinkerList();

    const door = spawnDoorCloseIn30(sector, list, harness.callbacks);

    for (let i = 0; i < CLOSE30_TICS - 1; i++) {
      tVerticalDoor(door);
      expect(door.direction).toBe(DoorDirection.waiting);
    }
    tVerticalDoor(door);
    expect(door.direction).toBe(DoorDirection.closing);
    expect(harness.sounds.at(-1)).toEqual({
      kind: 'sector',
      sfx: SFX_DORCLS,
      sector,
    });
  });
});

describe('spawnDoorRaiseIn5Mins', () => {
  it('arms raiseIn5Mins in initialWait with 5-minute timer and computed topheight', () => {
    const neighbor = 96 * FRACUNIT;
    const sector = makeSector({
      ceilingheight: 0,
      floorheight: 0,
      special: 14,
    });
    const harness = makeHarness({ neighborCeiling: neighbor });
    const list = new ThinkerList();

    const door = spawnDoorRaiseIn5Mins(sector, list, harness.callbacks);

    expect(door.type).toBe(VerticalDoorType.raiseIn5Mins);
    expect(door.direction).toBe(DoorDirection.initialWait);
    expect(door.topcountdown).toBe(RAISE_IN_5MINS_TICS);
    expect(door.topheight).toBe((neighbor - DOOR_CEILING_OFFSET) | 0);
    expect(sector.special).toBe(0);
    expect(sector.specialdata).toBe(door);
  });

  it('converts to a normal opening door after the 5-minute countdown', () => {
    const sector = makeSector({
      ceilingheight: 0,
      floorheight: 0,
      special: 14,
    });
    const harness = makeHarness({ neighborCeiling: VDOORSPEED * 3 });
    const list = new ThinkerList();

    const door = spawnDoorRaiseIn5Mins(sector, list, harness.callbacks);

    door.topcountdown = 1;
    tVerticalDoor(door);

    expect(door.direction).toBe(DoorDirection.opening);
    expect(door.type).toBe(VerticalDoorType.normal);
    expect(harness.sounds.at(-1)).toEqual({
      kind: 'sector',
      sfx: SFX_DOROPN,
      sector,
    });
  });
});

// ── ThinkerList integration ────────────────────────────────────────

describe('doors under ThinkerList.run()', () => {
  it('runs scheduled tics and unlinks closed doors', () => {
    const sector = makeSector({ ceilingheight: VDOORSPEED, floorheight: 0 });
    const harness = makeHarness();
    const list = new ThinkerList();
    const door = new VerticalDoor(sector, VerticalDoorType.normal, harness.callbacks);
    sector.specialdata = door;
    door.action = tVerticalDoor;
    door.direction = DoorDirection.closing;
    door.speed = VDOORSPEED;
    list.add(door);

    list.run();
    expect(sector.ceilingheight).toBe(0);
    expect<ThinkFunction | typeof REMOVED | null>(door.action).toBe(REMOVED);
    expect(sector.specialdata).toBeNull();
    // Vanilla P_RunThinkers unlinks REMOVED nodes on the NEXT tic.
    list.run();
    expect(list.isEmpty).toBe(true);
  });
});
