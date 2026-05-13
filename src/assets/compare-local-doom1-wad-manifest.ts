/**
 * Compares a parsed local DOOM1.WAD directory against the canonical
 * wad-map-summary.json manifest (reference/manifests/wad-map-summary.json).
 *
 * Validates that the local IWAD reports the expected total lump count
 * (1264 for shareware DOOM1.WAD) and that every map lump bundle is present
 * with matching offsets and sizes.
 */

import type { DirectoryEntry } from '../wad/directory.ts';

export const VANILLA_SHAREWARE_DOOM1_LUMP_COUNT = 1264;
export const VANILLA_SHAREWARE_WAD_TYPE = 'IWAD';

export interface WadManifestMap {
  readonly name: string;
  readonly directoryIndex: number;
  readonly lumps: readonly { readonly name: string; readonly offset: number; readonly size: number }[];
}

export interface WadManifestExpectations {
  readonly totalLumps: number;
  readonly wadType: string;
  readonly maps: readonly WadManifestMap[];
}

export type WadManifestComparisonViolation = 'wrong_total_lump_count' | 'missing_map' | 'lump_offset_mismatch' | 'lump_size_mismatch' | 'wrong_directory_index';

export interface WadManifestComparisonInput {
  readonly directory: readonly DirectoryEntry[];
  readonly expected: WadManifestExpectations;
}

export interface WadManifestComparisonDecision {
  readonly accepted: boolean;
  readonly violations: readonly WadManifestComparisonViolation[];
}

export function compareLocalDoom1WadManifest(input: WadManifestComparisonInput): WadManifestComparisonDecision {
  const violations = new Set<WadManifestComparisonViolation>();
  if (input.directory.length !== input.expected.totalLumps) {
    violations.add('wrong_total_lump_count');
  }
  for (const expectedMap of input.expected.maps) {
    const mapEntry = input.directory[expectedMap.directoryIndex];
    if (mapEntry === undefined || mapEntry.name.replace(/\0+$/u, '').toUpperCase() !== expectedMap.name) {
      violations.add('missing_map');
      continue;
    }
    for (let lumpIndex = 0; lumpIndex < expectedMap.lumps.length; lumpIndex += 1) {
      const expectedLump = expectedMap.lumps[lumpIndex]!;
      const observedLump = input.directory[expectedMap.directoryIndex + 1 + lumpIndex];
      if (observedLump === undefined) {
        violations.add('missing_map');
        break;
      }
      if (observedLump.offset !== expectedLump.offset) {
        violations.add('lump_offset_mismatch');
      }
      if (observedLump.size !== expectedLump.size) {
        violations.add('lump_size_mismatch');
      }
    }
  }
  return Object.freeze({
    accepted: violations.size === 0,
    violations: Object.freeze([...violations].sort()),
  });
}
