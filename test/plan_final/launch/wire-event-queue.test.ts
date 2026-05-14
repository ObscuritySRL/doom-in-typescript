import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { KEY_ESCAPE, KEY_F1, LPARAM_EXTENDED_FLAG } from '../../../src/input/keyboard.ts';
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
} from '../../../src/input/mouse.ts';
import { WM_QUIT } from '../../../src/host/win32/messagePump.ts';
import {
  LPARAM_ALT_DOWN_FLAG,
  VANILLA_MAX_EVENTS,
  VK_F4,
  VanillaEventQueue,
  WM_CLOSE,
  WM_KEYDOWN,
  WM_KEYUP,
  WM_KILLFOCUS,
  WM_SETFOCUS,
  WM_SYSKEYDOWN,
  WM_SYSKEYUP,
  dispatchWin32MessageToVanillaQueue,
  extractScanCodeFromLParam,
  isAltF4Message,
  translateCloseMessageToVanillaEvent,
  translateFocusMessageToFocusState,
  translateKeyboardMessageToVanillaEvent,
  translateMouseButtonMessageToVanillaEvent,
} from '../../../src/vanilla/eventQueue.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const EVENT_QUEUE_RELATIVE_PATH = 'src/vanilla/eventQueue.ts';
const EVENT_QUEUE_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, EVENT_QUEUE_RELATIVE_PATH);

const SCAN_CODE_ESCAPE = 0x01;
const SCAN_CODE_F1 = 0x3b;
const SCAN_CODE_F4 = 0x3e;
const SCAN_CODE_NUM_5 = 0x4c;

function buildLParam(scanCode: number, extended = false, altDown = false): number {
  let value = (scanCode & 0xff) << 16;
  if (extended) {
    value |= LPARAM_EXTENDED_FLAG;
  }
  if (altDown) {
    value |= LPARAM_ALT_DOWN_FLAG;
  }
  return value;
}

function buildMessage(messageId: number, wParam: number, lParam: number): { messageId: number; wParam: number; lParam: number } {
  return Object.freeze({ lParam, messageId, wParam });
}

