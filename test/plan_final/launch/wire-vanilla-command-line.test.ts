import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { CommandLineParseError, parseCommandLineConfiguration } from '../../../src/vanilla/commandLineConfiguration.ts';
import type { CommandLineConfiguration, WarpTarget } from '../../../src/vanilla/commandLineConfiguration.ts';
import { InvalidArgumentError, runDoomMain } from '../../../src/vanilla/runDoomMain.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const COMMAND_LINE_CONFIGURATION_RELATIVE_PATH = 'src/vanilla/commandLineConfiguration.ts';
const COMMAND_LINE_CONFIGURATION_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, COMMAND_LINE_CONFIGURATION_RELATIVE_PATH);
const RUN_DOOM_MAIN_RELATIVE_PATH = 'src/vanilla/runDoomMain.ts';
const RUN_DOOM_MAIN_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, RUN_DOOM_MAIN_RELATIVE_PATH);

function buildArgumentVector(...flagValues: readonly string[]): readonly string[] {
  return Object.freeze(['doom_codex', ...flagValues]);
}

describe('plan_final launch: wire-vanilla-command-line', () => {
  test('src/vanilla/commandLineConfiguration.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(COMMAND_LINE_CONFIGURATION_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(COMMAND_LINE_CONFIGURATION_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/commandLineConfiguration.ts cites plan_final step 03-003 in a top-of-file comment', () => {
    const fileText = readFileSync(COMMAND_LINE_CONFIGURATION_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('03-003');
    expect(fileText).toContain('parseCommandLineConfiguration');
  });

  test('src/vanilla/commandLineConfiguration.ts imports the existing bootstrap CommandLine class without modifying it', () => {
    const fileText = readFileSync(COMMAND_LINE_CONFIGURATION_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("import { CommandLine } from '../bootstrap/cmdline.ts';");
  });

  test('runDoomMain imports parseCommandLineConfiguration from the wrapper module', () => {
    const fileText = readFileSync(RUN_DOOM_MAIN_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("import { parseCommandLineConfiguration } from './commandLineConfiguration.ts';");
  });

  test('parseCommandLineConfiguration is exported as a function accepting a single argv argument', () => {
    expect(typeof parseCommandLineConfiguration).toBe('function');
    expect(parseCommandLineConfiguration.length).toBe(1);
  });

  test('CommandLineParseError is exported as a constructor with a stable name and exposes the offending parameter and value', () => {
    expect(typeof CommandLineParseError).toBe('function');
    const example = new CommandLineParseError('-skill', 'banana', 'invalid skill');
    expect(example.name).toBe('CommandLineParseError');
    expect(example).toBeInstanceOf(Error);
    expect(example.parameterName).toBe('-skill');
    expect(example.receivedValue).toBe('banana');
    expect(example.message).toBe('invalid skill');
  });

  test('parseCommandLineConfiguration returns null for every wired flag when argv contains only the program name', () => {
    const configuration = parseCommandLineConfiguration(['doom_codex']);
    expect(configuration.argv).toEqual(['doom_codex']);
    expect(configuration.iwadPath).toBeNull();
    expect(configuration.configPath).toBeNull();
    expect(configuration.warp).toBeNull();
    expect(configuration.playdemoName).toBeNull();
    expect(configuration.timedemoName).toBeNull();
    expect(configuration.skill).toBeNull();
    expect(configuration.savedirPath).toBeNull();
  });

  test('parseCommandLineConfiguration extracts -iwad <path>', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-iwad', 'doom/DOOM1.WAD'));
    expect(configuration.iwadPath).toBe('doom/DOOM1.WAD');
  });

  test('parseCommandLineConfiguration extracts -config <path>', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-config', 'doom/chocolate-doom.cfg'));
    expect(configuration.configPath).toBe('doom/chocolate-doom.cfg');
  });

  test('parseCommandLineConfiguration extracts -warp <episode> <map> in the two-argument episodic form', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-warp', '1', '1'));
    const warp: WarpTarget | null = configuration.warp;
    expect(warp).not.toBeNull();
    expect(warp!.episode).toBe(1);
    expect(warp!.map).toBe(1);
  });

  test('parseCommandLineConfiguration extracts -warp <map> in the single-argument Doom 2 form', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-warp', '7'));
    const warp: WarpTarget | null = configuration.warp;
    expect(warp).not.toBeNull();
    expect(warp!.episode).toBeNull();
    expect(warp!.map).toBe(7);
  });

  test('parseCommandLineConfiguration extracts -playdemo <name>', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-playdemo', 'demo1'));
    expect(configuration.playdemoName).toBe('demo1');
  });

  test('parseCommandLineConfiguration extracts -timedemo <name>', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-timedemo', 'demo3'));
    expect(configuration.timedemoName).toBe('demo3');
  });

  test('parseCommandLineConfiguration extracts -skill <1..5>', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-skill', '3'));
    expect(configuration.skill).toBe(3);
  });

  test('parseCommandLineConfiguration extracts -savedir <path>', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-savedir', 'saves/'));
    expect(configuration.savedirPath).toBe('saves/');
  });

  test('parseCommandLineConfiguration flows every wired flag through a composite argv simultaneously', () => {
    const configuration = parseCommandLineConfiguration(
      buildArgumentVector('-iwad', 'doom/DOOM1.WAD', '-config', 'doom/chocolate-doom.cfg', '-warp', '1', '1', '-playdemo', 'demo1', '-timedemo', 'demo3', '-skill', '4', '-savedir', 'saves/'),
    );
    expect(configuration.iwadPath).toBe('doom/DOOM1.WAD');
    expect(configuration.configPath).toBe('doom/chocolate-doom.cfg');
    expect(configuration.warp).toEqual({ episode: 1, map: 1 });
    expect(configuration.playdemoName).toBe('demo1');
    expect(configuration.timedemoName).toBe('demo3');
    expect(configuration.skill).toBe(4);
    expect(configuration.savedirPath).toBe('saves/');
  });

  test('parseCommandLineConfiguration matches flags case-insensitively (M_CheckParm contract)', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-IWAD', 'doom/DOOM1.WAD', '-Skill', '2'));
    expect(configuration.iwadPath).toBe('doom/DOOM1.WAD');
    expect(configuration.skill).toBe(2);
  });

  test('parseCommandLineConfiguration freezes the returned configuration so downstream subsystems cannot mutate the parsed contract', () => {
    const configuration: CommandLineConfiguration = parseCommandLineConfiguration(buildArgumentVector('-iwad', 'doom/DOOM1.WAD'));
    expect(Object.isFrozen(configuration)).toBe(true);
    expect(Object.isFrozen(configuration.argv)).toBe(true);
  });

  test('parseCommandLineConfiguration throws CommandLineParseError when -skill is non-numeric (offending value in message)', () => {
    let caughtError: unknown;
    try {
      parseCommandLineConfiguration(buildArgumentVector('-skill', 'banana'));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(CommandLineParseError);
    if (caughtError instanceof CommandLineParseError) {
      expect(caughtError.parameterName).toBe('-skill');
      expect(caughtError.receivedValue).toBe('banana');
      expect(caughtError.message).toContain('-skill');
      expect(caughtError.message).toContain('banana');
    }
  });

  test('parseCommandLineConfiguration throws CommandLineParseError when -skill is out of the vanilla [1, 5] range', () => {
    let caughtError: unknown;
    try {
      parseCommandLineConfiguration(buildArgumentVector('-skill', '9'));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(CommandLineParseError);
    if (caughtError instanceof CommandLineParseError) {
      expect(caughtError.parameterName).toBe('-skill');
      expect(caughtError.receivedValue).toBe('9');
      expect(caughtError.message).toContain('-skill');
      expect(caughtError.message).toContain('9');
    }
  });

  test('parseCommandLineConfiguration throws CommandLineParseError when -iwad is at the tail of argv with no trailing value', () => {
    let caughtError: unknown;
    try {
      parseCommandLineConfiguration(buildArgumentVector('-iwad'));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(CommandLineParseError);
    if (caughtError instanceof CommandLineParseError) {
      expect(caughtError.parameterName).toBe('-iwad');
      expect(caughtError.receivedValue).toBeNull();
      expect(caughtError.message).toContain('-iwad');
    }
  });

  test('parseCommandLineConfiguration throws CommandLineParseError when -warp has no trailing arguments', () => {
    let caughtError: unknown;
    try {
      parseCommandLineConfiguration(buildArgumentVector('-warp'));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(CommandLineParseError);
    if (caughtError instanceof CommandLineParseError) {
      expect(caughtError.parameterName).toBe('-warp');
      expect(caughtError.message).toContain('-warp');
    }
  });

  test('parseCommandLineConfiguration throws CommandLineParseError when -warp episode is non-numeric', () => {
    let caughtError: unknown;
    try {
      parseCommandLineConfiguration(buildArgumentVector('-warp', 'pizza', '1'));
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(CommandLineParseError);
    if (caughtError instanceof CommandLineParseError) {
      expect(caughtError.parameterName).toBe('-warp');
      expect(caughtError.receivedValue).toBe('pizza');
      expect(caughtError.message).toContain('pizza');
    }
  });

  test('runDoomMain accepts a string-array argv and resolves cleanly when every wired flag parses successfully', async () => {
    await expect(runDoomMain(['doom_codex', '-iwad', 'doom/DOOM1.WAD', '-config', 'doom/chocolate-doom.cfg', '-warp', '1', '1', '-playdemo', 'demo1', '-timedemo', 'demo3', '-skill', '4', '-savedir', 'saves/'])).resolves.toBeUndefined();
  });

  test('runDoomMain still rejects a non-array argv with InvalidArgumentError (preserves 03-001 invariant)', async () => {
    let caughtError: unknown;
    try {
      await runDoomMain({ iwad: 'doom/DOOM1.WAD' });
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(InvalidArgumentError);
  });

  test('runDoomMain throws CommandLineParseError when argv contains a recognized flag with an invalid trailing value', async () => {
    let caughtError: unknown;
    try {
      await runDoomMain(['doom_codex', '-skill', 'banana']);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(CommandLineParseError);
    if (caughtError instanceof CommandLineParseError) {
      expect(caughtError.parameterName).toBe('-skill');
      expect(caughtError.receivedValue).toBe('banana');
      expect(caughtError.message).toContain('-skill');
      expect(caughtError.message).toContain('banana');
    }
  });

  test('runDoomMain still resolves cleanly for the 03-001 baseline argv shape (--iwad double-dash is ignored, no parse failure)', async () => {
    await expect(runDoomMain(['--iwad', 'doom/DOOM1.WAD'])).resolves.toBeUndefined();
  });
});
