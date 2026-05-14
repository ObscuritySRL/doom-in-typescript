import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DIRECTORY_ENTRY_SIZE } from '../../../src/wad/directory.ts';
import { WAD_HEADER_SIZE } from '../../../src/wad/header.ts';
import { parseCommandLineConfiguration } from '../../../src/vanilla/commandLineConfiguration.ts';
import { IwadResourceCacheError, buildIwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import type { IwadFileLoader, IwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import { resolveLaunchContext } from '../../../src/vanilla/launchContext.ts';
import type { LaunchContextEnvironment } from '../../../src/vanilla/launchContext.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const IWAD_RESOURCE_CACHE_RELATIVE_PATH = 'src/vanilla/iwadResourceCache.ts';
const IWAD_RESOURCE_CACHE_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, IWAD_RESOURCE_CACHE_RELATIVE_PATH);

const SYNTHETIC_WAD_RESOLVED_PATH = './doom1.wad';

interface SyntheticLump {
  readonly name: string;
  readonly data: Buffer;
}

function buildSyntheticIwadBuffer(wadType: 'IWAD' | 'PWAD', lumps: readonly SyntheticLump[]): Buffer {
  const directoryOffset = WAD_HEADER_SIZE + lumps.reduce((accumulator, lump) => accumulator + lump.data.length, 0);
  const totalSize = directoryOffset + lumps.length * DIRECTORY_ENTRY_SIZE;
  const buffer = Buffer.alloc(totalSize);

  buffer.write(wadType, 0, 'ascii');
  buffer.writeInt32LE(lumps.length, 4);
  buffer.writeInt32LE(directoryOffset, 8);

  let cursor = WAD_HEADER_SIZE;
  for (let lumpIndex = 0; lumpIndex < lumps.length; lumpIndex += 1) {
    const lump = lumps[lumpIndex]!;
    lump.data.copy(buffer, cursor);
    const directoryEntryOffset = directoryOffset + lumpIndex * DIRECTORY_ENTRY_SIZE;
    buffer.writeInt32LE(cursor, directoryEntryOffset);
    buffer.writeInt32LE(lump.data.length, directoryEntryOffset + 4);
    buffer.write(lump.name.padEnd(8, '\0').slice(0, 8), directoryEntryOffset + 8, 'ascii');
    cursor += lump.data.length;
  }

  return buffer;
}

function buildLoaderReturning(buffer: Buffer | null): IwadFileLoader {
  return Object.freeze({
    readFile: () => buffer,
  });
}

function buildLoaderForPathMap(pathToBuffer: ReadonlyMap<string, Buffer | null>): IwadFileLoader {
  return Object.freeze({
    readFile: (resolvedPath: string) => pathToBuffer.get(resolvedPath) ?? null,
  });
}

const EMPTY_ENVIRONMENT: LaunchContextEnvironment = Object.freeze({
  doesBasenameExistInWadDirectory: () => false,
  doomWadDirectoryEnvironmentValue: null,
});

function buildLaunchContextForIwadPath(iwadPath: string) {
  const configuration = parseCommandLineConfiguration(['doom_codex', '-iwad', iwadPath]);
  return resolveLaunchContext(configuration, EMPTY_ENVIRONMENT);
}

const SHAREWARE_LUMPS: readonly SyntheticLump[] = Object.freeze([
  Object.freeze({ name: 'PLAYPAL', data: Buffer.alloc(8) }),
  Object.freeze({ name: 'COLORMAP', data: Buffer.alloc(4) }),
  Object.freeze({ name: 'E1M1', data: Buffer.alloc(0) }),
  Object.freeze({ name: 'E1M9', data: Buffer.alloc(0) }),
]);

const REGISTERED_LUMPS: readonly SyntheticLump[] = Object.freeze([Object.freeze({ name: 'PLAYPAL', data: Buffer.alloc(8) }), Object.freeze({ name: 'E1M1', data: Buffer.alloc(0) }), Object.freeze({ name: 'E3M1', data: Buffer.alloc(0) })]);

const RETAIL_LUMPS: readonly SyntheticLump[] = Object.freeze([
  Object.freeze({ name: 'PLAYPAL', data: Buffer.alloc(8) }),
  Object.freeze({ name: 'E1M1', data: Buffer.alloc(0) }),
  Object.freeze({ name: 'E3M1', data: Buffer.alloc(0) }),
  Object.freeze({ name: 'E4M1', data: Buffer.alloc(0) }),
]);

const COMMERCIAL_LUMPS: readonly SyntheticLump[] = Object.freeze([Object.freeze({ name: 'PLAYPAL', data: Buffer.alloc(8) }), Object.freeze({ name: 'MAP01', data: Buffer.alloc(0) }), Object.freeze({ name: 'MAP32', data: Buffer.alloc(0) })]);

describe('plan_final wad: wire-iwad-resource-cache', () => {
  test('src/vanilla/iwadResourceCache.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(IWAD_RESOURCE_CACHE_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(IWAD_RESOURCE_CACHE_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/iwadResourceCache.ts cites plan_final step 05-001 in a top-of-file comment', () => {
    const fileText = readFileSync(IWAD_RESOURCE_CACHE_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('05-001');
    expect(fileText).toContain('buildIwadResourceCache');
  });

  test('src/vanilla/iwadResourceCache.ts reuses the existing WAD primitives without modifying them', () => {
    const fileText = readFileSync(IWAD_RESOURCE_CACHE_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("import { parseWadHeader } from '../wad/header.ts';");
    expect(fileText).toContain("import { parseWadDirectory } from '../wad/directory.ts';");
    expect(fileText).toContain("import { LumpLookup } from '../wad/lumpLookup.ts';");
    expect(fileText).toContain("import { identifyGame } from '../bootstrap/gameMode.ts';");
  });

  test('buildIwadResourceCache is exported as a function accepting (launchContext, loader)', () => {
    expect(typeof buildIwadResourceCache).toBe('function');
    expect(buildIwadResourceCache.length).toBe(2);
  });

  test('IwadResourceCacheError exposes the reason discriminator and the resolved path', () => {
    const example = new IwadResourceCacheError('wad-not-found', '/missing.wad', 'sample message');
    expect(example.name).toBe('IwadResourceCacheError');
    expect(example).toBeInstanceOf(Error);
    expect(example.reason).toBe('wad-not-found');
    expect(example.resolvedPath).toBe('/missing.wad');
    expect(example.message).toBe('sample message');
  });

  test('happy path: shareware IWAD yields a frozen cache with gameMode=shareware and correct lump count', () => {
    const launchContext = buildLaunchContextForIwadPath(SYNTHETIC_WAD_RESOLVED_PATH);
    const buffer = buildSyntheticIwadBuffer('IWAD', SHAREWARE_LUMPS);
    const cache: IwadResourceCache = buildIwadResourceCache(launchContext, buildLoaderForPathMap(new Map([[SYNTHETIC_WAD_RESOLVED_PATH, buffer]])));
    expect(Object.isFrozen(cache)).toBe(true);
    expect(cache.wadHeader.type).toBe('IWAD');
    expect(cache.wadHeader.lumpCount).toBe(SHAREWARE_LUMPS.length);
    expect(cache.directory.length).toBe(SHAREWARE_LUMPS.length);
    expect(cache.lumpCount).toBe(SHAREWARE_LUMPS.length);
    expect(cache.gameIdentification.gameMode).toBe('shareware');
    expect(cache.gameIdentification.gameMission).toBe('doom');
    expect(cache.gameIdentification.episodeCount).toBe(1);
    expect(cache.resolvedPath).toBe(SYNTHETIC_WAD_RESOLVED_PATH);
  });

  test('happy path: registered IWAD (E3M1 present, E4M1 absent) yields gameMode=registered', () => {
    const launchContext = buildLaunchContextForIwadPath('./doom.wad');
    const buffer = buildSyntheticIwadBuffer('IWAD', REGISTERED_LUMPS);
    const cache = buildIwadResourceCache(launchContext, buildLoaderReturning(buffer));
    expect(cache.gameIdentification.gameMode).toBe('registered');
    expect(cache.gameIdentification.episodeCount).toBe(3);
  });

  test('happy path: retail IWAD (E4M1 present) yields gameMode=retail and reconciles a shareware-named -iwad path with the actual lump contents', () => {
    const launchContext = buildLaunchContextForIwadPath('./doom1.wad');
    const buffer = buildSyntheticIwadBuffer('IWAD', RETAIL_LUMPS);
    const cache = buildIwadResourceCache(launchContext, buildLoaderReturning(buffer));
    expect(cache.gameIdentification.gameMode).toBe('retail');
    expect(cache.gameIdentification.episodeCount).toBe(4);
  });

  test('happy path: commercial IWAD (MAP01 present) yields gameMode=commercial regardless of filename mode hint', () => {
    const launchContext = buildLaunchContextForIwadPath('./doom2.wad');
    const buffer = buildSyntheticIwadBuffer('IWAD', COMMERCIAL_LUMPS);
    const cache = buildIwadResourceCache(launchContext, buildLoaderReturning(buffer));
    expect(cache.gameIdentification.gameMode).toBe('commercial');
    expect(cache.gameIdentification.gameMission).toBe('doom2');
    expect(cache.gameIdentification.episodeCount).toBe(1);
  });

  test('happy path: unrecognized basename + commercial lump layout falls back to gameMission=doom2', () => {
    const launchContext = buildLaunchContextForIwadPath('./freedm.wad');
    const buffer = buildSyntheticIwadBuffer('IWAD', COMMERCIAL_LUMPS);
    const cache = buildIwadResourceCache(launchContext, buildLoaderReturning(buffer));
    expect(cache.gameIdentification.gameMode).toBe('commercial');
    expect(cache.gameIdentification.gameMission).toBe('doom2');
  });

  test('hasLump matches the LumpChecker contract case-insensitively', () => {
    const launchContext = buildLaunchContextForIwadPath(SYNTHETIC_WAD_RESOLVED_PATH);
    const buffer = buildSyntheticIwadBuffer('IWAD', SHAREWARE_LUMPS);
    const cache = buildIwadResourceCache(launchContext, buildLoaderReturning(buffer));
    expect(cache.hasLump('PLAYPAL')).toBe(true);
    expect(cache.hasLump('playpal')).toBe(true);
    expect(cache.hasLump('PlayPal')).toBe(true);
    expect(cache.hasLump('E1M1')).toBe(true);
    expect(cache.hasLump('E4M1')).toBe(false);
    expect(cache.hasLump('NOTEXIST')).toBe(false);
  });

  test('findLump returns the directory entry for an existing lump and null otherwise', () => {
    const launchContext = buildLaunchContextForIwadPath(SYNTHETIC_WAD_RESOLVED_PATH);
    const buffer = buildSyntheticIwadBuffer('IWAD', SHAREWARE_LUMPS);
    const cache = buildIwadResourceCache(launchContext, buildLoaderReturning(buffer));
    const playpalEntry = cache.findLump('PLAYPAL');
    expect(playpalEntry).not.toBeNull();
    expect(playpalEntry!.name).toBe('PLAYPAL');
    expect(playpalEntry!.size).toBe(8);
    expect(playpalEntry!.offset).toBe(WAD_HEADER_SIZE);
    expect(cache.findLump('NOTEXIST')).toBeNull();
  });

  test('getAllIndicesForName returns directory-order indices for duplicate lump names (vanilla last-match-wins semantics)', () => {
    const launchContext = buildLaunchContextForIwadPath(SYNTHETIC_WAD_RESOLVED_PATH);
    const duplicateLumps: readonly SyntheticLump[] = Object.freeze([Object.freeze({ name: 'PLAYPAL', data: Buffer.alloc(8) }), Object.freeze({ name: 'E1M1', data: Buffer.alloc(0) }), Object.freeze({ name: 'E1M1', data: Buffer.alloc(0) })]);
    const buffer = buildSyntheticIwadBuffer('IWAD', duplicateLumps);
    const cache = buildIwadResourceCache(launchContext, buildLoaderReturning(buffer));
    expect(cache.getAllIndicesForName('E1M1')).toEqual([1, 2]);
    expect(cache.findLump('E1M1')!.offset).toBe(buffer.readInt32LE(cache.wadHeader.directoryOffset + 2 * DIRECTORY_ENTRY_SIZE));
  });

  test('failure: loader returning null surfaces IwadResourceCacheError with reason "wad-not-found"', () => {
    const launchContext = buildLaunchContextForIwadPath('/missing.wad');
    let caughtError: unknown;
    try {
      buildIwadResourceCache(launchContext, buildLoaderReturning(null));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(IwadResourceCacheError);
    if (caughtError instanceof IwadResourceCacheError) {
      expect(caughtError.reason).toBe('wad-not-found');
      expect(caughtError.resolvedPath).toBe('/missing.wad');
    }
  });

  test('failure: empty buffer surfaces IwadResourceCacheError with reason "empty-buffer"', () => {
    const launchContext = buildLaunchContextForIwadPath(SYNTHETIC_WAD_RESOLVED_PATH);
    let caughtError: unknown;
    try {
      buildIwadResourceCache(launchContext, buildLoaderReturning(Buffer.alloc(0)));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(IwadResourceCacheError);
    if (caughtError instanceof IwadResourceCacheError) {
      expect(caughtError.reason).toBe('empty-buffer');
    }
  });

  test('failure: malformed WAD header surfaces IwadResourceCacheError with reason "wad-header-parse-failure"', () => {
    const launchContext = buildLaunchContextForIwadPath(SYNTHETIC_WAD_RESOLVED_PATH);
    const malformedHeader = Buffer.alloc(WAD_HEADER_SIZE);
    malformedHeader.write('XWAD', 0, 'ascii');
    let caughtError: unknown;
    try {
      buildIwadResourceCache(launchContext, buildLoaderReturning(malformedHeader));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(IwadResourceCacheError);
    if (caughtError instanceof IwadResourceCacheError) {
      expect(caughtError.reason).toBe('wad-header-parse-failure');
      expect(caughtError.message).toContain('Invalid WAD identification');
    }
  });

  test('failure: PWAD header surfaces IwadResourceCacheError with reason "not-an-iwad"', () => {
    const launchContext = buildLaunchContextForIwadPath(SYNTHETIC_WAD_RESOLVED_PATH);
    const pwadBuffer = buildSyntheticIwadBuffer('PWAD', SHAREWARE_LUMPS);
    let caughtError: unknown;
    try {
      buildIwadResourceCache(launchContext, buildLoaderReturning(pwadBuffer));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(IwadResourceCacheError);
    if (caughtError instanceof IwadResourceCacheError) {
      expect(caughtError.reason).toBe('not-an-iwad');
      expect(caughtError.message).toContain('PWAD');
    }
  });

  test('failure: malformed directory (entry past buffer end) surfaces "wad-directory-parse-failure"', () => {
    const launchContext = buildLaunchContextForIwadPath(SYNTHETIC_WAD_RESOLVED_PATH);
    const buffer = Buffer.alloc(WAD_HEADER_SIZE + DIRECTORY_ENTRY_SIZE);
    buffer.write('IWAD', 0, 'ascii');
    buffer.writeInt32LE(1, 4);
    buffer.writeInt32LE(WAD_HEADER_SIZE, 8);
    buffer.writeInt32LE(WAD_HEADER_SIZE, WAD_HEADER_SIZE);
    buffer.writeInt32LE(buffer.length, WAD_HEADER_SIZE + 4);
    buffer.write('BADLUMP', WAD_HEADER_SIZE + 8, 'ascii');
    let caughtError: unknown;
    try {
      buildIwadResourceCache(launchContext, buildLoaderReturning(buffer));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(IwadResourceCacheError);
    if (caughtError instanceof IwadResourceCacheError) {
      expect(caughtError.reason).toBe('wad-directory-parse-failure');
      expect(caughtError.message).toContain('exceeds buffer bounds');
    }
  });

  test('loader is invoked exactly once and with the launchContext.iwad.resolvedPath value', () => {
    const launchContext = buildLaunchContextForIwadPath(SYNTHETIC_WAD_RESOLVED_PATH);
    const invocations: string[] = [];
    const trackingLoader: IwadFileLoader = Object.freeze({
      readFile: (resolvedPath: string) => {
        invocations.push(resolvedPath);
        return buildSyntheticIwadBuffer('IWAD', SHAREWARE_LUMPS);
      },
    });
    buildIwadResourceCache(launchContext, trackingLoader);
    expect(invocations.length).toBe(1);
    expect(invocations[0]).toBe(launchContext.iwad.resolvedPath);
  });

  test('cache survives buffer mutation after construction (directory is decoupled from the source buffer)', () => {
    const launchContext = buildLaunchContextForIwadPath(SYNTHETIC_WAD_RESOLVED_PATH);
    const buffer = buildSyntheticIwadBuffer('IWAD', SHAREWARE_LUMPS);
    const cache = buildIwadResourceCache(launchContext, buildLoaderReturning(buffer));
    buffer.fill(0xff);
    expect(cache.directory[0]!.name).toBe('PLAYPAL');
    expect(cache.findLump('E1M1')!.name).toBe('E1M1');
  });
});
