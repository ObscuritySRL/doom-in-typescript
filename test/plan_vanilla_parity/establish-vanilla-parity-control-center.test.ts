import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const CONTROL_CENTER_DOCUMENT_PATH = 'plan_vanilla_parity/establish-vanilla-parity-control-center.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const README_PATH = 'plan_vanilla_parity/README.md';
const VALIDATE_PLAN_SCRIPT_PATH = 'plan_vanilla_parity/validate-plan.ts';

const BANNED_RUNTIME_TOKENS = ['jest', 'mocha', 'node', 'npm', 'npx', 'pnpm', 'ts-node', 'tsx', 'vitest', 'yarn'] as const;

interface ControlCenterDocument {
  readonly acceptanceStandard: string;
  readonly activeControlCenterDirectory: string;
  readonly finalGateStepFilePath: string;
  readonly finalGateStepId: string;
  readonly finalGateStepSlug: string;
  readonly firstEligibleStepFilePath: string;
  readonly firstEligibleStepId: string;
  readonly firstEligibleStepSlug: string;
  readonly priorArtOnlyDirectories: readonly string[];
  readonly readOnlyReferenceRoots: readonly string[];
  readonly runtimeTarget: string;
  readonly sharedPlanFiles: readonly string[];
  readonly totalSteps: number;
  readonly validationCommands: readonly string[];
  readonly writableWorkspaceRoot: string;
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in control center document.`);
  }
  const bodyStart = sectionStart + heading.length + 2;
  const remainder = documentText.slice(bodyStart);
  const nextHeadingOffset = remainder.search(/\n## /);
  return (nextHeadingOffset === -1 ? remainder : remainder.slice(0, nextHeadingOffset)).trim();
}

function extractBullets(documentText: string, sectionHeading: string): readonly string[] {
  return extractSection(documentText, sectionHeading)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim().replace(/^`|`$/g, ''));
}

function parseControlCenterDocument(documentText: string): ControlCenterDocument {
  const totalStepsText = extractSection(documentText, 'total steps');
  const totalStepsNumber = Number(totalStepsText);
  if (!Number.isInteger(totalStepsNumber) || totalStepsNumber <= 0) {
    throw new Error(`total steps must be a positive integer, got "${totalStepsText}".`);
  }
  return {
    acceptanceStandard: extractSection(documentText, 'acceptance standard'),
    activeControlCenterDirectory: extractSection(documentText, 'active control center directory'),
    finalGateStepFilePath: extractSection(documentText, 'final gate step file path'),
    finalGateStepId: extractSection(documentText, 'final gate step id'),
    finalGateStepSlug: extractSection(documentText, 'final gate step slug'),
    firstEligibleStepFilePath: extractSection(documentText, 'first eligible step file path'),
    firstEligibleStepId: extractSection(documentText, 'first eligible step id'),
    firstEligibleStepSlug: extractSection(documentText, 'first eligible step slug'),
    priorArtOnlyDirectories: extractBullets(documentText, 'prior-art only directories'),
    readOnlyReferenceRoots: extractBullets(documentText, 'read-only reference roots'),
    runtimeTarget: extractSection(documentText, 'runtime target'),
    sharedPlanFiles: extractBullets(documentText, 'shared plan files'),
    totalSteps: totalStepsNumber,
    validationCommands: extractBullets(documentText, 'validation commands'),
    writableWorkspaceRoot: extractSection(documentText, 'writable workspace root'),
  };
}

async function loadControlCenterDocument(): Promise<ControlCenterDocument> {
  const documentText = await Bun.file(CONTROL_CENTER_DOCUMENT_PATH).text();
  return parseControlCenterDocument(documentText);
}

describe('vanilla parity control center declaration', () => {
  test('control center document exists at the canonical path', () => {
    expect(existsSync(CONTROL_CENTER_DOCUMENT_PATH)).toBe(true);
    expect(statSync(CONTROL_CENTER_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadControlCenterDocument();
    expect(parsed.activeControlCenterDirectory).toBe('plan_vanilla_parity/');
    expect(parsed.priorArtOnlyDirectories).toEqual(['plan_engine/', 'plan_fps/']);
    expect(parsed.writableWorkspaceRoot).toBe('D:/Projects/doom-in-typescript');
    expect(parsed.runtimeTarget).toBe('bun run doom.ts');
    expect(parsed.totalSteps).toBe(398);
    expect(parsed.firstEligibleStepId).toBe('00-001');
    expect(parsed.firstEligibleStepSlug).toBe('establish-vanilla-parity-control-center');
    expect(parsed.firstEligibleStepFilePath).toBe('plan_vanilla_parity/steps/00-001-establish-vanilla-parity-control-center.md');
    expect(parsed.finalGateStepId).toBe('13-004');
    expect(parsed.finalGateStepSlug).toBe('gate-full-final-side-by-side-proof');
    expect(parsed.finalGateStepFilePath).toBe('plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md');
    expect(parsed.readOnlyReferenceRoots).toEqual(['doom/', 'iwad/', 'reference/']);
    expect(parsed.validationCommands).toEqual(['bun run format', 'bun test plan_vanilla_parity/validate-plan.test.ts', 'bun run plan_vanilla_parity/validate-plan.ts', 'bun test', 'bun x tsc --noEmit --project tsconfig.json']);
  });

  test('every declared shared plan file exists, lives under plan_vanilla_parity/, and is unique', async () => {
    const parsed = await loadControlCenterDocument();
    expect(parsed.sharedPlanFiles.length).toBeGreaterThan(0);
    expect(new Set(parsed.sharedPlanFiles).size).toBe(parsed.sharedPlanFiles.length);
    for (const sharedFilePath of parsed.sharedPlanFiles) {
      expect(sharedFilePath.startsWith('plan_vanilla_parity/')).toBe(true);
      expect(existsSync(sharedFilePath)).toBe(true);
      expect(statSync(sharedFilePath).isFile()).toBe(true);
    }
  });

  test('declared prior-art directories exist on disk and are not the active control center', async () => {
    const parsed = await loadControlCenterDocument();
    for (const priorArtDirectory of parsed.priorArtOnlyDirectories) {
      expect(priorArtDirectory).not.toBe(parsed.activeControlCenterDirectory);
      const trimmedPath = priorArtDirectory.replace(/\/$/, '');
      expect(existsSync(trimmedPath)).toBe(true);
      expect(statSync(trimmedPath).isDirectory()).toBe(true);
    }
  });

  test('first eligible step file exists, declares the governance lane, and matches MASTER_CHECKLIST.md row one', async () => {
    const parsed = await loadControlCenterDocument();
    expect(existsSync(parsed.firstEligibleStepFilePath)).toBe(true);
    const stepText = await Bun.file(parsed.firstEligibleStepFilePath).text();
    expect(stepText).toContain(`# [ ] STEP ${parsed.firstEligibleStepId}: Establish Vanilla Parity Control Center`);
    expect(stepText).toContain('\n## lane\n\ngovernance\n');

    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedChecklistLine = `- [ ] \`${parsed.firstEligibleStepId}\` \`${parsed.firstEligibleStepSlug}\` | lane: \`governance\` | prereqs: \`none\` | file: \`${parsed.firstEligibleStepFilePath}\``;
    const completedChecklistLine = `- [x] \`${parsed.firstEligibleStepId}\` \`${parsed.firstEligibleStepSlug}\` | lane: \`governance\` | prereqs: \`none\` | file: \`${parsed.firstEligibleStepFilePath}\``;
    expect(checklistText.includes(expectedChecklistLine) || checklistText.includes(completedChecklistLine)).toBe(true);
  });

  test('final gate step file exists, the slug matches the canonical convention, and the validator pins the same id', async () => {
    const parsed = await loadControlCenterDocument();
    expect(existsSync(parsed.finalGateStepFilePath)).toBe(true);
    expect(parsed.finalGateStepFilePath).toBe(`plan_vanilla_parity/steps/${parsed.finalGateStepId}-${parsed.finalGateStepSlug}.md`);

    const validatorScriptText = await Bun.file(VALIDATE_PLAN_SCRIPT_PATH).text();
    expect(validatorScriptText).toContain(`const FINAL_GATE_STEP_ID = '${parsed.finalGateStepId}';`);
  });

  test('total steps equals the count of plan_vanilla_parity/steps/*.md files and the validator EXPECTED_TOTAL_STEPS', async () => {
    const parsed = await loadControlCenterDocument();
    const stepFileNames = await Array.fromAsync(new Bun.Glob('*.md').scan({ cwd: 'plan_vanilla_parity/steps' }));
    expect(stepFileNames.length).toBe(parsed.totalSteps);

    const validatorScriptText = await Bun.file(VALIDATE_PLAN_SCRIPT_PATH).text();
    expect(validatorScriptText).toContain(`const EXPECTED_TOTAL_STEPS = ${parsed.totalSteps};`);
    expect(validatorScriptText).toContain(`const EXPECTED_FIRST_STEP = '${parsed.firstEligibleStepId}';`);
  });

  test('runtime target is the Bun-run entrypoint and the validator rejects every banned non-Bun runtime', async () => {
    const parsed = await loadControlCenterDocument();
    expect(parsed.runtimeTarget).toBe('bun run doom.ts');

    const validatorScriptText = await Bun.file(VALIDATE_PLAN_SCRIPT_PATH).text();
    for (const bannedRuntimeToken of BANNED_RUNTIME_TOKENS) {
      expect(validatorScriptText).toContain(`'${bannedRuntimeToken}'`);
    }
  });

  test('README.md declares plan_vanilla_parity as the active control center, lists prior-art-only plans, and pins the first eligible step', async () => {
    const parsed = await loadControlCenterDocument();
    const readmeText = await Bun.file(README_PATH).text();
    expect(readmeText).toContain('Active plan directory: `plan_vanilla_parity/`.');
    expect(readmeText).toContain('Prior art only: `plan_engine/` and `plan_fps/`.');
    expect(readmeText).toContain(`Total steps: \`${parsed.totalSteps}\`.`);
    expect(readmeText).toContain(`First eligible step: \`${parsed.firstEligibleStepId} ${parsed.firstEligibleStepSlug}\`.`);
  });

  test('PROMPT.md treats plan_vanilla_parity as the only active control center and pins the canonical verification order', async () => {
    const promptText = await Bun.file(PROMPT_PATH).text();
    expect(promptText).toContain('`plan_vanilla_parity/` as the only active planning and execution control center');
    expect(promptText).toContain('Treat `plan_engine/` and `plan_fps/` as prior art only.');
    expect(promptText).toContain('Verification order is fixed: `bun run format`, focused `bun test <path>`, `bun test`, and `bun x tsc --noEmit --project tsconfig.json`.');
  });

  test('read-only reference roots agree with validator READ_ONLY_ROOTS and never overlap any shared plan file', async () => {
    const parsed = await loadControlCenterDocument();
    const validatorScriptText = await Bun.file(VALIDATE_PLAN_SCRIPT_PATH).text();
    for (const readOnlyRoot of parsed.readOnlyReferenceRoots) {
      expect(readOnlyRoot.endsWith('/')).toBe(true);
      expect(validatorScriptText).toContain(`'${readOnlyRoot}'`);
      for (const sharedFilePath of parsed.sharedPlanFiles) {
        expect(sharedFilePath.startsWith(readOnlyRoot)).toBe(false);
      }
    }
  });

  test('writable workspace root matches the on-disk repository working directory case-insensitively', async () => {
    const parsed = await loadControlCenterDocument();
    const normalizedWorkingDirectory = process.cwd().replace(/\\/g, '/');
    expect(normalizedWorkingDirectory.toLowerCase()).toBe(parsed.writableWorkspaceRoot.toLowerCase());
  });

  test('acceptance standard binds bun run doom.ts, every required final-gate phrase, and zero default differences', async () => {
    const parsed = await loadControlCenterDocument();
    const requiredAcceptancePhrases = [
      'bun run doom.ts',
      'clean launch',
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
    ];
    for (const requiredPhrase of requiredAcceptancePhrases) {
      expect(parsed.acceptanceStandard).toContain(requiredPhrase);
    }
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## active control center directory\n\nplan_vanilla_parity/\n';
    expect(() => parseControlCenterDocument(documentTextWithMissingSection)).toThrow('Section "total steps" not found in control center document.');
  });

  test('parser surfaces a meaningful error when total steps is not a positive integer (failure mode)', () => {
    const documentTextWithBadTotal = [
      '# Test',
      '',
      '## active control center directory',
      '',
      'plan_vanilla_parity/',
      '',
      '## prior-art only directories',
      '',
      '- plan_engine/',
      '',
      '## writable workspace root',
      '',
      'D:/Projects/doom-in-typescript',
      '',
      '## runtime target',
      '',
      'bun run doom.ts',
      '',
      '## total steps',
      '',
      'not-a-number',
      '',
    ].join('\n');
    expect(() => parseControlCenterDocument(documentTextWithBadTotal)).toThrow('total steps must be a positive integer');
  });
});
