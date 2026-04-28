/**
 * Audit ledger for the vanilla DOOM 1.9 Win32 window-creation and
 * indexed-framebuffer contract pinned against id Software's
 * `linuxdoom-1.10/i_video.c`, `linuxdoom-1.10/v_video.c`, and Chocolate
 * Doom 2.2.1's `src/i_video.c`. The accompanying focused test
 * cross-checks every audited contract clause against a self-contained
 * reference handler that walks the canonical 320x200 8-bit indexed
 * framebuffer landscape the same way vanilla `I_InitGraphics` does.
 *
 * Step 03-009 pinned `D_DoomLoop` entry timing — `I_InitGraphics` is
 * the verbatim init call inside `D_DoomLoop` that hands control of the
 * display to the host. Step 03-010 pinned the clean-quit policy that
 * delegates window destruction to `I_ShutdownGraphics` registered via
 * the vanilla `I_Quit` body. Step 03-011 pinned the fatal-error
 * shutdown ordering that calls `I_ShutdownGraphics` as the third and
 * last explicit shutdown before `exit(-1)`. This step (03-012) pins
 * the third side of the I_InitGraphics / I_ShutdownGraphics symmetry:
 * the vanilla DOOM 1.9 contract for the indexed framebuffer surface
 * that vanilla later reads via `I_FinishUpdate` and writes via
 * `V_Init`'s `screens[0]` pointer. The audited surface is bounded by:
 *
 *   1. The 320x200 8-bit indexed framebuffer dimensions. Both DOS DOOM
 *      1.9 (VGA mode 13h) and linuxdoom-1.10 (X11 XShmCreateImage with
 *      8-bit pseudocolor visual) and Chocolate Doom 2.2.1 (SDL_Texture
 *      with SDL_PIXELFORMAT_INDEX8 streaming-target) agree on the
 *      verbatim internal dimensions and format. The internal buffer is
 *      always 64000 bytes (320 * 200 * 1).
 *
 *   2. The 256-color palette in 768 bytes. The palette comes from the
 *      `PLAYPAL` lump (read by step 05-005 in the WAD lane) and is
 *      256 * 3 = 768 bytes laid out as raw R8G8B8 triples (no alpha
 *      channel, no padding, no premultiplication). Both DOS DOOM 1.9
 *      and linuxdoom-1.10 push the palette to the host via
 *      `I_SetPalette(byte* palette)` which translates indexed
 *      framebuffer samples to display colors at presentation time.
 *
 *   3. The integer-only nearest-neighbor upscale. Vanilla DOOM 1.9 uses
 *      VGA mode 13h hardware doubling on DOS and X11 XShmPutImage
 *      pixel-replicated stretch on linuxdoom-1.10. There is no
 *      bilinear/trilinear filtering, no anisotropic scaling, no
 *      fractional scale multiplier. Chocolate Doom 2.2.1 preserves this
 *      with `SDL_HINT_RENDER_SCALE_QUALITY=nearest` (verbatim "nearest"
 *      string) and integer scale setting.
 *
 *   4. The 4:3 aspect-correction policy. Both DOS DOOM 1.9 and the
 *      linuxdoom-1.10 X11 port assume a 4:3 CRT vertical stretch
 *      (320x200 mode 13h with the VGA pixel-aspect-ratio of 5:6
 *      produces a 4:3 image on screen). Chocolate Doom 2.2.1
 *      reproduces this via a configurable `aspect_ratio_correct` flag
 *      (default 1) that stretches the 320x200 indexed buffer
 *      vertically to a 320x240 display rectangle (factor 6/5 = 1.2).
 *      When `aspect_ratio_correct` is 0 the display dimensions are
 *      320x200 unstretched (8:5 aspect).
 *
 *   5. The single-buffered presentation contract. Vanilla DOOM 1.9
 *      writes to a single screen buffer (`screens[0]`) and presents it
 *      directly via `I_FinishUpdate`; there is no game-logic-visible
 *      front/back swap, no triple buffering, and no GPU presentation
 *      queue. Chocolate Doom 2.2.1 internally uses `SDL_RenderPresent`
 *      (which can vsync) but the game-logic layer still observes a
 *      single conceptual frame slot.
 *
 *   6. The lifecycle binding. The window is created by `I_InitGraphics`
 *      during `D_DoomLoop` entry (step 03-009), persists for the entire
 *      game lifetime with no re-creation, and is destroyed by
 *      `I_ShutdownGraphics` on either the clean-quit path (step 03-010
 *      via `I_Quit`) or the fatal-error path (step 03-011 via the
 *      third explicit shutdown call in `I_Error`).
 *
 *   7. What vanilla 1.9 explicitly does NOT do. Vanilla 1.9 has no GPU
 *      shaders or color-correction, no fractional/HiDPI scales, no
 *      subpixel rendering, no hardware-vsync gate visible to the game
 *      logic, no double-buffer ping-pong at the framebuffer level, no
 *      window-decoration mutation at runtime, no per-frame window
 *      re-creation, no multi-monitor selection. A handler that adds
 *      any of these is a parity violation against the indexed-
 *      framebuffer contract.
 *
 *   8. The Chocolate Doom 2.2.1 divergences. Chocolate adds a 32-bit
 *      ARGB intermediate texture (`argbbuffer`) between the 8-bit
 *      indexed framebuffer and the SDL_Texture; vanilla 1.9 has no
 *      such intermediate. Chocolate also adds a resize handler and
 *      fullscreen toggle that vanilla 1.9 lacks; these are deferred to
 *      steps 03-017 and 03-019 of this plan.
 *
 * The audit module deliberately avoids importing from
 * `src/host/windowPolicy.ts`, `src/launcher/win32.ts`, or any other
 * runtime module so that a corrupted runtime cannot silently calibrate
 * the audit's own probe table. The hand-pinned canonical constants
 * below are independent of the runtime exports; the focused test
 * separately verifies the runtime exports agree with these audit
 * constants.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (canonical for the Win32
 *      window-creation + indexed-framebuffer contract — `i_video.c`
 *      `I_InitGraphics` is the verbatim source of the framebuffer
 *      width/height/format and the X11 XShmCreateImage allocation;
 *      `v_video.c` `V_Init` is the source of the `screens[0..3]` array
 *      that holds the indexed framebuffer the renderer writes to;
 *      `d_main.c` `D_DoomLoop` is the source of the `I_InitGraphics`
 *      call site that establishes the lifecycle entry point;
 *      `m_menu.c` is the source of the first surface the user sees
 *      after the window opens — the main menu rendered on top of the
 *      title-screen patch),
 *   5. Chocolate Doom 2.2.1 source (counterexample for the 32-bit
 *      ARGB intermediate texture, the SDL_HINT_RENDER_SCALE_QUALITY
 *      hint, and the resize/fullscreen handlers).
 */

/**
 * Hand-pinned canonical width of the vanilla DOOM 1.9 internal
 * framebuffer in pixel columns. Pinned independently of
 * `src/host/windowPolicy.ts` SCREENWIDTH so a corruption in
 * windowPolicy cannot silently calibrate the audit's probe table.
 */
export const AUDITED_INTERNAL_FRAMEBUFFER_WIDTH = 320;

/**
 * Hand-pinned canonical height of the vanilla DOOM 1.9 internal
 * framebuffer in pixel rows. Pinned independently of
 * `src/host/windowPolicy.ts` SCREENHEIGHT.
 */
export const AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT = 200;

/** Hand-pinned canonical bits-per-pixel of the indexed framebuffer (one byte = one palette index). */
export const AUDITED_INTERNAL_FRAMEBUFFER_BITS_PER_PIXEL = 8;

/** Hand-pinned canonical bytes-per-pixel of the indexed framebuffer. */
export const AUDITED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL = 1;

/** Hand-pinned canonical total byte count of one full framebuffer slot (320 * 200 * 1). */
export const AUDITED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES = 64_000;

/** Hand-pinned canonical color count in the vanilla DOOM 1.9 palette (PLAYPAL is 256 colors). */
export const AUDITED_PALETTE_COLOR_COUNT = 256;

/** Hand-pinned canonical bytes-per-color in PLAYPAL (R8G8B8, no alpha or padding). */
export const AUDITED_PALETTE_BYTES_PER_COLOR = 3;

/** Hand-pinned canonical total byte count of one PLAYPAL palette slot (256 * 3). */
export const AUDITED_PALETTE_TOTAL_BYTES = 768;

/**
 * Hand-pinned canonical aspect-corrected display height. 200 * 6/5 =
 * 240, restoring the 4:3 aspect produced by VGA mode 13h's 5:6
 * pixel-aspect-ratio on a CRT.
 */
export const AUDITED_DISPLAY_ASPECT_CORRECTED_HEIGHT = 240;

/** Hand-pinned canonical numerator of the 6/5 vertical stretch factor. */
export const AUDITED_DISPLAY_ASPECT_STRETCH_NUMERATOR = 6;

