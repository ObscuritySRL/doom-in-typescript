import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import manifest from '../../plan_fps/manifests/existing-plan-classification.json';

const CHECKLIST_PATH = 'plan_engine/MASTER_CHECKLIST.md';
const DECISION_LOG_PATH = 'plan_fps/DECISION_LOG.md';
const FACT_LOG_PATH = 'plan_fps/FACT_LOG.md';
const PACKAGE_JSON_PATH = 'package.json';
const MAIN_TS_PATH = 'src/main.ts';

type PhaseEntry = {
  id: string;
  name: string;
  completedSteps: number;
};

const EXPECTED_PHASES: readonly PhaseEntry[] = [
  { id: '00', name: 'Governance', completedSteps: 6 },
  { id: '01', name: 'Reference Inventory', completedSteps: 8 },
  { id: '02', name: 'Oracle Foundation', completedSteps: 10 },
  { id: '03', name: 'Scaffold And Test Harness', completedSteps: 8 },
  { id: '04', name: 'Core Math And Binary', completedSteps: 8 },
  { id: '05', name: 'WAD And Assets', completedSteps: 10 },
  { id: '06', name: 'Host Timing And Input', completedSteps: 8 },
  { id: '07', name: 'Bootstrap And Main Loop', completedSteps: 8 },
  { id: '08', name: 'Map Geometry And Spatial', completedSteps: 10 },
  { id: '09', name: 'Thinkers And Physics', completedSteps: 11 },
  { id: '10', name: 'Player, Weapons, Items', completedSteps: 8 },
  { id: '11', name: 'AI And Monsters', completedSteps: 8 },
  { id: '12', name: 'Specials And World Events', completedSteps: 10 },
  { id: '13', name: 'Renderer World', completedSteps: 14 },
  { id: '14', name: 'UI And Front-End Flow', completedSteps: 8 },
  { id: '15', name: 'Audio And Music', completedSteps: 12 },
  { id: '16', name: 'Save, Config, Demo', completedSteps: 10 },
  { id: '17', name: 'Parity And Acceptance', completedSteps: 10 },
];

function countCompletedStepsForPhase(checklistText: string, phaseId: string): number {
  const pattern = new RegExp(`^- \\[x\\] \`${phaseId}-`, 'gm');
  const matches = checklistText.match(pattern);
  return matches === null ? 0 : matches.length;
}

function countAllCompletedSteps(checklistText: string): number {
  const matches = checklistText.match(/^- \[x\] `/gm);
  return matches === null ? 0 : matches.length;
}

function countAllPendingSteps(checklistText: string): number {
  const matches = checklistText.match(/^- \[ \] `/gm);
  return matches === null ? 0 : matches.length;
}

describe('existing plan classification manifest', () => {
  test('locks schemaVersion 1 and the mixed classification tied to D-FPS-002', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.classification).toBe('mixed');
    expect(manifest.decisionId).toBe('D-FPS-002');
  });

  test('pins the old plan root and checklist path', () => {
    expect(manifest.oldPlan.root).toBe('plan_engine');
    expect(manifest.oldPlan.checklistPath).toBe(CHECKLIST_PATH);
    expect(existsSync(manifest.oldPlan.checklistPath)).toBe(true);
  });

  test('locks exactly 167 completed steps and 0 pending steps in the old plan', () => {
    expect(manifest.oldPlan.totalCompletedSteps).toBe(167);
    expect(manifest.oldPlan.totalPendingSteps).toBe(0);
  });

  test('reflects the actual completed step count in plan_engine/MASTER_CHECKLIST.md', async () => {
    const checklistText = await Bun.file(CHECKLIST_PATH).text();
    expect(countAllCompletedSteps(checklistText)).toBe(manifest.oldPlan.totalCompletedSteps);
    expect(countAllPendingSteps(checklistText)).toBe(manifest.oldPlan.totalPendingSteps);
  });

  test('lists all 18 phases in ascending id order with the exact expected names and counts', () => {
    expect(manifest.oldPlan.phases).toHaveLength(EXPECTED_PHASES.length);
    for (let index = 0; index < EXPECTED_PHASES.length; index += 1) {
      expect(manifest.oldPlan.phases[index]).toEqual(EXPECTED_PHASES[index]);
    }
  });

  test('per-phase counts in the manifest match per-phase counts in plan_engine/MASTER_CHECKLIST.md', async () => {
    const checklistText = await Bun.file(CHECKLIST_PATH).text();
    let sum = 0;
    for (const phase of EXPECTED_PHASES) {
      const observed = countCompletedStepsForPhase(checklistText, phase.id);
      expect(observed).toBe(phase.completedSteps);
      sum += observed;
    }
    expect(sum).toBe(manifest.oldPlan.totalCompletedSteps);
  });

  test('evidence paths exist on disk and include package.json and src/main.ts', () => {
    expect(manifest.evidencePaths).toContain(PACKAGE_JSON_PATH);
    expect(manifest.evidencePaths).toContain(MAIN_TS_PATH);
    expect(manifest.evidencePaths).toContain(CHECKLIST_PATH);
    for (const evidencePath of manifest.evidencePaths) {
      expect(existsSync(evidencePath)).toBe(true);
    }
  });

  test('playable gap pins the required Bun runtime command contract', () => {
    expect(manifest.playableParityGaps.requiredRuntimeCommand).toBe('bun run doom.ts');
    expect(manifest.playableParityGaps.missingEntryPointFile).toBe('doom.ts');
    expect(existsSync(manifest.playableParityGaps.missingEntryPointFile)).toBe(false);
  });

  test('playable gap reflects the actual current package start script and entry point', async () => {
    const packageJson = (await Bun.file(PACKAGE_JSON_PATH).json()) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.start).toBe(manifest.playableParityGaps.currentPackageStartScript);
    expect(existsSync(manifest.playableParityGaps.currentEntryPointFile)).toBe(true);
  });

  test('D-FPS-002 in plan_fps/DECISION_LOG.md still accepts the mixed classification', async () => {
    const decisionLogText = await Bun.file(DECISION_LOG_PATH).text();
    expect(decisionLogText).toContain('## D-FPS-002');
    expect(decisionLogText).toContain('status: accepted');
    expect(decisionLogText).toContain('Classify the old `plan_engine/` work as `mixed`.');
  });

  test('FACT_LOG.md records the classification and cites the manifest artifact path', async () => {
    const factLogText = await Bun.file(FACT_LOG_PATH).text();
    expect(factLogText).toContain('plan_fps/manifests/existing-plan-classification.json');
    expect(factLogText).toContain('classification is `mixed`');
  });
});
