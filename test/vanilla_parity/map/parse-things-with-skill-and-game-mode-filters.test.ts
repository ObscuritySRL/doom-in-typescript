import { describe, expect, test } from 'bun:test';

import { VANILLA_MTF_AMBUSH, VANILLA_MTF_EASY, VANILLA_MTF_HARD, VANILLA_MTF_NORMAL, VANILLA_MTF_NOT_SINGLE, VANILLA_THING_BYTES, parseThingLump, shouldThingSpawn } from '../../../src/map/parse-things-with-skill-and-game-mode-filters.ts';

describe('vanilla THING constants', () => {
  test('thing record is 10 bytes; canonical MTF flag bits', () => {
    expect(VANILLA_THING_BYTES).toBe(10);
    expect(VANILLA_MTF_EASY).toBe(0x0001);
    expect(VANILLA_MTF_NORMAL).toBe(0x0002);
    expect(VANILLA_MTF_HARD).toBe(0x0004);
    expect(VANILLA_MTF_AMBUSH).toBe(0x0008);
    expect(VANILLA_MTF_NOT_SINGLE).toBe(0x0010);
  });
});

describe('parseThingLump', () => {
  test('decodes 10-byte THING records', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x01, 0x00, 0x07, 0x00]);
    const things = parseThingLump(bytes);
    expect(things[0]).toEqual({ x: 0, y: 128, angle: 0, type: 1, flags: 0x0007 });
  });

  test('throws on non-multiple-of-10 input', () => {
    expect(() => parseThingLump(new Uint8Array(9))).toThrow(RangeError);
  });
});

describe('shouldThingSpawn', () => {
  const baseThing = { x: 0, y: 0, angle: 0, type: 1, flags: 0x0007 };

  test('skill 1 spawns when MTF_EASY is set', () => {
    expect(shouldThingSpawn({ thing: baseThing, skill: 1, multiplayer: false })).toBe(true);
  });

  test('skill 2 spawns when MTF_NORMAL is set', () => {
    expect(shouldThingSpawn({ thing: baseThing, skill: 2, multiplayer: false })).toBe(true);
  });

  test('skill 4 spawns when MTF_HARD is set', () => {
    expect(shouldThingSpawn({ thing: baseThing, skill: 4, multiplayer: false })).toBe(true);
  });

  test('MTF_NOT_SINGLE suppresses in single-player', () => {
    const thing = { ...baseThing, flags: VANILLA_MTF_EASY | VANILLA_MTF_NORMAL | VANILLA_MTF_HARD | VANILLA_MTF_NOT_SINGLE };
    expect(shouldThingSpawn({ thing, skill: 2, multiplayer: false })).toBe(false);
    expect(shouldThingSpawn({ thing, skill: 2, multiplayer: true })).toBe(true);
  });

  test('a thing with only MTF_NORMAL does not spawn on skill 1', () => {
    expect(shouldThingSpawn({ thing: { ...baseThing, flags: VANILLA_MTF_NORMAL }, skill: 1, multiplayer: false })).toBe(false);
  });
});
