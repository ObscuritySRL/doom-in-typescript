import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  SAVESTRINGSIZE,
  VANILLA_EMPTY_SAVE_SLOT_MENU_LABEL,
  VANILLA_SAVE_SLOT_COUNT,
  VANILLA_SAVE_SLOT_FILENAME_EXTENSION,
  VANILLA_SAVE_SLOT_FILENAME_PREFIX,
  VANILLA_SAVE_STAGING_FILENAME,
  VANILLA_SAVE_STRING_PRINTABLE_ASCII_MAX,
  VANILLA_SAVE_STRING_PRINTABLE_ASCII_MIN,
  VANILLA_SAVE_STRING_SIZE,
  VANILLA_SAVE_STRING_USER_INPUT_MAX,
  VANILLA_SAVE_SLOT_UI_INVARIANTS,
  decodeVanillaSaveDescription,
  encodeVanillaSaveDescription,
  isVanillaSaveSlotEmpty,
  isVanillaSaveSlotFilename,
  vanillaSaveSlotFilename,
  vanillaSaveSlotMenuLabel,
} from '../../../src/vanilla/wireSaveSlotUi.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireSaveSlotUi.ts');

describe('plan_final save: wire-save-slot-ui', () => {
  test('src/vanilla/wireSaveSlotUi.ts exists, is a regular file, and cites plan_final step 12-003', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('12-003');
    expect(fileText).toContain('VANILLA_SAVE_SLOT_UI_INVARIANTS');
  });

  test('the facade re-exports only from the two read-only save modules and menus.ts', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../save/define-save-directory-policy.ts', '../save/implement-save-slot-descriptions.ts', '../ui/menus.ts']);
  });

  test('VANILLA_SAVE_SLOT_UI_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_SAVE_SLOT_UI_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_SAVE_SLOT_UI_INVARIANTS)).toBe(true);
    const ids = VANILLA_SAVE_SLOT_UI_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['EMPTY_SLOT_LABEL_IS_EMPTY', 'QUICKSAVE_QUICKLOAD_AND_SLOT_SELECT_VIA_MENU_ACTIONS', 'SAVE_DESCRIPTION_IS_24_BYTES_23_PRINTABLE_ASCII', 'SAVE_SLOTS_ARE_SIX_DOOMSAV_DSG_FILES', 'SAVE_STAGING_USES_TEMP_DSG']);
    for (const invariant of VANILLA_SAVE_SLOT_UI_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the vanilla save constants match the reference', () => {
    expect(VANILLA_SAVE_SLOT_COUNT).toBe(6);
    expect(VANILLA_SAVE_SLOT_FILENAME_PREFIX).toBe('doomsav');
    expect(VANILLA_SAVE_SLOT_FILENAME_EXTENSION).toBe('.dsg');
    expect(VANILLA_SAVE_STAGING_FILENAME).toBe('temp.dsg');
    expect(VANILLA_SAVE_STRING_SIZE).toBe(24);
    expect(SAVESTRINGSIZE).toBe(24);
    expect(VANILLA_SAVE_STRING_USER_INPUT_MAX).toBe(23);
    expect(VANILLA_SAVE_STRING_PRINTABLE_ASCII_MIN).toBe(0x20);
    expect(VANILLA_SAVE_STRING_PRINTABLE_ASCII_MAX).toBe(0x7e);
    expect(VANILLA_EMPTY_SAVE_SLOT_MENU_LABEL).toBe('EMPTY');
  });

  test('the slot filename policy yields doomsav<N>.dsg and round-trips through the recognizer', () => {
    for (let slot = 0; slot < VANILLA_SAVE_SLOT_COUNT; slot += 1) {
      const filename = vanillaSaveSlotFilename(slot);
      expect(filename).toBe(`doomsav${slot}.dsg`);
      expect(isVanillaSaveSlotFilename(filename)).toBe(true);
    }
    expect(isVanillaSaveSlotFilename('temp.dsg')).toBe(false);
    expect(isVanillaSaveSlotFilename('savegame.sav')).toBe(false);
  });

  test('the save description codec round-trips and exposes empty slots as EMPTY', () => {
    const encoded = encodeVanillaSaveDescription('MY SAVE 1');
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.length).toBe(VANILLA_SAVE_STRING_SIZE);
    expect(decodeVanillaSaveDescription(encoded)).toBe('MY SAVE 1');

    const emptyBuffer = new Uint8Array(VANILLA_SAVE_STRING_SIZE);
    expect(isVanillaSaveSlotEmpty(emptyBuffer)).toBe(true);
    expect(vanillaSaveSlotMenuLabel(emptyBuffer)).toBe(VANILLA_EMPTY_SAVE_SLOT_MENU_LABEL);
    expect(isVanillaSaveSlotEmpty(encoded)).toBe(false);
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const directorySource = await import('../../../src/save/define-save-directory-policy.ts');
    const descriptionSource = await import('../../../src/save/implement-save-slot-descriptions.ts');
    const menusSource = await import('../../../src/ui/menus.ts');
    expect(vanillaSaveSlotFilename).toBe(directorySource.vanillaSaveSlotFilename);
    expect(encodeVanillaSaveDescription).toBe(descriptionSource.encodeVanillaSaveDescription);
    expect(SAVESTRINGSIZE).toBe(menusSource.SAVESTRINGSIZE);
  });
});
