/**
 * Shared test harness barrel for doom_codex.
 *
 * Defines the canonical test directory layout extracted from the 167-step
 * master checklist. Later steps (03-003 through 03-007) add shared utilities
 * as re-exports from this module.
 */

/** All test directories used across the master checklist, ASCIIbetically sorted. */
export const TEST_DIRECTORIES = Object.freeze([
  '_harness',
  'ai',
  'audio',
  'bootstrap',
  'config',
  'core',
  'demo',
  'host',
  'input',
  'map',
  'oracles',
  'parity',
  'player',
  'reference',
  'render',
  'save',
  'scaffold',
  'specials',
  'ui',
  'wad',
  'world',
] as const);

/** Discriminated union of all canonical test directory names. */
export type TestDirectory = (typeof TEST_DIRECTORIES)[number];

/** Total canonical test directories. */
export const TEST_DIRECTORY_COUNT = 21 as const;

/**
 * Maps each test directory to its primary phase number(s).
 * Directories used by multiple phases list all of them in ascending order.
 */
export const DIRECTORY_PHASE_MAP = Object.freeze({
  _harness: Object.freeze([3] as const),
  ai: Object.freeze([11] as const),
  audio: Object.freeze([15] as const),
  bootstrap: Object.freeze([7] as const),
  config: Object.freeze([16] as const),
  core: Object.freeze([4] as const),
  demo: Object.freeze([16] as const),
  host: Object.freeze([6] as const),
  input: Object.freeze([6] as const),
  map: Object.freeze([8] as const),
  oracles: Object.freeze([2] as const),
  parity: Object.freeze([17] as const),
  player: Object.freeze([10] as const),
  reference: Object.freeze([0, 1] as const),
  render: Object.freeze([13] as const),
  save: Object.freeze([16] as const),
  scaffold: Object.freeze([3] as const),
  specials: Object.freeze([12] as const),
  ui: Object.freeze([14] as const),
  wad: Object.freeze([1, 5] as const),
  world: Object.freeze([9] as const),
} as const satisfies Record<TestDirectory, readonly number[]>);

/** Total phases in the master checklist (00 through 17). */
export const PHASE_COUNT = 18 as const;

/** Directories present on disk by the time step 03-002 completes. */
export const PREEXISTING_DIRECTORIES = Object.freeze(['_harness', 'oracles', 'reference', 'scaffold', 'wad'] as const);
