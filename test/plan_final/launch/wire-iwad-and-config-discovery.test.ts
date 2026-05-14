import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { VANILLA_IWAD_CANDIDATES } from '../../../src/bootstrap/implement-iwad-discovery-order.ts';
import type { VanillaIwadCandidate } from '../../../src/bootstrap/implement-iwad-discovery-order.ts';
import { parseCommandLineConfiguration } from '../../../src/vanilla/commandLineConfiguration.ts';
import type { CommandLineConfiguration } from '../../../src/vanilla/commandLineConfiguration.ts';
import { HOST_EXTRA_CONFIG_FILENAME, VANILLA_DEFAULT_CONFIG_FILENAME, resolveLaunchContext } from '../../../src/vanilla/launchContext.ts';
import type { LaunchContext, LaunchContextEnvironment } from '../../../src/vanilla/launchContext.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const LAUNCH_CONTEXT_RELATIVE_PATH = 'src/vanilla/launchContext.ts';
const LAUNCH_CONTEXT_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, LAUNCH_CONTEXT_RELATIVE_PATH);
const RUN_DOOM_MAIN_RELATIVE_PATH = 'src/vanilla/runDoomMain.ts';
const RUN_DOOM_MAIN_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, RUN_DOOM_MAIN_RELATIVE_PATH);

function buildArgumentVector(...flagValues: readonly string[]): readonly string[] {
  return Object.freeze(['doom_codex', ...flagValues]);
}

function buildEnvironmentWithPresentBasenames(presentBasenames: readonly VanillaIwadCandidate['filename'][], doomWadDirectoryEnvironmentValue: string | null = null): LaunchContextEnvironment {
  const presentSet = new Set<VanillaIwadCandidate['filename']>(presentBasenames);
  return Object.freeze({
    doesBasenameExistInWadDirectory: (basename: VanillaIwadCandidate['filename']) => presentSet.has(basename),
    doomWadDirectoryEnvironmentValue,
  });
}