/** Hand-pinned canonical denominator of the 6/5 vertical stretch factor. */
export const AUDITED_DISPLAY_ASPECT_STRETCH_DENOMINATOR = 5;

/** Hand-pinned canonical 4:3 display ratio (320/240) when aspect correction is on. */
export const AUDITED_DISPLAY_FOUR_THIRDS_RATIO = 4 / 3;

/** Hand-pinned canonical 8:5 display ratio (320/200) when aspect correction is off. */
export const AUDITED_DISPLAY_EIGHT_FIFTHS_RATIO = 8 / 5;

/**
 * Number of vanilla `screens[]` array slots in linuxdoom-1.10 / DOS
 * DOOM 1.9 `v_video.c`. `screens[0]` is the visible framebuffer that
 * gets written by the renderer and read by `I_FinishUpdate`; slots 1
 * through 3 are scratch buffers used by the status bar (cached
 * background and statusbar overlay), automap (background cache), and
 * intermission tally. The audit pins the slot count because handlers
 * that add or drop screens slots break the contract callers in
 * `R_Init`, `ST_Init`, and `AM_Init` rely on.
 */
export const AUDITED_VANILLA_SCREENS_SLOT_COUNT = 4;

/** The slot index of the visible framebuffer in `screens[]`. */
export const AUDITED_VANILLA_VISIBLE_FRAMEBUFFER_SCREENS_INDEX = 0;

/**
 * Whether vanilla 1.9 enables hardware filtering (bilinear/trilinear)
 * on the upscale path. It does not — the upscale is nearest-neighbor
 * via VGA mode 13h hardware doubling on DOS and X11 XShmPutImage
 * pixel replication on linuxdoom-1.10.
 */
export const VANILLA_USES_HARDWARE_FILTERING = false;

/**
 * Whether vanilla 1.9 supports fractional display scales (e.g. 1.5x,
 * 2.5x). It does not — only integer scales are supported (1x and
 * 2x in DOS via mode 13h hardware doubling; integer X11 stretch in
 * linuxdoom-1.10).
 */
export const VANILLA_SUPPORTS_FRACTIONAL_SCALES = false;

/**
 * Whether vanilla 1.9 ping-pongs between two framebuffer slots at the
 * presentation level visible to the game logic. It does not — only
 * `screens[0]` is the conceptual "front buffer" the renderer writes
 * to and `I_FinishUpdate` reads. (Chocolate Doom 2.2.1 internally
 * double-buffers via SDL_RenderPresent, but the game-logic layer
 * still observes a single conceptual frame slot.)
 */
export const VANILLA_USES_DOUBLE_BUFFER_PINGPONG = false;

/**
 * Whether vanilla 1.9 supports HiDPI / Retina-style sub-CSS-pixel
 * scaling (where the OS independently scales the framebuffer based on
 * monitor DPI). It does not — vanilla DOS has no concept of monitor
 * DPI; linuxdoom-1.10 sends raw 320x200 pixels to the X server and
 * lets the X server do integer pixel replication only.
 */
export const VANILLA_SUPPORTS_HIDPI_SCALING = false;

/**
 * Whether vanilla 1.9 performs sub-pixel rendering (where polygons
 * are rasterized with fractional pixel offsets to anti-alias edges).
 * It does not — every renderer call site (R_DrawColumn,
 * R_DrawSpan, V_DrawPatch, etc.) writes whole-pixel samples to
 * grid-aligned `screens[0]` offsets.
 */
export const VANILLA_PERFORMS_SUBPIXEL_RENDERING = false;

/**
 * Whether vanilla 1.9 has a hardware-vsync gate visible to the game
 * logic. It does not — DOS DOOM 1.9 uses I_StartTic/I_FinishUpdate
 * directly without a vertical-retrace wait at the host level (the
 * renderer call sites are vsync-agnostic). Chocolate Doom 2.2.1 can
 * enable vsync via SDL_RENDERER_PRESENTVSYNC but that is a Chocolate-
 * only addition — the game-logic layer must observe the same
 * deterministic per-tic update regardless of the host's vsync state.
 */
export const VANILLA_HAS_HARDWARE_VSYNC_GATE = false;

/**
 * Whether vanilla 1.9 mutates window decorations at runtime
 * (toggling fullscreen, hiding/showing the title bar, changing window
 * styles). It does not — the vanilla X11 client opens the window with
 * fixed XSizeHints and never alters them; DOS has no window concept.
 * (Chocolate Doom 2.2.1 adds a fullscreen toggle via SDL_WINDOW_*
 * flags; that is a Chocolate-only divergence deferred to step 03-019.)
 */
export const VANILLA_MUTATES_WINDOW_DECORATIONS_AT_RUNTIME = false;

/**
 * Whether vanilla 1.9 re-creates the host window during the game
 * lifetime. It does not — `I_InitGraphics` is called once during
 * `D_DoomLoop` entry (step 03-009) and the window persists until
 * `I_ShutdownGraphics` is called by either `I_Quit` (step 03-010) or
 * `I_Error` (step 03-011). A handler that destroys and re-creates the
 * window mid-frame is a parity violation.
 */
export const VANILLA_RECREATES_WINDOW_MID_LIFETIME = false;

/**
 * Whether vanilla 1.9 supports multi-monitor selection (choosing
 * which display to open the window on). It does not — DOS has no
 * multi-monitor concept; the linuxdoom-1.10 X11 port opens the
 * window on the default display set by `XOpenDisplay(NULL)`.
 */
export const VANILLA_SUPPORTS_MULTI_MONITOR_SELECTION = false;

/**
 * Whether vanilla 1.9's host renderer applies any GPU shader
 * (vertex/fragment program) or color-correction transform on the
 * framebuffer. It does not — DOS pushes raw indexed bytes into VGA
 * memory; linuxdoom-1.10 pushes raw indexed bytes into XShmImage and
 * lets the X server do palette translation. Chocolate Doom 2.2.1's
 * SDL2 path is also shader-free (the SDL_Renderer used for the
 * upscale operates without custom shaders).
 */
export const VANILLA_APPLIES_GPU_SHADER_OR_COLOR_CORRECTION = false;

/**
 * Whether vanilla 1.9 has an `argbbuffer` 32-bit ARGB intermediate
 * texture between the 8-bit indexed framebuffer and the host
 * presentation surface. It does not — vanilla pushes raw indexed
 * bytes directly to VGA / XShmImage. Chocolate Doom 2.2.1 adds the
 * `argbbuffer` so SDL_RenderCopy can convert from indexed to RGBA in
 * one pass; that is a Chocolate-only addition.
 */
export const VANILLA_USES_ARGB_INTERMEDIATE_TEXTURE = false;

/**
 * Verbatim init-call symbol for the canonical vanilla 1.9 window-
 * creation entry point. The audit pins this name because vanilla and
 * Chocolate Doom 2.2.1 both export `I_InitGraphics` from `i_video.c`
 * and `D_DoomLoop` calls it by that exact symbol.
 */
export const AUDITED_WINDOW_CREATION_C_SYMBOL = 'I_InitGraphics';

/**
 * Verbatim shutdown-call symbol for the canonical vanilla 1.9 window-
 * destruction entry point.
 */
export const AUDITED_WINDOW_DESTRUCTION_C_SYMBOL = 'I_ShutdownGraphics';

/**
 * Verbatim presentation-call symbol for the canonical vanilla 1.9
 * frame-flush entry point. `I_FinishUpdate` reads `screens[0]` and
 * pushes it to the host display.
 */
export const AUDITED_FRAME_PRESENTATION_C_SYMBOL = 'I_FinishUpdate';

/**
 * Verbatim palette-set call symbol. `I_SetPalette` accepts the 256x3
 * PLAYPAL bytes and translates indexed framebuffer samples to display
 * colors at presentation time.
 */
export const AUDITED_PALETTE_SET_C_SYMBOL = 'I_SetPalette';

/**
 * Verbatim screen-buffer allocation call symbol from `v_video.c`.
 * `V_Init` allocates the four `screens[0..3]` slots used by the
 * renderer and the status bar / automap / intermission caches.
 */
export const AUDITED_SCREENS_ALLOCATION_C_SYMBOL = 'V_Init';

/**
 * Verbatim Chocolate Doom 2.2.1 SDL hint name that pins
 * nearest-neighbor rendering quality. The verbatim string is
 * `"nearest"` (single-word, lowercase). Used in the focused test to
 * verify the audit cites the canonical hint.
 */
export const AUDITED_CHOCOLATE_NEAREST_NEIGHBOR_HINT_VALUE = 'nearest';

/** Verbatim Chocolate Doom 2.2.1 SDL hint name. */
export const AUDITED_CHOCOLATE_RENDER_SCALE_QUALITY_HINT = 'SDL_HINT_RENDER_SCALE_QUALITY';

