/**
 * Pinned E1M2 map setup state from local DOOM1.WAD (shareware DOOM 1.9).
 */

export const E1M2_MAP_SETUP_STATE = Object.freeze({
  name: 'E1M2',
  vertexes: 942,
  sectors: 200,
  sidedefs: 1323,
  linedefs: 1033,
  segs: 1463,
  subsectors: 448,
  nodes: 447,
  things: 262,
  blockmapColumns: 42,
  blockmapRows: 31,
} as const);

export type E1M2MapSetupState = typeof E1M2_MAP_SETUP_STATE;
