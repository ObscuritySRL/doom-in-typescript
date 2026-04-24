/**
 * UI font and patch asset manifest.
 *
 * Enumerates every lump the vanilla Doom front-end, status bar,
 * intermission, and menu code path reads directly from the IWAD. The
 * names, counts, and face-state encoding reproduce Chocolate Doom 2.2.1
 * `hu_stuff.c`, `hu_lib.c`, `st_stuff.c`, `m_menu.c`, `wi_stuff.c`, and
 * `d_main.c` for DOOM1.WAD (shareware).
 *
 * Three layers are exported:
 *
 *  1. **Constants** — `HU_FONT_*`, `ST_*FACES`, `ST_FACESTRIDE`, etc.
 *     These match `hu_stuff.h` (`HU_FONTSTART` = `'!'`, `HU_FONTEND` =
 *     `'_'`, `HU_FONTSIZE` = 63) and the face constants in `st_stuff.c`
 *     (`ST_NUMPAINFACES` = 5, `ST_FACESTRIDE` = 8, `ST_NUMFACES` = 42).
 *  2. **Lump-name generators** — `huFontLumpName`, `statusBarFaceLumpName`,
 *     `intermissionAnimationLump`, `intermissionLevelNameLump`. Each
 *     reproduces the exact `DEH_snprintf` format vanilla uses so the
 *     resulting names match the names shipped in DOOM1.WAD byte-for-byte.
 *  3. **Static catalogs** — `MENU_ASSET_LUMPS`, `STATUS_BAR_*`,
 *     `INTERMISSION_*`, `FRONT_END_*`. Frozen string arrays listing every
 *     shareware-safe asset the front-end loads directly by name.
 *
 * `resolveUiAssetLumps(directory)` rolls the catalogs up against a WAD
 * directory and returns a frozen summary with directory indices and a
 * `missing` list. Retail-only lumps (e.g. `M_EPI4`) are explicitly not in
 * the shareware catalog.
 *
 * @example
 * ```ts
 * import {
 *   HU_FONT_SIZE,
 *   buildHudFontLumpList,
 *   buildStatusBarFaceLumpList,
 *   resolveUiAssetLumps,
 * } from "../src/ui/assets.ts";
 *
 * const fontLumps = buildHudFontLumpList();   // length 63
 * const faceLumps = buildStatusBarFaceLumpList(); // length 42
 * const catalog = resolveUiAssetLumps(directory);
 * console.log(catalog.missing);               // []
 * ```
 */

import type { DirectoryEntry } from '../wad/directory.ts';

/** First ASCII code in the HUD font range (`'!'`). Matches `HU_FONTSTART`. */
export const HU_FONT_START_CHAR = 0x21;

/** Last ASCII code in the HUD font range (`'_'`). Matches `HU_FONTEND`. */
export const HU_FONT_END_CHAR = 0x5f;

/** Number of glyphs in the HUD font (inclusive range). Matches `HU_FONTSIZE`. */
export const HU_FONT_SIZE = HU_FONT_END_CHAR - HU_FONT_START_CHAR + 1;

/** Common prefix for every HUD font lump name. */
export const HU_FONT_LUMP_PREFIX = 'STCFN';

/**
 * ASCII code for the extra HUD font lump shipped in DOOM1.WAD outside the
 * canonical range. `STCFN121` is the lowercase `'y'` glyph that the
 * quit-confirmation prompt renders when the randomized quit message
 * contains literal "yes/no" text. Retained here so callers can verify the
 * WAD ships the glyph even though the `HU_FONTSTART`..`HU_FONTEND` range
 * does not include it.
 */
export const HU_FONT_EXTRA_Y_CHAR = 0x79;

/** Lump name for the extra lowercase `'y'` HUD font glyph. */
export const HU_FONT_EXTRA_Y_LUMP = 'STCFN121';

/** Number of pain levels the status bar face animates through. */
export const ST_NUMPAINFACES = 5;

