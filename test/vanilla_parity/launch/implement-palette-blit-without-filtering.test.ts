import { describe, expect, test } from 'bun:test';

import {
  LOCKED_EXPAND4_BROKEN_COMMENT,
  LOCKED_EXPAND4_C_SYMBOL,
  LOCKED_GAMMA_CURVE_COUNT,
  LOCKED_GAMMA_TABLE_C_SYMBOL,
  LOCKED_GAMMA_TABLE_INPUT_INDEX_COUNT,
  LOCKED_I_FINISH_UPDATE_C_SYMBOL,
  LOCKED_I_SET_PALETTE_C_SYMBOL,
  LOCKED_MULTIPLY_2X2_REPLICATION_VALUE,
  LOCKED_MULTIPLY_3X3_REPLICATION_VALUE,
  LOCKED_MULTIPLY_4X4_REPLICATION_VALUE,
  LOCKED_MULTIPLY_ZERO_COPY_ALIAS_VALUE,
  LOCKED_PALETTE_BYTES_PER_ENTRY,
  LOCKED_PALETTE_CHANNEL_COUNT,
  LOCKED_PALETTE_ENTRY_COUNT,
  LOCKED_PALETTE_INPUT_BITS_PER_CHANNEL,
  LOCKED_PALETTE_TOTAL_BYTES,
  LOCKED_PALETTE_UPLOAD_X11_SYMBOL,
  LOCKED_PRESENTATION_X11_NON_SHM_SYMBOL,
  LOCKED_PRESENTATION_X11_SHM_SYMBOL,
  LOCKED_UPLOAD_NEW_PALETTE_C_SYMBOL,
  LOCKED_USE_GAMMA_C_SYMBOL,
  LOCKED_X11_NON_SHM_XSYNC_DISCARD_FLAG,
  LOCKED_X11_SHM_HANDSHAKE_FLAG_SYMBOL,
  LOCKED_X_COLORMAP_FLAGS_SYMBOL,
  LOCKED_X_COLORMAP_OUTPUT_BITS_PER_CHANNEL,
  LOCKED_X_HEIGHT_AT_MULTIPLY_ONE,
  LOCKED_X_HEIGHT_AT_MULTIPLY_THREE,
  LOCKED_X_HEIGHT_AT_MULTIPLY_TWO,
  LOCKED_X_WIDTH_AT_MULTIPLY_ONE,
  LOCKED_X_WIDTH_AT_MULTIPLY_THREE,
  LOCKED_X_WIDTH_AT_MULTIPLY_TWO,
  REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER,
  VANILLA_APPLIES_NON_GAMMA_COLOR_MATRIX,
  VANILLA_BLENDS_ADJACENT_PIXELS_ON_UPSCALE,
  VANILLA_HOLDS_PER_FRAME_VSYNC_GATE,
  VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_DERIVED_INVARIANTS,
  VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_DERIVED_INVARIANT_COUNT,
  VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK,
  VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK_CLAUSE_COUNT,
  VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES,
  VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBE_COUNT,
  VANILLA_REUPLOADS_PALETTE_EVERY_FRAME,
  VANILLA_SUPPORTS_FRACTIONAL_SCALES,
  VANILLA_USES_ALPHA_CHANNEL_BLENDING_AT_BLIT,
  VANILLA_USES_ANISOTROPIC_FILTERING,
  VANILLA_USES_BILINEAR_FILTERING,
  VANILLA_USES_DITHERING,
  VANILLA_USES_GPU_SHADER_AT_BLIT,
  VANILLA_USES_PARTIAL_RECT_BLITS,
  VANILLA_USES_RGB_INTERMEDIATE_BEFORE_BLIT,
  VANILLA_USES_SUBPIXEL_RENDERING,
  VANILLA_USES_TRILINEAR_FILTERING,
  crossCheckVanillaPaletteBlitWithoutFiltering,
  deriveExpectedVanillaPaletteBlitWithoutFilteringResult,
} from '../../../src/bootstrap/implement-palette-blit-without-filtering.ts';
import type { VanillaPaletteBlitWithoutFilteringHandler, VanillaPaletteBlitWithoutFilteringProbe, VanillaPaletteBlitWithoutFilteringResult } from '../../../src/bootstrap/implement-palette-blit-without-filtering.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../../src/host/windowPolicy.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-015-implement-palette-blit-without-filtering.md';

