export interface ValidationError {
  readonly file: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly errors: readonly ValidationError[];
  readonly firstStep: string | null;
  readonly totalSteps: number;
}

interface ChecklistStep {
  readonly filePath: string;
  readonly id: string;
  readonly lane: string;
  readonly lineNumber: number;
  readonly prerequisites: readonly string[];
  readonly slug: string;
}

interface LaneWriteScope {
  readonly lane: string;
  readonly roots: readonly string[];
}

type OutputWriter = (line: string) => void;

const BANNED_COMMANDS = new Set(['jest', 'mocha', 'node', 'npm', 'npx', 'pnpm', 'ts-node', 'tsx', 'vitest', 'yarn']);
const CHECKLIST_LINE_PATTERN = /^- \[[ x]\] `(?<id>\d{2}-\d{3})` `(?<slug>[^`]+)` \| lane: `(?<lane>[^`]+)` \| prereqs: `(?<prerequisites>[^`]+)` \| file: `(?<filePath>plan_vanilla_parity\/steps\/[^`]+\.md)`$/;
const DEFAULT_PLAN_DIRECTORY = import.meta.dir;
const EXPECTED_FIRST_STEP = '00-001';
const EXPECTED_TOTAL_STEPS = 398;
const FINAL_GATE_STEP_ID = '13-004';
const PLAN_VALIDATION_COMMAND = 'bun run plan_vanilla_parity/validate-plan.ts';
const READ_ONLY_ROOTS = ['doom/', 'iwad/', 'reference/'] as const;
const REQUIRED_FILES = [
  'README.md',
  'PROMPT.md',
  'PRE_PROMPT.md',
  'MASTER_CHECKLIST.md',
  'STEP_TEMPLATE.md',
  'SOURCE_CATALOG.md',
  'REFERENCE_ORACLES.md',
  'DEPENDENCY_GRAPH.md',
  'PARALLEL_WORK.md',
  'RISK_REGISTER.md',
  'validate-plan.ts',
  'validate-plan.test.ts',
] as const;
const REQUIRED_STEP_FIELDS = [
  'id',
  'lane',
  'title',
  'goal',
  'prerequisites',
  'parallel-safe-with',
  'write lock',
  'read-only paths',
  'research sources',
  'expected changes',
  'test files',
  'verification commands',
  'completion criteria',
  'final evidence',
] as const;
const REQUIRED_FINAL_GATE_PHRASES = [
  'bun run doom.ts',
  'same deterministic input stream',
  'deterministic state',
  'framebuffer',
  'audio',
  'music events',
  'menu transitions',
  'level transitions',
  'save/load bytes',
  'demo playback',
  'full-playthrough completion',
  'zero default differences',
] as const;
const REJECTED_FINAL_EVIDENCE_PATTERNS = [/\bpending\b/i, /\bmanifest-only\b/i, /\bsampled-only\b/i, /\bintent-only\b/i, /\bdeclared intent\b/i] as const;

export { PLAN_VALIDATION_COMMAND };

export async function validatePlan(planDirectory = DEFAULT_PLAN_DIRECTORY): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  await validateRequiredFiles(planDirectory, errors);

  const checklistPath = `${planDirectory}/MASTER_CHECKLIST.md`;
  const checklistText = await readTextIfExists(checklistPath);

  if (checklistText === null) {
    return { errors, firstStep: null, totalSteps: 0 };
  }

  const checklistSteps = parseChecklist(checklistText);
  const stepFileSet = await collectStepFiles(planDirectory);
  const knownStepIds = new Set<string>();
  const checklistFileSet = new Set<string>();
  let finalGateText: string | null = null;

  for (const checklistStep of checklistSteps) {
    knownStepIds.add(checklistStep.id);
    checklistFileSet.add(checklistStep.filePath);

    const relativeStepPath = checklistStep.filePath.replace(/^plan_vanilla_parity\//, '');
    if (!stepFileSet.has(relativeStepPath)) {
      errors.push({ file: 'plan_vanilla_parity/MASTER_CHECKLIST.md', message: `Checklist step ${checklistStep.id} points to missing file ${checklistStep.filePath}.` });
      continue;
    }

    const stepText = await Bun.file(`${planDirectory}/${relativeStepPath}`).text();
    validateStepText(checklistStep, stepText, knownStepIds, errors);

    if (checklistStep.id === FINAL_GATE_STEP_ID) {
      finalGateText = stepText;
    }
  }

  for (const stepFile of stepFileSet) {
    const checklistPathForStep = `plan_vanilla_parity/${stepFile}`;
    if (!checklistFileSet.has(checklistPathForStep)) {
      errors.push({ file: checklistPathForStep, message: 'Step file is not referenced by MASTER_CHECKLIST.md.' });
    }
  }

  validateChecklistSummary(checklistText, checklistSteps, errors);
  validateFinalGate(finalGateText, errors);
  await validateParallelWork(planDirectory, errors);

  return {
    errors,
    firstStep: checklistSteps[0]?.id ?? null,
    totalSteps: checklistSteps.length,
  };
}

export async function runValidationCli(planDirectory = DEFAULT_PLAN_DIRECTORY, stdout: OutputWriter = (line) => console.log(line), stderr: OutputWriter = (line) => console.error(line)): Promise<number> {
  const result = await validatePlan(planDirectory);

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      stderr(`${error.file}: ${error.message}`);
    }

    return 1;
  }

  stdout(`Validated ${result.totalSteps} vanilla parity steps. First step: ${result.firstStep ?? 'NONE'}.`);
  return 0;
}