/** Number of straight-facing face variants per pain level (random-cycled). */
export const ST_NUMSTRAIGHTFACES = 3;

/** Number of turn (left/right) face variants per pain level. */
export const ST_NUMTURNFACES = 2;

/** Number of special-reaction face variants per pain level (ouch, evil, rampage). */
export const ST_NUMSPECIALFACES = 3;

/** Total face variants per pain level (3 straight + 2 turn + 3 special = 8). */
export const ST_FACESTRIDE = ST_NUMSTRAIGHTFACES + ST_NUMTURNFACES + ST_NUMSPECIALFACES;

/** Extra faces appended after the per-pain-level block (god, dead). */
export const ST_NUMEXTRAFACES = 2;

/** Total number of status bar face sprites (5 × 8 + 2 = 42). */
export const ST_NUMFACES = ST_FACESTRIDE * ST_NUMPAINFACES + ST_NUMEXTRAFACES;

/** Index of the invulnerability `STFGOD0` face inside the face table. */
export const ST_GODFACE_INDEX = ST_FACESTRIDE * ST_NUMPAINFACES;

/** Index of the `STFDEAD0` face inside the face table. */
export const ST_DEADFACE_INDEX = ST_GODFACE_INDEX + 1;

/** Vanilla lump name for the invulnerability `god` face. */
export const ST_GOD_FACE_LUMP = 'STFGOD0';

/** Vanilla lump name for the player-dead face. */
export const ST_DEAD_FACE_LUMP = 'STFDEAD0';

/**
 * State index within a single pain level of the status bar face table.
 *
 * The eight values match the order vanilla populates `faces[]` in
 * `ST_loadGraphics`:
 *
 *  - 0..2: `STFST<p>0`..`STFST<p>2` — straight-facing random cycle.
 *  - 3:    `STFTR<p>0`              — turn right.
 *  - 4:    `STFTL<p>0`              — turn left.
 *  - 5:    `STFOUCH<p>`             — ouch (taking damage from behind).
 *  - 6:    `STFEVL<p>`              — evil grin (picked up a weapon).
 *  - 7:    `STFKILL<p>`             — rampage (shooting continuously).
 */
export enum FaceStateKind {
  Straight0 = 0,
  Straight1 = 1,
  Straight2 = 2,
  TurnRight = 3,
  TurnLeft = 4,
  Ouch = 5,
  EvilGrin = 6,
  Rampage = 7,
}

/**
 * Generate the HUD font lump name for the given ASCII code.
 *
 * Vanilla stores each glyph as `STCFN` plus the decimal ASCII code
 * zero-padded to exactly 3 digits, so the caller is responsible for
 * keeping `charCode` inside the 8-bit range.
 *
 * @throws {RangeError} If `charCode` is not an integer in `[0, 255]`.
 */
export function huFontLumpName(charCode: number): string {
  if (!Number.isInteger(charCode) || charCode < 0 || charCode > 255) {
    throw new RangeError(`huFontLumpName: charCode must be 0..255, got ${charCode}`);
  }
  return `${HU_FONT_LUMP_PREFIX}${charCode.toString().padStart(3, '0')}`;
}

/**
 * Generate the status bar face lump name for a `(painIndex, stateIndex)`
 * pair, reproducing the `DEH_snprintf` formats used in `st_stuff.c`.
 *
 * @throws {RangeError} If `painIndex` is outside `[0, ST_NUMPAINFACES)` or
 *   `stateIndex` is outside `[0, ST_FACESTRIDE)`.
 */
