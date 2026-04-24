/**
 * D_DoomMain initialization order matching Chocolate Doom 2.2.1.
 *
 * Models the exact subsystem initialization sequence observed in the
 * reference stdout.txt.  The 15 steps are grouped into three phases:
 * early (before WAD loading), wad-load (WAD indexing), and
 * post-identify (after game mode identification and banner).
 *
 * @example
 * ```ts
 * import { INIT_ORDER, INIT_STEP_COUNT } from "../src/bootstrap/initOrder.ts";
 * INIT_ORDER.length; // 15
 * INIT_ORDER[0].label; // "Z_Init"
 * ```
 */

import type { InitStep } from '../oracles/referenceRunManifest.ts';

/**
 * Phase of the initialization sequence within D_DoomMain.
 *
 * - `"early"`: subsystems initialized before WAD files are loaded
 * - `"post-identify"`: subsystems initialized after game mode detection
 * - `"wad-load"`: the WAD file indexing step itself
 */
export type InitPhase = 'early' | 'post-identify' | 'wad-load';

/** A single step in the D_DoomMain initialization sequence. */
export interface InitStepDefinition {
  /** 0-based index in the canonical init sequence. */
  readonly index: number;
  /** Function or subsystem label (e.g. "Z_Init"). */
  readonly label: string;
  /** Description of what this step initializes. */
  readonly description: string;
  /** Phase of initialization this step belongs to. */
  readonly phase: InitPhase;
}

/** All valid init phases in ASCIIbetical order. */
export const INIT_PHASES: readonly InitPhase[] = Object.freeze(['early', 'post-identify', 'wad-load']);

/** Total number of steps in the D_DoomMain initialization sequence. */
export const INIT_STEP_COUNT = 15;

/** Number of init steps in the early phase (before WAD loading). */
export const EARLY_PHASE_COUNT = 3;

/** Number of init steps in the wad-load phase. */
export const WAD_LOAD_PHASE_COUNT = 1;

/** Number of init steps in the post-identify phase. */
export const POST_IDENTIFY_PHASE_COUNT = 11;

/**
 * Frozen canonical initialization sequence from D_DoomMain.
 *
 * Derived from the Chocolate Doom 2.2.1 reference stdout.txt.
 * Steps 0–2 are early (pre-WAD), step 3 is the WAD load, and
 * steps 4–14 run after game mode identification and banner display.
 *
 * Between the wad-load and post-identify phases, D_DoomMain calls
 * D_IdentifyVersion, InitGameVersion, D_SetGameDescription, and
 * prints the game banner — none of these produce "X_Init:" stdout
 * messages, so they are not enumerated as visible init steps.
 */
export const INIT_ORDER: readonly InitStepDefinition[] = Object.freeze([
  Object.freeze({ index: 0, label: 'Z_Init', description: 'Init zone memory allocation daemon', phase: 'early' } satisfies InitStepDefinition),
  Object.freeze({ index: 1, label: 'V_Init', description: 'allocate screens', phase: 'early' } satisfies InitStepDefinition),
  Object.freeze({ index: 2, label: 'M_LoadDefaults', description: 'Load system defaults', phase: 'early' } satisfies InitStepDefinition),
  Object.freeze({ index: 3, label: 'W_Init', description: 'Init WADfiles', phase: 'wad-load' } satisfies InitStepDefinition),
  Object.freeze({ index: 4, label: 'I_Init', description: 'Setting up machine state', phase: 'post-identify' } satisfies InitStepDefinition),
  Object.freeze({ index: 5, label: 'OPL_Init', description: "Using driver 'SDL'", phase: 'post-identify' } satisfies InitStepDefinition),
  Object.freeze({ index: 6, label: 'NET_Init', description: 'Init network subsystem', phase: 'post-identify' } satisfies InitStepDefinition),
  Object.freeze({ index: 7, label: 'M_Init', description: 'Init miscellaneous info', phase: 'post-identify' } satisfies InitStepDefinition),
  Object.freeze({ index: 8, label: 'R_Init', description: 'Init DOOM refresh daemon', phase: 'post-identify' } satisfies InitStepDefinition),
  Object.freeze({ index: 9, label: 'P_Init', description: 'Init Playloop state', phase: 'post-identify' } satisfies InitStepDefinition),
  Object.freeze({ index: 10, label: 'S_Init', description: 'Setting up sound', phase: 'post-identify' } satisfies InitStepDefinition),
  Object.freeze({ index: 11, label: 'D_CheckNetGame', description: 'Checking network game status', phase: 'post-identify' } satisfies InitStepDefinition),
  Object.freeze({ index: 12, label: 'HU_Init', description: 'Setting up heads up display', phase: 'post-identify' } satisfies InitStepDefinition),
  Object.freeze({ index: 13, label: 'ST_Init', description: 'Init status bar', phase: 'post-identify' } satisfies InitStepDefinition),
  Object.freeze({ index: 14, label: 'I_InitStretchTables', description: 'Generating lookup tables', phase: 'post-identify' } satisfies InitStepDefinition),
]);

/**
 * Map from init step label to its canonical definition.
 *
 * Useful for O(1) lookup by label name when cross-referencing
 * with other manifests.
 */
export const INIT_ORDER_BY_LABEL: ReadonlyMap<string, InitStepDefinition> = (() => {
  const map = new Map<string, InitStepDefinition>();
  for (const step of INIT_ORDER) {
    map.set(step.label, step);
  }
  return map;
})();

/**
 * Verify that an {@link InitStepDefinition} array matches the
 * label/description pairs from a {@link InitStep} array.
 *
 * Returns `true` when every entry's label and description match
 * positionally.  Used to cross-reference INIT_ORDER against the
 * REFERENCE_RUN_MANIFEST initSequence.
 *
 * @param order    - The init order to validate.
 * @param manifest - The reference manifest init sequence.
 */
export function matchesManifestSequence(order: readonly InitStepDefinition[], manifest: readonly InitStep[]): boolean {
  if (order.length !== manifest.length) return false;
  for (let index = 0; index < order.length; index++) {
    const step = order[index]!;
    const reference = manifest[index]!;
    if (step.label !== reference.label) return false;
    if (step.description !== reference.description) return false;
  }
  return true;
}
