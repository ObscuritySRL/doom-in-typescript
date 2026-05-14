/**
 * Vanilla DOOM 1.9 IWAD resource cache.
 *
 * Plan_final step `05-001` (lane: wad-assets) wires the WAD directory,
 * the lump-name lookup, the canonical game-mode identification, and the
 * lump-availability predicate into a single frozen runtime artifact the
 * downstream subsystems (asset loaders, render init, audio init, save
 * format, demo player) consume.  The cache is built once per launch
 * from a resolved {@link LaunchContext} plus a caller-supplied
 * {@link IwadFileLoader} that reads the underlying file.  No filesystem
 * I/O happens inside the cache — every byte comes from the injected
 * loader so the focused test stays deterministic.
 *
 * Pipeline (matches Chocolate Doom 2.2.1 `W_AddFile` + Vanilla DOOM 1.9
 * `IdentifyVersion`/`D_IdentifyVersion`):
 *
 *   1. Read the IWAD buffer at {@link LaunchContext.iwad.resolvedPath}.
 *   2. Parse the 12-byte header via {@link parseWadHeader}.  Reject
 *      anything that is not `IWAD`.
 *   3. Parse the directory via {@link parseWadDirectory}.
 *   4. Build a {@link LumpLookup} for case-insensitive last-match-wins
 *      `W_CheckNumForName` queries.
 *   5. Run {@link identifyGame} against the resolved IWAD basename and
 *      the lump lookup so the cache exposes a final
 *      {@link GameIdentification} that reconciles the filename-derived
 *      gameMode from `03-004` with the actual lump contents (Ultimate
 *      vs Registered vs Shareware vs Commercial vs Chex).
 *
 * Failure modes are surfaced as typed {@link IwadResourceCacheError}
 * instances with a stable {@link IwadResourceCacheErrorReason}
 * discriminator so callers can branch on the failure cause rather than
 * parsing a free-form message.
 *
 * @example
 * ```ts
 * import { buildIwadResourceCache } from './iwadResourceCache.ts';
 * import { resolveLaunchContext } from './launchContext.ts';
 * import { parseCommandLineConfiguration } from './commandLineConfiguration.ts';
 *
 * const configuration = parseCommandLineConfiguration(['doom_codex', '-iwad', 'doom/DOOM1.WAD']);
 * const context = resolveLaunchContext(configuration, {
 *   doomWadDirectoryEnvironmentValue: null,
 *   doesBasenameExistInWadDirectory: () => false,
 * });
 * const cache = buildIwadResourceCache(context, {
 *   readFile: (path) => Buffer.from(Bun.file(path).arrayBufferSync()),
 * });
 * cache.gameIdentification.gameMode;     // 'shareware'
 * cache.hasLump('E1M1');                 // true
 * cache.findLump('PLAYPAL')?.offset;     // canonical PLAYPAL offset
 * ```
 */

import { identifyGame } from '../bootstrap/gameMode.ts';
import type { GameIdentification } from '../bootstrap/gameMode.ts';
import { parseWadDirectory } from '../wad/directory.ts';
import type { DirectoryEntry } from '../wad/directory.ts';
import { parseWadHeader } from '../wad/header.ts';
import type { WadHeader } from '../wad/header.ts';
import { LumpLookup } from '../wad/lumpLookup.ts';
import type { LaunchContext } from './launchContext.ts';

/**
 * Stable discriminator for {@link IwadResourceCacheError} failure causes
 * so callers can branch on the cause without parsing message strings.
 */
export type IwadResourceCacheErrorReason = 'empty-buffer' | 'not-an-iwad' | 'wad-directory-parse-failure' | 'wad-header-parse-failure' | 'wad-not-found';

/**
 * Thrown by {@link buildIwadResourceCache} when the underlying WAD file
 * cannot be loaded or parsed.  Each instance carries a stable
 * {@link IwadResourceCacheErrorReason} discriminator and the original
 * path the cache attempted to load so the launch-error UI can surface a
 * precise diagnostic.
 */
export class IwadResourceCacheError extends Error {
  public readonly reason: IwadResourceCacheErrorReason;
  public readonly resolvedPath: string;

  public constructor(reason: IwadResourceCacheErrorReason, resolvedPath: string, message: string) {
    super(message);
    this.name = 'IwadResourceCacheError';
    this.reason = reason;
    this.resolvedPath = resolvedPath;
  }
}

/**
 * Caller-supplied probe that reads a WAD file off the filesystem.
 *
 * The loader is invoked exactly once per {@link buildIwadResourceCache}
 * call with the {@link LaunchContext.iwad.resolvedPath} value.  Return
 * `null` to signal "the file does not exist on disk" — the cache then
 * throws {@link IwadResourceCacheError} with reason `'wad-not-found'`.
 * Returning a `Buffer` short-circuits any caching the loader implements;
 * the cache does not retain the returned buffer beyond the constructor
 * call (only the parsed directory and lookup are kept), so loaders are
 * free to slice or reuse buffer pools.
 *
 * Subsequent launch-host-input steps will wire a Bun-backed loader that
 * calls `Bun.file(path).arrayBufferSync()`.  The focused test in
 * `test/plan_final/wad/wire-iwad-resource-cache.test.ts` uses a
 * synthetic in-memory loader so the cache build remains deterministic
 * and offline-safe.
 */
export interface IwadFileLoader {
  readonly readFile: (resolvedPath: string) => Buffer | null;
}

/**
 * Frozen runtime artifact assembled by {@link buildIwadResourceCache}.
 *
 * Every field is read-only and the object itself is `Object.freeze`d so
 * downstream subsystems cannot mutate the resolved contract.  The
 * cache mirrors the `wadfile_info_t` plus `D_IdentifyVersion` outputs
 * Chocolate Doom 2.2.1 carries through startup.
 */
