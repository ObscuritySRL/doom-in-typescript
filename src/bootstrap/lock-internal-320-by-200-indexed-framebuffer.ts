/**
 * Audit ledger that LOCKS the vanilla DOOM 1.9 internal 320x200 8-bit
 * indexed framebuffer's byte-level layout against drift. The accompanying
 * focused test cross-checks every audited lock clause against a self-
 * contained reference handler that walks the canonical row-major
 * scanline byte ordering, the contiguous V_Init four-slot allocation
 * `SCREENWIDTH*SCREENHEIGHT*4`, the unsigned-char element type, and the
 * direct screens[0]-aliases-image-data semantics for the multiply==1
 * scale path.
 *
 * Step 03-012 pinned the broad contract for the indexed framebuffer
 * (dimensions, palette format, aspect-correction stretch, lifecycle
 * binding, and the absence of Chocolate-only additions). Step 03-014
 * narrows the focus to the BYTE-LEVEL LOCK that the runtime must hold
 * the canonical 320x200 indexed framebuffer to, with no drift in:
 *
 *   1. The 320 column count (SCREENWIDTH).
 *   2. The 200 row count (SCREENHEIGHT).
 *   3. The 1-byte-per-pixel element size (sizeof(byte) == sizeof(unsigned
 *      char) == 1) — NOT 16-bit or 32-bit.
 *   4. The row-major scanline byte ordering: byte offset of pixel
 *      (x, y) is `y * SCREENWIDTH + x`. The first pixel (top-left,
 *      x=0, y=0) is at offset 0; the last pixel (bottom-right,
 *      x=319, y=199) is at offset 63999.
 *   5. The row stride equals SCREENWIDTH = 320 bytes — no padding
 *      between scanlines, no row-alignment.
 *   6. The total byte count per slot equals `SCREENWIDTH * SCREENHEIGHT`
 *      = 64000 bytes — verbatim from `linuxdoom-1.10/i_video.c` line
 *      731 `malloc (SCREENWIDTH * SCREENHEIGHT)` and verbatim from
 *      `linuxdoom-1.10/v_video.c` `V_Init` line 363 where each of the
 *      four `screens[i]` slices is `SCREENWIDTH*SCREENHEIGHT` bytes.
 *   7. The four-slot contiguous allocation in V_Init: one
 *      `I_AllocLow(SCREENWIDTH*SCREENHEIGHT*4)` call yields a base
 *      pointer; `screens[i] = base + i*SCREENWIDTH*SCREENHEIGHT`. The
 *      total V_Init allocation is exactly `SCREENWIDTH*SCREENHEIGHT*4`
 *      = 256000 bytes.
 *   8. The direct alias semantics on the X11 multiply==1 path:
 *      `screens[0] = (unsigned char *) (image->data)` — no
 *      double-buffer copy, no per-frame memcpy, no intermediate
 *      conversion.
 *   9. The XShmCreateImage / XCreateImage 8-bit ZPixmap depth and
 *      format on the linuxdoom-1.10 X11 path. The non-SHM path
 *      explicitly passes `bytes_per_line = X_width = SCREENWIDTH`.
 *  10. The `byte` (= `unsigned char *`) row pointer type — one element
 *      = one byte = one palette index, with no signedness mismatch
 *      and no encoding header.
 *
 * The module deliberately does NOT import from `src/host/windowPolicy.ts`,
 * `src/launcher/win32.ts`, or any other runtime module so that a
 * corrupted runtime cannot silently calibrate the audit's own probe
 * table. The hand-pinned canonical constants below are independent of
 * the runtime exports; the focused test separately verifies that the
 * runtime exports agree with these audit constants — a divergence
 * raises a parity violation rather than auto-tracking.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (canonical for the
 *      byte-level layout — `i_video.c` `I_InitGraphics` lines 693-732
 *      pin the X11 image depth/format and the screens[0] alias to
 *      image->data; `v_video.c` `V_Init` lines 358-368 pin the
 *      contiguous four-slot `SCREENWIDTH*SCREENHEIGHT*4` allocation;
 *      `v_video.c` `V_DrawPatch` lines 153-169 pin the
 *      `dest += SCREENWIDTH` row-stride increment used by every
 *      column-walking primitive),
 *   5. Chocolate Doom 2.2.1 source (counterexample for the SDL2
 *      argbbuffer 32-bit ARGB intermediate — see step 03-012 audit).
 */

/**
 * Hand-pinned canonical width of the vanilla DOOM 1.9 internal
 * framebuffer in pixel columns. Pinned independently of
 * `src/host/windowPolicy.ts` SCREENWIDTH so that a corruption in
 * windowPolicy cannot silently calibrate the audit's probe table.
 */
export const LOCKED_INTERNAL_FRAMEBUFFER_WIDTH = 320;

/**
 * Hand-pinned canonical height of the vanilla DOOM 1.9 internal
 * framebuffer in pixel rows. Pinned independently of
 * `src/host/windowPolicy.ts` SCREENHEIGHT.
 */
export const LOCKED_INTERNAL_FRAMEBUFFER_HEIGHT = 200;

/** Hand-pinned canonical bytes-per-pixel of the indexed framebuffer (one byte = one palette index). */
export const LOCKED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL = 1;

/** Hand-pinned canonical bits-per-pixel of the indexed framebuffer (one byte = 8 bits). */
export const LOCKED_INTERNAL_FRAMEBUFFER_BITS_PER_PIXEL = 8;

/** Hand-pinned canonical row stride of the indexed framebuffer in bytes (= SCREENWIDTH * 1 byte/pixel). */
export const LOCKED_INTERNAL_FRAMEBUFFER_ROW_STRIDE_BYTES = 320;

/** Hand-pinned canonical total byte count of one full framebuffer slot (320 * 200 * 1 = 64000). */
export const LOCKED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES_PER_SLOT = 64_000;

/** Hand-pinned canonical screens[] slot count in vanilla 1.9 V_Init (four slots: 0=visible, 1..3=scratch). */
export const LOCKED_VANILLA_SCREENS_SLOT_COUNT = 4;

/** Hand-pinned canonical V_Init contiguous allocation byte count (= SCREENWIDTH*SCREENHEIGHT*4 = 256000). */
export const LOCKED_V_INIT_CONTIGUOUS_ALLOCATION_BYTES = 256_000;

/** Hand-pinned canonical visible-framebuffer slot index inside screens[]. */
export const LOCKED_VANILLA_VISIBLE_FRAMEBUFFER_SCREENS_INDEX = 0;

/** Hand-pinned canonical byte offset of the top-left pixel (x=0, y=0) inside one screens[] slot. */
export const LOCKED_TOP_LEFT_PIXEL_BYTE_OFFSET = 0;

/** Hand-pinned canonical byte offset of the bottom-right pixel (x=319, y=199) inside one screens[] slot (= 199*320+319 = 63999). */
export const LOCKED_BOTTOM_RIGHT_PIXEL_BYTE_OFFSET = 63_999;

/** Hand-pinned canonical X11 image bit depth value passed to XShmCreateImage / XCreateImage. */
export const LOCKED_X11_IMAGE_DEPTH_BITS = 8;

/** Hand-pinned canonical X11 image format symbol passed to XShmCreateImage / XCreateImage. */
export const LOCKED_X11_IMAGE_FORMAT_SYMBOL = 'ZPixmap';

/** Hand-pinned canonical X11 image bytes_per_line for the non-SHM XCreateImage path (= X_width = SCREENWIDTH). */
export const LOCKED_X11_IMAGE_BYTES_PER_LINE_NON_SHM = 320;

/** Hand-pinned canonical X11 XCreateImage `bitmap_pad` argument (8 bits — no row alignment beyond the pixel itself). */
export const LOCKED_X11_IMAGE_BITMAP_PAD = 8;

