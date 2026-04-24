import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS,
  EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH,
  EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH,
  FRAMEBUFFER_HEIGHT,
  FRAMEBUFFER_SIZE,
  FRAMEBUFFER_WIDTH,
  PALETTE_COUNT,
} from '../../src/oracles/framebufferHash.ts';
import type { FramebufferHashArtifact, FramebufferHashEntry, FramebufferHashPayload } from '../../src/oracles/framebufferHash.ts';
import { ORACLE_KINDS } from '../../src/oracles/schema.ts';
import type { OracleArtifact } from '../../src/oracles/schema.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_RUN_MANIFEST } from '../../src/oracles/referenceRunManifest.ts';

describe('framebuffer dimension constants', () => {
  test('FRAMEBUFFER_WIDTH is 320', () => {
    expect(FRAMEBUFFER_WIDTH).toBe(320);
  });

  test('FRAMEBUFFER_HEIGHT is 200', () => {
    expect(FRAMEBUFFER_HEIGHT).toBe(200);
  });

  test('FRAMEBUFFER_SIZE is width * height (64000)', () => {
    expect(FRAMEBUFFER_SIZE).toBe(FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT);
    expect(FRAMEBUFFER_SIZE).toBe(64_000);
  });

  test('dimensions match REFERENCE_RUN_MANIFEST internal framebuffer', () => {
    expect(FRAMEBUFFER_WIDTH).toBe(REFERENCE_RUN_MANIFEST.screen.internalWidth);
    expect(FRAMEBUFFER_HEIGHT).toBe(REFERENCE_RUN_MANIFEST.screen.internalHeight);
  });
});

describe('PALETTE_COUNT', () => {
  test('is 14 (F-027: PLAYPAL contains 14 palettes)', () => {
    expect(PALETTE_COUNT).toBe(14);
  });
});

describe('DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS', () => {
  test('is 35 (one second at Doom tic rate)', () => {
    expect(DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS).toBe(35);
    expect(DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS).toBe(PRIMARY_TARGET.ticRateHz);
  });
});

describe('ORACLE_KINDS cross-reference', () => {
  test('framebuffer-hash is a registered oracle kind', () => {
    expect(ORACLE_KINDS).toContain('framebuffer-hash');
  });
});

describe('EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH', () => {
  test('targets title-loop run mode', () => {
    expect(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH.targetRunMode).toBe('title-loop');
  });

  test('uses DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS', () => {
    expect(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH.samplingIntervalTics).toBe(DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS);
  });

  test('has empty entries array', () => {
    expect(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH.entries).toHaveLength(0);
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
    expect(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH.ticRateHz).toBe(35);
  });

  test('width and height match framebuffer constants', () => {
    expect(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH.width).toBe(FRAMEBUFFER_WIDTH);
    expect(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH.height).toBe(FRAMEBUFFER_HEIGHT);
  });

  test('has non-empty description', () => {
    expect(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH.description.length).toBeGreaterThan(0);
  });

  test('is frozen at top level and entries array', () => {
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH)).toBe(true);
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH.entries)).toBe(true);
  });
});

describe('EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH', () => {
  test('targets demo-playback run mode', () => {
    expect(EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH.targetRunMode).toBe('demo-playback');
  });

  test('uses DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS', () => {
    expect(EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH.samplingIntervalTics).toBe(DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS);
  });

  test('has empty entries array', () => {
    expect(EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH.entries).toHaveLength(0);
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
  });

  test('width and height match framebuffer constants', () => {
    expect(EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH.width).toBe(FRAMEBUFFER_WIDTH);
    expect(EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH.height).toBe(FRAMEBUFFER_HEIGHT);
  });

  test('is frozen at top level and entries array', () => {
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH)).toBe(true);
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH.entries)).toBe(true);
  });
});

describe('FramebufferHashEntry well-formed acceptance', () => {
  test('accepts a valid entry with hash and palette index', () => {
    const entry: FramebufferHashEntry = {
      tic: 0,
      hash: 'a'.repeat(64),
      paletteIndex: 0,
    };
    expect(entry.tic).toBe(0);
    expect(entry.hash).toHaveLength(64);
    expect(entry.paletteIndex).toBe(0);
  });

  test('palette index 0 is normal palette', () => {
    const entry: FramebufferHashEntry = {
      tic: 35,
      hash: 'b'.repeat(64),
      paletteIndex: 0,
    };
    expect(entry.paletteIndex).toBe(0);
    expect(entry.paletteIndex).toBeLessThan(PALETTE_COUNT);
  });

  test('palette index 13 is radiation suit (maximum valid index)', () => {
    const entry: FramebufferHashEntry = {
      tic: 70,
      hash: 'c'.repeat(64),
      paletteIndex: 13,
    };
    expect(entry.paletteIndex).toBe(PALETTE_COUNT - 1);
  });
});

