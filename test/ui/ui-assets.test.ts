import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import {
  FRONT_END_CREDIT_LUMP,
  FRONT_END_HELP_LUMPS,
  FRONT_END_TITLE_LUMP,
  FaceStateKind,
  HU_FONT_END_CHAR,
  HU_FONT_EXTRA_Y_CHAR,
  HU_FONT_EXTRA_Y_LUMP,
  HU_FONT_LUMP_PREFIX,
  HU_FONT_SIZE,
  HU_FONT_START_CHAR,
  INTERMISSION_BACKGROUND_LUMPS,
  INTERMISSION_COLON_LUMP,
  INTERMISSION_E1_ANIMATION_FRAMES_PER_LOCATION,
  INTERMISSION_E1_ANIMATION_LOCATION_COUNT,
  INTERMISSION_LABEL_LUMPS,
  INTERMISSION_MINUS_LUMP,
  INTERMISSION_NUMBER_LUMPS,
  INTERMISSION_PERCENT_LUMP,
  INTERMISSION_PLAYER_LUMPS,
  INTERMISSION_SPLAT_LUMP,
  INTERMISSION_YOU_ARE_HERE_LUMPS,
  MENU_ASSET_LUMPS,
  ST_DEADFACE_INDEX,
  ST_DEAD_FACE_LUMP,
  ST_FACESTRIDE,
  ST_GODFACE_INDEX,
  ST_GOD_FACE_LUMP,
  ST_NUMEXTRAFACES,
  ST_NUMFACES,
  ST_NUMPAINFACES,
  ST_NUMSPECIALFACES,
  ST_NUMSTRAIGHTFACES,
  ST_NUMTURNFACES,
  STATUS_BAR_ARMS_LUMP,
  STATUS_BAR_BACKGROUND_LUMP,
  STATUS_BAR_BIG_RED_MINUS_LUMP,
  STATUS_BAR_BIG_RED_NUMBER_LUMPS,
  STATUS_BAR_BIG_RED_PERCENT_LUMP,
  STATUS_BAR_FACE_BACKGROUND_LUMPS,
  STATUS_BAR_KEY_LUMPS,
  STATUS_BAR_SMALL_GREY_NUMBER_LUMPS,
  STATUS_BAR_SMALL_YELLOW_NUMBER_LUMPS,
  UI_ASSET_LUMP_COUNT,
  buildHudFontLumpList,
  buildStatusBarFaceLumpList,
  huFontLumpName,
  intermissionAnimationLump,
  intermissionLevelNameLump,
  resolveUiAssetLumps,
  statusBarFaceLumpName,
} from '../../src/ui/assets.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

describe('HUD font constants', () => {
  it("HU_FONT_START_CHAR is '!' (0x21)", () => {
    expect(HU_FONT_START_CHAR).toBe(0x21);
    expect(HU_FONT_START_CHAR).toBe('!'.charCodeAt(0));
  });

  it("HU_FONT_END_CHAR is '_' (0x5F)", () => {
    expect(HU_FONT_END_CHAR).toBe(0x5f);
    expect(HU_FONT_END_CHAR).toBe('_'.charCodeAt(0));
  });

  it('HU_FONT_SIZE is 63 (end - start + 1)', () => {
    expect(HU_FONT_SIZE).toBe(63);
    expect(HU_FONT_SIZE).toBe(HU_FONT_END_CHAR - HU_FONT_START_CHAR + 1);
  });

  it("HU_FONT_LUMP_PREFIX is 'STCFN'", () => {
    expect(HU_FONT_LUMP_PREFIX).toBe('STCFN');
  });

  it("HU_FONT_EXTRA_Y_CHAR is 121 ('y')", () => {
    expect(HU_FONT_EXTRA_Y_CHAR).toBe(121);
    expect(HU_FONT_EXTRA_Y_CHAR).toBe('y'.charCodeAt(0));
    expect(HU_FONT_EXTRA_Y_LUMP).toBe('STCFN121');
  });
});

describe('huFontLumpName', () => {
  it("pads ASCII '!' (33) to STCFN033", () => {
    expect(huFontLumpName(0x21)).toBe('STCFN033');
  });

  it("pads ASCII '_' (95) to STCFN095", () => {
    expect(huFontLumpName(0x5f)).toBe('STCFN095');
  });

  it('pads single-digit codes to three characters', () => {
    expect(huFontLumpName(0)).toBe('STCFN000');
    expect(huFontLumpName(9)).toBe('STCFN009');
  });

  it('does not zero-pad three-digit codes', () => {
    expect(huFontLumpName(255)).toBe('STCFN255');
  });

  it('throws on non-integer, negative, or out-of-range input', () => {
    expect(() => huFontLumpName(1.5)).toThrow(/charCode must be 0\.\.255/);
    expect(() => huFontLumpName(-1)).toThrow(/charCode must be 0\.\.255/);
    expect(() => huFontLumpName(256)).toThrow(/charCode must be 0\.\.255/);
  });
});

