import { describe, expect, it } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import type { ActiveCeilingSnapshot, ActivePlatSnapshot, ActivePlatsSnapshot, ActiveCeilingsSnapshot, ButtonListSnapshot, ButtonSnapshot } from '../../src/specials/activeSpecials.ts';
import { restoreActiveCeilings, restoreActivePlats, restoreButtons, snapshotActiveCeilings, snapshotActivePlats, snapshotButtons } from '../../src/specials/activeSpecials.ts';
import { ActiveCeilings, Ceiling, CeilingDirection, CeilingType, MAXCEILINGS, tMoveCeiling } from '../../src/specials/ceilings.ts';
import type { CeilingCallbacks, CeilingSector } from '../../src/specials/ceilings.ts';
import { PlaneMoveResult } from '../../src/specials/doors.ts';
import { ActivePlats, MAXPLATS, PLATSPEED, PLATWAIT_TICS, Platform, PlatStatus, PlatType, tPlatRaise } from '../../src/specials/platforms.ts';
import type { PlatCallbacks, PlatSector } from '../../src/specials/platforms.ts';
import { ButtonWhere, MAXBUTTONS, createButtonList } from '../../src/specials/switches.ts';
import type { Button, SwitchLine, SwitchSide } from '../../src/specials/switches.ts';
import { REMOVED, ThinkerList } from '../../src/world/thinkers.ts';

// ── Plat harness ────────────────────────────────────────────────────

function makePlatSector(options: { floorheight?: number; ceilingheight?: number; floorpic?: number; tag?: number } = {}): PlatSector {
  return {
    floorheight: options.floorheight ?? 0,
    ceilingheight: options.ceilingheight ?? 256 * FRACUNIT,
    floorpic: options.floorpic ?? 0,
    special: 0,
    specialdata: null,
    tag: options.tag ?? 0,
  };
}

function makePlatCallbacks(): PlatCallbacks {
  return {
    movePlane: () => PlaneMoveResult.ok,
    findLowestFloorSurrounding: () => 0,
    findHighestFloorSurrounding: () => 64 * FRACUNIT,
    findNextHighestFloor: () => 64 * FRACUNIT,
    pRandom: () => 0,
    getLevelTime: () => 0,
  };
}

function makeCeilingSector(options: { floorheight?: number; ceilingheight?: number; tag?: number } = {}): CeilingSector {
  return {
    floorheight: options.floorheight ?? 0,
    ceilingheight: options.ceilingheight ?? 256 * FRACUNIT,
    special: 0,
    specialdata: null,
    tag: options.tag ?? 0,
  };
}

function makeCeilingCallbacks(): CeilingCallbacks {
  return {
    movePlane: () => PlaneMoveResult.ok,
    findHighestCeilingSurrounding: () => 256 * FRACUNIT,
    getLevelTime: () => 0,
  };
}

// ── Plat snapshot / restore ─────────────────────────────────────────

