import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { createFrontEndSequence, TITLEPIC_PAGETIC } from '../../../src/ui/frontEndSequence.ts';
import { createMenuState, MenuKind, openMenu } from '../../../src/ui/menus.ts';
import { IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT, implementReturnToTitleFlow } from '../../../src/playable/front-end-menus/implementReturnToTitleFlow.ts';

const IMPLEMENT_RETURN_TO_TITLE_FLOW_SOURCE_PATH = new URL('../../../src/playable/front-end-menus/implementReturnToTitleFlow.ts', import.meta.url);
const LAUNCH_AUDIT_MANIFEST_PATH = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);

async function sha256(url: URL): Promise<string> {
  const contents = await Bun.file(url).text();
  return createHash('sha256').update(contents).digest('hex');
}

describe('IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT', () => {
  test('locks the exact Bun-only runtime contract, audit linkage, and source hash', async () => {
    expect(IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT).toEqual({
      audit: {
        schemaVersion: 1,
        stepId: '07-020',
        title: 'implement-return-to-title-flow',
      },
      launchAudit: {
        manifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
        missingSurface: 'launch-to-menu-transition',
        stepId: '01-008',
        title: 'audit-missing-launch-to-menu',
      },
      runtime: {
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
        value: 'bun run doom.ts',
      },
      selection: {
        confirmationText: 'are you sure you want to end the game?',
        defaultResponseKey: 13,
        itemOn: 0,
        menu: MenuKind.Options,
        resultAction: 'endGame',
      },
      titleReset: {
        initialLumpName: 'TITLEPIC',
        initialMusicLump: 'D_INTRO',
        initialTickKind: 'showPage',
        menuActive: false,
      },
    });

    const launchAuditManifest = await Bun.file(LAUNCH_AUDIT_MANIFEST_PATH).json();
    expect(launchAuditManifest.audit.stepId).toBe(IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT.launchAudit.stepId);
    expect(launchAuditManifest.audit.title).toBe(IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT.launchAudit.title);
    expect(launchAuditManifest.explicitNullSurfaces.some((explicitNullSurface: { readonly surface: string }) => explicitNullSurface.surface === IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT.launchAudit.missingSurface)).toBe(true);

    expect(await sha256(IMPLEMENT_RETURN_TO_TITLE_FLOW_SOURCE_PATH)).toBe('8da2f555cb21488e4a42b42590b3c890a52752b001424bec5423e1c466c2eb67');
  });
});

describe('implementReturnToTitleFlow', () => {
  test('routes the end-game confirmation and returns to the first visible title tick on confirm', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Options);

    const result = implementReturnToTitleFlow({
      command: 'bun run doom.ts',
      frontEndSequenceState,
      gameMode: 'shareware',
      menuState,
      responseKey: 'y'.charCodeAt(0),
    });

    expect(result.confirmationAction).toEqual({
      kind: 'openMessage',
      needsYesNo: true,
      onConfirm: { kind: 'endGame' },
      text: 'are you sure you want to end the game?',
    });
    expect(result.responseAction).toEqual({ kind: 'endGame' });
    expect(result.returnedToTitle).toBe(true);
    expect(menuState.active).toBe(false);
    expect(result.nextFrontEndSequenceState).not.toBe(frontEndSequenceState);
    expect(result.nextFrontEndSequenceState.menuActive).toBe(false);
    expect(result.nextFrontEndSequenceState.inDemoPlayback).toBe(false);
    expect(result.titleTickAction).toEqual({
      kind: 'showPage',
      lumpName: 'TITLEPIC',
      musicLump: 'D_INTRO',
      pagetic: TITLEPIC_PAGETIC,
    });
  });

  test('keeps the menu open when the player cancels the confirmation', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Options);

    const result = implementReturnToTitleFlow({
      command: 'bun run doom.ts',
      frontEndSequenceState,
      gameMode: 'shareware',
      menuState,
      responseKey: 'n'.charCodeAt(0),
    });

    expect(result.responseAction).toEqual({ kind: 'none' });
    expect(result.returnedToTitle).toBe(false);
    expect(result.titleTickAction).toBeNull();
    expect(result.nextFrontEndSequenceState).toBe(frontEndSequenceState);
    expect(frontEndSequenceState.menuActive).toBe(true);
    expect(menuState.active).toBe(true);
    expect(menuState.currentMenu).toBe(MenuKind.Options);
    expect(menuState.messageActive).toBe(false);
  });

  test('rejects non-Bun runtime commands', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Options);

    expect(() =>
      implementReturnToTitleFlow({
        command: 'bun run src/main.ts',
        frontEndSequenceState,
        gameMode: 'shareware',
        menuState,
      }),
    ).toThrow('implementReturnToTitleFlow requires the Bun runtime command `bun run doom.ts`.');
  });

  test('rejects the wrong Options-menu selection', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Options);
    menuState.itemOn = 1;

    expect(() =>
      implementReturnToTitleFlow({
        command: 'bun run doom.ts',
        frontEndSequenceState,
        gameMode: 'shareware',
        menuState,
      }),
    ).toThrow('implementReturnToTitleFlow requires the active Options menu End Game selection.');
  });
});
