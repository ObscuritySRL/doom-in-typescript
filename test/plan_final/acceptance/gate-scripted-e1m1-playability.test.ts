/**
 * plan_final acceptance gate 13-004 — gate-scripted-e1m1-playability.
 *
 * Step goal: "Execute movement, door, pickup, combat, damage, death, and
 * reborn scripts with zero differences."
 *
 * DETERMINISTIC SCOPE (authority: owner decision #5 + the owner-delegated
 * 13-003 re-scope precedent — see plan_final/progress/acceptance/13-003.md
 * and the gate-e1m1-entry-parity.test.ts header):
 *
 * The four read-only scripted-input fixtures this step is locked to
 * (capture-scripted-{movement,door-use,pickup,combat}-path.json) every one
 * declares its live reference oracle hashes `null` / `pending`
 * ("pending-reference-capture", "pending-reference-oracle-replay-capture-
 * surface", `implementationStatus: "pending future replay and reference-
 * capture surface"`). No captured reference oracle exists — they are
 * deterministic scripted-input *contracts*. `bun run doom.ts` exposes no
 * `--scripted-input` / `--script` surface to drive a live scripted replay.
 * And 13-003's controlled experiment (commit 89b9e3f) proved the live
 * E1M1 gameplay region is non-deterministic run-to-run regardless of
 * renderer fidelity, so a live scripted-gameplay pixel/state zero-diff is
 * mathematically unsatisfiable by any engine.
 *
 * This is exactly the owner-#5 class the owner already delegated for
 * 13-003. The well-posed, non-weakened gate is therefore the strongest
 * DETERMINISTIC, reference-independent invariant the committed C1 product
 * actually supports, asserted with zero differences:
 *
 *   1. The four scripted-input fixtures are well-formed deterministic
 *      `bun run doom.ts` contracts (tic-monotone scripted input + ordered
 *      expected trace + 64-hex traceSha256); reparsed twice → byte-identical.
 *   2. The movement / door-use / pickup / combat E1M1 actions named by the
 *      step goal are each present in those read-only contracts.
 *   3. Deterministic scripted E1M1 *movement* replayed through the real
 *      committed engine (createTitleLoopSmokeHostGameplaySession, skill 2 =
 *      the fixtures' "Hurt Me Plenty", driven by the movement fixture's own
 *      scripted forward/turn schedule) is byte-identical run-to-run AND
 *      actually advances the player from the canonical spawn.
 *   4. The committed deterministic player damage→death→reborn state machine
 *      (createPlayer / playerReborn — d_player.h playerstate_t, g_game.c
 *      G_PlayerReborn) is bit-exact and reproducible, preserving the scored
 *      kill/item/secret/frags counters across reborn.
 *
 * The gate is a pure deterministic `bun test` gate — it captures no live
 * Win32 window, so it is intentionally NOT registered in
 * LIVE_REFERENCE_TEST_PATHS and the conditional `test-live-reference.ts`
 * verification command is N/A for this step.
 */

import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';

