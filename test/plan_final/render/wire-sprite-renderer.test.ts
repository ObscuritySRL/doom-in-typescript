import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { FUZZ_COLORMAP_INDEX, FUZZ_TABLE_SIZE, getFuzzPos, rDrawFuzzColumn, resetFuzzPos, setFuzzPos } from '../../../src/render/fuzz.ts';
import { CLIP_UNSET, SIL_BOTH, SIL_BOTTOM, SIL_NONE, SIL_TOP } from '../../../src/render/spriteClip.ts';
import { FF_FRAMEMASK, FF_FULLBRIGHT, MAXVISSPRITES, MINZ, clearSprites, createVisSpritePool, newVisSprite, projectSprite } from '../../../src/render/spriteProjection.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const SPRITE_PROJECTION_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/render/spriteProjection.ts');
const SPRITE_CLIP_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/render/spriteClip.ts');
const FUZZ_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/render/fuzz.ts');

describe('plan_final render: wire-sprite-renderer', () => {
  test('every read-only sprite-rendering source file exists and is a regular file', () => {
    expect(existsSync(SPRITE_PROJECTION_PATH)).toBe(true);
    expect(statSync(SPRITE_PROJECTION_PATH).isFile()).toBe(true);
    expect(existsSync(SPRITE_CLIP_PATH)).toBe(true);
    expect(statSync(SPRITE_CLIP_PATH).isFile()).toBe(true);
    expect(existsSync(FUZZ_PATH)).toBe(true);
    expect(statSync(FUZZ_PATH).isFile()).toBe(true);
  });

  test('MAXVISSPRITES pins the canonical vanilla 128-vissprite cap', () => {
    expect(MAXVISSPRITES).toBe(128);
  });

  test('MINZ pins the vanilla 4 * FRACUNIT minimum sprite distance', () => {
    expect(MINZ).toBe(4 * 0x1_0000);
  });

  test('FF_FRAMEMASK and FF_FULLBRIGHT pin the sprite-frame flag bits from info.h', () => {
    expect(FF_FRAMEMASK).toBe(0x7fff);
    expect(FF_FULLBRIGHT).toBe(0x8000);
  });

  test('SIL_NONE/BOTTOM/TOP/BOTH pin the vanilla silhouette enum 0..3 from r_segs.c', () => {
    expect(SIL_NONE).toBe(0);
    expect(SIL_BOTTOM).toBe(1);
    expect(SIL_TOP).toBe(2);
    expect(SIL_BOTH).toBe(3);
  });

  test('CLIP_UNSET pins the vanilla sprtopclip/sprbottomclip un-initialized sentinel value of -2', () => {
    expect(CLIP_UNSET).toBe(-2);
  });

  test('FUZZ_TABLE_SIZE and FUZZ_COLORMAP_INDEX pin the vanilla 50-entry fuzz table and colormap index 6 (mid-brightness ramp)', () => {
    expect(FUZZ_TABLE_SIZE).toBe(50);
    expect(FUZZ_COLORMAP_INDEX).toBe(6);
  });

  test('vissprite pool primitives (createVisSpritePool, newVisSprite, clearSprites, projectSprite) are all exported as functions', () => {
    expect(typeof createVisSpritePool).toBe('function');
    expect(typeof newVisSprite).toBe('function');
    expect(typeof clearSprites).toBe('function');
    expect(typeof projectSprite).toBe('function');
  });

  test('fuzz primitives (rDrawFuzzColumn, getFuzzPos, setFuzzPos, resetFuzzPos) are all exported as functions', () => {
    expect(typeof rDrawFuzzColumn).toBe('function');
    expect(typeof getFuzzPos).toBe('function');
    expect(typeof setFuzzPos).toBe('function');
    expect(typeof resetFuzzPos).toBe('function');
  });

  test('createVisSpritePool returns a fresh pool each call (independent state)', () => {
    const firstPool = createVisSpritePool();
    const secondPool = createVisSpritePool();
    expect(firstPool).not.toBe(secondPool);
  });

  test('clearSprites resets the pool back to the empty state', () => {
    const pool = createVisSpritePool();
    clearSprites(pool);
    const sprite = newVisSprite(pool);
    expect(sprite).toBeDefined();
  });

  test('setFuzzPos/getFuzzPos round-trips the fuzz pointer index', () => {
    setFuzzPos(7);
    expect(getFuzzPos()).toBe(7);
    resetFuzzPos();
    expect(getFuzzPos()).toBe(0);
  });

  test('src/render/spriteProjection.ts cites R_ProjectSprite in its top-of-file comment', () => {
    const fileText = readFileSync(SPRITE_PROJECTION_PATH, 'utf8');
    expect(fileText).toContain('R_ProjectSprite');
  });
});
