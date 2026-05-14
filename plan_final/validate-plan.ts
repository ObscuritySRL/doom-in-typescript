import { readdir, stat } from 'node:fs/promises';

import { FINAL_PLAN_LANES, FINAL_PLAN_STEP_COUNT, FINAL_PLAN_STEPS, type FinalPlanStep } from './planData.ts';

const REQUIRED_ROOT_FILES = Object.freeze([
  'plan_final/README.md',
  'plan_final/PROMPT.md',
  'plan_final/PRE_PROMPT.md',
  'plan_final/STEP_TEMPLATE.md',
  'plan_final/PARALLEL_WORK.md',
  'plan_final/DEPENDENCY_GRAPH.md',
  'plan_final/MASTER_CHECKLIST.md',
  'plan_final/select-step.ts',
  'plan_final/validate-plan.ts',
  'plan_final/validate-plan.test.ts',
]);

const REQUIRED_DIRECTORIES = Object.freeze(['plan_final/steps', 'plan_final/status', 'plan_final/progress', 'plan_final/evidence', 'plan_final/lane_locks']);

const STEP_REQUIRED_HEADINGS = Object.freeze([
  '## id',
  '## lane',
  '## title',
  '## goal',
  '## prerequisites',
  '## parallel-safe-with',
  '## write lock',
  '## read-only paths',
  '## research sources',
  '## expected changes',
  '## test files',
  '## verification commands',
  '## progress log',
  '## completion criteria',
  '## final evidence',
]);

const REQUIRED_VERIFICATION_COMMANDS = Object.freeze(['`bun run format`', '`bun test ', '`bun test`', '`bun x tsc --noEmit --project tsconfig.json`']);

const FINAL_GATE_FORBIDDEN_TOKENS = Object.freeze(['pending', 'contract-only', 'manifest-only', 'unimplemented', 'human attestation alone']);

export interface PlanValidationResult {
  readonly errors: readonly string[];
  readonly stepCount: number;
  readonly valid: boolean;
}

function slugify(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '');
}

export function stepFilePath(step: FinalPlanStep): string {
  return `plan_final/steps/${step.id}-${slugify(step.title)}.md`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function readText(path: string): Promise<string> {
  return Bun.file(path).text();
}

function validateChecklist(checklistText: string, errors: string[]): void {
  if (!checklistText.includes(`- Total steps: ${FINAL_PLAN_STEP_COUNT}`)) {
    errors.push('MASTER_CHECKLIST.md does not report the generated step count.');
  }

  for (const step of FINAL_PLAN_STEPS) {
    const prerequisites = step.prerequisites.length === 0 ? 'none' : step.prerequisites.join(', ');
    const expectedLine = `- [ ] \`${step.id}\` \`${step.title}\` | lane: \`${step.lane}\` | prereqs: \`${prerequisites}\` | file: \`${stepFilePath(step)}\``;
    if (!checklistText.includes(expectedLine)) {
      errors.push(`MASTER_CHECKLIST.md is missing ${step.id} ${step.title}.`);
    }
  }
}

function validateStepText(step: FinalPlanStep, text: string, errors: string[]): void {
  for (const heading of STEP_REQUIRED_HEADINGS) {
    if (!text.includes(heading)) {
      errors.push(`${stepFilePath(step)} is missing ${heading}.`);
    }
  }

  if (!text.includes(`## id\n\n${step.id}`)) {
    errors.push(`${stepFilePath(step)} has an id mismatch.`);
  }

  if (!text.includes(`## lane\n\n${step.lane}`)) {
    errors.push(`${stepFilePath(step)} has a lane mismatch.`);
  }

  if (!text.includes(`## title\n\n${step.title}`)) {
    errors.push(`${stepFilePath(step)} has a title mismatch.`);
  }

  for (const command of REQUIRED_VERIFICATION_COMMANDS) {
    if (!text.includes(command)) {
      errors.push(`${stepFilePath(step)} is missing verification command ${command}.`);
    }
  }

  if (!text.includes('Any failure is fixed in this same step') || !text.includes('not marked complete')) {
    errors.push(`${stepFilePath(step)} does not enforce the no-failing-tests completion rule.`);
  }

  if (!text.includes('committed with a Conventional Commit') || !text.includes('pushed directly with local git commands')) {
    errors.push(`${stepFilePath(step)} does not require commit and push.`);
  }
}

function validateLaneCoverage(parallelText: string, errors: string[]): void {
  for (const lane of FINAL_PLAN_LANES) {
    if (!parallelText.includes(`\`${lane.lane}\``)) {
      errors.push(`PARALLEL_WORK.md is missing lane ${lane.lane}.`);
    }
  }
}

async function validateAcceptanceTests(errors: string[]): Promise<void> {
  const acceptanceDirectory = 'test/plan_final/acceptance';

  if (!(await pathExists(acceptanceDirectory))) {
    return;
  }

  for (const directoryEntry of await readdir(acceptanceDirectory)) {
    if (!directoryEntry.endsWith('.test.ts')) {
      continue;
    }

    const path = `${acceptanceDirectory}/${directoryEntry}`;
    const text = await readText(path);

    if (!text.includes('bun run doom.ts') && !text.includes("['run', 'doom.ts")) {
      errors.push(`${path} does not execute or assert the final bun run doom.ts command.`);
    }

    const lowerText = text.toLowerCase();
    for (const token of FINAL_GATE_FORBIDDEN_TOKENS) {
      if (lowerText.includes(`accept ${token}`) || lowerText.includes(`accepted ${token}`)) {
        errors.push(`${path} appears to accept forbidden final-gate token ${token}.`);
      }
    }
  }
}

export async function validatePlan(): Promise<PlanValidationResult> {
  const errors: string[] = [];

  for (const path of REQUIRED_ROOT_FILES) {
    if (!(await pathExists(path))) {
      errors.push(`Missing required root file: ${path}`);
    }
  }

  for (const path of REQUIRED_DIRECTORIES) {
    if (!(await pathExists(path))) {
      errors.push(`Missing required directory: ${path}`);
    }
  }

  if (await pathExists('plan_final/MASTER_CHECKLIST.md')) {
    validateChecklist(await readText('plan_final/MASTER_CHECKLIST.md'), errors);
  }

  if (await pathExists('plan_final/PARALLEL_WORK.md')) {
    validateLaneCoverage(await readText('plan_final/PARALLEL_WORK.md'), errors);
  }

  const seenStepIds = new Set<string>();
  for (const step of FINAL_PLAN_STEPS) {
    if (seenStepIds.has(step.id)) {
      errors.push(`Duplicate step id: ${step.id}`);
    }
    seenStepIds.add(step.id);

    const path = stepFilePath(step);
    if (!(await pathExists(path))) {
      errors.push(`Missing step file: ${path}`);
      continue;
    }

    validateStepText(step, await readText(path), errors);
  }

  for (const step of FINAL_PLAN_STEPS) {
    for (const prerequisite of step.prerequisites) {
      if (!seenStepIds.has(prerequisite)) {
        errors.push(`${step.id} references missing prerequisite ${prerequisite}.`);
      }
    }
  }

  await validateAcceptanceTests(errors);

  return Object.freeze({
    errors,
    stepCount: FINAL_PLAN_STEP_COUNT,
    valid: errors.length === 0,
  });
}

if (import.meta.main) {
  const result = await validatePlan();

  if (!result.valid) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }

  console.log(`plan_final valid: ${result.stepCount} steps`);
}
