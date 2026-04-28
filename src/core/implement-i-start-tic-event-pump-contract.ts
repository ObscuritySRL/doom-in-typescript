/**
 * Audit ledger for the vanilla DOOM 1.9 I_StartTic event pump
 * contract — the host-side event drain that runs once per newtic
 * inside the canonical NetUpdate body pinned by 04-011, the global
 * `events[MAXEVENTS]` circular buffer it feeds via `D_PostEvent`,
 * and the matching `D_ProcessEvents` consumer that drains the buffer
 * and dispatches each event through `M_Responder` → `G_Responder`.
 *
 * The 04-011 audit pinned the per-newtic NetUpdate ordering as
 * `I_StartTic (); D_ProcessEvents (); G_BuildTiccmd (...);`. This
 * audit pins the body-level contract behind that surface:
 *  - `I_StartTic` is the host-OS event-pump entry point in
 *    `linuxdoom-1.10/i_video.c` (X11 in vanilla, SDL in Chocolate
 *    Doom 2.2.1). Its body drains pending host events and translates
 *    each into a Doom `event_t` posted via `D_PostEvent`. It does
 *    NOT directly invoke `M_Responder` / `G_Responder` — those run
 *    later inside `D_ProcessEvents`.
 *  - `events[MAXEVENTS]` is a circular buffer in
 *    `linuxdoom-1.10/d_main.c` (vanilla) and
 *    `chocolate-doom-2.2.1/src/d_event.c` (Chocolate) with
 *    `MAXEVENTS == 64` from `linuxdoom-1.10/d_event.h`. The depth
 *    must be a power of two so the canonical wrap formula
 *    `eventhead = (++eventhead)&(MAXEVENTS-1)` works as the
 *    bitwise-mask equivalent of `% MAXEVENTS`.
 *  - `D_PostEvent (event_t* ev)` stores the event at `eventhead`
 *    then advances `eventhead` (mod `MAXEVENTS`). It does NOT call
 *    any responder; it is strictly an enqueue surface.
 *  - `D_ProcessEvents (void)` drains the queue in FIFO order via
 *    `for (; eventtail != eventhead ; eventtail = (++eventtail)&
 *    (MAXEVENTS-1))` (vanilla) or `while ((ev = D_PopEvent()) !=
 *    NULL)` (Chocolate). For each drained event it calls
 *    `M_Responder(ev)`; if `M_Responder` returns true ("menu ate
 *    the event") the dispatcher emits `continue` to skip
 *    `G_Responder`; otherwise it calls `G_Responder(ev)`.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source — PRIMARY for this audit
 *      because the buffer-depth constant, the dispatch order, and
 *      the "menu ate the event" `continue` pattern are textual
 *      properties of `d_event.h` and `d_main.c` that DOSBox cannot
 *      disagree with,
 *   5. Chocolate Doom 2.2.1 source — secondary; preserves the
 *      canonical depth, dispatch order, and FIFO drain but refactors
 *      the queue into a file-private `static` block in
 *      `src/d_event.c` and exposes `D_PopEvent` so `D_ProcessEvents`
 *      can drain via `while ((ev = D_PopEvent()) != NULL)` instead
 *      of touching the buffer indices directly,
 *   6. DoomWiki only for orientation.
 *
 * This audit pins:
 *  - the canonical `MAXEVENTS == 64` buffer depth and its
 *    power-of-two requirement,
 *  - the canonical `D_PostEvent` body (append-then-advance),
 *  - the canonical `D_ProcessEvents` body (drain-then-dispatch),
 *  - the canonical responder dispatch order
 *    (`M_Responder` before `G_Responder`),
 *  - the canonical "menu ate the event" `continue` semantics,
 *  - the canonical FIFO-order drain invariant,
 *  - the canonical `I_StartTic` role boundary (pumps host events,
 *    posts via `D_PostEvent`, does NOT invoke responders directly),
 *  - twelve operational invariants every parity-faithful
 *    re-implementation of the I_StartTic / D_PostEvent /
 *    D_ProcessEvents trio must honour, and
 *  - a curated probe table covering the canonical empty-queue,
 *    one-event, three-event-FIFO, menu-eats, menu-falls-through,
 *    interleaved-post-process, and back-to-back-pump boundaries.
 *
 * The audit module deliberately does NOT import from any runtime
 * input-pump module. The audit stands on its own canonical-source
 * authority so a corruption of the runtime cannot also silently
 * corrupt the audit that detects the corruption. The focused test
 * validates the ledger AND a hand-rolled reference candidate that
 * mirrors vanilla `D_PostEvent` / `D_ProcessEvents` / `I_StartTic`
 * semantics.
 */

/**
 * Audited canonical buffer depth `MAXEVENTS` from
 * `linuxdoom-1.10/d_event.h` — exactly 64. Pinned because the
 * power-of-two value is what makes the canonical wrap formula
 * `eventhead = (++eventhead)&(MAXEVENTS-1)` (mask with 63) a
 * lossless equivalent to `% MAXEVENTS`. A port that uses a
 * non-power-of-two depth (e.g. 50) would either need to abandon
 * the bitwise mask form or silently truncate to the largest
 * power-of-two strictly less than the chosen depth.
 */
export const AUDITED_MAXEVENTS = 64;

/**
 * Audited canonical buffer-depth log2 — exactly 6 (so MAXEVENTS ==
 * 1 << 6 == 64). Pinned because the bitwise mask `& (MAXEVENTS-1)`
 * is `& 0x3F` — six low bits. A port that grows MAXEVENTS to 128
 * (2^7) would shift the mask to 0x7F; a port that shrinks to 32
 * (2^5) would shift to 0x1F. Either drift would mask the wrap
 * silently.
 */
export const AUDITED_MAXEVENTS_LOG2 = 6;

/**
 * Audited canonical wrap mask `MAXEVENTS - 1` — exactly 63 (0x3F).
 * Pinned because the canonical D_PostEvent and D_ProcessEvents
 * advance forms in vanilla `linuxdoom-1.10/d_main.c` are
 * `eventhead = (++eventhead)&(MAXEVENTS-1)` and
 * `eventtail = (++eventtail)&(MAXEVENTS-1)`. A port that omits
 * the AND mask (e.g. relies on `int` overflow) would index past
 * the buffer end on the 64th event posted to a fresh queue.
 */
export const AUDITED_MAXEVENTS_WRAP_MASK = 63;