describe('LOCKED canonical constants', () => {
  test('palette has 256 entries with 3 bytes per entry totalling 768 bytes', () => {
    expect(LOCKED_PALETTE_ENTRY_COUNT).toBe(256);
    expect(LOCKED_PALETTE_BYTES_PER_ENTRY).toBe(3);
    expect(LOCKED_PALETTE_TOTAL_BYTES).toBe(768);
    expect(LOCKED_PALETTE_TOTAL_BYTES).toBe(LOCKED_PALETTE_ENTRY_COUNT * LOCKED_PALETTE_BYTES_PER_ENTRY);
  });

  test('palette has 3 channels with 8 input bits per channel and 16 output bits per channel', () => {
    expect(LOCKED_PALETTE_CHANNEL_COUNT).toBe(3);
    expect(LOCKED_PALETTE_INPUT_BITS_PER_CHANNEL).toBe(8);
    expect(LOCKED_X_COLORMAP_OUTPUT_BITS_PER_CHANNEL).toBe(16);
    expect(LOCKED_X_COLORMAP_OUTPUT_BITS_PER_CHANNEL).toBe(LOCKED_PALETTE_INPUT_BITS_PER_CHANNEL * 2);
  });

  test('gamma curve count is 5 with 256 input indices per curve', () => {
    expect(LOCKED_GAMMA_CURVE_COUNT).toBe(5);
    expect(LOCKED_GAMMA_TABLE_INPUT_INDEX_COUNT).toBe(256);
  });

  test('multiply values cover the four-branch dispatch {1,2,3,4}', () => {
    expect(LOCKED_MULTIPLY_ZERO_COPY_ALIAS_VALUE).toBe(1);
    expect(LOCKED_MULTIPLY_2X2_REPLICATION_VALUE).toBe(2);
    expect(LOCKED_MULTIPLY_3X3_REPLICATION_VALUE).toBe(3);
    expect(LOCKED_MULTIPLY_4X4_REPLICATION_VALUE).toBe(4);
  });

  test('locked X_width and X_height per multiply equal SCREENWIDTH and SCREENHEIGHT times multiply (cross-checked against runtime windowPolicy)', () => {
    expect(LOCKED_X_WIDTH_AT_MULTIPLY_ONE).toBe(320);
    expect(LOCKED_X_WIDTH_AT_MULTIPLY_ONE).toBe(SCREENWIDTH);
    expect(LOCKED_X_HEIGHT_AT_MULTIPLY_ONE).toBe(200);
    expect(LOCKED_X_HEIGHT_AT_MULTIPLY_ONE).toBe(SCREENHEIGHT);
    expect(LOCKED_X_WIDTH_AT_MULTIPLY_TWO).toBe(640);
    expect(LOCKED_X_WIDTH_AT_MULTIPLY_TWO).toBe(2 * SCREENWIDTH);
    expect(LOCKED_X_HEIGHT_AT_MULTIPLY_TWO).toBe(400);
    expect(LOCKED_X_HEIGHT_AT_MULTIPLY_TWO).toBe(2 * SCREENHEIGHT);
    expect(LOCKED_X_WIDTH_AT_MULTIPLY_THREE).toBe(960);
    expect(LOCKED_X_WIDTH_AT_MULTIPLY_THREE).toBe(3 * SCREENWIDTH);
    expect(LOCKED_X_HEIGHT_AT_MULTIPLY_THREE).toBe(600);
    expect(LOCKED_X_HEIGHT_AT_MULTIPLY_THREE).toBe(3 * SCREENHEIGHT);
  });

  test('XColor flags symbol is "DoRed|DoGreen|DoBlue"', () => {
    expect(LOCKED_X_COLORMAP_FLAGS_SYMBOL).toBe('DoRed|DoGreen|DoBlue');
  });

  test('X11 palette upload primitive is XStoreColors', () => {
    expect(LOCKED_PALETTE_UPLOAD_X11_SYMBOL).toBe('XStoreColors');
  });

  test('X11 SHM and non-SHM presentation primitives are XShmPutImage and XPutImage', () => {
    expect(LOCKED_PRESENTATION_X11_SHM_SYMBOL).toBe('XShmPutImage');
    expect(LOCKED_PRESENTATION_X11_NON_SHM_SYMBOL).toBe('XPutImage');
  });

  test('non-SHM XSync discard flag is False (events are NOT discarded)', () => {
    expect(LOCKED_X11_NON_SHM_XSYNC_DISCARD_FLAG).toBe(false);
  });

  test('SHM handshake flag symbol is shmFinished', () => {
    expect(LOCKED_X11_SHM_HANDSHAKE_FLAG_SYMBOL).toBe('shmFinished');
  });

  test('canonical C symbols are UploadNewPalette, I_SetPalette, I_FinishUpdate, gammatable, usegamma, Expand4', () => {
    expect(LOCKED_UPLOAD_NEW_PALETTE_C_SYMBOL).toBe('UploadNewPalette');
    expect(LOCKED_I_SET_PALETTE_C_SYMBOL).toBe('I_SetPalette');
    expect(LOCKED_I_FINISH_UPDATE_C_SYMBOL).toBe('I_FinishUpdate');
    expect(LOCKED_GAMMA_TABLE_C_SYMBOL).toBe('gammatable');
    expect(LOCKED_USE_GAMMA_C_SYMBOL).toBe('usegamma');
    expect(LOCKED_EXPAND4_C_SYMBOL).toBe('Expand4');
  });

  test('Expand4 is documented Broken in the source comment', () => {
    expect(LOCKED_EXPAND4_BROKEN_COMMENT).toBe('Broken. Gotta fix this some day.');
  });

  test('vanilla negative-fact constants are all false (vanilla does NOT do these things)', () => {
    expect(VANILLA_USES_BILINEAR_FILTERING).toBe(false);
    expect(VANILLA_USES_TRILINEAR_FILTERING).toBe(false);
    expect(VANILLA_USES_ANISOTROPIC_FILTERING).toBe(false);
    expect(VANILLA_SUPPORTS_FRACTIONAL_SCALES).toBe(false);
    expect(VANILLA_USES_DITHERING).toBe(false);
    expect(VANILLA_USES_SUBPIXEL_RENDERING).toBe(false);
    expect(VANILLA_BLENDS_ADJACENT_PIXELS_ON_UPSCALE).toBe(false);
    expect(VANILLA_USES_ALPHA_CHANNEL_BLENDING_AT_BLIT).toBe(false);
    expect(VANILLA_REUPLOADS_PALETTE_EVERY_FRAME).toBe(false);
    expect(VANILLA_APPLIES_NON_GAMMA_COLOR_MATRIX).toBe(false);
    expect(VANILLA_USES_GPU_SHADER_AT_BLIT).toBe(false);
    expect(VANILLA_USES_PARTIAL_RECT_BLITS).toBe(false);
    expect(VANILLA_HOLDS_PER_FRAME_VSYNC_GATE).toBe(false);
    expect(VANILLA_USES_RGB_INTERMEDIATE_BEFORE_BLIT).toBe(false);
  });
});

