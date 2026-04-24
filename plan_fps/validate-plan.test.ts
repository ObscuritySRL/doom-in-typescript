import { describe, expect, test } from 'bun:test';

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { PLAN_VALIDATION_COMMAND, parseChecklist, runValidationCli, validatePlan } from './validate-plan.ts';

function createStepText(options: {
  readonly expectedChanges: readonly string[];
  readonly goalText: string;
  readonly prereqs: readonly string[];
  readonly stepId: string;
  readonly testFiles: readonly string[];
  readonly title: string;
  readonly verificationCommands: readonly string[];
}): string {
  const { expectedChanges, goalText, prereqs, stepId, testFiles, title, verificationCommands } = options;

  return `# [ ] STEP ${stepId}: ${title}

## Goal

${goalText}

## Prerequisites

${prereqs.map((prerequisite) => `- ${prerequisite}`).join('\n')}

## Read Only

- package.json

## Consult Only If Blocked

- none

## Expected Changes

${expectedChanges.map((expectedChange) => `- ${expectedChange}`).join('\n')}

## Test Files

${testFiles.map((testFile) => `- ${testFile}`).join('\n')}

## Verification

${verificationCommands.map((verificationCommand) => `- \`${verificationCommand}\``).join('\n')}

## Completion Criteria

- lock an exact validator contract

## Required Log Updates

- \`FACT_LOG.md\`: none
- \`DECISION_LOG.md\`: none
- \`REFERENCE_ORACLES.md\`: none
- \`HANDOFF_LOG.md\`: append completion entry

## Later Steps That May Benefit

- none
`;
}

function createPromptText(includeLeaveProgressLogInstruction: boolean): string {
  const lines = [
    '# Prompt',
    '',
    'plan_fps/loop_logs/step_<step-id>_progress.txt',
    'completed work',
    'remaining planned work',
    'next exact action',
    'Do not stage, commit, or push the active step progress log',
    "Delete only that step's progress log after the step is marked complete, all required verification passes, and the verified commit has been pushed.",
    'RLP_PROGRESS_LOG: KEPT|DELETED|NONE',
  ];

  if (includeLeaveProgressLogInstruction) {
    lines.splice(lines.length - 1, 0, 'leave the progress log in place');
  }

  return lines.join('\n');
}

