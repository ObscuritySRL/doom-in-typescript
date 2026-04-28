/**
 * Audit ledger that PINS the vanilla DOOM 1.9 palette-blit-without-
 * filtering contract against drift. The accompanying focused test
 * cross-checks every audited clause against a self-contained reference
 * handler that walks the canonical I_SetPalette → UploadNewPalette →
 * XStoreColors palette upload path AND the I_FinishUpdate →
 * XShmPutImage / XPutImage indexed-framebuffer presentation path,
 * neither of which applies any filtering, smoothing, blending, color-
 * channel mutation, or sub-pixel transformation beyond the gamma
 * lookup table and the unsigned 8-bit-to-16-bit byte-duplication
 * expansion `(c<<8) + c` that XStoreColors requires.
 *
 * Step 03-012 pinned the broad contract for the indexed framebuffer
 * (dimensions, palette format, aspect-correction stretch, lifecycle
 * binding, Chocolate-only-omissions). Step 03-014 narrowed to the
 * BYTE-LEVEL LOCK that the framebuffer storage must hold (320x200,
 * 1 byte/pixel, row-major top-down, four contiguous V_Init slots,
 * direct alias to image->data on multiply==1). This step (03-015)
 * pins the THIRD side of the indexed-framebuffer pipeline: the
 * palette upload AND blit semantics that turn the 64000-byte indexed
 * payload into pixels on screen, with no filter / smoothing / blend
 * applied along the path:
 *
 *   1. The 256-entry palette upload via X11 XStoreColors. The
 *      verbatim loop in `linuxdoom-1.10/i_video.c` UploadNewPalette
 *      iterates `for (i=0 ; i<256 ; i++)` and writes each color
 *      through three sequential `*palette++` reads (red then green
 *      then blue) into the `colors[]` XColor array, then uploads the
 *      whole 256-entry array via a single XStoreColors call.
 *
 *   2. The unsigned 8-bit-to-16-bit byte-duplication expansion
 *      `(c<<8) + c` performed per channel. The PLAYPAL byte 0xAB
 *      becomes the X colormap entry word 0xABAB — the high byte and
 *      low byte are both equal to the input. This is NOT zero-padding
 *      (`c<<8`) nor a left-shift-only (`c<<8`) nor a multiplicative
 *      scaling — it is the exact inverse of the X11 16-bit-to-8-bit
 *      truncation `c >> 8` and preserves the maximum gamut spread.
 *
 *   3. The gamma correction lookup table. The verbatim
 *      `c = gammatable[usegamma][*palette++]` indirection applies a
 *      2D lookup with `usegamma` ∈ {0,1,2,3,4} selecting one of five
 *      gamma curves and the palette byte selecting the entry within
 *      that curve. Vanilla 1.9 supports five fixed gamma settings
 *      (no continuous slider) and applies the same gamma to all
 *      three channels of every palette entry uniformly.
 *
 *   4. The DoRed | DoGreen | DoBlue flag mask on every XColor entry.
 *      The verbatim `colors[i].flags = DoRed|DoGreen|DoBlue` requests
 *      the X server to update all three channels for every entry —
 *      the X server cannot ignore any channel of any palette entry.
 *
 *   5. The pixel-field assignment `colors[i].pixel = i`. Each X
 *      colormap entry indexes itself: the i-th XColor maps the
 *      framebuffer byte value i to the RGB triple stored in that
 *      XColor's red/green/blue fields. There is no permutation,
 *      no remap, and no offset.
 *
 *   6. The blit dispatcher branches on `multiply ∈ {1,2,3,4}`.
 *      multiply==1 is the zero-copy alias path: screens[0] is
 *      already image->data and I_FinishUpdate calls XShmPutImage /
 *      XPutImage directly without any pixel transformation.
 *      multiply==2 is the 2x2 block-replication path that walks the
 *      4-pixel-per-iteration unrolled loop with bitwise mask+shift
 *      arithmetic. multiply==3 is the 3x3 block-replication path
 *      with similar 4-pixel-per-iteration unrolled loop. multiply==4
 *      calls Expand4(), which the source comments mark "Broken".
 *
 *   7. The pure pixel-replication semantics. None of the
 *      multiply > 1 paths blend two pixels — every output pixel is
 *      a verbatim copy of one input pixel. The bitwise mask+shift
 *      arithmetic is NOT a 2-tap or 4-tap weighted average — it is
 *      a 4-pixels-in / N-pixels-out unrolled byte-permutation that
 *      duplicates each input pixel into its 2x2 / 3x3 output block.
 *
 *   8. The full-frame presentation rectangle. XShmPutImage and
 *      XPutImage are both called with `(0, 0, 0, 0, X_width,
 *      X_height)` — full-screen blit with no partial-rect updates,
 *      no dirty-region tracking, and no scissor. Every frame uploads
 *      the entire framebuffer.
 *
 *   9. The XShmPutImage handshake or XSync(False) gate at the end of
 *      each I_FinishUpdate. The shared-memory branch waits for the
 *      `shmFinished` flag via a poll-event loop; the non-SHM branch
 *      calls `XSync(X_display, False)` to flush queued requests.
 *      Neither path performs vsync — the X server may discard or
 *      coalesce frames if the client out-runs the display.
 *
 *  10. The absence of GPU shaders, fragment / vertex programs,
 *      texture filters, color-correction matrices, or 3D acceleration.
 *      The X11 path is pure software (XPutImage) or MIT-SHM (DMA into
 *      X server's pixmap area via XShmPutImage); neither involves a
 *      GPU. Chocolate Doom 2.2.1 uses SDL 1.2 SDL_Flip; later
 *      Chocolate variants use SDL 2's SDL_RenderCopy with a hint of
 *      SDL_HINT_RENDER_SCALE_QUALITY = "nearest" to preserve the
 *      vanilla nearest-neighbor semantics.
 *
 *  11. Vanilla 1.9 does NOT apply: bilinear filtering, trilinear
 *      filtering, anisotropic filtering, mipmaps, dithering, sub-pixel
 *      rendering, hue/saturation/contrast/brightness post-processing
 *      outside the gammatable lookup, alpha-channel blending, or any
 *      form of two-pixel weighted-average smoothing. A handler that
 *      adds any of these is a parity violation against the verbatim
 *      pure-block-replication / pure-colormap-lookup contract.
 *
 *  12. The framebuffer-to-display data flow. The renderer writes
 *      8-bit palette indices into screens[0]. I_FinishUpdate
 *      copy/replicates those indices (or uses them in place at
 *      multiply==1) into the X image. The X server resolves indices
 *      to RGB triples through the colormap when painting the image
 *      to the screen. The PLAYPAL → XColor → X colormap path is the
 *      ONLY place RGB ever appears; no intermediate RGB framebuffer
 *      exists in vanilla 1.9.
 *
 * The audit module deliberately does NOT import from
 * `src/host/windowPolicy.ts`, `src/launcher/win32.ts`, or any other
 * runtime module so that a corrupted runtime cannot silently calibrate
 * the audit's own probe table.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (canonical for the X11
 *      palette-upload and blit paths — `i_video.c` UploadNewPalette
 *      pins the 256-entry XStoreColors loop with DoRed|DoGreen|DoBlue
 *      flags, the gammatable[usegamma] indirection, and the
 *      `(c<<8) + c` byte-duplication expansion; `i_video.c`
 *      I_FinishUpdate pins the multiply ∈ {1,2,3,4} branches with
 *      bitwise-mask+shift block replication and the XShmPutImage /
 *      XPutImage full-frame presentation rectangle),
 *   5. Chocolate Doom 2.2.1 source (counterexample for the SDL 1.2
 *      SDL_Flip presentation primitive vs the X11 XShmPutImage /
 *      XPutImage primitive in vanilla 1.9).
 */

/** Hand-pinned canonical palette entry count — `for (i=0 ; i<256 ; i++)` in UploadNewPalette. */
export const LOCKED_PALETTE_ENTRY_COUNT = 256;

/** Hand-pinned canonical bytes per PLAYPAL palette entry — three `*palette++` reads (R, G, B). */
export const LOCKED_PALETTE_BYTES_PER_ENTRY = 3;

/** Hand-pinned canonical total byte count of one PLAYPAL palette block (256 * 3). */
export const LOCKED_PALETTE_TOTAL_BYTES = 768;

/** Hand-pinned canonical RGB channel count per palette entry (R, G, B — no A). */
export const LOCKED_PALETTE_CHANNEL_COUNT = 3;

/** Hand-pinned canonical bits per channel in PLAYPAL — 8-bit unsigned per channel. */
export const LOCKED_PALETTE_INPUT_BITS_PER_CHANNEL = 8;

/** Hand-pinned canonical bits per channel in the X colormap entry — 16-bit unsigned per channel. */
export const LOCKED_X_COLORMAP_OUTPUT_BITS_PER_CHANNEL = 16;

/**
 * Hand-pinned number of selectable gamma curves in vanilla 1.9.
 * `usegamma` is an integer ∈ {0,1,2,3,4} indexing into a
 * gammatable[5][256] structure; the M_Menu UI cycles between five
 * settings.
 */
export const LOCKED_GAMMA_CURVE_COUNT = 5;

/** Hand-pinned canonical gammatable second-axis size (256 entries per curve, indexed by the input byte). */
export const LOCKED_GAMMA_TABLE_INPUT_INDEX_COUNT = 256;

/** Hand-pinned canonical multiply value at the zero-copy alias path. */
export const LOCKED_MULTIPLY_ZERO_COPY_ALIAS_VALUE = 1;

