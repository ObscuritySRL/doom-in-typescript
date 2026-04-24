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
  readonly lineNumber: number;
  readonly prereq: string;
  readonly titleSlug: string;
}

const REQUIRED_SECTIONS = [
  '## Goal',
  '## Prerequisites',
  '## Read Only',
  '## Consult Only If Blocked',
  '## Expected Changes',
  '## Test Files',
  '## Verification',
  '## Completion Criteria',
  '## Required Log Updates',
  '## Later Steps That May Benefit',
] as const;

const READ_ONLY_ROOTS = ['doom/', 'iwad/', 'reference/'] as const;
const RUNTIME_TARGET = 'bun run doom.ts';

export async function validatePlan(planDirectory = import.meta.dir): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const checklistPath = `${planDirectory}/MASTER_CHECKLIST.md`;
  const checklistText = await Bun.file(checklistPath).text();
  const checklistSteps = parseChecklist(checklistText);
  const stepIds = new Set<string>();
  const stepFileSet = new Set<string>();
  const stepGlob = new Bun.Glob('steps/*.md');

  for await (const relativePath of stepGlob.scan({ cwd: planDirectory })) {
    stepFileSet.add(relativePath.replace(/\\/g, '/'));
  }

  for (const checklistStep of checklistSteps) {
    stepIds.add(checklistStep.id);

    const relativeFilePath = checklistStep.filePath.replace(/^plan_fps\//, '');
    if (!stepFileSet.has(relativeFilePath)) {
      errors.push({
        file: 'plan_fps/MASTER_CHECKLIST.md',
        message: `Checklist step ${checklistStep.id} points to missing file ${checklistStep.filePath}.`,
      });
      continue;
    }

    const fullStepPath = `${planDirectory}/${relativeFilePath}`;
    const stepText = await Bun.file(fullStepPath).text();
    validateStepText(checklistStep, stepText, stepIds, errors);
  }

  for (const stepFile of stepFileSet) {
    const fullPath = `plan_fps/${stepFile}`;
    if (!checklistSteps.some((checklistStep) => checklistStep.filePath === fullPath)) {
      errors.push({
        file: fullPath,
        message: 'Step file is not referenced by MASTER_CHECKLIST.md.',
      });
    }
  }

  if (!checklistText.includes(RUNTIME_TARGET)) {
    errors.push({
      file: 'plan_fps/MASTER_CHECKLIST.md',
      message: `MASTER_CHECKLIST.md must reference ${RUNTIME_TARGET}.`,
    });
  }

  const finalGatePath = `${planDirectory}/steps/15-010-gate-final-side-by-side.md`;
  const finalGateText = await Bun.file(finalGatePath).text();
  if (!finalGateText.includes(RUNTIME_TARGET)) {
    errors.push({
      file: 'plan_fps/steps/15-010-gate-final-side-by-side.md',
      message: `Final acceptance gate must reference ${RUNTIME_TARGET}.`,
    });
  }

  return {
    errors,
    firstStep: checklistSteps[0]?.id ?? null,
    totalSteps: checklistSteps.length,
  };
}

export function parseChecklist(checklistText: string): readonly ChecklistStep[] {
  const steps: ChecklistStep[] = [];
  const lines = checklistText.split(/\r?\n/);
  const pattern = new RegExp(
    '^- \\[ \\] `(?<id>\\d{2}-\\d{3})` `(?<titleSlug>[^`]+)` \\| prereqs: `(?<prereq>[^`]+)` \\| file: `(?<filePath>plan_fps/steps/[^`]+\\.md)`$',
  );

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    const match = pattern.exec(line);
    if (match?.groups === undefined) {
      continue;
    }

    steps.push({
      filePath: match.groups.filePath!,
      id: match.groups.id!,
      lineNumber: lineIndex + 1,
      prereq: match.groups.prereq!,
      titleSlug: match.groups.titleSlug!,
    });
  }

  return steps;
}

