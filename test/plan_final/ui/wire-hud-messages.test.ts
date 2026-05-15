import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  HU_MAXLINELENGTH,
  HU_MSGTIMEOUT,
  HU_MSGX,
  HU_MSGY,
  TICRATE,
  VANILLA_HUD_MESSAGE_ENTRY_POINTS,
  createHudMessageState,
  getDoom1MapName,
  hudMessageStart,
  requestHudMessageRefresh,
  tickHudMessages,
} from '../../../src/vanilla/wireHudMessages.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireHudMessages.ts');

describe('plan_final ui: wire-hud-messages', () => {
  test('src/vanilla/wireHudMessages.ts exists, is a regular file, and cites plan_final step 07-005', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('07-005');
    expect(fileText).toContain('VANILLA_HUD_MESSAGE_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only src/ui/hudMessages.ts without modifying it', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../ui/hudMessages.ts'");
  });

  test('VANILLA_HUD_MESSAGE_ENTRY_POINTS pins the five canonical entry points and is frozen', () => {
    expect(VANILLA_HUD_MESSAGE_ENTRY_POINTS).toEqual(['createHudMessageState', 'getDoom1MapName', 'hudMessageStart', 'requestHudMessageRefresh', 'tickHudMessages']);
    expect(Object.isFrozen(VANILLA_HUD_MESSAGE_ENTRY_POINTS)).toBe(true);
  });

  test('the HUD-message timing constants pin the vanilla hu_stuff.c values (TICRATE=35, 4s timeout)', () => {
    expect(TICRATE).toBe(35);
    expect(HU_MSGTIMEOUT).toBe(4 * 35);
    expect(HU_MSGX).toBe(0);
    expect(HU_MSGY).toBe(0);
    expect(HU_MAXLINELENGTH).toBe(80);
  });

  test('every wired function is re-exported as a callable function', () => {
    expect(typeof createHudMessageState).toBe('function');
    expect(typeof hudMessageStart).toBe('function');
    expect(typeof requestHudMessageRefresh).toBe('function');
    expect(typeof tickHudMessages).toBe('function');
    expect(typeof getDoom1MapName).toBe('function');
  });

  test('getDoom1MapName resolves the canonical E1M1 HUSTR title', () => {
    expect(getDoom1MapName(1, 1)).toBe('E1M1: Hangar');
  });

  test('the re-exported functions are the SAME references as the read-only hudMessages module exports', async () => {
    const source = await import('../../../src/ui/hudMessages.ts');
    expect(createHudMessageState).toBe(source.createHudMessageState);
    expect(tickHudMessages).toBe(source.tickHudMessages);
    expect(getDoom1MapName).toBe(source.getDoom1MapName);
  });
});
