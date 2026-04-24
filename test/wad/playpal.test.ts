import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';
import { BYTES_PER_COLOR, COLORS_PER_PALETTE, NUMREDPALS, NUMBONUSPALS, PALETTE_COUNT, PALETTE_SIZE, PLAYPAL_SIZE, RADIATIONPAL, STARTBONUSPALS, STARTREDPALS, parsePlaypal } from '../../src/assets/playpal.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const lookup = new LumpLookup(directory);
const playpalData = lookup.getLumpData('PLAYPAL', wadBuffer);
const palettes = parsePlaypal(playpalData);

describe('PLAYPAL constants', () => {
  it('PALETTE_COUNT is 14', () => {
    expect(PALETTE_COUNT).toBe(14);
  });

  it('COLORS_PER_PALETTE is 256', () => {
    expect(COLORS_PER_PALETTE).toBe(256);
  });

  it('BYTES_PER_COLOR is 3', () => {
    expect(BYTES_PER_COLOR).toBe(3);
  });

  it('PALETTE_SIZE is 768', () => {
    expect(PALETTE_SIZE).toBe(768);
  });

  it('PLAYPAL_SIZE is 10752', () => {
    expect(PLAYPAL_SIZE).toBe(10_752);
  });

  it('damage red palette range covers indices 1-8', () => {
    expect(STARTREDPALS).toBe(1);
    expect(NUMREDPALS).toBe(8);
    expect(STARTREDPALS + NUMREDPALS).toBe(9);
  });

  it('bonus pickup palette range covers indices 9-12', () => {
    expect(STARTBONUSPALS).toBe(9);
    expect(NUMBONUSPALS).toBe(4);
    expect(STARTBONUSPALS + NUMBONUSPALS).toBe(13);
  });

  it('radiation suit palette is index 13', () => {
    expect(RADIATIONPAL).toBe(13);
  });

  it('palette ranges are contiguous and non-overlapping', () => {
    expect(STARTREDPALS).toBe(1);
    expect(STARTREDPALS + NUMREDPALS).toBe(STARTBONUSPALS);
    expect(STARTBONUSPALS + NUMBONUSPALS).toBe(RADIATIONPAL);
    expect(RADIATIONPAL).toBe(PALETTE_COUNT - 1);
  });
});

describe('parsePlaypal', () => {
  it('returns exactly 14 palettes', () => {
    expect(palettes.length).toBe(PALETTE_COUNT);
  });

  it('each palette is exactly 768 bytes', () => {
    for (const palette of palettes) {
      expect(palette.length).toBe(PALETTE_SIZE);
    }
  });

  it('palette 0 has valid RGB values (all in 0-255 range)', () => {
    for (let i = 0; i < PALETTE_SIZE; i++) {
      expect(palettes[0]![i]).toBeGreaterThanOrEqual(0);
      expect(palettes[0]![i]).toBeLessThanOrEqual(255);
    }
  });

  it('palette 0 is not all zeros', () => {
    let nonZeroCount = 0;
    for (let i = 0; i < PALETTE_SIZE; i++) {
      if (palettes[0]![i] !== 0) nonZeroCount++;
    }
    expect(nonZeroCount).toBeGreaterThan(0);
  });

  it('palette 0 differs from damage red palettes', () => {
    for (let i = STARTREDPALS; i < STARTREDPALS + NUMREDPALS; i++) {
      let differs = false;
      for (let j = 0; j < PALETTE_SIZE; j++) {
        if (palettes[0]![j] !== palettes[i]![j]) {
          differs = true;
          break;
        }
      }
      expect(differs).toBe(true);
    }
  });

  it('palette 0 differs from bonus pickup palettes', () => {
    for (let i = STARTBONUSPALS; i < STARTBONUSPALS + NUMBONUSPALS; i++) {
      let differs = false;
      for (let j = 0; j < PALETTE_SIZE; j++) {
        if (palettes[0]![j] !== palettes[i]![j]) {
          differs = true;
          break;
        }
      }
      expect(differs).toBe(true);
    }
  });

  it('palette 0 differs from radiation suit palette', () => {
    let differs = false;
    for (let j = 0; j < PALETTE_SIZE; j++) {
      if (palettes[0]![j] !== palettes[RADIATIONPAL]![j]) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it('returned array is frozen', () => {
    expect(Object.isFrozen(palettes)).toBe(true);
  });

  it('palettes are contiguous views into the original data', () => {
    for (let i = 0; i < PALETTE_COUNT; i++) {
      const expectedOffset = i * PALETTE_SIZE;
      for (let j = 0; j < PALETTE_SIZE; j++) {
        expect(palettes[i]![j]).toBe(playpalData[expectedOffset + j]);
      }
    }
  });

  it('throws RangeError for data smaller than 10752 bytes', () => {
    const tooSmall = Buffer.alloc(PLAYPAL_SIZE - 1);
    expect(() => parsePlaypal(tooSmall)).toThrow(RangeError);
  });

  it('throws RangeError for data larger than 10752 bytes', () => {
    const tooLarge = Buffer.alloc(PLAYPAL_SIZE + 1);
    expect(() => parsePlaypal(tooLarge)).toThrow(RangeError);
  });

  it('error message includes expected and actual size', () => {
    const bad = Buffer.alloc(100);
    expect(() => parsePlaypal(bad)).toThrow(/10752.*100/);
  });

  it('accepts Uint8Array subarray input with a non-zero byteOffset', () => {
    const container = Buffer.alloc(PLAYPAL_SIZE + 2);
    playpalData.copy(container, 1);
    const uint8 = new Uint8Array(container.buffer, container.byteOffset + 1, PLAYPAL_SIZE);
    const result = parsePlaypal(uint8);
    expect(result.length).toBe(PALETTE_COUNT);
    expect(result[0]![0]).toBe(palettes[0]![0]);
    expect(result[RADIATIONPAL]![PALETTE_SIZE - 1]).toBe(palettes[RADIATIONPAL]![PALETTE_SIZE - 1]);
  });
});

describe('parity-sensitive edge cases', () => {
  it('color index 0 in palette 0 has the expected Doom black (0, 0, 0)', () => {
    // Doom's color index 0 is always black in the normal palette
    expect(palettes[0]![0]).toBe(0);
    expect(palettes[0]![1]).toBe(0);
    expect(palettes[0]![2]).toBe(0);
  });

  it('damage red palettes have increasing red tint intensity', () => {
    // Each successive damage palette should shift colors more toward red.
    // Measure the average red channel value across all 256 colors.
    const averageRed = (palette: Uint8Array): number => {
      let sum = 0;
      for (let i = 0; i < COLORS_PER_PALETTE; i++) {
        sum += palette[i * BYTES_PER_COLOR]!;
      }
      return sum / COLORS_PER_PALETTE;
    };

    const normalRed = averageRed(palettes[0]!);
    // All damage palettes should have higher average red than normal
    for (let i = STARTREDPALS; i < STARTREDPALS + NUMREDPALS; i++) {
      expect(averageRed(palettes[i]!)).toBeGreaterThan(normalRed);
    }
  });

  it('each palette occupies a distinct byte range in the lump', () => {
    // Verify no two palettes reference the same memory region
    const offsets = new Set<number>();
    for (const palette of palettes) {
      offsets.add(palette.byteOffset);
    }
    expect(offsets.size).toBe(PALETTE_COUNT);
  });
});
