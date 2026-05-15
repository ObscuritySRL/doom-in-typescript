// Owner-authorized plan supersession (2026-05-15, recorded in
// plan_final/progress/acceptance/13-001.md and the formal plan_final
// governance step 03-011 supersede-doom-ts-skeleton-pins): doom.ts is the
// wired thin entrypoint, not the `export {}` skeleton. The single skeleton
// assertion below is REPLACED with the stricter post-supersession
// wired-entrypoint assertion; the runDoomMain arity / InvalidArgumentError
// contract and clean-exit behavior are preserved verbatim.
import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { InvalidArgumentError, runDoomMain } from '../../../src/vanilla/runDoomMain.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const ROOT_DOOM_TS_RELATIVE_PATH = 'doom.ts';
const ROOT_DOOM_TS_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, ROOT_DOOM_TS_RELATIVE_PATH);
const RUN_DOOM_MAIN_RELATIVE_PATH = 'src/vanilla/runDoomMain.ts';
const RUN_DOOM_MAIN_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, RUN_DOOM_MAIN_RELATIVE_PATH);

interface SubprocessResult {
  readonly exitCode: number;
  readonly stderrText: string;
  readonly stdoutText: string;
}

async function runBunCommand(commandArguments: readonly string[]): Promise<SubprocessResult> {
  const subprocess = Bun.spawn({
    cmd: ['bun', ...commandArguments],
    cwd: REPOSITORY_ROOT_DIRECTORY,
    stderr: 'pipe',
    stdout: 'pipe',
  });

  const [stdoutText, stderrText, exitCode] = await Promise.all([new Response(subprocess.stdout).text(), new Response(subprocess.stderr).text(), subprocess.exited]);

  return { exitCode, stderrText, stdoutText };
}

describe('plan_final launch: replace-root-doom-entrypoint', () => {
  test('src/vanilla/runDoomMain.ts exists at the canonical wrapper-file path and is a regular file', () => {
    expect(existsSync(RUN_DOOM_MAIN_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(RUN_DOOM_MAIN_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/runDoomMain.ts cites plan_final step 03-001 in a top-of-file comment', () => {
    const fileText = readFileSync(RUN_DOOM_MAIN_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('03-001');
    expect(fileText).toContain('runDoomMain');
  });

  test('runDoomMain is exported as a function with an arity of at most one argument', () => {
    expect(typeof runDoomMain).toBe('function');
    expect(runDoomMain.length).toBeLessThanOrEqual(1);
  });

  test('runDoomMain resolves cleanly when called with an empty argv', async () => {
    await expect(runDoomMain([])).resolves.toBeUndefined();
  });

  test('runDoomMain resolves cleanly when called with no argument (default empty argv)', async () => {
    await expect(runDoomMain()).resolves.toBeUndefined();
  });

  test('runDoomMain resolves cleanly when called with a representative vanilla argv shape', async () => {
    await expect(runDoomMain(['--iwad', 'doom/DOOM1.WAD'])).resolves.toBeUndefined();
  });

  test('InvalidArgumentError is exported as a constructor with a stable name field', () => {
    expect(typeof InvalidArgumentError).toBe('function');
    const example = new InvalidArgumentError('example invalid argument');
    expect(example.name).toBe('InvalidArgumentError');
    expect(example).toBeInstanceOf(Error);
    expect(example.message).toBe('example invalid argument');
  });

  test('runDoomMain throws InvalidArgumentError when argv is a non-array object', async () => {
    let caughtError: unknown;
    try {
      await runDoomMain({ iwad: 'doom/DOOM1.WAD' });
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(InvalidArgumentError);
    if (caughtError instanceof InvalidArgumentError) {
      expect(caughtError.name).toBe('InvalidArgumentError');
      expect(caughtError.message).toContain('readonly string[]');
      expect(caughtError.message).toContain('object');
    }
  });

  test('runDoomMain throws InvalidArgumentError when argv is a number', async () => {
    let caughtError: unknown;
    try {
      await runDoomMain(42);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(InvalidArgumentError);
    if (caughtError instanceof InvalidArgumentError) {
      expect(caughtError.name).toBe('InvalidArgumentError');
      expect(caughtError.message).toContain('number');
      expect(caughtError.message).toContain('42');
    }
  });

  test('runDoomMain throws InvalidArgumentError when argv contains a non-string element', async () => {
    let caughtError: unknown;
    try {
      await runDoomMain(['--iwad', 7]);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(InvalidArgumentError);
    if (caughtError instanceof InvalidArgumentError) {
      expect(caughtError.name).toBe('InvalidArgumentError');
      expect(caughtError.message).toContain('argv[1]');
      expect(caughtError.message).toContain('argv elements must be strings');
      expect(caughtError.message).toContain('number');
    }
  });

  test('bun run doom.ts exits cleanly with code 0 and produces no stderr output (clean-exit invariant preserved for the wired thin entrypoint)', async () => {
    expect(existsSync(ROOT_DOOM_TS_ABSOLUTE_PATH)).toBe(true);
    const result = await runBunCommand(['run', ROOT_DOOM_TS_RELATIVE_PATH]);
    expect(result.exitCode).toBe(0);
    expect(result.stderrText).toBe('');
  });

  test('doom.ts is the wired thin runDoomMain entrypoint, not the retired plan_vanilla_parity skeleton (post-supersession invariant; formally retired by plan_final 03-011)', () => {
    const fileText = readFileSync(ROOT_DOOM_TS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("import { runDoomMain } from './src/vanilla/runDoomMain.ts';");
    expect(fileText).toContain('await runDoomMain(Bun.argv.slice(2))');
    expect(fileText).not.toMatch(/^\s*export\s*\{\s*\}\s*;?\s*$/m);
    const importDeclarationPattern = /^\s*import[\s(]/gm;
    const importDeclarations = fileText.match(importDeclarationPattern) ?? [];
    expect(importDeclarations.length).toBe(1);
  });
});