export function parseChecklist(checklistText: string): readonly ChecklistStep[] {
  const steps: ChecklistStep[] = [];
  const lines = checklistText.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    const match = CHECKLIST_LINE_PATTERN.exec(line);

    if (match?.groups === undefined) {
      continue;
    }

    steps.push({
      filePath: match.groups.filePath!,
      id: match.groups.id!,
      lane: match.groups.lane!,
      lineNumber: lineIndex + 1,
      prerequisites: parsePrerequisites(match.groups.prerequisites!),
      slug: match.groups.slug!,
    });
  }

  return steps;
}

function addMissingFileError(relativePath: string, errors: ValidationError[]): void {
  errors.push({
    file: `plan_vanilla_parity/${relativePath}`,
    message: 'Required plan file is missing.',
  });
}

async function collectStepFiles(planDirectory: string): Promise<ReadonlySet<string>> {
  const stepFiles = new Set<string>();
  const glob = new Bun.Glob('steps/*.md');

  for await (const relativePath of glob.scan({ cwd: planDirectory })) {
    stepFiles.add(relativePath.replace(/\\/g, '/'));
  }

  return stepFiles;
}

function extractBullets(stepText: string, field: string): readonly string[] {
  const section = extractSection(stepText, field);

  if (section === null) {
    return [];
  }

  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

function extractSection(stepText: string, field: string): string | null {
  const heading = `## ${field}`;
  const sectionStart = stepText.indexOf(`\n${heading}\n`);

  if (sectionStart === -1) {
    return null;
  }

  const bodyStart = sectionStart + heading.length + 3;
  const nextHeading = stepText.slice(bodyStart).search(/\n## /);

  return nextHeading === -1 ? stepText.slice(bodyStart).trim() : stepText.slice(bodyStart, bodyStart + nextHeading).trim();
}

function normalizePlanPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^`|`$/g, '');
}

function parseLaneWriteScopes(parallelWorkText: string): readonly LaneWriteScope[] {
  const scopes: LaneWriteScope[] = [];
  const lines = parallelWorkText.split(/\r?\n/);

  for (const line of lines) {
    if (!line.startsWith('| ') || line.includes('| ---') || line.includes('| lane |')) {
      continue;
    }

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 4) {
      continue;
    }

    const lane = cells[0]!;
    const roots = cells[3]!
      .split(';')
      .map((root) => normalizePlanPath(root.trim()))
      .filter((root) => root.length > 0);

    scopes.push({ lane, roots });
  }

  return scopes;
}

function parsePrerequisites(rawPrerequisites: string): readonly string[] {
  return rawPrerequisites
    .split(',')
    .map((prerequisite) => prerequisite.trim())
    .filter((prerequisite) => prerequisite.length > 0);
}

async function readTextIfExists(path: string): Promise<string | null> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return null;
  }

  return file.text();
}