export function statusBarFaceLumpName(painIndex: number, stateIndex: number): string {
  if (!Number.isInteger(painIndex) || painIndex < 0 || painIndex >= ST_NUMPAINFACES) {
    throw new RangeError(`statusBarFaceLumpName: painIndex must be 0..${ST_NUMPAINFACES - 1}, got ${painIndex}`);
  }
  if (!Number.isInteger(stateIndex) || stateIndex < 0 || stateIndex >= ST_FACESTRIDE) {
    throw new RangeError(`statusBarFaceLumpName: stateIndex must be 0..${ST_FACESTRIDE - 1}, got ${stateIndex}`);
  }
  if (stateIndex < ST_NUMSTRAIGHTFACES) {
    return `STFST${painIndex}${stateIndex}`;
  }
  switch (stateIndex) {
    case FaceStateKind.TurnRight:
      return `STFTR${painIndex}0`;
    case FaceStateKind.TurnLeft:
      return `STFTL${painIndex}0`;
    case FaceStateKind.Ouch:
      return `STFOUCH${painIndex}`;
    case FaceStateKind.EvilGrin:
      return `STFEVL${painIndex}`;
    case FaceStateKind.Rampage:
      return `STFKILL${painIndex}`;
    default:
      throw new RangeError(`statusBarFaceLumpName: unreachable stateIndex ${stateIndex}`);
  }
}

/**
 * Build the full 42-entry status bar face lump list in the exact order
 * vanilla writes into `faces[]` in `ST_loadGraphics`.
 */
export function buildStatusBarFaceLumpList(): readonly string[] {
  const names: string[] = new Array(ST_NUMFACES);
  let cursor = 0;
  for (let p = 0; p < ST_NUMPAINFACES; p++) {
    for (let s = 0; s < ST_FACESTRIDE; s++) {
      names[cursor++] = statusBarFaceLumpName(p, s);
    }
  }
  names[cursor++] = ST_GOD_FACE_LUMP;
  names[cursor++] = ST_DEAD_FACE_LUMP;
  return Object.freeze(names);
}

/**
 * Build the full 63-entry HUD font lump list covering
 * `HU_FONTSTART`..`HU_FONTEND` (`'!'`..`'_'`).
 */
export function buildHudFontLumpList(): readonly string[] {
  const names: string[] = new Array(HU_FONT_SIZE);
  for (let i = 0; i < HU_FONT_SIZE; i++) {
    names[i] = huFontLumpName(HU_FONT_START_CHAR + i);
  }
  return Object.freeze(names);
}

/**
 * Generate the intermission level-name lump (`WILV<e><m>`) for a given
 * 1-based Doom episode and map. Shareware only ships `WILV00`..`WILV08`
 * (E1M1..E1M9); retail adds `WILV10`..`WILV18` and `WILV20`..`WILV28`.
 *
 * @throws {RangeError} If `episode` is outside `[1, 3]` or `map` is
 *   outside `[1, 9]`.
 */
export function intermissionLevelNameLump(episode: number, map: number): string {
  if (!Number.isInteger(episode) || episode < 1 || episode > 3) {
    throw new RangeError(`intermissionLevelNameLump: episode must be 1..3, got ${episode}`);
  }
  if (!Number.isInteger(map) || map < 1 || map > 9) {
    throw new RangeError(`intermissionLevelNameLump: map must be 1..9, got ${map}`);
  }
  return `WILV${episode - 1}${map - 1}`;
}

/**
 * Generate an intermission animation frame lump
 * (`WIA<epsd><location(2)><frame(2)>`) matching the `DEH_snprintf` format
 * used in `wi_stuff.c` `WI_loadData`. DOOM1.WAD ships 30 frames for the
 * E1 intermission map (`WIA00000`..`WIA00902`, 10 locations × 3 frames).
 *
 * @param zeroBasedEpisode - `0` for E1, `1` for E2, `2` for E3.
 * @param location         - Animation slot on the background map (0..99).
 * @param frame            - Frame within that animation (0..99).
 * @throws {RangeError}    - If any argument is outside its supported range.
 */