/** Hand-pinned canonical multiply value at the 2x2 block-replication path. */
export const LOCKED_MULTIPLY_2X2_REPLICATION_VALUE = 2;

/** Hand-pinned canonical multiply value at the 3x3 block-replication path. */
export const LOCKED_MULTIPLY_3X3_REPLICATION_VALUE = 3;

/** Hand-pinned canonical multiply value at the 4x4 block-replication path (calls broken Expand4). */
export const LOCKED_MULTIPLY_4X4_REPLICATION_VALUE = 4;

/** Hand-pinned canonical X_width when multiply==1 (== SCREENWIDTH). */
export const LOCKED_X_WIDTH_AT_MULTIPLY_ONE = 320;

/** Hand-pinned canonical X_height when multiply==1 (== SCREENHEIGHT). */
export const LOCKED_X_HEIGHT_AT_MULTIPLY_ONE = 200;

/** Hand-pinned canonical X_width when multiply==2 (== 2 * SCREENWIDTH). */
export const LOCKED_X_WIDTH_AT_MULTIPLY_TWO = 640;

/** Hand-pinned canonical X_height when multiply==2 (== 2 * SCREENHEIGHT). */
export const LOCKED_X_HEIGHT_AT_MULTIPLY_TWO = 400;

/** Hand-pinned canonical X_width when multiply==3 (== 3 * SCREENWIDTH). */
export const LOCKED_X_WIDTH_AT_MULTIPLY_THREE = 960;

/** Hand-pinned canonical X_height when multiply==3 (== 3 * SCREENHEIGHT). */
export const LOCKED_X_HEIGHT_AT_MULTIPLY_THREE = 600;

/** Hand-pinned canonical XColor flags mask in UploadNewPalette: `DoRed|DoGreen|DoBlue`. */
export const LOCKED_X_COLORMAP_FLAGS_SYMBOL = 'DoRed|DoGreen|DoBlue';

/** Hand-pinned canonical X11 palette-upload primitive symbol. */
export const LOCKED_PALETTE_UPLOAD_X11_SYMBOL = 'XStoreColors';

/** Hand-pinned canonical X11 SHM blit primitive symbol. */
export const LOCKED_PRESENTATION_X11_SHM_SYMBOL = 'XShmPutImage';

/** Hand-pinned canonical X11 non-SHM blit primitive symbol. */
export const LOCKED_PRESENTATION_X11_NON_SHM_SYMBOL = 'XPutImage';

/** Hand-pinned canonical XSync flag in I_FinishUpdate non-SHM path: `XSync(X_display, False)`. */
export const LOCKED_X11_NON_SHM_XSYNC_DISCARD_FLAG = false;

/** Hand-pinned canonical SHM-handshake flag name set by SHM completion event. */
export const LOCKED_X11_SHM_HANDSHAKE_FLAG_SYMBOL = 'shmFinished';

/** Hand-pinned canonical UploadNewPalette C symbol. */
export const LOCKED_UPLOAD_NEW_PALETTE_C_SYMBOL = 'UploadNewPalette';

/** Hand-pinned canonical I_SetPalette C symbol. */
export const LOCKED_I_SET_PALETTE_C_SYMBOL = 'I_SetPalette';

/** Hand-pinned canonical I_FinishUpdate C symbol. */
export const LOCKED_I_FINISH_UPDATE_C_SYMBOL = 'I_FinishUpdate';

/** Hand-pinned canonical gammatable C symbol. */
export const LOCKED_GAMMA_TABLE_C_SYMBOL = 'gammatable';

/** Hand-pinned canonical usegamma C variable. */
export const LOCKED_USE_GAMMA_C_SYMBOL = 'usegamma';

/** Hand-pinned canonical Expand4 C symbol called on the multiply==4 path. */
export const LOCKED_EXPAND4_C_SYMBOL = 'Expand4';

/** Hand-pinned source comment marking the multiply==4 path as broken. */
export const LOCKED_EXPAND4_BROKEN_COMMENT = 'Broken. Gotta fix this some day.';

/**
 * Whether vanilla 1.9 applies bilinear filtering on the upscale path.
 * It does not — multiply > 1 paths are pure pixel replication.
 */
export const VANILLA_USES_BILINEAR_FILTERING = false;

/**
 * Whether vanilla 1.9 applies trilinear filtering on the upscale path.
 * It does not — vanilla has no mipmaps and no MIP_LINEAR mode.
 */
export const VANILLA_USES_TRILINEAR_FILTERING = false;

/**
 * Whether vanilla 1.9 applies anisotropic filtering on the upscale.
 * It does not — anisotropic filtering requires a programmable GPU and
 * vanilla 1.9 has no GPU code path.
 */
export const VANILLA_USES_ANISOTROPIC_FILTERING = false;

/**
 * Whether vanilla 1.9 supports fractional display scales (e.g. 1.5x,
 * 2.5x). It does not — only integer multipliers ∈ {1,2,3,4} are
 * supported, with multiply==4 marked Broken in the source.
 */
export const VANILLA_SUPPORTS_FRACTIONAL_SCALES = false;

/**
 * Whether vanilla 1.9 dithers indexed framebuffer pixels at any stage.
 * It does not — every pixel is a verbatim palette index, with no
 * ordered or error-diffused dithering applied.
 */
export const VANILLA_USES_DITHERING = false;

/**
 * Whether vanilla 1.9 performs sub-pixel rendering at presentation.
 * It does not — every output pixel snaps to integer coordinates.
 */
export const VANILLA_USES_SUBPIXEL_RENDERING = false;

/**
 * Whether vanilla 1.9 blends two adjacent input pixels to produce one
 * output pixel anywhere on the upscale path. It does not — every
 * output pixel is a 1-to-1 copy of one input pixel.
 */
export const VANILLA_BLENDS_ADJACENT_PIXELS_ON_UPSCALE = false;

/**
 * Whether vanilla 1.9 maintains a per-pixel alpha channel in the
 * indexed framebuffer or its blit pipeline. It does not —
 * translucency for fuzz monsters and translucent decorations is
 * handled at the renderer call site (R_DrawFuzzColumn) via colormap
 * lookup, never at the framebuffer storage or blit level.
 */
export const VANILLA_USES_ALPHA_CHANNEL_BLENDING_AT_BLIT = false;

/**
 * Whether vanilla 1.9 re-uploads the X colormap to the X server every
 * frame. It does not — the colormap is uploaded only when I_SetPalette
 * is invoked (e.g. red flash, item pickup, blood splash, gamma cycle).
 */
export const VANILLA_REUPLOADS_PALETTE_EVERY_FRAME = false;

/**
 * Whether vanilla 1.9 applies a hue / saturation / contrast / brightness
 * post-processing matrix on top of the gammatable lookup. It does not
 * — the gammatable is the only color-channel transformation between
 * the PLAYPAL byte and the X colormap entry.
 */
export const VANILLA_APPLIES_NON_GAMMA_COLOR_MATRIX = false;

/**
 * Whether vanilla 1.9 uses a GPU shader / fragment program / vertex
 * program at any point on the palette-blit path. It does not — the
 * X11 blit is pure software (XPutImage) or MIT-SHM DMA (XShmPutImage),
 * neither involves GPU code.
 */
export const VANILLA_USES_GPU_SHADER_AT_BLIT = false;

/**
 * Whether vanilla 1.9 issues partial-rect (dirty-region) blits.
 * It does not — every I_FinishUpdate uploads the full SCREENWIDTH x
 * SCREENHEIGHT framebuffer via a single XShmPutImage / XPutImage call
 * with `(0, 0, 0, 0, X_width, X_height)` arguments.
 */
export const VANILLA_USES_PARTIAL_RECT_BLITS = false;

/**
 * Whether vanilla 1.9 holds a per-frame vsync gate visible to the
 * game-logic layer. It does not — `XSync(X_display, False)` queues a
 * flush without waiting for vertical retrace, and the SHM handshake
 * waits only for the X server to acknowledge the put-image, not for
 * the next display refresh.
 */
export const VANILLA_HOLDS_PER_FRAME_VSYNC_GATE = false;

/**
 * Whether vanilla 1.9 ever holds an intermediate ARGB / RGB / BGRA
 * 32-bit framebuffer between the indexed framebuffer and the X server.
 * It does not — the framebuffer storage is 8-bit indexed, and the
 * X server resolves indices to RGB at presentation time via the
 * colormap. (Chocolate Doom 2.2.1 uses an `argbbuffer` in some SDL2
 * variants, but that is a Chocolate-only divergence.)
 */
export const VANILLA_USES_RGB_INTERMEDIATE_BEFORE_BLIT = false;

/**
 * One audited lock clause of the vanilla DOOM 1.9 palette-blit-without-
 * filtering contract.
 */
