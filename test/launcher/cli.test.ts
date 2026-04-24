import { describe, expect, test } from 'bun:test';

import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { runCli } from '../_harness/cli.ts';

const IWAD_PATH = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;

describe('launcher CLI', () => {
  test('prints usage information with --help', async () => {
    const result = await runCli(['--help'], {
      scriptPath: 'src/main.ts',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('DOOM Codex launcher');
    expect(result.stdout).toContain('--iwad');
    expect(result.stdout).toContain('Tab: toggle gameplay view and automap');
  });

  test('lists maps without opening the window', async () => {
    const result = await runCli(['--list-maps', '--iwad', IWAD_PATH], {
      scriptPath: 'src/main.ts',
    });

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.stdout).toContain('E1M1');
    expect(result.stdout).toContain('E1M9');
  });

  test('can use the copied local IWAD when --iwad is omitted', async () => {
    const result = await runCli(['--list-maps'], {
      scriptPath: 'src/main.ts',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('E1M1');
    expect(result.stdout).toContain('E1M9');
  });
});
