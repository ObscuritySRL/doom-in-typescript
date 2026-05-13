/**
 * Vanilla DOOM 1.9 line-special and line-record serialization contract.
 *
 * From Chocolate Doom 2.2.1 p_saveg.c P_ArchiveWorld /
 * P_UnArchiveWorld, each line_t record contributes a 6-byte base
 * payload (flags + special + tag) plus a per-side record for each
 * sidedef referenced by `sidenum[0]` and `sidenum[1]`.
 *
 * Per-line layout (canonical p_saveg.c order):
 *
 *   short flags;     // ML_BLOCKING / ML_TWOSIDED / ML_DONTPEGTOP / ...
 *   short special;   // Line trigger ID (1 = manual door, 11 = exit, ...)
 *   short tag;       // Sector tag for sector-affecting triggers
 *
 * Per-side layout (SAVEGAME_SIDE_SIZE=10 bytes when present):
 *
 *   short textureoffset;
 *   short rowoffset;
 *   short toptexture;
 *   short bottomtexture;
 *   short midtexture;
 *
 * The line-flag bits referenced by saved triggers (ML_*) come from
 * p_setup.c map-loading and are preserved verbatim — vanilla writes
 * the full 16-bit flags field even though only the low 9 bits have
 * documented meaning (ML_BLOCKING through ML_MAPPED).
 *
 * Parity-critical details:
 *   - The `special` field of zero means "no trigger" — it is NOT
 *     replaced with a tombstone. Triggered single-use lines clear
 *     `line->special = 0` at activation time and that clear is
 *     persisted in the save.
 *   - The repeat-rule flag is encoded into the `special` ID itself
 *     in vanilla DOOM (`P_CrossSpecialLine` looks up the line in a
 *     fixed table and clears `special=0` for one-shot triggers).
 *     The save format does NOT carry a separate repeatable bit.
 *   - The `tag` field is unbounded; vanilla treats any 16-bit value
 *     as a valid sector tag.
 */

export const VANILLA_SAVEGAME_LINE_BASE_SIZE = 6;

export const VANILLA_SAVEGAME_SIDE_SIZE = 10;

export const VANILLA_LINE_SPECIAL_NONE = 0;

export const VANILLA_LINE_FLAGS_FIELD_WIDTH = 2;
export const VANILLA_LINE_SPECIAL_FIELD_WIDTH = 2;
export const VANILLA_LINE_TAG_FIELD_WIDTH = 2;

export function vanillaSerializedLineByteLength(sidedefCount: 0 | 1 | 2): number {
  if (sidedefCount !== 0 && sidedefCount !== 1 && sidedefCount !== 2) {
    throw new RangeError(`sidedefCount must be 0, 1, or 2 (got ${sidedefCount})`);
  }
  return VANILLA_SAVEGAME_LINE_BASE_SIZE + sidedefCount * VANILLA_SAVEGAME_SIDE_SIZE;
}

export function isVanillaLineSpecialCleared(special: number): boolean {
  return special === VANILLA_LINE_SPECIAL_NONE;
}