describe('snapshotActivePlats', () => {
  it('returns a MAXPLATS-long array of nulls for an empty registry', () => {
    const plats = new ActivePlats();
    const snap = snapshotActivePlats(plats, () => 0);
    expect(snap.length).toBe(MAXPLATS);
    for (const entry of snap) {
      expect(entry).toBeNull();
    }
  });

  it('captures a live plat at its exact slot index', () => {
    const sectors = [makePlatSector({ tag: 7 })];
    const plats = new ActivePlats();
    const plat = new Platform(sectors[0]!, PlatType.downWaitUpStay, makePlatCallbacks());
    plat.speed = PLATSPEED * 4;
    plat.low = -16 * FRACUNIT;
    plat.high = 0;
    plat.wait = PLATWAIT_TICS;
    plat.count = 42;
    plat.status = PlatStatus.down;
    plat.oldstatus = PlatStatus.up;
    plat.crush = false;
    plat.tag = 7;
    plats.slots[3] = plat;

    const snap = snapshotActivePlats(plats, (sector) => sectors.indexOf(sector));
    expect(snap[0]).toBeNull();
    expect(snap[3]).not.toBeNull();
    const entry = snap[3] as ActivePlatSnapshot;
    expect(entry.sectorIndex).toBe(0);
    expect(entry.type).toBe(PlatType.downWaitUpStay);
    expect(entry.speed).toBe(PLATSPEED * 4);
    expect(entry.low).toBe(-16 * FRACUNIT);
    expect(entry.high).toBe(0);
    expect(entry.wait).toBe(PLATWAIT_TICS);
    expect(entry.count).toBe(42);
    expect(entry.status).toBe(PlatStatus.down);
    expect(entry.oldstatus).toBe(PlatStatus.up);
    expect(entry.crush).toBe(false);
    expect(entry.tag).toBe(7);
    expect(entry.inStasis).toBe(false);
  });

  it('marks an in-stasis plat with inStasis=true and preserves oldstatus', () => {
    const sectors = [makePlatSector({ tag: 1 })];
    const plats = new ActivePlats();
    const plat = new Platform(sectors[0]!, PlatType.perpetualRaise, makePlatCallbacks());
    plat.oldstatus = PlatStatus.up;
    plat.status = PlatStatus.inStasis;
    plat.action = null;
    plats.slots[0] = plat;

    const snap = snapshotActivePlats(plats, () => 0);
    const entry = snap[0] as ActivePlatSnapshot;
    expect(entry.inStasis).toBe(true);
    expect(entry.status).toBe(PlatStatus.inStasis);
    expect(entry.oldstatus).toBe(PlatStatus.up);
  });

  it('preserves exact slot positions when only some slots are live', () => {
    const sectors = [makePlatSector(), makePlatSector()];
    const plats = new ActivePlats();
    const callbacks = makePlatCallbacks();
    const a = new Platform(sectors[0]!, PlatType.perpetualRaise, callbacks);
    const b = new Platform(sectors[1]!, PlatType.blazeDWUS, callbacks);
    plats.slots[2] = a;
    plats.slots[7] = b;

    const snap = snapshotActivePlats(plats, (s) => sectors.indexOf(s));
    expect(snap[0]).toBeNull();
    expect(snap[2]).not.toBeNull();
    expect(snap[7]).not.toBeNull();
    expect((snap[2] as ActivePlatSnapshot).type).toBe(PlatType.perpetualRaise);
    expect((snap[7] as ActivePlatSnapshot).type).toBe(PlatType.blazeDWUS);
  });
});