export interface VanillaPaletteBlitWithoutFilteringLockEntry {
  /** Stable identifier of the lock clause. */
  readonly id:
    | 'PALETTE_HAS_256_ENTRIES'
    | 'PALETTE_BYTES_PER_ENTRY_IS_THREE'
    | 'PALETTE_TOTAL_BYTES_IS_768'
    | 'PALETTE_RGB_CHANNEL_ORDER_IS_R_THEN_G_THEN_B'
    | 'PALETTE_INPUT_FORMAT_IS_R8G8B8_NO_ALPHA'
    | 'PALETTE_ENTRY_PIXEL_FIELD_EQUALS_INDEX'
    | 'PALETTE_ENTRY_FLAGS_LOCKED_AT_DO_RED_GREEN_BLUE'
    | 'PALETTE_GAMMA_CORRECTED_VIA_GAMMATABLE_LOOKUP'
    | 'GAMMA_CURVE_COUNT_LOCKED_AT_FIVE'
    | 'PALETTE_8_BIT_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION'
    | 'PALETTE_UPLOAD_USES_X_STORE_COLORS_PRIMITIVE'
    | 'PALETTE_UPLOADED_ONLY_VIA_I_SET_PALETTE'
    | 'NO_PER_FRAME_PALETTE_REUPLOAD'
    | 'BLIT_BRANCHES_ON_MULTIPLY_ONE_TWO_THREE_FOUR'
    | 'MULTIPLY_ONE_PATH_IS_ZERO_COPY_ALIAS'
    | 'MULTIPLY_TWO_PATH_IS_2X2_PURE_BLOCK_REPLICATION'
    | 'MULTIPLY_THREE_PATH_IS_3X3_PURE_BLOCK_REPLICATION'
    | 'MULTIPLY_FOUR_PATH_CALLS_EXPAND4_FUNCTION'
    | 'MULTIPLY_FOUR_PATH_IS_DOCUMENTED_BROKEN_IN_SOURCE'
    | 'NO_BILINEAR_FILTERING_ON_UPSCALE'
    | 'NO_TRILINEAR_FILTERING_ON_UPSCALE'
    | 'NO_ANISOTROPIC_FILTERING_ON_UPSCALE'
    | 'NO_TWO_PIXEL_BLENDING_ON_UPSCALE'
    | 'NO_FRACTIONAL_SCALE_MULTIPLIERS'
    | 'NO_DITHERING_AT_BLIT'
    | 'NO_SUBPIXEL_RENDERING_AT_BLIT'
    | 'NO_ALPHA_CHANNEL_BLENDING_AT_BLIT'
    | 'NO_NON_GAMMA_COLOR_MATRIX_POST_PROCESSING'
    | 'NO_GPU_SHADER_ON_BLIT_PATH'
    | 'NO_PARTIAL_RECT_DIRTY_REGION_BLITS'
    | 'NO_PER_FRAME_VSYNC_GATE_VISIBLE_TO_GAME_LOGIC'
    | 'NO_INTERMEDIATE_RGB_FRAMEBUFFER_BEFORE_BLIT'
    | 'PRESENTATION_VIA_XSHMPUTIMAGE_OR_XPUTIMAGE'
    | 'PRESENTATION_RECT_IS_FULL_FRAME_ZERO_ZERO_TO_X_WIDTH_X_HEIGHT'
    | 'PRESENTATION_NON_SHM_PATH_USES_XSYNC_FALSE_FLAG'
    | 'PRESENTATION_SHM_PATH_USES_SHMFINISHED_HANDSHAKE'
    | 'INDEXED_FRAMEBUFFER_HOLDS_PALETTE_INDICES_NOT_RGB'
    | 'X_SERVER_RESOLVES_INDICES_TO_RGB_VIA_COLORMAP';
  /** Plain-language description of the lock clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'i_video.c';
  /** Verbatim C symbol the lock clause is pinned against. */
  readonly cSymbol: 'I_SetPalette' | 'UploadNewPalette' | 'I_FinishUpdate' | 'Expand4';
}