/** Hand-pinned C-source row-pointer type used in linuxdoom-1.10 i_video.c line 729 for the screens[0] alias. */
export const LOCKED_VANILLA_FRAMEBUFFER_C_ELEMENT_TYPE = 'unsigned char';

/** Hand-pinned vanilla `byte` typedef used by `screens[0..3]` row pointers in v_video.c. */
export const LOCKED_VANILLA_FRAMEBUFFER_BYTE_TYPEDEF = 'byte';

/** Hand-pinned canonical V_Init malloc symbol from linuxdoom-1.10 v_video.c. */
export const LOCKED_V_INIT_ALLOC_SYMBOL = 'I_AllocLow';

/** Hand-pinned canonical I_InitGraphics multiply==1 alias C symbol from linuxdoom-1.10 i_video.c. */
export const LOCKED_I_INIT_GRAPHICS_ALIAS_C_SYMBOL = 'image->data';

/**
 * Whether vanilla 1.9 introduces row padding (extra bytes beyond
 * SCREENWIDTH at the end of each scanline). It does not — the row
 * stride equals SCREENWIDTH exactly.
 */
export const VANILLA_USES_ROW_PADDING = false;

/**
 * Whether vanilla 1.9 introduces a row-alignment requirement (e.g.
 * 4-byte or 16-byte alignment for SIMD). It does not — the byte buffer
 * is plain unsigned-char with no alignment constraint.
 */
export const VANILLA_REQUIRES_ROW_ALIGNMENT = false;

/**
 * Whether vanilla 1.9 stores pixels in column-major order (offset =
 * x * SCREENHEIGHT + y). It does not — pixels are row-major (offset =
 * y * SCREENWIDTH + x), proven by the `dest += SCREENWIDTH` increment
 * in V_DrawPatch.
 */
export const VANILLA_USES_COLUMN_MAJOR_PIXEL_LAYOUT = false;

/**
 * Whether vanilla 1.9 stores pixels in bottom-up scanline order
 * (BMP-style; first pixel of buffer is bottom-left). It does not —
 * the first byte of screens[0] is the top-left pixel (Y axis is
 * top-to-bottom).
 */
export const VANILLA_USES_BOTTOM_UP_SCANLINE_ORDER = false;

/**
 * Whether vanilla 1.9 introduces a per-frame memcpy from screens[0]
 * to the X11 image data on the multiply==1 path. It does not —
 * `screens[0] = (unsigned char *) (image->data)` is a direct alias
 * (line 730 of i_video.c).
 */
export const VANILLA_PERFORMS_PER_FRAME_MEMCPY_ON_MULTIPLY_ONE = false;

/**
 * Whether vanilla 1.9 stores additional metadata bytes (header,
 * checksum, format tag) inside the screens[i] buffer. It does not —
 * the buffer is a raw 64000-byte indexed payload.
 */
export const VANILLA_PREPENDS_FRAMEBUFFER_HEADER = false;

/**
 * Whether vanilla 1.9 uses a 16-bit element type for the indexed
 * framebuffer (e.g. `uint16_t* screens[i]`). It does not — element
 * type is `unsigned char` / `byte` (1 byte per element).
 */
export const VANILLA_USES_SIXTEEN_BIT_FRAMEBUFFER_ELEMENT = false;

/**
 * Whether vanilla 1.9 uses a 32-bit element type for the indexed
 * framebuffer (e.g. `uint32_t* screens[i]`). It does not — element
 * type is `unsigned char` / `byte` (1 byte per element).
 */
export const VANILLA_USES_THIRTY_TWO_BIT_FRAMEBUFFER_ELEMENT = false;

/**
 * Whether vanilla 1.9 reserves an alpha channel for the indexed
 * framebuffer. It does not — the indexed sample is a raw palette
 * index, with translucency handled separately by the colormap-based
 * fuzz/translucency renderer.
 */
export const VANILLA_RESERVES_ALPHA_CHANNEL = false;

/** Verbatim init-call symbol for the canonical vanilla 1.9 framebuffer-allocation entry point. */
export const LOCKED_VANILLA_V_INIT_C_SYMBOL = 'V_Init';

/** Verbatim init-call symbol for the canonical vanilla 1.9 X11 image-allocation entry point. */
export const LOCKED_VANILLA_I_INIT_GRAPHICS_C_SYMBOL = 'I_InitGraphics';

/** Verbatim row-walk C symbol used by V_DrawPatch in v_video.c. */
export const LOCKED_VANILLA_ROW_WALKER_C_SYMBOL = 'V_DrawPatch';

/**
 * One audited lock clause of the vanilla DOOM 1.9 internal 320x200
 * indexed framebuffer.
 */
export interface VanillaInternal320By200IndexedFramebufferLockEntry {
  /** Stable identifier of the lock clause. */
  readonly id:
    | 'WIDTH_LOCKED_AT_320'
    | 'HEIGHT_LOCKED_AT_200'
    | 'BYTES_PER_PIXEL_LOCKED_AT_ONE'
    | 'BITS_PER_PIXEL_LOCKED_AT_EIGHT'
    | 'ROW_STRIDE_LOCKED_AT_SCREENWIDTH'
    | 'TOTAL_BYTES_PER_SLOT_LOCKED_AT_64000'
    | 'V_INIT_CONTIGUOUS_ALLOCATION_LOCKED_AT_FOUR_TIMES_SLOT_BYTES'
    | 'V_INIT_BASE_POINTER_SLICED_INTO_FOUR_SCREENS'
    | 'SCREENS_SLOT_COUNT_LOCKED_AT_FOUR'
    | 'VISIBLE_FRAMEBUFFER_AT_SCREENS_INDEX_ZERO'
    | 'TOP_LEFT_PIXEL_LOCKED_AT_BYTE_OFFSET_ZERO'
    | 'BOTTOM_RIGHT_PIXEL_LOCKED_AT_BYTE_OFFSET_63999'
    | 'PIXEL_OFFSET_FORMULA_IS_Y_TIMES_WIDTH_PLUS_X'
    | 'SCANLINE_ORDERING_IS_TOP_DOWN_NOT_BOTTOM_UP'
    | 'PIXEL_ORDER_IS_ROW_MAJOR_NOT_COLUMN_MAJOR'
    | 'NO_ROW_PADDING_BETWEEN_SCANLINES'
    | 'NO_ROW_ALIGNMENT_REQUIREMENT'
    | 'V_DRAWPATCH_INCREMENTS_DEST_BY_SCREENWIDTH_PER_ROW'
    | 'X11_IMAGE_DEPTH_LOCKED_AT_EIGHT_BITS'
    | 'X11_IMAGE_FORMAT_LOCKED_AT_ZPIXMAP'
    | 'X11_NON_SHM_BYTES_PER_LINE_LOCKED_AT_SCREENWIDTH'
    | 'X11_NON_SHM_BITMAP_PAD_LOCKED_AT_EIGHT_BITS'
    | 'SCREENS_ZERO_DIRECT_ALIAS_TO_IMAGE_DATA_AT_MULTIPLY_ONE'
    | 'NO_PER_FRAME_MEMCPY_ON_MULTIPLY_ONE_PATH'
    | 'FRAMEBUFFER_C_ELEMENT_TYPE_IS_UNSIGNED_CHAR'
    | 'FRAMEBUFFER_BYTE_TYPEDEF_IS_BYTE'
    | 'NO_FRAMEBUFFER_HEADER_OR_METADATA_PREFIX'
    | 'NO_ALPHA_CHANNEL_IN_INDEXED_FRAMEBUFFER'
    | 'NO_SIXTEEN_BIT_FRAMEBUFFER_ELEMENT'
    | 'NO_THIRTY_TWO_BIT_FRAMEBUFFER_ELEMENT'
    | 'V_INIT_ALLOC_USES_I_ALLOCLOW_FOR_BASE_BLOCK'
    | 'I_INIT_GRAPHICS_ALIAS_TARGETS_IMAGE_DATA_FIELD';
  /** Plain-language description of the lock clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'i_video.c' | 'v_video.c';
  /** Verbatim C symbol the lock clause is pinned against. */
  readonly cSymbol: 'I_InitGraphics' | 'V_Init' | 'V_DrawPatch' | 'I_AllocLow';
}

