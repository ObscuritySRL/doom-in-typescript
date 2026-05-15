import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DIRECTORY_ENTRY_SIZE } from '../../../src/wad/directory.ts';
import { WAD_HEADER_SIZE } from '../../../src/wad/header.ts';
import { parseCommandLineConfiguration } from '../../../src/vanilla/commandLineConfiguration.ts';
import { buildIwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import type { IwadFileLoader } from '../../../src/vanilla/iwadResourceCache.ts';
import { resolveLaunchContext } from '../../../src/vanilla/launchContext.ts';
import type { LaunchContextEnvironment } from '../../../src/vanilla/launchContext.ts';
import { wireSpriteFrameCacheFromIwadResourceCache } from '../../../src/assets/wireSpriteFrameCacheFromIwadResourceCache.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { PRIMARY_TARGET } from '../../../src/reference/target.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_SPRITE_CACHE_RELATIVE_PATH = 'src/assets/wireSpriteFrameCacheFromIwadResourceCache.ts';
const WIRE_SPRITE_CACHE_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, WIRE_SPRITE_CACHE_RELATIVE_PATH);
const SHAREWARE_WAD_PATH = join(REFERENCE_BUNDLE_PATH, PRIMARY_TARGET.wadFilename);
const SHAREWARE_SPRITE_NAMESPACE_ENTRY_COUNT = 483;
const PATCH_HEADER_BYTES = 8;

const EMPTY_ENVIRONMENT: LaunchContextEnvironment = Object.freeze({
  doesBasenameExistInWadDirectory: () => false,
  doomWadDirectoryEnvironmentValue: null,
});

interface SyntheticLump {
  readonly name: string;
  readonly data: Buffer;
}

function buildSpritePatchHeaderBuffer(width: number, height: number, leftOffset: number, topOffset: number): Buffer {
  const buffer = Buffer.alloc(PATCH_HEADER_BYTES);
  buffer.writeInt16LE(width, 0);
  buffer.writeInt16LE(height, 2);
  buffer.writeInt16LE(leftOffset, 4);
  buffer.writeInt16LE(topOffset, 6);
  return buffer;
}

