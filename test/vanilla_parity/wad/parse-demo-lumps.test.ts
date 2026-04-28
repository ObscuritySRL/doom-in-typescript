import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import {
  DEMO_CONSOLEPLAYER_FIELD_OFFSET,
  DEMO_DEATHMATCH_FIELD_OFFSET,
  DEMO_END_MARKER,
  DEMO_EPISODE_FIELD_OFFSET,
  DEMO_FASTPARM_FIELD_OFFSET,
  DEMO_HEADER_BYTES,
  DEMO_LUMP_AUDIT,
  DEMO_LUMP_DERIVED_INVARIANTS,
  DEMO_LUMP_NAME_FIELD_BYTES,
  DEMO_LUMP_NAME_PREFIX,
  DEMO_LUMP_NAME_PREFIX_LENGTH,
  DEMO_MAP_FIELD_OFFSET,
  DEMO_MAX_PLAYERS,
  DEMO_NOMONSTERS_FIELD_OFFSET,
  DEMO_PLAYERINGAME_FIELD_BYTES,
  DEMO_PLAYERINGAME_FIELD_OFFSET,
  DEMO_RESPAWNPARM_FIELD_OFFSET,
  DEMO_SKILL_FIELD_OFFSET,
  DEMO_TICCMD_ANGLETURN_OFFSET,
  DEMO_TICCMD_BUTTONS_OFFSET,
  DEMO_TICCMD_BYTES,
  DEMO_TICCMD_FORWARDMOVE_OFFSET,
  DEMO_TICCMD_SIDEMOVE_OFFSET,
  DEMO_TIC_RATE_HZ,
  DEMO_VERSION_FIELD_BYTES,
  DEMO_VERSION_FIELD_OFFSET,
  DEMO_VERSION_VANILLA_DOOM_1_9,
  SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE,
  crossCheckDemoLumpRuntime,
  crossCheckShareWareDoom1WadDemoLumpSample,
  isDemoLumpName,
  parseDemoLumpHeader,
  parseDemoLumpTiccmd,
} from '../../../src/assets/parse-demo-lumps.ts';
import type { DemoLumpAuditEntry, DemoLumpRuntimeSnapshot, ShareWareDoom1WadDemoLumpSample } from '../../../src/assets/parse-demo-lumps.ts';

const ALLOWED_AXIS_IDS = new Set<DemoLumpAuditEntry['id']>([
  'demo-lump-name-prefix-demo',
  'demo-lump-name-defdemoname-demo-n',
  'demo-lump-name-lookup-via-w-cachelumpname',
  'demo-lump-header-bytes-thirteen',
  'demo-lump-version-field-offset-zero-uint8',
  'demo-lump-version-vanilla-109',
  'demo-lump-skill-field-offset-one-uint8',
  'demo-lump-episode-field-offset-two-uint8',
  'demo-lump-map-field-offset-three-uint8',
  'demo-lump-deathmatch-field-offset-four-uint8',
  'demo-lump-respawnparm-field-offset-five-uint8',
  'demo-lump-fastparm-field-offset-six-uint8',
  'demo-lump-nomonsters-field-offset-seven-uint8',
  'demo-lump-consoleplayer-field-offset-eight-uint8',
  'demo-lump-playeringame-field-offset-nine-four-uint8s',
  'demo-lump-ticcmd-bytes-four-per-active-player',
  'demo-lump-ticcmd-forwardmove-signed-int8',
  'demo-lump-ticcmd-sidemove-signed-int8',
  'demo-lump-ticcmd-angleturn-uint8-shifted-left-eight',
  'demo-lump-ticcmd-buttons-uint8',
  'demo-lump-end-marker-0x80',
  'demo-lump-tic-rate-thirty-five-hz',
  'demo-lump-no-marker-range',
  'demo-lump-shareware-doom1-three-demos',
]);
const ALLOWED_SUBJECTS = new Set<DemoLumpAuditEntry['subject']>(['DEMO-lump', 'G_BeginRecording', 'G_DoPlayDemo', 'G_ReadDemoTiccmd', 'G_DeferedPlayDemo', 'parseDemoLumpHeader', 'shareware-doom1.wad']);
const ALLOWED_REFERENCE_FILES = new Set<DemoLumpAuditEntry['referenceSourceFile']>(['linuxdoom-1.10/g_game.c', 'linuxdoom-1.10/d_main.c', 'linuxdoom-1.10/doomdef.h', 'src/doom/g_game.c', 'shareware/DOOM1.WAD']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

const liveDemoEntries = liveDirectory.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.name.length > DEMO_LUMP_NAME_PREFIX_LENGTH && entry.name.startsWith(DEMO_LUMP_NAME_PREFIX));

function buildValidLumpBytes({
  version = DEMO_VERSION_VANILLA_DOOM_1_9,
  skill = 2,
  episode = 1,
  map = 5,
  deathmatch = 0,
  respawnparm = 0,
  fastparm = 0,
  nomonsters = 0,
  consoleplayer = 0,
  playeringame = [1, 0, 0, 0],
  tics = 4,
}: {
  version?: number;
  skill?: number;
  episode?: number;
  map?: number;
  deathmatch?: number;
  respawnparm?: number;
  fastparm?: number;
  nomonsters?: number;
  consoleplayer?: number;
  playeringame?: readonly number[];
  tics?: number;
} = {}): Buffer {
  const activePlayers = playeringame.filter((b) => b !== 0).length;
  const bodyBytes = activePlayers * DEMO_TICCMD_BYTES * tics;
  const buffer = Buffer.alloc(DEMO_HEADER_BYTES + bodyBytes + 1);
  buffer[DEMO_VERSION_FIELD_OFFSET] = version;
  buffer[DEMO_SKILL_FIELD_OFFSET] = skill;
  buffer[DEMO_EPISODE_FIELD_OFFSET] = episode;
  buffer[DEMO_MAP_FIELD_OFFSET] = map;
  buffer[DEMO_DEATHMATCH_FIELD_OFFSET] = deathmatch;
  buffer[DEMO_RESPAWNPARM_FIELD_OFFSET] = respawnparm;
  buffer[DEMO_FASTPARM_FIELD_OFFSET] = fastparm;
  buffer[DEMO_NOMONSTERS_FIELD_OFFSET] = nomonsters;
  buffer[DEMO_CONSOLEPLAYER_FIELD_OFFSET] = consoleplayer;
  for (let index = 0; index < DEMO_MAX_PLAYERS; index += 1) {
    buffer[DEMO_PLAYERINGAME_FIELD_OFFSET + index] = playeringame[index] ?? 0;
  }
  buffer[buffer.length - 1] = DEMO_END_MARKER;
  return buffer;
}

