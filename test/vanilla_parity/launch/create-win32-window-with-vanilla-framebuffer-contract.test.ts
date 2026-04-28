import { describe, expect, test } from 'bun:test';

import {
  AUDITED_CHOCOLATE_NEAREST_NEIGHBOR_HINT_VALUE,
  AUDITED_CHOCOLATE_RENDER_SCALE_QUALITY_HINT,
  AUDITED_DISPLAY_ASPECT_CORRECTED_HEIGHT,
  AUDITED_DISPLAY_ASPECT_STRETCH_DENOMINATOR,
  AUDITED_DISPLAY_ASPECT_STRETCH_NUMERATOR,
  AUDITED_DISPLAY_EIGHT_FIFTHS_RATIO,
  AUDITED_DISPLAY_FOUR_THIRDS_RATIO,
  AUDITED_FRAME_PRESENTATION_C_SYMBOL,
  AUDITED_INTERNAL_FRAMEBUFFER_BITS_PER_PIXEL,
  AUDITED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL,
  AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT,
  AUDITED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES,
  AUDITED_INTERNAL_FRAMEBUFFER_WIDTH,
  AUDITED_PALETTE_BYTES_PER_COLOR,
  AUDITED_PALETTE_COLOR_COUNT,
  AUDITED_PALETTE_SET_C_SYMBOL,
  AUDITED_PALETTE_TOTAL_BYTES,
  AUDITED_SCREENS_ALLOCATION_C_SYMBOL,
  AUDITED_VANILLA_SCREENS_SLOT_COUNT,
  AUDITED_VANILLA_VISIBLE_FRAMEBUFFER_SCREENS_INDEX,
  AUDITED_WINDOW_CREATION_C_SYMBOL,
  AUDITED_WINDOW_DESTRUCTION_C_SYMBOL,
  REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER,
  VANILLA_APPLIES_GPU_SHADER_OR_COLOR_CORRECTION,
  VANILLA_HAS_HARDWARE_VSYNC_GATE,
  VANILLA_MUTATES_WINDOW_DECORATIONS_AT_RUNTIME,
  VANILLA_PERFORMS_SUBPIXEL_RENDERING,
  VANILLA_RECREATES_WINDOW_MID_LIFETIME,
  VANILLA_SUPPORTS_FRACTIONAL_SCALES,
  VANILLA_SUPPORTS_HIDPI_SCALING,
  VANILLA_SUPPORTS_MULTI_MONITOR_SELECTION,
  VANILLA_USES_ARGB_INTERMEDIATE_TEXTURE,
  VANILLA_USES_DOUBLE_BUFFER_PINGPONG,
  VANILLA_USES_HARDWARE_FILTERING,
  VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITIONS,
  VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITION_COUNT,
  VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT,
  VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_CLAUSE_COUNT,
  VANILLA_WIN32_WINDOW_FRAMEBUFFER_DERIVED_INVARIANTS,
  VANILLA_WIN32_WINDOW_FRAMEBUFFER_DERIVED_INVARIANT_COUNT,
  VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES,
  VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBE_COUNT,
  crossCheckVanillaWin32WindowFramebuffer,
  deriveExpectedVanillaWin32WindowFramebufferResult,
} from '../../../src/bootstrap/create-win32-window-with-vanilla-framebuffer-contract.ts';
import type { VanillaWin32WindowFramebufferHandler, VanillaWin32WindowFramebufferProbe, VanillaWin32WindowFramebufferResult } from '../../../src/bootstrap/create-win32-window-with-vanilla-framebuffer-contract.ts';
import { ASPECT_CORRECTED_HEIGHT, ASPECT_STRETCH_RATIO, DISPLAY_ASPECT_RATIO, SCREENHEIGHT, SCREENWIDTH } from '../../../src/host/windowPolicy.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-012-create-win32-window-with-vanilla-framebuffer-contract.md';

