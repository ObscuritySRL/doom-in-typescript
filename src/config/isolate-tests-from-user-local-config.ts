/**
 * Vanilla DOOM 1.9 config-test isolation contract.
 *
 * Chocolate Doom 2.2.1 m_config.c reads `default.cfg` and
 * `chocolate-doom.cfg` from `configDirectory` (the per-user save
 * directory: `%APPDATA%/Chocolate Doom/` on Windows,
 * `~/.local/share/chocolate-doom/` on Linux, `~/Library/Application
 * Support/Chocolate Doom/` on macOS). Those files contain the
 * developer's personal preferences and may include path strings
 * (player_name, window_position) that vary per machine.
 *
 * Test suites in this repository MUST NOT read those user-local files.
 * Doing so would: (1) couple tests to the developer's local state,
 * making CI/CD reproducibility impossible; (2) accidentally surface
 * `player_name = "stevp"` and other personal identifiers in test
 * fixtures; (3) destabilize the test suite when the developer toggles
 * a preference outside of testing.
 *
 * This module pins the test-isolation contract:
 *   - All config parsing tests build their input as in-memory strings
 *     (template literals or `parseVanillaDefaultCfg(content)`) rather
 *     than reading files.
 *   - The repository's `doom/default.cfg` and `doom/chocolate-doom.cfg`
 *     are committed reference fixtures used for byte-level
 *     verification of the parser/writer — they are NOT user-local
 *     state.
 *   - User-local paths (under home directories, APPDATA, XDG
 *     directories) are forbidden as test inputs.
 *
 * `assertConfigPathIsTestSafe` provides the runtime gate.
 */

export const FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS: readonly string[] = Object.freeze(['/AppData/', '\\AppData\\', '/.local/share/', '/.config/', '/Library/Application Support/', 'Chocolate Doom', '%APPDATA%', '%USERPROFILE%', '~/']);

export const REPOSITORY_REFERENCE_FIXTURE_PATHS: readonly string[] = Object.freeze(['doom/default.cfg', 'doom/chocolate-doom.cfg']);

export interface ConfigTestIsolationViolation {
  readonly path: string;
  readonly matchedFragment: string;
}

export function isUserLocalConfigPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.startsWith('doom/') || normalized.includes('/doom/default.cfg') || normalized.includes('/doom/chocolate-doom.cfg')) {
    return false;
  }
  for (const fragment of FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS) {
    if (path.includes(fragment)) {
      return true;
    }
  }
  return false;
}

export function detectConfigTestIsolationViolation(path: string): ConfigTestIsolationViolation | null {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.startsWith('doom/') || normalized.includes('/doom/default.cfg') || normalized.includes('/doom/chocolate-doom.cfg')) {
    return null;
  }
  for (const fragment of FORBIDDEN_USER_LOCAL_PATH_FRAGMENTS) {
    if (path.includes(fragment)) {
      return Object.freeze({ path, matchedFragment: fragment });
    }
  }
  return null;
}

export function assertConfigPathIsTestSafe(path: string): void {
  const violation = detectConfigTestIsolationViolation(path);
  if (violation !== null) {
    throw new Error(`config test isolation violation: path "${violation.path}" matches forbidden user-local fragment "${violation.matchedFragment}"`);
  }
}

export function buildInMemoryDefaultCfgFixture(overrides: Readonly<Record<string, number | string>> = {}): string {
  const baseLines: string[] = [];
  for (const [name, value] of Object.entries(overrides)) {
    const paddedName = name.padEnd(30, ' ');
    const formattedValue = typeof value === 'string' ? `"${value}"` : `${value}`;
    baseLines.push(`${paddedName} ${formattedValue}`);
  }
  return baseLines.length === 0 ? '' : baseLines.join('\n') + '\n';
}