/**
 * Pinned ledger of every lock clause for the vanilla DOOM 1.9 internal
 * 320x200 indexed framebuffer.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK: readonly VanillaInternal320By200IndexedFramebufferLockEntry[] = [
  {
    id: 'WIDTH_LOCKED_AT_320',
    invariant:
      'The vanilla DOOM 1.9 internal framebuffer width is locked at exactly 320 columns. This dimension is pinned by VGA mode 13h (320x200) on DOS, the X11 8-bit pseudocolor image width on linuxdoom-1.10, and the SCREENWIDTH macro defined in `linuxdoom-1.10/doomdef.h`. The runtime `src/host/windowPolicy.ts` SCREENWIDTH must equal 320; any drift is a parity violation against the renderer call sites in `R_DrawColumn`, `R_DrawSpan`, and `V_DrawPatch` that all hardcode 320 as the row stride.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'HEIGHT_LOCKED_AT_200',
    invariant:
      'The vanilla DOOM 1.9 internal framebuffer height is locked at exactly 200 rows. This dimension is pinned by VGA mode 13h (320x200) on DOS and the SCREENHEIGHT macro defined in `linuxdoom-1.10/doomdef.h`. The runtime `src/host/windowPolicy.ts` SCREENHEIGHT must equal 200; any drift is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'BYTES_PER_PIXEL_LOCKED_AT_ONE',
    invariant:
      'The vanilla DOOM 1.9 indexed framebuffer uses exactly 1 byte per pixel — one `unsigned char` palette index, with no padding. This is verbatim from `i_video.c` line 731 `(unsigned char *) malloc (SCREENWIDTH * SCREENHEIGHT)` and `v_video.c` line 363 `screens[i] = base + i*SCREENWIDTH*SCREENHEIGHT`. A handler that pads to 2 or 4 bytes per pixel is a parity violation against the verbatim arithmetic.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'BITS_PER_PIXEL_LOCKED_AT_EIGHT',
    invariant:
      'The vanilla DOOM 1.9 indexed framebuffer uses exactly 8 bits per pixel. The X11 image is created with depth=8 in both the SHM path `XShmCreateImage(X_display, X_visual, 8, ZPixmap, ...)` (i_video.c line 695) and the non-SHM path `XCreateImage(X_display, X_visual, 8, ZPixmap, ...)` (i_video.c line 722). A handler that uses any other bit depth (15, 16, 24, 32) for the indexed framebuffer is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'ROW_STRIDE_LOCKED_AT_SCREENWIDTH',
    invariant:
      'The vanilla DOOM 1.9 indexed framebuffer row stride equals SCREENWIDTH bytes (= 320). This is pinned by `v_video.c` `V_DrawPatch` line ~166 `dest += SCREENWIDTH` — every column-walking primitive increments the destination pointer by exactly SCREENWIDTH bytes per row. The X11 non-SHM path passes `bytes_per_line = X_width = SCREENWIDTH` (i_video.c line 727). A handler that introduces row padding or row alignment beyond SCREENWIDTH is a parity violation against the verbatim `+= SCREENWIDTH` row walk.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_DrawPatch',
  },
  {
    id: 'TOTAL_BYTES_PER_SLOT_LOCKED_AT_64000',
    invariant:
      'The vanilla DOOM 1.9 framebuffer stores exactly 64000 bytes per `screens[i]` slot (320 columns * 200 rows * 1 byte/pixel). This is the verbatim per-slot size in `v_video.c` `V_Init` (each `screens[i]` slice is `SCREENWIDTH*SCREENHEIGHT` bytes) and in `i_video.c` line 731 `malloc (SCREENWIDTH * SCREENHEIGHT)`. A handler that allocates a different per-slot byte count is a parity violation.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'V_INIT_CONTIGUOUS_ALLOCATION_LOCKED_AT_FOUR_TIMES_SLOT_BYTES',
    invariant:
      'The vanilla DOOM 1.9 `V_Init` performs ONE contiguous allocation `I_AllocLow (SCREENWIDTH*SCREENHEIGHT*4)` totalling 256000 bytes, NOT four separate per-slot allocations. The base pointer is then sliced into four screens via `screens[i] = base + i*SCREENWIDTH*SCREENHEIGHT`. A handler that does four separate mallocs or that allocates a non-contiguous block is a parity violation against the verbatim arithmetic.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'V_INIT_BASE_POINTER_SLICED_INTO_FOUR_SCREENS',
    invariant:
      'The vanilla DOOM 1.9 `V_Init` slices the base pointer into four screens via the verbatim loop `for (i=0 ; i<4 ; i++) screens[i] = base + i*SCREENWIDTH*SCREENHEIGHT;` (v_video.c lines 364-366). The slice offsets are 0, 64000, 128000, 192000. A handler that uses a different slice formula or non-zero base offset is a parity violation.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'SCREENS_SLOT_COUNT_LOCKED_AT_FOUR',
    invariant:
      'The vanilla DOOM 1.9 `screens[]` array has exactly 4 active slots. The `V_Init` allocation multiplier is 4 (verbatim `SCREENWIDTH*SCREENHEIGHT*4`); the slicing loop runs `for (i=0 ; i<4 ; i++)`. A handler that allocates fewer slots breaks `R_Init`, `ST_Init`, `AM_Init` callers; a handler that allocates more slots wastes 64KB per extra slot.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'VISIBLE_FRAMEBUFFER_AT_SCREENS_INDEX_ZERO',
    invariant:
      'The vanilla DOOM 1.9 visible framebuffer is at `screens[0]`, the slice with offset 0 inside the V_Init base block. `i_video.c` line 729-730 sets `screens[0] = (unsigned char *) (image->data)` on the multiply==1 X11 path, redirecting the visible framebuffer to the X11 image buffer. A handler that places the visible framebuffer at any other index is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'TOP_LEFT_PIXEL_LOCKED_AT_BYTE_OFFSET_ZERO',
    invariant:
      'The vanilla DOOM 1.9 framebuffer top-left pixel (x=0, y=0) is at byte offset 0 of `screens[0]`. This is implicit in the `dest = desttop + column->topdelta*SCREENWIDTH` arithmetic in `V_DrawPatch` (v_video.c line ~158): `desttop` initialises to `screens[0] + ...` where the framebuffer base is the top-left pixel. A handler that stores the bottom-left pixel at offset 0 (BMP-style bottom-up scanline) is a parity violation against the canonical top-down ordering.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_DrawPatch',
  },
  {
    id: 'BOTTOM_RIGHT_PIXEL_LOCKED_AT_BYTE_OFFSET_63999',
    invariant:
      'The vanilla DOOM 1.9 framebuffer bottom-right pixel (x=319, y=199) is at byte offset 63999 of `screens[0]` (= 199*320+319). The total slot size 64000 minus 1 equals the last valid byte offset. A handler whose last-pixel offset is anywhere else is a parity violation against row-major scanline ordering.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'PIXEL_OFFSET_FORMULA_IS_Y_TIMES_WIDTH_PLUS_X',
    invariant:
      'The vanilla DOOM 1.9 byte offset of pixel (x, y) inside `screens[0]` is exactly `y * SCREENWIDTH + x`. This is the verbatim row-major scanline formula implied by `dest += SCREENWIDTH` in V_DrawPatch (each y increment = +SCREENWIDTH bytes; each x increment = +1 byte). A handler that uses any other formula (column-major `x*SCREENHEIGHT+y`, transposed, or strided) is a parity violation.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_DrawPatch',
  },
  {
    id: 'SCANLINE_ORDERING_IS_TOP_DOWN_NOT_BOTTOM_UP',
    invariant:
      'The vanilla DOOM 1.9 framebuffer stores scanlines in top-down order: scanline 0 (the topmost row) is at byte offsets 0..319, scanline 1 at 320..639, etc., scanline 199 (the bottommost row) at 63680..63999. This matches X11 ZPixmap convention and contrasts with BMP/DIB bottom-up convention. A handler that uses bottom-up storage (scanline 0 = bottommost row) is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'PIXEL_ORDER_IS_ROW_MAJOR_NOT_COLUMN_MAJOR',
    invariant:
      'The vanilla DOOM 1.9 framebuffer is row-major: adjacent X coordinates (same Y) are at adjacent byte offsets; adjacent Y coordinates (same X) are SCREENWIDTH bytes apart. This is locked by the V_DrawPatch row-walk arithmetic. A handler that uses column-major storage (adjacent Y at adjacent offsets, adjacent X at SCREENHEIGHT bytes apart) is a parity violation.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_DrawPatch',
  },
  {
    id: 'NO_ROW_PADDING_BETWEEN_SCANLINES',
    invariant:
      'The vanilla DOOM 1.9 framebuffer has zero padding between scanlines. The total slot size is exactly `SCREENWIDTH*SCREENHEIGHT` = 64000, which equals the sum of 200 unpadded 320-byte scanlines. A handler that pads each scanline to a multiple of 4/8/16 bytes (e.g. 320 -> 320 still, but 321 -> 324) is a parity violation against the verbatim arithmetic.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'NO_ROW_ALIGNMENT_REQUIREMENT',
    invariant:
      'The vanilla DOOM 1.9 framebuffer scanlines have no row-alignment requirement beyond the 1-byte alignment of the unsigned char element. The `XCreateImage` non-SHM path passes `bitmap_pad = 8` (bits) which is one byte (i_video.c line 727). A handler that imposes 4-byte / 8-byte / 16-byte row alignment for SIMD purposes is a parity violation against the canonical no-alignment payload.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'V_DRAWPATCH_INCREMENTS_DEST_BY_SCREENWIDTH_PER_ROW',
    invariant:
      'The vanilla DOOM 1.9 `V_DrawPatch` (`v_video.c` lines 153-169) walks columns by incrementing the destination pointer by SCREENWIDTH bytes per row: `dest += SCREENWIDTH;` (verbatim, line ~166). This is the verbatim row-stride locking instruction. A handler whose V_DrawPatch increments by anything other than SCREENWIDTH (e.g. SCREENWIDTH*2 for skipping rows, or SCREENWIDTH+pad for row alignment) is a parity violation.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_DrawPatch',
  },
  {
    id: 'X11_IMAGE_DEPTH_LOCKED_AT_EIGHT_BITS',
    invariant:
      'The vanilla DOOM 1.9 linuxdoom-1.10 X11 image is created with depth=8 in both `XShmCreateImage(X_display, X_visual, 8, ZPixmap, ...)` (i_video.c line 695) and `XCreateImage(X_display, X_visual, 8, ZPixmap, ...)` (i_video.c line 722). The third argument is the verbatim integer literal 8. A handler that uses depth=15/16/24/32 is a parity violation against the canonical 8-bit pseudocolor visual.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'X11_IMAGE_FORMAT_LOCKED_AT_ZPIXMAP',
    invariant:
      'The vanilla DOOM 1.9 linuxdoom-1.10 X11 image format is `ZPixmap` (verbatim symbol from `<X11/Xlib.h>`) — the densely-packed pixel-per-byte format X11 uses for 8-bit pseudocolor visuals. The fourth argument to both XShmCreateImage and XCreateImage is the literal symbol `ZPixmap`. A handler that uses `XYBitmap` or `XYPixmap` is a parity violation against the canonical 8-bit Z-format payload.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'X11_NON_SHM_BYTES_PER_LINE_LOCKED_AT_SCREENWIDTH',
    invariant:
      'The vanilla DOOM 1.9 X11 non-SHM `XCreateImage` path passes `bytes_per_line = X_width = SCREENWIDTH` as the ninth argument (i_video.c line 727). When `multiply == 1`, X_width equals SCREENWIDTH (320). The bytes_per_line value pins the X server to the same 320-byte row stride as the renderer arithmetic. A handler that passes a different bytes_per_line value is a parity violation against the canonical no-padding row stride.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'X11_NON_SHM_BITMAP_PAD_LOCKED_AT_EIGHT_BITS',
    invariant:
      'The vanilla DOOM 1.9 X11 non-SHM `XCreateImage` path passes `bitmap_pad = 8` (bits) as the eighth argument (i_video.c line 726). This pins the per-row alignment to one byte — no row alignment beyond the natural pixel-per-byte boundary. A handler that uses bitmap_pad = 16 / 32 (half-word / word alignment) is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'SCREENS_ZERO_DIRECT_ALIAS_TO_IMAGE_DATA_AT_MULTIPLY_ONE',
    invariant:
      'The vanilla DOOM 1.9 linuxdoom-1.10 X11 path at `multiply == 1` directly aliases `screens[0]` to `image->data` via `screens[0] = (unsigned char *) (image->data)` (i_video.c line 730). There is NO double-buffer copy and NO per-frame memcpy from `screens[0]` to the X11 image buffer — the renderer writes directly into the X server-bound buffer. A handler that introduces a separate visible buffer with a per-frame copy on the multiply==1 path is a parity violation against the canonical alias semantics.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'NO_PER_FRAME_MEMCPY_ON_MULTIPLY_ONE_PATH',
    invariant:
      'The vanilla DOOM 1.9 multiply==1 X11 path performs zero per-frame memcpy from screens[0] to the X11 image data. The two pointers are the same address (set once in `I_InitGraphics`). The scaled `multiply > 1` path does NOT match this guarantee — a handler that adds a memcpy on the multiply==1 path is a parity violation against the alias semantics.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'FRAMEBUFFER_C_ELEMENT_TYPE_IS_UNSIGNED_CHAR',
    invariant:
      'The vanilla DOOM 1.9 framebuffer C element type is `unsigned char`. The multiply==1 cast in `i_video.c` line 730 is verbatim `(unsigned char *)`; the multiply>1 malloc cast in line 731 is the same `(unsigned char *) malloc (SCREENWIDTH * SCREENHEIGHT)`. The `byte` typedef in `linuxdoom-1.10/doomtype.h` is exactly `typedef unsigned char byte;`. A handler that uses `signed char` / `int8_t` / `char` (whose signedness is implementation-defined) is a parity violation against the explicit unsigned semantics.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'FRAMEBUFFER_BYTE_TYPEDEF_IS_BYTE',
    invariant:
      'The vanilla DOOM 1.9 `screens[]` array uses the `byte` typedef from `doomtype.h` (= `unsigned char`). The verbatim declaration `byte* screens[5];` in `v_video.h` (with only the first 4 used in vanilla) is the canonical type signature. A handler that types screens with a struct or class wrapper around the byte array is a parity violation against the raw `byte*` contract.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'NO_FRAMEBUFFER_HEADER_OR_METADATA_PREFIX',
    invariant:
      'The vanilla DOOM 1.9 framebuffer has zero header bytes and zero metadata prefix. `screens[i]` points at the first data byte directly; there is no width/height field, no format tag, no checksum. A handler that prepends a header (BMP-style, PNG-style, or custom struct) to the framebuffer payload is a parity violation against the raw 64000-byte payload contract.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'V_Init',
  },
  {
    id: 'NO_ALPHA_CHANNEL_IN_INDEXED_FRAMEBUFFER',
    invariant:
      'The vanilla DOOM 1.9 indexed framebuffer has no alpha channel. The 1-byte sample is a raw palette index (0-255); translucency for fuzz monsters and translucent decorations is handled at the renderer call site (R_DrawFuzzColumn) via colormap lookup, NOT at the framebuffer storage level. A handler that adds an A-byte after each indexed sample is a parity violation against the 1-byte-per-pixel contract.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'NO_SIXTEEN_BIT_FRAMEBUFFER_ELEMENT',
    invariant:
      'The vanilla DOOM 1.9 framebuffer does NOT use a 16-bit element type. The cast `(unsigned char *)` in `i_video.c` line 730 explicitly pins the element width at 1 byte. A handler that uses `uint16_t* screens[i]` (e.g. for 5-6-5 packed RGB) is a parity violation against the canonical 8-bit indexed storage.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'NO_THIRTY_TWO_BIT_FRAMEBUFFER_ELEMENT',
    invariant:
      'The vanilla DOOM 1.9 framebuffer does NOT use a 32-bit element type. The Chocolate Doom 2.2.1 `argbbuffer` is a 32-bit ARGB intermediate that lives ALONGSIDE `screens[0]` (not as a replacement); vanilla 1.9 has no such intermediate. A handler whose `screens[i]` row pointers are `uint32_t*` instead of `unsigned char*` is a parity violation against the 8-bit contract.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'V_INIT_ALLOC_USES_I_ALLOCLOW_FOR_BASE_BLOCK',
    invariant:
      'The vanilla DOOM 1.9 `V_Init` allocates the contiguous base block via `I_AllocLow (SCREENWIDTH*SCREENHEIGHT*4)` (v_video.c line 361). `I_AllocLow` is the canonical zone-memory low-allocation primitive used to allocate sub-1MB DOS conventional memory. A handler that uses `malloc` / `Z_Malloc` / a custom allocator without preserving the `I_AllocLow` semantics is a parity violation against the canonical zone-allocation contract.',
    referenceSourceFile: 'v_video.c',
    cSymbol: 'I_AllocLow',
  },
  {
    id: 'I_INIT_GRAPHICS_ALIAS_TARGETS_IMAGE_DATA_FIELD',
    invariant:
      'The vanilla DOOM 1.9 `I_InitGraphics` multiply==1 alias targets the X11 image `data` field — the cast is `(unsigned char *) (image->data)` (i_video.c line 730). The `image` is the `XImage*` returned by XShmCreateImage / XCreateImage. A handler that aliases screens[0] to a different field (image->obdata, image->internal_data) is a parity violation against the canonical X11-payload alias.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
];

/** Number of audited lock clauses pinned by the ledger. */
export const VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_LOCK_CLAUSE_COUNT = 32;

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla-parity 320x200 indexed framebuffer must preserve.
 */
