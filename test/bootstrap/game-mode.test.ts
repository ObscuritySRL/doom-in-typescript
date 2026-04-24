import { describe, expect, it } from 'bun:test';

import type { GameIdentification, LumpChecker } from '../../src/bootstrap/gameMode.ts';
import { EPISODE_COUNTS, GAME_MISSIONS, GAME_MODES, GAME_VERSIONS, getEpisodeCount, getGameDescription, identifyGame, identifyMission, identifyMode } from '../../src/bootstrap/gameMode.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';

interface OrderedTestLumpChecker extends LumpChecker {
  getAllIndicesForName(name: string): readonly number[];
}

function makeLumpChecker(lumps: readonly string[]): OrderedTestLumpChecker {
  const indicesByName = new Map<string, number[]>();

  for (let index = 0; index < lumps.length; index++) {
    const upperName = lumps[index]!.toUpperCase();
    const indices = indicesByName.get(upperName);

    if (indices === undefined) {
      indicesByName.set(upperName, [index]);
      continue;
    }

    indices.push(index);
  }

  return {
    getAllIndicesForName: (name: string) => Object.freeze([...(indicesByName.get(name.toUpperCase()) ?? [])]),
    hasLump: (name: string) => indicesByName.has(name.toUpperCase()),
  };
}

/** Shareware DOOM1.WAD: E1M1–E1M9 only. */
const SHAREWARE_LUMPS = makeLumpChecker(['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9']);

/** Registered DOOM.WAD: E1M1–E3M9. */
const REGISTERED_LUMPS = makeLumpChecker([
  'E1M1',
  'E1M2',
  'E1M3',
  'E1M4',
  'E1M5',
  'E1M6',
  'E1M7',
  'E1M8',
  'E1M9',
  'E2M1',
  'E2M2',
  'E2M3',
  'E2M4',
  'E2M5',
  'E2M6',
  'E2M7',
  'E2M8',
  'E2M9',
  'E3M1',
  'E3M2',
  'E3M3',
  'E3M4',
  'E3M5',
  'E3M6',
  'E3M7',
  'E3M8',
  'E3M9',
]);

/** Retail (Ultimate Doom) DOOM.WAD: E1M1–E4M9. */
const RETAIL_LUMPS = makeLumpChecker([
  'E1M1',
  'E1M2',
  'E1M3',
  'E1M4',
  'E1M5',
  'E1M6',
  'E1M7',
  'E1M8',
  'E1M9',
  'E2M1',
  'E2M2',
  'E2M3',
  'E2M4',
  'E2M5',
  'E2M6',
  'E2M7',
  'E2M8',
  'E2M9',
  'E3M1',
  'E3M2',
  'E3M3',
  'E3M4',
  'E3M5',
  'E3M6',
  'E3M7',
  'E3M8',
  'E3M9',
  'E4M1',
  'E4M2',
  'E4M3',
  'E4M4',
  'E4M5',
  'E4M6',
  'E4M7',
  'E4M8',
  'E4M9',
]);

/** Commercial (Doom II) DOOM2.WAD: MAP01–MAP32. */
const COMMERCIAL_LUMPS = makeLumpChecker(Array.from({ length: 32 }, (_, index) => `MAP${String(index + 1).padStart(2, '0')}`));

/** Empty WAD with no recognizable map lumps. */
const EMPTY_LUMPS = makeLumpChecker([]);

describe('GAME_MODES', () => {
  it('contains exactly 5 modes', () => {
    expect(GAME_MODES).toHaveLength(5);
  });

  it('includes all standard modes', () => {
    expect(GAME_MODES).toContain('commercial');
    expect(GAME_MODES).toContain('indetermined');
    expect(GAME_MODES).toContain('registered');
    expect(GAME_MODES).toContain('retail');
    expect(GAME_MODES).toContain('shareware');
  });

  it('is sorted in ASCIIbetical order', () => {
    const sorted = [...GAME_MODES].sort();
    expect(GAME_MODES).toEqual(sorted);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(GAME_MODES)).toBe(true);
  });
});

describe('GAME_MISSIONS', () => {
  it('contains exactly 7 missions', () => {
    expect(GAME_MISSIONS).toHaveLength(7);
  });

  it('includes all missions', () => {
    expect(GAME_MISSIONS).toContain('doom');
    expect(GAME_MISSIONS).toContain('doom2');
    expect(GAME_MISSIONS).toContain('none');
    expect(GAME_MISSIONS).toContain('pack_chex');
    expect(GAME_MISSIONS).toContain('pack_hacx');
    expect(GAME_MISSIONS).toContain('pack_plut');
    expect(GAME_MISSIONS).toContain('pack_tnt');
  });

  it('is sorted in ASCIIbetical order', () => {
    const sorted = [...GAME_MISSIONS].sort();
    expect(GAME_MISSIONS).toEqual(sorted);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(GAME_MISSIONS)).toBe(true);
  });
});