describe('AUDITED canonical constants', () => {
  test('audited internal framebuffer width agrees with src/host/windowPolicy.ts SCREENWIDTH', () => {
    expect(AUDITED_INTERNAL_FRAMEBUFFER_WIDTH).toBe(320);
    expect(AUDITED_INTERNAL_FRAMEBUFFER_WIDTH).toBe(SCREENWIDTH);
  });

  test('audited internal framebuffer height agrees with src/host/windowPolicy.ts SCREENHEIGHT', () => {
    expect(AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT).toBe(200);
    expect(AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT).toBe(SCREENHEIGHT);
  });

  test('audited bits-per-pixel and bytes-per-pixel agree at 8 bits / 1 byte', () => {
    expect(AUDITED_INTERNAL_FRAMEBUFFER_BITS_PER_PIXEL).toBe(8);
    expect(AUDITED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL).toBe(1);
    expect(AUDITED_INTERNAL_FRAMEBUFFER_BITS_PER_PIXEL).toBe(AUDITED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL * 8);
  });

  test('audited total framebuffer bytes equals width * height * bytes-per-pixel', () => {
    expect(AUDITED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES).toBe(64_000);
    expect(AUDITED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES).toBe(AUDITED_INTERNAL_FRAMEBUFFER_WIDTH * AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT * AUDITED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL);
  });

  test('audited palette color count, bytes-per-color, and total bytes agree at 256 * 3 = 768', () => {
    expect(AUDITED_PALETTE_COLOR_COUNT).toBe(256);
    expect(AUDITED_PALETTE_BYTES_PER_COLOR).toBe(3);
    expect(AUDITED_PALETTE_TOTAL_BYTES).toBe(768);
    expect(AUDITED_PALETTE_TOTAL_BYTES).toBe(AUDITED_PALETTE_COLOR_COUNT * AUDITED_PALETTE_BYTES_PER_COLOR);
  });

  test('audited screens slot count is 4 with the visible framebuffer at index 0', () => {
    expect(AUDITED_VANILLA_SCREENS_SLOT_COUNT).toBe(4);
    expect(AUDITED_VANILLA_VISIBLE_FRAMEBUFFER_SCREENS_INDEX).toBe(0);
  });

  test('audited aspect-corrected height agrees with src/host/windowPolicy.ts ASPECT_CORRECTED_HEIGHT', () => {
    expect(AUDITED_DISPLAY_ASPECT_CORRECTED_HEIGHT).toBe(240);
    expect(AUDITED_DISPLAY_ASPECT_CORRECTED_HEIGHT).toBe(ASPECT_CORRECTED_HEIGHT);
    expect(AUDITED_DISPLAY_ASPECT_CORRECTED_HEIGHT).toBe(AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT * (AUDITED_DISPLAY_ASPECT_STRETCH_NUMERATOR / AUDITED_DISPLAY_ASPECT_STRETCH_DENOMINATOR));
  });

  test('audited aspect-stretch numerator and denominator agree with windowPolicy ASPECT_STRETCH_RATIO', () => {
    expect(AUDITED_DISPLAY_ASPECT_STRETCH_NUMERATOR).toBe(6);
    expect(AUDITED_DISPLAY_ASPECT_STRETCH_DENOMINATOR).toBe(5);
    expect(AUDITED_DISPLAY_ASPECT_STRETCH_NUMERATOR / AUDITED_DISPLAY_ASPECT_STRETCH_DENOMINATOR).toBe(ASPECT_STRETCH_RATIO);
  });

  test('audited four-thirds ratio agrees with src/host/windowPolicy.ts DISPLAY_ASPECT_RATIO', () => {
    expect(AUDITED_DISPLAY_FOUR_THIRDS_RATIO).toBe(4 / 3);
    expect(AUDITED_DISPLAY_FOUR_THIRDS_RATIO).toBe(DISPLAY_ASPECT_RATIO);
    expect(AUDITED_DISPLAY_FOUR_THIRDS_RATIO).toBe(AUDITED_INTERNAL_FRAMEBUFFER_WIDTH / AUDITED_DISPLAY_ASPECT_CORRECTED_HEIGHT);
  });

  test('audited eight-fifths ratio matches the unstretched 320:200 aspect', () => {
    expect(AUDITED_DISPLAY_EIGHT_FIFTHS_RATIO).toBe(8 / 5);
    expect(AUDITED_DISPLAY_EIGHT_FIFTHS_RATIO).toBe(AUDITED_INTERNAL_FRAMEBUFFER_WIDTH / AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT);
  });

  test('audited C symbols match the canonical i_video.c / v_video.c entry points', () => {
    expect(AUDITED_WINDOW_CREATION_C_SYMBOL).toBe('I_InitGraphics');
    expect(AUDITED_WINDOW_DESTRUCTION_C_SYMBOL).toBe('I_ShutdownGraphics');
    expect(AUDITED_FRAME_PRESENTATION_C_SYMBOL).toBe('I_FinishUpdate');
    expect(AUDITED_PALETTE_SET_C_SYMBOL).toBe('I_SetPalette');
    expect(AUDITED_SCREENS_ALLOCATION_C_SYMBOL).toBe('V_Init');
  });

  test('audited Chocolate-only nearest-neighbor hint value is the verbatim "nearest" string', () => {
    expect(AUDITED_CHOCOLATE_NEAREST_NEIGHBOR_HINT_VALUE).toBe('nearest');
    expect(AUDITED_CHOCOLATE_RENDER_SCALE_QUALITY_HINT).toBe('SDL_HINT_RENDER_SCALE_QUALITY');
  });
});

