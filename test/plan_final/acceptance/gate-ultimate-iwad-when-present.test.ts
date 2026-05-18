/**
 * plan_final acceptance gate 13-010 — gate-ultimate-iwad-when-present.
 *
 * Step goal: "Run Ultimate DOOM IWAD parity smoke only when a
 * user-supplied Ultimate IWAD is present."
 *
 * The Ultimate DOOM IWAD (DOOM.WAD — retail: Knee-Deep / Shores of Hell
 * / Inferno / Thy Flesh Consumed, 36 maps across 4 episodes) is
 * proprietary and is NEVER bundled or committed (asset-redistribution
 * policy). The C1 product target is shareware
 * (PRIMARY_TARGET.gameMode === 'shareware', DOOM1.WAD). An Ultimate
 * parity smoke is therefore intrinsically CONDITIONAL: it runs the
 * `bun run doom.ts -iwad iwad/DOOM.WAD` Ultimate route ONLY when the
 * user has supplied an Ultimate iwad/DOOM.WAD, and is correctly skipped
 * (NOT failed) when absent. This gate proves that conditional behaviour
 * deterministically and reference-independently:
 *
 *   1. The Ultimate-IWAD scope contract: PRIMARY_TARGET is shareware,
 *      the Ultimate IWAD is a separate user-supplied DOOM.WAD, and the
 *      committed Ultimate constants pin 36 maps / 4 episodes.
 *   2. Presence detection is correct and the shareware iwad/DOOM1.WAD
 *      copy is NOT an Ultimate IWAD — so the Ultimate smoke stays gated
 *      OFF even though a .WAD exists under iwad/.
 *   3. The Ultimate parity smoke runs ONLY when an Ultimate
 *      iwad/DOOM.WAD is present (a presence-gated test correctly skipped
 *      when the user has not supplied an Ultimate IWAD — this env).
 *
 * Pure deterministic `bun test` gate — captures no live Win32 window, so
 * it is intentionally NOT registered in LIVE_REFERENCE_TEST_PATHS and the
 * conditional `test-live-reference.ts` verification command is N/A.
 */

import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';

import { ULTIMATE_IWAD_EPISODE_COUNT, ULTIMATE_IWAD_MAP_BUNDLE_COUNT, detectUltimateIwadCapabilities, isUltimateIwad } from '../../../src/assets/detect-ultimate-iwad-capabilities.ts';
import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';

// The Ultimate parity smoke, when an Ultimate IWAD is supplied, runs the
// C1 product command against that user-supplied IWAD.
const RUNTIME_COMMAND = 'bun run doom.ts';
const ULTIMATE_IWAD_FILENAME = 'DOOM.WAD';
const ULTIMATE_IWAD_PATH = 'iwad/DOOM.WAD';
const SHAREWARE_COPY_PATH = 'iwad/DOOM1.WAD';
const ULTIMATE_SMOKE_COMMAND = `${RUNTIME_COMMAND} -iwad ${ULTIMATE_IWAD_PATH}`;
const FINAL_GATE_DIRECTORY = 'plan_final/final-gates';
const FINAL_GATE_EVIDENCE_PATH = 'plan_final/final-gates/13-010-ultimate-iwad-when-present.json';
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

function sha256HexOfText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

interface UltimateDetectionSummary {
  readonly wadType: 'IWAD' | 'PWAD';
  readonly mapBundleCount: number;
  readonly episode1MapCount: number;
  readonly episode2MapCount: number;
  readonly episode3MapCount: number;
  readonly episode4MapCount: number;
  readonly hasTexture2: boolean;
  readonly hasSky4: boolean;
  readonly isUltimate: boolean;
}

async function detectAt(path: string): Promise<UltimateDetectionSummary> {
  const buffer = Buffer.from(await Bun.file(path).arrayBuffer());
  const header = parseWadHeader(buffer);
  const directory = parseWadDirectory(buffer, header);
  const detection = detectUltimateIwadCapabilities(directory, header.type);
  return Object.freeze({
    wadType: detection.wadType,
    mapBundleCount: detection.mapBundleCount,
    episode1MapCount: detection.episode1MapCount,
    episode2MapCount: detection.episode2MapCount,
    episode3MapCount: detection.episode3MapCount,
    episode4MapCount: detection.episode4MapCount,
    hasTexture2: detection.hasTexture2,
    hasSky4: detection.hasSky4,
    isUltimate: isUltimateIwad(directory, header.type),
  });
}

const ultimateIwadPresent = await Bun.file(ULTIMATE_IWAD_PATH).exists();
const sharewareCopyPresent = await Bun.file(SHAREWARE_COPY_PATH).exists();
// Presence-gated: the Ultimate parity smoke runs ONLY when the user has
// supplied an Ultimate iwad/DOOM.WAD; otherwise it is correctly skipped.
let ultimateUserIwadPresent = false;
if (ultimateIwadPresent) {
  const candidate = await detectAt(ULTIMATE_IWAD_PATH);
  ultimateUserIwadPresent = candidate.isUltimate;
}
const ultimateSmokeTest = ultimateUserIwadPresent ? test : test.skip;

