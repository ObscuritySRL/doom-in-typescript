import { describe, expect, test } from 'bun:test';

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { PLAN_VALIDATION_COMMAND, parseChecklist, runValidationCli, validatePlan } from './validate-plan.ts';

const expectedTotalSteps = 398;
const finalGateStepId = '13-004';
const finalGateSlug = 'gate-full-final-side-by-side-proof';

interface FixtureOptions {
  readonly overrides?: Readonly<Record<string, string>>;
}

function createChecklistLine(step: FixtureStep): string {
  return `- [ ] \`${step.id}\` \`${step.slug}\` | lane: \`${step.lane}\` | prereqs: \`${step.prerequisites.join(',')}\` | file: \`plan_vanilla_parity/steps/${step.id}-${step.slug}.md\``;
}

function createFixtureSteps(): readonly FixtureStep[] {
  const steps: FixtureStep[] = [];

  for (let stepIndex = 1; stepIndex <= expectedTotalSteps - 1; stepIndex += 1) {
    const id = `00-${String(stepIndex).padStart(3, '0')}`;
    const slug = stepIndex === 1 ? 'establish-vanilla-parity-control-center' : `generated-step-${String(stepIndex).padStart(3, '0')}`;
    const title = stepIndex === 1 ? 'Establish Vanilla Parity Control Center' : `Generated Step ${String(stepIndex).padStart(3, '0')}`;
    const previousId = stepIndex === 1 ? 'none' : `00-${String(stepIndex - 1).padStart(3, '0')}`;

    steps.push({
      id,
      lane: 'governance',
      prerequisites: [previousId],
      slug,
      title,
    });
  }

  steps.push({
    id: finalGateStepId,
    lane: 'acceptance',
    prerequisites: ['00-397'],
    slug: finalGateSlug,
    title: 'Gate Full Final Side By Side Proof',
  });

  return steps;
}

function createMasterChecklist(steps: readonly FixtureStep[]): string {
  return `# Master Checklist

- Total steps: ${expectedTotalSteps}
- First eligible step: \`00-001 establish-vanilla-parity-control-center\`
- Runtime target: \`bun run doom.ts\`
- Rule: choose the first unchecked step whose prerequisites are complete.

## Phase 00: Fixture

${steps.map(createChecklistLine).join('\n')}
`;
}

function createParallelWorkText(): string {
  return `# Parallel Work

| lane | what can proceed immediately | blocked by | owns | must not touch |
| --- | --- | --- | --- | --- |
| governance | immediate | none | plan_vanilla_parity/steps/ | doom/; iwad/; reference/ |
| acceptance | blocked | runtime lanes | test/vanilla_parity/acceptance/ | doom/; iwad/; reference/ |
`;
}

function createRequiredPlanFiles(steps: readonly FixtureStep[]): Readonly<Record<string, string>> {
  return {
    'plan_vanilla_parity/DEPENDENCY_GRAPH.md': '# Dependency Graph\n',
    'plan_vanilla_parity/MASTER_CHECKLIST.md': createMasterChecklist(steps),
    'plan_vanilla_parity/PARALLEL_WORK.md': createParallelWorkText(),
    'plan_vanilla_parity/PRE_PROMPT.md': '# Audit Prompt\n',
    'plan_vanilla_parity/PROMPT.md': '# Ralph Loop Prompt\n',
    'plan_vanilla_parity/README.md': '# plan_vanilla_parity\n',
    'plan_vanilla_parity/REFERENCE_ORACLES.md': '# Reference Oracles\n',
    'plan_vanilla_parity/RISK_REGISTER.md': '# Risk Register\n',
    'plan_vanilla_parity/SOURCE_CATALOG.md': '# Source Catalog\n',
    'plan_vanilla_parity/STEP_TEMPLATE.md': '# [ ] STEP <id>: <Title>\n',
    'plan_vanilla_parity/validate-plan.test.ts': 'placeholder\n',
    'plan_vanilla_parity/validate-plan.ts': 'placeholder\n',
  };
}

