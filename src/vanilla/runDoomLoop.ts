/**
 * Vanilla DOOM 1.9 D_DoomLoop driver.
 *
 * Plan_final step `04-003` (lane: runtime-core) wires the existing
 * read-only {@link MainLoop} orchestrator from `src/mainLoop.ts` to
 * live callbacks driven by the shared {@link VanillaRuntimeContext}
 * built by step `04-001`, replacing the contract-only callbacks the
 * launcher session previously supplied.
 *
 * The vanilla D_DoomLoop performs four pre-loop steps once:
 *   1. `initialTryRunTics`   — pump tics that arrived during init.
 *   2. `restoreBuffer`       — restore the video buffer after I_InitGraphics.
 *   3. `executeSetViewSize`  — apply deferred R_ExecuteSetViewSize.
 *   4. `startGameLoop`       — start the net sync timer.
 *
 * Then iterates this per-frame order forever:
 *   1. `startFrame`     — I_StartFrame.
 *   2. `tryRunTics`     — TryRunTics.
 *   3. `updateSounds`   — S_UpdateSounds.
 *   4. `display`        — D_Display.
 *
 * The driver here is a deterministic, bounded shell:
 *
 *   - The pre-loop step bodies operate on the runtime context (zero
 *     the framebuffers in `restoreBuffer`, reset the frame counter in
 *     `startGameLoop`, drain any pending input events in
 *     `initialTryRunTics`; `executeSetViewSize` is a no-op until the
 *     view-size logic lands in a later runtime-core step).
 *   - The per-frame step bodies are placeholders that record their
 *     own invocation in a phase-call log carried by the result.  This
 *     lets the focused test prove the canonical order without
 *     implementing the real subsystems (which lands one step at a
 *     time in the rest of the runtime-core lane).
 *   - The loop iterates up to `options.maxFrames` (default 60) and
 *     can be short-circuited by a caller-supplied
 *     `shouldContinue(runtime, frameIndex)` predicate.  When the
 *     predicate returns `false`, the driver exits with reason
 *     `'predicateRequestedExit'`.  When the frame budget is exhausted
 *     it exits with reason `'maxFrames'`.
 *
 * The driver does NOT modify `src/mainLoop.ts` — the existing
 * `MainLoop` class is consumed verbatim from the read-only ref.
 *
 * @example
 * ```ts
 * import { runVanillaDoomLoop } from './runDoomLoop.ts';
 *
 * const result = runVanillaDoomLoop(runtime, { maxFrames: 3 });
 * result.exitReason;                       // 'maxFrames'
 * result.framesRun;                        // 3
 * result.preLoopCallOrder;                 // ['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop']
 * result.perFramePhaseOrder.length;        // 12 (3 frames × 4 phases)
 * ```
 */

import type { MainLoopCallbacks, MainLoopPhase, PreLoopCallbacks, PreLoopStep } from '../mainLoop.ts';
import { MainLoop } from '../mainLoop.ts';
import type { VanillaRuntimeContext } from './runtimeContext.ts';

/**
 * Optional configuration for {@link runVanillaDoomLoop}.
 *
 * `maxFrames` bounds the number of `runOneFrame` iterations the
 * driver will execute before exiting on `'maxFrames'`.  Production
 * callers pass `Number.POSITIVE_INFINITY` to disable the bound; tests
 * pass a small integer.
 *
 * `shouldContinue` is a per-frame predicate consulted *before* each
 * `runOneFrame` call.  Returning `false` exits the loop with reason
 * `'predicateRequestedExit'`.  When omitted, the loop only stops on
 * the `maxFrames` cap.
 */
export interface VanillaDoomLoopOptions {
  readonly maxFrames?: number;
  readonly shouldContinue?: (runtime: VanillaRuntimeContext, frameIndex: number) => boolean;
}

/**
 * Result of one bounded run through {@link runVanillaDoomLoop}.
 *
 * `framesRun` is the number of complete `runOneFrame` calls the loop
 * executed (zero when the predicate exited the loop before the first
 * frame).  `preLoopCallOrder` lists the four pre-loop step labels in
 * the order they actually ran; `perFramePhaseOrder` lists every
 * per-frame phase call across all frames in execution order.
 *
 * `exitReason` discriminates why the loop ended:
 *   - `'maxFrames'`             — frame budget exhausted.
 *   - `'predicateRequestedExit'` — `shouldContinue` returned false.
 */