describe('lock clause ledger shape', () => {
  test('declared clause count equals VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK_CLAUSE_COUNT', () => {
    expect(VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.length).toBe(VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK_CLAUSE_COUNT);
    expect(VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK_CLAUSE_COUNT).toBe(38);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.map((entry) => entry.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('every clause cites i_video.c as the reference source file', () => {
    for (const entry of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK) {
      expect(entry.referenceSourceFile).toBe('i_video.c');
    }
  });

  test('every clause cites a canonical C symbol from the palette/blit landscape', () => {
    const validSymbols = new Set(['I_SetPalette', 'UploadNewPalette', 'I_FinishUpdate', 'Expand4']);
    for (const entry of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK) {
      expect(validSymbols.has(entry.cSymbol)).toBe(true);
    }
  });

  test('every clause has a non-empty plain-language invariant description', () => {
    for (const entry of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });
});

describe('lock clause ledger values', () => {
  test('PALETTE_HAS_256_ENTRIES cites UploadNewPalette and the verbatim for-loop bound', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'PALETTE_HAS_256_ENTRIES');
    expect(clause).toBeDefined();
    expect(clause?.cSymbol).toBe('UploadNewPalette');
    expect(clause?.invariant).toContain('256');
    expect(clause?.invariant).toContain('for (i=0 ; i<256 ; i++)');
    expect(clause?.invariant).toContain('768-byte PLAYPAL block');
  });

  test('PALETTE_RGB_CHANNEL_ORDER_IS_R_THEN_G_THEN_B cites the verbatim three-read sequence', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'PALETTE_RGB_CHANNEL_ORDER_IS_R_THEN_G_THEN_B');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('colors[i].red = (c<<8) + c');
    expect(clause?.invariant).toContain('colors[i].green = (c<<8) + c');
    expect(clause?.invariant).toContain('colors[i].blue = (c<<8) + c');
    expect(clause?.invariant).toContain('gammatable[usegamma]');
  });

  test('PALETTE_8_BIT_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION cites the verbatim (c<<8) + c expansion', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'PALETTE_8_BIT_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('(c<<8) + c');
    expect(clause?.invariant).toContain('0xAB');
    expect(clause?.invariant).toContain('0xABAB');
  });

  test('PALETTE_GAMMA_CORRECTED_VIA_GAMMATABLE_LOOKUP cites usegamma and gammatable indirection', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'PALETTE_GAMMA_CORRECTED_VIA_GAMMATABLE_LOOKUP');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('gammatable[usegamma][*palette++]');
    expect(clause?.invariant).toContain('usegamma');
  });

  test('PALETTE_UPLOAD_USES_X_STORE_COLORS_PRIMITIVE cites the verbatim XStoreColors call signature', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'PALETTE_UPLOAD_USES_X_STORE_COLORS_PRIMITIVE');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('XStoreColors(X_display, cmap, colors, 256)');
  });

  test('PALETTE_ENTRY_FLAGS_LOCKED_AT_DO_RED_GREEN_BLUE cites the verbatim flag mask', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'PALETTE_ENTRY_FLAGS_LOCKED_AT_DO_RED_GREEN_BLUE');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('DoRed|DoGreen|DoBlue');
    expect(clause?.invariant).toContain('colors[i].flags');
  });

  test('MULTIPLY_TWO_PATH_IS_2X2_PURE_BLOCK_REPLICATION cites the verbatim mask+shift arithmetic', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'MULTIPLY_TWO_PATH_IS_2X2_PURE_BLOCK_REPLICATION');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('fouripixels');
    expect(clause?.invariant).toContain('0xff000000');
    expect(clause?.invariant).toContain('twoopixels');
    expect(clause?.invariant).toContain('twomoreopixels');
  });

  test('MULTIPLY_FOUR_PATH_IS_DOCUMENTED_BROKEN_IN_SOURCE cites the Broken comment', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'MULTIPLY_FOUR_PATH_IS_DOCUMENTED_BROKEN_IN_SOURCE');
    expect(clause).toBeDefined();
    expect(clause?.cSymbol).toBe('Expand4');
    expect(clause?.invariant).toContain('Broken. Gotta fix this some day.');
  });

  test('PRESENTATION_VIA_XSHMPUTIMAGE_OR_XPUTIMAGE cites both call signatures', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'PRESENTATION_VIA_XSHMPUTIMAGE_OR_XPUTIMAGE');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('XShmPutImage');
    expect(clause?.invariant).toContain('XPutImage');
    expect(clause?.invariant).toContain('X_width');
    expect(clause?.invariant).toContain('X_height');
  });

  test('PRESENTATION_NON_SHM_PATH_USES_XSYNC_FALSE_FLAG cites the canonical XSync invocation', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'PRESENTATION_NON_SHM_PATH_USES_XSYNC_FALSE_FLAG');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('XSync(X_display, False)');
  });

  test('PRESENTATION_SHM_PATH_USES_SHMFINISHED_HANDSHAKE cites the verbatim poll-event loop', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'PRESENTATION_SHM_PATH_USES_SHMFINISHED_HANDSHAKE');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('shmFinished = false');
    expect(clause?.invariant).toContain('I_GetEvent');
  });

  test('NO_INTERMEDIATE_RGB_FRAMEBUFFER_BEFORE_BLIT cites the Chocolate argbbuffer counterexample', () => {
    const clause = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK.find((entry) => entry.id === 'NO_INTERMEDIATE_RGB_FRAMEBUFFER_BEFORE_BLIT');
    expect(clause).toBeDefined();
    expect(clause?.invariant).toContain('argbbuffer');
    expect(clause?.invariant).toContain('Chocolate');
  });

  test('every clause that cites Expand4 references a separate function (not I_FinishUpdate)', () => {
    for (const entry of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK) {
      if (entry.cSymbol === 'Expand4') {
        expect(entry.id === 'MULTIPLY_FOUR_PATH_IS_DOCUMENTED_BROKEN_IN_SOURCE').toBe(true);
      }
    }
  });
});

