import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { VanillaEventQueue } from '../../../src/vanilla/eventQueue.ts';
import { VANILLA_TIC_RATE_HZ, VanillaInputTraceRecorder, VanillaInputTraceReplayer, convertInputScriptEventToVanillaEvent, convertVanillaEventToInputScriptEvent } from '../../../src/vanilla/inputTrace.ts';
import type { InputScriptPayload } from '../../../src/oracles/inputScript.ts';
import type { VanillaEvent } from '../../../src/vanilla/eventQueue.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const INPUT_TRACE_RELATIVE_PATH = 'src/vanilla/inputTrace.ts';
const INPUT_TRACE_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, INPUT_TRACE_RELATIVE_PATH);

describe('plan_final launch: wire-deterministic-input-trace', () => {
  test('src/vanilla/inputTrace.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(INPUT_TRACE_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(INPUT_TRACE_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/inputTrace.ts cites plan_final step 03-008 in a top-of-file comment', () => {
    const fileText = readFileSync(INPUT_TRACE_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('03-008');
    expect(fileText).toContain('VanillaInputTraceRecorder');
    expect(fileText).toContain('VanillaInputTraceReplayer');
  });

  test('VANILLA_TIC_RATE_HZ pins the canonical 35Hz reference tic rate', () => {
    expect(VANILLA_TIC_RATE_HZ).toBe(35);
  });

  test('convertVanillaEventToInputScriptEvent maps ev_keydown to a key-down script entry preserving the scan code', () => {
    const event: VanillaEvent = Object.freeze({ data1: 27, data2: 0, data3: 0, type: 'ev_keydown' });
    const scriptEvent = convertVanillaEventToInputScriptEvent(event, 7);
    expect(scriptEvent).not.toBeNull();
    if (scriptEvent && scriptEvent.kind === 'key-down') {
      expect(scriptEvent.scanCode).toBe(27);
      expect(scriptEvent.tic).toBe(7);
    }
  });

  test('convertVanillaEventToInputScriptEvent maps ev_keyup to a key-up script entry', () => {
    const event: VanillaEvent = Object.freeze({ data1: 0x70, data2: 0, data3: 0, type: 'ev_keyup' });
    const scriptEvent = convertVanillaEventToInputScriptEvent(event, 5);
    expect(scriptEvent).not.toBeNull();
    if (scriptEvent && scriptEvent.kind === 'key-up') {
      expect(scriptEvent.scanCode).toBe(0x70);
      expect(scriptEvent.tic).toBe(5);
    }
  });

  test('convertVanillaEventToInputScriptEvent maps ev_mouse with a single-bit mask to a mouse-button-down script entry', () => {
    const event: VanillaEvent = Object.freeze({ data1: 0b0_0100, data2: 0, data3: 0, type: 'ev_mouse' });
    const scriptEvent = convertVanillaEventToInputScriptEvent(event, 0);
    expect(scriptEvent).not.toBeNull();
    if (scriptEvent && scriptEvent.kind === 'mouse-button-down') {
      expect(scriptEvent.button).toBe(2);
    }
  });

  test('convertVanillaEventToInputScriptEvent returns null for ev_mouse with an empty mask (no button-press info)', () => {
    const event: VanillaEvent = Object.freeze({ data1: 0, data2: 0, data3: 0, type: 'ev_mouse' });
    expect(convertVanillaEventToInputScriptEvent(event, 0)).toBeNull();
  });

  test('convertVanillaEventToInputScriptEvent maps ev_quit to a quit script entry', () => {
    const event: VanillaEvent = Object.freeze({ data1: 0, data2: 0, data3: 0, type: 'ev_quit' });
    const scriptEvent = convertVanillaEventToInputScriptEvent(event, 12);
    expect(scriptEvent).not.toBeNull();
    if (scriptEvent && scriptEvent.kind === 'quit') {
      expect(scriptEvent.tic).toBe(12);
    }
  });

  test('convertInputScriptEventToVanillaEvent maps key-down/key-up to ev_keydown/ev_keyup with scanCode in data1', () => {
    const keydownEvent = convertInputScriptEventToVanillaEvent({ kind: 'key-down', scanCode: 27, tic: 0 });
    expect(keydownEvent).toEqual({ data1: 27, data2: 0, data3: 0, type: 'ev_keydown' });
    const keyupEvent = convertInputScriptEventToVanillaEvent({ kind: 'key-up', scanCode: 0x70, tic: 0 });
    expect(keyupEvent).toEqual({ data1: 0x70, data2: 0, data3: 0, type: 'ev_keyup' });
  });

  test('convertInputScriptEventToVanillaEvent maps mouse-button-down to ev_mouse with the button bit set in data1', () => {
    const event = convertInputScriptEventToVanillaEvent({ button: 1, kind: 'mouse-button-down', tic: 0 });
    expect(event).toEqual({ data1: 0b10, data2: 0, data3: 0, type: 'ev_mouse' });
  });

  test('convertInputScriptEventToVanillaEvent maps mouse-button-up to ev_mouse with zero mask', () => {
    const event = convertInputScriptEventToVanillaEvent({ button: 0, kind: 'mouse-button-up', tic: 0 });
    expect(event).toEqual({ data1: 0, data2: 0, data3: 0, type: 'ev_mouse' });
  });

  test('convertInputScriptEventToVanillaEvent maps quit to ev_quit', () => {
    const event = convertInputScriptEventToVanillaEvent({ kind: 'quit', tic: 0 });
    expect(event).toEqual({ data1: 0, data2: 0, data3: 0, type: 'ev_quit' });
  });

  test('convertInputScriptEventToVanillaEvent returns null for mouse-move (no VanillaEvent analog)', () => {
    expect(convertInputScriptEventToVanillaEvent({ deltaX: 5, deltaY: -2, kind: 'mouse-move', tic: 0 })).toBeNull();
  });

  test('VanillaInputTraceRecorder starts at tic 0 with an empty event list', () => {
    const recorder = new VanillaInputTraceRecorder({ description: 'test', targetRunMode: 'title-loop' });
    expect(recorder.currentTic).toBe(0);
    expect(recorder.recordedEventCount).toBe(0);
  });

  test('VanillaInputTraceRecorder.advanceTic increments the tic counter by 1', () => {
    const recorder = new VanillaInputTraceRecorder({ description: 'test', targetRunMode: 'title-loop' });
    recorder.advanceTic();
    expect(recorder.currentTic).toBe(1);
    recorder.advanceTic();
    expect(recorder.currentTic).toBe(2);
  });

  test('VanillaInputTraceRecorder.record tags events with the current tic and appends them to the live list', () => {
    const recorder = new VanillaInputTraceRecorder({ description: 'test', targetRunMode: 'title-loop' });
    recorder.advanceTic();
    recorder.record({ data1: 27, data2: 0, data3: 0, type: 'ev_keydown' });
    recorder.advanceTic();
    recorder.record({ data1: 0x1c, data2: 0, data3: 0, type: 'ev_keyup' });
    expect(recorder.recordedEventCount).toBe(2);
    const payload = recorder.freezePayload();
    expect(payload.events[0]).toEqual({ kind: 'key-down', scanCode: 27, tic: 1 });
    expect(payload.events[1]).toEqual({ kind: 'key-up', scanCode: 0x1c, tic: 2 });
  });

  test('VanillaInputTraceRecorder.freezePayload returns a frozen InputScriptPayload with description, mode, and default 35Hz tic rate', () => {
    const recorder = new VanillaInputTraceRecorder({ description: 'sample trace', targetRunMode: 'demo-playback' });
    recorder.advanceTic();
    recorder.record({ data1: 27, data2: 0, data3: 0, type: 'ev_keydown' });
    const payload: InputScriptPayload = recorder.freezePayload();
    expect(Object.isFrozen(payload)).toBe(true);
    expect(payload.description).toBe('sample trace');
    expect(payload.targetRunMode).toBe('demo-playback');
    expect(payload.ticRateHz).toBe(VANILLA_TIC_RATE_HZ);
    expect(Object.isFrozen(payload.events)).toBe(true);
  });

  test('VanillaInputTraceRecorder honors a caller-supplied ticRateHz', () => {
    const recorder = new VanillaInputTraceRecorder({ description: 'sample', targetRunMode: 'title-loop', ticRateHz: 70 });
    recorder.advanceTic();
    const payload = recorder.freezePayload();
    expect(payload.ticRateHz).toBe(70);
  });

  test('VanillaInputTraceReplayer.replayTic posts every event whose tic matches into the supplied queue', () => {
    const payload: InputScriptPayload = Object.freeze({
      description: 'sample',
      events: Object.freeze([Object.freeze({ kind: 'key-down', scanCode: 27, tic: 1 } as const), Object.freeze({ kind: 'key-up', scanCode: 27, tic: 1 } as const), Object.freeze({ kind: 'key-down', scanCode: 0x1c, tic: 3 } as const)]),
      targetRunMode: 'title-loop',
      ticRateHz: VANILLA_TIC_RATE_HZ,
      totalTics: 4,
    });
    const replayer = new VanillaInputTraceReplayer(payload);
    const queue = new VanillaEventQueue();
    expect(replayer.replayTic(0, queue)).toBe(0);
    expect(queue.size).toBe(0);
    expect(replayer.replayTic(1, queue)).toBe(2);
    expect(queue.size).toBe(2);
    expect(queue.pull()!.type).toBe('ev_keydown');
    expect(queue.pull()!.type).toBe('ev_keyup');
    expect(replayer.replayTic(2, queue)).toBe(0);
    expect(replayer.replayTic(3, queue)).toBe(1);
    expect(queue.size).toBe(1);
  });

  test('VanillaInputTraceReplayer skips events whose tic is less than the supplied tic (defensive against caller misuse)', () => {
    const payload: InputScriptPayload = Object.freeze({
      description: 'sample',
      events: Object.freeze([Object.freeze({ kind: 'key-down', scanCode: 27, tic: 1 } as const), Object.freeze({ kind: 'key-down', scanCode: 0x1c, tic: 5 } as const)]),
      targetRunMode: 'title-loop',
      ticRateHz: VANILLA_TIC_RATE_HZ,
      totalTics: 6,
    });
    const replayer = new VanillaInputTraceReplayer(payload);
    const queue = new VanillaEventQueue();
    expect(replayer.replayTic(5, queue)).toBe(1);
    expect(queue.size).toBe(1);
    expect(replayer.pendingEventCount).toBe(0);
  });

  test('VanillaInputTraceReplayer skips mouse-move entries during replay (no VanillaEvent analog)', () => {
    const payload: InputScriptPayload = Object.freeze({
      description: 'sample',
      events: Object.freeze([Object.freeze({ deltaX: 5, deltaY: -2, kind: 'mouse-move', tic: 0 } as const), Object.freeze({ kind: 'key-down', scanCode: 27, tic: 0 } as const)]),
      targetRunMode: 'title-loop',
      ticRateHz: VANILLA_TIC_RATE_HZ,
      totalTics: 1,
    });
    const replayer = new VanillaInputTraceReplayer(payload);
    const queue = new VanillaEventQueue();
    expect(replayer.replayTic(0, queue)).toBe(1);
    expect(queue.size).toBe(1);
  });

  test('Recorder + Replayer round-trip preserves every supported event kind in order', () => {
    const recorder = new VanillaInputTraceRecorder({ description: 'roundtrip', targetRunMode: 'title-loop' });
    recorder.advanceTic();
    recorder.record({ data1: 27, data2: 0, data3: 0, type: 'ev_keydown' });
    recorder.record({ data1: 0b0_0001, data2: 0, data3: 0, type: 'ev_mouse' });
    recorder.advanceTic();
    recorder.record({ data1: 0x1c, data2: 0, data3: 0, type: 'ev_keyup' });
    recorder.advanceTic();
    recorder.record({ data1: 0, data2: 0, data3: 0, type: 'ev_quit' });
    const payload = recorder.freezePayload();
    expect(payload.events.length).toBe(4);

    const replayer = new VanillaInputTraceReplayer(payload);
    const queue = new VanillaEventQueue();
    replayer.replayTic(1, queue);
    replayer.replayTic(2, queue);
    replayer.replayTic(3, queue);
    const drained = queue.drainAll();
    expect(drained.length).toBe(4);
    expect(drained[0]!.type).toBe('ev_keydown');
    expect(drained[1]!.type).toBe('ev_mouse');
    expect(drained[2]!.type).toBe('ev_keyup');
    expect(drained[3]!.type).toBe('ev_quit');
  });
});