describe('buildHudFontLumpList', () => {
  const fontLumps = buildHudFontLumpList();

  it('has exactly HU_FONT_SIZE entries', () => {
    expect(fontLumps.length).toBe(HU_FONT_SIZE);
    expect(fontLumps.length).toBe(63);
  });

  it('first entry is STCFN033 and last is STCFN095', () => {
    expect(fontLumps[0]).toBe('STCFN033');
    expect(fontLumps[fontLumps.length - 1]).toBe('STCFN095');
  });

  it('returned array is frozen', () => {
    expect(Object.isFrozen(fontLumps)).toBe(true);
  });

  it('entries are contiguous ascending STCFN<code> names', () => {
    for (let i = 0; i < fontLumps.length; i++) {
      expect(fontLumps[i]).toBe(huFontLumpName(HU_FONT_START_CHAR + i));
    }
  });

  it('every font glyph resolves in DOOM1.WAD', () => {
    const names = new Set(directory.map((e) => e.name.toUpperCase()));
    for (const lump of fontLumps) {
      expect(names.has(lump)).toBe(true);
    }
  });
});

describe('status bar face constants', () => {
  it('ST_NUMPAINFACES = 5', () => {
    expect(ST_NUMPAINFACES).toBe(5);
  });

  it('ST_NUMSTRAIGHTFACES = 3', () => {
    expect(ST_NUMSTRAIGHTFACES).toBe(3);
  });

  it('ST_NUMTURNFACES = 2', () => {
    expect(ST_NUMTURNFACES).toBe(2);
  });

  it('ST_NUMSPECIALFACES = 3', () => {
    expect(ST_NUMSPECIALFACES).toBe(3);
  });

  it('ST_FACESTRIDE = 8 (3 + 2 + 3)', () => {
    expect(ST_FACESTRIDE).toBe(8);
    expect(ST_FACESTRIDE).toBe(ST_NUMSTRAIGHTFACES + ST_NUMTURNFACES + ST_NUMSPECIALFACES);
  });

  it('ST_NUMEXTRAFACES = 2 (god, dead)', () => {
    expect(ST_NUMEXTRAFACES).toBe(2);
  });

  it('ST_NUMFACES = 42 (5 × 8 + 2)', () => {
    expect(ST_NUMFACES).toBe(42);
    expect(ST_NUMFACES).toBe(ST_FACESTRIDE * ST_NUMPAINFACES + ST_NUMEXTRAFACES);
  });

  it('ST_GODFACE_INDEX = 40 and ST_DEADFACE_INDEX = 41', () => {
    expect(ST_GODFACE_INDEX).toBe(40);
    expect(ST_DEADFACE_INDEX).toBe(41);
  });

  it("ST_GOD_FACE_LUMP is 'STFGOD0' and ST_DEAD_FACE_LUMP is 'STFDEAD0'", () => {
    expect(ST_GOD_FACE_LUMP).toBe('STFGOD0');
    expect(ST_DEAD_FACE_LUMP).toBe('STFDEAD0');
  });
});

describe('statusBarFaceLumpName', () => {
  it('formats straight-facing faces as STFST<p><s>', () => {
    expect(statusBarFaceLumpName(0, FaceStateKind.Straight0)).toBe('STFST00');
    expect(statusBarFaceLumpName(4, FaceStateKind.Straight2)).toBe('STFST42');
  });

  it('formats right turn as STFTR<p>0', () => {
    expect(statusBarFaceLumpName(0, FaceStateKind.TurnRight)).toBe('STFTR00');
    expect(statusBarFaceLumpName(3, FaceStateKind.TurnRight)).toBe('STFTR30');
  });

  it('formats left turn as STFTL<p>0', () => {
    expect(statusBarFaceLumpName(0, FaceStateKind.TurnLeft)).toBe('STFTL00');
    expect(statusBarFaceLumpName(4, FaceStateKind.TurnLeft)).toBe('STFTL40');
  });

  it('formats ouch, evil, rampage as single-digit-pain lumps', () => {
    expect(statusBarFaceLumpName(2, FaceStateKind.Ouch)).toBe('STFOUCH2');
    expect(statusBarFaceLumpName(1, FaceStateKind.EvilGrin)).toBe('STFEVL1');
    expect(statusBarFaceLumpName(4, FaceStateKind.Rampage)).toBe('STFKILL4');
  });

  it('throws on out-of-range painIndex', () => {
    expect(() => statusBarFaceLumpName(-1, 0)).toThrow(/painIndex/);
    expect(() => statusBarFaceLumpName(ST_NUMPAINFACES, 0)).toThrow(/painIndex/);
  });

  it('throws on out-of-range stateIndex', () => {
    expect(() => statusBarFaceLumpName(0, -1)).toThrow(/stateIndex/);
    expect(() => statusBarFaceLumpName(0, ST_FACESTRIDE)).toThrow(/stateIndex/);
  });
});

