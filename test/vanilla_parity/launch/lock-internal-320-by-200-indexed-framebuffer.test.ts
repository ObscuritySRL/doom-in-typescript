import { describe, expect, test } from 'bun:test';

import {
  LOCKED_BOTTOM_RIGHT_PIXEL_BYTE_OFFSET,
  LOCKED_INTERNAL_FRAMEBUFFER_BITS_PER_PIXEL,
  LOCKED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL,
  LOCKED_INTERNAL_FRAMEBUFFER_HEIGHT,
  LOCKED_INTERNAL_FRAMEBUFFER_ROW_STRIDE_BYTES,
  LOCKED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES_PER_SLOT,
  LOCKED_INTERNAL_FRAMEBUFFER_WIDTH,
  LOCKED_I_INIT_GRAPHICS_ALIAS_C_SYMBOL,
  LOCKED_TOP_LEFT_PIXEL_BYTE_OFFSET,
  LOCKED_VANILLA_FRAMEBUFFER_BYTE_TYPEDEF,
  LOCKED_VANILLA_FRAMEBUFFER_C_ELEMENT_TYPE,
  LOCKED_VANILLA_I_INIT_GRAPHICS_C_SYMBOL,
  LOCKED_VANILLA_ROW_WALKER_C_SYMBOL,
  LOCKED_VANILLA_SCREENS_SLOT_COUNT,
  LOCKED_VANILLA_VISIBLE_FRAMEBUFFER_SCREENS_INDEX,
  LOCKED_VANILLA_V_INIT_C_SYMBOL,
  LOCKED_V_INIT_ALLOC_SYMBOL,
  LOCKED_V_INIT_CONTIGUOUS_ALLOCATION_BYTES,
  LOCKED_X11_IMAGE_BITMAP_PAD,
  LOCKED_X11_IMAGE_BYTES_PER_LINE_NON_SHM,
  LOCKED_X11_IMAGE_DEPTH_BITS,
  LOCKED_X11_IMAGE_FORMAT_SYMBOL,
  REFERENCE_VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_HANDLER,
  VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_DERIVED_INVARIANTS,
  VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_DERIVED_INVARIANT_COUNT,
  VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK,
  VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK_CLAUSE_COUNT,
  VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES,
  VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBE_COUNT,
  VANILLA_PERFORMS_PER_FRAME_MEMCPY_ON_MULTIPLY_ONE,
  VANILLA_PREPENDS_FRAMEBUFFER_HEADER,
  VANILLA_REQUIRES_ROW_ALIGNMENT,
  VANILLA_RESERVES_ALPHA_CHANNEL,
  VANILLA_USES_BOTTOM_UP_SCANLINE_ORDER,
  VANILLA_USES_COLUMN_MAJOR_PIXEL_LAYOUT,
  VANILLA_USES_ROW_PADDING,
  VANILLA_USES_SIXTEEN_BIT_FRAMEBUFFER_ELEMENT,
  VANILLA_USES_THIRTY_TWO_BIT_FRAMEBUFFER_ELEMENT,
  crossCheckVanillaInternal320By200IndexedFramebuffer,
  deriveExpectedVanillaInternal320By200IndexedFramebufferResult,
} from '../../../src/bootstrap/lock-internal-320-by-200-indexed-framebuffer.ts';
import type { VanillaInternal320By200IndexedFramebufferHandler, VanillaInternal320By200IndexedFramebufferProbe, VanillaInternal320By200IndexedFramebufferResult } from '../../../src/bootstrap/lock-internal-320-by-200-indexed-framebuffer.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../../src/host/windowPolicy.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-014-lock-internal-320-by-200-indexed-framebuffer.md';