/**
 * Pinned ledger of every lock clause for the vanilla DOOM 1.9
 * palette-blit-without-filtering contract.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK: readonly VanillaPaletteBlitWithoutFilteringLockEntry[] = [
  {
    id: 'PALETTE_HAS_256_ENTRIES',
    invariant:
      'The vanilla DOOM 1.9 palette upload iterates exactly 256 entries. Verbatim from `linuxdoom-1.10/i_video.c` UploadNewPalette: `for (i=0 ; i<256 ; i++)` is the loop bound for both the firstcall init pass and the per-call entry-update pass. A handler that uploads fewer than 256 entries leaves stale colors; a handler that uploads more is an out-of-bounds read against the 768-byte PLAYPAL block.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'PALETTE_BYTES_PER_ENTRY_IS_THREE',
    invariant:
      'The vanilla DOOM 1.9 palette upload reads exactly 3 bytes per entry — three sequential `*palette++` reads (one each for red, green, blue). A handler that reads 4 bytes per entry (treating PLAYPAL as RGBA) is a parity violation against the verbatim three-read sequence.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'PALETTE_TOTAL_BYTES_IS_768',
    invariant:
      'The vanilla DOOM 1.9 PLAYPAL palette is 768 bytes total (256 entries * 3 bytes/entry). The UploadNewPalette function consumes the entire 768-byte block via its 256-iteration loop, advancing the `palette` pointer 768 times across all three channel reads. A handler that uses any other PLAYPAL byte count is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'PALETTE_RGB_CHANNEL_ORDER_IS_R_THEN_G_THEN_B',
    invariant:
      'The vanilla DOOM 1.9 palette upload reads channels in the order red, green, blue. Verbatim from UploadNewPalette: `c = gammatable[usegamma][*palette++]; colors[i].red = (c<<8) + c; c = gammatable[usegamma][*palette++]; colors[i].green = (c<<8) + c; c = gammatable[usegamma][*palette++]; colors[i].blue = (c<<8) + c;`. A handler that swaps the channel order (BGR or BRG) is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'PALETTE_INPUT_FORMAT_IS_R8G8B8_NO_ALPHA',
    invariant:
      'The vanilla DOOM 1.9 PLAYPAL byte stream is R8G8B8 with no alpha channel and no padding. Each `*palette++` read consumes one unsigned 8-bit byte; there is no fourth channel between or after the three RGB bytes. A handler that injects an alpha byte or padding byte is a parity violation against the 768-byte total.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'PALETTE_ENTRY_PIXEL_FIELD_EQUALS_INDEX',
    invariant:
      'The vanilla DOOM 1.9 X colormap entry assigns its `pixel` field equal to the loop index `i`. Verbatim from UploadNewPalette firstcall init: `colors[i].pixel = i;`. The framebuffer byte value `i` resolves to the RGB triple stored in `colors[i]` at presentation time. A handler that permutes the index-to-pixel mapping is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'PALETTE_ENTRY_FLAGS_LOCKED_AT_DO_RED_GREEN_BLUE',
    invariant:
      'The vanilla DOOM 1.9 X colormap entry sets `flags = DoRed|DoGreen|DoBlue` requesting the X server to apply all three channels. Verbatim from UploadNewPalette firstcall init: `colors[i].flags = DoRed|DoGreen|DoBlue;`. A handler that omits any of the three flag bits suppresses one channel of the entire palette.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'PALETTE_GAMMA_CORRECTED_VIA_GAMMATABLE_LOOKUP',
    invariant:
      'The vanilla DOOM 1.9 palette upload applies gamma correction via the `gammatable[usegamma][*palette++]` lookup. Verbatim from UploadNewPalette per-channel: `c = gammatable[usegamma][*palette++];`. The lookup is a 2D array: first axis is `usegamma` ∈ {0,1,2,3,4}, second axis is the input byte ∈ [0, 255]. A handler that bypasses the gammatable or applies a continuous gamma curve is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'GAMMA_CURVE_COUNT_LOCKED_AT_FIVE',
    invariant:
      'The vanilla DOOM 1.9 gammatable holds exactly 5 gamma curves indexed by `usegamma` ∈ {0,1,2,3,4}. The M_Menu UI cycles through these five settings; there is no continuous slider and no sixth curve. A handler that exposes more or fewer curves diverges from the M_Menu binding.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'PALETTE_8_BIT_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION',
    invariant:
      'The vanilla DOOM 1.9 8-bit-to-16-bit channel expansion is `(c<<8) + c`. Verbatim from UploadNewPalette: `colors[i].red = (c<<8) + c;`. The PLAYPAL byte 0xAB becomes the X colormap word 0xABAB — high byte equal to low byte. A handler that uses zero-padding (`c<<8`) or 257-multiplication (`c*257` is the same value but only when c ∈ [0,255], so the encoding is equivalent to byte duplication) is logically the same; a handler that linearly scales (`c*65535/255`) is NOT bit-equal because the integer division rounds differently.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'PALETTE_UPLOAD_USES_X_STORE_COLORS_PRIMITIVE',
    invariant:
      'The vanilla DOOM 1.9 palette upload pushes all 256 entries to the X server in a single `XStoreColors(X_display, cmap, colors, 256);` call. Verbatim from UploadNewPalette tail. A handler that uses XAllocColor (per-entry round-trip) or XQueryColors (read-only) is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'PALETTE_UPLOADED_ONLY_VIA_I_SET_PALETTE',
    invariant:
      'The vanilla DOOM 1.9 palette is uploaded only when `I_SetPalette(byte* palette)` is invoked. The renderer calls I_SetPalette at boundary events (red flash, item pickup, blood splash, gamma cycle), not every tic. A handler that re-uploads the palette every frame is a parity violation against the event-driven upload pattern.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_SetPalette',
  },
  {
    id: 'NO_PER_FRAME_PALETTE_REUPLOAD',
    invariant:
      'The vanilla DOOM 1.9 I_FinishUpdate function does NOT call I_SetPalette or UploadNewPalette. The colormap is uploaded only on event-driven I_SetPalette calls; the per-frame blit reuses the existing X colormap. A handler that hooks UploadNewPalette inside I_FinishUpdate is a parity violation against the event-driven upload contract.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'BLIT_BRANCHES_ON_MULTIPLY_ONE_TWO_THREE_FOUR',
    invariant:
      'The vanilla DOOM 1.9 I_FinishUpdate dispatches on `multiply ∈ {1,2,3,4}`. The verbatim source has separate code paths for multiply==1 (zero-copy alias), multiply==2 (2x2 block replication), multiply==3 (3x3 block replication), and multiply==4 (Expand4 call, marked Broken). A handler that supports only one branch is incomplete; a handler that supports a fifth branch (multiply==5+) is a parity violation against the canonical four-way switch.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'MULTIPLY_ONE_PATH_IS_ZERO_COPY_ALIAS',
    invariant:
      'The vanilla DOOM 1.9 multiply==1 blit path performs zero pixel copy. Because `screens[0] = (unsigned char *) (image->data)` was set at I_InitGraphics, the renderer writes directly into the X image buffer. I_FinishUpdate at multiply==1 calls XShmPutImage / XPutImage immediately without any pixel-transformation loop. A handler that adds a memcpy at multiply==1 is a parity violation against the alias contract pinned by step 03-014 clause SCREENS_ZERO_DIRECT_ALIAS_TO_IMAGE_DATA_AT_MULTIPLY_ONE.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'MULTIPLY_TWO_PATH_IS_2X2_PURE_BLOCK_REPLICATION',
    invariant:
      'The vanilla DOOM 1.9 multiply==2 blit path uses the verbatim 4-pixels-in / 8-pixels-out unrolled loop with bitwise mask+shift arithmetic: `fouripixels = *ilineptr++; twoopixels = (fouripixels & 0xff000000) | ((fouripixels>>8) & 0xffff00) | ((fouripixels>>16) & 0xff); twomoreopixels = ((fouripixels<<16) & 0xff000000) | ((fouripixels<<8) & 0xffff00) | (fouripixels & 0xff);`. Each input pixel is duplicated into a 2x2 output block; no two input pixels are blended. A handler that uses bilinear/trilinear/anisotropic filtering at multiply==2 is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'MULTIPLY_THREE_PATH_IS_3X3_PURE_BLOCK_REPLICATION',
    invariant:
      'The vanilla DOOM 1.9 multiply==3 blit path uses a 4-pixels-in / 12-pixels-out unrolled loop with bitwise mask+shift arithmetic. Each input pixel is duplicated into a 3x3 output block; no two input pixels are blended. A handler that uses bilinear filtering at multiply==3 is a parity violation against the pure-replication contract.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'MULTIPLY_FOUR_PATH_CALLS_EXPAND4_FUNCTION',
    invariant:
      'The vanilla DOOM 1.9 multiply==4 blit path calls the external `Expand4()` function. A handler that inlines a 4x4 block-replication loop at the I_FinishUpdate site (instead of calling Expand4) is a parity violation against the verbatim function-call dispatch.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'MULTIPLY_FOUR_PATH_IS_DOCUMENTED_BROKEN_IN_SOURCE',
    invariant:
      'The vanilla DOOM 1.9 source comments mark Expand4 as `Broken. Gotta fix this some day.`. A vanilla-parity Win32 host SHOULD mirror the broken state by either omitting the multiply==4 path entirely or implementing it but documenting that the upstream vanilla function is broken — silently fixing it changes the surface the host exposes to the renderer.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'Expand4',
  },
  {
    id: 'NO_BILINEAR_FILTERING_ON_UPSCALE',
    invariant:
      'The vanilla DOOM 1.9 upscale paths apply NO bilinear filtering. The multiply==2 and multiply==3 paths use bitwise mask+shift block replication that copies each input pixel to multiple output pixels without weighted averaging. A handler that wraps the framebuffer in an OpenGL texture with GL_LINEAR / GL_NEAREST_MIPMAP_LINEAR is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_TRILINEAR_FILTERING_ON_UPSCALE',
    invariant: 'The vanilla DOOM 1.9 upscale paths apply NO trilinear filtering. Vanilla 1.9 has no mipmap pyramid for the framebuffer and no MIP_LINEAR mode anywhere. A handler that uses GL_LINEAR_MIPMAP_LINEAR is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_ANISOTROPIC_FILTERING_ON_UPSCALE',
    invariant:
      'The vanilla DOOM 1.9 upscale paths apply NO anisotropic filtering. Anisotropic filtering requires a programmable GPU; vanilla 1.9 has no GPU code path on either DOS (mode 13h hardware doubling) or linuxdoom-1.10 (X11 software / MIT-SHM). A handler that enables EXT_texture_filter_anisotropic is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_TWO_PIXEL_BLENDING_ON_UPSCALE',
    invariant:
      'The vanilla DOOM 1.9 upscale paths NEVER blend two input pixels into one output pixel. Every output pixel is a 1-to-1 copy of one input pixel via the bitwise mask+shift unrolled loop. A handler that uses any 2-tap weighted-average smoothing kernel is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_FRACTIONAL_SCALE_MULTIPLIERS',
    invariant:
      'The vanilla DOOM 1.9 multiply variable is an integer ∈ {1,2,3,4}. There are no fractional scales (1.5x, 2.5x, 3.5x). A handler that exposes a fractional scale slider is a parity violation against the four-branch integer switch.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_DITHERING_AT_BLIT',
    invariant:
      'The vanilla DOOM 1.9 blit pipeline applies NO dithering. Every framebuffer byte is written verbatim to the X image without ordered-dither, error-diffusion (Floyd-Steinberg), or noise-injection. A handler that adds a dither pattern is a parity violation against the verbatim byte copy.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_SUBPIXEL_RENDERING_AT_BLIT',
    invariant:
      'The vanilla DOOM 1.9 blit pipeline writes every output pixel at integer screen coordinates. There is no subpixel offset, no anti-aliased edge, no fractional-pixel sampling. A handler that uses subpixel positioning (e.g. CLEARTYPE on text) is a parity violation against the integer pixel grid.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_ALPHA_CHANNEL_BLENDING_AT_BLIT',
    invariant:
      'The vanilla DOOM 1.9 blit pipeline does NOT use a per-pixel alpha channel anywhere. Translucency for the fuzz monster effect and translucent decorations is handled at the renderer call site (R_DrawFuzzColumn) via colormap lookup — never at the framebuffer storage or blit level. A handler that introduces an alpha-blending stage between screens[0] and the X image is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_NON_GAMMA_COLOR_MATRIX_POST_PROCESSING',
    invariant:
      'The vanilla DOOM 1.9 palette pipeline applies NO color-matrix post-processing besides the gammatable lookup. There is no hue rotation, no saturation adjustment, no contrast slider, no brightness slider — usegamma ∈ {0..4} is the only color-channel knob. A handler that adds a saturation slider on top of gammatable is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
  {
    id: 'NO_GPU_SHADER_ON_BLIT_PATH',
    invariant:
      'The vanilla DOOM 1.9 blit pipeline uses NO GPU shaders, fragment programs, or vertex programs. The X11 path is pure software (XPutImage) or MIT-SHM DMA into the X server pixmap area (XShmPutImage); neither route involves GPU code. A handler that wraps the framebuffer in a Vulkan / Metal / D3D pipeline is a parity violation against the pure-CPU software-blit contract.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_PARTIAL_RECT_DIRTY_REGION_BLITS',
    invariant:
      'The vanilla DOOM 1.9 I_FinishUpdate uploads the FULL framebuffer every call. The XShmPutImage and XPutImage call signatures both pass `(0, 0, 0, 0, X_width, X_height)` — full-screen blit, no dirty-region tracking, no scissor. A handler that diffs frames and uploads only changed scanlines is a parity violation against the verbatim full-frame blit.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_PER_FRAME_VSYNC_GATE_VISIBLE_TO_GAME_LOGIC',
    invariant:
      'The vanilla DOOM 1.9 I_FinishUpdate does NOT block on vsync. The non-SHM path calls `XSync(X_display, False)` to flush queued requests; the SHM path waits only for the X server to acknowledge the put-image via `shmFinished`. Neither waits for vertical retrace; the X server may discard or coalesce frames if the client out-runs the display. A handler that injects a vsync wait is a parity violation against the verbatim non-blocking flush.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'NO_INTERMEDIATE_RGB_FRAMEBUFFER_BEFORE_BLIT',
    invariant:
      'The vanilla DOOM 1.9 blit pipeline contains NO intermediate ARGB / RGB / BGRA 32-bit framebuffer between the indexed framebuffer and the X server. The X server resolves indices to RGB at presentation time via the colormap. (Chocolate Doom 2.2.1 SDL2 variants use an `argbbuffer` intermediate; that is a Chocolate-only divergence not present in vanilla 1.9.) A handler that materialises an RGB framebuffer is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'PRESENTATION_VIA_XSHMPUTIMAGE_OR_XPUTIMAGE',
    invariant:
      'The vanilla DOOM 1.9 blit issues either `XShmPutImage(X_display, X_mainWindow, X_gc, image, 0, 0, 0, 0, X_width, X_height, True)` (when SHM available) or `XPutImage(X_display, X_mainWindow, X_gc, image, 0, 0, 0, 0, X_width, X_height)` (otherwise). The SHM path is preferred; the non-SHM path is the fallback. A handler that uses any other X11 primitive (XCopyArea, XSetWindowBackgroundPixmap) is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'PRESENTATION_RECT_IS_FULL_FRAME_ZERO_ZERO_TO_X_WIDTH_X_HEIGHT',
    invariant:
      'The vanilla DOOM 1.9 XShmPutImage / XPutImage call passes `src_x=0, src_y=0, dest_x=0, dest_y=0, width=X_width, height=X_height` — the full framebuffer rectangle. X_width = SCREENWIDTH * multiply and X_height = SCREENHEIGHT * multiply. A handler that passes any other rectangle (off-screen offset, partial blit) is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'PRESENTATION_NON_SHM_PATH_USES_XSYNC_FALSE_FLAG',
    invariant:
      'The vanilla DOOM 1.9 non-SHM blit path ends with `XSync(X_display, False)` — discard==False meaning queued events are NOT discarded. A handler that passes True (discard) is a parity violation against the verbatim flag preservation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'PRESENTATION_SHM_PATH_USES_SHMFINISHED_HANDSHAKE',
    invariant:
      'The vanilla DOOM 1.9 SHM blit path ends with `shmFinished = false; do { I_GetEvent(); } while (!shmFinished);` — a poll-event loop awaiting the X server SHM completion event. A handler that uses a synchronous XSync after XShmPutImage is a parity violation against the verbatim handshake.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'INDEXED_FRAMEBUFFER_HOLDS_PALETTE_INDICES_NOT_RGB',
    invariant:
      'The vanilla DOOM 1.9 framebuffer stores 8-bit unsigned palette INDICES (0..255) — never resolved RGB triples. The renderer writes index bytes to screens[0]; the X server resolves indices to RGB at presentation time via the X colormap. A handler that pre-resolves indices to RGB before XPutImage is a parity violation against the indexed-storage contract pinned by step 03-014.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_FinishUpdate',
  },
  {
    id: 'X_SERVER_RESOLVES_INDICES_TO_RGB_VIA_COLORMAP',
    invariant:
      'The vanilla DOOM 1.9 RGB resolution happens at the X server, not at the client. The X server uses the colormap installed via XStoreColors to look up each indexed pixel value; the X11 PseudoColor visual (depth=8) is the canonical visual class for this. A handler that resolves on the client side is a parity violation against the verbatim X11 colormap-lookup architecture.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'UploadNewPalette',
  },
];

/** Number of audited lock clauses pinned by the ledger. */
export const VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_LOCK_CLAUSE_COUNT = 38;

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations.
 */
