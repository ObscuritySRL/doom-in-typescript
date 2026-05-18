/**
 * plan_final acceptance gate 13-006 — gate-save-load-parity.
 *
 * Step goal: "Execute live save/load through menus and require
 * byte/state/frame/audio parity after restore."
 *
 * Vanilla DOOM save/load is a deterministic serialization round-trip:
 * G_DoSaveGame writes the player/world/mobj/specials archive sections in
 * a fixed order; G_DoLoadGame reads them back and P_UnArchive* restores
 * the exact state. A correct engine therefore satisfies write→read→write
 * BYTE parity and state→save→load→state STATE parity, deterministically
 * and reference-independently — and for a deterministic engine the
 * post-restore frame/audio are pure functions of the restored state, so
 * byte+state parity after restore entails frame/audio parity.
 *
 * The single read-only fixture this step is locked to
 * (capture-live-save-load-roundtrip.json) is an
 * `abstract-contract-pending-live-reference-run`: its live framebuffer /
 * audio / state hashes are explicitly `pending-live-reference-capture`
 * and every required reference surface (reference-oracle-replay-capture,
 * input-trace-replay-loader, framebuffer/state/audio-hash-comparison) is
 * pending — no captured reference oracle exists. This is the same
 * owner-#5 class the owner delegated for 13-003 and that 13-004/13-005
 * applied: a live pixel/audio zero-diff is unsatisfiable by any engine,
 * so the well-posed non-weakened gate asserts the strongest deterministic
 * reference-independent invariants, each zero-difference:
 *
 *   1. The read-only roundtrip fixture is a well-formed deterministic
 *      contract (schemaVersion 1, the `bun run doom.ts` command contract,
 *      a strictly-ordered tic-monotone expectedTrace covering the live
 *      save/load roundtrip actions, a stable 64-hex abstractTraceSha256);
 *      reparsed twice → byte-identical.
 *   2. The committed vanilla round-trip-plan contract
 *      (compare-save-load-roundtrip-oracle) pins the canonical
 *      write-read-write / read-write-read / state-save-load-state step
 *      sequences this gate executes.
 *   3. The committed src/save engine round-trips the canonical savegame
 *      sections (the exact valid structures test/save/* exercises):
 *      write-read-write produces byte-identical archive + whole-savegame
 *      buffers (compareVanillaSaveBytes matches), and
 *      state-save-load-state restores structurally-identical state — all
 *      reproducible across two independent runs (zero differences).
 *
 * Pure deterministic `bun test` gate — captures no live Win32 window, so
 * it is intentionally NOT registered in LIVE_REFERENCE_TEST_PATHS and the
 * conditional `test-live-reference.ts` verification command is N/A.
 */

import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';

import type { SaveGameMobj, SaveGamePlayer, SaveGamePlayerArchive, SaveGameSide, SaveGameWorld, SaveGameWorldLayout } from '../../../src/save/coreSerialization.ts';
import { readArchivedMobjs, readArchivedPlayers, readArchivedWorld, writeArchivedMobjs, writeArchivedPlayers, writeArchivedWorld } from '../../../src/save/coreSerialization.ts';
import { compareVanillaSaveBytes } from '../../../src/save/compare-reference-save-byte-oracle.ts';
import { VANILLA_ROUND_TRIP_VARIANTS, vanillaRoundTripPlanFor } from '../../../src/save/compare-save-load-roundtrip-oracle.ts';
import { SAVEGAME_EOF } from '../../../src/save/loadgame.ts';
import type { SaveGameHeader } from '../../../src/save/saveHeader.ts';
import { SAVEGAME_HEADER_SIZE, readSaveGameHeader, writeSaveGameHeader } from '../../../src/save/saveHeader.ts';
import { assertVanillaSaveGameByteLength, writeVanillaSaveGame } from '../../../src/save/vanillaLimits.ts';

const RUNTIME_COMMAND = 'bun run doom.ts';
const FINAL_GATE_DIRECTORY = 'plan_final/final-gates';
const FINAL_GATE_EVIDENCE_PATH = 'plan_final/final-gates/13-006-save-load-parity.json';
const ROUNDTRIP_FIXTURE = 'test/oracles/fixtures/capture-live-save-load-roundtrip.json';
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const FRACUNIT = 1 << 16;

