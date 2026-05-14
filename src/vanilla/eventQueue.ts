/**
 * Vanilla DOOM 1.9 event-queue primitives and Win32 → vanilla event
 * translators.
 *
 * Plan_final step `03-006` (lane: launch-host-input) wires Win32
 * keyboard, mouse, close, focus, and Alt-F4 messages into the
 * vanilla event queue.  This module exposes:
 *
 *   - The vanilla `event_t` shape pinned by `d_event.h`
 *     (`evtype_t ∈ { ev_keydown, ev_keyup, ev_mouse, ev_quit }`,
 *     fields `data1`, `data2`, `data3`).
 *   - The canonical 64-slot circular queue (`MAXEVENTS = 64`) used
 *     by `D_PostEvent` / `D_ProcessEvents`.
 *   - Pure-function Win32 message translators for keyboard, mouse
 *     button, close, focus, and Alt-F4 messages.
 *   - `dispatchWin32MessageToVanillaQueue(queue, message, previousMouseButtonMask)`
 *     — convenience composer that posts the appropriate events to
 *     the queue and returns the updated mouse-button mask plus the
 *     latest focus state.
 *
 * The queue is a thin abstraction over a fixed-size circular array.
 * `post` mirrors `D_PostEvent` (writes at `eventhead`, wraps the
 * index); `pull` mirrors the read half of `D_ProcessEvents` (reads
 * at `eventtail`, wraps); `drainAll` returns every pending event in
 * FIFO order.  Overflowing the queue (more than 64 events posted
 * without a pull) overwrites the oldest entry — the same behavior
 * the vanilla circular buffer exhibits.
 *
 * Win32 → vanilla event mapping:
 *   - WM_KEYDOWN / WM_SYSKEYDOWN → `ev_keydown` with `data1` =
 *     translated Doom key code from the LPARAM scan code (the
 *     sys-key variants are how Alt-F4 arrives: VK_F4 with bit 29 of
 *     LPARAM set indicating the Alt prefix).
 *   - WM_KEYUP / WM_SYSKEYUP → `ev_keyup`.
 *   - WM_LBUTTONDOWN/UP, WM_RBUTTONDOWN/UP, WM_MBUTTONDOWN/UP,
 *     WM_XBUTTONDOWN/UP → `ev_mouse` with `data1` = updated mouse
 *     button bitmask; motion deltas are accumulated separately by
 *     `src/input/mouse.ts`.
 *   - WM_CLOSE / WM_QUIT → `ev_quit`.
 *   - WM_SETFOCUS / WM_KILLFOCUS → focus state reported directly
 *     (no `ev_focus` exists in vanilla `d_event.h`).
 *
 * @example
 * ```ts
 * import { VanillaEventQueue, dispatchWin32MessageToVanillaQueue } from './eventQueue.ts';
 * const queue = new VanillaEventQueue();
 * const result = dispatchWin32MessageToVanillaQueue(
 *   queue,
 *   { messageId: 0x0100, wParam: 0x1B, lParam: 0x010000 },
 *   0,
 * );
 * result.closeRequested;     // false
 * queue.pull()!.type;        // 'ev_keydown' (VK_ESCAPE)
 * ```
 */

import { LPARAM_SCANCODE_MASK, LPARAM_SCANCODE_SHIFT, translateScanCode } from '../input/keyboard.ts';
import {
  MOUSE_BUTTON_EXTRA1,
  MOUSE_BUTTON_EXTRA2,
  MOUSE_BUTTON_LEFT,
  MOUSE_BUTTON_MIDDLE,
  MOUSE_BUTTON_RIGHT,
  WM_LBUTTONDOWN,
  WM_LBUTTONUP,
  WM_MBUTTONDOWN,
  WM_MBUTTONUP,
  WM_RBUTTONDOWN,
  WM_RBUTTONUP,
  WM_XBUTTONDOWN,
  WM_XBUTTONUP,
  XBUTTON1,
  XBUTTON2,
} from '../input/mouse.ts';
import { WM_QUIT } from '../host/win32/messagePump.ts';

/** Vanilla `MAXEVENTS` from `d_event.h` — the fixed circular-queue size. */
export const VANILLA_MAX_EVENTS = 64;

/** Win32 WM_KEYDOWN message identifier. */
export const WM_KEYDOWN = 0x0100;
/** Win32 WM_KEYUP message identifier. */
export const WM_KEYUP = 0x0101;
/** Win32 WM_SYSKEYDOWN message identifier (Alt-F4 and Alt-modified keys). */
export const WM_SYSKEYDOWN = 0x0104;
/** Win32 WM_SYSKEYUP message identifier. */
export const WM_SYSKEYUP = 0x0105;
/** Win32 WM_CLOSE message identifier (window close button or Alt-F4 via DefWindowProc). */
export const WM_CLOSE = 0x0010;
/** Win32 WM_SETFOCUS message identifier. */
export const WM_SETFOCUS = 0x0007;
/** Win32 WM_KILLFOCUS message identifier. */
export const WM_KILLFOCUS = 0x0008;

