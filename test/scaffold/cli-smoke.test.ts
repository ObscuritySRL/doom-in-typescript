import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { cliDefaultTimeout, cliPackageRoot, runCli } from '../_harness/cli.ts';

const ROOT = resolve(import.meta.dir, '..', '..');

describe('cli harness module', () => {
  test('cliPackageRoot resolves to doom_codex root', () => {
    expect(cliPackageRoot()).toBe(ROOT);
  });

  test('cliPackageRoot points to an existing directory', () => {
    expect(existsSync(cliPackageRoot())).toBe(true);
  });

  test('cliDefaultTimeout is a positive number', () => {
    expect(cliDefaultTimeout()).toBeGreaterThan(0);
  });

  test('cliDefaultTimeout is at least 5 seconds', () => {
    expect(cliDefaultTimeout()).toBeGreaterThanOrEqual(5_000);
  });
});

describe('runCli stdout capture', () => {
  test('captures stdout from -e eval', async () => {
    const result = await runCli(['-e', 'console.log("hello")']);
    expect(result.stdout.trim()).toBe('hello');
  });

  test('captures multi-line stdout', async () => {
    const result = await runCli(['-e', 'console.log("a");console.log("b")']);
    const lines = result.stdout.trim().split('\n');
    expect(lines).toEqual(['a', 'b']);
  });

  test('empty stdout when script produces no output', async () => {
    const result = await runCli(['-e', '/* no output */']);
    expect(result.stdout).toBe('');
  });
});

describe('runCli stderr capture', () => {
  test('captures stderr', async () => {
    const result = await runCli(['-e', 'console.error("oops")']);
    expect(result.stderr.trim()).toBe('oops');
  });

  test('stdout and stderr are independent streams', async () => {
    const result = await runCli(['-e', 'console.log("out");console.error("err")']);
    expect(result.stdout.trim()).toBe('out');
    expect(result.stderr.trim()).toBe('err');
  });
});

describe('runCli exit code', () => {
  test('exit code 0 on success', async () => {
    const result = await runCli(['-e', 'process.exit(0)']);
    expect(result.exitCode).toBe(0);
  });

  test('exit code 1 on failure', async () => {
    const result = await runCli(['-e', 'process.exit(1)']);
    expect(result.exitCode).toBe(1);
  });

  test('non-zero exit code from thrown error', async () => {
    const result = await runCli(['-e', 'throw new Error("boom")']);
    expect(result.exitCode).not.toBe(0);
  });

  test('timedOut is false on normal exit', async () => {
    const result = await runCli(['-e', 'process.exit(0)']);
    expect(result.timedOut).toBe(false);
  });
});

describe('runCli options', () => {
  test('scriptPath prepends to args', async () => {
    const result = await runCli(['console.log("via-script-path")'], {
      scriptPath: '-e',
    });
    expect(result.stdout.trim()).toBe('via-script-path');
    expect(result.exitCode).toBe(0);
  });

  test('workingDirectory affects cwd', async () => {
    const result = await runCli(['-e', 'console.log(process.cwd())'], { workingDirectory: ROOT });
    // Normalize path separators for Windows
    const captured = result.stdout.trim().replace(/\\/g, '/');
    const expected = ROOT.replace(/\\/g, '/');
    expect(captured).toBe(expected);
  });

  test('environment overrides are visible to subprocess', async () => {
    const result = await runCli(['-e', 'console.log(process.env.DOOM_CODEX_TEST_VAR)'], { environment: { DOOM_CODEX_TEST_VAR: 'parity42' } });
    expect(result.stdout.trim()).toBe('parity42');
  });

  test('environment overrides do not leak into parent process', async () => {
    await runCli(['-e', ''], {
      environment: { DOOM_CODEX_LEAK_CHECK: 'leaked' },
    });
    expect(process.env.DOOM_CODEX_LEAK_CHECK).toBeUndefined();
  });
});

describe('runCli timeout', () => {
  test('short timeout kills a long-running process', async () => {
    const result = await runCli(['-e', 'await Bun.sleep(30000)'], { timeoutMilliseconds: 500 });
    expect(result.timedOut).toBe(true);
  });

  test('timed-out process has null exit code', async () => {
    const result = await runCli(['-e', 'await Bun.sleep(30000)'], { timeoutMilliseconds: 500 });
    expect(result.exitCode).toBeNull();
  });
});

describe('runCli result interface', () => {
  test('result has all required fields', async () => {
    const result = await runCli(['-e', '']);
    expect(result).toHaveProperty('stdout');
    expect(result).toHaveProperty('stderr');
    expect(result).toHaveProperty('exitCode');
    expect(result).toHaveProperty('timedOut');
  });

  test('stdout is a string type', async () => {
    const result = await runCli(['-e', '']);
    expect(typeof result.stdout).toBe('string');
  });

  test('stderr is a string type', async () => {
    const result = await runCli(['-e', '']);
    expect(typeof result.stderr).toBe('string');
  });
});

describe('parity edge cases', () => {
  test('preserves exit code 42 (arbitrary non-zero)', async () => {
    const result = await runCli(['-e', 'process.exit(42)']);
    expect(result.exitCode).toBe(42);
  });

  test('handles large stdout without truncation', async () => {
    const lineCount = 1_000;
    const script = `for(let i=0;i<${lineCount};i++)console.log("line"+i)`;
    const result = await runCli(['-e', script]);
    const lines = result.stdout.trim().split('\n');
    expect(lines.length).toBe(lineCount);
    expect(lines[0]).toBe('line0');
    expect(lines[lineCount - 1]).toBe(`line${lineCount - 1}`);
  });
});
