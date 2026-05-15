import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import { UI_ASSET_LUMP_COUNT, buildHudFontLumpList, buildStatusBarFaceLumpList } from '../../../src/ui/assets.ts';
import type { IwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import { VANILLA_ENDOOM_LUMP_NAME, buildUiPatchAssets } from '../../../src/vanilla/uiPatchAssets.ts';
import type { UiPatchAssetsResources } from '../../../src/vanilla/uiPatchAssets.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const UI_PATCH_ASSETS_RELATIVE_PATH = 'src/vanilla/uiPatchAssets.ts';
const UI_PATCH_ASSETS_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, UI_PATCH_ASSETS_RELATIVE_PATH);

function entry(name: string): DirectoryEntry {
  return Object.freeze({ name, offset: 0, size: 0 });
}

function buildHappyDirectory(includeEndoom: boolean): DirectoryEntry[] {
  const directory: DirectoryEntry[] = [];
  for (const name of buildHudFontLumpList()) directory.push(entry(name));
  directory.push(entry('STCFN121'));
  for (const name of buildStatusBarFaceLumpList()) directory.push(entry(name));
  for (const name of ['STFB0', 'STFB1', 'STFB2', 'STFB3']) directory.push(entry(name));
  for (let n = 0; n <= 9; n += 1) directory.push(entry(`STTNUM${n}`));
  directory.push(entry('STTMINUS'));
  directory.push(entry('STTPRCNT'));
  for (let n = 0; n <= 9; n += 1) directory.push(entry(`STYSNUM${n}`));
  for (let n = 0; n <= 9; n += 1) directory.push(entry(`STGNUM${n}`));
  directory.push(entry('STBAR'));
  directory.push(entry('STARMS'));
  for (let n = 0; n <= 5; n += 1) directory.push(entry(`STKEYS${n}`));
  for (let n = 0; n <= 9; n += 1) directory.push(entry(`WINUM${n}`));
  directory.push(entry('WIMINUS'));
  directory.push(entry('WIPCNT'));
  directory.push(entry('WICOLON'));
  for (const name of ['WIF', 'WIENTER', 'WIKILRS', 'WIVCTMS', 'WIMSTT', 'WIFRGS', 'WITIME', 'WISUCKS', 'WIPAR', 'WIOSTK', 'WIOSTS', 'WIOSTI', 'WIOSTF', 'WISCRT2', 'WIMSTAR']) {
    directory.push(entry(name));
  }
  for (const name of ['WIP1', 'WIP2', 'WIP3', 'WIP4', 'WIBP1', 'WIBP2', 'WIBP3', 'WIBP4']) directory.push(entry(name));
  for (const name of ['WIURH0', 'WIURH1']) directory.push(entry(name));
  directory.push(entry('WISPLAT'));
  directory.push(entry('WIMAP0'));
  for (let m = 0; m <= 8; m += 1) directory.push(entry(`WILV0${m}`));
  for (let location = 0; location < 10; location += 1) {
    for (let frame = 0; frame < 3; frame += 1) {
      directory.push(entry(`WIA0${location.toString().padStart(2, '0')}${frame.toString().padStart(2, '0')}`));
    }
  }
  for (const name of [
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
  ]) {
    directory.push(entry(name));
  }
  directory.push(entry('TITLEPIC'));
  directory.push(entry('CREDIT'));
  directory.push(entry('HELP1'));
  directory.push(entry('HELP2'));
  if (includeEndoom) directory.push(entry(VANILLA_ENDOOM_LUMP_NAME));
  return directory;
}

function buildStubResourceCache(directory: readonly DirectoryEntry[]): IwadResourceCache {
  return {
    directory,
    findLump: (lumpName: string): DirectoryEntry | null => {
      for (let index = directory.length - 1; index >= 0; index -= 1) {
        if (directory[index]!.name === lumpName) return directory[index]!;
      }
      return null;
    },
    gameIdentification: Object.freeze({ episodeCount: 1, gameDescription: 'DOOM Shareware', gameMission: 'doom', gameMode: 'shareware' }),
    getAllIndicesForName: (): readonly number[] => Object.freeze([]),
    hasLump: (lumpName: string): boolean => directory.some((dirEntry) => dirEntry.name === lumpName),
    lumpCount: directory.length,
    resolvedPath: 'synthetic://stub.wad',
    wadHeader: Object.freeze({ directoryOffset: 0, lumpCount: directory.length, type: 'IWAD' }),
  };
}