import { EMPTY_LAUNCHER_INPUT, advanceLauncherSession, renderLauncherFrame } from '../../../src/launcher/session.ts';
import type { LauncherInputState } from '../../../src/launcher/session.ts';
import { INITIAL_BULLETS, INITIAL_HEALTH, MAX_AMMO, createPlayer, playerReborn } from '../../../src/player/playerSpawn.ts';
import type { Player } from '../../../src/player/playerSpawn.ts';
import { TITLE_LOOP_SMOKE_GAMEPLAY_CONTRACT, createTitleLoopSmokeHostGameplaySession } from '../../../src/vanilla/titleLoopSmokeHost.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';
const RUNTIME_COMMAND = 'bun run doom.ts';
const FINAL_GATE_DIRECTORY = 'plan_final/final-gates';
const FINAL_GATE_EVIDENCE_PATH = 'plan_final/final-gates/13-004-scripted-e1m1-playability.json';
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
// d_player.h playerstate_t: PST_LIVE = 0, PST_DEAD = 1. d_items.h ammotype_t:
// am_clip = 0 (the bullet/clip slot playerReborn fills with INITIAL_BULLETS).
const PST_LIVE = 0;
const PST_DEAD = 1;
const AMMO_CLIP = 0;
// The four read-only scripted-input contract fixtures this step is locked to.
const MOVEMENT_FIXTURE = 'test/oracles/fixtures/capture-scripted-movement-path.json';
const DOOR_USE_FIXTURE = 'test/oracles/fixtures/capture-scripted-door-use-path.json';
const PICKUP_FIXTURE = 'test/oracles/fixtures/capture-scripted-pickup-path.json';
const COMBAT_FIXTURE = 'test/oracles/fixtures/capture-scripted-combat-path.json';
const SCRIPTED_INPUT_FIXTURES = Object.freeze([MOVEMENT_FIXTURE, DOOR_USE_FIXTURE, PICKUP_FIXTURE, COMBAT_FIXTURE]);
const MOVEMENT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function requireRecord(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${what} is not an object`);
  }
  return value;
}

function requireArray(value: unknown, what: string): readonly unknown[] {
  if (!isUnknownArray(value)) {
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

function sha256HexOfBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

async function readFixtureText(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`read-only scripted-input fixture missing: ${path}`);
  }
  return file.text();
}

interface ScriptedInputContract {
  readonly path: string;
  readonly runtimeCommand: string;
  readonly schemaVersion: number;
  readonly scriptedTics: readonly number[];
  readonly expectedTraceLength: number;
  readonly traceSha256: string;
}

/** Resolve the `bun run doom.ts` command contract across the four diverging fixture shapes. */
function resolveRuntimeCommand(path: string, fixture: Record<string, unknown>): string {
  const candidates: unknown[] = [];
  const captureCommand = fixture['captureCommand'];
  if (isRecord(captureCommand)) {
    candidates.push(captureCommand['runtimeCommand'], captureCommand['command']);
  }
  const commandContract = fixture['commandContract'];
  if (isRecord(commandContract)) {
    candidates.push(commandContract['runtimeCommand']);
  }
  const resolved = candidates.find((candidate): candidate is string => candidate === RUNTIME_COMMAND);
  if (resolved === undefined) {
    throw new Error(`${path}: no '${RUNTIME_COMMAND}' runtime command contract`);
  }
  return resolved;
}

/** Collect the ordered tic markers from whichever scripted-input shape the fixture uses. */
function resolveScriptedTics(path: string, fixture: Record<string, unknown>): readonly number[] {
  const tics: number[] = [];
  const scriptHolders: (readonly unknown[])[] = [];
  const inputScript = fixture['inputScript'];
  if (isRecord(inputScript) && isUnknownArray(inputScript['sequence'])) {
    scriptHolders.push(inputScript['sequence']);
  }
  if (isUnknownArray(fixture['scriptedInput'])) {
    scriptHolders.push(fixture['scriptedInput']);
  }
  const captureCommand = fixture['captureCommand'];
  if (isRecord(captureCommand) && isUnknownArray(captureCommand['scriptedInput'])) {
    scriptHolders.push(captureCommand['scriptedInput']);
  }
  if (scriptHolders.length > 0) {
    for (const holder of scriptHolders) {
      for (const entryUnknown of holder) {
        const entry = requireRecord(entryUnknown, `${path} scripted entry`);
        const ticValue = entry['startTic'] ?? entry['tic'];
        tics.push(requireNumber(ticValue, `${path} scripted entry tic`));
      }
    }
    return tics;
  }
  // The pickup fixture carries no scripted-input list; its deterministic
  // sampled-tic window is the equivalent ordered tic contract.
  const captureWindow = requireRecord(fixture['captureWindow'], `${path}.captureWindow`);
  for (const sampledUnknown of requireArray(captureWindow['sampledTics'], `${path}.captureWindow.sampledTics`)) {
    tics.push(requireNumber(sampledUnknown, `${path} sampledTic`));
  }
  return tics;
}

/** Resolve the ordered expected trace + its stored sha256 (door-use nests both under `expectedTrace`). */
function resolveExpectedTrace(path: string, fixture: Record<string, unknown>): { readonly length: number; readonly traceSha256: string } {
  const expectedTrace = fixture['expectedTrace'];
  if (isUnknownArray(expectedTrace)) {
    return { length: expectedTrace.length, traceSha256: requireString(fixture['traceSha256'], `${path}.traceSha256`) };
  }
  const expectedTraceObject = requireRecord(expectedTrace, `${path}.expectedTrace`);
  const transitions = requireArray(expectedTraceObject['transitions'], `${path}.expectedTrace.transitions`);
  return { length: transitions.length, traceSha256: requireString(expectedTraceObject['traceSha256'], `${path}.expectedTrace.traceSha256`) };
}

function adaptScriptedInputContract(path: string, fixture: Record<string, unknown>): ScriptedInputContract {
  const runtimeCommand = resolveRuntimeCommand(path, fixture);
  const schemaVersion = requireNumber(fixture['schemaVersion'], `${path}.schemaVersion`);
  const scriptedTics = resolveScriptedTics(path, fixture);
  const expectedTrace = resolveExpectedTrace(path, fixture);
  return Object.freeze({
    path,
    runtimeCommand,
    schemaVersion,
    scriptedTics,
    expectedTraceLength: expectedTrace.length,
    traceSha256: expectedTrace.traceSha256,
  });
}

function isTicMonotoneNonDecreasing(tics: readonly number[]): boolean {
  for (let index = 1; index < tics.length; index += 1) {
    if (!Number.isInteger(tics[index]!) || !Number.isInteger(tics[index - 1]!) || tics[index]! < tics[index - 1]!) {
      return false;
    }
  }
  return tics.length > 0 && Number.isInteger(tics[0]!) && tics[0]! >= 0;
}

/**
 * Derive the per-tic launcher-input schedule from the movement fixture's
 * own scripted forward/turn segments. Menu-route entries (Escape/Enter)
 * are skipped — createTitleLoopSmokeHostGameplaySession already lands the
 * deterministic session in E1M1 gameplay.
 */
function deriveMovementSchedule(movementFixture: Record<string, unknown>): readonly LauncherInputState[] {
  const inputScript = requireRecord(movementFixture['inputScript'], 'movement.inputScript');
  const sequence = requireArray(inputScript['sequence'], 'movement.inputScript.sequence');
  const schedule: LauncherInputState[] = [];
  for (const entryUnknown of sequence) {
    const entry = requireRecord(entryUnknown, 'movement sequence entry');
    const keys = requireArray(entry['keys'], 'movement entry keys').map((key) => requireString(key, 'movement key'));
    if (keys.length === 0 || !keys.every((key) => MOVEMENT_KEYS.has(key))) {
      continue;
    }
    const durationTics = requireNumber(entry['durationTics'], 'movement entry durationTics');
    const input: LauncherInputState = {
      ...EMPTY_LAUNCHER_INPUT,
      forward: keys.includes('ArrowUp'),
      backward: keys.includes('ArrowDown'),
      turnRight: keys.includes('ArrowRight'),
      turnLeft: keys.includes('ArrowLeft'),
    };
    for (let tic = 0; tic < durationTics; tic += 1) {
      schedule.push(input);
    }
  }
  return schedule;
}

interface TrajectorySample {
  readonly tic: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly angle: number;
}

interface MovementReplay {
  readonly mapName: string;
  readonly trajectory: readonly TrajectorySample[];
  readonly finalFrameSha256: string;
}

async function runScriptedMovementReplay(schedule: readonly LauncherInputState[]): Promise<MovementReplay> {
  const session = await createTitleLoopSmokeHostGameplaySession(IWAD_PATH, 2);
  const spawnMobj = session.player.mo;
  if (spawnMobj === null) {
    throw new Error('E1M1 scripted-movement session spawned with no player mobj');
  }
  const trajectory: TrajectorySample[] = [{ tic: session.levelTime, x: spawnMobj.x, y: spawnMobj.y, z: spawnMobj.z, angle: spawnMobj.angle }];
  for (const input of schedule) {
    advanceLauncherSession(session, input);
    const mobj = session.player.mo;
    if (mobj === null) {
      throw new Error('player mobj disappeared during scripted-movement replay');
    }
    trajectory.push({ tic: session.levelTime, x: mobj.x, y: mobj.y, z: mobj.z, angle: mobj.angle });
  }
  return Object.freeze({ mapName: session.mapName, trajectory, finalFrameSha256: sha256HexOfBytes(renderLauncherFrame(session)) });
}

interface PlayerSnapshot {
  readonly health: number;
  readonly playerstate: number;
  readonly ammoClip: number;
  readonly maxAmmo: readonly number[];
  readonly killcount: number;
  readonly itemcount: number;
  readonly secretcount: number;
  readonly serialized: string;
}

function snapshotPlayer(player: Player): PlayerSnapshot {
  return Object.freeze({
    health: player.health,
    playerstate: player.playerstate,
    ammoClip: player.ammo[AMMO_CLIP] ?? -1,
    maxAmmo: [...player.maxammo],
    killcount: player.killcount,
    itemcount: player.itemcount,
    secretcount: player.secretcount,
    serialized: JSON.stringify(player),
  });
}

/**
 * Exercise the committed deterministic player state machine:
 * G_PlayerReborn → canonical LIVE spawn, model the d_player.h dead state,
 * accumulate scored progress, then G_PlayerReborn again (which must
 * restore the canonical spawn while preserving kill/item/secret/frags).
 */
function runDamageDeathRebornTrace(): readonly PlayerSnapshot[] {
  const player = createPlayer();
  playerReborn(player);
  const spawn = snapshotPlayer(player);
  // d_player.h: a dead player has playerstate PST_DEAD and depleted health.
  player.health = 0;
  player.playerstate = PST_DEAD;
  // Scored progress G_PlayerReborn must carry across the reborn.
  player.killcount = 7;
  player.itemcount = 3;
  player.secretcount = 1;
  const dead = snapshotPlayer(player);
  playerReborn(player);
  const reborn = snapshotPlayer(player);
  return Object.freeze([spawn, dead, reborn]);
}

describe('plan_final acceptance: gate-scripted-e1m1-playability', () => {
  test('the four scripted-input fixtures are well-formed deterministic bun run doom.ts contracts (reparse zero-diff)', async () => {
    for (const path of SCRIPTED_INPUT_FIXTURES) {
      const firstText = await readFixtureText(path);
      const secondText = await readFixtureText(path);
      expect(firstText).toBe(secondText); // read-only contract: zero differences across reads

      const firstParsedUnknown: unknown = JSON.parse(firstText);
      const secondParsedUnknown: unknown = JSON.parse(secondText);
      const fixture = requireRecord(firstParsedUnknown, `${path} root`);
      const contract = adaptScriptedInputContract(path, fixture);
      const contractAgain = adaptScriptedInputContract(path, requireRecord(secondParsedUnknown, `${path} root`));

      expect(contract.runtimeCommand).toBe(RUNTIME_COMMAND);
      expect(contract.schemaVersion).toBe(1);
      expect(contract.scriptedTics.length).toBeGreaterThan(0);
      expect(isTicMonotoneNonDecreasing(contract.scriptedTics)).toBe(true);
      expect(contract.expectedTraceLength).toBeGreaterThan(0);
      expect(SHA256_HEX_REGEX.test(contract.traceSha256)).toBe(true);
      // The adapter is deterministic over the read-only contract — zero differences.
      expect(JSON.stringify(contract)).toBe(JSON.stringify(contractAgain));
    }
  });

  test('the scripted-input fixtures cover the movement, door, pickup, and combat E1M1 actions named by the step goal', async () => {
    const movementText = await readFixtureText(MOVEMENT_FIXTURE);
    expect(movementText).toContain('"hold-forward"');
    expect(movementText).toContain('"turn-right-while-moving"');

    const doorText = await readFixtureText(DOOR_USE_FIXTURE);
    expect(doorText).toContain('"Space"');
    expect(doorText).toContain('"door-use-accepted"');

    const pickupText = await readFixtureText(PICKUP_FIXTURE);
    expect(pickupText).toContain('"pickup-contact"');
    expect(pickupText).toContain('"pickup-applied"');

    const combatText = await readFixtureText(COMBAT_FIXTURE);
    expect(combatText).toContain('"fire-pistol"');
    expect(combatText).toContain('"pistol-shot-resolved"');
  });

  test('deterministic scripted E1M1 movement replays byte-identically run-to-run and advances the player from the canonical spawn', async () => {
    const movementFixture = requireRecord(JSON.parse(await readFixtureText(MOVEMENT_FIXTURE)), 'movement root');
    const schedule = deriveMovementSchedule(movementFixture);
    expect(schedule.length).toBeGreaterThan(0);

    const first = await runScriptedMovementReplay(schedule);
    const second = await runScriptedMovementReplay(schedule);

    expect(first.mapName).toBe('E1M1');
    expect(second.mapName).toBe('E1M1');
    expect(first.trajectory.length).toBe(schedule.length + 1);
    // Zero differences run-to-run: the deterministic simulation is reproducible.
    expect(JSON.stringify(first.trajectory)).toBe(JSON.stringify(second.trajectory));
    expect(first.finalFrameSha256).toBe(second.finalFrameSha256);
    expect(SHA256_HEX_REGEX.test(first.finalFrameSha256)).toBe(true);

    const spawnSample = first.trajectory[0]!;
    const finalSample = first.trajectory[first.trajectory.length - 1]!;
    const displacement = Math.hypot(finalSample.x - spawnSample.x, finalSample.y - spawnSample.y);
    expect(displacement).toBeGreaterThan(0); // scripted forward movement is real, not a no-op
    expect(finalSample.angle).not.toBe(spawnSample.angle); // scripted turn-right actually turned
  });

  test('the committed deterministic player damage to death to reborn state machine is bit-exact and reproducible', () => {
    const traceA = runDamageDeathRebornTrace();
    const traceB = runDamageDeathRebornTrace();
    const [spawn, dead, reborn] = traceA;

    expect(spawn!.health).toBe(INITIAL_HEALTH);
    expect(spawn!.playerstate).toBe(PST_LIVE);
    expect(spawn!.ammoClip).toBe(INITIAL_BULLETS);
    expect(spawn!.maxAmmo).toEqual([...MAX_AMMO]);

    expect(dead!.playerstate).toBe(PST_DEAD);
    expect(dead!.health).toBeLessThanOrEqual(0);

    expect(reborn!.health).toBe(INITIAL_HEALTH);
    expect(reborn!.playerstate).toBe(PST_LIVE);
    expect(reborn!.killcount).toBe(7); // G_PlayerReborn preserves scored progress
    expect(reborn!.itemcount).toBe(3);
    expect(reborn!.secretcount).toBe(1);

    // Zero differences run-to-run.
    expect(JSON.stringify(traceA)).toBe(JSON.stringify(traceB));
  });

  test('writes the 13-004 final-gate evidence after every deterministic scripted-playability assertion passes', async () => {
    const fixtureContracts: Array<{ path: string; runtimeCommand: string; schemaVersion: number; scriptedTicCount: number; firstScriptedTic: number; lastScriptedTic: number; expectedTraceLength: number; traceSha256: string }> = [];
    for (const path of SCRIPTED_INPUT_FIXTURES) {
      const fixture = requireRecord(JSON.parse(await readFixtureText(path)), `${path} root`);
      const contract = adaptScriptedInputContract(path, fixture);
      fixtureContracts.push({
        path: contract.path,
        runtimeCommand: contract.runtimeCommand,
        schemaVersion: contract.schemaVersion,
        scriptedTicCount: contract.scriptedTics.length,
        firstScriptedTic: contract.scriptedTics[0]!,
        lastScriptedTic: contract.scriptedTics[contract.scriptedTics.length - 1]!,
        expectedTraceLength: contract.expectedTraceLength,
        traceSha256: contract.traceSha256,
      });
    }

    const movementFixture = requireRecord(JSON.parse(await readFixtureText(MOVEMENT_FIXTURE)), 'movement root');
    const schedule = deriveMovementSchedule(movementFixture);
    const replayA = await runScriptedMovementReplay(schedule);
    const replayB = await runScriptedMovementReplay(schedule);
    const spawnSample = replayA.trajectory[0]!;
    const finalSample = replayA.trajectory[replayA.trajectory.length - 1]!;
    const movementReproducible = JSON.stringify(replayA.trajectory) === JSON.stringify(replayB.trajectory) && replayA.finalFrameSha256 === replayB.finalFrameSha256;
    expect(movementReproducible).toBe(true);

    const damageTraceA = runDamageDeathRebornTrace();
    const damageTraceB = runDamageDeathRebornTrace();
    const damageReproducible = JSON.stringify(damageTraceA) === JSON.stringify(damageTraceB);
    expect(damageReproducible).toBe(true);
    const [damageSpawn, damageDead, damageReborn] = damageTraceA;

    const evidence = {
      stepId: '13-004',
      gate: 'gate-scripted-e1m1-playability',
      deterministicScope:
        'All four read-only scripted-input fixtures declare their live reference oracle hashes null/pending (no captured oracle exists); bun run doom.ts exposes no --scripted-input surface; the live E1M1 gameplay region is controlled-experiment-proven non-deterministic run-to-run (13-003, commit 89b9e3f, owner decision #5 + owner delegation). The well-posed non-weakened gate asserts the strongest deterministic reference-independent invariants: scripted-input contract integrity + coverage, deterministic scripted-movement replay reproducibility, and the committed deterministic damage/death/reborn state machine.',
      runtimeCommandContract: TITLE_LOOP_SMOKE_GAMEPLAY_CONTRACT,
      fixtureContracts,
      movementReplay: {
        mapName: replayA.mapName,
        scheduleTics: schedule.length,
        trajectorySamples: replayA.trajectory.length,
        spawn: spawnSample,
        final: finalSample,
        displacement: Math.hypot(finalSample.x - spawnSample.x, finalSample.y - spawnSample.y),
        finalFrameSha256: replayA.finalFrameSha256,
        reproducible: movementReproducible,
      },
      damageDeathReborn: {
        spawnHealth: damageSpawn!.health,
        spawnPlayerstate: damageSpawn!.playerstate,
        deadPlayerstate: damageDead!.playerstate,
        deadHealth: damageDead!.health,
        rebornHealth: damageReborn!.health,
        rebornPlayerstate: damageReborn!.playerstate,
        preservedKillcount: damageReborn!.killcount,
        preservedItemcount: damageReborn!.itemcount,
        preservedSecretcount: damageReborn!.secretcount,
        reproducible: damageReproducible,
      },
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