describe('GAME_VERSIONS', () => {
  it('contains exactly 10 versions', () => {
    expect(GAME_VERSIONS).toHaveLength(10);
  });

  it('includes exe_doom_1_9 for the reference target', () => {
    expect(GAME_VERSIONS).toContain('exe_doom_1_9');
  });

  it('is sorted in ASCIIbetical order', () => {
    const sorted = [...GAME_VERSIONS].sort();
    expect(GAME_VERSIONS).toEqual(sorted);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(GAME_VERSIONS)).toBe(true);
  });
});

describe('EPISODE_COUNTS', () => {
  it('shareware has 1 episode', () => {
    expect(EPISODE_COUNTS.shareware).toBe(1);
  });

  it('registered has 3 episodes', () => {
    expect(EPISODE_COUNTS.registered).toBe(3);
  });

  it('retail has 4 episodes', () => {
    expect(EPISODE_COUNTS.retail).toBe(4);
  });

  it('commercial has 1 episode', () => {
    expect(EPISODE_COUNTS.commercial).toBe(1);
  });

  it('indetermined has 0 episodes', () => {
    expect(EPISODE_COUNTS.indetermined).toBe(0);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(EPISODE_COUNTS)).toBe(true);
  });

  it('has an entry for every game mode', () => {
    for (const mode of GAME_MODES) {
      expect(EPISODE_COUNTS[mode]).toBeDefined();
    }
  });
});

describe('identifyMission', () => {
  it('maps doom1.wad to doom', () => {
    expect(identifyMission('doom1.wad')).toBe('doom');
  });

  it('maps doom.wad to doom', () => {
    expect(identifyMission('doom.wad')).toBe('doom');
  });

  it('maps doom2.wad to doom2', () => {
    expect(identifyMission('doom2.wad')).toBe('doom2');
  });

  it('maps tnt.wad to pack_tnt', () => {
    expect(identifyMission('tnt.wad')).toBe('pack_tnt');
  });

  it('maps plutonia.wad to pack_plut', () => {
    expect(identifyMission('plutonia.wad')).toBe('pack_plut');
  });

  it('maps chex.wad to pack_chex', () => {
    expect(identifyMission('chex.wad')).toBe('pack_chex');
  });

  it('maps hacx.wad to pack_hacx', () => {
    expect(identifyMission('hacx.wad')).toBe('pack_hacx');
  });

  it('is case-insensitive', () => {
    expect(identifyMission('DOOM1.WAD')).toBe('doom');
    expect(identifyMission('Doom2.WAD')).toBe('doom2');
  });

  it('strips forward-slash directory path', () => {
    expect(identifyMission('/path/to/doom1.wad')).toBe('doom');
  });

  it('strips backslash directory path', () => {
    expect(identifyMission('C:\\Games\\doom1.wad')).toBe('doom');
  });

  it('returns none for unknown filenames', () => {
    expect(identifyMission('custom.wad')).toBe('none');
    expect(identifyMission('mymod.wad')).toBe('none');
  });

  it('maps Freedoom IWADs to their base missions', () => {
    expect(identifyMission('freedoom1.wad')).toBe('doom');
    expect(identifyMission('freedoom2.wad')).toBe('doom2');
    expect(identifyMission('freedm.wad')).toBe('doom2');
  });

  it('returns none for empty string', () => {
    expect(identifyMission('')).toBe('none');
  });
});

describe('identifyMode', () => {
  it('doom mission with only E1 maps returns shareware', () => {
    expect(identifyMode('doom', SHAREWARE_LUMPS)).toBe('shareware');
  });

  it('doom mission with E3M1 but not E4M1 returns registered', () => {
    expect(identifyMode('doom', REGISTERED_LUMPS)).toBe('registered');
  });

  it('doom mission with E4M1 returns retail', () => {
    expect(identifyMode('doom', RETAIL_LUMPS)).toBe('retail');
  });

  it('doom2 mission returns commercial', () => {
    expect(identifyMode('doom2', COMMERCIAL_LUMPS)).toBe('commercial');
  });

  it('pack_tnt mission returns commercial', () => {
    expect(identifyMode('pack_tnt', COMMERCIAL_LUMPS)).toBe('commercial');
  });

  it('pack_plut mission returns commercial', () => {
    expect(identifyMode('pack_plut', COMMERCIAL_LUMPS)).toBe('commercial');
  });

  it('pack_chex mission returns retail', () => {
    expect(identifyMode('pack_chex', SHAREWARE_LUMPS)).toBe('retail');
  });

  it('pack_hacx mission returns commercial', () => {
    expect(identifyMode('pack_hacx', COMMERCIAL_LUMPS)).toBe('commercial');
  });

  it('none mission with MAP01 returns commercial', () => {
    expect(identifyMode('none', COMMERCIAL_LUMPS)).toBe('commercial');
  });

  it('none mission with E1M1 only returns shareware', () => {
    expect(identifyMode('none', SHAREWARE_LUMPS)).toBe('shareware');
  });

  it('none mission with E3M1 returns registered', () => {
    expect(identifyMode('none', REGISTERED_LUMPS)).toBe('registered');
  });

  it('none mission with E4M1 returns retail', () => {
    expect(identifyMode('none', RETAIL_LUMPS)).toBe('retail');
  });

  it('none mission with no lumps returns indetermined', () => {
    expect(identifyMode('none', EMPTY_LUMPS)).toBe('indetermined');
  });

  it('commercial missions ignore lump contents', () => {
    expect(identifyMode('doom2', EMPTY_LUMPS)).toBe('commercial');
    expect(identifyMode('pack_tnt', SHAREWARE_LUMPS)).toBe('commercial');
  });
});