export interface VanillaInternal320By200IndexedFramebufferDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_DERIVED_INVARIANTS: readonly VanillaInternal320By200IndexedFramebufferDerivedInvariant[] = [
  {
    id: 'DIMENSIONS_LOCKED_AT_320_BY_200',
    description: 'The vanilla 1.9 internal framebuffer is locked at exactly 320 columns by 200 rows. Any drift in either dimension is a parity violation.',
  },
  {
    id: 'PIXEL_FORMAT_LOCKED_AT_8_BIT_INDEXED_ONE_BYTE',
    description: 'Each pixel is a single 8-bit / 1-byte unsigned palette index — no 16-bit/32-bit element type, no alpha channel, no padding, no header.',
  },
  {
    id: 'ROW_STRIDE_LOCKED_AT_SCREENWIDTH_NO_PADDING_NO_ALIGNMENT',
    description: 'The row stride is exactly SCREENWIDTH bytes (= 320), with no inter-scanline padding and no row-alignment requirement beyond 1-byte.',
  },
  {
    id: 'TOTAL_BYTES_PER_SLOT_AGREES_WITH_DIMENSIONS_AND_BYTES_PER_PIXEL',
    description: 'Total bytes per slot = SCREENWIDTH * SCREENHEIGHT * BYTES_PER_PIXEL = 320 * 200 * 1 = 64000. Any handler whose total disagrees is a parity violation.',
  },
  {
    id: 'V_INIT_CONTIGUOUS_FOUR_SLOT_ALLOCATION',
    description: 'V_Init allocates ONE contiguous 256000-byte block via `I_AllocLow(SCREENWIDTH*SCREENHEIGHT*4)` and slices it into four screens via `screens[i] = base + i*SCREENWIDTH*SCREENHEIGHT`.',
  },
  {
    id: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
    description: 'Pixel byte offset = `y * SCREENWIDTH + x` with top-left pixel at offset 0 and bottom-right pixel at offset 63999. Row-major, top-down scanline ordering.',
  },
  {
    id: 'V_DRAWPATCH_ROW_WALK_INCREMENTS_DEST_BY_SCREENWIDTH',
    description: 'The verbatim row-walking instruction in V_DrawPatch is `dest += SCREENWIDTH;` per row. A handler whose row-walking primitive uses any other increment is a parity violation.',
  },
  {
    id: 'X11_IMAGE_DEPTH_8_AND_FORMAT_ZPIXMAP',
    description: 'The X11 image is created with depth=8 and format=ZPixmap on both the SHM and non-SHM paths in I_InitGraphics. A handler that uses any other depth/format is a parity violation.',
  },
  {
    id: 'X11_NON_SHM_BYTES_PER_LINE_AND_BITMAP_PAD_LOCKED',
    description: 'The X11 non-SHM XCreateImage call passes bytes_per_line = SCREENWIDTH and bitmap_pad = 8 — no padding, byte-aligned only.',
  },
  {
    id: 'SCREENS_ZERO_DIRECTLY_ALIASES_X11_IMAGE_DATA_ON_MULTIPLY_ONE',
    description: 'On the multiply==1 path, `screens[0] = (unsigned char *) (image->data)` — the visible framebuffer is the same memory address as the X11 image buffer, with no per-frame memcpy.',
  },
  {
    id: 'FRAMEBUFFER_TYPE_IS_UNSIGNED_CHAR_VIA_BYTE_TYPEDEF',
    description: 'The framebuffer C element type is unsigned char (= the `byte` typedef from doomtype.h). A handler that uses signed char / int8_t / char with implementation-defined signedness is a parity violation.',
  },
  {
    id: 'NO_FRAMEBUFFER_HEADER_NO_METADATA_NO_ALPHA',
    description: 'The framebuffer payload is raw 64000 bytes per slot, with no header, no metadata prefix, and no alpha channel. The full byte budget is consumed by indexed pixel samples.',
  },
];

