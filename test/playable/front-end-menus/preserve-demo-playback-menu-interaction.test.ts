import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT, preserveDemoPlaybackMenuInteraction } from '../../../src/playable/front-end-menus/preserveDemoPlaybackMenuInteraction.ts';
import { FRONTEND_KEY_HELP, FRONTEND_KEY_MENU, createFrontEndSequence, setMenuActive, tickFrontEnd } from '../../../src/ui/frontEndSequence.ts';
import { MENU_ACTION_NONE, MenuKind, createMenuState, openMenu } from '../../../src/ui/menus.ts';

interface AuditManifest {
  readonly audit: {
    readonly stepId: string;
  };
  readonly explicitNullSurfaces: readonly ExplicitNullSurface[];
}

interface ExplicitNullSurface {
  readonly reason: string;
  readonly surface: string;
}

const AUDIT_MANIFEST_URL = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);
const SOURCE_FILE_URL = new URL('../../../src/playable/front-end-menus/preserveDemoPlaybackMenuInteraction.ts', import.meta.url);

const EXPECTED_CONTRACT = {
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  auditSurface: 'menu-render-controller',
  command: 'bun run doom.ts',
  deterministicReplaySafe: true,
  runtime: {
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
  stepId: '07-003',
  title: 'preserve-demo-playback-menu-interaction',
} as const satisfies typeof PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT;

const SOURCE_HASH = createHash('sha256')
  .update(await Bun.file(SOURCE_FILE_URL).text())
  .digest('hex');

function isAuditManifest(value: unknown): value is AuditManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (!('audit' in value) || !('explicitNullSurfaces' in value)) {
    return false;
  }

  const { audit, explicitNullSurfaces } = value;

  if (typeof audit !== 'object' || audit === null) {
    return false;
  }

  if (!('stepId' in audit) || typeof audit.stepId !== 'string') {
    return false;
  }

  if (!Array.isArray(explicitNullSurfaces)) {
    return false;
  }

  return explicitNullSurfaces.every((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return false;
    }

    return 'reason' in entry && typeof entry.reason === 'string' && 'surface' in entry && typeof entry.surface === 'string';
  });
}

function createDemoPlaybackContext(gameMode: Parameters<typeof createFrontEndSequence>[0] = 'shareware') {
  const frontEndState = createFrontEndSequence(gameMode);
  const firstVisibleState = tickFrontEnd(frontEndState);
  const menuState = createMenuState();

  expect(firstVisibleState.kind).toBe('showPage');
  expect(frontEndState.titleLoop.advancedemo).toBe(false);

  frontEndState.inDemoPlayback = true;

  return { frontEndState, menuState };
}

const auditManifestText = await Bun.file(AUDIT_MANIFEST_URL).text();
const parsedAuditManifest = JSON.parse(auditManifestText);

if (!isAuditManifest(parsedAuditManifest)) {
  throw new Error('01-008 audit manifest has an unexpected schema');
}

const auditManifest = parsedAuditManifest;

