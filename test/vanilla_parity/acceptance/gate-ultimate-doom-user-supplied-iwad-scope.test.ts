import { describe, expect, test } from 'bun:test';

import gateManifest from './gate-ultimate-doom-user-supplied-iwad-scope.json' with { type: 'json' };

describe('vanilla DOOM 1.9 Ultimate DOOM user-supplied IWAD acceptance gate', () => {
  test('pins the gate identity and lane', () => {
    expect(gateManifest.gate_id).toBe('13-003');
    expect(gateManifest.gate_lane).toBe('acceptance');
    expect(gateManifest.iwad_scope).toBe('ultimate-doom');
    expect(gateManifest.iwad_filename_expected).toBe('DOOM.WAD');
  });

  test('pins all four episodes (Ultimate DOOM adds Episode 4)', () => {
    expect(gateManifest.expected_episodes).toEqual([1, 2, 3, 4]);
  });

  test('pins Episode 4 maps E4M1 .. E4M9', () => {
    expect(gateManifest.expected_episode_4_maps).toEqual(['E4M1', 'E4M2', 'E4M3', 'E4M4', 'E4M5', 'E4M6', 'E4M7', 'E4M8', 'E4M9']);
  });

  test('pins the five vanilla skill levels (ITYTD, HNTR, HMP, UV, NM)', () => {
    expect(gateManifest.expected_skills).toEqual(['ITYTD', 'HNTR', 'HMP', 'UV', 'NM']);
  });

  test('aggregates every Phase 12 prerequisite gate', () => {
    const composed = new Set(gateManifest.gate_composes_step_ids);
    expect(composed.has('11-031')).toBe(true);
    expect(composed.has('12-028')).toBe(true);
    expect(composed.has('02-035')).toBe(true);
    expect(composed.has('09-038')).toBe(true);
    expect(gateManifest.gate_composes_step_ids.length).toBe(11);
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

  test('pins Ultimate-specific E4M6 / E4M8 boss exit paths', () => {
    expect(gateManifest.exit_paths_required).toContain('E4M6-cyberdemon-vld-blazeOpen-tag-666');
    expect(gateManifest.exit_paths_required).toContain('E4M8-spider-mastermind-lowerFloorToLowest-tag-666');
  });

  test('documents Ultimate-specific invariants from src/ai/bossSpecials.ts CheckBossEnd', () => {
    expect(Array.isArray(gateManifest.ultimate_specific_invariants)).toBe(true);
    expect(gateManifest.ultimate_specific_invariants.length).toBeGreaterThanOrEqual(1);
    const joinedText = gateManifest.ultimate_specific_invariants.join('|');
    expect(joinedText).toContain('CheckBossEnd');
  });

  test('marks the IWAD SHA-256 column as pending oracle capture (no invented hashes)', () => {
    expect(gateManifest.iwad_known_sha256).toBe('pending-oracle-capture');
  });

  test('scope notes mention the user-supplied IWAD requirement (no redistribution)', () => {
    expect(typeof gateManifest.scope_notes).toBe('string');
    expect(gateManifest.scope_notes).toContain('user');
    expect(gateManifest.scope_notes).toContain('IWAD');
  });
});