describe('LOCKED canonical constants', () => {
  test('locked internal framebuffer width is 320 and equals src/host/windowPolicy.ts SCREENWIDTH', () => {
    expect(LOCKED_INTERNAL_FRAMEBUFFER_WIDTH).toBe(320);
    expect(LOCKED_INTERNAL_FRAMEBUFFER_WIDTH).toBe(SCREENWIDTH);
  });

  test('locked internal framebuffer height is 200 and equals src/host/windowPolicy.ts SCREENHEIGHT', () => {
    expect(LOCKED_INTERNAL_FRAMEBUFFER_HEIGHT).toBe(200);
    expect(LOCKED_INTERNAL_FRAMEBUFFER_HEIGHT).toBe(SCREENHEIGHT);
  });

  test('locked bytes-per-pixel is 1 and bits-per-pixel is 8 with mutually consistent encoding', () => {
    expect(LOCKED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL).toBe(1);
    expect(LOCKED_INTERNAL_FRAMEBUFFER_BITS_PER_PIXEL).toBe(8);
    expect(LOCKED_INTERNAL_FRAMEBUFFER_BITS_PER_PIXEL).toBe(LOCKED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL * 8);
  });

  test('locked row stride equals SCREENWIDTH (320 bytes) with no padding', () => {
    expect(LOCKED_INTERNAL_FRAMEBUFFER_ROW_STRIDE_BYTES).toBe(320);
    expect(LOCKED_INTERNAL_FRAMEBUFFER_ROW_STRIDE_BYTES).toBe(LOCKED_INTERNAL_FRAMEBUFFER_WIDTH * LOCKED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL);
  });

  test('locked total bytes per slot equals width * height * bytes-per-pixel = 64000', () => {
    expect(LOCKED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES_PER_SLOT).toBe(64_000);
    expect(LOCKED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES_PER_SLOT).toBe(LOCKED_INTERNAL_FRAMEBUFFER_WIDTH * LOCKED_INTERNAL_FRAMEBUFFER_HEIGHT * LOCKED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL);
  });

  test('locked V_Init contiguous allocation equals total-bytes-per-slot * screens-slot-count = 256000', () => {
    expect(LOCKED_V_INIT_CONTIGUOUS_ALLOCATION_BYTES).toBe(256_000);
    expect(LOCKED_V_INIT_CONTIGUOUS_ALLOCATION_BYTES).toBe(LOCKED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES_PER_SLOT * LOCKED_VANILLA_SCREENS_SLOT_COUNT);
  });

  test('locked screens slot count is 4 with the visible framebuffer at index 0', () => {
    expect(LOCKED_VANILLA_SCREENS_SLOT_COUNT).toBe(4);
    expect(LOCKED_VANILLA_VISIBLE_FRAMEBUFFER_SCREENS_INDEX).toBe(0);
  });

  test('locked top-left pixel byte offset is 0 and bottom-right pixel byte offset is 63999', () => {
    expect(LOCKED_TOP_LEFT_PIXEL_BYTE_OFFSET).toBe(0);
    expect(LOCKED_BOTTOM_RIGHT_PIXEL_BYTE_OFFSET).toBe(63_999);
    expect(LOCKED_BOTTOM_RIGHT_PIXEL_BYTE_OFFSET).toBe(LOCKED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES_PER_SLOT - 1);
    expect(LOCKED_BOTTOM_RIGHT_PIXEL_BYTE_OFFSET).toBe(199 * LOCKED_INTERNAL_FRAMEBUFFER_WIDTH + 319);
  });

  test('locked X11 image depth is 8 bits and format is ZPixmap', () => {
    expect(LOCKED_X11_IMAGE_DEPTH_BITS).toBe(8);
    expect(LOCKED_X11_IMAGE_FORMAT_SYMBOL).toBe('ZPixmap');
  });

  test('locked X11 non-SHM bytes_per_line is SCREENWIDTH and bitmap_pad is 8 bits', () => {
    expect(LOCKED_X11_IMAGE_BYTES_PER_LINE_NON_SHM).toBe(320);
    expect(LOCKED_X11_IMAGE_BYTES_PER_LINE_NON_SHM).toBe(LOCKED_INTERNAL_FRAMEBUFFER_WIDTH);
    expect(LOCKED_X11_IMAGE_BITMAP_PAD).toBe(8);
  });

  test('locked C element type is "unsigned char" and byte typedef is "byte"', () => {
    expect(LOCKED_VANILLA_FRAMEBUFFER_C_ELEMENT_TYPE).toBe('unsigned char');
    expect(LOCKED_VANILLA_FRAMEBUFFER_BYTE_TYPEDEF).toBe('byte');
  });

  test('locked V_Init alloc symbol is "I_AllocLow" and I_InitGraphics alias symbol is "image->data"', () => {
    expect(LOCKED_V_INIT_ALLOC_SYMBOL).toBe('I_AllocLow');
    expect(LOCKED_I_INIT_GRAPHICS_ALIAS_C_SYMBOL).toBe('image->data');
  });

  test('locked vanilla C symbols cite I_InitGraphics, V_Init, and V_DrawPatch', () => {
    expect(LOCKED_VANILLA_I_INIT_GRAPHICS_C_SYMBOL).toBe('I_InitGraphics');
    expect(LOCKED_VANILLA_V_INIT_C_SYMBOL).toBe('V_Init');
    expect(LOCKED_VANILLA_ROW_WALKER_C_SYMBOL).toBe('V_DrawPatch');
  });

  test('locked vanilla negative-fact constants are all false (vanilla does NOT do these things)', () => {
    expect(VANILLA_USES_ROW_PADDING).toBe(false);
    expect(VANILLA_REQUIRES_ROW_ALIGNMENT).toBe(false);
    expect(VANILLA_USES_COLUMN_MAJOR_PIXEL_LAYOUT).toBe(false);
    expect(VANILLA_USES_BOTTOM_UP_SCANLINE_ORDER).toBe(false);
    expect(VANILLA_PERFORMS_PER_FRAME_MEMCPY_ON_MULTIPLY_ONE).toBe(false);
    expect(VANILLA_PREPENDS_FRAMEBUFFER_HEADER).toBe(false);
    expect(VANILLA_RESERVES_ALPHA_CHANNEL).toBe(false);
    expect(VANILLA_USES_SIXTEEN_BIT_FRAMEBUFFER_ELEMENT).toBe(false);
    expect(VANILLA_USES_THIRTY_TWO_BIT_FRAMEBUFFER_ELEMENT).toBe(false);
  });
});