function tryThrows(thunk: () => unknown): boolean {
  try {
    thunk();
    return false;
  } catch (err) {
    return err instanceof Error;
  }
}

const validLump = buildValidLumpBytes();
const parsedValidHeader = parseDemoLumpHeader(validLump);

const tooSmallBuffer = Buffer.alloc(DEMO_HEADER_BYTES - 1);
const wrongVersionBuffer = (() => {
  const buffer = buildValidLumpBytes();
  buffer[DEMO_VERSION_FIELD_OFFSET] = 110;
  return buffer;
})();
const zeroActivePlayersBuffer = (() => {
  const buffer = buildValidLumpBytes({ playeringame: [0, 0, 0, 0], tics: 0 });
  return buffer;
})();

const parserRejectsBufferTooSmallForHeader = tryThrows(() => parseDemoLumpHeader(tooSmallBuffer));
const parserRejectsUnsupportedVersion = tryThrows(() => parseDemoLumpHeader(wrongVersionBuffer));
const parserRejectsZeroActivePlayers = tryThrows(() => parseDemoLumpHeader(zeroActivePlayersBuffer));

function buildLiveRuntimeSnapshot(): DemoLumpRuntimeSnapshot {
  return {
    demoLumpNamePrefix: DEMO_LUMP_NAME_PREFIX,
    demoLumpNamePrefixLength: DEMO_LUMP_NAME_PREFIX_LENGTH,
    demoLumpNameFieldBytes: DEMO_LUMP_NAME_FIELD_BYTES,
    demoHeaderBytes: DEMO_HEADER_BYTES,
    demoVersionFieldOffset: DEMO_VERSION_FIELD_OFFSET,
    demoVersionFieldBytes: DEMO_VERSION_FIELD_BYTES,
    demoVersionVanillaDoom19: DEMO_VERSION_VANILLA_DOOM_1_9,
    demoSkillFieldOffset: DEMO_SKILL_FIELD_OFFSET,
    demoEpisodeFieldOffset: DEMO_EPISODE_FIELD_OFFSET,
    demoMapFieldOffset: DEMO_MAP_FIELD_OFFSET,
    demoDeathmatchFieldOffset: DEMO_DEATHMATCH_FIELD_OFFSET,
    demoRespawnparmFieldOffset: DEMO_RESPAWNPARM_FIELD_OFFSET,
    demoFastparmFieldOffset: DEMO_FASTPARM_FIELD_OFFSET,
    demoNomonstersFieldOffset: DEMO_NOMONSTERS_FIELD_OFFSET,
    demoConsoleplayerFieldOffset: DEMO_CONSOLEPLAYER_FIELD_OFFSET,
    demoPlayeringameFieldOffset: DEMO_PLAYERINGAME_FIELD_OFFSET,
    demoPlayeringameFieldBytes: DEMO_PLAYERINGAME_FIELD_BYTES,
    demoMaxPlayers: DEMO_MAX_PLAYERS,
    demoTiccmdBytes: DEMO_TICCMD_BYTES,
    demoTiccmdForwardmoveOffset: DEMO_TICCMD_FORWARDMOVE_OFFSET,
    demoTiccmdSidemoveOffset: DEMO_TICCMD_SIDEMOVE_OFFSET,
    demoTiccmdAngleturnOffset: DEMO_TICCMD_ANGLETURN_OFFSET,
    demoTiccmdButtonsOffset: DEMO_TICCMD_BUTTONS_OFFSET,
    demoEndMarker: DEMO_END_MARKER,
    demoTicRateHz: DEMO_TIC_RATE_HZ,
    parserReturnsFrozenHeader: Object.isFrozen(parsedValidHeader) && Object.isFrozen(parsedValidHeader.playersPresent),
    parserRejectsBufferTooSmallForHeader,
    parserRejectsUnsupportedVersion,
    parserRejectsZeroActivePlayers,
    isDemoLumpNameAcceptsDemoPrefix: isDemoLumpName('DEMO1'),
    isDemoLumpNameRejectsBareDemoToken: isDemoLumpName('DEMO') === false,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

function buildLiveOracleSample(): ShareWareDoom1WadDemoLumpSample {
  const pinnedDemoLumps = SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.pinnedDemoLumps.map((oracleEntry) => {
    const liveEntry = liveDemoEntries.find(({ entry }) => entry.name === oracleEntry.name);
    if (!liveEntry) {
      throw new Error(`pinned demo lump ${oracleEntry.name} not found in live IWAD`);
    }
    const directoryEntry = liveEntry.entry;
    const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
    const header = parseDemoLumpHeader(lump);
    return {
      name: directoryEntry.name,
      directoryIndex: liveEntry.index,
      fileOffset: directoryEntry.offset,
      size: directoryEntry.size,
      version: header.version,
      skill: header.skill,
      episode: header.episode,
      map: header.map,
      deathmatch: header.deathmatch,
      respawnparm: header.respawnparm,
      fastparm: header.fastparm,
      nomonsters: header.nomonsters,
      consoleplayer: header.consoleplayer,
      activePlayers: header.activePlayers,
      ticCount: header.ticCount,
      sha256: createHash('sha256').update(lump).digest('hex'),
    };
  });
  return {
    demoLumpCount: liveDemoEntries.length,
    firstDemoLumpIndex: liveDemoEntries[0]!.index,
    lastDemoLumpIndex: liveDemoEntries[liveDemoEntries.length - 1]!.index,
    pinnedDemoLumps,
  };
}

const liveOracleSample = buildLiveOracleSample();

describe('demo lump audit ledger shape', () => {
  test('audits exactly twenty-four behavioral axes', () => {
    expect(DEMO_LUMP_AUDIT.length).toBe(24);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of DEMO_LUMP_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = DEMO_LUMP_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of DEMO_LUMP_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of DEMO_LUMP_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of DEMO_LUMP_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of DEMO_LUMP_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the prefix-demo axis cites the upstream G_DeferedPlayDemo invocation', () => {
    const entry = DEMO_LUMP_AUDIT.find((e) => e.id === 'demo-lump-name-prefix-demo');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('G_DeferedPlayDemo') && line.includes('"demo1"'))).toBe(true);
  });

  test('the version-vanilla-109 axis cites the Chocolate Doom G_VanillaVersionCode switch', () => {
    const entry = DEMO_LUMP_AUDIT.find((e) => e.id === 'demo-lump-version-vanilla-109');
    expect(entry).toBeDefined();
    expect(entry!.referenceSourceFile).toBe('src/doom/g_game.c');
    expect(entry!.cSourceLines.some((line) => line.includes('exe_doom_1_9'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('109'))).toBe(true);
  });

  test('the header-bytes-thirteen axis cites all nine scalar writes plus the playeringame loop', () => {
    const entry = DEMO_LUMP_AUDIT.find((e) => e.id === 'demo-lump-header-bytes-thirteen');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('= VERSION'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('= gameskill'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('= consoleplayer'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('MAXPLAYERS'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('playeringame[i]'))).toBe(true);
  });

  test('the ticcmd-bytes-four axis cites the four upstream read sites', () => {
    const entry = DEMO_LUMP_AUDIT.find((e) => e.id === 'demo-lump-ticcmd-bytes-four-per-active-player');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('forwardmove'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('sidemove'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('angleturn') && line.includes('<<8'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('buttons'))).toBe(true);
  });

  test('the end-marker-0x80 axis cites the upstream DEMOMARKER define', () => {
    const entry = DEMO_LUMP_AUDIT.find((e) => e.id === 'demo-lump-end-marker-0x80');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('DEMOMARKER') && line.includes('0x80'))).toBe(true);
  });

  test('the tic-rate axis cites the upstream TICRATE define', () => {
    const entry = DEMO_LUMP_AUDIT.find((e) => e.id === 'demo-lump-tic-rate-thirty-five-hz');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('TICRATE') && line.includes('35'))).toBe(true);
  });

  test('the shareware-three-demos axis names the shareware DOOM1.WAD file', () => {
    const entry = DEMO_LUMP_AUDIT.find((e) => e.id === 'demo-lump-shareware-doom1-three-demos');
    expect(entry).toBeDefined();
    expect(entry!.subject).toBe('shareware-doom1.wad');
    expect(entry!.invariant.includes('3 demo lumps')).toBe(true);
  });
});