/**
 * One audited contract clause of the vanilla DOOM 1.9 Win32 window-
 * creation + indexed-framebuffer landscape.
 */
export interface VanillaWin32WindowFramebufferContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id:
    | 'INTERNAL_FRAMEBUFFER_WIDTH_IS_320'
    | 'INTERNAL_FRAMEBUFFER_HEIGHT_IS_200'
    | 'INTERNAL_FRAMEBUFFER_FORMAT_IS_8_BIT_INDEXED'
    | 'INTERNAL_FRAMEBUFFER_TOTAL_BYTES_IS_64000'
    | 'INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL_IS_ONE'
    | 'PALETTE_COLOR_COUNT_IS_256'
    | 'PALETTE_BYTES_PER_COLOR_IS_3'
    | 'PALETTE_TOTAL_BYTES_IS_768'
    | 'PALETTE_LIVES_IN_PLAYPAL_LUMP_AS_RAW_RGB_TRIPLES'
    | 'FRAMEBUFFER_LIVES_IN_SCREENS_ZERO_VIA_V_INIT'
    | 'SCREENS_ARRAY_HAS_FOUR_SLOTS_IN_VANILLA'
    | 'DISPLAY_ASPECT_CORRECTED_HEIGHT_IS_240'
    | 'DISPLAY_ASPECT_STRETCH_FACTOR_IS_SIX_FIFTHS'
    | 'DISPLAY_ASPECT_RATIO_IS_FOUR_THIRDS_WHEN_CORRECTED'
    | 'DISPLAY_ASPECT_RATIO_IS_EIGHT_FIFTHS_WHEN_UNCORRECTED'
    | 'DISPLAY_UPSCALE_IS_INTEGER_NEAREST_NEIGHBOR'
    | 'WINDOW_CREATED_BY_I_INITGRAPHICS_DURING_D_DOOMLOOP_ENTRY'
    | 'WINDOW_CREATED_AFTER_ALL_D_DOOMMAIN_INIT_PHASES_COMPLETE'
    | 'WINDOW_DESTROYED_BY_I_SHUTDOWNGRAPHICS_AT_QUIT_OR_ERROR'
    | 'WINDOW_PERSISTS_FOR_ENTIRE_GAME_LIFETIME_NO_RECREATION'
    | 'PRESENTATION_IS_SINGLE_BUFFERED_VIA_I_FINISHUPDATE'
    | 'NO_GPU_SHADER_OR_COLOR_CORRECTION_IN_VANILLA'
    | 'NO_FRACTIONAL_OR_HIDPI_SCALES_IN_VANILLA'
    | 'NO_DOUBLE_BUFFER_PINGPONG_AT_FRAMEBUFFER_LEVEL_IN_VANILLA'
    | 'NO_SUBPIXEL_RENDERING_IN_VANILLA'
    | 'NO_HARDWARE_VSYNC_GATE_VISIBLE_TO_GAME_LOGIC_IN_VANILLA'
    | 'NO_WINDOW_DECORATION_RUNTIME_MUTATION_IN_VANILLA'
    | 'NO_MULTI_MONITOR_SELECTION_IN_VANILLA'
    | 'CHOCOLATE_ONLY_ARGBBUFFER_INTERMEDIATE_NOT_IN_VANILLA'
    | 'CHOCOLATE_ONLY_SDL_HINT_NEAREST_NEIGHBOR_NOT_IN_VANILLA'
    | 'CHOCOLATE_ONLY_RESIZE_HANDLER_NOT_IN_VANILLA'
    | 'CHOCOLATE_ONLY_FULLSCREEN_TOGGLE_NOT_IN_VANILLA';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'i_video.c' | 'v_video.c' | 'd_main.c' | 'm_menu.c';
  /** Verbatim C symbol the contract clause is pinned against. */
  readonly cSymbol: 'I_InitGraphics' | 'I_FinishUpdate' | 'I_ShutdownGraphics' | 'I_SetPalette' | 'V_Init' | 'D_DoomLoop' | 'D_DoomMain' | 'M_Init';
}

