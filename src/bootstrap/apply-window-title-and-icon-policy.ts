/**
 * Audit ledger for the vanilla DOOM 1.9 window title and icon policy
 * pinned against id Software's `linuxdoom-1.10/i_video.c`. The
 * accompanying focused test cross-checks every audited contract clause
 * against a self-contained reference handler that walks the canonical
 * window-attribute landscape the same way vanilla `I_InitGraphics` does.
 *
 * Step 03-012 pinned the Win32 window-and-framebuffer contract — the
 * 320x200 indexed framebuffer, the 256-color PLAYPAL palette, and the
 * lifecycle binding through `I_InitGraphics` and `I_ShutdownGraphics`.
 * This step (03-013) pins the orthogonal "what does the window manager
 * see?" surface that 03-012 deliberately leaves alone:
 *
 *   1. Vanilla 1.9 has ZERO window-title API calls. The
 *      `linuxdoom-1.10/i_video.c` `I_InitGraphics` body opens an X11
 *      display, creates a colormap, calls `XCreateWindow` with
 *      `attribmask = CWEventMask | CWColormap | CWBorderPixel` (no
 *      title attribute), and calls `XMapWindow`. There is no
 *      `XStoreName`, no `XSetWMName`, no `XSetWMHints`, no
 *      `XSetClassHint`, no `XStringListToTextProperty` call anywhere
 *      in the file. The DOS port has no window concept at all (VGA
 *      mode 13h is fullscreen with a single 320x200 page-flipped
 *      framebuffer).
 *
 *   2. Vanilla 1.9 has ZERO window-icon API calls. There is no
 *      `XSetWMIconName` call, no `XCreatePixmap` call for an icon
 *      (the only `XCreatePixmap` call in the file is the 1x1
 *      `cursormask` pixmap used to hide the cursor), no embedded
 *      `icon_data[]` array, no `icon.c` file. The window manager is
 *      left to default to whatever the WM uses when neither
 *      `WM_ICON_NAME` nor `WM_HINTS` is set.
 *
 *   3. Vanilla 1.9 has ZERO `WM_CLASS` class-hint configuration. There
 *      is no `XSetClassHint` call, so the window manager is left to
 *      default to the program name from `argv[0]` (typically
 *      `"linuxxdoom"` for the X11 port and `"DOOM"` or whatever the
 *      DOS launcher names the executable). The class hint is not
 *      explicitly configured by the vanilla source.
 *
 *   4. The window-attribute source for both the title and the icon is
 *      the X11 window-manager default. The user observes whatever
 *      title and icon the WM falls back to when neither `XStoreName`
 *      nor `XSetWMHints` was ever called. There is no notion of
 *      "DOOM application name" embedded in the X11 metadata; the
 *      string the user sees in the WM titlebar comes from the WM's
 *      fallback rules, not from the DOOM binary.
 *
 *   5. The Chocolate Doom 2.2.1 divergences. Chocolate adds the full
 *      title-and-icon machinery the vanilla source omits:
 *      - `static char *window_title = "";` static storage for the
 *        per-game title.
 *      - `I_SetWindowTitle(char *title)` setter that stores the title
 *        without immediately propagating it to SDL.
 *      - `I_InitWindowTitle()` builder that constructs
 *        `M_StringJoin(window_title, " - ", PACKAGE_STRING, NULL)`
 *        and calls `SDL_WM_SetCaption(buf, NULL)` — the user sees a
 *        verbatim string of the form `"<window_title> - Chocolate
 *        Doom 2.2.1"`.
 *      - `I_InitWindowIcon()` builder that allocates a mask, walks an
 *        `icon_data[]` packed-RGB array (24 bits-per-pixel), creates
 *        an `SDL_Surface` via `SDL_CreateRGBSurfaceFrom`, and calls
 *        `SDL_WM_SetIcon(surface, mask)`.
 *      - The init ordering inside Chocolate's `I_InitGraphics` is
 *        title-init BEFORE icon-init, with the verbatim source-level
 *        comment `// Set up title and icon. Windows cares about the
 *        ordering; this has to be done before the window is opened.`
 *      A vanilla-1.9-faithful handler MUST report none of these five
 *      Chocolate-only API calls as present in the canonical fatal-
 *      path / clean-quit surface; including any of them is a parity
 *      violation against the verbatim absence in `linuxdoom-1.10`.
 *
 *   6. The runtime `src/launcher/win32.ts` already constructs a
 *      Win32 `STATIC` window class with a developer-convenience title
 *      passed via `LauncherWindowOptions.title` (set in `src/main.ts`
 *      to `"DOOM Codex - <mapName>"`); this is OUT OF SCOPE for the
 *      vanilla 1.9 contract pinned here. The audit deliberately
 *      avoids importing from any runtime launcher/host module so a
 *      corruption of either side cannot silently calibrate the audit.
 *      A future implementation step (or an oracle follow-up that
 *      observes `doom/DOOMD.EXE` directly under DOSBox) will decide
 *      how the runtime maps the vanilla "no explicit title or icon"
 *      contract onto a Win32 host that REQUIRES a window-class name
 *      (the runtime's developer-convenience title is not vanilla
 *      parity but is also not user-facing in the eventual
 *      `bun run doom.ts` fullscreen mode).
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE` — the DOS port has no window
 *      concept, so the title-and-icon contract is degenerate at this
 *      authority level.
 *   2. local IWAD `doom/DOOM1.WAD` — has no bearing on the window-
 *      title-and-icon policy (the IWAD has no GUI metadata).
 *   3. local Windows oracle `doom/DOOM.EXE` — Chocolate-shaped (sets
 *      a title and icon), counterexample only.
 *   4. id Software `linuxdoom-1.10` source (PRIMARY canonical
 *      authority for this audit — `i_video.c` `I_InitGraphics` is the
 *      verbatim source of the bare-XCreateWindow flow with no title
 *      or icon API calls). The audit invariants below are pinned
 *      against this authority because the per-attribute landscape is
 *      a textual property of `i_video.c`: the function body has no
 *      preprocessor branching that could hide a conditional title or
 *      icon call.
 *   5. Chocolate Doom 2.2.1 source (counterexample for the
 *      `I_SetWindowTitle` / `I_InitWindowTitle` / `I_InitWindowIcon`
 *      additions and the title-before-icon ordering).
 */

/**
 * Discriminator naming one of the five window-attribute channels
 * vanilla 1.9 leaves at the WM default. The audit pins all five
 * because each one corresponds to a distinct X11 API the vanilla
 * source could have called but does not.
 *
 * - `title` — the window-title string visible in the WM titlebar.
 *   Set in X11 via `XStoreName` or `XSetWMName`. Vanilla calls
 *   neither.
 * - `icon-pixmap` — the icon pixmap shown in the WM taskbar / dock.
 *   Set in X11 via `XSetWMHints` with the `IconPixmapHint` flag and
 *   a pixmap created via `XCreatePixmap`. Vanilla calls neither.
 * - `icon-name` — the icon-name string shown when the window is
 *   minimised. Set in X11 via `XSetWMIconName`. Vanilla does not
 *   call it.
 * - `wm-class` — the application class hint used by the WM to apply
 *   per-application defaults. Set in X11 via `XSetClassHint`.
 *   Vanilla does not call it.
 * - `wm-hints` — the WM_HINTS property bundle (input model, initial
 *   state, urgency). Set in X11 via `XSetWMHints`. Vanilla does not
 *   call it.
 */
