import { describe, expect, test } from 'bun:test';

import { Buffer } from 'node:buffer';

import { EMPTY_DEMO_PLAYBACK_SCRIPT } from '../../../src/oracles/inputScript.ts';
import { REPLAY_DEMO3_DETERMINISTICALLY_RUNTIME_COMMAND, replayDemo3Deterministically } from '../../../src/playable/demo-replay/replayDemo3Deterministically.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const DEMO3_COMPATIBLE_BUFFER = Buffer.from([109, 3, 2, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 12, 254, 8, 1, 252, 3, 16, 2, 128]);
const EMPTY_DEMO3_BUFFER = Buffer.from([109, 3, 2, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 128]);
const EXPECTED_REPLAY_HASH = '832e5496197c972e825a74efaabc6a1eb2b9cc4538fb3609e4a81d65929a9038';
const EXPECTED_SOURCE_HASH = 'cbabebfaaa374f69188282264df6364b9aa1c65bf895fe0670dd1361d003ef34';
const EXPECTED_TIC_COMMAND_HASH = '0cdd06a58039b091360f7188b0d44c7d7467fc37b25962339cb59255326e000e';
const SOURCE_PATH = 'src/playable/demo-replay/replayDemo3Deterministically.ts';

describe('replayDemo3Deterministically', () => {
  test('locks the Bun runtime command and side-by-side audit manifest contract', async () => {
    const manifest: unknown = await Bun.file(AUDIT_MANIFEST_PATH).json();

    expect(isSideBySideReplayAuditManifest(manifest)).toBe(true);
    if (!isSideBySideReplayAuditManifest(manifest)) {
      throw new Error('01-015 side-by-side replay audit manifest shape changed');
    }

    expect(REPLAY_DEMO3_DETERMINISTICALLY_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.targetReplayContract.requiredCommand).toBe(REPLAY_DEMO3_DETERMINISTICALLY_RUNTIME_COMMAND);
    const explicitNullSurfaces = manifest.explicitNullSurfaces.map((surface) => surface.surface);
    expect(explicitNullSurfaces).toContain('side-by-side-replay-command');
    expect(explicitNullSurfaces).toContain('input-trace-replay-loader');
  });

  test('locks the formatted source hash', async () => {
    const source = await Bun.file(SOURCE_PATH).text();

    expect(sha256Hex(source)).toBe(EXPECTED_SOURCE_HASH);
  });

  test('returns deterministic DEMO3 replay evidence and marker transition', () => {
    const evidence = replayDemo3Deterministically(DEMO3_COMPATIBLE_BUFFER);

    expect(evidence.auditManifestPath).toBe(AUDIT_MANIFEST_PATH);
    expect(evidence.commandContract).toBe(REPLAY_DEMO3_DETERMINISTICALLY_RUNTIME_COMMAND);
    expect(evidence.demoName).toBe('DEMO3');
    expect(evidence.finalSnapshot).toEqual({
      completionAction: 'advance-demo',
      consolePlayer: 0,
      deathmatch: 0,
      demoplayback: false,
      fastMonsters: 0,
      netDemo: false,
      netGame: false,
      noMonsters: 0,
      playersInGame: [true, false, false, false],
      respawnMonsters: 0,
      singleDemo: false,
      ticIndex: 3,
    });
    expect(evidence.inputScript).toBe(EMPTY_DEMO_PLAYBACK_SCRIPT);
    expect(evidence.replayHash).toBe(EXPECTED_REPLAY_HASH);
    expect(evidence.ticCommandHash).toBe(EXPECTED_TIC_COMMAND_HASH);
    expect(evidence.ticCount).toBe(3);
    expect(evidence.ticSignatures).toEqual([
      {
        activePlayerCount: 1,
        commandHash: '7b76c7c0738dcec1b183c64734a39a53ec39d1cc8cba48ed1659a67bd0696f73',
        ticIndex: 0,
      },
      {
        activePlayerCount: 1,
        commandHash: '59297becdd24af6c7c3cf175c3a04ac32de7adcc2d84862b8d64a50f7b6c0064',
        ticIndex: 1,
      },
      {
        activePlayerCount: 1,
        commandHash: '020d34a1d036e017ac3e180a4144bffe478c35bb7e0522b390a088a1c1c1eb6d',
        ticIndex: 2,
      },
    ]);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.ticSignatures)).toBe(true);
  });

  test('rejects launcher commands before parsing DEMO3 bytes', () => {
    expect(() =>
      replayDemo3Deterministically(Buffer.from([255]), {
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('DEMO3 deterministic replay requires bun run doom.ts');
  });

  test('rejects DEMO3 replay evidence without any tic commands', () => {
    expect(() => replayDemo3Deterministically(EMPTY_DEMO3_BUFFER)).toThrow('DEMO3 deterministic replay requires at least one tic');
  });

  test('produces identical evidence across repeated calls with the same buffer', () => {
    const firstEvidence = replayDemo3Deterministically(DEMO3_COMPATIBLE_BUFFER);
    const secondEvidence = replayDemo3Deterministically(DEMO3_COMPATIBLE_BUFFER);

    expect(secondEvidence.replayHash).toBe(firstEvidence.replayHash);
    expect(secondEvidence.ticCommandHash).toBe(firstEvidence.ticCommandHash);
    expect(secondEvidence.ticCount).toBe(firstEvidence.ticCount);
    expect(secondEvidence.ticSignatures).toEqual(firstEvidence.ticSignatures);
    expect(secondEvidence.finalSnapshot).toEqual(firstEvidence.finalSnapshot);
  });

  test('does not mutate the input demo buffer', () => {
    const inputBuffer = Buffer.from(DEMO3_COMPATIBLE_BUFFER);
    const originalBytes = Buffer.from(inputBuffer);

    replayDemo3Deterministically(inputBuffer);

    expect(inputBuffer.equals(originalBytes)).toBe(true);
  });

  test('flips replayHash when any tic byte changes', () => {
    const baselineEvidence = replayDemo3Deterministically(DEMO3_COMPATIBLE_BUFFER);
    const mutatedBuffer = Buffer.from(DEMO3_COMPATIBLE_BUFFER);
    mutatedBuffer[13] = 99;
    const mutatedEvidence = replayDemo3Deterministically(mutatedBuffer);

    expect(mutatedEvidence.replayHash).not.toBe(baselineEvidence.replayHash);
    expect(mutatedEvidence.ticCommandHash).not.toBe(baselineEvidence.ticCommandHash);
    expect(mutatedEvidence.ticSignatures[0]?.commandHash).not.toBe(baselineEvidence.ticSignatures[0]?.commandHash);
    expect(mutatedEvidence.ticSignatures[1]?.commandHash).toBe(baselineEvidence.ticSignatures[1]?.commandHash);
  });

  test('locks ticSignatures to contiguous zero-based indices that match the final snapshot', () => {
    const evidence = replayDemo3Deterministically(DEMO3_COMPATIBLE_BUFFER);

    expect(evidence.ticCount).toBe(evidence.ticSignatures.length);
    expect(evidence.ticCount).toBe(evidence.finalSnapshot.ticIndex);
    for (const [arrayIndex, signature] of evidence.ticSignatures.entries()) {
      expect(signature.ticIndex).toBe(arrayIndex);
      expect(signature.activePlayerCount).toBeGreaterThan(0);
      expect(signature.commandHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

interface SideBySideReplayAuditManifest {
  readonly explicitNullSurfaces: readonly {
    readonly surface: string;
  }[];
  readonly schemaVersion: number;
  readonly targetReplayContract: {
    readonly requiredCommand: string;
  };
}

function isSideBySideReplayAuditManifest(value: unknown): value is SideBySideReplayAuditManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const targetReplayContract = record.targetReplayContract;

  if (typeof targetReplayContract !== 'object' || targetReplayContract === null) {
    return false;
  }

  const targetReplayContractRecord = targetReplayContract as Record<string, unknown>;

  return (
    Array.isArray(record.explicitNullSurfaces) && record.explicitNullSurfaces.every((surface) => isExplicitNullSurface(surface)) && typeof record.schemaVersion === 'number' && typeof targetReplayContractRecord.requiredCommand === 'string'
  );
}

function isExplicitNullSurface(value: unknown): value is string {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.surface === 'string';
}

function sha256Hex(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}