export function intermissionAnimationLump(zeroBasedEpisode: number, location: number, frame: number): string {
  if (!Number.isInteger(zeroBasedEpisode) || zeroBasedEpisode < 0 || zeroBasedEpisode > 2) {
    throw new RangeError(`intermissionAnimationLump: zeroBasedEpisode must be 0..2, got ${zeroBasedEpisode}`);
  }
  if (!Number.isInteger(location) || location < 0 || location > 99) {
    throw new RangeError(`intermissionAnimationLump: location must be 0..99, got ${location}`);
  }
  if (!Number.isInteger(frame) || frame < 0 || frame > 99) {
    throw new RangeError(`intermissionAnimationLump: frame must be 0..99, got ${frame}`);
  }
  return `WIA${zeroBasedEpisode}${location.toString().padStart(2, '0')}${frame.toString().padStart(2, '0')}`;
}

/**
 * Menu graphic lumps (M_* prefix) referenced directly by `m_menu.c`
 * draw routines on shareware DOOM1.WAD. `M_EPI4` (Ultimate Doom) is
 * deliberately omitted because it is retail-only.
 */
export const MENU_ASSET_LUMPS: readonly string[] = Object.freeze([
  'M_DOOM',
  'M_SKULL1',
  'M_SKULL2',
  'M_NGAME',
  'M_OPTION',
  'M_LOADG',
  'M_SAVEG',
  'M_RDTHIS',
  'M_QUITG',
  'M_NEWG',
  'M_SKILL',
  'M_EPISOD',
  'M_EPI1',
  'M_EPI2',
  'M_EPI3',
  'M_JKILL',
  'M_ROUGH',
  'M_HURT',
  'M_ULTRA',
  'M_NMARE',
  'M_OPTTTL',
  'M_MESSG',
  'M_MSGOFF',
  'M_MSGON',
  'M_MSENS',
  'M_DETAIL',
  'M_GDHIGH',
  'M_GDLOW',
  'M_DISP',
  'M_DISOPT',
  'M_SCRNSZ',
  'M_SVOL',
  'M_SFXVOL',
  'M_MUSVOL',
  'M_ENDGAM',
  'M_PAUSE',
  'M_THERML',
  'M_THERMM',
  'M_THERMR',
  'M_THERMO',
  'M_LSLEFT',
  'M_LSCNTR',
  'M_LSRGHT',
  'M_LGTTL',
  'M_SGTTL',
]);

/** `STTNUM0`..`STTNUM9` — the big red status bar numbers (health, armor, ammo). */
export const STATUS_BAR_BIG_RED_NUMBER_LUMPS: readonly string[] = Object.freeze(['STTNUM0', 'STTNUM1', 'STTNUM2', 'STTNUM3', 'STTNUM4', 'STTNUM5', 'STTNUM6', 'STTNUM7', 'STTNUM8', 'STTNUM9']);

/** Big red minus glyph used when `health` dips below zero in cheat tests. */
export const STATUS_BAR_BIG_RED_MINUS_LUMP = 'STTMINUS';

/** Big red percent glyph rendered after health/armor readouts. */
export const STATUS_BAR_BIG_RED_PERCENT_LUMP = 'STTPRCNT';

/** `STYSNUM0`..`STYSNUM9` — the small yellow ammo-box numbers. */
export const STATUS_BAR_SMALL_YELLOW_NUMBER_LUMPS: readonly string[] = Object.freeze(['STYSNUM0', 'STYSNUM1', 'STYSNUM2', 'STYSNUM3', 'STYSNUM4', 'STYSNUM5', 'STYSNUM6', 'STYSNUM7', 'STYSNUM8', 'STYSNUM9']);

/** `STGNUM0`..`STGNUM9` — the small grey weapon-slot numbers. */
export const STATUS_BAR_SMALL_GREY_NUMBER_LUMPS: readonly string[] = Object.freeze(['STGNUM0', 'STGNUM1', 'STGNUM2', 'STGNUM3', 'STGNUM4', 'STGNUM5', 'STGNUM6', 'STGNUM7', 'STGNUM8', 'STGNUM9']);

/** Background plate `STBAR` drawn beneath every status bar widget. */
export const STATUS_BAR_BACKGROUND_LUMP = 'STBAR';

/** `STARMS` — slot 2..7 weapon-chart overlay used when no keys are shown. */
export const STATUS_BAR_ARMS_LUMP = 'STARMS';

