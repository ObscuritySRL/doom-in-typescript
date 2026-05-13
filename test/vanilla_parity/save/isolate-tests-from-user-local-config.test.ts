import { describe, expect, test } from 'bun:test';

import { parseVanillaDefaultCfg } from '../../../src/config/parse-default-cfg.ts';
import {
  assertConfigPathIsTestSafe,
  buildInMemoryDefaultCfgFixture,
  detectConfigTestIsolationViolation,
  FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS,
  isUserLocalConfigPath,
  REPOSITORY_REFERENCE_FIXTURE_PATHS,
} from '../../../src/config/isolate-tests-from-user-local-config.ts';

describe('vanilla DOOM 1.9 config test isolation contract', () => {
  test('pins the forbidden user-local path fragments across Windows / macOS / Linux', () => {
    expect(FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS).toContain('/AppData/');
    expect(FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS).toContain('\\AppData\\');
    expect(FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS).toContain('/.local/share/');
    expect(FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS).toContain('/.config/');
    expect(FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS).toContain('/Library/Application Support/');
    expect(FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS).toContain('Chocolate Doom');
    expect(FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS).toContain('%APPDATA%');
    expect(FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS).toContain('%USERPROFILE%');
    expect(FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS).toContain('~/');
  });

  test('committed repository reference fixtures are allowed test inputs', () => {
    expect(REPOSITORY_REFERENCE_FIXTURE_PATHS).toEqual(['doom/default.cfg', 'doom/chocolate-doom.cfg']);
    for (const path of REPOSITORY_REFERENCE_FIXTURE_PATHS) {
      expect(isUserLocalConfigPath(path)).toBe(false);
      expect(detectConfigTestIsolationViolation(path)).toBe(null);
    }
  });

  test('detects Windows AppData paths as user-local', () => {
    expect(isUserLocalConfigPath('C:/Users/stevp/AppData/Roaming/Chocolate Doom/default.cfg')).toBe(true);
    expect(isUserLocalConfigPath('C:\\Users\\stevp\\AppData\\Local\\default.cfg')).toBe(true);
    expect(isUserLocalConfigPath('%APPDATA%/Chocolate Doom/default.cfg')).toBe(true);
  });

  test('detects Linux XDG paths as user-local', () => {
    expect(isUserLocalConfigPath('/home/user/.local/share/chocolate-doom/default.cfg')).toBe(true);
    expect(isUserLocalConfigPath('/home/user/.config/chocolate-doom/default.cfg')).toBe(true);
    expect(isUserLocalConfigPath('~/.local/share/chocolate-doom/default.cfg')).toBe(true);
  });

  test('detects macOS Application Support paths as user-local', () => {
    expect(isUserLocalConfigPath('/Users/user/Library/Application Support/Chocolate Doom/default.cfg')).toBe(true);
  });

  test('assertConfigPathIsTestSafe throws with the matched fragment when the path is user-local', () => {
    let thrown: Error | null = null;
    try {
      assertConfigPathIsTestSafe('C:/Users/stevp/AppData/Roaming/Chocolate Doom/default.cfg');
    } catch (error) {
      thrown = error as Error;
    }
    expect(thrown).not.toBe(null);
    expect(thrown?.message).toContain('config test isolation violation');
    expect(thrown?.message).toContain('AppData');
  });

  test('assertConfigPathIsTestSafe accepts the doom/ repository fixture paths', () => {
    expect(() => assertConfigPathIsTestSafe('doom/default.cfg')).not.toThrow();
    expect(() => assertConfigPathIsTestSafe('doom/chocolate-doom.cfg')).not.toThrow();
  });

  test('in-memory fixture builder produces input that round-trips through parseVanillaDefaultCfg', () => {
    const fixture = buildInMemoryDefaultCfgFixture({
      mouse_sensitivity: 7,
      sfx_volume: 12,
      chatmacro1: 'Hello',
    });
    expect(fixture.includes('mouse_sensitivity              7')).toBe(true);
    expect(fixture.includes('sfx_volume                     12')).toBe(true);
    expect(fixture.includes('chatmacro1                     "Hello"')).toBe(true);
    const cfg = parseVanillaDefaultCfg(fixture);
    expect(cfg.mouse_sensitivity).toBe(7);
    expect(cfg.sfx_volume).toBe(12);
    expect(cfg.chatmacro1).toBe('Hello');
  });

  test('empty overrides produce an empty fixture (defaults exclusively from hardcoded layer)', () => {
    expect(buildInMemoryDefaultCfgFixture()).toBe('');
    expect(buildInMemoryDefaultCfgFixture({})).toBe('');
  });
});
