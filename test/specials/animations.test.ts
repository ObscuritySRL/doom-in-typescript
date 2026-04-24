import { describe, expect, it } from 'bun:test';

import { ANIMDEFS, initPicAnims, MAXANIMS, updateAnimTranslation, type AnimResolver } from '../../src/specials/animations.ts';

// ── Resolver builders ───────────────────────────────────────────────

/**
 * Build an {@link AnimResolver} from two parallel name→index maps.
 *
 * Simulates the renderer contract: textures and flats share a name
 * space that is resolved against the current WAD.  Missing names
 * return -1 for the `check*` callbacks and throw for the plain
 * callbacks, exactly matching `R_CheckTextureNumForName`,
 * `R_TextureNumForName`, `W_CheckNumForName`, and `R_FlatNumForName`.
 */
function buildResolver(textures: Record<string, number>, flats: Record<string, number>): AnimResolver {
  return {
    checkTextureNumForName(name) {
      return Object.prototype.hasOwnProperty.call(textures, name) ? textures[name]! : -1;
    },
    textureNumForName(name) {
      if (!Object.prototype.hasOwnProperty.call(textures, name)) {
        throw new Error(`R_TextureNumForName: ${name} not found`);
      }
      return textures[name]!;
    },
    checkFlatLumpForName(name) {
      return Object.prototype.hasOwnProperty.call(flats, name) ? flats[name]! : -1;
    },
    flatNumForName(name) {
      if (!Object.prototype.hasOwnProperty.call(flats, name)) {
        throw new Error(`R_FlatNumForName: ${name} not found`);
      }
      return flats[name]!;
    },
  };
}

/**
 * A minimal shareware-style resolver: the flats that actually ship in
 * DOOM1.WAD plus the E1 textures that contain animated fire frames.
 * Indices are arbitrary but unique within their table.
 */
const SHAREWARE_FLATS: Record<string, number> = {
  NUKAGE1: 10,
  NUKAGE2: 11,
  NUKAGE3: 12,
  FWATER1: 20,
  FWATER2: 21,
  FWATER3: 22,
  FWATER4: 23,
  LAVA1: 30,
  LAVA2: 31,
  LAVA3: 32,
  LAVA4: 33,
  BLOOD1: 40,
  BLOOD2: 41,
  BLOOD3: 42,
};

const SHAREWARE_TEXTURES: Record<string, number> = {
  FIREWALA: 100,
  FIREWALB: 101,
  FIREWALL: 102,
  FIREMAG1: 110,
  FIREMAG2: 111,
  FIREMAG3: 112,
  FIREBLU1: 120,
  FIREBLU2: 121,
  ROCKRED1: 130,
  ROCKRED2: 131,
  ROCKRED3: 132,
  FIRELAV3: 140,
  FIRELAV4: 141,
  FIRELAVA: 142,
};

/**
 * A complete-ish "commercial" resolver that has every ANIMDEFS entry
 * present, so `initPicAnims` should return a record for each of the
 * 22 animdefs.  Indices are contiguous within their cycle so parity
 * checks on `numpics` and `picnum` are easy to reason about.
 */
function buildCommercialResolver(): AnimResolver {
  const textures: Record<string, number> = {};
  const flats: Record<string, number> = {};
  let tIdx = 0;
  let fIdx = 0;
  for (const def of ANIMDEFS) {
    const target = def.istexture ? textures : flats;
    const nameSet = enumerateCycleNames(def.startname, def.endname);
    for (const n of nameSet) {
      if (def.istexture) target[n] = tIdx++;
      else target[n] = fIdx++;
    }
  }
  return buildResolver(textures, flats);
}

/**
 * Given the start/end pair, synthesize a plausible intermediate-name
 * sequence for the vanilla cycles.  For the purposes of these tests
 * we just need to generate enough unique names with start first, end
 * last, so the resolver assigns monotonic indices.
 */