function validateStepText(checklistStep: ChecklistStep, stepText: string, priorStepIds: ReadonlySet<string>, errors: ValidationError[]): void {
  const file = checklistStep.filePath;
  const expectedTitle = `# [ ] STEP ${checklistStep.id}: ${titleFromSlug(checklistStep.titleSlug)}`;

  if (!stepText.startsWith(expectedTitle)) {
    errors.push({ file, message: `Step title must start with "${expectedTitle}".` });
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!stepText.includes(`\n${section}\n`)) {
      errors.push({ file, message: `Missing required section ${section}.` });
    }
  }

  const prereqs = extractBullets(stepText, '## Prerequisites');
  for (const prereq of prereqs) {
    if (prereq === 'none') {
      continue;
    }

    if (!priorStepIds.has(prereq)) {
      errors.push({ file, message: `Prerequisite ${prereq} does not point to an existing prior step.` });
    }
  }

  const expectedChanges = extractBullets(stepText, '## Expected Changes');
  for (const changedPath of expectedChanges) {
    validateWritablePath(file, changedPath, errors);
  }

  const testFiles = extractBullets(stepText, '## Test Files');
  if (testFiles.length === 0) {
    errors.push({ file, message: 'Step must list at least one focused test path.' });
  }

  const verificationCommands = extractBullets(stepText, '## Verification').map((command) => command.replace(/^`|`$/g, ''));
  if (testFiles[0] !== undefined && !verificationCommands.includes(`bun test ${testFiles[0]}`)) {
    errors.push({ file, message: 'Verification must include the focused bun test command.' });
  }
  if (!verificationCommands.includes('bun test')) {
    errors.push({ file, message: 'Verification must include full bun test.' });
  }
  if (!verificationCommands.includes('bun x tsc --noEmit --project tsconfig.json')) {
    errors.push({ file, message: 'Verification must include the typecheck command.' });
  }

  for (const requiredLog of ['FACT_LOG.md', 'DECISION_LOG.md', 'REFERENCE_ORACLES.md', 'HANDOFF_LOG.md']) {
    if (!stepText.includes(`- \`${requiredLog}\`:`)) {
      errors.push({ file, message: `Missing required log update instruction for ${requiredLog}.` });
    }
  }

  if (/\bnode\s+doom\.ts\b/i.test(stepText)) {
    errors.push({ file, message: 'Step uses node as a doom.ts runtime target.' });
  }

  if (/compiled\s+`?\.exe`?\s+(as\s+)?(the\s+)?final/i.test(stepText)) {
    errors.push({ file, message: 'Step makes a compiled .exe final acceptance target.' });
  }
}

function validateWritablePath(file: string, changedPath: string, errors: ValidationError[]): void {
  const normalizedPath = changedPath.replace(/\\/g, '/').replace(/^\.\//, '');

  if (normalizedPath.startsWith('../')) {
    errors.push({ file, message: `Expected changed path escapes the workspace: ${changedPath}.` });
  }

  for (const readOnlyRoot of READ_ONLY_ROOTS) {
    if (normalizedPath.toLowerCase().startsWith(readOnlyRoot)) {
      errors.push({ file, message: `Expected changed path is inside read-only reference root: ${changedPath}.` });
    }
  }
}

function extractBullets(stepText: string, section: string): readonly string[] {
  const sectionStart = stepText.indexOf(`\n${section}\n`);
  if (sectionStart === -1) {
    return [];
  }

  const afterSection = stepText.slice(sectionStart + section.length + 2);
  const nextSection = afterSection.search(/\n## /);
  const sectionBody = nextSection === -1 ? afterSection : afterSection.slice(0, nextSection);

  return sectionBody
    .split(/\r?\n/)
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

function titleFromSlug(titleSlug: string): string {
  return titleSlug
    .split('-')
    .map((word) => {
      if (word.toUpperCase() === 'E1M1') {
        return 'E1M1';
      }

      if (word === 'iwad') {
        return 'IWAD';
      }

      if (word === 'win32') {
        return 'Win32';
      }

      if (word === 'sfx') {
        return 'SFX';
      }

      if (word === 'opl') {
        return 'OPL';
      }

      if (word === 'mus') {
        return 'MUS';
      }

      return `${word[0]!.toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
}

if (import.meta.main) {
  const result = await validatePlan();

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`${error.file}: ${error.message}`);
    }
    process.exit(1);
  }

  console.log(`Validated ${result.totalSteps} playable parity steps. First step: ${result.firstStep ?? 'NONE'}.`);
}
