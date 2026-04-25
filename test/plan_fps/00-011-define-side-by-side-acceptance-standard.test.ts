import { describe, expect, it } from 'bun:test';

import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const manifestPath = resolve(workspaceRoot, 'plan_fps/manifests/00-011-define-side-by-side-acceptance-standard.json');
const decisionLogPath = resolve(workspaceRoot, 'plan_fps/DECISION_LOG.md');
const packageJsonPath = resolve(workspaceRoot, 'package.json');
const readmePath = resolve(workspaceRoot, 'plan_fps/README.md');
const tsconfigPath = resolve(workspaceRoot, 'tsconfig.json');

const expectedManifest = {
  acceptanceGate: {
    comparisonMode: 'side-by-side',
    gateStepId: '15-010',
    gateStepSlug: 'gate-final-side-by-side',
    referenceAuthority: 'local-read-only-doom-reference',
    requiresCleanLaunch: true,
    requiresDeterministicReplay: true,
  },
  allowedPresentationDifference: {
    decisionId: 'D-FPS-004',
    implementationLaunchMode: 'windowed',
    referenceLaunchMode: 'fullscreen',
    scope: 'launch-presentation-envelope-only',
  },
  comparisonPipeline: [
    {
      id: 'arrange-side-by-side-view',
      requirement: 'Observe the Bun window and the local reference output together during the same scripted scenario.',
    },
    {
      id: 'launch-from-clean-state',
      requirement: 'Start both sides from clean launch state before any compared interaction.',
    },
    {
      id: 'drive-identical-deterministic-input',
      requirement: 'Use the same demo or scripted input path for both sides so comparisons are replay-stable.',
    },
    {
      id: 'capture-authoritative-oracles',
      requirement: 'Record hashes or exact transition logs instead of relying on human judgment alone.',
    },
    {
      id: 'accept-only-window-envelope-difference',
      requirement: 'Reject any observable mismatch outside the permitted windowed-versus-fullscreen presentation envelope.',
    },
  ],
  decisionId: 'D-FPS-011',
  evidencePaths: ['package.json', 'plan_fps/DECISION_LOG.md', 'plan_fps/README.md', 'plan_fps/manifests/00-011-define-side-by-side-acceptance-standard.json', 'tsconfig.json'],
  requiredEvidenceFamilies: [
    {
      gateStepIds: ['15-009', '15-010'],
      id: 'attract-loop',
      oracleStepIds: ['02-006', '02-031'],
      standard: 'exact-sequence',
    },
    {
      gateStepIds: ['15-007', '15-010'],
      id: 'audio-hash-windows',
      oracleStepIds: ['02-027', '10-014'],
      standard: 'exact-hash',
    },
    {
      gateStepIds: ['15-010'],
      id: 'framebuffer-hash-windows',
      oracleStepIds: ['02-029', '09-013'],
      standard: 'exact-hash',
    },
    {
      gateStepIds: ['15-010'],
      id: 'music-event-hash-windows',
      oracleStepIds: ['02-028', '10-014'],
      standard: 'exact-hash',
    },
    {
      gateStepIds: ['15-008', '15-010'],
      id: 'save-load-roundtrip',
      oracleStepIds: ['02-026', '11-011'],
      standard: 'exact-state',
    },
    {
      gateStepIds: ['15-005', '15-010'],
      id: 'scripted-e1m1-start',
      oracleStepIds: ['02-019'],
      standard: 'exact-transition',
    },
    {
      gateStepIds: ['15-003', '15-004', '15-010'],
      id: 'startup-and-menu-transitions',
      oracleStepIds: ['02-003', '02-010', '02-018'],
      standard: 'exact-sequence',
    },
    {
      gateStepIds: ['15-006', '15-010'],
      id: 'state-hash-windows',
      oracleStepIds: ['02-030', '13-008'],
      standard: 'exact-hash',
    },
  ],
  runtimeTarget: {
    command: 'bun run doom.ts',
    decisionId: 'D-FPS-003',
  },
  schemaVersion: 1,
  stepId: '00-011',
  stepSlug: 'define-side-by-side-acceptance-standard',
} as const;

const expectedDecisionBlock = `## D-FPS-011

- status: accepted
- date: 2026-04-24
- decision: Final acceptance is a side-by-side comparison between the Bun playable path and the local read-only reference path, started from clean launch and driven by identical deterministic input, with exact parity required for authoritative transition, framebuffer, audio, music, save/load, and state evidence outside the approved windowed-versus-fullscreen launch envelope.
- rationale: D-FPS-003 pins the Bun runtime target to \`bun run doom.ts\`, D-FPS-004 limits presentation drift to windowed-versus-fullscreen launch, and D-FPS-009/D-FPS-010 constrain the local reference authority to read-only, non-redistributable DOOM assets. This step turns "side-by-side-verifiable" from a slogan into an exact acceptance standard for later oracle capture and final gating work.
- evidence: plan_fps/README.md, plan_fps/manifests/00-011-define-side-by-side-acceptance-standard.json, package.json, tsconfig.json
- affected_steps: 00-011, 00-012, 02-031, 15-010
- supersedes: none`;