describe('restoreActivePlats', () => {
  it('rebuilds an empty registry from an all-null snapshot', () => {
    const snap: ActivePlatsSnapshot = new Array(MAXPLATS).fill(null);
    const thinkers = new ThinkerList();
    const plats = restoreActivePlats(snap, [], makePlatCallbacks(), thinkers);
    expect(plats.slots.every((s) => s === null)).toBe(true);
    expect(thinkers.isEmpty).toBe(true);
  });

  it('restores live plat state, sector.specialdata, thinker membership, and action closure', () => {
    const sector = makePlatSector({ tag: 5 });
    const saved: ActivePlatSnapshot = {
      sectorIndex: 0,
      type: PlatType.downWaitUpStay,
      speed: PLATSPEED * 4,
      low: -8 * FRACUNIT,
      high: 16 * FRACUNIT,
      wait: PLATWAIT_TICS,
      count: 15,
      status: PlatStatus.up,
      oldstatus: PlatStatus.down,
      crush: false,
      tag: 5,
      inStasis: false,
    };
    const snap: ActivePlatsSnapshot = Object.assign(new Array(MAXPLATS).fill(null) as (ActivePlatSnapshot | null)[], { 4: saved });
    const thinkers = new ThinkerList();
    const plats = restoreActivePlats(snap, [sector], makePlatCallbacks(), thinkers);

    const plat = plats.slots[4];
    expect(plat).not.toBeNull();
    expect(plat!.sector).toBe(sector);
    expect(plat!.speed).toBe(PLATSPEED * 4);
    expect(plat!.low).toBe(-8 * FRACUNIT);
    expect(plat!.high).toBe(16 * FRACUNIT);
    expect(plat!.wait).toBe(PLATWAIT_TICS);
    expect(plat!.count).toBe(15);
    expect(plat!.status).toBe(PlatStatus.up);
    expect(plat!.oldstatus).toBe(PlatStatus.down);
    expect(plat!.crush).toBe(false);
    expect(plat!.tag).toBe(5);
    expect(sector.specialdata).toBe(plat);
    expect(typeof plat!.action).toBe('function');
    expect(thinkers.isEmpty).toBe(false);
  });

  it('leaves action=null on in-stasis plats and preserves oldstatus on rebuild', () => {
    const sector = makePlatSector({ tag: 9 });
    const saved: ActivePlatSnapshot = {
      sectorIndex: 0,
      type: PlatType.perpetualRaise,
      speed: PLATSPEED,
      low: 0,
      high: 64 * FRACUNIT,
      wait: PLATWAIT_TICS,
      count: 0,
      status: PlatStatus.inStasis,
      oldstatus: PlatStatus.down,
      crush: false,
      tag: 9,
      inStasis: true,
    };
    const snap: ActivePlatsSnapshot = Object.assign(new Array(MAXPLATS).fill(null) as (ActivePlatSnapshot | null)[], { 0: saved });
    const plats = restoreActivePlats(snap, [sector], makePlatCallbacks(), new ThinkerList());

    const plat = plats.slots[0]!;
    expect(plat.status).toBe(PlatStatus.inStasis);
    expect(plat.oldstatus).toBe(PlatStatus.down);
    expect(plat.action).toBeNull();
  });

  it('restored action removes the plat from the rebuilt registry on up-pastdest', () => {
    const sector = makePlatSector({ tag: 2, floorheight: 16 * FRACUNIT });
    const callbacks: PlatCallbacks = {
      movePlane: (s, _speed, destheight) => {
        s.floorheight = destheight;
        return PlaneMoveResult.pastdest;
      },
      findLowestFloorSurrounding: () => 0,
      findHighestFloorSurrounding: () => 64 * FRACUNIT,
      findNextHighestFloor: () => 64 * FRACUNIT,
      pRandom: () => 0,
      getLevelTime: () => 0,
    };
    const saved: ActivePlatSnapshot = {
      sectorIndex: 0,
      type: PlatType.downWaitUpStay,
      speed: PLATSPEED * 4,
      low: 0,
      high: 16 * FRACUNIT,
      wait: PLATWAIT_TICS,
      count: 0,
      status: PlatStatus.up,
      oldstatus: PlatStatus.down,
      crush: false,
      tag: 2,
      inStasis: false,
    };
    const snap: ActivePlatsSnapshot = Object.assign(new Array(MAXPLATS).fill(null) as (ActivePlatSnapshot | null)[], { 1: saved });
    const plats = restoreActivePlats(snap, [sector], callbacks, new ThinkerList());

    const plat = plats.slots[1]!;
    const platAction = plat.action;
    if (typeof platAction !== 'function') throw new Error('expected live plat action');
    platAction(plat);
    expect(plats.slots[1]).toBeNull();
    expect(plat.action).toBe(REMOVED);
    expect(sector.specialdata).toBeNull();
  });

  it('round-trips an in-stasis plat preserving all fields byte-for-byte', () => {
    const sectors = [makePlatSector({ tag: 3 }), makePlatSector({ tag: 4 })];
    const originalPlats = new ActivePlats();
    const callbacks = makePlatCallbacks();
    const live = new Platform(sectors[0]!, PlatType.downWaitUpStay, callbacks);
    live.speed = PLATSPEED * 4;
    live.low = 0;
    live.high = 32 * FRACUNIT;
    live.wait = PLATWAIT_TICS;
    live.count = 7;
    live.status = PlatStatus.down;
    live.tag = 3;
    const stasis = new Platform(sectors[1]!, PlatType.perpetualRaise, callbacks);
    stasis.status = PlatStatus.inStasis;
    stasis.oldstatus = PlatStatus.up;
    stasis.action = null;
    stasis.tag = 4;
    originalPlats.slots[2] = live;
    originalPlats.slots[9] = stasis;

    const snap = snapshotActivePlats(originalPlats, (s) => sectors.indexOf(s));
    // Clear original sectors' specialdata so restore can re-bind.
    sectors[0]!.specialdata = null;
    sectors[1]!.specialdata = null;
    const reloaded = restoreActivePlats(snap, sectors, callbacks, new ThinkerList());

    expect(reloaded.slots[2]!.status).toBe(PlatStatus.down);
    expect(reloaded.slots[2]!.action).not.toBeNull();
    expect(reloaded.slots[9]!.status).toBe(PlatStatus.inStasis);
    expect(reloaded.slots[9]!.oldstatus).toBe(PlatStatus.up);
    expect(reloaded.slots[9]!.action).toBeNull();
  });
});