function buildSyntheticIwadBuffer(lumps: readonly SyntheticLump[]): Buffer {
  const directoryOffset = WAD_HEADER_SIZE + lumps.reduce((accumulator, lump) => accumulator + lump.data.length, 0);
  const totalSize = directoryOffset + lumps.length * DIRECTORY_ENTRY_SIZE;
  const buffer = Buffer.alloc(totalSize);
  buffer.write('IWAD', 0, 'ascii');
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

function buildSyntheticLaunchContext(iwadPath: string) {
  const configuration = parseCommandLineConfiguration(['doom_codex', '-iwad', iwadPath]);
  return resolveLaunchContext(configuration, EMPTY_ENVIRONMENT);
}

function buildLoaderReturning(buffer: Buffer): IwadFileLoader {
  return Object.freeze({ readFile: () => buffer });
}

describe('plan_final wad: wire-sprite-assets', () => {
  test('src/assets/wireSpriteFrameCacheFromIwadResourceCache.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(WIRE_SPRITE_CACHE_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(WIRE_SPRITE_CACHE_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/assets/wireSpriteFrameCacheFromIwadResourceCache.ts cites plan_final step 05-005 in a top-of-file comment', () => {
    const fileText = readFileSync(WIRE_SPRITE_CACHE_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('05-005');
    expect(fileText).toContain('wireSpriteFrameCacheFromIwadResourceCache');
  });

  test('src/assets/wireSpriteFrameCacheFromIwadResourceCache.ts reuses the existing build-sprite-frame-cache primitive without modifying it', () => {
    const fileText = readFileSync(WIRE_SPRITE_CACHE_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("import { buildSpriteFrameCache } from './build-sprite-frame-cache.ts';");
    expect(fileText).toContain("import type { IwadResourceCache } from '../vanilla/iwadResourceCache.ts';");
  });

  test('wireSpriteFrameCacheFromIwadResourceCache is exported as a function accepting (cache, wadBuffer)', () => {
    expect(typeof wireSpriteFrameCacheFromIwadResourceCache).toBe('function');
    expect(wireSpriteFrameCacheFromIwadResourceCache.length).toBe(2);
  });

  test('synthetic minimal sprite namespace: builds a frozen SpriteFrameCache with one entry and the canonical spriteNumber 0 formula', () => {
    const spriteLump: SyntheticLump = { name: 'TROOA1', data: buildSpritePatchHeaderBuffer(32, 64, -16, 64) };
    const lumps: readonly SyntheticLump[] = Object.freeze([
      Object.freeze({ name: 'PLAYPAL', data: Buffer.alloc(8) }),
      Object.freeze({ name: 'E1M1', data: Buffer.alloc(0) }),
      Object.freeze({ name: 'S_START', data: Buffer.alloc(0) }),
      Object.freeze(spriteLump),
      Object.freeze({ name: 'S_END', data: Buffer.alloc(0) }),
    ]);
    const wadBuffer = buildSyntheticIwadBuffer(lumps);
    const launchContext = buildSyntheticLaunchContext('./doom1.wad');
    const iwadResourceCache = buildIwadResourceCache(launchContext, buildLoaderReturning(wadBuffer));
    const spriteCache = wireSpriteFrameCacheFromIwadResourceCache(iwadResourceCache, wadBuffer);
    expect(spriteCache.entries.length).toBe(1);
    expect(spriteCache.entries[0]!.name).toBe('TROOA1');
    expect(spriteCache.entries[0]!.spriteNumber).toBe(0);
    expect(spriteCache.entries[0]!.width).toBe(32);
    expect(spriteCache.entries[0]!.height).toBe(64);
    expect(spriteCache.namespace.entries.length).toBe(1);
    expect(spriteCache.spriteNameToNumber.get('TROOA1')).toBe(0);
  });

  test('synthetic two-sprite namespace: preserves directory order and assigns sequential firstspritelump-relative numbers', () => {
    const lumps: readonly SyntheticLump[] = Object.freeze([
      Object.freeze({ name: 'PLAYPAL', data: Buffer.alloc(8) }),
      Object.freeze({ name: 'S_START', data: Buffer.alloc(0) }),
      Object.freeze({ name: 'TROOA1', data: buildSpritePatchHeaderBuffer(16, 32, -8, 32) }),
      Object.freeze({ name: 'TROOB1', data: buildSpritePatchHeaderBuffer(20, 36, -10, 36) }),
      Object.freeze({ name: 'S_END', data: Buffer.alloc(0) }),
    ]);
    const wadBuffer = buildSyntheticIwadBuffer(lumps);
    const launchContext = buildSyntheticLaunchContext('./doom1.wad');
    const iwadResourceCache = buildIwadResourceCache(launchContext, buildLoaderReturning(wadBuffer));
    const spriteCache = wireSpriteFrameCacheFromIwadResourceCache(iwadResourceCache, wadBuffer);
    expect(spriteCache.entries.length).toBe(2);
    expect(spriteCache.entries[0]!.name).toBe('TROOA1');
    expect(spriteCache.entries[0]!.spriteNumber).toBe(0);
    expect(spriteCache.entries[1]!.name).toBe('TROOB1');
    expect(spriteCache.entries[1]!.spriteNumber).toBe(1);
    expect(spriteCache.spriteOffsets.length).toBe(2);
    expect(spriteCache.spriteTopOffsets.length).toBe(2);
    expect(spriteCache.spriteWidths.length).toBe(2);
  });

  test('synthetic IWAD missing S_START surfaces a typed error from the underlying parser', () => {
    const lumps: readonly SyntheticLump[] = Object.freeze([Object.freeze({ name: 'PLAYPAL', data: Buffer.alloc(8) }), Object.freeze({ name: 'S_END', data: Buffer.alloc(0) })]);
    const wadBuffer = buildSyntheticIwadBuffer(lumps);
    const launchContext = buildSyntheticLaunchContext('./doom1.wad');
    const iwadResourceCache = buildIwadResourceCache(launchContext, buildLoaderReturning(wadBuffer));
    expect(() => wireSpriteFrameCacheFromIwadResourceCache(iwadResourceCache, wadBuffer)).toThrow();
  });

  test('synthetic IWAD missing S_END surfaces a typed error from the underlying parser', () => {
    const lumps: readonly SyntheticLump[] = Object.freeze([Object.freeze({ name: 'PLAYPAL', data: Buffer.alloc(8) }), Object.freeze({ name: 'S_START', data: Buffer.alloc(0) })]);
    const wadBuffer = buildSyntheticIwadBuffer(lumps);
    const launchContext = buildSyntheticLaunchContext('./doom1.wad');
    const iwadResourceCache = buildIwadResourceCache(launchContext, buildLoaderReturning(wadBuffer));
    expect(() => wireSpriteFrameCacheFromIwadResourceCache(iwadResourceCache, wadBuffer)).toThrow();
  });

  if (existsSync(SHAREWARE_WAD_PATH)) {
    test('real shareware DOOM1.WAD: builds a cache with the canonical 483 sprite-namespace entries', () => {
      const wadBuffer = Buffer.from(readFileSync(SHAREWARE_WAD_PATH));
      const launchContext = buildSyntheticLaunchContext('./doom1.wad');
      const iwadResourceCache = buildIwadResourceCache(launchContext, buildLoaderReturning(wadBuffer));
      const spriteCache = wireSpriteFrameCacheFromIwadResourceCache(iwadResourceCache, wadBuffer);
      expect(spriteCache.entries.length).toBe(SHAREWARE_SPRITE_NAMESPACE_ENTRY_COUNT);
      expect(spriteCache.namespace.entries.length).toBe(SHAREWARE_SPRITE_NAMESPACE_ENTRY_COUNT);
      expect(spriteCache.spriteOffsets.length).toBe(SHAREWARE_SPRITE_NAMESPACE_ENTRY_COUNT);
      expect(spriteCache.spriteWidths.length).toBe(SHAREWARE_SPRITE_NAMESPACE_ENTRY_COUNT);
      expect(spriteCache.spriteNameToNumber.has('PLAYA1')).toBe(true);
    });

    test('real shareware DOOM1.WAD: cache entries[0].spriteNumber === 0 (firstspritelump-relative)', () => {
      const wadBuffer = Buffer.from(readFileSync(SHAREWARE_WAD_PATH));
      const launchContext = buildSyntheticLaunchContext('./doom1.wad');
      const iwadResourceCache = buildIwadResourceCache(launchContext, buildLoaderReturning(wadBuffer));
      const spriteCache = wireSpriteFrameCacheFromIwadResourceCache(iwadResourceCache, wadBuffer);
      expect(spriteCache.entries[0]!.spriteNumber).toBe(0);
      const last = spriteCache.entries[spriteCache.entries.length - 1]!;
      expect(last.spriteNumber).toBe(SHAREWARE_SPRITE_NAMESPACE_ENTRY_COUNT - 1);
    });
  } else {
    test.skip('real shareware DOOM1.WAD oracle skipped (reference bundle absent at doom/DOOM1.WAD)', () => {});
  }
});
