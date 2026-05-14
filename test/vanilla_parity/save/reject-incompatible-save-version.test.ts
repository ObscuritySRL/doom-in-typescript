import { describe, expect, test } from 'bun:test';

import { classifyVanillaSaveVersion, rejectionPathForVanillaSaveVersion, VANILLA_INCOMPATIBLE_SAVE_REJECTION_MODE, VANILLA_REJECTED_SAVE_VERSIONS } from '../../../src/save/reject-incompatible-save-version.ts';

describe('vanilla DOOM 1.9 G_DoLoadGame version rejection contract', () => {
  test('pins DOOM 1.0..1.8 (100..108) and post-1.9 (110+) as rejected versions', () => {
    expect(VANILLA_REJECTED_SAVE_VERSIONS).toContain('version 100');
    expect(VANILLA_REJECTED_SAVE_VERSIONS).toContain('version 108');
    expect(VANILLA_REJECTED_SAVE_VERSIONS).toContain('version 110');
    expect(VANILLA_REJECTED_SAVE_VERSIONS).not.toContain('version 109');
  });

  test('pins the silent-return rejection path used by vanilla G_DoLoadGame', () => {
    expect(VANILLA_INCOMPATIBLE_SAVE_REJECTION_MODE).toBe('silent-return');
  });

  test('classifyVanillaSaveVersion accepts only "version 109" exactly', () => {
    expect(classifyVanillaSaveVersion('version 109')).toBe('accept');
    expect(classifyVanillaSaveVersion('version 108')).toBe('reject');
    expect(classifyVanillaSaveVersion('version 110')).toBe('reject');
    expect(classifyVanillaSaveVersion('Version 109')).toBe('reject');
    expect(classifyVanillaSaveVersion('')).toBe('reject');
    expect(classifyVanillaSaveVersion('version  109')).toBe('reject');
  });

  test('rejectionPathForVanillaSaveVersion returns "load" for compatible and "silent-return" otherwise', () => {
    expect(rejectionPathForVanillaSaveVersion('version 109')).toBe('load');
    expect(rejectionPathForVanillaSaveVersion('version 108')).toBe('silent-return');
    expect(rejectionPathForVanillaSaveVersion('version 200')).toBe('silent-return');
  });

  test('every rejected version classifies as reject', () => {
    for (const versionMagic of VANILLA_REJECTED_SAVE_VERSIONS) {
      expect(classifyVanillaSaveVersion(versionMagic)).toBe('reject');
    }
  });
});
