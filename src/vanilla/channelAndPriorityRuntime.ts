/**
 * Vanilla DOOM 1.9 SFX channel + priority runtime.
 *
 * Plan_final step `11-002` (lane: audio) wires the eight-channel SFX
 * allocator, the same-origin replacement rule (a new SFX from the
 * same `mobj_t* origin` evicts the old one on its channel), the
 * priority eviction rule (when no free channel exists, the lowest
 * existing priority loses if the new SFX outranks it), and the
 * stop/update order into a single frozen runtime artifact the mixer
 * consumes per-tic.
 *
 * The wrapper imports the read-only allocator/evictor helpers from
 * `src/audio/channels.ts` (`createChannelTable`, `findFreeChannel`,
 * `findChannelByOrigin`, `findEvictableChannel`, `allocateChannel`,
 * `stopChannel`, `stopSound`, `getOccupiedChannelCount`) and exposes
 * them through a frozen façade plus a small `playSound(request)`
 * helper that composes the four canonical S_StartSound branches
 * (same-origin replace, free slot, evict lowest priority, drop).
 *
 * The runtime artifact carries a mutable {@link ChannelTable} per
 * vanilla file-scope global; the façade itself is frozen so
 * downstream subsystems cannot replace the channel-table reference.
 * Stop/update order matches vanilla `S_UpdateSounds` (stop dead
 * channels before allocating new ones).
 *
 * @example
 * ```ts
 * import { createChannelAndPriorityRuntime } from './channelAndPriorityRuntime.ts';
 *
 * const audio = createChannelAndPriorityRuntime();
 * audio.playSound({ origin: 42, priority: 64, sfxId: 7, handle: 1, pitch: 128 });
 * audio.occupiedCount();        // 1
 * audio.stopSound(42);          // returns 0 (the channel index just freed)
 * ```
 */

import type { AllocateChannelRequest, Channel, ChannelTable } from '../audio/channels.ts';
import { NUM_CHANNELS, allocateChannel, createChannelTable, findChannelByOrigin, findEvictableChannel, findFreeChannel, getOccupiedChannelCount, stopChannel, stopSound } from '../audio/channels.ts';

/** Eight-channel allocator depth (`NUM_CHANNELS` from `src/audio/channels.ts`). */
export const VANILLA_SFX_CHANNEL_COUNT = NUM_CHANNELS;

/**
 * One play request fed into {@link ChannelAndPriorityRuntime.playSound}.
 * Mirrors {@link AllocateChannelRequest} verbatim; redeclared here so
 * downstream subsystems can import a single canonical type from the
 * `src/vanilla/` surface.
 */
export type SfxPlayRequest = AllocateChannelRequest;

/**
 * Result of a {@link ChannelAndPriorityRuntime.playSound} call.  When
 * the SFX was placed on a channel, `channelIndex` is the 0-based slot
 * and `evicted` is the {@link Channel} that was overwritten (or
 * `null` when the slot was free).  When the SFX could not be placed
 * (priority lost vs every existing channel), `channelIndex` is
 * `null` and `evicted` is `null`.
 */
export interface SfxPlayResult {
  readonly channelIndex: number | null;
  readonly evicted: Channel | null;
}

/**
 * Frozen runtime artifact assembled by
 * {@link createChannelAndPriorityRuntime}.  The `table` reference is
 * mutable per-tic (vanilla `channels[8]` is a file-scope global);
 * the façade itself is frozen so downstream subsystems cannot replace
 * the table reference.
 */
export interface ChannelAndPriorityRuntime {
  readonly evictBySameOrigin: (origin: number | null) => number | null;
  readonly occupiedCount: () => number;
  readonly playSound: (request: SfxPlayRequest) => SfxPlayResult;
  readonly stopChannel: (channelIndex: number) => void;
  readonly stopSound: (origin: number | null) => number | null;
  readonly table: ChannelTable;
}

function snapshotChannel(channel: Channel): Channel {
  return Object.freeze({ ...channel });
}

/**
 * Build a fresh {@link ChannelAndPriorityRuntime} backed by a new
 * eight-channel {@link ChannelTable}.  The default capacity matches
 * the canonical {@link VANILLA_SFX_CHANNEL_COUNT}; callers may
 * override for tests by supplying `{ capacity: <N> }`.
 *
 * @param options Optional capacity override.
 * @returns A frozen façade ready to be wired into the mixer.
 *
 * @example
 * ```ts
 * import { createChannelAndPriorityRuntime } from './channelAndPriorityRuntime.ts';
 *
 * const audio = createChannelAndPriorityRuntime();
 * audio.playSound({ origin: 1, priority: 64, sfxId: 7, handle: 1, pitch: 128 });
 * audio.playSound({ origin: 1, priority: 64, sfxId: 9, handle: 2, pitch: 128 });
 * audio.occupiedCount(); // 1 — same-origin replacement keeps the channel count stable
 * ```
 */
export function createChannelAndPriorityRuntime(options: { readonly capacity?: number } = {}): ChannelAndPriorityRuntime {
  const capacity = options.capacity ?? VANILLA_SFX_CHANNEL_COUNT;
  const table = createChannelTable(capacity);
  return Object.freeze({
    evictBySameOrigin: (origin: number | null): number | null => {
      const channelIndex = findChannelByOrigin(table, origin);
      if (channelIndex === null) {
        return null;
      }
      stopChannel(table, channelIndex);
      return channelIndex;
    },
    occupiedCount: (): number => getOccupiedChannelCount(table),
    playSound: (request: SfxPlayRequest): SfxPlayResult => {
      const sameOriginIndex = findChannelByOrigin(table, request.origin);
      if (sameOriginIndex !== null) {
        const previous = snapshotChannel(table.channels[sameOriginIndex]!);
        stopChannel(table, sameOriginIndex);
        const allocatedIndex = allocateChannel(table, request);
        return Object.freeze({
          channelIndex: allocatedIndex,
          evicted: previous,
        });
      }
      const freeIndex = findFreeChannel(table);
      if (freeIndex !== null) {
        const allocatedIndex = allocateChannel(table, request);
        return Object.freeze({
          channelIndex: allocatedIndex,
          evicted: null,
        });
      }
      const evictableIndex = findEvictableChannel(table, request.priority);
      if (evictableIndex !== null) {
        const previous = snapshotChannel(table.channels[evictableIndex]!);
        stopChannel(table, evictableIndex);
        const allocatedIndex = allocateChannel(table, request);
        return Object.freeze({
          channelIndex: allocatedIndex,
          evicted: previous,
        });
      }
      return Object.freeze({ channelIndex: null, evicted: null });
    },
    stopChannel: (channelIndex: number): void => stopChannel(table, channelIndex),
    stopSound: (origin: number | null): number | null => stopSound(table, origin),
    table,
  });
}
