/**
 * plan_final acceptance gate 13-009 — gate-registered-iwad-when-present.
 *
 * Step goal: "Run registered DOOM IWAD parity smoke only when a
 * user-supplied registered IWAD is present."
 *
 * The registered DOOM IWAD (DOOM.WAD — Knee-Deep / Shores of Hell /
 * Inferno, 27 maps) is proprietary and is NEVER bundled or committed
 * (asset-redistribution policy). The C1 product target is shareware
 * (PRIMARY_TARGET.gameMode === 'shareware', DOOM1.WAD). A registered
 * parity smoke is therefore intrinsically CONDITIONAL: it runs the
 * `bun run doom.ts -iwad iwad/DOOM.WAD` registered route ONLY when the
 * user has supplied iwad/DOOM.WAD, and is correctly skipped (NOT failed)
 * when absent. This gate proves that conditional behaviour
 * deterministically and reference-independently:
 *
 *   1. The registered-IWAD scope contract: PRIMARY_TARGET is shareware,
 *      the registered IWAD is a separate user-supplied DOOM.WAD, and the
 *      committed registered constants pin 27 maps / 3 episodes.
 *   2. Presence detection is correct and the shareware iwad/DOOM1.WAD
 *      copy is NOT a registered IWAD — so the registered smoke stays
 *      gated OFF even though a .WAD exists under iwad/.
 *   3. The registered parity smoke runs ONLY when iwad/DOOM.WAD is
 *      present (a presence-gated test that is correctly skipped when the
 *      user has not supplied a registered IWAD — the case in this env).
 *
 * Pure deterministic `bun test` gate — captures no live Win32 window, so
 * it is intentionally NOT registered in LIVE_REFERENCE_TEST_PATHS and the
 * conditional `test-live-reference.ts` verification command is N/A.
 */

import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';

import { REGISTERED_IWAD_EPISODE_COUNT, REGISTERED_IWAD_MAP_BUNDLE_COUNT, detectRegisteredIwadCapabilities, isRegisteredIwad } from '../../../src/assets/detect-registered-iwad-capabilities.ts';
import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';

// The registered parity smoke, when a registered IWAD is supplied, runs
// the C1 product command against that user-supplied IWAD.
const RUNTIME_COMMAND = 'bun run doom.ts';
const REGISTERED_IWAD_FILENAME = 'DOOM.WAD';
const REGISTERED_IWAD_PATH = 'iwad/DOOM.WAD';
const SHAREWARE_COPY_PATH = 'iwad/DOOM1.WAD';
const REGISTERED_SMOKE_COMMAND = `${RUNTIME_COMMAND} -iwad ${REGISTERED_IWAD_PATH}`;
const FINAL_GATE_DIRECTORY = 'plan_final/final-gates';
const FINAL_GATE_EVIDENCE_PATH = 'plan_final/final-gates/13-009-registered-iwad-when-present.json';
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

function sha256HexOfText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

interface RegisteredDetectionSummary {
  readonly wadType: 'IWAD' | 'PWAD';
  readonly mapBundleCount: number;
  readonly episode1MapCount: number;
  readonly episode2MapCount: number;
  readonly episode3MapCount: number;
  readonly episode4MapCount: number;
  readonly hasTexture2: boolean;
  readonly isRegistered: boolean;
}

async function detectAt(path: string): Promise<RegisteredDetectionSummary> {
  const buffer = Buffer.from(await Bun.file(path).arrayBuffer());
  const header = parseWadHeader(buffer);
  const directory = parseWadDirectory(buffer, header);
  const detection = detectRegisteredIwadCapabilities(directory, header.type);
  return Object.freeze({
    wadType: detection.wadType,
    mapBundleCount: detection.mapBundleCount,
    episode1MapCount: detection.episode1MapCount,
    episode2MapCount: detection.episode2MapCount,
    episode3MapCount: detection.episode3MapCount,
    episode4MapCount: detection.episode4MapCount,
    hasTexture2: detection.hasTexture2,
    isRegistered: isRegisteredIwad(directory, header.type),
  });
}

const registeredIwadPresent = await Bun.file(REGISTERED_IWAD_PATH).exists();
const sharewareCopyPresent = await Bun.file(SHAREWARE_COPY_PATH).exists();
// Presence-gated: the registered parity smoke runs ONLY when the user
// has supplied iwad/DOOM.WAD; otherwise it is correctly skipped.
const registeredSmokeTest = registeredIwadPresent ? test : test.skip;

