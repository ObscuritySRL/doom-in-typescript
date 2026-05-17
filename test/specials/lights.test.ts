/**
 * Parity tests for the sector light specials (`src/specials/lights.ts`
 * = Chocolate Doom 2.2.1 `p_lights.c` thinkers/spawners +
 * `p_spec.c` `P_SpawnSpecials` light branch).
 *
 * Rigor bar matches the rest of the specials/render suite: every
 * thinker recurrence is checked against a STRUCTURALLY DISTINCT
 * in-test re-transcription (different control flow, no shared helper
 * with the module), the spawners are checked for exact field seeding
 * AND exact `P_Random` draw counts (the parity-critical LCG-stream
 * discipline), `P_FindMinSurroundingLight`/`getNextSector` against a
 * hand-built adjacency graph, and a long differential battery drives
 * the real {@link DoomRandom} gameplay stream through both the module
 * and the independent oracle, asserting bit-identical `lightlevel`
 * trajectories and an identical final stream position.
 */

import { describe, expect, test } from 'bun:test';

import { DoomRandom } from '../../src/core/rng.ts';
import { ML_TWOSIDED } from '../../src/map/lineSectorGeometry.ts';
import type { FireFlicker, Glow, LightFlash, LightLine, LightSector, LightThinker, Strobe } from '../../src/specials/lights.ts';
import {
  FASTDARK,
  GLOWSPEED,
  SLOWDARK,
  STROBEBRIGHT,
  getNextSector,
  pFindMinSurroundingLight,
  pSpawnFireFlicker,
  pSpawnGlowingLight,
  pSpawnLightFlash,
  pSpawnSpecialsLights,
  pSpawnStrobeFlash,
  tFireFlicker,
  tGlow,
  tLightFlash,
  tStrobeFlash,
  tickLight,
} from '../../src/specials/lights.ts';

function sector(lightlevel: number, special: number, lines: readonly LightLine[] = []): LightSector {
  return { lightlevel, special, lines };
}

/** A two-sided / one-sided line bridging `front` and `back`. */
function line(front: LightSector, back: LightSector | null, twoSided: boolean): LightLine {
  return { flags: twoSided ? ML_TWOSIDED : 0, frontsector: front, backsector: back };
}

/** Counts draws so the parity-critical stream discipline is testable. */
function countingRandom(values: readonly number[]): { rng: () => number; draws: () => number } {
  let i = 0;
  return {
    rng: () => {
      const v = values[i % values.length]!;
      i += 1;
      return v;
    },
    draws: () => i,
  };
}

describe('lights: getNextSector / P_FindMinSurroundingLight (p_spec.c)', () => {
  test('getNextSector returns the far side only across an ML_TWOSIDED line', () => {
    const a = sector(100, 0);
    const b = sector(40, 0);
    const twoSided = line(a, b, true);
    const oneSided = line(a, b, false);

    expect(getNextSector(twoSided, a)).toBe(b);
    expect(getNextSector(twoSided, b)).toBe(a);
    expect(getNextSector(oneSided, a)).toBeNull();
    // frontsector !== sec and two-sided → frontsector returned.
    expect(getNextSector(line(b, sector(10, 0), true), a)).toBe(b);
  });

  test('P_FindMinSurroundingLight takes the min neighbor, seeded at max, skipping one-sided', () => {
    const center = sector(160, 0);
    const bright = sector(200, 0);
    const dim = sector(72, 0);
    const dimmest = sector(48, 0);
    const hiddenOneSided = sector(0, 0); // not ML_TWOSIDED → ignored
    (center.lines as LightLine[]).push(line(center, bright, true), line(center, dim, true), line(center, dimmest, true), line(center, hiddenOneSided, false));

    expect(pFindMinSurroundingLight(center, center.lightlevel)).toBe(48);
    // When every neighbor is brighter than the seed, the seed wins.
    const allBright = sector(30, 0);
    (allBright.lines as LightLine[]).push(line(allBright, bright, true));
    expect(pFindMinSurroundingLight(allBright, allBright.lightlevel)).toBe(30);
    // No two-sided neighbors → seed unchanged.
    expect(pFindMinSurroundingLight(sector(123, 0, [line(sector(0, 0), null, false)]), 123)).toBe(123);
  });
});

