/**
 * Vanilla DOOM 1.9 save/load byte-parity acceptance gate.
 *
 * This is the second Phase 12 gate, combining every save-load-related
 * contract pinned by 12-010..12-026 into a single accept/reject
 * predicate. A green flip here satisfies the second of the two
 * Phase 12 prerequisites for the Phase 13 acceptance gates.
 *
 * Gate criteria:
 *
 *   1. Save directory policy (6 slots, doomsav%i.dsg naming,
 *      temp.dsg staging, per-platform configDirectory paths,
 *      0o755 directory mode).
 *   2. Save slot description encoding (SAVESTRINGSIZE=24, printable
 *      ASCII filter, NUL-padding, "EMPTY" menu label).
 *   3. Save header version magic ("version 109", 16-byte field,
 *      offset 24 in header).
 *   4. Player / mobj / thinker / sector-special / line-special
 *      serialization contracts pinned (player=280, mobj=154,
 *      side=10, line_base=6, tc_* enum 0..7).
 *   5. World archive section terminators (tc_end=0,
 *      tc_endspecials=7, SAVE_GAME_TERMINATOR=0x1d).
 *   6. SAVEGAMESIZE=0x2c000 buffer cap enforced with the exact
 *      "Savegame buffer overrun" I_Error string.
 *   7. G_DoLoadGame header byte layout (50 bytes total) and
 *      restoration order (P_UnArchive* sections then
 *      P_RestoreTargets then post-load subsystem resets).
 *   8. Version rejection silent-return behavior for non-109
 *      saves; "Bad savegame" / "Unknown tclass %i in savegame"
 *      I_Error strings on corruption.
 *   9. Byte-level reference oracle comparator (first-divergent-
 *      offset, length mismatch) and round-trip oracle (three
 *      variants: write-read-write, read-write-read,
 *      state-save-load-state).
 */

export type VanillaSaveLoadGateCheck =
  | 'save-directory-policy'
  | 'save-slot-descriptions'
  | 'save-header-version-magic'
  | 'player-mobj-thinker-record-sizes'
  | 'sector-and-line-special-classes'
  | 'archive-section-terminators'
  | 'savegamesize-buffer-cap'
  | 'load-header-layout-and-restoration-order'
  | 'incompatible-version-silent-return'
  | 'corruption-detection-error-strings'
  | 'reference-byte-oracle-comparator'
  | 'roundtrip-oracle-three-variants';

export const VANILLA_SAVE_LOAD_GATE_CHECKS: readonly VanillaSaveLoadGateCheck[] = Object.freeze([
  'save-directory-policy',
  'save-slot-descriptions',
  'save-header-version-magic',
  'player-mobj-thinker-record-sizes',
  'sector-and-line-special-classes',
  'archive-section-terminators',
  'savegamesize-buffer-cap',
  'load-header-layout-and-restoration-order',
  'incompatible-version-silent-return',
  'corruption-detection-error-strings',
  'reference-byte-oracle-comparator',
  'roundtrip-oracle-three-variants',
]);

export const VANILLA_SAVE_LOAD_GATE_CHECK_COUNT = VANILLA_SAVE_LOAD_GATE_CHECKS.length;

export const VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK: ReadonlyMap<string, VanillaSaveLoadGateCheck> = Object.freeze(
  new Map<string, VanillaSaveLoadGateCheck>([
    ['12-010', 'save-directory-policy'],
    ['12-011', 'save-slot-descriptions'],
    ['12-012', 'save-header-version-magic'],
    ['12-013', 'player-mobj-thinker-record-sizes'],
    ['12-014', 'player-mobj-thinker-record-sizes'],
    ['12-015', 'player-mobj-thinker-record-sizes'],
    ['12-016', 'sector-and-line-special-classes'],
    ['12-017', 'sector-and-line-special-classes'],
    ['12-018', 'archive-section-terminators'],
    ['12-019', 'savegamesize-buffer-cap'],
    ['12-020', 'load-header-layout-and-restoration-order'],
    ['12-021', 'incompatible-version-silent-return'],
    ['12-022', 'corruption-detection-error-strings'],
    ['12-023', 'load-header-layout-and-restoration-order'],
    ['12-024', 'load-header-layout-and-restoration-order'],
    ['12-025', 'reference-byte-oracle-comparator'],
    ['12-026', 'roundtrip-oracle-three-variants'],
  ]),
);

export function vanillaSaveLoadGateChecksSatisfied(passingCheckSet: ReadonlySet<VanillaSaveLoadGateCheck>): boolean {
  for (const check of VANILLA_SAVE_LOAD_GATE_CHECKS) {
    if (!passingCheckSet.has(check)) return false;
  }
  return true;
}

export function vanillaSaveLoadGateMissingChecks(passingCheckSet: ReadonlySet<VanillaSaveLoadGateCheck>): readonly VanillaSaveLoadGateCheck[] {
  const missing: VanillaSaveLoadGateCheck[] = [];
  for (const check of VANILLA_SAVE_LOAD_GATE_CHECKS) {
    if (!passingCheckSet.has(check)) missing.push(check);
  }
  return Object.freeze(missing);
}
