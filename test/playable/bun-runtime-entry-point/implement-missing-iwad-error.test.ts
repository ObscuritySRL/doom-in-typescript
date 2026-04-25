import { describe, expect, test } from 'bun:test';

import { IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT, createMissingIwadError, formatMissingIwadError } from '../../../src/playable/bun-runtime-entry-point/implementMissingIwadError.ts';

const EXPECTED_CONTRACT = {
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    failureTiming: 'launcher-startup-before-session',
    mutatesGameState: false,
    mutatesReplayInput: false,
    requiresWindowHost: false,
  },
  missingIwadError: {
    defaultCandidatePath: 'doom\\DOOM1.WAD',
    explicitArgument: '--iwad <path-to-iwad>',
    failureKind: 'missing-iwad',
    messageHeader: 'Missing IWAD file for playable launch.',
    recoveryText: 'Provide --iwad <path-to-iwad> or place DOOM1.WAD at doom\\DOOM1.WAD.',
    reportsCheckedPaths: true,
    throwsBeforeWindow: true,
  },
  schemaVersion: 1,
  stepId: '03-008',
  stepTitleSlug: 'implement-missing-iwad-error',
  targetCommand: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
} as const;

const EXPECTED_DEFAULT_ERROR_MESSAGE = ['Missing IWAD file for playable launch.', 'Provide --iwad <path-to-iwad> or place DOOM1.WAD at doom\\DOOM1.WAD.', 'Explicit --iwad path: not provided', 'Checked paths:', '- doom\\DOOM1.WAD'].join(
  '\n',
);

const EXPECTED_EXPLICIT_ERROR_MESSAGE = [
  'Missing IWAD file for playable launch.',
  'Provide --iwad <path-to-iwad> or place DOOM1.WAD at doom\\DOOM1.WAD.',
  'Explicit --iwad path: missing\\CUSTOM.WAD',
  'Checked paths:',
  '- missing\\CUSTOM.WAD',
  '- doom\\DOOM1.WAD',
].join('\n');

describe('implement missing IWAD error', () => {
  test('locks the exact Bun runtime missing-IWAD contract', async () => {
    expect(IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT).toEqual(EXPECTED_CONTRACT);
    expect(reconstructTargetCommand()).toBe(IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT.targetCommand.command);
    expect(await sha256(JSON.stringify(IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT))).toBe('05234abc70b6fb86f1fefa0530ebba0fcd6ad11a0e9d2bfd7d34ec56b8b5243c');
  });

  test('formats a stable missing-IWAD message for the default discovery path', () => {
    expect(formatMissingIwadError({ checkedPaths: ['doom\\DOOM1.WAD'], explicitPath: null })).toBe(EXPECTED_DEFAULT_ERROR_MESSAGE);

    const error = createMissingIwadError({ checkedPaths: ['doom\\DOOM1.WAD'], explicitPath: null });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(EXPECTED_DEFAULT_ERROR_MESSAGE);
  });

  test('formats a stable missing-IWAD message for an explicit path failure', () => {
    expect(
      formatMissingIwadError({
        checkedPaths: ['missing\\CUSTOM.WAD', 'doom\\DOOM1.WAD'],
        explicitPath: 'missing\\CUSTOM.WAD',
      }),
    ).toBe(EXPECTED_EXPLICIT_ERROR_MESSAGE);
  });

  test('cross-checks the audited current launcher transition and manifest schema', async () => {
    const auditManifest = await Bun.file('plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json').json();
    const packageJson = await Bun.file('package.json').json();
    const sourceText = await Bun.file('src/main.ts').text();

    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.currentEntrypoint).toEqual(IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT.currentEntrypoint);
    expect(auditManifest.targetCommand.command).toBe(IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT.targetCommand.command);
    expect(packageJson.scripts.start).toBe(IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT.currentEntrypoint.command);
    expect(sourceText).toContain("throw new Error('Missing required --iwad <path-to-iwad> argument.\\n\\n' + HELP_TEXT);");
  });

  test('keeps the failure before replay, game state, or window-host mutation', () => {
    expect(IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT.deterministicReplayCompatibility).toEqual({
      failureTiming: 'launcher-startup-before-session',
      mutatesGameState: false,
      mutatesReplayInput: false,
      requiresWindowHost: false,
    });
    expect(IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT.missingIwadError.throwsBeforeWindow).toBe(true);
  });
});

function reconstructTargetCommand(): string {
  const targetCommand = IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT.targetCommand;

  return [targetCommand.program, targetCommand.subcommand, targetCommand.entryFile].join(' ');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
