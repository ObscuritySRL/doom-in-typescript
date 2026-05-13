import { describe, expect, test } from 'bun:test';

import {
  DI_EAST,
  DI_NODIR,
  DI_NORTH,
  DI_NORTHEAST,
  DI_NORTHWEST,
  DI_SOUTH,
  DI_SOUTHEAST,
  DI_SOUTHWEST,
  DI_WEST,
  VANILLA_DIRECTION_ANGLE_SHIFT,
  VANILLA_DIRECTION_COUNT,
  directionToBamAngle,
  oppositeDirection,
} from '../../../src/ai/implement-chase-direction-selection.ts';

describe('vanilla chase direction enum values', () => {
  test('directions match doomdef.h dirtype_t', () => {
    expect(DI_EAST).toBe(0);
    expect(DI_NORTHEAST).toBe(1);
    expect(DI_NORTH).toBe(2);
    expect(DI_NORTHWEST).toBe(3);
    expect(DI_WEST).toBe(4);
    expect(DI_SOUTHWEST).toBe(5);
    expect(DI_SOUTH).toBe(6);
    expect(DI_SOUTHEAST).toBe(7);
    expect(DI_NODIR).toBe(8);
  });

  test('8 cardinal+diagonal directions, angle shift 29', () => {
    expect(VANILLA_DIRECTION_COUNT).toBe(8);
    expect(VANILLA_DIRECTION_ANGLE_SHIFT).toBe(29);
  });
});

describe('directionToBamAngle', () => {
  test('east is 0 BAM', () => {
    expect(directionToBamAngle(DI_EAST)).toBe(0);
  });

  test('north is 2 << 29 = ANG90', () => {
    expect(directionToBamAngle(DI_NORTH)).toBe((2 << 29) | 0);
  });

  test('NODIR returns 0', () => {
    expect(directionToBamAngle(DI_NODIR)).toBe(0);
  });
});

describe('oppositeDirection', () => {
  test('east ↔ west', () => {
    expect(oppositeDirection(DI_EAST)).toBe(DI_WEST);
    expect(oppositeDirection(DI_WEST)).toBe(DI_EAST);
  });

  test('north ↔ south', () => {
    expect(oppositeDirection(DI_NORTH)).toBe(DI_SOUTH);
    expect(oppositeDirection(DI_SOUTH)).toBe(DI_NORTH);
  });

  test('NODIR opposite is NODIR', () => {
    expect(oppositeDirection(DI_NODIR)).toBe(DI_NODIR);
  });
});