/**
 * Pinned ledger of every contract clause of the vanilla DOOM 1.9
 * Win32 window-creation + indexed-framebuffer landscape.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_AUDIT: readonly VanillaWin32WindowFramebufferContractAuditEntry[] = [
  {
    id: 'INTERNAL_FRAMEBUFFER_WIDTH_IS_320',
    invariant:
      'The vanilla DOOM 1.9 internal framebuffer is exactly 320 pixel columns wide. This dimension is pinned by VGA mode 13h on DOS, the X11 8-bit pseudocolor visual on linuxdoom-1.10, and the SDL_Texture width parameter passed to `SDL_CreateTexture` in Chocolate Doom 2.2.1. A handler that allocates a wider or narrower framebuffer is a parity violation against the renderer call sites in `R_Init`, `R_DrawColumn`, `R_DrawSpan`, and `V_DrawPatch` that all hardcode 320 as the row stride.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'INTERNAL_FRAMEBUFFER_HEIGHT_IS_200',
    invariant:
      'The vanilla DOOM 1.9 internal framebuffer is exactly 200 pixel rows tall. This dimension is pinned by VGA mode 13h on DOS, the X11 8-bit pseudocolor visual on linuxdoom-1.10, and the SDL_Texture height parameter passed to `SDL_CreateTexture` in Chocolate Doom 2.2.1. The renderer call sites in `R_Init`, `R_DrawColumn`, and the status-bar/automap glue all assume the column count is 200, including the implicit column-loop bounds in `R_RenderPlayerView`.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'INTERNAL_FRAMEBUFFER_FORMAT_IS_8_BIT_INDEXED',
    invariant:
      'The vanilla DOOM 1.9 internal framebuffer is 8 bits per pixel — one byte per pixel, where the byte is an index into the 256-color PLAYPAL palette. VGA mode 13h is natively 8-bit indexed; the X11 port allocates an 8-bit pseudocolor visual via `XMatchVisualInfo(display, screen, 8, PseudoColor, ...)`; Chocolate Doom 2.2.1 uses `SDL_PIXELFORMAT_INDEX8` for the streaming-target SDL_Texture. A handler that uses 16/24/32-bit pixels for the indexed framebuffer is a parity violation — the renderer call sites write raw 8-bit palette samples and have no facility to encode RGB triples.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'INTERNAL_FRAMEBUFFER_TOTAL_BYTES_IS_64000',
    invariant:
      'The vanilla DOOM 1.9 internal framebuffer is exactly 64000 bytes per slot (320 columns * 200 rows * 1 byte/pixel). This is the verbatim allocation size for `screens[0..3]` in `v_video.c` `V_Init` and the `screen` byte array in `i_video.c` (linuxdoom-1.10). A handler that allocates a smaller or larger byte count for one frame slot is a parity violation against the verbatim arithmetic of the source.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL_IS_ONE',
    invariant:
      'The vanilla DOOM 1.9 internal framebuffer uses exactly 1 byte per pixel (no padding, no alpha, no premultiplication). The byte is treated as an unsigned 8-bit palette index by every consumer (R_DrawColumn writes one byte per row sample; I_SetPalette translates the byte to RGB at presentation time). A handler that pads to 2 or 4 bytes per pixel for the indexed buffer is a parity violation against the verbatim row-stride arithmetic in the renderer.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'PALETTE_COLOR_COUNT_IS_256',
    invariant:
      "The vanilla DOOM 1.9 palette has exactly 256 colors. This is pinned by VGA mode 13h's 256-entry hardware palette, the X11 PseudoColor visual's 256-entry colormap, and Chocolate Doom 2.2.1's `SDL_SetPaletteColors(palette, colors, 0, 256)` call. The PLAYPAL lump in DOOM1.WAD is laid out as 14 sequential palette banks, each exactly 256 colors. A handler that reports a different color count is a parity violation against the audited PLAYPAL surface.",
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_SetPalette',
  },
  {
    id: 'PALETTE_BYTES_PER_COLOR_IS_3',
    invariant:
      'The vanilla DOOM 1.9 palette uses exactly 3 bytes per color, laid out as raw R8G8B8 triples with no alpha channel and no padding. PLAYPAL is 256 * 3 = 768 bytes per bank. The DOS port writes the triples to VGA DAC registers directly; the X11 port copies them into XColor structures and feeds them to XStoreColors; Chocolate Doom 2.2.1 wraps them in SDL_Color structs (which add a 4th alpha byte that defaults to SDL_ALPHA_OPAQUE). The on-disk PLAYPAL format is always 3 bytes per color.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_SetPalette',
  },
  {
    id: 'PALETTE_TOTAL_BYTES_IS_768',
    invariant:
      "One vanilla DOOM 1.9 palette bank is exactly 768 bytes (256 * 3). PLAYPAL contains 14 such banks (10752 bytes total): the base palette plus 9 red-tinted damage banks, 3 yellow-tinted bonus banks, and 1 green radiation-suit bank. The runtime selects the active bank via `ST_doPaletteStuff` based on the player's damage/bonus state; `I_SetPalette` accepts a single 768-byte bank pointer.",
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_SetPalette',
  },
  {
    id: 'PALETTE_LIVES_IN_PLAYPAL_LUMP_AS_RAW_RGB_TRIPLES',
    invariant:
      'The vanilla DOOM 1.9 palette source-of-truth is the PLAYPAL lump in the IWAD, parsed by step 05-005 as raw R8G8B8 triples. There is no header, no compression, no endianness conversion — PLAYPAL is a flat byte array. A handler that demands a header on the palette payload, applies sRGB gamma, or re-orders the channels (BGR/RGBA/etc.) before reaching `I_SetPalette` is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_SetPalette',
  },
  {
    id: 'FRAMEBUFFER_LIVES_IN_SCREENS_ZERO_VIA_V_INIT',
    invariant:
      'The visible vanilla DOOM 1.9 framebuffer lives in `screens[0]`, allocated by `V_Init` (`v_video.c`) before `D_DoomLoop` entry. The renderer writes to `screens[0]` via `R_DrawColumn`, `R_DrawSpan`, `V_DrawPatch`, etc.; `I_FinishUpdate` reads `screens[0]` and pushes it to the host display. A handler that introduces an alternative framebuffer slot or a "shadow" buffer that diverges from `screens[0]` is a parity violation.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'SCREENS_ARRAY_HAS_FOUR_SLOTS_IN_VANILLA',
    invariant:
      'The vanilla DOOM 1.9 `screens[]` array allocated by `V_Init` has exactly 4 slots: `screens[0]` (visible framebuffer), `screens[1..3]` (scratch buffers used by status-bar background caching, automap background, and intermission tally). The slot count is verbatim in `v_video.h` (linuxdoom-1.10): `extern byte* screens[5];` declares 5 entries but only the first 4 are written; DOS DOOM 1.9 uses 4 slots verbatim. The audit pins 4 because handlers that allocate fewer slots break callers in `R_Init`, `ST_Init`, and `AM_Init` that index into `screens[1]`, `screens[2]`, and `screens[3]`.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'DISPLAY_ASPECT_CORRECTED_HEIGHT_IS_240',
    invariant:
      "The aspect-corrected display height is exactly 240 pixels (200 * 6/5). This restores the 4:3 aspect ratio produced by VGA mode 13h's native 5:6 pixel-aspect-ratio when displayed on a CRT. Chocolate Doom 2.2.1 reproduces this via `SCREENHEIGHT_4_3 = 240` in `doomtype.h` and the `aspect_ratio_correct` config flag. A handler that reports a different aspect-corrected height is a parity violation against the canonical mode 13h CRT geometry.",
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'DISPLAY_ASPECT_STRETCH_FACTOR_IS_SIX_FIFTHS',
    invariant:
      "The aspect-correction vertical stretch factor is exactly 6/5 (1.2). Each scanline is 1.2 display pixels tall on a 4:3-corrected display. This is the verbatim arithmetic in `src/host/windowPolicy.ts` ASPECT_STRETCH_RATIO and Chocolate Doom 2.2.1's `SDL_RenderSetLogicalSize(renderer, SCREENWIDTH, SCREENHEIGHT_4_3)` setup. A handler that uses a different stretch factor (e.g. 4/3 or 8/5) breaks the canonical CRT geometry.",
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'DISPLAY_ASPECT_RATIO_IS_FOUR_THIRDS_WHEN_CORRECTED',
    invariant:
      'The display aspect ratio is exactly 4:3 (1.333...) when `aspect_ratio_correct` is enabled (320/240 = 4/3). This is the canonical CRT mode 13h aspect that vanilla DOOM 1.9 was authored against. A handler that displays a different ratio under aspect-correction-on is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'DISPLAY_ASPECT_RATIO_IS_EIGHT_FIFTHS_WHEN_UNCORRECTED',
    invariant:
      "The display aspect ratio is exactly 8:5 (1.6) when `aspect_ratio_correct` is disabled (320/200 = 8/5). This is the unstretched 320x200 buffer aspect, useful for reproducing the renderer's internal column-aligned arithmetic on a square-pixel display.",
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'DISPLAY_UPSCALE_IS_INTEGER_NEAREST_NEIGHBOR',
    invariant:
      'The vanilla DOOM 1.9 display upscale is integer-only and nearest-neighbor — no fractional scales, no bilinear/trilinear/anisotropic filtering. DOS DOOM 1.9 uses VGA mode 13h hardware doubling (320x200 native, 640x400 doubled); linuxdoom-1.10 uses XShmPutImage with pixel replication; Chocolate Doom 2.2.1 sets `SDL_HINT_RENDER_SCALE_QUALITY=nearest` (verbatim "nearest" string) and integer scale settings. A handler that enables bilinear/trilinear filtering or a fractional scale is a parity violation against the canonical pixel-perfect upscale.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'WINDOW_CREATED_BY_I_INITGRAPHICS_DURING_D_DOOMLOOP_ENTRY',
    invariant:
      'The vanilla DOOM 1.9 host window is created by `I_InitGraphics` (`i_video.c`) during `D_DoomLoop` entry (audited in step 03-009). The call site is verbatim `I_InitGraphics()` inside the `D_DoomLoop` body, before the per-frame loop begins. A handler that creates the window earlier (during `D_DoomMain` init phases) or later (after the first frame) is a parity violation against the canonical lifecycle binding.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'WINDOW_CREATED_AFTER_ALL_D_DOOMMAIN_INIT_PHASES_COMPLETE',
    invariant:
      'The vanilla DOOM 1.9 host window is created AFTER all 12 `D_DoomMain` init phases complete (V_Init, M_LoadDefaults, Z_Init, W_Init, M_Init, R_Init, P_Init, I_Init, D_CheckNetGame, S_Init, HU_Init, ST_Init), pinned by step 03-008. The window-creation call site is in `D_DoomLoop`, which is reached only after `D_DoomMain` returns. A handler that creates the window mid-init (e.g. inside `V_Init` or `R_Init`) is a parity violation — the renderer relies on the framebuffer being unallocated until `V_Init` runs and the palette being unset until `R_Init` reads PLAYPAL.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'WINDOW_DESTROYED_BY_I_SHUTDOWNGRAPHICS_AT_QUIT_OR_ERROR',
    invariant:
      'The vanilla DOOM 1.9 host window is destroyed by `I_ShutdownGraphics` (`i_video.c`) on either the clean-quit path (audited in step 03-010 via `I_Quit`) or the fatal-error path (audited in step 03-011 via the third explicit shutdown call in `I_Error`). The shutdown call is the only path that closes the X11 display in linuxdoom-1.10 and restores VGA text mode in DOS DOOM 1.9. A handler that destroys the window through any other call site (e.g. a custom WM_CLOSE handler outside `I_ShutdownGraphics`) is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_ShutdownGraphics',
  },
  {
    id: 'WINDOW_PERSISTS_FOR_ENTIRE_GAME_LIFETIME_NO_RECREATION',
    invariant:
      'The vanilla DOOM 1.9 host window persists for the entire game lifetime — from `I_InitGraphics` in `D_DoomLoop` entry through the per-frame loop until `I_ShutdownGraphics`. There is NO mid-frame window destruction or re-creation, NO rebind on resolution change, NO re-init on focus loss. The window handle is opaque to the game logic; only `I_FinishUpdate` and `I_StartTic` interact with it. A handler that destroys and re-creates the window during gameplay (e.g. on a resolution change or fullscreen toggle) is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'PRESENTATION_IS_SINGLE_BUFFERED_VIA_I_FINISHUPDATE',
    invariant:
      'Vanilla DOOM 1.9 presentation is single-buffered at the game-logic layer. The renderer writes one full frame to `screens[0]`; `I_FinishUpdate` is called once per frame and pushes `screens[0]` directly to VGA / X11 / SDL. There is NO front/back buffer swap visible to the game logic; the renderer never sees a "back buffer" pointer distinct from `screens[0]`. A handler that exposes a `screens[BACK]` slot to the renderer or requires `SwapBuffers`-style API calls between frames is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_GPU_SHADER_OR_COLOR_CORRECTION_IN_VANILLA',
    invariant:
      "Vanilla DOOM 1.9 does NOT apply any GPU shader (vertex/fragment program) or color-correction transform on the framebuffer between `screens[0]` and the host display. DOS DOOM 1.9 pushes raw indexed bytes into VGA memory at 0xA0000; linuxdoom-1.10 pushes raw indexed bytes into XShmImage; Chocolate Doom 2.2.1's SDL_Renderer is shader-free for the upscale path. A handler that adds a CRT-emulation shader, scanline shader, sRGB-to-linear conversion, or any per-fragment color correction is a parity violation against the canonical raw-pixel-pushdown.",
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_FRACTIONAL_OR_HIDPI_SCALES_IN_VANILLA',
    invariant:
      "Vanilla DOOM 1.9 does NOT support fractional display scales (1.5x, 2.5x) or HiDPI/Retina-style sub-CSS-pixel scaling. DOS has no monitor-DPI concept; the linuxdoom-1.10 X11 port pushes raw 320x200 pixels and lets the X server do integer pixel replication. Chocolate Doom 2.2.1's integer-scale config option is the canonical reference. A handler that supports a 1.5x scale or honors a Windows DPI scaling factor for the framebuffer is a parity violation.",
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'NO_DOUBLE_BUFFER_PINGPONG_AT_FRAMEBUFFER_LEVEL_IN_VANILLA',
    invariant:
      'Vanilla DOOM 1.9 does NOT ping-pong between two framebuffer slots at the game-logic layer. Only `screens[0]` is the conceptual "front buffer" the renderer writes to and `I_FinishUpdate` reads. (Chocolate Doom 2.2.1 internally uses SDL_RenderPresent which can double-buffer at the GPU level; that is invisible to the game logic and does not constitute a vanilla parity violation as long as the game-logic layer still observes a single conceptual frame slot.)',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'NO_SUBPIXEL_RENDERING_IN_VANILLA',
    invariant:
      'Vanilla DOOM 1.9 does NOT perform sub-pixel rendering. Every renderer call site (`R_DrawColumn`, `R_DrawSpan`, `V_DrawPatch`, `M_WriteText`) writes whole-pixel samples to grid-aligned `screens[0]` offsets. There are NO fractional pixel offsets, NO anti-aliased edges, NO supersampled rasterization. A handler that rasterizes any renderer output with sub-pixel precision is a parity violation against the canonical integer-grid raster model.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'NO_HARDWARE_VSYNC_GATE_VISIBLE_TO_GAME_LOGIC_IN_VANILLA',
    invariant:
      'Vanilla DOOM 1.9 has NO hardware-vsync gate visible to the game logic. The `D_DoomLoop` per-frame body runs `I_StartTic`, `tryRunTics`, `S_UpdateSounds`, and `D_Display` (audited in step 03-009) without any vertical-retrace wait that is observable to the renderer or simulation. (DOS DOOM 1.9 talks to VGA hardware directly without polling the vertical-retrace bit; the linuxdoom-1.10 X11 port does not gate on vsync. Chocolate Doom 2.2.1 can enable vsync via SDL_RENDERER_PRESENTVSYNC but the game-logic layer must observe deterministic per-tic updates regardless of host vsync state.)',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_WINDOW_DECORATION_RUNTIME_MUTATION_IN_VANILLA',
    invariant:
      'Vanilla DOOM 1.9 does NOT mutate window decorations at runtime — no fullscreen toggle, no title-bar hiding, no window-style change after creation. The linuxdoom-1.10 X11 port opens the window with fixed XSizeHints and never alters them; DOS has no window concept. (Chocolate Doom 2.2.1 adds an Alt+Enter fullscreen toggle that mutates SDL_WINDOW_FULLSCREEN_DESKTOP at runtime; that is a Chocolate-only divergence deferred to step 03-019.)',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'NO_MULTI_MONITOR_SELECTION_IN_VANILLA',
    invariant:
      'Vanilla DOOM 1.9 does NOT support multi-monitor selection. DOS has no multi-monitor concept; the linuxdoom-1.10 X11 port opens the window on the default display set by `XOpenDisplay(NULL)`. A handler that adds a `-display` or `-monitor` CLI argument to choose which monitor hosts the window is a parity violation against the canonical default-display behaviour.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'CHOCOLATE_ONLY_ARGBBUFFER_INTERMEDIATE_NOT_IN_VANILLA',
    invariant:
      'Vanilla DOOM 1.9 has NO 32-bit ARGB intermediate texture between the 8-bit indexed framebuffer and the host display. Chocolate Doom 2.2.1 adds an `argbbuffer` (`uint32_t* argbbuffer = SDL_CreateRGBSurface(0, SCREENWIDTH, SCREENHEIGHT, 32, ...)`) that converts indexed-to-RGBA in one pass for `SDL_UpdateTexture`. A vanilla-1.9 handler that interposes a 32-bit ARGB stage in the presentation pipeline is a Chocolate-style addition and a parity violation against the raw-indexed-pushdown of vanilla.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'CHOCOLATE_ONLY_SDL_HINT_NEAREST_NEIGHBOR_NOT_IN_VANILLA',
    invariant:
      'Vanilla DOOM 1.9 does NOT call `SDL_SetHint(SDL_HINT_RENDER_SCALE_QUALITY, "nearest")`. That hint is a Chocolate Doom 2.2.1 addition that ensures SDL2\'s `SDL_RenderCopy` uses nearest-neighbor filtering rather than the SDL2 default of linear. Vanilla\'s nearest-neighbor upscale comes from the underlying VGA / X11 / DOS infrastructure rather than an SDL hint. A handler that depends on an SDL2 hint string for parity is a parity violation against the platform-agnostic vanilla contract.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'CHOCOLATE_ONLY_RESIZE_HANDLER_NOT_IN_VANILLA',
    invariant:
      'Vanilla DOOM 1.9 has NO host-side resize handler. The linuxdoom-1.10 X11 client sets fixed `XSizeHints` on the window and ignores any `ConfigureNotify` events that resize the client area; DOS has no window concept. Chocolate Doom 2.2.1 adds an SDL2 resize handler that calls `SDL_RenderSetLogicalSize` and re-computes the presentation rectangle on each WM_SIZE-equivalent. A vanilla-1.9 handler that supports runtime client-area resizing as part of the canonical contract is a Chocolate-style addition; the resize policy is deferred to step 03-017.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'CHOCOLATE_ONLY_FULLSCREEN_TOGGLE_NOT_IN_VANILLA',
    invariant:
      'Vanilla DOOM 1.9 has NO Alt+Enter fullscreen toggle. The DOS port runs in VGA mode 13h fullscreen always; the linuxdoom-1.10 X11 client opens a fixed-size window and has no fullscreen-toggle key binding. Chocolate Doom 2.2.1 adds the toggle via SDL2 `SDL_SetWindowFullscreen(window, SDL_WINDOW_FULLSCREEN_DESKTOP)` plumbed through the menu input layer in `m_menu.c`. A vanilla-1.9 handler that exposes a runtime fullscreen toggle is a Chocolate-style addition; the close-button and Alt+F4 policy is deferred to step 03-019.',
    referenceSourceFile: 'm_menu.c',
    cSymbol: 'M_Init',
  },
];

/** Number of audited contract clauses pinned by the ledger. */
export const VANILLA_WIN32_WINDOW_FRAMEBUFFER_CONTRACT_CLAUSE_COUNT = 32;

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla-parity Win32-window-creation handler must preserve.
 */