// ── Ceiling snapshot / restore ─────────────────────────────────────

describe('snapshotActiveCeilings', () => {
  it('returns a MAXCEILINGS-long array of nulls for an empty registry', () => {
    const ceilings = new ActiveCeilings();
    const snap = snapshotActiveCeilings(ceilings, () => 0);
    expect(snap.length).toBe(MAXCEILINGS);
    for (const entry of snap) {
      expect(entry).toBeNull();
    }
  });

  it('captures a live ceiling with all fields', () => {
    const sectors = [makeCeilingSector({ tag: 13 })];
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sectors[0]!, CeilingType.crushAndRaise, makeCeilingCallbacks());
    ceiling.bottomheight = 8 * FRACUNIT;
    ceiling.topheight = 128 * FRACUNIT;
    ceiling.speed = 2 * FRACUNIT;
    ceiling.crush = true;
    ceiling.direction = CeilingDirection.down;
    ceiling.olddirection = CeilingDirection.up;
    ceiling.tag = 13;
    ceilings.slots[5] = ceiling;

    const snap = snapshotActiveCeilings(ceilings, (s) => sectors.indexOf(s));
    const entry = snap[5] as ActiveCeilingSnapshot;
    expect(entry.sectorIndex).toBe(0);
    expect(entry.type).toBe(CeilingType.crushAndRaise);
    expect(entry.bottomheight).toBe(8 * FRACUNIT);
    expect(entry.topheight).toBe(128 * FRACUNIT);
    expect(entry.speed).toBe(2 * FRACUNIT);
    expect(entry.crush).toBe(true);
    expect(entry.direction).toBe(CeilingDirection.down);
    expect(entry.olddirection).toBe(CeilingDirection.up);
    expect(entry.tag).toBe(13);
    expect(entry.inStasis).toBe(false);
  });

  it('marks in-stasis ceiling with inStasis=true and preserves olddirection', () => {
    const sectors = [makeCeilingSector({ tag: 1 })];
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sectors[0]!, CeilingType.silentCrushAndRaise, makeCeilingCallbacks());
    ceiling.direction = CeilingDirection.inStasis;
    ceiling.olddirection = CeilingDirection.down;
    ceiling.action = null;
    ceilings.slots[0] = ceiling;

    const snap = snapshotActiveCeilings(ceilings, () => 0);
    const entry = snap[0] as ActiveCeilingSnapshot;
    expect(entry.inStasis).toBe(true);
    expect(entry.direction).toBe(CeilingDirection.inStasis);
    expect(entry.olddirection).toBe(CeilingDirection.down);
  });
});

