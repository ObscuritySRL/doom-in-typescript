/**
 * Vanilla DOOM 1.9 config load + persist runtime facade.
 *
 * Plan_final step `12-001` (lane: save-config-demo) aggregates the
 * `default.cfg` (vanilla 43-variable namespace) and
 * `chocolate-doom.cfg` (113-variable extended namespace) parse /
 * create / write-back / test-isolation entry points the launch
 * config path needs into one cohesive re-export barrel.  The
 * read-only `src/config/` modules already implement Chocolate Doom
 * 2.2.1 `m_config.c` `M_LoadDefaults` / `M_SaveDefaults` and the
 * disjoint-namespace invariant, and are SHA-pinned by the
 * `plan_vanilla_parity` save-and-config inventory; this module does
 * NOT modify them.
 *
 * Wired entry points and their Chocolate Doom 2.2.1 origins:
 *
 *   - `parseDefaultCfg` / `createDefaultVanillaCfg` — `m_config.c`
 *     `M_LoadDefaults` for the vanilla 43-var `default.cfg`.
 *   - `parseHostExtraCfg` / `createDefaultHostExtraCfg` — the
 *     113-var `chocolate-doom.cfg` extended namespace.
 *   - `writeVanillaDefaultCfg` — `m_config.c` `M_SaveDefaults`
 *     vanilla write-back (preserves the original serialization
 *     order + quoting).
 *   - `isUserLocalConfigPath` / `assertConfigPathIsTestSafe` /
 *     `buildInMemoryDefaultCfgFixture` — the test-isolation policy
 *     that prevents a test run from reading/writing the user's real
 *     config files.
 *
 * Precedence: `default.cfg` (vanilla) and `chocolate-doom.cfg`
 * (extended) are DISJOINT namespaces — no variable name appears in
 * both — so there is no precedence conflict; each file owns its own
 * variable set.
 *
 * @example
 * ```ts
 * import { parseDefaultCfg, VANILLA_CONFIG_ENTRY_POINTS } from './wireConfigLoadAndPersist.ts';
 * VANILLA_CONFIG_ENTRY_POINTS.length; // 7
 * ```
 */

export { createDefaultVanillaCfg, parseDefaultCfg } from '../config/defaultCfg.ts';
export { createDefaultHostExtraCfg, parseHostExtraCfg } from '../config/hostConfig.ts';
export { writeVanillaDefaultCfg } from '../config/write-config-back-in-vanilla-format.ts';
export { assertConfigPathIsTestSafe, buildInMemoryDefaultCfgFixture, isUserLocalConfigPath } from '../config/isolate-tests-from-user-local-config.ts';

/**
 * Frozen manifest of the seven canonical config load/persist
 * entry-point names this facade wires, in the order the launch
 * config path invokes them (assert the config path is test-safe,
 * parse default.cfg + chocolate-doom.cfg or fall back to the
 * hardcoded defaults, then write back the vanilla default.cfg on
 * exit).
 */
export const VANILLA_CONFIG_ENTRY_POINTS: readonly string[] = Object.freeze([
  'assertConfigPathIsTestSafe',
  'createDefaultHostExtraCfg',
  'createDefaultVanillaCfg',
  'isUserLocalConfigPath',
  'parseDefaultCfg',
  'parseHostExtraCfg',
  'writeVanillaDefaultCfg',
]);
