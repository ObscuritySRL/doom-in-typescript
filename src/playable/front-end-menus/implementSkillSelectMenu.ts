import { setMenuActive } from '../../ui/frontEndSequence.ts';
import { KEY_ENTER, MENU_TREE, MenuKind, handleMenuKey } from '../../ui/menus.ts';
import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';

const RUNTIME_COMMAND = 'bun run doom.ts';

export const IMPLEMENT_SKILL_SELECT_MENU_CONTRACT = Object.freeze({
  activationKey: KEY_ENTER,
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  deterministicReplayCompatible: true,
  expectedMenu: MenuKind.Skill,
  runtimeCommand: RUNTIME_COMMAND,
} as const);

export interface ImplementSkillSelectMenuOptions {
  readonly command: string;
  readonly frontEndSequence: FrontEndSequenceState;
  readonly menu: MenuState;
}

export interface ImplementSkillSelectMenuResult {
  readonly action: MenuAction;
  readonly currentMenu: MenuKind.Skill;
  readonly inDemoPlayback: boolean;
  readonly menuActive: boolean;
  readonly messageActive: boolean;
  readonly messageNeedsYesNo: boolean;
  readonly messagePendingAction: MenuAction | null;
  readonly messageString: string | null;
}

function assertRuntimeCommand(command: string): void {
  if (command !== RUNTIME_COMMAND) {
    throw new Error(`Expected ${RUNTIME_COMMAND}.`);
  }
}

function assertSkillMenu(menu: MenuState): void {
  if (!menu.active || menu.currentMenu !== MenuKind.Skill) {
    throw new Error('Skill menu must be active.');
  }

  const skillMenuItems = MENU_TREE[MenuKind.Skill].items;
  if (menu.itemOn < 0 || menu.itemOn >= skillMenuItems.length) {
    throw new Error('Skill selection index is out of range.');
  }
}

/**
 * Route the current Skill-menu selection through the playable Bun runtime path.
 *
 * @param options Skill-menu routing dependencies and the active runtime command.
 * @returns A frozen snapshot of the emitted menu action and replay-relevant front-end state.
 * @example
 * ```ts
 * import { createFrontEndSequence } from "../../ui/frontEndSequence.ts";
 * import { createMenuState, MenuKind, openMenu } from "../../ui/menus.ts";
 *
 * const frontEndSequence = createFrontEndSequence("shareware");
 * const menu = createMenuState();
 * openMenu(menu, MenuKind.Skill);
 *
 * const result = implementSkillSelectMenu({
 *   command: "bun run doom.ts",
 *   frontEndSequence,
 *   menu,
 * });
 *
 * console.log(result.action.kind); // "selectSkill"
 * ```
 */
export function implementSkillSelectMenu(options: ImplementSkillSelectMenuOptions): ImplementSkillSelectMenuResult {
  assertRuntimeCommand(options.command);
  assertSkillMenu(options.menu);

  const action = handleMenuKey(options.menu, IMPLEMENT_SKILL_SELECT_MENU_CONTRACT.activationKey);
  setMenuActive(options.frontEndSequence, options.menu.active);

  return Object.freeze({
    action,
    currentMenu: MenuKind.Skill,
    inDemoPlayback: options.frontEndSequence.inDemoPlayback,
    menuActive: options.frontEndSequence.menuActive,
    messageActive: options.menu.messageActive,
    messageNeedsYesNo: options.menu.messageNeedsYesNo,
    messagePendingAction: options.menu.messagePendingAction,
    messageString: options.menu.messageString,
  });
}