describe('derived invariants ledger', () => {
  test('declared invariant count equals VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_DERIVED_INVARIANT_COUNT', () => {
    expect(VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_DERIVED_INVARIANTS.length).toBe(VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_DERIVED_INVARIANT_COUNT);
    expect(VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_DERIVED_INVARIANT_COUNT).toBe(12);
  });

  test('every derived invariant id is unique', () => {
    const ids = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_DERIVED_INVARIANTS.map((entry) => entry.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('every derived invariant has a non-empty description', () => {
    for (const entry of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_DERIVED_INVARIANTS) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe('probe ledger shape', () => {
  test('declared probe count equals VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBE_COUNT', () => {
    expect(VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES.length).toBe(VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBE_COUNT);
    expect(VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBE_COUNT).toBe(54);
  });

  test('every probe id is unique', () => {
    const ids = VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES.map((probe) => probe.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('every probe witness invariant id matches a declared derived invariant', () => {
    const validInvariants = new Set(VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_DERIVED_INVARIANTS.map((entry) => entry.id));
    for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
      expect(validInvariants.has(probe.witnessInvariantId)).toBe(true);
    }
  });

  test('every probe has a non-empty description', () => {
    for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
      expect(probe.description.length).toBeGreaterThan(0);
    }
  });

  test('every probe has exactly one of expectedAnsweredNumber, expectedAnsweredString, or expectedAnsweredBoolean populated', () => {
    for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
      const numericPopulated = probe.expectedAnsweredNumber !== null;
      const stringPopulated = probe.expectedAnsweredString !== null;
      const booleanPopulated = probe.expectedAnsweredBoolean !== null;
      const populatedCount = (numericPopulated ? 1 : 0) + (stringPopulated ? 1 : 0) + (booleanPopulated ? 1 : 0);
      expect(populatedCount).toBe(1);
    }
  });

  test('numeric query kinds populate expectedAnsweredNumber and not the others', () => {
    const numericQueryKinds = new Set([
      'palette-entry-count',
      'palette-bytes-per-entry',
      'palette-total-bytes',
      'palette-channel-count',
      'palette-input-bits-per-channel',
      'x-colormap-output-bits-per-channel',
      'palette-channel-byte-offset',
      'palette-eight-to-sixteen-bit-expansion-of-input',
      'gamma-curve-count',
      'gamma-table-input-index-count',
      'multiply-zero-copy-alias-value',
      'multiply-2x2-replication-value',
      'multiply-3x3-replication-value',
      'multiply-4x4-replication-value',
      'x-width-for-multiply',
      'x-height-for-multiply',
    ]);
    for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
      if (numericQueryKinds.has(probe.queryKind)) {
        expect(probe.expectedAnsweredNumber).not.toBeNull();
        expect(probe.expectedAnsweredString).toBeNull();
        expect(probe.expectedAnsweredBoolean).toBeNull();
      }
    }
  });

  test('string query kinds populate expectedAnsweredString and not the others', () => {
    const stringQueryKinds = new Set([
      'x-colormap-flags-symbol',
      'palette-upload-x11-symbol',
      'presentation-x11-shm-symbol',
      'presentation-x11-non-shm-symbol',
      'x11-shm-handshake-flag-symbol',
      'upload-new-palette-c-symbol',
      'i-set-palette-c-symbol',
      'i-finish-update-c-symbol',
      'gamma-table-c-symbol',
      'use-gamma-c-symbol',
      'expand4-c-symbol',
      'expand4-broken-comment',
    ]);
    for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
      if (stringQueryKinds.has(probe.queryKind)) {
        expect(probe.expectedAnsweredString).not.toBeNull();
        expect(probe.expectedAnsweredNumber).toBeNull();
        expect(probe.expectedAnsweredBoolean).toBeNull();
      }
    }
  });

  test('boolean query kinds populate expectedAnsweredBoolean and not the others', () => {
    const booleanQueryKinds = new Set([
      'x11-non-shm-xsync-discard-flag',
      'vanilla-uses-bilinear-filtering',
      'vanilla-uses-trilinear-filtering',
      'vanilla-uses-anisotropic-filtering',
      'vanilla-supports-fractional-scales',
      'vanilla-uses-dithering',
      'vanilla-uses-subpixel-rendering',
      'vanilla-blends-adjacent-pixels-on-upscale',
      'vanilla-uses-alpha-channel-blending-at-blit',
      'vanilla-reuploads-palette-every-frame',
      'vanilla-applies-non-gamma-color-matrix',
      'vanilla-uses-gpu-shader-at-blit',
      'vanilla-uses-partial-rect-blits',
      'vanilla-holds-per-frame-vsync-gate',
      'vanilla-uses-rgb-intermediate-before-blit',
    ]);
    for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
      if (booleanQueryKinds.has(probe.queryKind)) {
        expect(probe.expectedAnsweredBoolean).not.toBeNull();
        expect(probe.expectedAnsweredNumber).toBeNull();
        expect(probe.expectedAnsweredString).toBeNull();
      }
    }
  });

  test('palette-channel-byte-offset probes populate queryChannelIndex and queryPaletteEntryIndex', () => {
    for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
      if (probe.queryKind === 'palette-channel-byte-offset') {
        expect(probe.queryChannelIndex).not.toBeNull();
        expect(probe.queryPaletteEntryIndex).not.toBeNull();
        expect(probe.queryInputByte).toBeNull();
        expect(probe.queryMultiply).toBeNull();
      }
    }
  });

  test('palette-eight-to-sixteen-bit-expansion-of-input probes populate queryInputByte', () => {
    for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
      if (probe.queryKind === 'palette-eight-to-sixteen-bit-expansion-of-input') {
        expect(probe.queryInputByte).not.toBeNull();
        expect(probe.queryChannelIndex).toBeNull();
        expect(probe.queryPaletteEntryIndex).toBeNull();
        expect(probe.queryMultiply).toBeNull();
      }
    }
  });

  test('x-width-for-multiply and x-height-for-multiply probes populate queryMultiply', () => {
    for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
      if (probe.queryKind === 'x-width-for-multiply' || probe.queryKind === 'x-height-for-multiply') {
        expect(probe.queryMultiply).not.toBeNull();
      }
    }
  });
});

describe('reference handler', () => {
  test('reference handler answers every probe correctly', () => {
    for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
      const result = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(probe);
      expect(result.probeId).toBe(probe.id);
      expect(result.answeredNumber).toBe(probe.expectedAnsweredNumber);
      expect(result.answeredString).toBe(probe.expectedAnsweredString);
      expect(result.answeredBoolean).toBe(probe.expectedAnsweredBoolean);
    }
  });

  test('reference handler byte-duplication formula matches (c<<8) + c for an arbitrary input byte', () => {
    const arbitraryProbe: VanillaPaletteBlitWithoutFilteringProbe = {
      id: 'arbitrary-byte-duplication-7f',
      description: 'Input byte 0x7F (mid-range) byte-duplication.',
      queryKind: 'palette-eight-to-sixteen-bit-expansion-of-input',
      queryChannelIndex: null,
      queryPaletteEntryIndex: null,
      queryInputByte: 0x7f,
      queryMultiply: null,
      expectedAnsweredNumber: 0x7f7f,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PALETTE_8_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION',
    };
    const result = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(arbitraryProbe);
    expect(result.answeredNumber).toBe(0x7f7f);
    expect(result.answeredNumber).toBe((0x7f << 8) + 0x7f);
  });

  test('reference handler returns null for an out-of-range input byte (256)', () => {
    const outOfRangeProbe: VanillaPaletteBlitWithoutFilteringProbe = {
      id: 'oob-input-byte-256',
      description: 'Input byte 256 (out of range).',
      queryKind: 'palette-eight-to-sixteen-bit-expansion-of-input',
      queryChannelIndex: null,
      queryPaletteEntryIndex: null,
      queryInputByte: 256,
      queryMultiply: null,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PALETTE_8_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION',
    };
    const result = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(outOfRangeProbe);
    expect(result.answeredNumber).toBeNull();
  });

  test('reference handler returns null for a negative input byte (-1)', () => {
    const negativeProbe: VanillaPaletteBlitWithoutFilteringProbe = {
      id: 'negative-input-byte',
      description: 'Input byte -1.',
      queryKind: 'palette-eight-to-sixteen-bit-expansion-of-input',
      queryChannelIndex: null,
      queryPaletteEntryIndex: null,
      queryInputByte: -1,
      queryMultiply: null,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PALETTE_8_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION',
    };
    const result = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(negativeProbe);
    expect(result.answeredNumber).toBeNull();
  });

  test('reference handler returns null for an out-of-range channel index (3)', () => {
    const outOfRangeChannelProbe: VanillaPaletteBlitWithoutFilteringProbe = {
      id: 'oob-channel-index-3',
      description: 'Channel index 3 (only 0..2 valid for R/G/B).',
      queryKind: 'palette-channel-byte-offset',
      queryChannelIndex: 3,
      queryPaletteEntryIndex: 0,
      queryInputByte: null,
      queryMultiply: null,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
    };
    const result = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(outOfRangeChannelProbe);
    expect(result.answeredNumber).toBeNull();
  });

  test('reference handler returns null for an out-of-range palette entry index (256)', () => {
    const outOfRangeEntryProbe: VanillaPaletteBlitWithoutFilteringProbe = {
      id: 'oob-entry-index-256',
      description: 'Entry index 256 (only 0..255 valid).',
      queryKind: 'palette-channel-byte-offset',
      queryChannelIndex: 0,
      queryPaletteEntryIndex: 256,
      queryInputByte: null,
      queryMultiply: null,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
    };
    const result = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(outOfRangeEntryProbe);
    expect(result.answeredNumber).toBeNull();
  });

  test('reference handler returns null for an out-of-range multiply value (5)', () => {
    const oobMultiplyProbe: VanillaPaletteBlitWithoutFilteringProbe = {
      id: 'oob-multiply-5',
      description: 'multiply=5 (only 1/2/3 are pinned for X_width/X_height).',
      queryKind: 'x-width-for-multiply',
      queryChannelIndex: null,
      queryPaletteEntryIndex: null,
      queryInputByte: null,
      queryMultiply: 5,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
    };
    const result = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(oobMultiplyProbe);
    expect(result.answeredNumber).toBeNull();
  });

  test('reference handler computes byte-duplication for every byte 0..255 matching (c<<8) + c', () => {
    for (let c = 0; c <= 0xff; c++) {
      const probe: VanillaPaletteBlitWithoutFilteringProbe = {
        id: `byte-duplication-${c}`,
        description: `Byte ${c} duplication.`,
        queryKind: 'palette-eight-to-sixteen-bit-expansion-of-input',
        queryChannelIndex: null,
        queryPaletteEntryIndex: null,
        queryInputByte: c,
        queryMultiply: null,
        expectedAnsweredNumber: (c << 8) + c,
        expectedAnsweredString: null,
        expectedAnsweredBoolean: null,
        witnessInvariantId: 'PALETTE_8_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION',
      };
      const result = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(probe);
      expect(result.answeredNumber).toBe((c << 8) + c);
    }
  });

  test('reference handler computes channel byte offsets matching entry*3 + channel for every entry 0..255', () => {
    for (let entry = 0; entry < 256; entry++) {
      for (let channel = 0; channel < 3; channel++) {
        const probe: VanillaPaletteBlitWithoutFilteringProbe = {
          id: `channel-offset-${entry}-${channel}`,
          description: `Entry ${entry} channel ${channel} byte offset.`,
          queryKind: 'palette-channel-byte-offset',
          queryChannelIndex: channel,
          queryPaletteEntryIndex: entry,
          queryInputByte: null,
          queryMultiply: null,
          expectedAnsweredNumber: entry * 3 + channel,
          expectedAnsweredString: null,
          expectedAnsweredBoolean: null,
          witnessInvariantId: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
        };
        const result = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(probe);
        expect(result.answeredNumber).toBe(entry * 3 + channel);
      }
    }
  });
});

