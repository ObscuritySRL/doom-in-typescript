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

  test('rationale pins the key evidence that drives the mixed classification', () => {
    expect(typeof manifest.rationale).toBe('string');
    expect(manifest.rationale.length).toBeGreaterThan(0);
    expect(manifest.rationale).toContain('167 steps');
    expect(manifest.rationale).toContain('bun run doom.ts');
    expect(manifest.rationale).toContain('side-by-side acceptance gate');
    expect(manifest.rationale).toContain('mixed');
  });

  test('evidencePaths is a non-empty array whose entries all live outside read-only reference roots', () => {
    expect(Array.isArray(manifest.evidencePaths)).toBe(true);
    expect(manifest.evidencePaths.length).toBeGreaterThanOrEqual(10);
    for (const evidencePath of manifest.evidencePaths) {
      expect(typeof evidencePath).toBe('string');
      expect(evidencePath.length).toBeGreaterThan(0);
      expect(evidencePath.startsWith('doom/')).toBe(false);
      expect(evidencePath.startsWith('iwad/')).toBe(false);
      expect(evidencePath.startsWith('reference/')).toBe(false);
    }
  });

  test('playable gap includesPlayableScope lists the delivered plan_engine/ scope items', () => {
    const includes = manifest.playableParityGaps.includesPlayableScope;
    expect(Array.isArray(includes)).toBe(true);
    expect(includes.length).toBeGreaterThanOrEqual(5);
    expect(includes).toContain('Host timing (35 Hz tic accumulator)');
    expect(includes).toContain('Keyboard and mouse input mapping');
    expect(includes).toContain('Save/load serialization');
    expect(includes).toContain('Demo parse, record, and playback');
    expect(includes).toContain('Parity and acceptance suite');
  });

  test('playable gap missesPlayableScope pins the bun-run and side-by-side anchors', () => {
    const misses = manifest.playableParityGaps.missesPlayableScope;
    expect(Array.isArray(misses)).toBe(true);
    expect(misses.length).toBeGreaterThanOrEqual(3);
    expect(misses).toContain('bun run doom.ts runtime entry point');
    expect(misses).toContain('Windowed host wired from launch to gameplay');
    expect(misses).toContain('Side-by-side acceptance gate');
  });

  test('totalCompletedSteps equals the sum of per-phase completedSteps in the manifest itself', () => {
    const sumOfPhaseCounts = manifest.oldPlan.phases.reduce((accumulator, phase) => accumulator + phase.completedSteps, 0);
    expect(sumOfPhaseCounts).toBe(manifest.oldPlan.totalCompletedSteps);
  });

  test('phase names in the manifest match the actual phase headers in plan_engine/MASTER_CHECKLIST.md', async () => {
    const checklistText = await Bun.file(CHECKLIST_PATH).text();
    const headerPattern = /^## Phase (\d{2}): (.+)$/gm;
    const observedHeaders = new Map<string, string>();

    for (const headerMatch of checklistText.matchAll(headerPattern)) {
      observedHeaders.set(headerMatch[1]!, headerMatch[2]!.trim());
    }

    expect(observedHeaders.size).toBe(EXPECTED_PHASES.length);
    for (const phase of EXPECTED_PHASES) {
      expect(observedHeaders.get(phase.id)).toBe(phase.name);
    }
  });
});
