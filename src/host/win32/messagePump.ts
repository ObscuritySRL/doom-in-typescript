/**
 * Win32 message pump with canonical PeekMessage → TranslateMessage →
 * DispatchMessage ordering.
 *
 * Chocolate Doom calls SDL_PollEvent in a non-blocking loop. This port
 * uses PeekMessageW with PM_REMOVE in the same pattern: drain all pending
 * messages, translate and dispatch each one, and detect WM_QUIT for
 * shutdown. The ordering guarantee — translate before dispatch, quit
 * breaks immediately — is locked by test/host/message-pump.test.ts.
 *
 * @example
 * ```ts
 * import { MessagePump, Win32MessagePumpHost } from "../src/host/win32/messagePump.ts";
 * const pump = new MessagePump(new Win32MessagePumpHost());
 * pump.drainMessages();
 * if (pump.quitRequested) { process.exit(0); }
 * ```
 */

import User32 from '@bun-win32/user32';

/** Size in bytes of the Win32 MSG structure on 64-bit Windows. */
export const MSG_SIZE = 0x30;

/** Byte offset of the HWND field (8-byte pointer). */
export const MSG_HWND_OFFSET = 0x00;

/** Byte offset of the UINT message field (4 bytes). */
export const MSG_MESSAGE_OFFSET = 0x08;

/** Byte offset of the WPARAM field (8-byte UINT_PTR). */
export const MSG_WPARAM_OFFSET = 0x10;

/** Byte offset of the LPARAM field (8-byte LONG_PTR). */
export const MSG_LPARAM_OFFSET = 0x18;

/** Byte offset of the DWORD time field (4 bytes). */
export const MSG_TIME_OFFSET = 0x20;

/** Byte offset of the POINT.x field (4-byte LONG). */
export const MSG_PT_X_OFFSET = 0x24;

/** Byte offset of the POINT.y field (4-byte LONG). */
export const MSG_PT_Y_OFFSET = 0x28;

/** WM_QUIT message identifier. */
export const WM_QUIT = 0x0012;

/** PeekMessage remove flag: remove the message from the queue. */
export const PM_REMOVE = 0x0001;

/**
 * Abstraction over the Win32 message triple: PeekMessage, TranslateMessage,
 * DispatchMessage. Tests supply a fake; production uses {@link Win32MessagePumpHost}.
 *
 * @example
 * ```ts
 * const host: MessagePumpHost = new Win32MessagePumpHost();
 * const pump = new MessagePump(host);
 * ```
 */
export interface MessagePumpHost {
  /** PeekMessageW(lpMsg, NULL, 0, 0, PM_REMOVE). Returns Win32 BOOL. */
  peekMessage(msgBuffer: Buffer): number;
  /** TranslateMessage(lpMsg). */
  translateMessage(msgBuffer: Buffer): void;
  /** DispatchMessageW(lpMsg). */
  dispatchMessage(msgBuffer: Buffer): void;
}

/**
 * Production message-pump host backed by user32.dll.
 *
 * Calls PeekMessageW with hwnd=NULL, no filter, PM_REMOVE — the standard
 * non-blocking drain pattern used by Doom-class game loops.
 *
 * @example
 * ```ts
 * const pump = new MessagePump(new Win32MessagePumpHost());
 * ```
 */
export class Win32MessagePumpHost implements MessagePumpHost {
  peekMessage(msgBuffer: Buffer): number {
    return User32.PeekMessageW(msgBuffer.ptr, 0n, 0, 0, PM_REMOVE);
  }

  translateMessage(msgBuffer: Buffer): void {
    void User32.TranslateMessage(msgBuffer.ptr);
  }

  dispatchMessage(msgBuffer: Buffer): void {
    void User32.DispatchMessageW(msgBuffer.ptr);
  }
}

/**
 * Non-blocking message pump that drains the thread's message queue with
 * canonical Win32 ordering: PeekMessage → TranslateMessage → DispatchMessage.
 *
 * WM_QUIT is detected but never translated or dispatched, matching the
 * standard Win32 message-loop contract. Once WM_QUIT is seen,
 * {@link quitRequested} stays true for the lifetime of the pump.
 *
 * @example
 * ```ts
 * const pump = new MessagePump(new Win32MessagePumpHost());
 * const processed = pump.drainMessages();
 * if (pump.quitRequested) { break; }
 * ```
 */
export class MessagePump {
  #host: MessagePumpHost;
  #msgBuffer = Buffer.alloc(MSG_SIZE);
  #msgView: DataView;
  #quitRequested = false;

  constructor(host: MessagePumpHost) {
    this.#host = host;
    this.#msgView = new DataView(this.#msgBuffer.buffer, this.#msgBuffer.byteOffset, MSG_SIZE);
  }

  /** Whether WM_QUIT has been received. Latches true once set. */
  get quitRequested(): boolean {
    return this.#quitRequested;
  }

  /**
   * Drain all pending messages from the thread's message queue.
   *
   * For each message: if WM_QUIT, latch {@link quitRequested} and stop.
   * Otherwise, call TranslateMessage then DispatchMessage. This matches
   * the canonical Win32 PeekMessage loop and Chocolate Doom's
   * SDL_PollEvent drain pattern.
   *
   * @returns Number of messages removed from the queue (including WM_QUIT).
   */
  drainMessages(): number {
    let count = 0;
    while (this.#host.peekMessage(this.#msgBuffer) !== 0) {
      const message = this.#msgView.getUint32(MSG_MESSAGE_OFFSET, true);
      if (message === WM_QUIT) {
        this.#quitRequested = true;
        count++;
        break;
      }
      this.#host.translateMessage(this.#msgBuffer);
      this.#host.dispatchMessage(this.#msgBuffer);
      count++;
    }
    return count;
  }
}
