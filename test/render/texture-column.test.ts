import { describe, expect, test } from 'bun:test';

import { ANG90, ANG180 } from '../../src/core/angle.ts';
import { FRACBITS, FRACUNIT, fixedMul } from '../../src/core/fixed.ts';
import { ANGLETOFINESHIFT, finetangent } from '../../src/core/trig.ts';
import { makeTextureColumnFor } from '../../src/render/textureColumn.ts';

function syntheticXToViewAngle(width: number): Uint32Array {
  // Plausible angle_t spread either side of 0 across the columns.
  const table = new Uint32Array(width);
  for (let x = 0; x < width; x += 1) {
    table[x] = ((x - (width >> 1)) * 0x0010_0000) >>> 0;
  }
  return table;
}

describe('textureColumn: R_RenderSegLoop texture-column formula', () => {
  test('full independent vanilla re-derivation over a parameter grid', () => {
    const xtoviewangle = syntheticXToViewAngle(64);
    for (const rwCenterangle of [0, ANG90, ANG180, 0x1234_5678, 0xfedc_ba98]) {
      for (const rwOffset of [0, 16 << 16, -32 << 16, 1_234_567]) {
        for (const rwDistance of [256, FRACUNIT, 64 * FRACUNIT, 7_654_321]) {
          const textureColumnFor = makeTextureColumnFor(rwCenterangle, rwOffset, rwDistance, xtoviewangle);
          for (let x = 0; x < 64; x += 1) {
            const angle = ((rwCenterangle + xtoviewangle[x]!) >>> 0) >>> ANGLETOFINESHIFT;
            const expected = ((rwOffset - fixedMul(finetangent[angle]!, rwDistance)) | 0) >> FRACBITS;
            expect(textureColumnFor(x)).toBe(expected);
          }
        }
      }
    }
  });

  test('the centerangle + xtoviewangle sum wraps as unsigned angle_t', () => {
    // rwCenterangle near 2^32 plus a positive xtoviewangle must wrap, not overflow.
    const xtoviewangle = new Uint32Array([0x4000_0000]);
    const textureColumnFor = makeTextureColumnFor(0xf000_0000, 0, FRACUNIT, xtoviewangle);
    const wrappedAngle = ((0xf000_0000 + 0x4000_0000) >>> 0) >>> ANGLETOFINESHIFT;
    expect(textureColumnFor(0)).toBe(((0 - fixedMul(finetangent[wrappedAngle]!, FRACUNIT)) | 0) >> FRACBITS);
  });

  test('rwOffset shifts every column by the same texel delta and the result is deterministic', () => {
    const xtoviewangle = syntheticXToViewAngle(8);
    const base = makeTextureColumnFor(ANG90, 0, 4 * FRACUNIT, xtoviewangle);
    const shifted = makeTextureColumnFor(ANG90, 5 << FRACBITS, 4 * FRACUNIT, xtoviewangle);
    for (let x = 0; x < 8; x += 1) {
      expect(shifted(x)).toBe(base(x) + 5);
    }
    expect(makeTextureColumnFor(ANG90, 0, 4 * FRACUNIT, xtoviewangle)(3)).toBe(base(3));
  });
});
