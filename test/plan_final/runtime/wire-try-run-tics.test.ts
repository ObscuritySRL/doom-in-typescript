import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { BACKUPTICS, TicRunner } from '../../../src/bootstrap/tryRunTics.ts';
import { EMPTY_TICCMD } from '../../../src/input/ticcmd.ts';
import { VanillaEventQueue, WM_KEYDOWN, dispatchWin32MessageToVanillaQueue } from '../../../src/vanilla/eventQueue.ts';
import { buildVanillaTicCallbacks, createVanillaTryRunTicsState, runVanillaTryRunTicsDriver } from '../../../src/vanilla/wireTryRunTics.ts';
import type { VanillaTryRunTicsState } from '../../../src/vanilla/wireTryRunTics.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_TRY_RUN_TICS_RELATIVE_PATH = 'src/vanilla/wireTryRunTics.ts';
const WIRE_TRY_RUN_TICS_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, WIRE_TRY_RUN_TICS_RELATIVE_PATH);

const SCAN_CODE_ESCAPE_LPARAM = 0x01_0000;

function buildAdvancingTimeSource(steps: readonly number[]): { getTime: () => number } {
  let index = 0;
  return {
    getTime: (): number => {
      const value = steps[Math.min(index, steps.length - 1)]!;
      if (index < steps.length - 1) {
        index += 1;
      }
      return value;
    },
  };
}