function enumerateCycleNames(start: string, end: string): string[] {
  if (start === end) return [start];
  if (start === 'FIREWALA' && end === 'FIREWALL') {
    return ['FIREWALA', 'FIREWALB', 'FIREWALL'];
  }
  if (start === 'FIRELAV3' && end === 'FIRELAVA') {
    return ['FIRELAV3', 'FIRELAV4', 'FIRELAVA'];
  }
  const prefixLen = sharedPrefixLength(start, end);
  const prefix = start.slice(0, prefixLen);
  const startSuffix = start.slice(prefixLen);
  const endSuffix = end.slice(prefixLen);
  const startDigit = parseInt(startSuffix, 10);
  const endDigit = parseInt(endSuffix, 10);
  if (Number.isFinite(startDigit) && Number.isFinite(endDigit) && endDigit >= startDigit) {
    const out: string[] = [];
    for (let d = startDigit; d <= endDigit; d++) {
      out.push(prefix + String(d).padStart(startSuffix.length, '0'));
    }
    return out;
  }
  return [start, end];
}

function sharedPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

// ── Source table tests ──────────────────────────────────────────────

describe('ANIMDEFS source table', () => {
  it('has 22 entries in exact p_spec.c order', () => {
    expect(ANIMDEFS).toHaveLength(22);
  });

  it('records the original nine flats before the commercial textures', () => {
    const names = ANIMDEFS.map((a) => a.startname);
    expect(names.slice(0, 9)).toEqual(['NUKAGE1', 'FWATER1', 'SWATER1', 'LAVA1', 'BLOOD1', 'RROCK05', 'SLIME01', 'SLIME05', 'SLIME09']);
    for (let i = 0; i < 9; i++) {
      expect(ANIMDEFS[i]!.istexture).toBe(false);
    }
  });

  it('records the thirteen texture cycles after the flats', () => {
    for (let i = 9; i < ANIMDEFS.length; i++) {
      expect(ANIMDEFS[i]!.istexture).toBe(true);
    }
    expect(ANIMDEFS.map((a) => a.startname).slice(9)).toEqual(['BLODGR1', 'SLADRIP1', 'BLODRIP1', 'FIREWALA', 'GSTFONT1', 'FIRELAV3', 'FIREMAG1', 'FIREBLU1', 'ROCKRED1', 'BFALL1', 'SFALL1', 'WFALL1', 'DBRAIN1']);
  });

  it('uses speed = 8 for every vanilla cycle', () => {
    for (const def of ANIMDEFS) expect(def.speed).toBe(8);
  });

  it('is frozen so callers cannot mutate the source table', () => {
    expect(Object.isFrozen(ANIMDEFS)).toBe(true);
  });

  it('fits inside MAXANIMS when every cycle resolves', () => {
    expect(ANIMDEFS.length).toBeLessThanOrEqual(MAXANIMS);
  });
});

// ── initPicAnims: filtering ─────────────────────────────────────────