async function validateParallelWork(planDirectory: string, errors: ValidationError[]): Promise<void> {
  const parallelWorkText = await readTextIfExists(`${planDirectory}/PARALLEL_WORK.md`);

  if (parallelWorkText === null) {
    return;
  }

  const scopes = parseLaneWriteScopes(parallelWorkText);

  for (const scope of scopes) {
    if (scope.roots.length === 0) {
      errors.push({ file: 'plan_vanilla_parity/PARALLEL_WORK.md', message: `Lane ${scope.lane} must list at least one owned write root.` });
    }

    for (const root of scope.roots) {
      validateWritablePath('plan_vanilla_parity/PARALLEL_WORK.md', root, errors);
    }
  }

  for (let leftIndex = 0; leftIndex < scopes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < scopes.length; rightIndex += 1) {
      const leftScope = scopes[leftIndex]!;
      const rightScope = scopes[rightIndex]!;

      for (const leftRoot of leftScope.roots) {
        for (const rightRoot of rightScope.roots) {
          if (pathsConflict(leftRoot, rightRoot)) {
            errors.push({
              file: 'plan_vanilla_parity/PARALLEL_WORK.md',
              message: `Lane write scopes overlap: ${leftScope.lane} owns ${leftRoot} and ${rightScope.lane} owns ${rightRoot}.`,
            });
          }
        }
      }
    }
  }
}

async function validateRequiredFiles(planDirectory: string, errors: ValidationError[]): Promise<void> {
  await Promise.all(
    REQUIRED_FILES.map(async (relativePath) => {
      if (!(await Bun.file(`${planDirectory}/${relativePath}`).exists())) {
        addMissingFileError(relativePath, errors);
      }
    }),
  );
}

function pathsConflict(leftPath: string, rightPath: string): boolean {
  if (leftPath === rightPath) {
    return true;
  }

  const leftPrefix = leftPath.endsWith('/') ? leftPath : `${leftPath}/`;
  const rightPrefix = rightPath.endsWith('/') ? rightPath : `${rightPath}/`;

  return (leftPath.endsWith('/') && rightPath.startsWith(leftPrefix)) || (rightPath.endsWith('/') && leftPath.startsWith(rightPrefix));
}

function validateChecklistSummary(checklistText: string, checklistSteps: readonly ChecklistStep[], errors: ValidationError[]): void {
  if (!checklistText.includes(`- Total steps: ${EXPECTED_TOTAL_STEPS}`)) {
    errors.push({ file: 'plan_vanilla_parity/MASTER_CHECKLIST.md', message: `Checklist must declare total steps ${EXPECTED_TOTAL_STEPS}.` });
  }

  if (!checklistText.includes('- First eligible step: `00-001 establish-vanilla-parity-control-center`')) {
    errors.push({ file: 'plan_vanilla_parity/MASTER_CHECKLIST.md', message: 'Checklist must declare the first eligible vanilla parity step.' });
  }

  if (!checklistText.includes('Runtime target: `bun run doom.ts`')) {
    errors.push({ file: 'plan_vanilla_parity/MASTER_CHECKLIST.md', message: 'Checklist must declare the bun run doom.ts runtime target.' });
  }

  if (checklistSteps.length !== EXPECTED_TOTAL_STEPS) {
    errors.push({ file: 'plan_vanilla_parity/MASTER_CHECKLIST.md', message: `Checklist must contain ${EXPECTED_TOTAL_STEPS} steps, got ${checklistSteps.length}.` });
  }

  if (checklistSteps[0]?.id !== EXPECTED_FIRST_STEP) {
    errors.push({ file: 'plan_vanilla_parity/MASTER_CHECKLIST.md', message: `First parsed step must be ${EXPECTED_FIRST_STEP}.` });
  }
}

function validateFinalGate(finalGateText: string | null, errors: ValidationError[]): void {
  if (finalGateText === null) {
    errors.push({ file: 'plan_vanilla_parity/MASTER_CHECKLIST.md', message: `Missing final gate step ${FINAL_GATE_STEP_ID}.` });
    return;
  }

  const finalEvidence = extractSection(finalGateText, 'final evidence') ?? '';
  const normalizedFinalEvidence = finalEvidence.toLowerCase();

  for (const requiredPhrase of REQUIRED_FINAL_GATE_PHRASES) {
    if (!normalizedFinalEvidence.includes(requiredPhrase.toLowerCase())) {
      errors.push({ file: `plan_vanilla_parity/steps/${FINAL_GATE_STEP_ID}-gate-full-final-side-by-side-proof.md`, message: `Final gate evidence must include ${requiredPhrase}.` });
    }
  }

  for (const rejectedPattern of REJECTED_FINAL_EVIDENCE_PATTERNS) {
    if (rejectedPattern.test(finalEvidence)) {
      errors.push({ file: `plan_vanilla_parity/steps/${FINAL_GATE_STEP_ID}-gate-full-final-side-by-side-proof.md`, message: 'Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.' });
    }
  }
}

