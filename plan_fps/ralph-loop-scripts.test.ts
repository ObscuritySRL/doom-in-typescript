import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

const AUDIT_SCRIPT_PATH = 'plan_fps/RALPH_LOOP_CLAUDE_CODE.ps1';
const NO_AUDIT_SCRIPT_PATH = 'plan_fps/RALPH_LOOP_CLAUDE_CODE_NO_AUDIT.ps1';
const PRE_PROMPT_PATH = 'plan_fps/PRE_PROMPT.md';

describe('Ralph-loop PowerShell scripts', () => {
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

  test('audit pre-prompt targets completed plan_fps steps without advancing the checklist', async () => {
    const promptText = await Bun.file(PRE_PROMPT_PATH).text();

    expect(promptText).toContain('Audit pass for `D:\\Projects\\doom-in-typescript`.');
    expect(promptText).toContain('Treat `D:\\Projects\\doom-in-typescript\\plan_fps\\` as the only active planning and execution control center.');
    expect(promptText).toContain('Open `D:\\Projects\\doom-in-typescript\\plan_fps\\MASTER_CHECKLIST.md`.');
    expect(promptText).toContain('Open the selected step file under `D:\\Projects\\doom-in-typescript\\plan_fps\\steps\\`.');
    expect(promptText).toContain('Do NOT modify `D:\\Projects\\doom-in-typescript\\plan_fps\\MASTER_CHECKLIST.md`.');
    expect(promptText).toContain('RLP_STATUS: COMPLETED|BLOCKED|LIMIT_REACHED');
    expect(promptText).not.toMatch(/D:\\Projects\\bun-win32|doom_codex|\\plans\\/);
  });

  test('loop log directory exists for script output', async () => {
    expect(existsSync('plan_fps/loop_logs')).toBe(true);
    expect(await Bun.file('plan_fps/loop_logs/.gitkeep').exists()).toBe(true);
  });
});