describe('initPicAnims filtering', () => {
  it('drops animdefs whose start name is absent (shareware iwad)', () => {
    const resolver = buildResolver(SHAREWARE_TEXTURES, SHAREWARE_FLATS);
    const anims = initPicAnims(resolver);
    const resolvedStarts = anims.map((a) => a.basepic);

    const fwaterDef = ANIMDEFS.find((a) => a.startname === 'FWATER1')!;
    const lavaDef = ANIMDEFS.find((a) => a.startname === 'LAVA1')!;
    const fireBlueDef = ANIMDEFS.find((a) => a.startname === 'FIREBLU1')!;
    expect(fwaterDef).toBeDefined();
    expect(lavaDef).toBeDefined();
    expect(fireBlueDef).toBeDefined();

    expect(resolvedStarts).toContain(SHAREWARE_FLATS.FWATER1);
    expect(resolvedStarts).toContain(SHAREWARE_FLATS.LAVA1);
    expect(resolvedStarts).toContain(SHAREWARE_TEXTURES.FIREBLU1);

    // Doom II entries (SWATER, RROCK05, SLIME01, BLODGR1, BFALL1, …)
    // have no shareware resolver entry so they must be silently dropped.
    const droppedStarts = ['SWATER1', 'RROCK05', 'SLIME01', 'SLIME05', 'SLIME09', 'BLODGR1', 'SLADRIP1', 'BLODRIP1', 'GSTFONT1', 'BFALL1', 'SFALL1', 'WFALL1', 'DBRAIN1'];
    for (const name of droppedStarts) {
      const droppedDef = ANIMDEFS.find((a) => a.startname === name);
      expect(droppedDef).toBeDefined();
      expect(
        anims.some((a) => {
          if (droppedDef!.istexture) {
            return a.basepic === SHAREWARE_TEXTURES[name];
          }
          return a.basepic === SHAREWARE_FLATS[name];
        }),
      ).toBe(false);
    }
  });

  it('keeps every animdef when every start name resolves (commercial iwad)', () => {
    const resolver = buildCommercialResolver();
    const anims = initPicAnims(resolver);
    expect(anims).toHaveLength(ANIMDEFS.length);
    for (let i = 0; i < ANIMDEFS.length; i++) {
      expect(anims[i]!.istexture).toBe(ANIMDEFS[i]!.istexture);
      expect(anims[i]!.speed).toBe(ANIMDEFS[i]!.speed);
      expect(anims[i]!.numpics).toBeGreaterThanOrEqual(2);
      expect(anims[i]!.numpics).toBe(anims[i]!.picnum - anims[i]!.basepic + 1);
    }
  });

  it("does not touch the resolver's end-name lookup when the start is missing", () => {
    const calls: string[] = [];
    const resolver: AnimResolver = {
      checkTextureNumForName(name) {
        calls.push(`checkT:${name}`);
        return -1;
      },
      textureNumForName(name) {
        calls.push(`T:${name}`);
        throw new Error(`unexpected textureNumForName(${name})`);
      },
      checkFlatLumpForName(name) {
        calls.push(`checkF:${name}`);
        return -1;
      },
      flatNumForName(name) {
        calls.push(`F:${name}`);
        throw new Error(`unexpected flatNumForName(${name})`);
      },
    };
    const anims = initPicAnims(resolver);
    expect(anims).toHaveLength(0);
    expect(calls.every((c) => c.startsWith('check'))).toBe(true);
  });

  it('uses checkFlatLumpForName (W_CheckNumForName) for flats and checkTextureNumForName for textures', () => {
    const order: Array<['tex' | 'flat', string]> = [];
    const textures: Record<string, number> = {};
    const flats: Record<string, number> = {};
    const resolver: AnimResolver = {
      checkTextureNumForName(name) {
        order.push(['tex', name]);
        return -1;
      },
      textureNumForName() {
        throw new Error('unreachable');
      },
      checkFlatLumpForName(name) {
        order.push(['flat', name]);
        return -1;
      },
      flatNumForName() {
        throw new Error('unreachable');
      },
    };
    initPicAnims(resolver);
    // The first nine checks are flats, the last thirteen are textures.
    expect(order.slice(0, 9).every(([k]) => k === 'flat')).toBe(true);
    expect(order.slice(9).every(([k]) => k === 'tex')).toBe(true);
    expect(order).toHaveLength(ANIMDEFS.length);
    // Suppress unused-var lints when the harness disables strict mode.
    void textures;
    void flats;
  });
});

// ── initPicAnims: error path ────────────────────────────────────────

describe('initPicAnims bad-cycle validation', () => {
  it('throws when a flat cycle has numpics < 2', () => {
    const flats: Record<string, number> = { NUKAGE1: 50, NUKAGE3: 50 };
    const textures: Record<string, number> = {};
    const resolver = buildResolver(textures, flats);
    expect(() => initPicAnims(resolver)).toThrow(/P_InitPicAnims: bad cycle from NUKAGE1 to NUKAGE3/);
  });

  it('throws when a texture cycle inverts end and start indices', () => {
    const textures: Record<string, number> = {
      FIREWALA: 200,
      FIREWALL: 199, // end before start — numpics = 0
    };
    const flats: Record<string, number> = {};
    const resolver = buildResolver(textures, flats);
    expect(() => initPicAnims(resolver)).toThrow(/P_InitPicAnims: bad cycle from FIREWALA to FIREWALL/);
  });

  it('accepts the smallest valid cycle (numpics === 2)', () => {
    const textures: Record<string, number> = { FIREWALA: 1, FIREWALL: 2 };
    const flats: Record<string, number> = {};
    const resolver = buildResolver(textures, flats);
    const anims = initPicAnims(resolver);
    const firewall = anims.find((a) => a.istexture && a.basepic === 1 && a.picnum === 2);
    expect(firewall).toBeDefined();
    expect(firewall!.numpics).toBe(2);
  });
});