/**
 * Audited canonical responder dispatch order — `M_Responder` runs
 * BEFORE `G_Responder` for every drained event. Pinned because the
 * canonical `for (...) { if (M_Responder (ev)) continue; G_Responder
 * (ev); }` body in `linuxdoom-1.10/d_main.c` and the corresponding
 * `while ((ev = D_PopEvent()) != NULL) { if (M_Responder (ev))
 * continue; G_Responder (ev); }` body in
 * `chocolate-doom-2.2.1/src/doom/d_main.c` both put `M_Responder`
 * first. A port that swaps the order would let `G_Responder`
 * observe events the menu intended to eat (mouselook would scroll
 * the inventory while the pause menu is open).
 */
export const AUDITED_RESPONDER_DISPATCH_PHASE_M_RESPONDER = 1;

/**
 * Audited canonical responder dispatch phase index for `G_Responder`
 * — exactly 2 (after `M_Responder`). Pinned alongside the phase-1
 * index above to defend against a port that reorders the dispatch
 * (the relative `M < G` ordering is the load-bearing invariant; the
 * exact integer values are arbitrary but the strict-less-than
 * relationship is not).
 */
export const AUDITED_RESPONDER_DISPATCH_PHASE_G_RESPONDER = 2;

/**
 * Audited canonical name of the linuxdoom source file containing the
 * canonical D_PostEvent and D_ProcessEvents bodies — exactly
 * `linuxdoom-1.10/d_main.c`. Pinned to disambiguate from the
 * Chocolate Doom 2.2.1 refactor which moves the queue into
 * `src/d_event.c` and the dispatcher into `src/doom/d_main.c`.
 */
export const AUDITED_VANILLA_EVENT_QUEUE_SOURCE_FILE = 'linuxdoom-1.10/d_main.c';

/**
 * Audited canonical name of the linuxdoom source file containing the
 * `MAXEVENTS` macro and `event_t` struct — exactly
 * `linuxdoom-1.10/d_event.h`. Pinned to lock the constant declaration
 * to its header file (a port that hides MAXEVENTS inside d_main.c
 * loses the cross-translation-unit visibility every other module
 * relies on).
 */
export const AUDITED_VANILLA_MAXEVENTS_SOURCE_FILE = 'linuxdoom-1.10/d_event.h';

/**
 * Audited canonical name of the linuxdoom source file containing the
 * canonical I_StartTic body — exactly `linuxdoom-1.10/i_video.c`.
 * Pinned because the X11-only host pump lives in `i_video.c` in
 * vanilla; Chocolate Doom 2.2.1 splits the body across
 * `src/i_video.c` (mouse) and `src/i_input.c` (keyboard) but both
 * preserve the role boundary (pumps host events, posts via
 * D_PostEvent, does NOT invoke responders directly).
 */
export const AUDITED_VANILLA_I_START_TIC_SOURCE_FILE = 'linuxdoom-1.10/i_video.c';

/**
 * Audited canonical name of the Chocolate Doom source file
 * containing the refactored event queue — exactly
 * `chocolate-doom-2.2.1/src/d_event.c`. Pinned because Chocolate
 * deliberately split the queue body out of `d_main.c` (where vanilla
 * kept it) into a dedicated `d_event.c` for the file-private
 * `static event_t events[MAXEVENTS];` declaration; a parity-faithful
 * re-implementation is free to locate the body in either file as
 * long as the canonical wrap-mask, dispatch order, and FIFO drain
 * are preserved.
 */
export const AUDITED_CHOCOLATE_EVENT_QUEUE_SOURCE_FILE = 'chocolate-doom-2.2.1/src/d_event.c';

/**
 * Stable identifier for one pinned C-source fact about the
 * canonical I_StartTic event pump contract.
 */
export type DoomIStartTicEventPumpFactId =
  | 'C_HEADER_VANILLA_MAXEVENTS_IS_SIXTY_FOUR'
  | 'C_HEADER_MAXEVENTS_IS_POWER_OF_TWO'
  | 'C_HEADER_VANILLA_EVENT_T_STRUCT_SHAPE'
  | 'C_BODY_VANILLA_EVENTS_ARRAY_DECLARATION'
  | 'C_BODY_VANILLA_EVENTHEAD_DECLARATION'
  | 'C_BODY_VANILLA_EVENTTAIL_DECLARATION'
  | 'C_BODY_VANILLA_DPOSTEVENT_STORE_THEN_ADVANCE'
  | 'C_BODY_VANILLA_DPOSTEVENT_WRAP_MASK_FORM'
  | 'C_BODY_VANILLA_DPROCESSEVENTS_DRAIN_LOOP_HEADER'
  | 'C_BODY_VANILLA_DPROCESSEVENTS_TAIL_ADVANCE_FORM'
  | 'C_BODY_VANILLA_DPROCESSEVENTS_M_RESPONDER_BEFORE_G_RESPONDER'
  | 'C_BODY_VANILLA_DPROCESSEVENTS_MENU_ATE_CONTINUE_COMMENT'
  | 'C_BODY_VANILLA_DPROCESSEVENTS_STORE_DEMO_GUARD'
  | 'C_BODY_VANILLA_ISTARTTIC_DRAINS_HOST_QUEUE'
  | 'C_BODY_VANILLA_ISTARTTIC_DOES_NOT_CALL_RESPONDER'
  | 'C_BODY_CHOCOLATE_DPOSTEVENT_MODULO_FORM'
  | 'C_BODY_CHOCOLATE_DPOPEVENT_RETURNS_NULL_ON_EMPTY'
  | 'C_BODY_CHOCOLATE_DPROCESSEVENTS_USES_DPOPEVENT_LOOP';

/** One pinned C-source fact about the I_StartTic event pump contract. */
export interface DoomIStartTicEventPumpFact {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomIStartTicEventPumpFactId;
  /** Whether the fact comes from the upstream C declaration or the upstream C body. */
  readonly category: 'c-header' | 'c-body';
  /** Plain-language description of what this fact pins. */
  readonly description: string;
  /** Verbatim C reference snippet. */
  readonly cReference: string;
  /** Reference source file path inside the upstream tree. */
  readonly referenceSourceFile: 'linuxdoom-1.10/d_event.h' | 'linuxdoom-1.10/d_main.c' | 'linuxdoom-1.10/i_video.c' | 'chocolate-doom-2.2.1/src/d_event.c' | 'chocolate-doom-2.2.1/src/doom/d_main.c' | 'shared:vanilla+chocolate';
}

/**
 * Pinned ledger of eighteen C-source facts that together define the
 * canonical I_StartTic event pump contract. The focused test asserts
 * the ledger is closed (every id appears exactly once) and that
 * every fact is honoured by the runtime.
 *
 * Categorisation:
 *  - `c-header` — file-scope or preprocessor declaration whose
 *    presence and value are visible without entering any function
 *    body.
 *  - `c-body`   — function body statement or call site.
 */
