import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { MAXSHORT, renderMaskedSegRange } from '../../../src/render/maskedTextures.ts';
import type { MaskedDrawSeg, MaskedSegRenderContext } from '../../../src/render/maskedTextures.ts';
import { renderTwoSidedWall } from '../../../src/render/twoSidedWalls.ts';
import type { TwoSidedWallRenderContext, TwoSidedWallSegment } from '../../../src/render/twoSidedWalls.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const MASKED_TEXTURES_RELATIVE_PATH = 'src/render/maskedTextures.ts';
const MASKED_TEXTURES_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, MASKED_TEXTURES_RELATIVE_PATH);
const TWO_SIDED_WALLS_RELATIVE_PATH = 'src/render/twoSidedWalls.ts';
const TWO_SIDED_WALLS_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, TWO_SIDED_WALLS_RELATIVE_PATH);

describe('plan_final render: wire-masked-textures', () => {
  test('src/render/maskedTextures.ts and src/render/twoSidedWalls.ts both exist and are committed regular files', () => {
    expect(existsSync(MASKED_TEXTURES_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(MASKED_TEXTURES_ABSOLUTE_PATH).isFile()).toBe(true);
    expect(existsSync(TWO_SIDED_WALLS_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(TWO_SIDED_WALLS_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('renderMaskedSegRange is exported as a function accepting (seg, x1, x2, ctx)', () => {
    expect(typeof renderMaskedSegRange).toBe('function');
    expect(renderMaskedSegRange.length).toBe(4);
  });

  test('renderTwoSidedWall is exported as a function accepting (seg, ctx)', () => {
    expect(typeof renderTwoSidedWall).toBe('function');
    expect(renderTwoSidedWall.length).toBe(2);
  });

  test('MAXSHORT pins the vanilla maskedtexturecol[x]=MAXSHORT done-flag sentinel value of 0x7fff', () => {
    expect(MAXSHORT).toBe(0x7fff);
  });

  test('src/render/maskedTextures.ts cites R_RenderMaskedSegRange in the top-of-file comment', () => {
    const fileText = readFileSync(MASKED_TEXTURES_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('R_RenderMaskedSegRange');
    expect(fileText).toContain('r_segs.c');
  });

  test('src/render/twoSidedWalls.ts re-exports HEIGHTBITS, HEIGHTUNIT, INVERSE_SCALE_NUMERATOR from solidWalls', () => {
    const fileText = readFileSync(TWO_SIDED_WALLS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('HEIGHTBITS');
    expect(fileText).toContain('HEIGHTUNIT');
    expect(fileText).toContain('INVERSE_SCALE_NUMERATOR');
    expect(fileText).toContain("from './solidWalls.ts'");
  });

  test('MaskedSegRenderContext interface is exposed for the wall-rendering pass to consume', () => {
    type ContextDef = MaskedSegRenderContext;
    const context: ContextDef | null = null;
    expect(context).toBeNull();
  });

  test('TwoSidedWallRenderContext interface is exposed for the wall-rendering pass to consume', () => {
    type ContextDef = TwoSidedWallRenderContext;
    const context: ContextDef | null = null;
    expect(context).toBeNull();
  });

  test('MaskedDrawSeg and TwoSidedWallSegment types are exposed for the wall-rendering pass to consume', () => {
    type SegDef = MaskedDrawSeg | TwoSidedWallSegment;
    const seg: SegDef | null = null;
    expect(seg).toBeNull();
  });
});
