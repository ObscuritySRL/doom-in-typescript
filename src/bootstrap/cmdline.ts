/**
 * Command-line parser matching Chocolate Doom 2.2.1 M_CheckParm behavior.
 *
 * Doom's command-line convention uses single-dash prefixed flags like
 * `-skill`, `-iwad`, `-devparm`.  M_CheckParm scans arguments
 * case-insensitively (Chocolate Doom behavior) and returns a 1-based
 * index where 0 means "not found".  The argument after a flag is
 * typically its value.
 *
 * @example
 * ```ts
 * import { CommandLine } from "../src/bootstrap/cmdline.ts";
 * const cmdline = new CommandLine(["doom.exe", "-skill", "4", "-devparm"]);
 * cmdline.checkParameter("-skill"); // 1
 * cmdline.getParameter("-skill");   // "4"
 * cmdline.parameterExists("-devparm"); // true
 * ```
 */

/**
 * Encapsulates the process argument list and provides Doom-convention
 * parameter lookup.
 *
 * The argument at index 0 is the program name and is never matched by
 * parameter searches.  All lookups are case-insensitive, matching
 * Chocolate Doom 2.2.1 behavior.
 */
export class CommandLine {
  readonly #arguments: readonly string[];

  /**
   * @param argv - Raw command-line arguments.  Index 0 is the program
   *   name; parameter searches start at index 1.
   */
  constructor(argv: readonly string[]) {
    this.#arguments = Object.freeze([...argv]);
  }

  /** Total argument count including program name (equivalent to myargc). */
  get count(): number {
    return this.#arguments.length;
  }

  /**
   * Argument at the given 0-based index, or `undefined` if out of range.
   *
   * @param index - 0-based position in the argument list.
   */
  at(index: number): string | undefined {
    return this.#arguments[index];
  }

  /**
   * Scan for a parameter by name, case-insensitively.
   *
   * Returns the 1-based index of the first matching argument, or 0 if
   * not found.  This matches Chocolate Doom's `M_CheckParm` convention
   * where 0 is the "not found" sentinel and the search starts at
   * index 1 (skipping the program name).
   *
   * @param name - Parameter name to find (e.g., `"-skill"`).
   * @returns 1-based argument index, or 0 if not found.
   */
  checkParameter(name: string): number {
    const lower = name.toLowerCase();
    for (let index = 1; index < this.#arguments.length; index++) {
      if (this.#arguments[index]!.toLowerCase() === lower) {
        return index;
      }
    }
    return 0;
  }

  /**
   * Scan for a parameter and verify that at least `requiredArgs`
   * arguments follow it.
   *
   * Returns the 1-based index when the parameter exists *and* has
   * enough trailing arguments; otherwise returns 0.  This matches
   * Chocolate Doom's `M_CheckParmWithArgs`.
   *
   * @param name         - Parameter name to find.
   * @param requiredArgs - Minimum number of arguments that must follow.
   * @returns 1-based argument index, or 0.
   */
  checkParameterWithArgs(name: string, requiredArgs: number): number {
    const index = this.checkParameter(name);
    if (index === 0) return 0;
    if (index + requiredArgs >= this.#arguments.length) return 0;
    return index;
  }

  /**
   * Check whether a parameter exists in the argument list.
   *
   * @param name - Parameter name to find (e.g., `"-devparm"`).
   */
  parameterExists(name: string): boolean {
    return this.checkParameter(name) !== 0;
  }

  /**
   * Get the value argument following a named parameter.
   *
   * In Doom's convention, `-skill 2` means the value `"2"` follows
   * the flag `-skill`.  Returns `null` if the parameter is not found
   * or if there is no argument after it.
   *
   * @param name - Parameter name whose value to retrieve.
   */
  getParameter(name: string): string | null {
    const index = this.checkParameter(name);
    if (index === 0) return null;
    const valueIndex = index + 1;
    if (valueIndex >= this.#arguments.length) return null;
    return this.#arguments[valueIndex]!;
  }

  /**
   * Collect all arguments following a parameter until the next
   * dash-prefixed flag or end of list.
   *
   * This handles Doom parameters like `-file` that accept multiple
   * trailing values (e.g., `-file foo.wad bar.wad`).
   *
   * @param name - Parameter name whose trailing values to collect.
   * @returns Frozen array of trailing values, empty if parameter is
   *   not found or has no trailing values.
   */
  getParameterValues(name: string): readonly string[] {
    const index = this.checkParameter(name);
    if (index === 0) return Object.freeze([]);
    const values: string[] = [];
    for (let cursor = index + 1; cursor < this.#arguments.length; cursor++) {
      const argument = this.#arguments[cursor]!;
      if (argument.startsWith('-')) break;
      values.push(argument);
    }
    return Object.freeze(values);
  }
}

/**
 * Create a {@link CommandLine} from the current process arguments.
 *
 * Uses `Bun.argv` which includes the runtime and script path as the
 * first entries.
 */
export function createFromProcessArgv(): CommandLine {
  return new CommandLine(Bun.argv);
}

/**
 * Create an empty {@link CommandLine} with only a program-name placeholder.
 *
 * This matches the reference run configuration where the IWAD is
 * auto-detected and no additional flags are passed.
 */
export function createEmpty(): CommandLine {
  return new CommandLine(['doom_codex']);
}
