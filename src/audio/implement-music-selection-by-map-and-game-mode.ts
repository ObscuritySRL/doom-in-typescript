/**
 * Vanilla DOOM 1.9 music selection by map and game mode contract.
 *
 * From Chocolate Doom 2.2.1 s_sound.c S_ChangeMusic, sounds.c S_music[]
 * table, and g_game.c map-to-music binding:
 *
 *   DOOM 1 (shareware / registered / Ultimate) uses the D_E#M# naming
 *   pattern for episode-keyed maps:
 *     E1M1 -> D_E1M1, E1M2 -> D_E1M2, ..., E1M9 -> D_E1M9
 *     E2M1 -> D_E2M1, ..., E2M9 -> D_E2M9
 *     E3M1 -> D_E3M1, ..., E3M9 -> D_E3M9
 *     E4M1 -> D_E1M1 (Ultimate reuses E1M1 music for E4M1 etc.)
 *
 *   DOOM 2 uses the D_RUNNIN-style flat name pattern indexed by map
 *   number (MAP01..MAP35 -> D_RUNNIN/D_STALKS/D_COUNTD/...):
 *     MAP01 -> D_RUNNIN, MAP02 -> D_STALKS, ..., MAP30 -> D_OPENIN
 *
 *   Intermission / title / finale lumps (shared across game modes):
 *     D_INTERM — intermission scoreboard music
 *     D_INTRO  — title screen music
 *     D_VICTOR — episode-end "Victory" screen music
 *     D_BUNNY  — DOOM 1 E1/E2/E3 bunny-scroll music
 *     D_READ_M — finale "reading" screen music (DOOM 2)
 *     D_OPENIN — DOOM 2 finale music
 *
 *   The shareware IWAD only contains the E1 lumps (D_E1M1..D_E1M9)
 *   plus the shared D_INTRO / D_INTERM / D_VICTOR / D_BUNNY tracks.
 *   Attempting to play a missing music lump throws — vanilla relies on
 *   the IWAD-mode check to never request a lump that isn't shipped.
 */

export type VanillaGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

export function vanillaMusicLumpForDoom1Map(episode: number, mapInEpisode: number): string {
  if (episode < 1 || episode > 4 || mapInEpisode < 1 || mapInEpisode > 9) {
    throw new RangeError(`DOOM 1 episode/map out of range: E${episode}M${mapInEpisode}`);
  }
  // Ultimate Doom (Episode 4) reuses E1 music tracks 1..9.
  const musicEpisode = episode === 4 ? 1 : episode;
  return `D_E${musicEpisode}M${mapInEpisode}`;
}

export const VANILLA_DOOM2_MUSIC_LUMPS_BY_MAP: readonly string[] = Object.freeze([
  'D_RUNNIN',
  'D_STALKS',
  'D_COUNTD',
  'D_BETWEE',
  'D_DOOM',
  'D_THE_DA',
  'D_SHAWN',
  'D_DDTBLU',
  'D_IN_CIT',
  'D_DEAD',
  'D_STLKS2',
  'D_THEDA2',
  'D_DOOM2',
  'D_DDTBL2',
  'D_RUNNI2',
  'D_DEAD2',
  'D_STLKS3',
  'D_ROMERO',
  'D_SHAWN2',
  'D_MESSAG',
  'D_COUNT2',
  'D_DDTBL3',
  'D_AMPIE',
  'D_THEDA3',
  'D_ADRIAN',
  'D_MESSG2',
  'D_ROMER2',
  'D_TENSE',
  'D_SHAWN3',
  'D_OPENIN',
  'D_EVIL',
  'D_ULTIMA',
  'D_READ_M',
  'D_DM2TTL',
  'D_DM2INT',
]);

export function vanillaMusicLumpForDoom2Map(mapNumber: number): string {
  if (mapNumber < 1 || mapNumber > VANILLA_DOOM2_MUSIC_LUMPS_BY_MAP.length) {
    throw new RangeError(`DOOM 2 map out of range: MAP${String(mapNumber).padStart(2, '0')}`);
  }
  return VANILLA_DOOM2_MUSIC_LUMPS_BY_MAP[mapNumber - 1]!;
}

/**
 * DOOM 1 shared music lumps shipped in every IWAD tier (shareware
 * through Ultimate). D_BUNNY is registered+ only and lives in
 * VANILLA_REGISTERED_ONLY_MUSIC_LUMPS. D_INTROA is the cycling secondary
 * title music vanilla rotates with D_INTRO between demo loops.
 */
export const VANILLA_SHARED_MUSIC_LUMPS = Object.freeze({
  intro: 'D_INTRO',
  introAlternate: 'D_INTROA',
  intermission: 'D_INTER',
  victory: 'D_VICTOR',
});

export const VANILLA_REGISTERED_ONLY_MUSIC_LUMPS = Object.freeze({
  bunny: 'D_BUNNY',
});

export const VANILLA_SHAREWARE_AVAILABLE_MUSIC_EPISODES: readonly number[] = Object.freeze([1]);
