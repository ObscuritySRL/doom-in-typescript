/**
 * Game mode identification matching Chocolate Doom 2.2.1 D_IdentifyVersion.
 *
 * Determines the game mode, mission, and description from the IWAD filename
 * and lump directory contents, following the same detection algorithm as the
 * canonical reference engine.
 *
 * @example
 * ```ts
 * import { identifyGame } from "../src/bootstrap/gameMode.ts";
 * const result = identifyGame("doom1.wad", { hasLump: (n) => n === "E1M1" });
 * result.gameMode; // "shareware"
 * ```
 */

/**
 * Game mode determines episode/map structure and content restrictions.
 * Matches Chocolate Doom 2.2.1 GameMode_t.
 */
export type GameMode = 'commercial' | 'indetermined' | 'registered' | 'retail' | 'shareware';

/**
 * Game mission identifies the specific IWAD or campaign.
 * Matches Chocolate Doom 2.2.1 GameMission_t.
 */
export type GameMission = 'doom' | 'doom2' | 'none' | 'pack_chex' | 'pack_hacx' | 'pack_plut' | 'pack_tnt';

/**
 * Game version determines which engine behavior quirks to emulate.
 * Matches Chocolate Doom 2.2.1 GameVersion_t.
 */
export type GameVersion = 'exe_chex' | 'exe_doom_1_2' | 'exe_doom_1_666' | 'exe_doom_1_7' | 'exe_doom_1_8' | 'exe_doom_1_9' | 'exe_final' | 'exe_final2' | 'exe_hacx' | 'exe_ultimate';

/** All valid game modes in ASCIIbetical order. */
export const GAME_MODES: readonly GameMode[] = Object.freeze(['commercial', 'indetermined', 'registered', 'retail', 'shareware']);

/** All valid game missions in ASCIIbetical order. */
export const GAME_MISSIONS: readonly GameMission[] = Object.freeze(['doom', 'doom2', 'none', 'pack_chex', 'pack_hacx', 'pack_plut', 'pack_tnt']);

/** All valid game versions in ASCIIbetical order. */
export const GAME_VERSIONS: readonly GameVersion[] = Object.freeze(['exe_chex', 'exe_doom_1_2', 'exe_doom_1_666', 'exe_doom_1_7', 'exe_doom_1_8', 'exe_doom_1_9', 'exe_final', 'exe_final2', 'exe_hacx', 'exe_ultimate']);

/** Maximum selectable episode number per game mode. */
export const EPISODE_COUNTS: Readonly<Record<GameMode, number>> = Object.freeze({
  commercial: 1,
  indetermined: 0,
  registered: 3,
  retail: 4,
  shareware: 1,
});

/** Minimal interface for checking lump presence in a WAD. */
export interface LumpChecker {
  hasLump(name: string): boolean;
}

interface OrderedLumpChecker extends LumpChecker {
  getAllIndicesForName(name: string): readonly number[];
}

/** Result of game mode identification. */
export interface GameIdentification {
  readonly episodeCount: number;
  readonly gameDescription: string;
  readonly gameMission: GameMission;
  readonly gameMode: GameMode;
}

/**
 * IWAD filename to game mission mapping.
 * Entries are in ASCIIbetical key order.
 */
const IWAD_MISSION_MAP: ReadonlyMap<string, GameMission> = new Map([
  ['chex.wad', 'pack_chex'],
  ['doom.wad', 'doom'],
  ['doom1.wad', 'doom'],
  ['doom2.wad', 'doom2'],
  ['freedm.wad', 'doom2'],
  ['freedoom1.wad', 'doom'],
  ['freedoom2.wad', 'doom2'],
  ['hacx.wad', 'pack_hacx'],
  ['plutonia.wad', 'pack_plut'],
  ['tnt.wad', 'pack_tnt'],
]);

function hasOrderedLumpAccess(lumps: LumpChecker): lumps is OrderedLumpChecker {
  return 'getAllIndicesForName' in lumps && typeof Reflect.get(lumps, 'getAllIndicesForName') === 'function';
}

/**
 * Identify game mission from an IWAD filename.
 *
 * Strips any directory prefix and compares the basename case-insensitively
 * against the known IWAD table.  Returns `"none"` for unrecognized filenames.
 *
 * @param iwadFilename - IWAD filename or full path.
 */
export function identifyMission(iwadFilename: string): GameMission {
  const segments = iwadFilename.split(/[/\\]/);
  const basename = segments[segments.length - 1]!.toLowerCase();
  return IWAD_MISSION_MAP.get(basename) ?? 'none';
}

