/**
 * Pinned E1M9 (Military Base, episode 1 secret map) setup state from local DOOM1.WAD.
 */

export const E1M9_MAP_SETUP_STATE = Object.freeze({
  name: 'E1M9',
  vertexes: 581,
  sectors: 147,
  sidedefs: 902,
  linedefs: 653,
  segs: 978,
  subsectors: 288,
  nodes: 287,
  things: 237,
  blockmapColumns: 27,
  blockmapRows: 26,
} as const);

export type E1M9MapSetupState = typeof E1M9_MAP_SETUP_STATE;
