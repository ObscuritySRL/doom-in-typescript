import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { KEY_F11 } from '../../../src/input/keyboard.ts';
import { IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT, implementScreenSizeDetailGammaControls } from '../../../src/playable/front-end-menus/implementScreenSizeDetailGammaControls.ts';
import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { KEY_ENTER, KEY_RIGHTARROW, MenuKind, createMenuState, openMenu } from '../../../src/ui/menus.ts';

const AUDIT_MANIFEST_PATH = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);
const SOURCE_PATH = new URL('../../../src/playable/front-end-menus/implementScreenSizeDetailGammaControls.ts', import.meta.url);
const EXPECTED_SOURCE_HASH = '91ce0fcbbf0e85cff036b96cde7a8017b25d5456d0e88a350291522295b197e7';

describe('implementScreenSizeDetailGammaControls', () => {
  test('locks the exact Bun-only contract', () => {
    expect(IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT).toEqual({
      auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
      currentMenu: MenuKind.Options,
      detailItemIndex: 2,
      functionName: 'implementScreenSizeDetailGammaControls',
      gammaHotkey: 'KEY_F11',
      gammaRange: {
        maximum: 4,
        minimum: 0,
        wraps: true,
      },
      runtimeCommand: 'bun run doom.ts',
      screenSizeItemIndex: 3,
      screenSizeRange: {
        maximum: 8,
        minimum: 0,
      },
      supportedMenuActionKinds: ['adjustScreenSize', 'toggleDetail'],
    });
  });

  test('locks the source hash', async () => {
    const sourceText = await Bun.file(SOURCE_PATH).text();
    const sourceHash = createHash('sha256').update(sourceText).digest('hex');

    expect(sourceHash).toBe(EXPECTED_SOURCE_HASH);
  });

  test('links back to the 01-008 launch-to-menu audit manifest', async () => {
    const auditManifest = JSON.parse(await Bun.file(AUDIT_MANIFEST_PATH).text()) as {
      readonly audit: { readonly stepId: string };
      readonly currentLauncher: { readonly launchMode: string; readonly menuStartImplemented: boolean };
      readonly explicitNullSurfaces: readonly { readonly surface: string }[];
    };

    expect(IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.auditManifestPath).toBe('plan_fps/manifests/01-008-audit-missing-launch-to-menu.json');
    expect(auditManifest.audit.stepId).toBe('01-008');
    expect(auditManifest.currentLauncher.launchMode).toBe('gameplay-first');
    expect(auditManifest.currentLauncher.menuStartImplemented).toBe(false);
    expect(auditManifest.explicitNullSurfaces.some(({ surface }) => surface === 'launch-to-menu-transition')).toBe(true);
  });

  test('applies screen-size adjustments through the Options menu and preserves demo playback state', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();

    openMenu(menu, MenuKind.Options);
    menu.itemOn = IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.screenSizeItemIndex;
    frontEndSequence.inDemoPlayback = true;

    const result = implementScreenSizeDetailGammaControls({
      detailMode: 'high',
      frontEndSequence,
      gammaLevel: 1,
      key: KEY_RIGHTARROW,
      menu,
      runtimeCommand: IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.runtimeCommand,
      screenSize: 5,
    });

    expect(result).toEqual({
      action: { direction: 1, kind: 'adjustScreenSize' },
      detailMode: 'high',
      gammaLevel: 1,
      screenSize: 6,
    });
    expect(menu.itemOn).toBe(IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.screenSizeItemIndex);
    expect(frontEndSequence.inDemoPlayback).toBe(true);
    expect(frontEndSequence.menuActive).toBe(true);
  });

  test('toggles detail with the vanilla-style Options-menu right-arrow path', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();

    openMenu(menu, MenuKind.Options);
    menu.itemOn = IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.detailItemIndex;
    frontEndSequence.inDemoPlayback = true;

    const result = implementScreenSizeDetailGammaControls({
      detailMode: 'high',
      frontEndSequence,
      gammaLevel: 2,
      key: KEY_RIGHTARROW,
      menu,
      runtimeCommand: IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.runtimeCommand,
      screenSize: 5,
    });

    expect(result).toEqual({
      action: { kind: 'toggleDetail' },
      detailMode: 'low',
      gammaLevel: 2,
      screenSize: 5,
    });
    expect(menu.itemOn).toBe(IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.detailItemIndex);
    expect(frontEndSequence.inDemoPlayback).toBe(true);
    expect(frontEndSequence.menuActive).toBe(true);
  });

  test('cycles gamma correction on F11 and wraps after the highest level', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();

    openMenu(menu, MenuKind.Options);
    menu.itemOn = IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.detailItemIndex;

    const result = implementScreenSizeDetailGammaControls({
      detailMode: 'low',
      frontEndSequence,
      gammaLevel: 4,
      key: KEY_F11,
      menu,
      runtimeCommand: IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.runtimeCommand,
      screenSize: 6,
    });

    expect(result).toEqual({
      action: { kind: 'adjustGamma', nextGammaLevel: 0, previousGammaLevel: 4 },
      detailMode: 'low',
      gammaLevel: 0,
      screenSize: 6,
    });
    expect(menu.itemOn).toBe(IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.detailItemIndex);
    expect(frontEndSequence.menuActive).toBe(true);
  });

  test('rejects the wrong runtime command', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();

    openMenu(menu, MenuKind.Options);
    menu.itemOn = IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.screenSizeItemIndex;

    expect(() =>
      implementScreenSizeDetailGammaControls({
        detailMode: 'high',
        frontEndSequence,
        gammaLevel: 0,
        key: KEY_RIGHTARROW,
        menu,
        runtimeCommand: 'bun run src/main.ts',
        screenSize: 5,
      }),
    ).toThrow('implementScreenSizeDetailGammaControls requires "bun run doom.ts".');
  });

  test('rejects the unimplemented Messages toggle path', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();

    openMenu(menu, MenuKind.Options);
    menu.itemOn = 1;

    expect(() =>
      implementScreenSizeDetailGammaControls({
        detailMode: 'high',
        frontEndSequence,
        gammaLevel: 0,
        key: KEY_ENTER,
        menu,
        runtimeCommand: IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.runtimeCommand,
        screenSize: 5,
      }),
    ).toThrow('Messages toggle is not implemented by implementScreenSizeDetailGammaControls.');
  });
});
