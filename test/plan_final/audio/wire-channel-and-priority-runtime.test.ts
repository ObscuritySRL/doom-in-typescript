import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { NORM_PITCH, NORM_PRIORITY } from '../../../src/audio/channels.ts';
import { VANILLA_SFX_CHANNEL_COUNT, createChannelAndPriorityRuntime } from '../../../src/vanilla/channelAndPriorityRuntime.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const RUNTIME_RELATIVE_PATH = 'src/vanilla/channelAndPriorityRuntime.ts';
const RUNTIME_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, RUNTIME_RELATIVE_PATH);

const HIGH_PRIORITY = 32;
const NORMAL_PRIORITY = NORM_PRIORITY;
const LOW_PRIORITY = 128;

describe('plan_final audio: wire-channel-and-priority-runtime', () => {
  test('src/vanilla/channelAndPriorityRuntime.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(RUNTIME_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(RUNTIME_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/channelAndPriorityRuntime.ts cites plan_final step 11-002 in a top-of-file comment', () => {
    const fileText = readFileSync(RUNTIME_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('11-002');
    expect(fileText).toContain('createChannelAndPriorityRuntime');
  });

  test('src/vanilla/channelAndPriorityRuntime.ts imports the read-only allocator helpers from src/audio/channels.ts without modifying them', () => {
    const fileText = readFileSync(RUNTIME_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../audio/channels.ts'");
    expect(fileText).toContain('allocateChannel');
    expect(fileText).toContain('findChannelByOrigin');
    expect(fileText).toContain('findEvictableChannel');
    expect(fileText).toContain('stopChannel');
  });

  test('VANILLA_SFX_CHANNEL_COUNT pins the canonical 8-channel allocator depth', () => {
    expect(VANILLA_SFX_CHANNEL_COUNT).toBe(8);
  });

  test('createChannelAndPriorityRuntime returns a frozen runtime with a fresh ChannelTable of capacity 8', () => {
    const runtime = createChannelAndPriorityRuntime();
    expect(Object.isFrozen(runtime)).toBe(true);
    expect(runtime.table.capacity).toBe(8);
    expect(runtime.table.channels.length).toBe(8);
    expect(runtime.occupiedCount()).toBe(0);
  });

  test('playSound on an empty table places the SFX in the first free slot and reports no eviction', () => {
    const runtime = createChannelAndPriorityRuntime();
    const result = runtime.playSound({ origin: 1, priority: NORMAL_PRIORITY, sfxId: 7, handle: 1, pitch: NORM_PITCH });
    expect(result.channelIndex).toBe(0);
    expect(result.evicted).toBeNull();
    expect(runtime.occupiedCount()).toBe(1);
  });

  test('playSound same-origin replacement evicts the existing channel and reports the evicted snapshot', () => {
    const runtime = createChannelAndPriorityRuntime();
    runtime.playSound({ origin: 42, priority: NORMAL_PRIORITY, sfxId: 5, handle: 1, pitch: NORM_PITCH });
    const replaceResult = runtime.playSound({ origin: 42, priority: NORMAL_PRIORITY, sfxId: 9, handle: 2, pitch: NORM_PITCH });
    expect(replaceResult.channelIndex).toBe(0);
    expect(replaceResult.evicted).not.toBeNull();
    expect(replaceResult.evicted!.sfxId).toBe(5);
    expect(replaceResult.evicted!.origin).toBe(42);
    expect(runtime.occupiedCount()).toBe(1);
  });

  test('playSound with a higher-priority request evicts the lowest-priority existing channel when no free slot remains', () => {
    const runtime = createChannelAndPriorityRuntime();
    for (let originIndex = 1; originIndex <= VANILLA_SFX_CHANNEL_COUNT; originIndex += 1) {
      runtime.playSound({ origin: originIndex, priority: LOW_PRIORITY, sfxId: originIndex, handle: originIndex, pitch: NORM_PITCH });
    }
    expect(runtime.occupiedCount()).toBe(VANILLA_SFX_CHANNEL_COUNT);
    const highResult = runtime.playSound({ origin: 100, priority: HIGH_PRIORITY, sfxId: 99, handle: 100, pitch: NORM_PITCH });
    expect(highResult.channelIndex).toBe(0);
    expect(highResult.evicted).not.toBeNull();
    expect(highResult.evicted!.priority).toBe(LOW_PRIORITY);
  });

  test('playSound returns channelIndex=null when every slot is occupied by a strictly more important sound', () => {
    const runtime = createChannelAndPriorityRuntime();
    for (let originIndex = 1; originIndex <= VANILLA_SFX_CHANNEL_COUNT; originIndex += 1) {
      runtime.playSound({ origin: originIndex, priority: HIGH_PRIORITY, sfxId: originIndex, handle: originIndex, pitch: NORM_PITCH });
    }
    expect(runtime.occupiedCount()).toBe(VANILLA_SFX_CHANNEL_COUNT);
    const dropResult = runtime.playSound({ origin: 100, priority: LOW_PRIORITY, sfxId: 99, handle: 100, pitch: NORM_PITCH });
    expect(dropResult.channelIndex).toBeNull();
    expect(dropResult.evicted).toBeNull();
  });

  test('stopChannel clears the named slot and decrements occupiedCount', () => {
    const runtime = createChannelAndPriorityRuntime();
    runtime.playSound({ origin: 1, priority: NORMAL_PRIORITY, sfxId: 7, handle: 1, pitch: NORM_PITCH });
    runtime.playSound({ origin: 2, priority: NORMAL_PRIORITY, sfxId: 9, handle: 2, pitch: NORM_PITCH });
    expect(runtime.occupiedCount()).toBe(2);
    runtime.stopChannel(0);
    expect(runtime.occupiedCount()).toBe(1);
    expect(runtime.table.channels[0]!.sfxId).toBeNull();
  });

  test('stopSound stops the channel matching the supplied origin and returns its index', () => {
    const runtime = createChannelAndPriorityRuntime();
    runtime.playSound({ origin: 1, priority: NORMAL_PRIORITY, sfxId: 7, handle: 1, pitch: NORM_PITCH });
    runtime.playSound({ origin: 2, priority: NORMAL_PRIORITY, sfxId: 9, handle: 2, pitch: NORM_PITCH });
    const stoppedIndex = runtime.stopSound(2);
    expect(stoppedIndex).toBe(1);
    expect(runtime.table.channels[1]!.sfxId).toBeNull();
  });

  test('stopSound returns null when no channel matches the supplied origin', () => {
    const runtime = createChannelAndPriorityRuntime();
    runtime.playSound({ origin: 1, priority: NORMAL_PRIORITY, sfxId: 7, handle: 1, pitch: NORM_PITCH });
    expect(runtime.stopSound(42)).toBeNull();
  });

  test('evictBySameOrigin clears the channel matching the supplied origin and returns its index', () => {
    const runtime = createChannelAndPriorityRuntime();
    runtime.playSound({ origin: 42, priority: NORMAL_PRIORITY, sfxId: 7, handle: 1, pitch: NORM_PITCH });
    expect(runtime.evictBySameOrigin(42)).toBe(0);
    expect(runtime.table.channels[0]!.sfxId).toBeNull();
  });

  test('evictBySameOrigin returns null when no channel matches the supplied origin', () => {
    const runtime = createChannelAndPriorityRuntime();
    expect(runtime.evictBySameOrigin(42)).toBeNull();
  });

  test('playSound with origin=null stacks anonymous sounds across distinct free channels (no origin dedup)', () => {
    const runtime = createChannelAndPriorityRuntime();
    runtime.playSound({ origin: null, priority: NORMAL_PRIORITY, sfxId: 7, handle: 1, pitch: NORM_PITCH });
    runtime.playSound({ origin: null, priority: NORMAL_PRIORITY, sfxId: 9, handle: 2, pitch: NORM_PITCH });
    expect(runtime.occupiedCount()).toBe(2);
  });

  test('the runtime table reference is the same object across calls (mirroring vanilla file-scope channels[])', () => {
    const runtime = createChannelAndPriorityRuntime();
    const firstReference = runtime.table;
    runtime.playSound({ origin: 1, priority: NORMAL_PRIORITY, sfxId: 7, handle: 1, pitch: NORM_PITCH });
    runtime.playSound({ origin: 2, priority: NORMAL_PRIORITY, sfxId: 9, handle: 2, pitch: NORM_PITCH });
    expect(runtime.table).toBe(firstReference);
  });

  test('createChannelAndPriorityRuntime honors a capacity override (for test fixtures that want smaller pools)', () => {
    const runtime = createChannelAndPriorityRuntime({ capacity: 2 });
    expect(runtime.table.capacity).toBe(2);
    expect(runtime.table.channels.length).toBe(2);
  });
});