export const DOOM_I_START_TIC_EVENT_PUMP_AUDIT: readonly DoomIStartTicEventPumpFact[] = [
  {
    id: 'C_HEADER_VANILLA_MAXEVENTS_IS_SIXTY_FOUR',
    category: 'c-header',
    description:
      'The vanilla `linuxdoom-1.10/d_event.h` declares `#define MAXEVENTS 64` at file scope. Pinned because every consumer of `events[MAXEVENTS]` (D_PostEvent, D_ProcessEvents, save format dimensions) reads this constant; a port that uses a smaller depth (e.g. 32) would silently overwrite events on the 33rd post to a fresh queue, and a port that uses a larger depth (e.g. 128) would mask the wrap bug at MAXEVENTS-1.',
    cReference: '#define MAXEVENTS\t\t64',
    referenceSourceFile: 'linuxdoom-1.10/d_event.h',
  },
  {
    id: 'C_HEADER_MAXEVENTS_IS_POWER_OF_TWO',
    category: 'c-header',
    description:
      'MAXEVENTS == 64 == 2^6 is a power of two. Pinned as a derived invariant because the canonical wrap formulas `eventhead = (++eventhead)&(MAXEVENTS-1)` and `eventtail = (++eventtail)&(MAXEVENTS-1)` rely on `(MAXEVENTS-1)` being a contiguous low-bit mask. A port that picks a non-power-of-two depth (e.g. 50) breaks the bitwise-mask wrap and must use modulo (slower, semantically different at non-power-of-two boundaries).',
    cReference: 'MAXEVENTS == 64 == (1 << 6)',
    referenceSourceFile: 'linuxdoom-1.10/d_event.h',
  },
  {
    id: 'C_HEADER_VANILLA_EVENT_T_STRUCT_SHAPE',
    category: 'c-header',
    description:
      'The vanilla `linuxdoom-1.10/d_event.h` declares the `event_t` struct as `{ evtype_t type; int data1; int data2; int data3; }` plus the `evtype_t` enum `{ ev_keydown, ev_keyup, ev_mouse, ev_joystick }`. Pinned because the four-int payload (one type tag plus three int slots) is the canonical event shape that responders (M_Responder, G_Responder) destructure; a port that grows the payload (e.g. adds a timestamp) would shift the save-format size and break demo replay parity.',
    cReference: 'typedef struct { evtype_t type; int data1; int data2; int data3; } event_t;',
    referenceSourceFile: 'linuxdoom-1.10/d_event.h',
  },
  {
    id: 'C_BODY_VANILLA_EVENTS_ARRAY_DECLARATION',
    category: 'c-body',
    description:
      'The vanilla `linuxdoom-1.10/d_main.c` declares `event_t events[MAXEVENTS];` at file scope. Pinned because the array is the canonical backing storage for the queue; a port that backs the queue with a linked list would not honour the canonical wrap-mask form and would diverge on overflow (the canonical buffer silently overwrites the oldest event at the MAXEVENTS-th post; a linked list would either grow unbounded or use a different eviction policy).',
    cReference: 'event_t         events[MAXEVENTS];',
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
  },
  {
    id: 'C_BODY_VANILLA_EVENTHEAD_DECLARATION',
    category: 'c-body',
    description:
      'The vanilla `linuxdoom-1.10/d_main.c` declares `int eventhead;` at file scope (zero-initialised by the C runtime). Pinned because eventhead is the producer index advanced by D_PostEvent; a port that initialises it non-zero (e.g. -1) would either underflow on the first wrap or skip the first slot of the buffer.',
    cReference: 'int             eventhead;',
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
  },
  {
    id: 'C_BODY_VANILLA_EVENTTAIL_DECLARATION',
    category: 'c-body',
    description:
      'The vanilla `linuxdoom-1.10/d_main.c` declares `int eventtail;` at file scope (zero-initialised by the C runtime). Pinned because eventtail is the consumer index advanced by D_ProcessEvents; the empty-queue invariant `eventhead == eventtail` is observable only when both are zero on a fresh process — any non-zero initial offset would observe a phantom event on the first D_ProcessEvents call.',
    cReference: 'int \teventtail;',
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
  },
  {
    id: 'C_BODY_VANILLA_DPOSTEVENT_STORE_THEN_ADVANCE',
    category: 'c-body',
    description:
      'The vanilla D_PostEvent body in `linuxdoom-1.10/d_main.c` is exactly `events[eventhead] = *ev; eventhead = (++eventhead)&(MAXEVENTS-1);` — store the dereferenced event at the current head, THEN advance head. Pinned because a port that swaps the order (advance-then-store) would write past the head index by one, leaving the slot under the original eventhead unwritten and silently dropping the event.',
    cReference: 'events[eventhead] = *ev; eventhead = (++eventhead)&(MAXEVENTS-1);',
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
  },
  {
    id: 'C_BODY_VANILLA_DPOSTEVENT_WRAP_MASK_FORM',
    category: 'c-body',
    description:
      'The vanilla D_PostEvent advance uses the bitwise-AND mask form `(++eventhead)&(MAXEVENTS-1)` rather than the modulo form `(eventhead + 1) % MAXEVENTS`. Pinned because the two forms are semantically equivalent only when MAXEVENTS is a power of two; pinning the mask form locks the canonical low-six-bits identity that the queue depends on.',
    cReference: '(++eventhead)&(MAXEVENTS-1)',
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
  },
  {
    id: 'C_BODY_VANILLA_DPROCESSEVENTS_DRAIN_LOOP_HEADER',
    category: 'c-body',
    description:
      'The vanilla D_ProcessEvents drain loop header in `linuxdoom-1.10/d_main.c` is exactly `for ( ; eventtail != eventhead ; eventtail = (++eventtail)&(MAXEVENTS-1) )`. Pinned because the empty-condition is `eventtail == eventhead`, NOT `eventtail >= eventhead` — the latter would terminate prematurely after a wrap when eventhead is numerically less than eventtail mod MAXEVENTS.',
    cReference: 'for ( ; eventtail != eventhead ; eventtail = (++eventtail)&(MAXEVENTS-1) )',
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
  },
  {
    id: 'C_BODY_VANILLA_DPROCESSEVENTS_TAIL_ADVANCE_FORM',
    category: 'c-body',
    description:
      'The vanilla D_ProcessEvents tail-advance form is `eventtail = (++eventtail)&(MAXEVENTS-1)` — same bitwise-mask form as eventhead. Pinned because the symmetric advance is what keeps the head and tail wrap synchronous; a port that uses different advance forms for head and tail would observe phantom events when one wraps but the other does not.',
    cReference: 'eventtail = (++eventtail)&(MAXEVENTS-1)',
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
  },
  {
    id: 'C_BODY_VANILLA_DPROCESSEVENTS_M_RESPONDER_BEFORE_G_RESPONDER',
    category: 'c-body',
    description:
      'The vanilla D_ProcessEvents body in `linuxdoom-1.10/d_main.c` calls `M_Responder (ev)` first, and only calls `G_Responder (ev)` when `M_Responder` returned false. Pinned because a port that swaps the order would let game-state responders observe events the menu intended to eat (e.g. arrow keys would still drive player movement while the pause menu is processing the same key for menu navigation).',
    cReference: 'if (M_Responder (ev)) continue; G_Responder (ev);',
    referenceSourceFile: 'shared:vanilla+chocolate',
  },
  {
    id: 'C_BODY_VANILLA_DPROCESSEVENTS_MENU_ATE_CONTINUE_COMMENT',
    category: 'c-body',
    description:
      'The vanilla D_ProcessEvents `continue` after a true `M_Responder` carries the verbatim comment `// menu ate the event`. Pinned because the comment is the canonical name of the load-bearing semantic; a port that drops the `continue` (e.g. uses an `else G_Responder (ev);` form) is semantically equivalent here, but a port that drops both the `continue` and the conditional (i.e. always calls G_Responder regardless of M_Responder return value) breaks the canonical "menu eats" contract.',
    cReference: 'if (M_Responder (ev)) continue;               // menu ate the event',
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
  },
  {
    id: 'C_BODY_VANILLA_DPROCESSEVENTS_STORE_DEMO_GUARD',
    category: 'c-body',
    description:
      'The vanilla D_ProcessEvents body opens with `if ( ( gamemode == commercial ) && (W_CheckNumForName("map01")<0) ) return;` — the store-demo gate that bails out before the drain loop when the build is the commercial DOOM II store demo (no map01 lump available). Pinned because Chocolate Doom 2.2.1 simplified the gate to `if (storedemo) return;` (set by `-storedemo` command-line flag); a port that omits the gate entirely would let store-demo input drive the demo playback. The shareware DOOM 1.9 IWAD does NOT trip the gate (gamemode == shareware, not commercial), so the gate is effectively a no-op for the C1 product target.',
    cReference: 'if ( ( gamemode == commercial ) && (W_CheckNumForName("map01")<0) ) return;',
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
  },
  {
    id: 'C_BODY_VANILLA_ISTARTTIC_DRAINS_HOST_QUEUE',
    category: 'c-body',
    description:
      'The vanilla I_StartTic body in `linuxdoom-1.10/i_video.c` opens with `if (!X_display) return;` then drains the X11 event queue via `while (XPending(X_display)) I_GetEvent();`. The drain loop is the only producer-side path that reaches `D_PostEvent` for keyboard / mouse events. Pinned because the loop body is the canonical "pump host events to game events" surface; a port that processes a fixed number of events per call (e.g. drains at most one) would lag input by one frame on bursty input.',
    cReference: 'if (!X_display) return; while (XPending(X_display)) I_GetEvent();',
    referenceSourceFile: 'linuxdoom-1.10/i_video.c',
  },
  {
    id: 'C_BODY_VANILLA_ISTARTTIC_DOES_NOT_CALL_RESPONDER',
    category: 'c-body',
    description:
      'The vanilla I_StartTic body in `linuxdoom-1.10/i_video.c` does NOT call `M_Responder` or `G_Responder` directly. Every host event pumped through I_StartTic / I_GetEvent goes through `D_PostEvent` to land in the global `events[]` queue, where it is later dispatched by `D_ProcessEvents`. Pinned because a port that short-circuits the queue (e.g. invokes M_Responder synchronously from inside I_StartTic) would deliver events outside the per-newtic batching contract pinned by 04-011, breaking the deterministic-tic ordering that demo replay parity depends on.',
    cReference: 'I_StartTic body has no M_Responder or G_Responder call sites',
    referenceSourceFile: 'linuxdoom-1.10/i_video.c',
  },
  {
    id: 'C_BODY_CHOCOLATE_DPOSTEVENT_MODULO_FORM',
    category: 'c-body',
    description:
      'Chocolate Doom 2.2.1 `src/d_event.c` D_PostEvent body uses `eventhead = (eventhead + 1) % MAXEVENTS;` — the modulo form rather than the vanilla `& (MAXEVENTS-1)` mask. Pinned because the two forms are semantically equivalent at MAXEVENTS == 64 (power of two); the deviation is a deliberate Chocolate-vs-vanilla refactor that does not change observable behaviour but a parity-faithful re-implementation may use either form.',
    cReference: 'eventhead = (eventhead + 1) % MAXEVENTS;',
    referenceSourceFile: 'chocolate-doom-2.2.1/src/d_event.c',
  },
  {
    id: 'C_BODY_CHOCOLATE_DPOPEVENT_RETURNS_NULL_ON_EMPTY',
    category: 'c-body',
    description:
      'Chocolate Doom 2.2.1 `src/d_event.c` introduces `D_PopEvent (void)` which returns `NULL` when `eventhead == eventtail` (queue empty) and otherwise returns `&events[eventtail]` after advancing eventtail by `(eventtail + 1) % MAXEVENTS`. Pinned because the new function is the consumer-side primitive Chocolate uses to refactor `D_ProcessEvents` away from direct buffer-index touching; a port that exposes the same primitive must agree on the empty-queue NULL return (NOT a sentinel event_t with type=0, NOT a thrown exception).',
    cReference: 'event_t* D_PopEvent (void); /* returns NULL when eventhead == eventtail */',
    referenceSourceFile: 'chocolate-doom-2.2.1/src/d_event.c',
  },
  {
    id: 'C_BODY_CHOCOLATE_DPROCESSEVENTS_USES_DPOPEVENT_LOOP',
    category: 'c-body',
    description:
      'Chocolate Doom 2.2.1 `src/doom/d_main.c` D_ProcessEvents body uses `while ((ev = D_PopEvent()) != NULL) { if (M_Responder (ev)) continue; G_Responder (ev); }`. Pinned because the refactor preserves the canonical FIFO drain order, the M-then-G dispatch, and the menu-ate-continue semantics — all the load-bearing properties of the vanilla `for` loop body — even though the loop header changed shape.',
    cReference: 'while ((ev = D_PopEvent()) != NULL) { if (M_Responder (ev)) continue; G_Responder (ev); }',
    referenceSourceFile: 'chocolate-doom-2.2.1/src/doom/d_main.c',
  },
] as const;

