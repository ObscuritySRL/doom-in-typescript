import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { createMenuState, MenuKind, openMenu } from '../../../src/ui/menus.ts';
import { IMPLEMENT_MAIN_MENU_CONTRACT, implementMainMenu } from '../../../src/playable/front-end-menus/implementMainMenu.ts';

const IMPLEMENT_MAIN_MENU_SOURCE_URL = new URL('../../../src/playable/front-end-menus/implementMainMenu.ts', import.meta.url);
const LAUNCH_AUDIT_MANIFEST_URL = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);

const EXPECTED_CONTRACT = {
  entryFile: 'doom.ts',
  feature: 'implement-main-menu',
  menuKind: MenuKind.Main,
  preservesDeterministicReplay: true,
  runtime: 'bun',
  runtimeCommand: 'bun run doom.ts',
  subcommand: 'run',
  syncsFrontEndMenuActive: true,
} as const satisfies typeof IMPLEMENT_MAIN_MENU_CONTRACT;

const EXPECTED_SOURCE_HASH = '6d335972daaa982159ba255a9408716673e4b1f880905b3d6006b32c8290c343';

interface LaunchAuditManifest {
  readonly audit: {
    readonly stepId: string;
    readonly title: string;
  };
  readonly explicitNullSurfaces: ReadonlyArray<{
    readonly reason: string;
    readonly surface: string;
  }>;
}

function isLaunchAuditManifest(value: unknown): value is LaunchAuditManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    audit?: {
      stepId?: unknown;
      title?: unknown;
    };
    explicitNullSurfaces?: Array<{
      reason?: unknown;
      surface?: unknown;
    }>;
  };

  if (typeof candidate.audit?.stepId !== 'string' || typeof candidate.audit?.title !== 'string') {
    return false;
  }

  if (!Array.isArray(candidate.explicitNullSurfaces)) {
    return false;
  }

  return candidate.explicitNullSurfaces.every((entry) => typeof entry.reason === 'string' && typeof entry.surface === 'string');
}

async function loadLaunchAuditManifest(): Promise<LaunchAuditManifest> {
  const rawManifest = JSON.parse(await Bun.file(LAUNCH_AUDIT_MANIFEST_URL).text());

  if (!isLaunchAuditManifest(rawManifest)) {
    throw new Error('01-008 launch audit manifest has an unexpected shape');
  }

  return rawManifest;
}

describe('implementMainMenu', () => {
  test('exports the exact Bun runtime contract', () => {
    expect(IMPLEMENT_MAIN_MENU_CONTRACT).toEqual(EXPECTED_CONTRACT);
  });

  test('locks the source hash', async () => {
    const sourceText = await Bun.file(IMPLEMENT_MAIN_MENU_SOURCE_URL).text();
    const sourceHash = createHash('sha256').update(sourceText).digest('hex');

    expect(sourceHash).toBe(EXPECTED_SOURCE_HASH);
  });

  test('links back to the launch-to-menu audit gap', async () => {
    const auditManifest = await loadLaunchAuditManifest();

    expect(auditManifest.audit.stepId).toBe('01-008');
    expect(auditManifest.audit.title).toBe('audit-missing-launch-to-menu');
    expect(auditManifest.explicitNullSurfaces.some((entry) => entry.surface === 'first-visible-main-menu-state' && entry.reason === 'No allowed file exposes a main-menu state as the first visible runtime state.')).toBe(true);
    expect(auditManifest.explicitNullSurfaces.some((entry) => entry.surface === 'menu-render-controller' && entry.reason === 'No allowed file exposes a menu renderer or menu controller for clean launch.')).toBe(true);
  });

  test('opens the main menu from a clean-launch front-end state', () => {
    const frontEnd = createFrontEndSequence('shareware');
    const menu = createMenuState();

    openMenu(menu, MenuKind.Options);
    menu.itemOn = 3;

    const result = implementMainMenu({
      frontEnd,
      menu,
      runtimeCommand: 'bun run doom.ts',
    });

    expect(result).toEqual({
      itemCount: 6,
      itemOn: 0,
      kind: 'mainMenuReady',
      menuActive: true,
      menuKind: MenuKind.Main,
      menuLumpNames: ['M_NGAME', 'M_OPTION', 'M_LOADG', 'M_SAVEG', 'M_RDTHIS', 'M_QUITG'],
      preservesDeterministicReplay: true,
    });
    expect(menu.active).toBe(true);
    expect(menu.currentMenu).toBe(MenuKind.Main);
    expect(frontEnd.menuActive).toBe(true);
    expect(frontEnd.inDemoPlayback).toBe(false);
  });

  test('keeps demo playback state intact while opening the main menu', () => {
    const frontEnd = createFrontEndSequence('registered');
    const menu = createMenuState();

    frontEnd.inDemoPlayback = true;

    const result = implementMainMenu({
      frontEnd,
      menu,
      runtimeCommand: 'bun run doom.ts',
    });

    expect(result.menuKind).toBe(MenuKind.Main);
    expect(result.menuActive).toBe(true);
    expect(frontEnd.inDemoPlayback).toBe(true);
    expect(frontEnd.menuActive).toBe(true);
    expect(menu.itemOn).toBe(0);
  });

  test('rejects non-Bun runtime commands', () => {
    const frontEnd = createFrontEndSequence('shareware');
    const menu = createMenuState();

    expect(() =>
      implementMainMenu({
        frontEnd,
        menu,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('implementMainMenu requires bun run doom.ts');
  });
});