describe('demo lump derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = DEMO_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(DEMO_LUMP_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'DEMO_LUMP_NAME_PREFIX_EQUALS_DEMO',
        'DEMO_LUMP_NAME_PREFIX_LENGTH_EQUALS_FOUR',
        'DEMO_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT',
        'DEMO_HEADER_BYTES_EQUALS_THIRTEEN',
        'DEMO_VERSION_FIELD_OFFSET_EQUALS_ZERO',
        'DEMO_VERSION_FIELD_BYTES_EQUALS_ONE',
        'DEMO_VERSION_VANILLA_DOOM_1_9_EQUALS_ONE_OH_NINE',
        'DEMO_SKILL_FIELD_OFFSET_EQUALS_ONE',
        'DEMO_EPISODE_FIELD_OFFSET_EQUALS_TWO',
        'DEMO_MAP_FIELD_OFFSET_EQUALS_THREE',
        'DEMO_DEATHMATCH_FIELD_OFFSET_EQUALS_FOUR',
        'DEMO_RESPAWNPARM_FIELD_OFFSET_EQUALS_FIVE',
        'DEMO_FASTPARM_FIELD_OFFSET_EQUALS_SIX',
        'DEMO_NOMONSTERS_FIELD_OFFSET_EQUALS_SEVEN',
        'DEMO_CONSOLEPLAYER_FIELD_OFFSET_EQUALS_EIGHT',
        'DEMO_PLAYERINGAME_FIELD_OFFSET_EQUALS_NINE',
        'DEMO_PLAYERINGAME_FIELD_BYTES_EQUALS_FOUR',
        'DEMO_MAX_PLAYERS_EQUALS_FOUR',
        'DEMO_TICCMD_BYTES_EQUALS_FOUR',
        'DEMO_TICCMD_FORWARDMOVE_OFFSET_EQUALS_ZERO',
        'DEMO_TICCMD_SIDEMOVE_OFFSET_EQUALS_ONE',
        'DEMO_TICCMD_ANGLETURN_OFFSET_EQUALS_TWO',
        'DEMO_TICCMD_BUTTONS_OFFSET_EQUALS_THREE',
        'DEMO_END_MARKER_EQUALS_0X80',
        'DEMO_TIC_RATE_HZ_EQUALS_THIRTY_FIVE',
        'PARSE_DEMO_LUMP_HEADER_RETURNS_FROZEN_HEADER',
        'PARSE_DEMO_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
        'PARSE_DEMO_LUMP_HEADER_REJECTS_UNSUPPORTED_VERSION',
        'PARSE_DEMO_LUMP_HEADER_REJECTS_ZERO_ACTIVE_PLAYERS',
        'IS_DEMO_LUMP_NAME_REQUIRES_DEMO_PREFIX',
        'IS_DEMO_LUMP_NAME_REJECTS_DEMOCRATIC_SOUNDING_NON_DEMO_LUMPS',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of DEMO_LUMP_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('DEMO_LUMP_NAME_PREFIX is the uppercase "DEMO" string', () => {
    expect(DEMO_LUMP_NAME_PREFIX).toBe('DEMO');
  });

  test('DEMO_LUMP_NAME_PREFIX_LENGTH equals 4 (matches the literal "demoN" base name)', () => {
    expect(DEMO_LUMP_NAME_PREFIX_LENGTH).toBe(4);
    expect(DEMO_LUMP_NAME_PREFIX_LENGTH).toBe(DEMO_LUMP_NAME_PREFIX.length);
  });

  test('DEMO_LUMP_NAME_FIELD_BYTES equals 8 (matches WAD directory name field)', () => {
    expect(DEMO_LUMP_NAME_FIELD_BYTES).toBe(8);
  });

  test('DEMO_HEADER_BYTES equals 13 (G_BeginRecording: 9 scalar writes + 4-byte playeringame loop)', () => {
    expect(DEMO_HEADER_BYTES).toBe(13);
    expect(DEMO_HEADER_BYTES).toBe(DEMO_PLAYERINGAME_FIELD_OFFSET + DEMO_PLAYERINGAME_FIELD_BYTES);
  });

  test('DEMO_VERSION_FIELD_OFFSET equals 0 and DEMO_VERSION_FIELD_BYTES equals 1', () => {
    expect(DEMO_VERSION_FIELD_OFFSET).toBe(0);
    expect(DEMO_VERSION_FIELD_BYTES).toBe(1);
  });

  test('DEMO_VERSION_VANILLA_DOOM_1_9 equals 109 (matches G_VanillaVersionCode for exe_doom_1_9)', () => {
    expect(DEMO_VERSION_VANILLA_DOOM_1_9).toBe(109);
    expect(DEMO_VERSION_VANILLA_DOOM_1_9).toBe(0x6d);
  });

  test('header field offsets follow the upstream G_BeginRecording write sequence 1..8', () => {
    expect(DEMO_SKILL_FIELD_OFFSET).toBe(1);
    expect(DEMO_EPISODE_FIELD_OFFSET).toBe(2);
    expect(DEMO_MAP_FIELD_OFFSET).toBe(3);
    expect(DEMO_DEATHMATCH_FIELD_OFFSET).toBe(4);
    expect(DEMO_RESPAWNPARM_FIELD_OFFSET).toBe(5);
    expect(DEMO_FASTPARM_FIELD_OFFSET).toBe(6);
    expect(DEMO_NOMONSTERS_FIELD_OFFSET).toBe(7);
    expect(DEMO_CONSOLEPLAYER_FIELD_OFFSET).toBe(8);
  });

  test('DEMO_PLAYERINGAME_FIELD_OFFSET equals 9 and DEMO_PLAYERINGAME_FIELD_BYTES equals MAXPLAYERS (4)', () => {
    expect(DEMO_PLAYERINGAME_FIELD_OFFSET).toBe(9);
    expect(DEMO_PLAYERINGAME_FIELD_BYTES).toBe(4);
    expect(DEMO_MAX_PLAYERS).toBe(4);
    expect(DEMO_PLAYERINGAME_FIELD_BYTES).toBe(DEMO_MAX_PLAYERS);
  });

  test('DEMO_TICCMD_BYTES equals 4 and the four field offsets are 0..3', () => {
    expect(DEMO_TICCMD_BYTES).toBe(4);
    expect(DEMO_TICCMD_FORWARDMOVE_OFFSET).toBe(0);
    expect(DEMO_TICCMD_SIDEMOVE_OFFSET).toBe(1);
    expect(DEMO_TICCMD_ANGLETURN_OFFSET).toBe(2);
    expect(DEMO_TICCMD_BUTTONS_OFFSET).toBe(3);
  });

  test('DEMO_END_MARKER equals 0x80 (matches DEMOMARKER define)', () => {
    expect(DEMO_END_MARKER).toBe(0x80);
    expect(DEMO_END_MARKER).toBe(128);
  });

  test('DEMO_TIC_RATE_HZ equals 35 (matches TICRATE define and PRIMARY_TARGET.ticRateHz)', () => {
    expect(DEMO_TIC_RATE_HZ).toBe(35);
    expect(DEMO_TIC_RATE_HZ).toBe(PRIMARY_TARGET.ticRateHz);
  });
});

