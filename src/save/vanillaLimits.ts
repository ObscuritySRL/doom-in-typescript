const SAVEGAME_EOF = 0x1d;

/** Vanilla Doom's `SAVEGAMESIZE` hard limit in bytes. */
export const VANILLA_SAVEGAME_LIMIT_SIZE = 0x2c000;

/** Fatal error text raised by `G_DoSaveGame` on savegame overrun. */
export const VANILLA_SAVEGAME_OVERRUN_ERROR = 'Savegame buffer overrun';

export interface VanillaSaveGameSections {
  readonly header: Uint8Array;
  readonly mobjs: Uint8Array;
  readonly players: Uint8Array;
  readonly specials: Uint8Array;
  readonly world: Uint8Array;
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer.`);
  }
}

function isVanillaSaveGameLimitEnabled(vanillaSavegameLimit: boolean | number): boolean {
  if (typeof vanillaSavegameLimit === 'boolean') {
    return vanillaSavegameLimit;
  }

  if (!Number.isInteger(vanillaSavegameLimit)) {
    throw new RangeError('vanillaSavegameLimit must be an integer or boolean.');
  }

  return vanillaSavegameLimit !== 0;
}

/**
 * Enforce the vanilla Doom savegame size ceiling used by `G_DoSaveGame`.
 *
 * @param byteLength - Final savegame byte length, including the EOF marker.
 * @param vanillaSavegameLimit - Doom-style compatibility flag. `0` disables the
 * limit; any non-zero integer or `true` enables it.
 * @returns Nothing. Throws when the byte length exceeds the vanilla ceiling.
 * @example
 * ```ts
 * assertVanillaSaveGameByteLength(0x2c000, 1);
 * ```
 */
export function assertVanillaSaveGameByteLength(byteLength: number, vanillaSavegameLimit: boolean | number = true): void {
  assertNonNegativeInteger('byteLength', byteLength);

  if (isVanillaSaveGameLimitEnabled(vanillaSavegameLimit) && byteLength > VANILLA_SAVEGAME_LIMIT_SIZE) {
    throw new RangeError(VANILLA_SAVEGAME_OVERRUN_ERROR);
  }
}

/**
 * Assemble a complete savegame byte stream in the canonical Doom section order
 * and enforce the vanilla size ceiling after appending the EOF marker.
 *
 * @param sections - Pre-serialized savegame sections in Doom's fixed order.
 * @param vanillaSavegameLimit - Doom-style compatibility flag. `0` disables the
 * limit; any non-zero integer or `true` enables it.
 * @returns A contiguous savegame buffer ending with the canonical EOF marker.
 * @example
 * ```ts
 * const bytes = writeVanillaSaveGame({
 *   header: new Uint8Array([1, 2]),
 *   mobjs: new Uint8Array([7]),
 *   players: new Uint8Array([3]),
 *   specials: new Uint8Array([8]),
 *   world: new Uint8Array([4, 5, 6]),
 * });
 * ```
 */
export function writeVanillaSaveGame(sections: VanillaSaveGameSections, vanillaSavegameLimit: boolean | number = true): Uint8Array {
  const totalByteLength = sections.header.length + sections.players.length + sections.world.length + sections.mobjs.length + sections.specials.length + 1;

  assertVanillaSaveGameByteLength(totalByteLength, vanillaSavegameLimit);

  const output = new Uint8Array(totalByteLength);
  let offset = 0;

  output.set(sections.header, offset);
  offset += sections.header.length;

  output.set(sections.players, offset);
  offset += sections.players.length;

  output.set(sections.world, offset);
  offset += sections.world.length;

  output.set(sections.mobjs, offset);
  offset += sections.mobjs.length;

  output.set(sections.specials, offset);
  offset += sections.specials.length;

  output[offset] = SAVEGAME_EOF;

  return output;
}