function createStepText(step: FixtureStep, options: { readonly finalEvidence?: string; readonly verificationCommands?: readonly string[]; readonly writeLock?: readonly string[] } = {}): string {
  const testPath = `test/vanilla_parity/${step.slug}.test.ts`;
  const writeLock = options.writeLock ?? [`test/vanilla_parity/${step.slug}.json`, testPath];
  const verificationCommands = options.verificationCommands ?? ['bun run format', `bun test ${testPath}`, 'bun test', 'bun x tsc --noEmit --project tsconfig.json'];
  const finalEvidence =
    options.finalEvidence ??
    (step.id === finalGateStepId
      ? '- A machine-generated final side-by-side report from clean launch that runs bun run doom.ts and the selected local reference with the same deterministic input stream.\n- The report compares deterministic state, framebuffer, audio, music events, menu transitions, level transitions, save/load bytes, demo playback, and full-playthrough completion with zero default differences.'
      : '- Focused evidence is committed and pushed.');

  return `# [ ] STEP ${step.id}: ${step.title}

## id

${step.id}

## lane

${step.lane}

## title

${step.title}

## goal

Validate a fixture step.

## prerequisites

${step.prerequisites.map((prerequisite) => `- ${prerequisite}`).join('\n')}

## parallel-safe-with

- acceptance lane

## write lock

${writeLock.map((path) => `- ${path}`).join('\n')}

## read-only paths

- AGENTS.md

## research sources

- local fixture

## expected changes

${writeLock.map((path) => `- ${path}`).join('\n')}

## test files

- ${testPath}

## verification commands

${verificationCommands.map((command) => `- \`${command}\``).join('\n')}

## completion criteria

- The fixture step passes validation.

## final evidence

${finalEvidence}
`;
}

async function writeFixtureFiles(fixtureRoot: string, files: Readonly<Record<string, string>>): Promise<void> {
  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = join(fixtureRoot, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents);
  }
}

async function withPlanFixture(options: FixtureOptions, run: (planDirectory: string, steps: readonly FixtureStep[]) => Promise<void>): Promise<void> {
  const fixtureRoot = await mkdtemp(join(process.cwd(), '.cache', 'plan-vanilla-parity-fixture-'));
  const planDirectory = join(fixtureRoot, 'plan_vanilla_parity');
  const steps = createFixtureSteps();
  const files: Record<string, string> = { ...createRequiredPlanFiles(steps) };

  for (const step of steps) {
    files[`plan_vanilla_parity/steps/${step.id}-${step.slug}.md`] = createStepText(step);
  }

  for (const [relativePath, contents] of Object.entries(options.overrides ?? {})) {
    files[relativePath] = contents;
  }

  try {
    await writeFixtureFiles(fixtureRoot, files);
    await run(planDirectory, steps);
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
}

interface FixtureStep {
  readonly id: string;
  readonly lane: string;
  readonly prerequisites: readonly string[];
  readonly slug: string;
  readonly title: string;
}

describe('vanilla parity plan validator', () => {
  test('accepts the generated vanilla parity plan', async () => {
    const result = await validatePlan();

    expect(result.errors).toEqual([]);
    expect(result.firstStep).toBe('00-001');
    expect(result.totalSteps).toBe(expectedTotalSteps);
  });

  test('parses the generated checklist and locks the validation command', async () => {
    const checklistText = await Bun.file('plan_vanilla_parity/MASTER_CHECKLIST.md').text();
    const steps = parseChecklist(checklistText);

    expect(steps).toHaveLength(expectedTotalSteps);
    expect(steps[0]?.id).toBe('00-001');
    expect(steps.at(-1)?.id).toBe(finalGateStepId);
    expect(PLAN_VALIDATION_COMMAND).toBe('bun run plan_vanilla_parity/validate-plan.ts');
  });

  test('accepts a complete fixture through an explicit plan directory', async () => {
    await withPlanFixture({}, async (planDirectory) => {
      const result = await validatePlan(planDirectory);

      expect(result).toEqual({
        errors: [],
        firstStep: '00-001',
        totalSteps: expectedTotalSteps,
      });
    });
  });

  test('reports missing required step fields', async () => {
    const firstStep = createFixtureSteps()[0]!;
    const malformedStepText = createStepText(firstStep).replace(/\n## final evidence\n\n- Focused evidence is committed and pushed\./, '');

    await withPlanFixture(
      {
        overrides: {
          [`plan_vanilla_parity/steps/${firstStep.id}-${firstStep.slug}.md`]: malformedStepText,
        },
      },
      async (planDirectory) => {
        const result = await validatePlan(planDirectory);

        expect(result.errors).toContainEqual({
          file: `plan_vanilla_parity/steps/${firstStep.id}-${firstStep.slug}.md`,
          message:
            'Step fields must exactly match: id, lane, title, goal, prerequisites, parallel-safe-with, write lock, read-only paths, research sources, expected changes, test files, verification commands, completion criteria, final evidence.',
        });
      },
    );
  });

  test('rejects banned verification commands', async () => {
    const firstStep = createFixtureSteps()[0]!;

    await withPlanFixture(
      {
        overrides: {
          [`plan_vanilla_parity/steps/${firstStep.id}-${firstStep.slug}.md`]: createStepText(firstStep, {
            verificationCommands: ['bun run format', `bun test test/vanilla_parity/${firstStep.slug}.test.ts`, 'npm test', 'bun test', 'bun x tsc --noEmit --project tsconfig.json'],
          }),
        },
      },
      async (planDirectory) => {
        const result = await validatePlan(planDirectory);

        expect(result.errors).toContainEqual({
          file: `plan_vanilla_parity/steps/${firstStep.id}-${firstStep.slug}.md`,
          message: 'Verification command uses a banned tool: npm test.',
        });
      },
    );
  });

  test('rejects write locks inside read-only reference roots', async () => {
    const firstStep = createFixtureSteps()[0]!;

    await withPlanFixture(
      {
        overrides: {
          [`plan_vanilla_parity/steps/${firstStep.id}-${firstStep.slug}.md`]: createStepText(firstStep, {
            writeLock: ['doom/DOOM1.WAD', `test/vanilla_parity/${firstStep.slug}.test.ts`],
          }),
        },
      },
      async (planDirectory) => {
        const result = await validatePlan(planDirectory);

        expect(result.errors).toContainEqual({
          file: `plan_vanilla_parity/steps/${firstStep.id}-${firstStep.slug}.md`,
          message: 'Write lock is inside read-only reference root: doom/DOOM1.WAD.',
        });
      },
    );
  });

  test('rejects final gate evidence that relies on deferred or manifest-only proof', async () => {
    const finalGateStep = createFixtureSteps().at(-1)!;

    await withPlanFixture(
      {
        overrides: {
          [`plan_vanilla_parity/steps/${finalGateStep.id}-${finalGateStep.slug}.md`]: createStepText(finalGateStep, {
            finalEvidence: '- A pending manifest-only sampled-only declared intent report.',
          }),
        },
      },
      async (planDirectory) => {
        const result = await validatePlan(planDirectory);

        expect(result.errors).toContainEqual({
          file: 'plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md',
          message: 'Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.',
        });
      },
    );
  });

  test('rejects overlapping lane write scopes', async () => {
    await withPlanFixture(
      {
        overrides: {
          'plan_vanilla_parity/PARALLEL_WORK.md': `# Parallel Work

