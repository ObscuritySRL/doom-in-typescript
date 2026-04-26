import { describe, expect, test } from 'bun:test';

import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { acquireLaneLock, parseLaneLockArguments, releaseLaneLock } from './lane-lock.ts';

const CODEX_NO_AUDIT_SCRIPT_PATH = 'plan_vanilla_parity/RALPH_LOOP_CODEX_NO_AUDIT.ps1';
const CODEX_SCRIPT_PATH = 'plan_vanilla_parity/RALPH_LOOP_CODEX.ps1';
const CLAUDE_CODE_NO_AUDIT_SCRIPT_PATH = 'plan_vanilla_parity/RALPH_LOOP_CLAUDE_CODE_NO_AUDIT.ps1';
const CLAUDE_CODE_SCRIPT_PATH = 'plan_vanilla_parity/RALPH_LOOP_CLAUDE_CODE.ps1';
const PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const README_PATH = 'plan_vanilla_parity/README.md';

async function createFakeCodexCommand(temporaryDirectory: string): Promise<string> {
  const fakeCodexCommandPath = join(temporaryDirectory, 'codex.cmd');

  await Bun.write(
    fakeCodexCommandPath,
    [
      '@echo off',
      'if "%~1"=="--version" (',
      '  echo codex-fake 1.0',
      '  exit /b 0',
      ')',
      'echo RLP_STATUS: NO_ELIGIBLE_STEP',
      'echo RLP_STEP_ID: NONE',
      'echo RLP_STEP_TITLE: NONE',
      'echo RLP_LANE: governance',
      'echo RLP_AGENT: Codex',
      'echo RLP_MODEL: fake-model',
      'echo RLP_EFFORT: fake-effort',
      'echo RLP_FILES_CHANGED: NONE',
      'echo RLP_TEST_COMMANDS: NONE',
      'echo RLP_CHECKLIST_UPDATED: NO',
      'echo RLP_HANDOFF_UPDATED: NO',
      'echo RLP_PROGRESS_LOG: NONE',
      'echo RLP_NEXT_STEP: NONE',
      'echo RLP_REASON: fake done',
      'exit /b 0',
      '',
    ].join('\r\n'),
  );

  return fakeCodexCommandPath;
}

async function createFakeClaudeCommand(temporaryDirectory: string): Promise<string> {
  const fakeClaudeCommandPath = join(temporaryDirectory, 'claude.cmd');

  await Bun.write(
    fakeClaudeCommandPath,
    [
      '@echo off',
      'if "%~1"=="--version" (',
      '  echo claude-fake 1.0',
      '  exit /b 0',
      ')',
      'echo RLP_STATUS: NO_ELIGIBLE_STEP',
      'echo RLP_STEP_ID: NONE',
      'echo RLP_STEP_TITLE: NONE',
      'echo RLP_LANE: governance',
      'echo RLP_AGENT: Claude Code',
      'echo RLP_MODEL: fake-model',
      'echo RLP_EFFORT: fake-effort',
      'echo RLP_FILES_CHANGED: NONE',
      'echo RLP_TEST_COMMANDS: NONE',
      'echo RLP_CHECKLIST_UPDATED: NO',
      'echo RLP_HANDOFF_UPDATED: NO',
      'echo RLP_PROGRESS_LOG: NONE',
      'echo RLP_NEXT_STEP: NONE',
      'echo RLP_REASON: fake done',
      'exit /b 0',
      '',
    ].join('\r\n'),
  );

  return fakeClaudeCommandPath;
}

async function runPowerShellScript(scriptPath: string, additionalArguments: readonly string[]) {
  const subprocess = Bun.spawn({
    cmd: ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...additionalArguments],
    stderr: 'pipe',
    stdout: 'pipe',
  });

  const [standardErrorText, standardOutputText, exitCode] = await Promise.all([new Response(subprocess.stderr).text(), new Response(subprocess.stdout).text(), subprocess.exited]);

  return {
    combinedOutput: `${standardOutputText}\n${standardErrorText}`,
    exitCode,
  };
}