export type VanillaWindowAttributeChannel = 'title' | 'icon-pixmap' | 'icon-name' | 'wm-class' | 'wm-hints';

/**
 * Verbatim X11 API symbol name a vanilla-parity handler could call
 * (but vanilla 1.9 does NOT call) to populate one of the five
 * window-attribute channels.
 */
export type VanillaWindowAttributeApiCallSymbol = 'XStoreName' | 'XSetWMName' | 'XSetWMIconName' | 'XSetClassHint' | 'XSetWMHints' | 'XCreatePixmapForIconUse';

/**
 * Discriminator naming how vanilla 1.9 populates a given window-
 * attribute channel.
 *
 * - `wm-default-no-explicit-set` — vanilla 1.9 makes no API call to
 *   set the channel; the channel falls through to whatever default
 *   the X11 window manager applies. This is the strategy for ALL
 *   five channels in the linuxdoom-1.10 X11 port.
 * - `dos-no-window-concept` — the DOS port has no window concept at
 *   all (VGA mode 13h is fullscreen). The channel is degenerate at
 *   the DOS authority level — there is no titlebar to display a
 *   title in and no taskbar to display an icon in.
 */
export type VanillaWindowAttributeSourceStrategy = 'wm-default-no-explicit-set' | 'dos-no-window-concept';

/**
 * Per-channel record pinning what vanilla 1.9 does (or does not do)
 * for one window-attribute channel.
 */
export interface VanillaWindowAttributeChannelRecord {
  /** Verbatim attribute-channel name. */
  readonly channelName: VanillaWindowAttributeChannel;
  /** How vanilla 1.9 populates the channel on the X11 port. */
  readonly x11SourceStrategy: VanillaWindowAttributeSourceStrategy;
  /** How vanilla 1.9 populates the channel on the DOS port. */
  readonly dosSourceStrategy: VanillaWindowAttributeSourceStrategy;
  /**
   * Verbatim X11 API symbol vanilla would have to call to populate
   * the channel explicitly (but does NOT call). The audit pins the
   * symbol because a parity-violating handler that adds an explicit
   * call must invoke one of these names.
   */
  readonly x11ApiSymbolThatVanillaOmits: VanillaWindowAttributeApiCallSymbol;
  /**
   * Stable identifier of the corresponding Chocolate-only API call,
   * or `null` when Chocolate also omits an explicit call for the
   * channel. The four Chocolate-only additions are:
   *  - `title` → `SDL_WM_SetCaption` (called from `I_InitWindowTitle`).
   *  - `icon-pixmap` → `SDL_WM_SetIcon` (called from `I_InitWindowIcon`).
   *  - `icon-name` → null (Chocolate also omits this — SDL has no
   *    separate icon-name API).
   *  - `wm-class` → null (Chocolate uses the default SDL class hint
   *    derived from the application name).
   *  - `wm-hints` → null (Chocolate uses the default SDL hints).
   */
  readonly chocolateApiSymbol: string | null;
}

/**
 * Frozen canonical per-channel landscape pinned by vanilla DOOM 1.9
 * `linuxdoom-1.10/i_video.c`. The order matches the canonical
 * X11 attribute hierarchy: the user-facing title comes first, then
 * the icon pixmap and icon name, then the application class hint
 * and the catch-all WM hints bundle.
 */
export const VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE: readonly VanillaWindowAttributeChannelRecord[] = Object.freeze([
  Object.freeze({
    channelName: 'title',
    x11SourceStrategy: 'wm-default-no-explicit-set',
    dosSourceStrategy: 'dos-no-window-concept',
    x11ApiSymbolThatVanillaOmits: 'XStoreName',
    chocolateApiSymbol: 'SDL_WM_SetCaption',
  } satisfies VanillaWindowAttributeChannelRecord),
  Object.freeze({
    channelName: 'icon-pixmap',
    x11SourceStrategy: 'wm-default-no-explicit-set',
    dosSourceStrategy: 'dos-no-window-concept',
    x11ApiSymbolThatVanillaOmits: 'XSetWMHints',
    chocolateApiSymbol: 'SDL_WM_SetIcon',
  } satisfies VanillaWindowAttributeChannelRecord),
  Object.freeze({
    channelName: 'icon-name',
    x11SourceStrategy: 'wm-default-no-explicit-set',
    dosSourceStrategy: 'dos-no-window-concept',
    x11ApiSymbolThatVanillaOmits: 'XSetWMIconName',
    chocolateApiSymbol: null,
  } satisfies VanillaWindowAttributeChannelRecord),
  Object.freeze({
    channelName: 'wm-class',
    x11SourceStrategy: 'wm-default-no-explicit-set',
    dosSourceStrategy: 'dos-no-window-concept',
    x11ApiSymbolThatVanillaOmits: 'XSetClassHint',
    chocolateApiSymbol: null,
  } satisfies VanillaWindowAttributeChannelRecord),
  Object.freeze({
    channelName: 'wm-hints',
    x11SourceStrategy: 'wm-default-no-explicit-set',
    dosSourceStrategy: 'dos-no-window-concept',
    x11ApiSymbolThatVanillaOmits: 'XSetWMHints',
    chocolateApiSymbol: null,
  } satisfies VanillaWindowAttributeChannelRecord),
]);

/** Total number of pinned window-attribute channels. */
export const VANILLA_WINDOW_ATTRIBUTE_CHANNEL_COUNT = 5;

/** Number of vanilla 1.9 window-title API calls in `linuxdoom-1.10/i_video.c`. */
export const VANILLA_WINDOW_TITLE_API_CALL_COUNT = 0;

/** Number of vanilla 1.9 window-icon API calls in `linuxdoom-1.10/i_video.c`. */
export const VANILLA_WINDOW_ICON_API_CALL_COUNT = 0;

/** Number of vanilla 1.9 window WM-class-hint API calls in `linuxdoom-1.10/i_video.c`. */
export const VANILLA_WINDOW_WM_CLASS_API_CALL_COUNT = 0;

/** Whether the DOS port of vanilla DOOM 1.9 has any concept of a window (it does not — VGA mode 13h is fullscreen). */
export const VANILLA_DOS_PORT_HAS_WINDOW_CONCEPT = false;

/** Whether the linuxdoom-1.10 X11 port of vanilla DOOM 1.9 calls `XCreateWindow` with only event-mask, colormap, and border-pixel attributes (no title or icon). */
export const VANILLA_X11_PORT_USES_BARE_XCREATEWINDOW = true;

/**
 * Verbatim list of X11 attribmask flags vanilla `XCreateWindow`
 * combines for the main window. The audit pins this list because a
 * parity-violating handler that adds an attribute must extend the
 * mask, and this list is the authoritative ceiling.
 */
export const VANILLA_X11_XCREATEWINDOW_ATTRIBMASK_TOKENS: readonly string[] = Object.freeze(['CWEventMask', 'CWColormap', 'CWBorderPixel']);

