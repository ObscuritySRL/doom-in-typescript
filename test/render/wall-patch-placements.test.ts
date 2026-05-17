import { describe, expect, test } from 'bun:test';

import type { TextureDefinition } from '../../src/assets/texture1.ts';
import type { DecodedPatch } from '../../src/render/patchDraw.ts';
import { buildWallPatchPlacements } from '../../src/render/wallPatchPlacements.ts';

// Minimal distinct DecodedPatch — only header.width is read downstream
// (by prepareWallTexture); buildWallPatchPlacements binds it opaquely.
function patch(width: number): DecodedPatch {
  return Object.freeze({ header: Object.freeze({ width, height: 16, leftOffset: 0, topOffset: 0 }), columns: Object.freeze([]) });
}

function textureDef(overrides: Partial<TextureDefinition> = {}): TextureDefinition {
  return Object.freeze({
    name: 'STARTAN3',
    masked: false,
    width: 128,
    height: 128,
    patchCount: 2,
    patches: Object.freeze([Object.freeze({ originX: 0, originY: 0, patchIndex: 2 }), Object.freeze({ originX: -4, originY: 7, patchIndex: 0 })]),
    ...overrides,
  });
}

// parsePnames yields the patch name per patch number; patchByName is
// W_CheckNumForName + the decoded-patch cache.
const PNAMES = Object.freeze(['WALL01', 'WALL02', 'DOOR2']);

describe('wallPatchPlacements: R_InitTextures patch resolution', () => {
  test('copies originx/originy verbatim, maps patchIndex→PNAMES→patch, preserves order', () => {
    const p = { WALL01: patch(64), DOOR2: patch(32) };
    const seen: string[] = [];
    const placements = buildWallPatchPlacements(textureDef(), PNAMES, (name) => {
      seen.push(name);
      return p[name as 'WALL01' | 'DOOR2'] ?? null;
    });

    // PNAMES[2]='DOOR2' first, then PNAMES[0]='WALL01' — invocation order = lump order.
    expect(seen).toEqual(['DOOR2', 'WALL01']);
    expect(placements.length).toBe(2);
    expect(placements[0]!.originX).toBe(0);
    expect(placements[0]!.originY).toBe(0);
    expect(placements[0]!.patch).toBe(p.DOOR2);
    // Signed origins survive untouched (parseTextureLump already sign-extended).
    expect(placements[1]!.originX).toBe(-4);
    expect(placements[1]!.originY).toBe(7);
    expect(placements[1]!.patch).toBe(p.WALL01);
  });

  test('a missing patch lump (W_CheckNumForName == -1) → I_Error with the upstream message', () => {
    expect(() => buildWallPatchPlacements(textureDef({ name: 'BIGDOOR1' }), PNAMES, () => null)).toThrow('R_InitTextures: Missing patch in texture BIGDOOR1');
  });

  test('a patchIndex outside PNAMES is a malformed-lump hard error (no fabricated placement)', () => {
    const def = textureDef({ patches: Object.freeze([Object.freeze({ originX: 0, originY: 0, patchIndex: 9 })]), patchCount: 1 });
    expect(() => buildWallPatchPlacements(def, PNAMES, () => patch(8))).toThrow(RangeError);
    expect(() => buildWallPatchPlacements(def, PNAMES, () => patch(8))).toThrow('PNAMES index 9 outside 0..2');
  });

  test('a duplicate patchIndex resolves the same graphic for each placement', () => {
    const shared = patch(48);
    const def = textureDef({
      patchCount: 2,
      patches: Object.freeze([Object.freeze({ originX: 0, originY: 0, patchIndex: 1 }), Object.freeze({ originX: 64, originY: 0, patchIndex: 1 })]),
    });
    const placements = buildWallPatchPlacements(def, PNAMES, () => shared);
    expect(placements[0]!.patch).toBe(shared);
    expect(placements[1]!.patch).toBe(shared);
    expect(placements[1]!.originX).toBe(64);
  });

  test('no patches → a frozen empty array (single-column texture / degenerate def)', () => {
    const placements = buildWallPatchPlacements(textureDef({ patchCount: 0, patches: Object.freeze([]) }), PNAMES, () => patch(1));
    expect(placements).toEqual([]);
    expect(Object.isFrozen(placements)).toBe(true);
  });

  test('the result and every placement are deep-frozen', () => {
    const placements = buildWallPatchPlacements(textureDef(), PNAMES, () => patch(16));
    expect(Object.isFrozen(placements)).toBe(true);
    expect(Object.isFrozen(placements[0])).toBe(true);
    expect(Object.isFrozen(placements[1])).toBe(true);
  });
});
