/**
 * Map lump bundle parser.
 *
 * Extracts the 10 canonical sub-lumps that follow a map marker lump
 * in a WAD directory, matching vanilla Doom's P_SetupLevel expectations.
 * Each map marker (E1M1, MAP01, etc.) is a zero-size lump immediately
 * followed by THINGS, LINEDEFS, SIDEDEFS, VERTEXES, SEGS, SSECTORS,
 * NODES, SECTORS, REJECT, BLOCKMAP in that exact order.
 *
 * @example
 * ```ts
 * import { parseMapBundle, findMapNames } from "../src/map/mapBundle.ts";
 * const names = findMapNames(directory);     // ["E1M1", …, "E1M9"]
 * const bundle = parseMapBundle(directory, wadBuffer, "E1M1");
 * console.log(bundle.things.length);         // 1380
 * ```
 */

import type { DirectoryEntry } from '../wad/directory.ts';

/** Canonical order of the 10 sub-lumps following a map marker. */
export const MAP_LUMP_ORDER = Object.freeze(['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP'] as const);

/** Name of one of the 10 canonical map sub-lumps. */
export type MapLumpName = (typeof MAP_LUMP_ORDER)[number];

/** Number of sub-lumps per map (always 10). */
export const MAP_LUMP_COUNT = 10;

/** Raw data buffers for each of the 10 canonical map sub-lumps. */
export interface MapLumpBundle {
  /** The map name (e.g. "E1M1" or "MAP01"), uppercased. */
  readonly name: string;
  /** Directory index of the map marker lump. */
  readonly markerIndex: number;
  /** Raw THINGS lump data. */
  readonly things: Buffer;
  /** Raw LINEDEFS lump data. */
  readonly linedefs: Buffer;
  /** Raw SIDEDEFS lump data. */
  readonly sidedefs: Buffer;
  /** Raw VERTEXES lump data. */
  readonly vertexes: Buffer;
  /** Raw SEGS lump data. */
  readonly segs: Buffer;
  /** Raw SSECTORS lump data. */
  readonly ssectors: Buffer;
  /** Raw NODES lump data. */
  readonly nodes: Buffer;
  /** Raw SECTORS lump data. */
  readonly sectors: Buffer;
  /** Raw REJECT lump data. */
  readonly reject: Buffer;
  /** Raw BLOCKMAP lump data. */
  readonly blockmap: Buffer;
}

/** Doom 1 ExMy map name pattern. */
const EXMY_PATTERN = /^E\dM\d$/i;

/** Doom 2 MAPxx map name pattern. */
const MAPXX_PATTERN = /^MAP\d\d$/i;

/**
 * Test whether a lump name is a map marker.
 *
 * @param name - Lump name (case-insensitive).
 */
export function isMapMarker(name: string): boolean {
  return EXMY_PATTERN.test(name) || MAPXX_PATTERN.test(name);
}

/**
 * Find all map names present in a WAD directory, in directory order.
 *
 * @param directory - Parsed WAD directory entries.
 * @returns Frozen array of uppercased map names in directory order.
 */
export function findMapNames(directory: readonly DirectoryEntry[]): readonly string[] {
  const names: string[] = [];
  for (let index = 0; index < directory.length; index++) {
    const name = directory[index]!.name;
    if (isMapMarker(name)) {
      names.push(name.toUpperCase());
    }
  }
  return Object.freeze(names);
}

/**
 * Parse a map lump bundle from a WAD buffer.
 *
 * Locates the map marker by name (last occurrence wins, matching PWAD
 * override semantics), then extracts the 10 canonical sub-lumps that
 * immediately follow it in the directory. Verifies each sub-lump name
 * matches the canonical order.
 *
 * @param directory - Parsed WAD directory entries.
 * @param wadBuffer - Buffer containing the entire WAD file.
 * @param mapName - Map name to look up (e.g. "E1M1", case-insensitive).
 * @returns A frozen MapLumpBundle with raw data for all 10 sub-lumps.
 * @throws {Error} If the map marker is not found.
 * @throws {RangeError} If there are fewer than 10 lumps after the marker,
 *   or if a sub-lump name does not match the canonical order.
 */
export function parseMapBundle(directory: readonly DirectoryEntry[], wadBuffer: Buffer, mapName: string): MapLumpBundle {
  const upper = mapName.toUpperCase();

  let markerIndex = -1;
  for (let index = directory.length - 1; index >= 0; index--) {
    if (directory[index]!.name.toUpperCase() === upper) {
      markerIndex = index;
      break;
    }
  }

  if (markerIndex === -1) {
    throw new Error(`W_GetNumForName: ${upper} not found!`);
  }

  if (markerIndex + MAP_LUMP_COUNT >= directory.length) {
    throw new RangeError(`Map ${upper} at index ${markerIndex} needs ${MAP_LUMP_COUNT} sub-lumps but only ${directory.length - markerIndex - 1} entries remain`);
  }

  const lumpData: Buffer[] = new Array(MAP_LUMP_COUNT);
  for (let lumpIdx = 0; lumpIdx < MAP_LUMP_COUNT; lumpIdx++) {
    const entry = directory[markerIndex + 1 + lumpIdx]!;
    const expectedName = MAP_LUMP_ORDER[lumpIdx]!;
    const actualName = entry.name.toUpperCase();
    if (actualName !== expectedName) {
      throw new RangeError(`Map ${upper} sub-lump ${lumpIdx} expected ${expectedName}, got ${actualName}`);
    }
    lumpData[lumpIdx] = wadBuffer.subarray(entry.offset, entry.offset + entry.size);
  }

  return Object.freeze({
    name: upper,
    markerIndex,
    things: lumpData[0]!,
    linedefs: lumpData[1]!,
    sidedefs: lumpData[2]!,
    vertexes: lumpData[3]!,
    segs: lumpData[4]!,
    ssectors: lumpData[5]!,
    nodes: lumpData[6]!,
    sectors: lumpData[7]!,
    reject: lumpData[8]!,
    blockmap: lumpData[9]!,
  });
}