/** Number of attribmask tokens passed to vanilla `XCreateWindow`. */
export const VANILLA_X11_XCREATEWINDOW_ATTRIBMASK_TOKEN_COUNT = 3;

/**
 * Verbatim list of cleanup-stage handlers Chocolate Doom 2.2.1 adds
 * on top of vanilla 1.9's empty title-and-icon set. A vanilla-1.9
 * handler must report `false` for "is this Chocolate-only API call
 * present in the canonical vanilla title-and-icon surface?" for
 * every entry below.
 */
export const VANILLA_WINDOW_TITLE_AND_ICON_POLICY_ABSENT_CHOCOLATE_API_CALLS: readonly string[] = Object.freeze(['I_SetWindowTitle', 'I_InitWindowTitle', 'I_InitWindowIcon', 'SDL_WM_SetCaption', 'SDL_WM_SetIcon']);

/** Number of Chocolate-only API calls absent from the vanilla 1.9 window title-and-icon surface. */
export const VANILLA_WINDOW_TITLE_AND_ICON_POLICY_ABSENT_CHOCOLATE_API_CALL_COUNT = 5;

/**
 * Verbatim canonical Chocolate Doom 2.2.1 title-format template:
 * the constructed string is `<window_title> - <PACKAGE_STRING>` (e.g.
 * `"DOOM - Chocolate Doom 2.2.1"`). Pinned for counterexample
 * recognition; vanilla 1.9 produces no such string.
 */
export const CHOCOLATE_TITLE_FORMAT_TEMPLATE = '<window_title> - PACKAGE_STRING';

/** Verbatim Chocolate-only string-join helper that builds the title. */
export const CHOCOLATE_TITLE_JOIN_FUNCTION_SYMBOL = 'M_StringJoin';

/** Bits-per-pixel of the Chocolate icon-data packed RGB array. */
export const CHOCOLATE_ICON_DATA_BITS_PER_PIXEL = 24;

/** Whether Chocolate inits the window title BEFORE the window icon. It does — Windows cares about the ordering. */
export const CHOCOLATE_INIT_ORDERING_TITLE_BEFORE_ICON = true;

/**
 * One audited contract clause of the vanilla DOOM 1.9 window-title-
 * and-icon policy.
 */
export interface VanillaWindowTitleAndIconPolicyContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id:
    | 'VANILLA_X11_PORT_HAS_NO_XSTORENAME_CALL'
    | 'VANILLA_X11_PORT_HAS_NO_XSETWMNAME_CALL'
    | 'VANILLA_X11_PORT_HAS_NO_XSETWMICONNAME_CALL'
    | 'VANILLA_X11_PORT_HAS_NO_XSETCLASSHINT_CALL'
    | 'VANILLA_X11_PORT_HAS_NO_XSETWMHINTS_CALL'
    | 'VANILLA_X11_PORT_HAS_NO_ICON_PIXMAP'
    | 'VANILLA_X11_PORT_USES_BARE_XCREATEWINDOW_ATTRIBMASK'
    | 'VANILLA_TITLE_SOURCE_IS_WM_DEFAULT'
    | 'VANILLA_ICON_SOURCE_IS_WM_DEFAULT'
    | 'VANILLA_WM_CLASS_SOURCE_IS_WM_DEFAULT'
    | 'VANILLA_DOS_PORT_HAS_NO_WINDOW_CONCEPT'
    | 'VANILLA_HAS_NO_EMBEDDED_ICON_DATA_ARRAY'
    | 'VANILLA_HAS_NO_TITLE_SETTER_FUNCTION'
    | 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_I_SETWINDOWTITLE'
    | 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_I_INITWINDOWTITLE'
    | 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_I_INITWINDOWICON'
    | 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_SDL_WM_SETCAPTION'
    | 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_SDL_WM_SETICON'
    | 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_PACKAGE_STRING_SUFFIX'
    | 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_M_STRINGJOIN_TITLE_FORMAT'
    | 'VANILLA_HAS_NO_TITLE_BEFORE_ICON_INIT_ORDERING_REQUIREMENT'
    | 'VANILLA_HAS_NO_RUNTIME_TITLE_OR_ICON_MUTATION';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'i_video.c' | 'd_main.c';
  /** Verbatim C symbol the contract clause is pinned against. */
  readonly cSymbol: 'I_InitGraphics' | 'I_ShutdownGraphics' | 'D_DoomMain' | 'D_DoomLoop';
}

