import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const ROOT_DOOM_TS_RELATIVE_PATH = 'doom.ts';
const ROOT_DOOM_TS_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, ROOT_DOOM_TS_RELATIVE_PATH);
const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-001-add-root-doom-ts-bun-entrypoint.md';
const CONTROL_CENTER_DOCUMENT_RELATIVE_PATH = 'plan_vanilla_parity/establish-vanilla-parity-control-center.md';
const PACKAGE_JSON_RELATIVE_PATH = 'package.json';
const NONEXISTENT_ROOT_TYPESCRIPT_FILE = '__doom_codex_nonexistent_entrypoint_for_failure_mode__.ts';

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

describe('vanilla parity launch: root doom.ts Bun entrypoint', () => {
  test('doom.ts exists at the repository root and is a regular file', () => {
    expect(existsSync(ROOT_DOOM_TS_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(ROOT_DOOM_TS_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('doom.ts content names the canonical bun run doom.ts runtime target and the launch lane scope', async () => {
    const fileText = await Bun.file(ROOT_DOOM_TS_RELATIVE_PATH).text();
    expect(fileText).toContain('Vanilla DOOM 1.9');
    expect(fileText).toContain('bun run doom.ts');
    expect(fileText).toContain('plan_vanilla_parity');
    expect(fileText).toContain('03-001');
  });

  test('doom.ts is a TypeScript module with no top-level side effects beyond an empty export marker', async () => {
    const fileText = await Bun.file(ROOT_DOOM_TS_RELATIVE_PATH).text();
    expect(fileText).toContain('export {}');
    expect(fileText).not.toContain('console.log');
    expect(fileText).not.toContain('process.exit');
    expect(fileText).not.toContain('Bun.spawn');
  });

  test('doom.ts contains no import declarations under step 03-001 minimal skeleton', async () => {
    const fileText = await Bun.file(ROOT_DOOM_TS_RELATIVE_PATH).text();
    const importDeclarationPattern = /^\s*import[\s\(]/m;
    expect(importDeclarationPattern.test(fileText)).toBe(false);
  });

  test('control center declares bun run doom.ts as the runtime target', async () => {
    const controlCenterText = await Bun.file(CONTROL_CENTER_DOCUMENT_RELATIVE_PATH).text();
    expect(controlCenterText).toContain('\n## runtime target\n\nbun run doom.ts\n');
  });

  test('step file 03-001 pins doom.ts and the focused test path under its write lock and lane', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('\n## lane\n\nlaunch\n');
    expect(stepText).toContain('\n## write lock\n\n- doom.ts\n- test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts\n');
    expect(stepText).toContain('\n## expected changes\n\n- doom.ts\n- test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts\n');
    expect(stepText).toContain('\n## test files\n\n- test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts\n');
  });

  test('bun run doom.ts exits cleanly with code 0 and produces no stderr output', async () => {
    const result = await runBunCommand(['run', ROOT_DOOM_TS_RELATIVE_PATH]);
    expect(result.exitCode).toBe(0);
    expect(result.stderrText).toBe('');
  });

  test('bun on a nonexistent root .ts file fails with module-not-found error (failure mode)', async () => {
    expect(existsSync(NONEXISTENT_ROOT_TYPESCRIPT_FILE)).toBe(false);
    const result = await runBunCommand(['run', NONEXISTENT_ROOT_TYPESCRIPT_FILE]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderrText).toContain('Module not found');
    expect(result.stderrText).toContain(NONEXISTENT_ROOT_TYPESCRIPT_FILE);
  });

  test('package.json does not yet expose a doom.ts script entry under step 03-001 (manifest unchanged)', async () => {
    const packageJsonText = await Bun.file(PACKAGE_JSON_RELATIVE_PATH).text();
    const packageJson = JSON.parse(packageJsonText) as { readonly scripts?: Readonly<Record<string, string>> };
    const declaredScripts = packageJson.scripts ?? {};
    for (const scriptValue of Object.values(declaredScripts)) {
      expect(scriptValue).not.toContain('doom.ts');
    }
  });

  test('failure mode: a doom.ts that throws at module evaluation makes bun run exit non-zero', async () => {
    const temporaryEntrypointRelativePath = '__doom_codex_failing_entrypoint_for_failure_mode__.ts';
    const temporaryEntrypointAbsolutePath = join(REPOSITORY_ROOT_DIRECTORY, temporaryEntrypointRelativePath);
    const failingModuleSource = "throw new Error('intentional failure-mode entrypoint');\n";
    await Bun.write(temporaryEntrypointAbsolutePath, failingModuleSource);
    try {
      const result = await runBunCommand(['run', temporaryEntrypointRelativePath]);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderrText).toContain('intentional failure-mode entrypoint');
    } finally {
      await Bun.file(temporaryEntrypointAbsolutePath).delete();
    }
  });
});
