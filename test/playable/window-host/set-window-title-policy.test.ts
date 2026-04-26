import { expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { computeClientDimensions } from '../../../src/host/windowPolicy.ts';
import { setWindowTitlePolicy, WINDOW_TITLE_POLICY_CONTRACT } from '../../../src/playable/window-host/setWindowTitlePolicy.ts';

interface AuditPlayableHostManifest {
  readonly commandContracts: {
    readonly currentLauncherCommand: string;
    readonly targetRuntimeCommand: string;
  };
  readonly currentLauncherHostTransition: {
    readonly call: string;
    readonly titleTemplate: string;
  };
}

const LOCKED_CONTRACT_SHA256 = 'e199457706cabad986ccdba9a41f47d0bae7e74f97c7e6e364bb591ee16710bf';

function createContractHash(): string {
  return createHash('sha256').update(JSON.stringify(WINDOW_TITLE_POLICY_CONTRACT)).digest('hex');
}

async function readAuditPlayableHostManifest(): Promise<AuditPlayableHostManifest> {
  return JSON.parse(await Bun.file('plan_fps/manifests/01-006-audit-playable-host-surface.json').text()) as AuditPlayableHostManifest;
}

test('WINDOW_TITLE_POLICY_CONTRACT matches the locked policy object and hash', () => {
  expect(WINDOW_TITLE_POLICY_CONTRACT).toEqual({
    currentLauncherCommand: 'bun run src/main.ts',
    currentLauncherTransition: {
      defaultAspectRatioCorrect: true,
      defaultClientSize: {
        height: 480,
        width: 640,
      },
      defaultScale: 2,
      sourceCall: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      sourcePath: 'src/launcher/win32.ts',
      titleTemplate: 'DOOM Codex - ${session.mapName}',
    },
    deterministicReplayCompatibility: {
      consumesReplayInput: false,
      createsNativeWindow: false,
      mutatesGameState: false,
      mutatesRandomSeed: false,
    },
    stepId: '04-002',
    stepTitle: 'set-window-title-policy',
    targetRuntimeCommand: 'bun run doom.ts',
    titlePolicy: {
      mapNameSource: 'gameContext.mapName',
      prefix: 'DOOM Codex - ',
      rejectsBlankMapName: true,
      windowPolicySourcePath: 'src/host/windowPolicy.ts',
    },
  });
  expect(createContractHash()).toBe(LOCKED_CONTRACT_SHA256);
});

test('the contract matches the audited launcher transition and live source evidence', async () => {
  const auditPlayableHostManifest = await readAuditPlayableHostManifest();
  const launcherSource = await Bun.file('src/launcher/win32.ts').text();

  expect(auditPlayableHostManifest.commandContracts.currentLauncherCommand).toBe(WINDOW_TITLE_POLICY_CONTRACT.currentLauncherCommand);
  expect(auditPlayableHostManifest.commandContracts.targetRuntimeCommand).toBe(WINDOW_TITLE_POLICY_CONTRACT.targetRuntimeCommand);
  expect(auditPlayableHostManifest.currentLauncherHostTransition.call).toBe(WINDOW_TITLE_POLICY_CONTRACT.currentLauncherTransition.sourceCall);
  expect(auditPlayableHostManifest.currentLauncherHostTransition.titleTemplate).toBe(WINDOW_TITLE_POLICY_CONTRACT.currentLauncherTransition.titleTemplate);
  expect(launcherSource).toContain('readonly title: string;');
  expect(launcherSource).toContain("const windowTitle = Buffer.from(`${options.title}\\0`, 'utf16le');");
});

test('the contract default client size matches the shared window policy', async () => {
  const windowPolicySource = await Bun.file('src/host/windowPolicy.ts').text();

  expect(WINDOW_TITLE_POLICY_CONTRACT.currentLauncherTransition.defaultClientSize).toEqual(
    computeClientDimensions(WINDOW_TITLE_POLICY_CONTRACT.currentLauncherTransition.defaultScale, WINDOW_TITLE_POLICY_CONTRACT.currentLauncherTransition.defaultAspectRatioCorrect),
  );
  expect(windowPolicySource).toContain('export function computeClientDimensions');
});

test('setWindowTitlePolicy returns the Bun runtime window title', () => {
  expect(
    setWindowTitlePolicy({
      command: 'bun run doom.ts',
      mapName: 'E1M1',
    }),
  ).toEqual({
    title: 'DOOM Codex - E1M1',
    titleTemplate: 'DOOM Codex - ${session.mapName}',
  });
});

test('setWindowTitlePolicy rejects non-playable commands and blank map names', () => {
  expect(() =>
    setWindowTitlePolicy({
      command: 'bun run src/main.ts',
      mapName: 'E1M1',
    }),
  ).toThrow('Window title policy requires bun run doom.ts');

  expect(() =>
    setWindowTitlePolicy({
      command: 'bun run doom.ts',
      mapName: '   ',
    }),
  ).toThrow('Window title policy requires a non-empty map name');
});

test('setWindowTitlePolicy rejects an empty-string map name and an empty-string command', () => {
  expect(() =>
    setWindowTitlePolicy({
      command: 'bun run doom.ts',
      mapName: '',
    }),
  ).toThrow('Window title policy requires a non-empty map name');

  expect(() =>
    setWindowTitlePolicy({
      command: '',
      mapName: 'E1M1',
    }),
  ).toThrow('Window title policy requires bun run doom.ts');
});

test('setWindowTitlePolicy returns a frozen result so callers cannot mutate the title plan', () => {
  const result = setWindowTitlePolicy({
    command: 'bun run doom.ts',
    mapName: 'E1M1',
  });

  expect(Object.isFrozen(result)).toBe(true);
});

test('locks runtime-frozen invariants on the contract and every nested object', () => {
  expect(Object.isFrozen(WINDOW_TITLE_POLICY_CONTRACT)).toBe(true);
  expect(Object.isFrozen(WINDOW_TITLE_POLICY_CONTRACT.currentLauncherTransition)).toBe(true);
  expect(Object.isFrozen(WINDOW_TITLE_POLICY_CONTRACT.currentLauncherTransition.defaultClientSize)).toBe(true);
  expect(Object.isFrozen(WINDOW_TITLE_POLICY_CONTRACT.deterministicReplayCompatibility)).toBe(true);
  expect(Object.isFrozen(WINDOW_TITLE_POLICY_CONTRACT.titlePolicy)).toBe(true);
});