describe('parseDemoLumpHeader runtime parser', () => {
  test('returns a frozen header for a synthesised valid lump', () => {
    const header = parseDemoLumpHeader(buildValidLumpBytes());
    expect(Object.isFrozen(header)).toBe(true);
    expect(Object.isFrozen(header.playersPresent)).toBe(true);
  });

  test('decodes all thirteen header fields in upstream order', () => {
    const buffer = buildValidLumpBytes({
      version: DEMO_VERSION_VANILLA_DOOM_1_9,
      skill: 3,
      episode: 1,
      map: 7,
      deathmatch: 0,
      respawnparm: 0,
      fastparm: 0,
      nomonsters: 0,
      consoleplayer: 0,
      playeringame: [1, 0, 0, 0],
      tics: 2,
    });
    const header = parseDemoLumpHeader(buffer);
    expect(header.version).toBe(DEMO_VERSION_VANILLA_DOOM_1_9);
    expect(header.skill).toBe(3);
    expect(header.episode).toBe(1);
    expect(header.map).toBe(7);
    expect(header.deathmatch).toBe(0);
    expect(header.respawnparm).toBe(0);
    expect(header.fastparm).toBe(0);
    expect(header.nomonsters).toBe(0);
    expect(header.consoleplayer).toBe(0);
    expect(header.playersPresent).toEqual([true, false, false, false]);
    expect(header.activePlayers).toBe(1);
    expect(header.ticCount).toBe(2);
    expect(header.durationSeconds).toBeCloseTo(2 / DEMO_TIC_RATE_HZ);
  });

  test('throws RangeError on a buffer too small for the header', () => {
    expect(() => parseDemoLumpHeader(Buffer.alloc(DEMO_HEADER_BYTES - 1))).toThrow(RangeError);
  });

  test('throws RangeError on a version byte that is not the vanilla 109', () => {
    const buffer = buildValidLumpBytes();
    buffer[DEMO_VERSION_FIELD_OFFSET] = 110;
    expect(() => parseDemoLumpHeader(buffer)).toThrow(RangeError);
  });

  test('throws RangeError when playeringame is all zero', () => {
    const buffer = buildValidLumpBytes({ playeringame: [0, 0, 0, 0], tics: 0 });
    expect(() => parseDemoLumpHeader(buffer)).toThrow(RangeError);
  });

  test('counts active players via the popcount of non-zero playeringame bytes', () => {
    const buffer = buildValidLumpBytes({ playeringame: [1, 1, 0, 1], tics: 1 });
    const header = parseDemoLumpHeader(buffer);
    expect(header.activePlayers).toBe(3);
    expect(header.playersPresent).toEqual([true, true, false, true]);
  });

  test('derives ticCount as floor((bodyBytes - 1 trailer) / (DEMO_TICCMD_BYTES * activePlayers))', () => {
    const buffer = buildValidLumpBytes({ playeringame: [1, 1, 0, 0], tics: 5 });
    const header = parseDemoLumpHeader(buffer);
    expect(header.activePlayers).toBe(2);
    expect(header.ticCount).toBe(5);
    expect(header.durationSeconds).toBeCloseTo(5 / DEMO_TIC_RATE_HZ);
  });

  test('accepts a Uint8Array view in addition to a Buffer', () => {
    const buffer = buildValidLumpBytes();
    const view = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    expect(() => parseDemoLumpHeader(view)).not.toThrow();
  });
});

