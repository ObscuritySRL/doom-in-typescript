import { describe, expect, test } from 'bun:test';

import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { MENU_TREE, MenuKind, createMenuState, openMenu } from '../../../src/ui/menus.ts';
import { IMPLEMENT_SKILL_SELECT_MENU_CONTRACT, implementSkillSelectMenu } from '../../../src/playable/front-end-menus/implementSkillSelectMenu.ts';

const EXPECTED_CONTRACT = {
  activationKey: 13,
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  deterministicReplayCompatible: true,
  expectedMenu: MenuKind.Skill,
  runtimeCommand: 'bun run doom.ts',
} as const;

const MODULE_URL = new URL('../../../src/playable/front-end-menus/implementSkillSelectMenu.ts', import.meta.url);
const AUDIT_MANIFEST_URL = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);
const EXPECTED_SOURCE_HASH = 'c88915897938af29b14badb859e8f35e89176939fafe797ccbb7f23436979b89';
const NIGHTMARE_MESSAGE = "are you sure? this skill level\nisn't even remotely fair.";

interface LaunchAuditManifest {
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly value: string;
    };
  };
  readonly explicitNullSurfaces: ReadonlyArray<{
    readonly surface: string;
  }>;
}

function createSkillSelectionContext() {
  const frontEndSequence = createFrontEndSequence('shareware');
  const menu = createMenuState();
  openMenu(menu, MenuKind.Skill);

  return { frontEndSequence, menu };
}

async function sha256Hex(url: URL): Promise<string> {
  const sourceText = await Bun.file(url).text();
  const digestBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceText));
  return Array.from(new Uint8Array(digestBuffer), (value) => value.toString(16).padStart(2, '0')).join('');
}

describe('implementSkillSelectMenu', () => {
  test('exports the exact runtime contract', () => {
    expect(IMPLEMENT_SKILL_SELECT_MENU_CONTRACT).toEqual(EXPECTED_CONTRACT);
    expect(Object.isFrozen(IMPLEMENT_SKILL_SELECT_MENU_CONTRACT)).toBe(true);
  });

  test('locks the source hash', async () => {
    expect(await sha256Hex(MODULE_URL)).toBe(EXPECTED_SOURCE_HASH);
  });

  test('links the launch-to-menu audit to the bun runtime contract', async () => {
    const launchAudit = (await Bun.file(AUDIT_MANIFEST_URL).json()) as LaunchAuditManifest;

    expect(launchAudit.commandContracts.targetRuntime.value).toBe(IMPLEMENT_SKILL_SELECT_MENU_CONTRACT.runtimeCommand);
    expect(launchAudit.explicitNullSurfaces.map((surface) => surface.surface)).toContain('launch-to-menu-transition');
  });

  test('routes the active skill selection and preserves demo playback state', () => {
    const { frontEndSequence, menu } = createSkillSelectionContext();
    frontEndSequence.inDemoPlayback = true;
    menu.itemOn = 2;

    const result = implementSkillSelectMenu({
      command: IMPLEMENT_SKILL_SELECT_MENU_CONTRACT.runtimeCommand,
      frontEndSequence,
      menu,
    });

    expect(result.action).toEqual({ kind: 'selectSkill', skill: 2 });
    expect(result.currentMenu).toBe(MenuKind.Skill);
    expect(result.inDemoPlayback).toBe(true);
    expect(result.menuActive).toBe(true);
    expect(result.messageActive).toBe(false);
    expect(result.messageNeedsYesNo).toBe(false);
    expect(result.messagePendingAction).toBeNull();
    expect(result.messageString).toBeNull();
  });

  test('opens the nightmare confirmation without breaking menu synchronization', () => {
    const { frontEndSequence, menu } = createSkillSelectionContext();
    menu.itemOn = MENU_TREE[MenuKind.Skill].items.length - 1;

    const result = implementSkillSelectMenu({
      command: IMPLEMENT_SKILL_SELECT_MENU_CONTRACT.runtimeCommand,
      frontEndSequence,
      menu,
    });

    expect(result.action).toEqual({
      kind: 'openMessage',
      text: NIGHTMARE_MESSAGE,
      needsYesNo: true,
      onConfirm: { kind: 'selectSkill', skill: 4 },
    });
    expect(result.menuActive).toBe(true);
    expect(result.messageActive).toBe(true);
    expect(result.messageNeedsYesNo).toBe(true);
    expect(result.messagePendingAction).toEqual({ kind: 'selectSkill', skill: 4 });
    expect(result.messageString).toBe(NIGHTMARE_MESSAGE);
  });

  test('rejects the wrong runtime command', () => {
    const { frontEndSequence, menu } = createSkillSelectionContext();

    expect(() =>
      implementSkillSelectMenu({
        command: 'bun run src/main.ts',
        frontEndSequence,
        menu,
      }),
    ).toThrow('Expected bun run doom.ts.');
  });

  test('rejects an out-of-range skill selection index', () => {
    const { frontEndSequence, menu } = createSkillSelectionContext();
    menu.itemOn = MENU_TREE[MenuKind.Skill].items.length;

    expect(() =>
      implementSkillSelectMenu({
        command: IMPLEMENT_SKILL_SELECT_MENU_CONTRACT.runtimeCommand,
        frontEndSequence,
        menu,
      }),
    ).toThrow('Skill selection index is out of range.');
  });
});
