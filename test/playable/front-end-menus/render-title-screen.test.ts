import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { SKULL_ANIM_TIME } from '../../../src/ui/menus.ts';
import { MenuKind } from '../../../src/ui/menus.ts';
import { RENDER_TITLE_SCREEN_CONTRACT, renderTitleScreen } from '../../../src/playable/front-end-menus/renderTitleScreen.ts';

const EXPECTED_CONTRACT = Object.freeze({
  auditStepId: '01-008',
  auditSurface: 'launch-to-menu-transition',
  firstVisibleActionKind: 'showPage',
  firstVisibleLumpName: 'TITLEPIC',
  requiredRuntimeCommand: 'bun run doom.ts',
  transition: 'clean-launch-to-title-screen',
} as const);

const EXPECTED_CONTRACT_HASH = 'ccf38b2a382708b47dc5348804d32ef5434589ef16b4f98f5387bb262a4cf48a';

interface AuditManifest {
  readonly audit: {
    readonly stepId: string;
  };
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly value: string;
    };
  };
  readonly currentLauncher: {
    readonly menuStartImplemented: boolean;
  };
  readonly explicitNullSurfaces: readonly {
    readonly reason: string;
    readonly surface: string;
  }[];
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.audit !== 'object' || record.audit === null) {
    return false;
  }
  if (typeof record.commandContracts !== 'object' || record.commandContracts === null) {
    return false;
  }
  if (typeof record.currentLauncher !== 'object' || record.currentLauncher === null) {
    return false;
  }
  if (!Array.isArray(record.explicitNullSurfaces)) {
    return false;
  }

  const audit = record.audit as Record<string, unknown>;
  const commandContracts = record.commandContracts as Record<string, unknown>;
  const currentLauncher = record.currentLauncher as Record<string, unknown>;
  const targetRuntime = commandContracts.targetRuntime;

  return (
    typeof audit.stepId === 'string' &&
    typeof targetRuntime === 'object' &&
    targetRuntime !== null &&
    typeof (targetRuntime as Record<string, unknown>).value === 'string' &&
    typeof currentLauncher.menuStartImplemented === 'boolean' &&
    record.explicitNullSurfaces.every(
      (surface): surface is AuditManifest['explicitNullSurfaces'][number] =>
        typeof surface === 'object' && surface !== null && typeof (surface as Record<string, unknown>).reason === 'string' && typeof (surface as Record<string, unknown>).surface === 'string',
    )
  );
}

describe('renderTitleScreen', () => {
  test('locks the exact contract object and hash', () => {
    expect(RENDER_TITLE_SCREEN_CONTRACT).toEqual(EXPECTED_CONTRACT);
    expect(hashValue(RENDER_TITLE_SCREEN_CONTRACT)).toBe(EXPECTED_CONTRACT_HASH);
  });

  test('renders the clean-launch shareware title screen deterministically', () => {
    expect(
      renderTitleScreen({
        gameMode: 'shareware',
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      contract: EXPECTED_CONTRACT,
      frontEnd: {
        gameMode: 'shareware',
        inDemoPlayback: false,
        menuActive: false,
      },
      menu: {
        active: false,
        currentMenu: MenuKind.Main,
        itemOn: 0,
        skullAnimCounter: SKULL_ANIM_TIME,
        whichSkull: 0,
      },
      titlePage: {
        kind: 'showPage',
        lumpName: 'TITLEPIC',
        musicLump: 'D_INTRO',
        pagetic: 170,
      },
      transition: 'clean-launch-to-title-screen',
    });
  });

  test('stays aligned with the 01-008 launch-to-menu audit gap', async () => {
    const manifestJson = JSON.parse(await Bun.file('plan_fps/manifests/01-008-audit-missing-launch-to-menu.json').text());
    expect(isAuditManifest(manifestJson)).toBe(true);
    if (!isAuditManifest(manifestJson)) {
      throw new Error('Expected a valid 01-008 audit manifest');
    }

    expect(manifestJson.audit.stepId).toBe(RENDER_TITLE_SCREEN_CONTRACT.auditStepId);
    expect(manifestJson.commandContracts.targetRuntime.value).toBe(RENDER_TITLE_SCREEN_CONTRACT.requiredRuntimeCommand);
    expect(manifestJson.currentLauncher.menuStartImplemented).toBe(false);
    expect(manifestJson.explicitNullSurfaces.some((surface) => surface.surface === RENDER_TITLE_SCREEN_CONTRACT.auditSurface && surface.reason.includes('title/menu startup route'))).toBe(true);
  });

  test('rejects non-bun runtime commands', () => {
    expect(() =>
      renderTitleScreen({
        gameMode: 'shareware',
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('renderTitleScreen requires bun run doom.ts');
  });
});