/** Number of derived invariants. */
export const VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_DERIVED_INVARIANT_COUNT = 12;

/**
 * Discriminator for one probe-style query against the canonical
 * vanilla 1.9 internal 320x200 indexed framebuffer lock contract.
 */
export type VanillaInternal320By200IndexedFramebufferQueryKind =
  | 'framebuffer-width'
  | 'framebuffer-height'
  | 'framebuffer-bytes-per-pixel'
  | 'framebuffer-bits-per-pixel'
  | 'framebuffer-row-stride-bytes'
  | 'framebuffer-total-bytes-per-slot'
  | 'v-init-contiguous-allocation-bytes'
  | 'v-init-screens-slot-count'
  | 'visible-framebuffer-screens-index'
  | 'top-left-pixel-byte-offset'
  | 'bottom-right-pixel-byte-offset'
  | 'pixel-byte-offset-for-coordinate'
  | 'screens-slot-base-byte-offset'
  | 'x11-image-depth-bits'
  | 'x11-image-format-symbol'
  | 'x11-non-shm-bytes-per-line'
  | 'x11-non-shm-bitmap-pad'
  | 'framebuffer-c-element-type'
  | 'framebuffer-byte-typedef'
  | 'v-init-alloc-symbol'
  | 'i-init-graphics-alias-c-symbol'
  | 'vanilla-uses-row-padding'
  | 'vanilla-requires-row-alignment'
  | 'vanilla-uses-column-major-layout'
  | 'vanilla-uses-bottom-up-scanline-order'
  | 'vanilla-performs-per-frame-memcpy-multiply-one'
  | 'vanilla-prepends-framebuffer-header'
  | 'vanilla-reserves-alpha-channel'
  | 'vanilla-uses-sixteen-bit-element'
  | 'vanilla-uses-thirty-two-bit-element';

