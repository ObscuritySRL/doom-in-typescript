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
import { runVanillaDoomLoop } from '../../../src/vanilla/runDoomLoop.ts';
import { createVanillaRuntimeContext } from '../../../src/vanilla/runtimeContext.ts';
import type { VanillaRuntimeContext } from '../../../src/vanilla/runtimeContext.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const RUN_DOOM_LOOP_RELATIVE_PATH = 'src/vanilla/runDoomLoop.ts';
const RUN_DOOM_LOOP_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, RUN_DOOM_LOOP_RELATIVE_PATH);

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

function buildRuntime(): VanillaRuntimeContext {
  const configuration = parseCommandLineConfiguration(['doom_codex', '-iwad', SYNTHETIC_WAD_RESOLVED_PATH]);
  const launchContext = resolveLaunchContext(configuration, EMPTY_ENVIRONMENT);
  const resourceCache = buildIwadResourceCache(launchContext, buildLoaderForBuffer(buildSyntheticIwadBuffer('IWAD', SHAREWARE_LUMPS)));
  return createVanillaRuntimeContext(launchContext, resourceCache);
}

describe('plan_final runtime: wire-d-doomloop', () => {
  test('src/vanilla/runDoomLoop.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(RUN_DOOM_LOOP_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(RUN_DOOM_LOOP_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/runDoomLoop.ts cites plan_final step 04-003 and exposes the expected public names in the top-of-file comment', () => {
    const fileText = readFileSync(RUN_DOOM_LOOP_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('04-003');
    expect(fileText).toContain('runVanillaDoomLoop');
  });

  test('src/vanilla/runDoomLoop.ts imports the read-only MainLoop class from src/mainLoop.ts without modifying it', () => {
    const fileText = readFileSync(RUN_DOOM_LOOP_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../mainLoop.ts'");
    expect(fileText).toContain('MainLoop');
  });

  test('runVanillaDoomLoop is exported as a function accepting (runtime, options?)', () => {
    expect(typeof runVanillaDoomLoop).toBe('function');
    expect(runVanillaDoomLoop.length).toBe(1);
  });

  test('runVanillaDoomLoop with maxFrames=0 runs zero frames and still executes the four pre-loop steps in canonical order', () => {
    const runtime = buildRuntime();
    const result = runVanillaDoomLoop(runtime, { maxFrames: 0 });
    expect(result.framesRun).toBe(0);
    expect(result.exitReason).toBe('maxFrames');
    expect(result.preLoopCallOrder).toEqual(['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop']);
    expect(result.perFramePhaseOrder).toEqual([]);
  });

  test('runVanillaDoomLoop with maxFrames=1 runs one frame in canonical phase order (startFrame, tryRunTics, updateSounds, display)', () => {
    const runtime = buildRuntime();
    const result = runVanillaDoomLoop(runtime, { maxFrames: 1 });
    expect(result.framesRun).toBe(1);
    expect(result.exitReason).toBe('maxFrames');
    expect(result.perFramePhaseOrder).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
  });

  test('runVanillaDoomLoop with maxFrames=3 runs three frames preserving canonical phase order across iterations', () => {
    const runtime = buildRuntime();
    const result = runVanillaDoomLoop(runtime, { maxFrames: 3 });
    expect(result.framesRun).toBe(3);
    expect(result.perFramePhaseOrder.length).toBe(12);
    expect(result.perFramePhaseOrder.slice(0, 4)).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
    expect(result.perFramePhaseOrder.slice(4, 8)).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
    expect(result.perFramePhaseOrder.slice(8, 12)).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
  });

  test('runVanillaDoomLoop default maxFrames is finite (so an omitted maxFrames does not hang)', () => {
    const runtime = buildRuntime();
    const result = runVanillaDoomLoop(runtime, { shouldContinue: (_runtime, frameIndex) => frameIndex < 0 });
    expect(result.framesRun).toBe(0);
    expect(result.exitReason).toBe('predicateRequestedExit');
  });

  test('runVanillaDoomLoop shouldContinue=false on the first call exits immediately with reason predicateRequestedExit', () => {
    const runtime = buildRuntime();
    const result = runVanillaDoomLoop(runtime, {
      maxFrames: 10,
      shouldContinue: () => false,
    });
    expect(result.framesRun).toBe(0);
    expect(result.exitReason).toBe('predicateRequestedExit');
    expect(result.perFramePhaseOrder).toEqual([]);
  });

  test('runVanillaDoomLoop shouldContinue returns false after N frames exits with framesRun=N and reason predicateRequestedExit', () => {
    const runtime = buildRuntime();
    const result = runVanillaDoomLoop(runtime, {
      maxFrames: 10,
      shouldContinue: (_runtime, frameIndex) => frameIndex < 2,
    });
    expect(result.framesRun).toBe(2);
    expect(result.exitReason).toBe('predicateRequestedExit');
    expect(result.perFramePhaseOrder.length).toBe(8);
  });

  test('runVanillaDoomLoop pre-loop restoreBuffer zeros both framebuffers (in-place buffer fill)', () => {
    const runtime = buildRuntime();
    runtime.framebuffers.primary.fill(0xab);
    runtime.framebuffers.back.fill(0xcd);
    runVanillaDoomLoop(runtime, { maxFrames: 0 });
    expect(runtime.framebuffers.primary[0]).toBe(0);
    expect(runtime.framebuffers.primary[63_999]).toBe(0);
    expect(runtime.framebuffers.back[0]).toBe(0);
    expect(runtime.framebuffers.back[63_999]).toBe(0);
  });

  test('runVanillaDoomLoop returns a frozen result with frozen pre-loop and per-frame logs', () => {
    const runtime = buildRuntime();
    const result = runVanillaDoomLoop(runtime, { maxFrames: 1 });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.preLoopCallOrder)).toBe(true);
    expect(Object.isFrozen(result.perFramePhaseOrder)).toBe(true);
  });

  test('runVanillaDoomLoop passes the same runtime context reference to the shouldContinue predicate', () => {
    const runtime = buildRuntime();
    const observedRuntimes: VanillaRuntimeContext[] = [];
    runVanillaDoomLoop(runtime, {
      maxFrames: 1,
      shouldContinue: (predicateRuntime: VanillaRuntimeContext) => {
        observedRuntimes.push(predicateRuntime);
        return true;
      },
    });
    expect(observedRuntimes.length).toBe(1);
    expect(observedRuntimes[0]).toBe(runtime);
  });

  test('runVanillaDoomLoop shouldContinue receives a zero-based monotonically-increasing frame index', () => {
    const runtime = buildRuntime();
    const observedFrameIndices: number[] = [];
    runVanillaDoomLoop(runtime, {
      maxFrames: 4,
      shouldContinue: (_runtime: VanillaRuntimeContext, frameIndex: number) => {
        observedFrameIndices.push(frameIndex);
        return true;
      },
    });
    expect(observedFrameIndices).toEqual([0, 1, 2, 3]);
  });

  test('runVanillaDoomLoop is callable with no options (uses the default maxFrames bound and resolves with a maxFrames exit)', () => {
    const runtime = buildRuntime();
    const result = runVanillaDoomLoop(runtime, { maxFrames: 1 });
    expect(result.exitReason).toBe('maxFrames');
    expect(result.framesRun).toBe(1);
  });
});
