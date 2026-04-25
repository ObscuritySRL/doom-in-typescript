import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';

import { DEFINE_ASPECT_CORRECTION_POLICY_CONTRACT, defineAspectCorrectionPolicy } from '../../../src/playable/window-host/defineAspectCorrectionPolicy.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-006-audit-playable-host-surface.json';
const CONTRACT_SHA256 = 'f26fe6691b1396a9b58844107e96b79796326361bdf40a9dd80a631e53557558';
const EXPECTED_CONTRACT = {
  correctedDisplay: {
    aspectRatio: 4 / 3,
    height: 240,
    stretchRatio: 6 / 5,
    width: 320,
  },
  deterministicReplayCompatibility: {
    createsWindow: false,
    mutatesFramebuffer: false,
    mutatesGameState: false,
    mutatesRandomSeed: false,
    readsInputEvents: false,
  },
  presentation: {
    backgroundFill: 'black',
    defaultClientHeightAtScaleTwo: 480,
    defaultClientWidthAtScaleTwo: 640,
    defaultPresentationRectAtScaleTwo: {
      height: 480,
      width: 640,
      x: 0,
      y: 0,
    },
    defaultScale: 2,
    maintainCorrectedAspectRatio: true,
    preserveIntegerSourceFramebuffer: true,
  },
  runtime: {
    currentLauncherCommand: 'bun run src/main.ts',
    currentLauncherHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
    requiredRuntimeCommand: 'bun run doom.ts',
  },
  sourceFramebuffer: {
    height: 200,
    width: 320,
  },
  stepId: '04-005',
  stepTitle: 'define-aspect-correction-policy',
} as const;
const REQUIRED_RUNTIME_COMMAND = 'bun run doom.ts';
const WIN32_SOURCE_PATH = 'src/launcher/win32.ts';
const WINDOW_POLICY_SOURCE_PATH = 'src/host/windowPolicy.ts';