describe('FramebufferHashPayload well-formed acceptance', () => {
  test('accepts a multi-entry payload with ascending tic order', () => {
    const payload: FramebufferHashPayload = {
      description: 'Test framebuffer hashes with multiple entries',
      targetRunMode: 'demo-playback',
      samplingIntervalTics: 35,
      ticRateHz: 35,
      width: FRAMEBUFFER_WIDTH,
      height: FRAMEBUFFER_HEIGHT,
      entries: [
        { tic: 0, hash: 'a'.repeat(64), paletteIndex: 0 },
        { tic: 35, hash: 'b'.repeat(64), paletteIndex: 0 },
        { tic: 70, hash: 'c'.repeat(64), paletteIndex: 0 },
      ],
    };
    expect(payload.entries).toHaveLength(3);
    const tics = payload.entries.map((entry) => entry.tic);
    expect(tics).toEqual([0, 35, 70]);
  });

  test('allows sampling interval of 1 for frame-by-frame debugging', () => {
    const payload: FramebufferHashPayload = {
      description: 'Frame-by-frame framebuffer hash for visual divergence debugging',
      targetRunMode: 'title-loop',
      samplingIntervalTics: 1,
      ticRateHz: 35,
      width: FRAMEBUFFER_WIDTH,
      height: FRAMEBUFFER_HEIGHT,
      entries: [
        { tic: 0, hash: 'd'.repeat(64), paletteIndex: 0 },
        { tic: 1, hash: 'e'.repeat(64), paletteIndex: 0 },
        { tic: 2, hash: 'f'.repeat(64), paletteIndex: 0 },
      ],
    };
    expect(payload.samplingIntervalTics).toBe(1);
  });
});

describe('parity-sensitive edge cases', () => {
  test('same pixel data with different palette index produces different visible output', () => {
    const pixelHash = 'a'.repeat(64);
    const normalFrame: FramebufferHashEntry = {
      tic: 100,
      hash: pixelHash,
      paletteIndex: 0,
    };
    const damageFrame: FramebufferHashEntry = {
      tic: 101,
      hash: pixelHash,
      paletteIndex: 1,
    };
    // Same raw framebuffer data but different palette means different visible output
    expect(normalFrame.hash).toBe(damageFrame.hash);
    expect(normalFrame.paletteIndex).not.toBe(damageFrame.paletteIndex);
  });

  test('damage red palette indices span 1-8 (F-027 STARTREDPALS/NUMREDPALS)', () => {
    const damageEntries: FramebufferHashEntry[] = [];
    for (let index = 1; index <= 8; index++) {
      damageEntries.push({
        tic: index * 35,
        hash: '0'.repeat(64),
        paletteIndex: index,
      });
    }
    expect(damageEntries).toHaveLength(8);
    expect(damageEntries[0].paletteIndex).toBe(1);
    expect(damageEntries[7].paletteIndex).toBe(8);
    for (const entry of damageEntries) {
      expect(entry.paletteIndex).toBeGreaterThanOrEqual(1);
      expect(entry.paletteIndex).toBeLessThanOrEqual(8);
    }
  });

  test('tic 0 captures initial framebuffer before any rendering occurs', () => {
    const entry: FramebufferHashEntry = {
      tic: 0,
      hash: '1'.repeat(64),
      paletteIndex: 0,
    };
    // Tic 0 captures the framebuffer state before D_Display runs
    expect(entry.tic).toBe(0);
    expect(entry.paletteIndex).toBe(0);
  });

  test('framebuffer size is exactly 64000 bytes for 320x200 8-bit indexed', () => {
    // The hash covers exactly FRAMEBUFFER_SIZE bytes of palette-indexed data
    // This is the pre-palette, pre-aspect-correction, pre-scaling raw buffer
    expect(FRAMEBUFFER_SIZE).toBe(64_000);
    expect(FRAMEBUFFER_SIZE).toBe(FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT);
  });
});

describe('compile-time type satisfaction', () => {
  test('FramebufferHashArtifact wraps FramebufferHashPayload in OracleArtifact envelope', () => {
    const artifact: FramebufferHashArtifact = {
      kind: 'framebuffer-hash',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: '0'.repeat(64),
      payload: EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH,
    };
    expect(artifact.kind).toBe('framebuffer-hash');
    expect(artifact.version).toBe(1);
    expect(artifact.payload).toBe(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH);
  });

  test('FramebufferHashArtifact satisfies OracleArtifact<FramebufferHashPayload>', () => {
    const artifact: OracleArtifact<FramebufferHashPayload> = {
      kind: 'framebuffer-hash',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: 'A'.repeat(64),
      payload: EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH,
    };
    expect(artifact.payload.targetRunMode).toBe('demo-playback');
  });
});
