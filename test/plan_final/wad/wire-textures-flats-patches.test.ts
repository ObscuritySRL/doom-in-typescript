import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import type { IwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import { TexturesAndFlatsError, VANILLA_PNAMES_LUMP_NAME, VANILLA_TEXTURE1_LUMP_NAME, VANILLA_TEXTURE2_LUMP_NAME, buildTexturesAndFlats } from '../../../src/vanilla/texturesAndFlats.ts';
import type { LumpReader, TexturesAndFlatsResources } from '../../../src/vanilla/texturesAndFlats.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const TEXTURES_AND_FLATS_RELATIVE_PATH = 'src/vanilla/texturesAndFlats.ts';
const TEXTURES_AND_FLATS_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, TEXTURES_AND_FLATS_RELATIVE_PATH);

function writeAsciiNullPadded(target: Buffer, offset: number, value: string, fieldSize: number): void {
  for (let index = 0; index < fieldSize; index += 1) {
    target.writeUInt8(index < value.length ? value.charCodeAt(index) & 0xff : 0, offset + index);
  }
}

function buildSyntheticPnames(names: readonly string[]): Uint8Array {
  const buffer = Buffer.alloc(4 + names.length * 8);
  buffer.writeInt32LE(names.length, 0);
  for (let index = 0; index < names.length; index += 1) {
    writeAsciiNullPadded(buffer, 4 + index * 8, names[index]!.toUpperCase(), 8);
  }
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

interface SyntheticTexture {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly masked: boolean;
  readonly patches: readonly { readonly originX: number; readonly originY: number; readonly patchIndex: number }[];
}

function buildSyntheticTextureLump(textures: readonly SyntheticTexture[]): Uint8Array {
  const headerSize = 4 + textures.length * 4;
  const textureDefinitionSizes = textures.map((texture) => 22 + texture.patches.length * 10);
  const totalSize = headerSize + textureDefinitionSizes.reduce((sum, size) => sum + size, 0);
  const buffer = Buffer.alloc(totalSize);
  buffer.writeInt32LE(textures.length, 0);
  let currentDefinitionOffset = headerSize;
  for (let index = 0; index < textures.length; index += 1) {
    buffer.writeInt32LE(currentDefinitionOffset, 4 + index * 4);
    currentDefinitionOffset += textureDefinitionSizes[index]!;
  }
  let writeOffset = headerSize;
  for (const texture of textures) {
    writeAsciiNullPadded(buffer, writeOffset, texture.name.toUpperCase(), 8);
    buffer.writeInt32LE(texture.masked ? 1 : 0, writeOffset + 8);
    buffer.writeInt16LE(texture.width, writeOffset + 12);
    buffer.writeInt16LE(texture.height, writeOffset + 14);
    buffer.writeInt32LE(0, writeOffset + 16);
    buffer.writeInt16LE(texture.patches.length, writeOffset + 20);
    writeOffset += 22;
    for (const patch of texture.patches) {
      buffer.writeInt16LE(patch.originX, writeOffset);
      buffer.writeInt16LE(patch.originY, writeOffset + 2);
      buffer.writeInt16LE(patch.patchIndex, writeOffset + 4);
      buffer.writeInt16LE(0, writeOffset + 6);
      buffer.writeInt16LE(0, writeOffset + 8);
      writeOffset += 10;
    }
  }
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function syntheticDirectoryEntry(name: string, size: number): DirectoryEntry {
  return Object.freeze({ name, offset: 0, size });
}

interface StubCacheOptions {
  readonly directory: readonly DirectoryEntry[];
}

function buildStubResourceCache(options: StubCacheOptions): IwadResourceCache {
  const directory = options.directory;
  return {
    directory,
    findLump: (lumpName: string): DirectoryEntry | null => {
      for (let index = directory.length - 1; index >= 0; index -= 1) {
        if (directory[index]!.name === lumpName) {
          return directory[index]!;
        }
      }
      return null;
    },
    gameIdentification: Object.freeze({ episodeCount: 1, gameDescription: 'DOOM Shareware', gameMission: 'doom', gameMode: 'shareware' }),
    getAllIndicesForName: (): readonly number[] => Object.freeze([]),
    hasLump: (lumpName: string): boolean => directory.some((entry) => entry.name === lumpName),
    lumpCount: directory.length,
    resolvedPath: 'synthetic://stub.wad',
    wadHeader: Object.freeze({ directoryOffset: 0, lumpCount: directory.length, type: 'IWAD' }),
  };
}

function buildLumpReader(payloads: Record<string, Uint8Array>): LumpReader {
  return Object.freeze({
    readLumpBytes: (entry: DirectoryEntry): Uint8Array => {
      const payload = payloads[entry.name];
      if (payload === undefined) {
        throw new Error(`no payload registered for entry ${entry.name}`);
      }
      return payload;
    },
  });
}

function buildHappyDirectoryAndPayloads(options: { readonly includeTexture2: boolean }): { readonly directory: readonly DirectoryEntry[]; readonly payloads: Record<string, Uint8Array> } {
  const pnamesBytes = buildSyntheticPnames(['WALL00_3', 'WALL01_1']);
  const textures1Bytes = buildSyntheticTextureLump([{ height: 128, masked: false, name: 'AASTINKY', patches: [{ originX: 0, originY: 0, patchIndex: 0 }], width: 64 }]);
  const textures2Bytes = buildSyntheticTextureLump([{ height: 128, masked: false, name: 'ASHWALL2', patches: [{ originX: 0, originY: 0, patchIndex: 1 }], width: 64 }]);
  const directory: DirectoryEntry[] = [syntheticDirectoryEntry(VANILLA_PNAMES_LUMP_NAME, pnamesBytes.length), syntheticDirectoryEntry(VANILLA_TEXTURE1_LUMP_NAME, textures1Bytes.length)];
  const payloads: Record<string, Uint8Array> = {
    [VANILLA_PNAMES_LUMP_NAME]: pnamesBytes,
    [VANILLA_TEXTURE1_LUMP_NAME]: textures1Bytes,
  };
  if (options.includeTexture2) {
    directory.push(syntheticDirectoryEntry(VANILLA_TEXTURE2_LUMP_NAME, textures2Bytes.length));
    payloads[VANILLA_TEXTURE2_LUMP_NAME] = textures2Bytes;
  }
  directory.push(syntheticDirectoryEntry('P_START', 0));
  directory.push(syntheticDirectoryEntry('WALL00_3', 4096));
  directory.push(syntheticDirectoryEntry('WALL01_1', 4096));
  directory.push(syntheticDirectoryEntry('P_END', 0));
  directory.push(syntheticDirectoryEntry('F_START', 0));
  directory.push(syntheticDirectoryEntry('FLOOR0_1', 4096));
  directory.push(syntheticDirectoryEntry('FLOOR0_2', 4096));
  directory.push(syntheticDirectoryEntry('F_END', 0));
  return { directory, payloads };
}

describe('plan_final wad: wire-textures-flats-patches', () => {
  test('src/vanilla/texturesAndFlats.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(TEXTURES_AND_FLATS_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(TEXTURES_AND_FLATS_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/texturesAndFlats.ts cites plan_final step 05-003 in a top-of-file comment', () => {
    const fileText = readFileSync(TEXTURES_AND_FLATS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('05-003');
    expect(fileText).toContain('buildTexturesAndFlats');
  });

  test('src/vanilla/texturesAndFlats.ts imports the read-only parsers (parsePnames, parseTextureLump, buildFlatCatalog, buildPatchCatalog) without modifying them', () => {
    const fileText = readFileSync(TEXTURES_AND_FLATS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../assets/pnames.ts'");
    expect(fileText).toContain("from '../assets/texture1.ts'");
    expect(fileText).toContain("from '../assets/flats.ts'");
    expect(fileText).toContain("from '../assets/patchCatalog.ts'");
    expect(fileText).toContain('parsePnames');
    expect(fileText).toContain('parseTextureLump');
    expect(fileText).toContain('buildFlatCatalog');
    expect(fileText).toContain('buildPatchCatalog');
  });

  test('VANILLA_PNAMES_LUMP_NAME / VANILLA_TEXTURE1_LUMP_NAME / VANILLA_TEXTURE2_LUMP_NAME pin the canonical basenames', () => {
    expect(VANILLA_PNAMES_LUMP_NAME).toBe('PNAMES');
    expect(VANILLA_TEXTURE1_LUMP_NAME).toBe('TEXTURE1');
    expect(VANILLA_TEXTURE2_LUMP_NAME).toBe('TEXTURE2');
  });

  test('buildTexturesAndFlats happy path returns parsed PNAMES, TEXTURE1, null TEXTURE2 for shareware, and full patch+flat catalogs', () => {
    const { directory, payloads } = buildHappyDirectoryAndPayloads({ includeTexture2: false });
    const resources: TexturesAndFlatsResources = buildTexturesAndFlats(buildStubResourceCache({ directory }), buildLumpReader(payloads));
    expect(resources.patchNames).toEqual(['WALL00_3', 'WALL01_1']);
    expect(resources.textures1.length).toBe(1);
    expect(resources.textures1[0]!.name).toBe('AASTINKY');
    expect(resources.textures1[0]!.width).toBe(64);
    expect(resources.textures1[0]!.height).toBe(128);
    expect(resources.textures1[0]!.patches[0]!.patchIndex).toBe(0);
    expect(resources.textures2).toBeNull();
    expect(resources.patchCatalog.count).toBe(2);
    expect(resources.patchCatalog.dataCount).toBe(2);
    expect(resources.flatCatalog.count).toBe(2);
    expect(resources.flatCatalog.dataCount).toBe(2);
  });

  test('buildTexturesAndFlats includes TEXTURE2 when present in the directory', () => {
    const { directory, payloads } = buildHappyDirectoryAndPayloads({ includeTexture2: true });
    const resources = buildTexturesAndFlats(buildStubResourceCache({ directory }), buildLumpReader(payloads));
    expect(resources.textures2).not.toBeNull();
    expect(resources.textures2!.length).toBe(1);
    expect(resources.textures2![0]!.name).toBe('ASHWALL2');
  });

  test('buildTexturesAndFlats returns a frozen result', () => {
    const { directory, payloads } = buildHappyDirectoryAndPayloads({ includeTexture2: false });
    const resources = buildTexturesAndFlats(buildStubResourceCache({ directory }), buildLumpReader(payloads));
    expect(Object.isFrozen(resources)).toBe(true);
  });

  test('buildTexturesAndFlats throws TexturesAndFlatsError with reason pnames-lump-missing when PNAMES is absent', () => {
    const { directory, payloads } = buildHappyDirectoryAndPayloads({ includeTexture2: false });
    const filteredDirectory = directory.filter((entry) => entry.name !== VANILLA_PNAMES_LUMP_NAME);
    let caughtError: unknown;
    try {
      buildTexturesAndFlats(buildStubResourceCache({ directory: filteredDirectory }), buildLumpReader(payloads));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(TexturesAndFlatsError);
    expect((caughtError as TexturesAndFlatsError).reason).toBe('pnames-lump-missing');
    expect((caughtError as TexturesAndFlatsError).identifier).toBe('PNAMES');
  });

  test('buildTexturesAndFlats throws TexturesAndFlatsError with reason texture1-lump-missing when TEXTURE1 is absent', () => {
    const { directory, payloads } = buildHappyDirectoryAndPayloads({ includeTexture2: false });
    const filteredDirectory = directory.filter((entry) => entry.name !== VANILLA_TEXTURE1_LUMP_NAME);
    let caughtError: unknown;
    try {
      buildTexturesAndFlats(buildStubResourceCache({ directory: filteredDirectory }), buildLumpReader(payloads));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(TexturesAndFlatsError);
    expect((caughtError as TexturesAndFlatsError).reason).toBe('texture1-lump-missing');
  });

  test('buildTexturesAndFlats throws TexturesAndFlatsError with reason pnames-lump-malformed when PNAMES bytes are too short', () => {
    const { directory } = buildHappyDirectoryAndPayloads({ includeTexture2: false });
    const malformedReader = buildLumpReader({
      [VANILLA_PNAMES_LUMP_NAME]: new Uint8Array(1),
      [VANILLA_TEXTURE1_LUMP_NAME]: buildSyntheticTextureLump([{ height: 128, masked: false, name: 'AASTINKY', patches: [], width: 64 }]),
    });
    let caughtError: unknown;
    try {
      buildTexturesAndFlats(buildStubResourceCache({ directory }), malformedReader);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(TexturesAndFlatsError);
    expect((caughtError as TexturesAndFlatsError).reason).toBe('pnames-lump-malformed');
  });

  test('buildTexturesAndFlats throws TexturesAndFlatsError with reason texture1-lump-malformed when TEXTURE1 bytes are unparseable', () => {
    const { directory } = buildHappyDirectoryAndPayloads({ includeTexture2: false });
    const malformedReader = buildLumpReader({
      [VANILLA_PNAMES_LUMP_NAME]: buildSyntheticPnames(['WALL00_3']),
      [VANILLA_TEXTURE1_LUMP_NAME]: new Uint8Array(2),
    });
    let caughtError: unknown;
    try {
      buildTexturesAndFlats(buildStubResourceCache({ directory }), malformedReader);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(TexturesAndFlatsError);
    expect((caughtError as TexturesAndFlatsError).reason).toBe('texture1-lump-malformed');
  });

  test('buildTexturesAndFlats throws TexturesAndFlatsError with reason patch-markers-missing when P_START/P_END are absent', () => {
    const { directory, payloads } = buildHappyDirectoryAndPayloads({ includeTexture2: false });
    const filteredDirectory = directory.filter((entry) => entry.name !== 'P_START');
    let caughtError: unknown;
    try {
      buildTexturesAndFlats(buildStubResourceCache({ directory: filteredDirectory }), buildLumpReader(payloads));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(TexturesAndFlatsError);
    expect((caughtError as TexturesAndFlatsError).reason).toBe('patch-markers-missing');
    expect((caughtError as TexturesAndFlatsError).identifier).toBe('P_START..P_END');
  });

  test('buildTexturesAndFlats throws TexturesAndFlatsError with reason flat-markers-missing when F_START/F_END are absent', () => {
    const { directory, payloads } = buildHappyDirectoryAndPayloads({ includeTexture2: false });
    const filteredDirectory = directory.filter((entry) => entry.name !== 'F_END');
    let caughtError: unknown;
    try {
      buildTexturesAndFlats(buildStubResourceCache({ directory: filteredDirectory }), buildLumpReader(payloads));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(TexturesAndFlatsError);
    expect((caughtError as TexturesAndFlatsError).reason).toBe('flat-markers-missing');
    expect((caughtError as TexturesAndFlatsError).identifier).toBe('F_START..F_END');
  });

  test('buildTexturesAndFlats includes inner markers in patchCatalog.count but excludes them from dataCount', () => {
    const { directory, payloads } = buildHappyDirectoryAndPayloads({ includeTexture2: false });
    const directoryWithInnerMarkers: DirectoryEntry[] = [];
    for (const entry of directory) {
      if (entry.name === 'P_START') {
        directoryWithInnerMarkers.push(entry);
        directoryWithInnerMarkers.push(syntheticDirectoryEntry('P1_START', 0));
        continue;
      }
      if (entry.name === 'P_END') {
        directoryWithInnerMarkers.push(syntheticDirectoryEntry('P1_END', 0));
        directoryWithInnerMarkers.push(entry);
        continue;
      }
      directoryWithInnerMarkers.push(entry);
    }
    const resources = buildTexturesAndFlats(buildStubResourceCache({ directory: directoryWithInnerMarkers }), buildLumpReader(payloads));
    expect(resources.patchCatalog.count).toBe(4);
    expect(resources.patchCatalog.dataCount).toBe(2);
  });
});
