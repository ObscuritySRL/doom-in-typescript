import { describe, expect, test } from 'bun:test';

import gateManifest from './gate-full-final-side-by-side-proof.json' with { type: 'json' };

describe('vanilla DOOM 1.9 full final side-by-side proof acceptance gate', () => {
  test('pins the gate identity as the final acceptance gate', () => {
    expect(gateManifest.gate_id).toBe('13-004');
    expect(gateManifest.gate_lane).toBe('acceptance');
    expect(gateManifest.is_final_gate).toBe(true);
  });

  test('aggregates the three IWAD-scope gates as prerequisites', () => {
    expect(gateManifest.gate_composes_step_ids).toEqual(['13-001', '13-002', '13-003']);
    expect(gateManifest.iwad_scopes_required).toEqual(['shareware-doom1', 'registered-doom1', 'ultimate-doom1']);
  });

  test('blocks no downstream steps (terminal gate)', () => {
    expect(gateManifest.gate_blocks_step_ids).toEqual([]);
  });

  test('requires side-by-side screen-capture comparison evidence', () => {
    expect(gateManifest.oracle_evidence_required).toContain('side-by-side-screen-capture-comparison-with-chocolate-doom-2.2.1');
  });

  test('requires byte-level oracle evidence across all three IWAD scopes', () => {
    expect(gateManifest.oracle_evidence_required).toContain('framebuffer-hash-per-tic-window-across-three-iwad-scopes');
    expect(gateManifest.oracle_evidence_required).toContain('audio-hash-per-tic-window-across-three-iwad-scopes');
    expect(gateManifest.oracle_evidence_required).toContain('music-event-log-per-tic-window-across-three-iwad-scopes');
    expect(gateManifest.oracle_evidence_required).toContain('savegame-byte-oracle-across-three-iwad-scopes');
    expect(gateManifest.oracle_evidence_required).toContain('demo-replay-sync-across-three-iwad-scopes');
  });

  test('requires human attestation of side-by-side parity', () => {
    expect(gateManifest.human_attestation_required).toBe(true);
    expect(gateManifest.human_attestation_text).toContain('TypeScript port');
    expect(gateManifest.human_attestation_text).toContain('Chocolate Doom 2.2.1');
    expect(gateManifest.human_attestation_text).toContain('frame-for-frame');
    expect(gateManifest.human_attestation_text).toContain('sample-for-sample');
  });
});