/**
 * Stable identifier for one operational invariant the cross-check
 * helper enforces against any candidate I_StartTic event pump
 * surface tuple.
 */
export type DoomIStartTicEventPumpInvariantId =
  | 'EVENT_PUMP_FRESH_INSTANCE_HAS_ZERO_PENDING_EVENTS'
  | 'EVENT_PUMP_I_START_TIC_WITH_EMPTY_LIST_DOES_NOT_INCREASE_PENDING'
  | 'EVENT_PUMP_I_START_TIC_INCREASES_PENDING_BY_POSTED_COUNT'
  | 'EVENT_PUMP_D_PROCESS_EVENTS_ON_EMPTY_DOES_NOT_INVOKE_RESPONDERS'
  | 'EVENT_PUMP_D_PROCESS_EVENTS_DRAINS_QUEUE_TO_EMPTY'
  | 'EVENT_PUMP_D_PROCESS_EVENTS_DISPATCHES_FIFO'
  | 'EVENT_PUMP_M_RESPONDER_RUNS_BEFORE_G_RESPONDER_FOR_SAME_EVENT'
  | 'EVENT_PUMP_M_RESPONDER_TRUE_SKIPS_G_RESPONDER'
  | 'EVENT_PUMP_M_RESPONDER_FALSE_INVOKES_G_RESPONDER'
  | 'EVENT_PUMP_I_START_TIC_DOES_NOT_INVOKE_RESPONDERS_DIRECTLY'
  | 'EVENT_PUMP_INTERLEAVED_POST_AND_PROCESS_PRESERVE_FIFO'
  | 'EVENT_PUMP_TWO_INSTANCES_ARE_INDEPENDENT';