| lane | what can proceed immediately | blocked by | owns | must not touch |
| --- | --- | --- | --- | --- |
| core | immediate | none | src/core/ | doom/; iwad/; reference/ |
| timing | immediate | none | src/core/fixed.ts | doom/; iwad/; reference/ |
`,
        },
      },
      async (planDirectory) => {
        const result = await validatePlan(planDirectory);

        expect(result.errors).toContainEqual({
          file: 'plan_vanilla_parity/PARALLEL_WORK.md',
          message: 'Lane write scopes overlap: core owns src/core/ and timing owns src/core/fixed.ts.',
        });
      },
    );
  });

  test('returns CLI diagnostics for invalid fixtures', async () => {
    const firstStep = createFixtureSteps()[0]!;

    await withPlanFixture(
      {
        overrides: {
          [`plan_vanilla_parity/steps/${firstStep.id}-${firstStep.slug}.md`]: createStepText(firstStep, {
            verificationCommands: ['bun run format', `bun test test/vanilla_parity/${firstStep.slug}.test.ts`, 'node doom.ts', 'bun test', 'bun x tsc --noEmit --project tsconfig.json'],
          }),
        },
      },
      async (planDirectory) => {
        const standardOutputLines: string[] = [];
        const standardErrorLines: string[] = [];
        const exitCode = await runValidationCli(
          planDirectory,
          (line) => standardOutputLines.push(line),
          (line) => standardErrorLines.push(line),
        );

        expect(exitCode).toBe(1);
        expect(standardOutputLines).toEqual([]);
        expect(standardErrorLines).toContain(`plan_vanilla_parity/steps/${firstStep.id}-${firstStep.slug}.md: Verification command uses a banned tool: node doom.ts.`);
      },
    );
  });
});