describe('vanilla parity Ralph-loop scripts', () => {
  test('documents lane-locked parallel Ralph-loop usage', async () => {
    const promptText = await Bun.file(PROMPT_PATH).text();
    const readmeText = await Bun.file(README_PATH).text();

    expect(readmeText).toContain('Use `-Lane <lane>` to pin a loop to one lane.');
    expect(readmeText).toContain('Omit `-Lane` to let the launcher pick the first eligible lane that is not currently locked.');
    expect(readmeText).toContain('premature Ctrl-C or process loss leaves a lock file that expires and can be reclaimed after the lease');
    expect(promptText).toContain('choose the first unchecked step in that lane whose prerequisites are complete');
    expect(promptText).toContain('Do not switch lanes.');
    expect(promptText).toContain('RLP_LANE: <assigned lane or NONE>');
  });

  test('Codex scripts default to the vanilla parity plan and lane lock directories', async () => {
    for (const scriptPath of [CODEX_SCRIPT_PATH, CODEX_NO_AUDIT_SCRIPT_PATH]) {
      const scriptText = await Bun.file(scriptPath).text();

      expect(scriptText).toContain('plan_vanilla_parity\\PROMPT.md');
      expect(scriptText).toContain('plan_vanilla_parity\\loop_logs');
      expect(scriptText).toContain('plan_vanilla_parity\\lane_locks');
      expect(scriptText).toContain('[string]$Lane = ""');
      expect(scriptText).toContain('[int]$LockLeaseMinutes = 120');
      expect(scriptText).not.toContain('plan_fps\\PROMPT.md');
    }
  });

  test('Claude Code scripts default to the vanilla parity plan and lane lock directories', async () => {
    for (const scriptPath of [CLAUDE_CODE_SCRIPT_PATH, CLAUDE_CODE_NO_AUDIT_SCRIPT_PATH]) {
      const scriptText = await Bun.file(scriptPath).text();

      expect(scriptText).toContain('plan_vanilla_parity\\PROMPT.md');
      expect(scriptText).toContain('plan_vanilla_parity\\loop_logs');
      expect(scriptText).toContain('plan_vanilla_parity\\lane_locks');
      expect(scriptText).toContain('[string]$Lane = ""');
      expect(scriptText).toContain('[int]$LockLeaseMinutes = 120');
      expect(scriptText).not.toContain('plan_fps\\PROMPT.md');
    }
  });

  test('Codex no-audit loop auto-acquires and releases the first eligible unlocked lane', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'doom-vanilla-loop-'));
    const logDirectory = join(temporaryDirectory, 'logs');
    const lockDirectory = join(temporaryDirectory, 'locks');
    const fakeCodexCommandPath = await createFakeCodexCommand(temporaryDirectory);

    try {
      const result = await runPowerShellScript(CODEX_NO_AUDIT_SCRIPT_PATH, ['-MaxIterations', '1', '-CodexCommand', fakeCodexCommandPath, '-LogDirectory', logDirectory, '-LaneLockDirectory', lockDirectory]);

      expect(result.exitCode).toBe(0);
      expect(result.combinedOutput).toContain('Lane: governance');
      expect(result.combinedOutput).toContain('Initial eligible step: 00-001 establish-vanilla-parity-control-center');
      expect(result.combinedOutput).toContain('LOOP_STATUS: NO_ELIGIBLE_STEP');
      expect(result.combinedOutput).toContain('LOOP_LANE: governance');

      const lockEntries = await readdir(lockDirectory);
      expect(lockEntries).toEqual([]);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  test('Claude Code no-audit loop auto-acquires and releases the first eligible unlocked lane', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'doom-vanilla-loop-'));
    const logDirectory = join(temporaryDirectory, 'logs');
    const lockDirectory = join(temporaryDirectory, 'locks');
    const fakeClaudeCommandPath = await createFakeClaudeCommand(temporaryDirectory);

    try {
      const result = await runPowerShellScript(CLAUDE_CODE_NO_AUDIT_SCRIPT_PATH, ['-MaxIterations', '1', '-ClaudeCommand', fakeClaudeCommandPath, '-LogDirectory', logDirectory, '-LaneLockDirectory', lockDirectory]);

      expect(result.exitCode).toBe(0);
      expect(result.combinedOutput).toContain('Lane: governance');
      expect(result.combinedOutput).toContain('Initial eligible step: 00-001 establish-vanilla-parity-control-center');
      expect(result.combinedOutput).toContain('LOOP_STATUS: NO_ELIGIBLE_STEP');
      expect(result.combinedOutput).toContain('LOOP_LANE: governance');

      const lockEntries = await readdir(lockDirectory);
      expect(lockEntries).toEqual([]);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  test('Codex no-audit loop refuses an explicitly locked lane before invoking Codex', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'doom-vanilla-loop-'));
    const logDirectory = join(temporaryDirectory, 'logs');
    const lockDirectory = join(temporaryDirectory, 'locks');
    const fakeCodexCommandPath = await createFakeCodexCommand(temporaryDirectory);

    await mkdir(lockDirectory, { recursive: true });
    const lockResult = await acquireLaneLock(parseLaneLockArguments(['acquire', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--owner', 'other-agent', '--lease-minutes', '60', '--lane', 'governance']));

    try {
      const result = await runPowerShellScript(CODEX_NO_AUDIT_SCRIPT_PATH, ['-MaxIterations', '1', '-CodexCommand', fakeCodexCommandPath, '-LogDirectory', logDirectory, '-LaneLockDirectory', lockDirectory, '-Lane', 'governance']);

      expect(lockResult.acquired).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.combinedOutput).toContain('LOOP_STATUS: NO_ELIGIBLE_STEP');
      expect(result.combinedOutput).toContain('Lane is locked: governance by other-agent');
      expect(result.combinedOutput).not.toContain('Codex command:');
    } finally {
      if (lockResult.lockId) {
        await releaseLaneLock(parseLaneLockArguments(['release', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--lane', 'governance', '--lock-id', lockResult.lockId]));
      }
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  test('Claude Code no-audit loop refuses an explicitly locked lane before invoking Claude Code', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'doom-vanilla-loop-'));
    const logDirectory = join(temporaryDirectory, 'logs');
    const lockDirectory = join(temporaryDirectory, 'locks');
    const fakeClaudeCommandPath = await createFakeClaudeCommand(temporaryDirectory);

    await mkdir(lockDirectory, { recursive: true });
    const lockResult = await acquireLaneLock(parseLaneLockArguments(['acquire', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--owner', 'other-agent', '--lease-minutes', '60', '--lane', 'governance']));

    try {
      const result = await runPowerShellScript(CLAUDE_CODE_NO_AUDIT_SCRIPT_PATH, ['-MaxIterations', '1', '-ClaudeCommand', fakeClaudeCommandPath, '-LogDirectory', logDirectory, '-LaneLockDirectory', lockDirectory, '-Lane', 'governance']);

      expect(lockResult.acquired).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.combinedOutput).toContain('LOOP_STATUS: NO_ELIGIBLE_STEP');
      expect(result.combinedOutput).toContain('Lane is locked: governance by other-agent');
      expect(result.combinedOutput).not.toContain('Claude command:');
    } finally {
      if (lockResult.lockId) {
        await releaseLaneLock(parseLaneLockArguments(['release', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--lane', 'governance', '--lock-id', lockResult.lockId]));
      }
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});
