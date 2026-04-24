import { describe, expect, test } from 'bun:test';

import type { MessagePumpHost } from '../../src/host/win32/messagePump.ts';
import {
  MessagePump,
  MSG_HWND_OFFSET,
  MSG_LPARAM_OFFSET,
  MSG_MESSAGE_OFFSET,
  MSG_PT_X_OFFSET,
  MSG_PT_Y_OFFSET,
  MSG_SIZE,
  MSG_TIME_OFFSET,
  MSG_WPARAM_OFFSET,
  PM_REMOVE,
  WM_QUIT,
  Win32MessagePumpHost,
} from '../../src/host/win32/messagePump.ts';

/** Writes a message ID into a MSG buffer at the correct offset. */
function writeMsgId(buffer: Buffer, messageId: number): void {
  const view = new DataView(buffer.buffer, buffer.byteOffset, MSG_SIZE);
  view.setUint32(MSG_MESSAGE_OFFSET, messageId, true);
}

/**
 * Fake host that returns a scripted sequence of messages and records
 * the exact call order for ordering verification.
 */
class FakeMessagePumpHost implements MessagePumpHost {
  #messages: number[];
  #index = 0;
  calls: string[] = [];

  constructor(messages: number[]) {
    this.#messages = messages;
  }

  peekMessage(msgBuffer: Buffer): number {
    this.calls.push('peek');
    if (this.#index >= this.#messages.length) {
      return 0;
    }
    writeMsgId(msgBuffer, this.#messages[this.#index]!);
    this.#index++;
    return 1;
  }

  translateMessage(_msgBuffer: Buffer): void {
    this.calls.push('translate');
  }

  dispatchMessage(_msgBuffer: Buffer): void {
    this.calls.push('dispatch');
  }
}

describe('message pump constants', () => {
  test('MSG_SIZE is 48 bytes (0x30)', () => {
    expect(MSG_SIZE).toBe(0x30);
    expect(MSG_SIZE).toBe(48);
  });

  test('MSG field offsets match 64-bit Windows layout', () => {
    expect(MSG_HWND_OFFSET).toBe(0x00);
    expect(MSG_MESSAGE_OFFSET).toBe(0x08);
    expect(MSG_WPARAM_OFFSET).toBe(0x10);
    expect(MSG_LPARAM_OFFSET).toBe(0x18);
    expect(MSG_TIME_OFFSET).toBe(0x20);
    expect(MSG_PT_X_OFFSET).toBe(0x24);
    expect(MSG_PT_Y_OFFSET).toBe(0x28);
  });

  test('field offsets are strictly increasing', () => {
    const offsets = [MSG_HWND_OFFSET, MSG_MESSAGE_OFFSET, MSG_WPARAM_OFFSET, MSG_LPARAM_OFFSET, MSG_TIME_OFFSET, MSG_PT_X_OFFSET, MSG_PT_Y_OFFSET];
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i]!).toBeGreaterThan(offsets[i - 1]!);
    }
  });

  test('all offsets fit within MSG_SIZE', () => {
    expect(MSG_PT_Y_OFFSET + 4).toBeLessThanOrEqual(MSG_SIZE);
  });

  test('WM_QUIT is 0x0012', () => {
    expect(WM_QUIT).toBe(0x0012);
  });

  test('PM_REMOVE is 0x0001', () => {
    expect(PM_REMOVE).toBe(0x0001);
  });
});

