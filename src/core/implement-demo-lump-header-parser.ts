/**
 * Vanilla Chocolate Doom 2.2.1 demo lump 13-byte header parser.
 *
 * Vanilla DOOM 1.9 demo header (g_game.c::G_DoPlayDemo and G_RecordDemo):
 *   byte 0:  version (== 109 for v1.9 / 0x6D)
 *   byte 1:  skill (0-4)
 *   byte 2:  episode (1-based)
 *   byte 3:  map (1-based)
 *   byte 4:  deathmatch (0/1/2)
 *   byte 5:  respawn parm
 *   byte 6:  fast parm
 *   byte 7:  nomonsters
 *   byte 8:  consoleplayer (0-3)
 *   bytes 9-12: player-in-game flags (one byte per player, 0 or 1)
 *
 * Ticcmds start at offset 13. Demo ends at the 0x80 terminator byte.
 */

export const VANILLA_DEMO_HEADER_BYTES = 13;
export const VANILLA_DEMO_VERSION_109 = 109;
export const VANILLA_DEMO_TICCMD_BYTES = 4;
export const VANILLA_DEMO_TERMINATOR_BYTE = 0x80;
export const VANILLA_DEMO_PLAYER_COUNT = 4;

export interface DemoHeader {
  readonly version: number;
  readonly skill: number;
  readonly episode: number;
  readonly map: number;
  readonly deathmatch: number;
  readonly respawnParm: number;
  readonly fastParm: number;
  readonly nomonsters: number;
  readonly consolePlayer: number;
  readonly playerInGame: readonly [number, number, number, number];
}

export type DemoHeaderViolation = 'insufficient_bytes' | 'unsupported_version' | 'skill_out_of_range' | 'invalid_episode' | 'invalid_map' | 'invalid_console_player';

export interface DemoHeaderParseResult {
  readonly header: DemoHeader | null;
  readonly violations: readonly DemoHeaderViolation[];
}

export function parseDemoHeader(bytes: Uint8Array): DemoHeaderParseResult {
  const violations: DemoHeaderViolation[] = [];
  if (bytes.length < VANILLA_DEMO_HEADER_BYTES) {
    violations.push('insufficient_bytes');
    return Object.freeze({ header: null, violations: Object.freeze(violations) });
  }
  const version = bytes[0]!;
  if (version !== VANILLA_DEMO_VERSION_109) {
    violations.push('unsupported_version');
  }
  const skill = bytes[1]!;
  if (skill > 4) {
    violations.push('skill_out_of_range');
  }
  const episode = bytes[2]!;
  if (episode < 1 || episode > 4) {
    violations.push('invalid_episode');
  }
  const map = bytes[3]!;
  if (map < 1 || map > 9) {
    violations.push('invalid_map');
  }
  const consolePlayer = bytes[8]!;
  if (consolePlayer >= VANILLA_DEMO_PLAYER_COUNT) {
    violations.push('invalid_console_player');
  }
  const header: DemoHeader = Object.freeze({
    version,
    skill,
    episode,
    map,
    deathmatch: bytes[4]!,
    respawnParm: bytes[5]!,
    fastParm: bytes[6]!,
    nomonsters: bytes[7]!,
    consolePlayer,
    playerInGame: Object.freeze([bytes[9]!, bytes[10]!, bytes[11]!, bytes[12]!] as const),
  });
  return Object.freeze({
    header: violations.length === 0 ? header : header,
    violations: Object.freeze([...violations].sort()),
  });
}
