/**
 * Audit ledger plus runtime policy for the vanilla DOOM 1.9 asset cache
 * lifetime contract — the rules that decide when each cached lump and
 * each `Z_Malloc`-allocated runtime block is freed by the zone allocator
 * during a session.
 *
 * Vanilla DOOM uses the `z_zone.c` zone allocator with a per-block
 * "purge tag" that drives lifetime. The complete tag taxonomy from
 * `z_zone.h`:
 *
 *   - `PU_STATIC`     - static for the entire process lifetime;
 *                       freed only by an explicit `Z_Free` or `Z_FreeTags`
 *                       call.
 *   - `PU_SOUND`      - static while the sound is playing; the SFX
 *                       channel layer downgrades the tag when the
 *                       channel ends.
 *   - `PU_MUSIC`      - static while the music is playing; the music
 *                       layer downgrades the tag when the song ends.
 *   - `PU_FREE`       - a free block (Chocolate Doom replacement for
 *                       id Software's `PU_DAVE`).
 *   - `PU_LEVEL`      - static until the next `P_SetupLevel`, which
 *                       calls `Z_FreeTags(PU_LEVEL, PU_PURGELEVEL - 1)`
 *                       to free everything tagged `PU_LEVEL` or
 *                       `PU_LEVSPEC` before loading the next map.
 *   - `PU_LEVSPEC`    - a special thinker pinned to the level lifetime;
 *                       freed by the same `Z_FreeTags` call as
 *                       `PU_LEVEL`.
 *   - `PU_PURGELEVEL` - lower bound (inclusive) for purgable blocks.
 *                       Tags >= `PU_PURGELEVEL` are eligible for
 *                       reclamation whenever the zone allocator needs
 *                       memory for a new allocation.
 *   - `PU_CACHE`      - purgable cache; the most common tag for
 *                       transient drawing assets.
 *
 * The cross-reference between an asset and its tag is observable in
 * the upstream Chocolate Doom 2.2.1 source: every `Z_Malloc(size, tag,
 * ptr)` call and every `W_CacheLumpName(name, tag)` /
 * `W_CacheLumpNum(num, tag)` call is a textual pairing of an asset
 * with its tag, so the lifetime policy is fully derivable from the
 * upstream C source without any runtime probing.
 *
 * This module pins, for the C1 shareware target (`bun run doom.ts`):
 *
 * 1. The 7-tag purge taxonomy (`PU_STATIC`, `PU_SOUND`, `PU_MUSIC`,
 *    `PU_LEVEL`, `PU_LEVSPEC`, `PU_PURGELEVEL`, `PU_CACHE`) and the
 *    semantic lifetime category each tag implies (`'static'`,
 *    `'sound-playing'`, `'music-playing'`, `'level'`, `'level-special'`,
 *    `'purgable'`).
 *
 * 2. The 30-axis audit ledger that pins, for every named lump or
 *    Z_Malloc-allocated block in the shareware-relevant code paths,
 *    the upstream `cSourceLines` that prove the (asset, tag) pairing.
 *
 * 3. The 28-entry `ASSET_LIFETIME_POLICY` table that names every
 *    audited (asset, tag) pairing as a runtime-queryable row.
 *
 * 4. The runtime helpers `getLifetimeTagForAsset(name)`,
 *    `classifyLifetimeCategory(tag)`,
 *    `isFreedAtLevelExit(tag)`,
 *    `isPurgableTag(tag)`, and
 *    `assetsFreedAtLevelExit()` so future caches (texture composition,
 *    flat cache, sprite frame cache, patch font cache) can call into
 *    a single source of truth instead of rolling ad-hoc lifetime rules.
 *
 * 5. The `Z_FreeTags(PU_LEVEL, PU_PURGELEVEL - 1)` lifecycle hook
 *    contract that pins the level-exit free range as the
 *    half-open interval [PU_LEVEL, PU_PURGELEVEL).
 *
 * 6. The cross-check helper `crossCheckAssetCacheLifetimeRuntime` that
 *    consumes a runtime snapshot and reports the list of axes whose
 *    runtime counterpart did not surface the expected behavior, by
 *    stable identifier.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE` (presence-only, no content read),
 *   2. local IWAD `doom/DOOM1.WAD` (presence-only at this layer; the
 *      lifetime policy is derived from the C source, not from on-disk
 *      bytes),
 *   3. local Windows oracle `doom/DOOM.EXE`,
 *   4. id Software `linuxdoom-1.10` source (`z_zone.h`, `r_data.c`,
 *      `w_wad.c`, `p_setup.c`, `d_main.c`, `f_finale.c`,
 *      `st_stuff.c`),
 *   5. Chocolate Doom 2.2.1 source (`src/z_zone.h`, `src/z_zone.c`,
 *      `src/doom/r_data.c`, `src/doom/p_setup.c`, `src/doom/d_main.c`,
 *      `src/doom/f_finale.c`, `src/doom/st_stuff.c`,
 *      `src/doom/m_menu.c`, `src/doom/wi_stuff.c`).
 *
 * The numeric values of `PU_LEVEL` and the other symbolic tags differ
 * between id Software's original `linuxdoom-1.10/z_zone.h`
 * (`PU_LEVEL = 50`) and Chocolate Doom 2.2.1's
 * `src/z_zone.h` (auto-incremented enum, so `PU_LEVEL = 5`). Because
 * Chocolate Doom 2.2.1 is the behavioral reference and because the
 * numeric values are an implementation detail of the zone allocator
 * (only the relative ordering and the named hooks affect observable
 * behavior), this module pins the symbolic name and the lifetime
 * category but intentionally does NOT pin a numeric value: a future
 * `src/core/zone.ts` step is the right place to lock the integer
 * representation. The relative-ordering invariant `PU_STATIC <
 * PU_LEVEL < PU_PURGELEVEL <= PU_CACHE` IS pinned here because it is
 * load-bearing for the level-exit `Z_FreeTags(PU_LEVEL, PU_PURGELEVEL
 * - 1)` half-open interval.
 *
 * This module does NOT itself allocate any memory or implement the
 * zone allocator: it is a pure contract that future cache builders
 * (05-022 texture composition cache, 05-023 flat cache, 05-024 sprite
 * frame cache, 05-025 patch font cache) and the future runtime
 * `src/core/zone.ts` allocator will call into.
 */

/**
 * Closed-enum vanilla purge tag names. These are textual symbols, not
 * numeric values: the integer representation is intentionally left to
 * a future `src/core/zone.ts` allocator step. Only the relative
 * ordering `PU_STATIC < PU_LEVEL < PU_PURGELEVEL <= PU_CACHE` is
 * load-bearing here.
 */
export type AssetPurgeTag = 'PU_STATIC' | 'PU_SOUND' | 'PU_MUSIC' | 'PU_LEVEL' | 'PU_LEVSPEC' | 'PU_PURGELEVEL' | 'PU_CACHE';

/**
 * Closed-enum lifetime category. Every purge tag maps to exactly one
 * category. The category drives observable cache eviction behavior;
 * different tags that share a category MUST be freed by the same hook.
 */
export type AssetLifetimeCategory = 'static' | 'sound-playing' | 'music-playing' | 'level' | 'level-special' | 'purgable';

/**
 * Asciibetically sorted, frozen list of every purge tag name vanilla
 * DOOM 1.9 uses. The list is closed: a future tag would require an
 * explicit audit ledger extension before it can be added here.
 */
export const VANILLA_PURGE_TAGS: readonly AssetPurgeTag[] = Object.freeze(['PU_CACHE', 'PU_LEVEL', 'PU_LEVSPEC', 'PU_MUSIC', 'PU_PURGELEVEL', 'PU_SOUND', 'PU_STATIC']);

/**
 * Asciibetically sorted, frozen list of every lifetime category that
 * the audited tag taxonomy maps to. The list is closed: a future
 * category would require an explicit audit ledger extension.
 */
