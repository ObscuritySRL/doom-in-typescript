/**
 * Pinned E1M1 map setup state from local DOOM1.WAD (shareware DOOM 1.9).
 *
 * These counts are derived by loading DOOM1.WAD's E1M1 through the parity
 * map bundle parser. They serve as a fixture to detect regressions in map
 * loading, BSP construction, or blockmap generation.
 */

export const E1M1_MAP_SETUP_STATE = Object.freeze({
  name: 'E1M1',
  vertexes: 467,
  sectors: 85,
  sidedefs: 648,
  linedefs: 475,
  segs: 732,
  subsectors: 237,
  nodes: 236,
  things: 138,
  blockmapColumns: 36,
  blockmapRows: 23,
} as const);

export type E1M1MapSetupState = typeof E1M1_MAP_SETUP_STATE;