describe('cross-checker passes on the reference handler', () => {
  test('crossCheckVanillaPaletteBlitWithoutFiltering reports zero failures on the reference handler', () => {
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER);
    expect(failures).toEqual([]);
  });
});

function tamperedHandler(transform: (probe: VanillaPaletteBlitWithoutFilteringProbe, result: VanillaPaletteBlitWithoutFilteringResult) => VanillaPaletteBlitWithoutFilteringResult): VanillaPaletteBlitWithoutFilteringHandler {
  return Object.freeze({
    evaluate(probe: VanillaPaletteBlitWithoutFilteringProbe): VanillaPaletteBlitWithoutFilteringResult {
      const result = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(probe);
      return transform(probe, result);
    },
  });
}

describe('cross-checker detects tampered candidates', () => {
  test('detects palette entry count drift from 256 to 64 (handler reports a smaller VGA palette)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'palette-entry-count' ? { ...result, answeredNumber: 64 } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('palette-entry-count-is-256:answered-number-mismatch');
  });

  test('detects palette bytes-per-entry drift to 4 (handler treats PLAYPAL as RGBA)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'palette-bytes-per-entry' ? { ...result, answeredNumber: 4 } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('palette-bytes-per-entry-is-three:answered-number-mismatch');
  });

  test('detects palette total bytes drift to 1024 (handler reports 256 RGBA entries)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'palette-total-bytes' ? { ...result, answeredNumber: 1024 } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('palette-total-bytes-is-768:answered-number-mismatch');
  });

  test('detects palette channel count drift from 3 to 4 (handler adds an alpha channel)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'palette-channel-count' ? { ...result, answeredNumber: 4 } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('palette-channel-count-is-three:answered-number-mismatch');
  });

  test('detects 8-bit-to-16-bit expansion drift to zero-padding `c<<8` (handler reports 0xAB00 instead of 0xABAB)', () => {
    const tampered = tamperedHandler((probe, result) => {
      if (probe.queryKind === 'palette-eight-to-sixteen-bit-expansion-of-input' && probe.queryInputByte === 0xab) {
        return { ...result, answeredNumber: 0xab << 8 };
      }
      return result;
    });
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('palette-eight-to-sixteen-bit-expansion-of-ab-is-abab:answered-number-mismatch');
  });

  test('detects 8-bit-to-16-bit expansion drift on 0x01 from 0x0101 to 0x0100 (zero-padding tamper)', () => {
    const tampered = tamperedHandler((probe, result) => {
      if (probe.queryKind === 'palette-eight-to-sixteen-bit-expansion-of-input' && probe.queryInputByte === 0x01) {
        return { ...result, answeredNumber: 0x0100 };
      }
      return result;
    });
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('palette-eight-to-sixteen-bit-expansion-of-01-is-0101:answered-number-mismatch');
  });

  test('detects gamma curve count drift from 5 to 4 (handler exposes one fewer gamma setting)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'gamma-curve-count' ? { ...result, answeredNumber: 4 } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('gamma-curve-count-is-five:answered-number-mismatch');
  });

  test('detects channel byte offset drift to BGR ordering (entry 0 red at offset 2 instead of 0)', () => {
    const tampered = tamperedHandler((probe, result) => {
      if (probe.queryKind === 'palette-channel-byte-offset' && probe.queryChannelIndex === 0 && probe.queryPaletteEntryIndex === 0) {
        return { ...result, answeredNumber: 2 };
      }
      return result;
    });
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('palette-channel-byte-offset-entry-zero-red:answered-number-mismatch');
  });

  test('detects channel byte offset drift for entry 255 blue from 767 to 1023 (handler treats PLAYPAL as RGBA)', () => {
    const tampered = tamperedHandler((probe, result) => {
      if (probe.queryKind === 'palette-channel-byte-offset' && probe.queryChannelIndex === 2 && probe.queryPaletteEntryIndex === 255) {
        return { ...result, answeredNumber: 1023 };
      }
      return result;
    });
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('palette-channel-byte-offset-entry-255-blue:answered-number-mismatch');
  });

  test('detects multiply==2 X_width drift from 640 to 800 (handler imposes 4:3-stretched 800x600 rendering)', () => {
    const tampered = tamperedHandler((probe, result) => {
      if (probe.queryKind === 'x-width-for-multiply' && probe.queryMultiply === 2) {
        return { ...result, answeredNumber: 800 };
      }
      return result;
    });
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('x-width-at-multiply-two-is-640:answered-number-mismatch');
  });

  test('detects multiply==3 X_height drift from 600 to 720 (handler imposes 16:9-stretched 1280x720 rendering)', () => {
    const tampered = tamperedHandler((probe, result) => {
      if (probe.queryKind === 'x-height-for-multiply' && probe.queryMultiply === 3) {
        return { ...result, answeredNumber: 720 };
      }
      return result;
    });
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('x-height-at-multiply-three-is-600:answered-number-mismatch');
  });

  test('detects XColor flags symbol drift from "DoRed|DoGreen|DoBlue" to just "DoRed" (handler omits two channels)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'x-colormap-flags-symbol' ? { ...result, answeredString: 'DoRed' } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('x-colormap-flags-symbol-is-do-red-do-green-do-blue:answered-string-mismatch');
  });

  test('detects palette upload primitive drift from XStoreColors to XAllocColor (per-entry round trip)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'palette-upload-x11-symbol' ? { ...result, answeredString: 'XAllocColor' } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('palette-upload-x11-symbol-is-x-store-colors:answered-string-mismatch');
  });

  test('detects presentation primitive drift from XPutImage to SDL_RenderCopy (handler swaps to SDL2)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'presentation-x11-non-shm-symbol' ? { ...result, answeredString: 'SDL_RenderCopy' } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('presentation-x11-non-shm-symbol-is-x-put-image:answered-string-mismatch');
  });

  test('detects XSync discard flag drift from False to True (handler discards queued events)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'x11-non-shm-xsync-discard-flag' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('x11-non-shm-xsync-discard-flag-is-false:answered-boolean-mismatch');
  });

  test('detects SHM handshake flag symbol drift from shmFinished to shmComplete (handler renames)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'x11-shm-handshake-flag-symbol' ? { ...result, answeredString: 'shmComplete' } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('x11-shm-handshake-flag-symbol-is-shm-finished:answered-string-mismatch');
  });

  test('detects gammatable C symbol drift to "gamma_ramp" (handler uses non-vanilla name)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'gamma-table-c-symbol' ? { ...result, answeredString: 'gamma_ramp' } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('gamma-table-c-symbol-is-gammatable:answered-string-mismatch');
  });

  test('detects Expand4 broken comment drift (handler updates the comment)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'expand4-broken-comment' ? { ...result, answeredString: 'Fixed in v1.10.' } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('expand4-broken-comment-is-broken-gotta-fix-this:answered-string-mismatch');
  });

  test('detects vanilla-uses-bilinear-filtering flipped to true (handler enables GL_LINEAR)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-uses-bilinear-filtering' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('vanilla-uses-bilinear-filtering-is-false:answered-boolean-mismatch');
  });

  test('detects vanilla-blends-adjacent-pixels-on-upscale flipped to true (handler weights two pixels)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-blends-adjacent-pixels-on-upscale' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('vanilla-blends-adjacent-pixels-on-upscale-is-false:answered-boolean-mismatch');
  });

  test('detects vanilla-uses-dithering flipped to true (handler adds Floyd-Steinberg)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-uses-dithering' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('vanilla-uses-dithering-is-false:answered-boolean-mismatch');
  });

  test('detects vanilla-uses-alpha-channel-blending-at-blit flipped to true (handler adds per-pixel alpha)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-uses-alpha-channel-blending-at-blit' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('vanilla-uses-alpha-channel-blending-at-blit-is-false:answered-boolean-mismatch');
  });

  test('detects vanilla-reuploads-palette-every-frame flipped to true (handler reuploads PLAYPAL every tic)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-reuploads-palette-every-frame' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('vanilla-reuploads-palette-every-frame-is-false:answered-boolean-mismatch');
  });

  test('detects vanilla-uses-gpu-shader-at-blit flipped to true (handler wraps in OpenGL pipeline)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-uses-gpu-shader-at-blit' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('vanilla-uses-gpu-shader-at-blit-is-false:answered-boolean-mismatch');
  });

  test('detects vanilla-uses-partial-rect-blits flipped to true (handler tracks dirty regions)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-uses-partial-rect-blits' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('vanilla-uses-partial-rect-blits-is-false:answered-boolean-mismatch');
  });

  test('detects vanilla-holds-per-frame-vsync-gate flipped to true (handler waits for vertical retrace)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-holds-per-frame-vsync-gate' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('vanilla-holds-per-frame-vsync-gate-is-false:answered-boolean-mismatch');
  });

  test('detects vanilla-uses-rgb-intermediate-before-blit flipped to true (handler materialises argbbuffer)', () => {
    const tampered = tamperedHandler((probe, result) => (probe.queryKind === 'vanilla-uses-rgb-intermediate-before-blit' ? { ...result, answeredBoolean: true } : result));
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('vanilla-uses-rgb-intermediate-before-blit-is-false:answered-boolean-mismatch');
  });

  test('detects probe-id-mismatch when handler returns wrong probeId', () => {
    const tampered: VanillaPaletteBlitWithoutFilteringHandler = Object.freeze({
      evaluate(probe: VanillaPaletteBlitWithoutFilteringProbe): VanillaPaletteBlitWithoutFilteringResult {
        const result = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(probe);
        if (probe.id === 'palette-entry-count-is-256') {
          return { ...result, probeId: 'wrong-probe-id' };
        }
        return result;
      },
    });
    const failures = crossCheckVanillaPaletteBlitWithoutFiltering(tampered);
    expect(failures).toContain('palette-entry-count-is-256:probe-id-mismatch');
  });
});