describe('lights: T_LightFlash (p_lights.c) — independent re-derivation', () => {
  test('counts down without RNG, then toggles + reloads from (P_Random & {min,max}time)+1', () => {
    const sec = sector(192, 0);
    const flash: LightFlash = { sector: sec, count: 3, maxlight: 192, minlight: 64, maxtime: 64, mintime: 7 };
    const seq = [0xff, 0x00, 0x55, 0x1a, 0x4c];
    const { rng, draws } = countingRandom(seq);

    // Independent oracle: separate closure, plain locals, its own seq cursor.
    let oLevel = 192;
    let oCount = 3;
    let oDraws = 0;
    const oMax = 192;
    const oMin = 64;
    const oracleStep = () => {
      oCount -= 1;
      if (oCount !== 0) return;
      const drawn = seq[oDraws % seq.length]!;
      oDraws += 1;
      if (oLevel === oMax) {
        oLevel = oMin;
        oCount = (drawn & 7) + 1;
      } else {
        oLevel = oMax;
        oCount = (drawn & 64) + 1;
      }
    };

    for (let tic = 0; tic < 400; tic += 1) {
      tLightFlash(flash, rng);
      oracleStep();
      expect(flash.sector.lightlevel).toBe(oLevel);
      expect(flash.count).toBe(oCount);
      expect(draws()).toBe(oDraws);
    }
    expect(oDraws).toBeGreaterThan(5); // it actually toggled many times
  });
});

describe('lights: T_StrobeFlash (p_lights.c) — independent re-derivation', () => {
  test('square wave: brighttime on the bright edge, darktime on the dark edge, never draws RNG', () => {
    const sec = sector(40, 0);
    const flash: Strobe = { sector: sec, count: 1, minlight: 40, maxlight: 200, darktime: SLOWDARK, brighttime: STROBEBRIGHT };
    const { rng, draws } = countingRandom([1, 2, 3]);

    let oLevel = 40;
    let oCount = 1;
    const oMin = 40;
    const oMax = 200;
    const oracleStep = () => {
      oCount -= 1;
      if (oCount !== 0) return;
      if (oLevel === oMin) {
        oLevel = oMax;
        oCount = STROBEBRIGHT;
      } else {
        oLevel = oMin;
        oCount = SLOWDARK;
      }
    };

    for (let tic = 0; tic < 600; tic += 1) {
      tStrobeFlash(flash);
      oracleStep();
      expect(flash.sector.lightlevel).toBe(oLevel);
      expect(flash.count).toBe(oCount);
    }
    expect(draws()).toBe(0); // strobe never consumes the gameplay stream
    void rng;
  });
});

describe('lights: T_Glow (p_lights.c) — independent re-derivation', () => {
  test('triangle wave by GLOWSPEED with overshoot-correction; stays in [minlight,maxlight]; no RNG', () => {
    const sec = sector(160, 0);
    const g: Glow = { sector: sec, minlight: 96, maxlight: 168, direction: -1 };

    let oLevel = 160;
    let oDir = -1;
    const oMin = 96;
    const oMax = 168;
    const oracleStep = () => {
      if (oDir === -1) {
        oLevel -= GLOWSPEED;
        if (oLevel <= oMin) {
          oLevel += GLOWSPEED;
          oDir = 1;
        }
      } else if (oDir === 1) {
        oLevel += GLOWSPEED;
        if (oLevel >= oMax) {
          oLevel -= GLOWSPEED;
          oDir = -1;
        }
      }
    };

    for (let tic = 0; tic < 500; tic += 1) {
      tGlow(g);
      oracleStep();
      expect(g.sector.lightlevel).toBe(oLevel);
      expect(g.direction).toBe(oDir);
      expect(g.sector.lightlevel).toBeGreaterThan(oMin - GLOWSPEED);
      expect(g.sector.lightlevel).toBeLessThan(oMax + GLOWSPEED);
    }
  });
});