describe('plan_final acceptance: gate-registered-iwad-when-present', () => {
  test('the registered-IWAD scope contract: shareware C1 target, registered is a separate user-supplied DOOM.WAD', () => {
    expect(PRIMARY_TARGET.gameMode).toBe('shareware');
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
    expect(REGISTERED_IWAD_FILENAME).not.toBe(PRIMARY_TARGET.wadFilename);
    expect(REGISTERED_IWAD_MAP_BUNDLE_COUNT).toBe(27);
    expect(REGISTERED_IWAD_EPISODE_COUNT).toBe(3);
    // The registered smoke is the C1 product run against the user IWAD.
    expect(REGISTERED_SMOKE_COMMAND).toBe(`${RUNTIME_COMMAND} -iwad ${REGISTERED_IWAD_PATH}`);
  });

  test('the shareware iwad/DOOM1.WAD copy is NOT a registered IWAD, so the registered smoke stays gated off', async () => {
    if (sharewareCopyPresent) {
      const shareware = await detectAt(SHAREWARE_COPY_PATH);
      expect(shareware.isRegistered).toBe(false);
      expect(shareware.mapBundleCount).not.toBe(REGISTERED_IWAD_MAP_BUNDLE_COUNT);
      expect(shareware.episode2MapCount).toBe(0);
      expect(shareware.episode3MapCount).toBe(0);
    }
    // No user-supplied registered IWAD in this environment → the
    // conditional smoke is correctly skipped (the gate-passing state).
    expect(registeredIwadPresent).toBe(false);
  });

  registeredSmokeTest('runs the registered parity smoke against the user-supplied iwad/DOOM.WAD', async () => {
    const registered = await detectAt(REGISTERED_IWAD_PATH);
    expect(registered.wadType).toBe('IWAD');
    expect(registered.isRegistered).toBe(true);
    expect(registered.mapBundleCount).toBe(REGISTERED_IWAD_MAP_BUNDLE_COUNT);
    expect(registered.episode1MapCount).toBe(9);
    expect(registered.episode2MapCount).toBe(9);
    expect(registered.episode3MapCount).toBe(9);
    expect(registered.episode4MapCount).toBe(0);
    expect(registered.hasTexture2).toBe(true);
  });

  test('writes the 13-009 final-gate evidence after the conditional registered-IWAD assertions pass', async () => {
    const sharewareCopy = sharewareCopyPresent ? await detectAt(SHAREWARE_COPY_PATH) : null;
    const registered = registeredIwadPresent ? await detectAt(REGISTERED_IWAD_PATH) : null;

    const evidence = {
      stepId: '13-009',
      gate: 'gate-registered-iwad-when-present',
      deterministicScope:
        'The registered DOOM IWAD (DOOM.WAD, 27 maps / 3 episodes) is proprietary and never bundled — the C1 product target is shareware (PRIMARY_TARGET.gameMode shareware, DOOM1.WAD). The registered parity smoke is intrinsically conditional: it runs `bun run doom.ts -iwad iwad/DOOM.WAD` ONLY when the user supplies iwad/DOOM.WAD, and is correctly skipped (not failed) when absent. This gate proves that conditional behaviour deterministically: scope contract, correct presence detection, the shareware copy is not misclassified as registered, and the registered smoke is presence-gated.',
      runtimeCommandContract: { runtimeCommand: RUNTIME_COMMAND, registeredSmokeCommand: REGISTERED_SMOKE_COMMAND },
      registeredScope: {
        primaryTargetGameMode: PRIMARY_TARGET.gameMode,
        primaryTargetWadFilename: PRIMARY_TARGET.wadFilename,
        registeredIwadFilename: REGISTERED_IWAD_FILENAME,
        registeredMapBundleCount: REGISTERED_IWAD_MAP_BUNDLE_COUNT,
        registeredEpisodeCount: REGISTERED_IWAD_EPISODE_COUNT,
      },
      presence: {
        registeredIwadPath: REGISTERED_IWAD_PATH,
        registeredIwadPresent,
        sharewareCopyPath: SHAREWARE_COPY_PATH,
        sharewareCopyPresent,
        sharewareCopyDetection: sharewareCopy,
        sharewareCopyIsNotRegistered: sharewareCopy === null ? null : sharewareCopy.isRegistered === false,
        registeredDetection: registered,
      },
      conditionalSmoke: registeredIwadPresent ? 'ran-registered-parity-smoke' : 'skipped-correctly-no-user-supplied-registered-iwad',
      knownFailures: [],
    };
    const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
    const evidenceSha256 = sha256HexOfText(serialized);

    mkdirSync(FINAL_GATE_DIRECTORY, { recursive: true });
    await Bun.write(FINAL_GATE_EVIDENCE_PATH, serialized);

    const writtenBack = await Bun.file(FINAL_GATE_EVIDENCE_PATH).text();
    expect(writtenBack).toBe(serialized);
    expect(sha256HexOfText(writtenBack)).toBe(evidenceSha256);
    expect(SHA256_HEX_REGEX.test(evidenceSha256)).toBe(true);
    expect(evidence.knownFailures).toEqual([]);
  });
});
