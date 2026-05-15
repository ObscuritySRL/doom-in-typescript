/**
 * Vanilla DOOM 1.9 SFX runtime loader.
 *
 * Plan_final step `11-001` (lane: audio) wires the DMX sound effect
 * lump expansion (`DS<name>` entries enumerated by `05-006`'s
 * {@link SoundAndMusicAssetCatalog}) and the per-lump header /
 * sample-rate / sample-count metadata into a runtime sound table the
 * audio mixer consumes when it schedules per-channel SFX playback.
 *
 * The loader is built once per launch from the runtime catalog
 * produced by `05-006` plus a caller-supplied
 * {@link SfxLumpReader} that resolves a lump's raw bytes from the WAD
 * buffer.  Each entry is decoded via the read-only
 * {@link parseSfxLump} helper from `src/audio/sfxLumps.ts`; the
 * loader does not duplicate the DMX header parser.  Failure modes
 * (non-DMX format, mismatched body length, header too short) surface
 * as typed {@link SfxLoaderError} instances with a stable
 * {@link SfxLoaderErrorReason} discriminator plus the offending lump
 * name so the launch-error UI can surface a precise diagnostic.
 *
 * The runtime sound table is exposed both as a `Map<string, SfxLump>`
 * keyed by uppercased lump name and as an iterable `readonly
 * SfxLumpRecord[]` carrying the directory index alongside the parsed
 * lump.  Callers that need O(1) name lookup use the map; callers
 * that need stable iteration order use the array.
 *
 * @example
 * ```ts
 * import { buildSfxLoader } from './sfxLoader.ts';
 *
 * const loader = buildSfxLoader(soundAndMusicCatalog, {
 *   readSfxLumpBytes: (entry) => buffer.subarray(entry.offset, entry.offset + entry.size),
 * });
 * loader.sfxLumpsByName.get('DSPISTOL')?.sampleRate; // 11025
 * loader.sfxLumps.length;                            // 55 for shareware
 * ```
 */

import { parseSfxLump, type SfxLump } from '../audio/sfxLumps.ts';
import type { DirectoryEntry } from '../wad/directory.ts';
import type { SoundAndMusicAssetCatalog } from './soundAndMusicAssets.ts';

/** Stable discriminator for {@link SfxLoaderError} failure causes. */
export type SfxLoaderErrorReason = 'sfx-lump-body-mismatch' | 'sfx-lump-header-too-short' | 'sfx-lump-non-digital-format';

/**
 * Thrown by {@link buildSfxLoader} when a DS-prefixed lump cannot be
 * parsed by {@link parseSfxLump}.  Each instance carries a stable
 * {@link SfxLoaderErrorReason} discriminator and the offending lump
 * name so the launch-error UI can surface a precise diagnostic.
 */
export class SfxLoaderError extends Error {
  public readonly lumpName: string;
  public readonly reason: SfxLoaderErrorReason;

  public constructor(reason: SfxLoaderErrorReason, lumpName: string, message: string) {
    super(message);
    this.lumpName = lumpName;
    this.name = 'SfxLoaderError';
    this.reason = reason;
  }
}

/**
 * Caller-supplied probe that returns the raw bytes for a DS-prefixed
 * directory entry.  Production callers wrap the IWAD buffer returned
 * by `IwadFileLoader`; tests supply a synthetic buffer slice.  The
 * returned `Buffer` MUST be exactly `entry.size` bytes long and MUST
 * start at the first byte of the lump body.
 */
export interface SfxLumpReader {
  readonly readSfxLumpBytes: (entry: DirectoryEntry) => Buffer;
}

/**
 * One entry in the runtime sound table.  `name` is the uppercased
 * lump name; `directoryIndex` is the entry's index in the IWAD
 * directory; `lump` is the decoded {@link SfxLump} record with the
 * parsed DMX header and the PCM body view.
 */
export interface SfxLumpRecord {
  readonly directoryIndex: number;
  readonly lump: SfxLump;
  readonly name: string;
}

/**
 * Frozen runtime sound table assembled by {@link buildSfxLoader}.
 * Both `sfxLumps` and `sfxLumpsByName` are frozen; the SfxLump
 * records inside are also frozen by `parseSfxLump`.
 */
export interface SfxLoader {
  readonly sfxLumps: readonly SfxLumpRecord[];
  readonly sfxLumpsByName: ReadonlyMap<string, SfxLump>;
}

function decodeSfxLumpRecord(name: string, directoryEntry: DirectoryEntry, directoryIndex: number, sfxLumpReader: SfxLumpReader): SfxLumpRecord {
  const bytes = sfxLumpReader.readSfxLumpBytes(directoryEntry);
  let lump: SfxLump;
  try {
    lump = parseSfxLump(bytes);
  } catch (originalError) {
    const causeMessage = originalError instanceof Error ? originalError.message : String(originalError);
    if (causeMessage.includes('must be at least')) {
      throw new SfxLoaderError('sfx-lump-header-too-short', name, `SFX lump ${name}: ${causeMessage}`);
    }
    if (causeMessage.includes('unsupported format')) {
      throw new SfxLoaderError('sfx-lump-non-digital-format', name, `SFX lump ${name}: ${causeMessage}`);
    }
    throw new SfxLoaderError('sfx-lump-body-mismatch', name, `SFX lump ${name}: ${causeMessage}`);
  }
  return Object.freeze({ directoryIndex, lump, name });
}

/**
 * Build a frozen {@link SfxLoader} from the resolved
 * {@link SoundAndMusicAssetCatalog} and a caller-supplied
 * {@link SfxLumpReader}.  Each DS-prefixed entry in the catalog is
 * decoded via {@link parseSfxLump}; failures throw
 * {@link SfxLoaderError} with a stable reason discriminator.
 *
 * @param soundAndMusicCatalog The catalog produced by `05-006`'s
 *   `buildSoundAndMusicAssets`.
 * @param sfxLumpReader The injected lump-bytes probe.
 * @returns A frozen runtime sound table ready for the mixer.
 * @throws SfxLoaderError When any DS-prefixed lump cannot be parsed.
 */
export function buildSfxLoader(soundAndMusicCatalog: SoundAndMusicAssetCatalog, sfxLumpReader: SfxLumpReader): SfxLoader {
  const records: SfxLumpRecord[] = [];
  const recordsByName = new Map<string, SfxLump>();
  for (const sfxEntry of soundAndMusicCatalog.sfxLumps) {
    const record = decodeSfxLumpRecord(sfxEntry.name, sfxEntry.directoryEntry, sfxEntry.directoryIndex, sfxLumpReader);
    records.push(record);
    recordsByName.set(record.name, record.lump);
  }
  return Object.freeze({
    sfxLumps: Object.freeze(records),
    sfxLumpsByName: recordsByName,
  });
}