/** One operational invariant the cross-check helper enforces. */
export interface DoomIStartTicEventPumpInvariant {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomIStartTicEventPumpInvariantId;
  /** Plain-language description of the invariant. */
  readonly description: string;
}

/**
 * Pinned ledger of twelve operational invariants. The focused test
 * asserts the ledger is closed and that the cross-check helper
 * returns exactly the right failure id for each tampered candidate.
 */
export const DOOM_I_START_TIC_EVENT_PUMP_INVARIANTS: readonly DoomIStartTicEventPumpInvariant[] = [
  {
    id: 'EVENT_PUMP_FRESH_INSTANCE_HAS_ZERO_PENDING_EVENTS',
    description:
      'A freshly-constructed candidate exposes `pendingEventCount === 0` before any iStartTic call. Pinned because the canonical file-scope `int eventhead;` and `int eventtail;` declarations zero-initialise (matches the C runtime guarantee for static int storage).',
  },
  {
    id: 'EVENT_PUMP_I_START_TIC_WITH_EMPTY_LIST_DOES_NOT_INCREASE_PENDING',
    description:
      'Calling iStartTic with an empty events-to-post list leaves pendingEventCount unchanged. Pinned because the canonical I_StartTic loop `while (XPending(X_display)) I_GetEvent();` only iterates while the host queue has pending events; an empty host queue produces zero D_PostEvent calls.',
  },
  {
    id: 'EVENT_PUMP_I_START_TIC_INCREASES_PENDING_BY_POSTED_COUNT',
    description:
      'Calling iStartTic with K events to post increases pendingEventCount by exactly K (assuming K < MAXEVENTS). Pinned because each event in the host queue produces exactly one D_PostEvent call which appends one event to the buffer.',
  },
  {
    id: 'EVENT_PUMP_D_PROCESS_EVENTS_ON_EMPTY_DOES_NOT_INVOKE_RESPONDERS',
    description:
      'Calling dProcessEvents on a fresh (empty) queue invokes neither mResponder nor gResponder. Pinned because the canonical drain-loop header `for (; eventtail != eventhead ; ...)` (vanilla) or `while ((ev = D_PopEvent()) != NULL)` (Chocolate) skips the body when the queue is empty.',
  },
  {
    id: 'EVENT_PUMP_D_PROCESS_EVENTS_DRAINS_QUEUE_TO_EMPTY',
    description:
      'After dProcessEvents returns, pendingEventCount is 0 (every queued event has been drained). Pinned because the canonical drain loop runs until eventtail catches up to eventhead; a port that drains a fixed number of events per call would leave residual events queued across frames.',
  },
  {
    id: 'EVENT_PUMP_D_PROCESS_EVENTS_DISPATCHES_FIFO',
    description:
      'For events posted in order [A, B, C], dProcessEvents invokes the responder callbacks in the same order [A, B, C] (FIFO). Pinned because the canonical drain advances eventtail by +1 per iteration (mod MAXEVENTS), which is the FIFO order; a port that uses LIFO (e.g. drains from eventhead-1 backward) would deliver mouse motion in reverse and break the ticcmd encoding.',
  },
  {
    id: 'EVENT_PUMP_M_RESPONDER_RUNS_BEFORE_G_RESPONDER_FOR_SAME_EVENT',
    description:
      'For each drained event, mResponder is invoked before gResponder (when gResponder runs at all). Pinned because the canonical body `if (M_Responder (ev)) continue; G_Responder (ev);` evaluates M_Responder first; a port that runs G_Responder first would let game state observe events the menu intended to eat.',
  },
  {
    id: 'EVENT_PUMP_M_RESPONDER_TRUE_SKIPS_G_RESPONDER',
    description:
      'If mResponder returns true for an event, gResponder is NOT invoked for that event. Pinned because the canonical `continue` after a true M_Responder skips the rest of the loop body; a port that drops the `continue` (or uses `if (!M_Responder (ev)) G_Responder (ev);` then ALSO calls G_Responder unconditionally) would deliver the event to both responders.',
  },
  {
    id: 'EVENT_PUMP_M_RESPONDER_FALSE_INVOKES_G_RESPONDER',
    description:
      'If mResponder returns false for an event, gResponder IS invoked for that event. Pinned because the canonical body falls through to `G_Responder (ev);` when M_Responder did not eat the event; a port that swallows events when M_Responder returns false would silently drop game input.',
  },
  {
    id: 'EVENT_PUMP_I_START_TIC_DOES_NOT_INVOKE_RESPONDERS_DIRECTLY',
    description:
      'iStartTic does NOT invoke mResponder or gResponder during its own execution; both run only inside dProcessEvents. Pinned because the canonical I_StartTic body in linuxdoom-1.10/i_video.c contains no responder call sites; a port that short-circuits the queue (e.g. dispatches synchronously from inside I_StartTic) would break the deterministic-tic ordering that 04-011 audit pins.',
  },
  {
    id: 'EVENT_PUMP_INTERLEAVED_POST_AND_PROCESS_PRESERVE_FIFO',
    description:
      'Posting [A, B] then draining (mResponder/gResponder visit A then B), then posting [C, D] then draining (visit C then D), preserves global FIFO order [A, B, C, D]. Pinned because each individual D_ProcessEvents call drains in eventtail-advance order; running multiple drain phases between post phases preserves the per-phase ordering across the whole interleaved sequence.',
  },
  {
    id: 'EVENT_PUMP_TWO_INSTANCES_ARE_INDEPENDENT',
    description:
      'Two independently-constructed candidates do not share state: posting events to instance A leaves instance B with pendingEventCount === 0. Pinned because a port that uses global static state (rather than per-instance) would couple test fixtures and leak events across tests; the canonical vanilla queue uses true file-scope globals, but a parity-faithful re-implementation should encapsulate the queue state per-instance to honour the deterministic-replay isolation contract demos depend on.',
  },
] as const;

