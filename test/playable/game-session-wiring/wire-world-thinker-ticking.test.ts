import { describe, expect, test } from 'bun:test';

import type { PreLoopCallbacks } from '../../../src/mainLoop.ts';

import { createLauncherSession, loadLauncherResources } from '../../../src/launcher/session.ts';
import { MainLoop } from '../../../src/mainLoop.ts';
import { WIRE_WORLD_THINKER_TICKING_RUNTIME_CONTRACT, wireWorldThinkerTicking } from '../../../src/playable/game-session-wiring/wireWorldThinkerTicking.ts';

interface AuditManifest {
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly command: string;
      readonly entryFile: string;
      readonly implementedInReadScope: boolean;
    };
  };
  readonly schemaVersion: number;
  readonly stepId: string;
}

const SOURCE_PATH = 'src/playable/game-session-wiring/wireWorldThinkerTicking.ts';
const SOURCE_SHA256 = 'f2906ba1cec10ab832d764b2f207fb97a9c7fc15eb2bffa3405f257deb43b1aa';

const NOOP_PRE_LOOP_CALLBACKS: PreLoopCallbacks = Object.freeze({
  executeSetViewSize() {},
  initialTryRunTics() {},
  restoreBuffer() {},
  startGameLoop() {},
});

describe('wireWorldThinkerTicking', () => {
  test('locks the Bun runtime command contract', () => {
    expect(WIRE_WORLD_THINKER_TICKING_RUNTIME_CONTRACT).toEqual({
      auditStepId: '01-009',
      command: 'bun run doom.ts',
      entryFile: 'doom.ts',
      manifestPath: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
      schemaVersion: 1,
      targetRuntimeImplementedInReadScope: false,
    });
  });

  test('matches the audited menu-to-E1M1 manifest contract', async () => {
    const manifest = await readAuditManifest();

    expect(manifest.schemaVersion).toBe(WIRE_WORLD_THINKER_TICKING_RUNTIME_CONTRACT.schemaVersion);
    expect(manifest.stepId).toBe(WIRE_WORLD_THINKER_TICKING_RUNTIME_CONTRACT.auditStepId);
    expect(manifest.commandContracts.targetRuntime.command).toBe(WIRE_WORLD_THINKER_TICKING_RUNTIME_CONTRACT.command);
    expect(manifest.commandContracts.targetRuntime.entryFile).toBe(WIRE_WORLD_THINKER_TICKING_RUNTIME_CONTRACT.entryFile);
    expect(manifest.commandContracts.targetRuntime.implementedInReadScope).toBe(WIRE_WORLD_THINKER_TICKING_RUNTIME_CONTRACT.targetRuntimeImplementedInReadScope);
  });

  test('locks the implementation source hash', async () => {
    expect(await hashSourceFile(SOURCE_PATH)).toBe(SOURCE_SHA256);
  });

  test('advances one world thinker tic during tryRunTics', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const session = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });
    const mainLoop = new MainLoop();

    mainLoop.setup(NOOP_PRE_LOOP_CALLBACKS);

    const result = wireWorldThinkerTicking({
      command: WIRE_WORLD_THINKER_TICKING_RUNTIME_CONTRACT.command,
      mainLoop,
      session,
    });

    expect(result).toEqual({
      command: 'bun run doom.ts',
      frameCountAfter: 1,
      frameCountBefore: 0,
      levelTimeAfter: 1,
      levelTimeBefore: 0,
      playerThinkerStillLinked: true,
      thinkerCountAfter: result.thinkerCountBefore,
      thinkerCountBefore: result.thinkerCountBefore,
      tickedDuringPhase: 'tryRunTics',
    });
    expect(result.thinkerCountBefore).toBeGreaterThan(0);
  });

  test('rejects non-target runtime commands before ticking the world', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const session = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });
    const mainLoop = new MainLoop();

    mainLoop.setup(NOOP_PRE_LOOP_CALLBACKS);

    expect(() =>
      wireWorldThinkerTicking({
        command: 'bun run src/main.ts',
        mainLoop,
        session,
      }),
    ).toThrow('wireWorldThinkerTicking requires bun run doom.ts, got bun run src/main.ts');
    expect(mainLoop.frameCount).toBe(0);
    expect(session.levelTime).toBe(0);
  });
});

async function hashSourceFile(sourcePath: string): Promise<string> {
  const sourceText = await Bun.file(sourcePath).text();
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(sourceText);

  return hasher.digest('hex');
}

async function readAuditManifest(): Promise<AuditManifest> {
  const manifestText = await Bun.file(WIRE_WORLD_THINKER_TICKING_RUNTIME_CONTRACT.manifestPath).text();
  const manifest: unknown = JSON.parse(manifestText);

  if (!isAuditManifest(manifest)) {
    throw new Error('01-009 audit manifest did not match the expected test schema');
  }

  return manifest;
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (!isRecord(value)) {
    return false;
  }

  const commandContracts = value.commandContracts;

  if (!isRecord(commandContracts)) {
    return false;
  }

  const targetRuntime = commandContracts.targetRuntime;

  return (
    isRecord(targetRuntime) &&
    typeof value.schemaVersion === 'number' &&
    typeof value.stepId === 'string' &&
    typeof targetRuntime.command === 'string' &&
    typeof targetRuntime.entryFile === 'string' &&
    typeof targetRuntime.implementedInReadScope === 'boolean'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
