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
    expect(statSync(manifest.activeControlCenter.stepsDirectory).isDirectory()).toBe(true);
    expect(statSync(manifest.activeControlCenter.manifestsDirectory).isDirectory()).toBe(true);
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

  test('locks the Bun runtime command contract exactly as bun run doom.ts with no compiled entry point on disk', () => {
    expect(manifest.runtimeTarget).toBe('bun run doom.ts');
    expect(existsSync('doom.ts')).toBe(false);
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
});
