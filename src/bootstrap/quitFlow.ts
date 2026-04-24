/**
 * Quit and cleanup flow matching Chocolate Doom 2.2.1.
 *
 * Models the I_AtExit registration stack and I_Quit / I_Error
 * execution paths from i_system.c.  Cleanup handlers are registered
 * during initialization in chronological order and executed in LIFO
 * (last-registered-first) order, matching the linked-list prepend
 * behavior of I_AtExit.
 *
 * @example
 * ```ts
 * import { QuitFlow } from "../src/bootstrap/quitFlow.ts";
 * const flow = new QuitFlow();
 * flow.register("M_SaveDefaults", true);
 * flow.register("I_ShutdownTimer", true);
 * const executed = flow.executeQuit(name => subsystems[name]());
 * ```
 */

/**
 * Canonical cleanup step names from Chocolate Doom 2.2.1.
 *
 * Each name corresponds to a function registered via I_AtExit
 * during initialization.  Listed in ASCIIbetical order per
 * project convention.
 */
export type CleanupStepName = 'D_Endoom' | 'D_QuitNetGame' | 'I_ShutdownGraphics' | 'I_ShutdownMusic' | 'I_ShutdownSound' | 'I_ShutdownTimer' | 'M_SaveDefaults' | 'S_Shutdown';

/**
 * A single cleanup registration matching one I_AtExit() call.
 *
 * The {@link runOnError} flag controls whether this handler
 * executes during I_Error (error exit) in addition to I_Quit
 * (normal exit).
 */
export interface CleanupRegistration {
  /** Cleanup function name. */
  readonly name: CleanupStepName;
  /** Whether this handler runs on error exit (I_Error path). */
  readonly runOnError: boolean;
}

/** Number of cleanup steps in the canonical shareware quit sequence. */
export const CLEANUP_STEP_COUNT = 8;

/**
 * Canonical cleanup registrations in chronological I_AtExit call order.
 *
 * This is the order handlers are registered during initialization.
 * Execution order is the reverse (LIFO) of this array.
 *
 * Registration sites (Chocolate Doom 2.2.1):
 * - M_SaveDefaults: M_LoadDefaults (init step 2)
 * - I_ShutdownTimer: I_InitTimer via I_Init (init step 4)
 * - I_ShutdownSound: I_InitSound via S_Init (init step 10)
 * - I_ShutdownMusic: I_InitMusic via S_Init (init step 10)
 * - S_Shutdown: S_Init (init step 10)
 * - D_QuitNetGame: D_CheckNetGame (init step 11)
 * - D_Endoom: D_DoomMain (after init, before D_DoomLoop)
 * - I_ShutdownGraphics: I_InitGraphics (in D_DoomLoop)
 */
export const CANONICAL_REGISTRATION_ORDER: readonly CleanupRegistration[] = Object.freeze([
  Object.freeze({ name: 'M_SaveDefaults', runOnError: true } satisfies CleanupRegistration),
  Object.freeze({ name: 'I_ShutdownTimer', runOnError: true } satisfies CleanupRegistration),
  Object.freeze({ name: 'I_ShutdownSound', runOnError: true } satisfies CleanupRegistration),
  Object.freeze({ name: 'I_ShutdownMusic', runOnError: true } satisfies CleanupRegistration),
  Object.freeze({ name: 'S_Shutdown', runOnError: true } satisfies CleanupRegistration),
  Object.freeze({ name: 'D_QuitNetGame', runOnError: true } satisfies CleanupRegistration),
  Object.freeze({ name: 'D_Endoom', runOnError: true } satisfies CleanupRegistration),
  Object.freeze({ name: 'I_ShutdownGraphics', runOnError: true } satisfies CleanupRegistration),
]);

/**
 * Canonical cleanup step names in LIFO execution order.
 *
 * This is the order handlers execute during I_Quit for shareware
 * Doom — the reverse of {@link CANONICAL_REGISTRATION_ORDER}.
 */
export const CANONICAL_QUIT_ORDER: readonly CleanupStepName[] = Object.freeze(['I_ShutdownGraphics', 'D_Endoom', 'D_QuitNetGame', 'S_Shutdown', 'I_ShutdownMusic', 'I_ShutdownSound', 'I_ShutdownTimer', 'M_SaveDefaults']);

