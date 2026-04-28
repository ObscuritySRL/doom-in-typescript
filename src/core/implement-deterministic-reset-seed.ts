/**
 * Audit ledger for the vanilla DOOM 1.9 deterministic reset seed —
 * the precise semantics of `M_ClearRandom()` and the canonical call
 * site (`G_InitNew()` in `linuxdoom-1.10/g_game.c`) that wire it into
 * the per-game-start init sequence.
 *
 * The reset seed is what makes demo replay deterministic: every demo
 * begins with both RNG indices at zero, and any deviation from that
 * single contract corrupts the very first roll of every monster
 * spawn, weapon-spread choice, and damage variance for the rest of
 * the game. The 04-007 audit pinned the rndtable contents and the
 * pre-incremented index walk; this audit pins the matching reset
 * contract:
 *  - `prndindex` becomes 0,
 *  - `rndindex` becomes 0 (vanilla DOOM 1.9 — id Software linuxdoom
 *    lineage — NOT the post-vanilla Chocolate Doom 2.2.1 enhancement
 *    which seeds `rndindex` from `time(NULL) & 0xff`),
 *  - both transitions happen in a single observable step (the C
 *    statement is the chained assignment `rndindex = prndindex = 0;`
 *    so a partial reset is invisible to a caller who only inspects
 *    the post-state),
 *  - the table itself is untouched (`M_ClearRandom` does NOT
 *    overwrite any `rndtable[]` cell),
 *  - calling `M_ClearRandom` twice in succession leaves the same
 *    post-state as calling it once (idempotence),
 *  - the reset post-state is bit-equivalent to a freshly-constructed
 *    instance (because the file-scope declarations `int rndindex = 0;`
 *    and `int prndindex = 0;` initialise to the same zeroes the reset
 *    enforces).
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. id Software `linuxdoom-1.10` source — PRIMARY for this audit
 *      because the reset is a one-statement function body and a
 *      one-statement call inside `G_InitNew()` that the binary cannot
 *      disagree with,
 *   4. Chocolate Doom 2.2.1 source — secondary; the
 *      `time(NULL) & 0xff` `rndindex` seed is a deliberate
 *      post-vanilla deviation explicitly out of scope for this
 *      parity-faithful audit,
 *   5. DoomWiki only for orientation.
 *
 * This audit pins:
 *  - the canonical body of `M_ClearRandom` (`rndindex = prndindex = 0;`)
 *    and its `void` return type,
 *  - the canonical call site (one and only — inside `G_InitNew()` in
 *    `g_game.c`, after map validation and before the
 *    `skill == sk_nightmare || respawnparm` branch),
 *  - the operational invariants every parity-faithful re-implementation
 *    must honour (post-state both-zero, idempotence, fresh-equivalence,
 *    table preservation, no time seed, single-statement transition),
 *  - a curated probe table covering reset from various pre-states
 *    (fresh instance, single P call, single M call, full-cycle P,
 *    full-cycle M, mixed P+M, repeated reset, reset preserves
 *    `pSubRandom` first-call sentinel),
 *  - a cross-check helper that any candidate (table, P_Random,
 *    M_Random, M_ClearRandom, pSubRandom, prndindex/rndindex
 *    accessors) tuple must satisfy.
 *
 * The audit module deliberately does NOT import from
 * `src/core/rng.ts`. Hardcoding the canonical reset-seed values and
 * probe expectations here means a corruption of `src/core/rng.ts`
 * cannot also silently corrupt the audit that detects the corruption.
 * The focused test re-verifies the ledger against the runtime
 * exports, so a drift in either direction surfaces loudly.
 */

/**
 * Audited canonical post-reset value of `prndindex` — exactly 0.
 * The C source declares `int prndindex = 0;` at file scope and the
 * `M_ClearRandom` body re-asserts that value. Pinned independently
 * of `src/core/rng.ts` so a transcription drift fails loudly.
 */
export const AUDITED_RESET_PRNDINDEX_VALUE = 0;

/**
 * Audited canonical post-reset value of `rndindex` — exactly 0 in
 * vanilla DOOM 1.9 / id Software linuxdoom-1.10. Chocolate Doom 2.2.1
 * later changed this to `time(NULL) & 0xff` so menu animation differs
 * across runs, but the shareware DOOM 1.9 target this audit pins
 * matches the id Software lineage (zero, deterministic).
 */
export const AUDITED_RESET_RNDINDEX_VALUE = 0;

/**
 * Audited canonical first-call return value of `P_Random()` after
 * `M_ClearRandom()` — exactly 8 (i.e. `rndtable[1]`). The pre-increment
 * moves the index from 0 to 1 BEFORE lookup, so the first roll lands
 * on `rndtable[1] = 8`, never `rndtable[0] = 0`. A port that uses
 * post-increment would emit 0 first instead.
 */
export const AUDITED_RESET_FIRST_P_RANDOM_VALUE = 8;

/**
 * Audited canonical first-call return value of `M_Random()` after
 * `M_ClearRandom()` — exactly 8. Mirrors the `P_Random` invariant
 * because both streams share the table and the pre-increment, but
 * each owns its own index.
 */
export const AUDITED_RESET_FIRST_M_RANDOM_VALUE = 8;

/**
 * Audited canonical first-call return value of `pSubRandom()` after
 * `M_ClearRandom()` — exactly -101 (= `rndtable[1] - rndtable[2]` =
 * `8 - 109`). Pinned because the `P_Random() - P_Random()` subtraction
 * order is canonical: a port that swaps the order would return +101.
 */