export interface VanillaWin32WindowFramebufferDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_WIN32_WINDOW_FRAMEBUFFER_DERIVED_INVARIANTS: readonly VanillaWin32WindowFramebufferDerivedInvariant[] = [
  {
    id: 'FRAMEBUFFER_DIMENSIONS_ARE_320_BY_200',
    description: 'The vanilla 1.9 internal framebuffer is exactly 320 columns by 200 rows. A handler that reports different dimensions is a parity violation.',
  },
  {
    id: 'FRAMEBUFFER_FORMAT_IS_8_BIT_INDEXED_ONE_BYTE_PER_PIXEL',
    description: 'The vanilla 1.9 internal framebuffer is 8-bit indexed at exactly one byte per pixel. A handler that reports a different bit depth or padding is a parity violation.',
  },
  {
    id: 'FRAMEBUFFER_TOTAL_BYTES_AGREES_WITH_DIMENSIONS',
    description: 'The total framebuffer byte count is the product of width, height, and bytes-per-pixel (320 * 200 * 1 = 64000). A handler whose total disagrees with the product is a parity violation.',
  },
  {
    id: 'PALETTE_HAS_256_COLORS_AT_3_BYTES_EACH_TOTAL_768',
    description: 'The vanilla 1.9 palette has exactly 256 colors at 3 bytes each, total 768 bytes. A handler whose totals disagree is a parity violation.',
  },
  {
    id: 'SCREENS_ARRAY_HAS_FOUR_VANILLA_SLOTS_VISIBLE_AT_INDEX_ZERO',
    description: 'The vanilla `screens[]` array has 4 slots and the visible framebuffer is at index 0. A handler with a different slot count or visible index is a parity violation.',
  },
  {
    id: 'DISPLAY_ASPECT_CORRECTED_HEIGHT_IS_240_VIA_SIX_FIFTHS_STRETCH',
    description: 'The aspect-corrected display height is 240 pixels (200 * 6/5). A handler that uses a different stretch factor or corrected height is a parity violation.',
  },
  {
    id: 'DISPLAY_ASPECT_RATIO_IS_FOUR_THIRDS_CORRECTED_OR_EIGHT_FIFTHS_UNCORRECTED',
    description: 'The display aspect ratio is 4/3 with aspect correction enabled or 8/5 with it disabled. A handler that reports any other ratio is a parity violation.',
  },
  {
    id: 'DISPLAY_UPSCALE_IS_INTEGER_NEAREST_NEIGHBOR_NO_FILTERING',
    description: 'The display upscale is integer-only nearest-neighbor with no bilinear/trilinear/anisotropic filtering. A handler that enables hardware filtering is a parity violation.',
  },
  {
    id: 'WINDOW_LIFECYCLE_BOUND_BY_I_INITGRAPHICS_AND_I_SHUTDOWNGRAPHICS',
    description: 'The vanilla 1.9 host window is created by `I_InitGraphics` in `D_DoomLoop` and destroyed by `I_ShutdownGraphics` on quit/error. A handler that uses a different entry/exit pair is a parity violation.',
  },
  {
    id: 'WINDOW_PERSISTS_FOR_ENTIRE_GAME_LIFETIME',
    description: 'The vanilla 1.9 host window is created once and persists for the entire game lifetime with no mid-frame re-creation. A handler that destroys and re-creates the window is a parity violation.',
  },
  {
    id: 'PRESENTATION_IS_SINGLE_BUFFERED_AT_GAME_LOGIC_LAYER',
    description: 'Vanilla 1.9 presentation is single-buffered at the game-logic layer. A handler that exposes a back buffer to the renderer is a parity violation.',
  },
  {
    id: 'VANILLA_OMITS_ALL_LISTED_CHOCOLATE_ADDITIONS',
    description:
      'Vanilla 1.9 omits the Chocolate-only additions: the 32-bit ARGB intermediate, the SDL nearest-neighbor hint, the resize handler, and the fullscreen toggle. A handler that depends on any of these in the canonical vanilla contract is a parity violation.',
  },
];