/**
 * Pinned ledger of every contract clause of the vanilla DOOM 1.9
 * window-title-and-icon policy.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT: readonly VanillaWindowTitleAndIconPolicyContractAuditEntry[] = [
  {
    id: 'VANILLA_X11_PORT_HAS_NO_XSTORENAME_CALL',
    invariant:
      'The linuxdoom-1.10 X11 port has ZERO `XStoreName` calls in `i_video.c`. The function `I_InitGraphics` opens the display, creates the colormap, calls `XCreateWindow`, and calls `XMapWindow` — at no point does it set the WM_NAME property via `XStoreName`. The window title falls through to whatever the X11 window manager defaults to when neither WM_NAME nor WM_ICON_NAME is set. A handler that calls `XStoreName` (or any equivalent SDL_WM_SetCaption) on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_X11_PORT_HAS_NO_XSETWMNAME_CALL',
    invariant:
      'The linuxdoom-1.10 X11 port has ZERO `XSetWMName` calls. `XSetWMName` is the modern X11 API for setting the window-title text property (with locale support); vanilla calls neither it nor the older `XStoreName`. A handler that calls `XSetWMName` on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_X11_PORT_HAS_NO_XSETWMICONNAME_CALL',
    invariant:
      'The linuxdoom-1.10 X11 port has ZERO `XSetWMIconName` calls. `XSetWMIconName` is the X11 API for setting the icon-name string shown when the window is minimised; vanilla never sets it. A handler that calls `XSetWMIconName` on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_X11_PORT_HAS_NO_XSETCLASSHINT_CALL',
    invariant:
      'The linuxdoom-1.10 X11 port has ZERO `XSetClassHint` calls. `XSetClassHint` is the X11 API for setting the WM_CLASS class-hint pair (instance name plus class name) the window manager uses for per-application defaults; vanilla never sets it. The class hint falls through to the WM default derived from `argv[0]`. A handler that calls `XSetClassHint` on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_X11_PORT_HAS_NO_XSETWMHINTS_CALL',
    invariant:
      'The linuxdoom-1.10 X11 port has ZERO `XSetWMHints` calls. `XSetWMHints` is the X11 API for setting the WM_HINTS property bundle (input model, initial state, urgency, icon pixmap); vanilla never calls it. The icon pixmap and other WM hints fall through to WM defaults. A handler that calls `XSetWMHints` on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_X11_PORT_HAS_NO_ICON_PIXMAP',
    invariant:
      'The linuxdoom-1.10 X11 port creates ZERO icon pixmaps. The only `XCreatePixmap` call in `i_video.c` is the 1x1 `cursormask` pixmap used by `createnullcursor` to hide the X cursor inside the DOOM window — that pixmap has nothing to do with the application icon. There is no embedded `icon_data[]` array, no per-frame icon refresh, no `XCreateBitmapFromData` call. A handler that creates an icon pixmap on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_X11_PORT_USES_BARE_XCREATEWINDOW_ATTRIBMASK',
    invariant:
      'The linuxdoom-1.10 X11 port calls `XCreateWindow` with `attribmask = CWEventMask | CWColormap | CWBorderPixel` — three flags only. There is no CWBackPixmap, no CWBackingStore, no override-redirect, no implicit title or icon flag. The three flags are: CWEventMask (for KeyPressMask|KeyReleaseMask|ExposureMask), CWColormap (for the 256-color X_cmap), and CWBorderPixel (zero for a flat black border). A handler that extends the attribmask to include any title- or icon-bearing flag is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_TITLE_SOURCE_IS_WM_DEFAULT',
    invariant:
      'The vanilla 1.9 window title source is the X11 window-manager default — whatever the WM falls back to when neither `XStoreName` nor `XSetWMName` was ever called. There is no embedded "DOOM" title string in the X11 metadata; the user-visible title comes from the WM, not from the binary. A handler that reports a non-default title source on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_ICON_SOURCE_IS_WM_DEFAULT',
    invariant:
      'The vanilla 1.9 window icon source is the X11 window-manager default — whatever pixmap the WM falls back to when neither `XSetWMHints(IconPixmapHint)` nor `XSetWMIconName` was ever called. There is no embedded icon pixmap in the binary. A handler that reports a non-default icon source on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_WM_CLASS_SOURCE_IS_WM_DEFAULT',
    invariant:
      'The vanilla 1.9 WM_CLASS class hint source is the X11 window-manager default — typically derived from `argv[0]` when no explicit `XSetClassHint` call is made. The vanilla source never sets a class hint. A handler that reports a non-default class-hint source on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_DOS_PORT_HAS_NO_WINDOW_CONCEPT',
    invariant:
      'The DOS port of vanilla DOOM 1.9 has NO window concept at all. The DOS executable runs in VGA mode 13h fullscreen with a single 320x200 page-flipped framebuffer; there is no titlebar, no taskbar, no WM, no application icon. The title-and-icon contract is degenerate at the DOS authority level — every channel resolves to `dos-no-window-concept`. A handler that reports the DOS port as having a window title or icon is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_HAS_NO_EMBEDDED_ICON_DATA_ARRAY',
    invariant:
      'Vanilla DOOM 1.9 has NO embedded icon-data array in either the DOS or the linuxdoom-1.10 build. There is no `icon_data[]` byte array, no `icon_w`/`icon_h` constants, no `icon.c` source file. Chocolate Doom 2.2.1 adds an `icon.c` containing a packed-RGB 24bpp icon array; vanilla has no such file. A handler that includes an embedded icon-data array on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_HAS_NO_TITLE_SETTER_FUNCTION',
    invariant:
      'Vanilla DOOM 1.9 has NO `I_SetWindowTitle` setter function. There is no static `window_title` storage, no public setter that allows `D_DoomMain` to inject a per-game title (e.g., "DOOM" / "Doom II" / "Final Doom") into the window manager. Chocolate Doom 2.2.1 adds `static char *window_title = "";` plus `I_SetWindowTitle(char *title)`; vanilla has neither. A handler that exposes a runtime title-setter API on the canonical vanilla 1.9 surface is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_I_SETWINDOWTITLE',
    invariant:
      'Vanilla `i_video.c` does NOT define `I_SetWindowTitle`. `I_SetWindowTitle` is a Chocolate Doom 2.2.1 addition (a setter for the static `window_title` storage). A handler that exposes `I_SetWindowTitle` on the canonical vanilla 1.9 surface is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_I_INITWINDOWTITLE',
    invariant:
      'Vanilla `i_video.c` does NOT define `I_InitWindowTitle`. `I_InitWindowTitle` is a Chocolate Doom 2.2.1 addition that constructs `M_StringJoin(window_title, " - ", PACKAGE_STRING, NULL)` and calls `SDL_WM_SetCaption`. A handler that exposes `I_InitWindowTitle` on the canonical vanilla 1.9 surface is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_I_INITWINDOWICON',
    invariant:
      'Vanilla `i_video.c` does NOT define `I_InitWindowIcon`. `I_InitWindowIcon` is a Chocolate Doom 2.2.1 addition that allocates a mask, walks the `icon_data[]` packed-RGB array, creates an `SDL_Surface` via `SDL_CreateRGBSurfaceFrom`, and calls `SDL_WM_SetIcon`. A handler that exposes `I_InitWindowIcon` on the canonical vanilla 1.9 surface is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_SDL_WM_SETCAPTION',
    invariant:
      'Vanilla `i_video.c` does NOT call `SDL_WM_SetCaption`. SDL is not even a dependency of vanilla DOOM 1.9 — the DOS build talks to VGA hardware directly and the linuxdoom-1.10 build links against Xlib, not SDL. `SDL_WM_SetCaption` is a Chocolate Doom 2.2.1-only call (deprecated by SDL2 in favour of `SDL_SetWindowTitle`). A handler that calls `SDL_WM_SetCaption` (or `SDL_SetWindowTitle`) on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_SDL_WM_SETICON',
    invariant:
      'Vanilla `i_video.c` does NOT call `SDL_WM_SetIcon`. SDL is not a vanilla 1.9 dependency. `SDL_WM_SetIcon` is a Chocolate Doom 2.2.1-only call (deprecated by SDL2 in favour of `SDL_SetWindowIcon`). A handler that calls `SDL_WM_SetIcon` (or `SDL_SetWindowIcon`) on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_PACKAGE_STRING_SUFFIX',
    invariant:
      'Vanilla DOOM 1.9 does NOT embed a `PACKAGE_STRING` constant in the window-title format. The `PACKAGE_STRING` macro (containing strings like `"Chocolate Doom 2.2.1"`) is generated by autotools `configure` for the Chocolate Doom build and concatenated into the window title via `M_StringJoin(window_title, " - ", PACKAGE_STRING, NULL)`. Vanilla has no autotools, no PACKAGE_STRING, no string-joining of a per-port suffix. A handler that includes a `PACKAGE_STRING`-style suffix on the canonical vanilla 1.9 title path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_M_STRINGJOIN_TITLE_FORMAT',
    invariant:
      'Vanilla DOOM 1.9 does NOT use `M_StringJoin` (or any equivalent string-join helper) to build a window-title string. `M_StringJoin` is a Chocolate Doom 2.2.1 addition (declared in `m_misc.h`) used to concatenate the per-game title with the per-port suffix. Vanilla never calls it, never declares it, and has no equivalent. A handler that uses `M_StringJoin` on the canonical vanilla 1.9 title path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_HAS_NO_TITLE_BEFORE_ICON_INIT_ORDERING_REQUIREMENT',
    invariant:
      'Vanilla DOOM 1.9 has NO title-before-icon initialization-ordering requirement. The Chocolate Doom 2.2.1 source contains the verbatim comment `// Set up title and icon. Windows cares about the ordering; this has to be done before the window is opened.` immediately preceding the `I_InitWindowTitle(); I_InitWindowIcon();` pair. Vanilla has neither call and therefore has no ordering requirement at all. A handler that reports a title-before-icon ordering requirement on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_InitGraphics',
  },
  {
    id: 'VANILLA_HAS_NO_RUNTIME_TITLE_OR_ICON_MUTATION',
    invariant:
      'Vanilla DOOM 1.9 has NO runtime title-or-icon mutation. The window title and icon (such as they are — both default to the X11 WM fallback) are set ONCE at window creation inside `I_InitGraphics` and never change for the lifetime of the process. There is no per-map title update (e.g., "DOOM - E1M1"), no per-game-state title update (e.g., "DOOM (Paused)"), no per-frame icon swap. A handler that mutates the title or icon at runtime on the canonical vanilla 1.9 path is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
] as const;

/** Number of audited contract clauses pinned by the ledger. */
export const VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_CLAUSE_COUNT = 22;

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla-parity window title-and-icon handler must
 * preserve.
 */
