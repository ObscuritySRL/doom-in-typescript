import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapLinedef, MapSector, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { ML_SOUNDBLOCK, ML_TWOSIDED, ST_HORIZONTAL } from '../../src/map/lineSectorGeometry.ts';
import type { LineSectors, MapData, SectorGroup } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';
import { Mobj, MobjType } from '../../src/world/mobj.ts';
import { createSoundState, noiseAlert } from '../../src/ai/soundPropagation.ts';

// ── Helpers ──────────────────────────────────────────────────────────

const F = FRACUNIT;

/** Minimum-viable empty blockmap stub for MapData construction. */
function createEmptyBlockmap(): Blockmap {
  const lumpData = Buffer.alloc(2);
  lumpData.writeInt16LE(-1, 0);
  return {
    originX: 0,
    originY: 0,
    columns: 1,
    rows: 1,
    offsets: Object.freeze([0]),
    lumpData,
  };
}

/** Describe a sector's floor/ceiling heights (height defaults to 128 map units). */
interface SectorSpec {
  floor?: number;
  ceiling?: number;
}

/** Describe a two-sided or one-sided linedef between two sectors. */
interface LineSpec {
  /** Front sector index. */
  front: number;
  /** Back sector index, or -1 for a one-sided wall. */
  back: number;
  /** Extra ML_* flags beyond ML_TWOSIDED (ML_TWOSIDED is set automatically when back !== -1). */
  flags?: number;
}

function buildSector(spec: SectorSpec): MapSector {
  return Object.freeze({
    floorheight: ((spec.floor ?? 0) * F) | 0,
    ceilingheight: ((spec.ceiling ?? 128) * F) | 0,
    floorpic: 'FLAT',
    ceilingpic: 'FLAT',
    lightlevel: 160,
    special: 0,
    tag: 0,
  });
}

function buildLine(spec: LineSpec): MapLinedef {
  const flags = (spec.flags ?? 0) | (spec.back !== -1 ? ML_TWOSIDED : 0);
  return Object.freeze({
    v1: 0,
    v2: 1,
    dx: F,
    dy: 0,
    flags,
    special: 0,
    tag: 0,
    sidenum0: 0,
    sidenum1: spec.back === -1 ? -1 : 1,
    slopetype: ST_HORIZONTAL,
    bbox: Object.freeze([0, 0, 0, F] as const),
  });
}

function buildLineSectors(spec: LineSpec): LineSectors {
  return Object.freeze({
    frontsector: spec.front,
    backsector: spec.back,
  });
}

function buildSectorGroups(sectorCount: number, lines: readonly LineSpec[]): readonly SectorGroup[] {
  const groups: SectorGroup[] = new Array(sectorCount);
  for (let s = 0; s < sectorCount; s++) {
    const lineIndices: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.front === s || line.back === s) {
        lineIndices.push(i);
      }
    }
    groups[s] = Object.freeze({
      lineIndices: Object.freeze(lineIndices),
      bbox: Object.freeze([0, 0, 0, 0] as const),
      soundOriginX: 0 as Fixed,
      soundOriginY: 0 as Fixed,
      blockbox: Object.freeze([0, 0, 0, 0] as const),
    });
  }
  return Object.freeze(groups);
}

/** Build a minimal MapData from sector and line specs, skipping unused fields. */
function buildMap(sectorSpecs: readonly SectorSpec[], lineSpecs: readonly LineSpec[]): MapData {
  const sectors = Object.freeze(sectorSpecs.map(buildSector));
  const linedefs = Object.freeze(lineSpecs.map(buildLine));
  const lineSectors = Object.freeze(lineSpecs.map(buildLineSectors));
  const sectorGroups = buildSectorGroups(sectors.length, lineSpecs);

  const rejectMap: RejectMap = {
    sectorCount: sectors.length,
    totalBits: sectors.length * sectors.length,
    expectedSize: Math.ceil((sectors.length * sectors.length) / 8),
    data: Buffer.alloc(Math.ceil((sectors.length * sectors.length) / 8)),
  };

  return {
    name: 'TEST',
    vertexes: Object.freeze([] as readonly MapVertex[]),
    sectors,
    sidedefs: Object.freeze([]),
    linedefs,
    segs: Object.freeze([]),
    subsectors: Object.freeze([]),
    nodes: Object.freeze([]),
    things: Object.freeze([]),
    blockmap: createEmptyBlockmap(),
    reject: rejectMap,
    subsectorSectors: Object.freeze([]),
    lineSectors,
    sectorGroups,
    validCount: createValidCount(linedefs.length),
  } as MapData;
}