describe('lights: T_FireFlicker (p_lights.c) — independent re-derivation', () => {
  test('amount=(P_Random&3)*16 clamp logic; count always reloads to 4; one draw per expiry', () => {
    const sec = sector(208, 0);
    const flick: FireFlicker = { sector: sec, count: 4, maxlight: 208, minlight: 80 };
    const seq = [0, 1, 2, 3, 0xaa, 0x07];
    const { rng, draws } = countingRandom(seq);

    let oLevel = 208;
    let oCount = 4;
    let oDraws = 0;
    const oMax = 208;
    const oMin = 80;
    const oracleStep = () => {
      oCount -= 1;
      if (oCount !== 0) return;
      const amount = (seq[oDraws % seq.length]! & 3) * 16;
      oDraws += 1;
      oLevel = oLevel - amount < oMin ? oMin : oMax - amount;
      oCount = 4;
    };

    for (let tic = 0; tic < 400; tic += 1) {
      tFireFlicker(flick, rng);
      oracleStep();
      expect(flick.sector.lightlevel).toBe(oLevel);
      expect(flick.count).toBe(oCount);
      expect(draws()).toBe(oDraws);
    }
    expect(oDraws).toBe(100); // expiry every 4 tics over 400 tics
  });
});

describe('lights: spawners — field seeding + exact P_Random draw discipline', () => {
  test('P_SpawnLightFlash: clears special, seeds maxtime/mintime, draws exactly 1', () => {
    const neighbor = sector(48, 0);
    const sec = sector(176, 1, []);
    (sec.lines as LightLine[]).push(line(sec, neighbor, true));
    const { rng, draws } = countingRandom([0x20]);

    const flash = pSpawnLightFlash(sec, rng);
    expect(sec.special).toBe(0);
    expect(flash.maxlight).toBe(176);
    expect(flash.minlight).toBe(48);
    expect(flash.maxtime).toBe(64);
    expect(flash.mintime).toBe(7);
    expect(flash.count).toBe((0x20 & 64) + 1);
    expect(draws()).toBe(1);
  });

  test('P_SpawnStrobeFlash: minlight collapses to 0 when equal to maxlight; sync draws 0, async draws 1', () => {
    const isolated = sector(120, 2, []); // no neighbors → min == max → minlight 0
    const { rng: r1, draws: d1 } = countingRandom([0x05]);
    const async = pSpawnStrobeFlash(isolated, FASTDARK, 0, r1);
    expect(async.darktime).toBe(FASTDARK);
    expect(async.brighttime).toBe(STROBEBRIGHT);
    expect(async.maxlight).toBe(120);
    expect(async.minlight).toBe(0);
    expect(isolated.special).toBe(0);
    expect(async.count).toBe((0x05 & 7) + 1);
    expect(d1()).toBe(1);

    const dim = sector(20, 12, []);
    const bright = sector(200, 12, []);
    (bright.lines as LightLine[]).push(line(bright, dim, true));
    const { rng: r2, draws: d2 } = countingRandom([0x77]);
    const synced = pSpawnStrobeFlash(bright, SLOWDARK, 1, r2);
    expect(synced.minlight).toBe(20);
    expect(synced.maxlight).toBe(200);
    expect(synced.count).toBe(1); // in-sync → exactly 1, no draw
    expect(d2()).toBe(0);
  });

  test('P_SpawnGlowingLight: direction -1, no draw; P_SpawnFireFlicker: minlight+16, count 4, no draw', () => {
    const neighbor = sector(60, 0);
    const gSec = sector(150, 8, [line(sector(150, 0), null, false)]);
    (gSec.lines as LightLine[]).push(line(gSec, neighbor, true));
    const glow = pSpawnGlowingLight(gSec);
    expect(glow.direction).toBe(-1);
    expect(glow.minlight).toBe(60);
    expect(glow.maxlight).toBe(150);
    expect(gSec.special).toBe(0);

    const fSec = sector(200, 17, []);
    (fSec.lines as LightLine[]).push(line(fSec, neighbor, true));
    const flick = pSpawnFireFlicker(fSec);
    expect(flick.maxlight).toBe(200);
    expect(flick.minlight).toBe(60 + 16);
    expect(flick.count).toBe(4);
    expect(fSec.special).toBe(0);
  });
});

