import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import type { IwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import { VANILLA_DEMO_LUMP_PREFIX, buildDemoAndMapAssets } from '../../../src/vanilla/demoAndMapAssets.ts';
import type { DemoAndMapAssetCatalog } from '../../../src/vanilla/demoAndMapAssets.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const DEMO_AND_MAP_ASSETS_RELATIVE_PATH = 'src/vanilla/demoAndMapAssets.ts';
const DEMO_AND_MAP_ASSETS_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, DEMO_AND_MAP_ASSETS_RELATIVE_PATH);

function entry(name: string, size: number): DirectoryEntry {
  return Object.freeze({ name, offset: 0, size });
}

function buildStubResourceCache(directory: readonly DirectoryEntry[]): IwadResourceCache {
  return {
    directory,
    findLump: (lumpName: string): DirectoryEntry | null => directory.find((dirEntry) => dirEntry.name === lumpName) ?? null,
    gameIdentification: Object.freeze({ episodeCount: 1, gameDescription: 'DOOM Shareware', gameMission: 'doom', gameMode: 'shareware' }),
    getAllIndicesForName: (): readonly number[] => Object.freeze([]),
    hasLump: (lumpName: string): boolean => directory.some((dirEntry) => dirEntry.name === lumpName),
    lumpCount: directory.length,
    resolvedPath: 'synthetic://stub.wad',
    wadHeader: Object.freeze({ directoryOffset: 0, lumpCount: directory.length, type: 'IWAD' }),
  };
}

function buildEpisodicMapDirectory(): DirectoryEntry[] {
  const mapLumpNames = ['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP'];
  const directory: DirectoryEntry[] = [];
  for (let episode = 1; episode <= 1; episode += 1) {
    for (let map = 1; map <= 9; map += 1) {
      directory.push(entry(`E${episode}M${map}`, 0));
      for (const lump of mapLumpNames) directory.push(entry(lump, 1024));
    }
  }
  return directory;
}

describe('plan_final wad: wire-demo-and-map-assets', () => {
  test('src/vanilla/demoAndMapAssets.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(DEMO_AND_MAP_ASSETS_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(DEMO_AND_MAP_ASSETS_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/demoAndMapAssets.ts cites plan_final step 05-007 in a top-of-file comment', () => {
    const fileText = readFileSync(DEMO_AND_MAP_ASSETS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('05-007');
    expect(fileText).toContain('buildDemoAndMapAssets');
  });

  test('src/vanilla/demoAndMapAssets.ts imports the read-only findMapNames helper from src/map/mapBundle.ts without modifying it', () => {
    const fileText = readFileSync(DEMO_AND_MAP_ASSETS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../map/mapBundle.ts'");
    expect(fileText).toContain('findMapNames');
  });

  test('src/vanilla/demoAndMapAssets.ts embeds NO proprietary IWAD demo or map bytes (per AGENTS.md)', () => {
    const fileText = readFileSync(DEMO_AND_MAP_ASSETS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).not.toContain('Uint8Array.from');
    expect(fileText).not.toContain('Buffer.from(');
  });

  test('VANILLA_DEMO_LUMP_PREFIX pins the canonical 4-byte demo lump-name prefix', () => {
    expect(VANILLA_DEMO_LUMP_PREFIX).toBe('DEMO');
  });

  test('buildDemoAndMapAssets returns a frozen catalog with frozen demoLumps/mapNames arrays', () => {
    const directory = [entry('DEMO1', 4096), ...buildEpisodicMapDirectory()];
    const catalog: DemoAndMapAssetCatalog = buildDemoAndMapAssets(buildStubResourceCache(directory));
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.demoLumps)).toBe(true);
    expect(Object.isFrozen(catalog.mapNames)).toBe(true);
  });

  test('buildDemoAndMapAssets reports every DEMO-prefixed lump in directory order', () => {
    const directory = [entry('PLAYPAL', 10752), entry('DEMO1', 4096), entry('DEMO2', 8192), entry('DEMO3', 12288), entry('STBAR', 2048)];
    const catalog = buildDemoAndMapAssets(buildStubResourceCache(directory));
    expect(catalog.demoLumps.map((demo) => demo.name)).toEqual(['DEMO1', 'DEMO2', 'DEMO3']);
    expect(catalog.demoLumps.map((demo) => demo.directoryIndex)).toEqual([1, 2, 3]);
  });

  test('buildDemoAndMapAssets reports each demo entry with its canonical DirectoryEntry reference', () => {
    const demoEntry = entry('DEMO1', 4096);
    const directory = [demoEntry];
    const catalog = buildDemoAndMapAssets(buildStubResourceCache(directory));
    expect(catalog.demoLumps[0]!.directoryEntry).toBe(demoEntry);
  });

  test('buildDemoAndMapAssets enumerates episodic E1M1..E1M9 shareware map markers via findMapNames', () => {
    const catalog = buildDemoAndMapAssets(buildStubResourceCache(buildEpisodicMapDirectory()));
    expect(catalog.mapNames.length).toBe(9);
    for (let map = 1; map <= 9; map += 1) {
      expect(catalog.mapNames.includes(`E1M${map}`)).toBe(true);
    }
  });

  test('buildDemoAndMapAssets returns empty catalogs for an empty directory without throwing', () => {
    const catalog = buildDemoAndMapAssets(buildStubResourceCache([]));
    expect(catalog.demoLumps.length).toBe(0);
    expect(catalog.mapNames.length).toBe(0);
  });

  test('buildDemoAndMapAssets skips zero-size DEMO entries (matching empty-lump rejection)', () => {
    const directory = [entry('DEMO1', 0), entry('DEMO2', 4096)];
    const catalog = buildDemoAndMapAssets(buildStubResourceCache(directory));
    expect(catalog.demoLumps.map((demo) => demo.name)).toEqual(['DEMO2']);
  });

  test('buildDemoAndMapAssets folds case so a lowercase demo on disk still resolves to the canonical bucket', () => {
    const catalog = buildDemoAndMapAssets(buildStubResourceCache([entry('demo1', 4096)]));
    expect(catalog.demoLumps.length).toBe(1);
    expect(catalog.demoLumps[0]!.name).toBe('DEMO1');
  });

  test('buildDemoAndMapAssets does not classify a non-DEMO lump that happens to start with DE as DEMO', () => {
    const catalog = buildDemoAndMapAssets(buildStubResourceCache([entry('DECORATE', 1024), entry('DEAD1', 512)]));
    expect(catalog.demoLumps.length).toBe(0);
  });
});