/** Stable identifier for one curated I_StartTic event pump probe. */
export type DoomIStartTicEventPumpProbeId =
  | 'fresh_queue_pending_count_is_zero'
  | 'one_post_then_process_dispatches_one_event'
  | 'three_posts_then_process_dispatches_three_in_fifo_order'
  | 'process_with_no_pending_events_dispatches_zero'
  | 'm_responder_true_skips_g_responder_for_that_event'
  | 'm_responder_false_falls_through_to_g_responder'
  | 'interleaved_post_process_preserves_global_fifo'
  | 'i_start_tic_with_empty_event_list_does_not_increase_pending'
  | 'two_back_to_back_pump_phases_accumulate_pending';

/** Which kind of expectation a probe pins. */
export type DoomIStartTicEventPumpProbeTarget = 'pending_event_count_after_calls' | 'm_responder_call_count_after_calls' | 'g_responder_call_count_after_calls' | 'total_responder_call_count_after_calls';

/** One curated I_StartTic event pump probe expectation. */
export interface DoomIStartTicEventPumpProbe {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomIStartTicEventPumpProbeId;
  /** Which surface this probe inspects. */
  readonly target: DoomIStartTicEventPumpProbeTarget;
  /**
   * Description of the call sequence run from a freshly-constructed
   * instance. The harness performs an alternating sequence of
   * iStartTic and dProcessEvents calls with the listed input shapes.
   */
  readonly input: {
    readonly steps: readonly DoomIStartTicEventPumpProbeStep[];
  };
  /** Expected canonical observed value at the END of the step sequence. */
  readonly expected: number;
  /** Plain-language note explaining what this probe defends against. */
  readonly note: string;
}

/** One step in a probe's input sequence. */
export type DoomIStartTicEventPumpProbeStep = { readonly kind: 'iStartTic'; readonly eventsToPost: readonly number[] } | { readonly kind: 'dProcessEvents'; readonly mResponderTrueForEventIds: readonly number[] };

/**
 * Curated probe table covering the canonical I_StartTic event pump
 * boundaries. Each probe is hand-pinned from the canonical
 * `linuxdoom-1.10/d_main.c` and `linuxdoom-1.10/i_video.c` source.
 */
export const DOOM_I_START_TIC_EVENT_PUMP_PROBES: readonly DoomIStartTicEventPumpProbe[] = [
  {
    id: 'fresh_queue_pending_count_is_zero',
    target: 'pending_event_count_after_calls',
    input: { steps: [] },
    expected: 0,
    note: 'A freshly-constructed candidate has zero pending events. Anchors the canonical zero-init `int eventhead; int eventtail;` declaration.',
  },
  {
    id: 'one_post_then_process_dispatches_one_event',
    target: 'total_responder_call_count_after_calls',
    input: {
      steps: [
        { kind: 'iStartTic', eventsToPost: [42] },
        { kind: 'dProcessEvents', mResponderTrueForEventIds: [] },
      ],
    },
    expected: 2,
    note: 'iStartTic with one event then dProcessEvents dispatches that event through both M_Responder (returns false) and G_Responder, totalling 2 responder calls. Anchors the canonical M-then-G dispatch.',
  },
  {
    id: 'three_posts_then_process_dispatches_three_in_fifo_order',
    target: 'g_responder_call_count_after_calls',
    input: {
      steps: [
        { kind: 'iStartTic', eventsToPost: [10, 20, 30] },
        { kind: 'dProcessEvents', mResponderTrueForEventIds: [] },
      ],
    },
    expected: 3,
    note: 'iStartTic posts three events, dProcessEvents dispatches all three (mResponder returns false for each), so gResponder is invoked exactly three times. Anchors the canonical drain-to-empty.',
  },
  {
    id: 'process_with_no_pending_events_dispatches_zero',
    target: 'total_responder_call_count_after_calls',
    input: {
      steps: [{ kind: 'dProcessEvents', mResponderTrueForEventIds: [] }],
    },
    expected: 0,
    note: 'dProcessEvents on a fresh empty queue invokes neither mResponder nor gResponder. Anchors the canonical empty-condition `eventtail == eventhead` skipping the loop body.',
  },
  {
    id: 'm_responder_true_skips_g_responder_for_that_event',
    target: 'g_responder_call_count_after_calls',
    input: {
      steps: [
        { kind: 'iStartTic', eventsToPost: [100, 200, 300] },
        { kind: 'dProcessEvents', mResponderTrueForEventIds: [200] },
      ],
    },
    expected: 2,
    note: 'iStartTic posts events 100, 200, 300; dProcessEvents calls M_Responder for each, with M_Responder returning true ONLY for event 200. The `continue` after M_Responder true skips G_Responder for event 200, so G_Responder runs for events 100 and 300 only (count 2). Anchors the canonical menu-ate-continue.',
  },
  {
    id: 'm_responder_false_falls_through_to_g_responder',
    target: 'g_responder_call_count_after_calls',
    input: {
      steps: [
        { kind: 'iStartTic', eventsToPost: [7] },
        { kind: 'dProcessEvents', mResponderTrueForEventIds: [] },
      ],
    },
    expected: 1,
    note: 'M_Responder returns false for event 7 (not in mResponderTrueForEventIds), so the loop body falls through to `G_Responder (ev);`. Anchors the canonical M-then-G fall-through.',
  },
  {
    id: 'interleaved_post_process_preserves_global_fifo',
    target: 'g_responder_call_count_after_calls',
    input: {
      steps: [
        { kind: 'iStartTic', eventsToPost: [1, 2] },
        { kind: 'dProcessEvents', mResponderTrueForEventIds: [] },
        { kind: 'iStartTic', eventsToPost: [3, 4] },
        { kind: 'dProcessEvents', mResponderTrueForEventIds: [] },
      ],
    },
    expected: 4,
    note: 'Interleaved post-process-post-process delivers all four events to gResponder. Anchors the canonical inter-phase FIFO preservation: each dProcessEvents drains its own queue, post phases append to the rear.',
  },
  {
    id: 'i_start_tic_with_empty_event_list_does_not_increase_pending',
    target: 'pending_event_count_after_calls',
    input: {
      steps: [{ kind: 'iStartTic', eventsToPost: [] }],
    },
    expected: 0,
    note: 'iStartTic with an empty host event list (XPending returns false on first iteration) produces zero D_PostEvent calls. Anchors the canonical `while (XPending(...))` loop terminating immediately on an empty host queue.',
  },
  {
    id: 'two_back_to_back_pump_phases_accumulate_pending',
    target: 'pending_event_count_after_calls',
    input: {
      steps: [
        { kind: 'iStartTic', eventsToPost: [1] },
        { kind: 'iStartTic', eventsToPost: [2, 3] },
      ],
    },
    expected: 3,
    note: 'Two back-to-back iStartTic calls (no intervening dProcessEvents) accumulate pending events. Anchors the canonical eventhead-only advance (without the consumer-side eventtail catch-up).',
  },
] as const;