/** `STKEYS0`..`STKEYS5` — keycard and skull key icons. */
export const STATUS_BAR_KEY_LUMPS: readonly string[] = Object.freeze(['STKEYS0', 'STKEYS1', 'STKEYS2', 'STKEYS3', 'STKEYS4', 'STKEYS5']);

/** `STFB0`..`STFB3` — per-player face background color remaps for deathmatch. */
export const STATUS_BAR_FACE_BACKGROUND_LUMPS: readonly string[] = Object.freeze(['STFB0', 'STFB1', 'STFB2', 'STFB3']);

/** `WINUM0`..`WINUM9` — intermission large stat numerals. */
export const INTERMISSION_NUMBER_LUMPS: readonly string[] = Object.freeze(['WINUM0', 'WINUM1', 'WINUM2', 'WINUM3', 'WINUM4', 'WINUM5', 'WINUM6', 'WINUM7', 'WINUM8', 'WINUM9']);

/** Minus glyph used when an intermission stat is missing/negative. */
export const INTERMISSION_MINUS_LUMP = 'WIMINUS';

/** Percent glyph appended after kills/items/secrets ratios. */
export const INTERMISSION_PERCENT_LUMP = 'WIPCNT';

/** Colon glyph used in the par/total time readouts. */
export const INTERMISSION_COLON_LUMP = 'WICOLON';

/** Labels and banners the intermission screen draws verbatim. */
export const INTERMISSION_LABEL_LUMPS: readonly string[] = Object.freeze(['WIF', 'WIENTER', 'WIKILRS', 'WIVCTMS', 'WIMSTT', 'WIFRGS', 'WITIME', 'WISUCKS', 'WIPAR', 'WIOSTK', 'WIOSTS', 'WIOSTI', 'WIOSTF', 'WISCRT2', 'WIMSTAR']);

/** Per-player marker lumps for cooperative/deathmatch scoreboards. */
export const INTERMISSION_PLAYER_LUMPS: readonly string[] = Object.freeze(['WIP1', 'WIP2', 'WIP3', 'WIP4', 'WIBP1', 'WIBP2', 'WIBP3', 'WIBP4']);

/** `WIURH0`/`WIURH1` — the "You Are Here" blinking cursor frames. */
export const INTERMISSION_YOU_ARE_HERE_LUMPS: readonly string[] = Object.freeze(['WIURH0', 'WIURH1']);

/** Completed-level splat icon drawn on the E1 intermission map. */
export const INTERMISSION_SPLAT_LUMP = 'WISPLAT';

/** Episode background lumps present in DOOM1.WAD (shareware has E1 only). */
export const INTERMISSION_BACKGROUND_LUMPS: readonly string[] = Object.freeze(['WIMAP0']);

/** Shareware E1 intermission animation: 10 locations × 3 frames. */
export const INTERMISSION_E1_ANIMATION_LOCATION_COUNT = 10;

/** Frame count per animation slot on the E1 intermission map. */
export const INTERMISSION_E1_ANIMATION_FRAMES_PER_LOCATION = 3;

/** Title screen page lump shown during the demo loop. */
export const FRONT_END_TITLE_LUMP = 'TITLEPIC';

/** Credit page lump shown between demos in the vanilla demo sequence. */
export const FRONT_END_CREDIT_LUMP = 'CREDIT';

/** Help/order-info pages referenced by `M_DrawReadThis` and the demo loop. */
export const FRONT_END_HELP_LUMPS: readonly string[] = Object.freeze(['HELP1', 'HELP2']);

