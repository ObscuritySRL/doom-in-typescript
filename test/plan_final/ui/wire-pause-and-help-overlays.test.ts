import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { VANILLA_PAUSE_HELP_INVARIANTS, closeMenu, getInitialHelpLump, notifyDemoCompleted, openMenu, openMessage, setMenuActive } from '../../../src/vanilla/wirePauseAndHelpOverlays.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wirePauseAndHelpOverlays.ts');

describe('plan_final ui: wire-pause-and-help-overlays', () => {
  test('src/vanilla/wirePauseAndHelpOverlays.ts exists, is a regular file, and cites plan_final step 07-009', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('07-009');
    expect(fileText).toContain('VANILLA_PAUSE_HELP_INVARIANTS');
  });

  test('the facade re-exports from the read-only frontEndSequence + menus modules without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../ui/frontEndSequence.ts'");
    expect(fileText).toContain("from '../ui/menus.ts'");
  });

  test('VANILLA_PAUSE_HELP_INVARIANTS pins the two page-timer parity rules and is frozen', () => {
    expect(VANILLA_PAUSE_HELP_INVARIANTS.length).toBe(2);
    expect(Object.isFrozen(VANILLA_PAUSE_HELP_INVARIANTS)).toBe(true);
    const ids = VANILLA_PAUSE_HELP_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['IN_LEVEL_PAUSE_DOES_NOT_TOUCH_PAGE_TIMER', 'MENU_OR_HELP_OVER_TITLE_PAUSES_PAGE_TIMER']);
    for (const invariant of VANILLA_PAUSE_HELP_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('every wired overlay function is re-exported as a callable function', () => {
    expect(typeof getInitialHelpLump).toBe('function');
    expect(typeof notifyDemoCompleted).toBe('function');
    expect(typeof setMenuActive).toBe('function');
    expect(typeof openMenu).toBe('function');
    expect(typeof closeMenu).toBe('function');
    expect(typeof openMessage).toBe('function');
  });

  test('getInitialHelpLump resolves the gamemode-keyed Read-This first page (vanilla ReadDef1/ReadDef2)', () => {
    expect(getInitialHelpLump('retail')).toBe('HELP1');
    expect(getInitialHelpLump('commercial')).toBe('HELP');
    expect(getInitialHelpLump('shareware')).toBe('HELP2');
    expect(getInitialHelpLump('registered')).toBe('HELP2');
    expect(getInitialHelpLump('indetermined')).toBe('HELP2');
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const frontEndSource = await import('../../../src/ui/frontEndSequence.ts');
    const menusSource = await import('../../../src/ui/menus.ts');
    expect(getInitialHelpLump).toBe(frontEndSource.getInitialHelpLump);
    expect(setMenuActive).toBe(frontEndSource.setMenuActive);
    expect(openMenu).toBe(menusSource.openMenu);
  });
});