/**
 * A candidate I_StartTic event pump surface tuple for cross-checking.
 * The tuple captures the canonical I_StartTic / D_PostEvent /
 * D_ProcessEvents trio: a constructor that returns a fresh instance,
 * plus a per-instance pendingEventCount getter, an `iStartTic`
 * operation that posts a list of synthetic events, and a
 * `dProcessEvents` operation that drains the queue and dispatches
 * each event through the M-then-G responder chain.
 */
export interface DoomIStartTicEventPumpCandidate {
  /** Factory that returns a fresh instance with zero pending events. */
  readonly create: () => DoomIStartTicEventPumpInstance;
}

/** The I_StartTic event pump surface a candidate must expose for the cross-check to inspect. */
export interface DoomIStartTicEventPumpInstance {
  /**
   * The current pending event count. After iStartTic appends K
   * events, this returns `previous_pending + K` (assuming
   * previous_pending + K < MAXEVENTS). After dProcessEvents drains
   * the queue, this returns 0.
   */
  readonly pendingEventCount: number;
  /**
   * I_StartTic equivalent. Posts each entry of `eventsToPost` to the
   * internal queue via the canonical D_PostEvent semantics
   * (append-then-advance-head). Each entry is an opaque synthetic
   * event identifier that round-trips to the responder callbacks
   * unchanged.
   *
   * The canonical contract:
   *  - iStartTic MUST NOT invoke `M_Responder` or `G_Responder`
   *    directly; events must land in the queue and dispatch later.
   *  - iStartTic MUST advance pendingEventCount by exactly the
   *    length of `eventsToPost` (assuming MAXEVENTS-bounded).
   */
  iStartTic(eventsToPost: readonly number[]): void;
  /**
   * D_ProcessEvents equivalent. Drains the queue in FIFO order. For
   * each drained event, calls `callbacks.mResponder(ev)`; if the
   * return value is true, the event is consumed (the loop continues
   * with the NEXT event, skipping G_Responder for the current
   * event); otherwise calls `callbacks.gResponder(ev)`.
   *
   * The canonical contract:
   *  - The drain MUST run until the queue is empty
   *    (pendingEventCount === 0 after return).
   *  - The drain MUST visit events in FIFO order (matches
   *    eventtail-advance order).
   *  - For each event, mResponder MUST run before gResponder.
   *  - When mResponder returns true, gResponder MUST NOT be
   *    invoked for that event.
   */
  dProcessEvents(callbacks: DoomIStartTicEventPumpCallbacks): void;
}

/** Callbacks invoked by dProcessEvents during the responder dispatch. */
export interface DoomIStartTicEventPumpCallbacks {
  /** M_Responder equivalent. Returns true to "eat" the event (skip gResponder). */
  mResponder(event: number): boolean;
  /** G_Responder equivalent. Invoked when mResponder returned false for the same event. */
  gResponder(event: number): void;
}

/**
 * Cross-check a candidate I_StartTic event pump surface tuple
 * against `DOOM_I_START_TIC_EVENT_PUMP_PROBES` and
 * `DOOM_I_START_TIC_EVENT_PUMP_INVARIANTS`. Returns the list of
 * failures by stable identifier; an empty list means the candidate
 * honours every audited fact.
 *
 * Identifiers used:
 *  - `probe:<id>` for a per-probe expectation mismatch.
 *  - `invariant:<id>` for a derived invariant that fails on at least
 *    one observation.
 */