/**
 * Identify game mode from mission and WAD lump contents.
 *
 * Matches Chocolate Doom 2.2.1 D_IdentifyVersion:
 * - `doom` mission: check E4M1 / E3M1 for retail / registered / shareware
 * - Commercial missions: always `"commercial"`
 * - `pack_chex`: always `"retail"`
 * - `"none"` mission: lump-based fallback (MAP01 vs E1M1 probes)
 *
 * @param mission - Game mission from {@link identifyMission}.
 * @param lumps   - Lump presence checker (e.g. a LumpLookup).
 */
export function identifyMode(mission: GameMission, lumps: LumpChecker): GameMode {
  switch (mission) {
    case 'doom':
      if (lumps.hasLump('E4M1')) return 'retail';
      if (lumps.hasLump('E3M1')) return 'registered';
      return 'shareware';
    case 'doom2':
    case 'pack_hacx':
    case 'pack_plut':
    case 'pack_tnt':
      return 'commercial';
    case 'pack_chex':
      return 'retail';
    case 'none':
      if (hasOrderedLumpAccess(lumps)) {
        const firstEpisodeMapIndex = lumps.getAllIndicesForName('E1M1')[0] ?? Number.POSITIVE_INFINITY;
        const firstMap01Index = lumps.getAllIndicesForName('MAP01')[0] ?? Number.POSITIVE_INFINITY;

        if (firstMap01Index < firstEpisodeMapIndex) {
          return 'commercial';
        }

        if (firstEpisodeMapIndex < firstMap01Index) {
          if (lumps.hasLump('E4M1')) return 'retail';
          if (lumps.hasLump('E3M1')) return 'registered';
          return 'shareware';
        }
      }

      if (lumps.hasLump('MAP01')) return 'commercial';
      if (lumps.hasLump('E1M1')) {
        if (lumps.hasLump('E4M1')) return 'retail';
        if (lumps.hasLump('E3M1')) return 'registered';
        return 'shareware';
      }
      return 'indetermined';
  }
}

/**
 * Get the game description string for a mode + mission pair.
 *
 * Matches Chocolate Doom 2.2.1 D_SetGameDescription (excluding
 * Freedoom-specific descriptions which require a separate lump check).
 *
 * @param mode    - Identified game mode.
 * @param mission - Identified game mission.
 */
export function getGameDescription(mode: GameMode, mission: GameMission): string {
  switch (mode) {
    case 'commercial':
      switch (mission) {
        case 'doom2':
          return 'DOOM 2: Hell on Earth';
        case 'pack_hacx':
          return "HACX - Twitch 'n Kill";
        case 'pack_plut':
          return 'DOOM 2: Plutonia Experiment';
        case 'pack_tnt':
          return 'DOOM 2: TNT - Evilution';
        default:
          return 'DOOM 2: Hell on Earth';
      }
    case 'indetermined':
      return 'Unknown game';
    case 'registered':
      return 'DOOM Registered';
    case 'retail':
      if (mission === 'pack_chex') return 'Chex Quest';
      return 'The Ultimate DOOM';
    case 'shareware':
      return 'DOOM Shareware';
  }
}

/**
 * Get the maximum selectable episode count for a game mode.
 *
 * @param mode - Identified game mode.
 */
export function getEpisodeCount(mode: GameMode): number {
  return EPISODE_COUNTS[mode];
}

/**
 * Full game mode identification from IWAD filename and lump contents.
 *
 * Combines {@link identifyMission}, {@link identifyMode}, and
 * {@link getGameDescription} into a single frozen result object.
 * When the initial mission is `"none"` (unknown IWAD filename), the
 * mission is refined based on detected lump contents.
 *
 * @param iwadFilename - IWAD filename or full path.
 * @param lumps        - Lump presence checker.
 */
export function identifyGame(iwadFilename: string, lumps: LumpChecker): GameIdentification {
  let gameMission = identifyMission(iwadFilename);
  const gameMode = identifyMode(gameMission, lumps);

  if (gameMission === 'none' && gameMode !== 'indetermined') {
    gameMission = gameMode === 'commercial' ? 'doom2' : 'doom';
  }

  return Object.freeze({
    episodeCount: EPISODE_COUNTS[gameMode],
    gameDescription: getGameDescription(gameMode, gameMission),
    gameMission,
    gameMode,
  });
}