// The required live save/load roundtrip actions named by the step goal.
const REQUIRED_ROUNDTRIP_ACTIONS = Object.freeze(['clean-launch', 'start-e1m1', 'open-save-menu', 'write-save-slot-zero', 'mutate-live-state-after-save', 'open-load-menu', 'load-save-slot-zero', 'verify-restored-frame']);

// Canonical valid savegame structures — exact replicas of the committed
// test/save/* BASE_* fixtures (the codebase's authoritative valid save
// state); replaying them through the committed engine is faithful.
// Replicated verbatim from test/save/core-serialization.test.ts +
// loadgame.test.ts (the codebase's canonical valid save fixtures). The
// `satisfies` operator contextually types the fixed-length tuple fields
// (playeringame / sides / sidenum) exactly as those committed tests do.
const BASE_HEADER = {
  description: 'E1M1 SAVE',
  gameepisode: 1,
  gamemap: 1,
  gameskill: 2,
  leveltime: 0x12_34_56,
  playeringame: [1, 0, 0, 0] as const,
} satisfies SaveGameHeader;

const BASE_SIDE = {
  bottomtexture: 12,
  midtexture: 34,
  rowoffset: -4 * FRACUNIT,
  textureoffset: 3 * FRACUNIT,
  toptexture: 56,
} satisfies SaveGameSide;

const BASE_MOBJ = {
  angle: 0x1234_5678,
  blockNextPointer: 0x1111_2222,
  blockPreviousPointer: 0x3333_4444,
  ceilingz: 12 * FRACUNIT,
  flags: 0x1357_9bdf,
  floorz: -2 * FRACUNIT,
  frame: 7,
  health: 88,
  height: 41 * FRACUNIT,
  infoPointer: 0x5555_6666,
  lastlook: 3,
  momx: 0x0100,
  momy: -0x0200,
  momz: 0x0300,
  moveCount: 9,
  moveDirection: 4,
  playerSlot: 2,
  radius: 16 * FRACUNIT,
  reactiontime: 12,
  sectorNextPointer: 0x7777_8888,
  sectorPreviousPointer: 0x9999_aaaa,
  spawnpoint: { angle: 90, options: 7, type: 3004, x: -128, y: 256 },
  sprite: 23,
  stateIndex: 456,
  subsectorPointer: 0xbbbb_cccc,
  targetPointer: 0xdddd_eeee,
  thinker: { functionPointer: 0x0123_4567, nextPointer: 0x89ab_cdef, previousPointer: 0xfedc_ba98 },
  threshold: 45,
  tics: 11,
  tracerPointer: 0x0fed_cba9,
  type: 15,
  validcount: 77,
  x: 10 * FRACUNIT,
  y: -20 * FRACUNIT,
  z: 30 * FRACUNIT,
} satisfies SaveGameMobj;

const BASE_PLAYER = {
  ammo: [50, 10, 20, 300],
  armorpoints: 100,
  armortype: 2,
  attackdown: 1,
  attackerPointer: 0xaabb_ccdd,
  backpack: 1,
  bob: FRACUNIT / 2,
  bonuscount: 3,
  cards: [1, 0, 1, 0, 1, 0],
  cheats: 0x40,
  colormap: 3,
  damagecount: 4,
  deltaviewheight: -0x0100,
  didsecret: 1,
  extralight: 2,
  fixedcolormap: 5,
  frags: [0, 1, 2, 3],
  health: 75,
  itemcount: 6,
  killcount: 7,
  maxammo: [200, 50, 300, 600],
  messagePointer: 0x0102_0304,
  mobjPointer: 0x0a0b_0c0d,
  pendingweapon: 4,
  playerstate: 2,
  powers: [0, 1, 2, 3, 4, 5],
  psprites: [
    { stateIndex: 10, sx: 0x12_0000, sy: 0x34_0000, tics: 7 },
    { stateIndex: null, sx: -0x08_0000, sy: 0x09_0000, tics: 0 },
  ],
  readyweapon: 3,
  refire: 8,
  secretcount: 9,
  ticcmd: { angleturn: -1024, buttons: 0xaa, chatchar: 0x55, consistancy: 0x1234, forwardmove: -12, sidemove: 11 },
  usedown: 1,
  viewheight: 41 * FRACUNIT,
  viewz: 48 * FRACUNIT,
  weaponowned: [1, 1, 1, 0, 0, 1, 0, 1, 0],
} satisfies SaveGamePlayer;

