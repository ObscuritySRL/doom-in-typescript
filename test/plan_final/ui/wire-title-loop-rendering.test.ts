import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  COMMERCIAL_TITLEPIC_PAGETIC,
  CYCLE_LENGTH,
  INTERLUDE_PAGETIC,
  TITLEPIC_PAGETIC,
  TitleLoop,
  VANILLA_TITLE_LOOP_ENTRY_POINTS,
  createFrontEndSequence,
  getInitialHelpLump,
  handleFrontEndKey,
  notifyDemoCompleted,
  setMenuActive,
  tickFrontEnd,
} from '../../../src/vanilla/wireTitleLoopRendering.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireTitleLoopRendering.ts');

describe('plan_final ui: wire-title-loop-rendering', () => {
  test('src/vanilla/wireTitleLoopRendering.ts exists, is a regular file, and cites plan_final step 07-001', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('07-001');
    expect(fileText).toContain('VANILLA_TITLE_LOOP_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only frontEndSequence + titleLoop modules without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../ui/frontEndSequence.ts'");
    expect(fileText).toContain("from '../bootstrap/titleLoop.ts'");
  });

  test('VANILLA_TITLE_LOOP_ENTRY_POINTS pins the six canonical entry points and is frozen', () => {
    expect(VANILLA_TITLE_LOOP_ENTRY_POINTS).toEqual(['createFrontEndSequence', 'getInitialHelpLump', 'handleFrontEndKey', 'notifyDemoCompleted', 'setMenuActive', 'tickFrontEnd']);
    expect(Object.isFrozen(VANILLA_TITLE_LOOP_ENTRY_POINTS)).toBe(true);
  });

  test('the page-timing constants pin the vanilla d_main.c values', () => {
    expect(TITLEPIC_PAGETIC).toBe(170);
    expect(COMMERCIAL_TITLEPIC_PAGETIC).toBe(385);
    expect(INTERLUDE_PAGETIC).toBe(200);
    expect(CYCLE_LENGTH).toBe(6);
  });

  test('every wired front-end function is re-exported as a callable function and TitleLoop as a constructor', () => {
    expect(typeof createFrontEndSequence).toBe('function');
    expect(typeof tickFrontEnd).toBe('function');
    expect(typeof handleFrontEndKey).toBe('function');
    expect(typeof notifyDemoCompleted).toBe('function');
    expect(typeof setMenuActive).toBe('function');
    expect(typeof getInitialHelpLump).toBe('function');
    expect(typeof TitleLoop).toBe('function');
    expect(new TitleLoop('shareware')).toBeInstanceOf(TitleLoop);
  });

  test('createFrontEndSequence + tickFrontEnd produce a deterministic attract-loop tick action for the shareware gamemode', () => {
    const state = createFrontEndSequence('shareware');
    const action = tickFrontEnd(state);
    expect(typeof action.kind).toBe('string');
    expect(['showPage', 'playDemo', 'idle']).toContain(action.kind);
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const frontEndSource = await import('../../../src/ui/frontEndSequence.ts');
    const titleLoopSource = await import('../../../src/bootstrap/titleLoop.ts');
    expect(createFrontEndSequence).toBe(frontEndSource.createFrontEndSequence);
    expect(tickFrontEnd).toBe(frontEndSource.tickFrontEnd);
    expect(TitleLoop).toBe(titleLoopSource.TitleLoop);
  });
});
