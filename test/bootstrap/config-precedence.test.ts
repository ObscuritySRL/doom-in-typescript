import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  buildDefinitionMap,
  EXTENDED_CONFIG_FILENAME,
  initializeDefaults,
  loadDefaults,
  parseConfigFileContent,
  parseConfigValue,
  resolveExtendedConfigPath,
  resolveVanillaConfigPath,
  VANILLA_CONFIG_FILENAME,
} from '../../src/bootstrap/config.ts';
import type { ConfigDefinition, ConfigLoadResult, ConfigValueType } from '../../src/bootstrap/config.ts';
import { CommandLine } from '../../src/bootstrap/cmdline.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';

/* ------------------------------------------------------------------ */
/*  Synthetic definitions for pure-function tests                      */
/* ------------------------------------------------------------------ */

const SAMPLE_VANILLA: readonly ConfigDefinition[] = Object.freeze([
  Object.freeze({ name: 'mouse_sensitivity', type: 'integer' as ConfigValueType, defaultValue: 5 }),
  Object.freeze({ name: 'sfx_volume', type: 'integer' as ConfigValueType, defaultValue: 8 }),
  Object.freeze({ name: 'chatmacro0', type: 'string' as ConfigValueType, defaultValue: 'No' }),
  Object.freeze({ name: 'usegamma', type: 'integer' as ConfigValueType, defaultValue: 0 }),
]);

const SAMPLE_EXTENDED: readonly ConfigDefinition[] = Object.freeze([
  Object.freeze({ name: 'fullscreen', type: 'integer' as ConfigValueType, defaultValue: 1 }),
  Object.freeze({ name: 'mouse_acceleration', type: 'float' as ConfigValueType, defaultValue: 2.0 }),
  Object.freeze({ name: 'opl_io_port', type: 'integer' as ConfigValueType, defaultValue: 0x388 }),
  Object.freeze({ name: 'snd_musiccmd', type: 'string' as ConfigValueType, defaultValue: '' }),
  Object.freeze({ name: 'vanilla_savegame_limit', type: 'integer' as ConfigValueType, defaultValue: 1 }),
]);

/* ------------------------------------------------------------------ */
/*  parseConfigValue                                                   */
/* ------------------------------------------------------------------ */

describe('parseConfigValue', () => {
  test('parses positive integer', () => {
    expect(parseConfigValue('42', 'integer')).toBe(42);
  });

  test('parses negative integer', () => {
    expect(parseConfigValue('-1', 'integer')).toBe(-1);
  });

  test('parses zero integer', () => {
    expect(parseConfigValue('0', 'integer')).toBe(0);
  });

  test('parses hex integer with 0x prefix', () => {
    expect(parseConfigValue('0x388', 'integer')).toBe(0x388);
  });

  test('parses hex integer with 0X prefix', () => {
    expect(parseConfigValue('0X1A', 'integer')).toBe(0x1a);
  });

  test('parses quoted string', () => {
    expect(parseConfigValue('"Hello"', 'string')).toBe('Hello');
  });

  test('parses empty quoted string', () => {
    expect(parseConfigValue('""', 'string')).toBe('');
  });

  test('parses quoted string with spaces', () => {
    expect(parseConfigValue('"I\'m ready to kick butt!"', 'string')).toBe("I'm ready to kick butt!");
  });

  test('passes through unquoted string as-is', () => {
    expect(parseConfigValue('bare', 'string')).toBe('bare');
  });

  test('parses float with trailing zeros', () => {
    expect(parseConfigValue('2.000000', 'float')).toBe(2.0);
  });

  test('parses float with non-zero fractional', () => {
    expect(parseConfigValue('0.650000', 'float')).toBe(0.65);
  });
});

/* ------------------------------------------------------------------ */
/*  parseConfigFileContent                                             */
/* ------------------------------------------------------------------ */