export function crossCheckDoomIStartTicEventPump(candidate: DoomIStartTicEventPumpCandidate): readonly string[] {
  const failures: string[] = [];

  // Per-probe checks
  for (const probe of DOOM_I_START_TIC_EVENT_PUMP_PROBES) {
    const instance = candidate.create();
    let mResponderCallCount = 0;
    let gResponderCallCount = 0;
    for (const step of probe.input.steps) {
      if (step.kind === 'iStartTic') {
        instance.iStartTic(step.eventsToPost);
      } else {
        const trueIds = new Set<number>(step.mResponderTrueForEventIds);
        instance.dProcessEvents({
          mResponder: (event: number): boolean => {
            mResponderCallCount++;
            return trueIds.has(event);
          },
          gResponder: (): void => {
            gResponderCallCount++;
          },
        });
      }
    }
    let actual: number;
    if (probe.target === 'pending_event_count_after_calls') {
      actual = instance.pendingEventCount;
    } else if (probe.target === 'm_responder_call_count_after_calls') {
      actual = mResponderCallCount;
    } else if (probe.target === 'g_responder_call_count_after_calls') {
      actual = gResponderCallCount;
    } else {
      actual = mResponderCallCount + gResponderCallCount;
    }
    if (actual !== probe.expected) {
      failures.push(`probe:${probe.id}`);
    }
  }

  // Invariant: fresh instance has zero pending events
  {
    const instance = candidate.create();
    if (instance.pendingEventCount !== 0) {
      failures.push('invariant:EVENT_PUMP_FRESH_INSTANCE_HAS_ZERO_PENDING_EVENTS');
    }
  }

  // Invariant: iStartTic with an empty list does not increase pending
  {
    const instance = candidate.create();
    instance.iStartTic([]);
    if (instance.pendingEventCount !== 0) {
      failures.push('invariant:EVENT_PUMP_I_START_TIC_WITH_EMPTY_LIST_DOES_NOT_INCREASE_PENDING');
    }
  }

  // Invariant: iStartTic increases pending by posted count
  {
    let allMatch = true;
    for (const k of [1, 2, 5, 10]) {
      const instance = candidate.create();
      const events: number[] = [];
      for (let i = 0; i < k; i++) events.push(i);
      instance.iStartTic(events);
      if (instance.pendingEventCount !== k) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:EVENT_PUMP_I_START_TIC_INCREASES_PENDING_BY_POSTED_COUNT');
    }
  }

  // Invariant: dProcessEvents on empty queue does not invoke responders
  {
    const instance = candidate.create();
    let mCount = 0;
    let gCount = 0;
    instance.dProcessEvents({
      mResponder: (): boolean => {
        mCount++;
        return false;
      },
      gResponder: (): void => {
        gCount++;
      },
    });
    if (mCount !== 0 || gCount !== 0) {
      failures.push('invariant:EVENT_PUMP_D_PROCESS_EVENTS_ON_EMPTY_DOES_NOT_INVOKE_RESPONDERS');
    }
  }

  // Invariant: dProcessEvents drains queue to empty
  {
    const instance = candidate.create();
    instance.iStartTic([1, 2, 3, 4, 5]);
    instance.dProcessEvents({
      mResponder: (): boolean => false,
      gResponder: (): void => {},
    });
    if (instance.pendingEventCount !== 0) {
      failures.push('invariant:EVENT_PUMP_D_PROCESS_EVENTS_DRAINS_QUEUE_TO_EMPTY');
    }
  }

  // Invariant: dProcessEvents dispatches FIFO
  {
    const instance = candidate.create();
    const dispatched: number[] = [];
    instance.iStartTic([10, 20, 30, 40]);
    instance.dProcessEvents({
      mResponder: (): boolean => false,
      gResponder: (event: number): void => {
        dispatched.push(event);
      },
    });
    let ok = dispatched.length === 4;
    if (ok) {
      const expected = [10, 20, 30, 40];
      for (let i = 0; i < expected.length; i++) {
        if (dispatched[i] !== expected[i]) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) {
      failures.push('invariant:EVENT_PUMP_D_PROCESS_EVENTS_DISPATCHES_FIFO');
    }
  }

  // Invariant: M_Responder runs before G_Responder for the same event
  {
    const instance = candidate.create();
    const events: { kind: string; event: number }[] = [];
    instance.iStartTic([7]);
    instance.dProcessEvents({
      mResponder: (event: number): boolean => {
        events.push({ kind: 'm', event });
        return false;
      },
      gResponder: (event: number): void => {
        events.push({ kind: 'g', event });
      },
    });
    let ok = events.length === 2;
    if (ok) {
      ok = events[0].kind === 'm' && events[0].event === 7 && events[1].kind === 'g' && events[1].event === 7;
    }
    if (!ok) {
      failures.push('invariant:EVENT_PUMP_M_RESPONDER_RUNS_BEFORE_G_RESPONDER_FOR_SAME_EVENT');
    }
  }

  // Invariant: M_Responder true skips G_Responder
  {
    const instance = candidate.create();
    const gEvents: number[] = [];
    instance.iStartTic([1, 2, 3]);
    instance.dProcessEvents({
      mResponder: (event: number): boolean => event === 2,
      gResponder: (event: number): void => {
        gEvents.push(event);
      },
    });
    let ok = gEvents.length === 2 && gEvents[0] === 1 && gEvents[1] === 3;
    if (!ok) {
      failures.push('invariant:EVENT_PUMP_M_RESPONDER_TRUE_SKIPS_G_RESPONDER');
    }
  }

  // Invariant: M_Responder false invokes G_Responder
  {
    const instance = candidate.create();
    const gEvents: number[] = [];
    instance.iStartTic([99]);
    instance.dProcessEvents({
      mResponder: (): boolean => false,
      gResponder: (event: number): void => {
        gEvents.push(event);
      },
    });
    if (gEvents.length !== 1 || gEvents[0] !== 99) {
      failures.push('invariant:EVENT_PUMP_M_RESPONDER_FALSE_INVOKES_G_RESPONDER');
    }
  }

  // Invariant: iStartTic does not invoke responders directly
  {
    const instance = candidate.create();
    let mCount = 0;
    let gCount = 0;
    instance.iStartTic([5, 6, 7]);
    // Note: we cannot directly observe responder calls during iStartTic
    // without callbacks; instead we observe that the queue retains all
    // posted events (so iStartTic did not consume them via dispatch).
    if (instance.pendingEventCount !== 3) {
      failures.push('invariant:EVENT_PUMP_I_START_TIC_DOES_NOT_INVOKE_RESPONDERS_DIRECTLY');
    }
    // Then a separate dProcessEvents must observe all three events
    instance.dProcessEvents({
      mResponder: (): boolean => {
        mCount++;
        return false;
      },
      gResponder: (): void => {
        gCount++;
      },
    });
    if (mCount !== 3 || gCount !== 3) {
      failures.push('invariant:EVENT_PUMP_I_START_TIC_DOES_NOT_INVOKE_RESPONDERS_DIRECTLY');
    }
  }

  // Invariant: interleaved post-process preserves global FIFO
  {
    const instance = candidate.create();
    const dispatched: number[] = [];
    const callbacks: DoomIStartTicEventPumpCallbacks = {
      mResponder: (): boolean => false,
      gResponder: (event: number): void => {
        dispatched.push(event);
      },
    };
    instance.iStartTic([1, 2]);
    instance.dProcessEvents(callbacks);
    instance.iStartTic([3, 4]);
    instance.dProcessEvents(callbacks);
    let ok = dispatched.length === 4;
    if (ok) {
      const expected = [1, 2, 3, 4];
      for (let i = 0; i < expected.length; i++) {
        if (dispatched[i] !== expected[i]) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) {
      failures.push('invariant:EVENT_PUMP_INTERLEAVED_POST_AND_PROCESS_PRESERVE_FIFO');
    }
  }

  // Invariant: two instances are independent
  {
    const a = candidate.create();
    const b = candidate.create();
    a.iStartTic([1, 2, 3, 4, 5]);
    if (a.pendingEventCount !== 5 || b.pendingEventCount !== 0) {
      failures.push('invariant:EVENT_PUMP_TWO_INSTANCES_ARE_INDEPENDENT');
    }
  }

  return failures;
}