/**
 * Bit 29 of LPARAM in WM_SYSKEYDOWN/WM_SYSKEYUP messages — set when
 * the Alt prefix is held while the key generates the message.  Used
 * to recognise Alt-F4.
 */
export const LPARAM_ALT_DOWN_FLAG = 0x2000_0000;

/** Win32 virtual key code for VK_F4. */
export const VK_F4 = 0x73;

/**
 * Vanilla `evtype_t` from `d_event.h`.  String-literal type is used
 * rather than a numeric enum so the event objects round-trip cleanly
 * through JSON, structured clone, and test assertions.
 */
export type VanillaEventType = 'ev_keydown' | 'ev_keyup' | 'ev_mouse' | 'ev_quit';

/**
 * Vanilla `event_t` from `d_event.h`.  All four event types share
 * the same `data1/data2/data3` slots; the field semantics depend on
 * the `type`:
 *
 *   - `ev_keydown` / `ev_keyup`: `data1` is the Doom key code from
 *     `translateScanCode`; `data2` and `data3` are zero.
 *   - `ev_mouse`: `data1` is the mouse button bitmask; `data2` is
 *     the horizontal delta; `data3` is the vertical delta.  This
 *     module emits ev_mouse events for button transitions with
 *     `data2`/`data3` = 0 — motion is accumulated separately by
 *     `src/input/mouse.ts`.
 *   - `ev_quit`: all three data slots are zero.
 */
export interface VanillaEvent {
  readonly type: VanillaEventType;
  readonly data1: number;
  readonly data2: number;
  readonly data3: number;
}

function freezeEvent(type: VanillaEventType, data1: number, data2: number, data3: number): VanillaEvent {
  return Object.freeze({ data1, data2, data3, type });
}

/**
 * Canonical 64-slot circular event queue matching vanilla
 * `D_PostEvent` / `D_ProcessEvents`.
 *
 * The internal storage is a fixed-size array of `MAXEVENTS = 64`
 * slots.  `post` writes to `eventHead % MAXEVENTS` and increments
 * `eventHead`; `pull` reads from `eventTail % MAXEVENTS` and
 * increments `eventTail`.  When the producer outruns the consumer
 * by more than `MAXEVENTS` posts, the oldest entries are
 * overwritten — matching the vanilla circular-buffer overflow
 * behavior.
 */
export class VanillaEventQueue {
  readonly #slots: (VanillaEvent | null)[];
  #eventHead = 0;
  #eventTail = 0;

  public constructor() {
    this.#slots = new Array<VanillaEvent | null>(VANILLA_MAX_EVENTS).fill(null);
  }

  /** Number of events currently in the queue (clamped to MAXEVENTS). */
  public get size(): number {
    const pending = this.#eventHead - this.#eventTail;
    return pending > VANILLA_MAX_EVENTS ? VANILLA_MAX_EVENTS : pending;
  }

  /** True when the queue is empty. */
  public get isEmpty(): boolean {
    return this.#eventHead === this.#eventTail;
  }

  /** Post one event; mirrors D_PostEvent.  Overflow overwrites the oldest entry. */
  public post(event: VanillaEvent): void {
    const slotIndex = this.#eventHead % VANILLA_MAX_EVENTS;
    this.#slots[slotIndex] = event;
    this.#eventHead += 1;
    if (this.#eventHead - this.#eventTail > VANILLA_MAX_EVENTS) {
      this.#eventTail = this.#eventHead - VANILLA_MAX_EVENTS;
    }
  }

  /** Pull the oldest pending event, or `null` if the queue is empty.  Mirrors the read half of D_ProcessEvents. */
  public pull(): VanillaEvent | null {
    if (this.isEmpty) {
      return null;
    }
    const slotIndex = this.#eventTail % VANILLA_MAX_EVENTS;
    const event = this.#slots[slotIndex] ?? null;
    this.#slots[slotIndex] = null;
    this.#eventTail += 1;
    return event;
  }

  /** Drain every pending event in FIFO order.  Mirrors a full D_ProcessEvents pass. */
  public drainAll(): readonly VanillaEvent[] {
    const drained: VanillaEvent[] = [];
    while (!this.isEmpty) {
      const event = this.pull();
      if (event !== null) {
        drained.push(event);
      }
    }
    return Object.freeze(drained);
  }
}