describe('VANILLA top-level booleans', () => {
  test('vanilla 1.9 does not use hardware filtering on the upscale', () => {
    expect(VANILLA_USES_HARDWARE_FILTERING).toBe(false);
  });

  test('vanilla 1.9 does not support fractional display scales', () => {
    expect(VANILLA_SUPPORTS_FRACTIONAL_SCALES).toBe(false);
  });

  test('vanilla 1.9 does not ping-pong double-buffers at the framebuffer level', () => {
    expect(VANILLA_USES_DOUBLE_BUFFER_PINGPONG).toBe(false);
  });

  test('vanilla 1.9 does not support HiDPI scaling', () => {
    expect(VANILLA_SUPPORTS_HIDPI_SCALING).toBe(false);
  });

  test('vanilla 1.9 does not perform sub-pixel rendering', () => {
    expect(VANILLA_PERFORMS_SUBPIXEL_RENDERING).toBe(false);
  });

  test('vanilla 1.9 has no hardware-vsync gate visible to the game logic', () => {
    expect(VANILLA_HAS_HARDWARE_VSYNC_GATE).toBe(false);
  });

  test('vanilla 1.9 does not mutate window decorations at runtime', () => {
    expect(VANILLA_MUTATES_WINDOW_DECORATIONS_AT_RUNTIME).toBe(false);
  });

  test('vanilla 1.9 does not destroy and re-create the host window during the game lifetime', () => {
    expect(VANILLA_RECREATES_WINDOW_MID_LIFETIME).toBe(false);
  });

  test('vanilla 1.9 does not support multi-monitor selection', () => {
    expect(VANILLA_SUPPORTS_MULTI_MONITOR_SELECTION).toBe(false);
  });

  test('vanilla 1.9 does not apply GPU shaders or color-correction transforms', () => {
    expect(VANILLA_APPLIES_GPU_SHADER_OR_COLOR_CORRECTION).toBe(false);
  });

  test('vanilla 1.9 does not interpose a 32-bit ARGB intermediate texture', () => {
    expect(VANILLA_USES_ARGB_INTERMEDIATE_TEXTURE).toBe(false);
  });
});