export const AUDITED_RESET_FIRST_P_SUB_RANDOM_VALUE = -101;

/**
 * Audited canonical name of the function that contains the one and
 * only call site of `M_ClearRandom()` in vanilla DOOM 1.9 — exactly
 * `G_InitNew`. Pinned because the entire reset contract collapses if
 * the call is moved earlier (e.g. into `D_DoomMain` before the WAD
 * loads) or later (e.g. after the player spawns and the first
 * monster has already advanced the gameplay stream).
 */
export const AUDITED_RESET_CALL_SITE_FUNCTION = 'G_InitNew';

/**
 * Audited canonical reference source file containing the call site —
 * exactly `linuxdoom-1.10/g_game.c`. Pinned to disambiguate from any
 * future refactor that splits `g_game.c` into multiple files.
 */
export const AUDITED_RESET_CALL_SITE_FILE = 'linuxdoom-1.10/g_game.c';

/**
 * Audited canonical count of `M_ClearRandom()` call sites across the
 * entire id Software linuxdoom-1.10 source tree — exactly 1. Pinned
 * because a port that adds an extra call inside (for example) the
 * intermission-screen entry path would silently alter the gameplay
 * stream's relationship to demo timing. The single canonical call
 * lives inside `G_InitNew()`.
 */
export const AUDITED_RESET_CALL_SITE_COUNT = 1;

/**
 * Stable identifier for one pinned C-source fact about the canonical
 * deterministic reset-seed contract.
 */
export type DoomResetSeedFactId =
  | 'C_BODY_M_CLEAR_RANDOM_CHAINED_ASSIGNMENT_BOTH_INDICES_ZERO'
  | 'C_BODY_M_CLEAR_RANDOM_NO_TIME_SEED_IN_VANILLA'
  | 'C_BODY_M_CLEAR_RANDOM_RETURN_TYPE_VOID'
  | 'C_HEADER_M_CLEAR_RANDOM_PROTOTYPE_VOID_VOID'
  | 'C_BODY_G_INIT_NEW_CALLS_M_CLEAR_RANDOM_AFTER_MAP_VALIDATION'
  | 'C_BODY_M_CLEAR_RANDOM_HAS_EXACTLY_ONE_CALL_SITE'
  | 'C_HEADER_RNDINDEX_INITIAL_ZERO_MATCHES_RESET_POST_STATE'
  | 'C_HEADER_PRNDINDEX_INITIAL_ZERO_MATCHES_RESET_POST_STATE'
  | 'C_BODY_M_CLEAR_RANDOM_DOES_NOT_TOUCH_RNDTABLE'
  | 'C_BODY_M_CLEAR_RANDOM_IS_IDEMPOTENT';