describe('00-011 define-side-by-side-acceptance-standard', () => {
  it('locks the parsed manifest payload exactly', async () => {
    const manifest = await Bun.file(manifestPath).json();

    expect(manifest).toEqual(expectedManifest);
  });

  it('pins the ordered comparison pipeline and exact-match evidence families', async () => {
    const manifest = await Bun.file(manifestPath).json();

    expect(manifest.comparisonPipeline.map((entry: { id: string }) => entry.id)).toEqual([
      'arrange-side-by-side-view',
      'launch-from-clean-state',
      'drive-identical-deterministic-input',
      'capture-authoritative-oracles',
      'accept-only-window-envelope-difference',
    ]);
    expect(manifest.requiredEvidenceFamilies.map((entry: { id: string; standard: string }) => `${entry.id}:${entry.standard}`)).toEqual([
      'attract-loop:exact-sequence',
      'audio-hash-windows:exact-hash',
      'framebuffer-hash-windows:exact-hash',
      'music-event-hash-windows:exact-hash',
      'save-load-roundtrip:exact-state',
      'scripted-e1m1-start:exact-transition',
      'startup-and-menu-transitions:exact-sequence',
      'state-hash-windows:exact-hash',
    ]);
  });

  it('cross-checks the README mission and Bun-only workspace settings', async () => {
    const packageJson = await Bun.file(packageJsonPath).json();
    const readmeText = await Bun.file(readmePath).text();
    const tsconfig = await Bun.file(tsconfigPath).json();

    expect(readmeText).toContain(
      'Convert the existing deterministic DOOM engine work into a Bun-run, windowed, playable, side-by-side-verifiable DOOM product while preserving vanilla/reference behavior exactly except for fullscreen-vs-windowed presentation.',
    );
    expect(packageJson.private).toBe(true);
    expect(packageJson.type).toBe('module');
    expect(Object.values(packageJson.scripts)).toEqual(['bun run tools/format-changed.ts', 'bun run src/main.ts']);
    expect(tsconfig.compilerOptions.noEmit).toBe(true);
    expect(tsconfig.compilerOptions.types).toEqual(['bun']);
  });

  it('records the exact D-FPS-011 decision block', async () => {
    const decisionLogText = await Bun.file(decisionLogPath).text();

    expect(decisionLogText).toContain(expectedDecisionBlock);
  });

  it('keeps every evidence path present on disk', async () => {
    for (const relativePath of expectedManifest.evidencePaths) {
      const absolutePath = resolve(workspaceRoot, relativePath);

      expect(await Bun.file(absolutePath).exists()).toBe(true);
    }
  });

  it('keeps evidence paths sorted with no duplicates', () => {
    const evidencePaths = [...expectedManifest.evidencePaths];
    const sortedEvidencePaths = [...evidencePaths].sort();

    expect(evidencePaths).toEqual(sortedEvidencePaths);
    expect(new Set(evidencePaths).size).toBe(evidencePaths.length);
  });

  it('keeps required evidence family ids alphabetical and unique', () => {
    const familyIds = expectedManifest.requiredEvidenceFamilies.map((family) => family.id);
    const sortedFamilyIds = [...familyIds].sort();

    expect(familyIds).toEqual(sortedFamilyIds);
    expect(new Set(familyIds).size).toBe(familyIds.length);
  });

  it('keeps comparison pipeline ids unique', () => {
    const pipelineIds = expectedManifest.comparisonPipeline.map((step) => step.id);

    expect(new Set(pipelineIds).size).toBe(pipelineIds.length);
  });

  it('routes every evidence family through the final acceptance gate', () => {
    const finalGateStepId = expectedManifest.acceptanceGate.gateStepId;

    for (const family of expectedManifest.requiredEvidenceFamilies) {
      expect(family.gateStepIds).toContain(finalGateStepId);
      expect(family.oracleStepIds.length).toBeGreaterThan(0);
      expect(new Set(family.gateStepIds).size).toBe(family.gateStepIds.length);
      expect(new Set(family.oracleStepIds).size).toBe(family.oracleStepIds.length);
    }
  });

  it('uses the runtime command pinned by D-FPS-003 as the acceptance-gate target', () => {
    expect(expectedManifest.runtimeTarget.command).toBe('bun run doom.ts');
    expect(expectedManifest.runtimeTarget.decisionId).toBe('D-FPS-003');
    expect(expectedManifest.acceptanceGate.requiresDeterministicReplay).toBe(true);
    expect(expectedManifest.acceptanceGate.requiresCleanLaunch).toBe(true);
  });
});
