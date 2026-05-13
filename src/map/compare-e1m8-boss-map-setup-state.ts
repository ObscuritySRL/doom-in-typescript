/**
 * Pinned E1M8 (Phobos Anomaly, episode 1 boss map) setup state from local DOOM1.WAD.
 */

export const E1M8_MAP_SETUP_STATE = Object.freeze({
  name: 'E1M8',
  vertexes: 328,
  sectors: 74,
  sidedefs: 511,
  linedefs: 333,
  segs: 586,
  subsectors: 177,
  nodes: 176,
  things: 126,
  blockmapColumns: 52,
  blockmapRows: 56,
} as const);

export type E1M8MapSetupState = typeof E1M8_MAP_SETUP_STATE;