export interface VanillaWindowTitleAndIconPolicyDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_WINDOW_TITLE_AND_ICON_POLICY_DERIVED_INVARIANTS: readonly VanillaWindowTitleAndIconPolicyDerivedInvariant[] = [
  {
    id: 'WINDOW_TITLE_API_CALL_COUNT_IS_ZERO',
    description: 'The vanilla 1.9 window-title API call count is exactly zero. Reporting any positive value is a parity violation.',
  },
  {
    id: 'WINDOW_ICON_API_CALL_COUNT_IS_ZERO',
    description: 'The vanilla 1.9 window-icon API call count is exactly zero. Reporting any positive value is a parity violation.',
  },
  {
    id: 'WINDOW_WM_CLASS_API_CALL_COUNT_IS_ZERO',
    description: 'The vanilla 1.9 WM_CLASS API call count is exactly zero. Reporting any positive value is a parity violation.',
  },
  {
    id: 'X11_PORT_USES_BARE_XCREATEWINDOW',
    description: 'The linuxdoom-1.10 X11 port calls `XCreateWindow` with the bare three-flag attribmask (CWEventMask | CWColormap | CWBorderPixel). A handler that extends the mask is a parity violation.',
  },
  {
    id: 'X11_PORT_ATTRIBMASK_HAS_THREE_TOKENS',
    description: 'The vanilla `XCreateWindow` attribmask is exactly three tokens (CWEventMask, CWColormap, CWBorderPixel). A handler that reports a different token count is a parity violation.',
  },
  {
    id: 'TITLE_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
    description: 'The window-title channel resolves to `wm-default-no-explicit-set` on the vanilla X11 port. A handler that reports a different strategy is a parity violation.',
  },
  {
    id: 'ICON_PIXMAP_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
    description: 'The icon-pixmap channel resolves to `wm-default-no-explicit-set` on the vanilla X11 port. A handler that reports a different strategy is a parity violation.',
  },
  {
    id: 'ICON_NAME_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
    description: 'The icon-name channel resolves to `wm-default-no-explicit-set` on the vanilla X11 port. A handler that reports a different strategy is a parity violation.',
  },
  {
    id: 'WM_CLASS_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
    description: 'The WM_CLASS channel resolves to `wm-default-no-explicit-set` on the vanilla X11 port. A handler that reports a different strategy is a parity violation.',
  },
  {
    id: 'WM_HINTS_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
    description: 'The WM_HINTS channel resolves to `wm-default-no-explicit-set` on the vanilla X11 port. A handler that reports a different strategy is a parity violation.',
  },
  {
    id: 'EVERY_CHANNEL_DOS_STRATEGY_IS_DOS_NO_WINDOW_CONCEPT',
    description: 'Every window-attribute channel resolves to `dos-no-window-concept` on the vanilla DOS port. A handler that reports a different DOS strategy is a parity violation.',
  },
  {
    id: 'CHANNEL_LANDSCAPE_HAS_FIVE_ENTRIES',
    description: 'The pinned window-attribute channel landscape has exactly five entries (title, icon-pixmap, icon-name, wm-class, wm-hints). A handler that reports a different total is a parity violation.',
  },
  {
    id: 'TITLE_AND_ICON_POLICY_OMITS_CHOCOLATE_I_SETWINDOWTITLE',
    description: 'Vanilla `I_InitGraphics` omits `I_SetWindowTitle`. A handler that includes it is a parity violation.',
  },
  {
    id: 'TITLE_AND_ICON_POLICY_OMITS_CHOCOLATE_I_INITWINDOWTITLE',
    description: 'Vanilla `I_InitGraphics` omits `I_InitWindowTitle`. A handler that includes it is a parity violation.',
  },
  {
    id: 'TITLE_AND_ICON_POLICY_OMITS_CHOCOLATE_I_INITWINDOWICON',
    description: 'Vanilla `I_InitGraphics` omits `I_InitWindowIcon`. A handler that includes it is a parity violation.',
  },
  {
    id: 'TITLE_AND_ICON_POLICY_OMITS_CHOCOLATE_SDL_WM_SETCAPTION',
    description: 'Vanilla `I_InitGraphics` omits `SDL_WM_SetCaption`. A handler that includes it is a parity violation.',
  },
  {
    id: 'TITLE_AND_ICON_POLICY_OMITS_CHOCOLATE_SDL_WM_SETICON',
    description: 'Vanilla `I_InitGraphics` omits `SDL_WM_SetIcon`. A handler that includes it is a parity violation.',
  },
  {
    id: 'DOS_PORT_HAS_NO_WINDOW_CONCEPT',
    description: 'The DOS port has no window concept at all. A handler that reports a window concept on the DOS port is a parity violation.',
  },
  {
    id: 'NO_RUNTIME_TITLE_OR_ICON_MUTATION',
    description: 'Vanilla 1.9 does not mutate the title or icon at runtime. A handler that mutates either is a parity violation.',
  },
  {
    id: 'NO_TITLE_BEFORE_ICON_INIT_ORDERING_REQUIREMENT',
    description: 'Vanilla 1.9 has no title-before-icon initialization ordering requirement (because it has neither call). A handler that reports such a requirement is a parity violation.',
  },
];

/** Number of derived invariants. */
export const VANILLA_WINDOW_TITLE_AND_ICON_POLICY_DERIVED_INVARIANT_COUNT = 20;

/**
 * Discriminator for one probe-style query against the canonical
 * vanilla 1.9 window-title-and-icon policy contract.
 *
 * - `window-title-api-call-count`: ask the handler the total number
 *   of window-title API calls in the canonical vanilla 1.9 source
 *   (always 0).
 * - `window-icon-api-call-count`: ask the handler the total number
 *   of window-icon API calls in the canonical vanilla 1.9 source
 *   (always 0).
 * - `window-wm-class-api-call-count`: ask the handler the total
 *   number of WM_CLASS API calls in the canonical vanilla 1.9 source
 *   (always 0).
 * - `channel-x11-source-strategy`: ask the handler the X11 source
 *   strategy for the named attribute channel (always
 *   `wm-default-no-explicit-set`).
 * - `channel-dos-source-strategy`: ask the handler the DOS source
 *   strategy for the named attribute channel (always
 *   `dos-no-window-concept`).
 * - `channel-x11-omitted-api-symbol`: ask the handler the X11 API
 *   symbol vanilla would have to call to populate the named channel
 *   explicitly.
 * - `landscape-channel-count`: ask the handler the total number of
 *   pinned window-attribute channels (always 5).
 * - `dos-port-has-window-concept`: ask the handler whether the DOS
 *   port has any window concept (always false in vanilla).
 * - `x11-port-uses-bare-xcreatewindow`: ask the handler whether the
 *   linuxdoom-1.10 X11 port uses the bare-three-flag XCreateWindow
 *   call (always true in vanilla).
 * - `x11-port-attribmask-token-count`: ask the handler the number of
 *   tokens in the vanilla XCreateWindow attribmask (always 3).
 * - `x11-port-attribmask-includes-token`: ask the handler whether the
 *   vanilla XCreateWindow attribmask includes the named token.
 * - `title-and-icon-policy-includes-chocolate-api-call`: ask the
 *   handler whether the named Chocolate-only API call is present in
 *   the canonical vanilla 1.9 surface (always false for every
 *   Chocolate addition).
 * - `runtime-title-or-icon-mutation-allowed`: ask the handler
 *   whether vanilla allows runtime title or icon mutation (always
 *   false).
 * - `title-before-icon-ordering-required`: ask the handler whether
 *   the canonical vanilla 1.9 surface requires title-before-icon
 *   init ordering (always false — vanilla has neither).
 */