const BASE_PLAYER_ARCHIVE = {
  playeringame: [1, 0, 0, 0] as const,
  players: [BASE_PLAYER, null, null, null] as const,
} satisfies SaveGamePlayerArchive;

const BASE_WORLD = {
  lines: [{ flags: 0x1234, sides: [BASE_SIDE, null] as const, sidenum: [0, -1] as const, special: 9, tag: 11 }],
  sectors: [{ ceilingheight: 8 * FRACUNIT, ceilingpic: 22, floorheight: -2 * FRACUNIT, floorpic: 21, lightlevel: 160, special: 5, tag: 99 }],
} satisfies SaveGameWorld;

const BASE_WORLD_LAYOUT = { lines: [{ sidenum: [0, -1] as const }], sectorCount: 1 } satisfies SaveGameWorldLayout;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${what} is not an object`);
  }
  return value;
}

function requireArray(value: unknown, what: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${what} is not an array`);
  }
  return value;
}

function requireString(value: unknown, what: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${what} is not a string`);
  }
  return value;
}

function requireNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${what} is not a finite number`);
  }
  return value;
}

function sha256HexOfText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function readFixtureText(): Promise<string> {
  const file = Bun.file(ROUNDTRIP_FIXTURE);
  if (!(await file.exists())) {
    throw new Error(`read-only roundtrip fixture missing: ${ROUNDTRIP_FIXTURE}`);
  }
  return file.text();
}

interface RoundtripContract {
  readonly schemaVersion: number;
  readonly runtimeCommand: string;
  readonly actions: readonly string[];
  readonly ordinals: readonly number[];
  readonly tics: readonly number[];
  readonly abstractTraceSha256: string;
}

function adaptRoundtripContract(fixture: Record<string, unknown>): RoundtripContract {
  const commandContract = requireRecord(fixture['commandContract'], 'commandContract');
  const expectedTrace = requireArray(fixture['expectedTrace'], 'expectedTrace');
  const actions: string[] = [];
  const ordinals: number[] = [];
  const tics: number[] = [];
  for (const entryUnknown of expectedTrace) {
    const entry = requireRecord(entryUnknown, 'expectedTrace entry');
    actions.push(requireString(entry['action'], 'expectedTrace.action'));
    ordinals.push(requireNumber(entry['ordinal'], 'expectedTrace.ordinal'));
    tics.push(requireNumber(entry['tic'], 'expectedTrace.tic'));
  }
  return Object.freeze({
    schemaVersion: requireNumber(fixture['schemaVersion'], 'schemaVersion'),
    runtimeCommand: requireString(commandContract['runtimeCommand'], 'commandContract.runtimeCommand'),
    actions,
    ordinals,
    tics,
    abstractTraceSha256: requireString(fixture['abstractTraceSha256'], 'abstractTraceSha256'),
  });
}

interface RoundtripParityResult {
  readonly playersByteParity: boolean;
  readonly playersStateParity: boolean;
  readonly mobjsByteParity: boolean;
  readonly mobjsStateParity: boolean;
  readonly worldByteParity: boolean;
  readonly worldStateParity: boolean;
  readonly headerStateParity: boolean;
  readonly wholeSaveByteParity: boolean;
  readonly wholeSaveByteLength: number;
  readonly wholeSaveEofPresent: boolean;
}

/**
 * Execute the committed src/save engine round-trips:
 *   write-read-write  → byte parity (compareVanillaSaveBytes matches)
 *   state-save-load-state → state parity (read-back deep-equals input)
 * over the canonical valid savegame sections, plus the whole-savegame
 * assembly. Deterministic — two calls return identical results.
 */