describe('parseDemoLumpTiccmd runtime ticcmd decoder', () => {
  test('decodes the four-byte ticcmd record into signed forwardmove/sidemove and unsigned angleturn/buttons', () => {
    const buffer = Buffer.from([0xff, 0x80, 0x40, 0x12]);
    const cmd = parseDemoLumpTiccmd(buffer, 0);
    expect(cmd.forwardmove).toBe(-1);
    expect(cmd.sidemove).toBe(-128);
    expect(cmd.angleturn).toBe(0x40);
    expect(cmd.buttons).toBe(0x12);
    expect(Object.isFrozen(cmd)).toBe(true);
  });

  test('respects the offset parameter (decodes a record at an arbitrary aligned position)', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x10, 0x20, 0x30, 0x40]);
    const cmd = parseDemoLumpTiccmd(buffer, 4);
    expect(cmd.forwardmove).toBe(0x10);
    expect(cmd.sidemove).toBe(0x20);
    expect(cmd.angleturn).toBe(0x30);
    expect(cmd.buttons).toBe(0x40);
  });

  test('throws RangeError when the record extends past the buffer end', () => {
    const buffer = Buffer.alloc(3);
    expect(() => parseDemoLumpTiccmd(buffer, 0)).toThrow(RangeError);
  });

  test('throws RangeError on a negative offset', () => {
    const buffer = Buffer.alloc(8);
    expect(() => parseDemoLumpTiccmd(buffer, -1)).toThrow(RangeError);
  });
});

describe('isDemoLumpName predicate', () => {
  test('accepts uppercase DEMO-prefixed names with at least one suffix character', () => {
    expect(isDemoLumpName('DEMO1')).toBe(true);
    expect(isDemoLumpName('DEMO2')).toBe(true);
    expect(isDemoLumpName('DEMO3')).toBe(true);
    expect(isDemoLumpName('DEMO4')).toBe(true);
  });

  test('rejects the bare "DEMO" token (no index suffix)', () => {
    expect(isDemoLumpName('DEMO')).toBe(false);
  });

  test('rejects names that do not start with the DEMO prefix', () => {
    expect(isDemoLumpName('PISTOL')).toBe(false);
    expect(isDemoLumpName('DSPISTOL')).toBe(false);
    expect(isDemoLumpName('DEM')).toBe(false);
    expect(isDemoLumpName('DEMORAGI')).toBe(true);
  });

  test('is case-insensitive (matches the upstream W_CheckNumForName uppercase fold)', () => {
    expect(isDemoLumpName('demo1')).toBe(true);
    expect(isDemoLumpName('Demo1')).toBe(true);
  });
});