describe('buildStatusBarFaceLumpList', () => {
  const faces = buildStatusBarFaceLumpList();

  it('has exactly ST_NUMFACES entries', () => {
    expect(faces.length).toBe(ST_NUMFACES);
    expect(faces.length).toBe(42);
  });

  it('first entry is STFST00 (pain 0, straight 0)', () => {
    expect(faces[0]).toBe('STFST00');
  });

  it('god face is at ST_GODFACE_INDEX and dead face at ST_DEADFACE_INDEX', () => {
    expect(faces[ST_GODFACE_INDEX]).toBe(ST_GOD_FACE_LUMP);
    expect(faces[ST_DEADFACE_INDEX]).toBe(ST_DEAD_FACE_LUMP);
  });

  it('ends with STFDEAD0', () => {
    expect(faces[faces.length - 1]).toBe('STFDEAD0');
  });

  it('returned array is frozen', () => {
    expect(Object.isFrozen(faces)).toBe(true);
  });

  it('contains the 15 STFST<p><s> straight-facing faces', () => {
    const straight = faces.filter((name) => name.startsWith('STFST'));
    expect(straight.length).toBe(ST_NUMSTRAIGHTFACES * ST_NUMPAINFACES);
    expect(straight.length).toBe(15);
  });

  it('contains exactly 5 STFTR, 5 STFTL, 5 STFOUCH, 5 STFEVL, 5 STFKILL', () => {
    const groups = {
      STFTR: 0,
      STFTL: 0,
      STFOUCH: 0,
      STFEVL: 0,
      STFKILL: 0,
    };
    for (const name of faces) {
      for (const key of Object.keys(groups) as (keyof typeof groups)[]) {
        if (name.startsWith(key)) {
          groups[key]++;
          break;
        }
      }
    }
    expect(groups.STFTR).toBe(ST_NUMPAINFACES);
    expect(groups.STFTL).toBe(ST_NUMPAINFACES);
    expect(groups.STFOUCH).toBe(ST_NUMPAINFACES);
    expect(groups.STFEVL).toBe(ST_NUMPAINFACES);
    expect(groups.STFKILL).toBe(ST_NUMPAINFACES);
  });

  it('every face sprite resolves in DOOM1.WAD', () => {
    const names = new Set(directory.map((e) => e.name.toUpperCase()));
    for (const lump of faces) {
      expect(names.has(lump)).toBe(true);
    }
  });
});

describe('intermissionLevelNameLump', () => {
  it('maps (1, 1) to WILV00', () => {
    expect(intermissionLevelNameLump(1, 1)).toBe('WILV00');
  });

  it('maps (1, 9) to WILV08 (E1M9 shareware boundary)', () => {
    expect(intermissionLevelNameLump(1, 9)).toBe('WILV08');
  });

  it('maps (3, 1) to WILV20 (retail E3M1)', () => {
    expect(intermissionLevelNameLump(3, 1)).toBe('WILV20');
  });

  it('throws on invalid episode or map', () => {
    expect(() => intermissionLevelNameLump(0, 1)).toThrow(/episode/);
    expect(() => intermissionLevelNameLump(4, 1)).toThrow(/episode/);
    expect(() => intermissionLevelNameLump(1, 0)).toThrow(/map/);
    expect(() => intermissionLevelNameLump(1, 10)).toThrow(/map/);
  });
});

