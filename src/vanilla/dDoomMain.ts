/**
 * Vanilla DOOM 1.9 D_DoomMain initialization orchestrator.
 *
 * Plan_final step `04-002` (lane: runtime-core) wires the canonical
 * subsystem initialization order from Chocolate Doom 2.2.1's
 * `d_main.c` into a typed orchestrator that runs each init step
 * against the shared {@link VanillaRuntimeContext} produced by step
 * `04-001`.
 *
 * The 15-step canonical order is sourced from `src/bootstrap/initOrder.ts`
 * (SHA-pinned by the vanilla-parity inventory; read-only from this step):
 *
 *   0. Z_Init                — Init zone memory allocation daemon
 *   1. V_Init                — allocate screens
 *   2. M_LoadDefaults        — Load system defaults
 *   3. W_Init                — Init WADfiles
 *   4. I_Init                — Setting up machine state
 *   5. OPL_Init              — Using driver 'SDL'
 *   6. NET_Init              — Init network subsystem
 *   7. M_Init                — Init miscellaneous info
 *   8. R_Init                — Init DOOM refresh daemon
 *   9. P_Init                — Init Playloop state
 *  10. S_Init                — Setting up sound
 *  11. D_CheckNetGame        — Checking network game status
 *  12. HU_Init               — Setting up heads up display
 *  13. ST_Init               — Init status bar
 *  14. I_InitStretchTables   — Generating lookup tables
 *
 * Each step's `run` implementation in this step is an intentional
 * no-op placeholder.  Downstream runtime-core steps replace the
 * placeholder bodies one-by-one with the real subsystem wiring (Z
 * zone alloc, V screen alloc, M defaults load, W WAD index, etc.);
 * the ORDER itself is locked here so later steps cannot accidentally
 * reorder phases.
 *
 * The orchestrator awaits each step in sequence.  A throw from any
 * step is wrapped in {@link VanillaDDoomMainInitError} (carrying the
 * failed step's `label`, `index`, and the original `cause`) and
 * aborts the chain — subsequent steps do not run.  This mirrors
 * vanilla's `I_Error`-on-init-failure behavior: the engine never
 * proceeds past a failed init.
 *
 * @example
 * ```ts
 * import { D_DOOM_MAIN_INIT_ORDER, runDDoomMainInit } from './dDoomMain.ts';
 * import { createVanillaRuntimeContext } from './runtimeContext.ts';
 *
 * const context = createVanillaRuntimeContext(launchContext, resourceCache);
 * D_DOOM_MAIN_INIT_ORDER.length;       // 15
 * D_DOOM_MAIN_INIT_ORDER[0]!.label;    // 'Z_Init'
 * await runDDoomMainInit(context);     // runs all 15 placeholders in order
 * ```
 */

import type { VanillaRuntimeContext } from './runtimeContext.ts';

/**
 * One step in the D_DoomMain init sequence.
 *
 * `label` matches the corresponding `INIT_ORDER[i].label` from
 * `src/bootstrap/initOrder.ts` (e.g. `'Z_Init'`, `'V_Init'`).
 * `description` is the same human-readable description used by the
 * vanilla stdout banner.  `run` is the subsystem init callable;
 * downstream runtime-core steps replace the placeholder body with
 * the real wiring while keeping the same signature.
 *
 * The `run` callable is allowed to be either synchronous or async
 * (returning `void` or `Promise<void>`) to accommodate steps that
 * need to read files (`W_Init` reads the IWAD, `M_LoadDefaults`
 * reads default.cfg) without forcing every placeholder to allocate
 * a `Promise`.
 */
export interface VanillaDDoomMainInitStep {
  readonly label: string;
  readonly description: string;
  readonly run: (context: VanillaRuntimeContext) => Promise<void> | void;
}

/**
 * Typed error thrown by {@link runDDoomMainInit} when any init step
 * fails.  Carries the failed step's `label` and zero-based `index`
 * plus the original `cause` so callers (and downstream `I_Error`-
 * equivalent shutdown paths) can report exactly which subsystem
 * aborted the init chain.
 */
export class VanillaDDoomMainInitError extends Error {
  readonly stepLabel: string;
  readonly stepIndex: number;
  override readonly cause: unknown;

  constructor(stepLabel: string, stepIndex: number, cause: unknown) {
    super(`D_DoomMain init step ${stepIndex} (${stepLabel}) failed`);
    this.name = 'VanillaDDoomMainInitError';
    this.stepLabel = stepLabel;
    this.stepIndex = stepIndex;
    this.cause = cause;
  }
}

const NO_OP_INIT: VanillaDDoomMainInitStep['run'] = () => {};

/**
 * The frozen, ordered list of D_DoomMain init steps.  Index, label,
 * and description match `src/bootstrap/initOrder.ts`'s `INIT_ORDER`
 * positionally (SHA-pinned by the vanilla-parity inventory).  Each
 * `run` is a no-op placeholder in this step; downstream runtime-core
 * steps replace the bodies with the real subsystem init while
 * keeping the order locked.
 */
export const D_DOOM_MAIN_INIT_ORDER: readonly VanillaDDoomMainInitStep[] = Object.freeze([
  Object.freeze({ description: 'Init zone memory allocation daemon', label: 'Z_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'allocate screens', label: 'V_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Load system defaults', label: 'M_LoadDefaults', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Init WADfiles', label: 'W_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Setting up machine state', label: 'I_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: "Using driver 'SDL'", label: 'OPL_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Init network subsystem', label: 'NET_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Init miscellaneous info', label: 'M_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Init DOOM refresh daemon', label: 'R_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Init Playloop state', label: 'P_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Setting up sound', label: 'S_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Checking network game status', label: 'D_CheckNetGame', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Setting up heads up display', label: 'HU_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Init status bar', label: 'ST_Init', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
  Object.freeze({ description: 'Generating lookup tables', label: 'I_InitStretchTables', run: NO_OP_INIT } satisfies VanillaDDoomMainInitStep),
]);

/**
 * Iterate {@link D_DOOM_MAIN_INIT_ORDER} and call each step's `run`
 * against the supplied {@link VanillaRuntimeContext} in canonical
 * order.  Each step is awaited before the next runs; a throw from
 * any step is wrapped in {@link VanillaDDoomMainInitError} and
 * aborts the chain (subsequent steps do not run).
 *
 * @param context       The runtime context built by `createVanillaRuntimeContext`.
 * @param customOrder   Optional override init order — exposed solely
 *   for tests that need to inject spied/failing steps.  Production
 *   callers should always omit this and use the frozen canonical
 *   order.
 * @returns A promise that resolves once every step has run.
 * @throws {VanillaDDoomMainInitError} when any step's `run` throws.
 */
export async function runDDoomMainInit(context: VanillaRuntimeContext, customOrder: readonly VanillaDDoomMainInitStep[] = D_DOOM_MAIN_INIT_ORDER): Promise<void> {
  for (let stepIndex = 0; stepIndex < customOrder.length; stepIndex += 1) {
    const step = customOrder[stepIndex]!;
    try {
      await step.run(context);
    } catch (cause) {
      throw new VanillaDDoomMainInitError(step.label, stepIndex, cause);
    }
  }
}