/** Number of directly-named UI lumps the shareware front-end must resolve. */
export const UI_ASSET_LUMP_COUNT = (function () {
  const fontCount = HU_FONT_SIZE; // 63 — STCFN033..STCFN095
  const extraFontCount = 1; // STCFN121 for the quit prompt
  const faceCount = ST_NUMFACES; // 42 — all face sprites
  const faceBackgroundCount = STATUS_BAR_FACE_BACKGROUND_LUMPS.length; // 4
  const bigRedNumberCount = STATUS_BAR_BIG_RED_NUMBER_LUMPS.length + /* minus */ 1 + /* percent */ 1; // 12
  const smallYellowCount = STATUS_BAR_SMALL_YELLOW_NUMBER_LUMPS.length; // 10
  const smallGreyCount = STATUS_BAR_SMALL_GREY_NUMBER_LUMPS.length; // 10
  const statusBarStaticCount = /* STBAR */ 1 + /* STARMS */ 1 + STATUS_BAR_KEY_LUMPS.length; // 8
  const intermissionNumberCount = INTERMISSION_NUMBER_LUMPS.length + /* minus/percent/colon */ 3; // 13
  const intermissionLabelCount = INTERMISSION_LABEL_LUMPS.length; // 15
  const intermissionPlayerCount = INTERMISSION_PLAYER_LUMPS.length; // 8
  const intermissionBannerCount = INTERMISSION_YOU_ARE_HERE_LUMPS.length + /* splat */ 1; // 3
  const intermissionBackgroundCount = INTERMISSION_BACKGROUND_LUMPS.length; // 1
  const e1LevelLabelCount = 9; // WILV00..WILV08
  const e1AnimFrameCount = INTERMISSION_E1_ANIMATION_LOCATION_COUNT * INTERMISSION_E1_ANIMATION_FRAMES_PER_LOCATION; // 30
  const menuCount = MENU_ASSET_LUMPS.length; // 45
  const frontEndPageCount = /* title + credit */ 2 + FRONT_END_HELP_LUMPS.length; // 4
  return (
    fontCount +
    extraFontCount +
    faceCount +
    faceBackgroundCount +
    bigRedNumberCount +
    smallYellowCount +
    smallGreyCount +
    statusBarStaticCount +
    intermissionNumberCount +
    intermissionLabelCount +
    intermissionPlayerCount +
    intermissionBannerCount +
    intermissionBackgroundCount +
    e1LevelLabelCount +
    e1AnimFrameCount +
    menuCount +
    frontEndPageCount
  );
})();

/** A single resolved UI asset lump with its directory index. */
export interface ResolvedUiAsset {
  /** Uppercased lump name. */
  readonly name: string;
  /** Zero-based index into the WAD directory, or `-1` if the lump is absent. */
  readonly directoryIndex: number;
  /** Category this lump belongs to for grouped presence checks. */
  readonly category: UiAssetCategory;
}

/** Logical group a UI asset belongs to. */
export type UiAssetCategory =
  | 'hudFont'
  | 'hudFontExtra'
  | 'statusBarFace'
  | 'statusBarFaceBackground'
  | 'statusBarBigRed'
  | 'statusBarSmallYellow'
  | 'statusBarSmallGrey'
  | 'statusBarStatic'
  | 'intermissionNumber'
  | 'intermissionLabel'
  | 'intermissionPlayer'
  | 'intermissionBanner'
  | 'intermissionBackground'
  | 'intermissionLevelLabel'
  | 'intermissionAnimation'
  | 'menu'
  | 'frontEndPage';

/** Rolled-up catalog of every UI asset the shareware front-end needs. */
export interface UiAssetCatalog {
  /** Every expected lump, in a stable deterministic order. */
  readonly assets: readonly ResolvedUiAsset[];
  /** Subset of `assets` that did not resolve in the provided directory. */
  readonly missing: readonly ResolvedUiAsset[];
  /** Total number of entries in `assets` (matches `UI_ASSET_LUMP_COUNT`). */
  readonly totalCount: number;
}

/**
 * Resolve every UI asset lump against the provided WAD directory.
 *
 * Lookups are case-insensitive and return the **last** directory entry
 * with the given name, matching `W_CheckNumForName`. Missing lumps are
 * surfaced through the `missing` array rather than throwing, so callers
 * can build fine-grained error reports.
 */