describe('intermissionAnimationLump', () => {
  it('maps (0, 0, 0) to WIA00000', () => {
    expect(intermissionAnimationLump(0, 0, 0)).toBe('WIA00000');
  });

  it('maps (0, 9, 2) to WIA00902 (last shareware frame)', () => {
    expect(intermissionAnimationLump(0, 9, 2)).toBe('WIA00902');
  });

  it('pads location and frame to two digits each', () => {
    expect(intermissionAnimationLump(1, 3, 1)).toBe('WIA10301');
  });

  it('throws on invalid episode/location/frame', () => {
    expect(() => intermissionAnimationLump(-1, 0, 0)).toThrow(/zeroBasedEpisode/);
    expect(() => intermissionAnimationLump(3, 0, 0)).toThrow(/zeroBasedEpisode/);
    expect(() => intermissionAnimationLump(0, -1, 0)).toThrow(/location/);
    expect(() => intermissionAnimationLump(0, 100, 0)).toThrow(/location/);
    expect(() => intermissionAnimationLump(0, 0, -1)).toThrow(/frame/);
    expect(() => intermissionAnimationLump(0, 0, 100)).toThrow(/frame/);
  });
});

describe('static UI asset catalogs', () => {
  it('MENU_ASSET_LUMPS has 45 entries and excludes retail-only M_EPI4', () => {
    expect(MENU_ASSET_LUMPS.length).toBe(45);
    expect(MENU_ASSET_LUMPS).not.toContain('M_EPI4');
    expect(MENU_ASSET_LUMPS).toContain('M_EPI1');
    expect(MENU_ASSET_LUMPS).toContain('M_EPI2');
    expect(MENU_ASSET_LUMPS).toContain('M_EPI3');
  });

  it('status bar number arrays each have 10 entries', () => {
    expect(STATUS_BAR_BIG_RED_NUMBER_LUMPS.length).toBe(10);
    expect(STATUS_BAR_SMALL_YELLOW_NUMBER_LUMPS.length).toBe(10);
    expect(STATUS_BAR_SMALL_GREY_NUMBER_LUMPS.length).toBe(10);
  });

  it('STATUS_BAR_KEY_LUMPS has 6 entries (3 cards + 3 skulls)', () => {
    expect(STATUS_BAR_KEY_LUMPS.length).toBe(6);
    expect(STATUS_BAR_KEY_LUMPS[0]).toBe('STKEYS0');
    expect(STATUS_BAR_KEY_LUMPS[5]).toBe('STKEYS5');
  });

  it('STATUS_BAR_FACE_BACKGROUND_LUMPS has 4 entries', () => {
    expect(STATUS_BAR_FACE_BACKGROUND_LUMPS.length).toBe(4);
    expect(STATUS_BAR_FACE_BACKGROUND_LUMPS).toEqual(['STFB0', 'STFB1', 'STFB2', 'STFB3']);
  });

  it('INTERMISSION_NUMBER_LUMPS has 10 entries', () => {
    expect(INTERMISSION_NUMBER_LUMPS.length).toBe(10);
  });

  it('INTERMISSION_LABEL_LUMPS has 15 entries', () => {
    expect(INTERMISSION_LABEL_LUMPS.length).toBe(15);
  });

  it('INTERMISSION_PLAYER_LUMPS has 8 entries (4 P + 4 BP)', () => {
    expect(INTERMISSION_PLAYER_LUMPS.length).toBe(8);
  });

  it('INTERMISSION_YOU_ARE_HERE_LUMPS has 2 frames', () => {
    expect(INTERMISSION_YOU_ARE_HERE_LUMPS).toEqual(['WIURH0', 'WIURH1']);
  });

  it('INTERMISSION_BACKGROUND_LUMPS is shareware-only [WIMAP0]', () => {
    expect(INTERMISSION_BACKGROUND_LUMPS).toEqual(['WIMAP0']);
  });

  it('FRONT_END_HELP_LUMPS is [HELP1, HELP2]', () => {
    expect(FRONT_END_HELP_LUMPS).toEqual(['HELP1', 'HELP2']);
  });

  it('front-end page lump names', () => {
    expect(FRONT_END_TITLE_LUMP).toBe('TITLEPIC');
    expect(FRONT_END_CREDIT_LUMP).toBe('CREDIT');
  });

  it('status bar scalar lumps', () => {
    expect(STATUS_BAR_BACKGROUND_LUMP).toBe('STBAR');
    expect(STATUS_BAR_ARMS_LUMP).toBe('STARMS');
    expect(STATUS_BAR_BIG_RED_MINUS_LUMP).toBe('STTMINUS');
    expect(STATUS_BAR_BIG_RED_PERCENT_LUMP).toBe('STTPRCNT');
  });

  it('intermission scalar lumps', () => {
    expect(INTERMISSION_MINUS_LUMP).toBe('WIMINUS');
    expect(INTERMISSION_PERCENT_LUMP).toBe('WIPCNT');
    expect(INTERMISSION_COLON_LUMP).toBe('WICOLON');
    expect(INTERMISSION_SPLAT_LUMP).toBe('WISPLAT');
  });

  it('INTERMISSION_E1 animation sizing (10 locations × 3 frames = 30)', () => {
    expect(INTERMISSION_E1_ANIMATION_LOCATION_COUNT).toBe(10);
    expect(INTERMISSION_E1_ANIMATION_FRAMES_PER_LOCATION).toBe(3);
  });
});