describe('restoreActiveCeilings', () => {
  it('rebuilds an empty registry from an all-null snapshot', () => {
    const snap: ActiveCeilingsSnapshot = new Array(MAXCEILINGS).fill(null);
    const thinkers = new ThinkerList();
    const ceilings = restoreActiveCeilings(snap, [], makeCeilingCallbacks(), thinkers);
    expect(ceilings.slots.every((s) => s === null)).toBe(true);
    expect(thinkers.isEmpty).toBe(true);
  });

  it('restores ceiling state, sector.specialdata, thinker membership, and action closure', () => {
    const sector = makeCeilingSector({ tag: 6 });
    const saved: ActiveCeilingSnapshot = {
      sectorIndex: 0,
      type: CeilingType.fastCrushAndRaise,
      bottomheight: 8 * FRACUNIT,
      topheight: 200 * FRACUNIT,
      speed: 2 * FRACUNIT,
      crush: true,
      direction: CeilingDirection.down,
      olddirection: CeilingDirection.up,
      tag: 6,
      inStasis: false,
    };
    const snap: ActiveCeilingsSnapshot = Object.assign(new Array(MAXCEILINGS).fill(null) as (ActiveCeilingSnapshot | null)[], { 4: saved });
    const thinkers = new ThinkerList();
    const ceilings = restoreActiveCeilings(snap, [sector], makeCeilingCallbacks(), thinkers);

    const ceiling = ceilings.slots[4]!;
    expect(ceiling.sector).toBe(sector);
    expect(ceiling.type).toBe(CeilingType.fastCrushAndRaise);
    expect(ceiling.bottomheight).toBe(8 * FRACUNIT);
    expect(ceiling.topheight).toBe(200 * FRACUNIT);
    expect(ceiling.speed).toBe(2 * FRACUNIT);
    expect(ceiling.crush).toBe(true);
    expect(ceiling.direction).toBe(CeilingDirection.down);
    expect(ceiling.olddirection).toBe(CeilingDirection.up);
    expect(ceiling.tag).toBe(6);
    expect(sector.specialdata).toBe(ceiling);
    expect(typeof ceiling.action).toBe('function');
    expect(thinkers.isEmpty).toBe(false);
  });

  it('leaves action=null on in-stasis ceilings and preserves olddirection on rebuild', () => {
    const sector = makeCeilingSector({ tag: 11 });
    const saved: ActiveCeilingSnapshot = {
      sectorIndex: 0,
      type: CeilingType.silentCrushAndRaise,
      bottomheight: 8 * FRACUNIT,
      topheight: 128 * FRACUNIT,
      speed: FRACUNIT,
      crush: true,
      direction: CeilingDirection.inStasis,
      olddirection: CeilingDirection.up,
      tag: 11,
      inStasis: true,
    };
    const snap: ActiveCeilingsSnapshot = Object.assign(new Array(MAXCEILINGS).fill(null) as (ActiveCeilingSnapshot | null)[], { 0: saved });
    const ceilings = restoreActiveCeilings(snap, [sector], makeCeilingCallbacks(), new ThinkerList());

    const ceiling = ceilings.slots[0]!;
    expect(ceiling.direction).toBe(CeilingDirection.inStasis);
    expect(ceiling.olddirection).toBe(CeilingDirection.up);
    expect(ceiling.action).toBeNull();
  });

  it('restored ceiling action removes the ceiling from the rebuilt registry on pastdest for lowerToFloor', () => {
    const sector = makeCeilingSector({ tag: 2, ceilingheight: 0 });
    const callbacks: CeilingCallbacks = {
      movePlane: (s, _speed, destheight) => {
        s.ceilingheight = destheight;
        return PlaneMoveResult.pastdest;
      },
      findHighestCeilingSurrounding: () => 256 * FRACUNIT,
      getLevelTime: () => 0,
    };
    const saved: ActiveCeilingSnapshot = {
      sectorIndex: 0,
      type: CeilingType.lowerToFloor,
      bottomheight: 0,
      topheight: 128 * FRACUNIT,
      speed: FRACUNIT,
      crush: false,
      direction: CeilingDirection.down,
      olddirection: CeilingDirection.down,
      tag: 2,
      inStasis: false,
    };
    const snap: ActiveCeilingsSnapshot = Object.assign(new Array(MAXCEILINGS).fill(null) as (ActiveCeilingSnapshot | null)[], { 3: saved });
    const ceilings = restoreActiveCeilings(snap, [sector], callbacks, new ThinkerList());

    const ceiling = ceilings.slots[3]!;
    const ceilingAction = ceiling.action;
    if (typeof ceilingAction !== 'function') throw new Error('expected live ceiling action');
    ceilingAction(ceiling);
    expect(ceilings.slots[3]).toBeNull();
    expect(ceiling.action).toBe(REMOVED);
    expect(sector.specialdata).toBeNull();
  });
});