describe('lock clause ledger shape', () => {
  test('declared clause count equals VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK_CLAUSE_COUNT', () => {
    expect(VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.length).toBe(VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK_CLAUSE_COUNT);
    expect(VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK_CLAUSE_COUNT).toBe(32);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.map((entry) => entry.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('every clause cites a real linuxdoom-1.10 source file', () => {
    const validFiles = new Set(['i_video.c', 'v_video.c']);
    for (const entry of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK) {
      expect(validFiles.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every clause cites a canonical C symbol from the lock landscape', () => {
    const validSymbols = new Set(['I_InitGraphics', 'V_Init', 'V_DrawPatch', 'I_AllocLow']);
    for (const entry of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK) {
      expect(validSymbols.has(entry.cSymbol)).toBe(true);
    }
  });

  test('every clause has a non-empty plain-language invariant description', () => {
    for (const entry of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });
});

describe('lock clause ledger values', () => {
  test('WIDTH_LOCKED_AT_320 cites I_InitGraphics in i_video.c with SCREENWIDTH context', () => {
    const clause = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.find((entry) => entry.id === 'WIDTH_LOCKED_AT_320');
    expect(clause).toBeDefined();
    expect(clause?.referenceSourceFile).toBe('i_video.c');
    expect(clause?.cSymbol).toBe('I_InitGraphics');
    expect(clause?.invariant).toContain('320');
    expect(clause?.invariant).toContain('SCREENWIDTH');
  });

  test('HEIGHT_LOCKED_AT_200 cites I_InitGraphics in i_video.c with SCREENHEIGHT context', () => {
    const clause = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.find((entry) => entry.id === 'HEIGHT_LOCKED_AT_200');
    expect(clause).toBeDefined();
    expect(clause?.referenceSourceFile).toBe('i_video.c');
    expect(clause?.cSymbol).toBe('I_InitGraphics');
    expect(clause?.invariant).toContain('200');
    expect(clause?.invariant).toContain('SCREENHEIGHT');
  });

  test('ROW_STRIDE_LOCKED_AT_SCREENWIDTH cites V_DrawPatch row-walk with `dest += SCREENWIDTH`', () => {
    const clause = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.find((entry) => entry.id === 'ROW_STRIDE_LOCKED_AT_SCREENWIDTH');
    expect(clause).toBeDefined();
    expect(clause?.referenceSourceFile).toBe('v_video.c');
    expect(clause?.cSymbol).toBe('V_DrawPatch');
    expect(clause?.invariant).toContain('dest += SCREENWIDTH');
    expect(clause?.invariant).toContain('320');
  });

  test('V_INIT_CONTIGUOUS_ALLOCATION_LOCKED_AT_FOUR_TIMES_SLOT_BYTES cites the I_AllocLow base block', () => {
    const clause = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.find((entry) => entry.id === 'V_INIT_CONTIGUOUS_ALLOCATION_LOCKED_AT_FOUR_TIMES_SLOT_BYTES');
    expect(clause).toBeDefined();
    expect(clause?.referenceSourceFile).toBe('v_video.c');
    expect(clause?.cSymbol).toBe('V_Init');
    expect(clause?.invariant).toContain('I_AllocLow');
    expect(clause?.invariant).toContain('SCREENWIDTH*SCREENHEIGHT*4');
    expect(clause?.invariant).toContain('256000');
  });

  test('V_INIT_BASE_POINTER_SLICED_INTO_FOUR_SCREENS cites the slicing loop with verbatim line numbers', () => {
    const clause = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.find((entry) => entry.id === 'V_INIT_BASE_POINTER_SLICED_INTO_FOUR_SCREENS');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('screens[i] = base + i*SCREENWIDTH*SCREENHEIGHT');
    expect(clause?.invariant).toContain('64000');
    expect(clause?.invariant).toContain('128000');
    expect(clause?.invariant).toContain('192000');
  });

  test('SCREENS_ZERO_DIRECT_ALIAS_TO_IMAGE_DATA_AT_MULTIPLY_ONE cites the verbatim cast in i_video.c line 730', () => {
    const clause = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.find((entry) => entry.id === 'SCREENS_ZERO_DIRECT_ALIAS_TO_IMAGE_DATA_AT_MULTIPLY_ONE');
    expect(clause).toBeDefined();
    expect(clause?.referenceSourceFile).toBe('i_video.c');
    expect(clause?.cSymbol).toBe('I_InitGraphics');
    expect(clause?.invariant).toContain('multiply == 1');
    expect(clause?.invariant).toContain('image->data');
    expect(clause?.invariant).toContain('(unsigned char *)');
  });

  test('X11_IMAGE_DEPTH_LOCKED_AT_EIGHT_BITS cites both XShmCreateImage and XCreateImage', () => {
    const clause = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.find((entry) => entry.id === 'X11_IMAGE_DEPTH_LOCKED_AT_EIGHT_BITS');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('XShmCreateImage');
    expect(clause?.invariant).toContain('XCreateImage');
    expect(clause?.invariant).toContain('depth=8');
  });

  test('X11_IMAGE_FORMAT_LOCKED_AT_ZPIXMAP cites the ZPixmap format from Xlib.h', () => {
    const clause = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.find((entry) => entry.id === 'X11_IMAGE_FORMAT_LOCKED_AT_ZPIXMAP');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('ZPixmap');
    expect(clause?.invariant).toContain('XYBitmap');
    expect(clause?.invariant).toContain('XYPixmap');
  });

  test('PIXEL_OFFSET_FORMULA_IS_Y_TIMES_WIDTH_PLUS_X cites the row-major scanline formula', () => {
    const clause = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.find((entry) => entry.id === 'PIXEL_OFFSET_FORMULA_IS_Y_TIMES_WIDTH_PLUS_X');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('y * SCREENWIDTH + x');
    expect(clause?.invariant).toContain('column-major');
  });

  test('FRAMEBUFFER_C_ELEMENT_TYPE_IS_UNSIGNED_CHAR cites the doomtype.h byte typedef', () => {
    const clause = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.find((entry) => entry.id === 'FRAMEBUFFER_C_ELEMENT_TYPE_IS_UNSIGNED_CHAR');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('doomtype.h');
    expect(clause?.invariant).toContain('typedef unsigned char byte');
    expect(clause?.invariant).toContain('signed char');
  });

  test('NO_THIRTY_TWO_BIT_FRAMEBUFFER_ELEMENT cites the Chocolate argbbuffer counterexample', () => {
    const clause = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK.find((entry) => entry.id === 'NO_THIRTY_TWO_BIT_FRAMEBUFFER_ELEMENT');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('argbbuffer');
    expect(clause?.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('every clause that cites I_InitGraphics references i_video.c', () => {
    for (const entry of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK) {
      if (entry.cSymbol === 'I_InitGraphics') {
        expect(entry.referenceSourceFile).toBe('i_video.c');
      }
    }
  });

  test('every clause that cites V_Init or V_DrawPatch references v_video.c', () => {
    for (const entry of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK) {
      if (entry.cSymbol === 'V_Init' || entry.cSymbol === 'V_DrawPatch') {
        expect(entry.referenceSourceFile).toBe('v_video.c');
      }
    }
  });
});

describe('derived invariants ledger', () => {
  test('declared invariant count equals VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_DERIVED_INVARIANT_COUNT', () => {
    expect(VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_DERIVED_INVARIANTS.length).toBe(VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_DERIVED_INVARIANT_COUNT);
    expect(VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_DERIVED_INVARIANT_COUNT).toBe(12);
  });

  test('every derived invariant id is unique', () => {
    const ids = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_DERIVED_INVARIANTS.map((entry) => entry.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('every derived invariant has a non-empty description', () => {
    for (const entry of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_DERIVED_INVARIANTS) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe('probe ledger shape', () => {
  test('declared probe count equals VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBE_COUNT', () => {
    expect(VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES.length).toBe(VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBE_COUNT);
    expect(VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBE_COUNT).toBe(37);
  });

  test('every probe id is unique', () => {
    const ids = VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES.map((probe) => probe.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('every probe witness invariant id matches a declared derived invariant', () => {
    const validInvariants = new Set(VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_DERIVED_INVARIANTS.map((entry) => entry.id));
    for (const probe of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES) {
      expect(validInvariants.has(probe.witnessInvariantId)).toBe(true);
    }
  });

  test('every probe has a non-empty description', () => {
    for (const probe of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES) {
      expect(probe.description.length).toBeGreaterThan(0);
    }
  });

  test('every probe has exactly one of expectedAnsweredNumber, expectedAnsweredString, or expectedAnsweredBoolean populated (the others null)', () => {
    for (const probe of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES) {
      const numericPopulated = probe.expectedAnsweredNumber !== null;
      const stringPopulated = probe.expectedAnsweredString !== null;
      const booleanPopulated = probe.expectedAnsweredBoolean !== null;
      const populatedCount = (numericPopulated ? 1 : 0) + (stringPopulated ? 1 : 0) + (booleanPopulated ? 1 : 0);
      expect(populatedCount).toBe(1);
    }
  });

  test('numeric query kinds populate expectedAnsweredNumber and not the others', () => {
    const numericQueryKinds = new Set([
      'framebuffer-width',
      'framebuffer-height',
      'framebuffer-bytes-per-pixel',
      'framebuffer-bits-per-pixel',
      'framebuffer-row-stride-bytes',
      'framebuffer-total-bytes-per-slot',
      'v-init-contiguous-allocation-bytes',
      'v-init-screens-slot-count',
      'visible-framebuffer-screens-index',
      'top-left-pixel-byte-offset',
      'bottom-right-pixel-byte-offset',
      'pixel-byte-offset-for-coordinate',
      'screens-slot-base-byte-offset',
      'x11-image-depth-bits',
      'x11-non-shm-bytes-per-line',
      'x11-non-shm-bitmap-pad',
    ]);
    for (const probe of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES) {
      if (numericQueryKinds.has(probe.queryKind)) {
        expect(probe.expectedAnsweredNumber).not.toBeNull();
        expect(probe.expectedAnsweredString).toBeNull();
        expect(probe.expectedAnsweredBoolean).toBeNull();
      }
    }
  });

  test('string query kinds populate expectedAnsweredString and not the others', () => {
    const stringQueryKinds = new Set(['x11-image-format-symbol', 'framebuffer-c-element-type', 'framebuffer-byte-typedef', 'v-init-alloc-symbol', 'i-init-graphics-alias-c-symbol']);
    for (const probe of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES) {
      if (stringQueryKinds.has(probe.queryKind)) {
        expect(probe.expectedAnsweredString).not.toBeNull();
        expect(probe.expectedAnsweredNumber).toBeNull();
        expect(probe.expectedAnsweredBoolean).toBeNull();
      }
    }
  });

  test('boolean query kinds populate expectedAnsweredBoolean and not the others', () => {
    const booleanQueryKinds = new Set([
      'vanilla-uses-row-padding',
      'vanilla-requires-row-alignment',
      'vanilla-uses-column-major-layout',
      'vanilla-uses-bottom-up-scanline-order',
      'vanilla-performs-per-frame-memcpy-multiply-one',
      'vanilla-prepends-framebuffer-header',
      'vanilla-reserves-alpha-channel',
      'vanilla-uses-sixteen-bit-element',
      'vanilla-uses-thirty-two-bit-element',
    ]);
    for (const probe of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES) {
      if (booleanQueryKinds.has(probe.queryKind)) {
        expect(probe.expectedAnsweredBoolean).not.toBeNull();
        expect(probe.expectedAnsweredNumber).toBeNull();
        expect(probe.expectedAnsweredString).toBeNull();
      }
    }
  });

  test('pixel-byte-offset-for-coordinate probes populate queryX and queryY', () => {
    for (const probe of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES) {
      if (probe.queryKind === 'pixel-byte-offset-for-coordinate') {
        expect(probe.queryX).not.toBeNull();
        expect(probe.queryY).not.toBeNull();
        expect(probe.querySlotIndex).toBeNull();
      }
    }
  });

  test('screens-slot-base-byte-offset probes populate querySlotIndex', () => {
    for (const probe of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES) {
      if (probe.queryKind === 'screens-slot-base-byte-offset') {
        expect(probe.querySlotIndex).not.toBeNull();
        expect(probe.queryX).toBeNull();
        expect(probe.queryY).toBeNull();
      }
    }
  });
});

describe('reference handler', () => {
  test('reference handler answers every probe correctly', () => {
    for (const probe of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES) {
      const result = REFERENCE_VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_HANDLER.evaluate(probe);
      expect(result.probeId).toBe(probe.id);
      expect(result.answeredNumber).toBe(probe.expectedAnsweredNumber);
      expect(result.answeredString).toBe(probe.expectedAnsweredString);
      expect(result.answeredBoolean).toBe(probe.expectedAnsweredBoolean);
    }
  });

  test('reference handler row-major formula matches y*SCREENWIDTH+x for an arbitrary probe', () => {
    const arbitraryProbe: VanillaInternal320By200IndexedFramebufferProbe = {
      id: 'arbitrary-pixel-offset-200-100',
      description: 'Pixel (200, 100) byte offset.',
      queryKind: 'pixel-byte-offset-for-coordinate',
      queryX: 200,
      queryY: 100,
      querySlotIndex: null,
      expectedAnsweredNumber: 100 * 320 + 200,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
    };
    const result = REFERENCE_VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_HANDLER.evaluate(arbitraryProbe);
    expect(result.answeredNumber).toBe(100 * 320 + 200);
    expect(result.answeredNumber).toBe(32_200);
  });

  test('reference handler returns null for an out-of-range pixel coordinate', () => {
    const outOfRangeProbe: VanillaInternal320By200IndexedFramebufferProbe = {
      id: 'oob-coord-320-0',
      description: 'X=320 (out of range).',
      queryKind: 'pixel-byte-offset-for-coordinate',
      queryX: 320,
      queryY: 0,
      querySlotIndex: null,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
    };
    const result = REFERENCE_VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_HANDLER.evaluate(outOfRangeProbe);
    expect(result.answeredNumber).toBeNull();
  });

  test('reference handler returns null for an out-of-range screens slot index', () => {
    const outOfRangeProbe: VanillaInternal320By200IndexedFramebufferProbe = {
      id: 'oob-slot-4',
      description: 'screens[4] (out of range — only 0..3 are valid).',
      queryKind: 'screens-slot-base-byte-offset',
      queryX: null,
      queryY: null,
      querySlotIndex: 4,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'V_INIT_CONTIGUOUS_FOUR_SLOT_ALLOCATION',
    };
    const result = REFERENCE_VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_HANDLER.evaluate(outOfRangeProbe);
    expect(result.answeredNumber).toBeNull();
  });
});

describe('cross-checker passes on the reference handler', () => {
  test('crossCheckVanillaInternal320By200IndexedFramebuffer reports zero failures on the reference handler', () => {
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(REFERENCE_VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_HANDLER);
    expect(failures).toEqual([]);
  });
});

function tamperedHandler(
  transform: (probe: VanillaInternal320By200IndexedFramebufferProbe, result: VanillaInternal320By200IndexedFramebufferResult) => VanillaInternal320By200IndexedFramebufferResult,
): VanillaInternal320By200IndexedFramebufferHandler {
  return Object.freeze({
    evaluate(probe: VanillaInternal320By200IndexedFramebufferProbe): VanillaInternal320By200IndexedFramebufferResult {
      const result = REFERENCE_VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_HANDLER.evaluate(probe);
      return transform(probe, result);
    },
  });
}

describe('cross-checker detects tampered candidates', () => {
  test('detects width drift to 640 (handler reports framebuffer-width = 640)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'framebuffer-width' ? { ...result, answeredNumber: 640 } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('framebuffer-width-is-320:answered-number-mismatch');
  });

  test('detects height drift to 240 (handler reports framebuffer-height = 240, BMP-style)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'framebuffer-height' ? { ...result, answeredNumber: 240 } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('framebuffer-height-is-200:answered-number-mismatch');
  });

  test('detects bytes-per-pixel drift to 4 (handler reports 32-bit ARGB framebuffer)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'framebuffer-bytes-per-pixel' ? { ...result, answeredNumber: 4 } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('framebuffer-bytes-per-pixel-is-one:answered-number-mismatch');
  });

  test('detects bits-per-pixel drift to 16 (handler reports 5-6-5 packed RGB framebuffer)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'framebuffer-bits-per-pixel' ? { ...result, answeredNumber: 16 } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('framebuffer-bits-per-pixel-is-eight:answered-number-mismatch');
  });

  test('detects row-stride drift to 384 bytes (handler imposes 64-byte row alignment)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'framebuffer-row-stride-bytes' ? { ...result, answeredNumber: 384 } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('framebuffer-row-stride-is-320:answered-number-mismatch');
  });

  test('detects total-bytes-per-slot drift to 76800 bytes (handler reports 320*240 = 76800)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'framebuffer-total-bytes-per-slot' ? { ...result, answeredNumber: 76_800 } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('framebuffer-total-bytes-per-slot-is-64000:answered-number-mismatch');
  });

  test('detects V_Init contiguous allocation drift to 64000 (handler does only one-slot allocation)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'v-init-contiguous-allocation-bytes' ? { ...result, answeredNumber: 64_000 } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('v-init-contiguous-allocation-is-256000:answered-number-mismatch');
  });

  test('detects screens slot count drift to 5 (handler reports 5 slots, including the spurious extension declared in v_video.h)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'v-init-screens-slot-count' ? { ...result, answeredNumber: 5 } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('v-init-screens-slot-count-is-four:answered-number-mismatch');
  });

  test('detects visible framebuffer slot drift from 0 to 3 (handler reports back buffer is at index 3)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'visible-framebuffer-screens-index' ? { ...result, answeredNumber: 3 } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('visible-framebuffer-screens-index-is-zero:answered-number-mismatch');
  });

  test('detects bottom-right pixel offset drift (handler uses 199*240+319 = aspect-corrected-height row stride)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'bottom-right-pixel-byte-offset' ? { ...result, answeredNumber: 199 * 240 + 319 } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('bottom-right-pixel-byte-offset-is-63999:answered-number-mismatch');
  });

  test('detects pixel offset formula drift to column-major (handler returns x*SCREENHEIGHT+y for pixel (1,0))', () => {
    const tampered = tamperedHandler((probe, result) => {
      if (probe.queryKind === 'pixel-byte-offset-for-coordinate' && probe.queryX === 1 && probe.queryY === 0) {
        return { ...result, answeredNumber: 1 * 200 + 0 };
      }
      return result;
    });
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('pixel-byte-offset-one-zero-is-one:answered-number-mismatch');
  });

  test('detects screens slot base offset drift (handler uses non-contiguous per-slot allocation with offset 0 for every slot)', () => {
    const tampered = tamperedHandler((probe, result) => {
      if (probe.queryKind === 'screens-slot-base-byte-offset' && probe.querySlotIndex === 1) {
        return { ...result, answeredNumber: 0 };
      }
      return result;
    });
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('screens-slot-one-base-offset-is-64000:answered-number-mismatch');
  });

  test('detects X11 image depth drift from 8 to 24 bits (handler uses TrueColor visual)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'x11-image-depth-bits' ? { ...result, answeredNumber: 24 } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('x11-image-depth-is-eight-bits:answered-number-mismatch');
  });

  test('detects X11 image format drift from ZPixmap to XYPixmap (handler uses planar format)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'x11-image-format-symbol' ? { ...result, answeredString: 'XYPixmap' } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('x11-image-format-is-zpixmap:answered-string-mismatch');
  });

  test('detects framebuffer C element type drift from "unsigned char" to "signed char" (signedness violation)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'framebuffer-c-element-type' ? { ...result, answeredString: 'signed char' } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('framebuffer-c-element-type-is-unsigned-char:answered-string-mismatch');
  });

  test('detects byte typedef drift from "byte" to "uint8_t" (handler uses C99 typedef)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'framebuffer-byte-typedef' ? { ...result, answeredString: 'uint8_t' } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('framebuffer-byte-typedef-is-byte:answered-string-mismatch');
  });

  test('detects V_Init alloc symbol drift from "I_AllocLow" to "Z_Malloc" (handler uses zone allocator instead of low memory)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'v-init-alloc-symbol' ? { ...result, answeredString: 'Z_Malloc' } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('v-init-alloc-symbol-is-i-alloclow:answered-string-mismatch');
  });

  test('detects I_InitGraphics alias symbol drift from "image->data" to "image->obdata"', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'i-init-graphics-alias-c-symbol' ? { ...result, answeredString: 'image->obdata' } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('i-init-graphics-alias-c-symbol-is-image-data:answered-string-mismatch');
  });

  test('detects vanilla-uses-row-padding flipped to true (handler reports vanilla pads each scanline)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-uses-row-padding' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('vanilla-uses-row-padding-is-false:answered-boolean-mismatch');
  });

  test('detects vanilla-uses-bottom-up-scanline-order flipped to true (handler reports BMP-style storage)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-uses-bottom-up-scanline-order' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('vanilla-uses-bottom-up-scanline-order-is-false:answered-boolean-mismatch');
  });

  test('detects vanilla-performs-per-frame-memcpy-multiply-one flipped to true (handler memcpy on multiply==1 path)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-performs-per-frame-memcpy-multiply-one' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('vanilla-performs-per-frame-memcpy-multiply-one-is-false:answered-boolean-mismatch');
  });

  test('detects vanilla-uses-thirty-two-bit-element flipped to true (handler reports uint32_t framebuffer)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-uses-thirty-two-bit-element' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('vanilla-uses-thirty-two-bit-element-is-false:answered-boolean-mismatch');
  });

  test('detects probe-id-mismatch when handler returns wrong probeId', () => {
    const tampered: VanillaInternal320By200IndexedFramebufferHandler = Object.freeze({
      evaluate(probe: VanillaInternal320By200IndexedFramebufferProbe): VanillaInternal320By200IndexedFramebufferResult {
        const result = REFERENCE_VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_HANDLER.evaluate(probe);
        if (probe.id === 'framebuffer-width-is-320') {
          return { ...result, probeId: 'wrong-probe-id' };
        }
        return result;
      },
    });
    const failures = crossCheckVanillaInternal320By200IndexedFramebuffer(tampered);
    expect(failures).toContain('framebuffer-width-is-320:probe-id-mismatch');
  });
});

