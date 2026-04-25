export interface ValidationError {
  readonly file: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly errors: readonly ValidationError[];
  readonly firstStep: string | null;
  readonly totalSteps: number;
}

type OutputWriter = (line: string) => void;

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
const STEP_PROGRESS_LOG_PATTERN = 'plan_fps/loop_logs/step_<step-id>_progress.txt';
const DEFAULT_PLAN_DIRECTORY = import.meta.dir;
const FINAL_GATE_RELATIVE_PATH = 'steps/15-010-gate-final-side-by-side.md';
const FINAL_GATE_FILE_PATH = `plan_fps/${FINAL_GATE_RELATIVE_PATH}`;
const CHECKLIST_LINE_PATTERN = /^- \[[ x]\] `(?<id>\d{2}-\d{3})` `(?<titleSlug>[^`]+)` \| prereqs: `(?<prereq>[^`]+)` \| file: `(?<filePath>plan_fps\/steps\/[^`]+\.md)`$/;

export const PLAN_VALIDATION_COMMAND = 'bun run plan_fps/validate-plan.ts';

export async function validatePlan(planDirectory = DEFAULT_PLAN_DIRECTORY): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const checklistPath = `${planDirectory}/MASTER_CHECKLIST.md`;
  const stepGlob = new Bun.Glob('steps/*.md');

  const stepFileSetPromise = (async (): Promise<Set<string>> => {
    const stepFileSet = new Set<string>();
    for await (const relativePath of stepGlob.scan({ cwd: planDirectory })) {
      stepFileSet.add(relativePath.replace(/\\/g, '/'));
    }
    return stepFileSet;
  })();

  const [checklistText, stepFileSet] = await Promise.all([Bun.file(checklistPath).text(), stepFileSetPromise]);
  const checklistSteps = parseChecklist(checklistText);

  const stepReadResults = await Promise.all(
    checklistSteps.map(async (checklistStep) => {
      const relativeFilePath = checklistStep.filePath.replace(/^plan_fps\//, '');
      if (!stepFileSet.has(relativeFilePath)) {
        return { checklistStep, fileExists: false as const, stepText: null };
      }
      const fullStepPath = `${planDirectory}/${relativeFilePath}`;
      return { checklistStep, fileExists: true as const, stepText: await Bun.file(fullStepPath).text() };
    }),
  );

  const stepIds = new Set<string>();
  let finalGateTextFromReads: string | null = null;
  for (const { checklistStep, fileExists, stepText } of stepReadResults) {
    stepIds.add(checklistStep.id);

    if (!fileExists) {
      errors.push({
        file: 'plan_fps/MASTER_CHECKLIST.md',
        message: `Checklist step ${checklistStep.id} points to missing file ${checklistStep.filePath}.`,
      });
      continue;
    }

    if (checklistStep.filePath === FINAL_GATE_FILE_PATH) {
      finalGateTextFromReads = stepText;
    }

    validateStepText(checklistStep, stepText, stepIds, errors);
  }

  const checklistFilePathSet = new Set(checklistSteps.map((step) => step.filePath));
  for (const stepFile of stepFileSet) {
    if (!checklistFilePathSet.has(`plan_fps/${stepFile}`)) {
      errors.push({
        file: `plan_fps/${stepFile}`,
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

  const finalGateText = finalGateTextFromReads ?? (await Bun.file(`${planDirectory}/${FINAL_GATE_RELATIVE_PATH}`).text());
  if (!finalGateText.includes(RUNTIME_TARGET)) {
    errors.push({
      file: FINAL_GATE_FILE_PATH,
      message: `Final acceptance gate must reference ${RUNTIME_TARGET}.`,
    });
  }

  await validateProgressLogInstructions(planDirectory, errors);

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

  stdout(`Validated ${result.totalSteps} playable parity steps. First step: ${result.firstStep ?? 'NONE'}.`);
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
      lineNumber: lineIndex + 1,
      prereq: match.groups.prereq!,
      titleSlug: match.groups.titleSlug!,
    });
  }

  return steps;
}

async function validateProgressLogInstructions(planDirectory: string, errors: ValidationError[]): Promise<void> {
  const [promptText, readmeText, stepTemplateText, gitignoreText] = await Promise.all([
    Bun.file(`${planDirectory}/PROMPT.md`).text(),
    Bun.file(`${planDirectory}/README.md`).text(),
    Bun.file(`${planDirectory}/STEP_TEMPLATE.md`).text(),
    Bun.file(`${planDirectory}/../.gitignore`).text(),
  ]);

  const requiredPromptPhrases = [
    STEP_PROGRESS_LOG_PATTERN,
    'completed work',
    'remaining planned work',
    'next exact action',
    'Do not stage, commit, or push the active step progress log',
    "Delete only that step's progress log after the step is marked complete, all required verification passes, and the verified commit has been pushed.",
    'leave the progress log in place',
    'RLP_PROGRESS_LOG: KEPT|DELETED|NONE',
  ] as const;

  for (const requiredPhrase of requiredPromptPhrases) {
    if (!promptText.includes(requiredPhrase)) {
      errors.push({ file: 'plan_fps/PROMPT.md', message: `Missing active step progress log instruction: ${requiredPhrase}` });
    }
  }

  const requiredReadmePhrases = [
    STEP_PROGRESS_LOG_PATTERN,
    'completed work',
    'remaining planned work',
    "Delete only that step's `plan_fps/loop_logs/step_<step-id>_progress.txt` after the step is marked complete, all required verification passes, and the verified commit has been pushed.",
    'Do not delete it on blocked, failed, interrupted, or limit-reached work.',
  ] as const;

  for (const requiredPhrase of requiredReadmePhrases) {
    if (!readmeText.includes(requiredPhrase)) {
      errors.push({ file: 'plan_fps/README.md', message: `Missing active step progress log instruction: ${requiredPhrase}` });
    }
  }

  if (!stepTemplateText.includes('`loop_logs/step_<step-id>_progress.txt`: keep completed work and remaining planned work current until the verified step is pushed')) {
    errors.push({ file: 'plan_fps/STEP_TEMPLATE.md', message: 'Step template must require active step progress log updates.' });
  }

  if (!gitignoreText.includes('plan_fps/loop_logs/*.txt')) {
    errors.push({ file: '.gitignore', message: 'Active step progress logs must stay ignored under plan_fps/loop_logs/*.txt.' });
  }
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
  process.exit(await runValidationCli());
}
