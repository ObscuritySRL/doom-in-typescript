import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const AUDIT_SCRIPT_PATH = 'plan_fps/RALPH_LOOP_CLAUDE_CODE.ps1';
const CODEX_AUDIT_SCRIPT_PATH = 'plan_fps/RALPH_LOOP_CODEX.ps1';
const CODEX_NO_AUDIT_SCRIPT_PATH = 'plan_fps/RALPH_LOOP_CODEX_NO_AUDIT.ps1';
const NO_AUDIT_SCRIPT_PATH = 'plan_fps/RALPH_LOOP_CLAUDE_CODE_NO_AUDIT.ps1';
const PRE_PROMPT_PATH = 'plan_fps/PRE_PROMPT.md';
const PROMPT_PATH = 'plan_fps/PROMPT.md';
const README_PATH = 'plan_fps/README.md';

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
      expect(scriptText).toContain('[string]$Model = ""');
      expect(scriptText).toContain('[string]$CodexCommand = "codex"');
      expect(scriptText).toContain('function ConvertTo-CodexReasoningEffort');
      expect(scriptText).toContain('if ($Value -eq "max")');
      expect(scriptText).toContain('return "xhigh"');
      expect(scriptText).toContain('"exec"');
      expect(scriptText).toContain('"--color", "never"');
      expect(scriptText).toContain('"--ask-for-approval", "never"');
      expect(scriptText).toContain('"--sandbox", "danger-full-access"');
      expect(scriptText).toContain('"-c", "model_reasoning_effort=$codexReasoningEffort"');
      expect(scriptText).toContain('$codexArguments += "-"');
      expect(scriptText).toContain('| & $CodexCommand @codexArguments 2>&1 | Out-String');
      expect(scriptText).not.toContain('--dangerously-skip-permissions');
      expect(scriptText).not.toContain('--effort');
      expect(scriptText).not.toContain('--output-format');
      expect(scriptText).not.toContain('--print');
      expect(scriptText).not.toContain('Codex-opus-4-7');
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
    expect(promptText).toContain('If the audit pass changes any files, commit the verified audit fixes and push them before reporting `RLP_STATUS: COMPLETED`.');
    expect(promptText).toContain('Do not open a pull request.');
    expect(promptText).toContain('Do not use GitHub apps, GitHub API tools, issue automation, release automation, or pull request workflows.');
    expect(promptText).not.toMatch(/D:\\Projects\\bun-win32|doom_codex|\\plans\\/);
  });

  test('forward prompt requires commit and push after one verified step', async () => {
    const promptText = await Bun.file(PROMPT_PATH).text();

    expect(promptText).toContain('Work on exactly one step.');
    expect(promptText).toContain('After the step is verified and logs/checklist are updated, commit the step and push it before stopping.');
    expect(promptText).toContain('Make repository changes, commits, and pushes as the configured human user only.');
    expect(promptText).toContain('Do not override `user.name`, `user.email`, commit author, commit committer, or publishing identity to an AI or agent identity.');
    expect(promptText).toContain('References to tools, models, or agents are allowed when technically relevant, but they are not authors or publishing identities for this repository.');
    expect(promptText).toContain('Stage files explicitly by path.');
    expect(promptText).toContain('Do not open a pull request.');
    expect(promptText).toContain('Do not use GitHub apps, GitHub API tools, issue automation, release automation, or pull request workflows.');
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
  });
});