describe('plan_final launch: wire-iwad-and-config-discovery', () => {
  test('src/vanilla/launchContext.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(LAUNCH_CONTEXT_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(LAUNCH_CONTEXT_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/launchContext.ts cites plan_final step 03-004 in a top-of-file comment', () => {
    const fileText = readFileSync(LAUNCH_CONTEXT_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('03-004');
    expect(fileText).toContain('resolveLaunchContext');
  });

  test('src/vanilla/launchContext.ts imports the canonical IWAD candidate list from the audit module without modifying it', () => {
    const fileText = readFileSync(LAUNCH_CONTEXT_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("import { VANILLA_DEFAULT_SEARCH_DIRECTORY, VANILLA_IWAD_CANDIDATES } from '../bootstrap/implement-iwad-discovery-order.ts';");
    expect(fileText).toContain("import { identifyMission } from '../bootstrap/gameMode.ts';");
  });

  test('runDoomMain wires resolveLaunchContext into the entry point and cites plan_final step 03-004', () => {
    const fileText = readFileSync(RUN_DOOM_MAIN_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('03-004');
    expect(fileText).toContain("import { resolveLaunchContext } from './launchContext.ts';");
    expect(fileText).toContain('resolveLaunchContext(commandLineConfiguration');
  });

  test('resolveLaunchContext is exported as a function accepting (configuration, environment)', () => {
    expect(typeof resolveLaunchContext).toBe('function');
    expect(resolveLaunchContext.length).toBe(2);
  });

  test('VANILLA_DEFAULT_CONFIG_FILENAME and HOST_EXTRA_CONFIG_FILENAME pin the Chocolate Doom 2.2.1 M_SetConfigFilenames slots', () => {
    expect(VANILLA_DEFAULT_CONFIG_FILENAME).toBe('default.cfg');
    expect(HOST_EXTRA_CONFIG_FILENAME).toBe('chocolate-doom.cfg');
  });

  test('resolveLaunchContext returns a frozen object with frozen iwad slot', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-iwad', 'doom/DOOM1.WAD'));
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.iwad)).toBe(true);
    expect(Object.isFrozen(context.iwad.probedSequence)).toBe(true);
  });

  test('iwad-flag mode: explicit -iwad <canonical-basename> path is honored verbatim and pins the canonical game mode', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-iwad', 'doom/doom1.wad'));
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(context.iwad.source).toBe('iwad-flag');
    expect(context.iwad.resolvedPath).toBe('doom/doom1.wad');
    expect(context.iwad.matchedFilename).toBe('doom1.wad');
    expect(context.iwad.gameMode).toBe('shareware');
    expect(context.iwad.gameMission).toBe('doom');
    expect(context.iwad.probedSequence).toEqual([]);
    expect(context.iwad.searchDirectory).toBeNull();
  });

  test('iwad-flag mode: uppercase basename (DOOM1.WAD) is recognized case-insensitively as a canonical candidate', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-iwad', 'doom/DOOM1.WAD'));
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(context.iwad.source).toBe('iwad-flag');
    expect(context.iwad.matchedFilename).toBe('doom1.wad');
    expect(context.iwad.gameMode).toBe('shareware');
  });

  test('iwad-flag mode: non-canonical basename (freedoom1.wad) yields source=iwad-flag, gameMode=indetermined, but identifyMission still recognizes the mission', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-iwad', 'doom/freedoom1.wad'));
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(context.iwad.source).toBe('iwad-flag');
    expect(context.iwad.resolvedPath).toBe('doom/freedoom1.wad');
    expect(context.iwad.matchedFilename).toBeNull();
    expect(context.iwad.gameMode).toBe('indetermined');
    expect(context.iwad.gameMission).toBe('doom');
  });

  test('iwad-flag mode: Windows backslash separators in -iwad path are accepted when extracting the basename', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-iwad', 'C:\\games\\doom\\DOOM1.WAD'));
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(context.iwad.source).toBe('iwad-flag');
    expect(context.iwad.matchedFilename).toBe('doom1.wad');
  });

  test('discovery mode: walks the full seven-candidate probe sequence when no IWAD is present and returns indetermined', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector());
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(context.iwad.source).toBe('discovery');
    expect(context.iwad.matchedFilename).toBeNull();
    expect(context.iwad.gameMode).toBe('indetermined');
    expect(context.iwad.gameMission).toBe('none');
    expect(context.iwad.probedSequence).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);
    expect(context.iwad.searchDirectory).toBe('.');
  });

  test('discovery mode: only doom1.wad present matches and pins shareware', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector());
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames(['doom1.wad']));
    expect(context.iwad.source).toBe('discovery');
    expect(context.iwad.matchedFilename).toBe('doom1.wad');
    expect(context.iwad.gameMode).toBe('shareware');
    expect(context.iwad.probedSequence).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);
    expect(context.iwad.resolvedPath).toBe('./doom1.wad');
  });

  test('discovery mode: first-match-wins by probe order — doom.wad beats doom1.wad', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector());
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames(['doom.wad', 'doom1.wad']));
    expect(context.iwad.source).toBe('discovery');
    expect(context.iwad.matchedFilename).toBe('doom.wad');
    expect(context.iwad.gameMode).toBe('registered');
    expect(context.iwad.probedSequence).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad']);
    expect(context.iwad.resolvedPath).toBe('./doom.wad');
  });

  test('discovery mode: doomu.wad beats doom.wad (retail beats registered) under canonical probe order', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector());
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames(['doomu.wad', 'doom.wad']));
    expect(context.iwad.matchedFilename).toBe('doomu.wad');
    expect(context.iwad.gameMode).toBe('retail');
    expect(context.iwad.probedSequence).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad']);
  });

  test('discovery mode: doom2f.wad alone matches and stops the probe at the first candidate', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector());
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames(['doom2f.wad']));
    expect(context.iwad.matchedFilename).toBe('doom2f.wad');
    expect(context.iwad.gameMode).toBe('commercial');
    expect(context.iwad.probedSequence).toEqual(['doom2f.wad']);
  });

  test('discovery mode: DOOMWADDIR override prefixes every candidate path with the supplied directory', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector());
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames(['doom1.wad'], '/iwad'));
    expect(context.iwad.source).toBe('discovery');
    expect(context.iwad.matchedFilename).toBe('doom1.wad');
    expect(context.iwad.searchDirectory).toBe('/iwad');
    expect(context.iwad.resolvedPath).toBe('/iwad/doom1.wad');
  });

  test('discovery mode: DOOMWADDIR=null falls back to the literal current-working-directory prefix "."', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector());
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames(['doom1.wad'], null));
    expect(context.iwad.searchDirectory).toBe('.');
    expect(context.iwad.resolvedPath).toBe('./doom1.wad');
  });

  test('discovery mode: every canonical candidate basename roundtrips through the probe sequence (length matches VANILLA_IWAD_CANDIDATES)', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector());
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(context.iwad.probedSequence.length).toBe(VANILLA_IWAD_CANDIDATES.length);
    for (let candidateIndex = 0; candidateIndex < VANILLA_IWAD_CANDIDATES.length; candidateIndex += 1) {
      expect(context.iwad.probedSequence[candidateIndex]).toBe(VANILLA_IWAD_CANDIDATES[candidateIndex]!.filename);
    }
  });

  test('defaultConfigPath: falls back to literal "default.cfg" when -config is absent', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector());
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(context.defaultConfigPath).toBe('default.cfg');
  });

  test('defaultConfigPath: -config <path> override honors the explicit path verbatim', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-config', 'saves/override-default.cfg'));
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(context.defaultConfigPath).toBe('saves/override-default.cfg');
  });

  test('hostConfigPath: always falls back to literal "chocolate-doom.cfg" (no -extraconfig wired in plan_final 03-003)', () => {
    const configurationWithoutConfig = parseCommandLineConfiguration(buildArgumentVector());
    const contextWithoutConfig = resolveLaunchContext(configurationWithoutConfig, buildEnvironmentWithPresentBasenames([]));
    expect(contextWithoutConfig.hostConfigPath).toBe('chocolate-doom.cfg');

    const configurationWithConfig = parseCommandLineConfiguration(buildArgumentVector('-config', 'override.cfg'));
    const contextWithConfig = resolveLaunchContext(configurationWithConfig, buildEnvironmentWithPresentBasenames([]));
    expect(contextWithConfig.hostConfigPath).toBe('chocolate-doom.cfg');
  });

  test('saveDirectory: falls back to literal "." when -savedir is absent', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector());
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(context.saveDirectory).toBe('.');
  });

  test('saveDirectory: -savedir <path> override honors the explicit path verbatim', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-savedir', 'C:/dosgames/doom/saves'));
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(context.saveDirectory).toBe('C:/dosgames/doom/saves');
  });

  test('full launch context: composite argv with every wired flag flows through every slot simultaneously', () => {
    const configuration: CommandLineConfiguration = parseCommandLineConfiguration(buildArgumentVector('-iwad', 'doom/DOOM1.WAD', '-config', 'saves/main.cfg', '-savedir', 'saves/'));
    const context: LaunchContext = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames([]));
    expect(context.iwad.source).toBe('iwad-flag');
    expect(context.iwad.resolvedPath).toBe('doom/DOOM1.WAD');
    expect(context.iwad.gameMode).toBe('shareware');
    expect(context.defaultConfigPath).toBe('saves/main.cfg');
    expect(context.hostConfigPath).toBe('chocolate-doom.cfg');
    expect(context.saveDirectory).toBe('saves/');
  });

  test('full launch context: discovery + DOOMWADDIR + -savedir interact correctly', () => {
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-savedir', 'saves/'));
    const context = resolveLaunchContext(configuration, buildEnvironmentWithPresentBasenames(['doom.wad', 'doom1.wad'], '/iwad'));
    expect(context.iwad.source).toBe('discovery');
    expect(context.iwad.matchedFilename).toBe('doom.wad');
    expect(context.iwad.resolvedPath).toBe('/iwad/doom.wad');
    expect(context.iwad.searchDirectory).toBe('/iwad');
    expect(context.defaultConfigPath).toBe('default.cfg');
    expect(context.hostConfigPath).toBe('chocolate-doom.cfg');
    expect(context.saveDirectory).toBe('saves/');
  });

  test('discovery mode: does not invoke doesBasenameExistInWadDirectory when -iwad is supplied (iwad-flag short-circuits the probe)', () => {
    let probeInvocations = 0;
    const trackingEnvironment: LaunchContextEnvironment = Object.freeze({
      doesBasenameExistInWadDirectory: () => {
        probeInvocations += 1;
        return false;
      },
      doomWadDirectoryEnvironmentValue: null,
    });
    const configuration = parseCommandLineConfiguration(buildArgumentVector('-iwad', 'doom/DOOM1.WAD'));
    resolveLaunchContext(configuration, trackingEnvironment);
    expect(probeInvocations).toBe(0);
  });

  test('discovery mode: stops invoking doesBasenameExistInWadDirectory after the first match', () => {
    const probedCandidates: string[] = [];
    const trackingEnvironment: LaunchContextEnvironment = Object.freeze({
      doesBasenameExistInWadDirectory: (basename: VanillaIwadCandidate['filename']) => {
        probedCandidates.push(basename);
        return basename === 'doom.wad';
      },
      doomWadDirectoryEnvironmentValue: null,
    });
    const configuration = parseCommandLineConfiguration(buildArgumentVector());
    resolveLaunchContext(configuration, trackingEnvironment);
    expect(probedCandidates).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad']);
  });
});
