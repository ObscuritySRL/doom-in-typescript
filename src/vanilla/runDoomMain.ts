/**
 * Vanilla DOOM 1.9 `D_DoomMain` Bun entrypoint surface.
 *
 * Plan_final step `03-001` (lane: launch-host-input) replaces the historic
 * stub D_DoomMain placeholder with a real runDoomMain function that the
 * future root entrypoint can call.  This step deliberately keeps the
 * implementation a documented placeholder: it parses an optional argv
 * array, validates the shape of its inputs, and returns cleanly on a
 * happy path.  Subsequent launch-host-input steps (03-002 onward) will
 * wire the concrete `D_DoomMain` init order, command-line parsing,
 * IWAD discovery, host bring-up, the `D_DoomLoop` frame schedule, and
 * the clean quit semantics.
 *
 * Plan_final step `03-003` (lane: launch-host-input) wires the existing
 * vanilla command-line parser at `src/bootstrap/cmdline.ts` into this
 * entrypoint via {@link parseCommandLineConfiguration}, so a real
 * vanilla argv now flows through into a typed {@link CommandLineConfiguration}
 * before the subsequent launch lane steps consume it.  Invalid trailing
 * argument values for the wired flags (`-iwad`, `-config`, `-warp`,
 * `-playdemo`, `-timedemo`, `-skill`, `-savedir`) cause runDoomMain to
 * throw a typed {@link CommandLineParseError} that names both the
 * offending parameter and the offending received value.
 *
 * Plan_final step `03-004` (lane: launch-host-input) extends this
 * entrypoint by feeding the parsed configuration into
 * {@link resolveLaunchContext}, which derives the resolved IWAD path,
 * the `default.cfg` and `chocolate-doom.cfg` paths, and the save
 * directory.  The resolved {@link LaunchContext} is intentionally
 * discarded here (no asset load or host bring-up happens yet); later
 * launch-host-input steps will consume the context.  The discovery
 * environment is injected via an optional second argument so that
 * focused tests can exercise the resolution without touching the real
 * filesystem; when omitted, a default environment is used that reports
 * `DOOMWADDIR` as unset and every candidate basename as absent, which
 * makes the call shape stable while no host bring-up has wired the
 * real probes yet.
 *
 * The root entrypoint at `doom.ts` is held byte-identical to the
 * plan_vanilla_parity 03-001 skeleton (no top-level imports, `export {}`
 * marker, no side effects) until the cross-plan write-lock conflict on
 * `doom.ts` is resolved by a dedicated step.  In the meantime, this
 * wrapper file is the canonical surface the plan_final 03-001 focused
 * test pins.
 *
 * @example
 * ```ts
 * import { runDoomMain } from './src/vanilla/runDoomMain.ts';
 * await runDoomMain([]);
 * await runDoomMain(['-iwad', 'doom/DOOM1.WAD', '-skill', '3']);
 * ```
 */

import { parseCommandLineConfiguration } from './commandLineConfiguration.ts';
import { resolveLaunchContext } from './launchContext.ts';
import type { LaunchContextEnvironment } from './launchContext.ts';

/**
 * Thrown when {@link runDoomMain} is invoked with an argument shape it
 * cannot accept.  `runDoomMain` requires a `readonly string[]` argv (or
 * undefined for the empty-argv default); any other shape is rejected
 * here so calling code fails fast with a typed error rather than a
 * generic `TypeError` deep in argv handling.
 */
export class InvalidArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidArgumentError';
  }
}

/**
 * Describes why {@link runDoomMain} considered an argv element invalid.
 * Each entry is reported verbatim in the {@link InvalidArgumentError}
 * message so the caller can identify the offending slot.
 */
interface ArgumentValidationFailure {
  readonly index: number;
  readonly reason: string;
  readonly received: string;
}

const MAXIMUM_ARGUMENT_VALUE_PREVIEW_LENGTH = 80;

/**
 * Default {@link LaunchContextEnvironment} used when {@link runDoomMain}
 * is called without an explicit second argument.  Reports `DOOMWADDIR`
 * as unset and every canonical IWAD candidate basename as absent, which
 * matches the no-IWAD-on-disk fallback path through
 * {@link resolveLaunchContext} (returns a discovery result with
 * gameMode `'indetermined'` and the full seven-candidate probe sequence).
 * Subsequent launch-host-input steps will replace this default with a
 * Bun-backed probe that consults `Bun.env.DOOMWADDIR` and
 * `Bun.file(path).exists()`.
 */
