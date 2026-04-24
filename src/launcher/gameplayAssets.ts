import { parseColormap } from '../assets/colormap.ts';
import { buildFlatCatalog } from '../assets/flats.ts';
import { buildPatchCatalog } from '../assets/patchCatalog.ts';
import { parsePnames } from '../assets/pnames.ts';
import { parseTextureLump } from '../assets/texture1.ts';
import { decodePatch } from '../render/patchDraw.ts';
import type { DirectoryEntry } from '../wad/directory.ts';
import { LumpLookup } from '../wad/lumpLookup.ts';

const EMPTY_TEXTURE_NAME = '-';

export interface GameplayTexture {
  readonly columns: readonly Uint8Array[];
  readonly height: number;
  readonly name: string;
  readonly width: number;
}

export interface GameplayRenderResources {
  readonly colormaps: readonly Uint8Array[];
  readonly flats: ReadonlyMap<string, Uint8Array>;
  readonly skyTexture: GameplayTexture | null;
  readonly textures: ReadonlyMap<string, GameplayTexture>;
}

interface TextureColumnPlacement {
  readonly originX: number;
  readonly originY: number;
  readonly patch: ReturnType<typeof decodePatch>;
}

export function loadGameplayRenderResources(directory: readonly DirectoryEntry[], wadBuffer: Buffer): GameplayRenderResources {
  const lookup = new LumpLookup(directory);
  const colormaps = parseColormap(lookup.getLumpData('COLORMAP', wadBuffer));
  const flats = loadFlatLookup(directory, wadBuffer);
  const textures = loadTextureLookup(directory, lookup, wadBuffer);

  return Object.freeze({
    colormaps,
    flats,
    skyTexture: textures.get('SKY1') ?? null,
    textures,
  });
}

function composeTexture(name: string, width: number, height: number, placements: readonly TextureColumnPlacement[]): GameplayTexture {
  const pixels = new Uint8Array(width * height);

  for (const placement of placements) {
    const { originX, originY, patch } = placement;

    for (let localX = 0; localX < patch.header.width; localX += 1) {
      const textureX = originX + localX;

      if (textureX < 0 || textureX >= width) {
        continue;
      }

      const column = patch.columns[localX]!;

      for (const post of column) {
        const postStartY = originY + post.topDelta;

        for (let postRow = 0; postRow < post.length; postRow += 1) {
          const textureY = postStartY + postRow;

          if (textureY < 0 || textureY >= height) {
            continue;
          }

          pixels[textureX * height + textureY] = post.pixels[postRow]!;
        }
      }
    }
  }

  const columns: Uint8Array[] = new Array(width);

  for (let textureX = 0; textureX < width; textureX += 1) {
    columns[textureX] = pixels.subarray(textureX * height, (textureX + 1) * height);
  }

  return Object.freeze({
    columns: Object.freeze(columns),
    height,
    name,
    width,
  });
}

function loadFlatLookup(directory: readonly DirectoryEntry[], wadBuffer: Buffer): ReadonlyMap<string, Uint8Array> {
  const catalog = buildFlatCatalog(directory);
  const flats = new Map<string, Uint8Array>();

  for (const entry of catalog.entries) {
    if (entry.isMarker) {
      continue;
    }

    const directoryEntry = directory[entry.directoryIndex]!;
    flats.set(entry.name.toUpperCase(), wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size));
  }

  return flats;
}

function loadPatchPlacements(directory: readonly DirectoryEntry[], lookup: LumpLookup, wadBuffer: Buffer): ReadonlyMap<string, ReturnType<typeof decodePatch>> {
  const patchCatalog = buildPatchCatalog(directory);
  const patches = new Map<string, ReturnType<typeof decodePatch>>();
  const decodedByDirectoryIndex = new Map<number, ReturnType<typeof decodePatch>>();

  for (const entry of patchCatalog.entries) {
    if (entry.isMarker) {
      continue;
    }

    let decodedPatch = decodedByDirectoryIndex.get(entry.directoryIndex) ?? null;

    if (decodedPatch === null) {
      const directoryEntry = lookup.getEntry(entry.directoryIndex);
      decodedPatch = decodePatch(wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size));
      decodedByDirectoryIndex.set(entry.directoryIndex, decodedPatch);
    }

    patches.set(entry.name.toUpperCase(), decodedPatch);
  }

  return patches;
}

function loadTextureLookup(directory: readonly DirectoryEntry[], lookup: LumpLookup, wadBuffer: Buffer): ReadonlyMap<string, GameplayTexture> {
  const patchNames = parsePnames(lookup.getLumpData('PNAMES', wadBuffer));
  const patchLookup = loadPatchPlacements(directory, lookup, wadBuffer);
  const textures = new Map<string, GameplayTexture>();
  const textureDefinitions = [...parseTextureLump(lookup.getLumpData('TEXTURE1', wadBuffer))];

  if (lookup.hasLump('TEXTURE2')) {
    textureDefinitions.push(...parseTextureLump(lookup.getLumpData('TEXTURE2', wadBuffer)));
  }

  for (const definition of textureDefinitions) {
    const placements: TextureColumnPlacement[] = [];

    for (const patch of definition.patches) {
      const patchName = patchNames[patch.patchIndex];

      if (patchName === undefined) {
        throw new RangeError(`Texture "${definition.name}" references PNAMES index ${patch.patchIndex}, but PNAMES has only ${patchNames.length} entries`);
      }

      if (patchName === EMPTY_TEXTURE_NAME) {
        continue;
      }

      const decodedPatch = patchLookup.get(patchName);

      if (decodedPatch === undefined) {
        throw new Error(`Texture "${definition.name}" references missing patch "${patchName}"`);
      }

      placements.push({
        originX: patch.originX,
        originY: patch.originY,
        patch: decodedPatch,
      });
    }

    textures.set(definition.name.toUpperCase(), composeTexture(definition.name.toUpperCase(), definition.width, definition.height, placements));
  }

  return textures;
}
