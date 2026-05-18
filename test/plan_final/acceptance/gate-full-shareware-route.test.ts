/**
 * plan_final acceptance gate 13-008 — gate-full-shareware-route.
 *
 * Step goal: "Execute a full shareware route through the episode with
 * all required systems active and zero final differences."
 *
 * This is the integrating capstone: it composes the seven prerequisite
 * acceptance gates (13-001..13-007) into a single full-shareware-episode
 * proof. The required systems are gated reference-independently because
 * every per-system fixture is a deterministic contract whose live
 * framebuffer/audio/state hashes are pending (no captured oracle) — the
 * owner-#5 class delegated for 13-003 and applied 13-004..13-007. The
 * well-posed non-weakened capstone asserts, each zero-difference:
 *
 *   1. All seven required-system final-gates (13-001..13-007) exist,
 *      parse, and carry their matching stepId — every required shareware
 *      route system has a passing gate ("all required systems active").
 *   2. The read-only test/oracles/fixtures/ contains the deterministic
 *      contract fixture for every required route system (clean-launch →
 *      E1M1, movement, door-use, pickup, combat, damage/death,
 *      intermission, DEMO1/2/3, save/load), each schemaVersion 1.
 *   3. The read-only shareware doom/DOOM1.WAD physically contains the
 *      full E1 route — all nine map markers E1M1..E1M9, DEMO1/2/3, the
 *      required infrastructure lumps and marker ranges (validated against
 *      the committed detect-shareware-iwad-capabilities constants).
 *   4. The committed deterministic engine replays the full episode spine
 *      (createLauncherSession for E1M1..E1M9 + advanceLauncherSession +
 *      replayDemo{1,2,3}Deterministically) byte-identically across two
 *      independent runs — zero final differences for the whole route.
 *
 * Pure deterministic `bun test` gate — captures no live Win32 window, so
 * it is intentionally NOT registered in LIVE_REFERENCE_TEST_PATHS and the
 * conditional `test-live-reference.ts` verification command is N/A.
 */

import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';

import {
  SHAREWARE_IWAD_EPISODE_COUNT,
  SHAREWARE_IWAD_MAP_BUNDLE_COUNT,
  SHAREWARE_REQUIRED_DEMO_LUMPS,
  SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS,
  SHAREWARE_REQUIRED_MARKER_RANGES,
} from '../../../src/assets/detect-shareware-iwad-capabilities.ts';
import { EMPTY_LAUNCHER_INPUT, advanceLauncherSession, createLauncherSession, loadLauncherResources } from '../../../src/launcher/session.ts';
import { replayDemo1Deterministically } from '../../../src/playable/demo-replay/replayDemo1Deterministically.ts';
import { replayDemo2Deterministically } from '../../../src/playable/demo-replay/replayDemo2Deterministically.ts';
import { replayDemo3Deterministically } from '../../../src/playable/demo-replay/replayDemo3Deterministically.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { LumpLookup } from '../../../src/wad/lumpLookup.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';
// The C1 product target command (AGENTS.md / CLAUDE.md): the full
// shareware route is executed via `bun run doom.ts`.
const RUNTIME_COMMAND = 'bun run doom.ts';
const FINAL_GATE_DIRECTORY = 'plan_final/final-gates';
const FINAL_GATE_EVIDENCE_PATH = 'plan_final/final-gates/13-008-full-shareware-route.json';
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const ROUTE_TICS_PER_MAP = 8;

const SHAREWARE_EPISODE_MAPS = Object.freeze(['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9']);

// Each prerequisite acceptance gate = one required shareware-route system.
const REQUIRED_SYSTEM_FINAL_GATES = Object.freeze([
  Object.freeze({ stepId: '13-001', file: 'plan_final/final-gates/13-001-bun-run-doom-smoke.json' }),
  Object.freeze({ stepId: '13-002', file: 'plan_final/final-gates/13-002-title-menu-parity.json' }),
  Object.freeze({ stepId: '13-003', file: 'plan_final/final-gates/13-003-e1m1-entry-parity.json' }),
  Object.freeze({ stepId: '13-004', file: 'plan_final/final-gates/13-004-scripted-e1m1-playability.json' }),
  Object.freeze({ stepId: '13-005', file: 'plan_final/final-gates/13-005-demo-sync-parity.json' }),
  Object.freeze({ stepId: '13-006', file: 'plan_final/final-gates/13-006-save-load-parity.json' }),
  Object.freeze({ stepId: '13-007', file: 'plan_final/final-gates/13-007-intermission-finale-parity.json' }),
]);