export interface VanillaPaletteBlitWithoutFilteringDerivedInvariant {
  readonly id: string;
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_DERIVED_INVARIANTS: readonly VanillaPaletteBlitWithoutFilteringDerivedInvariant[] = [
  {
    id: 'PALETTE_DIMENSIONS_LOCKED_AT_256_ENTRIES_3_BYTES_768_TOTAL',
    description: 'The PLAYPAL palette has exactly 256 entries, 3 bytes per entry (R8G8B8 with no alpha), and 768 bytes total. The X colormap upload iterates 256 times.',
  },
  {
    id: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
    description: 'PLAYPAL bytes are read in the order red, green, blue with no alpha or padding byte between or after the channel triples.',
  },
  {
    id: 'PALETTE_GAMMA_PIPELINE_USES_GAMMATABLE_LOOKUP_WITH_FIVE_CURVES',
    description: 'Each palette byte is gamma-corrected via `gammatable[usegamma][input]` with `usegamma` ∈ {0,1,2,3,4} (five curves) and the input byte selecting the entry within the chosen curve.',
  },
  {
    id: 'PALETTE_8_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION',
    description: 'The 8-bit gamma-corrected channel value `c` becomes the 16-bit X colormap channel value `(c<<8) + c` — high byte equal to low byte, preserving the maximum gamut spread.',
  },
  {
    id: 'PALETTE_X_COLORMAP_ENTRY_IDENTITY_MAPS_INDEX_TO_PIXEL_FIELD',
    description: 'The X colormap entry assigns `pixel = i` (the loop index), with the `flags = DoRed|DoGreen|DoBlue` mask requesting the X server to update all three channels.',
  },
  {
    id: 'PALETTE_UPLOAD_VIA_X_STORE_COLORS_AND_ONLY_VIA_I_SET_PALETTE',
    description: 'All 256 colormap entries are uploaded via a single XStoreColors call. The upload happens only when I_SetPalette is invoked — never per frame.',
  },
  {
    id: 'BLIT_DISPATCH_IS_INTEGER_MULTIPLY_ONE_TWO_THREE_OR_FOUR',
    description: 'I_FinishUpdate dispatches on `multiply ∈ {1,2,3,4}`; multiply==1 is zero-copy alias, multiply==2/3 are pure block replication, multiply==4 calls Expand4 (marked Broken in source).',
  },
  {
    id: 'BLIT_UPSCALE_IS_PURE_BLOCK_REPLICATION_NO_FILTERING_NO_BLENDING',
    description:
      'The multiply > 1 paths use bitwise mask+shift block replication that duplicates each input pixel into its 2x2 / 3x3 / 4x4 output block. No bilinear, trilinear, anisotropic, or weighted-average smoothing is applied at any scale.',
  },
  {
    id: 'BLIT_PIPELINE_HAS_NO_DITHERING_NO_SUBPIXEL_NO_ALPHA_NO_GPU_SHADER',
    description: 'The blit pipeline applies no dithering, no subpixel rendering, no per-pixel alpha blending, and no GPU shader. The X11 path is pure software (XPutImage) or MIT-SHM DMA (XShmPutImage).',
  },
  {
    id: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
    description: 'I_FinishUpdate uploads the full SCREENWIDTH * multiply x SCREENHEIGHT * multiply rectangle via XShmPutImage (SHM available) or XPutImage (fallback). No dirty-region tracking; no partial-rect blits.',
  },
  {
    id: 'PRESENTATION_HAS_NO_PER_FRAME_VSYNC_GATE_VISIBLE_TO_GAME_LOGIC',
    description: 'The non-SHM path uses XSync(X_display, False) to flush; the SHM path uses the shmFinished handshake to await server acknowledgement. Neither blocks on vertical retrace.',
  },
  {
    id: 'PALETTE_BLIT_DATA_FLOW_IS_INDEX_THEN_X_SERVER_COLORMAP_LOOKUP',
    description: 'The framebuffer holds palette indices (8-bit unsigned). The X server resolves indices to RGB via the colormap at presentation time. There is no intermediate RGB framebuffer on the client side.',
  },
];

/** Number of derived invariants. */
export const VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_DERIVED_INVARIANT_COUNT = 12;

/**
 * Discriminator for one probe-style query against the canonical
 * vanilla 1.9 palette-blit-without-filtering lock contract.
 */
export type VanillaPaletteBlitWithoutFilteringQueryKind =
  | 'palette-entry-count'
  | 'palette-bytes-per-entry'
  | 'palette-total-bytes'
  | 'palette-channel-count'
  | 'palette-input-bits-per-channel'
  | 'x-colormap-output-bits-per-channel'
  | 'palette-channel-byte-offset'
  | 'palette-eight-to-sixteen-bit-expansion-of-input'
  | 'gamma-curve-count'
  | 'gamma-table-input-index-count'
  | 'multiply-zero-copy-alias-value'
  | 'multiply-2x2-replication-value'
  | 'multiply-3x3-replication-value'
  | 'multiply-4x4-replication-value'
  | 'x-width-for-multiply'
  | 'x-height-for-multiply'
  | 'x-colormap-flags-symbol'
  | 'palette-upload-x11-symbol'
  | 'presentation-x11-shm-symbol'
  | 'presentation-x11-non-shm-symbol'
  | 'x11-non-shm-xsync-discard-flag'
  | 'x11-shm-handshake-flag-symbol'
  | 'upload-new-palette-c-symbol'
  | 'i-set-palette-c-symbol'
  | 'i-finish-update-c-symbol'
  | 'gamma-table-c-symbol'
  | 'use-gamma-c-symbol'
  | 'expand4-c-symbol'
  | 'expand4-broken-comment'
  | 'vanilla-uses-bilinear-filtering'
  | 'vanilla-uses-trilinear-filtering'
  | 'vanilla-uses-anisotropic-filtering'
  | 'vanilla-supports-fractional-scales'
  | 'vanilla-uses-dithering'
  | 'vanilla-uses-subpixel-rendering'
  | 'vanilla-blends-adjacent-pixels-on-upscale'
  | 'vanilla-uses-alpha-channel-blending-at-blit'
  | 'vanilla-reuploads-palette-every-frame'
  | 'vanilla-applies-non-gamma-color-matrix'
  | 'vanilla-uses-gpu-shader-at-blit'
  | 'vanilla-uses-partial-rect-blits'
  | 'vanilla-holds-per-frame-vsync-gate'
  | 'vanilla-uses-rgb-intermediate-before-blit';

/**
 * One probe applied to a runtime vanilla palette-blit-without-filtering
 * lock handler.
 */
export interface VanillaPaletteBlitWithoutFilteringProbe {
  readonly id: string;
  readonly description: string;
  readonly queryKind: VanillaPaletteBlitWithoutFilteringQueryKind;
  /** Optional channel index argument for `palette-channel-byte-offset` (0=R, 1=G, 2=B). */
  readonly queryChannelIndex: number | null;
  /** Optional palette entry index argument for `palette-channel-byte-offset` (0..255). */
  readonly queryPaletteEntryIndex: number | null;
  /** Optional input byte argument for `palette-eight-to-sixteen-bit-expansion-of-input` (0..255). */
  readonly queryInputByte: number | null;
  /** Optional multiply value argument for `x-width-for-multiply` and `x-height-for-multiply` (1, 2, or 3). */
  readonly queryMultiply: number | null;
  readonly expectedAnsweredNumber: number | null;
  readonly expectedAnsweredString: string | null;
  readonly expectedAnsweredBoolean: boolean | null;
  readonly witnessInvariantId: string;
}

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a single query against the canonical lock contract plus
 * the expected answer.
 */
export const VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES: readonly VanillaPaletteBlitWithoutFilteringProbe[] = [
  {
    id: 'palette-entry-count-is-256',
    description: 'PLAYPAL has 256 palette entries.',
    queryKind: 'palette-entry-count',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 256,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_DIMENSIONS_LOCKED_AT_256_ENTRIES_3_BYTES_768_TOTAL',
  },
  {
    id: 'palette-bytes-per-entry-is-three',
    description: 'Each PLAYPAL entry is 3 bytes (R, G, B).',
    queryKind: 'palette-bytes-per-entry',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 3,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_DIMENSIONS_LOCKED_AT_256_ENTRIES_3_BYTES_768_TOTAL',
  },
  {
    id: 'palette-total-bytes-is-768',
    description: 'Total PLAYPAL block is 768 bytes (256 * 3).',
    queryKind: 'palette-total-bytes',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 768,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_DIMENSIONS_LOCKED_AT_256_ENTRIES_3_BYTES_768_TOTAL',
  },
  {
    id: 'palette-channel-count-is-three',
    description: 'PLAYPAL has 3 channels (R, G, B).',
    queryKind: 'palette-channel-count',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 3,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
  },
  {
    id: 'palette-input-bits-per-channel-is-eight',
    description: 'PLAYPAL is 8 bits per channel.',
    queryKind: 'palette-input-bits-per-channel',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 8,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_DIMENSIONS_LOCKED_AT_256_ENTRIES_3_BYTES_768_TOTAL',
  },
  {
    id: 'x-colormap-output-bits-per-channel-is-sixteen',
    description: 'X colormap entries are 16 bits per channel.',
    queryKind: 'x-colormap-output-bits-per-channel',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 16,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_8_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION',
  },
  {
    id: 'palette-channel-byte-offset-entry-zero-red',
    description: 'Entry 0 red channel is at byte offset 0.',
    queryKind: 'palette-channel-byte-offset',
    queryChannelIndex: 0,
    queryPaletteEntryIndex: 0,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 0,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
  },
  {
    id: 'palette-channel-byte-offset-entry-zero-green',
    description: 'Entry 0 green channel is at byte offset 1.',
    queryKind: 'palette-channel-byte-offset',
    queryChannelIndex: 1,
    queryPaletteEntryIndex: 0,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 1,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
  },
  {
    id: 'palette-channel-byte-offset-entry-zero-blue',
    description: 'Entry 0 blue channel is at byte offset 2.',
    queryKind: 'palette-channel-byte-offset',
    queryChannelIndex: 2,
    queryPaletteEntryIndex: 0,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 2,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
  },
  {
    id: 'palette-channel-byte-offset-entry-one-red',
    description: 'Entry 1 red channel is at byte offset 3.',
    queryKind: 'palette-channel-byte-offset',
    queryChannelIndex: 0,
    queryPaletteEntryIndex: 1,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 3,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
  },
  {
    id: 'palette-channel-byte-offset-entry-255-blue',
    description: 'Entry 255 blue channel is at byte offset 767 (the last byte of PLAYPAL).',
    queryKind: 'palette-channel-byte-offset',
    queryChannelIndex: 2,
    queryPaletteEntryIndex: 255,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 767,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_FORMAT_LOCKED_AT_R_THEN_G_THEN_B_NO_ALPHA',
  },
  {
    id: 'palette-eight-to-sixteen-bit-expansion-of-zero-is-zero',
    description: 'Input byte 0x00 expands to 0x0000.',
    queryKind: 'palette-eight-to-sixteen-bit-expansion-of-input',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: 0x00,
    queryMultiply: null,
    expectedAnsweredNumber: 0x0000,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_8_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION',
  },
  {
    id: 'palette-eight-to-sixteen-bit-expansion-of-ab-is-abab',
    description: 'Input byte 0xAB expands to 0xABAB (byte duplication).',
    queryKind: 'palette-eight-to-sixteen-bit-expansion-of-input',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: 0xab,
    queryMultiply: null,
    expectedAnsweredNumber: 0xabab,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_8_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION',
  },
  {
    id: 'palette-eight-to-sixteen-bit-expansion-of-ff-is-ffff',
    description: 'Input byte 0xFF expands to 0xFFFF (max gamut).',
    queryKind: 'palette-eight-to-sixteen-bit-expansion-of-input',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: 0xff,
    queryMultiply: null,
    expectedAnsweredNumber: 0xffff,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_8_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION',
  },
  {
    id: 'palette-eight-to-sixteen-bit-expansion-of-01-is-0101',
    description: 'Input byte 0x01 expands to 0x0101 — not 0x0100 (which would be `c<<8` zero-padding).',
    queryKind: 'palette-eight-to-sixteen-bit-expansion-of-input',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: 0x01,
    queryMultiply: null,
    expectedAnsweredNumber: 0x0101,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_8_TO_16_BIT_EXPANSION_IS_BYTE_DUPLICATION',
  },
  {
    id: 'gamma-curve-count-is-five',
    description: 'gammatable holds 5 gamma curves indexed by usegamma ∈ {0,1,2,3,4}.',
    queryKind: 'gamma-curve-count',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 5,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_GAMMA_PIPELINE_USES_GAMMATABLE_LOOKUP_WITH_FIVE_CURVES',
  },
  {
    id: 'gamma-table-input-index-count-is-256',
    description: 'Each gamma curve has 256 entries indexed by the input byte.',
    queryKind: 'gamma-table-input-index-count',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 256,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_GAMMA_PIPELINE_USES_GAMMATABLE_LOOKUP_WITH_FIVE_CURVES',
  },
  {
    id: 'multiply-zero-copy-alias-value-is-one',
    description: 'multiply==1 is the zero-copy alias path.',
    queryKind: 'multiply-zero-copy-alias-value',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 1,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'BLIT_DISPATCH_IS_INTEGER_MULTIPLY_ONE_TWO_THREE_OR_FOUR',
  },
  {
    id: 'multiply-2x2-replication-value-is-two',
    description: 'multiply==2 is the 2x2 block-replication path.',
    queryKind: 'multiply-2x2-replication-value',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 2,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'BLIT_DISPATCH_IS_INTEGER_MULTIPLY_ONE_TWO_THREE_OR_FOUR',
  },
  {
    id: 'multiply-3x3-replication-value-is-three',
    description: 'multiply==3 is the 3x3 block-replication path.',
    queryKind: 'multiply-3x3-replication-value',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 3,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'BLIT_DISPATCH_IS_INTEGER_MULTIPLY_ONE_TWO_THREE_OR_FOUR',
  },
  {
    id: 'multiply-4x4-replication-value-is-four',
    description: 'multiply==4 is the 4x4 block-replication path (Expand4).',
    queryKind: 'multiply-4x4-replication-value',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: 4,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'BLIT_DISPATCH_IS_INTEGER_MULTIPLY_ONE_TWO_THREE_OR_FOUR',
  },
  {
    id: 'x-width-at-multiply-one-is-screenwidth',
    description: 'X_width at multiply==1 equals SCREENWIDTH = 320.',
    queryKind: 'x-width-for-multiply',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: 1,
    expectedAnsweredNumber: 320,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
  },
  {
    id: 'x-height-at-multiply-one-is-screenheight',
    description: 'X_height at multiply==1 equals SCREENHEIGHT = 200.',
    queryKind: 'x-height-for-multiply',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: 1,
    expectedAnsweredNumber: 200,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
  },
  {
    id: 'x-width-at-multiply-two-is-640',
    description: 'X_width at multiply==2 equals 2 * SCREENWIDTH = 640.',
    queryKind: 'x-width-for-multiply',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: 2,
    expectedAnsweredNumber: 640,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
  },
  {
    id: 'x-height-at-multiply-two-is-400',
    description: 'X_height at multiply==2 equals 2 * SCREENHEIGHT = 400.',
    queryKind: 'x-height-for-multiply',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: 2,
    expectedAnsweredNumber: 400,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
  },
  {
    id: 'x-width-at-multiply-three-is-960',
    description: 'X_width at multiply==3 equals 3 * SCREENWIDTH = 960.',
    queryKind: 'x-width-for-multiply',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: 3,
    expectedAnsweredNumber: 960,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
  },
  {
    id: 'x-height-at-multiply-three-is-600',
    description: 'X_height at multiply==3 equals 3 * SCREENHEIGHT = 600.',
    queryKind: 'x-height-for-multiply',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: 3,
    expectedAnsweredNumber: 600,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
  },
  {
    id: 'x-colormap-flags-symbol-is-do-red-do-green-do-blue',
    description: 'XColor flags is `DoRed|DoGreen|DoBlue`.',
    queryKind: 'x-colormap-flags-symbol',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'DoRed|DoGreen|DoBlue',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_X_COLORMAP_ENTRY_IDENTITY_MAPS_INDEX_TO_PIXEL_FIELD',
  },
  {
    id: 'palette-upload-x11-symbol-is-x-store-colors',
    description: 'X11 palette upload primitive is XStoreColors.',
    queryKind: 'palette-upload-x11-symbol',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'XStoreColors',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_UPLOAD_VIA_X_STORE_COLORS_AND_ONLY_VIA_I_SET_PALETTE',
  },
  {
    id: 'presentation-x11-shm-symbol-is-x-shm-put-image',
    description: 'X11 SHM presentation primitive is XShmPutImage.',
    queryKind: 'presentation-x11-shm-symbol',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'XShmPutImage',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
  },
  {
    id: 'presentation-x11-non-shm-symbol-is-x-put-image',
    description: 'X11 non-SHM presentation primitive is XPutImage.',
    queryKind: 'presentation-x11-non-shm-symbol',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'XPutImage',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
  },
  {
    id: 'x11-non-shm-xsync-discard-flag-is-false',
    description: 'XSync discard flag in I_FinishUpdate non-SHM path is False.',
    queryKind: 'x11-non-shm-xsync-discard-flag',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PRESENTATION_HAS_NO_PER_FRAME_VSYNC_GATE_VISIBLE_TO_GAME_LOGIC',
  },
  {
    id: 'x11-shm-handshake-flag-symbol-is-shm-finished',
    description: 'X11 SHM handshake flag symbol is shmFinished.',
    queryKind: 'x11-shm-handshake-flag-symbol',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'shmFinished',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PRESENTATION_HAS_NO_PER_FRAME_VSYNC_GATE_VISIBLE_TO_GAME_LOGIC',
  },
  {
    id: 'upload-new-palette-c-symbol-is-upload-new-palette',
    description: 'UploadNewPalette is the C symbol that uploads the colormap.',
    queryKind: 'upload-new-palette-c-symbol',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'UploadNewPalette',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_UPLOAD_VIA_X_STORE_COLORS_AND_ONLY_VIA_I_SET_PALETTE',
  },
  {
    id: 'i-set-palette-c-symbol-is-i-set-palette',
    description: 'I_SetPalette is the C entry symbol exposed to the renderer.',
    queryKind: 'i-set-palette-c-symbol',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'I_SetPalette',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_UPLOAD_VIA_X_STORE_COLORS_AND_ONLY_VIA_I_SET_PALETTE',
  },
  {
    id: 'i-finish-update-c-symbol-is-i-finish-update',
    description: 'I_FinishUpdate is the C entry symbol that issues the per-frame blit.',
    queryKind: 'i-finish-update-c-symbol',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'I_FinishUpdate',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
  },
  {
    id: 'gamma-table-c-symbol-is-gammatable',
    description: 'gammatable is the C array name for the gamma lookup tables.',
    queryKind: 'gamma-table-c-symbol',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'gammatable',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_GAMMA_PIPELINE_USES_GAMMATABLE_LOOKUP_WITH_FIVE_CURVES',
  },
  {
    id: 'use-gamma-c-symbol-is-usegamma',
    description: 'usegamma is the C variable selecting the gamma curve.',
    queryKind: 'use-gamma-c-symbol',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'usegamma',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PALETTE_GAMMA_PIPELINE_USES_GAMMATABLE_LOOKUP_WITH_FIVE_CURVES',
  },
  {
    id: 'expand4-c-symbol-is-expand4',
    description: 'Expand4 is the C function called on the multiply==4 path.',
    queryKind: 'expand4-c-symbol',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'Expand4',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'BLIT_DISPATCH_IS_INTEGER_MULTIPLY_ONE_TWO_THREE_OR_FOUR',
  },
  {
    id: 'expand4-broken-comment-is-broken-gotta-fix-this',
    description: 'Expand4 is documented as Broken in the source.',
    queryKind: 'expand4-broken-comment',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'Broken. Gotta fix this some day.',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'BLIT_DISPATCH_IS_INTEGER_MULTIPLY_ONE_TWO_THREE_OR_FOUR',
  },
  {
    id: 'vanilla-uses-bilinear-filtering-is-false',
    description: 'Vanilla 1.9 does NOT apply bilinear filtering.',
    queryKind: 'vanilla-uses-bilinear-filtering',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'BLIT_UPSCALE_IS_PURE_BLOCK_REPLICATION_NO_FILTERING_NO_BLENDING',
  },
  {
    id: 'vanilla-uses-trilinear-filtering-is-false',
    description: 'Vanilla 1.9 does NOT apply trilinear filtering.',
    queryKind: 'vanilla-uses-trilinear-filtering',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'BLIT_UPSCALE_IS_PURE_BLOCK_REPLICATION_NO_FILTERING_NO_BLENDING',
  },
  {
    id: 'vanilla-uses-anisotropic-filtering-is-false',
    description: 'Vanilla 1.9 does NOT apply anisotropic filtering.',
    queryKind: 'vanilla-uses-anisotropic-filtering',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'BLIT_UPSCALE_IS_PURE_BLOCK_REPLICATION_NO_FILTERING_NO_BLENDING',
  },
  {
    id: 'vanilla-supports-fractional-scales-is-false',
    description: 'Vanilla 1.9 does NOT support fractional scale multipliers.',
    queryKind: 'vanilla-supports-fractional-scales',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'BLIT_DISPATCH_IS_INTEGER_MULTIPLY_ONE_TWO_THREE_OR_FOUR',
  },
  {
    id: 'vanilla-uses-dithering-is-false',
    description: 'Vanilla 1.9 does NOT dither indexed framebuffer pixels.',
    queryKind: 'vanilla-uses-dithering',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'BLIT_PIPELINE_HAS_NO_DITHERING_NO_SUBPIXEL_NO_ALPHA_NO_GPU_SHADER',
  },
  {
    id: 'vanilla-uses-subpixel-rendering-is-false',
    description: 'Vanilla 1.9 does NOT perform subpixel rendering.',
    queryKind: 'vanilla-uses-subpixel-rendering',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'BLIT_PIPELINE_HAS_NO_DITHERING_NO_SUBPIXEL_NO_ALPHA_NO_GPU_SHADER',
  },
  {
    id: 'vanilla-blends-adjacent-pixels-on-upscale-is-false',
    description: 'Vanilla 1.9 does NOT blend adjacent input pixels on upscale.',
    queryKind: 'vanilla-blends-adjacent-pixels-on-upscale',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'BLIT_UPSCALE_IS_PURE_BLOCK_REPLICATION_NO_FILTERING_NO_BLENDING',
  },
  {
    id: 'vanilla-uses-alpha-channel-blending-at-blit-is-false',
    description: 'Vanilla 1.9 does NOT apply per-pixel alpha blending in the blit pipeline.',
    queryKind: 'vanilla-uses-alpha-channel-blending-at-blit',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'BLIT_PIPELINE_HAS_NO_DITHERING_NO_SUBPIXEL_NO_ALPHA_NO_GPU_SHADER',
  },
  {
    id: 'vanilla-reuploads-palette-every-frame-is-false',
    description: 'Vanilla 1.9 does NOT re-upload the palette every frame.',
    queryKind: 'vanilla-reuploads-palette-every-frame',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PALETTE_UPLOAD_VIA_X_STORE_COLORS_AND_ONLY_VIA_I_SET_PALETTE',
  },
  {
    id: 'vanilla-applies-non-gamma-color-matrix-is-false',
    description: 'Vanilla 1.9 does NOT apply hue/saturation/contrast matrices outside gammatable.',
    queryKind: 'vanilla-applies-non-gamma-color-matrix',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PALETTE_GAMMA_PIPELINE_USES_GAMMATABLE_LOOKUP_WITH_FIVE_CURVES',
  },
  {
    id: 'vanilla-uses-gpu-shader-at-blit-is-false',
    description: 'Vanilla 1.9 does NOT use a GPU shader on the blit path.',
    queryKind: 'vanilla-uses-gpu-shader-at-blit',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'BLIT_PIPELINE_HAS_NO_DITHERING_NO_SUBPIXEL_NO_ALPHA_NO_GPU_SHADER',
  },
  {
    id: 'vanilla-uses-partial-rect-blits-is-false',
    description: 'Vanilla 1.9 does NOT use partial-rect (dirty-region) blits.',
    queryKind: 'vanilla-uses-partial-rect-blits',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PRESENTATION_IS_FULL_FRAME_VIA_XSHM_PUT_IMAGE_OR_X_PUT_IMAGE',
  },
  {
    id: 'vanilla-holds-per-frame-vsync-gate-is-false',
    description: 'Vanilla 1.9 does NOT hold a per-frame vsync gate visible to game logic.',
    queryKind: 'vanilla-holds-per-frame-vsync-gate',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PRESENTATION_HAS_NO_PER_FRAME_VSYNC_GATE_VISIBLE_TO_GAME_LOGIC',
  },
  {
    id: 'vanilla-uses-rgb-intermediate-before-blit-is-false',
    description: 'Vanilla 1.9 does NOT use an intermediate RGB framebuffer before the blit.',
    queryKind: 'vanilla-uses-rgb-intermediate-before-blit',
    queryChannelIndex: null,
    queryPaletteEntryIndex: null,
    queryInputByte: null,
    queryMultiply: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PALETTE_BLIT_DATA_FLOW_IS_INDEX_THEN_X_SERVER_COLORMAP_LOOKUP',
  },
];

/** Number of pinned probes. */
export const VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBE_COUNT = 54;

/**
 * Result of evaluating one probe against a runtime handler.
 */
export interface VanillaPaletteBlitWithoutFilteringResult {
  readonly probeId: string;
  readonly answeredNumber: number | null;
  readonly answeredString: string | null;
  readonly answeredBoolean: boolean | null;
}

/**
 * Runtime handler interface for the vanilla 1.9 palette-blit-without-
 * filtering lock contract.
 */
export interface VanillaPaletteBlitWithoutFilteringHandler {
  evaluate(probe: VanillaPaletteBlitWithoutFilteringProbe): VanillaPaletteBlitWithoutFilteringResult;
}

/**
 * Reference handler that answers every probe with the canonical
 * vanilla 1.9 lock value.
 */
export const REFERENCE_VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_HANDLER: VanillaPaletteBlitWithoutFilteringHandler = Object.freeze({
  evaluate(probe: VanillaPaletteBlitWithoutFilteringProbe): VanillaPaletteBlitWithoutFilteringResult {
    return deriveExpectedVanillaPaletteBlitWithoutFilteringResult(probe);
  },
});

/**
 * Convenience derivation that returns the canonical answered result
 * for a given probe.
 */
export function deriveExpectedVanillaPaletteBlitWithoutFilteringResult(probe: VanillaPaletteBlitWithoutFilteringProbe): VanillaPaletteBlitWithoutFilteringResult {
  switch (probe.queryKind) {
    case 'palette-entry-count':
      return { probeId: probe.id, answeredNumber: LOCKED_PALETTE_ENTRY_COUNT, answeredString: null, answeredBoolean: null };
    case 'palette-bytes-per-entry':
      return { probeId: probe.id, answeredNumber: LOCKED_PALETTE_BYTES_PER_ENTRY, answeredString: null, answeredBoolean: null };
    case 'palette-total-bytes':
      return { probeId: probe.id, answeredNumber: LOCKED_PALETTE_TOTAL_BYTES, answeredString: null, answeredBoolean: null };
    case 'palette-channel-count':
      return { probeId: probe.id, answeredNumber: LOCKED_PALETTE_CHANNEL_COUNT, answeredString: null, answeredBoolean: null };
    case 'palette-input-bits-per-channel':
      return { probeId: probe.id, answeredNumber: LOCKED_PALETTE_INPUT_BITS_PER_CHANNEL, answeredString: null, answeredBoolean: null };
    case 'x-colormap-output-bits-per-channel':
      return { probeId: probe.id, answeredNumber: LOCKED_X_COLORMAP_OUTPUT_BITS_PER_CHANNEL, answeredString: null, answeredBoolean: null };
    case 'palette-channel-byte-offset':
      if (probe.queryChannelIndex === null || probe.queryPaletteEntryIndex === null) {
        return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: null };
      }
      if (probe.queryChannelIndex < 0 || probe.queryChannelIndex >= LOCKED_PALETTE_CHANNEL_COUNT) {
        return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: null };
      }
      if (probe.queryPaletteEntryIndex < 0 || probe.queryPaletteEntryIndex >= LOCKED_PALETTE_ENTRY_COUNT) {
        return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: null };
      }
      return {
        probeId: probe.id,
        answeredNumber: probe.queryPaletteEntryIndex * LOCKED_PALETTE_BYTES_PER_ENTRY + probe.queryChannelIndex,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'palette-eight-to-sixteen-bit-expansion-of-input':
      if (probe.queryInputByte === null || probe.queryInputByte < 0 || probe.queryInputByte > 0xff) {
        return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: null };
      }
      return {
        probeId: probe.id,
        answeredNumber: (probe.queryInputByte << 8) + probe.queryInputByte,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'gamma-curve-count':
      return { probeId: probe.id, answeredNumber: LOCKED_GAMMA_CURVE_COUNT, answeredString: null, answeredBoolean: null };
    case 'gamma-table-input-index-count':
      return { probeId: probe.id, answeredNumber: LOCKED_GAMMA_TABLE_INPUT_INDEX_COUNT, answeredString: null, answeredBoolean: null };
    case 'multiply-zero-copy-alias-value':
      return { probeId: probe.id, answeredNumber: LOCKED_MULTIPLY_ZERO_COPY_ALIAS_VALUE, answeredString: null, answeredBoolean: null };
    case 'multiply-2x2-replication-value':
      return { probeId: probe.id, answeredNumber: LOCKED_MULTIPLY_2X2_REPLICATION_VALUE, answeredString: null, answeredBoolean: null };
    case 'multiply-3x3-replication-value':
      return { probeId: probe.id, answeredNumber: LOCKED_MULTIPLY_3X3_REPLICATION_VALUE, answeredString: null, answeredBoolean: null };
    case 'multiply-4x4-replication-value':
      return { probeId: probe.id, answeredNumber: LOCKED_MULTIPLY_4X4_REPLICATION_VALUE, answeredString: null, answeredBoolean: null };
    case 'x-width-for-multiply':
      if (probe.queryMultiply === null) {
        return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: null };
      }
      switch (probe.queryMultiply) {
        case 1:
          return { probeId: probe.id, answeredNumber: LOCKED_X_WIDTH_AT_MULTIPLY_ONE, answeredString: null, answeredBoolean: null };
        case 2:
          return { probeId: probe.id, answeredNumber: LOCKED_X_WIDTH_AT_MULTIPLY_TWO, answeredString: null, answeredBoolean: null };
        case 3:
          return { probeId: probe.id, answeredNumber: LOCKED_X_WIDTH_AT_MULTIPLY_THREE, answeredString: null, answeredBoolean: null };
        default:
          return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: null };
      }
    case 'x-height-for-multiply':
      if (probe.queryMultiply === null) {
        return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: null };
      }
      switch (probe.queryMultiply) {
        case 1:
          return { probeId: probe.id, answeredNumber: LOCKED_X_HEIGHT_AT_MULTIPLY_ONE, answeredString: null, answeredBoolean: null };
        case 2:
          return { probeId: probe.id, answeredNumber: LOCKED_X_HEIGHT_AT_MULTIPLY_TWO, answeredString: null, answeredBoolean: null };
        case 3:
          return { probeId: probe.id, answeredNumber: LOCKED_X_HEIGHT_AT_MULTIPLY_THREE, answeredString: null, answeredBoolean: null };
        default:
          return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: null };
      }
    case 'x-colormap-flags-symbol':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_X_COLORMAP_FLAGS_SYMBOL, answeredBoolean: null };
    case 'palette-upload-x11-symbol':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_PALETTE_UPLOAD_X11_SYMBOL, answeredBoolean: null };
    case 'presentation-x11-shm-symbol':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_PRESENTATION_X11_SHM_SYMBOL, answeredBoolean: null };
    case 'presentation-x11-non-shm-symbol':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_PRESENTATION_X11_NON_SHM_SYMBOL, answeredBoolean: null };
    case 'x11-non-shm-xsync-discard-flag':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: LOCKED_X11_NON_SHM_XSYNC_DISCARD_FLAG };
    case 'x11-shm-handshake-flag-symbol':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_X11_SHM_HANDSHAKE_FLAG_SYMBOL, answeredBoolean: null };
    case 'upload-new-palette-c-symbol':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_UPLOAD_NEW_PALETTE_C_SYMBOL, answeredBoolean: null };
    case 'i-set-palette-c-symbol':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_I_SET_PALETTE_C_SYMBOL, answeredBoolean: null };
    case 'i-finish-update-c-symbol':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_I_FINISH_UPDATE_C_SYMBOL, answeredBoolean: null };
    case 'gamma-table-c-symbol':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_GAMMA_TABLE_C_SYMBOL, answeredBoolean: null };
    case 'use-gamma-c-symbol':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_USE_GAMMA_C_SYMBOL, answeredBoolean: null };
    case 'expand4-c-symbol':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_EXPAND4_C_SYMBOL, answeredBoolean: null };
    case 'expand4-broken-comment':
      return { probeId: probe.id, answeredNumber: null, answeredString: LOCKED_EXPAND4_BROKEN_COMMENT, answeredBoolean: null };
    case 'vanilla-uses-bilinear-filtering':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_USES_BILINEAR_FILTERING };
    case 'vanilla-uses-trilinear-filtering':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_USES_TRILINEAR_FILTERING };
    case 'vanilla-uses-anisotropic-filtering':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_USES_ANISOTROPIC_FILTERING };
    case 'vanilla-supports-fractional-scales':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_SUPPORTS_FRACTIONAL_SCALES };
    case 'vanilla-uses-dithering':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_USES_DITHERING };
    case 'vanilla-uses-subpixel-rendering':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_USES_SUBPIXEL_RENDERING };
    case 'vanilla-blends-adjacent-pixels-on-upscale':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_BLENDS_ADJACENT_PIXELS_ON_UPSCALE };
    case 'vanilla-uses-alpha-channel-blending-at-blit':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_USES_ALPHA_CHANNEL_BLENDING_AT_BLIT };
    case 'vanilla-reuploads-palette-every-frame':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_REUPLOADS_PALETTE_EVERY_FRAME };
    case 'vanilla-applies-non-gamma-color-matrix':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_APPLIES_NON_GAMMA_COLOR_MATRIX };
    case 'vanilla-uses-gpu-shader-at-blit':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_USES_GPU_SHADER_AT_BLIT };
    case 'vanilla-uses-partial-rect-blits':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_USES_PARTIAL_RECT_BLITS };
    case 'vanilla-holds-per-frame-vsync-gate':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_HOLDS_PER_FRAME_VSYNC_GATE };
    case 'vanilla-uses-rgb-intermediate-before-blit':
      return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: VANILLA_USES_RGB_INTERMEDIATE_BEFORE_BLIT };
  }
}

/**
 * Cross-check a candidate handler against every pinned probe. Returns
 * the list of probe ids whose answered fields disagree with the
 * canonical expectations. An empty array means the candidate is
 * parity-safe.
 */
export function crossCheckVanillaPaletteBlitWithoutFiltering(handler: VanillaPaletteBlitWithoutFilteringHandler): readonly string[] {
  const failures: string[] = [];
  for (const probe of VANILLA_PALETTE_BLIT_WITHOUT_FILTERING_PROBES) {
    const result = handler.evaluate(probe);
    if (result.probeId !== probe.id) {
      failures.push(`${probe.id}:probe-id-mismatch`);
      continue;
    }
    if (result.answeredNumber !== probe.expectedAnsweredNumber) {
      failures.push(`${probe.id}:answered-number-mismatch`);
    }
    if (result.answeredString !== probe.expectedAnsweredString) {
      failures.push(`${probe.id}:answered-string-mismatch`);
    }
    if (result.answeredBoolean !== probe.expectedAnsweredBoolean) {
      failures.push(`${probe.id}:answered-boolean-mismatch`);
    }
  }
  return failures;
}