describe('parseConfigFileContent', () => {
  const defMap = buildDefinitionMap(SAMPLE_VANILLA);

  test('parses integer values from config lines', () => {
    const content = 'mouse_sensitivity             5\nsfx_volume                    8\n';
    const values = parseConfigFileContent(content, defMap);
    expect(values.get('mouse_sensitivity')).toBe(5);
    expect(values.get('sfx_volume')).toBe(8);
  });

  test('parses quoted string values', () => {
    const content = 'chatmacro0                    "No"\n';
    const values = parseConfigFileContent(content, defMap);
    expect(values.get('chatmacro0')).toBe('No');
  });

  test('silently ignores unknown variable names', () => {
    const content = 'unknown_var 99\nmouse_sensitivity 3\n';
    const values = parseConfigFileContent(content, defMap);
    expect(values.has('unknown_var')).toBe(false);
    expect(values.get('mouse_sensitivity')).toBe(3);
    expect(values.size).toBe(1);
  });

  test('returns empty map for empty content', () => {
    const values = parseConfigFileContent('', defMap);
    expect(values.size).toBe(0);
  });

  test('skips blank lines and whitespace-only lines', () => {
    const content = '\n   \n\nmouse_sensitivity 7\n\n';
    const values = parseConfigFileContent(content, defMap);
    expect(values.size).toBe(1);
    expect(values.get('mouse_sensitivity')).toBe(7);
  });

  test('handles Windows line endings', () => {
    const content = 'mouse_sensitivity 4\r\nsfx_volume 6\r\n';
    const values = parseConfigFileContent(content, defMap);
    expect(values.get('mouse_sensitivity')).toBe(4);
    expect(values.get('sfx_volume')).toBe(6);
  });

  test('skips lines with only a name and no value', () => {
    const content = 'mouse_sensitivity\nsfx_volume 3\n';
    const values = parseConfigFileContent(content, defMap);
    expect(values.has('mouse_sensitivity')).toBe(false);
    expect(values.get('sfx_volume')).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/*  parseConfigFileContent with extended (float/hex) types             */
/* ------------------------------------------------------------------ */

describe('parseConfigFileContent extended types', () => {
  const defMap = buildDefinitionMap(SAMPLE_EXTENDED);

  test('parses hex integer (opl_io_port 0x388)', () => {
    const content = 'opl_io_port                   0x388\n';
    const values = parseConfigFileContent(content, defMap);
    expect(values.get('opl_io_port')).toBe(0x388);
  });

  test('parses float value', () => {
    const content = 'mouse_acceleration            2.000000\n';
    const values = parseConfigFileContent(content, defMap);
    expect(values.get('mouse_acceleration')).toBe(2.0);
  });

  test('parses empty quoted string', () => {
    const content = 'snd_musiccmd                  ""\n';
    const values = parseConfigFileContent(content, defMap);
    expect(values.get('snd_musiccmd')).toBe('');
  });
});

/* ------------------------------------------------------------------ */
/*  buildDefinitionMap                                                 */
/* ------------------------------------------------------------------ */

describe('buildDefinitionMap', () => {
  test('creates map with correct size', () => {
    const map = buildDefinitionMap(SAMPLE_VANILLA);
    expect(map.size).toBe(SAMPLE_VANILLA.length);
  });

  test('maps names to definitions', () => {
    const map = buildDefinitionMap(SAMPLE_VANILLA);
    expect(map.get('sfx_volume')?.defaultValue).toBe(8);
    expect(map.get('sfx_volume')?.type).toBe('integer');
  });

  test('returns undefined for unknown names', () => {
    const map = buildDefinitionMap(SAMPLE_VANILLA);
    expect(map.get('nonexistent')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  initializeDefaults                                                 */
/* ------------------------------------------------------------------ */

describe('initializeDefaults', () => {
  test('creates map with all definition default values', () => {
    const defaults = initializeDefaults(SAMPLE_VANILLA);
    expect(defaults.size).toBe(SAMPLE_VANILLA.length);
    expect(defaults.get('mouse_sensitivity')).toBe(5);
    expect(defaults.get('sfx_volume')).toBe(8);
    expect(defaults.get('chatmacro0')).toBe('No');
    expect(defaults.get('usegamma')).toBe(0);
  });

  test('returns empty map for empty definitions', () => {
    const defaults = initializeDefaults([]);
    expect(defaults.size).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  resolveVanillaConfigPath                                           */
/* ------------------------------------------------------------------ */

describe('resolveVanillaConfigPath', () => {
  test('returns default path when -config is absent', () => {
    const cmdline = new CommandLine(['doom.exe']);
    const result = resolveVanillaConfigPath(cmdline, '/game');
    expect(result).toContain(VANILLA_CONFIG_FILENAME);
  });

  test('returns -config override when present', () => {
    const cmdline = new CommandLine(['doom.exe', '-config', '/custom/my.cfg']);
    const result = resolveVanillaConfigPath(cmdline, '/game');
    expect(result).toBe('/custom/my.cfg');
  });

  test('-config override is case-insensitive', () => {
    const cmdline = new CommandLine(['doom.exe', '-CONFIG', '/alt.cfg']);
    const result = resolveVanillaConfigPath(cmdline, '/game');
    expect(result).toBe('/alt.cfg');
  });
});

/* ------------------------------------------------------------------ */
/*  resolveExtendedConfigPath                                          */
/* ------------------------------------------------------------------ */

describe('resolveExtendedConfigPath', () => {
  test('returns default path when -extraconfig is absent', () => {
    const cmdline = new CommandLine(['doom.exe']);
    const result = resolveExtendedConfigPath(cmdline, '/game');
    expect(result).toContain(EXTENDED_CONFIG_FILENAME);
  });

  test('returns -extraconfig override when present', () => {
    const cmdline = new CommandLine(['doom.exe', '-extraconfig', '/other/ext.cfg']);
    const result = resolveExtendedConfigPath(cmdline, '/game');
    expect(result).toBe('/other/ext.cfg');
  });
});

/* ------------------------------------------------------------------ */
/*  Filename constants                                                 */
/* ------------------------------------------------------------------ */

describe('config filename constants', () => {
  test('vanilla filename matches Chocolate Doom convention', () => {
    expect(VANILLA_CONFIG_FILENAME).toBe('default.cfg');
  });

  test('extended filename matches Chocolate Doom convention', () => {
    expect(EXTENDED_CONFIG_FILENAME).toBe('chocolate-doom.cfg');
  });
});

/* ------------------------------------------------------------------ */
/*  Precedence: file values override defaults                          */
/* ------------------------------------------------------------------ */

describe('precedence logic', () => {
  test('file values override hardcoded defaults', () => {
    const defaults = initializeDefaults(SAMPLE_VANILLA);
    expect(defaults.get('mouse_sensitivity')).toBe(5);

    const defMap = buildDefinitionMap(SAMPLE_VANILLA);
    const fileValues = parseConfigFileContent('mouse_sensitivity 10\n', defMap);
    for (const [name, value] of fileValues) {
      defaults.set(name, value);
    }

    expect(defaults.get('mouse_sensitivity')).toBe(10);
  });

  test('defaults survive when file has no matching entry', () => {
    const defaults = initializeDefaults(SAMPLE_VANILLA);
    const defMap = buildDefinitionMap(SAMPLE_VANILLA);
    const fileValues = parseConfigFileContent('mouse_sensitivity 3\n', defMap);
    for (const [name, value] of fileValues) {
      defaults.set(name, value);
    }

    expect(defaults.get('mouse_sensitivity')).toBe(3);
    expect(defaults.get('sfx_volume')).toBe(8);
    expect(defaults.get('chatmacro0')).toBe('No');
  });

  test('vanilla and extended namespaces are disjoint', () => {
    const vanillaNames = new Set(SAMPLE_VANILLA.map((d) => d.name));
    const extendedNames = new Set(SAMPLE_EXTENDED.map((d) => d.name));
    for (const name of vanillaNames) {
      expect(extendedNames.has(name)).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  loadDefaults with real temp files                                  */
/* ------------------------------------------------------------------ */

describe('loadDefaults', () => {
  let tempDirectory: string;

  const setup = async (): Promise<string> => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'doom-config-test-'));
    return tempDirectory;
  };

  const cleanup = async (): Promise<void> => {
    if (tempDirectory) {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  };

  test('loads both config files and merges with defaults', async () => {
    const directory = await setup();
    try {
      await Bun.write(join(directory, VANILLA_CONFIG_FILENAME), 'mouse_sensitivity             3\nsfx_volume                    6\n');
      await Bun.write(join(directory, EXTENDED_CONFIG_FILENAME), 'fullscreen                    0\nopl_io_port                   0x388\n');

      const cmdline = new CommandLine(['doom.exe']);
      const result = await loadDefaults(cmdline, SAMPLE_VANILLA, SAMPLE_EXTENDED, directory);

      expect(result.vanillaLoaded).toBe(true);
      expect(result.extendedLoaded).toBe(true);
      expect(result.values.get('mouse_sensitivity')).toBe(3);
      expect(result.values.get('sfx_volume')).toBe(6);
      expect(result.values.get('chatmacro0')).toBe('No');
      expect(result.values.get('fullscreen')).toBe(0);
      expect(result.values.get('opl_io_port')).toBe(0x388);
      expect(result.values.get('mouse_acceleration')).toBe(2.0);
    } finally {
      await cleanup();
    }
  });

  test('uses defaults when config files are missing', async () => {
    const directory = await setup();
    try {
      const cmdline = new CommandLine(['doom.exe']);
      const result = await loadDefaults(cmdline, SAMPLE_VANILLA, SAMPLE_EXTENDED, directory);

      expect(result.vanillaLoaded).toBe(false);
      expect(result.extendedLoaded).toBe(false);
      expect(result.values.get('mouse_sensitivity')).toBe(5);
      expect(result.values.get('sfx_volume')).toBe(8);
      expect(result.values.get('fullscreen')).toBe(1);
    } finally {
      await cleanup();
    }
  });

  test('honors -config override for vanilla config path', async () => {
    const directory = await setup();
    try {
      const customPath = join(directory, 'custom.cfg');
      await Bun.write(customPath, 'mouse_sensitivity 99\n');

      const cmdline = new CommandLine(['doom.exe', '-config', customPath]);
      const result = await loadDefaults(cmdline, SAMPLE_VANILLA, SAMPLE_EXTENDED, directory);

      expect(result.vanillaLoaded).toBe(true);
      expect(result.vanillaConfigPath).toBe(customPath);
      expect(result.values.get('mouse_sensitivity')).toBe(99);
    } finally {
      await cleanup();
    }
  });

  test('honors -extraconfig override for extended config path', async () => {
    const directory = await setup();
    try {
      const customPath = join(directory, 'extra.cfg');
      await Bun.write(customPath, 'fullscreen 0\n');

      const cmdline = new CommandLine(['doom.exe', '-extraconfig', customPath]);
      const result = await loadDefaults(cmdline, SAMPLE_VANILLA, SAMPLE_EXTENDED, directory);

      expect(result.extendedLoaded).toBe(true);
      expect(result.extendedConfigPath).toBe(customPath);
      expect(result.values.get('fullscreen')).toBe(0);
    } finally {
      await cleanup();
    }
  });

  test('combined values map contains all definitions from both namespaces', async () => {
    const directory = await setup();
    try {
      const cmdline = new CommandLine(['doom.exe']);
      const result = await loadDefaults(cmdline, SAMPLE_VANILLA, SAMPLE_EXTENDED, directory);
      const expectedSize = SAMPLE_VANILLA.length + SAMPLE_EXTENDED.length;
      expect(result.values.size).toBe(expectedSize);
    } finally {
      await cleanup();
    }
  });

  test('result object is frozen', async () => {
    const directory = await setup();
    try {
      const cmdline = new CommandLine(['doom.exe']);
      const result = await loadDefaults(cmdline, SAMPLE_VANILLA, SAMPLE_EXTENDED, directory);
      expect(Object.isFrozen(result)).toBe(true);
    } finally {
      await cleanup();
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Parity-sensitive edge cases                                        */
/* ------------------------------------------------------------------ */

describe('parity-sensitive edge cases', () => {
  test('hex integer opl_io_port round-trips correctly (0x388 = 904)', () => {
    const defMap = buildDefinitionMap(SAMPLE_EXTENDED);
    const values = parseConfigFileContent('opl_io_port                   0x388\n', defMap);
    expect(values.get('opl_io_port')).toBe(904);
    expect(values.get('opl_io_port')).toBe(0x388);
  });

  test('unknown variables in config file are silently ignored (Chocolate Doom behavior)', () => {
    const defMap = buildDefinitionMap(SAMPLE_VANILLA);
    const content = ['mouse_sensitivity 5', 'totally_unknown 42', 'another_unknown_var 100', 'some_string "hello"', 'sfx_volume 8'].join('\n');

    const values = parseConfigFileContent(content, defMap);
    expect(values.size).toBe(2);
    expect(values.has('totally_unknown')).toBe(false);
    expect(values.has('another_unknown_var')).toBe(false);
    expect(values.has('some_string')).toBe(false);
  });

  test('-config changes load path while -extraconfig is independent', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'doom-config-parity-'));
    try {
      const vanillaCustom = join(directory, 'alt-default.cfg');
      await Bun.write(vanillaCustom, 'mouse_sensitivity 77\n');
      await Bun.write(join(directory, EXTENDED_CONFIG_FILENAME), 'fullscreen 0\n');

      const cmdline = new CommandLine(['doom.exe', '-config', vanillaCustom]);
      const result = await loadDefaults(cmdline, SAMPLE_VANILLA, SAMPLE_EXTENDED, directory);

      expect(result.vanillaConfigPath).toBe(vanillaCustom);
      expect(result.vanillaLoaded).toBe(true);
      expect(result.values.get('mouse_sensitivity')).toBe(77);
      expect(result.extendedLoaded).toBe(true);
      expect(result.values.get('fullscreen')).toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('missing vanilla file does not prevent extended file loading', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'doom-config-partial-'));
    try {
      await Bun.write(join(directory, EXTENDED_CONFIG_FILENAME), 'fullscreen 0\n');

      const cmdline = new CommandLine(['doom.exe']);
      const result = await loadDefaults(cmdline, SAMPLE_VANILLA, SAMPLE_EXTENDED, directory);

      expect(result.vanillaLoaded).toBe(false);
      expect(result.extendedLoaded).toBe(true);
      expect(result.values.get('mouse_sensitivity')).toBe(5);
      expect(result.values.get('fullscreen')).toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Cross-reference with config-variable-summary.json                  */
/* ------------------------------------------------------------------ */

describe('cross-reference with config-variable-summary.json', () => {
  interface ConfigVariableSummaryEntry {
    readonly name: string;
    readonly value: number | string;
    readonly type: string;
    readonly category: string;
  }

  interface ConfigFileSummary {
    readonly fileName: string;
    readonly variableCount: number;
    readonly variables: readonly ConfigVariableSummaryEntry[];
  }

  interface ConfigVariableSummary {
    readonly summary: {
      readonly defaultCfgCount: number;
      readonly chocolateDoomCfgCount: number;
      readonly totalCount: number;
      readonly overlapCount: number;
    };
    readonly configFiles: readonly ConfigFileSummary[];
  }

  let summary: ConfigVariableSummary;

  const loadSummary = async (): Promise<void> => {
    const path = join(import.meta.dir, '..', '..', 'reference', 'manifests', 'config-variable-summary.json');
    summary = await Bun.file(path).json();
  };

  test('reference summary has zero overlap (F-022)', async () => {
    await loadSummary();
    expect(summary.summary.overlapCount).toBe(0);
  });

  test('vanilla config has 43 variables', async () => {
    await loadSummary();
    expect(summary.summary.defaultCfgCount).toBe(43);
  });

  test('extended config has 113 variables', async () => {
    await loadSummary();
    expect(summary.summary.chocolateDoomCfgCount).toBe(113);
  });

  test('total is 156 variables', async () => {
    await loadSummary();
    expect(summary.summary.totalCount).toBe(156);
  });

  test('parser correctly handles all reference default.cfg entries', async () => {
    await loadSummary();
    const vanillaFile = summary.configFiles.find((f) => f.fileName === 'default.cfg')!;
    const definitions: ConfigDefinition[] = vanillaFile.variables.map((v) => ({
      name: v.name,
      type: v.type as ConfigValueType,
      defaultValue: v.value,
    }));

    const referenceContent = await Bun.file(join(REFERENCE_BUNDLE_PATH, 'default.cfg')).text();

    const defMap = buildDefinitionMap(definitions);
    const parsed = parseConfigFileContent(referenceContent, defMap);
    expect(parsed.size).toBe(43);
  });

  test('parser correctly handles all reference chocolate-doom.cfg entries', async () => {
    await loadSummary();
    const extendedFile = summary.configFiles.find((f) => f.fileName === 'chocolate-doom.cfg')!;
    const definitions: ConfigDefinition[] = extendedFile.variables.map((v) => ({
      name: v.name,
      type: v.type as ConfigValueType,
      defaultValue: v.value,
    }));

    const referenceContent = await Bun.file(join(REFERENCE_BUNDLE_PATH, 'chocolate-doom.cfg')).text();

    const defMap = buildDefinitionMap(definitions);
    const parsed = parseConfigFileContent(referenceContent, defMap);
    expect(parsed.size).toBe(113);
  });
});

/* ------------------------------------------------------------------ */
/*  Compile-time type satisfaction                                     */
/* ------------------------------------------------------------------ */

describe('compile-time type satisfaction', () => {
  test('ConfigDefinition accepts well-formed literal', () => {
    const definition: ConfigDefinition = {
      name: 'test_var',
      type: 'integer',
      defaultValue: 0,
    };
    expect(definition.name).toBe('test_var');
  });

  test('ConfigLoadResult fields are typed correctly', () => {
    const result: ConfigLoadResult = {
      values: new Map([['a', 1]]),
      vanillaConfigPath: '/path/default.cfg',
      extendedConfigPath: '/path/chocolate-doom.cfg',
      vanillaLoaded: true,
      extendedLoaded: false,
    };
    expect(result.values.get('a')).toBe(1);
    expect(result.vanillaLoaded).toBe(true);
    expect(result.extendedLoaded).toBe(false);
  });

  test('ConfigValueType union covers all three types', () => {
    const types: ConfigValueType[] = ['float', 'integer', 'string'];
    expect(types.length).toBe(3);
  });
});