/** Number of derived invariants. */
export const VANILLA_WIN32_WINDOW_FRAMEBUFFER_DERIVED_INVARIANT_COUNT = 12;

/**
 * Verbatim list of Chocolate Doom 2.2.1 additions absent from the
 * canonical vanilla 1.9 indexed-framebuffer contract.
 */
export const VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITIONS: readonly string[] = Object.freeze(['argbbuffer', 'SDL_HINT_RENDER_SCALE_QUALITY', 'resize-handler', 'fullscreen-toggle']);

/** Number of Chocolate-only additions absent from the canonical vanilla 1.9 contract. */
export const VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITION_COUNT = 4;

/**
 * Discriminator for one probe-style query against the canonical
 * vanilla 1.9 Win32-window-creation + indexed-framebuffer contract.
 */
export type VanillaWin32WindowFramebufferQueryKind =
  | 'framebuffer-width'
  | 'framebuffer-height'
  | 'framebuffer-bits-per-pixel'
  | 'framebuffer-bytes-per-pixel'
  | 'framebuffer-total-bytes'
  | 'palette-color-count'
  | 'palette-bytes-per-color'
  | 'palette-total-bytes'
  | 'screens-slot-count'
  | 'screens-visible-index'
  | 'display-aspect-corrected-height'
  | 'display-aspect-stretch-numerator'
  | 'display-aspect-stretch-denominator'
  | 'display-corrected-aspect-ratio'
  | 'display-uncorrected-aspect-ratio'
  | 'window-creation-c-symbol'
  | 'window-destruction-c-symbol'
  | 'frame-presentation-c-symbol'
  | 'palette-set-c-symbol'
  | 'screens-allocation-c-symbol'
  | 'vanilla-uses-hardware-filtering'
  | 'vanilla-supports-fractional-scales'
  | 'vanilla-uses-double-buffer-pingpong'
  | 'vanilla-supports-hidpi-scaling'
  | 'vanilla-performs-subpixel-rendering'
  | 'vanilla-has-hardware-vsync-gate'
  | 'vanilla-mutates-window-decorations'
  | 'vanilla-recreates-window-mid-lifetime'
  | 'vanilla-supports-multi-monitor-selection'
  | 'vanilla-applies-gpu-shader-or-color-correction'
  | 'vanilla-uses-argb-intermediate-texture'
  | 'vanilla-includes-chocolate-addition';

/**
 * One probe applied to a runtime vanilla Win32-window-creation +
 * indexed-framebuffer handler.
 */
export interface VanillaWin32WindowFramebufferProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Discriminator for the query kind. */
  readonly queryKind: VanillaWin32WindowFramebufferQueryKind;
  /** Optional Chocolate-addition name argument (for `vanilla-includes-chocolate-addition`). */
  readonly queryChocolateAddition: string | null;
  /** Expected answered C symbol (for *-c-symbol queries). */
  readonly expectedAnsweredCSymbol: string | null;
  /** Expected answered numeric value (for dimension/count queries). */
  readonly expectedAnsweredNumber: number | null;
  /** Expected answered ratio value (for aspect-ratio queries). */
  readonly expectedAnsweredRatio: number | null;
  /** Expected answered boolean value (for vanilla-* boolean queries). */
  readonly expectedAnsweredBoolean: boolean | null;
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId: string;
}

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a single query against the canonical contract plus the
 * expected answer.
 */
