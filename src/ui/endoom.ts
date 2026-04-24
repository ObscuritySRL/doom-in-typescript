/**
 * ENDOOM lump parser.
 *
 * Parses the ENDOOM lump from a WAD file into a structured 80x25
 * text-mode screen.  ENDOOM is displayed when the game exits and uses
 * standard VGA text mode encoding: 2 bytes per cell (character byte +
 * attribute byte) for an 80-column, 25-row display.
 *
 * Attribute byte layout:
 * | Bits | Field      | Range |
 * | ---- | ---------- | ----- |
 * | 0-3  | Foreground | 0-15  |
 * | 4-6  | Background | 0-7   |
 * | 7    | Blink      | 0-1   |
 *
 * @example
 * ```ts
 * import { parseEndoom, ENDOOM_SIZE } from "../src/ui/endoom.ts";
 * const screen = parseEndoom(endoomLumpData);
 * console.log(screen.width, screen.height); // 80, 25
 * console.log(screen.cells.length);         // 2000
 * ```
 */

/** Number of columns in the ENDOOM text screen. */
export const ENDOOM_COLUMNS = 80;

/** Number of rows in the ENDOOM text screen. */
export const ENDOOM_ROWS = 25;

/** Total number of cells in the ENDOOM screen (80 * 25 = 2000). */
export const ENDOOM_CELL_COUNT = ENDOOM_COLUMNS * ENDOOM_ROWS;

/** Bytes per cell (1 character + 1 attribute = 2). */
export const ENDOOM_BYTES_PER_CELL = 2;

/** Expected total byte size of the ENDOOM lump (2000 * 2 = 4000). */
export const ENDOOM_SIZE = ENDOOM_CELL_COUNT * ENDOOM_BYTES_PER_CELL;

/** A single cell in the ENDOOM text screen. */
export interface EndoomCell {
  /** CP437 character code (0-255). */
  readonly character: number;
  /** Foreground color index (0-15, CGA palette). */
  readonly foreground: number;
  /** Background color index (0-7, CGA palette). */
  readonly background: number;
  /** Whether the cell blinks (attribute bit 7). */
  readonly blink: boolean;
}

/** Parsed ENDOOM text screen. */
export interface EndoomScreen {
  /** Screen width in columns (always 80). */
  readonly width: number;
  /** Screen height in rows (always 25). */
  readonly height: number;
  /** Frozen array of 2000 cells in row-major order. */
  readonly cells: readonly EndoomCell[];
}

/**
 * Parse an ENDOOM lump into a structured text screen.
 *
 * @param lumpData - Raw ENDOOM lump data (must be exactly 4000 bytes).
 * @returns Frozen EndoomScreen with parsed cells.
 * @throws {RangeError} If the lump data is not exactly 4000 bytes.
 */
export function parseEndoom(lumpData: Buffer | Uint8Array): Readonly<EndoomScreen> {
  if (lumpData.length !== ENDOOM_SIZE) {
    throw new RangeError(`ENDOOM lump must be exactly ${ENDOOM_SIZE} bytes, got ${lumpData.length}`);
  }

  const cells: EndoomCell[] = new Array(ENDOOM_CELL_COUNT);
  for (let index = 0; index < ENDOOM_CELL_COUNT; index++) {
    const byteOffset = index * ENDOOM_BYTES_PER_CELL;
    const character = lumpData[byteOffset]!;
    const attribute = lumpData[byteOffset + 1]!;

    cells[index] = Object.freeze({
      character,
      foreground: attribute & 0x0f,
      background: (attribute >> 4) & 0x07,
      blink: (attribute & 0x80) !== 0,
    });
  }

  const screen: EndoomScreen = {
    width: ENDOOM_COLUMNS,
    height: ENDOOM_ROWS,
    cells: Object.freeze(cells),
  };

  return Object.freeze(screen);
}