/**
 * One probe applied to a runtime vanilla internal 320x200 indexed
 * framebuffer lock handler.
 */
export interface VanillaInternal320By200IndexedFramebufferProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Discriminator for the query kind. */
  readonly queryKind: VanillaInternal320By200IndexedFramebufferQueryKind;
  /** Optional X coordinate argument (for `pixel-byte-offset-for-coordinate`). */
  readonly queryX: number | null;
  /** Optional Y coordinate argument (for `pixel-byte-offset-for-coordinate`). */
  readonly queryY: number | null;
  /** Optional screens slot index argument (for `screens-slot-base-byte-offset`). */
  readonly querySlotIndex: number | null;
  /** Expected answered numeric value. */
  readonly expectedAnsweredNumber: number | null;
  /** Expected answered string value (for `*-c-symbol`, `*-element-type`, `*-format-symbol`, `*-typedef` queries). */
  readonly expectedAnsweredString: string | null;
  /** Expected answered boolean value (for vanilla-* boolean queries). */
  readonly expectedAnsweredBoolean: boolean | null;
  /** Stable derived invariant id this probe witnesses. */
  readonly witnessInvariantId: string;
}

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a single query against the canonical lock contract plus
 * the expected answer.
 */
export const VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES: readonly VanillaInternal320By200IndexedFramebufferProbe[] = [
  {
    id: 'framebuffer-width-is-320',
    description: 'The internal framebuffer width is locked at 320.',
    queryKind: 'framebuffer-width',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 320,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'DIMENSIONS_LOCKED_AT_320_BY_200',
  },
  {
    id: 'framebuffer-height-is-200',
    description: 'The internal framebuffer height is locked at 200.',
    queryKind: 'framebuffer-height',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 200,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'DIMENSIONS_LOCKED_AT_320_BY_200',
  },
  {
    id: 'framebuffer-bytes-per-pixel-is-one',
    description: 'The internal framebuffer is 1 byte per pixel.',
    queryKind: 'framebuffer-bytes-per-pixel',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 1,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PIXEL_FORMAT_LOCKED_AT_8_BIT_INDEXED_ONE_BYTE',
  },
  {
    id: 'framebuffer-bits-per-pixel-is-eight',
    description: 'The internal framebuffer is 8 bits per pixel.',
    queryKind: 'framebuffer-bits-per-pixel',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 8,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PIXEL_FORMAT_LOCKED_AT_8_BIT_INDEXED_ONE_BYTE',
  },
  {
    id: 'framebuffer-row-stride-is-320',
    description: 'The framebuffer row stride is 320 bytes (= SCREENWIDTH).',
    queryKind: 'framebuffer-row-stride-bytes',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 320,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'ROW_STRIDE_LOCKED_AT_SCREENWIDTH_NO_PADDING_NO_ALIGNMENT',
  },
  {
    id: 'framebuffer-total-bytes-per-slot-is-64000',
    description: 'One screens[i] slot is 64000 bytes (= 320 * 200 * 1).',
    queryKind: 'framebuffer-total-bytes-per-slot',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 64_000,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'TOTAL_BYTES_PER_SLOT_AGREES_WITH_DIMENSIONS_AND_BYTES_PER_PIXEL',
  },
  {
    id: 'v-init-contiguous-allocation-is-256000',
    description: 'The V_Init contiguous base allocation is 256000 bytes (= SCREENWIDTH*SCREENHEIGHT*4).',
    queryKind: 'v-init-contiguous-allocation-bytes',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 256_000,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'V_INIT_CONTIGUOUS_FOUR_SLOT_ALLOCATION',
  },
  {
    id: 'v-init-screens-slot-count-is-four',
    description: 'V_Init slices the base into exactly 4 screens slots.',
    queryKind: 'v-init-screens-slot-count',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 4,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'V_INIT_CONTIGUOUS_FOUR_SLOT_ALLOCATION',
  },
  {
    id: 'visible-framebuffer-screens-index-is-zero',
    description: 'The visible framebuffer is at screens[0].',
    queryKind: 'visible-framebuffer-screens-index',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 0,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'V_INIT_CONTIGUOUS_FOUR_SLOT_ALLOCATION',
  },
  {
    id: 'top-left-pixel-byte-offset-is-zero',
    description: 'The top-left pixel (0,0) is at byte offset 0.',
    queryKind: 'top-left-pixel-byte-offset',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 0,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
  },
  {
    id: 'bottom-right-pixel-byte-offset-is-63999',
    description: 'The bottom-right pixel (319,199) is at byte offset 63999.',
    queryKind: 'bottom-right-pixel-byte-offset',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 63_999,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
  },
  {
    id: 'pixel-byte-offset-zero-zero-is-zero',
    description: 'Pixel (0,0) is at byte offset 0 (row-major formula y*SCREENWIDTH + x).',
    queryKind: 'pixel-byte-offset-for-coordinate',
    queryX: 0,
    queryY: 0,
    querySlotIndex: null,
    expectedAnsweredNumber: 0,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
  },
  {
    id: 'pixel-byte-offset-one-zero-is-one',
    description: 'Pixel (1,0) is at byte offset 1.',
    queryKind: 'pixel-byte-offset-for-coordinate',
    queryX: 1,
    queryY: 0,
    querySlotIndex: null,
    expectedAnsweredNumber: 1,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
  },
  {
    id: 'pixel-byte-offset-zero-one-is-screenwidth',
    description: 'Pixel (0,1) is at byte offset 320 (= SCREENWIDTH).',
    queryKind: 'pixel-byte-offset-for-coordinate',
    queryX: 0,
    queryY: 1,
    querySlotIndex: null,
    expectedAnsweredNumber: 320,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'V_DRAWPATCH_ROW_WALK_INCREMENTS_DEST_BY_SCREENWIDTH',
  },
  {
    id: 'pixel-byte-offset-159-99-is-31839',
    description: 'Pixel (159,99) (the canonical centre) is at byte offset 31839 (= 99*320+159).',
    queryKind: 'pixel-byte-offset-for-coordinate',
    queryX: 159,
    queryY: 99,
    querySlotIndex: null,
    expectedAnsweredNumber: 31_839,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
  },
  {
    id: 'pixel-byte-offset-319-199-is-63999',
    description: 'Pixel (319,199) is at byte offset 63999 (the last valid byte).',
    queryKind: 'pixel-byte-offset-for-coordinate',
    queryX: 319,
    queryY: 199,
    querySlotIndex: null,
    expectedAnsweredNumber: 63_999,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
  },
  {
    id: 'screens-slot-zero-base-offset-is-zero',
    description: 'screens[0] starts at base + 0 (the first slot).',
    queryKind: 'screens-slot-base-byte-offset',
    queryX: null,
    queryY: null,
    querySlotIndex: 0,
    expectedAnsweredNumber: 0,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'V_INIT_CONTIGUOUS_FOUR_SLOT_ALLOCATION',
  },
  {
    id: 'screens-slot-one-base-offset-is-64000',
    description: 'screens[1] starts at base + 64000.',
    queryKind: 'screens-slot-base-byte-offset',
    queryX: null,
    queryY: null,
    querySlotIndex: 1,
    expectedAnsweredNumber: 64_000,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'V_INIT_CONTIGUOUS_FOUR_SLOT_ALLOCATION',
  },
  {
    id: 'screens-slot-two-base-offset-is-128000',
    description: 'screens[2] starts at base + 128000.',
    queryKind: 'screens-slot-base-byte-offset',
    queryX: null,
    queryY: null,
    querySlotIndex: 2,
    expectedAnsweredNumber: 128_000,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'V_INIT_CONTIGUOUS_FOUR_SLOT_ALLOCATION',
  },
  {
    id: 'screens-slot-three-base-offset-is-192000',
    description: 'screens[3] starts at base + 192000 (the last slot).',
    queryKind: 'screens-slot-base-byte-offset',
    queryX: null,
    queryY: null,
    querySlotIndex: 3,
    expectedAnsweredNumber: 192_000,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'V_INIT_CONTIGUOUS_FOUR_SLOT_ALLOCATION',
  },
  {
    id: 'x11-image-depth-is-eight-bits',
    description: 'The X11 image is created with depth=8 bits.',
    queryKind: 'x11-image-depth-bits',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 8,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'X11_IMAGE_DEPTH_8_AND_FORMAT_ZPIXMAP',
  },
  {
    id: 'x11-image-format-is-zpixmap',
    description: 'The X11 image format symbol is `ZPixmap`.',
    queryKind: 'x11-image-format-symbol',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'ZPixmap',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'X11_IMAGE_DEPTH_8_AND_FORMAT_ZPIXMAP',
  },
  {
    id: 'x11-non-shm-bytes-per-line-is-screenwidth',
    description: 'The X11 non-SHM XCreateImage bytes_per_line is SCREENWIDTH = 320.',
    queryKind: 'x11-non-shm-bytes-per-line',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 320,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'X11_NON_SHM_BYTES_PER_LINE_AND_BITMAP_PAD_LOCKED',
  },
  {
    id: 'x11-non-shm-bitmap-pad-is-eight-bits',
    description: 'The X11 non-SHM XCreateImage bitmap_pad is 8 bits.',
    queryKind: 'x11-non-shm-bitmap-pad',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: 8,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'X11_NON_SHM_BYTES_PER_LINE_AND_BITMAP_PAD_LOCKED',
  },
  {
    id: 'framebuffer-c-element-type-is-unsigned-char',
    description: 'The framebuffer C element type is `unsigned char`.',
    queryKind: 'framebuffer-c-element-type',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'unsigned char',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'FRAMEBUFFER_TYPE_IS_UNSIGNED_CHAR_VIA_BYTE_TYPEDEF',
  },
  {
    id: 'framebuffer-byte-typedef-is-byte',
    description: 'The framebuffer `byte` typedef from doomtype.h is `byte`.',
    queryKind: 'framebuffer-byte-typedef',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'byte',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'FRAMEBUFFER_TYPE_IS_UNSIGNED_CHAR_VIA_BYTE_TYPEDEF',
  },
  {
    id: 'v-init-alloc-symbol-is-i-alloclow',
    description: 'V_Init uses I_AllocLow for the contiguous base block.',
    queryKind: 'v-init-alloc-symbol',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'I_AllocLow',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'V_INIT_CONTIGUOUS_FOUR_SLOT_ALLOCATION',
  },
  {
    id: 'i-init-graphics-alias-c-symbol-is-image-data',
    description: 'I_InitGraphics aliases screens[0] to image->data on multiply==1.',
    queryKind: 'i-init-graphics-alias-c-symbol',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: 'image->data',
    expectedAnsweredBoolean: null,
    witnessInvariantId: 'SCREENS_ZERO_DIRECTLY_ALIASES_X11_IMAGE_DATA_ON_MULTIPLY_ONE',
  },
  {
    id: 'vanilla-uses-row-padding-is-false',
    description: 'Vanilla 1.9 does not use row padding.',
    queryKind: 'vanilla-uses-row-padding',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'ROW_STRIDE_LOCKED_AT_SCREENWIDTH_NO_PADDING_NO_ALIGNMENT',
  },
  {
    id: 'vanilla-requires-row-alignment-is-false',
    description: 'Vanilla 1.9 does not require row alignment beyond 1 byte.',
    queryKind: 'vanilla-requires-row-alignment',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'ROW_STRIDE_LOCKED_AT_SCREENWIDTH_NO_PADDING_NO_ALIGNMENT',
  },
  {
    id: 'vanilla-uses-column-major-layout-is-false',
    description: 'Vanilla 1.9 does not use column-major pixel layout.',
    queryKind: 'vanilla-uses-column-major-layout',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
  },
  {
    id: 'vanilla-uses-bottom-up-scanline-order-is-false',
    description: 'Vanilla 1.9 does not use bottom-up scanline order.',
    queryKind: 'vanilla-uses-bottom-up-scanline-order',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PIXEL_LAYOUT_IS_ROW_MAJOR_TOP_DOWN_SCANLINE',
  },
  {
    id: 'vanilla-performs-per-frame-memcpy-multiply-one-is-false',
    description: 'Vanilla 1.9 does not perform per-frame memcpy on multiply==1.',
    queryKind: 'vanilla-performs-per-frame-memcpy-multiply-one',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'SCREENS_ZERO_DIRECTLY_ALIASES_X11_IMAGE_DATA_ON_MULTIPLY_ONE',
  },
  {
    id: 'vanilla-prepends-framebuffer-header-is-false',
    description: 'Vanilla 1.9 does not prepend a framebuffer header.',
    queryKind: 'vanilla-prepends-framebuffer-header',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'NO_FRAMEBUFFER_HEADER_NO_METADATA_NO_ALPHA',
  },
  {
    id: 'vanilla-reserves-alpha-channel-is-false',
    description: 'Vanilla 1.9 does not reserve an alpha channel.',
    queryKind: 'vanilla-reserves-alpha-channel',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'NO_FRAMEBUFFER_HEADER_NO_METADATA_NO_ALPHA',
  },
  {
    id: 'vanilla-uses-sixteen-bit-element-is-false',
    description: 'Vanilla 1.9 does not use a 16-bit framebuffer element.',
    queryKind: 'vanilla-uses-sixteen-bit-element',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PIXEL_FORMAT_LOCKED_AT_8_BIT_INDEXED_ONE_BYTE',
  },
  {
    id: 'vanilla-uses-thirty-two-bit-element-is-false',
    description: 'Vanilla 1.9 does not use a 32-bit framebuffer element.',
    queryKind: 'vanilla-uses-thirty-two-bit-element',
    queryX: null,
    queryY: null,
    querySlotIndex: null,
    expectedAnsweredNumber: null,
    expectedAnsweredString: null,
    expectedAnsweredBoolean: false,
    witnessInvariantId: 'PIXEL_FORMAT_LOCKED_AT_8_BIT_INDEXED_ONE_BYTE',
  },
];