describe('plan_final wad: wire-ui-patch-assets', () => {
  test('src/vanilla/uiPatchAssets.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(UI_PATCH_ASSETS_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(UI_PATCH_ASSETS_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/uiPatchAssets.ts cites plan_final step 05-004 in a top-of-file comment', () => {
    const fileText = readFileSync(UI_PATCH_ASSETS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('05-004');
    expect(fileText).toContain('buildUiPatchAssets');
  });

  test('src/vanilla/uiPatchAssets.ts imports the read-only resolveUiAssetLumps helper from src/ui/assets.ts without modifying it', () => {
    const fileText = readFileSync(UI_PATCH_ASSETS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../ui/assets.ts'");
    expect(fileText).toContain('resolveUiAssetLumps');
  });

  test('VANILLA_ENDOOM_LUMP_NAME pins the canonical ENDOOM lump basename', () => {
    expect(VANILLA_ENDOOM_LUMP_NAME).toBe('ENDOOM');
  });

  test('buildUiPatchAssets returns a frozen result with frozen uiAssetCatalog', () => {
    const cache = buildStubResourceCache(buildHappyDirectory(true));
    const resources: UiPatchAssetsResources = buildUiPatchAssets(cache);
    expect(Object.isFrozen(resources)).toBe(true);
    expect(Object.isFrozen(resources.uiAssetCatalog)).toBe(true);
  });

  test('buildUiPatchAssets surfaces the canonical UI lump count from src/ui/assets.ts', () => {
    const cache = buildStubResourceCache(buildHappyDirectory(true));
    const resources = buildUiPatchAssets(cache);
    expect(resources.uiAssetCatalog.totalCount).toBe(UI_ASSET_LUMP_COUNT);
    expect(resources.uiAssetCatalog.assets.length).toBe(UI_ASSET_LUMP_COUNT);
  });

  test('buildUiPatchAssets reports endoomPresent=true with a non-negative directoryIndex when ENDOOM is in the directory', () => {
    const directory = buildHappyDirectory(true);
    const cache = buildStubResourceCache(directory);
    const resources = buildUiPatchAssets(cache);
    expect(resources.endoomPresent).toBe(true);
    expect(resources.endoomDirectoryIndex).toBeGreaterThanOrEqual(0);
    expect(directory[resources.endoomDirectoryIndex]!.name).toBe(VANILLA_ENDOOM_LUMP_NAME);
  });

  test('buildUiPatchAssets reports endoomPresent=false with directoryIndex=-1 when ENDOOM is absent', () => {
    const cache = buildStubResourceCache(buildHappyDirectory(false));
    const resources = buildUiPatchAssets(cache);
    expect(resources.endoomPresent).toBe(false);
    expect(resources.endoomDirectoryIndex).toBe(-1);
  });

  test('buildUiPatchAssets reports zero missing UI assets when every shareware-safe lump is in the directory', () => {
    const cache = buildStubResourceCache(buildHappyDirectory(true));
    const resources = buildUiPatchAssets(cache);
    expect(resources.uiAssetCatalog.missing.length).toBe(0);
  });

  test('buildUiPatchAssets reports the missing list when a UI lump is absent from the directory', () => {
    const directory = buildHappyDirectory(true).filter((dirEntry) => dirEntry.name !== 'TITLEPIC');
    const cache = buildStubResourceCache(directory);
    const resources = buildUiPatchAssets(cache);
    expect(resources.uiAssetCatalog.missing.length).toBeGreaterThan(0);
    expect(resources.uiAssetCatalog.missing.some((asset) => asset.name === 'TITLEPIC')).toBe(true);
  });

  test('buildUiPatchAssets does not throw when the directory is empty (every UI asset surfaces in missing)', () => {
    const cache = buildStubResourceCache([]);
    let caughtError: unknown;
    let resources: UiPatchAssetsResources | undefined;
    try {
      resources = buildUiPatchAssets(cache);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeUndefined();
    expect(resources!.endoomPresent).toBe(false);
    expect(resources!.uiAssetCatalog.missing.length).toBe(UI_ASSET_LUMP_COUNT);
  });

  test('buildUiPatchAssets returns the same UiAssetCatalog shape resolveUiAssetLumps would have returned directly', () => {
    const directory = buildHappyDirectory(false);
    const cache = buildStubResourceCache(directory);
    const resources = buildUiPatchAssets(cache);
    expect(resources.uiAssetCatalog.assets[0]!.name.startsWith('STCFN')).toBe(true);
    expect(resources.uiAssetCatalog.assets.some((asset) => asset.category === 'frontEndPage' && asset.name === 'CREDIT')).toBe(true);
    expect(resources.uiAssetCatalog.assets.some((asset) => asset.category === 'menu' && asset.name === 'M_DOOM')).toBe(true);
  });
});