export type VanillaWindowTitleAndIconPolicyQueryKind =
  | 'window-title-api-call-count'
  | 'window-icon-api-call-count'
  | 'window-wm-class-api-call-count'
  | 'channel-x11-source-strategy'
  | 'channel-dos-source-strategy'
  | 'channel-x11-omitted-api-symbol'
  | 'landscape-channel-count'
  | 'dos-port-has-window-concept'
  | 'x11-port-uses-bare-xcreatewindow'
  | 'x11-port-attribmask-token-count'
  | 'x11-port-attribmask-includes-token'
  | 'title-and-icon-policy-includes-chocolate-api-call'
  | 'runtime-title-or-icon-mutation-allowed'
  | 'title-before-icon-ordering-required';

/**
 * One probe applied to a runtime vanilla window-title-and-icon policy
 * handler.
 */
export interface VanillaWindowTitleAndIconPolicyProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Discriminator for the query kind. */
  readonly queryKind: VanillaWindowTitleAndIconPolicyQueryKind;
  /** Channel-name query argument (for channel-* queries). */
  readonly queryChannelName: VanillaWindowAttributeChannel | null;
  /** Attribmask-token query argument (for `x11-port-attribmask-includes-token`). */
  readonly queryAttribmaskToken: string | null;
  /** Chocolate API-call name query argument (for `title-and-icon-policy-includes-chocolate-api-call`). */
  readonly queryChocolateApiCallName: string | null;
  /** Expected answered source strategy (for `channel-x11-source-strategy` / `channel-dos-source-strategy`). */
  readonly expectedAnsweredSourceStrategy: VanillaWindowAttributeSourceStrategy | null;
  /** Expected answered API symbol (for `channel-x11-omitted-api-symbol`). */
  readonly expectedAnsweredApiSymbol: VanillaWindowAttributeApiCallSymbol | null;
  /** Expected answered presence boolean (for boolean queries). */
  readonly expectedAnsweredPresent: boolean | null;
  /** Expected answered count (for count queries). */
  readonly expectedAnsweredCount: number | null;
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId: string;
}

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a single query against the canonical landscape plus the
 * expected answer.
 */