describe('VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly thirty-two contract clauses', () => {
    expect(VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.length).toBe(32);
    expect(VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.length).toBe(VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_CLAUSE_COUNT);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references a real reference source file and a canonical C symbol', () => {
    for (const entry of VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT) {
      expect(['i_video.c', 'v_video.c', 'd_main.c', 'm_menu.c']).toContain(entry.referenceSourceFile);
      expect(['I_InitGraphics', 'I_FinishUpdate', 'I_ShutdownGraphics', 'I_SetPalette', 'V_Init', 'D_DoomLoop', 'D_DoomMain', 'M_Init']).toContain(entry.cSymbol);
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the INTERNAL_FRAMEBUFFER_WIDTH_IS_320 clause cites VGA mode 13h and the renderer call sites', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'INTERNAL_FRAMEBUFFER_WIDTH_IS_320');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('320');
    expect(entry!.invariant).toContain('VGA mode 13h');
    expect(entry!.invariant).toContain('R_DrawColumn');
  });

  test('the INTERNAL_FRAMEBUFFER_FORMAT_IS_8_BIT_INDEXED clause cites the canonical SDL pixel format and the X11 visual', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'INTERNAL_FRAMEBUFFER_FORMAT_IS_8_BIT_INDEXED');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('SDL_PIXELFORMAT_INDEX8');
    expect(entry!.invariant).toContain('PseudoColor');
    expect(entry!.invariant).toContain('8 bits per pixel');
  });

  test('the PALETTE_COLOR_COUNT_IS_256 clause cites PLAYPAL banks', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'PALETTE_COLOR_COUNT_IS_256');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('PLAYPAL');
    expect(entry!.invariant).toContain('256');
    expect(entry!.invariant).toContain('SDL_SetPaletteColors');
  });

  test('the PALETTE_LIVES_IN_PLAYPAL_LUMP_AS_RAW_RGB_TRIPLES clause cites the absence of header / sRGB gamma', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'PALETTE_LIVES_IN_PLAYPAL_LUMP_AS_RAW_RGB_TRIPLES');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('sRGB');
    expect(entry!.invariant).toContain('05-005');
    expect(entry!.invariant).toContain('endianness');
  });

  test('the FRAMEBUFFER_LIVES_IN_SCREENS_ZERO_VIA_V_INIT clause cites screens[0] consumers', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'FRAMEBUFFER_LIVES_IN_SCREENS_ZERO_VIA_V_INIT');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('screens[0]');
    expect(entry!.invariant).toContain('R_DrawColumn');
    expect(entry!.invariant).toContain('I_FinishUpdate');
  });

  test('the SCREENS_ARRAY_HAS_FOUR_SLOTS_IN_VANILLA clause cites status bar, automap, and intermission consumers', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'SCREENS_ARRAY_HAS_FOUR_SLOTS_IN_VANILLA');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('status-bar');
    expect(entry!.invariant).toContain('automap');
    expect(entry!.invariant).toContain('intermission');
    expect(entry!.invariant).toContain('R_Init');
    expect(entry!.invariant).toContain('ST_Init');
    expect(entry!.invariant).toContain('AM_Init');
  });

  test('the DISPLAY_ASPECT_CORRECTED_HEIGHT_IS_240 clause cites Chocolate doomtype.h SCREENHEIGHT_4_3', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'DISPLAY_ASPECT_CORRECTED_HEIGHT_IS_240');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('SCREENHEIGHT_4_3');
    expect(entry!.invariant).toContain('aspect_ratio_correct');
    expect(entry!.invariant).toContain('5:6');
  });

  test('the DISPLAY_UPSCALE_IS_INTEGER_NEAREST_NEIGHBOR clause cites the SDL hint and the X11 mechanism', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'DISPLAY_UPSCALE_IS_INTEGER_NEAREST_NEIGHBOR');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('SDL_HINT_RENDER_SCALE_QUALITY=nearest');
    expect(entry!.invariant).toContain('XShmPutImage');
    expect(entry!.invariant).toContain('bilinear');
  });

  test('the WINDOW_CREATED_BY_I_INITGRAPHICS_DURING_D_DOOMLOOP_ENTRY clause cites step 03-009', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'WINDOW_CREATED_BY_I_INITGRAPHICS_DURING_D_DOOMLOOP_ENTRY');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('03-009');
    expect(entry!.invariant).toContain('I_InitGraphics');
    expect(entry!.invariant).toContain('D_DoomLoop');
  });

  test('the WINDOW_CREATED_AFTER_ALL_D_DOOMMAIN_INIT_PHASES_COMPLETE clause cites step 03-008 and the 12 init phases', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'WINDOW_CREATED_AFTER_ALL_D_DOOMMAIN_INIT_PHASES_COMPLETE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('03-008');
    expect(entry!.invariant).toContain('V_Init');
    expect(entry!.invariant).toContain('R_Init');
    expect(entry!.invariant).toContain('PLAYPAL');
  });

  test('the WINDOW_DESTROYED_BY_I_SHUTDOWNGRAPHICS_AT_QUIT_OR_ERROR clause cites steps 03-010 and 03-011', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'WINDOW_DESTROYED_BY_I_SHUTDOWNGRAPHICS_AT_QUIT_OR_ERROR');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('03-010');
    expect(entry!.invariant).toContain('03-011');
    expect(entry!.invariant).toContain('I_Quit');
    expect(entry!.invariant).toContain('I_Error');
  });

  test('the PRESENTATION_IS_SINGLE_BUFFERED_VIA_I_FINISHUPDATE clause cites screens[BACK] absence and SwapBuffers', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'PRESENTATION_IS_SINGLE_BUFFERED_VIA_I_FINISHUPDATE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('screens[BACK]');
    expect(entry!.invariant).toContain('SwapBuffers');
    expect(entry!.invariant).toContain('single-buffered');
  });

  test('the NO_GPU_SHADER_OR_COLOR_CORRECTION_IN_VANILLA clause cites VGA 0xA0000 and CRT-emulation shader', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'NO_GPU_SHADER_OR_COLOR_CORRECTION_IN_VANILLA');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('0xA0000');
    expect(entry!.invariant).toContain('CRT-emulation shader');
    expect(entry!.invariant).toContain('sRGB-to-linear');
  });

  test('the NO_FRACTIONAL_OR_HIDPI_SCALES_IN_VANILLA clause cites Windows DPI scaling', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'NO_FRACTIONAL_OR_HIDPI_SCALES_IN_VANILLA');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('1.5x');
    expect(entry!.invariant).toContain('Windows DPI');
    expect(entry!.invariant).toContain('Retina');
  });

  test('the CHOCOLATE_ONLY_ARGBBUFFER_INTERMEDIATE_NOT_IN_VANILLA clause cites SDL_CreateRGBSurface', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'CHOCOLATE_ONLY_ARGBBUFFER_INTERMEDIATE_NOT_IN_VANILLA');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('argbbuffer');
    expect(entry!.invariant).toContain('SDL_CreateRGBSurface');
    expect(entry!.invariant).toContain('SDL_UpdateTexture');
  });

  test('the CHOCOLATE_ONLY_SDL_HINT_NEAREST_NEIGHBOR_NOT_IN_VANILLA clause cites the verbatim hint name', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'CHOCOLATE_ONLY_SDL_HINT_NEAREST_NEIGHBOR_NOT_IN_VANILLA');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('SDL_HINT_RENDER_SCALE_QUALITY');
    expect(entry!.invariant).toContain('"nearest"');
    expect(entry!.invariant).toContain('SDL_RenderCopy');
  });

  test('the CHOCOLATE_ONLY_RESIZE_HANDLER_NOT_IN_VANILLA clause cites step 03-017', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'CHOCOLATE_ONLY_RESIZE_HANDLER_NOT_IN_VANILLA');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('03-017');
    expect(entry!.invariant).toContain('XSizeHints');
    expect(entry!.invariant).toContain('ConfigureNotify');
  });

  test('the CHOCOLATE_ONLY_FULLSCREEN_TOGGLE_NOT_IN_VANILLA clause cites step 03-019 and Alt+Enter', () => {
    const entry = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.find((clause) => clause.id === 'CHOCOLATE_ONLY_FULLSCREEN_TOGGLE_NOT_IN_VANILLA');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('03-019');
    expect(entry!.invariant).toContain('Alt+Enter');
    expect(entry!.invariant).toContain('SDL_WINDOW_FULLSCREEN_DESKTOP');
  });

  test('every i_video.c-pinned clause cites a canonical i_video.c entry point', () => {
    const iVideoClauses = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.filter((entry) => entry.referenceSourceFile === 'i_video.c');
    for (const clause of iVideoClauses) {
      expect(['I_InitGraphics', 'I_FinishUpdate', 'I_ShutdownGraphics', 'I_SetPalette']).toContain(clause.cSymbol);
    }
  });

  test('every v_video.c-pinned clause cites V_Init', () => {
    const vVideoClauses = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.filter((entry) => entry.referenceSourceFile === 'v_video.c');
    for (const clause of vVideoClauses) {
      expect(clause.cSymbol).toBe('V_Init');
    }
  });

  test('every d_main.c-pinned clause cites D_DoomLoop or D_DoomMain', () => {
    const dMainClauses = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.filter((entry) => entry.referenceSourceFile === 'd_main.c');
    expect(dMainClauses.length).toBeGreaterThan(0);
    for (const clause of dMainClauses) {
      expect(['D_DoomLoop', 'D_DoomMain']).toContain(clause.cSymbol);
    }
  });

  test('every m_menu.c-pinned clause cites M_Init', () => {
    const mMenuClauses = VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT.filter((entry) => entry.referenceSourceFile === 'm_menu.c');
    for (const clause of mMenuClauses) {
      expect(clause.cSymbol).toBe('M_Init');
    }
  });
});