describe('getGameDescription', () => {
  it('shareware + doom', () => {
    expect(getGameDescription('shareware', 'doom')).toBe('DOOM Shareware');
  });

  it('registered + doom', () => {
    expect(getGameDescription('registered', 'doom')).toBe('DOOM Registered');
  });

  it('retail + doom', () => {
    expect(getGameDescription('retail', 'doom')).toBe('The Ultimate DOOM');
  });

  it('commercial + doom2', () => {
    expect(getGameDescription('commercial', 'doom2')).toBe('DOOM 2: Hell on Earth');
  });

  it('commercial + pack_tnt', () => {
    expect(getGameDescription('commercial', 'pack_tnt')).toBe('DOOM 2: TNT - Evilution');
  });

  it('commercial + pack_plut', () => {
    expect(getGameDescription('commercial', 'pack_plut')).toBe('DOOM 2: Plutonia Experiment');
  });

  it('retail + pack_chex', () => {
    expect(getGameDescription('retail', 'pack_chex')).toBe('Chex Quest');
  });

  it('commercial + pack_hacx', () => {
    expect(getGameDescription('commercial', 'pack_hacx')).toBe("HACX - Twitch 'n Kill");
  });

  it('indetermined + none', () => {
    expect(getGameDescription('indetermined', 'none')).toBe('Unknown game');
  });
});

describe('getEpisodeCount', () => {
  it('returns correct count for each mode', () => {
    expect(getEpisodeCount('shareware')).toBe(1);
    expect(getEpisodeCount('registered')).toBe(3);
    expect(getEpisodeCount('retail')).toBe(4);
    expect(getEpisodeCount('commercial')).toBe(1);
    expect(getEpisodeCount('indetermined')).toBe(0);
  });
});

