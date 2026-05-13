import { describe, expect, test } from 'bun:test';

import {
  MASKED_MIDTEXTURE_CLIP_ORDER,
  MASKED_MIDTEXTURE_DONE_FLAG,
  MASKED_MIDTEXTURE_ISCALE_NUMERATOR,
  MASKED_MIDTEXTURE_LIGHTSCALESHIFT,
  MASKED_MIDTEXTURE_MAXLIGHTSCALE,
  MASKED_MIDTEXTURE_RENDER_PHASE,
  maskedMidtextureIscale,
  maskedMidtextureLightBucket,
  maskedMidtexturePostTextureMid,
  maskedMidtextureWrapColumn,
} from '../../../src/render/implement-masked-midtexture-rendering.ts';

describe('vanilla masked midtexture rendering parity', () => {
  test('done-flag sentinel matches MAXSHORT (0x7fff = 32767)', () => {
    expect(MASKED_MIDTEXTURE_DONE_FLAG).toBe(0x7fff);
    expect(MASKED_MIDTEXTURE_DONE_FLAG).toBe(32767);
  });

  test('light-scale shift and max match r_main.h LIGHTSCALESHIFT/MAXLIGHTSCALE', () => {
    expect(MASKED_MIDTEXTURE_LIGHTSCALESHIFT).toBe(12);
    expect(MASKED_MIDTEXTURE_MAXLIGHTSCALE).toBe(48);
  });

  test('iscale numerator is unsigned 0xffffffff', () => {
    expect(MASKED_MIDTEXTURE_ISCALE_NUMERATOR).toBe(0xffff_ffff);
  });

  test('light bucket: spryscale=FRACUNIT (0x10000) maps to index 16', () => {
    expect(maskedMidtextureLightBucket(0x10000)).toBe(16);
  });

  test('light bucket clamps at MAXLIGHTSCALE - 1 for large scales', () => {
    expect(maskedMidtextureLightBucket(0xffff_ffff | 0)).toBe(0);
    const justSaturating = (MASKED_MIDTEXTURE_MAXLIGHTSCALE - 1) << MASKED_MIDTEXTURE_LIGHTSCALESHIFT;
    expect(maskedMidtextureLightBucket(justSaturating)).toBe(MASKED_MIDTEXTURE_MAXLIGHTSCALE - 1);
    expect(maskedMidtextureLightBucket(justSaturating + 1)).toBe(MASKED_MIDTEXTURE_MAXLIGHTSCALE - 1);
    expect(maskedMidtextureLightBucket(justSaturating + (1 << 20))).toBe(MASKED_MIDTEXTURE_MAXLIGHTSCALE - 1);
  });

  test('iscale: spryscale=1 yields signed -1 after unsigned divide and | 0', () => {
    expect(maskedMidtextureIscale(1)).toBe(-1);
  });

  test('iscale: spryscale=FRACUNIT yields 0xffff (truncated unsigned divide)', () => {
    // 0xffffffff / 0x10000 = 65535.999... → trunc = 65535 = 0xffff
    expect(maskedMidtextureIscale(0x10000)).toBe(0xffff);
  });

  test('iscale: spryscale=2*FRACUNIT yields 0x7fff (truncated unsigned divide)', () => {
    // 0xffffffff / 0x20000 = 32767.999... → trunc = 32767 = 0x7fff
    expect(maskedMidtextureIscale(0x20000)).toBe(0x7fff);
  });

  test('iscale throws on spryscale=0 (vanilla divide-by-zero)', () => {
    expect(() => maskedMidtextureIscale(0)).toThrow(/divide-by-zero/);
  });

  test("column wrap respects widthMask (signed two's-complement bitwise AND)", () => {
    expect(maskedMidtextureWrapColumn(0, 127)).toBe(0);
    expect(maskedMidtextureWrapColumn(127, 127)).toBe(127);
    expect(maskedMidtextureWrapColumn(128, 127)).toBe(0);
    expect(maskedMidtextureWrapColumn(255, 127)).toBe(127);
    expect(maskedMidtextureWrapColumn(-1, 127)).toBe(127);
  });

  test('post textureMid = base - (postTopDelta << 16)', () => {
    expect(maskedMidtexturePostTextureMid(0, 0)).toBe(0);
    expect(maskedMidtexturePostTextureMid(0x10_0000, 1)).toBe(0x10_0000 - 0x1_0000);
    expect(maskedMidtexturePostTextureMid(0, 4)).toBe(-0x4_0000);
  });

  test('clip order: yh-against-sprbottomclip runs before yl-against-sprtopclip', () => {
    expect(MASKED_MIDTEXTURE_CLIP_ORDER[0]).toBe('yh-against-sprbottomclip');
    expect(MASKED_MIDTEXTURE_CLIP_ORDER[1]).toBe('yl-against-sprtopclip');
  });

  test('render phase declares masked-midtextures run after solid walls and sprites', () => {
    expect(MASKED_MIDTEXTURE_RENDER_PHASE).toBe('after-solid-walls-after-sprites');
  });
});