describe('crossCheckDemoLumpRuntime', () => {
  test('reports zero failures for the live runtime snapshot', () => {
    expect(crossCheckDemoLumpRuntime(liveRuntimeSnapshot)).toEqual([]);
  });

  test('detects a tampered DEMO_LUMP_NAME_PREFIX', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoLumpNamePrefix: 'DEMOO' };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_LUMP_NAME_PREFIX_EQUALS_DEMO');
    expect(failures).toContain('audit:demo-lump-name-prefix-demo:not-observed');
  });

  test('detects a tampered DEMO_LUMP_NAME_PREFIX_LENGTH', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoLumpNamePrefixLength: 5 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_LUMP_NAME_PREFIX_LENGTH_EQUALS_FOUR');
    expect(failures).toContain('audit:demo-lump-name-defdemoname-demo-n:not-observed');
  });

  test('detects a tampered DEMO_LUMP_NAME_FIELD_BYTES', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoLumpNameFieldBytes: 16 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT');
  });

  test('detects a tampered DEMO_HEADER_BYTES', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoHeaderBytes: 12 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_HEADER_BYTES_EQUALS_THIRTEEN');
    expect(failures).toContain('audit:demo-lump-header-bytes-thirteen:not-observed');
  });

  test('detects a tampered DEMO_VERSION_FIELD_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoVersionFieldOffset: 1 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_VERSION_FIELD_OFFSET_EQUALS_ZERO');
    expect(failures).toContain('audit:demo-lump-version-field-offset-zero-uint8:not-observed');
  });

  test('detects a tampered DEMO_VERSION_FIELD_BYTES', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoVersionFieldBytes: 2 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_VERSION_FIELD_BYTES_EQUALS_ONE');
  });

  test('detects a tampered DEMO_VERSION_VANILLA_DOOM_1_9', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoVersionVanillaDoom19: 110 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_VERSION_VANILLA_DOOM_1_9_EQUALS_ONE_OH_NINE');
    expect(failures).toContain('audit:demo-lump-version-vanilla-109:not-observed');
  });

  test('detects a tampered DEMO_SKILL_FIELD_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoSkillFieldOffset: 0 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_SKILL_FIELD_OFFSET_EQUALS_ONE');
  });

  test('detects a tampered DEMO_EPISODE_FIELD_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoEpisodeFieldOffset: 1 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_EPISODE_FIELD_OFFSET_EQUALS_TWO');
  });

  test('detects a tampered DEMO_MAP_FIELD_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoMapFieldOffset: 2 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_MAP_FIELD_OFFSET_EQUALS_THREE');
  });

  test('detects a tampered DEMO_DEATHMATCH_FIELD_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoDeathmatchFieldOffset: 3 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_DEATHMATCH_FIELD_OFFSET_EQUALS_FOUR');
  });

  test('detects a tampered DEMO_RESPAWNPARM_FIELD_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoRespawnparmFieldOffset: 4 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_RESPAWNPARM_FIELD_OFFSET_EQUALS_FIVE');
  });

  test('detects a tampered DEMO_FASTPARM_FIELD_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoFastparmFieldOffset: 5 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_FASTPARM_FIELD_OFFSET_EQUALS_SIX');
  });

  test('detects a tampered DEMO_NOMONSTERS_FIELD_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoNomonstersFieldOffset: 6 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_NOMONSTERS_FIELD_OFFSET_EQUALS_SEVEN');
  });

  test('detects a tampered DEMO_CONSOLEPLAYER_FIELD_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoConsoleplayerFieldOffset: 7 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_CONSOLEPLAYER_FIELD_OFFSET_EQUALS_EIGHT');
  });

  test('detects a tampered DEMO_PLAYERINGAME_FIELD_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoPlayeringameFieldOffset: 8 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_PLAYERINGAME_FIELD_OFFSET_EQUALS_NINE');
    expect(failures).toContain('audit:demo-lump-playeringame-field-offset-nine-four-uint8s:not-observed');
  });

  test('detects a tampered DEMO_PLAYERINGAME_FIELD_BYTES', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoPlayeringameFieldBytes: 8 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_PLAYERINGAME_FIELD_BYTES_EQUALS_FOUR');
  });

  test('detects a tampered DEMO_MAX_PLAYERS', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoMaxPlayers: 8 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_MAX_PLAYERS_EQUALS_FOUR');
  });

  test('detects a tampered DEMO_TICCMD_BYTES', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoTiccmdBytes: 5 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_TICCMD_BYTES_EQUALS_FOUR');
    expect(failures).toContain('audit:demo-lump-ticcmd-bytes-four-per-active-player:not-observed');
  });

  test('detects a tampered DEMO_TICCMD_FORWARDMOVE_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoTiccmdForwardmoveOffset: 1 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_TICCMD_FORWARDMOVE_OFFSET_EQUALS_ZERO');
  });

  test('detects a tampered DEMO_TICCMD_SIDEMOVE_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoTiccmdSidemoveOffset: 2 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_TICCMD_SIDEMOVE_OFFSET_EQUALS_ONE');
  });

  test('detects a tampered DEMO_TICCMD_ANGLETURN_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoTiccmdAngleturnOffset: 3 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_TICCMD_ANGLETURN_OFFSET_EQUALS_TWO');
  });

  test('detects a tampered DEMO_TICCMD_BUTTONS_OFFSET', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoTiccmdButtonsOffset: 0 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_TICCMD_BUTTONS_OFFSET_EQUALS_THREE');
  });

  test('detects a tampered DEMO_END_MARKER', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoEndMarker: 0xff };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_END_MARKER_EQUALS_0X80');
    expect(failures).toContain('audit:demo-lump-end-marker-0x80:not-observed');
  });

  test('detects a tampered DEMO_TIC_RATE_HZ', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, demoTicRateHz: 60 };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:DEMO_TIC_RATE_HZ_EQUALS_THIRTY_FIVE');
    expect(failures).toContain('audit:demo-lump-tic-rate-thirty-five-hz:not-observed');
  });

  test('detects a parser that fails to freeze the returned header', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserReturnsFrozenHeader: false };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_DEMO_LUMP_HEADER_RETURNS_FROZEN_HEADER');
  });

  test('detects a parser that silently accepts a too-small buffer', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsBufferTooSmallForHeader: false };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_DEMO_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
  });

  test('detects a parser that silently accepts an unsupported version byte', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsUnsupportedVersion: false };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_DEMO_LUMP_HEADER_REJECTS_UNSUPPORTED_VERSION');
    expect(failures).toContain('audit:demo-lump-version-vanilla-109:not-observed');
  });

  test('detects a parser that silently accepts zero active players', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, parserRejectsZeroActivePlayers: false };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:PARSE_DEMO_LUMP_HEADER_REJECTS_ZERO_ACTIVE_PLAYERS');
  });

  test('detects an isDemoLumpName that no longer accepts DEMO1', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, isDemoLumpNameAcceptsDemoPrefix: false };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:IS_DEMO_LUMP_NAME_REQUIRES_DEMO_PREFIX');
    expect(failures).toContain('audit:demo-lump-name-lookup-via-w-cachelumpname:not-observed');
  });

  test('detects an isDemoLumpName that classifies the bare "DEMO" token as a demo', () => {
    const tampered: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot, isDemoLumpNameRejectsBareDemoToken: false };
    const failures = crossCheckDemoLumpRuntime(tampered);
    expect(failures).toContain('derived:IS_DEMO_LUMP_NAME_REJECTS_DEMOCRATIC_SOUNDING_NON_DEMO_LUMPS');
  });

  test('reports an empty failure list for a freshly cloned snapshot', () => {
    const cloned: DemoLumpRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckDemoLumpRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD demo lump oracle', () => {
  test('declares the three pinned demo lumps (DEMO1, DEMO2, DEMO3)', () => {
    const names = SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.pinnedDemoLumps.map((entry) => entry.name);
    expect(names).toEqual(['DEMO1', 'DEMO2', 'DEMO3']);
  });

  test('every pinned demo lump declares the vanilla DOOM 1.9 version byte', () => {
    for (const oracleDemo of SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.pinnedDemoLumps) {
      expect(oracleDemo.version).toBe(DEMO_VERSION_VANILLA_DOOM_1_9);
    }
  });

  test('every pinned demo lump runs at skill 2 (Hurt Me Plenty), episode 1', () => {
    for (const oracleDemo of SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.pinnedDemoLumps) {
      expect(oracleDemo.skill).toBe(2);
      expect(oracleDemo.episode).toBe(1);
    }
  });

  test('every pinned demo lump is single-player cooperative (deathmatch=0, activePlayers=1)', () => {
    for (const oracleDemo of SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.pinnedDemoLumps) {
      expect(oracleDemo.deathmatch).toBe(0);
      expect(oracleDemo.activePlayers).toBe(1);
    }
  });

  test('every pinned demo lump satisfies size === DEMO_HEADER_BYTES + ticCount * DEMO_TICCMD_BYTES + 1 (end marker)', () => {
    for (const oracleDemo of SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.pinnedDemoLumps) {
      const expectedSize = DEMO_HEADER_BYTES + oracleDemo.ticCount * DEMO_TICCMD_BYTES * oracleDemo.activePlayers + 1;
      expect(oracleDemo.size).toBe(expectedSize);
    }
  });

  test('every pinned demo lump sha256 matches the live IWAD bytes byte-for-byte', () => {
    for (const oracleDemo of SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.pinnedDemoLumps) {
      const directoryEntry = liveDirectory[oracleDemo.directoryIndex]!;
      expect(directoryEntry.name).toBe(oracleDemo.name);
      expect(directoryEntry.size).toBe(oracleDemo.size);
      expect(directoryEntry.offset).toBe(oracleDemo.fileOffset);
      const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
      const sha256 = createHash('sha256').update(lump).digest('hex');
      expect(sha256).toBe(oracleDemo.sha256);
    }
  });

  test('every pinned demo lump parses through parseDemoLumpHeader and matches the oracle header fields', () => {
    for (const oracleDemo of SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.pinnedDemoLumps) {
      const directoryEntry = liveDirectory[oracleDemo.directoryIndex]!;
      const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
      const header = parseDemoLumpHeader(lump);
      expect(header.version).toBe(oracleDemo.version);
      expect(header.skill).toBe(oracleDemo.skill);
      expect(header.episode).toBe(oracleDemo.episode);
      expect(header.map).toBe(oracleDemo.map);
      expect(header.deathmatch).toBe(oracleDemo.deathmatch);
      expect(header.respawnparm).toBe(oracleDemo.respawnparm);
      expect(header.fastparm).toBe(oracleDemo.fastparm);
      expect(header.nomonsters).toBe(oracleDemo.nomonsters);
      expect(header.consoleplayer).toBe(oracleDemo.consoleplayer);
      expect(header.activePlayers).toBe(oracleDemo.activePlayers);
      expect(header.ticCount).toBe(oracleDemo.ticCount);
    }
  });

  test('every pinned demo lump terminates with the 0x80 DEMOMARKER byte', () => {
    for (const oracleDemo of SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.pinnedDemoLumps) {
      const directoryEntry = liveDirectory[oracleDemo.directoryIndex]!;
      const lump = wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size);
      expect(lump[lump.length - 1]).toBe(DEMO_END_MARKER);
    }
  });

  test('the live IWAD reports 3 DEMO lumps spanning directory indices 3..5', () => {
    expect(liveOracleSample.demoLumpCount).toBe(SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.demoLumpCount);
    expect(liveOracleSample.firstDemoLumpIndex).toBe(SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.firstDemoLumpIndex);
    expect(liveOracleSample.lastDemoLumpIndex).toBe(SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.lastDemoLumpIndex);
  });

  test('every live demo sample reports zero failures against the pinned oracle', () => {
    expect(crossCheckShareWareDoom1WadDemoLumpSample(liveOracleSample)).toEqual([]);
  });

  test('matches the wad-map-summary.json reference manifest on demo lump count', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { lumpCategories: { demo: number } };
    expect(manifest.lumpCategories.demo).toBe(3);
    expect(manifest.lumpCategories.demo).toBe(SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.demoLumpCount);
  });

  test('the pinned IWAD filename matches PRIMARY_TARGET.wadFilename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
  });

  test('the live IWAD has no marker range around the DEMO lumps', () => {
    const demoRange = liveDirectory.slice(SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.firstDemoLumpIndex, SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.lastDemoLumpIndex + 1);
    for (const entry of demoRange) {
      if (entry.name.startsWith('DEMO')) {
        continue;
      }
      expect(entry.name === 'S_START' || entry.name === 'S_END' || entry.name === 'F_START' || entry.name === 'F_END' || entry.name === 'P_START' || entry.name === 'P_END').toBe(false);
    }
  });

  test('every pinned demo lump duration matches ticCount / DEMO_TIC_RATE_HZ to within 0.05 seconds', () => {
    const knownDurations: Record<string, number> = { DEMO1: 143.6, DEMO2: 109.6, DEMO3: 60.97142857142857 };
    for (const oracleDemo of SHAREWARE_DOOM1_WAD_DEMO_LUMP_ORACLE.pinnedDemoLumps) {
      const expected = oracleDemo.ticCount / DEMO_TIC_RATE_HZ;
      expect(expected).toBeCloseTo(knownDurations[oracleDemo.name]!, 1);
    }
  });
});