/** Number of pinned probes. */
export const VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBE_COUNT = 37;

/**
 * Result of evaluating one probe against a runtime handler.
 *
 * The shape mirrors the probe's expected-answer fields: each query
 * kind populates exactly one of `answeredNumber` / `answeredString`
 * / `answeredBoolean` (the others are null). A divergence between
 * a probe's expected-answered field and the corresponding answered
 * field surfaces as a cross-check failure.
 */
export interface VanillaInternal320By200IndexedFramebufferResult {
  /** The probe's stable identifier. */
  readonly probeId: string;
  /** The runtime handler's numeric answer (or null if the query kind is not numeric). */
  readonly answeredNumber: number | null;
  /** The runtime handler's string answer (or null if the query kind is not string-typed). */
  readonly answeredString: string | null;
  /** The runtime handler's boolean answer (or null if the query kind is not boolean-typed). */
  readonly answeredBoolean: boolean | null;
}

/**
 * Runtime handler interface for the vanilla 1.9 internal 320x200
 * indexed framebuffer lock contract. Implementations answer each
 * probe according to the canonical lock semantics. The reference
 * handler below answers correctly; downstream parity tests can
 * implement this interface to cross-check their own runtime against
 * the canonical contract.
 */
export interface VanillaInternal320By200IndexedFramebufferHandler {
  /** Evaluate one probe and return the answer in the discriminated result shape. */
  evaluate(probe: VanillaInternal320By200IndexedFramebufferProbe): VanillaInternal320By200IndexedFramebufferResult;
}

