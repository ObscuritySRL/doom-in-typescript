/**
 * CLI smoke-test harness for doom_codex.
 *
 * Spawns Bun subprocesses and captures stdout, stderr, and exit code
 * in a structured result. Supports configurable timeouts, working
 * directories, and environment overrides.
 *
 * @example
 * ```ts
 * import { runCli } from "./cli.ts";
 * const result = await runCli(["--version"]);
 * expect(result.exitCode).toBe(0);
 * ```
 */

import { resolve } from 'node:path';

/** Root of the doom_codex package (two levels up from test/_harness/). */
const PACKAGE_ROOT = resolve(import.meta.dir, '..', '..');

/** Default timeout for CLI subprocess execution in milliseconds. */
const DEFAULT_TIMEOUT_MILLISECONDS = 10_000;

/** Structured result from a CLI subprocess run. */
export interface CliResult {
  /** Captured standard output as a UTF-8 string. */
  readonly stdout: string;
  /** Captured standard error as a UTF-8 string. */
  readonly stderr: string;
  /** Process exit code, or `null` if the process was killed by a signal. */
  readonly exitCode: number | null;
  /** `true` if the process was killed because it exceeded the timeout. */
  readonly timedOut: boolean;
}

/** Options for {@link runCli}. */
export interface CliRunOptions {
  /**
   * Script path to execute. Resolved relative to the doom_codex package root.
   * When omitted, the first element of `args` is treated as the script path.
   */
  readonly scriptPath?: string;
  /** Working directory for the subprocess. Defaults to the doom_codex package root. */
  readonly workingDirectory?: string;
  /** Maximum execution time in milliseconds before the process is killed. */
  readonly timeoutMilliseconds?: number;
  /** Additional environment variables merged on top of the current environment. */
  readonly environment?: Readonly<Record<string, string>>;
}

/**
 * Spawns a Bun subprocess and captures its output.
 *
 * @param args - Arguments passed to `bun run`. If `options.scriptPath` is
 *   provided, it is prepended to `args` as the script to execute.
 * @param options - Subprocess configuration.
 * @returns A promise that resolves to the captured {@link CliResult}.
 *
 * @example
 * ```ts
 * const result = await runCli(["-e", "console.log('hello')"]);
 * expect(result.stdout.trim()).toBe("hello");
 * ```
 */
export async function runCli(args: readonly string[], options: CliRunOptions = {}): Promise<CliResult> {
  const { scriptPath, workingDirectory = PACKAGE_ROOT, timeoutMilliseconds = DEFAULT_TIMEOUT_MILLISECONDS, environment } = options;

  const commandArgs = scriptPath ? [scriptPath, ...args] : [...args];

  const mergedEnvironment = environment ? { ...process.env, ...environment } : undefined;

  const subprocess = Bun.spawn(['bun', ...commandArgs], {
    cwd: workingDirectory,
    stdout: 'pipe',
    stderr: 'pipe',
    env: mergedEnvironment,
  });

  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    subprocess.kill();
  }, timeoutMilliseconds);

  try {
    const [stdout, stderr] = await Promise.all([new Response(subprocess.stdout).text(), new Response(subprocess.stderr).text()]);

    await subprocess.exited;

    return {
      stdout,
      stderr,
      exitCode: timedOut ? null : subprocess.exitCode,
      timedOut,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/** Returns the absolute path to the doom_codex package root. */
export function cliPackageRoot(): string {
  return PACKAGE_ROOT;
}

/** Returns the default timeout in milliseconds. */
export function cliDefaultTimeout(): number {
  return DEFAULT_TIMEOUT_MILLISECONDS;
}