describe('preserveDemoPlaybackMenuInteraction', () => {
  test('locks the exact Bun-only command contract', () => {
    expect(PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT).toEqual(EXPECTED_CONTRACT);
    expect(Object.isFrozen(PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT)).toBe(true);
    expect(Object.isFrozen(PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT.runtime)).toBe(true);
  });

  test('locks the source hash', () => {
    expect(SOURCE_HASH).toBe('23e59dbb4438151ec0b8f651c8647b5566c0610afb1d3be0eede348a640c998d');
  });

  test('links the wrapper to the 01-008 launch-to-menu audit surface', () => {
    expect(PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT.auditManifestPath).toContain('01-008');
    expect(auditManifest.audit.stepId).toBe('01-008');
    expect(
      auditManifest.explicitNullSurfaces.some((entry) => entry.reason === 'No allowed file exposes a menu renderer or menu controller for clean launch.' && entry.surface === PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT.auditSurface),
    ).toBe(true);
  });

  test('opens the main menu during demo playback without ending demo playback', () => {
    const { frontEndState, menuState } = createDemoPlaybackContext();

    const result = preserveDemoPlaybackMenuInteraction(PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT.command, frontEndState, menuState, FRONTEND_KEY_MENU);

    expect(result.frontEndAction).toEqual({ kind: 'openMenu' });
    expect(result.inDemoPlayback).toBe(true);
    expect(result.menuAction).toBe(MENU_ACTION_NONE);
    expect(result.menuActive).toBe(true);
    expect(result.openedMenu).toBe(MenuKind.Main);
    expect(result.route).toBe('frontEnd');
    expect(frontEndState.menuActive).toBe(true);
    expect(menuState.active).toBe(true);
    expect(menuState.currentMenu).toBe(MenuKind.Main);
  });

  test('maps the retail help action to the second Read This menu during demo playback', () => {
    const { frontEndState, menuState } = createDemoPlaybackContext('retail');

    const result = preserveDemoPlaybackMenuInteraction(PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT.command, frontEndState, menuState, FRONTEND_KEY_HELP);

    expect(result.frontEndAction).toEqual({ kind: 'openHelp', lump: 'HELP1' });
    expect(result.inDemoPlayback).toBe(true);
    expect(result.menuAction).toBe(MENU_ACTION_NONE);
    expect(result.menuActive).toBe(true);
    expect(result.openedMenu).toBe(MenuKind.ReadThis2);
    expect(result.route).toBe('frontEnd');
    expect(frontEndState.menuActive).toBe(true);
    expect(menuState.active).toBe(true);
    expect(menuState.currentMenu).toBe(MenuKind.ReadThis2);
  });

  test('routes active-overlay keys to the menu without advancing the attract loop', () => {
    const { frontEndState, menuState } = createDemoPlaybackContext();

    openMenu(menuState, MenuKind.Main);
    setMenuActive(frontEndState, true);

    const result = preserveDemoPlaybackMenuInteraction(PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT.command, frontEndState, menuState, 0x61);

    expect(result.frontEndAction).toEqual({ kind: 'none' });
    expect(result.inDemoPlayback).toBe(true);
    expect(result.menuAction).toBe(MENU_ACTION_NONE);
    expect(result.menuActive).toBe(true);
    expect(result.openedMenu).toBeNull();
    expect(result.route).toBe('menu');
    expect(frontEndState.menuActive).toBe(true);
    expect(frontEndState.titleLoop.advancedemo).toBe(false);
    expect(menuState.active).toBe(true);
    expect(menuState.currentMenu).toBe(MenuKind.Main);
  });

  test('closes the main menu during demo playback and resyncs menuActive', () => {
    const { frontEndState, menuState } = createDemoPlaybackContext();

    openMenu(menuState, MenuKind.Main);
    setMenuActive(frontEndState, true);

    const result = preserveDemoPlaybackMenuInteraction(PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT.command, frontEndState, menuState, FRONTEND_KEY_MENU);

    expect(result.frontEndAction).toEqual({ kind: 'none' });
    expect(result.inDemoPlayback).toBe(true);
    expect(result.menuAction).toEqual({ kind: 'closeMenu' });
    expect(result.menuActive).toBe(false);
    expect(result.openedMenu).toBeNull();
    expect(result.route).toBe('menu');
    expect(frontEndState.menuActive).toBe(false);
    expect(menuState.active).toBe(false);
  });

  test('rejects any runtime command other than bun run doom.ts', () => {
    const { frontEndState, menuState } = createDemoPlaybackContext();

    expect(() => preserveDemoPlaybackMenuInteraction('bun run src/main.ts', frontEndState, menuState, FRONTEND_KEY_MENU)).toThrow('preserveDemoPlaybackMenuInteraction requires bun run doom.ts, received bun run src/main.ts');
  });
});