function validateStepText(checklistStep: ChecklistStep, stepText: string, knownStepIds: ReadonlySet<string>, errors: ValidationError[]): void {
  const file = checklistStep.filePath;
  const expectedTitle = `# [ ] STEP ${checklistStep.id}: ${extractSection(stepText, 'title') ?? ''}`;

  if (!stepText.startsWith(expectedTitle)) {
    errors.push({ file, message: 'Step heading must match the id and title fields.' });
  }

  const headings = [...stepText.matchAll(/^## (.+)$/gm)].map((match) => match[1]!);

  if (headings.join('\n') !== REQUIRED_STEP_FIELDS.join('\n')) {
    errors.push({ file, message: `Step fields must exactly match: ${REQUIRED_STEP_FIELDS.join(', ')}.` });
  }

  for (const field of REQUIRED_STEP_FIELDS) {
    const section = extractSection(stepText, field);

    if (section === null || section.length === 0) {
      errors.push({ file, message: `Missing or empty required field: ${field}.` });
    }
  }

  const id = extractSection(stepText, 'id');
  if (id !== checklistStep.id) {
    errors.push({ file, message: `id field must be ${checklistStep.id}.` });
  }

  const lane = extractSection(stepText, 'lane');
  if (lane !== checklistStep.lane) {
    errors.push({ file, message: `lane field must be ${checklistStep.lane}.` });
  }

  const prerequisites = extractBullets(stepText, 'prerequisites');
  if (prerequisites.join(',') !== checklistStep.prerequisites.join(',')) {
    errors.push({ file, message: 'Step prerequisites must match MASTER_CHECKLIST.md.' });
  }

  for (const prerequisite of prerequisites) {
    if (prerequisite === 'none') {
      continue;
    }

    if (!knownStepIds.has(prerequisite)) {
      errors.push({ file, message: `Prerequisite ${prerequisite} does not point to an existing prior step.` });
    }
  }

  for (const writeLock of extractBullets(stepText, 'write lock')) {
    validateWritablePath(file, writeLock, errors);
  }

  const testFiles = extractBullets(stepText, 'test files');
  if (testFiles.length === 0) {
    errors.push({ file, message: 'Step must list at least one focused test file.' });
  }

  const verificationCommands = extractBullets(stepText, 'verification commands').map((command) => command.replace(/^`|`$/g, ''));
  const focusedTest = testFiles[0];

  if (!verificationCommands.includes('bun run format')) {
    errors.push({ file, message: 'Verification must include bun run format.' });
  }

  if (focusedTest !== undefined && !verificationCommands.includes(`bun test ${focusedTest}`)) {
    errors.push({ file, message: 'Verification must include the focused bun test command.' });
  }

  if (!verificationCommands.includes('bun test')) {
    errors.push({ file, message: 'Verification must include full bun test.' });
  }

  if (!verificationCommands.includes('bun x tsc --noEmit --project tsconfig.json')) {
    errors.push({ file, message: 'Verification must include the Bun typecheck command.' });
  }

  for (const command of verificationCommands) {
    if (usesBannedCommand(command)) {
      errors.push({ file, message: `Verification command uses a banned tool: ${command}.` });
    }
  }
}

function usesBannedCommand(command: string): boolean {
  const tokens = command.trim().split(/\s+/);
  const executable = tokens[0]?.toLowerCase() ?? '';

  if (BANNED_COMMANDS.has(executable)) {
    return true;
  }

  if (executable === 'bun' && tokens[1]?.toLowerCase() === 'x') {
    return BANNED_COMMANDS.has(tokens[2]?.toLowerCase() ?? '');
  }

  return false;
}

function validateWritablePath(file: string, path: string, errors: ValidationError[]): void {
  const normalizedPath = normalizePlanPath(path).toLowerCase();

  if (normalizedPath.length === 0) {
    errors.push({ file, message: 'Write lock path must not be empty.' });
    return;
  }

  if (normalizedPath.startsWith('../')) {
    errors.push({ file, message: `Write lock escapes the workspace: ${path}.` });
  }

  for (const readOnlyRoot of READ_ONLY_ROOTS) {
    if (normalizedPath.startsWith(readOnlyRoot)) {
      errors.push({ file, message: `Write lock is inside read-only reference root: ${path}.` });
    }
  }
}

if (import.meta.main) {
  process.exit(await runValidationCli());
}