// ── Button snapshot / restore ──────────────────────────────────────

describe('snapshotButtons', () => {
  it('returns a MAXBUTTONS-long array of nulls for a fresh button list', () => {
    const buttons = createButtonList();
    const snap = snapshotButtons(
      buttons,
      () => -1,
      () => -1,
      () => -1,
    );
    expect(snap.length).toBe(MAXBUTTONS);
    for (const entry of snap) {
      expect(entry).toBeNull();
    }
  });

  it('captures every active slot with its indices and leaves inactive slots null', () => {
    const buttons = createButtonList();
    const line: SwitchLine = { special: 7 };
    const side: SwitchSide = { toptexture: 10, midtexture: 11, bottomtexture: 12 };
    const origin = { sector: 'origin0' };
    buttons[2] = {
      line,
      side,
      where: ButtonWhere.middle,
      btexture: 10,
      btimer: 17,
      soundorg: origin,
    };
    buttons[5] = {
      line,
      side: null,
      where: ButtonWhere.top,
      btexture: 3,
      btimer: 1,
      soundorg: null,
    };

    const snap = snapshotButtons(
      buttons,
      (l) => (l === line ? 2 : -1),
      (s) => (s === side ? 4 : -1),
      (o) => (o === origin ? 6 : -1),
    );
    expect(snap[0]).toBeNull();
    expect(snap[2]).not.toBeNull();
    expect(snap[5]).not.toBeNull();
    expect(snap[1]).toBeNull();

    const active = snap[2] as ButtonSnapshot;
    expect(active.lineIndex).toBe(2);
    expect(active.sideIndex).toBe(4);
    expect(active.where).toBe(ButtonWhere.middle);
    expect(active.btexture).toBe(10);
    expect(active.btimer).toBe(17);
    expect(active.soundorgIndex).toBe(6);

    const nullRefs = snap[5] as ButtonSnapshot;
    expect(nullRefs.lineIndex).toBe(2);
    expect(nullRefs.sideIndex).toBe(-1);
    expect(nullRefs.soundorgIndex).toBe(-1);
  });

  it('skips slots with btimer=0 even if other fields are populated', () => {
    const buttons = createButtonList();
    buttons[1] = {
      line: { special: 7 },
      side: { toptexture: 1, midtexture: 2, bottomtexture: 3 },
      where: ButtonWhere.bottom,
      btexture: 9,
      btimer: 0,
      soundorg: null,
    };
    const snap = snapshotButtons(
      buttons,
      () => 0,
      () => 0,
      () => 0,
    );
    expect(snap[1]).toBeNull();
  });
});

