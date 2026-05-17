/**
 * I6a parity tests for the sprite-frame catalog (`buildSpriteCatalog`
 * = r_things.c `R_InstallSpriteLump` + `R_InitSpriteDefs`).
 *
 * Rigor bar mirrors the wall pipeline: exact hand-derived scenario
 * asserts (rot-0 all-8, 8-rotation, mirrored 8-char lump, numframes,
 * unmatched→0) + every `I_Error` path, a STRUCTURALLY DISTINCT in-test
 * re-transcription differential over a constructed namespace, and a
 * REAL doom/DOOM1.WAD sprite-namespace integration check.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseSpriteNamespace } from '../../src/assets/parse-sprite-namespace.ts';
import type { SpriteCatalogLump } from '../../src/render/spriteCatalog.ts';
import { MAX_SPRITE_FRAMES, VANILLA_SPRNAMES, buildSpriteCatalog } from '../../src/render/spriteCatalog.ts';

const lump = (name: string, spriteNumber: number): SpriteCatalogLump => ({ name, spriteNumber });

describe('buildSpriteCatalog — VANILLA_SPRNAMES table', () => {
  test('is the verbatim 138-entry info.c sprnames order (TROO first, TLP2 last)', () => {
    expect(VANILLA_SPRNAMES.length).toBe(138);
    expect(VANILLA_SPRNAMES[0]).toBe('TROO');
    expect(VANILLA_SPRNAMES[28]).toBe('PLAY'); // SPR_PLAY index
    expect(VANILLA_SPRNAMES[137]).toBe('TLP2');
    expect(new Set(VANILLA_SPRNAMES).size).toBe(138); // unique
  });
});

describe('buildSpriteCatalog — frame installation', () => {
  test('a rot-0 lump fills all 8 slots, rotate=false', () => {
    const sprites = buildSpriteCatalog([lump('TROOA0', 0)], ['TROO']);
    expect(sprites[0]!.numFrames).toBe(1);
    const f = sprites[0]!.frames[0]!;
    expect(f.rotate).toBe(false);
    expect([...f.lump]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect([...f.flip]).toEqual([false, false, false, false, false, false, false, false]);
  });

  test('eight rotation lumps build a rotate=true frame with distinct lumps', () => {
    const lumps = [1, 2, 3, 4, 5, 6, 7, 8].map((r, i) => lump(`TROOB${r}`, 10 + i));
    const sprites = buildSpriteCatalog(lumps, ['TROO']);
    expect(sprites[0]!.numFrames).toBe(2); // frames A(0,empty)+B(1) → maxframe 1 → +1 = 2
    const b = sprites[0]!.frames[1]!;
    expect(b.rotate).toBe(true);
    expect([...b.lump]).toEqual([10, 11, 12, 13, 14, 15, 16, 17]); // rotation-1 → 0-based
  });

  test('an 8-char "A2A8" lump installs frame A rot2 and the mirrored rot8 (flip)', () => {
    // TROOA2A8: frame A rot2 flipped=false; second view frame A rot8 flipped=true.
    // Needs the rest of frame A's rotations to satisfy the all-8 check.
    const lumps: SpriteCatalogLump[] = [lump('TROOA2A8', 5), lump('TROOA1', 6), lump('TROOA3A7', 7), lump('TROOA4A6', 8), lump('TROOA5', 9)];
    const sprites = buildSpriteCatalog(lumps, ['TROO']);
    const a = sprites[0]!.frames[0]!;
    expect(a.rotate).toBe(true);
    expect(a.lump[1]).toBe(5); // rot2 → index 1, from TROOA2..
    expect(a.flip[1]).toBe(false);
    expect(a.lump[7]).toBe(5); // mirrored rot8 → index 7, flipped
    expect(a.flip[7]).toBe(true);
    expect(a.lump[6]).toBe(7); // TROOA3A7 → rot7 mirror index 6
    expect(a.flip[6]).toBe(true);
  });

  test('a name with no matching lumps yields numFrames 0', () => {
    const sprites = buildSpriteCatalog([lump('TROOA0', 0)], ['TROO', 'VILE']);
    expect(sprites[1]!.numFrames).toBe(0);
    expect(sprites[1]!.frames).toEqual([]);
  });
});

describe('buildSpriteCatalog — I_Error parity', () => {
  test('bad frame character (frame >= 29) throws', () => {
    // name[4] = '^' (char 94 = 'A'+29) → frame 29 >= MAX_SPRITE_FRAMES.
    // (WAD lump names are uppercase; '^' is unchanged by toUpperCase.)
    expect(() => buildSpriteCatalog([lump('TROO^0', 0)], ['TROO'])).toThrow(/Bad frame characters/);
  });

  test('two rot-0 lumps for the same frame throws "multip rot=0"', () => {
    expect(() => buildSpriteCatalog([lump('TROOA0', 0), lump('TROOA0', 1)], ['TROO'])).toThrow(/multip rot=0/);
  });

  test('a rotation lump after a rot-0 lump throws "rotations and a rot=0 lump"', () => {
    expect(() => buildSpriteCatalog([lump('TROOA0', 0), lump('TROOA1', 1)], ['TROO'])).toThrow(/rotations and a rot=0 lump/);
  });

  test('duplicate rotation throws "two lumps mapped to it"', () => {
    expect(() => buildSpriteCatalog([lump('TROOA1', 0), lump('TROOA1', 1)], ['TROO'])).toThrow(/two lumps mapped to it/);
  });

  test('a rotate=true frame missing rotations throws "missing rotations"', () => {
    expect(() => buildSpriteCatalog([lump('TROOA1', 0), lump('TROOA3', 1)], ['TROO'])).toThrow(/missing rotations/);
  });
});

// Structurally distinct re-transcription of R_InstallSpriteLump/R_InitSpriteDefs.
function oracle(lumps: readonly SpriteCatalogLump[], names: readonly string[]): { numFrames: number; rotate: boolean[]; lump: number[][] }[] {
  return names.map((nm) => {
    const pre = nm.toUpperCase();
    const rot = new Array<number>(MAX_SPRITE_FRAMES).fill(0xff);
    const lm = Array.from({ length: MAX_SPRITE_FRAMES }, () => new Array<number>(8).fill(-1));
    let maxf = -1;
    const inst = (li: number, fr: number, ro: number): void => {
      if (fr >= MAX_SPRITE_FRAMES || ro > 8) throw new Error('Bad frame characters');
      if (fr > maxf) maxf = fr;
      if (ro === 0) {
        if (rot[fr] === 0) throw new Error('multip rot=0');
        if (rot[fr] === 1) throw new Error('rotations and a rot=0 lump');
        rot[fr] = 0;
        for (let r = 0; r < 8; r += 1) lm[fr]![r] = li;
        return;
      }
      if (rot[fr] === 0) throw new Error('rotations and a rot=0 lump');
      rot[fr] = 1;
      const r0 = ro - 1;
      if (lm[fr]![r0] !== -1) throw new Error('two lumps mapped to it');
      lm[fr]![r0] = li;
    };
    for (const lp of lumps) {
      const u = lp.name.toUpperCase();
      if (u.length < 4 || u.slice(0, 4) !== pre) continue;
      inst(lp.spriteNumber, u.charCodeAt(4) - 65, u.charCodeAt(5) - 48);
      if (u.length > 6 && u.charCodeAt(6) !== 0) inst(lp.spriteNumber, u.charCodeAt(6) - 65, u.charCodeAt(7) - 48);
    }
    if (maxf === -1) return { numFrames: 0, rotate: [], lump: [] };
    const mf = maxf + 1;
    for (let f = 0; f < mf; f += 1) {
      if (rot[f] === 1) {
        for (let r = 0; r < 8; r += 1) if (lm[f]![r] === -1) throw new Error('missing rotations');
      }
    }
    return { numFrames: mf, rotate: Array.from({ length: mf }, (_, f) => rot[f] === 1), lump: Array.from({ length: mf }, (_, f) => lm[f]!.slice()) };
  });
}

describe('buildSpriteCatalog — independent re-transcription differential', () => {
  test('matches the oracle over a constructed multi-sprite namespace', () => {
    const lumps: SpriteCatalogLump[] = [
      lump('PLAYA1', 0),
      lump('PLAYA2A8', 1),
      lump('PLAYA3A7', 2),
      lump('PLAYA4A6', 3),
      lump('PLAYA5', 4),
      lump('PLAYB1', 5),
      lump('PLAYB2B8', 6),
      lump('PLAYB3B7', 7),
      lump('PLAYB4B6', 8),
      lump('PLAYB5', 9),
      lump('PISGA0', 10),
      lump('PISGB0', 11),
      lump('PISGC0', 12),
      lump('PUNGA0', 13),
    ];
    const names = ['PLAY', 'PISG', 'PUNG', 'VILE'];
    const got = buildSpriteCatalog(lumps, names);
    const want = oracle(lumps, names);
    for (let i = 0; i < names.length; i += 1) {
      expect(got[i]!.numFrames).toBe(want[i]!.numFrames);
      expect(got[i]!.frames.map((f) => f.rotate)).toEqual(want[i]!.rotate);
      expect(got[i]!.frames.map((f) => [...f.lump])).toEqual(want[i]!.lump);
    }
  });
});

describe('buildSpriteCatalog — real doom/DOOM1.WAD sprite namespace', () => {
  test('builds the full vanilla catalog; shareware sprites present, DOOM2-only absent', () => {
    const wad = readFileSync('doom/DOOM1.WAD');
    const directory = parseWadDirectory(wad, parseWadHeader(wad));
    const namespace = parseSpriteNamespace(directory);
    const lumps: SpriteCatalogLump[] = namespace.entries.map((e) => ({ name: e.name, spriteNumber: e.spriteNumber }));
    const sprites = buildSpriteCatalog(lumps);
    expect(sprites.length).toBe(138);
    // PLAY (player) and the pistol weapon PISG are in shareware DOOM1.WAD.
    expect(sprites[VANILLA_SPRNAMES.indexOf('PLAY')]!.numFrames).toBeGreaterThan(0);
    expect(sprites[VANILLA_SPRNAMES.indexOf('PISG')]!.numFrames).toBeGreaterThan(0);
    expect(sprites[VANILLA_SPRNAMES.indexOf('TROO')]!.numFrames).toBeGreaterThan(0); // imp (E1M1 has imps)
    // VILE (Arch-vile) / FATT (Mancubus) are DOOM2-only → absent in shareware.
    expect(sprites[VANILLA_SPRNAMES.indexOf('VILE')]!.numFrames).toBe(0);
    expect(sprites[VANILLA_SPRNAMES.indexOf('FATT')]!.numFrames).toBe(0);
    // determinism
    const again = buildSpriteCatalog(lumps);
    expect(again[VANILLA_SPRNAMES.indexOf('PLAY')]).toEqual(sprites[VANILLA_SPRNAMES.indexOf('PLAY')]!);
  });
});
