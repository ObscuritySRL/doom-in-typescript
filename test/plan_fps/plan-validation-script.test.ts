import { afterEach, describe, expect, test } from 'bun:test';

import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PLAN_VALIDATION_COMMAND, runValidationCli } from '../../plan_fps/validate-plan.ts';

const RUNTIME_TARGET = 'bun run doom.ts';
const STEP_PROGRESS_LOG_PATTERN = 'plan_fps/loop_logs/step_<step-id>_progress.txt';
const REQUIRED_STEP_TEMPLATE_LINE = '`loop_logs/step_<step-id>_progress.txt`: keep completed work and remaining planned work current until the verified step is pushed';

const REQUIRED_PROMPT_PHRASES = [
  STEP_PROGRESS_LOG_PATTERN,
  'completed work',
  'remaining planned work',
  'next exact action',
  'Do not stage, commit, or push the active step progress log',
  "Delete only that step's progress log after the step is marked complete, all required verification passes, and the verified commit has been pushed.",
  'leave the progress log in place',
  'RLP_PROGRESS_LOG: KEPT|DELETED|NONE',
] as const;

const REQUIRED_README_PHRASES = [
  STEP_PROGRESS_LOG_PATTERN,
  'completed work',
  'remaining planned work',
  "Delete only that step's `plan_fps/loop_logs/step_<step-id>_progress.txt` after the step is marked complete, all required verification passes, and the verified commit has been pushed.",
  'Do not delete it on blocked, failed, interrupted, or limit-reached work.',
] as const;

const temporaryWorkspaceDirectories: string[] = [];

describe('plan validation script', () => {
  afterEach(async () => {
    for (const temporaryWorkspaceDirectory of temporaryWorkspaceDirectories.splice(0)) {
      await rm(temporaryWorkspaceDirectory, { force: true, recursive: true });
    }
  });

  test('uses the exact Bun CLI contract and success line', async () => {
    expect(PLAN_VALIDATION_COMMAND).toBe('bun run plan_fps/validate-plan.ts');

    const workspaceRoot = join(import.meta.dir, '..', '..');
    const validationProcess = Bun.spawn(['bun', 'run', 'plan_fps/validate-plan.ts'], {
      cwd: workspaceRoot,
      stderr: 'pipe',
      stdout: 'pipe',
    });

    const standardOutput = await new Response(validationProcess.stdout).text();
    const standardError = await new Response(validationProcess.stderr).text();

    expect(await validationProcess.exited).toBe(0);
    expect(standardError).toBe('');
    expect(standardOutput.replace(/\r\n/g, '\n')).toBe('Validated 223 playable parity steps. First step: 00-001.\n');
  });

  test('reports the exact final gate runtime-target diagnostic for an invalid plan', async () => {
    const temporaryWorkspaceDirectory = await mkdtemp(join(tmpdir(), 'doom-plan-validation-'));
    temporaryWorkspaceDirectories.push(temporaryWorkspaceDirectory);

    const planDirectory = await writeMinimalPlanFixture(temporaryWorkspaceDirectory, {
      includeRuntimeTargetInFinalGate: false,
    });

    const standardOutputLines: string[] = [];
    const standardErrorLines: string[] = [];
    const exitCode = await runValidationCli(
      planDirectory,
      (line) => standardOutputLines.push(line),
      (line) => standardErrorLines.push(line),
    );

    expect(exitCode).toBe(1);
    expect(standardOutputLines).toEqual([]);
    expect(standardErrorLines).toEqual(['plan_fps/steps/15-010-gate-final-side-by-side.md: Final acceptance gate must reference bun run doom.ts.']);
  });
});

function buildStepMarkdown(stepId: string, stepTitle: string, prerequisite: string, expectedChangePath: string, testFilePath: string, goal: string): string {
  return `# [ ] STEP ${stepId}: ${stepTitle}

## Goal

${goal}

## Prerequisites

- ${prerequisite}

## Read Only

- plan_fps/README.md

## Consult Only If Blocked

- none

## Expected Changes

- ${expectedChangePath}

## Test Files

- ${testFilePath}

## Verification

- \`bun test ${testFilePath}\`
- \`bun test\`
- \`bun x tsc --noEmit --project tsconfig.json\`

## Completion Criteria

- The step stays on the Bun runtime path.

## Required Log Updates

- \`FACT_LOG.md\`: none
- \`DECISION_LOG.md\`: update as needed
- \`REFERENCE_ORACLES.md\`: none
- \`HANDOFF_LOG.md\`: append completion entry

## Later Steps That May Benefit

- none
`;
}

async function writeMinimalPlanFixture(temporaryWorkspaceDirectory: string, options: { readonly includeRuntimeTargetInFinalGate: boolean }): Promise<string> {
  const planDirectory = join(temporaryWorkspaceDirectory, 'plan_fps');
  await mkdir(join(planDirectory, 'steps'), { recursive: true });

  await Bun.write(join(temporaryWorkspaceDirectory, '.gitignore'), 'plan_fps/loop_logs/*.txt\n');
  await Bun.write(
    join(planDirectory, 'MASTER_CHECKLIST.md'),
    `# Master Checklist

- Total steps: 2
- First eligible step: \`00-001 Classify Existing Plan\`
- Runtime target: \`${RUNTIME_TARGET}\`
- Rule: choose the first unchecked step whose prerequisites are complete.

## Phase 00: Governance / Plan Foundation

- [ ] \`00-001\` \`classify-existing-plan\` | prereqs: \`none\` | file: \`plan_fps/steps/00-001-classify-existing-plan.md\`
- [ ] \`15-010\` \`gate-final-side-by-side\` | prereqs: \`00-001\` | file: \`plan_fps/steps/15-010-gate-final-side-by-side.md\`
`,
  );
  await Bun.write(join(planDirectory, 'PROMPT.md'), `${REQUIRED_PROMPT_PHRASES.join('\n')}\n`);
  await Bun.write(join(planDirectory, 'README.md'), `${REQUIRED_README_PHRASES.join('\n')}\n`);
  await Bun.write(join(planDirectory, 'STEP_TEMPLATE.md'), `${REQUIRED_STEP_TEMPLATE_LINE}\n`);
  await Bun.write(
    join(planDirectory, 'steps', '00-001-classify-existing-plan.md'),
    buildStepMarkdown('00-001', 'Classify Existing Plan', 'none', 'plan_fps/manifests/00-001-classify-existing-plan.json', 'test/plan_fps/00-001-classify-existing-plan.test.ts', 'Lock the initial plan governance rules.'),
  );
  await Bun.write(
    join(planDirectory, 'steps', '15-010-gate-final-side-by-side.md'),
    buildStepMarkdown(
      '15-010',
      'Gate Final Side By Side',
      '00-001',
      'plan_fps/reports/15-010-gate-final-side-by-side.txt',
      'test/plan_fps/15-010-gate-final-side-by-side.test.ts',
      options.includeRuntimeTargetInFinalGate ? `Verify ${RUNTIME_TARGET} reaches the final side-by-side gate.` : 'Verify the final side-by-side gate is reachable.',
    ),
  );

  return planDirectory;
}
