import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { INIT_ORDER, INIT_STEP_COUNT } from '../../../src/bootstrap/initOrder.ts';
import { DIRECTORY_ENTRY_SIZE } from '../../../src/wad/directory.ts';
import { WAD_HEADER_SIZE } from '../../../src/wad/header.ts';
import { D_DOOM_MAIN_INIT_ORDER, VanillaDDoomMainInitError, runDDoomMainInit } from '../../../src/vanilla/dDoomMain.ts';
import type { VanillaDDoomMainInitStep } from '../../../src/vanilla/dDoomMain.ts';
import { parseCommandLineConfiguration } from '../../../src/vanilla/commandLineConfiguration.ts';
import { buildIwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import type { IwadFileLoader } from '../../../src/vanilla/iwadResourceCache.ts';
import { resolveLaunchContext } from '../../../src/vanilla/launchContext.ts';
import type { LaunchContextEnvironment } from '../../../src/vanilla/launchContext.ts';
import { createVanillaRuntimeContext } from '../../../src/vanilla/runtimeContext.ts';
import type { VanillaRuntimeContext } from '../../../src/vanilla/runtimeContext.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const D_DOOM_MAIN_RELATIVE_PATH = 'src/vanilla/dDoomMain.ts';
const D_DOOM_MAIN_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, D_DOOM_MAIN_RELATIVE_PATH);

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

function buildShareWareRuntimeContext(): VanillaRuntimeContext {
  const configuration = parseCommandLineConfiguration(['doom_codex', '-iwad', SYNTHETIC_WAD_RESOLVED_PATH]);
  const launchContext = resolveLaunchContext(configuration, EMPTY_ENVIRONMENT);
  const resourceCache = buildIwadResourceCache(launchContext, buildLoaderForBuffer(buildSyntheticIwadBuffer('IWAD', SHAREWARE_LUMPS)));
  return createVanillaRuntimeContext(launchContext, resourceCache);
}