// ── updateAnimTranslation: per-tic rotation ─────────────────────────

describe('updateAnimTranslation rotation', () => {
  it('writes pic = basepic + ((basepic + k) % numpics) at leveltime 0', () => {
    // Vanilla does NOT reset to identity at t=0; the formula is
    // `pic = basepic + ((leveltime/speed + i) % numpics)` and for t=0
    // that collapses to `basepic + (i % numpics)`.  For cycles where
    // `basepic % numpics !== 0` this is a non-trivial permutation.
    const resolver = buildResolver(SHAREWARE_TEXTURES, SHAREWARE_FLATS);
    const anims = initPicAnims(resolver);
    const tex = identityInt32(256);
    const flat = identityInt32(256);
    updateAnimTranslation(anims, 0, tex, flat);
    for (const anim of anims) {
      for (let k = 0; k < anim.numpics; k++) {
        const table = anim.istexture ? tex : flat;
        const expected = anim.basepic + ((anim.basepic + k) % anim.numpics);
        expect(table[anim.basepic + k]).toBe(expected);
      }
    }
  });

  it('advances one frame every `speed` tics', () => {
    // Isolate a single flat cycle: NUKAGE1..NUKAGE3 at indices 10..12.
    const anims = initPicAnims(buildResolver({}, { NUKAGE1: 10, NUKAGE2: 11, NUKAGE3: 12 }));
    expect(anims).toHaveLength(1);
    const flat = identityInt32(16);
    const tex = identityInt32(16);

    // speed = 8, numpics = 3, basepic = 10
    // Formula: translation[10+k] = 10 + ((leveltime/8 + 10 + k) % 3)
    for (const lt of [0, 7, 8, 15, 16, 23, 24]) {
      updateAnimTranslation(anims, lt, tex, flat);
      const step = Math.floor(lt / 8);
      for (let k = 0; k < 3; k++) {
        expect(flat[10 + k]).toBe(10 + ((step + 10 + k) % 3));
      }
    }
  });

  it('routes texture anims to the texture table and flat anims to the flat table', () => {
    const textures: Record<string, number> = { FIREWALA: 5, FIREWALL: 6 };
    const flats: Record<string, number> = { NUKAGE1: 5, NUKAGE3: 7 };
    const anims = initPicAnims(buildResolver(textures, flats));
    expect(anims).toHaveLength(2);

    const tex = identityInt32(16);
    const flat = identityInt32(16);
    updateAnimTranslation(anims, 8, tex, flat);

    // The texture anim covers indices 5..6; the flat anim covers 5..7.
    // They share indices by coincidence, so this test also guards against
    // a bug where both tables are written for either anim.

    // Texture anim at speed 8, numpics 2, step 1: translation[5+k] = 5 + ((1+5+k) % 2)
    // k=0: (6%2)=0 → 5; k=1: (7%2)=1 → 6
    expect(tex[5]).toBe(5);
    expect(tex[6]).toBe(6);

    // Flat anim at speed 8, numpics 3, step 1: translation[5+k] = 5 + ((1+5+k) % 3)
    // k=0: (6%3)=0 → 5; k=1: (7%3)=1 → 6; k=2: (8%3)=2 → 7
    expect(flat[5]).toBe(5);
    expect(flat[6]).toBe(6);
    expect(flat[7]).toBe(7);

    // Slots not owned by either anim stay at identity (untouched).
    expect(tex[0]).toBe(0);
    expect(flat[0]).toBe(0);
    expect(tex[15]).toBe(15);
    expect(flat[15]).toBe(15);
  });

  it('cycles every numpics*speed tics (parity-sensitive edge case)', () => {
    // Use FWATER1..FWATER4 at 20..23: numpics = 4, speed = 8.
    // One full cycle = 32 tics.
    const anims = initPicAnims(
      buildResolver(
        {},
        {
          FWATER1: 20,
          FWATER2: 21,
          FWATER3: 22,
          FWATER4: 23,
        },
      ),
    );
    expect(anims).toHaveLength(1);
    const tex = identityInt32(32);
    const flatT0 = identityInt32(32);
    updateAnimTranslation(anims, 0, tex, flatT0);

    const flatT32 = identityInt32(32);
    updateAnimTranslation(anims, 32, tex, flatT32);

    // After a full 32-tic cycle the translation MUST equal the t=0 state.
    for (let k = 0; k < 4; k++) {
      expect(flatT32[20 + k]).toBe(flatT0[20 + k]);
    }

    // Confirm t=0 is identity.
    for (let k = 0; k < 4; k++) {
      expect(flatT0[20 + k]).toBe(20 + k);
    }

    // And confirm t=16 is half-cycle rotated (numpics/2 = 2 offset).
    const flatT16 = identityInt32(32);
    updateAnimTranslation(anims, 16, tex, flatT16);
    // step = 16/8 = 2; translation[20+k] = 20 + ((2+20+k) % 4)
    // k=0: (22%4)=2 → 22; k=1: 3 → 23; k=2: 0 → 20; k=3: 1 → 21
    expect(flatT16[20]).toBe(22);
    expect(flatT16[21]).toBe(23);
    expect(flatT16[22]).toBe(20);
    expect(flatT16[23]).toBe(21);
  });

  it('is idempotent within a single tic (repeated calls do not drift)', () => {
    const anims = initPicAnims(buildResolver({}, { NUKAGE1: 10, NUKAGE2: 11, NUKAGE3: 12 }));
    const flat = identityInt32(16);
    const tex = identityInt32(16);
    updateAnimTranslation(anims, 123, tex, flat);
    const first = Array.from(flat);
    updateAnimTranslation(anims, 123, tex, flat);
    updateAnimTranslation(anims, 123, tex, flat);
    expect(Array.from(flat)).toEqual(first);
  });

  it('does not overwrite indices outside [basepic, picnum]', () => {
    const anims = initPicAnims(buildResolver({}, { NUKAGE1: 10, NUKAGE2: 11, NUKAGE3: 12 }));
    const flat = identityInt32(16);
    // Pre-seed non-identity markers outside the cycle.
    for (let i = 0; i < flat.length; i++) flat[i] = i + 1000;
    const tex = identityInt32(16);

    updateAnimTranslation(anims, 100, tex, flat);

    // Slots 10..12 are rewritten by the anim.
    for (let k = 0; k < 3; k++) {
      expect(flat[10 + k]).not.toBe(10 + k + 1000);
    }
    // Every other slot keeps the pre-seeded value.
    for (let i = 0; i < flat.length; i++) {
      if (i >= 10 && i <= 12) continue;
      expect(flat[i]).toBe(i + 1000);
    }
  });

  it('handles leveltime smaller than any anim.speed without division artefacts', () => {
    const anims = initPicAnims(buildResolver({}, { NUKAGE1: 10, NUKAGE2: 11, NUKAGE3: 12 }));
    const flat = identityInt32(16);
    const tex = identityInt32(16);
    // leveltime=1 → step=floor(1/8)=0.  translation[10+k] = 10 + ((0 + 10 + k) % 3).
    // k=0: (10%3)=1 → 11; k=1: (11%3)=2 → 12; k=2: (12%3)=0 → 10.
    updateAnimTranslation(anims, 1, tex, flat);
    expect(flat[10]).toBe(11);
    expect(flat[11]).toBe(12);
    expect(flat[12]).toBe(10);
  });
});

// ── Helpers ─────────────────────────────────────────────────────────

function identityInt32(length: number): Int32Array {
  const a = new Int32Array(length);
  for (let i = 0; i < length; i++) a[i] = i;
  return a;
}
