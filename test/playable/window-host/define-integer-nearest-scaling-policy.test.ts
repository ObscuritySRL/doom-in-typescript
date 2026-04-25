import { describe, expect, test } from 'bun:test';

import { ASPECT_CORRECTED_HEIGHT, SCREENHEIGHT, SCREENWIDTH, computeClientDimensions } from '../../../src/host/windowPolicy.ts';
import { DEFINE_INTEGER_NEAREST_SCALING_POLICY_CONTRACT, defineIntegerNearestScalingPolicy } from '../../../src/playable/window-host/defineIntegerNearestScalingPolicy.ts';

const AUDIT_MANIFEST_URL = new URL('../../../plan_fps/manifests/01-006-audit-playable-host-surface.json', import.meta.url);
const WIN32_SOURCE_URL = new URL('../../../src/launcher/win32.ts', import.meta.url);

const EXPECTED_CONTRACT = Object.freeze({
  auditedCurrentLauncherCommand: 'bun run src/main.ts',
  auditedLauncherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  defaultClientDimensions: Object.freeze({
    height: 480,
    width: 640,
  }),
  defaultScale: 2,
  deterministicReplayCompatibility: Object.freeze({
    consumesReplayInput: false,
    createsWindowHost: false,
    mutatesFramebuffer: false,
    mutatesGameState: false,
  }),
  displayDimensions: Object.freeze({
    height: 240,
    width: 320,
  }),
  filter: 'nearest',
  framebufferDimensions: Object.freeze({
    height: 200,
    width: 320,
  }),
  hostEvidence: Object.freeze({
    presentationHelper: 'computePresentationRect(clientWidth, clientHeight, true)',
    presentationSymbol: 'StretchDIBits',
  }),
  minimumScale: 1,
  presentationMode: 'centered-integer-scale',
  runtimeCommand: 'bun run doom.ts',
  scaleMode: 'integer-only',
  stepId: '04-006',
  stepTitle: 'define-integer-nearest-scaling-policy',
});

const EXPECTED_CONTRACT_HASH = '8424f540f3b50e964686846707372cfa5d1ccaa2bad9fb1a6bfca7825015f555';

interface AuditManifest {
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
}

describe('defineIntegerNearestScalingPolicy', () => {
  test('locks the exact contract and its stable hash', () => {
    expect(DEFINE_INTEGER_NEAREST_SCALING_POLICY_CONTRACT).toEqual(EXPECTED_CONTRACT);
    expect(hashValue(DEFINE_INTEGER_NEAREST_SCALING_POLICY_CONTRACT)).toBe(EXPECTED_CONTRACT_HASH);
  });

  test('cross-checks the 01-006 audit manifest and shared window policy evidence', async () => {
    const manifest = await readAuditManifest();

    expect(manifest.stepId).toBe('01-006');
    expect(manifest.stepTitle).toBe('audit-playable-host-surface');
    expect(manifest.commandContracts.currentLauncherCommand).toBe(EXPECTED_CONTRACT.auditedCurrentLauncherCommand);
    expect(manifest.commandContracts.targetRuntimeCommand).toBe(EXPECTED_CONTRACT.runtimeCommand);
    expect(manifest.currentLauncherHostTransition.call).toBe(EXPECTED_CONTRACT.auditedLauncherTransition);
    expect(manifest.currentLauncherHostTransition.defaultScale).toBe(EXPECTED_CONTRACT.defaultScale);
    expect(computeClientDimensions(EXPECTED_CONTRACT.defaultScale, true)).toEqual(EXPECTED_CONTRACT.defaultClientDimensions);
    expect(ASPECT_CORRECTED_HEIGHT).toBe(EXPECTED_CONTRACT.displayDimensions.height);
    expect(SCREENHEIGHT).toBe(EXPECTED_CONTRACT.framebufferDimensions.height);
    expect(SCREENWIDTH).toBe(EXPECTED_CONTRACT.displayDimensions.width);
    expect(SCREENWIDTH).toBe(EXPECTED_CONTRACT.framebufferDimensions.width);
  });

  test('locks live win32 presentation evidence', async () => {
    const win32Source = await Bun.file(WIN32_SOURCE_URL).text();

    expect(win32Source).toContain(EXPECTED_CONTRACT.hostEvidence.presentationHelper);
    expect(win32Source).toContain(EXPECTED_CONTRACT.hostEvidence.presentationSymbol);
  });

  test('returns a nearest integer scaling plan for the Bun runtime command', () => {
    expect(
      defineIntegerNearestScalingPolicy({
        aspectRatioCorrect: true,
        clientHeight: 720,
        clientWidth: 960,
        command: EXPECTED_CONTRACT.runtimeCommand,
      }),
    ).toEqual({
      aspectRatioCorrect: true,
      clientHeight: 720,
      clientWidth: 960,
      filter: 'nearest',
      fitsWithinClient: true,
      presentationMode: 'centered-integer-scale',
      scaleMode: 'integer-only',
      scaleMultiplier: 3,
      scaledHeight: 720,
      scaledWidth: 960,
    });
  });

  test('retains the minimum integer scale even when the client is narrower than the framebuffer', () => {
    expect(
      defineIntegerNearestScalingPolicy({
        aspectRatioCorrect: true,
        clientHeight: 240,
        clientWidth: 300,
        command: EXPECTED_CONTRACT.runtimeCommand,
      }),
    ).toEqual({
      aspectRatioCorrect: true,
      clientHeight: 240,
      clientWidth: 300,
      filter: 'nearest',
      fitsWithinClient: false,
      presentationMode: 'centered-integer-scale',
      scaleMode: 'integer-only',
      scaleMultiplier: 1,
      scaledHeight: 240,
      scaledWidth: 320,
    });
  });

  test('rejects non-Bun runtime commands', () => {
    expect(() =>
      defineIntegerNearestScalingPolicy({
        aspectRatioCorrect: true,
        clientHeight: 480,
        clientWidth: 640,
        command: 'bun run src/main.ts',
      }),
    ).toThrow('defineIntegerNearestScalingPolicy requires bun run doom.ts; received bun run src/main.ts');
  });
});

async function readAuditManifest(): Promise<AuditManifest> {
  const manifest = await Bun.file(AUDIT_MANIFEST_URL).json();

  if (!isAuditManifest(manifest)) {
    throw new TypeError('01-006 audit manifest shape changed');
  }

  return manifest;
}

function hashValue(value: unknown): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(JSON.stringify(value));

  return hasher.digest('hex');
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (!isRecord(value)) {
    return false;
  }

  const commandContracts = value.commandContracts;
  const currentLauncherHostTransition = value.currentLauncherHostTransition;

  return (
    typeof value.stepId === 'string' &&
    typeof value.stepTitle === 'string' &&
    isRecord(commandContracts) &&
    typeof commandContracts.currentLauncherCommand === 'string' &&
    typeof commandContracts.targetRuntimeCommand === 'string' &&
    isRecord(currentLauncherHostTransition) &&
    typeof currentLauncherHostTransition.call === 'string' &&
    typeof currentLauncherHostTransition.defaultScale === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
