import { describe, expect, test } from 'bun:test';

import type { TextureDefinition } from '../../src/assets/texture1.ts';
import type { DecodedPatch } from '../../src/render/patchDraw.ts';
import { makeTextureCatalog } from '../../src/render/textureCatalog.ts';
import type { WallPatchPlacement } from '../../src/render/wallColumns.ts';

function def(name: string, width: number, patchIndex: number): TextureDefinition {
  return Object.freeze({
    name,
    masked: false,
    width,
    height: 1,
    patchCount: 1,
    patches: Object.freeze([Object.freeze({ originX: 0, originY: 0, patchIndex })]),
  });
}

const PNAMES = Object.freeze(['PA', 'PB']);
// Combined TEXTURE1(+TEXTURE2) order — index = vanilla texture number.
const DEFS: readonly TextureDefinition[] = Object.freeze([def('AASHITTY', 1, 0), def('STARTAN3', 64, 1), def('BROWN1', 32, 0)]);

describe('textureCatalog: texture-number → PreparedWallTexture (R_InitTextures inverse)', () => {
  test('maps a number to its combined-order def and threads name/dims/placements into prepareWallTexture', () => {
    const onePatch: readonly WallPatchPlacement[] = Object.freeze([]);
    const calls: Array<{ name: string; width: number; height: number }> = [];
    const textureOf = makeTextureCatalog(DEFS, PNAMES, () => null, {
      buildWallPatchPlacementsFn: (d, pn) => {
        expect(d).toBe(DEFS[1]);
        expect(pn).toBe(PNAMES);
        return onePatch;
      },
      prepareWallTextureFn: (name, width, height, patches) => {
        calls.push({ name, width, height });
        expect(patches).toBe(onePatch);
        return Object.freeze({ name, width, height, widthMask: width - 1, composite: new Uint8Array(1), columns: Object.freeze([new Uint8Array(1)]) });
      },
    });

    const t = textureOf(1)!;
    expect(t.name).toBe('STARTAN3');
    expect(t.width).toBe(64);
    expect(calls).toEqual([{ name: 'STARTAN3', width: 64, height: 1 }]);
  });

  test('memoizes per number — same frozen instance, prepare runs once (parity-neutral cache)', () => {
    let prepares = 0;
    const textureOf = makeTextureCatalog(DEFS, PNAMES, () => null, {
      buildWallPatchPlacementsFn: () => Object.freeze([]),
      prepareWallTextureFn: (name, width, height) => {
        prepares += 1;
        return Object.freeze({ name, width, height, widthMask: 0, composite: new Uint8Array(1), columns: Object.freeze([new Uint8Array(1)]) });
      },
    });

    const a = textureOf(2);
    const b = textureOf(2);
    expect(a).toBe(b);
    expect(prepares).toBe(1);
    // A different number still builds (independently cached).
    textureOf(0);
    expect(prepares).toBe(2);
  });

  test('a number outside the definition list is a wiring error (no fabricated texture)', () => {
    const textureOf = makeTextureCatalog(DEFS, PNAMES, () => null, {
      buildWallPatchPlacementsFn: () => Object.freeze([]),
      prepareWallTextureFn: (n) => Object.freeze({ name: n, width: 0, height: 0, widthMask: 0, composite: new Uint8Array(0), columns: Object.freeze([]) }),
    });
    expect(() => textureOf(3)).toThrow(RangeError);
    expect(() => textureOf(3)).toThrow('texture number 3 outside 0..2');
  });

  test('end-to-end over the real buildWallPatchPlacements + prepareWallTexture composite passes', () => {
    // A real 1×1 single-patch texture: pixel 42 must survive composition.
    const patch: DecodedPatch = Object.freeze({
      header: Object.freeze({ width: 1, height: 1, leftOffset: 0, topOffset: 0 }),
      columns: Object.freeze([Object.freeze([Object.freeze({ topDelta: 0, length: 1, pixels: new Uint8Array([42]) })])]),
    });
    const textureOf = makeTextureCatalog([def('AASHITTY', 1, 0)], PNAMES, (name) => (name === 'PA' ? patch : null));

    const t = textureOf(0)!;
    expect(t.name).toBe('AASHITTY');
    expect(t.width).toBe(1);
    expect(t.height).toBe(1);
    expect(t.columns.length).toBe(1);
    expect(t.columns[0]![0]).toBe(42);
  });

  test('a missing patch lump propagates the R_InitTextures I_Error through the catalog', () => {
    const textureOf = makeTextureCatalog([def('BIGDOOR1', 64, 0)], PNAMES, () => null);
    expect(() => textureOf(0)).toThrow('R_InitTextures: Missing patch in texture BIGDOOR1');
  });
});
