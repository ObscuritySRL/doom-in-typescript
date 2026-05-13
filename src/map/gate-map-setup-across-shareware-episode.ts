/**
 * Gate step 06-031: aggregate shareware episode 1 map setup state from local DOOM1.WAD.
 *
 * Anchors all 9 shareware-episode maps (E1M1..E1M9) to the same map-setup
 * oracle so regressions in the bundle parser, BSP traversal, or blockmap
 * generation surface here, not in scattered tests.
 */

import { E1M1_MAP_SETUP_STATE } from './compare-e1m1-map-setup-state.ts';
import { E1M2_MAP_SETUP_STATE } from './compare-e1m2-map-setup-state.ts';
import { E1M8_MAP_SETUP_STATE } from './compare-e1m8-boss-map-setup-state.ts';
import { E1M9_MAP_SETUP_STATE } from './compare-e1m9-secret-map-setup-state.ts';

export const SHAREWARE_EPISODE_MAP_NAMES = Object.freeze(['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9'] as const);
export type ShareWareEpisodeMapName = (typeof SHAREWARE_EPISODE_MAP_NAMES)[number];

export const SHAREWARE_EPISODE_PINNED_ORACLES = Object.freeze({
  E1M1: E1M1_MAP_SETUP_STATE,
  E1M2: E1M2_MAP_SETUP_STATE,
  E1M8: E1M8_MAP_SETUP_STATE,
  E1M9: E1M9_MAP_SETUP_STATE,
} as const);