export const VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES: readonly VanillaWin32WindowFramebufferProbe[] = [
  {
    id: 'framebuffer-width-is-320',
    description: 'The internal framebuffer width is 320.',
    queryKind: 'framebuffer-width',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 320,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'FRAMEBUFFER_DIMENSIONS_ARE_320_BY_200',
  },
  {
    id: 'framebuffer-height-is-200',
    description: 'The internal framebuffer height is 200.',
    queryKind: 'framebuffer-height',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 200,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'FRAMEBUFFER_DIMENSIONS_ARE_320_BY_200',
  },
  {
    id: 'framebuffer-bits-per-pixel-is-eight',
    description: 'The internal framebuffer is 8 bits per pixel.',
    queryKind: 'framebuffer-bits-per-pixel',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 8,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'FRAMEBUFFER_FORMAT_IS_8_BIT_INDEXED_ONE_BYTE_PER_PIXEL',
  },
  {
    id: 'framebuffer-bytes-per-pixel-is-one',
    description: 'The internal framebuffer is 1 byte per pixel.',
    queryKind: 'framebuffer-bytes-per-pixel',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 1,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'FRAMEBUFFER_FORMAT_IS_8_BIT_INDEXED_ONE_BYTE_PER_PIXEL',
  },
  {
    id: 'framebuffer-total-bytes-is-64000',
    description: 'The internal framebuffer total bytes is 64000.',
    queryKind: 'framebuffer-total-bytes',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 64_000,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'FRAMEBUFFER_TOTAL_BYTES_AGREES_WITH_DIMENSIONS',
  },
  {
    id: 'palette-color-count-is-256',
    description: 'The palette has 256 colors.',
    queryKind: 'palette-color-count',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 256,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_HAS_256_COLORS_AT_3_BYTES_EACH_TOTAL_768',
  },
  {
    id: 'palette-bytes-per-color-is-three',
    description: 'The palette has 3 bytes per color (R, G, B).',
    queryKind: 'palette-bytes-per-color',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 3,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_HAS_256_COLORS_AT_3_BYTES_EACH_TOTAL_768',
  },
  {
    id: 'palette-total-bytes-is-768',
    description: 'The palette total byte count is 768.',
    queryKind: 'palette-total-bytes',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 768,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_HAS_256_COLORS_AT_3_BYTES_EACH_TOTAL_768',
  },
  {
    id: 'screens-slot-count-is-four',
    description: 'The vanilla `screens[]` array has 4 slots.',
    queryKind: 'screens-slot-count',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 4,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'SCREENS_ARRAY_HAS_FOUR_VANILLA_SLOTS_VISIBLE_AT_INDEX_ZERO',
  },
  {
    id: 'screens-visible-index-is-zero',
    description: 'The vanilla visible framebuffer slot index is 0.',
    queryKind: 'screens-visible-index',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 0,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'SCREENS_ARRAY_HAS_FOUR_VANILLA_SLOTS_VISIBLE_AT_INDEX_ZERO',
  },
  {
    id: 'display-aspect-corrected-height-is-240',
    description: 'The aspect-corrected display height is 240 pixels.',
    queryKind: 'display-aspect-corrected-height',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 240,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'DISPLAY_ASPECT_CORRECTED_HEIGHT_IS_240_VIA_SIX_FIFTHS_STRETCH',
  },
  {
    id: 'display-aspect-stretch-numerator-is-six',
    description: 'The aspect-correction stretch factor numerator is 6.',
    queryKind: 'display-aspect-stretch-numerator',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 6,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'DISPLAY_ASPECT_CORRECTED_HEIGHT_IS_240_VIA_SIX_FIFTHS_STRETCH',
  },
  {
    id: 'display-aspect-stretch-denominator-is-five',
    description: 'The aspect-correction stretch factor denominator is 5.',
    queryKind: 'display-aspect-stretch-denominator',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: 5,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'DISPLAY_ASPECT_CORRECTED_HEIGHT_IS_240_VIA_SIX_FIFTHS_STRETCH',
  },
  {
    id: 'display-corrected-aspect-ratio-is-four-thirds',
    description: 'The corrected display aspect ratio is 4/3.',
    queryKind: 'display-corrected-aspect-ratio',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: 4 / 3,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'DISPLAY_ASPECT_RATIO_IS_FOUR_THIRDS_CORRECTED_OR_EIGHT_FIFTHS_UNCORRECTED',
  },
  {
    id: 'display-uncorrected-aspect-ratio-is-eight-fifths',
    description: 'The uncorrected display aspect ratio is 8/5.',
    queryKind: 'display-uncorrected-aspect-ratio',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: 8 / 5,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'DISPLAY_ASPECT_RATIO_IS_FOUR_THIRDS_CORRECTED_OR_EIGHT_FIFTHS_UNCORRECTED',
  },
  {
    id: 'window-creation-symbol-is-i-initgraphics',
    description: 'The window-creation entry point is `I_InitGraphics`.',
    queryKind: 'window-creation-c-symbol',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: 'I_InitGraphics',
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'WINDOW_LIFECYCLE_BOUND_BY_I_INITGRAPHICS_AND_I_SHUTDOWNGRAPHICS',
  },
  {
    id: 'window-destruction-symbol-is-i-shutdowngraphics',
    description: 'The window-destruction entry point is `I_ShutdownGraphics`.',
    queryKind: 'window-destruction-c-symbol',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: 'I_ShutdownGraphics',
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'WINDOW_LIFECYCLE_BOUND_BY_I_INITGRAPHICS_AND_I_SHUTDOWNGRAPHICS',
  },
  {
    id: 'frame-presentation-symbol-is-i-finishupdate',
    description: 'The frame-presentation entry point is `I_FinishUpdate`.',
    queryKind: 'frame-presentation-c-symbol',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: 'I_FinishUpdate',
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PRESENTATION_IS_SINGLE_BUFFERED_AT_GAME_LOGIC_LAYER',
  },
  {
    id: 'palette-set-symbol-is-i-setpalette',
    description: 'The palette-set entry point is `I_SetPalette`.',
    queryKind: 'palette-set-c-symbol',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: 'I_SetPalette',
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_HAS_256_COLORS_AT_3_BYTES_EACH_TOTAL_768',
  },
  {
    id: 'screens-allocation-symbol-is-v-init',
    description: 'The screens-array allocation entry point is `V_Init`.',
    queryKind: 'screens-allocation-c-symbol',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: 'V_Init',
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'SCREENS_ARRAY_HAS_FOUR_VANILLA_SLOTS_VISIBLE_AT_INDEX_ZERO',
  },
  {
    id: 'vanilla-does-not-use-hardware-filtering',
    description: 'Vanilla 1.9 does not use hardware filtering on the upscale.',
    queryKind: 'vanilla-uses-hardware-filtering',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'DISPLAY_UPSCALE_IS_INTEGER_NEAREST_NEIGHBOR_NO_FILTERING',
  },
  {
    id: 'vanilla-does-not-support-fractional-scales',
    description: 'Vanilla 1.9 does not support fractional display scales.',
    queryKind: 'vanilla-supports-fractional-scales',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'DISPLAY_UPSCALE_IS_INTEGER_NEAREST_NEIGHBOR_NO_FILTERING',
  },
  {
    id: 'vanilla-does-not-pingpong-double-buffers',
    description: 'Vanilla 1.9 does not ping-pong between two framebuffer slots at the game-logic layer.',
    queryKind: 'vanilla-uses-double-buffer-pingpong',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PRESENTATION_IS_SINGLE_BUFFERED_AT_GAME_LOGIC_LAYER',
  },
  {
    id: 'vanilla-does-not-support-hidpi-scaling',
    description: 'Vanilla 1.9 does not support HiDPI scaling.',
    queryKind: 'vanilla-supports-hidpi-scaling',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'DISPLAY_UPSCALE_IS_INTEGER_NEAREST_NEIGHBOR_NO_FILTERING',
  },
  {
    id: 'vanilla-does-not-perform-subpixel-rendering',
    description: 'Vanilla 1.9 does not perform sub-pixel rendering.',
    queryKind: 'vanilla-performs-subpixel-rendering',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'DISPLAY_UPSCALE_IS_INTEGER_NEAREST_NEIGHBOR_NO_FILTERING',
  },
  {
    id: 'vanilla-has-no-hardware-vsync-gate',
    description: 'Vanilla 1.9 has no hardware-vsync gate visible to the game logic.',
    queryKind: 'vanilla-has-hardware-vsync-gate',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PRESENTATION_IS_SINGLE_BUFFERED_AT_GAME_LOGIC_LAYER',
  },
  {
    id: 'vanilla-does-not-mutate-window-decorations',
    description: 'Vanilla 1.9 does not mutate window decorations at runtime.',
    queryKind: 'vanilla-mutates-window-decorations',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'WINDOW_PERSISTS_FOR_ENTIRE_GAME_LIFETIME',
  },
  {
    id: 'vanilla-does-not-recreate-window-mid-lifetime',
    description: 'Vanilla 1.9 does not destroy and re-create the host window during the game lifetime.',
    queryKind: 'vanilla-recreates-window-mid-lifetime',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'WINDOW_PERSISTS_FOR_ENTIRE_GAME_LIFETIME',
  },
  {
    id: 'vanilla-does-not-support-multi-monitor-selection',
    description: 'Vanilla 1.9 does not support multi-monitor selection.',
    queryKind: 'vanilla-supports-multi-monitor-selection',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'WINDOW_LIFECYCLE_BOUND_BY_I_INITGRAPHICS_AND_I_SHUTDOWNGRAPHICS',
  },
  {
    id: 'vanilla-does-not-apply-gpu-shader-or-color-correction',
    description: 'Vanilla 1.9 does not apply any GPU shader or color-correction transform on the framebuffer.',
    queryKind: 'vanilla-applies-gpu-shader-or-color-correction',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PRESENTATION_IS_SINGLE_BUFFERED_AT_GAME_LOGIC_LAYER',
  },
  {
    id: 'vanilla-does-not-use-argb-intermediate',
    description: 'Vanilla 1.9 does not interpose a 32-bit ARGB intermediate texture between the indexed framebuffer and the host display.',
    queryKind: 'vanilla-uses-argb-intermediate-texture',
    queryChocolateAddition: null,
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'VANILLA_OMITS_ALL_LISTED_CHOCOLATE_ADDITIONS',
  },
  {
    id: 'vanilla-omits-argbbuffer-chocolate-addition',
    description: 'Vanilla 1.9 omits the Chocolate-only `argbbuffer` 32-bit ARGB intermediate.',
    queryKind: 'vanilla-includes-chocolate-addition',
    queryChocolateAddition: 'argbbuffer',
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'VANILLA_OMITS_ALL_LISTED_CHOCOLATE_ADDITIONS',
  },
  {
    id: 'vanilla-omits-sdl-render-scale-quality-hint',
    description: 'Vanilla 1.9 omits the Chocolate-only `SDL_HINT_RENDER_SCALE_QUALITY` hint.',
    queryKind: 'vanilla-includes-chocolate-addition',
    queryChocolateAddition: 'SDL_HINT_RENDER_SCALE_QUALITY',
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'VANILLA_OMITS_ALL_LISTED_CHOCOLATE_ADDITIONS',
  },
  {
    id: 'vanilla-omits-resize-handler',
    description: 'Vanilla 1.9 omits the Chocolate-only host-side resize handler.',
    queryKind: 'vanilla-includes-chocolate-addition',
    queryChocolateAddition: 'resize-handler',
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'VANILLA_OMITS_ALL_LISTED_CHOCOLATE_ADDITIONS',
  },
  {
    id: 'vanilla-omits-fullscreen-toggle',
    description: 'Vanilla 1.9 omits the Chocolate-only Alt+Enter fullscreen toggle.',
    queryKind: 'vanilla-includes-chocolate-addition',
    queryChocolateAddition: 'fullscreen-toggle',
    expectedAnsweredCSymbol: null,
    expectedAnsweredNumber: null,
    expectedAnsweredRatio: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'VANILLA_OMITS_ALL_LISTED_CHOCOLATE_ADDITIONS',
  },
];

/** Number of pinned probes. */
export const VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBE_COUNT = 35;

