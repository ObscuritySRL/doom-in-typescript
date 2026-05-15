import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DIRECTORY_ENTRY_SIZE } from '../../../src/wad/directory.ts';
import { WAD_HEADER_SIZE } from '../../../src/wad/header.ts';
import { parseCommandLineConfiguration } from '../../../src/vanilla/commandLineConfiguration.ts';
import { buildIwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import type { IwadFileLoader, IwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import { resolveLaunchContext } from '../../../src/vanilla/launchContext.ts';
import type { LaunchContextEnvironment } from '../../../src/vanilla/launchContext.ts';
import { VANILLA_PLAYER_SLOT_COUNT, createVanillaRuntimeContext } from '../../../src/vanilla/runtimeContext.ts';
import type { VanillaRuntimeContext } from '../../../src/vanilla/runtimeContext.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const RUNTIME_CONTEXT_RELATIVE_PATH = 'src/vanilla/runtimeContext.ts';
const RUNTIME_CONTEXT_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, RUNTIME_CONTEXT_RELATIVE_PATH);

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

function buildLoaderForBuffer(buffer: Buffer): IwadFileLoader {
  return Object.freeze({
    readFile: () => buffer,
  });
}

const EMPTY_ENVIRONMENT: LaunchContextEnvironment = Object.freeze({
  doesBasenameExistInWadDirectory: () => false,
  doomWadDirectoryEnvironmentValue: null,
});

const SHAREWARE_LUMPS: readonly SyntheticLump[] = Object.freeze([
  Object.freeze({ data: Buffer.alloc(8), name: 'PLAYPAL' }),
  Object.freeze({ data: Buffer.alloc(4), name: 'COLORMAP' }),
  Object.freeze({ data: Buffer.alloc(0), name: 'E1M1' }),
  Object.freeze({ data: Buffer.alloc(0), name: 'E1M9' }),
]);

const RETAIL_LUMPS: readonly SyntheticLump[] = Object.freeze([
  Object.freeze({ data: Buffer.alloc(8), name: 'PLAYPAL' }),
  Object.freeze({ data: Buffer.alloc(0), name: 'E1M1' }),
  Object.freeze({ data: Buffer.alloc(0), name: 'E3M1' }),
  Object.freeze({ data: Buffer.alloc(0), name: 'E4M1' }),
]);

function buildShareWareRuntimeContext(): VanillaRuntimeContext {
  const configuration = parseCommandLineConfiguration(['doom_codex', '-iwad', SYNTHETIC_WAD_RESOLVED_PATH]);
  const launchContext = resolveLaunchContext(configuration, EMPTY_ENVIRONMENT);
  const resourceCache: IwadResourceCache = buildIwadResourceCache(launchContext, buildLoaderForBuffer(buildSyntheticIwadBuffer('IWAD', SHAREWARE_LUMPS)));
  return createVanillaRuntimeContext(launchContext, resourceCache);
}

describe('plan_final runtime: create-vanilla-runtime-context', () => {
  test('src/vanilla/runtimeContext.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(RUNTIME_CONTEXT_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(RUNTIME_CONTEXT_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/runtimeContext.ts cites plan_final step 04-001 in a top-of-file comment', () => {
    const fileText = readFileSync(RUNTIME_CONTEXT_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('04-001');
    expect(fileText).toContain('createVanillaRuntimeContext');
  });

  test('src/vanilla/runtimeContext.ts imports the launchContext, iwadResourceCache, and win32WindowHost wrappers without modifying them', () => {
    const fileText = readFileSync(RUNTIME_CONTEXT_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from './launchContext.ts'");
    expect(fileText).toContain("from './iwadResourceCache.ts'");
    expect(fileText).toContain("from './win32WindowHost.ts'");
    expect(fileText).toContain("from '../bootstrap/gameMode.ts'");
  });

  test('createVanillaRuntimeContext is exported as a function accepting (launchContext, resourceCache)', () => {
    expect(typeof createVanillaRuntimeContext).toBe('function');
    expect(createVanillaRuntimeContext.length).toBe(2);
  });

  test('VANILLA_PLAYER_SLOT_COUNT pins the canonical MAXPLAYERS = 4', () => {
    expect(VANILLA_PLAYER_SLOT_COUNT).toBe(4);
  });

  test('runtime context is frozen at the top level', () => {
    const runtime = buildShareWareRuntimeContext();
    expect(Object.isFrozen(runtime)).toBe(true);
  });

  test('runtime context exposes launchContext and resourceCache verbatim from the inputs', () => {
    const configuration = parseCommandLineConfiguration(['doom_codex', '-iwad', SYNTHETIC_WAD_RESOLVED_PATH]);
    const launchContext = resolveLaunchContext(configuration, EMPTY_ENVIRONMENT);
    const resourceCache = buildIwadResourceCache(launchContext, buildLoaderForBuffer(buildSyntheticIwadBuffer('IWAD', SHAREWARE_LUMPS)));
    const runtime = createVanillaRuntimeContext(launchContext, resourceCache);
    expect(runtime.launchContext).toBe(launchContext);
    expect(runtime.resourceCache).toBe(resourceCache);
  });

  test('runtime context flattens gameIdentification fields for downstream ergonomic access', () => {
    const runtime = buildShareWareRuntimeContext();
    expect(runtime.gameMode).toBe('shareware');
    expect(runtime.gameMission).toBe('doom');
    expect(runtime.gameDescription).toBe('DOOM Shareware');
    expect(runtime.episodeCount).toBe(1);
    expect(runtime.gameIdentification).toBe(runtime.resourceCache.gameIdentification);
  });

  test('runtime context game-mode flattening reflects the IWAD lump contents (retail IWAD → retail gameMode, episodeCount=4)', () => {
    const configuration = parseCommandLineConfiguration(['doom_codex', '-iwad', './doom.wad']);
    const launchContext = resolveLaunchContext(configuration, EMPTY_ENVIRONMENT);
    const resourceCache = buildIwadResourceCache(launchContext, buildLoaderForBuffer(buildSyntheticIwadBuffer('IWAD', RETAIL_LUMPS)));
    const runtime = createVanillaRuntimeContext(launchContext, resourceCache);
    expect(runtime.gameMode).toBe('retail');
    expect(runtime.episodeCount).toBe(4);
  });

  test('runtime context exposes a frozen playerSlots array of length VANILLA_PLAYER_SLOT_COUNT', () => {
    const runtime = buildShareWareRuntimeContext();
    expect(runtime.playerSlots.length).toBe(VANILLA_PLAYER_SLOT_COUNT);
    expect(Object.isFrozen(runtime.playerSlots)).toBe(true);
  });

  test('every player slot starts unoccupied (present=false, player=null) and exposes its zero-based index', () => {
    const runtime = buildShareWareRuntimeContext();
    for (let slotIndex = 0; slotIndex < VANILLA_PLAYER_SLOT_COUNT; slotIndex += 1) {
      const slot = runtime.playerSlots[slotIndex]!;
      expect(slot.index).toBe(slotIndex);
      expect(slot.present).toBe(false);
      expect(slot.player).toBeNull();
      expect(Object.isFrozen(slot)).toBe(true);
    }
  });

  test('runtime context mapState starts empty (current=null)', () => {
    const runtime = buildShareWareRuntimeContext();
    expect(runtime.mapState.current).toBeNull();
  });

  test('runtime context audioState starts silent (no music playing, no sfx channels)', () => {
    const runtime = buildShareWareRuntimeContext();
    expect(runtime.audioState.musicPlaying).toBe(false);
    expect(runtime.audioState.sfxChannels.length).toBe(0);
  });

  test('runtime context uiState starts at the vanilla initial state (HUD visible, automap/menu closed, no intermission)', () => {
    const runtime = buildShareWareRuntimeContext();
    expect(runtime.uiState.hudVisible).toBe(true);
    expect(runtime.uiState.automapOpen).toBe(false);
    expect(runtime.uiState.menuOpen).toBe(false);
    expect(runtime.uiState.intermissionPhase).toBeNull();
  });

  test('runtime context exposes a frozen framebuffers pair, each 64000 bytes and zero-filled', () => {
    const runtime = buildShareWareRuntimeContext();
    expect(Object.isFrozen(runtime.framebuffers)).toBe(true);
    expect(runtime.framebuffers.primary).toBeInstanceOf(Uint8Array);
    expect(runtime.framebuffers.back).toBeInstanceOf(Uint8Array);
    expect(runtime.framebuffers.primary.length).toBe(64_000);
    expect(runtime.framebuffers.back.length).toBe(64_000);
    expect(runtime.framebuffers.primary[0]).toBe(0);
    expect(runtime.framebuffers.back[0]).toBe(0);
  });

  test('runtime context primary and back framebuffers are independent allocations (mutating one does not affect the other)', () => {
    const runtime = buildShareWareRuntimeContext();
    runtime.framebuffers.primary[0] = 0xff;
    expect(runtime.framebuffers.back[0]).toBe(0);
  });

  test('two runtime contexts built from the same inputs allocate independent framebuffer buffers', () => {
    const firstRuntime = buildShareWareRuntimeContext();
    const secondRuntime = buildShareWareRuntimeContext();
    expect(firstRuntime.framebuffers.primary).not.toBe(secondRuntime.framebuffers.primary);
    expect(firstRuntime.framebuffers.back).not.toBe(secondRuntime.framebuffers.back);
    firstRuntime.framebuffers.primary[100] = 0x77;
    expect(secondRuntime.framebuffers.primary[100]).toBe(0);
  });
});
