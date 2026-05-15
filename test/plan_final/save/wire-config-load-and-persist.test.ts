import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  VANILLA_CONFIG_ENTRY_POINTS,
  assertConfigPathIsTestSafe,
  buildInMemoryDefaultCfgFixture,
  createDefaultHostExtraCfg,
  createDefaultVanillaCfg,
  isUserLocalConfigPath,
  parseDefaultCfg,
  parseHostExtraCfg,
  writeVanillaDefaultCfg,
} from '../../../src/vanilla/wireConfigLoadAndPersist.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireConfigLoadAndPersist.ts');

describe('plan_final save: wire-config-load-and-persist', () => {
  test('src/vanilla/wireConfigLoadAndPersist.ts exists, is a regular file, and cites plan_final step 12-001', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('12-001');
    expect(fileText).toContain('VANILLA_CONFIG_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only src/config/ modules without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../config/defaultCfg.ts'");
    expect(fileText).toContain("from '../config/hostConfig.ts'");
    expect(fileText).toContain("from '../config/write-config-back-in-vanilla-format.ts'");
    expect(fileText).toContain("from '../config/isolate-tests-from-user-local-config.ts'");
  });

  test('VANILLA_CONFIG_ENTRY_POINTS pins the seven canonical entry points and is frozen', () => {
    expect(VANILLA_CONFIG_ENTRY_POINTS).toEqual(['assertConfigPathIsTestSafe', 'createDefaultHostExtraCfg', 'createDefaultVanillaCfg', 'isUserLocalConfigPath', 'parseDefaultCfg', 'parseHostExtraCfg', 'writeVanillaDefaultCfg']);
    expect(Object.isFrozen(VANILLA_CONFIG_ENTRY_POINTS)).toBe(true);
  });

  test('every wired config function is re-exported as a callable function', () => {
    expect(typeof parseDefaultCfg).toBe('function');
    expect(typeof createDefaultVanillaCfg).toBe('function');
    expect(typeof parseHostExtraCfg).toBe('function');
    expect(typeof createDefaultHostExtraCfg).toBe('function');
    expect(typeof writeVanillaDefaultCfg).toBe('function');
    expect(typeof isUserLocalConfigPath).toBe('function');
    expect(typeof assertConfigPathIsTestSafe).toBe('function');
    expect(typeof buildInMemoryDefaultCfgFixture).toBe('function');
  });

  test('createDefaultVanillaCfg + createDefaultHostExtraCfg produce the disjoint vanilla/extended namespaces', () => {
    const vanilla = createDefaultVanillaCfg();
    const extended = createDefaultHostExtraCfg();
    const vanillaKeys = new Set(Object.keys(vanilla));
    const extendedKeys = new Set(Object.keys(extended));
    for (const key of vanillaKeys) {
      expect(extendedKeys.has(key)).toBe(false);
    }
    expect(vanillaKeys.size).toBeGreaterThan(0);
    expect(extendedKeys.size).toBeGreaterThan(0);
  });

  test('parseDefaultCfg round-trips a buildInMemoryDefaultCfgFixture override', () => {
    const fixture = buildInMemoryDefaultCfgFixture({ mouse_sensitivity: 9 });
    const parsed = parseDefaultCfg(fixture);
    expect(parsed.mouse_sensitivity).toBe(9);
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const defaultCfgSource = await import('../../../src/config/defaultCfg.ts');
    const hostConfigSource = await import('../../../src/config/hostConfig.ts');
    expect(parseDefaultCfg).toBe(defaultCfgSource.parseDefaultCfg);
    expect(parseHostExtraCfg).toBe(hostConfigSource.parseHostExtraCfg);
  });
});
