import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

import classificationManifest from '../../plan_fps/manifests/existing-plan-classification.json';
import manifest from '../../plan_fps/manifests/00-002-declare-plan-fps-control-center.json';

const README_PATH = 'plan_fps/README.md';
const CHECKLIST_PATH = 'plan_fps/MASTER_CHECKLIST.md';
const DECISION_LOG_PATH = 'plan_fps/DECISION_LOG.md';
const PACKAGE_JSON_PATH = 'package.json';
const TSCONFIG_JSON_PATH = 'tsconfig.json';

describe('plan_fps control-center declaration manifest', () => {
  test('locks schemaVersion 1 and ties the decision to D-FPS-001', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.decisionId).toBe('D-FPS-001');
  });

  test('pins plan_fps as the active control center directory with resolvable subpaths', () => {
    expect(manifest.activeControlCenter.directory).toBe('plan_fps');
    expect(manifest.activeControlCenter.readmePath).toBe(README_PATH);
    expect(manifest.activeControlCenter.checklistPath).toBe(CHECKLIST_PATH);
    expect(manifest.activeControlCenter.promptPath).toBe('plan_fps/PROMPT.md');
    expect(manifest.activeControlCenter.prePromptPath).toBe('plan_fps/PRE_PROMPT.md');
    expect(manifest.activeControlCenter.stepTemplatePath).toBe('plan_fps/STEP_TEMPLATE.md');
    expect(manifest.activeControlCenter.validatorScriptPath).toBe('plan_fps/validate-plan.ts');
    expect(manifest.activeControlCenter.validatorTestPath).toBe('plan_fps/validate-plan.test.ts');
    expect(manifest.activeControlCenter.stepsDirectory).toBe('plan_fps/steps');
    expect(manifest.activeControlCenter.manifestsDirectory).toBe('plan_fps/manifests');

    for (const activePath of Object.values(manifest.activeControlCenter)) {
      expect(existsSync(activePath)).toBe(true);
    }
    expect(statSync(manifest.activeControlCenter.directory).isDirectory()).toBe(true);
    expect(statSync(manifest.activeControlCenter.stepsDirectory).isDirectory()).toBe(true);
    expect(statSync(manifest.activeControlCenter.manifestsDirectory).isDirectory()).toBe(true);
    expect(statSync(manifest.activeControlCenter.readmePath).isFile()).toBe(true);
    expect(statSync(manifest.activeControlCenter.checklistPath).isFile()).toBe(true);
    expect(statSync(manifest.activeControlCenter.promptPath).isFile()).toBe(true);
    expect(statSync(manifest.activeControlCenter.prePromptPath).isFile()).toBe(true);
    expect(statSync(manifest.activeControlCenter.stepTemplatePath).isFile()).toBe(true);
    expect(statSync(manifest.activeControlCenter.validatorScriptPath).isFile()).toBe(true);
    expect(statSync(manifest.activeControlCenter.validatorTestPath).isFile()).toBe(true);
  });

  test('pins plan_engine as prior-art-only and inherits the mixed classification from the 00-001 manifest', () => {
    expect(manifest.priorArtPlan.directory).toBe('plan_engine');
    expect(manifest.priorArtPlan.role).toBe('prior-art-only');
    expect(manifest.priorArtPlan.classification).toBe('mixed');
    expect(manifest.priorArtPlan.classification).toBe(classificationManifest.classification);
    expect(manifest.priorArtPlan.classificationManifestPath).toBe('plan_fps/manifests/existing-plan-classification.json');
    expect(existsSync(manifest.priorArtPlan.directory)).toBe(true);
    expect(statSync(manifest.priorArtPlan.directory).isDirectory()).toBe(true);
    expect(existsSync(manifest.priorArtPlan.classificationManifestPath)).toBe(true);
  });

  test('locks the Bun runtime command contract exactly as bun run doom.ts', () => {
    expect(manifest.runtimeTarget).toBe('bun run doom.ts');
  });

  test('locks total steps at 223 and ties firstStepId to 00-001 classify-existing-plan', () => {
    expect(manifest.totalSteps).toBe(223);
    expect(manifest.firstStepId).toBe('00-001');
    expect(manifest.firstStepTitleSlug).toBe('classify-existing-plan');
    expect(manifest.firstStepFilePath).toBe('plan_fps/steps/00-001-classify-existing-plan.md');
    expect(existsSync(manifest.firstStepFilePath)).toBe(true);
  });

  test('pins final acceptance gate at 15-010 gate-final-side-by-side', () => {
    expect(manifest.finalGateStepId).toBe('15-010');
    expect(manifest.finalGateStepFilePath).toBe('plan_fps/steps/15-010-gate-final-side-by-side.md');
    expect(existsSync(manifest.finalGateStepFilePath)).toBe(true);
  });

  test('locks the writable workspace root and exactly three read-only reference roots', () => {
    expect(manifest.writableWorkspaceRoot).toBe('D:/Projects/doom-in-typescript');
    expect(manifest.readOnlyReferenceRoots).toEqual(['doom/', 'iwad/', 'reference/']);
  });

  test('lists every shared plan_fps control-log and reference file, and all of them exist on disk', () => {
    const expectedSharedFiles = [
      'plan_fps/MASTER_CHECKLIST.md',
      'plan_fps/DECISION_LOG.md',
      'plan_fps/FACT_LOG.md',
      'plan_fps/HANDOFF_LOG.md',
      'plan_fps/PRE_PROMPT.md',
      'plan_fps/REFERENCE_ORACLES.md',
      'plan_fps/SOURCE_CATALOG.md',
      'plan_fps/PACKAGE_CAPABILITY_MATRIX.md',
      'plan_fps/STEP_TEMPLATE.md',
    ];
    expect(manifest.sharedFiles).toEqual(expectedSharedFiles);
    for (const sharedFile of manifest.sharedFiles) {
      expect(existsSync(sharedFile)).toBe(true);
    }
  });

  test('locks the ralph-loop workflow step count and canonical validation commands', () => {
    expect(manifest.ralphLoopWorkflowStepCount).toBe(10);
    expect(manifest.validationCommands).toEqual(['bun run format', 'bun test plan_fps/validate-plan.test.ts', 'bun run plan_fps/validate-plan.ts', 'bun test', 'bun x tsc --noEmit --project tsconfig.json']);
  });

  test('MASTER_CHECKLIST.md header values match the manifest totals and first-step id', async () => {
    const checklistText = await Bun.file(CHECKLIST_PATH).text();
    expect(checklistText).toContain(`Total steps: ${manifest.totalSteps}`);
    expect(checklistText).toContain(`First eligible step: \`${manifest.firstStepId} Classify Existing Plan\``);
    expect(checklistText).toContain(`Runtime target: \`${manifest.runtimeTarget}\``);
  });

  test('README.md declares plan_fps as the active plan directory and pins the Bun runtime command', async () => {
    const readmeText = await Bun.file(README_PATH).text();
    expect(readmeText).toContain('Active plan directory: `plan_fps/`');
    expect(readmeText).toContain('Prior-art plan directory: `plan_engine/`');
    expect(readmeText).toContain(`Final command: \`${manifest.runtimeTarget}\``);
    expect(readmeText).toContain(`Total playable-plan steps: \`${manifest.totalSteps}\``);
    expect(readmeText).toContain(`First eligible step: \`${manifest.firstStepId} Classify Existing Plan\``);
  });

  test('DECISION_LOG.md records D-FPS-001 as accepted and cites the manifest artifact as evidence', async () => {
    const decisionLogText = await Bun.file(DECISION_LOG_PATH).text();
    expect(decisionLogText).toContain(`## ${manifest.decisionId}`);
    expect(decisionLogText).toContain('status: accepted');
    expect(decisionLogText).toContain('Use `plan_fps/` as the active playable parity control center.');
    expect(decisionLogText).toContain('plan_fps/manifests/00-002-declare-plan-fps-control-center.json');
  });

  test('the prior-art classification manifest still schema-aligns with this control-center manifest', () => {
    expect(classificationManifest.schemaVersion).toBe(1);
    expect(classificationManifest.oldPlan.root).toBe(manifest.priorArtPlan.directory);
    expect(manifest.priorArtPlan.classification).toBe(classificationManifest.classification);
  });

  test('package.json and tsconfig.json exist at the paths consulted by this step', () => {
    expect(existsSync(PACKAGE_JSON_PATH)).toBe(true);
    expect(existsSync(TSCONFIG_JSON_PATH)).toBe(true);
  });

  test('readOnlyReferenceRoots and sharedFiles never reference a read-only reference root path', () => {
    for (const readOnlyRoot of manifest.readOnlyReferenceRoots) {
      expect(readOnlyRoot.endsWith('/')).toBe(true);
    }
    for (const sharedFile of manifest.sharedFiles) {
      expect(sharedFile.startsWith('doom/')).toBe(false);
      expect(sharedFile.startsWith('iwad/')).toBe(false);
      expect(sharedFile.startsWith('reference/')).toBe(false);
    }
  });

  test('sharedFiles, validationCommands, and readOnlyReferenceRoots each contain no duplicate entries', () => {
    expect(new Set(manifest.sharedFiles).size).toBe(manifest.sharedFiles.length);
    expect(new Set(manifest.validationCommands).size).toBe(manifest.validationCommands.length);
    expect(new Set(manifest.readOnlyReferenceRoots).size).toBe(manifest.readOnlyReferenceRoots.length);
  });

  test('activeControlCenter values contain no duplicate paths', () => {
    const activeValues = Object.values(manifest.activeControlCenter);
    expect(new Set(activeValues).size).toBe(activeValues.length);
  });

  test('firstStepFilePath matches the canonical plan_fps/steps/<id>-<slug>.md convention', () => {
    const expectedFirstStepFilePath = `plan_fps/steps/${manifest.firstStepId}-${manifest.firstStepTitleSlug}.md`;
    expect(manifest.firstStepFilePath).toBe(expectedFirstStepFilePath);
  });

  test('finalGateStepFilePath lives under plan_fps/steps, starts with the finalGateStepId segment, and ends in .md', () => {
    expect(manifest.finalGateStepFilePath.startsWith(`plan_fps/steps/${manifest.finalGateStepId}-`)).toBe(true);
    expect(manifest.finalGateStepFilePath.endsWith('.md')).toBe(true);
  });

  test('README.md pins the writable workspace root verbatim', async () => {
    const readmeText = await Bun.file(README_PATH).text();
    expect(readmeText).toContain(`Writable workspace root: \`${manifest.writableWorkspaceRoot}\``);
  });

  test('validate-plan.ts RUNTIME_TARGET constant agrees with the manifest runtimeTarget', async () => {
    const validatorText = await Bun.file(manifest.activeControlCenter.validatorScriptPath).text();
    expect(validatorText).toContain(`const RUNTIME_TARGET = '${manifest.runtimeTarget}';`);
  });

  test('every plan_fps/steps file matches the canonical <id>-<slug>.md pattern, step ids are unique, and the total equals manifest.totalSteps', async () => {
    const stepFilenamePattern = /^(?<stepId>\d{2}-\d{3})-(?<titleSlug>[a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
    const stepsGlob = new Bun.Glob('*.md');
    const collectedStepIds = new Set<string>();
    let stepFileCount = 0;
    for await (const stepFilename of stepsGlob.scan({ cwd: manifest.activeControlCenter.stepsDirectory })) {
      stepFileCount += 1;
      const match = stepFilenamePattern.exec(stepFilename);
      expect(match?.groups).toBeDefined();
      const stepId = match!.groups!.stepId!;
      expect(collectedStepIds.has(stepId)).toBe(false);
      collectedStepIds.add(stepId);
    }
    expect(stepFileCount).toBe(manifest.totalSteps);
    expect(collectedStepIds.size).toBe(manifest.totalSteps);
    expect(collectedStepIds.has(manifest.firstStepId)).toBe(true);
    expect(collectedStepIds.has(manifest.finalGateStepId)).toBe(true);
  });

  test('MASTER_CHECKLIST.md contains exactly totalSteps checklist row entries that match the canonical id pattern', async () => {
    const checklistText = await Bun.file(CHECKLIST_PATH).text();
    const checklistRowPattern = /^- \[[ x]\] `\d{2}-\d{3}` /gm;
    const checklistRowMatches = checklistText.match(checklistRowPattern);
    expect(checklistRowMatches).not.toBeNull();
    expect(checklistRowMatches!.length).toBe(manifest.totalSteps);
  });

  test('README.md Ralph-Loop Workflow section has exactly ralphLoopWorkflowStepCount numbered items', async () => {
    const readmeText = await Bun.file(README_PATH).text();
    const workflowSectionStart = readmeText.indexOf('## Ralph-Loop Workflow');
    expect(workflowSectionStart).toBeGreaterThanOrEqual(0);

    const afterHeader = readmeText.slice(workflowSectionStart);
    const nextSectionIndex = afterHeader.indexOf('\n## ', 1);
    const workflowBody = nextSectionIndex === -1 ? afterHeader : afterHeader.slice(0, nextSectionIndex);

    const numberedItems = workflowBody.match(/^\d+\. /gm);
    expect(numberedItems).not.toBeNull();
    expect(numberedItems!.length).toBe(manifest.ralphLoopWorkflowStepCount);
  });

  test('README.md Validation section contains every command listed in validationCommands', async () => {
    const readmeText = await Bun.file(README_PATH).text();
    const validationSectionStart = readmeText.indexOf('## Validation');
    expect(validationSectionStart).toBeGreaterThanOrEqual(0);

    const afterHeader = readmeText.slice(validationSectionStart);
    const nextSectionIndex = afterHeader.indexOf('\n## ', 1);
    const validationBody = nextSectionIndex === -1 ? afterHeader : afterHeader.slice(0, nextSectionIndex);

    for (const validationCommand of manifest.validationCommands) {
      expect(validationBody).toContain(validationCommand);
    }
  });
});
