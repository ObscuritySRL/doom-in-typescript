import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  SAVEGAME_DESCRIPTION_SIZE,
  SAVEGAME_HEADER_SIZE,
  SAVEGAME_MOBJ_SIZE,
  SAVEGAME_PLAYER_SIZE,
  SAVEGAME_THINKER_CLASS_END,
  SAVEGAME_THINKER_CLASS_MOBJ,
  SAVEGAME_VERSION_CODE,
  VANILLA_SAVEGAME_WRITE_INVARIANTS,
  readSaveGameHeader,
  writeSaveGameHeader,
} from '../../../src/vanilla/wireSavegameWrite.ts';

import type { SaveGameHeader } from '../../../src/vanilla/wireSavegameWrite.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireSavegameWrite.ts');

const SAMPLE_HEADER: SaveGameHeader = { description: 'TEST SAVE 1', gameepisode: 1, gamemap: 1, gameskill: 2, leveltime: 1234, playeringame: [1, 0, 0, 0] };

describe('plan_final save: wire-savegame-write', () => {
  test('src/vanilla/wireSavegameWrite.ts exists, is a regular file, and cites plan_final step 12-004', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('12-004');
    expect(fileText).toContain('VANILLA_SAVEGAME_WRITE_INVARIANTS');
  });

  test('the facade re-exports only from the three read-only save serialization modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../save/coreSerialization.ts', '../save/saveHeader.ts', '../save/specialSerialization.ts']);
  });

  test('VANILLA_SAVEGAME_WRITE_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_SAVEGAME_WRITE_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_SAVEGAME_WRITE_INVARIANTS)).toBe(true);
    const ids = VANILLA_SAVEGAME_WRITE_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'HEADER_IS_FIXED_SIZE_WITH_VERSION_109',
      'MOBJ_AND_PLAYER_RECORDS_ARE_FIXED_SIZE',
      'SPECIALS_SERIALIZE_BY_CLASS_WITH_FIXED_SIZES',
      'THINKER_LIST_TERMINATED_BY_CLASS_END_0',
      'WORLD_WRITES_SECTORS_LINES_SIDES_THEN_THINKERS',
    ]);
    for (const invariant of VANILLA_SAVEGAME_WRITE_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the savegame layout constants match the vanilla p_saveg.c struct sizes', () => {
    expect(SAVEGAME_VERSION_CODE).toBe(109);
    expect(SAVEGAME_DESCRIPTION_SIZE).toBe(24);
    expect(SAVEGAME_MOBJ_SIZE).toBe(154);
    expect(SAVEGAME_PLAYER_SIZE).toBe(280);
    expect(SAVEGAME_THINKER_CLASS_END).toBe(0);
    expect(SAVEGAME_THINKER_CLASS_MOBJ).toBe(1);
    expect(SAVEGAME_HEADER_SIZE).toBeGreaterThan(SAVEGAME_DESCRIPTION_SIZE);
  });

  test('writeSaveGameHeader emits a fixed-size block that readSaveGameHeader round-trips', () => {
    const written = writeSaveGameHeader(SAMPLE_HEADER);
    expect(written).toBeInstanceOf(Uint8Array);
    expect(written.length).toBe(SAVEGAME_HEADER_SIZE);

    const parsed = readSaveGameHeader(written);
    expect(parsed).not.toBeNull();
    expect(parsed!.description).toBe('TEST SAVE 1');
    expect(parsed!.gameepisode).toBe(1);
    expect(parsed!.gamemap).toBe(1);
    expect(parsed!.gameskill).toBe(2);
    expect(parsed!.leveltime).toBe(1234);
    expect([...parsed!.playeringame]).toEqual([1, 0, 0, 0]);
  });

  test('readSaveGameHeader rejects a buffer whose version field is corrupted', () => {
    const written = writeSaveGameHeader(SAMPLE_HEADER);
    const corrupted = Uint8Array.from(written);
    corrupted[SAVEGAME_DESCRIPTION_SIZE] = corrupted[SAVEGAME_DESCRIPTION_SIZE]! ^ 0xff;
    expect(readSaveGameHeader(corrupted)).toBeNull();
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const headerSource = await import('../../../src/save/saveHeader.ts');
    const coreSource = await import('../../../src/save/coreSerialization.ts');
    const specialSource = await import('../../../src/save/specialSerialization.ts');
    expect(writeSaveGameHeader).toBe(headerSource.writeSaveGameHeader);
    expect(SAVEGAME_MOBJ_SIZE).toBe(coreSource.SAVEGAME_MOBJ_SIZE);
    expect(typeof specialSource.writeArchivedSpecials).toBe('function');
  });
});