describe('identifyGame', () => {
  it('identifies shareware from doom1.wad', () => {
    const result = identifyGame('doom1.wad', SHAREWARE_LUMPS);
    expect(result.gameMode).toBe('shareware');
    expect(result.gameMission).toBe('doom');
    expect(result.gameDescription).toBe('DOOM Shareware');
    expect(result.episodeCount).toBe(1);
  });

  it('identifies registered from doom.wad with 3 episodes', () => {
    const result = identifyGame('doom.wad', REGISTERED_LUMPS);
    expect(result.gameMode).toBe('registered');
    expect(result.gameMission).toBe('doom');
    expect(result.gameDescription).toBe('DOOM Registered');
    expect(result.episodeCount).toBe(3);
  });

  it('identifies retail from doom.wad with 4 episodes', () => {
    const result = identifyGame('doom.wad', RETAIL_LUMPS);
    expect(result.gameMode).toBe('retail');
    expect(result.gameMission).toBe('doom');
    expect(result.gameDescription).toBe('The Ultimate DOOM');
    expect(result.episodeCount).toBe(4);
  });

  it('identifies Doom II from doom2.wad', () => {
    const result = identifyGame('doom2.wad', COMMERCIAL_LUMPS);
    expect(result.gameMode).toBe('commercial');
    expect(result.gameMission).toBe('doom2');
    expect(result.gameDescription).toBe('DOOM 2: Hell on Earth');
    expect(result.episodeCount).toBe(1);
  });

  it('identifies TNT from tnt.wad', () => {
    const result = identifyGame('tnt.wad', COMMERCIAL_LUMPS);
    expect(result.gameMission).toBe('pack_tnt');
    expect(result.gameDescription).toBe('DOOM 2: TNT - Evilution');
  });

  it('identifies Plutonia from plutonia.wad', () => {
    const result = identifyGame('plutonia.wad', COMMERCIAL_LUMPS);
    expect(result.gameMission).toBe('pack_plut');
    expect(result.gameDescription).toBe('DOOM 2: Plutonia Experiment');
  });

  it('result is frozen', () => {
    const result = identifyGame('doom1.wad', SHAREWARE_LUMPS);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('refines none mission to doom on lump-based fallback', () => {
    const result = identifyGame('custom.wad', SHAREWARE_LUMPS);
    expect(result.gameMode).toBe('shareware');
    expect(result.gameMission).toBe('doom');
  });

  it('refines none mission to doom2 on lump-based fallback', () => {
    const result = identifyGame('custom.wad', COMMERCIAL_LUMPS);
    expect(result.gameMode).toBe('commercial');
    expect(result.gameMission).toBe('doom2');
  });

  it('keeps none mission when indetermined', () => {
    const result = identifyGame('custom.wad', EMPTY_LUMPS);
    expect(result.gameMode).toBe('indetermined');
    expect(result.gameMission).toBe('none');
    expect(result.gameDescription).toBe('Unknown game');
    expect(result.episodeCount).toBe(0);
  });
});

describe('reference target cross-reference', () => {
  it('PRIMARY_TARGET.gameMode matches shareware identification', () => {
    const result = identifyGame(PRIMARY_TARGET.wadFilename, SHAREWARE_LUMPS);
    const modeString: string = result.gameMode;
    expect(modeString).toBe(PRIMARY_TARGET.gameMode);
  });

  it('stdout banner matches game description', () => {
    const result = identifyGame('doom1.wad', SHAREWARE_LUMPS);
    expect(result.gameDescription).toBe('DOOM Shareware');
  });

  it('shareware episode count is 1 matching single-episode DOOM1.WAD (F-017)', () => {
    const result = identifyGame(PRIMARY_TARGET.wadFilename, SHAREWARE_LUMPS);
    expect(result.episodeCount).toBe(1);
  });

  it('reference WAD filename doom1.wad maps to doom mission (F-029)', () => {
    expect(identifyMission('doom1.wad')).toBe('doom');
  });
});

describe('parity-sensitive edge cases', () => {
  it('E4M1 takes priority over E3M1 for doom mission', () => {
    expect(identifyMode('doom', RETAIL_LUMPS)).toBe('retail');
  });

  it('unknown-IWAD fallback follows directory order when MAP01 and E1M1 both exist', () => {
    const doomFirst = makeLumpChecker(['E1M1', 'MAP01']);
    expect(identifyMode('none', doomFirst)).toBe('shareware');
    expect(identifyGame('custom.wad', doomFirst).gameMission).toBe('doom');

    const doom2First = makeLumpChecker(['MAP01', 'E1M1']);
    expect(identifyMode('none', doom2First)).toBe('commercial');
    expect(identifyGame('custom.wad', doom2First).gameMission).toBe('doom2');
  });

  it('mission does not change for known IWADs regardless of lump contents', () => {
    const result = identifyGame('doom2.wad', EMPTY_LUMPS);
    expect(result.gameMission).toBe('doom2');
    expect(result.gameMode).toBe('commercial');
  });

  it('DOOM1.WAD shareware has E1 maps but none from E2/E3/E4 (F-017)', () => {
    expect(SHAREWARE_LUMPS.hasLump('E1M1')).toBe(true);
    expect(SHAREWARE_LUMPS.hasLump('E2M1')).toBe(false);
    expect(SHAREWARE_LUMPS.hasLump('E3M1')).toBe(false);
    expect(SHAREWARE_LUMPS.hasLump('E4M1')).toBe(false);
  });

  it('F-029 core game modes are all present', () => {
    expect(GAME_MODES).toContain('shareware');
    expect(GAME_MODES).toContain('registered');
    expect(GAME_MODES).toContain('retail');
    expect(GAME_MODES).toContain('commercial');
  });

  it('F-029 core game missions are all present', () => {
    expect(GAME_MISSIONS).toContain('doom');
    expect(GAME_MISSIONS).toContain('doom2');
    expect(GAME_MISSIONS).toContain('pack_tnt');
    expect(GAME_MISSIONS).toContain('pack_plut');
  });

  it('GameIdentification satisfies expected interface shape', () => {
    const result: GameIdentification = identifyGame('doom1.wad', SHAREWARE_LUMPS);
    expect(typeof result.episodeCount).toBe('number');
    expect(typeof result.gameDescription).toBe('string');
    expect(typeof result.gameMission).toBe('string');
    expect(typeof result.gameMode).toBe('string');
  });

  it('stdout DOOM Shareware banner matches reference identification', () => {
    const result = identifyGame(PRIMARY_TARGET.wadFilename, SHAREWARE_LUMPS);
    expect('DOOM Shareware').toBe(result.gameDescription);
  });
});
