import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import { setMenuActive } from '../../ui/frontEndSequence.ts';
import { LINEHEIGHT, MENU_TREE, SKULLXOFF, type MenuState } from '../../ui/menus.ts';

export interface RenderSkullCursorRuntimeContract {
  readonly audit: {
    readonly schemaVersion: 1;
    readonly stepId: '07-017';
    readonly title: 'render-skull-cursor';
  };
  readonly auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json';
  readonly targetRuntime: {
    readonly entryFile: 'doom.ts';
    readonly program: 'bun';
    readonly subcommand: 'run';
    readonly value: 'bun run doom.ts';
  };
}

export const RENDER_SKULL_CURSOR_RUNTIME_CONTRACT = Object.freeze({
  audit: Object.freeze({
    schemaVersion: 1,
    stepId: '07-017',
    title: 'render-skull-cursor',
  }),
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  targetRuntime: Object.freeze({
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    value: 'bun run doom.ts',
  }),
}) satisfies RenderSkullCursorRuntimeContract;

export interface RenderSkullCursorOptions {
  readonly frontEndSequenceState: FrontEndSequenceState;
  readonly menuState: MenuState;
  readonly runtimeCommand: string;
}

export interface RenderedSkullCursor {
  readonly demoPlaybackActive: boolean;
  readonly itemOn: number;
  readonly lumpName: 'M_SKULL1' | 'M_SKULL2';
  readonly menuActive: true;
  readonly menuKind: MenuState['currentMenu'];
  readonly x: number;
  readonly y: number;
}

function assertSupportedRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== RENDER_SKULL_CURSOR_RUNTIME_CONTRACT.targetRuntime.value) {
    throw new Error('renderSkullCursor requires the bun run doom.ts runtime command.');
  }
}

export function renderSkullCursor(options: RenderSkullCursorOptions): RenderedSkullCursor {
  assertSupportedRuntimeCommand(options.runtimeCommand);

  if (!options.menuState.active) {
    throw new Error('renderSkullCursor requires an active menu state.');
  }

  const menuDefinition = MENU_TREE[options.menuState.currentMenu];
  const currentItem = menuDefinition.items[options.menuState.itemOn];

  if (currentItem === undefined) {
    throw new Error('renderSkullCursor requires an in-range menu cursor position.');
  }

  setMenuActive(options.frontEndSequenceState, options.menuState.active);

  return Object.freeze({
    demoPlaybackActive: options.frontEndSequenceState.inDemoPlayback,
    itemOn: options.menuState.itemOn,
    lumpName: options.menuState.whichSkull === 0 ? 'M_SKULL1' : 'M_SKULL2',
    menuActive: true,
    menuKind: options.menuState.currentMenu,
    x: menuDefinition.x + SKULLXOFF,
    y: menuDefinition.y + options.menuState.itemOn * LINEHEIGHT,
  });
}