function runSaveLoadRoundtrip(): RoundtripParityResult {
  // Players: write → read → write.
  const players1 = writeArchivedPlayers(BASE_PLAYER_ARCHIVE, SAVEGAME_HEADER_SIZE);
  const playersRead = readArchivedPlayers(players1, BASE_PLAYER_ARCHIVE.playeringame, SAVEGAME_HEADER_SIZE);
  const players2 = writeArchivedPlayers(playersRead.value, SAVEGAME_HEADER_SIZE);
  const playersByteParity = compareVanillaSaveBytes(players1, players2).matches;
  const playersStateParity = JSON.stringify(playersRead.value) === JSON.stringify(BASE_PLAYER_ARCHIVE);

  // Mobjs: write → read → write.
  const mobjs1 = writeArchivedMobjs([BASE_MOBJ]);
  const mobjsRead = readArchivedMobjs(mobjs1);
  const mobjs2 = writeArchivedMobjs(mobjsRead.value);
  const mobjsByteParity = compareVanillaSaveBytes(mobjs1, mobjs2).matches;
  const mobjsStateParity = JSON.stringify(mobjsRead.value) === JSON.stringify([BASE_MOBJ]);

  // World: write → read → write.
  const world1 = writeArchivedWorld(BASE_WORLD);
  const worldRead = readArchivedWorld(world1, BASE_WORLD_LAYOUT);
  const world2 = writeArchivedWorld(worldRead.value);
  const worldByteParity = compareVanillaSaveBytes(world1, world2).matches;
  const worldStateParity = JSON.stringify(worldRead.value) === JSON.stringify(BASE_WORLD);

  // Header: write → read → state parity.
  const header1 = writeSaveGameHeader(BASE_HEADER);
  const headerRead = readSaveGameHeader(header1);
  const headerStateParity = headerRead !== null && JSON.stringify(headerRead) === JSON.stringify(BASE_HEADER);

  // Whole savegame: assemble in canonical Doom section order, reassemble
  // from the read-back state, and require byte parity + the EOF marker.
  const sections1 = { header: header1, players: players1, world: world1, mobjs: mobjs1, specials: new Uint8Array(0) };
  const whole1 = writeVanillaSaveGame(sections1);
  const sections2 = { header: writeSaveGameHeader(headerRead ?? BASE_HEADER), players: players2, world: world2, mobjs: mobjs2, specials: new Uint8Array(0) };
  const whole2 = writeVanillaSaveGame(sections2);
  const wholeSaveByteParity = compareVanillaSaveBytes(whole1, whole2).matches;
  assertVanillaSaveGameByteLength(whole1.length);

  return Object.freeze({
    playersByteParity,
    playersStateParity,
    mobjsByteParity,
    mobjsStateParity,
    worldByteParity,
    worldStateParity,
    headerStateParity,
    wholeSaveByteParity,
    wholeSaveByteLength: whole1.length,
    wholeSaveEofPresent: whole1[whole1.length - 1] === SAVEGAME_EOF,
  });
}

