/**
 * Vanilla DOOM 1.9 SFX + MUS lump catalog runtime resources.
 *
 * Plan_final step `05-006` (lane: wad-assets) wires the digital sound
 * effect lumps (`DS<name>` from `getsfx()` / `I_GetSfxLumpNum()`) and
 * the MUS music lumps (`D_<name>` from `S_StartMusic` / `S_ChangeMusic`)
 * into a runtime catalog the audio subsystem consumes.  The catalog is
 * built once per launch from the {@link IwadResourceCache} produced by
 * `05-001`; it does NOT eagerly load the underlying sample/score
 * bytes — those remain inside the WAD buffer and are decoded lazily by
 * the audio mixer / MUS scheduler.  The wrapper is therefore safe to
 * commit to source control with no embedded proprietary IWAD bytes,
 * matching the AGENTS.md "no embedded proprietary bytes" rule.
 *
 * Behavioral contract:
 *
 *   - SFX lumps are enumerated by directory scan: every committed
 *     directory entry whose uppercased name starts with `DS` and
 *     whose remaining body is non-empty is reported as an
 *     {@link SfxLumpEntry}.  The 2-byte `DS` prefix follows
 *     `linuxdoom-1.10` `i_sound.c` `sprintf(name, "ds%s", sfx->name)`;
 *     `W_CheckNumForName` folds case to uppercase before hashing, so
 *     a literal lowercase `ds<name>` on disk still matches.
 *   - MUS lumps are enumerated by directory scan: every entry whose
 *     uppercased name starts with `D_` is reported as a
 *     {@link MusLumpEntry}.  The shareware IWAD ships 9 episode
 *     tracks (`D_E1M1`..`D_E1M9`) plus the title/intermission/credit
 *     tracks; the catalog reports every D_-prefixed lump in
 *     directory order regardless of mode.
 *   - The catalog is FROZEN; downstream subsystems cannot mutate
 *     entries.  Per-entry directory indices are stable for the
 *     lifetime of the cache.
 *   - The catalog does NOT parse the SFX DMX header or the MUS
 *     header at build time.  Header validation is a per-sample
 *     concern handled by {@link parseSfxLump} (`src/audio/sfxLumps.ts`)
 *     and {@link parseMus} (`src/assets/mus.ts`) at mixer/scheduler
 *     time.  The catalog simply tells the audio subsystem WHICH
 *     entries are available; the audio subsystem decides which to
 *     read and decode.
 *
 * The wrapper is intentionally non-throwing — IWADs that ship no MUS
 * lumps (extremely rare) report `musLumps.length === 0`; IWADs that
 * ship no SFX lumps (also rare) report `sfxLumps.length === 0`.
 * Callers must decide whether to surface a launch error or play
 * silently.
 *
 * @example
 * ```ts
 * import { buildSoundAndMusicAssets } from './soundAndMusicAssets.ts';
 *
 * const catalog = buildSoundAndMusicAssets(resourceCache);
 * catalog.sfxLumps.length;                              // 55 for shareware
 * catalog.sfxLumps.find((entry) => entry.name === 'DSPISTOL'); // entry with directory index
 * catalog.musLumps.find((entry) => entry.name === 'D_E1M1');   // first-episode track
 * ```
 */

import type { DirectoryEntry } from '../wad/directory.ts';
import type { IwadResourceCache } from './iwadResourceCache.ts';

/** Two-byte prefix every digital sound effect lump name carries (`DS<name>`). */
export const VANILLA_SFX_LUMP_PREFIX = 'DS';

/** Two-byte prefix every MUS music lump name carries (`D_<name>`). */
export const VANILLA_MUS_LUMP_PREFIX = 'D_';

/**
 * A single digital sound effect lump in the IWAD directory.  `name`
 * is the uppercased lump name; `directoryIndex` is the entry's index
 * in {@link IwadResourceCache.directory}; `directoryEntry` carries
 * the entry's `offset` and `size` so the audio subsystem can decode
 * the body directly from the WAD buffer.
 */
export interface SfxLumpEntry {
  readonly directoryEntry: DirectoryEntry;
  readonly directoryIndex: number;
  readonly name: string;
}

/**
 * A single MUS music lump in the IWAD directory.  The fields mirror
 * {@link SfxLumpEntry}; the audio subsystem feeds the entry's bytes
 * into {@link parseMus} when the runtime starts playing the track.
 */
export interface MusLumpEntry {
  readonly directoryEntry: DirectoryEntry;
  readonly directoryIndex: number;
  readonly name: string;
}

/**
 * Frozen runtime catalog assembled by
 * {@link buildSoundAndMusicAssets}.  The nested entry arrays are
 * frozen; the underlying {@link DirectoryEntry} references are the
 * exact objects the resource cache produced (not copies).
 */
export interface SoundAndMusicAssetCatalog {
  readonly musLumps: readonly MusLumpEntry[];
  readonly sfxLumps: readonly SfxLumpEntry[];
}

/**
 * Walk the resource cache's directory and partition every committed
 * lump into the SFX (`DS`-prefixed) and MUS (`D_`-prefixed) buckets.
 * The walk is O(n) where n = directory length; the resulting arrays
 * preserve directory order so callers that need stable indices can
 * use the returned `directoryIndex` directly.
 *
 * @param resourceCache The cache produced by `05-001`'s
 *   `buildIwadResourceCache`.
 * @returns A frozen {@link SoundAndMusicAssetCatalog} ready for the
 *   audio subsystem.
 */
export function buildSoundAndMusicAssets(resourceCache: IwadResourceCache): SoundAndMusicAssetCatalog {
  const sfxLumps: SfxLumpEntry[] = [];
  const musLumps: MusLumpEntry[] = [];
  const directory = resourceCache.directory;
  for (let directoryIndex = 0; directoryIndex < directory.length; directoryIndex += 1) {
    const entry = directory[directoryIndex]!;
    const upperName = entry.name.toUpperCase();
    if (upperName.startsWith(VANILLA_SFX_LUMP_PREFIX) && entry.size > 0) {
      sfxLumps.push(Object.freeze({ directoryEntry: entry, directoryIndex, name: upperName }));
      continue;
    }
    if (upperName.startsWith(VANILLA_MUS_LUMP_PREFIX) && entry.size > 0) {
      musLumps.push(Object.freeze({ directoryEntry: entry, directoryIndex, name: upperName }));
    }
  }
  return Object.freeze({
    musLumps: Object.freeze(musLumps),
    sfxLumps: Object.freeze(sfxLumps),
  });
}