describe('plan_final runtime: wire-try-run-tics', () => {
  test('src/vanilla/wireTryRunTics.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(WIRE_TRY_RUN_TICS_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(WIRE_TRY_RUN_TICS_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/wireTryRunTics.ts cites plan_final step 04-004 in the top-of-file comment', () => {
    const fileText = readFileSync(WIRE_TRY_RUN_TICS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('04-004');
    expect(fileText).toContain('runVanillaTryRunTicsDriver');
    expect(fileText).toContain('buildVanillaTicCallbacks');
  });

  test('src/vanilla/wireTryRunTics.ts imports the read-only TicRunner and EMPTY_TICCMD without modifying them', () => {
    const fileText = readFileSync(WIRE_TRY_RUN_TICS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../bootstrap/tryRunTics.ts'");
    expect(fileText).toContain("from '../input/ticcmd.ts'");
    expect(fileText).toContain("from './eventQueue.ts'");
  });

  test('createVanillaTryRunTicsState seeds every counter at zero and the drainedEvents log as empty', () => {
    const state = createVanillaTryRunTicsState();
    expect(state.startTicInvocations).toBe(0);
    expect(state.buildTiccmdInvocations).toBe(0);
    expect(state.tickerInvocations).toBe(0);
    expect(state.advanceDemoInvocations).toBe(0);
    expect(state.renderInvalidated).toBe(false);
    expect(state.advanceDemoRequested).toBe(false);
    expect(state.drainedEvents).toEqual([]);
  });

  test('buildVanillaTicCallbacks returns an object with every TicCallbacks slot', () => {
    const state = createVanillaTryRunTicsState();
    const callbacks = buildVanillaTicCallbacks(state, new VanillaEventQueue());
    expect(typeof callbacks.startTic).toBe('function');
    expect(typeof callbacks.buildTiccmd).toBe('function');
    expect(typeof callbacks.ticker).toBe('function');
    expect(typeof callbacks.doAdvanceDemo).toBe('function');
    expect(typeof callbacks.advancedemo).toBe('boolean');
  });

  test('callbacks.buildTiccmd returns EMPTY_TICCMD and increments the invocation counter', () => {
    const state = createVanillaTryRunTicsState();
    const callbacks = buildVanillaTicCallbacks(state, new VanillaEventQueue());
    const ticCommand = callbacks.buildTiccmd();
    expect(ticCommand).toBe(EMPTY_TICCMD);
    expect(state.buildTiccmdInvocations).toBe(1);
  });

  test('callbacks.startTic drains every queued event into state.drainedEvents in FIFO order', () => {
    const state = createVanillaTryRunTicsState();
    const queue = new VanillaEventQueue();
    dispatchWin32MessageToVanillaQueue(queue, { lParam: SCAN_CODE_ESCAPE_LPARAM, messageId: WM_KEYDOWN, wParam: 0x1b }, 0);
    const callbacks = buildVanillaTicCallbacks(state, queue);
    callbacks.startTic();
    expect(state.startTicInvocations).toBe(1);
    expect(state.drainedEvents.length).toBe(1);
    expect(state.drainedEvents[0]!.type).toBe('ev_keydown');
    expect(queue.isEmpty).toBe(true);
  });

  test('callbacks.ticker increments the ticker counter and sets renderInvalidated=true', () => {
    const state = createVanillaTryRunTicsState();
    const callbacks = buildVanillaTicCallbacks(state, new VanillaEventQueue());
    expect(state.renderInvalidated).toBe(false);
    callbacks.ticker();
    expect(state.tickerInvocations).toBe(1);
    expect(state.renderInvalidated).toBe(true);
  });

  test('callbacks.advancedemo proxies state.advanceDemoRequested live (reads at each access)', () => {
    const state = createVanillaTryRunTicsState();
    const callbacks = buildVanillaTicCallbacks(state, new VanillaEventQueue());
    expect(callbacks.advancedemo).toBe(false);
    state.advanceDemoRequested = true;
    expect(callbacks.advancedemo).toBe(true);
    state.advanceDemoRequested = false;
    expect(callbacks.advancedemo).toBe(false);
  });

  test('callbacks.doAdvanceDemo increments the advanceDemoInvocations counter and clears advanceDemoRequested', () => {
    const state = createVanillaTryRunTicsState();
    const callbacks = buildVanillaTicCallbacks(state, new VanillaEventQueue());
    state.advanceDemoRequested = true;
    callbacks.doAdvanceDemo();
    expect(state.advanceDemoInvocations).toBe(1);
    expect(state.advanceDemoRequested).toBe(false);
  });

  test('runVanillaTryRunTicsDriver with timeSource advancing 0→1 executes exactly one tic', () => {
    const runner = new TicRunner();
    const state = createVanillaTryRunTicsState();
    const queue = new VanillaEventQueue();
    const ticsExecuted = runVanillaTryRunTicsDriver(runner, buildAdvancingTimeSource([1]), state, queue);
    expect(ticsExecuted).toBe(1);
    expect(state.startTicInvocations).toBe(1);
    expect(state.buildTiccmdInvocations).toBe(1);
    expect(state.tickerInvocations).toBe(1);
    expect(state.renderInvalidated).toBe(true);
    expect(runner.gametic).toBe(1);
    expect(runner.maketic).toBe(1);
  });

  test('runVanillaTryRunTicsDriver with timeSource advancing 0→3 executes three tics in order', () => {
    const runner = new TicRunner();
    const state = createVanillaTryRunTicsState();
    const queue = new VanillaEventQueue();
    const ticsExecuted = runVanillaTryRunTicsDriver(runner, buildAdvancingTimeSource([3]), state, queue);
    expect(ticsExecuted).toBe(3);
    expect(state.startTicInvocations).toBe(3);
    expect(state.buildTiccmdInvocations).toBe(3);
    expect(state.tickerInvocations).toBe(3);
    expect(runner.gametic).toBe(3);
  });

  test('runVanillaTryRunTicsDriver with the same timeSource value executes zero tics', () => {
    const runner = new TicRunner();
    const state = createVanillaTryRunTicsState();
    const queue = new VanillaEventQueue();
    const firstRun = runVanillaTryRunTicsDriver(runner, buildAdvancingTimeSource([1]), state, queue);
    expect(firstRun).toBe(1);
    const secondRun = runVanillaTryRunTicsDriver(runner, buildAdvancingTimeSource([1]), state, queue);
    expect(secondRun).toBe(0);
    expect(state.tickerInvocations).toBe(1);
  });

  test('runVanillaTryRunTicsDriver caps newly-built ticcmds at BACKUPTICS (circular buffer protection)', () => {
    const runner = new TicRunner();
    const state = createVanillaTryRunTicsState();
    const queue = new VanillaEventQueue();
    const ticsExecuted = runVanillaTryRunTicsDriver(runner, buildAdvancingTimeSource([BACKUPTICS + 5]), state, queue);
    expect(ticsExecuted).toBe(BACKUPTICS);
    expect(state.buildTiccmdInvocations).toBe(BACKUPTICS);
    expect(state.tickerInvocations).toBe(BACKUPTICS);
  });

  test('runVanillaTryRunTicsDriver drains events posted between startTic calls into the state log', () => {
    const runner = new TicRunner();
    const state = createVanillaTryRunTicsState();
    const queue = new VanillaEventQueue();
    dispatchWin32MessageToVanillaQueue(queue, { lParam: SCAN_CODE_ESCAPE_LPARAM, messageId: WM_KEYDOWN, wParam: 0x1b }, 0);
    runVanillaTryRunTicsDriver(runner, buildAdvancingTimeSource([1]), state, queue);
    expect(state.drainedEvents.length).toBe(1);
    expect(state.drainedEvents[0]!.type).toBe('ev_keydown');
  });

  test('runVanillaTryRunTicsDriver triggers doAdvanceDemo when advanceDemoRequested=true', () => {
    const runner = new TicRunner();
    const state = createVanillaTryRunTicsState();
    state.advanceDemoRequested = true;
    const queue = new VanillaEventQueue();
    runVanillaTryRunTicsDriver(runner, buildAdvancingTimeSource([1]), state, queue);
    expect(state.advanceDemoInvocations).toBe(1);
    expect(state.advanceDemoRequested).toBe(false);
  });

  test('runVanillaTryRunTicsDriver does NOT trigger doAdvanceDemo when advanceDemoRequested=false', () => {
    const runner = new TicRunner();
    const state: VanillaTryRunTicsState = createVanillaTryRunTicsState();
    expect(state.advanceDemoRequested).toBe(false);
    const queue = new VanillaEventQueue();
    runVanillaTryRunTicsDriver(runner, buildAdvancingTimeSource([1]), state, queue);
    expect(state.advanceDemoInvocations).toBe(0);
  });
});