function makeTarget(): Mobj {
  const mobj = new Mobj();
  mobj.type = MobjType.PLAYER;
  return mobj;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('createSoundState', () => {
  it('initializes validcount to zero', () => {
    const state = createSoundState(5);
    expect(state.validcount).toBe(0);
  });

  it('allocates per-sector stamp, traversed, and target arrays', () => {
    const state = createSoundState(5);
    expect(state.sectorValidcount.length).toBe(5);
    expect(state.sectorSoundTraversed.length).toBe(5);
    expect(state.sectorSoundTarget.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(state.sectorValidcount[i]).toBe(0);
      expect(state.sectorSoundTraversed[i]).toBe(0);
      expect(state.sectorSoundTarget[i]).toBeNull();
    }
  });
});

describe('noiseAlert', () => {
  it('advances validcount by 1 per call', () => {
    const map = buildMap([{}], []);
    const state = createSoundState(1);
    const target = makeTarget();

    noiseAlert(target, 0, map, state);
    expect(state.validcount).toBe(1);

    noiseAlert(target, 0, map, state);
    expect(state.validcount).toBe(2);
  });

  it('stamps only the emitter sector when no two-sided lines connect it', () => {
    const map = buildMap([{}, {}], []);
    const state = createSoundState(2);
    const target = makeTarget();

    noiseAlert(target, 0, map, state);

    expect(state.sectorValidcount[0]).toBe(1);
    expect(state.sectorSoundTraversed[0]).toBe(1);
    expect(state.sectorSoundTarget[0]).toBe(target);

    expect(state.sectorValidcount[1]).toBe(0);
    expect(state.sectorSoundTarget[1]).toBeNull();
  });

  it('floods through open two-sided lines in a linear chain', () => {
    const map = buildMap(
      [{}, {}, {}, {}],
      [
        { front: 0, back: 1 },
        { front: 1, back: 2 },
        { front: 2, back: 3 },
      ],
    );
    const state = createSoundState(4);
    const target = makeTarget();

    noiseAlert(target, 0, map, state);

    for (let s = 0; s < 4; s++) {
      expect(state.sectorValidcount[s]).toBe(1);
      expect(state.sectorSoundTraversed[s]).toBe(1);
      expect(state.sectorSoundTarget[s]).toBe(target);
    }
  });

  it('stops at a closed door (openrange <= 0)', () => {
    // Sector 2 has floor === ceiling, so the opening on line 1 collapses.
    const map = buildMap(
      [{}, {}, { floor: 0, ceiling: 0 }, {}],
      [
        { front: 0, back: 1 },
        { front: 1, back: 2 },
        { front: 2, back: 3 },
      ],
    );
    const state = createSoundState(4);
    const target = makeTarget();

    noiseAlert(target, 0, map, state);

    expect(state.sectorSoundTarget[0]).toBe(target);
    expect(state.sectorSoundTarget[1]).toBe(target);
    expect(state.sectorSoundTarget[2]).toBeNull();
    expect(state.sectorSoundTarget[3]).toBeNull();
  });

  it('skips one-sided linedefs (no ML_TWOSIDED bit)', () => {
    const map = buildMap(
      [{}, {}],
      [
        { front: 0, back: -1 },
        { front: 1, back: -1 },
      ],
    );
    const state = createSoundState(2);
    const target = makeTarget();

    noiseAlert(target, 0, map, state);

    expect(state.sectorSoundTarget[0]).toBe(target);
    expect(state.sectorSoundTarget[1]).toBeNull();
  });

  it('records the other-side sector when emitting from the back side of a line', () => {
    // Line 0 has front = 1, back = 0.  Emitting from sector 1 must still
    // reach sector 0 via the "other side" branch.
    const map = buildMap([{}, {}], [{ front: 1, back: 0 }]);
    const state = createSoundState(2);
    const target = makeTarget();

    noiseAlert(target, 1, map, state);

    expect(state.sectorSoundTarget[0]).toBe(target);
    expect(state.sectorSoundTarget[1]).toBe(target);
    expect(state.sectorSoundTraversed[0]).toBe(1);
    expect(state.sectorSoundTraversed[1]).toBe(1);
  });

  it('raises soundblocks to 1 on the first ML_SOUNDBLOCK crossing', () => {
    const map = buildMap(
      [{}, {}, {}],
      [
        { front: 0, back: 1, flags: ML_SOUNDBLOCK },
        { front: 1, back: 2 },
      ],
    );
    const state = createSoundState(3);
    const target = makeTarget();

    noiseAlert(target, 0, map, state);

    expect(state.sectorSoundTraversed[0]).toBe(1);
    // Crossing the SOUNDBLOCK with soundblocks=0 recurses with 1 → stored as 2.
    expect(state.sectorSoundTraversed[1]).toBe(2);
    // Propagation continues (non-soundblock) with soundblocks=1 unchanged → 2.
    expect(state.sectorSoundTraversed[2]).toBe(2);
  });

  it('stops entirely on the second ML_SOUNDBLOCK crossing', () => {
    // Chain: 0 —soundblock→ 1 —soundblock→ 2 —open→ 3
    const map = buildMap(
      [{}, {}, {}, {}],
      [
        { front: 0, back: 1, flags: ML_SOUNDBLOCK },
        { front: 1, back: 2, flags: ML_SOUNDBLOCK },
        { front: 2, back: 3 },
      ],
    );
    const state = createSoundState(4);
    const target = makeTarget();

    noiseAlert(target, 0, map, state);

    expect(state.sectorSoundTraversed[0]).toBe(1);
    expect(state.sectorSoundTraversed[1]).toBe(2);
    // Second SOUNDBLOCK with soundblocks=1 blocks the recursion entirely.
    expect(state.sectorSoundTarget[2]).toBeNull();
    expect(state.sectorSoundTarget[3]).toBeNull();
  });

  it('does not re-visit an already-flooded sector within the same generation', () => {
    // Triangle: 0↔1, 1↔2, 2↔0.  A naive flood would re-visit sector 0
    // via sector 2; the validcount guard must prevent that.
    const map = buildMap(
      [{}, {}, {}],
      [
        { front: 0, back: 1 },
        { front: 1, back: 2 },
        { front: 2, back: 0 },
      ],
    );
    const state = createSoundState(3);
    const target = makeTarget();

    noiseAlert(target, 0, map, state);

    for (let s = 0; s < 3; s++) {
      expect(state.sectorValidcount[s]).toBe(1);
      expect(state.sectorSoundTraversed[s]).toBe(1);
    }
  });

  it('lets a second visit overwrite a worse soundblocks stamp with a better one', () => {
    // Sector 2 is reachable by two paths:
    //   (A) 0 —soundblock→ 2         (arrives with soundblocks=1, stored 2)
    //   (B) 0 —open→ 1 —open→ 2       (arrives with soundblocks=0, stored 1)
    // With lineIndices iterated in insertion order, path (A) wins first.
    // Path (B) must then overwrite the stamp because soundtraversed > soundblocks+1.
    const map = buildMap(
      [{}, {}, {}],
      [
        { front: 0, back: 2, flags: ML_SOUNDBLOCK },
        { front: 0, back: 1 },
        { front: 1, back: 2 },
      ],
    );
    const state = createSoundState(3);
    const target = makeTarget();

    noiseAlert(target, 0, map, state);

    expect(state.sectorSoundTraversed[0]).toBe(1);
    expect(state.sectorSoundTraversed[1]).toBe(1);
    // Better (lower) soundblocks wins.
    expect(state.sectorSoundTraversed[2]).toBe(1);
  });

  it('wraps validcount at int32 max so stamps stay comparable after overflow (C parity)', () => {
    // Vanilla C `validcount++` on a signed int wraps from INT_MAX to INT_MIN
    // and per-sector `sec->validcount` wraps with it.  The TS port stores
    // per-sector stamps in an Int32Array which truncates on assignment, so
    // `state.validcount` must also be kept in int32 range, otherwise the
    // `===` test never matches again after one wrap and the flood re-enters
    // every sector forever.
    const map = buildMap([{}, {}], [{ front: 0, back: 1 }]);
    const state = createSoundState(2);
    const target = makeTarget();

    state.validcount = 0x7fff_ffff;
    noiseAlert(target, 0, map, state);
    expect(state.validcount).toBe(-0x8000_0000);
    expect(state.sectorValidcount[0]).toBe(-0x8000_0000);
    expect(state.sectorValidcount[1]).toBe(-0x8000_0000);
    expect(state.sectorSoundTarget[0]).toBe(target);
    expect(state.sectorSoundTarget[1]).toBe(target);
  });

  it('invalidates previous-generation stamps on the next noiseAlert', () => {
    // First alert floods sectors 0 and 1.  A second alert from a different
    // origin with validcount+1 must naturally supersede the old stamp
    // without any explicit reset.
    const map = buildMap(
      [{}, {}, {}],
      [
        { front: 0, back: 1 },
        { front: 1, back: 2 },
      ],
    );
    const state = createSoundState(3);
    const firstTarget = makeTarget();
    const secondTarget = makeTarget();

    noiseAlert(firstTarget, 0, map, state);
    expect(state.validcount).toBe(1);
    for (let s = 0; s < 3; s++) {
      expect(state.sectorSoundTarget[s]).toBe(firstTarget);
    }

    noiseAlert(secondTarget, 2, map, state);
    expect(state.validcount).toBe(2);
    for (let s = 0; s < 3; s++) {
      expect(state.sectorValidcount[s]).toBe(2);
      expect(state.sectorSoundTarget[s]).toBe(secondTarget);
    }
  });
});