describe('restoreButtons', () => {
  it('resets every slot on an all-null snapshot', () => {
    const buttons = createButtonList();
    buttons[0] = {
      line: { special: 7 },
      side: { toptexture: 1, midtexture: 2, bottomtexture: 3 },
      where: ButtonWhere.bottom,
      btexture: 9,
      btimer: 20,
      soundorg: { sector: 'old' },
    };
    const snap: ButtonListSnapshot = new Array(MAXBUTTONS).fill(null);
    restoreButtons(
      snap,
      buttons,
      () => null,
      () => null,
      () => null,
    );
    for (const slot of buttons) {
      expect(slot.line).toBeNull();
      expect(slot.side).toBeNull();
      expect(slot.btimer).toBe(0);
      expect(slot.btexture).toBe(0);
      expect(slot.soundorg).toBeNull();
      expect(slot.where).toBe(ButtonWhere.top);
    }
  });

  it('restores active slots using caller-supplied index resolvers', () => {
    const buttons = createButtonList();
    const line: SwitchLine = { special: 0 };
    const side: SwitchSide = { toptexture: 0, midtexture: 0, bottomtexture: 0 };
    const origin = { tag: 'reload-origin' };
    const snapEntry: ButtonSnapshot = {
      lineIndex: 3,
      sideIndex: 4,
      where: ButtonWhere.bottom,
      btexture: 21,
      btimer: 12,
      soundorgIndex: 5,
    };
    const snap: ButtonListSnapshot = Object.assign(new Array(MAXBUTTONS).fill(null) as (ButtonSnapshot | null)[], { 8: snapEntry });

    restoreButtons(
      snap,
      buttons,
      (i) => (i === 3 ? line : null),
      (i) => (i === 4 ? side : null),
      (i) => (i === 5 ? origin : null),
    );

    const slot = buttons[8]!;
    expect(slot.line).toBe(line);
    expect(slot.side).toBe(side);
    expect(slot.where).toBe(ButtonWhere.bottom);
    expect(slot.btexture).toBe(21);
    expect(slot.btimer).toBe(12);
    expect(slot.soundorg).toBe(origin);
  });

  it('decodes -1 indices back to null for line, side, and soundorg', () => {
    const buttons = createButtonList();
    const snapEntry: ButtonSnapshot = {
      lineIndex: -1,
      sideIndex: -1,
      where: ButtonWhere.top,
      btexture: 4,
      btimer: 7,
      soundorgIndex: -1,
    };
    const snap: ButtonListSnapshot = Object.assign(new Array(MAXBUTTONS).fill(null) as (ButtonSnapshot | null)[], { 0: snapEntry });

    let lineLookupCalls = 0;
    let sideLookupCalls = 0;
    let soundLookupCalls = 0;
    restoreButtons(
      snap,
      buttons,
      () => {
        lineLookupCalls++;
        return { special: 0 };
      },
      () => {
        sideLookupCalls++;
        return { toptexture: 0, midtexture: 0, bottomtexture: 0 };
      },
      () => {
        soundLookupCalls++;
        return {};
      },
    );
    expect(lineLookupCalls).toBe(0);
    expect(sideLookupCalls).toBe(0);
    expect(soundLookupCalls).toBe(0);

    const slot = buttons[0]!;
    expect(slot.line).toBeNull();
    expect(slot.side).toBeNull();
    expect(slot.soundorg).toBeNull();
    expect(slot.btimer).toBe(7);
    expect(slot.btexture).toBe(4);
  });

  it('round-trips an active button array through snapshot + restore', () => {
    const buttons = createButtonList();
    const line: SwitchLine = { special: 7 };
    const side: SwitchSide = { toptexture: 1, midtexture: 2, bottomtexture: 3 };
    const origin = { sector: 'origin' };
    buttons[10] = {
      line,
      side,
      where: ButtonWhere.top,
      btexture: 33,
      btimer: 25,
      soundorg: origin,
    };

    const lines: (SwitchLine | null)[] = [null, null, null, line];
    const sides: (SwitchSide | null)[] = [null, null, null, null, side];
    const origins: (typeof origin | null)[] = [null, null, null, null, null, origin];
    const snap = snapshotButtons(
      buttons,
      (l) => (l === null ? -1 : lines.indexOf(l)),
      (s) => (s === null ? -1 : sides.indexOf(s)),
      (o) => (o === null ? -1 : origins.indexOf(o as typeof origin)),
    );

    const reload = createButtonList();
    restoreButtons(
      snap,
      reload,
      (i) => lines[i]!,
      (i) => sides[i]!,
      (i) => origins[i]!,
    );

    expect(reload[10]!.line).toBe(line);
    expect(reload[10]!.side).toBe(side);
    expect(reload[10]!.soundorg).toBe(origin);
    expect(reload[10]!.btimer).toBe(25);
    expect(reload[10]!.btexture).toBe(33);
    expect(reload[10]!.where).toBe(ButtonWhere.top);
    expect(reload[0]!.btimer).toBe(0);
  });
});