async function withPlanFixture(overrides: Readonly<Record<string, string>>, run: (fixture: { readonly planDirectory: string }) => Promise<void>): Promise<void> {
  const fixtureRoot = await mkdtemp(join(process.cwd(), '.tmp-validate-plan-'));
  const planDirectory = join(fixtureRoot, 'plan_fps');

  const defaultFiles: Readonly<Record<string, string>> = {
    '.gitignore': 'plan_fps/loop_logs/*.txt\n',
    'plan_fps/MASTER_CHECKLIST.md': `# Master Checklist

- Total steps: 2
- First eligible step: \`00-001 Test Step\`
- Runtime target: \`bun run doom.ts\`
- Rule: choose the first unchecked step whose prerequisites are complete.

## Phase 00: Test

- [ ] \`00-001\` \`test-step\` | prereqs: \`none\` | file: \`plan_fps/steps/00-001-test-step.md\`
- [ ] \`15-010\` \`gate-final-side-by-side\` | prereqs: \`00-001\` | file: \`plan_fps/steps/15-010-gate-final-side-by-side.md\`
`,
    'plan_fps/PROMPT.md': createPromptText(true),
    'plan_fps/README.md': `# README

plan_fps/loop_logs/step_<step-id>_progress.txt
completed work
remaining planned work
Delete only that step's \`plan_fps/loop_logs/step_<step-id>_progress.txt\` after the step is marked complete, all required verification passes, and the verified commit has been pushed.
Do not delete it on blocked, failed, interrupted, or limit-reached work.
`,
    'plan_fps/STEP_TEMPLATE.md': '`loop_logs/step_<step-id>_progress.txt`: keep completed work and remaining planned work current until the verified step is pushed\n',
    'plan_fps/steps/00-001-test-step.md': createStepText({
      expectedChanges: ['plan_fps/example.txt'],
      goalText: 'Exercise the validator fixture.',
      prereqs: ['none'],
      stepId: '00-001',
      testFiles: ['plan_fps/example.test.ts'],
      title: 'Test Step',
      verificationCommands: ['bun test plan_fps/example.test.ts', 'bun test', 'bun x tsc --noEmit --project tsconfig.json'],
    }),
    'plan_fps/steps/15-010-gate-final-side-by-side.md': createStepText({
      expectedChanges: ['plan_fps/final-gate.txt'],
      goalText: 'Confirm bun run doom.ts remains the final acceptance runtime target.',
      prereqs: ['00-001'],
      stepId: '15-010',
      testFiles: ['plan_fps/final-gate.test.ts'],
      title: 'Gate Final Side By Side',
      verificationCommands: ['bun test plan_fps/final-gate.test.ts', 'bun test', 'bun x tsc --noEmit --project tsconfig.json'],
    }),
  };

  try {
    const files = { ...defaultFiles, ...overrides };
    for (const [relativePath, contents] of Object.entries(files)) {
      const fullPath = join(fixtureRoot, relativePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, contents);
    }

    await run({ planDirectory });
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
}

describe('playable plan validator', () => {
  test('accepts the generated plan with the exact step count and first step', async () => {
    const result = await validatePlan();

    expect(result.errors).toEqual([]);
    expect(result.totalSteps).toBe(223);
    expect(result.firstStep).toBe('00-001');
  });

  test('parses every checklist entry with exact ids and step file paths', async () => {
    const checklistText = await Bun.file('plan_fps/MASTER_CHECKLIST.md').text();
    const checklistSteps = parseChecklist(checklistText);

    expect(checklistSteps).toHaveLength(223);
    expect(checklistSteps[0]).toEqual({
      filePath: 'plan_fps/steps/00-001-classify-existing-plan.md',
      id: '00-001',
      lineNumber: 10,
      prereq: 'none',
      titleSlug: 'classify-existing-plan',
    });
    expect(checklistSteps.at(-1)).toEqual({
      filePath: 'plan_fps/steps/15-010-gate-final-side-by-side.md',
      id: '15-010',
      lineNumber: 277,
      prereq: '15-009',
      titleSlug: 'gate-final-side-by-side',
    });
  });

  test('exports the exact Bun command contract for plan validation', () => {
    expect(PLAN_VALIDATION_COMMAND).toBe('bun run plan_fps/validate-plan.ts');
  });

  test('accepts a minimal valid fixture through an explicit planDirectory', async () => {
    await withPlanFixture({}, async ({ planDirectory }) => {
      const result = await validatePlan(planDirectory);

      expect(result).toEqual({
        errors: [],
        firstStep: '00-001',
        totalSteps: 2,
      });
    });
  });

  test('returns exact diagnostics for a malformed fixture', async () => {
    await withPlanFixture(
      {
        'plan_fps/PROMPT.md': createPromptText(false),
        'plan_fps/steps/00-001-test-step.md': createStepText({
          expectedChanges: ['plan_fps/example.txt'],
          goalText: 'Exercise the validator fixture.',
          prereqs: ['none'],
          stepId: '00-001',
          testFiles: ['plan_fps/example.test.ts'],
          title: 'Test Step',
          verificationCommands: ['bun test', 'bun x tsc --noEmit --project tsconfig.json'],
        }),
      },
      async ({ planDirectory }) => {
        const result = await validatePlan(planDirectory);

        expect(result).toEqual({
          errors: [
            {
              file: 'plan_fps/steps/00-001-test-step.md',
              message: 'Verification must include the focused bun test command.',
            },
            {
              file: 'plan_fps/PROMPT.md',
              message: 'Missing active step progress log instruction: leave the progress log in place',
            },
          ],
          firstStep: '00-001',
          totalSteps: 2,
        });

        const standardOutputLines: string[] = [];
        const standardErrorLines: string[] = [];
        const exitCode = await runValidationCli(
          planDirectory,
          (line) => {
            standardOutputLines.push(line);
          },
          (line) => {
            standardErrorLines.push(line);
          },
        );

        expect(exitCode).toBe(1);
        expect(standardOutputLines).toEqual([]);
        expect(standardErrorLines).toEqual([
          'plan_fps/steps/00-001-test-step.md: Verification must include the focused bun test command.',
          'plan_fps/PROMPT.md: Missing active step progress log instruction: leave the progress log in place',
        ]);
      },
    );
  });
});
