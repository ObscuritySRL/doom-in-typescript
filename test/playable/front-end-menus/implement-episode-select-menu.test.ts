import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { IMPLEMENT_EPISODE_SELECT_MENU_CONTRACT, implementEpisodeSelectMenu } from '../../../src/playable/front-end-menus/implementEpisodeSelectMenu.ts';
import { createFrontEndSequence, setMenuActive } from '../../../src/ui/frontEndSequence.ts';
import { KEY_ENTER, MenuKind, createMenuState, openMenu } from '../../../src/ui/menus.ts';

const AUDIT_MANIFEST_URL = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);
const SOURCE_FILE_URL = new URL('../../../src/playable/front-end-menus/implementEpisodeSelectMenu.ts', import.meta.url);

const EXPECTED_CONTRACT = {
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  expectedCurrentMenu: MenuKind.Episode,
  nextMenu: MenuKind.Skill,
  runtimeCommand: 'bun run doom.ts',
  stepId: '07-006',
  triggerKeyCode: KEY_ENTER,
} as const;

const EXPECTED_SOURCE_HASH = 'bc8b39c4acdbbda8e7f6520a1f3564e825d518e1d5a0c20467e3dc4adca3ea88';

function createEpisodeSelectionContext(itemOn = 0) {
  const frontEndSequence = createFrontEndSequence('shareware');
  const menu = createMenuState();

  openMenu(menu, MenuKind.Episode);
  menu.itemOn = itemOn;
  setMenuActive(frontEndSequence, menu.active);

  return { frontEndSequence, menu };
}

describe('implementEpisodeSelectMenu', () => {
  test('exports the exact Bun runtime contract', () => {
    expect(IMPLEMENT_EPISODE_SELECT_MENU_CONTRACT).toEqual(EXPECTED_CONTRACT);
  });

  test('locks the source hash', async () => {
    const source = await Bun.file(SOURCE_FILE_URL).text();
    const sourceHash = createHash('sha256').update(source).digest('hex');

    expect(sourceHash).toBe(EXPECTED_SOURCE_HASH);
  });

  test('links to the 01-008 audit manifest and launch gap', async () => {
    const auditManifest = JSON.parse(await Bun.file(AUDIT_MANIFEST_URL).text()) as {
      audit: { stepId: string };
      commandContracts: { targetRuntime: { value: string } };
      explicitNullSurfaces: Array<{ reason: string; surface: string }>;
    };

    expect(auditManifest.audit.stepId).toBe('01-008');
    expect(auditManifest.commandContracts.targetRuntime.value).toBe(EXPECTED_CONTRACT.runtimeCommand);
    expect(
      auditManifest.explicitNullSurfaces.some((explicitNullSurface) => explicitNullSurface.surface === 'launch-to-menu-transition' && explicitNullSurface.reason === 'No allowed file exposes a title/menu startup route before gameplay.'),
    ).toBe(true);
  });

  test('transitions from the episode menu to the skill menu and preserves demo playback state', () => {
    const { frontEndSequence, menu } = createEpisodeSelectionContext(2);
    frontEndSequence.inDemoPlayback = true;

    const result = implementEpisodeSelectMenu({
      command: 'bun run doom.ts',
      frontEndSequence,
      menu,
    });

    expect(result).toEqual({
      demoPlaybackWasActive: true,
      frontEndMenuActive: true,
      menuAction: { kind: 'selectEpisode', episode: 3 },
      nextMenu: MenuKind.Skill,
      selectedEpisode: 3,
    });
    expect(frontEndSequence.inDemoPlayback).toBe(true);
    expect(frontEndSequence.menuActive).toBe(true);
    expect(menu.active).toBe(true);
    expect(menu.currentMenu).toBe(MenuKind.Skill);
    expect(menu.itemOn).toBe(2);
  });

  test('rejects the wrong runtime command', () => {
    const { frontEndSequence, menu } = createEpisodeSelectionContext(0);

    expect(() =>
      implementEpisodeSelectMenu({
        command: 'bun run src/main.ts',
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementEpisodeSelectMenu requires bun run doom.ts; received bun run src/main.ts');
  });

  test('rejects an invalid episode selection state', () => {
    const { frontEndSequence, menu } = createEpisodeSelectionContext(0);
    menu.itemOn = 99;

    expect(() =>
      implementEpisodeSelectMenu({
        command: 'bun run doom.ts',
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementEpisodeSelectMenu requires an episode selection; received none');
  });
});