/**
 * Reference handler that answers every probe with the canonical
 * vanilla 1.9 lock value. The cross-checker passes this handler
 * with zero failures by construction; the focused test asserts that
 * fact and uses the helper to validate fabricated tampered handlers.
 */
export const REFERENCE_VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_HANDLER: VanillaInternal320By200IndexedFramebufferHandler = Object.freeze({
  evaluate(probe: VanillaInternal320By200IndexedFramebufferProbe): VanillaInternal320By200IndexedFramebufferResult {
    return deriveExpectedVanillaInternal320By200IndexedFramebufferResult(probe);
  },
});

/**
 * Convenience derivation that returns the canonical answered result
 * for a given probe, matching its `expectedAnswered*` fields exactly.
 * The reference handler delegates here; failure-mode tests use this
 * helper to fabricate tampered runtime answers (e.g. swap a string,
 * flip a boolean) without re-pinning the probe expectations.
 */
export function deriveExpectedVanillaInternal320By200IndexedFramebufferResult(probe: VanillaInternal320By200IndexedFramebufferProbe): VanillaInternal320By200IndexedFramebufferResult {
  switch (probe.queryKind) {
    case 'framebuffer-width':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_INTERNAL_FRAMEBUFFER_WIDTH,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'framebuffer-height':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_INTERNAL_FRAMEBUFFER_HEIGHT,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'framebuffer-bytes-per-pixel':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_INTERNAL_FRAMEBUFFER_BYTES_PER_PIXEL,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'framebuffer-bits-per-pixel':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_INTERNAL_FRAMEBUFFER_BITS_PER_PIXEL,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'framebuffer-row-stride-bytes':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_INTERNAL_FRAMEBUFFER_ROW_STRIDE_BYTES,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'framebuffer-total-bytes-per-slot':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES_PER_SLOT,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'v-init-contiguous-allocation-bytes':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_V_INIT_CONTIGUOUS_ALLOCATION_BYTES,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'v-init-screens-slot-count':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_VANILLA_SCREENS_SLOT_COUNT,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'visible-framebuffer-screens-index':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_VANILLA_VISIBLE_FRAMEBUFFER_SCREENS_INDEX,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'top-left-pixel-byte-offset':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_TOP_LEFT_PIXEL_BYTE_OFFSET,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'bottom-right-pixel-byte-offset':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_BOTTOM_RIGHT_PIXEL_BYTE_OFFSET,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'pixel-byte-offset-for-coordinate':
      if (probe.queryX === null || probe.queryY === null) {
        return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: null };
      }
      if (probe.queryX < 0 || probe.queryX >= LOCKED_INTERNAL_FRAMEBUFFER_WIDTH || probe.queryY < 0 || probe.queryY >= LOCKED_INTERNAL_FRAMEBUFFER_HEIGHT) {
        return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: null };
      }
      return {
        probeId: probe.id,
        answeredNumber: probe.queryY * LOCKED_INTERNAL_FRAMEBUFFER_WIDTH + probe.queryX,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'screens-slot-base-byte-offset':
      if (probe.querySlotIndex === null || probe.querySlotIndex < 0 || probe.querySlotIndex >= LOCKED_VANILLA_SCREENS_SLOT_COUNT) {
        return { probeId: probe.id, answeredNumber: null, answeredString: null, answeredBoolean: null };
      }
      return {
        probeId: probe.id,
        answeredNumber: probe.querySlotIndex * LOCKED_INTERNAL_FRAMEBUFFER_TOTAL_BYTES_PER_SLOT,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'x11-image-depth-bits':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_X11_IMAGE_DEPTH_BITS,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'x11-image-format-symbol':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: LOCKED_X11_IMAGE_FORMAT_SYMBOL,
        answeredBoolean: null,
      };
    case 'x11-non-shm-bytes-per-line':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_X11_IMAGE_BYTES_PER_LINE_NON_SHM,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'x11-non-shm-bitmap-pad':
      return {
        probeId: probe.id,
        answeredNumber: LOCKED_X11_IMAGE_BITMAP_PAD,
        answeredString: null,
        answeredBoolean: null,
      };
    case 'framebuffer-c-element-type':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: LOCKED_VANILLA_FRAMEBUFFER_C_ELEMENT_TYPE,
        answeredBoolean: null,
      };
    case 'framebuffer-byte-typedef':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: LOCKED_VANILLA_FRAMEBUFFER_BYTE_TYPEDEF,
        answeredBoolean: null,
      };
    case 'v-init-alloc-symbol':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: LOCKED_V_INIT_ALLOC_SYMBOL,
        answeredBoolean: null,
      };
    case 'i-init-graphics-alias-c-symbol':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: LOCKED_I_INIT_GRAPHICS_ALIAS_C_SYMBOL,
        answeredBoolean: null,
      };
    case 'vanilla-uses-row-padding':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: null,
        answeredBoolean: VANILLA_USES_ROW_PADDING,
      };
    case 'vanilla-requires-row-alignment':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: null,
        answeredBoolean: VANILLA_REQUIRES_ROW_ALIGNMENT,
      };
    case 'vanilla-uses-column-major-layout':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: null,
        answeredBoolean: VANILLA_USES_COLUMN_MAJOR_PIXEL_LAYOUT,
      };
    case 'vanilla-uses-bottom-up-scanline-order':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: null,
        answeredBoolean: VANILLA_USES_BOTTOM_UP_SCANLINE_ORDER,
      };
    case 'vanilla-performs-per-frame-memcpy-multiply-one':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: null,
        answeredBoolean: VANILLA_PERFORMS_PER_FRAME_MEMCPY_ON_MULTIPLY_ONE,
      };
    case 'vanilla-prepends-framebuffer-header':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: null,
        answeredBoolean: VANILLA_PREPENDS_FRAMEBUFFER_HEADER,
      };
    case 'vanilla-reserves-alpha-channel':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: null,
        answeredBoolean: VANILLA_RESERVES_ALPHA_CHANNEL,
      };
    case 'vanilla-uses-sixteen-bit-element':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: null,
        answeredBoolean: VANILLA_USES_SIXTEEN_BIT_FRAMEBUFFER_ELEMENT,
      };
    case 'vanilla-uses-thirty-two-bit-element':
      return {
        probeId: probe.id,
        answeredNumber: null,
        answeredString: null,
        answeredBoolean: VANILLA_USES_THIRTY_TWO_BIT_FRAMEBUFFER_ELEMENT,
      };
  }
}

/**
 * Cross-check a candidate handler against every pinned probe. Returns
 * the list of probe ids whose answered fields disagree with the
 * canonical expectations. An empty array means the candidate is
 * parity-safe.
 */
export function crossCheckVanillaInternal320By200IndexedFramebuffer(handler: VanillaInternal320By200IndexedFramebufferHandler): readonly string[] {
  const failures: string[] = [];
  for (const probe of VANILLA_INTERNAL_320_BY_200_INDEXED_FRAMEBUFFER_PROBES) {
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