describe('deriveExpectedVanillaPaletteBlitWithoutFilteringResult helper', () => {
  test('matches the reference handler answer for every pinned probe', () => {
    for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
      const derived = deriveExpectedVanillaPaletteBlitWithoutFilteringResult(probe);
      const reference = REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER.evaluate(probe);
      expect(derived.answeredNumber).toBe(reference.answeredNumber);
      expect(derived.answeredString).toBe(reference.answeredString);
      expect(derived.answeredBoolean).toBe(reference.answeredBoolean);
      expect(derived.probeId).toBe(reference.probeId);
    }
  });

  test('returns null answeredNumber for an out-of-range channel index (-1)', () => {
    const probe: VanillaPaletteBlitWithoutFilteringProbe = {
      id: 'negative-channel',
      description: 'Channel index -1.',
      queryKind: 'palette-channel-byte-offset',
      queryChannelIndex: -1,
      queryPaletteEntryIndex: 0,
      queryInputByte: null,
      queryMultiply: null,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
    };
    const result = deriveExpectedVanillaPaletteBlitWithoutFilteringResult(probe);
    expect(result.answeredNumber).toBeNull();
  });

  test('returns null answeredNumber for an out-of-range palette entry index (-1)', () => {
    const probe: VanillaPaletteBlitWithoutFilteringProbe = {
      id: 'negative-entry-index',
      description: 'Entry index -1.',
      queryKind: 'palette-channel-byte-offset',
      queryChannelIndex: 0,
      queryPaletteEntryIndex: -1,
      queryInputByte: null,
      queryMultiply: null,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
    };
    const result = deriveExpectedVanillaPaletteBlitWithoutFilteringResult(probe);
    expect(result.answeredNumber).toBeNull();
  });

  test('returns null for an out-of-range multiply value (4) on x-width-for-multiply (Expand4 path is documented Broken)', () => {
    const probe: VanillaPaletteBlitWithoutFilteringProbe = {
      id: 'multiply-4-x-width-not-pinned',
      description: 'multiply=4 (Expand4 path is documented Broken in source).',
      queryKind: 'x-width-for-multiply',
      queryChannelIndex: null,
      queryPaletteEntryIndex: null,
      queryInputByte: null,
      queryMultiply: 4,
      expectedAnsweredNumber: null,
      expectedAnsweredString: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
    };
    const result = deriveExpectedVanillaPaletteBlitWithoutFilteringResult(probe);
    expect(result.answeredNumber).toBeNull();
  });

  test('returns the same answer for an arbitrary user-constructed probe of every query kind', () => {
    const queryKinds: ReadonlyArray<{
      kind: VanillaPaletteBlitWithoutFilteringProbe['queryKind'];
      expectedNumber: number | null;
      expectedString: string | null;
      expectedBoolean: boolean | null;
    }> = [
      { kind: 'palette-entry-count', expectedNumber: 256, expectedString: null, expectedBoolean: null },
      { kind: 'palette-bytes-per-entry', expectedNumber: 3, expectedString: null, expectedBoolean: null },
      { kind: 'palette-total-bytes', expectedNumber: 768, expectedString: null, expectedBoolean: null },
      { kind: 'palette-channel-count', expectedNumber: 3, expectedString: null, expectedBoolean: null },
      { kind: 'palette-input-bits-per-channel', expectedNumber: 8, expectedString: null, expectedBoolean: null },
      { kind: 'x-colormap-output-bits-per-channel', expectedNumber: 16, expectedString: null, expectedBoolean: null },
      { kind: 'gamma-curve-count', expectedNumber: 5, expectedString: null, expectedBoolean: null },
      { kind: 'gamma-table-input-index-count', expectedNumber: 256, expectedString: null, expectedBoolean: null },
      { kind: 'multiply-zero-copy-alias-value', expectedNumber: 1, expectedString: null, expectedBoolean: null },
      { kind: 'multiply-2x2-replication-value', expectedNumber: 2, expectedString: null, expectedBoolean: null },
      { kind: 'multiply-3x3-replication-value', expectedNumber: 3, expectedString: null, expectedBoolean: null },
      { kind: 'multiply-4x4-replication-value', expectedNumber: 4, expectedString: null, expectedBoolean: null },
      { kind: 'x-colormap-flags-symbol', expectedNumber: null, expectedString: 'DoRed|DoGreen|DoBlue', expectedBoolean: null },
      { kind: 'palette-upload-x11-symbol', expectedNumber: null, expectedString: 'XStoreColors', expectedBoolean: null },
      { kind: 'presentation-x11-shm-symbol', expectedNumber: null, expectedString: 'XShmPutImage', expectedBoolean: null },
      { kind: 'presentation-x11-non-shm-symbol', expectedNumber: null, expectedString: 'XPutImage', expectedBoolean: null },
      { kind: 'x11-non-shm-xsync-discard-flag', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'x11-shm-handshake-flag-symbol', expectedNumber: null, expectedString: 'shmFinished', expectedBoolean: null },
      { kind: 'upload-new-palette-c-symbol', expectedNumber: null, expectedString: 'UploadNewPalette', expectedBoolean: null },
      { kind: 'i-set-palette-c-symbol', expectedNumber: null, expectedString: 'I_SetPalette', expectedBoolean: null },
      { kind: 'i-finish-update-c-symbol', expectedNumber: null, expectedString: 'I_FinishUpdate', expectedBoolean: null },
      { kind: 'gamma-table-c-symbol', expectedNumber: null, expectedString: 'gammatable', expectedBoolean: null },
      { kind: 'use-gamma-c-symbol', expectedNumber: null, expectedString: 'usegamma', expectedBoolean: null },
      { kind: 'expand4-c-symbol', expectedNumber: null, expectedString: 'Expand4', expectedBoolean: null },
      { kind: 'expand4-broken-comment', expectedNumber: null, expectedString: 'Broken. Gotta fix this some day.', expectedBoolean: null },
      { kind: 'vanilla-uses-bilinear-filtering', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-trilinear-filtering', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-anisotropic-filtering', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-supports-fractional-scales', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-dithering', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-subpixel-rendering', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-blends-adjacent-pixels-on-upscale', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-alpha-channel-blending-at-blit', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-reuploads-palette-every-frame', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-applies-non-gamma-color-matrix', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-gpu-shader-at-blit', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-partial-rect-blits', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-holds-per-frame-vsync-gate', expectedNumber: null, expectedString: null, expectedBoolean: false },
      { kind: 'vanilla-uses-rgb-intermediate-before-blit', expectedNumber: null, expectedString: null, expectedBoolean: false },
    ];
    for (const { kind, expectedNumber, expectedString, expectedBoolean } of queryKinds) {
      const probe: VanillaPaletteBlitWithoutFilteringProbe = {
        id: `manual-derive-test-${kind}`,
        description: `Manual derive test for ${kind}.`,
        queryKind: kind,
        queryChannelIndex: null,
        queryPaletteEntryIndex: null,
        queryInputByte: null,
        queryMultiply: null,
        expectedAnsweredNumber: expectedNumber,
        expectedAnsweredString: expectedString,
        expectedAnsweredBoolean: expectedBoolean,
        witnessInvariantId: 'PALETTE_DIMENSIONS_LOCKED_AT_256_ENTRIES_3_BYTES_768_TOTAL',
      };
      const result = deriveExpectedVanillaPaletteBlitWithoutFilteringResult(probe);
      expect(result.answeredNumber).toBe(expectedNumber);
      expect(result.answeredString).toBe(expectedString);
      expect(result.answeredBoolean).toBe(expectedBoolean);
    }
  });
});

describe('implement-palette-blit-without-filtering step file', () => {
  test('declares the launch lane and the step write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/implement-palette-blit-without-filtering.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/implement-palette-blit-without-filtering.test.ts');
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
