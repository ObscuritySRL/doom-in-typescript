import { describe, expect, test } from 'bun:test';

import gateManifest from './gate-registered-doom-user-supplied-iwad-scope.json' with { type: 'json' };

describe('vanilla DOOM 1.9 registered DOOM user-supplied-IWAD acceptance gate', () => {
  test('pins the gate identity and registered IWAD scope', () => {
    expect(gateManifest.gate_id).toBe('13-002');
    expect(gateManifest.gate_lane).toBe('acceptance');
    expect(gateManifest.iwad_scope).toBe('registered-doom1');
    expect(gateManifest.iwad_filename_expected).toBe('DOOM.WAD');
  });

  test('covers E1/E2/E3 with the standard 9-map structure each', () => {
    expect(gateManifest.expected_episodes).toEqual([1, 2, 3]);
    expect(gateManifest.expected_episode_1_maps).toHaveLength(9);
    expect(gateManifest.expected_episode_2_maps).toHaveLength(9);
    expect(gateManifest.expected_episode_3_maps).toHaveLength(9);
  });

  test('pins all 5 vanilla skill levels', () => {
    expect(gateManifest.expected_skills).toEqual(['ITYTD', 'HNTR', 'HMP', 'UV', 'NM']);
  });

  test('requires registered-only boss exits: E2M8 cyberdemon, E3M8 spider mastermind', () => {
    expect(gateManifest.exit_paths_required).toContain('E2M8-cyberdemon-death-exit');
    expect(gateManifest.exit_paths_required).toContain('E3M8-spider-mastermind-death-exit');
  });

  test('requires human attestation that the user owns the IWAD (no bundled proprietary bytes)', () => {
    expect(gateManifest.human_attestation_required).toBe(true);
    expect(typeof gateManifest.human_attestation_text).toBe('string');
    expect(gateManifest.human_attestation_text!.length).toBeGreaterThan(0);
  });

  test('IWAD checksum column stays "pending-oracle-capture" until a real registered IWAD is hashed', () => {
    expect(gateManifest.iwad_known_sha256).toBe('pending-oracle-capture');
  });

  test('blocks the final side-by-side proof 13-004', () => {
    expect(gateManifest.gate_blocks_step_ids).toContain('13-004');
  });

  test('aggregates the same Phase 02-12 prerequisite gates as 13-001', () => {
    expect(gateManifest.gate_composes_step_ids).toEqual(['02-035', '03-036', '04-030', '05-028', '06-032', '07-034', '08-032', '09-038', '10-028', '11-031', '12-028']);
  });
});
