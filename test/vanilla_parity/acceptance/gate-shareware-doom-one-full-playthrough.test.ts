import { describe, expect, test } from 'bun:test';

import gateManifest from './gate-shareware-doom-one-full-playthrough.json' with { type: 'json' };

describe('vanilla DOOM 1.9 shareware DOOM 1 full-playthrough acceptance gate', () => {
  test('pins the gate identity and lane', () => {
    expect(gateManifest.gate_id).toBe('13-001');
    expect(gateManifest.gate_lane).toBe('acceptance');
    expect(gateManifest.iwad_scope).toBe('shareware-doom1');
    expect(gateManifest.iwad_filename_expected).toBe('DOOM1.WAD');
  });

  test('pins Episode 1 maps E1M1 .. E1M9 as the playthrough scope', () => {
    expect(gateManifest.expected_episodes).toEqual([1]);
    expect(gateManifest.expected_episode_1_maps).toEqual(['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9']);
  });

  test('pins the five vanilla skill levels (ITYTD, HNTR, HMP, UV, NM)', () => {
    expect(gateManifest.expected_skills).toEqual(['ITYTD', 'HNTR', 'HMP', 'UV', 'NM']);
  });

  test('aggregates every Phase 12 prerequisite gate including the two save-side gates', () => {
    const composed = new Set(gateManifest.gate_composes_step_ids);
    expect(composed.has('11-031')).toBe(true);
    expect(composed.has('12-028')).toBe(true);
    expect(composed.has('02-035')).toBe(true);
    expect(composed.has('09-038')).toBe(true);
  });

  test('blocks the full side-by-side proof 13-004', () => {
    expect(gateManifest.gate_blocks_step_ids).toContain('13-004');
  });

  test('requires the five oracle evidence streams', () => {
    expect(gateManifest.oracle_evidence_required).toContain('framebuffer-hash-per-tic-window');
    expect(gateManifest.oracle_evidence_required).toContain('audio-hash-per-tic-window');
    expect(gateManifest.oracle_evidence_required).toContain('music-event-log-per-tic-window');
    expect(gateManifest.oracle_evidence_required).toContain('savegame-byte-oracle');
    expect(gateManifest.oracle_evidence_required).toContain('demo-replay-sync');
  });

  test('pins the E1M8 boss-death and E1M9 secret-exit required exit paths', () => {
    expect(gateManifest.exit_paths_required).toContain('E1M8-boss-death-tag-666');
    expect(gateManifest.exit_paths_required).toContain('E1M9-secret-exit-from-E1M3');
  });

  test('marks the IWAD SHA-256 column as pending oracle capture (no invented hashes)', () => {
    expect(gateManifest.iwad_known_sha256).toBe('pending-oracle-capture');
  });
});
