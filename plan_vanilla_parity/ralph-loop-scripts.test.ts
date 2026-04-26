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

async function createFakeCodexCommand(temporaryDirectory: string, delayBeforeResponseSeconds = 0): Promise<string> {
  const fakeCodexCommandPath = join(temporaryDirectory, 'codex.cmd');

  await Bun.write(
    fakeCodexCommandPath,
    [
      '@echo off',
      'if "%~1"=="--version" (',
      '  echo codex-fake 1.0',
      '  exit /b 0',
      ')',
      ...(delayBeforeResponseSeconds > 0 ? [`ping -n ${delayBeforeResponseSeconds + 1} 127.0.0.1 >nul`] : []),
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

async function createFakeClaudeCommand(temporaryDirectory: string, delayBeforeResponseSeconds = 0): Promise<string> {
  const fakeClaudeCommandPath = join(temporaryDirectory, 'claude.cmd');

  await Bun.write(
    fakeClaudeCommandPath,
    [
      '@echo off',
      'if "%~1"=="--version" (',
      '  echo claude-fake 1.0',
      '  exit /b 0',
      ')',
      ...(delayBeforeResponseSeconds > 0 ? [`ping -n ${delayBeforeResponseSeconds + 1} 127.0.0.1 >nul`] : []),
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

async function readFirstEligibleGovernanceStepLine(): Promise<string | null> {
  const checklistText = await Bun.file('plan_vanilla_parity/MASTER_CHECKLIST.md').text();
  const firstUncheckedGovernancePattern = /^- \[ \] `(?<id>\d{2}-\d{3})` `(?<slug>[^`]+)` \| lane: `governance` \|/m;
  const match = firstUncheckedGovernancePattern.exec(checklistText);
  if (match?.groups === undefined) {
    return null;
  }
  return `Initial eligible step: ${match.groups.id} ${match.groups.slug}`;
}

async function readFirstEligibleNonGovernanceStep(): Promise<{ readonly lane: string; readonly stepId: string } | null> {
  const checklistText = await Bun.file('plan_vanilla_parity/MASTER_CHECKLIST.md').text();
  const uncheckedNoPrereqPattern = /^- \[ \] `(?<id>\d{2}-\d{3})` `(?<slug>[^`]+)` \| lane: `(?<lane>[^`]+)` \| prereqs: `none` \|/gm;
  for (const match of checklistText.matchAll(uncheckedNoPrereqPattern)) {
    if (match.groups?.lane !== 'governance') {
      return { lane: match.groups!.lane!, stepId: match.groups!.id! };
    }
  }
  return null;
}

async function readFirstEligibleStep(): Promise<{ readonly lane: string; readonly stepId: string; readonly stepLine: string } | null> {
  const checklistText = await Bun.file('plan_vanilla_parity/MASTER_CHECKLIST.md').text();
  const checklistLinePattern = /^- \[(?<mark>[ xX])\] `(?<id>\d{2}-\d{3})` `(?<slug>[^`]+)` \| lane: `(?<lane>[^`]+)` \| prereqs: `(?<prereqs>[^`]+)` \|/gm;
  const completedStepIds = new Set<string>();

  for (const match of checklistText.matchAll(checklistLinePattern)) {
    if (match.groups?.mark.toLowerCase() === 'x') {
      completedStepIds.add(match.groups.id);
    }
  }

  for (const match of checklistText.matchAll(checklistLinePattern)) {
    if (match.groups?.mark !== ' ') {
      continue;
    }
    const prereqs = match.groups.prereqs
      .split(',')
      .map((prereq) => prereq.trim())
      .filter((prereq) => prereq.length > 0 && prereq !== 'none');
    const allComplete = prereqs.every((prereq) => completedStepIds.has(prereq));
    if (allComplete) {
      return {
        lane: match.groups.lane,
        stepId: match.groups.id,
        stepLine: `Initial eligible step: ${match.groups.id} ${match.groups.slug}`,
      };
    }
  }
  return null;
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
    expect(readmeText).toContain('Long-running process status prints every 180 seconds by default');
    expect(readmeText).toContain('pass `-ProgressStatusSeconds 0` to suppress repeated status lines');
    expect(readmeText).toContain('Forward/no-audit loop agents must not read or update any `AUDIT_LOG.md`');
    expect(readmeText).toContain('The immediate lane roots are `governance`, `inventory`, `oracle`, `launch`, `core`, and `wad`.');
    expect(promptText).toContain('choose the first unchecked step in that lane whose prerequisites are complete');
    expect(promptText).toContain('Do not switch lanes.');
    expect(promptText).toContain('forbidden to read or update `plan_vanilla_parity/AUDIT_LOG.md`');
    expect(promptText).toContain('RLP_LANE: <assigned lane or NONE>');
  });

  test('actual plan exposes immediate lane roots for parallel startup', async () => {
    const checklistText = await Bun.file('plan_vanilla_parity/MASTER_CHECKLIST.md').text();

    for (const stepId of ['00-001', '01-001', '02-001', '03-001', '04-001', '05-001']) {
      expect(checklistText).toContain(`\`${stepId}\``);
    }

    expect(checklistText).toContain('`00-001` `establish-vanilla-parity-control-center` | lane: `governance` | prereqs: `none`');
    expect(checklistText).toContain('`01-001` `inventory-root-scripts-and-missing-doom-ts` | lane: `inventory` | prereqs: `none`');
    expect(checklistText).toContain('`02-001` `catalog-local-reference-binaries-and-configs` | lane: `oracle` | prereqs: `none`');
    expect(checklistText).toContain('`03-001` `add-root-doom-ts-bun-entrypoint` | lane: `launch` | prereqs: `none`');
    expect(checklistText).toContain('`04-001` `audit-fixed-point-constants` | lane: `core` | prereqs: `none`');
    expect(checklistText).toContain('`05-001` `verify-wad-header-and-directory-parsing` | lane: `wad` | prereqs: `none`');
  });

  test('auto-select skips locked governance and acquires another immediate lane in the actual plan', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'doom-vanilla-loop-'));
    const lockDirectory = join(temporaryDirectory, 'locks');
    let firstLockId = '';
    let firstLane = '';
    let secondLane = '';
    let secondLockId = '';

    try {
      const expectedFirstStep = await readFirstEligibleStep();
      if (expectedFirstStep === null) {
        return;
      }
      const expectedSecondStep = await readFirstEligibleNonGovernanceStep();
      const firstResult = await acquireLaneLock(
        parseLaneLockArguments(['acquire', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--owner', 'other-agent', '--lease-minutes', '60', '--lane', expectedFirstStep.lane]),
      );
      const secondResult = await acquireLaneLock(parseLaneLockArguments(['acquire', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--owner', 'auto-agent', '--lease-minutes', '60']));

      firstLockId = firstResult.lockId ?? '';
      firstLane = firstResult.lane ?? '';
      secondLane = secondResult.lane ?? '';
      secondLockId = secondResult.lockId ?? '';

      expect(firstResult.acquired).toBe(true);
      expect(firstResult.lane).toBe(expectedFirstStep.lane);
      if (expectedSecondStep === null) {
        expect(secondResult.lane).not.toBe(expectedFirstStep.lane);
      } else {
        expect(secondResult.acquired).toBe(true);
        if (expectedFirstStep.lane === 'governance') {
          expect(secondResult.lane).toBe(expectedSecondStep.lane);
          expect(secondResult.stepId).toBe(expectedSecondStep.stepId);
        } else {
          expect(secondResult.lane).not.toBe(expectedFirstStep.lane);
        }
      }
    } finally {
      if (firstLockId && firstLane) {
        await releaseLaneLock(parseLaneLockArguments(['release', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--lane', firstLane, '--lock-id', firstLockId]));
      }

      if (secondLane && secondLockId) {
        await releaseLaneLock(parseLaneLockArguments(['release', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--lane', secondLane, '--lock-id', secondLockId]));
      }

      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  test('Codex scripts default to the vanilla parity plan and lane lock directories', async () => {
    for (const scriptPath of [CODEX_SCRIPT_PATH, CODEX_NO_AUDIT_SCRIPT_PATH]) {
      const scriptText = await Bun.file(scriptPath).text();

      expect(scriptText).toContain('plan_vanilla_parity\\PROMPT.md');
      expect(scriptText).toContain('plan_vanilla_parity\\loop_logs');
      expect(scriptText).toContain('plan_vanilla_parity\\lane_locks');
      expect(scriptText).toContain('[string]$Lane = ""');
      expect(scriptText).toContain('[int]$LockLeaseMinutes = 120');
      expect(scriptText).toContain('[int]$ProgressStatusSeconds = 180');
      expect(scriptText).toContain('-ProgressStatusSeconds $ProgressStatusSeconds');
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
      expect(scriptText).toContain('[int]$ProgressStatusSeconds = 180');
      expect(scriptText).toContain('-ProgressStatusSeconds $ProgressStatusSeconds');
      expect(scriptText).not.toContain('plan_fps\\PROMPT.md');
    }
  });

  test('Codex no-audit loop auto-acquires and releases the first eligible unlocked lane', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'doom-vanilla-loop-'));
    const logDirectory = join(temporaryDirectory, 'logs');
    const lockDirectory = join(temporaryDirectory, 'locks');
    const fakeCodexCommandPath = await createFakeCodexCommand(temporaryDirectory);
    const expectedInitialStep = await readFirstEligibleStep();

    try {
      if (expectedInitialStep === null) {
        return;
      }
      const result = await runPowerShellScript(CODEX_NO_AUDIT_SCRIPT_PATH, ['-MaxIterations', '1', '-CodexCommand', fakeCodexCommandPath, '-LogDirectory', logDirectory, '-LaneLockDirectory', lockDirectory]);

      expect(result.exitCode).toBe(0);
      expect(result.combinedOutput).toContain(`Lane: ${expectedInitialStep.lane}`);
      expect(result.combinedOutput).toContain(expectedInitialStep.stepLine);
      expect(result.combinedOutput).toContain('LOOP_STATUS: NO_ELIGIBLE_STEP');
      expect(result.combinedOutput).toContain(`LOOP_LANE: ${expectedInitialStep.lane}`);

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
    const expectedInitialStep = await readFirstEligibleStep();

    try {
      if (expectedInitialStep === null) {
        return;
      }
      const result = await runPowerShellScript(CLAUDE_CODE_NO_AUDIT_SCRIPT_PATH, ['-MaxIterations', '1', '-ClaudeCommand', fakeClaudeCommandPath, '-LogDirectory', logDirectory, '-LaneLockDirectory', lockDirectory]);

      expect(result.exitCode).toBe(0);
      expect(result.combinedOutput).toContain(`Lane: ${expectedInitialStep.lane}`);
      expect(result.combinedOutput).toContain(expectedInitialStep.stepLine);
      expect(result.combinedOutput).toContain('LOOP_STATUS: NO_ELIGIBLE_STEP');
      expect(result.combinedOutput).toContain(`LOOP_LANE: ${expectedInitialStep.lane}`);

      const lockEntries = await readdir(lockDirectory);
      expect(lockEntries).toEqual([]);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  test('Claude Code no-audit loop suppresses repeated running status before the progress interval', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'doom-vanilla-loop-'));
    const logDirectory = join(temporaryDirectory, 'logs');
    const lockDirectory = join(temporaryDirectory, 'locks');
    const fakeClaudeCommandPath = await createFakeClaudeCommand(temporaryDirectory, 2);

    try {
      const result = await runPowerShellScript(CLAUDE_CODE_NO_AUDIT_SCRIPT_PATH, [
        '-MaxIterations',
        '1',
        '-ClaudeCommand',
        fakeClaudeCommandPath,
        '-LogDirectory',
        logDirectory,
        '-LaneLockDirectory',
        lockDirectory,
        '-ProgressStatusSeconds',
        '180',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.combinedOutput).toContain('Saving final response to');
      expect(result.combinedOutput).not.toContain('Claude Code is still running; final response will be saved to');
      expect(result.combinedOutput).toContain('LOOP_STATUS: NO_ELIGIBLE_STEP');
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
    const expectedFirstStep = await readFirstEligibleStep();
    if (expectedFirstStep === null) {
      await rm(temporaryDirectory, { force: true, recursive: true });
      return;
    }
    const lockResult = await acquireLaneLock(
      parseLaneLockArguments(['acquire', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--owner', 'other-agent', '--lease-minutes', '60', '--lane', expectedFirstStep.lane]),
    );

    try {
      const result = await runPowerShellScript(CODEX_NO_AUDIT_SCRIPT_PATH, ['-MaxIterations', '1', '-CodexCommand', fakeCodexCommandPath, '-LogDirectory', logDirectory, '-LaneLockDirectory', lockDirectory, '-Lane', expectedFirstStep.lane]);

      expect(lockResult.acquired).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.combinedOutput).toContain('LOOP_STATUS: NO_ELIGIBLE_STEP');
      expect(result.combinedOutput).toContain(`Lane is locked: ${expectedFirstStep.lane} by other-agent`);
      expect(result.combinedOutput).not.toContain('Codex command:');
    } finally {
      if (lockResult.lockId) {
        await releaseLaneLock(parseLaneLockArguments(['release', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--lane', expectedFirstStep.lane, '--lock-id', lockResult.lockId]));
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
    const expectedFirstStep = await readFirstEligibleStep();
    if (expectedFirstStep === null) {
      await rm(temporaryDirectory, { force: true, recursive: true });
      return;
    }
    const lockResult = await acquireLaneLock(
      parseLaneLockArguments(['acquire', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--owner', 'other-agent', '--lease-minutes', '60', '--lane', expectedFirstStep.lane]),
    );

    try {
      const result = await runPowerShellScript(CLAUDE_CODE_NO_AUDIT_SCRIPT_PATH, [
        '-MaxIterations',
        '1',
        '-ClaudeCommand',
        fakeClaudeCommandPath,
        '-LogDirectory',
        logDirectory,
        '-LaneLockDirectory',
        lockDirectory,
        '-Lane',
        expectedFirstStep.lane,
      ]);

      expect(lockResult.acquired).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.combinedOutput).toContain('LOOP_STATUS: NO_ELIGIBLE_STEP');
      expect(result.combinedOutput).toContain(`Lane is locked: ${expectedFirstStep.lane} by other-agent`);
      expect(result.combinedOutput).not.toContain('Claude command:');
    } finally {
      if (lockResult.lockId) {
        await releaseLaneLock(parseLaneLockArguments(['release', '--plan-directory', 'plan_vanilla_parity', '--lock-directory', lockDirectory, '--lane', expectedFirstStep.lane, '--lock-id', lockResult.lockId]));
      }
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});