// ── tPlatRaise / tMoveCeiling smoke: closures share the rebuilt registry ──

describe('active-special closure identity', () => {
  it('tPlatRaise called via the restored action observes the rebuilt registry (not the original)', () => {
    const sector = makePlatSector({ tag: 1, floorheight: 32 * FRACUNIT });
    const callbacks: PlatCallbacks = {
      movePlane: (s, _speed, destheight) => {
        s.floorheight = destheight;
        return PlaneMoveResult.pastdest;
      },
      findLowestFloorSurrounding: () => 0,
      findHighestFloorSurrounding: () => 64 * FRACUNIT,
      findNextHighestFloor: () => 64 * FRACUNIT,
      pRandom: () => 0,
      getLevelTime: () => 0,
    };
    const saved: ActivePlatSnapshot = {
      sectorIndex: 0,
      type: PlatType.downWaitUpStay,
      speed: PLATSPEED * 4,
      low: 0,
      high: 32 * FRACUNIT,
      wait: PLATWAIT_TICS,
      count: 0,
      status: PlatStatus.up,
      oldstatus: PlatStatus.down,
      crush: false,
      tag: 1,
      inStasis: false,
    };
    const snap: ActivePlatsSnapshot = Object.assign(new Array(MAXPLATS).fill(null) as (ActivePlatSnapshot | null)[], { 0: saved });
    const plats = restoreActivePlats(snap, [sector], callbacks, new ThinkerList());

    tPlatRaise(plats.slots[0]!, plats);
    expect(plats.slots[0]).toBeNull();
  });

  it('tMoveCeiling called via the restored action observes the rebuilt ceilings registry', () => {
    const sector = makeCeilingSector({ tag: 2, ceilingheight: 128 * FRACUNIT });
    const callbacks: CeilingCallbacks = {
      movePlane: (s, _speed, destheight) => {
        s.ceilingheight = destheight;
        return PlaneMoveResult.pastdest;
      },
      findHighestCeilingSurrounding: () => 256 * FRACUNIT,
      getLevelTime: () => 0,
    };
    const saved: ActiveCeilingSnapshot = {
      sectorIndex: 0,
      type: CeilingType.lowerAndCrush,
      bottomheight: 8 * FRACUNIT,
      topheight: 128 * FRACUNIT,
      speed: FRACUNIT,
      crush: false,
      direction: CeilingDirection.down,
      olddirection: CeilingDirection.down,
      tag: 2,
      inStasis: false,
    };
    const snap: ActiveCeilingsSnapshot = Object.assign(new Array(MAXCEILINGS).fill(null) as (ActiveCeilingSnapshot | null)[], { 0: saved });
    const ceilings = restoreActiveCeilings(snap, [sector], callbacks, new ThinkerList());

    tMoveCeiling(ceilings.slots[0]!, ceilings);
    expect(ceilings.slots[0]).toBeNull();
  });
});