/**
 * Translate a Win32 keyboard message (WM_KEYDOWN, WM_KEYUP,
 * WM_SYSKEYDOWN, WM_SYSKEYUP) into a vanilla `ev_keydown` /
 * `ev_keyup` event.
 *
 * The Doom key code is derived from the LPARAM scan code via the
 * read-only `translateScanCode` table.  Keys that translate to 0
 * (unmapped) return `null` — vanilla `I_GetEvent` does the same.
 */
export function translateKeyboardMessageToVanillaEvent(messageId: number, wParam: number, lParam: number): VanillaEvent | null {
  void wParam;
  if (messageId !== WM_KEYDOWN && messageId !== WM_KEYUP && messageId !== WM_SYSKEYDOWN && messageId !== WM_SYSKEYUP) {
    return null;
  }
  const doomKey = translateScanCode(lParam);
  if (doomKey === 0) {
    return null;
  }
  const eventType: VanillaEventType = messageId === WM_KEYDOWN || messageId === WM_SYSKEYDOWN ? 'ev_keydown' : 'ev_keyup';
  return freezeEvent(eventType, doomKey, 0, 0);
}

/**
 * Return `true` when the given message is a WM_SYSKEYDOWN with
 * VK_F4 and the Alt flag set in LPARAM bit 29.  Exposed as a
 * stand-alone predicate so callers that bypass `DefWindowProc`
 * (custom message loops, tests) can still recognise Alt-F4 directly.
 */
export function isAltF4Message(messageId: number, wParam: number, lParam: number): boolean {
  return messageId === WM_SYSKEYDOWN && wParam === VK_F4 && (lParam & LPARAM_ALT_DOWN_FLAG) !== 0;
}

