import { beforeAll, describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import type { LauncherResources } from '../../../src/launcher/session.ts';

import { createLauncherSession, loadLauncherResources } from '../../../src/launcher/session.ts';
import { MainLoop } from '../../../src/mainLoop.ts';
import { WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT, wireGameplayRendererInvocation } from '../../../src/playable/game-session-wiring/wireGameplayRendererInvocation.ts';

const EXPECTED_FRAMEBUFFER_HASH = '285f60701552bbe313ef485cef9fc39d51bb3f74238fe333d83e630ebcba73c5';
const EXPECTED_SOURCE_HASH = '180c2190d01afcfba425d2728c11de956ceb8149b518416296717741b7ab24cb';
const SOURCE_PATH = 'src/playable/game-session-wiring/wireGameplayRendererInvocation.ts';

interface AuditManifest {
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly command: string;
      readonly entryFile: string;
    };
  };
  readonly currentLauncherSurface: {
    readonly defaults: {
      readonly mapName: string;
      readonly scale: number;
      readonly skill: number;
    };
  };
  readonly explicitNullSurfaces: readonly {
    readonly surfaceId: string;
  }[];
  readonly schemaVersion: number;
  readonly stepId: string;
}

let launcherResources: LauncherResources | null = null;

beforeAll(async () => {
  launcherResources = await loadLauncherResources('doom/DOOM1.WAD');
});

describe('wireGameplayRendererInvocation', () => {
  test('locks the Bun runtime contract and audit manifest linkage', async () => {
    expect(WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT).toEqual({
      command: 'bun run doom.ts',
      entryFile: 'doom.ts',
      rendererPhase: 'display',
      sourceAuditPath: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
      sourceAuditStepId: '01-009',
    });

    const manifestValue: unknown = await Bun.file(WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT.sourceAuditPath).json();

    expect(isAuditManifest(manifestValue)).toBe(true);

    if (!isAuditManifest(manifestValue)) {
      throw new Error('01-009 audit manifest shape changed');
    }

    expect(manifestValue.schemaVersion).toBe(1);
    expect(manifestValue.stepId).toBe(WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT.sourceAuditStepId);
    expect(manifestValue.commandContracts.targetRuntime.command).toBe(WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT.command);
    expect(manifestValue.commandContracts.targetRuntime.entryFile).toBe(WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT.entryFile);
    expect(manifestValue.currentLauncherSurface.defaults).toEqual({
      mapName: 'E1M1',
      scale: 2,
      skill: 2,
    });
    expect(manifestValue.explicitNullSurfaces.map((surface) => surface.surfaceId)).toContain('menu-to-e1m1-transition');
  });

  test('locks the formatted implementation source hash', async () => {
    expect(await sha256File(SOURCE_PATH)).toBe(EXPECTED_SOURCE_HASH);
  });

  test('invokes gameplay rendering only during the display phase', () => {
    const mainLoop = new MainLoop();
    const session = createLauncherSession(getLauncherResources(), { mapName: 'E1M1', skill: 2 });
    const result = wireGameplayRendererInvocation({
      command: WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT.command,
      mainLoop,
      session,
    });

    expect(result.preLoopTrace).toEqual(['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop']);
    expect(result.phaseTrace).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
    expect(result.renderPhase).toBe('display');
    expect(result.frameCountBefore).toBe(0);
    expect(result.frameCountAfter).toBe(1);
    expect(result.levelTimeBefore).toBe(0);
    expect(result.levelTimeBeforeRender).toBe(1);
    expect(result.levelTimeAfterRender).toBe(1);
    expect(result.levelTimeAfter).toBe(1);
    expect(result.renderedGameplay).toBe(true);
    expect(result.reusedFramebuffer).toBe(true);
    expect(result.showAutomap).toBe(false);
    expect(sha256(result.framebuffer)).toBe(EXPECTED_FRAMEBUFFER_HASH);
    expect(session.player.mo?.x).toBe(69206016);
    expect(session.player.mo?.y).toBe(-236978176);
    expect(session.player.mo?.angle).toBe(1073741824);
  });

  test('reuses an already-started loop without replaying pre-loop setup', () => {
    const mainLoop = new MainLoop();
    const session = createLauncherSession(getLauncherResources(), { mapName: 'E1M1', skill: 2 });

    mainLoop.setup({
      executeSetViewSize() {},
      initialTryRunTics() {},
      restoreBuffer() {},
      startGameLoop() {},
    });

    const result = wireGameplayRendererInvocation({
      command: WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT.command,
      mainLoop,
      session,
    });

    expect(result.preLoopTrace).toEqual([]);
    expect(result.phaseTrace).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
    expect(result.frameCountBefore).toBe(0);
    expect(result.frameCountAfter).toBe(1);
    expect(result.levelTimeBeforeRender).toBe(1);
    expect(result.levelTimeAfterRender).toBe(1);
  });

  test('rejects non-target launch commands before rendering', () => {
    const session = createLauncherSession(getLauncherResources(), { mapName: 'E1M1', skill: 2 });

    expect(() =>
      wireGameplayRendererInvocation({
        command: 'bun run src/main.ts',
        session,
      }),
    ).toThrow('wire gameplay renderer invocation requires bun run doom.ts');

    expect(session.levelTime).toBe(0);
  });

  test('rejects automap rendering before later render-path wiring', () => {
    const session = createLauncherSession(getLauncherResources(), { mapName: 'E1M1', skill: 2 });

    session.showAutomap = true;

    expect(() =>
      wireGameplayRendererInvocation({
        command: WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT.command,
        session,
      }),
    ).toThrow('wire gameplay renderer invocation requires gameplay view');

    expect(session.levelTime).toBe(0);
  });
});

function getLauncherResources(): LauncherResources {
  if (launcherResources === null) {
    throw new Error('launcher resources were not loaded');
  }

  return launcherResources;
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (!isRecord(value)) {
    return false;
  }

  const commandContracts = value.commandContracts;
  const currentLauncherSurface = value.currentLauncherSurface;

  if (!isRecord(commandContracts) || !isRecord(currentLauncherSurface)) {
    return false;
  }

  const targetRuntime = commandContracts.targetRuntime;
  const defaults = currentLauncherSurface.defaults;

  return (
    value.schemaVersion === 1 &&
    value.stepId === '01-009' &&
    isRecord(targetRuntime) &&
    targetRuntime.command === 'bun run doom.ts' &&
    targetRuntime.entryFile === 'doom.ts' &&
    isRecord(defaults) &&
    typeof defaults.mapName === 'string' &&
    typeof defaults.scale === 'number' &&
    typeof defaults.skill === 'number' &&
    Array.isArray(value.explicitNullSurfaces) &&
    value.explicitNullSurfaces.every((surface) => isRecord(surface) && typeof surface.surfaceId === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function sha256File(path: string): Promise<string> {
  return sha256(Buffer.from(await Bun.file(path).arrayBuffer()));
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