describe('lights: P_SpawnSpecials light branch (p_spec.c)', () => {
  test('maps each light special to the right thinker in array order; clears/keeps special; v1.4 gates 17', () => {
    const neighbor = sector(20, 0);
    const mk = (special: number) => {
      const s = sector(180, special, []);
      (s.lines as LightLine[]).push(line(s, neighbor, true));
      return s;
    };
    const sectors = [mk(1), mk(2), mk(3), mk(4), mk(8), sector(180, 9, []), mk(12), mk(13), mk(17), sector(180, 0, [])];

    let drawCount = 0;
    const rng = () => {
      drawCount += 1;
      return 0x11;
    };

    const thinkers = pSpawnSpecialsLights(sectors, rng, true);
    expect(thinkers.map((t) => t.kind)).toEqual(['lightflash', 'strobe', 'strobe', 'strobe', 'glow', 'strobe', 'strobe', 'fireflicker']);

    // special post-state: cleared except case 4 (re-asserted), the
    // non-light case 9 (untouched by this module), and the 0 sector.
    expect(sectors[0]!.special).toBe(0); // 1
    expect(sectors[3]!.special).toBe(4); // 4 re-asserted
    expect(sectors[4]!.special).toBe(0); // 8
    expect(sectors[5]!.special).toBe(9); // 9 non-light, untouched here
    expect(sectors[8]!.special).toBe(0); // 17

    // Draw discipline: LightFlash(1) + StrobeFast(1) + StrobeSlow(1) +
    // StrobeFast/4(1) + Glow(0) + SyncStrobeSlow(0) + SyncStrobeFast(0)
    // + FireFlicker(0) = exactly 4 draws, in array order.
    expect(drawCount).toBe(4);

    // gameversion <= exe_doom_1_2 → special 17 spawns nothing.
    const older = [mk(17)];
    expect(pSpawnSpecialsLights(older, () => 0, false)).toEqual([]);
    expect(older[0]!.special).toBe(17); // untouched (no spawner ran)
  });
});