export interface IwadResourceCache {
  /** Parsed 12-byte WAD header.  Always reports `type: 'IWAD'`. */
  readonly wadHeader: WadHeader;
  /** Parsed lump directory in file order. */
  readonly directory: readonly DirectoryEntry[];
  /** Convenience accessor for `directory.length`. */
  readonly lumpCount: number;
  /** Game identification derived from the resolved basename + the lump lookup. */
  readonly gameIdentification: GameIdentification;
  /** The path the cache was built from. */
  readonly resolvedPath: string;

  /**
   * Look up the directory entry for a lump by name.  Returns `null`
   * when no entry matches.  Case-insensitive; resolves to the last
   * matching entry per vanilla `W_CheckNumForName` semantics.
   */
  readonly findLump: (lumpName: string) => DirectoryEntry | null;

  /**
   * Predicate matching the {@link LumpChecker} contract consumed by
   * {@link identifyGame} and downstream WAD loaders.
   */
  readonly hasLump: (lumpName: string) => boolean;

  /**
   * Return every directory index whose lump name matches the supplied
   * name (case-insensitive), in directory order.  Mirrors the
   * `OrderedLumpChecker` contract `identifyGame` consults when the
   * mission is `'none'` and lump order is needed to disambiguate
   * episodic from commercial layouts.
   */
  readonly getAllIndicesForName: (lumpName: string) => readonly number[];
}

/**
 * Build a frozen {@link IwadResourceCache} from a resolved
 * {@link LaunchContext} and a caller-supplied {@link IwadFileLoader}.
 *
 * Pipeline:
 *
 *   1. The loader is invoked with `launchContext.iwad.resolvedPath`.
 *      A `null` return throws {@link IwadResourceCacheError} with
 *      reason `'wad-not-found'`.
 *   2. An empty buffer throws with reason `'empty-buffer'`.
 *   3. The WAD header is parsed; non-`IWAD` types throw with reason
 *      `'not-an-iwad'`; malformed headers throw with reason
 *      `'wad-header-parse-failure'`.
 *   4. The directory is parsed; malformed directories throw with
 *      reason `'wad-directory-parse-failure'`.
 *   5. A {@link LumpLookup} is built and {@link identifyGame} is
 *      invoked against the resolved IWAD basename and the lookup.
 *
 * The returned cache is `Object.freeze`d and its `directory` array is
 * the same frozen reference returned by {@link parseWadDirectory}, so
 * downstream WAD loaders never observe a half-initialized cache.
 *
 * @param launchContext The resolved launch context whose `iwad.resolvedPath` points at the IWAD to load.
 * @param loader The injected file-read probe.
 * @returns A frozen runtime resource cache.
 * @throws IwadResourceCacheError When the WAD cannot be loaded or parsed.
 *
 * @example
 * ```ts
 * const cache = buildIwadResourceCache(launchContext, {
 *   readFile: (path) => path === 'doom1.wad' ? syntheticBuffer : null,
 * });
 * cache.gameIdentification.gameMode; // 'shareware'
 * ```
 */
export function buildIwadResourceCache(launchContext: LaunchContext, loader: IwadFileLoader): IwadResourceCache {
  const resolvedPath = launchContext.iwad.resolvedPath;
  const buffer = loader.readFile(resolvedPath);

  if (buffer === null) {
    throw new IwadResourceCacheError('wad-not-found', resolvedPath, `IWAD resource cache loader reported the file at "${resolvedPath}" does not exist`);
  }

  if (buffer.length === 0) {
    throw new IwadResourceCacheError('empty-buffer', resolvedPath, `IWAD resource cache loader returned an empty buffer for "${resolvedPath}"`);
  }

  let wadHeader: WadHeader;
  try {
    wadHeader = parseWadHeader(buffer);
  } catch (originalError) {
    const causeMessage = originalError instanceof Error ? originalError.message : String(originalError);
    throw new IwadResourceCacheError('wad-header-parse-failure', resolvedPath, `IWAD resource cache failed to parse WAD header for "${resolvedPath}": ${causeMessage}`);
  }

  if (wadHeader.type !== 'IWAD') {
    throw new IwadResourceCacheError('not-an-iwad', resolvedPath, `IWAD resource cache rejected "${resolvedPath}" because its WAD identification is "${wadHeader.type}", not "IWAD"`);
  }

  let directory: readonly DirectoryEntry[];
  try {
    directory = parseWadDirectory(buffer, wadHeader);
  } catch (originalError) {
    const causeMessage = originalError instanceof Error ? originalError.message : String(originalError);
    throw new IwadResourceCacheError('wad-directory-parse-failure', resolvedPath, `IWAD resource cache failed to parse WAD directory for "${resolvedPath}": ${causeMessage}`);
  }

  const lumpLookup = new LumpLookup(directory);
  const gameIdentification = identifyGame(resolvedPath, lumpLookup);

  return Object.freeze({
    directory,
    findLump: (lumpName: string): DirectoryEntry | null => {
      const index = lumpLookup.checkNumForName(lumpName);
      if (index === -1) {
        return null;
      }
      return lumpLookup.getEntry(index);
    },
    gameIdentification,
    getAllIndicesForName: (lumpName: string): readonly number[] => lumpLookup.getAllIndicesForName(lumpName),
    hasLump: (lumpName: string): boolean => lumpLookup.hasLump(lumpName),
    lumpCount: directory.length,
    resolvedPath,
    wadHeader,
  });
}