/**
 * Quit and cleanup flow orchestrator.
 *
 * Models the I_AtExit linked-list stack from Chocolate Doom 2.2.1
 * i_system.c.  Handlers are registered during initialization and
 * executed in LIFO order on quit.
 *
 * Two execution paths exist:
 * - {@link executeQuit} (I_Quit): runs all registered handlers.
 * - {@link executeErrorQuit} (I_Error): runs only handlers with
 *   {@link CleanupRegistration.runOnError} set to `true`.
 *
 * Lifecycle:
 * 1. Construct a flow instance.
 * 2. Call {@link register} for each subsystem during initialization.
 * 3. Call {@link executeQuit} or {@link executeErrorQuit} once to
 *    perform cleanup.
 *
 * @example
 * ```ts
 * import { QuitFlow } from "../src/bootstrap/quitFlow.ts";
 * const flow = new QuitFlow();
 * flow.register("M_SaveDefaults", true);
 * flow.register("I_ShutdownGraphics", true);
 * flow.executeQuit(name => console.log("cleanup:", name));
 * ```
 */
export class QuitFlow {
  #hasQuit = false;
  readonly #stack: CleanupRegistration[] = [];

  /** Whether {@link executeQuit} or {@link executeErrorQuit} has been called. */
  get hasQuit(): boolean {
    return this.#hasQuit;
  }

  /** Number of registered cleanup handlers. */
  get registrationCount(): number {
    return this.#stack.length;
  }

  /**
   * I_Error equivalent: execute only `runOnError` handlers in LIFO order.
   *
   * Walks the registration stack in reverse and calls {@link dispatch}
   * for each handler whose {@link CleanupRegistration.runOnError} is
   * `true`.  Returns the names of executed steps as a frozen array.
   *
   * @param dispatch - Called for each eligible cleanup step name.
   * @returns Frozen array of executed step names in execution order.
   * @throws {Error} If quit has already been executed.
   */
  executeErrorQuit(dispatch: (name: CleanupStepName) => void): readonly CleanupStepName[] {
    if (this.#hasQuit) {
      throw new Error('QuitFlow.executeErrorQuit called after quit');
    }
    this.#hasQuit = true;

    const executed: CleanupStepName[] = [];
    for (let index = this.#stack.length - 1; index >= 0; index--) {
      const registration = this.#stack[index]!;
      if (registration.runOnError) {
        dispatch(registration.name);
        executed.push(registration.name);
      }
    }
    return Object.freeze(executed);
  }

  /**
   * I_Quit equivalent: execute all registered handlers in LIFO order.
   *
   * Walks the registration stack in reverse and calls {@link dispatch}
   * for each handler regardless of its {@link CleanupRegistration.runOnError}
   * flag.  Returns the names of executed steps as a frozen array.
   *
   * @param dispatch - Called for each cleanup step name.
   * @returns Frozen array of executed step names in execution order.
   * @throws {Error} If quit has already been executed.
   */
  executeQuit(dispatch: (name: CleanupStepName) => void): readonly CleanupStepName[] {
    if (this.#hasQuit) {
      throw new Error('QuitFlow.executeQuit called after quit');
    }
    this.#hasQuit = true;

    const executed: CleanupStepName[] = [];
    for (let index = this.#stack.length - 1; index >= 0; index--) {
      const registration = this.#stack[index]!;
      dispatch(registration.name);
      executed.push(registration.name);
    }
    return Object.freeze(executed);
  }

  /**
   * I_AtExit equivalent: push a cleanup handler onto the LIFO stack.
   *
   * Handlers are stored in registration order.  Execution traverses
   * the stack in reverse (LIFO), matching the linked-list prepend
   * behavior of Chocolate Doom's I_AtExit.
   *
   * @param name       - Cleanup function name.
   * @param runOnError - Whether to execute on error exit.
   * @throws {Error} If quit has already been executed.
   */
  register(name: CleanupStepName, runOnError: boolean): void {
    if (this.#hasQuit) {
      throw new Error('QuitFlow.register called after quit');
    }
    this.#stack.push(Object.freeze({ name, runOnError }));
  }
}