export const VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES: readonly VanillaWindowTitleAndIconPolicyProbe[] = [
  {
    id: 'window-title-api-call-count-is-zero',
    description: 'The vanilla 1.9 window-title API call count is exactly zero.',
    queryKind: 'window-title-api-call-count',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: 0,
    witnessInvariantId: 'WINDOW_TITLE_API_CALL_COUNT_IS_ZERO',
  },
  {
    id: 'window-icon-api-call-count-is-zero',
    description: 'The vanilla 1.9 window-icon API call count is exactly zero.',
    queryKind: 'window-icon-api-call-count',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: 0,
    witnessInvariantId: 'WINDOW_ICON_API_CALL_COUNT_IS_ZERO',
  },
  {
    id: 'window-wm-class-api-call-count-is-zero',
    description: 'The vanilla 1.9 WM_CLASS API call count is exactly zero.',
    queryKind: 'window-wm-class-api-call-count',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: 0,
    witnessInvariantId: 'WINDOW_WM_CLASS_API_CALL_COUNT_IS_ZERO',
  },
  {
    id: 'channel-title-x11-strategy-is-wm-default',
    description: 'The window-title channel resolves to `wm-default-no-explicit-set` on the X11 port.',
    queryKind: 'channel-x11-source-strategy',
    queryChannelName: 'title',
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: 'wm-default-no-explicit-set',
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'TITLE_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
  },
  {
    id: 'channel-icon-pixmap-x11-strategy-is-wm-default',
    description: 'The icon-pixmap channel resolves to `wm-default-no-explicit-set` on the X11 port.',
    queryKind: 'channel-x11-source-strategy',
    queryChannelName: 'icon-pixmap',
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: 'wm-default-no-explicit-set',
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'ICON_PIXMAP_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
  },
  {
    id: 'channel-icon-name-x11-strategy-is-wm-default',
    description: 'The icon-name channel resolves to `wm-default-no-explicit-set` on the X11 port.',
    queryKind: 'channel-x11-source-strategy',
    queryChannelName: 'icon-name',
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: 'wm-default-no-explicit-set',
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'ICON_NAME_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
  },
  {
    id: 'channel-wm-class-x11-strategy-is-wm-default',
    description: 'The WM_CLASS channel resolves to `wm-default-no-explicit-set` on the X11 port.',
    queryKind: 'channel-x11-source-strategy',
    queryChannelName: 'wm-class',
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: 'wm-default-no-explicit-set',
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'WM_CLASS_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
  },
  {
    id: 'channel-wm-hints-x11-strategy-is-wm-default',
    description: 'The WM_HINTS channel resolves to `wm-default-no-explicit-set` on the X11 port.',
    queryKind: 'channel-x11-source-strategy',
    queryChannelName: 'wm-hints',
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: 'wm-default-no-explicit-set',
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'WM_HINTS_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
  },
  {
    id: 'channel-title-dos-strategy-is-no-window-concept',
    description: 'The window-title channel resolves to `dos-no-window-concept` on the DOS port.',
    queryKind: 'channel-dos-source-strategy',
    queryChannelName: 'title',
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: 'dos-no-window-concept',
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'EVERY_CHANNEL_DOS_STRATEGY_IS_DOS_NO_WINDOW_CONCEPT',
  },
  {
    id: 'channel-icon-pixmap-dos-strategy-is-no-window-concept',
    description: 'The icon-pixmap channel resolves to `dos-no-window-concept` on the DOS port.',
    queryKind: 'channel-dos-source-strategy',
    queryChannelName: 'icon-pixmap',
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: 'dos-no-window-concept',
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'EVERY_CHANNEL_DOS_STRATEGY_IS_DOS_NO_WINDOW_CONCEPT',
  },
  {
    id: 'channel-title-x11-omits-xstorename',
    description: 'The window-title channel`s vanilla-omitted X11 API symbol is `XStoreName`.',
    queryKind: 'channel-x11-omitted-api-symbol',
    queryChannelName: 'title',
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: 'XStoreName',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'TITLE_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
  },
  {
    id: 'channel-icon-pixmap-x11-omits-xsetwmhints',
    description: 'The icon-pixmap channel`s vanilla-omitted X11 API symbol is `XSetWMHints` (with IconPixmapHint).',
    queryKind: 'channel-x11-omitted-api-symbol',
    queryChannelName: 'icon-pixmap',
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: 'XSetWMHints',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'ICON_PIXMAP_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
  },
  {
    id: 'channel-icon-name-x11-omits-xsetwmiconname',
    description: 'The icon-name channel`s vanilla-omitted X11 API symbol is `XSetWMIconName`.',
    queryKind: 'channel-x11-omitted-api-symbol',
    queryChannelName: 'icon-name',
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: 'XSetWMIconName',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'ICON_NAME_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
  },
  {
    id: 'channel-wm-class-x11-omits-xsetclasshint',
    description: 'The WM_CLASS channel`s vanilla-omitted X11 API symbol is `XSetClassHint`.',
    queryKind: 'channel-x11-omitted-api-symbol',
    queryChannelName: 'wm-class',
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: 'XSetClassHint',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'WM_CLASS_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
  },
  {
    id: 'landscape-channel-count-is-five',
    description: 'The pinned window-attribute channel landscape has exactly five entries.',
    queryKind: 'landscape-channel-count',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: 5,
    witnessInvariantId: 'CHANNEL_LANDSCAPE_HAS_FIVE_ENTRIES',
  },
  {
    id: 'dos-port-has-no-window-concept',
    description: 'The DOS port has no window concept at all.',
    queryKind: 'dos-port-has-window-concept',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'DOS_PORT_HAS_NO_WINDOW_CONCEPT',
  },
  {
    id: 'x11-port-uses-bare-xcreatewindow',
    description: 'The linuxdoom-1.10 X11 port uses the bare-three-flag XCreateWindow attribmask.',
    queryKind: 'x11-port-uses-bare-xcreatewindow',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: true,
    expectedAnsweredCount: null,
    witnessInvariantId: 'X11_PORT_USES_BARE_XCREATEWINDOW',
  },
  {
    id: 'x11-port-attribmask-has-three-tokens',
    description: 'The vanilla XCreateWindow attribmask has exactly three tokens.',
    queryKind: 'x11-port-attribmask-token-count',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: 3,
    witnessInvariantId: 'X11_PORT_ATTRIBMASK_HAS_THREE_TOKENS',
  },
  {
    id: 'x11-port-attribmask-includes-cweventmask',
    description: 'The vanilla XCreateWindow attribmask includes `CWEventMask`.',
    queryKind: 'x11-port-attribmask-includes-token',
    queryChannelName: null,
    queryAttribmaskToken: 'CWEventMask',
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: true,
    expectedAnsweredCount: null,
    witnessInvariantId: 'X11_PORT_USES_BARE_XCREATEWINDOW',
  },
  {
    id: 'x11-port-attribmask-includes-cwcolormap',
    description: 'The vanilla XCreateWindow attribmask includes `CWColormap`.',
    queryKind: 'x11-port-attribmask-includes-token',
    queryChannelName: null,
    queryAttribmaskToken: 'CWColormap',
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: true,
    expectedAnsweredCount: null,
    witnessInvariantId: 'X11_PORT_USES_BARE_XCREATEWINDOW',
  },
  {
    id: 'x11-port-attribmask-includes-cwborderpixel',
    description: 'The vanilla XCreateWindow attribmask includes `CWBorderPixel`.',
    queryKind: 'x11-port-attribmask-includes-token',
    queryChannelName: null,
    queryAttribmaskToken: 'CWBorderPixel',
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: true,
    expectedAnsweredCount: null,
    witnessInvariantId: 'X11_PORT_USES_BARE_XCREATEWINDOW',
  },
  {
    id: 'x11-port-attribmask-excludes-cwbackpixmap',
    description: 'The vanilla XCreateWindow attribmask excludes `CWBackPixmap`.',
    queryKind: 'x11-port-attribmask-includes-token',
    queryChannelName: null,
    queryAttribmaskToken: 'CWBackPixmap',
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'X11_PORT_USES_BARE_XCREATEWINDOW',
  },
  {
    id: 'x11-port-attribmask-excludes-cwoverrideredirect',
    description: 'The vanilla XCreateWindow attribmask excludes `CWOverrideRedirect`.',
    queryKind: 'x11-port-attribmask-includes-token',
    queryChannelName: null,
    queryAttribmaskToken: 'CWOverrideRedirect',
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'X11_PORT_USES_BARE_XCREATEWINDOW',
  },
  {
    id: 'title-and-icon-policy-omits-i-setwindowtitle',
    description: 'The vanilla 1.9 title-and-icon surface omits `I_SetWindowTitle` (Chocolate-only).',
    queryKind: 'title-and-icon-policy-includes-chocolate-api-call',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: 'I_SetWindowTitle',
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'TITLE_AND_ICON_POLICY_OMITS_CHOCOLATE_I_SETWINDOWTITLE',
  },
  {
    id: 'title-and-icon-policy-omits-i-initwindowtitle',
    description: 'The vanilla 1.9 title-and-icon surface omits `I_InitWindowTitle` (Chocolate-only).',
    queryKind: 'title-and-icon-policy-includes-chocolate-api-call',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: 'I_InitWindowTitle',
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'TITLE_AND_ICON_POLICY_OMITS_CHOCOLATE_I_INITWINDOWTITLE',
  },
  {
    id: 'title-and-icon-policy-omits-i-initwindowicon',
    description: 'The vanilla 1.9 title-and-icon surface omits `I_InitWindowIcon` (Chocolate-only).',
    queryKind: 'title-and-icon-policy-includes-chocolate-api-call',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: 'I_InitWindowIcon',
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'TITLE_AND_ICON_POLICY_OMITS_CHOCOLATE_I_INITWINDOWICON',
  },
  {
    id: 'title-and-icon-policy-omits-sdl-wm-setcaption',
    description: 'The vanilla 1.9 title-and-icon surface omits `SDL_WM_SetCaption` (Chocolate-only).',
    queryKind: 'title-and-icon-policy-includes-chocolate-api-call',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: 'SDL_WM_SetCaption',
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'TITLE_AND_ICON_POLICY_OMITS_CHOCOLATE_SDL_WM_SETCAPTION',
  },
  {
    id: 'title-and-icon-policy-omits-sdl-wm-seticon',
    description: 'The vanilla 1.9 title-and-icon surface omits `SDL_WM_SetIcon` (Chocolate-only).',
    queryKind: 'title-and-icon-policy-includes-chocolate-api-call',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: 'SDL_WM_SetIcon',
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'TITLE_AND_ICON_POLICY_OMITS_CHOCOLATE_SDL_WM_SETICON',
  },
  {
    id: 'runtime-title-or-icon-mutation-not-allowed',
    description: 'Vanilla 1.9 does not mutate the title or icon at runtime.',
    queryKind: 'runtime-title-or-icon-mutation-allowed',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'NO_RUNTIME_TITLE_OR_ICON_MUTATION',
  },
  {
    id: 'title-before-icon-ordering-not-required',
    description: 'Vanilla 1.9 does not require title-before-icon init ordering (because it has neither call).',
    queryKind: 'title-before-icon-ordering-required',
    queryChannelName: null,
    queryAttribmaskToken: null,
    queryChocolateApiCallName: null,
    expectedAnsweredSourceStrategy: null,
    expectedAnsweredApiSymbol: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'NO_TITLE_BEFORE_ICON_INIT_ORDERING_REQUIREMENT',
  },
];