describe('message pump ordering', () => {
  test('empty queue returns 0 with single peek', () => {
    const host = new FakeMessagePumpHost([]);
    const pump = new MessagePump(host);
    expect(pump.drainMessages()).toBe(0);
    expect(host.calls).toEqual(['peek']);
  });

  test('single message: peek → translate → dispatch → peek', () => {
    const host = new FakeMessagePumpHost([0x000f]); // WM_PAINT
    const pump = new MessagePump(host);
    expect(pump.drainMessages()).toBe(1);
    expect(host.calls).toEqual(['peek', 'translate', 'dispatch', 'peek']);
  });

  test('three messages: strict per-message ordering preserved', () => {
    const host = new FakeMessagePumpHost([0x000f, 0x0005, 0x0003]);
    const pump = new MessagePump(host);
    expect(pump.drainMessages()).toBe(3);
    expect(host.calls).toEqual(['peek', 'translate', 'dispatch', 'peek', 'translate', 'dispatch', 'peek', 'translate', 'dispatch', 'peek']);
  });

  test('WM_QUIT is not translated or dispatched', () => {
    const host = new FakeMessagePumpHost([WM_QUIT]);
    const pump = new MessagePump(host);
    pump.drainMessages();
    expect(host.calls).toEqual(['peek']);
    expect(host.calls).not.toContain('translate');
    expect(host.calls).not.toContain('dispatch');
  });

  test('WM_QUIT sets quitRequested', () => {
    const host = new FakeMessagePumpHost([WM_QUIT]);
    const pump = new MessagePump(host);
    expect(pump.quitRequested).toBe(false);
    pump.drainMessages();
    expect(pump.quitRequested).toBe(true);
  });

  test('WM_QUIT counts as one message', () => {
    const host = new FakeMessagePumpHost([WM_QUIT]);
    const pump = new MessagePump(host);
    expect(pump.drainMessages()).toBe(1);
  });

  test('messages before WM_QUIT are fully processed', () => {
    const host = new FakeMessagePumpHost([0x000f, 0x0005, WM_QUIT]);
    const pump = new MessagePump(host);
    expect(pump.drainMessages()).toBe(3);
    expect(host.calls).toEqual(['peek', 'translate', 'dispatch', 'peek', 'translate', 'dispatch', 'peek']);
  });

  test('messages after WM_QUIT in queue are not processed', () => {
    const host = new FakeMessagePumpHost([0x000f, WM_QUIT, 0x0005]);
    const pump = new MessagePump(host);
    expect(pump.drainMessages()).toBe(2);
    expect(host.calls).toEqual(['peek', 'translate', 'dispatch', 'peek']);
  });

  test('quitRequested persists across drain cycles', () => {
    const host = new FakeMessagePumpHost([WM_QUIT]);
    const pump = new MessagePump(host);
    pump.drainMessages();
    expect(pump.quitRequested).toBe(true);
    pump.drainMessages();
    expect(pump.quitRequested).toBe(true);
  });

  test('quitRequested starts false', () => {
    const host = new FakeMessagePumpHost([]);
    const pump = new MessagePump(host);
    expect(pump.quitRequested).toBe(false);
  });

  test('multiple drain cycles return independent counts', () => {
    const host = new FakeMessagePumpHost([0x000f, 0x0005]);
    const pump = new MessagePump(host);
    expect(pump.drainMessages()).toBe(2);
    expect(pump.drainMessages()).toBe(0);
  });

  test('translate always immediately precedes dispatch', () => {
    const host = new FakeMessagePumpHost([0x0100, 0x0101, 0x0200]);
    const pump = new MessagePump(host);
    pump.drainMessages();
    for (let i = 0; i < host.calls.length; i++) {
      if (host.calls[i] === 'dispatch') {
        expect(host.calls[i - 1]).toBe('translate');
      }
    }
  });

  test('peek always immediately precedes translate for non-quit', () => {
    const host = new FakeMessagePumpHost([0x000f, 0x0003]);
    const pump = new MessagePump(host);
    pump.drainMessages();
    for (let i = 0; i < host.calls.length; i++) {
      if (host.calls[i] === 'translate') {
        expect(host.calls[i - 1]).toBe('peek');
      }
    }
  });
});

describe('Win32MessagePumpHost', () => {
  test('class can be constructed', () => {
    const host = new Win32MessagePumpHost();
    expect(host).toBeDefined();
  });

  test('satisfies MessagePumpHost interface', () => {
    const host: MessagePumpHost = new Win32MessagePumpHost();
    expect(typeof host.peekMessage).toBe('function');
    expect(typeof host.translateMessage).toBe('function');
    expect(typeof host.dispatchMessage).toBe('function');
  });
});