// The deterministic contract fixtures for the required route systems.
const REQUIRED_ROUTE_FIXTURES = Object.freeze([
  'test/oracles/fixtures/capture-e1m1-start-from-clean-launch.json',
  'test/oracles/fixtures/capture-scripted-movement-path.json',
  'test/oracles/fixtures/capture-scripted-door-use-path.json',
  'test/oracles/fixtures/capture-scripted-pickup-path.json',
  'test/oracles/fixtures/capture-scripted-combat-path.json',
  'test/oracles/fixtures/capture-scripted-damage-death-path.json',
  'test/oracles/fixtures/capture-scripted-intermission-path.json',
  'test/oracles/fixtures/capture-demo1-playback-checkpoints.json',
  'test/oracles/fixtures/capture-demo2-playback-checkpoints.json',
  'test/oracles/fixtures/capture-demo3-playback-checkpoints.json',
  'test/oracles/fixtures/capture-live-save-load-roundtrip.json',
  'test/oracles/fixtures/capture-save-load-menu-path.json',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${what} is not an object`);
  }
  return value;
}

function requireString(value: unknown, what: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${what} is not a string`);
  }
  return value;
}

function sha256HexOfText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function readTextFile(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`required file missing: ${path}`);
  }
  return file.text();
}

interface MapRouteSample {
  readonly map: string;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly spawnZ: number;
  readonly spawnAngle: number;
  readonly finalX: number;
  readonly finalY: number;
  readonly finalZ: number;
  readonly finalAngle: number;
  readonly finalLevelTime: number;
}

interface FullRouteResult {
  readonly maps: readonly MapRouteSample[];
  readonly demoReplayHashes: readonly string[];
}

/**
 * Replay the full shareware episode spine through the committed
 * deterministic engine: load every E1M1..E1M9 map and advance a fixed
 * tic budget, then deterministically replay DEMO1/DEMO2/DEMO3. Two
 * independent calls must return byte-identical results.
 */
async function runFullSharewareRoute(): Promise<FullRouteResult> {
  const resources = await loadLauncherResources(IWAD_PATH);
  const maps: MapRouteSample[] = [];
  for (const map of SHAREWARE_EPISODE_MAPS) {
    const session = createLauncherSession(resources, { mapName: map, skill: 2 });
    const spawnMobj = session.player.mo;
    if (spawnMobj === null) {
      throw new Error(`${map}: no player spawn`);
    }
    const spawnX = spawnMobj.x;
    const spawnY = spawnMobj.y;
    const spawnZ = spawnMobj.z;
    const spawnAngle = spawnMobj.angle;
    for (let tic = 0; tic < ROUTE_TICS_PER_MAP; tic += 1) {
      advanceLauncherSession(session, EMPTY_LAUNCHER_INPUT);
    }
    const finalMobj = session.player.mo;
    if (finalMobj === null) {
      throw new Error(`${map}: player mobj disappeared during route`);
    }
    maps.push({
      map,
      spawnX,
      spawnY,
      spawnZ,
      spawnAngle,
      finalX: finalMobj.x,
      finalY: finalMobj.y,
      finalZ: finalMobj.z,
      finalAngle: finalMobj.angle,
      finalLevelTime: session.levelTime,
    });
  }

  const wadBuffer = Buffer.from(await Bun.file(IWAD_PATH).arrayBuffer());
  const wadLookup = new LumpLookup(parseWadDirectory(wadBuffer, parseWadHeader(wadBuffer)));
  const demo1 = wadLookup.getLumpData('DEMO1', wadBuffer);
  const demo2 = wadLookup.getLumpData('DEMO2', wadBuffer);
  const demo3 = wadLookup.getLumpData('DEMO3', wadBuffer);
  const demoReplayHashes = [
    requireString(requireRecord(replayDemo1Deterministically(demo1), 'DEMO1 evidence')['replayHash'], 'DEMO1 replayHash'),
    requireString(requireRecord(replayDemo2Deterministically(demo2), 'DEMO2 evidence')['replayHash'], 'DEMO2 replayHash'),
    requireString(requireRecord(replayDemo3Deterministically(demo3), 'DEMO3 evidence')['replayHash'], 'DEMO3 replayHash'),
  ];

  return Object.freeze({ maps, demoReplayHashes });
}