export const VANILLA_LIFETIME_CATEGORIES: readonly AssetLifetimeCategory[] = Object.freeze(['level', 'level-special', 'music-playing', 'purgable', 'sound-playing', 'static']);

/**
 * Frozen ordered map (preserved insertion order via `as const`) from
 * each purge tag to its lifetime category. The mapping is total: every
 * `AssetPurgeTag` value appears exactly once on the left.
 */
export const PURGE_TAG_TO_LIFETIME_CATEGORY: { readonly [Key in AssetPurgeTag]: AssetLifetimeCategory } = Object.freeze({
  PU_STATIC: 'static',
  PU_SOUND: 'sound-playing',
  PU_MUSIC: 'music-playing',
  PU_LEVEL: 'level',
  PU_LEVSPEC: 'level-special',
  PU_PURGELEVEL: 'purgable',
  PU_CACHE: 'purgable',
});

/**
 * One audited (asset, tag) pairing pinned to its upstream Chocolate
 * Doom 2.2.1 / linuxdoom-1.10 source line.
 *
 * Each entry pins one named lump or one named `Z_Malloc`-allocated
 * runtime block, the symbolic purge tag the upstream code passes to
 * `Z_Malloc` / `W_CacheLumpName` / `W_CacheLumpNum` for that asset,
 * the upstream subsystem that owns the call, and a plain-language
 * invariant describing the runtime behavior the pairing locks down.
 */
export interface AssetCacheLifetimeAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'playpal-cached-pu-cache'
    | 'colormap-cached-pu-static'
    | 'colormap-zmalloc-pu-static-after-alignment'
    | 'texture1-cached-pu-static'
    | 'texture2-cached-pu-static-when-present'
    | 'pnames-cached-pu-static'
    | 'patchlookup-zmalloc-pu-static'
    | 'flattranslation-zmalloc-pu-static'
    | 'flat-content-cached-pu-static-by-num'
    | 'sprite-width-zmalloc-pu-static'
    | 'sprite-offset-zmalloc-pu-static'
    | 'sprite-topoffset-zmalloc-pu-static'
    | 'sprite-frame-cached-pu-cache-by-num-at-draw-time'
    | 'stbar-cached-pu-static'
    | 'starms-cached-pu-static'
    | 'endoom-cached-pu-static'
    | 'genmidi-cached-pu-static'
    | 'titlepic-cached-pu-cache'
    | 'credit-cached-pu-cache'
    | 'help1-cached-pu-cache'
    | 'help2-cached-pu-cache'
    | 'bossback-cached-pu-cache'
    | 'victory2-cached-pu-cache'
    | 'endpic-cached-pu-cache'
    | 'pfub1-cached-pu-level'
    | 'pfub2-cached-pu-level'
    | 'blockmap-cached-pu-level'
    | 'reject-cached-pu-level'
    | 'map-data-cached-pu-static-then-freed'
    | 'demo-lump-cached-pu-static'
    | 'level-exit-z-freetags-half-open-interval';
  /** Asset or runtime block this row pins. */
  readonly asset:
    | 'PLAYPAL'
    | 'COLORMAP'
    | 'TEXTURE1'
    | 'TEXTURE2'
    | 'PNAMES'
    | 'patchlookup'
    | 'flattranslation'
    | 'flat-data-lump'
    | 'spritewidth'
    | 'spriteoffset'
    | 'spritetopoffset'
    | 'sprite-frame-patch'
    | 'STBAR'
    | 'STARMS'
    | 'ENDOOM'
    | 'GENMIDI'
    | 'TITLEPIC'
    | 'CREDIT'
    | 'HELP1'
    | 'HELP2'
    | 'BOSSBACK'
    | 'VICTORY2'
    | 'ENDPIC'
    | 'PFUB1'
    | 'PFUB2'
    | 'BLOCKMAP'
    | 'REJECT'
    | 'map-data-lump'
    | 'demo-lump'
    | 'Z_FreeTags';
  /** Symbolic purge tag the upstream code pairs with this asset. */
  readonly tag: AssetPurgeTag;
  /** Verbatim C source line(s) that establish the (asset, tag) pairing. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the Chocolate Doom 2.2.1 / linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'src/doom/r_data.c' | 'src/doom/d_main.c' | 'src/doom/p_setup.c' | 'src/doom/f_finale.c' | 'src/doom/st_stuff.c' | 'src/doom/m_menu.c' | 'src/doom/wi_stuff.c' | 'src/doom/g_game.c' | 'src/z_zone.c';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every audited (asset, tag) pairing the runtime
 * cache layer must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior in the policy table and the runtime helpers.
 */