describe('plan_final runtime: wire-d-doommain-init-order', () => {
  test('src/vanilla/dDoomMain.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(D_DOOM_MAIN_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(D_DOOM_MAIN_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/dDoomMain.ts cites plan_final step 04-002 and the runDDoomMainInit symbol in a top-of-file comment', () => {
    const fileText = readFileSync(D_DOOM_MAIN_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('04-002');
    expect(fileText).toContain('runDDoomMainInit');
    expect(fileText).toContain('D_DOOM_MAIN_INIT_ORDER');
  });

  test('D_DOOM_MAIN_INIT_ORDER is frozen and contains exactly INIT_STEP_COUNT entries', () => {
    expect(Object.isFrozen(D_DOOM_MAIN_INIT_ORDER)).toBe(true);
    expect(D_DOOM_MAIN_INIT_ORDER.length).toBe(INIT_STEP_COUNT);
  });

  test('every D_DOOM_MAIN_INIT_ORDER entry is frozen and exposes label/description/run', () => {
    for (const step of D_DOOM_MAIN_INIT_ORDER) {
      expect(Object.isFrozen(step)).toBe(true);
      expect(typeof step.label).toBe('string');
      expect(typeof step.description).toBe('string');
      expect(typeof step.run).toBe('function');
    }
  });

  test('D_DOOM_MAIN_INIT_ORDER labels and descriptions match src/bootstrap/initOrder.ts INIT_ORDER positionally', () => {
    for (let stepIndex = 0; stepIndex < INIT_ORDER.length; stepIndex += 1) {
      const orchestratorStep = D_DOOM_MAIN_INIT_ORDER[stepIndex]!;
      const canonicalStep = INIT_ORDER[stepIndex]!;
      expect(orchestratorStep.label).toBe(canonicalStep.label);
      expect(orchestratorStep.description).toBe(canonicalStep.description);
    }
  });

  test('D_DOOM_MAIN_INIT_ORDER opens with the early phase (Z_Init, V_Init, M_LoadDefaults) in vanilla order', () => {
    expect(D_DOOM_MAIN_INIT_ORDER[0]!.label).toBe('Z_Init');
    expect(D_DOOM_MAIN_INIT_ORDER[1]!.label).toBe('V_Init');
    expect(D_DOOM_MAIN_INIT_ORDER[2]!.label).toBe('M_LoadDefaults');
  });

  test('D_DOOM_MAIN_INIT_ORDER places W_Init at index 3 (wad-load phase boundary)', () => {
    expect(D_DOOM_MAIN_INIT_ORDER[3]!.label).toBe('W_Init');
  });

  test('D_DOOM_MAIN_INIT_ORDER closes with I_InitStretchTables (final post-identify step)', () => {
    expect(D_DOOM_MAIN_INIT_ORDER[INIT_STEP_COUNT - 1]!.label).toBe('I_InitStretchTables');
  });

  test('runDDoomMainInit calls every step exactly once in canonical index order against the supplied context', async () => {
    const runtime = buildShareWareRuntimeContext();
    const callLog: { readonly index: number; readonly label: string; readonly context: VanillaRuntimeContext }[] = [];
    const spiedOrder: readonly VanillaDDoomMainInitStep[] = D_DOOM_MAIN_INIT_ORDER.map((step, stepIndex) => ({
      description: step.description,
      label: step.label,
      run: (calledContext) => {
        callLog.push({ context: calledContext, index: stepIndex, label: step.label });
      },
    }));

    await runDDoomMainInit(runtime, spiedOrder);

    expect(callLog.length).toBe(INIT_STEP_COUNT);
    for (let stepIndex = 0; stepIndex < INIT_STEP_COUNT; stepIndex += 1) {
      expect(callLog[stepIndex]!.index).toBe(stepIndex);
      expect(callLog[stepIndex]!.label).toBe(D_DOOM_MAIN_INIT_ORDER[stepIndex]!.label);
      expect(callLog[stepIndex]!.context).toBe(runtime);
    }
  });

  test('runDDoomMainInit awaits async step.run results before advancing to the next step', async () => {
    const runtime = buildShareWareRuntimeContext();
    const callOrder: number[] = [];
    const asyncOrder: readonly VanillaDDoomMainInitStep[] = Object.freeze([
      Object.freeze({
        description: 'first',
        label: 'StepOne',
        run: async () => {
          await Promise.resolve();
          callOrder.push(1);
        },
      } satisfies VanillaDDoomMainInitStep),
      Object.freeze({
        description: 'second',
        label: 'StepTwo',
        run: () => {
          callOrder.push(2);
        },
      } satisfies VanillaDDoomMainInitStep),
    ]);

    await runDDoomMainInit(runtime, asyncOrder);

    expect(callOrder).toEqual([1, 2]);
  });

  test('runDDoomMainInit aborts the chain when a step throws and wraps the cause in VanillaDDoomMainInitError', async () => {
    const runtime = buildShareWareRuntimeContext();
    const failureCause = new Error('synthetic init failure');
    let postFailureRan = false;
    const failingOrder: readonly VanillaDDoomMainInitStep[] = Object.freeze([
      Object.freeze({ description: 'first', label: 'StepOne', run: () => {} } satisfies VanillaDDoomMainInitStep),
      Object.freeze({
        description: 'second',
        label: 'StepTwo',
        run: () => {
          throw failureCause;
        },
      } satisfies VanillaDDoomMainInitStep),
      Object.freeze({
        description: 'third',
        label: 'StepThree',
        run: () => {
          postFailureRan = true;
        },
      } satisfies VanillaDDoomMainInitStep),
    ]);

    let caught: unknown = null;
    try {
      await runDDoomMainInit(runtime, failingOrder);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VanillaDDoomMainInitError);
    const initError = caught as VanillaDDoomMainInitError;
    expect(initError.stepLabel).toBe('StepTwo');
    expect(initError.stepIndex).toBe(1);
    expect(initError.cause).toBe(failureCause);
    expect(postFailureRan).toBe(false);
  });

  test('runDDoomMainInit defaults to the canonical D_DOOM_MAIN_INIT_ORDER when no custom order is supplied', async () => {
    const runtime = buildShareWareRuntimeContext();
    await expect(runDDoomMainInit(runtime)).resolves.toBeUndefined();
  });

  test('runDDoomMainInit accepts a step.run that returns a rejected promise and wraps the rejection cause', async () => {
    const runtime = buildShareWareRuntimeContext();
    const rejection = new Error('async init reject');
    const asyncFailingOrder: readonly VanillaDDoomMainInitStep[] = Object.freeze([
      Object.freeze({
        description: 'rejecting',
        label: 'AsyncReject',
        run: async () => {
          await Promise.resolve();
          throw rejection;
        },
      } satisfies VanillaDDoomMainInitStep),
    ]);

    let caught: unknown = null;
    try {
      await runDDoomMainInit(runtime, asyncFailingOrder);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VanillaDDoomMainInitError);
    expect((caught as VanillaDDoomMainInitError).cause).toBe(rejection);
    expect((caught as VanillaDDoomMainInitError).stepIndex).toBe(0);
  });
});