describe('crossCheckShareWareDoom1WadDemoLumpSample failure modes', () => {
  test('detects a wrong demoLumpCount', () => {
    const tampered: ShareWareDoom1WadDemoLumpSample = { ...liveOracleSample, demoLumpCount: 999 };
    expect(crossCheckShareWareDoom1WadDemoLumpSample(tampered)).toContain('oracle:demoLumpCount:value-mismatch');
  });

  test('detects a wrong firstDemoLumpIndex', () => {
    const tampered: ShareWareDoom1WadDemoLumpSample = { ...liveOracleSample, firstDemoLumpIndex: 0 };
    expect(crossCheckShareWareDoom1WadDemoLumpSample(tampered)).toContain('oracle:firstDemoLumpIndex:value-mismatch');
  });

  test('detects a wrong lastDemoLumpIndex', () => {
    const tampered: ShareWareDoom1WadDemoLumpSample = { ...liveOracleSample, lastDemoLumpIndex: 0 };
    expect(crossCheckShareWareDoom1WadDemoLumpSample(tampered)).toContain('oracle:lastDemoLumpIndex:value-mismatch');
  });

  test('detects a missing pinned demo lump', () => {
    const tampered: ShareWareDoom1WadDemoLumpSample = {
      ...liveOracleSample,
      pinnedDemoLumps: liveOracleSample.pinnedDemoLumps.filter((entry) => entry.name !== 'DEMO1'),
    };
    expect(crossCheckShareWareDoom1WadDemoLumpSample(tampered)).toContain('oracle:demo:DEMO1:not-found');
  });

  test('detects a wrong map on a pinned demo lump', () => {
    const tampered: ShareWareDoom1WadDemoLumpSample = {
      ...liveOracleSample,
      pinnedDemoLumps: liveOracleSample.pinnedDemoLumps.map((entry) => (entry.name === 'DEMO1' ? { ...entry, map: 99 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadDemoLumpSample(tampered)).toContain('oracle:demo:DEMO1:map:value-mismatch');
  });

  test('detects a wrong sha256 on a pinned demo lump', () => {
    const tampered: ShareWareDoom1WadDemoLumpSample = {
      ...liveOracleSample,
      pinnedDemoLumps: liveOracleSample.pinnedDemoLumps.map((entry) => (entry.name === 'DEMO3' ? { ...entry, sha256: '0'.repeat(64) } : entry)),
    };
    expect(crossCheckShareWareDoom1WadDemoLumpSample(tampered)).toContain('oracle:demo:DEMO3:sha256:value-mismatch');
  });

  test('detects a wrong ticCount on a pinned demo lump', () => {
    const tampered: ShareWareDoom1WadDemoLumpSample = {
      ...liveOracleSample,
      pinnedDemoLumps: liveOracleSample.pinnedDemoLumps.map((entry) => (entry.name === 'DEMO2' ? { ...entry, ticCount: 0 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadDemoLumpSample(tampered)).toContain('oracle:demo:DEMO2:ticCount:value-mismatch');
  });

  test('detects a wrong activePlayers on a pinned demo lump', () => {
    const tampered: ShareWareDoom1WadDemoLumpSample = {
      ...liveOracleSample,
      pinnedDemoLumps: liveOracleSample.pinnedDemoLumps.map((entry) => (entry.name === 'DEMO1' ? { ...entry, activePlayers: 4 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadDemoLumpSample(tampered)).toContain('oracle:demo:DEMO1:activePlayers:value-mismatch');
  });
});

describe('shareware DOOM1.WAD demo inventory matches the runtime parser', () => {
  test('every DEMO lump in directory order parses via parseDemoLumpHeader without throwing', () => {
    for (const { entry } of liveDemoEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      expect(() => parseDemoLumpHeader(lump)).not.toThrow();
    }
  });

  test('every DEMO lump declares the vanilla DOOM 1.9 version byte at offset 0', () => {
    for (const { entry } of liveDemoEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      expect(lump[DEMO_VERSION_FIELD_OFFSET]).toBe(DEMO_VERSION_VANILLA_DOOM_1_9);
    }
  });

  test('every DEMO lump terminates with the 0x80 DEMOMARKER byte', () => {
    for (const { entry } of liveDemoEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      expect(lump[lump.length - 1]).toBe(DEMO_END_MARKER);
    }
  });

  test('every DEMO lump body length is congruent to 1 modulo (DEMO_TICCMD_BYTES * activePlayers)', () => {
    for (const { entry } of liveDemoEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      const header = parseDemoLumpHeader(lump);
      const bodyBytes = entry.size - DEMO_HEADER_BYTES;
      const ticBytes = bodyBytes - 1;
      expect(ticBytes).toBeGreaterThanOrEqual(0);
      expect(ticBytes % (DEMO_TICCMD_BYTES * header.activePlayers)).toBe(0);
    }
  });

  test('every DEMO lump name matches the isDemoLumpName predicate', () => {
    for (const { entry } of liveDemoEntries) {
      expect(isDemoLumpName(entry.name)).toBe(true);
    }
  });

  test('every DS digital sound effect lump name does NOT match isDemoLumpName', () => {
    const dsEntries = liveDirectory.filter((entry) => entry.name.length >= 3 && entry.name.startsWith('DS'));
    for (const entry of dsEntries) {
      expect(isDemoLumpName(entry.name)).toBe(false);
    }
  });

  test('every D_ music lump name does NOT match isDemoLumpName', () => {
    const dEntries = liveDirectory.filter((entry) => entry.name.length >= 3 && entry.name.startsWith('D_'));
    for (const entry of dEntries) {
      expect(isDemoLumpName(entry.name)).toBe(false);
    }
  });

  test('every DEMO lump skill byte is in the vanilla 0..4 range', () => {
    for (const { entry } of liveDemoEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      const header = parseDemoLumpHeader(lump);
      expect(header.skill).toBeGreaterThanOrEqual(0);
      expect(header.skill).toBeLessThanOrEqual(4);
    }
  });

  test('every DEMO lump episode byte is the shareware episode 1', () => {
    for (const { entry } of liveDemoEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      const header = parseDemoLumpHeader(lump);
      expect(header.episode).toBe(1);
    }
  });

  test('every DEMO lump map byte is in the shareware E1M1..E1M9 range', () => {
    for (const { entry } of liveDemoEntries) {
      const lump = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
      const header = parseDemoLumpHeader(lump);
      expect(header.map).toBeGreaterThanOrEqual(1);
      expect(header.map).toBeLessThanOrEqual(9);
    }
  });
});

describe('05-014 step file declarations', () => {
  test('the step file declares the wad lane with the correct write lock and prerequisite', async () => {
    const stepFileText = await Bun.file('plan_vanilla_parity/steps/05-014-parse-demo-lumps.md').text();
    expect(stepFileText.includes('lane\n\nwad')).toBe(true);
    expect(stepFileText.includes('src/assets/parse-demo-lumps.ts')).toBe(true);
    expect(stepFileText.includes('test/vanilla_parity/wad/parse-demo-lumps.test.ts')).toBe(true);
    expect(stepFileText.includes('00-018')).toBe(true);
  });
});
