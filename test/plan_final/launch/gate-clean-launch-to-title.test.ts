import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync } from 'node:fs';

const PREREQUISITE_STEP_IDS: readonly string[] = ['03-004', '03-005', '04-003', '05-004', '07-001'];

const LAUNCH_TO_TITLE_SURFACE: readonly string[] = [
  'src/vanilla/commandLineConfiguration.ts',
  'src/vanilla/launchContext.ts',
  'src/vanilla/win32WindowHost.ts',
  'src/vanilla/runDoomMain.ts',
  'src/vanilla/runDoomLoop.ts',
  'src/vanilla/wireTitleLoopRendering.ts',
];

interface PrerequisiteStatus {
  readonly stepId: string;
  readonly status: string;
  readonly commitSha?: string;
}

interface PrerequisiteEvidence {
  readonly stepId: string;
  readonly knownFailures: readonly unknown[];
  readonly typecheck: string;
}

function readStatus(stepId: string): PrerequisiteStatus {
  const path = `plan_final/status/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-clean-launch-to-title: prerequisite status ${path} is missing`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as PrerequisiteStatus;
}

function readEvidence(stepId: string): PrerequisiteEvidence {
  const path = `plan_final/evidence/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-clean-launch-to-title: prerequisite evidence ${path} is missing`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as PrerequisiteEvidence;
}

describe('plan_final launch: gate-clean-launch-to-title', () => {
  test('every launch->title prerequisite has a committed status JSON declaring COMPLETED with the matching stepId', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(status.stepId).toBe(stepId);
      expect(status.status).toBe('COMPLETED');
    }
  });

  test('every launch->title prerequisite status records a non-empty commitSha (proof the work was pushed)', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(typeof status.commitSha).toBe('string');
      expect((status.commitSha ?? '').length).toBeGreaterThanOrEqual(7);
    }
  });

  test('every launch->title prerequisite evidence declares zero knownFailures and a clean typecheck', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const evidence = readEvidence(stepId);
      expect(evidence.stepId).toBe(stepId);
      expect(evidence.knownFailures.length).toBe(0);
      expect(evidence.typecheck).toBe('clean');
    }
  });

  test('the composed launch->title runtime surface exists under src/vanilla/', () => {
    for (const sourcePath of LAUNCH_TO_TITLE_SURFACE) {
      expect(existsSync(sourcePath)).toBe(true);
    }
  });

  test('runDoomMain wires the parsed command line through resolveLaunchContext (the launch->title entry path)', () => {
    const runDoomMainText = readFileSync('src/vanilla/runDoomMain.ts', 'utf8');
    expect(runDoomMainText).toContain("import { resolveLaunchContext } from './launchContext.ts';");
    expect(runDoomMainText).toContain('resolveLaunchContext(commandLineConfiguration');
  });

  test('the wireTitleLoopRendering facade exposes the canonical title-loop entry points the launch path reaches', () => {
    const facadeText = readFileSync('src/vanilla/wireTitleLoopRendering.ts', 'utf8');
    expect(facadeText).toContain('createFrontEndSequence');
    expect(facadeText).toContain('tickFrontEnd');
    expect(facadeText).toContain('VANILLA_TITLE_LOOP_ENTRY_POINTS');
  });

  test('doom.ts exists and is held at the pinned plan_vanilla_parity skeleton (no side effects until a dedicated replace step)', () => {
    expect(existsSync('doom.ts')).toBe(true);
    const doomText = readFileSync('doom.ts', 'utf8');
    expect(doomText).toContain('export {}');
    expect(doomText).not.toContain('import {');
  });

  test('the reference initial-title-frame oracle fixture is present and pins the canonical capture command', () => {
    const fixturePath = 'test/oracles/fixtures/capture-initial-title-frame.json';
    expect(existsSync(fixturePath)).toBe(true);
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      captureCommand: { arguments: readonly string[]; program: string };
      captureWindow: { startTic: number };
    };
    expect(fixture.captureCommand.arguments).toEqual(['-iwad', 'doom/DOOM1.WAD']);
    expect(fixture.captureCommand.program).toBe('doom/DOOMD.EXE');
    expect(fixture.captureWindow.startTic).toBe(0);
  });

  test('the local shareware IWAD required for the clean launch is present', () => {
    expect(existsSync('doom/DOOM1.WAD')).toBe(true);
  });
});