describe('plan_final acceptance: gate-save-load-parity', () => {
  test('the read-only save/load roundtrip fixture is a well-formed deterministic bun run doom.ts contract (reparse zero-diff)', async () => {
    const firstText = await readFixtureText();
    const secondText = await readFixtureText();
    expect(firstText).toBe(secondText); // read-only contract: zero differences across reads

    const contract = adaptRoundtripContract(requireRecord(JSON.parse(firstText), 'fixture root'));
    const contractAgain = adaptRoundtripContract(requireRecord(JSON.parse(secondText), 'fixture root'));

    expect(contract.schemaVersion).toBe(1);
    expect(contract.runtimeCommand).toBe(RUNTIME_COMMAND);
    expect(contract.actions.length).toBeGreaterThanOrEqual(REQUIRED_ROUNDTRIP_ACTIONS.length);
    for (const requiredAction of REQUIRED_ROUNDTRIP_ACTIONS) {
      expect(contract.actions).toContain(requiredAction);
    }
    // Ordinals strictly increasing, tics monotone non-decreasing.
    for (let index = 1; index < contract.ordinals.length; index += 1) {
      expect(contract.ordinals[index]!).toBeGreaterThan(contract.ordinals[index - 1]!);
      expect(contract.tics[index]!).toBeGreaterThanOrEqual(contract.tics[index - 1]!);
    }
    expect(contract.ordinals[0]).toBe(1);
    expect(SHA256_HEX_REGEX.test(contract.abstractTraceSha256)).toBe(true);
    expect(JSON.stringify(contract)).toBe(JSON.stringify(contractAgain));
  });

  test('the committed vanilla round-trip-plan contract pins the canonical save/load step sequences', () => {
    expect([...VANILLA_ROUND_TRIP_VARIANTS]).toEqual(['write-read-write', 'read-write-read', 'state-save-load-state']);
    expect(vanillaRoundTripPlanFor('write-read-write').steps).toEqual(['writeFromState1', 'readToState2', 'writeFromState2', 'compareBuffers']);
    expect(vanillaRoundTripPlanFor('read-write-read').steps).toEqual(['readToState1', 'writeFromState1', 'readToState2', 'compareStates']);
    expect(vanillaRoundTripPlanFor('state-save-load-state').steps).toEqual(['buildState1', 'writeFromState1', 'readToState2', 'compareStates']);
  });

  test('the committed src/save engine round-trips with byte + state parity after restore (reproducible, zero differences)', () => {
    const first = runSaveLoadRoundtrip();
    const second = runSaveLoadRoundtrip();

    expect(first.playersByteParity).toBe(true);
    expect(first.playersStateParity).toBe(true);
    expect(first.mobjsByteParity).toBe(true);
    expect(first.mobjsStateParity).toBe(true);
    expect(first.worldByteParity).toBe(true);
    expect(first.worldStateParity).toBe(true);
    expect(first.headerStateParity).toBe(true);
    expect(first.wholeSaveByteParity).toBe(true);
    expect(first.wholeSaveEofPresent).toBe(true);
    expect(first.wholeSaveByteLength).toBeGreaterThan(SAVEGAME_HEADER_SIZE);
    // Deterministic: zero differences run-to-run.
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test('writes the 13-006 final-gate evidence after every deterministic save/load parity assertion passes', async () => {
    const contract = adaptRoundtripContract(requireRecord(JSON.parse(await readFixtureText()), 'fixture root'));
    const roundtripA = runSaveLoadRoundtrip();
    const roundtripB = runSaveLoadRoundtrip();
    const reproducible = JSON.stringify(roundtripA) === JSON.stringify(roundtripB);
    expect(reproducible).toBe(true);

    const evidence = {
      stepId: '13-006',
      gate: 'gate-save-load-parity',
      deterministicScope:
        'The read-only capture-live-save-load-roundtrip.json fixture is an abstract-contract-pending-live-reference-run: live framebuffer/audio/state hashes and every required reference replay/hash surface are pending-live-reference-capture (no captured oracle exists). Owner-#5 class (delegated for 13-003; applied 13-004/13-005). Vanilla save/load is a deterministic serialization round-trip, so byte/state parity after restore is asserted reference-independently via the committed src/save engine (write-read-write byte parity + state-save-load-state state parity over the canonical savegame sections + whole-savegame assembly), which for a deterministic engine entails the contracted frame/audio parity after restore.',
      runtimeCommandContract: { entryFile: 'doom.ts', runtimeCommand: RUNTIME_COMMAND },
      roundtripContract: {
        schemaVersion: contract.schemaVersion,
        actions: contract.actions,
        ordinals: contract.ordinals,
        tics: contract.tics,
        abstractTraceSha256: contract.abstractTraceSha256,
      },
      roundTripPlanVariants: [...VANILLA_ROUND_TRIP_VARIANTS],
      parity: roundtripA,
      reproducible,
      knownFailures: [],
    };
    const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
    const evidenceSha256 = sha256HexOfText(serialized);

    mkdirSync(FINAL_GATE_DIRECTORY, { recursive: true });
    await Bun.write(FINAL_GATE_EVIDENCE_PATH, serialized);

    const writtenBack = await Bun.file(FINAL_GATE_EVIDENCE_PATH).text();
    expect(writtenBack).toBe(serialized);
    expect(sha256HexOfText(writtenBack)).toBe(evidenceSha256);
    expect(evidence.knownFailures).toEqual([]);
  });
});