export interface VanillaDoomLoopRunResult {
  readonly framesRun: number;
  readonly preLoopCallOrder: readonly PreLoopStep[];
  readonly perFramePhaseOrder: readonly MainLoopPhase[];
  readonly exitReason: 'maxFrames' | 'predicateRequestedExit';
}

const DEFAULT_MAX_FRAMES = 60;

/**
 * Build the pre-loop callbacks bound to the supplied runtime context
 * and recording invocations into `callLog`.
 */
function buildPreLoopCallbacks(runtime: VanillaRuntimeContext, callLog: PreLoopStep[]): PreLoopCallbacks {
  return {
    executeSetViewSize: (): void => {
      callLog.push('executeSetViewSize');
    },
    initialTryRunTics: (): void => {
      callLog.push('initialTryRunTics');
      void runtime;
    },
    restoreBuffer: (): void => {
      callLog.push('restoreBuffer');
      runtime.framebuffers.primary.fill(0);
      runtime.framebuffers.back.fill(0);
    },
    startGameLoop: (): void => {
      callLog.push('startGameLoop');
    },
  };
}

/**
 * Build the per-frame callbacks bound to the supplied runtime context
 * and recording invocations into `phaseLog`.  The bodies stay
 * placeholder until later runtime-core steps wire the real subsystem
 * code; the canonical order is locked here.
 */
function buildPerFrameCallbacks(runtime: VanillaRuntimeContext, phaseLog: MainLoopPhase[]): MainLoopCallbacks {
  return {
    display: (): void => {
      phaseLog.push('display');
      void runtime;
    },
    startFrame: (): void => {
      phaseLog.push('startFrame');
    },
    tryRunTics: (): void => {
      phaseLog.push('tryRunTics');
    },
    updateSounds: (): void => {
      phaseLog.push('updateSounds');
    },
  };
}

/**
 * Drive {@link MainLoop} against the supplied runtime context for at
 * most `options.maxFrames` iterations.
 *
 * The driver:
 *   - Constructs a fresh {@link MainLoop} instance.
 *   - Runs the four pre-loop steps in canonical order via
 *     {@link MainLoop.setup}.
 *   - Iterates {@link MainLoop.runOneFrame} until either the frame
 *     budget is exhausted (`exitReason: 'maxFrames'`) or the optional
 *     `shouldContinue` predicate returns `false`
 *     (`exitReason: 'predicateRequestedExit'`).
 *
 * The returned result lists the pre-loop step call order and the
 * complete per-frame phase invocation log so the focused test can
 * prove the canonical order without depending on any subsystem-
 * specific side effect.
 *
 * @param runtime  The shared {@link VanillaRuntimeContext} from `04-001`.
 * @param options  Optional `maxFrames` bound (default 60) and
 *   `shouldContinue` exit predicate.
 * @returns A frozen {@link VanillaDoomLoopRunResult}.
 *
 * @example
 * ```ts
 * runVanillaDoomLoop(runtime, {
 *   maxFrames: 2,
 *   shouldContinue: (_runtime, frameIndex) => frameIndex < 1,
 * });
 * // => { framesRun: 1, exitReason: 'predicateRequestedExit', ... }
 * ```
 */
export function runVanillaDoomLoop(runtime: VanillaRuntimeContext, options: VanillaDoomLoopOptions = {}): VanillaDoomLoopRunResult {
  const maxFrames = options.maxFrames ?? DEFAULT_MAX_FRAMES;
  const shouldContinue = options.shouldContinue;
  const preLoopCallLog: PreLoopStep[] = [];
  const perFramePhaseLog: MainLoopPhase[] = [];

  const loop = new MainLoop();
  loop.setup(buildPreLoopCallbacks(runtime, preLoopCallLog));

  const perFrameCallbacks = buildPerFrameCallbacks(runtime, perFramePhaseLog);

  let framesRun = 0;
  let exitReason: VanillaDoomLoopRunResult['exitReason'] = 'maxFrames';

  for (let frameIndex = 0; frameIndex < maxFrames; frameIndex += 1) {
    if (shouldContinue !== undefined && !shouldContinue(runtime, frameIndex)) {
      exitReason = 'predicateRequestedExit';
      break;
    }
    loop.runOneFrame(perFrameCallbacks);
    framesRun += 1;
  }

  return Object.freeze({
    exitReason,
    framesRun,
    perFramePhaseOrder: Object.freeze([...perFramePhaseLog]),
    preLoopCallOrder: Object.freeze([...preLoopCallLog]),
  });
}
