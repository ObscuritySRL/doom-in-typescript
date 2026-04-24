/**
 * D_DoomLoop main loop orchestrator matching Chocolate Doom 2.2.1.
 *
 * Models the exact per-frame call order from d_main.c D_DoomLoop
 * (non-singletics path, no testcontrols):
 *
 * 1. {@link MainLoopCallbacks.startFrame | I_StartFrame}
 * 2. {@link MainLoopCallbacks.tryRunTics | TryRunTics}
 * 3. {@link MainLoopCallbacks.updateSounds | S_UpdateSounds}
 * 4. {@link MainLoopCallbacks.display | D_Display}
 *
 * Before the loop begins, D_DoomLoop runs four pre-loop steps in order:
 * an initial TryRunTics call, V_RestoreBuffer, R_ExecuteSetViewSize,
 * and D_StartGameLoop.
 *
 * @example
 * ```ts
 * import { MainLoop } from "../src/mainLoop.ts";
 * const loop = new MainLoop();
 * loop.setup(preLoopCallbacks);
 * loop.runOneFrame(frameCallbacks);
 * ```
 */

/**
 * Phase identifier for one of the four per-frame operations in D_DoomLoop.
 *
 * Execution order is: `"startFrame"` → `"tryRunTics"` →
 * `"updateSounds"` → `"display"`.
 */
export type MainLoopPhase = 'display' | 'startFrame' | 'tryRunTics' | 'updateSounds';

/**
 * Frozen array of per-frame phases in canonical execution order.
 *
 * This is the order D_DoomLoop calls its subsystems each iteration
 * of the while(1) loop (non-singletics path, testcontrols=false).
 */
export const MAIN_LOOP_PHASES: readonly MainLoopPhase[] = Object.freeze(['startFrame', 'tryRunTics', 'updateSounds', 'display']);

/** Number of per-frame phases in the main loop. */
export const MAIN_LOOP_PHASE_COUNT = 4;

/**
 * Pre-loop step identifier for the one-time setup before the main loop.
 *
 * Execution order is: `"initialTryRunTics"` → `"restoreBuffer"` →
 * `"executeSetViewSize"` → `"startGameLoop"`.
 */
export type PreLoopStep = 'executeSetViewSize' | 'initialTryRunTics' | 'restoreBuffer' | 'startGameLoop';

/**
 * Frozen array of pre-loop steps in canonical execution order.
 *
 * These match the four parity-relevant calls in D_DoomLoop between
 * I_InitGraphics and the while(1) loop: TryRunTics (initial pump),
 * V_RestoreBuffer, R_ExecuteSetViewSize, D_StartGameLoop.
 */
export const PRE_LOOP_STEPS: readonly PreLoopStep[] = Object.freeze(['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop']);

/** Number of pre-loop steps. */
export const PRE_LOOP_STEP_COUNT = 4;

/**
 * Callbacks for the per-frame systems orchestrated by D_DoomLoop.
 *
 * The {@link MainLoop} calls these in canonical order each frame:
 * {@link startFrame} → {@link tryRunTics} → {@link updateSounds} →
 * {@link display}.
 *
 * @example
 * ```ts
 * const callbacks: MainLoopCallbacks = {
 *   startFrame() { pump.startFrame(); },
 *   tryRunTics() { runner.tryRunTics(timeSource, ticCallbacks); },
 *   updateSounds() { audio.update(listener); },
 *   display() { renderer.drawFrame(); },
 * };
 * ```
 */
export interface MainLoopCallbacks {
  /** D_Display — render the current frame. */
  display(): void;
  /** I_StartFrame — frame-synchronous I/O operations. */
  startFrame(): void;
  /** TryRunTics — process one or more game tics. */
  tryRunTics(): void;
  /** S_UpdateSounds — update positional sound sources. */
  updateSounds(): void;
}

/**
 * Callbacks for the one-time pre-loop setup in D_DoomLoop.
 *
 * The {@link MainLoop} calls these in canonical order once during
 * {@link MainLoop.setup}: {@link initialTryRunTics} →
 * {@link restoreBuffer} → {@link executeSetViewSize} →
 * {@link startGameLoop}.
 *
 * @example
 * ```ts
 * const preLoop: PreLoopCallbacks = {
 *   initialTryRunTics() { runner.tryRunTics(timeSource, ticCallbacks); },
 *   restoreBuffer() { video.restoreBuffer(); },
 *   executeSetViewSize() { renderer.executeSetViewSize(); },
 *   startGameLoop() { clock.reset(); },
 * };
 * ```
 */
export interface PreLoopCallbacks {
  /** R_ExecuteSetViewSize — apply deferred view size changes. */
  executeSetViewSize(): void;
  /** TryRunTics — initial tic pump before the loop begins. */
  initialTryRunTics(): void;
  /** V_RestoreBuffer — restore video buffer after graphics init. */
  restoreBuffer(): void;
  /** D_StartGameLoop — start the net sync timer. */
  startGameLoop(): void;
}

/**
 * Main loop orchestrator matching Chocolate Doom 2.2.1 D_DoomLoop.
 *
 * Lifecycle:
 * 1. Construct a loop instance.
 * 2. Call {@link setup} once with {@link PreLoopCallbacks} to run the
 *    pre-loop initialization sequence.
 * 3. Call {@link runOneFrame} each frame with {@link MainLoopCallbacks}
 *    to execute one iteration of the main loop in canonical order.
 *
 * @example
 * ```ts
 * import { MainLoop } from "../src/mainLoop.ts";
 * const loop = new MainLoop();
 * loop.setup(preLoopCallbacks);
 * while (!quit) loop.runOneFrame(frameCallbacks);
 * ```
 */
export class MainLoop {
  #frameCount = 0;
  #started = false;

  /** Number of complete frames executed since {@link setup}. */
  get frameCount(): number {
    return this.#frameCount;
  }

  /** Whether {@link setup} has been called. */
  get started(): boolean {
    return this.#started;
  }

  /**
   * Run one iteration of D_DoomLoop in canonical order.
   *
   * Calls {@link MainLoopCallbacks.startFrame}, then
   * {@link MainLoopCallbacks.tryRunTics}, then
   * {@link MainLoopCallbacks.updateSounds}, then
   * {@link MainLoopCallbacks.display}.  Increments the frame counter.
   *
   * @throws {Error} If {@link setup} has not been called.
   */
  runOneFrame(callbacks: MainLoopCallbacks): void {
    if (!this.#started) {
      throw new Error('MainLoop.runOneFrame called before setup');
    }

    callbacks.startFrame();
    callbacks.tryRunTics();
    callbacks.updateSounds();
    callbacks.display();
    this.#frameCount++;
  }

  /**
   * Execute the pre-loop setup sequence from D_DoomLoop.
   *
   * Calls the four pre-loop steps in canonical order:
   * {@link PreLoopCallbacks.initialTryRunTics},
   * {@link PreLoopCallbacks.restoreBuffer},
   * {@link PreLoopCallbacks.executeSetViewSize},
   * {@link PreLoopCallbacks.startGameLoop}.
   *
   * @throws {Error} If setup has already been called.
   */
  setup(callbacks: PreLoopCallbacks): void {
    if (this.#started) {
      throw new Error('MainLoop.setup called more than once');
    }

    callbacks.initialTryRunTics();
    callbacks.restoreBuffer();
    callbacks.executeSetViewSize();
    callbacks.startGameLoop();
    this.#started = true;
  }
}