/** Number of pinned probes. */
export const VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBE_COUNT = 30;

/**
 * Result of a single probe run against a vanilla window-title-and-
 * icon policy handler. Each query kind populates a different result
 * field; fields not relevant to the query kind are `null`.
 */
export interface VanillaWindowTitleAndIconPolicyResult {
  readonly answeredSourceStrategy: VanillaWindowAttributeSourceStrategy | null;
  readonly answeredApiSymbol: VanillaWindowAttributeApiCallSymbol | null;
  readonly answeredPresent: boolean | null;
  readonly answeredCount: number | null;
}

/**
 * A minimal handler interface modelling the canonical vanilla 1.9
 * window-title-and-icon policy contract. The reference implementation
 * answers each query against the pinned canonical landscape; the
 * cross-check accepts any handler shape so the focused test can
 * exercise deliberately broken adapters and observe the failure ids.
 */
export interface VanillaWindowTitleAndIconPolicyHandler {
  /**
   * Run a probe against a fresh handler instance. Returns the relevant
   * answer fields populated for the probe's query kind; unrelated
   * fields are `null`.
   */
  readonly runProbe: (probe: VanillaWindowTitleAndIconPolicyProbe) => VanillaWindowTitleAndIconPolicyResult;
}

const NULL_ANSWER: VanillaWindowTitleAndIconPolicyResult = Object.freeze({
  answeredSourceStrategy: null,
  answeredApiSymbol: null,
  answeredPresent: null,
  answeredCount: null,
});

/**
 * Reference handler that answers every query against the canonical
 * vanilla 1.9 window-title-and-icon policy landscape. The focused
 * test asserts that this handler passes every probe with zero
 * failures.
 */
function referenceVanillaWindowTitleAndIconPolicyProbe(probe: VanillaWindowTitleAndIconPolicyProbe): VanillaWindowTitleAndIconPolicyResult {
  switch (probe.queryKind) {
    case 'window-title-api-call-count': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_WINDOW_TITLE_API_CALL_COUNT });
    }
    case 'window-icon-api-call-count': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_WINDOW_ICON_API_CALL_COUNT });
    }
    case 'window-wm-class-api-call-count': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_WINDOW_WM_CLASS_API_CALL_COUNT });
    }
    case 'channel-x11-source-strategy': {
      const channelName = probe.queryChannelName;
      const record = VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.find((entry) => entry.channelName === channelName);
      return Object.freeze({ ...NULL_ANSWER, answeredSourceStrategy: record ? record.x11SourceStrategy : null });
    }
    case 'channel-dos-source-strategy': {
      const channelName = probe.queryChannelName;
      const record = VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.find((entry) => entry.channelName === channelName);
      return Object.freeze({ ...NULL_ANSWER, answeredSourceStrategy: record ? record.dosSourceStrategy : null });
    }
    case 'channel-x11-omitted-api-symbol': {
      const channelName = probe.queryChannelName;
      const record = VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.find((entry) => entry.channelName === channelName);
      return Object.freeze({ ...NULL_ANSWER, answeredApiSymbol: record ? record.x11ApiSymbolThatVanillaOmits : null });
    }
    case 'landscape-channel-count': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.length });
    }
    case 'dos-port-has-window-concept': {
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: VANILLA_DOS_PORT_HAS_WINDOW_CONCEPT });
    }
    case 'x11-port-uses-bare-xcreatewindow': {
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: VANILLA_X11_PORT_USES_BARE_XCREATEWINDOW });
    }
    case 'x11-port-attribmask-token-count': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_X11_XCREATEWINDOW_ATTRIBMASK_TOKENS.length });
    }
    case 'x11-port-attribmask-includes-token': {
      const token = probe.queryAttribmaskToken ?? '';
      const includes = VANILLA_X11_XCREATEWINDOW_ATTRIBMASK_TOKENS.includes(token);
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: includes });
    }
    case 'title-and-icon-policy-includes-chocolate-api-call': {
      const name = probe.queryChocolateApiCallName ?? '';
      const present = !VANILLA_WINDOW_TITLE_AND_ICON_POLICY_ABSENT_CHOCOLATE_API_CALLS.includes(name);
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: present });
    }
    case 'runtime-title-or-icon-mutation-allowed': {
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: false });
    }
    case 'title-before-icon-ordering-required': {
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: false });
    }
  }
}

/**
 * Reference handler routing every probe to the canonical reference
 * implementation. The focused test asserts that this handler passes
 * every probe with zero failures.
 */
export const REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER: VanillaWindowTitleAndIconPolicyHandler = Object.freeze({
  runProbe: referenceVanillaWindowTitleAndIconPolicyProbe,
});

/**
 * Cross-check a `VanillaWindowTitleAndIconPolicyHandler` against the
 * pinned probe set. Returns the list of failures by stable identifier;
 * an empty list means the handler is parity-safe with the canonical
 * vanilla 1.9 window-title-and-icon policy contract.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:answeredSourceStrategy:value-mismatch`
 *  - `probe:<probe.id>:answeredApiSymbol:value-mismatch`
 *  - `probe:<probe.id>:answeredPresent:value-mismatch`
 *  - `probe:<probe.id>:answeredCount:value-mismatch`
 */
export function crossCheckVanillaWindowTitleAndIconPolicy(handler: VanillaWindowTitleAndIconPolicyHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES) {
    const result = handler.runProbe(probe);

    if (probe.expectedAnsweredSourceStrategy !== null && result.answeredSourceStrategy !== probe.expectedAnsweredSourceStrategy) {
      failures.push(`probe:${probe.id}:answeredSourceStrategy:value-mismatch`);
    }
    if (probe.expectedAnsweredApiSymbol !== null && result.answeredApiSymbol !== probe.expectedAnsweredApiSymbol) {
      failures.push(`probe:${probe.id}:answeredApiSymbol:value-mismatch`);
    }
    if (probe.expectedAnsweredPresent !== null && result.answeredPresent !== probe.expectedAnsweredPresent) {
      failures.push(`probe:${probe.id}:answeredPresent:value-mismatch`);
    }
    if (probe.expectedAnsweredCount !== null && result.answeredCount !== probe.expectedAnsweredCount) {
      failures.push(`probe:${probe.id}:answeredCount:value-mismatch`);
    }
  }

  return failures;
}

/**
 * Convenience helper: derive the expected answer for an arbitrary
 * probe against the canonical vanilla 1.9 window-title-and-icon
 * policy contract. The focused test uses this helper to cross-validate
 * probe expectations independently of the reference handler.
 */
export function deriveExpectedVanillaWindowTitleAndIconPolicyResult(probe: VanillaWindowTitleAndIconPolicyProbe): VanillaWindowTitleAndIconPolicyResult {
  return referenceVanillaWindowTitleAndIconPolicyProbe(probe);
}
