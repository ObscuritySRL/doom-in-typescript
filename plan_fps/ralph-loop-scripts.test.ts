import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const AGENTS_PATH = 'AGENTS.md';
const AUDIT_SCRIPT_PATH = 'plan_fps/RALPH_LOOP_CLAUDE_CODE.ps1';
const BIOME_CONFIG_PATH = 'biome.json';
const CODEX_AUDIT_SCRIPT_PATH = 'plan_fps/RALPH_LOOP_CODEX.ps1';
const CODEX_NO_AUDIT_SCRIPT_PATH = 'plan_fps/RALPH_LOOP_CODEX_NO_AUDIT.ps1';
const FORMAT_CHANGED_TOOL_PATH = 'tools/format-changed.ts';
const NO_AUDIT_SCRIPT_PATH = 'plan_fps/RALPH_LOOP_CLAUDE_CODE_NO_AUDIT.ps1';
const PACKAGE_PATH = 'package.json';
const PRE_PROMPT_PATH = 'plan_fps/PRE_PROMPT.md';
const PRETTIER_CONFIG_PATH = '.prettierrc.json';
const PROMPT_PATH = 'plan_fps/PROMPT.md';
const README_PATH = 'plan_fps/README.md';

async function runPowerShellScript(scriptPath: string, additionalArguments: string[]) {
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

describe('Ralph-loop PowerShell scripts', () => {
  test('repository instructions require human-owned direct commit and push publishing', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();

    expect(agentsText).toContain('## GitHub and Publishing Authority');
    expect(agentsText).toContain('Make repository changes, commits, pushes, and GitHub repository actions as Stev Peifer through the configured human account and repository permissions.');
    expect(agentsText).toContain('Do not override `user.name`, `user.email`, commit author, commit committer, or publishing identity to Codex, OpenAI, Claude, or any other AI or agent identity.');
    expect(agentsText).toContain('References to tools, models, or agents are allowed when technically relevant, but they are not authors or publishing identities for this repository.');
    expect(agentsText).toContain('When publishing changes, commit and push directly. Do not open pull requests.');
    expect(agentsText).toContain('Every completed Ralph-loop step must end with a verified commit and push before the step is considered complete.');
  });

  test('repository uses Biome instead of Prettier for formatting', async () => {
    const biomeText = await Bun.file(BIOME_CONFIG_PATH).text();
    const formatChangedToolText = await Bun.file(FORMAT_CHANGED_TOOL_PATH).text();
    const packageText = await Bun.file(PACKAGE_PATH).text();

    expect(packageText).toContain('"format": "bun run tools/format-changed.ts"');
    expect(packageText).toContain('"@biomejs/biome":');
    expect(biomeText).toContain('"defaultBranch": "origin/main"');
    expect(biomeText).toContain('"ignoreUnknown": true');
    expect(biomeText).toContain('"!reference/**"');
    expect(biomeText).toContain('"lineWidth": 240');
    expect(biomeText).toContain('"quoteStyle": "single"');
    expect(formatChangedToolText).toContain("cmd: ['bun', 'x', 'biome', 'format', '--write', '--no-errors-on-unmatched', ...formatPaths]");
    expect(formatChangedToolText).toContain("const READ_ONLY_ROOTS = ['doom/', 'iwad/', 'reference/'] as const;");
    expect(existsSync(PRETTIER_CONFIG_PATH)).toBe(false);
  });

  test('audit script defaults to the playable plan control center', async () => {
    const scriptText = await Bun.file(AUDIT_SCRIPT_PATH).text();

    expect(scriptText).toContain('[string]$PromptPath = "D:\\Projects\\doom-in-typescript\\plan_fps\\PROMPT.md"');
    expect(scriptText).toContain('[string]$PrePromptPath = "D:\\Projects\\doom-in-typescript\\plan_fps\\PRE_PROMPT.md"');
    expect(scriptText).toContain('[string]$WorkingDirectory = "D:\\Projects\\doom-in-typescript"');
    expect(scriptText).toContain('[string]$LogDirectory = "D:\\Projects\\doom-in-typescript\\plan_fps\\loop_logs"');
    expect(scriptText).not.toMatch(/D:\\Projects\\bun-win32|doom_codex|\\plans\\/);
  });

  test('no-audit script defaults to the playable plan control center', async () => {
    const scriptText = await Bun.file(NO_AUDIT_SCRIPT_PATH).text();

    expect(scriptText).toContain('[string]$PromptPath = "D:\\Projects\\doom-in-typescript\\plan_fps\\PROMPT.md"');
    expect(scriptText).toContain('[string]$WorkingDirectory = "D:\\Projects\\doom-in-typescript"');
    expect(scriptText).toContain('[string]$LogDirectory = "D:\\Projects\\doom-in-typescript\\plan_fps\\loop_logs"');
    expect(scriptText).not.toContain('$PrePromptPath');
    expect(scriptText).not.toMatch(/D:\\Projects\\bun-win32|doom_codex|\\plans\\/);
  });

  test('codex audit script defaults to the playable plan control center', async () => {
    const scriptText = await Bun.file(CODEX_AUDIT_SCRIPT_PATH).text();

    expect(scriptText).toContain('[string]$PromptPath = "D:\\Projects\\doom-in-typescript\\plan_fps\\PROMPT.md"');
    expect(scriptText).toContain('[string]$PrePromptPath = "D:\\Projects\\doom-in-typescript\\plan_fps\\PRE_PROMPT.md"');
    expect(scriptText).toContain('[string]$WorkingDirectory = "D:\\Projects\\doom-in-typescript"');
    expect(scriptText).toContain('[string]$LogDirectory = "D:\\Projects\\doom-in-typescript\\plan_fps\\loop_logs"');
    expect(scriptText).not.toMatch(/D:\\Projects\\bun-win32|doom_codex|\\plans\\/);
  });

  test('codex no-audit script defaults to the playable plan control center', async () => {
    const scriptText = await Bun.file(CODEX_NO_AUDIT_SCRIPT_PATH).text();

    expect(scriptText).toContain('[string]$PromptPath = "D:\\Projects\\doom-in-typescript\\plan_fps\\PROMPT.md"');
    expect(scriptText).toContain('[string]$WorkingDirectory = "D:\\Projects\\doom-in-typescript"');
    expect(scriptText).toContain('[string]$LogDirectory = "D:\\Projects\\doom-in-typescript\\plan_fps\\loop_logs"');
    expect(scriptText).not.toContain('$PrePromptPath');
    expect(scriptText).not.toMatch(/D:\\Projects\\bun-win32|doom_codex|\\plans\\/);
  });

  test('codex scripts use non-interactive exec with explicit automation permissions', async () => {
    for (const scriptPath of [CODEX_AUDIT_SCRIPT_PATH, CODEX_NO_AUDIT_SCRIPT_PATH]) {
      const scriptText = await Bun.file(scriptPath).text();

      expect(scriptText).toContain('[ValidateSet("minimal", "low", "medium", "high", "xhigh", "max")]');
      expect(scriptText).toContain('[string]$Effort = "xhigh"');
      expect(scriptText).toContain('[string]$Model = "gpt-5.5"');
      expect(scriptText).toContain('[string]$CodexCommand = "codex"');
      expect(scriptText).toContain('function ConvertTo-ProcessArgument');
      expect(scriptText).toContain('function ConvertTo-CodexReasoningEffort');
      expect(scriptText).toContain('function Invoke-CodexCommand');
      expect(scriptText).toContain('function Resolve-CodexCommand');
      expect(scriptText).toContain('function Test-CodexCommand');
      expect(scriptText).toContain('"--output-last-message"');
      expect(scriptText).toContain('$standardInputPath = [System.IO.Path]::GetTempFileName()');
      expect(scriptText).toContain('[System.IO.File]::WriteAllText($standardInputPath, $InputText, (New-Object System.Text.UTF8Encoding($false)))');
      expect(scriptText).toContain('Start-Process -FilePath $Command');
      expect(scriptText).toContain('-RedirectStandardInput $standardInputPath');
      expect(scriptText).toContain('-NoNewWindow');
      expect(scriptText).toContain('Codex is still running; final response will be saved to $ResponsePath');
      expect(scriptText).toContain('[System.IO.Path]::ChangeExtension($command.Source, ".cmd")');
      expect(scriptText).toContain('[System.IO.Path]::ChangeExtension($resolvedPath, ".cmd")');
      expect(scriptText).toContain('if ($Value -eq "max")');
      expect(scriptText).toContain('return "xhigh"');
      expect(scriptText).toContain('Write-LoopSummary -Status "CLI_ERROR" -Reason "Codex CLI command not found: $CodexCommand.');
      expect(scriptText).toContain('$codexCommandError = Test-CodexCommand -Value $resolvedCodexCommand');
      expect(scriptText).toContain('"--ask-for-approval", "never",');
      expect(scriptText).toMatch(/"--ask-for-approval", "never",\s+"exec"/);
      expect(scriptText).toContain('"exec"');
      expect(scriptText).toContain('"--color", "never"');
      expect(scriptText).toContain('"--sandbox", "danger-full-access"');
      expect(scriptText).toContain('$codexArguments += @("--model", $Model)');
      expect(scriptText).toContain('"-c", "model_reasoning_effort=$codexReasoningEffort"');
      expect(scriptText).toContain('$codexArguments += "-"');
      expect(scriptText).toContain('Invoke-CodexCommand -Command $resolvedCodexCommand -Arguments $codexArguments');
      expect(scriptText).not.toContain('| & $resolvedCodexCommand @codexArguments 2>&1 | Out-String');
      expect(scriptText).not.toContain('$startInfo.FileName = $env:ComSpec');
      expect(scriptText).not.toContain('--dangerously-skip-permissions');
      expect(scriptText).not.toContain('--effort');
      expect(scriptText).not.toContain('--output-format');
      expect(scriptText).not.toContain('--print');
      expect(scriptText).not.toContain('Codex-opus-4-7');
    }
  });

  test('codex scripts capture CLI stderr without PowerShell NativeCommandError', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'doom-codex-ralph-loop-'));
    const fakeCodexCommandPath = join(temporaryDirectory, 'codex.cmd');
    const fakeCodexPowerShellPath = join(temporaryDirectory, 'codex.ps1');

    await Bun.write(
      fakeCodexCommandPath,
      [
        '@echo off',
        'if "%~1"=="--version" (',
        '  echo codex-fake 1.0',
        '  exit /b 0',
        ')',
        'echo OpenAI Codex v0.124.0 (research preview) 1>&2',
        'echo RLP_STATUS: NO_ELIGIBLE_STEP',
        'echo RLP_STEP_ID: NONE',
        'echo RLP_STEP_TITLE: NONE',
        'echo RLP_REASON: fake done',
        'exit /b 0',
        '',
      ].join('\r\n'),
    );
    await Bun.write(fakeCodexPowerShellPath, 'Write-Error "ps1 shim should not run"\r\nexit 9\r\n');

    try {
      const result = await runPowerShellScript(CODEX_NO_AUDIT_SCRIPT_PATH, ['-MaxIterations', '1', '-CodexCommand', fakeCodexPowerShellPath]);

      expect(result.exitCode).toBe(0);
      expect(result.combinedOutput).toContain(`Codex command: ${fakeCodexCommandPath}`);
      expect(result.combinedOutput).toContain('Codex arguments: --ask-for-approval never exec --color never --sandbox danger-full-access -c model_reasoning_effort=xhigh --model gpt-5.5 -');
      expect(result.combinedOutput).toContain('Execution model: gpt-5.5');
      expect(result.combinedOutput).toContain('LOOP_STATUS: NO_ELIGIBLE_STEP');
      expect(result.combinedOutput).not.toContain('OpenAI Codex v0.124.0 (research preview)');
      expect(result.combinedOutput).not.toContain('NativeCommandError');
      expect(result.combinedOutput).not.toContain('ps1 shim should not run');

      const responseLogMatch = result.combinedOutput.match(/LOOP_RESPONSE_LOG: (.+)/);
      expect(responseLogMatch).not.toBeNull();
      const responseLogText = await Bun.file(responseLogMatch?.[1]?.trim() ?? '').text();
      expect(responseLogText).toContain('OpenAI Codex v0.124.0 (research preview)');
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  test('codex scripts tolerate silent polling intervals before CLI output', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'doom-codex-ralph-loop-'));
    const fakeCodexCommandPath = join(temporaryDirectory, 'codex.cmd');

    await Bun.write(
      fakeCodexCommandPath,
      [
        '@echo off',
        'if "%~1"=="--version" (',
        '  echo codex-fake 1.0',
        '  exit /b 0',
        ')',
        'ping -n 2 127.0.0.1 >nul',
        'echo RLP_STATUS: NO_ELIGIBLE_STEP',
        'echo RLP_STEP_ID: NONE',
        'echo RLP_STEP_TITLE: NONE',
        'echo RLP_REASON: delayed fake done',
        'exit /b 0',
        '',
      ].join('\r\n'),
    );

    try {
      const result = await runPowerShellScript(CODEX_NO_AUDIT_SCRIPT_PATH, ['-MaxIterations', '1', '-CodexCommand', fakeCodexCommandPath]);

      expect(result.exitCode).toBe(0);
      expect(result.combinedOutput).toContain('LOOP_STATUS: NO_ELIGIBLE_STEP');
      expect(result.combinedOutput).not.toContain('Cannot bind argument to parameter');
      expect(result.combinedOutput).not.toContain('ParameterArgumentValidationErrorEmptyStringNotAllowed');
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  test('ralph-loop scripts inject execution metadata for handoff tracking', async () => {
    for (const scriptPath of [CODEX_AUDIT_SCRIPT_PATH, CODEX_NO_AUDIT_SCRIPT_PATH]) {
      const scriptText = await Bun.file(scriptPath).text();

      expect(scriptText).toContain('function Add-ExecutionMetadata');
      expect(scriptText).toContain('$executionAgent = "Codex"');
      expect(scriptText).toContain('[string]$Model = "gpt-5.5"');
      expect(scriptText).toContain('$executionModel = $Model');
      expect(scriptText).toContain('Record these exact values in any `plan_fps/HANDOFF_LOG.md` completion entry');
      expect(scriptText).toContain('RLP_AGENT: $executionAgent');
      expect(scriptText).toContain('RLP_MODEL: $executionModel');
      expect(scriptText).toContain('RLP_EFFORT: $executionEffort');
    }

    for (const scriptPath of [AUDIT_SCRIPT_PATH, NO_AUDIT_SCRIPT_PATH]) {
      const scriptText = await Bun.file(scriptPath).text();

      expect(scriptText).toContain('function Add-ExecutionMetadata');
      expect(scriptText).toContain('$executionAgent = "Claude Code"');
      expect(scriptText).toContain('$executionModel = "claude-cli-default-unspecified"');
      expect(scriptText).toContain('Record these exact values in any `plan_fps/HANDOFF_LOG.md` completion entry');
      expect(scriptText).toContain('RLP_AGENT: $executionAgent');
      expect(scriptText).toContain('RLP_MODEL: $executionModel');
      expect(scriptText).toContain('RLP_EFFORT: $executionEffort');
    }
  });

  test('codex scripts report a missing CLI before the loop starts', async () => {
    for (const scriptPath of [CODEX_AUDIT_SCRIPT_PATH, CODEX_NO_AUDIT_SCRIPT_PATH]) {
      const result = await runPowerShellScript(scriptPath, ['-MaxIterations', '1', '-CodexCommand', '__missing_codex_command_for_test__']);

      expect(result.exitCode).toBe(2);
      expect(result.combinedOutput).toContain('LOOP_STATUS: CLI_ERROR');
      expect(result.combinedOutput).toContain('Codex CLI command not found: __missing_codex_command_for_test__.');
      expect(result.combinedOutput).toContain('pass -CodexCommand with the full CLI path');
      expect(result.combinedOutput).not.toContain('ObjectNotFound');
      expect(result.combinedOutput).not.toContain('CommandNotFoundException');
    }
  });

  test('audit pre-prompt targets completed plan_fps steps without advancing the checklist', async () => {
    const promptText = await Bun.file(PRE_PROMPT_PATH).text();

    expect(promptText).toContain('Audit pass for `D:\\Projects\\doom-in-typescript`.');
    expect(promptText).toContain('Treat `D:\\Projects\\doom-in-typescript\\plan_fps\\` as the only active planning and execution control center.');
    expect(promptText).toContain('Open `D:\\Projects\\doom-in-typescript\\plan_fps\\MASTER_CHECKLIST.md`.');
    expect(promptText).toContain('Open the selected step file under `D:\\Projects\\doom-in-typescript\\plan_fps\\steps\\`.');
    expect(promptText).toContain('Do NOT modify `D:\\Projects\\doom-in-typescript\\plan_fps\\MASTER_CHECKLIST.md`.');
    expect(promptText).toContain('RLP_STATUS: COMPLETED|BLOCKED|LIMIT_REACHED');
    expect(promptText).toContain('Use the execution metadata supplied at the top of this prompt.');
    expect(promptText).toContain('Biome is the formatter.');
    expect(promptText).toContain('run `bun run format` before the verification sequence below.');
    expect(promptText).toContain('RLP_AGENT: <execution metadata agent or unknown>');
    expect(promptText).toContain('RLP_MODEL: <execution metadata model or unknown>');
    expect(promptText).toContain('RLP_EFFORT: <execution metadata effort or unknown>');
    expect(promptText).toContain('If the audit pass changes any files, commit the verified audit fixes and push them before reporting `RLP_STATUS: COMPLETED`.');
    expect(promptText).toContain('Do not open a pull request.');
    expect(promptText).toContain('Do not use GitHub apps, GitHub API tools, issue automation, release automation, or pull request workflows.');
    expect(promptText).not.toMatch(/D:\\Projects\\bun-win32|doom_codex|\\plans\\/);
  });

  test('forward prompt requires commit and push after one verified step', async () => {
    const promptText = await Bun.file(PROMPT_PATH).text();

    expect(promptText).toContain('Work on exactly one step.');
    expect(promptText).toContain('Use the execution metadata supplied at the top of this prompt.');
    expect(promptText).toContain('Biome is the formatter.');
    expect(promptText).toContain('1. `bun run format`');
    expect(promptText).toContain('Each `HANDOFF_LOG.md` completion entry must include:');
    expect(promptText).toContain('RLP_AGENT: <execution metadata agent or unknown>');
    expect(promptText).toContain('RLP_MODEL: <execution metadata model or unknown>');
    expect(promptText).toContain('RLP_EFFORT: <execution metadata effort or unknown>');
    expect(promptText).toContain('After the step is verified and logs/checklist are updated, commit the step and push it before stopping.');
    expect(promptText).toContain('Make repository changes, commits, and pushes as the configured human user only.');
    expect(promptText).toContain('Do not override `user.name`, `user.email`, commit author, commit committer, or publishing identity to an AI or agent identity.');
    expect(promptText).toContain('References to tools, models, or agents are allowed when technically relevant, but they are not authors or publishing identities for this repository.');
    expect(promptText).toContain('Stage files explicitly by path.');
    expect(promptText).toContain('Do not open a pull request.');
    expect(promptText).toContain('Do not use GitHub apps, GitHub API tools, issue automation, release automation, or pull request workflows.');
  });

  test('forward prompt requires an active resumable step progress log', async () => {
    const promptText = await Bun.file(PROMPT_PATH).text();
    const readmeText = await Bun.file(README_PATH).text();

    for (const planText of [promptText, readmeText]) {
      expect(planText).toContain('plan_fps/loop_logs/step_<step-id>_progress.txt');
      expect(planText).toContain('completed work');
      expect(planText).toContain('remaining planned work');
    }

    expect(promptText).toContain('next exact action');
    expect(promptText).toContain('Do not stage, commit, or push the active step progress log');
    expect(promptText).toContain("Delete only that step's progress log after the step is marked complete, all required verification passes, and the verified commit has been pushed.");
    expect(promptText).toContain('leave the progress log in place');
    expect(promptText).toContain('RLP_PROGRESS_LOG: KEPT|DELETED|NONE');
    expect(readmeText).toContain('Do not delete it on blocked, failed, interrupted, or limit-reached work.');
  });

  test('status repair prompts preserve the progress log status field', async () => {
    for (const scriptPath of [AUDIT_SCRIPT_PATH, NO_AUDIT_SCRIPT_PATH, CODEX_AUDIT_SCRIPT_PATH, CODEX_NO_AUDIT_SCRIPT_PATH]) {
      const scriptText = await Bun.file(scriptPath).text();

      expect(scriptText).toContain('RLP_PROGRESS_LOG: KEPT|DELETED|NONE');
    }
  });

  test('loop log directory exists for script output', async () => {
    expect(existsSync('plan_fps/loop_logs')).toBe(true);
    expect(await Bun.file('plan_fps/loop_logs/.gitkeep').exists()).toBe(true);
  });

  test('readme documents both Claude and Codex Ralph-loop scripts', async () => {
    const readmeText = await Bun.file(README_PATH).text();

    expect(readmeText).toContain('`RALPH_LOOP_CLAUDE_CODE.ps1`: runs an audit pass from `PRE_PROMPT.md`, then a forward step from `PROMPT.md`.');
    expect(readmeText).toContain('`RALPH_LOOP_CLAUDE_CODE_NO_AUDIT.ps1`: runs only the forward step from `PROMPT.md`.');
    expect(readmeText).toContain('`RALPH_LOOP_CODEX.ps1`: runs an audit pass from `PRE_PROMPT.md`, then a forward step from `PROMPT.md` through `codex exec`.');
    expect(readmeText).toContain('`RALPH_LOOP_CODEX_NO_AUDIT.ps1`: runs only the forward step from `PROMPT.md` through `codex exec`.');
    expect(readmeText).toContain('The Codex scripts require the Codex CLI terminal command on `PATH`, or `-CodexCommand <full CLI path>`.');
    expect(readmeText).toContain('Run `bun run format` with Biome, then run verification in the listed order.');
    expect(readmeText).toContain('Handoff entries must record `agent`, `model`, and `effort`.');
  });
});