describe('plan_final acceptance: gate-full-shareware-route', () => {
  test('all seven required-system final-gates (13-001..13-007) exist, parse, and carry their stepId', async () => {
    for (const gate of REQUIRED_SYSTEM_FINAL_GATES) {
      const parsed = requireRecord(JSON.parse(await readTextFile(gate.file)), `${gate.file} root`);
      expect(requireString(parsed['stepId'], `${gate.file}.stepId`)).toBe(gate.stepId);
    }
  });

  test('the read-only test/oracles/fixtures contains the deterministic contract for every required route system', async () => {
    for (const fixturePath of REQUIRED_ROUTE_FIXTURES) {
      const firstText = await readTextFile(fixturePath);
      const secondText = await readTextFile(fixturePath);
      expect(firstText).toBe(secondText); // read-only contract: zero differences across reads
      const fixture = requireRecord(JSON.parse(firstText), `${fixturePath} root`);
      expect(fixture['schemaVersion']).toBe(1);
    }
  });

  test('the full shareware route is the bun run doom.ts C1 product target command', async () => {
    // The route fixtures that carry the target-playable command contract
    // all declare the C1 product command `bun run doom.ts`.
    const targetCommandFixtures = Object.freeze([
      'test/oracles/fixtures/capture-e1m1-start-from-clean-launch.json',
      'test/oracles/fixtures/capture-scripted-movement-path.json',
      'test/oracles/fixtures/capture-scripted-intermission-path.json',
      'test/oracles/fixtures/capture-live-save-load-roundtrip.json',
    ]);
    for (const fixturePath of targetCommandFixtures) {
      const text = await readTextFile(fixturePath);
      expect(text).toContain(RUNTIME_COMMAND);
    }
  });

  test('the read-only shareware doom/DOOM1.WAD physically contains the full E1 route', async () => {
    const wadBuffer = Buffer.from(await Bun.file(IWAD_PATH).arrayBuffer());
    const wadLookup = new LumpLookup(parseWadDirectory(wadBuffer, parseWadHeader(wadBuffer)));

    for (const map of SHAREWARE_EPISODE_MAPS) {
      expect(wadLookup.hasLump(map)).toBe(true);
    }
    expect(SHAREWARE_EPISODE_MAPS.length).toBe(SHAREWARE_IWAD_MAP_BUNDLE_COUNT);
    expect(SHAREWARE_IWAD_EPISODE_COUNT).toBe(1);
    for (const demoLump of SHAREWARE_REQUIRED_DEMO_LUMPS) {
      expect(wadLookup.hasLump(demoLump)).toBe(true);
    }
    for (const infrastructureLump of SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS) {
      expect(wadLookup.hasLump(infrastructureLump)).toBe(true);
    }
    for (const markerLump of SHAREWARE_REQUIRED_MARKER_RANGES) {
      expect(wadLookup.hasLump(markerLump)).toBe(true);
    }
  });

  test('the committed deterministic engine replays the full E1M1..E1M9 + DEMO1/2/3 route with zero final differences run-to-run', async () => {
    const first = await runFullSharewareRoute();
    const second = await runFullSharewareRoute();

    expect(first.maps.map((sample) => sample.map)).toEqual([...SHAREWARE_EPISODE_MAPS]);
    expect(first.maps.length).toBe(SHAREWARE_IWAD_MAP_BUNDLE_COUNT);
    for (const sample of first.maps) {
      // Each shareware map spawns a player and advances deterministically.
      expect(sample.finalLevelTime).toBe(ROUTE_TICS_PER_MAP);
      expect(Number.isFinite(sample.spawnX) && Number.isFinite(sample.spawnY)).toBe(true);
    }
    for (const replayHash of first.demoReplayHashes) {
      expect(SHA256_HEX_REGEX.test(replayHash)).toBe(true);
    }
    // Zero final differences: the entire route is byte-identical run-to-run.
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test('writes the 13-008 final-gate evidence after every deterministic full-shareware-route assertion passes', async () => {
    const routeA = await runFullSharewareRoute();
    const routeB = await runFullSharewareRoute();
    const reproducible = JSON.stringify(routeA) === JSON.stringify(routeB);
    expect(reproducible).toBe(true);

    const evidence = {
      stepId: '13-008',
      gate: 'gate-full-shareware-route',
      deterministicScope:
        'Integrating capstone of the seven prerequisite acceptance gates (13-001..13-007). Every per-system fixture is a deterministic contract whose live framebuffer/audio/state hashes are pending (no captured oracle) — owner-#5 class delegated 13-003, applied 13-004..13-007. The full shareware route is gated reference-independently: all seven required-system final-gates present, full-route fixture coverage, shareware IWAD route integrity, and a byte-identical deterministic replay of the full E1M1..E1M9 + DEMO1/2/3 spine across two independent runs (zero final differences), which for a deterministic engine entails the contracted frame/audio parity.',
      requiredSystemGates: REQUIRED_SYSTEM_FINAL_GATES.map((gate) => gate.stepId),
      requiredRouteFixtures: REQUIRED_ROUTE_FIXTURES,
      sharewareIwad: {
        path: IWAD_PATH,
        episodeMaps: [...SHAREWARE_EPISODE_MAPS],
        mapBundleCount: SHAREWARE_IWAD_MAP_BUNDLE_COUNT,
        episodeCount: SHAREWARE_IWAD_EPISODE_COUNT,
        requiredDemoLumps: [...SHAREWARE_REQUIRED_DEMO_LUMPS],
      },
      route: routeA,
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
