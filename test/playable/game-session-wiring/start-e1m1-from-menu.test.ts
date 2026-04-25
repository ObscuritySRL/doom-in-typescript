import { beforeAll, describe, expect, test } from 'bun:test';

import { join, resolve } from 'node:path';

import { loadLauncherResources } from '../../../src/launcher/session.ts';
import { START_E1M1_FROM_MENU_RUNTIME, startE1m1FromMenu } from '../../../src/playable/game-session-wiring/startE1m1FromMenu.ts';

const REPOSITORY_ROOT = resolve(import.meta.dir, '..', '..', '..');
const AUDIT_MANIFEST_PATH = join(REPOSITORY_ROOT, 'plan_fps', 'manifests', '01-009-audit-missing-menu-to-e1m1.json');
const DOOM1_WAD_PATH = join(REPOSITORY_ROOT, 'doom', 'DOOM1.WAD');
const SOURCE_FILE_PATH = join(REPOSITORY_ROOT, 'src', 'playable', 'game-session-wiring', 'startE1m1FromMenu.ts');
const SOURCE_SHA256 = 'dd291e823897e9d41191595b68730dbdb3e366af00d40469543e0629dce428d7';

interface AuditNullSurface {
  readonly surfaceId: string;
}

interface AuditManifest {
  readonly explicitNullSurfaces: readonly AuditNullSurface[];
  readonly schemaVersion: number;
  readonly stepId: string;
}

let resources: Awaited<ReturnType<typeof loadLauncherResources>>;

beforeAll(async () => {
  resources = await loadLauncherResources(DOOM1_WAD_PATH);
});

describe('startE1m1FromMenu', () => {
  test('locks the Bun runtime contract and source hash', async () => {
    expect(START_E1M1_FROM_MENU_RUNTIME).toEqual({
      command: 'bun run doom.ts',
      entryFile: 'doom.ts',
      expectedEpisode: 1,
      expectedMapName: 'E1M1',
      transitionRoute: ['main:new-game', 'episode:e1', 'skill-select'],
    });

    const sourceText = await Bun.file(SOURCE_FILE_PATH).text();

    expect(hashText(sourceText)).toBe(SOURCE_SHA256);
  });

  test('keeps the 01-009 audit manifest linked to the missing menu-to-e1m1 route', async () => {
    const auditManifestData: unknown = await Bun.file(AUDIT_MANIFEST_PATH).json();

    if (!isAuditManifest(auditManifestData)) {
      throw new Error('01-009 audit manifest shape changed');
    }

    expect(auditManifestData.schemaVersion).toBe(1);
    expect(auditManifestData.stepId).toBe('01-009');
    expect(auditManifestData.explicitNullSurfaces.map(({ surfaceId }) => surfaceId)).toEqual([
      'e1m1-start-menu-command',
      'episode-menu-route',
      'menu-controller-surface',
      'menu-render-surface',
      'menu-to-e1m1-transition',
      'root-doom-entrypoint-menu-path',
      'skill-menu-route',
    ]);
  });

  test('creates an unopened main loop and an E1M1 launcher session from the exact menu route', () => {
    const startResult = startE1m1FromMenu(resources, {
      command: START_E1M1_FROM_MENU_RUNTIME.command,
      selectedEpisode: START_E1M1_FROM_MENU_RUNTIME.expectedEpisode,
      selectedSkill: 4,
      transitionRoute: [...START_E1M1_FROM_MENU_RUNTIME.transitionRoute],
    });

    expect(startResult.command).toBe(START_E1M1_FROM_MENU_RUNTIME.command);
    expect(startResult.mainLoop.frameCount).toBe(0);
    expect(startResult.mainLoop.started).toBe(false);
    expect(startResult.mapName).toBe('E1M1');
    expect(startResult.selectedSkill).toBe(4);
    expect(startResult.transitionRoute).toBe(START_E1M1_FROM_MENU_RUNTIME.transitionRoute);
    expect(startResult.launcherSession.levelTime).toBe(0);
    expect(startResult.launcherSession.mapName).toBe('E1M1');
    expect(startResult.launcherSession.player.mo).not.toBeNull();
  });

  test('rejects non-Bun runtime commands', () => {
    expect(() =>
      startE1m1FromMenu(resources, {
        command: 'bun run src/main.ts',
        selectedEpisode: START_E1M1_FROM_MENU_RUNTIME.expectedEpisode,
        selectedSkill: 3,
        transitionRoute: [...START_E1M1_FROM_MENU_RUNTIME.transitionRoute],
      }),
    ).toThrow('startE1m1FromMenu requires bun run doom.ts, got bun run src/main.ts');
  });

  test('rejects menu transitions that do not target episode one', () => {
    expect(() =>
      startE1m1FromMenu(resources, {
        command: START_E1M1_FROM_MENU_RUNTIME.command,
        selectedEpisode: 2,
        selectedSkill: 3,
        transitionRoute: [...START_E1M1_FROM_MENU_RUNTIME.transitionRoute],
      }),
    ).toThrow('startE1m1FromMenu requires episode 1, got 2');
  });

  test('rejects menu transitions that skip the exact New Game route', () => {
    expect(() =>
      startE1m1FromMenu(resources, {
        command: START_E1M1_FROM_MENU_RUNTIME.command,
        selectedEpisode: START_E1M1_FROM_MENU_RUNTIME.expectedEpisode,
        selectedSkill: 3,
        transitionRoute: ['main:new-game', 'episode:e1', 'skill-confirm'],
      }),
    ).toThrow('startE1m1FromMenu requires transition route main:new-game -> episode:e1 -> skill-select');
  });
});

function hashText(sourceText: string): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(sourceText);

  return hasher.digest('hex');
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.schemaVersion !== 'number' || typeof value.stepId !== 'string' || !Array.isArray(value.explicitNullSurfaces)) {
    return false;
  }

  return value.explicitNullSurfaces.every((surface) => isRecord(surface) && typeof surface.surfaceId === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