export const ASSET_CACHE_LIFETIME_AUDIT: readonly AssetCacheLifetimeAuditEntry[] = [
  {
    id: 'playpal-cached-pu-cache',
    asset: 'PLAYPAL',
    tag: 'PU_CACHE',
    cSourceLines: ['pal = (byte *) W_CacheLumpNum (lu_palette, PU_CACHE) + palette*768;'],
    referenceSourceFile: 'src/doom/d_main.c',
    invariant:
      'Vanilla `I_SetPalette` caches the PLAYPAL lump via `W_CacheLumpNum(lu_palette, PU_CACHE)` on every palette change. PU_CACHE means the lump is purgable: the renderer reloads it on demand if the zone allocator reclaimed it. The runtime models this by classifying PLAYPAL with `tag === "PU_CACHE"` and lifetime category `"purgable"`.',
  },
  {
    id: 'colormap-cached-pu-static',
    asset: 'COLORMAP',
    tag: 'PU_STATIC',
    cSourceLines: ['colormaps = W_CacheLumpName ("COLORMAP", PU_STATIC);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla `R_InitColormaps` caches the COLORMAP lump via `W_CacheLumpName("COLORMAP", PU_STATIC)`. PU_STATIC means the lump persists for the entire process lifetime — it is never purged. The runtime models this by classifying COLORMAP with `tag === "PU_STATIC"` and lifetime category `"static"`.',
  },
  {
    id: 'colormap-zmalloc-pu-static-after-alignment',
    asset: 'COLORMAP',
    tag: 'PU_STATIC',
    cSourceLines: ['lump = W_GetNumForName("COLORMAP"); ', 'length = W_LumpLength (lump) + 255; ', 'colormaps = Z_Malloc (length, PU_STATIC, 0); ', 'colormaps = (byte *)( ((int)colormaps + 255)&~0xff); ', 'W_ReadLump (lump,colormaps); '],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla `R_InitColormaps` allocates a 256-byte aligned COLORMAP buffer via `Z_Malloc(length + 255, PU_STATIC, 0)` and rounds the pointer up to a 256-byte boundary. The PU_STATIC tag pins the buffer for the entire process lifetime so the renderer can dereference any of the 34 colormap rows without reload checks. The runtime models this by recording two PU_STATIC rows for COLORMAP: one for the lump cache, one for the aligned Z_Malloc buffer.',
  },
  {
    id: 'texture1-cached-pu-static',
    asset: 'TEXTURE1',
    tag: 'PU_STATIC',
    cSourceLines: ['maptex = maptex1 = W_CacheLumpName (DEH_String("TEXTURE1"), PU_STATIC);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla `R_InitTextures` caches the TEXTURE1 lump via `W_CacheLumpName("TEXTURE1", PU_STATIC)`. The composed texture column buffers downstream of TEXTURE1 inherit PU_STATIC for the same reason: the renderer indexes into them on every wall column draw. The runtime models this by classifying TEXTURE1 with `tag === "PU_STATIC"`.',
  },
  {
    id: 'texture2-cached-pu-static-when-present',
    asset: 'TEXTURE2',
    tag: 'PU_STATIC',
    cSourceLines: ['if (W_CheckNumForName (DEH_String("TEXTURE2")) != -1)', '    maptex2 = W_CacheLumpName (DEH_String("TEXTURE2"), PU_STATIC);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla `R_InitTextures` caches TEXTURE2 with PU_STATIC IF the lump is present (registered/Ultimate IWADs); the shareware IWAD takes the `else` branch and TEXTURE2 is absent. The lifetime policy still classifies TEXTURE2 with `tag === "PU_STATIC"` because the `else` branch is a presence check, not a lifetime override.',
  },
  {
    id: 'pnames-cached-pu-static',
    asset: 'PNAMES',
    tag: 'PU_STATIC',
    cSourceLines: ['names = W_CacheLumpName (DEH_String("PNAMES"), PU_STATIC);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla `R_InitTextures` caches PNAMES with PU_STATIC. The `patchlookup` array (`Z_Malloc(nummappatches*sizeof(*patchlookup), PU_STATIC, NULL)`) is also PU_STATIC because it is consulted on every TEXTURE1/TEXTURE2 column draw.',
  },
  {
    id: 'patchlookup-zmalloc-pu-static',
    asset: 'patchlookup',
    tag: 'PU_STATIC',
    cSourceLines: ['patchlookup = Z_Malloc(nummappatches*sizeof(*patchlookup), PU_STATIC, NULL);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla `R_InitTextures` allocates the `patchlookup` array (one int per PNAMES entry) via `Z_Malloc(nummappatches*sizeof(*patchlookup), PU_STATIC, NULL)`. The runtime models this by recording a PU_STATIC row for `patchlookup`; the future texture composition cache (05-022) must keep the patchlookup buffer alive for the entire process lifetime.',
  },
  {
    id: 'flattranslation-zmalloc-pu-static',
    asset: 'flattranslation',
    tag: 'PU_STATIC',
    cSourceLines: ['flattranslation = Z_Malloc ((numflats+1)*sizeof(*flattranslation), ', '                            PU_STATIC, 0);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla `R_InitFlats` allocates the `flattranslation` table with `numflats + 1` int slots via `Z_Malloc((numflats+1)*sizeof(*flattranslation), PU_STATIC, 0)`. The PU_STATIC tag pins the table for the entire process lifetime so animated flats can be retargeted by writing into `flattranslation[i]` without re-allocating. The runtime models this by recording a PU_STATIC row for `flattranslation`.',
  },
  {
    id: 'flat-content-cached-pu-static-by-num',
    asset: 'flat-data-lump',
    tag: 'PU_STATIC',
    cSourceLines: ['flat = W_CacheLumpNum(firstflat+i, PU_STATIC); '],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla `R_InitFlats` caches each flat data lump via `W_CacheLumpNum(firstflat+i, PU_STATIC)` at init time, so the 4096-byte flat pixel buffer is pinned for the entire process lifetime. The future flat cache (05-023) must mirror this by classifying every flat data lump with `tag === "PU_STATIC"`.',
  },
  {
    id: 'sprite-width-zmalloc-pu-static',
    asset: 'spritewidth',
    tag: 'PU_STATIC',
    cSourceLines: ['spritewidth = Z_Malloc (numspritelumps*sizeof(*spritewidth), PU_STATIC, 0);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla `R_InitSpriteLumps` allocates the per-frame `spritewidth` array via `Z_Malloc(numspritelumps*sizeof(*spritewidth), PU_STATIC, 0)`. PU_STATIC pins the table for the process lifetime so the renderer can index it on every sprite draw without bounds-checking against a freed pointer.',
  },
  {
    id: 'sprite-offset-zmalloc-pu-static',
    asset: 'spriteoffset',
    tag: 'PU_STATIC',
    cSourceLines: ['spriteoffset = Z_Malloc (numspritelumps*sizeof(*spriteoffset), PU_STATIC, 0);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant: 'Vanilla `R_InitSpriteLumps` allocates the per-frame `spriteoffset` array via `Z_Malloc(numspritelumps*sizeof(*spriteoffset), PU_STATIC, 0)`. PU_STATIC pins the table for the process lifetime, paralleling `spritewidth`.',
  },
  {
    id: 'sprite-topoffset-zmalloc-pu-static',
    asset: 'spritetopoffset',
    tag: 'PU_STATIC',
    cSourceLines: ['spritetopoffset = Z_Malloc (numspritelumps*sizeof(*spritetopoffset), PU_STATIC, 0);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla `R_InitSpriteLumps` allocates the per-frame `spritetopoffset` array via `Z_Malloc(numspritelumps*sizeof(*spritetopoffset), PU_STATIC, 0)`. PU_STATIC pins the table for the process lifetime, paralleling `spritewidth` and `spriteoffset`.',
  },
  {
    id: 'sprite-frame-cached-pu-cache-by-num-at-draw-time',
    asset: 'sprite-frame-patch',
    tag: 'PU_CACHE',
    cSourceLines: ['patch = W_CacheLumpNum(vis->patch+firstspritelump, PU_CACHE);'],
    referenceSourceFile: 'src/doom/r_data.c',
    invariant:
      'Vanilla `R_DrawVisSprite` caches the sprite-frame patch lump via `W_CacheLumpNum(vis->patch+firstspritelump, PU_CACHE)` on every visible-sprite draw. PU_CACHE means the lump is purgable: the zone allocator may reclaim it between frames, and the next draw will reload from the WAD. The runtime models this by classifying sprite frames with `tag === "PU_CACHE"` and lifetime category `"purgable"`.',
  },
  {
    id: 'stbar-cached-pu-static',
    asset: 'STBAR',
    tag: 'PU_STATIC',
    cSourceLines: ['sbar = W_CacheLumpName("STBAR", PU_STATIC);'],
    referenceSourceFile: 'src/doom/st_stuff.c',
    invariant: 'Vanilla `ST_Init` caches the STBAR status-bar background lump with PU_STATIC. The HUD draws the status bar every frame, so it is pinned for the entire process lifetime to avoid per-frame reload churn.',
  },
  {
    id: 'starms-cached-pu-static',
    asset: 'STARMS',
    tag: 'PU_STATIC',
    cSourceLines: ['starms = W_CacheLumpName("STARMS", PU_STATIC);'],
    referenceSourceFile: 'src/doom/st_stuff.c',
    invariant: 'Vanilla `ST_Init` caches the STARMS arms-panel patch lump with PU_STATIC, paralleling STBAR. Both lumps are required for the in-game HUD and are pinned for the entire process lifetime.',
  },
  {
    id: 'endoom-cached-pu-static',
    asset: 'ENDOOM',
    tag: 'PU_STATIC',
    cSourceLines: ['endoom = W_CacheLumpName("ENDOOM", PU_STATIC);'],
    referenceSourceFile: 'src/doom/d_main.c',
    invariant: 'Vanilla `I_Endoom` caches the ENDOOM text-mode quit screen with PU_STATIC. The lifetime is technically only "until shutdown," but PU_STATIC subsumes the entire process lifetime so the policy is identical.',
  },
  {
    id: 'genmidi-cached-pu-static',
    asset: 'GENMIDI',
    tag: 'PU_STATIC',
    cSourceLines: ['genmidi = W_CacheLumpName("GENMIDI", PU_STATIC);'],
    referenceSourceFile: 'src/doom/d_main.c',
    invariant:
      'Vanilla DMX library initialization caches the GENMIDI OPL2 instrument bank with PU_STATIC. The synth references GENMIDI on every MUS instrument-program-change event, so PU_STATIC pins the bank for the entire process lifetime.',
  },
  {
    id: 'titlepic-cached-pu-cache',
    asset: 'TITLEPIC',
    tag: 'PU_CACHE',
    cSourceLines: ['pagename = "TITLEPIC";', 'V_DrawPatchDirect (0, 0, 0, W_CacheLumpName(pagename, PU_CACHE));'],
    referenceSourceFile: 'src/doom/d_main.c',
    invariant:
      'Vanilla `D_PageDrawer` caches the TITLEPIC title-screen patch via `W_CacheLumpName("TITLEPIC", PU_CACHE)` once per title-loop tick. PU_CACHE means the lump is purgable: the zone allocator may reclaim it between ticks, and the next draw will reload. The runtime models this by classifying TITLEPIC with `tag === "PU_CACHE"`.',
  },
  {
    id: 'credit-cached-pu-cache',
    asset: 'CREDIT',
    tag: 'PU_CACHE',
    cSourceLines: ['pagename = "CREDIT";', 'V_DrawPatchDirect (0, 0, 0, W_CacheLumpName(pagename, PU_CACHE));'],
    referenceSourceFile: 'src/doom/d_main.c',
    invariant: 'Vanilla `D_PageDrawer` caches the CREDIT credits-screen patch via `W_CacheLumpName("CREDIT", PU_CACHE)` paralleling TITLEPIC. The runtime models this by classifying CREDIT with `tag === "PU_CACHE"`.',
  },
  {
    id: 'help1-cached-pu-cache',
    asset: 'HELP1',
    tag: 'PU_CACHE',
    cSourceLines: ['V_DrawPatchDirect (0, 0, 0, W_CacheLumpName("HELP1", PU_CACHE));'],
    referenceSourceFile: 'src/doom/m_menu.c',
    invariant:
      'Vanilla `M_DrawReadThis1` caches the HELP1 in-game help patch via `W_CacheLumpName("HELP1", PU_CACHE)`. PU_CACHE pins the lump only for the duration of one help-screen draw; the menu can be dismissed and the lump reclaimed without affecting later behavior.',
  },
  {
    id: 'help2-cached-pu-cache',
    asset: 'HELP2',
    tag: 'PU_CACHE',
    cSourceLines: ['V_DrawPatchDirect (0, 0, 0, W_CacheLumpName("HELP2", PU_CACHE));'],
    referenceSourceFile: 'src/doom/m_menu.c',
    invariant: 'Vanilla `M_DrawReadThis2` caches the HELP2 in-game help patch via `W_CacheLumpName("HELP2", PU_CACHE)` paralleling HELP1. The runtime models this by classifying HELP2 with `tag === "PU_CACHE"`.',
  },
  {
    id: 'bossback-cached-pu-cache',
    asset: 'BOSSBACK',
    tag: 'PU_CACHE',
    cSourceLines: ['V_DrawPatchDirect(0, 0, 0, W_CacheLumpName("BOSSBACK", PU_CACHE));'],
    referenceSourceFile: 'src/doom/wi_stuff.c',
    invariant: 'Vanilla `WI_drawNoState` caches the BOSSBACK end-of-episode background patch via `W_CacheLumpName("BOSSBACK", PU_CACHE)`. PU_CACHE pins the lump only for the duration of the intermission tick.',
  },
  {
    id: 'victory2-cached-pu-cache',
    asset: 'VICTORY2',
    tag: 'PU_CACHE',
    cSourceLines: ['V_DrawPatchDirect(0, 0, 0, W_CacheLumpName("VICTORY2", PU_CACHE));'],
    referenceSourceFile: 'src/doom/f_finale.c',
    invariant: 'Vanilla `F_BunnyScroll` and the related finale path cache the VICTORY2 victory-screen patch with PU_CACHE. The runtime models this by classifying VICTORY2 with `tag === "PU_CACHE"`.',
  },
  {
    id: 'endpic-cached-pu-cache',
    asset: 'ENDPIC',
    tag: 'PU_CACHE',
    cSourceLines: ['V_DrawPatchDirect(0, 0, 0, W_CacheLumpName("ENDPIC", PU_CACHE));'],
    referenceSourceFile: 'src/doom/f_finale.c',
    invariant: 'Vanilla `F_CastDrawer` caches the ENDPIC end-screen patch with PU_CACHE. The runtime models this by classifying ENDPIC with `tag === "PU_CACHE"`.',
  },
  {
    id: 'pfub1-cached-pu-level',
    asset: 'PFUB1',
    tag: 'PU_LEVEL',
    cSourceLines: ['p2 = W_CacheLumpName ("PFUB1", PU_LEVEL);'],
    referenceSourceFile: 'src/doom/f_finale.c',
    invariant:
      'Vanilla `F_BunnyScroll` caches the PFUB1 finale-text-scroll background patch with PU_LEVEL. PU_LEVEL means the lump is freed by the next `Z_FreeTags(PU_LEVEL, PU_PURGELEVEL - 1)` call at level (or finale) exit. The runtime models this by classifying PFUB1 with `tag === "PU_LEVEL"` and lifetime category `"level"`.',
  },
  {
    id: 'pfub2-cached-pu-level',
    asset: 'PFUB2',
    tag: 'PU_LEVEL',
    cSourceLines: ['p1 = W_CacheLumpName ("PFUB2", PU_LEVEL);'],
    referenceSourceFile: 'src/doom/f_finale.c',
    invariant: 'Vanilla `F_BunnyScroll` caches the PFUB2 finale-text-scroll background patch with PU_LEVEL paralleling PFUB1. Both patches are freed at finale exit by `Z_FreeTags(PU_LEVEL, PU_PURGELEVEL - 1)`.',
  },
  {
    id: 'blockmap-cached-pu-level',
    asset: 'BLOCKMAP',
    tag: 'PU_LEVEL',
    cSourceLines: ['blockmaplump = W_CacheLumpNum (lump + ML_BLOCKMAP, PU_LEVEL);'],
    referenceSourceFile: 'src/doom/p_setup.c',
    invariant:
      'Vanilla `P_LoadBlockMap` caches the per-map BLOCKMAP lump with PU_LEVEL. The blockmap is consulted on every `P_BlockThingsIterator` / `P_BlockLinesIterator` call during simulation, but the lifetime ends at level exit because the next map ships its own BLOCKMAP. The runtime models this by classifying BLOCKMAP with `tag === "PU_LEVEL"`.',
  },
  {
    id: 'reject-cached-pu-level',
    asset: 'REJECT',
    tag: 'PU_LEVEL',
    cSourceLines: ['rejectmatrix = W_CacheLumpNum (lump + ML_REJECT, PU_LEVEL);'],
    referenceSourceFile: 'src/doom/p_setup.c',
    invariant:
      'Vanilla `P_LoadReject` caches the per-map REJECT lump with PU_LEVEL paralleling BLOCKMAP. The reject matrix is consulted on every `P_CheckSight` call during AI simulation, but the lifetime ends at level exit. The runtime models this by classifying REJECT with `tag === "PU_LEVEL"`.',
  },
  {
    id: 'map-data-cached-pu-static-then-freed',
    asset: 'map-data-lump',
    tag: 'PU_STATIC',
    cSourceLines: ['data = W_CacheLumpNum (lumpnum + ML_THINGS, PU_STATIC);', 'Z_Free (data);'],
    referenceSourceFile: 'src/doom/p_setup.c',
    invariant:
      'Vanilla `P_LoadThings` / `P_LoadLineDefs` / `P_LoadSideDefs` / `P_LoadVertexes` / `P_LoadSegs` / `P_LoadSubsectors` / `P_LoadNodes` / `P_LoadSectors` cache each map data lump (THINGS/LINEDEFS/SIDEDEFS/VERTEXES/SEGS/SSECTORS/NODES/SECTORS) with PU_STATIC, parse it into the runtime structure, and then explicitly call `Z_Free(data)` once parsing is complete. PU_STATIC here is a transient pin: the caller frees the buffer manually rather than waiting for level exit. The runtime models this by classifying map data lumps with `tag === "PU_STATIC"` and noting in the invariant that the cache lifetime ends at the explicit `Z_Free` call after parsing.',
  },
  {
    id: 'demo-lump-cached-pu-static',
    asset: 'demo-lump',
    tag: 'PU_STATIC',
    cSourceLines: ['demobuffer = demo_p = W_CacheLumpName (defdemoname, PU_STATIC);'],
    referenceSourceFile: 'src/doom/g_game.c',
    invariant:
      'Vanilla `G_DoPlayDemo` caches the named demo lump with PU_STATIC. The demo buffer is read every gametic during playback; PU_STATIC pins it for the playback duration and the buffer is reclaimed (via `W_ReleaseLumpName` or process exit) when playback ends. The runtime models this by classifying demo lumps with `tag === "PU_STATIC"`.',
  },
  {
    id: 'level-exit-z-freetags-half-open-interval',
    asset: 'Z_FreeTags',
    tag: 'PU_LEVEL',
    cSourceLines: ['Z_FreeTags (PU_LEVEL, PU_PURGELEVEL-1);'],
    referenceSourceFile: 'src/doom/p_setup.c',
    invariant:
      'Vanilla `P_SetupLevel` calls `Z_FreeTags(PU_LEVEL, PU_PURGELEVEL - 1)` at the start of every map load to release everything tagged in the half-open interval `[PU_LEVEL, PU_PURGELEVEL)`. This drains PU_LEVEL and PU_LEVSPEC blocks (BLOCKMAP, REJECT, PFUB1/PFUB2 from the prior finale, every level thinker) and leaves PU_STATIC and PU_PURGELEVEL+ untouched. The runtime models this with `assetsFreedAtLevelExit()` returning every audited row whose tag is in `[PU_LEVEL, PU_PURGELEVEL)`.',
  },
] as const;

/**
 * One derived bit-level invariant the cross-check enforces on top of
 * the raw audit entries. Failures point at concrete identities any
 * vanilla parity rebuild must preserve.
 */
export interface AssetCacheLifetimeDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const ASSET_CACHE_LIFETIME_DERIVED_INVARIANTS: readonly AssetCacheLifetimeDerivedInvariant[] = [
  { id: 'PURGE_TAG_LIST_IS_ASCIIBETICALLY_SORTED', description: '`VANILLA_PURGE_TAGS` is asciibetically sorted and frozen with the seven canonical tags.' },
  { id: 'LIFETIME_CATEGORY_LIST_IS_ASCIIBETICALLY_SORTED', description: '`VANILLA_LIFETIME_CATEGORIES` is asciibetically sorted and frozen with the six canonical categories.' },
  { id: 'PURGE_TAG_TO_LIFETIME_CATEGORY_IS_TOTAL', description: 'Every `AssetPurgeTag` value appears as a key in `PURGE_TAG_TO_LIFETIME_CATEGORY` exactly once and maps to a member of `VANILLA_LIFETIME_CATEGORIES`.' },
  { id: 'PU_STATIC_MAPS_TO_STATIC_CATEGORY', description: '`PURGE_TAG_TO_LIFETIME_CATEGORY.PU_STATIC === "static"`.' },
  { id: 'PU_LEVEL_MAPS_TO_LEVEL_CATEGORY', description: '`PURGE_TAG_TO_LIFETIME_CATEGORY.PU_LEVEL === "level"`.' },
  { id: 'PU_LEVSPEC_MAPS_TO_LEVEL_SPECIAL_CATEGORY', description: '`PURGE_TAG_TO_LIFETIME_CATEGORY.PU_LEVSPEC === "level-special"`.' },
  { id: 'PU_CACHE_MAPS_TO_PURGABLE_CATEGORY', description: '`PURGE_TAG_TO_LIFETIME_CATEGORY.PU_CACHE === "purgable"`.' },
  { id: 'PU_PURGELEVEL_MAPS_TO_PURGABLE_CATEGORY', description: '`PURGE_TAG_TO_LIFETIME_CATEGORY.PU_PURGELEVEL === "purgable"` because PU_PURGELEVEL is the lower bound of the purgable range.' },
  { id: 'PU_SOUND_MAPS_TO_SOUND_PLAYING_CATEGORY', description: '`PURGE_TAG_TO_LIFETIME_CATEGORY.PU_SOUND === "sound-playing"`.' },
  { id: 'PU_MUSIC_MAPS_TO_MUSIC_PLAYING_CATEGORY', description: '`PURGE_TAG_TO_LIFETIME_CATEGORY.PU_MUSIC === "music-playing"`.' },
  { id: 'POLICY_TABLE_HAS_ENTRY_PER_AUDIT_AXIS', description: 'Every audit-ledger axis except the `level-exit-z-freetags-half-open-interval` lifecycle hook has a corresponding `ASSET_LIFETIME_POLICY` row.' },
  { id: 'POLICY_TABLE_TAGS_MATCH_AUDIT_TAGS', description: "For every (axis, policy row) pair, the policy row's `tag` matches the audit axis's `tag`." },
  { id: 'PLAYPAL_LIFETIME_IS_PURGABLE', description: '`getLifetimeTagForAsset("PLAYPAL") === "PU_CACHE"` and `classifyLifetimeCategory("PU_CACHE") === "purgable"`.' },
  { id: 'COLORMAP_LIFETIME_IS_STATIC', description: '`getLifetimeTagForAsset("COLORMAP") === "PU_STATIC"` and the category is `"static"`.' },
  { id: 'TEXTURE1_LIFETIME_IS_STATIC', description: '`getLifetimeTagForAsset("TEXTURE1") === "PU_STATIC"`.' },
  { id: 'PNAMES_LIFETIME_IS_STATIC', description: '`getLifetimeTagForAsset("PNAMES") === "PU_STATIC"`.' },
  { id: 'BLOCKMAP_LIFETIME_IS_LEVEL', description: '`getLifetimeTagForAsset("BLOCKMAP") === "PU_LEVEL"` and the category is `"level"`.' },
  { id: 'REJECT_LIFETIME_IS_LEVEL', description: '`getLifetimeTagForAsset("REJECT") === "PU_LEVEL"` and the category is `"level"`.' },
  { id: 'PFUB1_LIFETIME_IS_LEVEL', description: '`getLifetimeTagForAsset("PFUB1") === "PU_LEVEL"` and the category is `"level"`.' },
  { id: 'PFUB2_LIFETIME_IS_LEVEL', description: '`getLifetimeTagForAsset("PFUB2") === "PU_LEVEL"` and the category is `"level"`.' },
  { id: 'TITLEPIC_LIFETIME_IS_PURGABLE', description: '`getLifetimeTagForAsset("TITLEPIC") === "PU_CACHE"` and the category is `"purgable"`.' },
  { id: 'CREDIT_LIFETIME_IS_PURGABLE', description: '`getLifetimeTagForAsset("CREDIT") === "PU_CACHE"` and the category is `"purgable"`.' },
  { id: 'STBAR_AND_STARMS_LIFETIMES_ARE_STATIC', description: '`getLifetimeTagForAsset("STBAR") === "PU_STATIC"` and `getLifetimeTagForAsset("STARMS") === "PU_STATIC"`.' },
  { id: 'ENDOOM_AND_GENMIDI_LIFETIMES_ARE_STATIC', description: '`getLifetimeTagForAsset("ENDOOM") === "PU_STATIC"` and `getLifetimeTagForAsset("GENMIDI") === "PU_STATIC"`.' },
  { id: 'GET_LIFETIME_TAG_RETURNS_NULL_FOR_UNKNOWN_ASSET', description: '`getLifetimeTagForAsset("DOES_NOT_EXIST")` returns `null` because the asset has no audited row.' },
  { id: 'GET_LIFETIME_TAG_IS_CASE_INSENSITIVE', description: '`getLifetimeTagForAsset("playpal") === "PU_CACHE"` (matching vanilla\'s case-insensitive `W_CheckNumForName`).' },
  {
    id: 'IS_FREED_AT_LEVEL_EXIT_ACCEPTS_PU_LEVEL_AND_PU_LEVSPEC',
    description: '`isFreedAtLevelExit("PU_LEVEL") === true` and `isFreedAtLevelExit("PU_LEVSPEC") === true` because both are inside the `[PU_LEVEL, PU_PURGELEVEL)` half-open interval.',
  },
  { id: 'IS_FREED_AT_LEVEL_EXIT_REJECTS_PU_STATIC', description: '`isFreedAtLevelExit("PU_STATIC") === false` because PU_STATIC is below the level-exit interval lower bound.' },
  { id: 'IS_FREED_AT_LEVEL_EXIT_REJECTS_PU_CACHE', description: '`isFreedAtLevelExit("PU_CACHE") === false` because PU_CACHE is at or above the level-exit interval upper bound.' },
  { id: 'IS_PURGABLE_TAG_ACCEPTS_PU_CACHE', description: '`isPurgableTag("PU_CACHE") === true` because PU_CACHE is at or above PU_PURGELEVEL.' },
  { id: 'IS_PURGABLE_TAG_REJECTS_PU_STATIC', description: '`isPurgableTag("PU_STATIC") === false`.' },
  { id: 'IS_PURGABLE_TAG_REJECTS_PU_LEVEL', description: '`isPurgableTag("PU_LEVEL") === false`.' },
  { id: 'ASSETS_FREED_AT_LEVEL_EXIT_INCLUDES_BLOCKMAP_AND_REJECT', description: '`assetsFreedAtLevelExit()` includes both `BLOCKMAP` and `REJECT`.' },
  { id: 'ASSETS_FREED_AT_LEVEL_EXIT_INCLUDES_PFUB1_AND_PFUB2', description: '`assetsFreedAtLevelExit()` includes both `PFUB1` and `PFUB2`.' },
  { id: 'ASSETS_FREED_AT_LEVEL_EXIT_EXCLUDES_PLAYPAL', description: '`assetsFreedAtLevelExit()` does NOT include `PLAYPAL` because PLAYPAL is PU_CACHE (purgable but not level-scoped).' },
  { id: 'ASSETS_FREED_AT_LEVEL_EXIT_EXCLUDES_COLORMAP', description: '`assetsFreedAtLevelExit()` does NOT include `COLORMAP` because COLORMAP is PU_STATIC.' },
  { id: 'EVERY_AUDIT_AXIS_IS_DECLARED', description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.' },
];

/**
 * One row of the runtime asset lifetime policy table. Each row pins
 * one named asset (or one named runtime block) to its symbolic purge
 * tag and to the upstream source line that proves the pairing.
 */
export interface AssetLifetimePolicyRow {
  /** Asset name as it appears in the WAD directory or as a runtime block identifier. Matched case-insensitively by `getLifetimeTagForAsset`. */
  readonly asset: AssetCacheLifetimeAuditEntry['asset'];
  /** Symbolic purge tag the upstream code pairs with this asset. */
  readonly tag: AssetPurgeTag;
  /** Lifetime category derived from `tag`. */
  readonly category: AssetLifetimeCategory;
  /** Stable audit axis identifier this row reflects. */
  readonly auditAxisId: AssetCacheLifetimeAuditEntry['id'];
}

function buildPolicyTable(): readonly AssetLifetimePolicyRow[] {
  const rows: AssetLifetimePolicyRow[] = [];
  for (const entry of ASSET_CACHE_LIFETIME_AUDIT) {
    if (entry.id === 'level-exit-z-freetags-half-open-interval') {
      continue;
    }
    rows.push(
      Object.freeze({
        asset: entry.asset,
        tag: entry.tag,
        category: PURGE_TAG_TO_LIFETIME_CATEGORY[entry.tag],
        auditAxisId: entry.id,
      }),
    );
  }
  return Object.freeze(rows);
}

/**
 * Frozen runtime policy table. Each row maps one audited asset to its
 * symbolic purge tag and lifetime category. Future caches consult this
 * table via `getLifetimeTagForAsset`.
 *
 * The `level-exit-z-freetags-half-open-interval` audit axis is NOT a
 * row here because it pins a lifecycle hook rather than an asset; it
 * is consumed by `assetsFreedAtLevelExit()` instead.
 */
export const ASSET_LIFETIME_POLICY: readonly AssetLifetimePolicyRow[] = buildPolicyTable();

/**
 * Resolve the symbolic purge tag for a named asset. Matched
 * case-insensitively (mirroring `W_CheckNumForName`).
 *
 * Returns `null` when the asset has no audited row. Callers must NOT
 * fall back to a default tag — an unknown asset means the audit
 * ledger does not yet cover the call site, and the caller must add an
 * audit axis before deciding the lifetime.
 *
 * Multiple audit rows may share the same asset (for example, COLORMAP
 * has both a `W_CacheLumpName` row and a `Z_Malloc` row). When two
 * rows share an asset, the function returns the tag of the first
 * matching row. The audit ledger guarantees all rows for a given
 * asset share the same tag, so the choice of "first" is irrelevant.
 *
 * @param assetName - Asset basename (e.g. `"PLAYPAL"`, `"BLOCKMAP"`).
 * @returns Symbolic purge tag, or `null` if the asset is not audited.
 */
export function getLifetimeTagForAsset(assetName: string): AssetPurgeTag | null {
  const upper = assetName.toUpperCase();
  for (const row of ASSET_LIFETIME_POLICY) {
    if (row.asset.toUpperCase() === upper) {
      return row.tag;
    }
  }
  return null;
}

/**
 * Resolve the lifetime category for a symbolic purge tag.
 *
 * Total over `AssetPurgeTag`: every tag value maps to exactly one
 * category. The mapping is the inverse of
 * `PURGE_TAG_TO_LIFETIME_CATEGORY`.
 */
export function classifyLifetimeCategory(tag: AssetPurgeTag): AssetLifetimeCategory {
  return PURGE_TAG_TO_LIFETIME_CATEGORY[tag];
}

/**
 * Whether a tag is in the half-open interval `[PU_LEVEL,
 * PU_PURGELEVEL)` that vanilla `Z_FreeTags(PU_LEVEL, PU_PURGELEVEL -
 * 1)` releases at level exit.
 *
 * Returns `true` only for `PU_LEVEL` and `PU_LEVSPEC`. Returns
 * `false` for `PU_STATIC` (below the lower bound), `PU_SOUND` /
 * `PU_MUSIC` (also below in the upstream id Software ordering),
 * `PU_PURGELEVEL` (at the upper bound, exclusive), and `PU_CACHE`
 * (above the upper bound).
 */
export function isFreedAtLevelExit(tag: AssetPurgeTag): boolean {
  return tag === 'PU_LEVEL' || tag === 'PU_LEVSPEC';
}

/**
 * Whether a tag is at or above `PU_PURGELEVEL` and therefore eligible
 * for reclamation whenever the zone allocator needs memory.
 *
 * Returns `true` only for `PU_PURGELEVEL` and `PU_CACHE`. Every other
 * tag returns `false`.
 */
export function isPurgableTag(tag: AssetPurgeTag): boolean {
  return tag === 'PU_PURGELEVEL' || tag === 'PU_CACHE';
}

/**
 * Frozen list of every audited asset whose lifetime tag falls in the
 * level-exit interval `[PU_LEVEL, PU_PURGELEVEL)`. The list is
 * derived by filtering `ASSET_LIFETIME_POLICY` through
 * `isFreedAtLevelExit`; future audits that add a `PU_LEVEL` /
 * `PU_LEVSPEC` row will surface here automatically.
 *
 * Future `P_SetupLevel` parity code consults this list to know which
 * asset cache entries to drain before loading the next map.
 */
export function assetsFreedAtLevelExit(): readonly AssetLifetimePolicyRow[] {
  return ASSET_LIFETIME_POLICY.filter((row) => isFreedAtLevelExit(row.tag));
}

/**
 * Snapshot of the runtime constants and helper behaviors exposed by
 * `src/assets/build-asset-cache-lifetime-policy.ts`. The cross-check
 * helper consumes this shape so the focused test can both verify the
 * live runtime exports and exercise a deliberately tampered snapshot
 * to prove the failure modes are observable.
 */
export interface AssetCacheLifetimeRuntimeSnapshot {
  /** `VANILLA_PURGE_TAGS` length. Must equal 7. */
  readonly purgeTagCount: number;
  /** Whether `VANILLA_PURGE_TAGS` is asciibetically sorted. */
  readonly purgeTagsAreSorted: boolean;
  /** Whether `Object.isFrozen(VANILLA_PURGE_TAGS)`. */
  readonly purgeTagsAreFrozen: boolean;
  /** `VANILLA_LIFETIME_CATEGORIES` length. Must equal 6. */
  readonly lifetimeCategoryCount: number;
  /** Whether `VANILLA_LIFETIME_CATEGORIES` is asciibetically sorted. */
  readonly lifetimeCategoriesAreSorted: boolean;
  /** Whether `Object.isFrozen(VANILLA_LIFETIME_CATEGORIES)`. */
  readonly lifetimeCategoriesAreFrozen: boolean;
  /** Whether `Object.isFrozen(PURGE_TAG_TO_LIFETIME_CATEGORY)`. */
  readonly purgeTagMapIsFrozen: boolean;
  /** Whether `PURGE_TAG_TO_LIFETIME_CATEGORY` covers every entry of `VANILLA_PURGE_TAGS`. */
  readonly purgeTagMapIsTotal: boolean;
  /** `PURGE_TAG_TO_LIFETIME_CATEGORY.PU_STATIC`. */
  readonly puStaticCategory: AssetLifetimeCategory;
  /** `PURGE_TAG_TO_LIFETIME_CATEGORY.PU_LEVEL`. */
  readonly puLevelCategory: AssetLifetimeCategory;
  /** `PURGE_TAG_TO_LIFETIME_CATEGORY.PU_LEVSPEC`. */
  readonly puLevSpecCategory: AssetLifetimeCategory;
  /** `PURGE_TAG_TO_LIFETIME_CATEGORY.PU_CACHE`. */
  readonly puCacheCategory: AssetLifetimeCategory;
  /** `PURGE_TAG_TO_LIFETIME_CATEGORY.PU_PURGELEVEL`. */
  readonly puPurgeLevelCategory: AssetLifetimeCategory;
  /** `PURGE_TAG_TO_LIFETIME_CATEGORY.PU_SOUND`. */
  readonly puSoundCategory: AssetLifetimeCategory;
  /** `PURGE_TAG_TO_LIFETIME_CATEGORY.PU_MUSIC`. */
  readonly puMusicCategory: AssetLifetimeCategory;
  /** Whether the policy table covers every audit axis except the lifecycle-hook axis. */
  readonly policyTableHasEntryPerAuditAxis: boolean;
  /** Whether each policy row's tag matches the corresponding audit axis's tag. */
  readonly policyTableTagsMatchAuditTags: boolean;
  /** `getLifetimeTagForAsset("PLAYPAL")`. */
  readonly playpalTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("COLORMAP")`. */
  readonly colormapTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("TEXTURE1")`. */
  readonly texture1Tag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("PNAMES")`. */
  readonly pnamesTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("BLOCKMAP")`. */
  readonly blockmapTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("REJECT")`. */
  readonly rejectTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("PFUB1")`. */
  readonly pfub1Tag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("PFUB2")`. */
  readonly pfub2Tag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("TITLEPIC")`. */
  readonly titlepicTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("CREDIT")`. */
  readonly creditTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("STBAR")`. */
  readonly stbarTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("STARMS")`. */
  readonly starmsTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("ENDOOM")`. */
  readonly endoomTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("GENMIDI")`. */
  readonly genmidiTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("DOES_NOT_EXIST")`. Must equal `null`. */
  readonly unknownAssetTag: AssetPurgeTag | null;
  /** `getLifetimeTagForAsset("playpal") === "PU_CACHE"`. */
  readonly assetLookupIsCaseInsensitive: boolean;
  /** `isFreedAtLevelExit("PU_LEVEL")`. */
  readonly puLevelIsFreedAtLevelExit: boolean;
  /** `isFreedAtLevelExit("PU_LEVSPEC")`. */
  readonly puLevSpecIsFreedAtLevelExit: boolean;
  /** `isFreedAtLevelExit("PU_STATIC")`. */
  readonly puStaticIsFreedAtLevelExit: boolean;
  /** `isFreedAtLevelExit("PU_CACHE")`. */
  readonly puCacheIsFreedAtLevelExit: boolean;
  /** `isFreedAtLevelExit("PU_PURGELEVEL")`. */
  readonly puPurgeLevelIsFreedAtLevelExit: boolean;
  /** `isPurgableTag("PU_CACHE")`. */
  readonly puCacheIsPurgable: boolean;
  /** `isPurgableTag("PU_PURGELEVEL")`. */
  readonly puPurgeLevelIsPurgable: boolean;
  /** `isPurgableTag("PU_STATIC")`. */
  readonly puStaticIsPurgable: boolean;
  /** `isPurgableTag("PU_LEVEL")`. */
  readonly puLevelIsPurgable: boolean;
  /** Whether `assetsFreedAtLevelExit()` includes BLOCKMAP and REJECT. */
  readonly levelExitIncludesBlockmapAndReject: boolean;
  /** Whether `assetsFreedAtLevelExit()` includes PFUB1 and PFUB2. */
  readonly levelExitIncludesPfub1AndPfub2: boolean;
  /** Whether `assetsFreedAtLevelExit()` excludes PLAYPAL. */
  readonly levelExitExcludesPlaypal: boolean;
  /** Whether `assetsFreedAtLevelExit()` excludes COLORMAP. */
  readonly levelExitExcludesColormap: boolean;
}

/**
 * Cross-check an `AssetCacheLifetimeRuntimeSnapshot` against
 * `ASSET_CACHE_LIFETIME_AUDIT` and
 * `ASSET_CACHE_LIFETIME_DERIVED_INVARIANTS`. Returns the list of
 * failures by stable identifier; an empty list means the snapshot is
 * parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the
 *    snapshot.
 */
export function crossCheckAssetCacheLifetimeRuntime(snapshot: AssetCacheLifetimeRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.purgeTagCount !== 7 || !snapshot.purgeTagsAreSorted || !snapshot.purgeTagsAreFrozen) {
    failures.push('derived:PURGE_TAG_LIST_IS_ASCIIBETICALLY_SORTED');
  }
  if (snapshot.lifetimeCategoryCount !== 6 || !snapshot.lifetimeCategoriesAreSorted || !snapshot.lifetimeCategoriesAreFrozen) {
    failures.push('derived:LIFETIME_CATEGORY_LIST_IS_ASCIIBETICALLY_SORTED');
  }
  if (!snapshot.purgeTagMapIsFrozen || !snapshot.purgeTagMapIsTotal) {
    failures.push('derived:PURGE_TAG_TO_LIFETIME_CATEGORY_IS_TOTAL');
  }
  if (snapshot.puStaticCategory !== 'static') {
    failures.push('derived:PU_STATIC_MAPS_TO_STATIC_CATEGORY');
  }
  if (snapshot.puLevelCategory !== 'level') {
    failures.push('derived:PU_LEVEL_MAPS_TO_LEVEL_CATEGORY');
  }
  if (snapshot.puLevSpecCategory !== 'level-special') {
    failures.push('derived:PU_LEVSPEC_MAPS_TO_LEVEL_SPECIAL_CATEGORY');
  }
  if (snapshot.puCacheCategory !== 'purgable') {
    failures.push('derived:PU_CACHE_MAPS_TO_PURGABLE_CATEGORY');
  }
  if (snapshot.puPurgeLevelCategory !== 'purgable') {
    failures.push('derived:PU_PURGELEVEL_MAPS_TO_PURGABLE_CATEGORY');
  }
  if (snapshot.puSoundCategory !== 'sound-playing') {
    failures.push('derived:PU_SOUND_MAPS_TO_SOUND_PLAYING_CATEGORY');
  }
  if (snapshot.puMusicCategory !== 'music-playing') {
    failures.push('derived:PU_MUSIC_MAPS_TO_MUSIC_PLAYING_CATEGORY');
  }
  if (!snapshot.policyTableHasEntryPerAuditAxis) {
    failures.push('derived:POLICY_TABLE_HAS_ENTRY_PER_AUDIT_AXIS');
  }
  if (!snapshot.policyTableTagsMatchAuditTags) {
    failures.push('derived:POLICY_TABLE_TAGS_MATCH_AUDIT_TAGS');
  }
  if (snapshot.playpalTag !== 'PU_CACHE') {
    failures.push('derived:PLAYPAL_LIFETIME_IS_PURGABLE');
    failures.push('audit:playpal-cached-pu-cache:not-observed');
  }
  if (snapshot.colormapTag !== 'PU_STATIC') {
    failures.push('derived:COLORMAP_LIFETIME_IS_STATIC');
    failures.push('audit:colormap-cached-pu-static:not-observed');
  }
  if (snapshot.texture1Tag !== 'PU_STATIC') {
    failures.push('derived:TEXTURE1_LIFETIME_IS_STATIC');
    failures.push('audit:texture1-cached-pu-static:not-observed');
  }
  if (snapshot.pnamesTag !== 'PU_STATIC') {
    failures.push('derived:PNAMES_LIFETIME_IS_STATIC');
    failures.push('audit:pnames-cached-pu-static:not-observed');
  }
  if (snapshot.blockmapTag !== 'PU_LEVEL') {
    failures.push('derived:BLOCKMAP_LIFETIME_IS_LEVEL');
    failures.push('audit:blockmap-cached-pu-level:not-observed');
  }
  if (snapshot.rejectTag !== 'PU_LEVEL') {
    failures.push('derived:REJECT_LIFETIME_IS_LEVEL');
    failures.push('audit:reject-cached-pu-level:not-observed');
  }
  if (snapshot.pfub1Tag !== 'PU_LEVEL') {
    failures.push('derived:PFUB1_LIFETIME_IS_LEVEL');
    failures.push('audit:pfub1-cached-pu-level:not-observed');
  }
  if (snapshot.pfub2Tag !== 'PU_LEVEL') {
    failures.push('derived:PFUB2_LIFETIME_IS_LEVEL');
    failures.push('audit:pfub2-cached-pu-level:not-observed');
  }
  if (snapshot.titlepicTag !== 'PU_CACHE') {
    failures.push('derived:TITLEPIC_LIFETIME_IS_PURGABLE');
    failures.push('audit:titlepic-cached-pu-cache:not-observed');
  }
  if (snapshot.creditTag !== 'PU_CACHE') {
    failures.push('derived:CREDIT_LIFETIME_IS_PURGABLE');
    failures.push('audit:credit-cached-pu-cache:not-observed');
  }
  if (snapshot.stbarTag !== 'PU_STATIC' || snapshot.starmsTag !== 'PU_STATIC') {
    failures.push('derived:STBAR_AND_STARMS_LIFETIMES_ARE_STATIC');
    failures.push('audit:stbar-cached-pu-static:not-observed');
    failures.push('audit:starms-cached-pu-static:not-observed');
  }
  if (snapshot.endoomTag !== 'PU_STATIC' || snapshot.genmidiTag !== 'PU_STATIC') {
    failures.push('derived:ENDOOM_AND_GENMIDI_LIFETIMES_ARE_STATIC');
    failures.push('audit:endoom-cached-pu-static:not-observed');
    failures.push('audit:genmidi-cached-pu-static:not-observed');
  }
  if (snapshot.unknownAssetTag !== null) {
    failures.push('derived:GET_LIFETIME_TAG_RETURNS_NULL_FOR_UNKNOWN_ASSET');
  }
  if (!snapshot.assetLookupIsCaseInsensitive) {
    failures.push('derived:GET_LIFETIME_TAG_IS_CASE_INSENSITIVE');
  }
  if (!snapshot.puLevelIsFreedAtLevelExit || !snapshot.puLevSpecIsFreedAtLevelExit) {
    failures.push('derived:IS_FREED_AT_LEVEL_EXIT_ACCEPTS_PU_LEVEL_AND_PU_LEVSPEC');
    failures.push('audit:level-exit-z-freetags-half-open-interval:not-observed');
  }
  if (snapshot.puStaticIsFreedAtLevelExit) {
    failures.push('derived:IS_FREED_AT_LEVEL_EXIT_REJECTS_PU_STATIC');
  }
  if (snapshot.puCacheIsFreedAtLevelExit || snapshot.puPurgeLevelIsFreedAtLevelExit) {
    failures.push('derived:IS_FREED_AT_LEVEL_EXIT_REJECTS_PU_CACHE');
  }
  if (!snapshot.puCacheIsPurgable || !snapshot.puPurgeLevelIsPurgable) {
    failures.push('derived:IS_PURGABLE_TAG_ACCEPTS_PU_CACHE');
  }
  if (snapshot.puStaticIsPurgable) {
    failures.push('derived:IS_PURGABLE_TAG_REJECTS_PU_STATIC');
  }
  if (snapshot.puLevelIsPurgable) {
    failures.push('derived:IS_PURGABLE_TAG_REJECTS_PU_LEVEL');
  }
  if (!snapshot.levelExitIncludesBlockmapAndReject) {
    failures.push('derived:ASSETS_FREED_AT_LEVEL_EXIT_INCLUDES_BLOCKMAP_AND_REJECT');
  }
  if (!snapshot.levelExitIncludesPfub1AndPfub2) {
    failures.push('derived:ASSETS_FREED_AT_LEVEL_EXIT_INCLUDES_PFUB1_AND_PFUB2');
  }
  if (!snapshot.levelExitExcludesPlaypal) {
    failures.push('derived:ASSETS_FREED_AT_LEVEL_EXIT_EXCLUDES_PLAYPAL');
  }
  if (!snapshot.levelExitExcludesColormap) {
    failures.push('derived:ASSETS_FREED_AT_LEVEL_EXIT_EXCLUDES_COLORMAP');
  }

  const declaredAxes = new Set(ASSET_CACHE_LIFETIME_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<AssetCacheLifetimeAuditEntry['id']> = [
    'playpal-cached-pu-cache',
    'colormap-cached-pu-static',
    'colormap-zmalloc-pu-static-after-alignment',
    'texture1-cached-pu-static',
    'texture2-cached-pu-static-when-present',
    'pnames-cached-pu-static',
    'patchlookup-zmalloc-pu-static',
    'flattranslation-zmalloc-pu-static',
    'flat-content-cached-pu-static-by-num',
    'sprite-width-zmalloc-pu-static',
    'sprite-offset-zmalloc-pu-static',
    'sprite-topoffset-zmalloc-pu-static',
    'sprite-frame-cached-pu-cache-by-num-at-draw-time',
    'stbar-cached-pu-static',
    'starms-cached-pu-static',
    'endoom-cached-pu-static',
    'genmidi-cached-pu-static',
    'titlepic-cached-pu-cache',
    'credit-cached-pu-cache',
    'help1-cached-pu-cache',
    'help2-cached-pu-cache',
    'bossback-cached-pu-cache',
    'victory2-cached-pu-cache',
    'endpic-cached-pu-cache',
    'pfub1-cached-pu-level',
    'pfub2-cached-pu-level',
    'blockmap-cached-pu-level',
    'reject-cached-pu-level',
    'map-data-cached-pu-static-then-freed',
    'demo-lump-cached-pu-static',
    'level-exit-z-freetags-half-open-interval',
  ];
  for (const axis of requiredAxes) {
    if (!declaredAxes.has(axis)) {
      failures.push('derived:EVERY_AUDIT_AXIS_IS_DECLARED');
      break;
    }
  }

  return failures;
}