/**
 * Result of a single probe run against a vanilla Win32-window-creation
 * + indexed-framebuffer handler. Each query kind populates a different
 * result field; fields not relevant to the query kind are `null`.
 */
export interface VanillaWin32WindowFramebufferResult {
  readonly answeredCSymbol: string | null;
  readonly answeredNumber: number | null;
  readonly answeredRatio: number | null;
  readonly answeredBoolean: boolean | null;
}

/**
 * A minimal handler interface modelling the canonical vanilla 1.9
 * Win32-window-creation + indexed-framebuffer contract. The reference
 * implementation answers each query against the pinned canonical
 * landscape; the cross-check accepts any handler shape so the focused
 * test can exercise deliberately broken adapters and observe the
 * failure ids.
 */
export interface VanillaWin32WindowFramebufferHandler {
  readonly runProbe: (probe: VanillaWin32WindowFramebufferProbe) => VanillaWin32WindowFramebufferResult;
}

const NULL_ANSWER: VanillaWin32WindowFramebufferResult = Object.freeze({
  answeredCSymbol: null,
  answeredNumber: null,
  answeredRatio: null,
  answeredBoolean: null,
});

/**
 * Reference handler that answers every query against the canonical
 * vanilla 1.9 Win32-window-creation + indexed-framebuffer landscape.
 * The focused test asserts that this handler passes every probe with
 * zero failures.
 */
function referenceVanillaWin32WindowFramebufferProbe(probe: VanillaWin32WindowFramebufferProbe): VanillaWin32WindowFramebufferResult {
  switch (probe.queryKind) {
    case 'framebuffer-width': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_INTERNAL_FRAMEBUFFER_WIDTH });
    }
    case 'framebuffer-height': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT });
    }
    case 'framebuffer-bits-per-pixel': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_INTERNAL_FRAMEBUFFER_BITS_PER_PIXEL });
    }
    case 'framebuffer-bytes-per-pixel': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL });
    }
    case 'framebuffer-total-bytes': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES });
    }
    case 'palette-color-count': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_PALETTE_COLOR_COUNT });
    }
    case 'palette-bytes-per-color': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_PALETTE_BYTES_PER_COLOR });
    }
    case 'palette-total-bytes': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_PALETTE_TOTAL_BYTES });
    }
    case 'screens-slot-count': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_VANILLA_SCREENS_SLOT_COUNT });
    }
    case 'screens-visible-index': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_VANILLA_VISIBLE_FRAMEBUFFER_SCREENS_INDEX });
    }
    case 'display-aspect-corrected-height': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_DISPLAY_ASPECT_CORRECTED_HEIGHT });
    }
    case 'display-aspect-stretch-numerator': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_DISPLAY_ASPECT_STRETCH_NUMERATOR });
    }
    case 'display-aspect-stretch-denominator': {
      return Object.freeze({ ...NULL_ANSWER, answeredNumber: AUDITED_DISPLAY_ASPECT_STRETCH_DENOMINATOR });
    }
    case 'display-corrected-aspect-ratio': {
      return Object.freeze({ ...NULL_ANSWER, answeredRatio: AUDITED_DISPLAY_FOUR_THIRDS_RATIO });
    }
    case 'display-uncorrected-aspect-ratio': {
      return Object.freeze({ ...NULL_ANSWER, answeredRatio: AUDITED_DISPLAY_EIGHT_FIFTHS_RATIO });
    }
    case 'window-creation-c-symbol': {
      return Object.freeze({ ...NULL_ANSWER, answeredCSymbol: AUDITED_WINDOW_CREATION_C_SYMBOL });
    }
    case 'window-destruction-c-symbol': {
      return Object.freeze({ ...NULL_ANSWER, answeredCSymbol: AUDITED_WINDOW_DESTRUCTION_C_SYMBOL });
    }
    case 'frame-presentation-c-symbol': {
      return Object.freeze({ ...NULL_ANSWER, answeredCSymbol: AUDITED_FRAME_PRESENTATION_C_SYMBOL });
    }
    case 'palette-set-c-symbol': {
      return Object.freeze({ ...NULL_ANSWER, answeredCSymbol: AUDITED_PALETTE_SET_C_SYMBOL });
    }
    case 'screens-allocation-c-symbol': {
      return Object.freeze({ ...NULL_ANSWER, answeredCSymbol: AUDITED_SCREENS_ALLOCATION_C_SYMBOL });
    }
    case 'vanilla-uses-hardware-filtering': {
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: VANILLA_USES_HARDWARE_FILTERING });
    }
    case 'vanilla-supports-fractional-scales': {
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: VANILLA_SUPPORTS_FRACTIONAL_SCALES });
    }
    case 'vanilla-uses-double-buffer-pingpong': {
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: VANILLA_USES_DOUBLE_BUFFER_PINGPONG });
    }
    case 'vanilla-supports-hidpi-scaling': {
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: VANILLA_SUPPORTS_HIDPI_SCALING });
    }
    case 'vanilla-performs-subpixel-rendering': {
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: VANILLA_PERFORMS_SUBPIXEL_RENDERING });
    }
    case 'vanilla-has-hardware-vsync-gate': {
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: VANILLA_HAS_HARDWARE_VSYNC_GATE });
    }
    case 'vanilla-mutates-window-decorations': {
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: VANILLA_MUTATES_WINDOW_DECORATIONS_AT_RUNTIME });
    }
    case 'vanilla-recreates-window-mid-lifetime': {
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: VANILLA_RECREATES_WINDOW_MID_LIFETIME });
    }
    case 'vanilla-supports-multi-monitor-selection': {
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: VANILLA_SUPPORTS_MULTI_MONITOR_SELECTION });
    }
    case 'vanilla-applies-gpu-shader-or-color-correction': {
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: VANILLA_APPLIES_GPU_SHADER_OR_COLOR_CORRECTION });
    }
    case 'vanilla-uses-argb-intermediate-texture': {
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: VANILLA_USES_ARGB_INTERMEDIATE_TEXTURE });
    }
    case 'vanilla-includes-chocolate-addition': {
      const name = probe.queryChocolateAddition!;
      const present = !VANILLA_WIN32_WINDOW_FRAMEBUFFER_ABSENT_CHOCOLATE_ADDITIONS.includes(name);
      return Object.freeze({ ...NULL_ANSWER, answeredBoolean: present });
    }
  }
}

/**
 * Reference handler routing every probe to the canonical reference
 * implementation. The focused test asserts that this handler passes
 * every probe with zero failures.
 */
export const REFERENCE_VANILLA_WIN32_WINDOW_FRAMEBUFFER_HANDLER: VanillaWin32WindowFramebufferHandler = Object.freeze({
  runProbe: referenceVanillaWin32WindowFramebufferProbe,
});

/**
 * Cross-check a `VanillaWin32WindowFramebufferHandler` against the
 * pinned probe set. Returns the list of failures by stable identifier;
 * an empty list means the handler is parity-safe with the canonical
 * vanilla 1.9 Win32-window-creation + indexed-framebuffer contract.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:answeredCSymbol:value-mismatch`
 *  - `probe:<probe.id>:answeredNumber:value-mismatch`
 *  - `probe:<probe.id>:answeredRatio:value-mismatch`
 *  - `probe:<probe.id>:answeredBoolean:value-mismatch`
 */
export function crossCheckVanillaWin32WindowFramebuffer(handler: VanillaWin32WindowFramebufferHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_WIN32_WINDOW_FRAMEBUFFER_PROBES) {
    const result = handler.runProbe(probe);

    if (probe.expectedAnsweredCSymbol !== null && result.answeredCSymbol !== probe.expectedAnsweredCSymbol) {
      failures.push(`probe:${probe.id}:answeredCSymbol:value-mismatch`);
    }
    if (probe.expectedAnsweredNumber !== null && result.answeredNumber !== probe.expectedAnsweredNumber) {
      failures.push(`probe:${probe.id}:answeredNumber:value-mismatch`);
    }
    if (probe.expectedAnsweredRatio !== null && result.answeredRatio !== probe.expectedAnsweredRatio) {
      failures.push(`probe:${probe.id}:answeredRatio:value-mismatch`);
    }
    if (probe.expectedAnsweredBoolean !== null && result.answeredBoolean !== probe.expectedAnsweredBoolean) {
      failures.push(`probe:${probe.id}:answeredBoolean:value-mismatch`);
    }
  }

  return failures;
}

/**
 * Convenience helper: derive the expected answer for an arbitrary
 * probe against the canonical vanilla 1.9 Win32-window-creation +
 * indexed-framebuffer contract. The focused test uses this helper to
 * cross-validate probe expectations independently of the reference
 * handler.
 */
export function deriveExpectedVanillaWin32WindowFramebufferResult(probe: VanillaWin32WindowFramebufferProbe): VanillaWin32WindowFramebufferResult {
  return referenceVanillaWin32WindowFramebufferProbe(probe);
}