/** Resolve the Doom mouse-button bit change from a Win32 mouse message. */
function resolveMouseButtonChange(messageId: number, wParam: number): { bit: number; direction: 'down' | 'up' } | null {
  switch (messageId) {
    case WM_LBUTTONDOWN:
      return { bit: 1 << MOUSE_BUTTON_LEFT, direction: 'down' };
    case WM_LBUTTONUP:
      return { bit: 1 << MOUSE_BUTTON_LEFT, direction: 'up' };
    case WM_RBUTTONDOWN:
      return { bit: 1 << MOUSE_BUTTON_RIGHT, direction: 'down' };
    case WM_RBUTTONUP:
      return { bit: 1 << MOUSE_BUTTON_RIGHT, direction: 'up' };
    case WM_MBUTTONDOWN:
      return { bit: 1 << MOUSE_BUTTON_MIDDLE, direction: 'down' };
    case WM_MBUTTONUP:
      return { bit: 1 << MOUSE_BUTTON_MIDDLE, direction: 'up' };
    case WM_XBUTTONDOWN: {
      const xButton = (wParam >>> 16) & 0xffff;
      if (xButton === XBUTTON1) {
        return { bit: 1 << MOUSE_BUTTON_EXTRA1, direction: 'down' };
      }
      if (xButton === XBUTTON2) {
        return { bit: 1 << MOUSE_BUTTON_EXTRA2, direction: 'down' };
      }
      return null;
    }
    case WM_XBUTTONUP: {
      const xButton = (wParam >>> 16) & 0xffff;
      if (xButton === XBUTTON1) {
        return { bit: 1 << MOUSE_BUTTON_EXTRA1, direction: 'up' };
      }
      if (xButton === XBUTTON2) {
        return { bit: 1 << MOUSE_BUTTON_EXTRA2, direction: 'up' };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Result of translating a Win32 mouse-button message: the updated
 * mouse-button bitmask the caller should keep, plus the `ev_mouse`
 * event to post to the queue.
 */
export interface VanillaMouseButtonTranslation {
  readonly updatedMouseButtonMask: number;
  readonly event: VanillaEvent;
}

/**
 * Translate a Win32 mouse-button message into the updated Doom
 * mouse-button bitmask and an `ev_mouse` event whose `data1` is
 * that bitmask.  Returns `null` when the message is not a mouse
 * button message or when WM_XBUTTONDOWN/UP carries an unrecognised
 * HIWORD(wParam) value.  Motion deltas are accumulated separately.
 */
export function translateMouseButtonMessageToVanillaEvent(messageId: number, wParam: number, currentMouseButtonMask: number): VanillaMouseButtonTranslation | null {
  const change = resolveMouseButtonChange(messageId, wParam);
  if (change === null) {
    return null;
  }
  const updatedMouseButtonMask = change.direction === 'down' ? currentMouseButtonMask | change.bit : currentMouseButtonMask & ~change.bit;
  return Object.freeze({
    event: freezeEvent('ev_mouse', updatedMouseButtonMask & 0xff, 0, 0),
    updatedMouseButtonMask: updatedMouseButtonMask & 0xff,
  });
}

/**
 * Translate a Win32 close message into a vanilla `ev_quit` event.
 * Both WM_CLOSE and WM_QUIT map to `ev_quit`; other messages return `null`.
 */
export function translateCloseMessageToVanillaEvent(messageId: number): VanillaEvent | null {
  if (messageId === WM_CLOSE || messageId === WM_QUIT) {
    return freezeEvent('ev_quit', 0, 0, 0);
  }
  return null;
}

/**
 * Translate a Win32 focus message into a focus state change.
 * WM_SETFOCUS yields `{ hasFocus: true }`; WM_KILLFOCUS yields
 * `{ hasFocus: false }`; other messages return `null`.  Vanilla
 * Doom has no `ev_focus` event type, so focus is reported as a
 * direct state change rather than a queued event.
 */
export function translateFocusMessageToFocusState(messageId: number): { readonly hasFocus: boolean } | null {
  if (messageId === WM_SETFOCUS) {
    return Object.freeze({ hasFocus: true });
  }
  if (messageId === WM_KILLFOCUS) {
    return Object.freeze({ hasFocus: false });
  }
  return null;
}

/**
 * One Win32 window message to translate.  `messageId` is the
 * `MSG.message` UINT; `wParam` and `lParam` are the corresponding
 * `MSG.wParam` and `MSG.lParam` UINT_PTR / LONG_PTR values.
 */
export interface Win32WindowMessage {
  readonly messageId: number;
  readonly wParam: number;
  readonly lParam: number;
}

/**
 * Result of dispatching one Win32 message through
 * {@link dispatchWin32MessageToVanillaQueue}.  The caller keeps
 * `updatedMouseButtonMask` for the next call so the bitmask is
 * preserved across messages; `focusChange` carries the latest
 * focus state when WM_SETFOCUS/WM_KILLFOCUS was processed;
 * `closeRequested` is `true` when WM_CLOSE / WM_QUIT / Alt-F4 was
 * processed.
 */
export interface VanillaQueueDispatchResult {
  readonly updatedMouseButtonMask: number;
  readonly focusChange: { readonly hasFocus: boolean } | null;
  readonly closeRequested: boolean;
}

/**
 * Dispatch one Win32 window message through every translator and
 * post the resulting vanilla events to the queue.  Returns the
 * updated mouse-button bitmask, the focus state change (if any),
 * and whether the message was a close-window request.  An Alt-F4
 * combination is both posted as an `ev_keydown` (via the keyboard
 * translator) and reported as `closeRequested = true`, matching the
 * vanilla launch host's "quit immediately on Alt-F4" semantics.
 */
export function dispatchWin32MessageToVanillaQueue(queue: VanillaEventQueue, message: Win32WindowMessage, previousMouseButtonMask: number): VanillaQueueDispatchResult {
  const keyboardEvent = translateKeyboardMessageToVanillaEvent(message.messageId, message.wParam, message.lParam);
  if (keyboardEvent !== null) {
    queue.post(keyboardEvent);
  }

  const mouseTranslation = translateMouseButtonMessageToVanillaEvent(message.messageId, message.wParam, previousMouseButtonMask);
  let updatedMouseButtonMask = previousMouseButtonMask;
  if (mouseTranslation !== null) {
    queue.post(mouseTranslation.event);
    updatedMouseButtonMask = mouseTranslation.updatedMouseButtonMask;
  }

  const closeEvent = translateCloseMessageToVanillaEvent(message.messageId);
  const altF4 = isAltF4Message(message.messageId, message.wParam, message.lParam);
  const closeRequested = closeEvent !== null || altF4;
  if (closeEvent !== null) {
    queue.post(closeEvent);
  } else if (altF4) {
    queue.post(freezeEvent('ev_quit', 0, 0, 0));
  }

  const focusChange = translateFocusMessageToFocusState(message.messageId);

  return Object.freeze({
    closeRequested,
    focusChange,
    updatedMouseButtonMask,
  });
}

/**
 * Extract the DOS scan code from a Win32 LPARAM.  Re-exported here
 * so callers using `dispatchWin32MessageToVanillaQueue` can debug
 * the scan-code extraction step without importing from two modules.
 */
export function extractScanCodeFromLParam(lParam: number): number {
  return (lParam >>> LPARAM_SCANCODE_SHIFT) & LPARAM_SCANCODE_MASK;
}
