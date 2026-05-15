/**
 * Wire the runtime sprite frame cache from an
 * {@link IwadResourceCache} + WAD byte buffer.
 *
 * Plan_final step `05-005` (lane: wad-assets) wires the sprite
 * namespace, rotation/flip semantics, and the firstspritelump-relative
 * frame cache into a runtime artifact the mobj simulator and the
 * renderer can consume.  The cache itself is built by the existing
 * `buildSpriteFrameCache` primitive (read-only ref:
 * `src/assets/build-sprite-frame-cache.ts`).  This bridge accepts an
 * {@link IwadResourceCache} from `05-001` plus the underlying WAD byte
 * buffer (intentionally NOT retained inside the cache per the 05-001
 * design) and produces a frozen {@link SpriteFrameCache} with no
 * additional state.
 *
 * The bridge does not perform any filesystem I/O of its own.  Callers
 * provide both the parsed cache (whose `directory` is consumed) and
 * the byte buffer the cache was originally built from.  Subsequent
 * launch-host-input or runtime-core steps will compose this bridge
 * with a Bun-backed loader that reads `Bun.file(path).arrayBufferSync()`
 * once per launch.
 *
 * @example
 * ```ts
 * import { wireSpriteFrameCacheFromIwadResourceCache } from './wireSpriteFrameCacheFromIwadResourceCache.ts';
 * import { buildIwadResourceCache } from '../vanilla/iwadResourceCache.ts';
 *
 * const wadBuffer = Buffer.from(Bun.file('doom/DOOM1.WAD').arrayBufferSync());
 * const cache = buildIwadResourceCache(launchContext, { readFile: () => wadBuffer });
 * const spriteCache = wireSpriteFrameCacheFromIwadResourceCache(cache, wadBuffer);
 * spriteCache.entries.length;                  // 483 for shareware DOOM1.WAD
 * spriteCache.spriteNameToNumber.get('PLAYA1'); // canonical PLAYA1 sprite number
 * ```
 */

import type { SpriteFrameCache } from './build-sprite-frame-cache.ts';
import { buildSpriteFrameCache } from './build-sprite-frame-cache.ts';
import type { IwadResourceCache } from '../vanilla/iwadResourceCache.ts';

/**
 * Build a frozen {@link SpriteFrameCache} from an {@link IwadResourceCache}
 * and the underlying WAD byte buffer.
 *
 * The cache's `directory` is consumed verbatim — no copy, no re-sort.
 * The supplied `wadBuffer` is read by `buildSpriteFrameCache` to
 * decode each sprite patch header; the bridge itself does not retain
 * a reference to the buffer beyond the call.  Errors from the
 * underlying `parseSpriteNamespace` / `buildSpriteFrameCache`
 * primitives propagate verbatim and name the offending sprite lump.
 *
 * @param iwadResourceCache The cache produced by `buildIwadResourceCache`.
 * @param wadBuffer The original WAD byte buffer the cache was built from.
 * @returns A frozen sprite frame cache ready for mobj / renderer use.
 *
 * @example
 * ```ts
 * wireSpriteFrameCacheFromIwadResourceCache(cache, wadBuffer);
 * ```
 */
export function wireSpriteFrameCacheFromIwadResourceCache(iwadResourceCache: IwadResourceCache, wadBuffer: Buffer): SpriteFrameCache {
  return buildSpriteFrameCache({
    directory: iwadResourceCache.directory,
    wadBuffer,
  });
}