describe('deriveExpectedVanillaInternal320By200IndexedFramebufferResult helper', () => {
  test('matches the reference handler answer for every pinned probe', () => {
    for (const probe of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES) {
      const derived = deriveExpectedVanillaInternal320By200IndexedFramebufferResult(probe);
      const reference = REFERENCE_VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_HANDLER.evaluate(probe);
      expect(derived.answeredNumber).toBe(reference.answeredNumber);
      expect(derived.answeredString).toBe(reference.answeredString);
      expect(derived.answeredBoolean).toBe(reference.answeredBoolean);
      expect(derived.probeId).toBe(reference.probeId);
    }
  });

  test('returns null answeredNumber for a pixel coordinate at x=-1', () => {
    const negativeProbe: VanillaInternal320By200IndexedFramebufferProbe = {
      id: 'negative-x-coord',
      description: 'X=-1.',
      queryKind: 'pixel-byte-offset-for-coordinate',
      queryX: -1,
      queryY: 0,
      querySlotIndex: null,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
    };
    const result = deriveExpectedVanillaInternal320By200IndexedFramebufferResult(negativeProbe);
    expect(result.answeredNumber).toBeNull();
  });

  test('returns null answeredNumber for a pixel coordinate at y=200 (out of range)', () => {
    const yOutOfRange: VanillaInternal320By200IndexedFramebufferProbe = {
      id: 'y-out-of-range',
      description: 'Y=200.',
      queryKind: 'pixel-byte-offset-for-coordinate',
      queryX: 0,
      queryY: 200,
      querySlotIndex: null,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
    };
    const result = deriveExpectedVanillaInternal320By200IndexedFramebufferResult(yOutOfRange);
    expect(result.answeredNumber).toBeNull();
  });

  test('returns null answeredNumber for a screens slot index of -1', () => {
    const negativeSlot: VanillaInternal320By200IndexedFramebufferProbe = {
      id: 'negative-slot',
      description: 'Slot -1.',
      queryKind: 'screens-slot-base-byte-offset',
      queryX: null,
      queryY: null,
      querySlotIndex: -1,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'V_INIT_CONTIGUOUS_FOUR_SLOT_ALLOCATION',
    };
    const result = deriveExpectedVanillaInternal320By200IndexedFramebufferResult(negativeSlot);
    expect(result.answeredNumber).toBeNull();
  });

  test('returns the same answer for an arbitrary user-constructed probe of every query kind', () => {
    const queryKinds: ReadonlyArray<{
      kind: VanillaInternal320By200IndexedFramebufferProbe['queryKind'];
      expectedNumber: number | null;
      expectedString: string | null;
      expectedBoolean: boolean | null;
    }> = [
      { kind: 'framebuffer-width', expectedNumber: 320, expectedString: null, expectedBoolean: null },
      { kind: 'framebuffer-height', expectedNumber: 200, expectedString: null, expectedBoolean: null },
      { kind: 'framebuffer-bytes-per-pixel', expectedNumber: 1, expectedString: null, expectedBoolean: null },
      { kind: 'framebuffer-bits-per-pixel', expectedNumber: 8, expectedString: null, expectedBoolean: null },
      { kind: 'framebuffer-row-stride-bytes', expectedNumber: 320, expectedString: null, expectedBoolean: null },
      { kind: 'framebuffer-total-bytes-per-slot', expectedNumber: 64_000, expectedString: null, expectedBoolean: null },
      { kind: 'v-init-contiguous-allocation-bytes', expectedNumber: 256_000, expectedString: null, expectedBoolean: null },
      { kind: 'v-init-screens-slot-count', expectedNumber: 4, expectedString: null, expectedBoolean: null },
      { kind: 'visible-framebuffer-screens-index', expectedNumber: 0, expectedString: null, expectedBoolean: null },
      { kind: 'top-left-pixel-byte-offset', expectedNumber: 0, expectedString: null, expectedBoolean: null },
      { kind: 'bottom-right-pixel-byte-offset', expectedNumber: 63_999, expectedString: null, expectedBoolean: null },
      { kind: 'x11-image-depth-bits', expectedNumber: 8, expectedString: null, expectedBoolean: null },
      { kind: 'x11-non-shm-bytes-per-line', expectedNumber: 320, expectedString: null, expectedBoolean: null },
      { kind: 'x11-non-shm-bitmap-pad', expectedNumber: 8, expectedString: null, expectedBoolean: null },
      { kind: 'x11-image-format-symbol', expectedNumber: null, expectedString: 'ZPixmap', expectedBoolean: null },
      { kind: 'framebuffer-c-element-type', expectedNumber: null, expectedString: 'unsigned char', expectedBoolean: null },
      { kind: 'framebuffer-byte-typedef', expectedNumber: null, expectedString: 'byte', expectedBoolean: null },
      { kind: 'v-init-alloc-symbol', expectedNumber: null, expectedString: 'I_AllocLow', expectedBoolean: null },
      { kind: 'i-init-graphics-alias-c-symbol', expectedNumber: null, expectedString: 'image->data', expectedBoolean: null },
      { kind: 'vanilla-uses-row-padding', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-requires-row-alignment', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-column-major-layout', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-bottom-up-scanline-order', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-performs-per-frame-memcpy-multiply-one', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-prepends-framebuffer-header', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-reserves-alpha-channel', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-sixteen-bit-element', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-thirty-two-bit-element', expectedNumber: null, expectedString: null, expectedBoolean: false },
    ];
    for (const { kind, expectedNumber, expectedString, expectedBoolean } of queryKinds) {
      const probe: VanillaInternal320By200IndexedFramebufferProbe = {
        id: `manual-derive-test-${kind}`,
        description: `Manual derive test for ${kind}.`,
        queryKind: kind,
        queryX: null,
        queryY: null,
        querySlotIndex: null,
        expectedAnsweredNumber: expectedNumber,
        expectedAnsweredString: expectedString,
        expectedAnsweredBoolean: expectedBoolean,
        witnessInvariantId: 'DIMENSIONS_LOCKED_AT_320_BY_200',
      };
      const result = deriveExpectedVanillaInternal320By200IndexedFramebufferResult(probe);
      expect(result.answeredNumber).toBe(expectedNumber);
      expect(result.answeredString).toBe(expectedString);
      expect(result.answeredBoolean).toBe(expectedBoolean);
    }
  });
});

describe('lock-internal-320-by-200-indexed-framebuffer step file', () => {
  test('declares the launch lane and the step write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/lock-internal-320-by-200-indexed-framebuffer.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/lock-internal-320-by-200-indexed-framebuffer.test.ts');
  });

  test('lists d_main.c, g_game.c, i_timer.c, i_video.c, and m_menu.c as research sources', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
    expect(stepText).toContain('- i_timer.c');
    expect(stepText).toContain('- i_video.c');
    expect(stepText).toContain('- m_menu.c');
  });

  test('declares the prerequisite gate 00-018', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
