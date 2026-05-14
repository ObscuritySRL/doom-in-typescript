import { describe, expect, test } from 'bun:test';

const PROMPT_PATH = 'plan_final/PROMPT.md';
const PRE_PROMPT_PATH = 'plan_final/PRE_PROMPT.md';

async function readContractText(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe('plan_final Ralph-loop launcher contract', () => {
  test('PROMPT.md anchors the loop to plan_final/ and reads AGENTS plus the master checklist', async () => {
    const text = await readContractText(PROMPT_PATH);

    expect(text).toContain('Continue the Ralph loop using `plan_final/`');
    expect(text).toContain('AGENTS.md');
    expect(text).toContain('plan_final/PROMPT.md');
    expect(text).toContain('plan_final/MASTER_CHECKLIST.md');
  });

  test('PROMPT.md honors RLP_LANE and falls back to plan_final/select-step.ts', async () => {
    const text = await readContractText(PROMPT_PATH);

    expect(text).toContain('RLP_LANE');
    expect(text).toContain('first eligible step in that lane only');
    expect(text).toContain('`bun run plan_final/select-step.ts`');
  });

  test('PROMPT.md requires the progress log start before any implementation reads', async () => {
    const text = await readContractText(PROMPT_PATH);

    expect(text).toContain('Before reading implementation files, append a start entry');
    expect(text).toContain('plan_final/progress/<lane>/<step-id>.md');
    expect(text).toContain('Read only the paths listed in the selected step');
    expect(text).toContain('Change only the selected step write lock and expected changes');
    expect(text).toContain('Add or update the focused test');
  });

  test('PROMPT.md fixes the verification command order', async () => {
    const text = await readContractText(PROMPT_PATH);

    expect(text).toContain('`bun run format`');
    expect(text).toContain('focused `bun test`');
    expect(text).toContain('full `bun test`');
    expect(text).toContain('typecheck');
    expect(text).toMatch(/bun run format[^]+focused `bun test`[^]+full `bun test`[^]+typecheck/);
  });

  test('PROMPT.md mandates fix-rerun on any failure rather than skipping or weakening tests', async () => {
    const text = await readContractText(PROMPT_PATH);

    expect(text).toContain('If any command fails, log it, fix it, and rerun the full sequence from the beginning');
  });

  test('PROMPT.md requires explicit staging, commit, push, and SHA logging', async () => {
    const text = await readContractText(PROMPT_PATH);

    expect(text).toContain('stage explicit paths');
    expect(text).toContain('commit');
    expect(text).toContain('push');
    expect(text).toContain('log the pushed commit SHA');
  });

  test('PROMPT.md ends with the machine-readable status trailer naming every required key', async () => {
    const text = await readContractText(PROMPT_PATH);

    expect(text).toContain('RLP_STATUS: COMPLETED|BLOCKED|NO_ELIGIBLE_STEP');
    expect(text).toContain('RLP_STEP_ID:');
    expect(text).toContain('RLP_LANE:');
    expect(text).toContain('RLP_FILES_CHANGED:');
    expect(text).toContain('RLP_TEST_COMMANDS:');
    expect(text).toContain('RLP_REASON:');
  });

  test('PRE_PROMPT.md bans non-Bun runtimes and forbids manifest-only completion claims', async () => {
    const text = await readContractText(PRE_PROMPT_PATH);

    expect(text).toContain('Use Bun only');
    expect(text).toMatch(/npm.*yarn.*pnpm.*npx.*node/);
    expect(text).toMatch(/jest.*vitest.*mocha.*ts-node.*tsx/);
  });

  test('PRE_PROMPT.md ties completion to executable tests and live side-by-side evidence', async () => {
    const text = await readContractText(PRE_PROMPT_PATH);

    expect(text).toContain('not complete because a checklist says so');
    expect(text).toContain('executable tests and live side-by-side evidence');
    expect(text).toContain('`bun run doom.ts`');
    expect(text).toContain('matches the reference');
  });
});
