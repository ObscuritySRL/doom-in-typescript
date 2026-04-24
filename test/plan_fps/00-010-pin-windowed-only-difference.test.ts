import { describe, expect, test } from 'bun:test';

const manifestPath = new URL('../../plan_fps/manifests/00-010-pin-windowed-only-difference.json', import.meta.url);
const decisionLogPath = new URL('../../plan_fps/DECISION_LOG.md', import.meta.url);
const packageJsonPath = new URL('../../package.json', import.meta.url);
const readmePath = new URL('../../plan_fps/README.md', import.meta.url);
const tsconfigPath = new URL('../../tsconfig.json', import.meta.url);

const manifest = await Bun.file(manifestPath).json();
const decisionLog = await Bun.file(decisionLogPath).text();
const packageJson = await Bun.file(packageJsonPath).json();
const readme = await Bun.file(readmePath).text();
const tsconfig = await Bun.file(tsconfigPath).json();

const expectedManifest = {
  schemaVersion: 1,
  stepId: '00-010',
  stepSlug: 'pin-windowed-only-difference',
  decisionId: 'D-FPS-004',
  readmeMissionSentence:
    'Convert the existing deterministic DOOM engine work into a Bun-run, windowed, playable, side-by-side-verifiable DOOM product while preserving vanilla/reference behavior exactly except for fullscreen-vs-windowed presentation.',
  runtimePath: {
    command: 'bun run doom.ts',
    packageJson: {
      private: true,
      type: 'module',
    },
    tsconfig: {
      noEmit: true,
      types: ['bun'],
    },
  },
  windowedOnlyDifference: {
    decisionSentence: 'The only intentional presentation difference from the reference target is windowed launch instead of fullscreen launch.',
    differenceCount: 1,
    productPresentationMode: 'windowed',
    referencePresentationMode: 'fullscreen',
    scope: 'launch and presentation only',
    deterministicReplayCompatible: true,
    parityRule: 'All other observable behavior remains parity-critical until proven otherwise and recorded.',
  },
  parityCriticalSurfaces: ['audio-output', 'command-contract', 'config-persistence', 'deterministic-replay', 'framebuffer-content', 'input-behavior', 'save-load-behavior', 'simulation-timing'],
  evidencePaths: ['plan_fps/README.md', 'plan_fps/DECISION_LOG.md', 'package.json', 'tsconfig.json'],
  rationale:
    'The playable parity product must remain side-by-side comparable to the reference target while still launching as a Bun-run windowed application. Pinning exactly one allowed difference keeps later host and acceptance steps from drifting into non-window presentation changes that would break deterministic replay or parity claims.',
} as const;

describe('00-010 pin-windowed-only-difference manifest', () => {
  test('locks the exact manifest payload', () => {
    expect(manifest).toEqual(expectedManifest);
  });

  test('pins the README mission sentence verbatim', () => {
    expect(readme).toContain(expectedManifest.readmeMissionSentence);
  });

  test('pins the D-FPS-004 decision and rationale sentences verbatim', () => {
    expect(decisionLog).toContain('## D-FPS-004');
    expect(decisionLog).toContain(expectedManifest.windowedOnlyDifference.decisionSentence);
    expect(decisionLog).toContain(expectedManifest.windowedOnlyDifference.parityRule);
    expect(decisionLog).toContain('plan_fps/manifests/00-010-pin-windowed-only-difference.json');
  });

  test('ties the allowed difference to the Bun runtime-only workspace metadata', () => {
    expect(packageJson.private).toBe(expectedManifest.runtimePath.packageJson.private);
    expect(packageJson.type).toBe(expectedManifest.runtimePath.packageJson.type);
    expect(tsconfig.compilerOptions.noEmit).toBe(expectedManifest.runtimePath.tsconfig.noEmit);
    expect(tsconfig.compilerOptions.types).toEqual(expectedManifest.runtimePath.tsconfig.types);
  });

  test('keeps the allowed difference singular and presentation-only', () => {
    expect(expectedManifest.windowedOnlyDifference.differenceCount).toBe(1);
    expect(expectedManifest.windowedOnlyDifference.referencePresentationMode).toBe('fullscreen');
    expect(expectedManifest.windowedOnlyDifference.productPresentationMode).toBe('windowed');
    expect(expectedManifest.windowedOnlyDifference.scope).toBe('launch and presentation only');
    expect(expectedManifest.windowedOnlyDifference.deterministicReplayCompatible).toBe(true);
  });

  test('locks the parity-critical surfaces set', () => {
    expect(new Set(expectedManifest.parityCriticalSurfaces).size).toBe(expectedManifest.parityCriticalSurfaces.length);
    expect(expectedManifest.parityCriticalSurfaces).not.toContain('presentation-mode');
    expect(expectedManifest.parityCriticalSurfaces).toEqual(manifest.parityCriticalSurfaces);
  });

  test('verifies every evidence path exists on disk', async () => {
    for (const relativePath of expectedManifest.evidencePaths) {
      const evidenceFile = Bun.file(new URL(`../../${relativePath}`, import.meta.url));
      expect(await evidenceFile.exists()).toBe(true);
    }
  });
});