const DEFAULT_LAUNCH_CONTEXT_ENVIRONMENT: LaunchContextEnvironment = Object.freeze({
  doesBasenameExistInWadDirectory: (): boolean => false,
  doomWadDirectoryEnvironmentValue: null,
});

function describeArgumentValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    const preview = value.length > MAXIMUM_ARGUMENT_VALUE_PREVIEW_LENGTH ? `${value.slice(0, MAXIMUM_ARGUMENT_VALUE_PREVIEW_LENGTH)}...` : value;
    return `string(${JSON.stringify(preview)})`;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return `${typeof value}(${String(value)})`;
  }
  if (typeof value === 'symbol') {
    return `symbol(${value.toString()})`;
  }
  if (typeof value === 'function') {
    return 'function';
  }
  if (Array.isArray(value)) {
    return `array(length=${value.length})`;
  }
  return `object(${Object.prototype.toString.call(value)})`;
}

function validateArgumentVector(argumentVector: unknown): readonly string[] {
  if (argumentVector === undefined) {
    return [];
  }
  if (!Array.isArray(argumentVector)) {
    throw new InvalidArgumentError(`runDoomMain expected a readonly string[] argv or undefined; received ${describeArgumentValue(argumentVector)}`);
  }
  const failures: ArgumentValidationFailure[] = [];
  for (let argumentIndex = 0; argumentIndex < argumentVector.length; argumentIndex += 1) {
    const argumentValue: unknown = argumentVector[argumentIndex];
    if (typeof argumentValue !== 'string') {
      failures.push({
        index: argumentIndex,
        reason: 'argv elements must be strings',
        received: describeArgumentValue(argumentValue),
      });
    }
  }
  if (failures.length > 0) {
    const failureDescriptions = failures.map((failure) => `argv[${failure.index}]: ${failure.reason} (received ${failure.received})`).join('; ');
    throw new InvalidArgumentError(`runDoomMain rejected ${failures.length} invalid argv element(s): ${failureDescriptions}`);
  }
  return argumentVector as readonly string[];
}

/**
 * Vanilla DOOM 1.9 `D_DoomMain` placeholder entrypoint.
 *
 * For plan_final step `03-001` this function exists purely as the wrapper
 * surface that downstream launch-host-input steps build on.  It validates
 * its argv argument and otherwise returns cleanly without performing any
 * runtime work, asset load, host bring-up, or side effects.  Later steps
 * progressively replace the placeholder body with the real vanilla init
 * order; the public signature (`runDoomMain(argv?: readonly string[] |
 * unknown): Promise<void>`) is intended to remain stable from this step
 * onward, with runtime validation guarding against argv shape misuse.
 *
 * The argument type is declared `unknown` so callers without strict
 * argv types (subprocess wrappers, demo tooling, ad-hoc tests) can
 * pass through their raw input and receive a typed
 * {@link InvalidArgumentError} on mismatch, rather than a generic
 * `TypeError` deep inside argv handling.  Strict callers should pass a
 * `readonly string[]` or omit the argument entirely.
 *
 * @param argumentVector Optional argv passed to the runtime.  When
 *   omitted, the empty-argv branch is taken.  When supplied, must be a
 *   readonly array of strings.
 * @param launchContextEnvironment Optional environment probes consumed
 *   by {@link resolveLaunchContext} (DOOMWADDIR value, canonical
 *   candidate existence predicate).  When omitted the
 *   {@link DEFAULT_LAUNCH_CONTEXT_ENVIRONMENT} is used, which reports
 *   `DOOMWADDIR` as unset and every candidate as absent.
 * @returns A promise that resolves once the placeholder workflow
 *   completes.
 * @throws InvalidArgumentError When `argumentVector` is supplied as a
 *   non-array value or contains a non-string element.
 *
 * @example
 * ```ts
 * await runDoomMain();
 * await runDoomMain(['--iwad', 'doom/DOOM1.WAD']);
 * await runDoomMain(['-iwad', 'doom/DOOM1.WAD'], {
 *   doomWadDirectoryEnvironmentValue: null,
 *   doesBasenameExistInWadDirectory: () => false,
 * });
 * ```
 */
export async function runDoomMain(argumentVector?: unknown, launchContextEnvironment: LaunchContextEnvironment = DEFAULT_LAUNCH_CONTEXT_ENVIRONMENT): Promise<void> {
  const validatedArgumentVector = validateArgumentVector(argumentVector);
  const commandLineConfiguration = parseCommandLineConfiguration(validatedArgumentVector);
  const launchContext = resolveLaunchContext(commandLineConfiguration, launchContextEnvironment);
  void launchContext;
}