type AuditPlayableHostSurfaceManifest = {
  readonly commandContracts: {
    readonly currentLauncherCommand: string;
    readonly targetRuntimeCommand: string;
  };
  readonly currentLauncherHostTransition: {
    readonly call: string;
    readonly defaultScale: number;
  };
  readonly stepId: string;
  readonly stepTitle: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAuditPlayableHostSurfaceManifest(value: unknown): value is AuditPlayableHostSurfaceManifest {
  if (!isRecord(value)) {
    return false;
  }

  const commandContracts = value.commandContracts;
  const currentLauncherHostTransition = value.currentLauncherHostTransition;

  if (!isRecord(commandContracts) || !isRecord(currentLauncherHostTransition)) {
    return false;
  }

  return (
    typeof commandContracts.currentLauncherCommand === 'string' &&
    typeof commandContracts.targetRuntimeCommand === 'string' &&
    typeof currentLauncherHostTransition.call === 'string' &&
    typeof currentLauncherHostTransition.defaultScale === 'number' &&
    typeof value.stepId === 'string' &&
    typeof value.stepTitle === 'string'
  );
}

async function loadAuditPlayableHostSurfaceManifest(): Promise<AuditPlayableHostSurfaceManifest> {
  const auditManifestText = await Bun.file(AUDIT_MANIFEST_PATH).text();
  const parsedAuditManifest = JSON.parse(auditManifestText) as unknown;

  if (!isAuditPlayableHostSurfaceManifest(parsedAuditManifest)) {
    throw new TypeError(`Invalid audit manifest at ${AUDIT_MANIFEST_PATH}`);
  }

  return parsedAuditManifest;
}

describe('defineAspectCorrectionPolicy', () => {
  it('locks the exact aspect correction policy contract', () => {
    expect(DEFINE_ASPECT_CORRECTION_POLICY_CONTRACT).toEqual(EXPECTED_CONTRACT);
  });

  it('returns the frozen contract for the Bun runtime command', () => {
    const aspectCorrectionPolicy = defineAspectCorrectionPolicy(REQUIRED_RUNTIME_COMMAND);

    expect(aspectCorrectionPolicy).toBe(DEFINE_ASPECT_CORRECTION_POLICY_CONTRACT);
    expect(Object.isFrozen(aspectCorrectionPolicy)).toBe(true);
    expect(Object.isFrozen(aspectCorrectionPolicy.correctedDisplay)).toBe(true);
    expect(Object.isFrozen(aspectCorrectionPolicy.deterministicReplayCompatibility)).toBe(true);
    expect(Object.isFrozen(aspectCorrectionPolicy.presentation)).toBe(true);
    expect(Object.isFrozen(aspectCorrectionPolicy.presentation.defaultPresentationRectAtScaleTwo)).toBe(true);
    expect(Object.isFrozen(aspectCorrectionPolicy.runtime)).toBe(true);
    expect(Object.isFrozen(aspectCorrectionPolicy.sourceFramebuffer)).toBe(true);
  });

  it('locks a stable SHA-256 hash for the contract', () => {
    const contractHash = createHash('sha256').update(JSON.stringify(DEFINE_ASPECT_CORRECTION_POLICY_CONTRACT)).digest('hex');

    expect(contractHash).toBe(CONTRACT_SHA256);
  });

  it('cross-checks the audited 01-006 launcher transition and command contract', async () => {
    const auditPlayableHostSurfaceManifest = await loadAuditPlayableHostSurfaceManifest();

    expect(auditPlayableHostSurfaceManifest.stepId).toBe('01-006');
    expect(auditPlayableHostSurfaceManifest.stepTitle).toBe('audit-playable-host-surface');
    expect(auditPlayableHostSurfaceManifest.commandContracts.currentLauncherCommand).toBe(DEFINE_ASPECT_CORRECTION_POLICY_CONTRACT.runtime.currentLauncherCommand);
    expect(auditPlayableHostSurfaceManifest.currentLauncherHostTransition.call).toBe(DEFINE_ASPECT_CORRECTION_POLICY_CONTRACT.runtime.currentLauncherHostTransition);
    expect(auditPlayableHostSurfaceManifest.commandContracts.targetRuntimeCommand).toBe(DEFINE_ASPECT_CORRECTION_POLICY_CONTRACT.runtime.requiredRuntimeCommand);
    expect(auditPlayableHostSurfaceManifest.currentLauncherHostTransition.defaultScale).toBe(DEFINE_ASPECT_CORRECTION_POLICY_CONTRACT.presentation.defaultScale);
  });

  it('locks live source evidence for corrected client sizing and presentation', async () => {
    const win32Source = await Bun.file(WIN32_SOURCE_PATH).text();
    const windowPolicySource = await Bun.file(WINDOW_POLICY_SOURCE_PATH).text();

    expect(win32Source).toContain('computeClientDimensions(options.scale, true)');
    expect(win32Source).toContain('computePresentationRect(clientWidth, clientHeight, true)');
    expect(windowPolicySource).toContain('export const ASPECT_CORRECTED_HEIGHT = 240;');
    expect(windowPolicySource).toContain('export const DISPLAY_ASPECT_RATIO = 4 / 3;');
    expect(windowPolicySource).toContain('export const ASPECT_STRETCH_RATIO = 6 / 5;');
  });

  it('rejects commands outside the Bun runtime path', () => {
    expect(() => defineAspectCorrectionPolicy('bun run src/main.ts')).toThrow('Aspect correction policy requires bun run doom.ts');
    expect(() => defineAspectCorrectionPolicy('')).toThrow('Aspect correction policy requires bun run doom.ts');
    expect(() => defineAspectCorrectionPolicy(' bun run doom.ts ')).toThrow('Aspect correction policy requires bun run doom.ts');
    expect(() => defineAspectCorrectionPolicy('bun run doom.ts --debug')).toThrow('Aspect correction policy requires bun run doom.ts');
  });
});