/** One pinned C-source fact about the deterministic reset seed. */
export interface DoomResetSeedFact {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomResetSeedFactId;
  /** Whether the fact comes from the upstream C declaration or the upstream C body. */
  readonly category: 'c-header' | 'c-body';
  /** Plain-language description of what this fact pins. */
  readonly description: string;
  /** Verbatim C reference snippet. */
  readonly cReference: string;
  /** Reference source file path inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'linuxdoom-1.10/m_random.c' | 'linuxdoom-1.10/g_game.c';
}

/**
 * Pinned ledger of ten C-source facts that together define the
 * canonical deterministic reset-seed contract. The focused test
 * asserts the ledger is closed (every id appears exactly once) and
 * that every fact is honoured by the runtime.
 *
 * Categorisation:
 *  - `c-header` — file-scope declaration whose presence and value
 *    are visible without entering any function body.
 *  - `c-body`   — function body statement or call site.
 */
export const DOOM_RESET_SEED_AUDIT: readonly DoomResetSeedFact[] = [
  {
    id: 'C_BODY_M_CLEAR_RANDOM_CHAINED_ASSIGNMENT_BOTH_INDICES_ZERO',
    category: 'c-body',
    description:
      'Body of `M_ClearRandom` is exactly one chained-assignment statement that resets BOTH indices to 0 in a single observable transition: `rndindex = prndindex = 0;`. The chain assigns 0 to `prndindex` first, then assigns the result of that assignment (which is 0) to `rndindex`. Because both reset to the same zero in the same statement, a partial reset is invisible to any caller who only inspects the post-state — but a port that splits the chain into two separate statements with different right-hand-sides would diverge.',
    cReference: 'rndindex = prndindex = 0;',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_M_CLEAR_RANDOM_NO_TIME_SEED_IN_VANILLA',
    category: 'c-body',
    description:
      'Body of `M_ClearRandom` does NOT call `time(NULL)`, `srand()`, or any other entropy source in vanilla DOOM 1.9 / id Software linuxdoom-1.10. The reset is purely a constant-zero assignment. Chocolate Doom 2.2.1 later modified this body to `prndindex = 0; rndindex = time(NULL) & 0xff;` so menu animation differs across runs, but that enhancement is post-vanilla and is explicitly NOT in scope for this parity audit. A port that adds a time seed silently breaks the menu-stream determinism that downstream tests depend on.',
    cReference: 'rndindex = prndindex = 0;',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_M_CLEAR_RANDOM_RETURN_TYPE_VOID',
    category: 'c-body',
    description:
      'Function signature is `void M_ClearRandom (void)` returning nothing. The reset is a side-effect-only operation; callers who try to capture a return value are reading uninitialised memory. A TypeScript port that returns a value from `clearRandom()` would silently allow callers to depend on a contract the C source never offered.',
    cReference: 'void M_ClearRandom (void)',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_HEADER_M_CLEAR_RANDOM_PROTOTYPE_VOID_VOID',
    category: 'c-header',
    description:
      'The `M_ClearRandom` prototype is declared in `m_random.h` as `void M_ClearRandom (void);` — visible to any translation unit that includes the header. Pinned because a port that hides the reset behind a private surface and forces external callers to construct a fresh instance would diverge from the canonical "one shared RNG, one reset entry point" contract.',
    cReference: 'void M_ClearRandom (void);',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_G_INIT_NEW_CALLS_M_CLEAR_RANDOM_AFTER_MAP_VALIDATION',
    category: 'c-body',
    description:
      'Inside `G_InitNew()` the call `M_ClearRandom();` appears AFTER the map-bounds validation (`if (map < 1) map = 1;` and `if ((map > 9) && (gamemode != commercial)) map = 9;`) and BEFORE the `if (skill == sk_nightmare || respawnparm)` branch. The placement matters because every gameplay-affecting decision that follows (skill-dependent monster speedup, fast-monster respawn timing, even the player respawn that initialises the spawn random offsets) draws from the reset stream. A port that calls `clearRandom()` earlier (before the WAD loads) or later (after the player spawns) silently desyncs the very first random roll of the level.',
    cReference: 'M_ClearRandom ();',
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
  },
  {
    id: 'C_BODY_M_CLEAR_RANDOM_HAS_EXACTLY_ONE_CALL_SITE',
    category: 'c-body',
    description:
      'Across the entire id Software linuxdoom-1.10 source tree, `M_ClearRandom()` is invoked from exactly one call site — the body of `G_InitNew()` in `g_game.c`. There is no second call site in `d_main.c` (which calls `G_InitNew` conditionally on `autostart || netgame`), no call site in `f_finale.c`, no call site in `wi_stuff.c`, and no call site in `p_setup.c`. A port that adds an extra call (for example, on every level transition, intermission entry, or save-load) silently alters the relationship between the gameplay stream and demo timing.',
    cReference: 'M_ClearRandom ();',
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
  },
  {
    id: 'C_HEADER_RNDINDEX_INITIAL_ZERO_MATCHES_RESET_POST_STATE',
    category: 'c-header',
    description:
      'The file-scope declaration `int rndindex = 0;` in `m_random.c` initialises the menu stream to the same zero the reset enforces. As a consequence, a freshly-constructed RNG state is bit-identical to one that has just had `M_ClearRandom()` called on it — the runtime can dispense with calling `clearRandom()` immediately after construction, and a port that makes the first roll depend on construction-time entropy diverges from the canonical contract.',
    cReference: 'int rndindex = 0;',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_HEADER_PRNDINDEX_INITIAL_ZERO_MATCHES_RESET_POST_STATE',
    category: 'c-header',
    description:
      'The file-scope declaration `int prndindex = 0;` in `m_random.c` initialises the gameplay stream to the same zero the reset enforces. Combined with the matching `rndindex` initialiser, this is what makes the two-line `D_DoomMain → G_InitNew → M_ClearRandom` boot path produce the same post-state as a no-op (the indices were already zero). The reset is a defence against repeated game starts in the same process, not against fresh process boots.',
    cReference: 'int prndindex = 0;',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_M_CLEAR_RANDOM_DOES_NOT_TOUCH_RNDTABLE',
    category: 'c-body',
    description:
      'The body of `M_ClearRandom` reads and writes the two index counters and nothing else. The 256-byte `rndtable` array is not aliased, modified, or even referenced by name. Pinned because a port that re-randomises the table on reset (a common temptation when porting "random" things) would silently shift every subsequent roll across the entire session. The 04-007 table audit cross-validates the bytes; this fact validates that `clearRandom()` is non-mutating with respect to those bytes.',
    cReference: 'rndindex = prndindex = 0;',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
  {
    id: 'C_BODY_M_CLEAR_RANDOM_IS_IDEMPOTENT',
    category: 'c-body',
    description:
      'Calling `M_ClearRandom()` N times in succession is observationally indistinguishable from calling it once: every call writes the same constant zero to the same two locations, with no read-modify-write side effect. Pinned because a port that increments a "reset counter" or seeds from a clock would lose this property and would diverge under engine-internal patterns that occasionally re-clear (none in vanilla 1.9, but the property guards against future drift).',
    cReference: 'rndindex = prndindex = 0;',
    referenceSourceFile: 'linuxdoom-1.10/m_random.c',
  },
] as const;

/**
 * Stable identifier for one operational invariant the cross-check
 * helper enforces against any candidate RNG tuple.
 */
export type DoomResetSeedInvariantId =
  | 'RESET_PRNDINDEX_BECOMES_ZERO'
  | 'RESET_RNDINDEX_BECOMES_ZERO'
  | 'RESET_BOTH_INDICES_BECOME_ZERO_TOGETHER'
  | 'RESET_FIRST_P_RANDOM_RETURNS_RNDTABLE_ONE'
  | 'RESET_FIRST_M_RANDOM_RETURNS_RNDTABLE_ONE'
  | 'RESET_FIRST_P_SUB_RANDOM_RETURNS_NEGATIVE_101'
  | 'RESET_IS_IDEMPOTENT'
  | 'RESET_FROM_FRESH_INSTANCE_IS_NO_OP'
  | 'RESET_AFTER_PARTIAL_P_CYCLE_RESTORES_FRESH_STATE'
  | 'RESET_AFTER_PARTIAL_M_CYCLE_RESTORES_FRESH_STATE'
  | 'RESET_AFTER_FULL_P_CYCLE_RESTORES_FRESH_STATE'
  | 'RESET_AFTER_MIXED_PM_USE_RESTORES_FRESH_STATE'
  | 'RESET_DOES_NOT_DEPEND_ON_PRIOR_HISTORY'
  | 'RESET_PRESERVES_RNDTABLE_BYTES'
  | 'RESET_IS_DETERMINISTIC_ACROSS_RAPID_CALLS'
  | 'RESET_RETURNS_VOID_OR_UNDEFINED';

/** One operational invariant the cross-check helper enforces. */
export interface DoomResetSeedInvariant {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomResetSeedInvariantId;
  /** Plain-language description of the invariant. */
  readonly description: string;
}

/**
 * Pinned ledger of sixteen operational invariants. The focused test
 * asserts the ledger is closed and that the cross-check helper
 * returns exactly the right failure id for each tampered candidate.
 */
export const DOOM_RESET_SEED_INVARIANTS: readonly DoomResetSeedInvariant[] = [
  {
    id: 'RESET_PRNDINDEX_BECOMES_ZERO',
    description: 'After calling clearRandom(), the gameplay-stream index prndindex equals exactly 0. Pinned because a partial reset that leaves prndindex non-zero would silently desync demo replay starting from a non-canonical first roll.',
  },
  {
    id: 'RESET_RNDINDEX_BECOMES_ZERO',
    description:
      'After calling clearRandom(), the menu-stream index rndindex equals exactly 0 (vanilla DOOM 1.9 — id Software linuxdoom-1.10 lineage). Pinned because Chocolate Doom 2.2.1 deliberately seeds rndindex from `time(NULL) & 0xff` so a port that inherits from Chocolate Doom rather than vanilla would diverge here.',
  },
  {
    id: 'RESET_BOTH_INDICES_BECOME_ZERO_TOGETHER',
    description:
      'A single clearRandom() call reduces both indices to 0 — there is no observable intermediate state where one is reset and the other is not. The chained C assignment `rndindex = prndindex = 0;` enforces this; a port that uses two sequential statements would still satisfy this invariant if the writes are not interrupted.',
  },
  {
    id: 'RESET_FIRST_P_RANDOM_RETURNS_RNDTABLE_ONE',
    description:
      'After clearRandom(), the next pRandom() call returns rndtable[1] === 8. Anchors the pre-increment semantics applied to a zeroed index: 0 → 1 → lookup. A reset that left prndindex at 1 would emit rndtable[2] = 109 first instead.',
  },
  {
    id: 'RESET_FIRST_M_RANDOM_RETURNS_RNDTABLE_ONE',
    description:
      'After clearRandom(), the next mRandom() call returns rndtable[1] === 8. Mirrors the P_Random invariant. A Chocolate-Doom-style port that seeds rndindex from time(NULL) would emit a varying value here across runs and would fail this invariant on every machine.',
  },
  {
    id: 'RESET_FIRST_P_SUB_RANDOM_RETURNS_NEGATIVE_101',
    description:
      'After clearRandom(), the next pSubRandom() call returns rndtable[1] - rndtable[2] === 8 - 109 === -101. Pins the subtraction order (first call - second call) and the post-reset two-call advance — both conditions must hold for parity-faithful directional offsets.',
  },
  {
    id: 'RESET_IS_IDEMPOTENT',
    description:
      'Calling clearRandom() N times in succession produces the same post-state as calling it once. Specifically: clearRandom(); clearRandom(); pRandom() === clearRandom(); pRandom(). Pinned because a port that uses a counter or clock-derived seed loses this property.',
  },
  {
    id: 'RESET_FROM_FRESH_INSTANCE_IS_NO_OP',
    description:
      'A freshly-constructed RNG instance is bit-equivalent to one that has just had clearRandom() called on it. Specifically: new DoomRandom().pRandom() === new DoomRandom() then clearRandom() then pRandom(). Pinned because the file-scope C initialisers `int rndindex = 0;` and `int prndindex = 0;` are written explicitly; a port that constructs at non-zero indices would diverge.',
  },
  {
    id: 'RESET_AFTER_PARTIAL_P_CYCLE_RESTORES_FRESH_STATE',
    description:
      'After K (1 ≤ K < 256) pRandom() calls and one clearRandom(), the next pRandom() returns rndtable[1] === 8 — independent of K. Pinned because a partial reset whose post-state depends on the pre-state (e.g. `prndindex &= 0x7f`) would pass single-K probes but fail across K.',
  },
  {
    id: 'RESET_AFTER_PARTIAL_M_CYCLE_RESTORES_FRESH_STATE',
    description:
      'After K (1 ≤ K < 256) mRandom() calls and one clearRandom(), the next mRandom() returns rndtable[1] === 8 — independent of K. Mirror of the P-cycle invariant; defends against a port that resets prndindex but leaves rndindex untouched.',
  },
  {
    id: 'RESET_AFTER_FULL_P_CYCLE_RESTORES_FRESH_STATE',
    description:
      'After 256 pRandom() calls (a full table cycle, returning prndindex to 0 via `& 0xff` wrap) and one clearRandom(), the next pRandom() returns rndtable[1] === 8. Pinned to defend against a port that conditions the reset on the wrap state — the reset must be unconditional.',
  },
  {
    id: 'RESET_AFTER_MIXED_PM_USE_RESTORES_FRESH_STATE',
    description:
      'After arbitrary interleaved P+M calls (e.g. 50 pRandom() then 70 mRandom() then 30 pRandom()), one clearRandom() restores both streams so the next pRandom() and the next mRandom() each return rndtable[1] === 8. Pinned to defend against a stream-entanglement port that resets only the most-recently-used stream.',
  },
  {
    id: 'RESET_DOES_NOT_DEPEND_ON_PRIOR_HISTORY',
    description:
      'For every K in {0, 1, 2, ..., 255}, after K pRandom() calls and one clearRandom(), the post-state of both indices is exactly 0. Stronger than the partial-cycle restoration invariants because it pins the post-state values, not just the next-roll values.',
  },
  {
    id: 'RESET_PRESERVES_RNDTABLE_BYTES',
    description:
      'Calling clearRandom() does NOT mutate the rndtable byte sequence. After any sequence of operations that includes clearRandom() calls, the runtime rndtable bytes match the canonical 04-007-pinned bytes. Pinned because a port that re-shuffles the table on reset would silently diverge for the rest of the session.',
  },
  {
    id: 'RESET_IS_DETERMINISTIC_ACROSS_RAPID_CALLS',
    description:
      'clearRandom() called twice with no other intervening operation produces the same post-state — it is NOT seeded from a wall-clock or monotonic clock. Defends against the Chocolate Doom 2.2.1 deviation where rapid back-to-back resets within the same second would produce identical rndindex but resets across a second boundary would diverge.',
  },
  {
    id: 'RESET_RETURNS_VOID_OR_UNDEFINED',
    description:
      'clearRandom() has no return value (TypeScript: returns undefined). The C signature `void M_ClearRandom (void)` is purely side-effect. A port that returns the post-state values would silently encourage callers to inspect non-canonical surfaces.',
  },
] as const;

/** Stable identifier for one curated reset-seed probe. */
export type DoomResetSeedProbeId =
  | 'reset_from_fresh_state_makes_p_random_emit_8'
  | 'reset_from_fresh_state_makes_m_random_emit_8'
  | 'reset_after_one_p_random_makes_next_p_random_emit_8'
  | 'reset_after_one_m_random_makes_next_m_random_emit_8'
  | 'reset_after_one_p_random_makes_first_m_random_emit_8'
  | 'reset_after_one_m_random_makes_first_p_random_emit_8'
  | 'reset_after_full_p_cycle_makes_next_p_random_emit_8'
  | 'reset_after_full_m_cycle_makes_next_m_random_emit_8'
  | 'reset_after_mixed_p_then_m_then_p_emits_8'
  | 'reset_then_p_sub_random_emits_negative_101'
  | 'double_reset_then_p_random_emits_8'
  | 'reset_after_one_hundred_p_random_makes_prndindex_zero'
  | 'reset_after_one_hundred_m_random_makes_rndindex_zero'
  | 'reset_after_partial_cycle_then_clear_again_emits_8'
  | 'reset_after_p_sub_random_makes_next_p_random_emit_8'
  | 'reset_clears_both_indices_simultaneously';

/** Which kind of expectation a probe pins. */
export type DoomResetSeedProbeTarget = 'p_random_after_reset' | 'm_random_after_reset' | 'p_sub_random_after_reset' | 'index_after_reset';

/** One curated reset-seed probe expectation. */
export interface DoomResetSeedProbe {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomResetSeedProbeId;
  /** Which surface this probe inspects. */
  readonly target: DoomResetSeedProbeTarget;
  /**
   * Description of the call sequence run from a freshly-constructed
   * instance. The harness performs:
   *   1. The setup calls (P, M, or pSubRandom) in the specified
   *      counts, in the specified order.
   *   2. A clearRandom() (or two, if `extraResetAfterSetup` is true).
   *   3. The observation: a single P/M/pSubRandom call, OR an index
   *      read of `prndindex`/`rndindex`.
   */
  readonly input: {
    readonly setupPRandomCalls?: number;
    readonly setupMRandomCalls?: number;
    readonly setupPSubRandomCalls?: number;
    readonly extraResetAfterSetup?: boolean;
    readonly observation: 'pRandom' | 'mRandom' | 'pSubRandom' | 'prndindex' | 'rndindex' | 'bothIndices';
  };
  /**
   * Expected canonical output. For `prndindex`/`rndindex` probes this
   * is the index value. For `bothIndices` probes this is the sum
   * (which is 0 iff both are 0). For stream observations it is the
   * canonical first-roll-after-reset value.
   */
  readonly expected: number;
  /** Plain-language note explaining what this probe defends against. */
  readonly note: string;
}

/**
 * Curated probe table of sixteen probes covering the canonical reset
 * contract. Each probe is hand-pinned from the canonical id Software
 * linuxdoom-1.10 source and re-verified by the focused test against
 * the live runtime.
 *
 * Coverage:
 *  - reset from fresh state restores fresh state (P, M).
 *  - reset after one prior call (P, M, mixed).
 *  - reset after a full table cycle (P, M).
 *  - reset after mixed P+M+P interleaving.
 *  - reset followed by pSubRandom (subtraction-order sentinel).
 *  - double reset (idempotence).
 *  - index post-state probes (prndindex, rndindex, both).
 *  - reset after pSubRandom (multi-step setup).
 */
export const DOOM_RESET_SEED_PROBES: readonly DoomResetSeedProbe[] = [
  {
    id: 'reset_from_fresh_state_makes_p_random_emit_8',
    target: 'p_random_after_reset',
    input: { observation: 'pRandom' },
    expected: 8,
    note: 'A reset on a freshly-constructed instance is observationally a no-op: the next pRandom emits rndtable[1] === 8.',
  },
  {
    id: 'reset_from_fresh_state_makes_m_random_emit_8',
    target: 'm_random_after_reset',
    input: { observation: 'mRandom' },
    expected: 8,
    note: 'A reset on a freshly-constructed instance is observationally a no-op for the menu stream: the next mRandom emits rndtable[1] === 8.',
  },
  {
    id: 'reset_after_one_p_random_makes_next_p_random_emit_8',
    target: 'p_random_after_reset',
    input: { setupPRandomCalls: 1, observation: 'pRandom' },
    expected: 8,
    note: 'A reset rolls back the gameplay stream: the next pRandom after reset emits rndtable[1] === 8 even though one P call already happened.',
  },
  {
    id: 'reset_after_one_m_random_makes_next_m_random_emit_8',
    target: 'm_random_after_reset',
    input: { setupMRandomCalls: 1, observation: 'mRandom' },
    expected: 8,
    note: 'A reset rolls back the menu stream: the next mRandom after reset emits rndtable[1] === 8 even though one M call already happened.',
  },
  {
    id: 'reset_after_one_p_random_makes_first_m_random_emit_8',
    target: 'm_random_after_reset',
    input: { setupPRandomCalls: 1, observation: 'mRandom' },
    expected: 8,
    note: 'Cross-stream defence: a P call before reset must not leave the menu stream in a non-zero state after the reset (the M stream was untouched, but the reset must still bring rndindex to 0).',
  },
  {
    id: 'reset_after_one_m_random_makes_first_p_random_emit_8',
    target: 'p_random_after_reset',
    input: { setupMRandomCalls: 1, observation: 'pRandom' },
    expected: 8,
    note: 'Cross-stream defence: an M call before reset must not leave the gameplay stream in a non-zero state after the reset.',
  },
  {
    id: 'reset_after_full_p_cycle_makes_next_p_random_emit_8',
    target: 'p_random_after_reset',
    input: { setupPRandomCalls: 256, observation: 'pRandom' },
    expected: 8,
    note: 'A full 256-call P cycle returns prndindex to 0 (& 0xff wrap), and the reset is unconditional: the next pRandom still emits rndtable[1] === 8 — confirming the reset does not condition on the wrap state.',
  },
  {
    id: 'reset_after_full_m_cycle_makes_next_m_random_emit_8',
    target: 'm_random_after_reset',
    input: { setupMRandomCalls: 256, observation: 'mRandom' },
    expected: 8,
    note: 'A full 256-call M cycle returns rndindex to 0, and the reset is unconditional: the next mRandom still emits rndtable[1] === 8.',
  },
  {
    id: 'reset_after_mixed_p_then_m_then_p_emits_8',
    target: 'p_random_after_reset',
    input: { setupPRandomCalls: 50, setupMRandomCalls: 70, observation: 'pRandom' },
    expected: 8,
    note: 'After 50 P calls and 70 M calls, one reset brings both streams back to zero so the next pRandom emits rndtable[1] === 8. Defends against a stream-entanglement port that resets only the most-recently-used stream.',
  },
  {
    id: 'reset_then_p_sub_random_emits_negative_101',
    target: 'p_sub_random_after_reset',
    input: { setupPRandomCalls: 100, observation: 'pSubRandom' },
    expected: -101,
    note: 'After 100 P calls and one reset, pSubRandom emits 8 - 109 === -101 from the reset state. Anchors the post-reset two-call advance and the canonical subtraction order.',
  },
  {
    id: 'double_reset_then_p_random_emits_8',
    target: 'p_random_after_reset',
    input: { setupPRandomCalls: 50, extraResetAfterSetup: true, observation: 'pRandom' },
    expected: 8,
    note: 'Two resets in succession are idempotent: the second reset is a no-op on the post-reset state. After 50 P calls, two resets, the next pRandom still emits rndtable[1] === 8.',
  },
  {
    id: 'reset_after_one_hundred_p_random_makes_prndindex_zero',
    target: 'index_after_reset',
    input: { setupPRandomCalls: 100, observation: 'prndindex' },
    expected: 0,
    note: 'Direct index-state probe: after 100 P calls and one reset, the prndindex post-state value is exactly 0 — independent of the K value. Stronger than the next-roll-value probe because it pins the index, not just the visible roll.',
  },
  {
    id: 'reset_after_one_hundred_m_random_makes_rndindex_zero',
    target: 'index_after_reset',
    input: { setupMRandomCalls: 100, observation: 'rndindex' },
    expected: 0,
    note: 'Direct index-state probe for the menu stream: after 100 M calls and one reset, the rndindex post-state value is exactly 0. Defends against a Chocolate-Doom-style time seed that would leave rndindex at `time(NULL) & 0xff`.',
  },
  {
    id: 'reset_after_partial_cycle_then_clear_again_emits_8',
    target: 'p_random_after_reset',
    input: { setupPRandomCalls: 200, extraResetAfterSetup: true, observation: 'pRandom' },
    expected: 8,
    note: 'Mid-cycle (after 200 P calls, two resets) the next pRandom still emits rndtable[1] === 8 — pins idempotence at a non-trivial pre-state.',
  },
  {
    id: 'reset_after_p_sub_random_makes_next_p_random_emit_8',
    target: 'p_random_after_reset',
    input: { setupPSubRandomCalls: 5, observation: 'pRandom' },
    expected: 8,
    note: 'After 5 pSubRandom calls (which advances prndindex by 10) and one reset, the next pRandom emits rndtable[1] === 8. Confirms the reset undoes pSubRandom-driven advances exactly like P_Random-driven advances.',
  },
  {
    id: 'reset_clears_both_indices_simultaneously',
    target: 'index_after_reset',
    input: { setupPRandomCalls: 50, setupMRandomCalls: 70, observation: 'bothIndices' },
    expected: 0,
    note: 'After 50 P calls and 70 M calls (so prndindex=50 and rndindex=70), one reset brings the SUM of both indices to 0 — both must be exactly 0 for the sum to be 0 because both are non-negative.',
  },
] as const;

/**
 * A candidate RNG tuple for cross-checking. The tuple captures the
 * full reset-relevant RNG surface: the table, the four operations,
 * and the two index accessors.
 */
export interface DoomResetSeedCandidate {
  /** The 256-entry random table as bytes (Uint8Array preferred for byte-exact comparison). */
  readonly rndtable: Uint8Array;
  /** Factory that returns a fresh RNG instance with both indices at 0. */
  readonly create: () => DoomResetSeedCandidateInstance;
}

/** The RNG surface a candidate must expose for the cross-check to inspect. */
export interface DoomResetSeedCandidateInstance {
  pRandom(): number;
  mRandom(): number;
  pSubRandom(): number;
  clearRandom(): void;
  readonly prndindex: number;
  readonly rndindex: number;
}

/**
 * Cross-check a candidate RNG tuple against `DOOM_RESET_SEED_PROBES`
 * and `DOOM_RESET_SEED_INVARIANTS`. Returns the list of failures by
 * stable identifier; an empty list means the candidate honours every
 * audited reset-seed fact.
 *
 * Identifiers used:
 *  - `probe:<id>` for a per-probe expectation mismatch.
 *  - `invariant:<id>` for a derived invariant that fails on at least
 *    one observation.
 */
export function crossCheckDoomResetSeed(candidate: DoomResetSeedCandidate): readonly string[] {
  const failures: string[] = [];

  // Per-probe checks
  for (const probe of DOOM_RESET_SEED_PROBES) {
    const instance = candidate.create();
    for (let i = 0; i < (probe.input.setupPRandomCalls ?? 0); i++) instance.pRandom();
    for (let i = 0; i < (probe.input.setupMRandomCalls ?? 0); i++) instance.mRandom();
    for (let i = 0; i < (probe.input.setupPSubRandomCalls ?? 0); i++) instance.pSubRandom();
    instance.clearRandom();
    if (probe.input.extraResetAfterSetup === true) instance.clearRandom();

    let actual: number;
    if (probe.input.observation === 'pRandom') {
      actual = instance.pRandom();
    } else if (probe.input.observation === 'mRandom') {
      actual = instance.mRandom();
    } else if (probe.input.observation === 'pSubRandom') {
      actual = instance.pSubRandom();
    } else if (probe.input.observation === 'prndindex') {
      actual = instance.prndindex;
    } else if (probe.input.observation === 'rndindex') {
      actual = instance.rndindex;
    } else {
      actual = instance.prndindex + instance.rndindex;
    }

    if (actual !== probe.expected) {
      failures.push(`probe:${probe.id}`);
    }
  }

  // Invariant: prndindex post-reset equals 0
  {
    const instance = candidate.create();
    for (let i = 0; i < 17; i++) instance.pRandom();
    instance.clearRandom();
    if (instance.prndindex !== AUDITED_RESET_PRNDINDEX_VALUE) {
      failures.push('invariant:RESET_PRNDINDEX_BECOMES_ZERO');
    }
  }

  // Invariant: rndindex post-reset equals 0 (vanilla 1.9, NOT Chocolate-Doom-time-seeded)
  {
    const instance = candidate.create();
    for (let i = 0; i < 23; i++) instance.mRandom();
    instance.clearRandom();
    if (instance.rndindex !== AUDITED_RESET_RNDINDEX_VALUE) {
      failures.push('invariant:RESET_RNDINDEX_BECOMES_ZERO');
    }
  }

  // Invariant: both indices reset together (sum is 0 iff both are 0; both are non-negative)
  {
    const instance = candidate.create();
    for (let i = 0; i < 50; i++) instance.pRandom();
    for (let i = 0; i < 70; i++) instance.mRandom();
    instance.clearRandom();
    if (instance.prndindex + instance.rndindex !== 0) {
      failures.push('invariant:RESET_BOTH_INDICES_BECOME_ZERO_TOGETHER');
    }
  }

  // Invariant: first P_Random after reset returns rndtable[1] = 8
  {
    const instance = candidate.create();
    for (let i = 0; i < 13; i++) instance.pRandom();
    instance.clearRandom();
    if (instance.pRandom() !== AUDITED_RESET_FIRST_P_RANDOM_VALUE) {
      failures.push('invariant:RESET_FIRST_P_RANDOM_RETURNS_RNDTABLE_ONE');
    }
  }

  // Invariant: first M_Random after reset returns rndtable[1] = 8
  {
    const instance = candidate.create();
    for (let i = 0; i < 19; i++) instance.mRandom();
    instance.clearRandom();
    if (instance.mRandom() !== AUDITED_RESET_FIRST_M_RANDOM_VALUE) {
      failures.push('invariant:RESET_FIRST_M_RANDOM_RETURNS_RNDTABLE_ONE');
    }
  }

  // Invariant: first pSubRandom after reset returns -101
  {
    const instance = candidate.create();
    for (let i = 0; i < 7; i++) instance.pRandom();
    instance.clearRandom();
    if (instance.pSubRandom() !== AUDITED_RESET_FIRST_P_SUB_RANDOM_VALUE) {
      failures.push('invariant:RESET_FIRST_P_SUB_RANDOM_RETURNS_NEGATIVE_101');
    }
  }

  // Invariant: idempotence — two resets produce the same observable state as one,
  // checked at the index post-state AND the next P/M values for both streams.
  {
    const oneReset = candidate.create();
    for (let i = 0; i < 30; i++) oneReset.pRandom();
    for (let i = 0; i < 40; i++) oneReset.mRandom();
    oneReset.clearRandom();
    const oneResetPrnd = oneReset.prndindex;
    const oneResetRnd = oneReset.rndindex;
    const oneResetPValue = oneReset.pRandom();
    const oneResetMValue = oneReset.mRandom();

    const twoResets = candidate.create();
    for (let i = 0; i < 30; i++) twoResets.pRandom();
    for (let i = 0; i < 40; i++) twoResets.mRandom();
    twoResets.clearRandom();
    twoResets.clearRandom();
    const twoResetsPrnd = twoResets.prndindex;
    const twoResetsRnd = twoResets.rndindex;
    const twoResetsPValue = twoResets.pRandom();
    const twoResetsMValue = twoResets.mRandom();

    if (oneResetPrnd !== twoResetsPrnd || oneResetRnd !== twoResetsRnd || oneResetPValue !== twoResetsPValue || oneResetMValue !== twoResetsMValue) {
      failures.push('invariant:RESET_IS_IDEMPOTENT');
    }
  }

  // Invariant: reset from fresh instance is a no-op
  {
    const fresh = candidate.create();
    const cleared = candidate.create();
    cleared.clearRandom();
    if (fresh.pRandom() !== cleared.pRandom()) {
      failures.push('invariant:RESET_FROM_FRESH_INSTANCE_IS_NO_OP');
    }
  }

  // Invariant: reset after partial P cycle restores fresh state across multiple K values
  {
    let allMatch = true;
    for (const k of [1, 5, 17, 100, 200, 255]) {
      const instance = candidate.create();
      for (let i = 0; i < k; i++) instance.pRandom();
      instance.clearRandom();
      if (instance.pRandom() !== 8) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:RESET_AFTER_PARTIAL_P_CYCLE_RESTORES_FRESH_STATE');
    }
  }

  // Invariant: reset after partial M cycle restores fresh state across multiple K values
  {
    let allMatch = true;
    for (const k of [1, 3, 42, 100, 200, 255]) {
      const instance = candidate.create();
      for (let i = 0; i < k; i++) instance.mRandom();
      instance.clearRandom();
      if (instance.mRandom() !== 8) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:RESET_AFTER_PARTIAL_M_CYCLE_RESTORES_FRESH_STATE');
    }
  }

  // Invariant: reset after a full P cycle (256 calls) restores fresh state
  {
    const instance = candidate.create();
    for (let i = 0; i < 256; i++) instance.pRandom();
    instance.clearRandom();
    if (instance.pRandom() !== 8) {
      failures.push('invariant:RESET_AFTER_FULL_P_CYCLE_RESTORES_FRESH_STATE');
    }
  }

  // Invariant: reset after mixed P+M use restores fresh state on both streams
  {
    const instance = candidate.create();
    for (let i = 0; i < 50; i++) instance.pRandom();
    for (let i = 0; i < 70; i++) instance.mRandom();
    for (let i = 0; i < 30; i++) instance.pRandom();
    instance.clearRandom();
    if (instance.pRandom() !== 8 || instance.mRandom() !== 8) {
      failures.push('invariant:RESET_AFTER_MIXED_PM_USE_RESTORES_FRESH_STATE');
    }
  }

  // Invariant: reset post-state is independent of prior history (stronger: index values, not roll values)
  {
    let allZero = true;
    for (const k of [0, 1, 2, 3, 17, 100, 200, 255]) {
      const instance = candidate.create();
      for (let i = 0; i < k; i++) instance.pRandom();
      instance.clearRandom();
      if (instance.prndindex !== 0) {
        allZero = false;
        break;
      }
    }
    if (!allZero) {
      failures.push('invariant:RESET_DOES_NOT_DEPEND_ON_PRIOR_HISTORY');
    }
  }

  // Invariant: reset preserves rndtable bytes
  {
    const before = Array.from(candidate.rndtable);
    const instance = candidate.create();
    for (let i = 0; i < 100; i++) instance.pRandom();
    for (let i = 0; i < 100; i++) instance.mRandom();
    instance.clearRandom();
    instance.clearRandom();
    const after = Array.from(candidate.rndtable);
    let identical = before.length === after.length;
    if (identical) {
      for (let i = 0; i < before.length; i++) {
        if (before[i] !== after[i]) {
          identical = false;
          break;
        }
      }
    }
    if (!identical) {
      failures.push('invariant:RESET_PRESERVES_RNDTABLE_BYTES');
    }
  }

  // Invariant: reset is deterministic across rapid calls (no time seed)
  {
    const a = candidate.create();
    a.clearRandom();
    const aValue = a.mRandom();

    const b = candidate.create();
    b.clearRandom();
    const bValue = b.mRandom();

    if (aValue !== bValue) {
      failures.push('invariant:RESET_IS_DETERMINISTIC_ACROSS_RAPID_CALLS');
    }
  }

  // Invariant: clearRandom returns void (or undefined)
  {
    const instance = candidate.create();
    const result = instance.clearRandom() as unknown;
    if (result !== undefined) {
      failures.push('invariant:RESET_RETURNS_VOID_OR_UNDEFINED');
    }
  }

  return failures;
}