export function resolveUiAssetLumps(directory: readonly DirectoryEntry[]): UiAssetCatalog {
  const nameToIndex = new Map<string, number>();
  for (let i = 0; i < directory.length; i++) {
    nameToIndex.set(directory[i]!.name.toUpperCase(), i);
  }

  const assets: ResolvedUiAsset[] = [];

  const push = (name: string, category: UiAssetCategory): void => {
    const upperName = name.toUpperCase();
    const directoryIndex = nameToIndex.get(upperName) ?? -1;
    assets.push(Object.freeze({ name: upperName, directoryIndex, category }));
  };

  for (const name of buildHudFontLumpList()) {
    push(name, 'hudFont');
  }
  push(HU_FONT_EXTRA_Y_LUMP, 'hudFontExtra');

  for (const name of buildStatusBarFaceLumpList()) {
    push(name, 'statusBarFace');
  }

  for (const name of STATUS_BAR_FACE_BACKGROUND_LUMPS) {
    push(name, 'statusBarFaceBackground');
  }

  for (const name of STATUS_BAR_BIG_RED_NUMBER_LUMPS) {
    push(name, 'statusBarBigRed');
  }
  push(STATUS_BAR_BIG_RED_MINUS_LUMP, 'statusBarBigRed');
  push(STATUS_BAR_BIG_RED_PERCENT_LUMP, 'statusBarBigRed');

  for (const name of STATUS_BAR_SMALL_YELLOW_NUMBER_LUMPS) {
    push(name, 'statusBarSmallYellow');
  }

  for (const name of STATUS_BAR_SMALL_GREY_NUMBER_LUMPS) {
    push(name, 'statusBarSmallGrey');
  }

  push(STATUS_BAR_BACKGROUND_LUMP, 'statusBarStatic');
  push(STATUS_BAR_ARMS_LUMP, 'statusBarStatic');
  for (const name of STATUS_BAR_KEY_LUMPS) {
    push(name, 'statusBarStatic');
  }

  for (const name of INTERMISSION_NUMBER_LUMPS) {
    push(name, 'intermissionNumber');
  }
  push(INTERMISSION_MINUS_LUMP, 'intermissionNumber');
  push(INTERMISSION_PERCENT_LUMP, 'intermissionNumber');
  push(INTERMISSION_COLON_LUMP, 'intermissionNumber');

  for (const name of INTERMISSION_LABEL_LUMPS) {
    push(name, 'intermissionLabel');
  }

  for (const name of INTERMISSION_PLAYER_LUMPS) {
    push(name, 'intermissionPlayer');
  }

  for (const name of INTERMISSION_YOU_ARE_HERE_LUMPS) {
    push(name, 'intermissionBanner');
  }
  push(INTERMISSION_SPLAT_LUMP, 'intermissionBanner');

  for (const name of INTERMISSION_BACKGROUND_LUMPS) {
    push(name, 'intermissionBackground');
  }

  for (let map = 1; map <= 9; map++) {
    push(intermissionLevelNameLump(1, map), 'intermissionLevelLabel');
  }

  for (let location = 0; location < INTERMISSION_E1_ANIMATION_LOCATION_COUNT; location++) {
    for (let frame = 0; frame < INTERMISSION_E1_ANIMATION_FRAMES_PER_LOCATION; frame++) {
      push(intermissionAnimationLump(0, location, frame), 'intermissionAnimation');
    }
  }

  for (const name of MENU_ASSET_LUMPS) {
    push(name, 'menu');
  }

  push(FRONT_END_TITLE_LUMP, 'frontEndPage');
  push(FRONT_END_CREDIT_LUMP, 'frontEndPage');
  for (const name of FRONT_END_HELP_LUMPS) {
    push(name, 'frontEndPage');
  }

  const missing = assets.filter((entry) => entry.directoryIndex < 0);

  return Object.freeze({
    assets: Object.freeze(assets),
    missing: Object.freeze(missing),
    totalCount: assets.length,
  });
}
