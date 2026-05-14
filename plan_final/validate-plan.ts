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

const PENDING_FIXTURE_MARKERS = Object.freeze(['pending-live-capture', 'pending-unimplemented-surface', 'pending-unimplemented-side-by-side-surface', 'pending-live-evidence', 'pending-replay', 'pending-oracle']);

const MANIFEST_ONLY_MARKERS = Object.freeze(['manifest-only', 'contract-only', 'inheritedsourcehashes']);

const LIVE_CAPTURE_MARKERS = Object.freeze(['live-capture', 'live-evidence', 'live-oracle', 'side-by-side-zero-diff']);

export type FinalProofViolationCategory = 'human-attestation-alone' | 'manifest-only' | 'pending-fixture';

export interface FinalProofViolation {
  readonly category: FinalProofViolationCategory;
  readonly detail: string;
}

export type StatusSchemaViolationCategory =
  | 'evidence-missing-focused-test-command'
  | 'evidence-missing-format-command'
  | 'evidence-missing-full-test-command'
  | 'evidence-missing-required'
  | 'evidence-missing-typecheck-command'
  | 'evidence-path-mismatch'
  | 'invalid-commit-sha-format'
  | 'lane-missing'
  | 'missing-commit-sha'
  | 'step-id-missing';

export interface StatusSchemaViolation {
  readonly category: StatusSchemaViolationCategory;
  readonly detail: string;
}

export interface CompletionStatusRecord {
  readonly commitSha?: unknown;
  readonly evidence?: unknown;
  readonly lane?: unknown;
  readonly status?: unknown;
  readonly stepId?: unknown;
}

export interface CompletionEvidenceRecord {
  readonly commands?: unknown;
}

const COMMIT_SHA_FORMAT = /^[0-9a-f]{40}$/;

export interface PlanValidationResult {
  readonly errors: readonly string[];
  readonly stepCount: number;
  readonly valid: boolean;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
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

function extractEvidenceCommandStrings(commands: unknown): readonly string[] {
  if (!Array.isArray(commands)) {
    return [];
  }

  const result: string[] = [];
  for (const entry of commands) {
    if (typeof entry === 'string') {
      result.push(entry);
      continue;
    }

    if (typeof entry === 'object' && entry !== null && 'command' in entry) {
      const command = (entry as { readonly command?: unknown }).command;
      if (typeof command === 'string') {
        result.push(command);
      }
    }
  }

  return result;
}

export function findStatusSchemaViolations(status: CompletionStatusRecord, evidence: CompletionEvidenceRecord | null = null): readonly StatusSchemaViolation[] {
  const violations: StatusSchemaViolation[] = [];

  if (status.status !== 'COMPLETED') {
    return violations;
  }

  if (typeof status.stepId !== 'string' || status.stepId.trim() === '') {
    violations.push({ category: 'step-id-missing', detail: 'Completed status must record a non-empty stepId.' });
  }

  if (typeof status.lane !== 'string' || status.lane.trim() === '') {
    violations.push({ category: 'lane-missing', detail: 'Completed status must record a non-empty lane.' });
  }

  if (typeof status.commitSha !== 'string' || status.commitSha.trim() === '') {
    violations.push({ category: 'missing-commit-sha', detail: 'Completed status must record the pushed commit SHA.' });
  } else if (!COMMIT_SHA_FORMAT.test(status.commitSha)) {
    violations.push({ category: 'invalid-commit-sha-format', detail: `commitSha "${status.commitSha}" is not a 40-character lowercase hex string.` });
  }

  if (typeof status.evidence !== 'string' || status.evidence.trim() === '') {
    violations.push({ category: 'evidence-missing-required', detail: 'Completed status must reference an evidence file path.' });
    return violations;
  }

  if (evidence === null) {
    violations.push({ category: 'evidence-missing-required', detail: `Completed status references evidence file ${status.evidence} but no evidence record was provided.` });
    return violations;
  }

  const commandStrings = extractEvidenceCommandStrings(evidence.commands);

  if (!commandStrings.some((command) => command.includes('bun run format'))) {
    violations.push({ category: 'evidence-missing-format-command', detail: 'Evidence commands must include `bun run format`.' });
  }

  const fullTestPattern = /^bun test\s*$/;
  if (!commandStrings.some((command) => fullTestPattern.test(command.trim()))) {
    violations.push({ category: 'evidence-missing-full-test-command', detail: 'Evidence commands must include the full `bun test` run.' });
  }

  const focusedTestPattern = /^bun test\s+\S/;
  if (!commandStrings.some((command) => focusedTestPattern.test(command.trim()))) {
    violations.push({ category: 'evidence-missing-focused-test-command', detail: 'Evidence commands must include a focused `bun test <path>` run.' });
  }

  if (!commandStrings.some((command) => command.includes('bun x tsc --noEmit --project tsconfig.json'))) {
    violations.push({ category: 'evidence-missing-typecheck-command', detail: 'Evidence commands must include `bun x tsc --noEmit --project tsconfig.json`.' });
  }

  return violations;
}

export function findEvidencePathMismatch(status: CompletionStatusRecord, expectedEvidencePath: string): StatusSchemaViolation | null {
  if (status.status !== 'COMPLETED') {
    return null;
  }

  if (typeof status.evidence === 'string' && status.evidence === expectedEvidencePath) {
    return null;
  }

  return { category: 'evidence-path-mismatch', detail: `Completed status evidence "${String(status.evidence)}" does not match expected path "${expectedEvidencePath}".` };
}

export function findFinalProofViolations(text: string): readonly FinalProofViolation[] {
  const violations: FinalProofViolation[] = [];
  const lowerText = text.toLowerCase();
  const hasLiveCapture = LIVE_CAPTURE_MARKERS.some((marker) => lowerText.includes(marker));

  for (const marker of PENDING_FIXTURE_MARKERS) {
    if (lowerText.includes(marker)) {
      violations.push({ category: 'pending-fixture', detail: `Found pending marker: ${marker}` });
      break;
    }
  }

  for (const marker of MANIFEST_ONLY_MARKERS) {
    if (lowerText.includes(marker) && !hasLiveCapture) {
      violations.push({ category: 'manifest-only', detail: `Found manifest-only marker: ${marker} without live capture` });
      break;
    }
  }

  if (/"human_attestation_required"\s*:\s*true/i.test(text)) {
    const oracleEvidenceMatch = /"oracle_evidence_required"\s*:\s*\[([^\]]*)\]/i.exec(text);
    const oracleEvidenceBody = oracleEvidenceMatch?.[1]?.trim() ?? '';
    if (oracleEvidenceBody === '') {
      violations.push({ category: 'human-attestation-alone', detail: 'Final gate relies on human attestation alone without oracle evidence entries' });
    }
  }

  return violations;
}

async function validateFinalGates(errors: string[]): Promise<void> {
  const finalGatesDirectory = 'plan_final/final-gates';

  if (!(await pathExists(finalGatesDirectory))) {
    return;
  }

  for (const directoryEntry of await readdir(finalGatesDirectory)) {
    if (!directoryEntry.endsWith('.json')) {
      continue;
    }

    const path = `${finalGatesDirectory}/${directoryEntry}`;
    const text = await readText(path);
    for (const violation of findFinalProofViolations(text)) {
      errors.push(`${path} rejects final proof: ${violation.category} - ${violation.detail}`);
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
  await validateFinalGates(errors);

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