describe('plan_final launch: wire-event-queue', () => {
  test('src/vanilla/eventQueue.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(EVENT_QUEUE_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(EVENT_QUEUE_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/eventQueue.ts cites plan_final step 03-006 and exposes the expected public names in a top-of-file comment', () => {
    const fileText = readFileSync(EVENT_QUEUE_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('03-006');
    expect(fileText).toContain('VanillaEventQueue');
    expect(fileText).toContain('dispatchWin32MessageToVanillaQueue');
    expect(fileText).toContain('translateKeyboardMessageToVanillaEvent');
    expect(fileText).toContain('translateMouseButtonMessageToVanillaEvent');
    expect(fileText).toContain('translateCloseMessageToVanillaEvent');
    expect(fileText).toContain('translateFocusMessageToFocusState');
  });

  test('src/vanilla/eventQueue.ts imports the keyboard, mouse, and message-pump constants from the read-only refs', () => {
    const fileText = readFileSync(EVENT_QUEUE_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../input/keyboard.ts'");
    expect(fileText).toContain("from '../input/mouse.ts'");
    expect(fileText).toContain("from '../host/win32/messagePump.ts'");
  });

  test('VANILLA_MAX_EVENTS pins the canonical 64-slot queue size (d_event.h MAXEVENTS)', () => {
    expect(VANILLA_MAX_EVENTS).toBe(64);
  });

  test('VanillaEventQueue starts empty (size=0, isEmpty=true, pull returns null)', () => {
    const queue = new VanillaEventQueue();
    expect(queue.size).toBe(0);
    expect(queue.isEmpty).toBe(true);
    expect(queue.pull()).toBeNull();
  });

  test('VanillaEventQueue.post + pull preserves FIFO order (D_PostEvent / D_ProcessEvents semantics)', () => {
    const queue = new VanillaEventQueue();
    queue.post(Object.freeze({ data1: 1, data2: 0, data3: 0, type: 'ev_keydown' as const }));
    queue.post(Object.freeze({ data1: 2, data2: 0, data3: 0, type: 'ev_keydown' as const }));
    queue.post(Object.freeze({ data1: 3, data2: 0, data3: 0, type: 'ev_keyup' as const }));
    expect(queue.size).toBe(3);
    expect(queue.pull()!.data1).toBe(1);
    expect(queue.pull()!.data1).toBe(2);
    expect(queue.pull()!.data1).toBe(3);
    expect(queue.pull()).toBeNull();
    expect(queue.isEmpty).toBe(true);
  });

  test('VanillaEventQueue.drainAll returns every pending event in FIFO order and leaves the queue empty', () => {
    const queue = new VanillaEventQueue();
    queue.post(Object.freeze({ data1: 10, data2: 0, data3: 0, type: 'ev_keydown' as const }));
    queue.post(Object.freeze({ data1: 20, data2: 0, data3: 0, type: 'ev_keydown' as const }));
    const drained = queue.drainAll();
    expect(drained.length).toBe(2);
    expect(drained[0]!.data1).toBe(10);
    expect(drained[1]!.data1).toBe(20);
    expect(queue.isEmpty).toBe(true);
  });

  test('VanillaEventQueue overflow overwrites the oldest events when post count exceeds MAXEVENTS without a pull', () => {
    const queue = new VanillaEventQueue();
    for (let postIndex = 0; postIndex < VANILLA_MAX_EVENTS + 10; postIndex += 1) {
      queue.post(Object.freeze({ data1: postIndex, data2: 0, data3: 0, type: 'ev_keydown' as const }));
    }
    expect(queue.size).toBe(VANILLA_MAX_EVENTS);
    const drained = queue.drainAll();
    expect(drained.length).toBe(VANILLA_MAX_EVENTS);
    expect(drained[0]!.data1).toBe(10);
    expect(drained[drained.length - 1]!.data1).toBe(VANILLA_MAX_EVENTS + 9);
  });

  test('translateKeyboardMessageToVanillaEvent maps WM_KEYDOWN with Escape scan code to ev_keydown with KEY_ESCAPE', () => {
    const event = translateKeyboardMessageToVanillaEvent(WM_KEYDOWN, 0x1b, buildLParam(SCAN_CODE_ESCAPE));
    expect(event).not.toBeNull();
    expect(event!.type).toBe('ev_keydown');
    expect(event!.data1).toBe(KEY_ESCAPE);
    expect(event!.data2).toBe(0);
    expect(event!.data3).toBe(0);
  });

  test('translateKeyboardMessageToVanillaEvent maps WM_KEYUP with F1 scan code to ev_keyup with KEY_F1', () => {
    const event = translateKeyboardMessageToVanillaEvent(WM_KEYUP, 0x70, buildLParam(SCAN_CODE_F1));
    expect(event).not.toBeNull();
    expect(event!.type).toBe('ev_keyup');
    expect(event!.data1).toBe(KEY_F1);
  });

  test('translateKeyboardMessageToVanillaEvent treats WM_SYSKEYDOWN as ev_keydown (Alt-modified path)', () => {
    const event = translateKeyboardMessageToVanillaEvent(WM_SYSKEYDOWN, VK_F4, buildLParam(SCAN_CODE_F4, false, true));
    expect(event).not.toBeNull();
    expect(event!.type).toBe('ev_keydown');
  });

  test('translateKeyboardMessageToVanillaEvent treats WM_SYSKEYUP as ev_keyup', () => {
    const event = translateKeyboardMessageToVanillaEvent(WM_SYSKEYUP, VK_F4, buildLParam(SCAN_CODE_F4, false, true));
    expect(event).not.toBeNull();
    expect(event!.type).toBe('ev_keyup');
  });

  test('translateKeyboardMessageToVanillaEvent returns null when the scan code is unmapped (translateScanCode returns 0)', () => {
    expect(translateKeyboardMessageToVanillaEvent(WM_KEYDOWN, 0, buildLParam(0))).toBeNull();
  });

  test('translateKeyboardMessageToVanillaEvent returns null when the message is not a keyboard message (e.g. WM_LBUTTONDOWN)', () => {
    expect(translateKeyboardMessageToVanillaEvent(WM_LBUTTONDOWN, 0, 0)).toBeNull();
  });

  test('extractScanCodeFromLParam extracts the scan code from LPARAM bits 16-23', () => {
    expect(extractScanCodeFromLParam(buildLParam(SCAN_CODE_ESCAPE))).toBe(SCAN_CODE_ESCAPE);
    expect(extractScanCodeFromLParam(buildLParam(SCAN_CODE_NUM_5))).toBe(SCAN_CODE_NUM_5);
  });

  test('isAltF4Message returns true only for WM_SYSKEYDOWN with VK_F4 and bit 29 of LPARAM set', () => {
    expect(isAltF4Message(WM_SYSKEYDOWN, VK_F4, buildLParam(SCAN_CODE_F4, false, true))).toBe(true);
    expect(isAltF4Message(WM_SYSKEYDOWN, VK_F4, buildLParam(SCAN_CODE_F4, false, false))).toBe(false);
    expect(isAltF4Message(WM_SYSKEYUP, VK_F4, buildLParam(SCAN_CODE_F4, false, true))).toBe(false);
    expect(isAltF4Message(WM_KEYDOWN, VK_F4, buildLParam(SCAN_CODE_F4, false, true))).toBe(false);
    expect(isAltF4Message(WM_SYSKEYDOWN, 0x1b, buildLParam(SCAN_CODE_ESCAPE, false, true))).toBe(false);
  });

  test('translateMouseButtonMessageToVanillaEvent toggles the left-button bit on WM_LBUTTONDOWN / WM_LBUTTONUP', () => {
    const downTranslation = translateMouseButtonMessageToVanillaEvent(WM_LBUTTONDOWN, 0, 0);
    expect(downTranslation).not.toBeNull();
    expect(downTranslation!.updatedMouseButtonMask).toBe(1 << MOUSE_BUTTON_LEFT);
    expect(downTranslation!.event.type).toBe('ev_mouse');
    expect(downTranslation!.event.data1).toBe(1 << MOUSE_BUTTON_LEFT);

    const upTranslation = translateMouseButtonMessageToVanillaEvent(WM_LBUTTONUP, 0, downTranslation!.updatedMouseButtonMask);
    expect(upTranslation).not.toBeNull();
    expect(upTranslation!.updatedMouseButtonMask).toBe(0);
    expect(upTranslation!.event.data1).toBe(0);
  });

  test('translateMouseButtonMessageToVanillaEvent toggles the right and middle button bits', () => {
    let mouseButtonMask = 0;
    const rightDown = translateMouseButtonMessageToVanillaEvent(WM_RBUTTONDOWN, 0, mouseButtonMask)!;
    mouseButtonMask = rightDown.updatedMouseButtonMask;
    expect(mouseButtonMask).toBe(1 << MOUSE_BUTTON_RIGHT);

    const middleDown = translateMouseButtonMessageToVanillaEvent(WM_MBUTTONDOWN, 0, mouseButtonMask)!;
    mouseButtonMask = middleDown.updatedMouseButtonMask;
    expect(mouseButtonMask).toBe((1 << MOUSE_BUTTON_RIGHT) | (1 << MOUSE_BUTTON_MIDDLE));

    const middleUp = translateMouseButtonMessageToVanillaEvent(WM_MBUTTONUP, 0, mouseButtonMask)!;
    mouseButtonMask = middleUp.updatedMouseButtonMask;
    expect(mouseButtonMask).toBe(1 << MOUSE_BUTTON_RIGHT);

    const rightUp = translateMouseButtonMessageToVanillaEvent(WM_RBUTTONUP, 0, mouseButtonMask)!;
    expect(rightUp.updatedMouseButtonMask).toBe(0);
  });

  test('translateMouseButtonMessageToVanillaEvent recognises WM_XBUTTONDOWN with XBUTTON1 / XBUTTON2 in HIWORD(wParam)', () => {
    const x1Translation = translateMouseButtonMessageToVanillaEvent(WM_XBUTTONDOWN, XBUTTON1 << 16, 0)!;
    expect(x1Translation.updatedMouseButtonMask).toBe(1 << MOUSE_BUTTON_EXTRA1);

    const x2Translation = translateMouseButtonMessageToVanillaEvent(WM_XBUTTONDOWN, XBUTTON2 << 16, 0)!;
    expect(x2Translation.updatedMouseButtonMask).toBe(1 << MOUSE_BUTTON_EXTRA2);

    const x1Up = translateMouseButtonMessageToVanillaEvent(WM_XBUTTONUP, XBUTTON1 << 16, 1 << MOUSE_BUTTON_EXTRA1)!;
    expect(x1Up.updatedMouseButtonMask).toBe(0);
  });

  test('translateMouseButtonMessageToVanillaEvent returns null for unrecognised XBUTTON values', () => {
    expect(translateMouseButtonMessageToVanillaEvent(WM_XBUTTONDOWN, 0x0007 << 16, 0)).toBeNull();
  });

  test('translateMouseButtonMessageToVanillaEvent returns null when the message is not a mouse button message', () => {
    expect(translateMouseButtonMessageToVanillaEvent(WM_KEYDOWN, 0, 0)).toBeNull();
    expect(translateMouseButtonMessageToVanillaEvent(WM_CLOSE, 0, 0)).toBeNull();
  });

  test('translateCloseMessageToVanillaEvent maps WM_CLOSE and WM_QUIT to ev_quit', () => {
    expect(translateCloseMessageToVanillaEvent(WM_CLOSE)!.type).toBe('ev_quit');
    expect(translateCloseMessageToVanillaEvent(WM_QUIT)!.type).toBe('ev_quit');
    expect(translateCloseMessageToVanillaEvent(WM_KEYDOWN)).toBeNull();
  });

  test('translateFocusMessageToFocusState maps WM_SETFOCUS to { hasFocus: true } and WM_KILLFOCUS to { hasFocus: false }', () => {
    expect(translateFocusMessageToFocusState(WM_SETFOCUS)).toEqual({ hasFocus: true });
    expect(translateFocusMessageToFocusState(WM_KILLFOCUS)).toEqual({ hasFocus: false });
    expect(translateFocusMessageToFocusState(WM_KEYDOWN)).toBeNull();
  });

  test('dispatchWin32MessageToVanillaQueue posts a keyboard event for WM_KEYDOWN and reports closeRequested=false', () => {
    const queue = new VanillaEventQueue();
    const result = dispatchWin32MessageToVanillaQueue(queue, buildMessage(WM_KEYDOWN, 0x1b, buildLParam(SCAN_CODE_ESCAPE)), 0);
    expect(result.closeRequested).toBe(false);
    expect(result.focusChange).toBeNull();
    expect(result.updatedMouseButtonMask).toBe(0);
    expect(queue.size).toBe(1);
    expect(queue.pull()!.type).toBe('ev_keydown');
  });

  test('dispatchWin32MessageToVanillaQueue posts both ev_keydown and ev_quit for an Alt-F4 WM_SYSKEYDOWN message', () => {
    const queue = new VanillaEventQueue();
    const result = dispatchWin32MessageToVanillaQueue(queue, buildMessage(WM_SYSKEYDOWN, VK_F4, buildLParam(SCAN_CODE_F4, false, true)), 0);
    expect(result.closeRequested).toBe(true);
    const events = queue.drainAll();
    expect(events.length).toBe(2);
    expect(events.find((event) => event.type === 'ev_keydown')).toBeDefined();
    expect(events.find((event) => event.type === 'ev_quit')).toBeDefined();
  });

  test('dispatchWin32MessageToVanillaQueue posts ev_quit for WM_CLOSE and reports closeRequested=true', () => {
    const queue = new VanillaEventQueue();
    const result = dispatchWin32MessageToVanillaQueue(queue, buildMessage(WM_CLOSE, 0, 0), 0);
    expect(result.closeRequested).toBe(true);
    expect(queue.size).toBe(1);
    expect(queue.pull()!.type).toBe('ev_quit');
  });

  test('dispatchWin32MessageToVanillaQueue posts ev_mouse and updates the mouse-button mask across consecutive messages', () => {
    const queue = new VanillaEventQueue();
    let mouseButtonMask = 0;
    let result = dispatchWin32MessageToVanillaQueue(queue, buildMessage(WM_LBUTTONDOWN, 0, 0), mouseButtonMask);
    mouseButtonMask = result.updatedMouseButtonMask;
    expect(mouseButtonMask).toBe(1 << MOUSE_BUTTON_LEFT);

    result = dispatchWin32MessageToVanillaQueue(queue, buildMessage(WM_RBUTTONDOWN, 0, 0), mouseButtonMask);
    mouseButtonMask = result.updatedMouseButtonMask;
    expect(mouseButtonMask).toBe((1 << MOUSE_BUTTON_LEFT) | (1 << MOUSE_BUTTON_RIGHT));

    result = dispatchWin32MessageToVanillaQueue(queue, buildMessage(WM_LBUTTONUP, 0, 0), mouseButtonMask);
    mouseButtonMask = result.updatedMouseButtonMask;
    expect(mouseButtonMask).toBe(1 << MOUSE_BUTTON_RIGHT);

    const events = queue.drainAll();
    expect(events.length).toBe(3);
    expect(events[0]!.data1).toBe(1 << MOUSE_BUTTON_LEFT);
    expect(events[1]!.data1).toBe((1 << MOUSE_BUTTON_LEFT) | (1 << MOUSE_BUTTON_RIGHT));
    expect(events[2]!.data1).toBe(1 << MOUSE_BUTTON_RIGHT);
  });

  test('dispatchWin32MessageToVanillaQueue reports focus change for WM_SETFOCUS / WM_KILLFOCUS without queuing an event', () => {
    const queue = new VanillaEventQueue();
    const focusResult = dispatchWin32MessageToVanillaQueue(queue, buildMessage(WM_SETFOCUS, 0, 0), 0);
    expect(focusResult.focusChange).toEqual({ hasFocus: true });
    expect(queue.isEmpty).toBe(true);

    const killResult = dispatchWin32MessageToVanillaQueue(queue, buildMessage(WM_KILLFOCUS, 0, 0), 0);
    expect(killResult.focusChange).toEqual({ hasFocus: false });
    expect(queue.isEmpty).toBe(true);
  });

  test('every queued event is frozen', () => {
    const queue = new VanillaEventQueue();
    dispatchWin32MessageToVanillaQueue(queue, buildMessage(WM_KEYDOWN, 0x1b, buildLParam(SCAN_CODE_ESCAPE)), 0);
    const pulled = queue.pull()!;
    expect(Object.isFrozen(pulled)).toBe(true);
  });
});
