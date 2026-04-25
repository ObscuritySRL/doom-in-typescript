import { describe, expect, test } from 'bun:test';

import { createLauncherSession, loadLauncherResources } from '../../../src/launcher/session.ts';
import { WIRE_AUTOMAP_TOGGLE_RENDER_PATH_COMMAND_CONTRACT, wireAutomapToggleRenderPath } from '../../../src/playable/game-session-wiring/wireAutomapToggleRenderPath.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json';
const SOURCE_PATH = 'src/playable/game-session-wiring/wireAutomapToggleRenderPath.ts';
const SOURCE_SHA256 = 'e09cbd0314e3fa8b318b5d55169e31ca1d926d9452d32b278ccc5321f7c424c1';

interface AuditManifest {
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly command: string;
      readonly entryFile: string;
      readonly implementedInReadScope: boolean;
    };
  };
  readonly currentLauncherSurface: {
    readonly observedSurfaces: readonly {
      readonly evidence: string;
      readonly path: string;
      readonly surfaceId: string;
    }[];
  };
  readonly schemaVersion: number;
  readonly stepId: string;
}

describe('wireAutomapToggleRenderPath', () => {
  test('locks the Bun command contract and audit manifest linkage', async () => {
    const manifest = JSON.parse(await Bun.file(AUDIT_MANIFEST_PATH).text()) as AuditManifest;

    expect(WIRE_AUTOMAP_TOGGLE_RENDER_PATH_COMMAND_CONTRACT).toEqual({
      command: 'bun run doom.ts',
      entryFile: 'doom.ts',
      program: 'bun',
      subcommand: 'run',
    });
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.stepId).toBe('01-009');
    expect(manifest.commandContracts.targetRuntime).toEqual({
      command: WIRE_AUTOMAP_TOGGLE_RENDER_PATH_COMMAND_CONTRACT.command,
      entryFile: WIRE_AUTOMAP_TOGGLE_RENDER_PATH_COMMAND_CONTRACT.entryFile,
      implementedInReadScope: false,
    });
    expect(manifest.currentLauncherSurface.observedSurfaces).toContainEqual({
      evidence: 'Tab: toggle gameplay view and automap',
      path: 'src/main.ts',
      surfaceId: 'tab-automap-toggle',
    });
  });

  test('locks the implementation source hash', async () => {
    expect(await sha256(SOURCE_PATH)).toBe(SOURCE_SHA256);
  });

  test('toggles automap during game tics and renders automap during display', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const session = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });

    const evidence = wireAutomapToggleRenderPath({
      command: WIRE_AUTOMAP_TOGGLE_RENDER_PATH_COMMAND_CONTRACT.command,
      session,
    });

    expect(evidence.preLoopTrace).toEqual(['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop']);
    expect(evidence.phaseTrace).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
    expect(evidence.beforeShowAutomap).toBe(false);
    expect(evidence.showAutomapAfterTryRunTics).toBe(true);
    expect(evidence.showAutomapDuringDisplay).toBe(true);
    expect(evidence.afterShowAutomap).toBe(true);
    expect(evidence.renderedMode).toBe('automap');
    expect(evidence.renderedFramebufferByteLength).toBe(64_000);
    expect(evidence.renderedFramebufferIsSessionFramebuffer).toBe(true);
    expect(evidence.levelTime).toBe(1);
    expect(evidence.frameCount).toBe(1);
  });

  test('rejects the old package start command before replay state mutation', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const session = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });

    expect(() =>
      wireAutomapToggleRenderPath({
        command: 'bun run src/main.ts',
        session,
      }),
    ).toThrow('Expected command bun run doom.ts, got bun run src/main.ts.');
    expect(session.showAutomap).toBe(false);
    expect(session.levelTime).toBe(0);
  });
});

async function sha256(path: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await Bun.file(path).arrayBuffer());

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