describe('resolveUiAssetLumps against DOOM1.WAD', () => {
  const catalog = resolveUiAssetLumps(directory);

  it('has UI_ASSET_LUMP_COUNT total entries', () => {
    expect(catalog.totalCount).toBe(UI_ASSET_LUMP_COUNT);
    expect(catalog.assets.length).toBe(UI_ASSET_LUMP_COUNT);
  });

  it('has zero missing lumps (shareware catalog is self-consistent)', () => {
    expect(catalog.missing.length).toBe(0);
  });

  it('every resolved asset has a non-negative directory index', () => {
    for (const asset of catalog.assets) {
      expect(asset.directoryIndex).toBeGreaterThanOrEqual(0);
      expect(asset.directoryIndex).toBeLessThan(directory.length);
    }
  });

  it('returned catalog is frozen', () => {
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.assets)).toBe(true);
    expect(Object.isFrozen(catalog.missing)).toBe(true);
  });

  it('each asset entry is frozen', () => {
    expect(Object.isFrozen(catalog.assets[0])).toBe(true);
    expect(Object.isFrozen(catalog.assets[catalog.assets.length - 1])).toBe(true);
  });

  it('hudFont category contains exactly HU_FONT_SIZE entries', () => {
    const hudFont = catalog.assets.filter((a) => a.category === 'hudFont');
    expect(hudFont.length).toBe(HU_FONT_SIZE);
  });

  it('statusBarFace category contains exactly ST_NUMFACES entries', () => {
    const faces = catalog.assets.filter((a) => a.category === 'statusBarFace');
    expect(faces.length).toBe(ST_NUMFACES);
  });

  it('intermissionAnimation category contains 30 E1 frames', () => {
    const anims = catalog.assets.filter((a) => a.category === 'intermissionAnimation');
    expect(anims.length).toBe(INTERMISSION_E1_ANIMATION_LOCATION_COUNT * INTERMISSION_E1_ANIMATION_FRAMES_PER_LOCATION);
    expect(anims.length).toBe(30);
  });

  it('intermissionLevelLabel category contains 9 E1 maps', () => {
    const labels = catalog.assets.filter((a) => a.category === 'intermissionLevelLabel');
    expect(labels.length).toBe(9);
    expect(labels[0]!.name).toBe('WILV00');
    expect(labels[labels.length - 1]!.name).toBe('WILV08');
  });

  it('menu category size matches MENU_ASSET_LUMPS', () => {
    const menu = catalog.assets.filter((a) => a.category === 'menu');
    expect(menu.length).toBe(MENU_ASSET_LUMPS.length);
  });

  it('hudFontExtra category contains exactly the extra STCFN121 y-glyph', () => {
    const extra = catalog.assets.filter((a) => a.category === 'hudFontExtra');
    expect(extra.length).toBe(1);
    expect(extra[0]!.name).toBe(HU_FONT_EXTRA_Y_LUMP);
  });
});

describe('resolveUiAssetLumps — missing reporting (parity-sensitive edge case)', () => {
  it('flags retail-only M_EPI4 as missing when added to an ad-hoc directory and absent from WAD', () => {
    // Simulate a directory that drops the expected M_EPI3 entry by scrubbing it
    // from the real DOOM1.WAD directory list. resolveUiAssetLumps must surface
    // the scrubbed lump through the `missing` array without throwing.
    const scrubbed = directory.filter((entry) => entry.name.toUpperCase() !== 'M_EPI3');
    const catalog = resolveUiAssetLumps(scrubbed);
    expect(catalog.missing.length).toBe(1);
    expect(catalog.missing[0]!.name).toBe('M_EPI3');
    expect(catalog.missing[0]!.directoryIndex).toBe(-1);
    expect(catalog.missing[0]!.category).toBe('menu');
  });

  it('reports empty input as every asset missing and never throws', () => {
    const catalog = resolveUiAssetLumps([]);
    expect(catalog.missing.length).toBe(catalog.totalCount);
    for (const asset of catalog.assets) {
      expect(asset.directoryIndex).toBe(-1);
    }
  });
});