describe('lights: differential battery — real DoomRandom, independent oracle, stream-position parity', () => {
  test('module vs structurally-distinct oracle: identical lightlevel trajectories + identical final RNG index over a long run', () => {
    // Deterministic mixed level: one sector per light id, two clean
    // two-sided neighbors (one dim, one bright), scanned in order.
    const buildLevel = (): LightSector[] => {
      const dim = sector(24, 0);
      const bright = sector(232, 0);
      const ids = [1, 2, 3, 4, 8, 12, 13, 17];
      return ids.map((id, k) => {
        const s = sector(96 + k * 8, id, []);
        (s.lines as LightLine[]).push(line(s, dim, true), line(s, bright, true));
        return s;
      });
    };

    // Independent surrounding-min (different control flow than module).
    const findMin = (s: LightSector, max: number): number => {
      let m = max;
      for (const ln of s.lines) {
        if ((ln.flags & ML_TWOSIDED) === 0) continue;
        const other = ln.frontsector === s ? ln.backsector : ln.frontsector;
        if (other !== null && other.lightlevel < m) m = other.lightlevel;
      }
      return m;
    };

    // ── Module side ──
    const moduleSectors = buildLevel();
    const moduleRng = new DoomRandom();
    const thinkers: LightThinker[] = pSpawnSpecialsLights(moduleSectors, () => moduleRng.pRandom(), true);

    // ── Oracle side: parallel level + hand-written recurrences ──
    type LfO = { kind: 'lf'; sec: LightSector; maxlight: number; minlight: number; maxtime: number; mintime: number; count: number };
    type StO = { kind: 'st'; sec: LightSector; minlight: number; maxlight: number; darktime: number; brighttime: number; count: number };
    type GlO = { kind: 'gl'; sec: LightSector; minlight: number; maxlight: number; direction: number };
    type FfO = { kind: 'ff'; sec: LightSector; maxlight: number; minlight: number; count: number };
    type OracleThinker = LfO | StO | GlO | FfO;

    const oracleSectors = buildLevel();
    const oracleRng = new DoomRandom();
    const oThinkers: OracleThinker[] = [];
    for (const s of oracleSectors) {
      if (!s.special) continue;
      const maxl = s.lightlevel;
      if (s.special === 1) {
        const minl = findMin(s, maxl);
        s.special = 0;
        oThinkers.push({ kind: 'lf', sec: s, maxlight: maxl, minlight: minl, maxtime: 64, mintime: 7, count: (oracleRng.pRandom() & 64) + 1 });
      } else if (s.special === 2 || s.special === 3 || s.special === 4 || s.special === 12 || s.special === 13) {
        const fast = s.special === 2 || s.special === 4 || s.special === 13;
        const sync = s.special === 12 || s.special === 13;
        const reassert = s.special === 4;
        let minl = findMin(s, maxl);
        if (minl === maxl) minl = 0;
        s.special = reassert ? 4 : 0;
        const count = sync ? 1 : (oracleRng.pRandom() & 7) + 1;
        oThinkers.push({ kind: 'st', sec: s, minlight: minl, maxlight: maxl, darktime: fast ? FASTDARK : SLOWDARK, brighttime: STROBEBRIGHT, count });
      } else if (s.special === 8) {
        const minl = findMin(s, maxl);
        s.special = 0;
        oThinkers.push({ kind: 'gl', sec: s, minlight: minl, maxlight: maxl, direction: -1 });
      } else if (s.special === 17) {
        const minl = findMin(s, maxl) + 16;
        s.special = 0;
        oThinkers.push({ kind: 'ff', sec: s, maxlight: maxl, minlight: minl, count: 4 });
      }
    }

    const stepOracle = (t: OracleThinker): void => {
      if (t.kind === 'lf') {
        t.count -= 1;
        if (t.count !== 0) return;
        if (t.sec.lightlevel === t.maxlight) {
          t.sec.lightlevel = t.minlight;
          t.count = (oracleRng.pRandom() & t.mintime) + 1;
        } else {
          t.sec.lightlevel = t.maxlight;
          t.count = (oracleRng.pRandom() & t.maxtime) + 1;
        }
      } else if (t.kind === 'st') {
        t.count -= 1;
        if (t.count !== 0) return;
        if (t.sec.lightlevel === t.minlight) {
          t.sec.lightlevel = t.maxlight;
          t.count = t.brighttime;
        } else {
          t.sec.lightlevel = t.minlight;
          t.count = t.darktime;
        }
      } else if (t.kind === 'gl') {
        if (t.direction === -1) {
          t.sec.lightlevel -= GLOWSPEED;
          if (t.sec.lightlevel <= t.minlight) {
            t.sec.lightlevel += GLOWSPEED;
            t.direction = 1;
          }
        } else if (t.direction === 1) {
          t.sec.lightlevel += GLOWSPEED;
          if (t.sec.lightlevel >= t.maxlight) {
            t.sec.lightlevel -= GLOWSPEED;
            t.direction = -1;
          }
        }
      } else {
        t.count -= 1;
        if (t.count !== 0) return;
        const amount = (oracleRng.pRandom() & 3) * 16;
        t.sec.lightlevel = t.sec.lightlevel - amount < t.minlight ? t.minlight : t.maxlight - amount;
        t.count = 4;
      }
    };

    expect(oThinkers.length).toBe(thinkers.length);
    // Spawn drew the same amount on both sides.
    expect(moduleRng.prndindex).toBe(oracleRng.prndindex);
    // Spawn seeded identical sector lightlevels + special post-state.
    for (let k = 0; k < thinkers.length; k += 1) {
      expect(thinkers[k]!.state.sector.lightlevel).toBe(oThinkers[k]!.sec.lightlevel);
    }
    expect(moduleSectors.map((s) => s.special)).toEqual(oracleSectors.map((s) => s.special));

    for (let tic = 0; tic < 4000; tic += 1) {
      for (const t of thinkers) tickLight(t, () => moduleRng.pRandom());
      for (const t of oThinkers) stepOracle(t);

      for (let k = 0; k < thinkers.length; k += 1) {
        expect(thinkers[k]!.state.sector.lightlevel).toBe(oThinkers[k]!.sec.lightlevel);
      }
      // The shared LCG stream stays positioned identically — the
      // single most parity-critical invariant for downstream RNG.
      expect(moduleRng.prndindex).toBe(oracleRng.prndindex);
    }

    // The battery actually exercised the RNG-consuming thinkers.
    expect(moduleRng.prndindex).toBeGreaterThan(0);
  });
});