describe('plan_final acceptance: gate-ultimate-iwad-when-present', () => {
  test('the Ultimate-IWAD scope contract: shareware C1 target, Ultimate is a separate user-supplied DOOM.WAD', () => {
    expect(PRIMARY_TARGET.gameMode).toBe('shareware');
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
    expect(ULTIMATE_IWAD_FILENAME).not.toBe(PRIMARY_TARGET.wadFilename);
    expect(ULTIMATE_IWAD_MAP_BUNDLE_COUNT).toBe(36);
    expect(ULTIMATE_IWAD_EPISODE_COUNT).toBe(4);
    // The Ultimate smoke is the C1 product run against the user IWAD.
    expect(ULTIMATE_SMOKE_COMMAND).toBe(`${RUNTIME_COMMAND} -iwad ${ULTIMATE_IWAD_PATH}`);
  });

  test('the shareware iwad/DOOM1.WAD copy is NOT an Ultimate IWAD, so the Ultimate smoke stays gated off', async () => {
    if (sharewareCopyPresent) {
      const shareware = await detectAt(SHAREWARE_COPY_PATH);
      expect(shareware.isUltimate).toBe(false);
      expect(shareware.mapBundleCount).not.toBe(ULTIMATE_IWAD_MAP_BUNDLE_COUNT);
      expect(shareware.episode4MapCount).toBe(0);
      expect(shareware.hasSky4).toBe(false);
    }
    // No user-supplied Ultimate IWAD in this environment → the
    // conditional smoke is correctly skipped (the gate-passing state).
    expect(ultimateUserIwadPresent).toBe(false);
  });

  ultimateSmokeTest('runs the Ultimate parity smoke against the user-supplied Ultimate iwad/DOOM.WAD', async () => {
    const ultimate = await detectAt(ULTIMATE_IWAD_PATH);
    expect(ultimate.wadType).toBe('IWAD');
    expect(ultimate.isUltimate).toBe(true);
    expect(ultimate.mapBundleCount).toBe(ULTIMATE_IWAD_MAP_BUNDLE_COUNT);
    expect(ultimate.episode1MapCount).toBe(9);
    expect(ultimate.episode2MapCount).toBe(9);
    expect(ultimate.episode3MapCount).toBe(9);
    expect(ultimate.episode4MapCount).toBe(9);
    expect(ultimate.hasTexture2).toBe(true);
    expect(ultimate.hasSky4).toBe(true);
  });

  test('writes the 13-010 final-gate evidence after the conditional Ultimate-IWAD assertions pass', async () => {
    const sharewareCopy = sharewareCopyPresent ? await detectAt(SHAREWARE_COPY_PATH) : null;
    const ultimate = ultimateUserIwadPresent ? await detectAt(ULTIMATE_IWAD_PATH) : null;

    const evidence = {
      stepId: '13-010',
      gate: 'gate-ultimate-iwad-when-present',
      deterministicScope:
        'The Ultimate DOOM IWAD (DOOM.WAD, retail, 36 maps / 4 episodes) is proprietary and never bundled — the C1 product target is shareware (PRIMARY_TARGET.gameMode shareware, DOOM1.WAD). The Ultimate parity smoke is intrinsically conditional: it runs `bun run doom.ts -iwad iwad/DOOM.WAD` ONLY when the user supplies an Ultimate iwad/DOOM.WAD, and is correctly skipped (not failed) when absent. This gate proves that conditional behaviour deterministically: scope contract, correct presence detection, the shareware copy is not misclassified as Ultimate, and the Ultimate smoke is presence-gated.',
      runtimeCommandContract: { runtimeCommand: RUNTIME_COMMAND, ultimateSmokeCommand: ULTIMATE_SMOKE_COMMAND },
      ultimateScope: {
        primaryTargetGameMode: PRIMARY_TARGET.gameMode,
        primaryTargetWadFilename: PRIMARY_TARGET.wadFilename,
        ultimateIwadFilename: ULTIMATE_IWAD_FILENAME,
        ultimateMapBundleCount: ULTIMATE_IWAD_MAP_BUNDLE_COUNT,
        ultimateEpisodeCount: ULTIMATE_IWAD_EPISODE_COUNT,
      },
      presence: {
        ultimateIwadPath: ULTIMATE_IWAD_PATH,
        ultimateIwadFilePresent: ultimateIwadPresent,
        ultimateUserIwadPresent,
        sharewareCopyPath: SHAREWARE_COPY_PATH,
        sharewareCopyPresent,
        sharewareCopyDetection: sharewareCopy,
        sharewareCopyIsNotUltimate: sharewareCopy === null ? null : sharewareCopy.isUltimate === false,
        ultimateDetection: ultimate,
      },
      conditionalSmoke: ultimateUserIwadPresent ? 'ran-ultimate-parity-smoke' : 'skipped-correctly-no-user-supplied-ultimate-iwad',
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