describe('VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITIONS list', () => {
  test('has exactly four Chocolate-only additions', () => {
    expect(VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITIONS.length).toBe(4);
    expect(VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITIONS.length).toBe(VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITION_COUNT);
  });

  test('lists every Chocolate-only addition referenced by the audit ledger', () => {
    expect([...VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITIONS]).toEqual(['argbbuffer', 'SDL_HINT_RENDER_SCALE_QUALITY', 'resize-handler', 'fullscreen-toggle']);
  });
});

describe('VANILLA_WIN32_WINDOW_FRAMEBUFFER_DERIVED_INVARIANTS list', () => {
  test('has exactly twelve derived invariants', () => {
    expect(VANILLA_WIN32_WINDOW_FRAMEBUFFER_DERIVED_INVARIANTS.length).toBe(12);
    expect(VANILLA_WIN32_WINDOW_FRAMEBUFFER_DERIVED_INVARIANTS.length).toBe(VANILLA_WIN32_WINDOW_FRAMEBUFFER_DERIVED_INVARIANT_COUNT);
  });

  test('every invariant id is unique', () => {
    const ids = VANILLA_WIN32_WINDOW_FRAMEBUFFER_DERIVED_INVARIANTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every invariant declares a non-empty description', () => {
    for (const entry of VANILLA_WIN32_WINDOW_FRAMEBUFFER_DERIVED_INVARIANTS) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES probe set', () => {
  test('has exactly thirty-five pinned probes', () => {
    expect(VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES.length).toBe(35);
    expect(VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES.length).toBe(VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBE_COUNT);
  });

  test('every probe id is unique', () => {
    const ids = VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe witness invariant id matches a derived invariant', () => {
    const derivedIds = new Set(VANILLA_WIN32_WINDOW_FRAMEBUFFER_DERIVED_INVARIANTS.map((entry) => entry.id));
    for (const probe of VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES) {
      expect(derivedIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });

  test('every probe sets exactly one of the four expected-* fields', () => {
    for (const probe of VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES) {
      const setFieldCount = [probe.expectedAnsweredCSymbol, probe.expectedAnsweredNumber, probe.expectedAnsweredRatio, probe.expectedAnsweredBoolean].filter((field) => field !== null).length;
      expect(setFieldCount).toBe(1);
    }
  });

  test('every chocolate-addition probe has a non-null queryChocolateAddition argument', () => {
    const chocolateAdditionProbes = VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES.filter((probe) => probe.queryKind === 'vanilla-includes-chocolate-addition');
    expect(chocolateAdditionProbes.length).toBe(4);
    for (const probe of chocolateAdditionProbes) {
      expect(probe.queryChocolateAddition).not.toBeNull();
      expect(VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITIONS).toContain(probe.queryChocolateAddition!);
      expect(probe.expectedAnsweredBoolean).toBe(false);
    }
  });

  test('every numeric probe expectation agrees with the audited canonical constants', () => {
    const expectations = new Map<string, number>([
      ['framebuffer-width-is-320', AUDITED_INTERNAL_FRAMEBUFFER_WIDTH],
      ['framebuffer-height-is-200', AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT],
      ['framebuffer-bits-per-pixel-is-eight', AUDITED_INTERNAL_FRAMEBUFFER_BITS_PER_PIXEL],
      ['framebuffer-bytes-per-pixel-is-one', AUDITED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL],
      ['framebuffer-total-bytes-is-64000', AUDITED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES],
      ['palette-color-count-is-256', AUDITED_PALETTE_COLOR_COUNT],
      ['palette-bytes-per-color-is-three', AUDITED_PALETTE_BYTES_PER_COLOR],
      ['palette-total-bytes-is-768', AUDITED_PALETTE_TOTAL_BYTES],
      ['screens-slot-count-is-four', AUDITED_VANILLA_SCREENS_SLOT_COUNT],
      ['screens-visible-index-is-zero', AUDITED_VANILLA_VISIBLE_FRAMEBUFFER_SCREENS_INDEX],
      ['display-aspect-corrected-height-is-240', AUDITED_DISPLAY_ASPECT_CORRECTED_HEIGHT],
      ['display-aspect-stretch-numerator-is-six', AUDITED_DISPLAY_ASPECT_STRETCH_NUMERATOR],
      ['display-aspect-stretch-denominator-is-five', AUDITED_DISPLAY_ASPECT_STRETCH_DENOMINATOR],
    ]);

    for (const [probeId, expected] of expectations) {
      const probe = VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES.find((entry) => entry.id === probeId);
      expect(probe).toBeDefined();
      expect(probe!.expectedAnsweredNumber).toBe(expected);
    }
  });
});

describe('REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER reference handler', () => {
  test('passes every pinned probe with zero failures', () => {
    const failures = crossCheckVanillaWin32WindowFramebuffer(REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER);
    expect(failures).toEqual([]);
  });

  test('answers framebuffer-width with 320', () => {
    const result = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe({
      id: 'manual-width-probe',
      description: 'Width probe.',
      queryKind: 'framebuffer-width',
      queryChocolateAddition: null,
      expectedAnsweredCSymbol: null,
      expectedAnsweredNumber: 320,
      expectedAnsweredRatio: null,
      expectedAnsweredBoolean: null,
      witnessInvariantId: 'FRAMEBUFFER_DIMENSIONS_ARE_320_BY_200',
    });
    expect(result.answeredNumber).toBe(320);
    expect(result.answeredCSymbol).toBeNull();
    expect(result.answeredRatio).toBeNull();
    expect(result.answeredBoolean).toBeNull();
  });

  test('answers vanilla-includes-chocolate-addition false for every absent Chocolate addition', () => {
    for (const additionName of VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITIONS) {
      const result = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe({
        id: `manual-chocolate-addition-${additionName}`,
        description: `Manual probe for ${additionName}.`,
        queryKind: 'vanilla-includes-chocolate-addition',
        queryChocolateAddition: additionName,
        expectedAnsweredCSymbol: null,
        expectedAnsweredNumber: null,
        expectedAnsweredRatio: null,
        expectedAnsweredBoolean: false,
        witnessInvariantId: 'VANILLA_OMITS_ALL_LISTED_CHOCOLATE_ADDITIONS',
      });
      expect(result.answeredBoolean).toBe(false);
    }
  });

  test('answers vanilla-includes-chocolate-addition true for an unknown name (positive control)', () => {
    const result = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe({
      id: 'manual-unknown-addition',
      description: 'Manual probe for an unknown chocolate addition (should report present).',
      queryKind: 'vanilla-includes-chocolate-addition',
      queryChocolateAddition: 'unknown-chocolate-addition-name',
      expectedAnsweredCSymbol: null,
      expectedAnsweredNumber: null,
      expectedAnsweredRatio: null,
      expectedAnsweredBoolean: true,
      witnessInvariantId: 'VANILLA_OMITS_ALL_LISTED_CHOCOLATE_ADDITIONS',
    });
    expect(result.answeredBoolean).toBe(true);
  });
});

describe('crossCheckVanillaWin32WindowFramebuffer tampered candidates', () => {
  test('detects a handler that reports the wrong framebuffer width (200 instead of 320)', () => {
    const wrongWidth: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'framebuffer-width') {
          return Object.freeze({ ...inner, answeredNumber: 200 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(wrongWidth);
    expect(failures.some((failure) => failure.startsWith('probe:framebuffer-width-is-320:answeredNumber:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the wrong framebuffer total bytes (320 * 200 * 2 = 128000)', () => {
    const wrongTotalBytes: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'framebuffer-total-bytes') {
          return Object.freeze({ ...inner, answeredNumber: 128_000 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(wrongTotalBytes);
    expect(failures.some((failure) => failure.startsWith('probe:framebuffer-total-bytes-is-64000:answeredNumber:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the wrong palette color count (16 instead of 256)', () => {
    const wrongPaletteCount: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'palette-color-count') {
          return Object.freeze({ ...inner, answeredNumber: 16 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(wrongPaletteCount);
    expect(failures.some((failure) => failure.startsWith('probe:palette-color-count-is-256:answeredNumber:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the wrong screens slot count (1 instead of 4)', () => {
    const wrongScreensCount: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'screens-slot-count') {
          return Object.freeze({ ...inner, answeredNumber: 1 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(wrongScreensCount);
    expect(failures.some((failure) => failure.startsWith('probe:screens-slot-count-is-four:answeredNumber:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the wrong aspect-corrected height (200 instead of 240)', () => {
    const wrongAspectHeight: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'display-aspect-corrected-height') {
          return Object.freeze({ ...inner, answeredNumber: 200 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(wrongAspectHeight);
    expect(failures.some((failure) => failure.startsWith('probe:display-aspect-corrected-height-is-240:answeredNumber:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the wrong corrected aspect ratio (16:9 instead of 4:3)', () => {
    const wrongAspectRatio: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'display-corrected-aspect-ratio') {
          return Object.freeze({ ...inner, answeredRatio: 16 / 9 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(wrongAspectRatio);
    expect(failures.some((failure) => failure.startsWith('probe:display-corrected-aspect-ratio-is-four-thirds:answeredRatio:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the wrong window-creation symbol (R_Init instead of I_InitGraphics)', () => {
    const wrongCreationSymbol: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'window-creation-c-symbol') {
          return Object.freeze({ ...inner, answeredCSymbol: 'R_Init' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(wrongCreationSymbol);
    expect(failures.some((failure) => failure.startsWith('probe:window-creation-symbol-is-i-initgraphics:answeredCSymbol:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports vanilla 1.9 as using hardware filtering', () => {
    const hwFiltering: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'vanilla-uses-hardware-filtering') {
          return Object.freeze({ ...inner, answeredBoolean: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(hwFiltering);
    expect(failures.some((failure) => failure.startsWith('probe:vanilla-does-not-use-hardware-filtering:answeredBoolean:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports vanilla 1.9 as supporting fractional scales', () => {
    const fractionalScales: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'vanilla-supports-fractional-scales') {
          return Object.freeze({ ...inner, answeredBoolean: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(fractionalScales);
    expect(failures.some((failure) => failure.startsWith('probe:vanilla-does-not-support-fractional-scales:answeredBoolean:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports vanilla 1.9 as recreating the window mid-lifetime', () => {
    const recreatingWindow: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'vanilla-recreates-window-mid-lifetime') {
          return Object.freeze({ ...inner, answeredBoolean: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(recreatingWindow);
    expect(failures.some((failure) => failure.startsWith('probe:vanilla-does-not-recreate-window-mid-lifetime:answeredBoolean:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the argbbuffer Chocolate addition as present in vanilla', () => {
    const argbBufferPresent: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'vanilla-includes-chocolate-addition' && probe.queryChocolateAddition === 'argbbuffer') {
          return Object.freeze({ ...inner, answeredBoolean: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(argbBufferPresent);
    expect(failures.some((failure) => failure.startsWith('probe:vanilla-omits-argbbuffer-chocolate-addition:answeredBoolean:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the SDL nearest-neighbor hint Chocolate addition as present in vanilla', () => {
    const sdlHintPresent: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'vanilla-includes-chocolate-addition' && probe.queryChocolateAddition === 'SDL_HINT_RENDER_SCALE_QUALITY') {
          return Object.freeze({ ...inner, answeredBoolean: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(sdlHintPresent);
    expect(failures.some((failure) => failure.startsWith('probe:vanilla-omits-sdl-render-scale-quality-hint:answeredBoolean:value-mismatch'))).toBe(true);
  });

  test('detects a handler that drops the resize-handler omission (reports it as present in vanilla)', () => {
    const resizePresent: VanillaWin32WindowFramebufferHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'vanilla-includes-chocolate-addition' && probe.queryChocolateAddition === 'resize-handler') {
          return Object.freeze({ ...inner, answeredBoolean: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWin32WindowFramebuffer(resizePresent);
    expect(failures.some((failure) => failure.startsWith('probe:vanilla-omits-resize-handler:answeredBoolean:value-mismatch'))).toBe(true);
  });
});

describe('deriveExpectedVanillaWin32WindowFramebufferResult helper', () => {
  test('matches the reference handler answer for every pinned probe', () => {
    for (const probe of VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES) {
      const derived: VanillaWin32WindowFramebufferResult = deriveExpectedVanillaWin32WindowFramebufferResult(probe);
      const reference: VanillaWin32WindowFramebufferResult = REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER.runProbe(probe);
      expect(derived.answeredCSymbol).toBe(reference.answeredCSymbol);
      expect(derived.answeredNumber).toBe(reference.answeredNumber);
      expect(derived.answeredRatio).toBe(reference.answeredRatio);
      expect(derived.answeredBoolean).toBe(reference.answeredBoolean);
    }
  });

  test('returns the same answer for an arbitrary user-constructed probe of every query kind', () => {
    const queryKinds: ReadonlyArray<{
      kind: VanillaWin32WindowFramebufferProbe['queryKind'];
      expectedNumber: number | null;
      expectedSymbol: string | null;
      expectedRatio: number | null;
      expectedBoolean: boolean | null;
      chocolateAddition?: string;
    }> = [
      { kind: 'framebuffer-width', expectedNumber: 320, expectedSymbol: null, expectedRatio: null, expectedBoolean: null },
      { kind: 'framebuffer-height', expectedNumber: 200, expectedSymbol: null, expectedRatio: null, expectedBoolean: null },
      { kind: 'screens-slot-count', expectedNumber: 4, expectedSymbol: null, expectedRatio: null, expectedBoolean: null },
      { kind: 'window-creation-c-symbol', expectedNumber: null, expectedSymbol: 'I_InitGraphics', expectedRatio: null, expectedBoolean: null },
      { kind: 'display-corrected-aspect-ratio', expectedNumber: null, expectedSymbol: null, expectedRatio: 4 / 3, expectedBoolean: null },
      { kind: 'vanilla-uses-hardware-filtering', expectedNumber: null, expectedSymbol: null, expectedRatio: null, expectedBoolean: false },
      { kind: 'vanilla-includes-chocolate-addition', expectedNumber: null, expectedSymbol: null, expectedRatio: null, expectedBoolean: false, chocolateAddition: 'argbbuffer' },
    ];
    for (const { kind, expectedNumber, expectedSymbol, expectedRatio, expectedBoolean, chocolateAddition } of queryKinds) {
      const probe: VanillaWin32WindowFramebufferProbe = {
        id: `manual-derive-test-${kind}`,
        description: `Manual derive test for ${kind}.`,
        queryKind: kind,
        queryChocolateAddition: chocolateAddition ?? null,
        expectedAnsweredCSymbol: expectedSymbol,
        expectedAnsweredNumber: expectedNumber,
        expectedAnsweredRatio: expectedRatio,
        expectedAnsweredBoolean: expectedBoolean,
        witnessInvariantId: 'FRAMEBUFFER_DIMENSIONS_ARE_320_BY_200',
      };
      const result = deriveExpectedVanillaWin32WindowFramebufferResult(probe);
      expect(result.answeredNumber).toBe(expectedNumber);
      expect(result.answeredCSymbol).toBe(expectedSymbol);
      expect(result.answeredRatio).toBe(expectedRatio);
      expect(result.answeredBoolean).toBe(expectedBoolean);
    }
  });
});

describe('create-win32-window-with-vanilla-framebuffer-contract step file', () => {
  test('declares the launch lane and the step write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/create-win32-window-with-vanilla-framebuffer-contract.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/create-win32-window-with-vanilla-framebuffer-contract.test.ts');
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
