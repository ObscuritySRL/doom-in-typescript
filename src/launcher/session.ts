import type { Angle } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';

import { FRACUNIT, fixedMul } from '../core/fixed.ts';
import { DoomRandom } from '../core/rng.ts';
import { ANG45 } from '../core/angle.ts';
import { parsePlaypal } from '../assets/playpal.ts';
import { MAPBLOCKSHIFT } from '../map/blockmap.ts';
import { findMapNames, parseMapBundle } from '../map/mapBundle.ts';
import { type MapData, setupLevel } from '../map/mapSetup.ts';
import { sectorIndexAt } from '../map/subsectorQuery.ts';
import { MTF_AMBUSH, MTF_EASY, MTF_HARD, MTF_NORMAL, MTF_NOT_SINGLE } from '../map/things.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../host/windowPolicy.ts';
import { ANGLE_TURN, FORWARD_MOVE, SIDE_MOVE, packTicCommand } from '../input/ticcmd.ts';
import { calcHeight, movePlayer } from '../player/movement.ts';
import type { Player } from '../player/playerSpawn.ts';
import { createPlayer, playerReborn } from '../player/playerSpawn.ts';
import {
  BACKGROUND,
  CDWALLCOLORS,
  FDWALLCOLORS,
  M_ZOOMIN,
  M_ZOOMOUT,
  PLAYER_ARROW_LINES,
  THINGCOLORS,
  THIN_TRIANGLE_GUY_LINES,
  TSWALLCOLORS,
  WALLCOLORS,
  YOURCOLORS,
  automapClipMline,
  automapDoFollowPlayer,
  automapDrawFline,
  automapRotate,
  automapStart,
  automapTicker,
  createAutomapState,
} from '../ui/automap.ts';
import type { AutomapState, Line2D } from '../ui/automap.ts';
import type { DirectoryEntry } from '../wad/directory.ts';
import { parseWadDirectory } from '../wad/directory.ts';
import { parseWadHeader } from '../wad/header.ts';
import { LumpLookup } from '../wad/lumpLookup.ts';
import { createBlockThingsGrid } from '../world/checkPosition.ts';
import type { BlockThingsGrid } from '../world/checkPosition.ts';
import { MF_AMBUSH, MF_SPAWNCEILING, MOBJINFO, Mobj, MobjType, ONCEILINGZ, ONFLOORZ, spawnMobj } from '../world/mobj.ts';
import { ThinkerList } from '../world/thinkers.ts';
import { xyMovement } from '../world/xyMovement.ts';
import { VIEWHEIGHT, zMovement } from '../world/zMovement.ts';

import { loadGameplayRenderResources } from './gameplayAssets.ts';
import type { GameplayRenderResources } from './gameplayAssets.ts';
import { createGameplayRenderState, renderGameplayFrame } from './gameplayRenderer.ts';
import type { GameplayRenderState } from './gameplayRenderer.ts';

const THING_MARK_SCALE = 16 * FRACUNIT;

export interface LauncherResources {
  readonly directory: readonly DirectoryEntry[];
  readonly iwadPath: string;
  readonly mapNames: readonly string[];
  readonly palette: Uint8Array;
  readonly renderResources: GameplayRenderResources;
  readonly wadBuffer: Buffer;
}

export interface LauncherSession {
  readonly automapState: AutomapState;
  readonly blocklinks: BlockThingsGrid;
  readonly framebuffer: Uint8Array;
  readonly mapData: MapData;
  readonly mapName: string;
  readonly palette: Uint8Array;
  readonly player: Player;
  readonly renderResources: GameplayRenderResources;
  readonly renderState: GameplayRenderState;
  readonly thinkerList: ThinkerList;
  readonly doomRandom: DoomRandom;
  levelTime: number;
  showAutomap: boolean;
}

export interface LauncherSessionOptions {
  readonly mapName: string;
  readonly skill: number;
}

export interface LauncherInputState {
  readonly backward: boolean;
  readonly forward: boolean;
  readonly quitRequested: boolean;
  readonly run: boolean;
  readonly strafeLeft: boolean;
  readonly strafeRight: boolean;
  readonly toggleMap: boolean;
  readonly toggleFollow: boolean;
  readonly turnLeft: boolean;
  readonly turnRight: boolean;
  readonly zoomIn: boolean;
  readonly zoomOut: boolean;
}

export const EMPTY_LAUNCHER_INPUT: LauncherInputState = Object.freeze({
  backward: false,
  forward: false,
  quitRequested: false,
  run: false,
  strafeLeft: false,
  strafeRight: false,
  toggleMap: false,
  toggleFollow: false,
  turnLeft: false,
  turnRight: false,
  zoomIn: false,
  zoomOut: false,
});

export async function loadLauncherResources(iwadPath: string): Promise<LauncherResources> {
  const wadFile = Bun.file(iwadPath);

  if (!(await wadFile.exists())) {
    throw new Error(`IWAD not found: ${iwadPath}`);
  }

  const wadBuffer = Buffer.from(await wadFile.arrayBuffer());
  const wadDirectory = parseWadDirectory(wadBuffer, parseWadHeader(wadBuffer));
  const wadLookup = new LumpLookup(wadDirectory);
  const palette = parsePlaypal(wadLookup.getLumpData('PLAYPAL', wadBuffer))[0]!;
  const renderResources = loadGameplayRenderResources(wadDirectory, wadBuffer);

  return Object.freeze({
    directory: wadDirectory,
    iwadPath,
    mapNames: findMapNames(wadDirectory),
    palette,
    renderResources,
    wadBuffer,
  });
}

export function createLauncherSession(resources: LauncherResources, options: LauncherSessionOptions): LauncherSession {
  validateSkill(options.skill);

  const mapName = options.mapName.toUpperCase();
  const mapData = setupLevel(parseMapBundle(resources.directory, resources.wadBuffer, mapName));
  const thinkerList = new ThinkerList();
  const doomRandom = new DoomRandom();
  const blocklinks = createBlockThingsGrid(mapData.blockmap.columns, mapData.blockmap.rows);
  const player = createPlayer();

  doomRandom.clearRandom();
  playerReborn(player);

  let playerSpawned = false;
  const skillFlag = skillFlagForGameskill(options.skill);

  for (const mapThing of mapData.things) {
    if (mapThing.type === 1) {
      if (!playerSpawned) {
        const playerMapObject = spawnMapThing(mapThing, MobjType.PLAYER, mapData, thinkerList, doomRandom, options.skill);
        playerMapObject.player = player;
        player.health = playerMapObject.health;
        player.mo = playerMapObject;
        player.viewheight = VIEWHEIGHT;
        player.deltaviewheight = 0;
        player.viewz = (playerMapObject.z + player.viewheight) | 0;
        linkThingToBlockmap(playerMapObject, mapData, blocklinks);
        playerSpawned = true;
      }
      continue;
    }

    if (mapThing.type >= 2 && mapThing.type <= 4) {
      continue;
    }

    if (mapThing.type === 11) {
      continue;
    }

    if ((mapThing.options & MTF_NOT_SINGLE) !== 0) {
      continue;
    }

    if ((mapThing.options & skillFlag) === 0) {
      continue;
    }

    const mapObjectType = findMapObjectType(mapThing.type);

    if (mapObjectType === null) {
      throw new RangeError(`No map object type exists for doomednum ${mapThing.type}.`);
    }

    const mapObject = spawnMapThing(mapThing, mapObjectType, mapData, thinkerList, doomRandom, options.skill);
    linkThingToBlockmap(mapObject, mapData, blocklinks);
  }

  if (!playerSpawned || player.mo === null) {
    throw new Error(`Player 1 start was not spawned for ${mapName}.`);
  }

  const automapState = createAutomapState();
  const levelKey = parseLevelKey(mapName);
  const lastLevelKey = { episode: -1, map: -1 };
  const renderState = createGameplayRenderState();

  automapState.cheating = 2;
  automapState.f_h = SCREENHEIGHT;
  automapState.f_w = SCREENWIDTH;
  automapStart(automapState, {
    episode: levelKey.episode,
    lastLevelKey,
    map: levelKey.map,
    playerX: player.mo.x,
    playerY: player.mo.y,
    vertexes: mapData.vertexes,
  });

  return {
    automapState,
    blocklinks,
    framebuffer: new Uint8Array(SCREENWIDTH * SCREENHEIGHT),
    mapData,
    mapName,
    palette: resources.palette,
    player,
    renderResources: resources.renderResources,
    renderState,
    thinkerList,
    doomRandom,
    levelTime: 0,
    showAutomap: false,
  };
}

export function advanceLauncherSession(session: LauncherSession, inputState: LauncherInputState): void {
  if (session.player.mo === null) {
    return;
  }

  if (inputState.toggleMap) {
    session.showAutomap = !session.showAutomap;
  }

  if (inputState.toggleFollow) {
    session.automapState.followplayer = session.automapState.followplayer === 0 ? 1 : 0;
    if (session.automapState.followplayer !== 0) {
      automapDoFollowPlayer(session.automapState, session.player.mo.x, session.player.mo.y);
    }
  }

  const speedIndex = inputState.run ? 1 : 0;
  const angleTurn = inputState.turnLeft && !inputState.turnRight ? ANGLE_TURN[speedIndex]! : inputState.turnRight && !inputState.turnLeft ? -ANGLE_TURN[speedIndex]! : 0;
  const forwardMove = inputState.forward && !inputState.backward ? FORWARD_MOVE[speedIndex]! : inputState.backward && !inputState.forward ? -FORWARD_MOVE[speedIndex]! : 0;
  const sideMove = inputState.strafeRight && !inputState.strafeLeft ? SIDE_MOVE[speedIndex]! : inputState.strafeLeft && !inputState.strafeRight ? -SIDE_MOVE[speedIndex]! : 0;

  session.player.cmd = packTicCommand(forwardMove, sideMove, angleTurn, 0, 0, 0);

  const onGround = movePlayer(session.player);
  xyMovement(session.player.mo, session.mapData, session.blocklinks, session.thinkerList, session.doomRandom);
  zMovement(session.player.mo, session.doomRandom, session.thinkerList);
  calcHeight(session.player, session.levelTime, onGround && session.player.mo.z <= session.player.mo.floorz);

  if (inputState.zoomIn && !inputState.zoomOut) {
    session.automapState.ftom_zoommul = M_ZOOMOUT;
    session.automapState.mtof_zoommul = M_ZOOMIN;
  } else if (inputState.zoomOut && !inputState.zoomIn) {
    session.automapState.ftom_zoommul = M_ZOOMIN;
    session.automapState.mtof_zoommul = M_ZOOMOUT;
  } else {
    session.automapState.ftom_zoommul = FRACUNIT;
    session.automapState.mtof_zoommul = FRACUNIT;
  }

  automapTicker(session.automapState, {
    playerX: session.player.mo.x,
    playerY: session.player.mo.y,
  });

  session.levelTime += 1;
}

export function renderLauncherFrame(session: LauncherSession): Uint8Array {
  if (!session.showAutomap) {
    return renderGameplayFrame({
      framebuffer: session.framebuffer,
      mapData: session.mapData,
      player: session.player,
      renderResources: session.renderResources,
      renderState: session.renderState,
    });
  }

  const framebuffer = session.framebuffer;

  framebuffer.fill(BACKGROUND);

  for (let linedefIndex = 0; linedefIndex < session.mapData.linedefs.length; linedefIndex += 1) {
    const linedef = session.mapData.linedefs[linedefIndex]!;
    const clippedLine = automapClipMline(session.automapState, {
      a: { x: session.mapData.vertexes[linedef.v1]!.x, y: session.mapData.vertexes[linedef.v1]!.y },
      b: { x: session.mapData.vertexes[linedef.v2]!.x, y: session.mapData.vertexes[linedef.v2]!.y },
    });

    if (clippedLine !== null) {
      automapDrawFline(framebuffer, session.automapState, clippedLine, wallColorForLinedef(session.mapData, linedefIndex));
    }
  }

  if (session.automapState.cheating > 1) {
    session.thinkerList.forEach((thinker) => {
      if (!(thinker instanceof Mobj)) {
        return;
      }

      if (thinker === session.player.mo) {
        return;
      }

      drawLineCharacter(framebuffer, session.automapState, THIN_TRIANGLE_GUY_LINES, thinker.x, thinker.y, thinker.angle, THINGCOLORS + session.automapState.lightlev, THING_MARK_SCALE);
    });
  }

  if (session.player.mo !== null) {
    drawLineCharacter(framebuffer, session.automapState, PLAYER_ARROW_LINES, session.player.mo.x, session.player.mo.y, session.player.mo.angle, YOURCOLORS);
  }

  return framebuffer;
}

function drawLineCharacter(framebuffer: Uint8Array, automapState: AutomapState, lines: readonly Line2D[], centerX: Fixed, centerY: Fixed, angle: Angle, color: number, scale: Fixed = FRACUNIT): void {
  for (const line of lines) {
    const rotatedStart = {
      x: fixedMul(line.a.x, scale),
      y: fixedMul(line.a.y, scale),
    };
    const rotatedEnd = {
      x: fixedMul(line.b.x, scale),
      y: fixedMul(line.b.y, scale),
    };

    automapRotate(rotatedStart, angle);
    automapRotate(rotatedEnd, angle);

    const clippedLine = automapClipMline(automapState, {
      a: { x: (centerX + rotatedStart.x) | 0, y: (centerY + rotatedStart.y) | 0 },
      b: { x: (centerX + rotatedEnd.x) | 0, y: (centerY + rotatedEnd.y) | 0 },
    });

    if (clippedLine !== null) {
      automapDrawFline(framebuffer, automapState, clippedLine, color);
    }
  }
}

function findMapObjectType(doomednum: number): MobjType | null {
  for (let mapObjectType = 0; mapObjectType < MOBJINFO.length; mapObjectType += 1) {
    if (MOBJINFO[mapObjectType]!.doomednum === doomednum) {
      return mapObjectType;
    }
  }

  return null;
}

function linkThingToBlockmap(thing: Mobj, mapData: MapData, blocklinks: BlockThingsGrid): void {
  refreshThingSector(thing, mapData);

  const blockX = ((thing.x - mapData.blockmap.originX) | 0) >> MAPBLOCKSHIFT;
  const blockY = ((thing.y - mapData.blockmap.originY) | 0) >> MAPBLOCKSHIFT;

  if (blockX < 0 || blockY < 0 || blockX >= mapData.blockmap.columns || blockY >= mapData.blockmap.rows) {
    return;
  }

  const cellIndex = blockY * mapData.blockmap.columns + blockX;

  thing.blockPrev = null;
  thing.blockNext = blocklinks[cellIndex];

  if (thing.blockNext !== null) {
    thing.blockNext.blockPrev = thing;
  }

  blocklinks[cellIndex] = thing;
}

function parseLevelKey(mapName: string): { episode: number; map: number } {
  const episodeMatch = /^E(\d)M(\d)$/i.exec(mapName);

  if (episodeMatch !== null) {
    return {
      episode: Number(episodeMatch[1]),
      map: Number(episodeMatch[2]),
    };
  }

  const mapMatch = /^MAP(\d\d)$/i.exec(mapName);

  if (mapMatch !== null) {
    return {
      episode: 0,
      map: Number(mapMatch[1]),
    };
  }

  return { episode: 0, map: 0 };
}

function refreshThingSector(thing: Mobj, mapData: MapData): void {
  const sectorIndex = sectorIndexAt(thing.x, thing.y, mapData.nodes, mapData.subsectorSectors);
  const sector = mapData.sectors[sectorIndex]!;

  thing.subsector = {
    sector: {
      ceilingheight: sector.ceilingheight,
      floorheight: sector.floorheight,
    },
  };
  thing.floorz = sector.floorheight;
  thing.ceilingz = sector.ceilingheight;
}

function skillFlagForGameskill(gameskill: number): number {
  if (gameskill <= 1) {
    return MTF_EASY;
  }

  if (gameskill === 2) {
    return MTF_NORMAL;
  }

  return MTF_HARD;
}

function spawnMapThing(
  mapThing: {
    readonly angle: number;
    readonly options: number;
    readonly type: number;
    readonly x: number;
    readonly y: number;
  },
  mapObjectType: MobjType,
  mapData: MapData,
  thinkerList: ThinkerList,
  doomRandom: DoomRandom,
  gameskill: number,
): Mobj {
  const mapX = mapThing.x * FRACUNIT;
  const mapY = mapThing.y * FRACUNIT;
  const sectorIndex = sectorIndexAt(mapX, mapY, mapData.nodes, mapData.subsectorSectors);
  const sector = mapData.sectors[sectorIndex]!;
  const mapObjectInfo = MOBJINFO[mapObjectType]!;
  const spawnZ = (mapObjectInfo.flags & MF_SPAWNCEILING) !== 0 ? ONCEILINGZ : ONFLOORZ;
  const mapObject = spawnMobj(mapX, mapY, spawnZ, mapObjectType, doomRandom, thinkerList, gameskill);

  mapObject.subsector = {
    sector: {
      ceilingheight: sector.ceilingheight,
      floorheight: sector.floorheight,
    },
  };
  mapObject.floorz = sector.floorheight;
  mapObject.ceilingz = sector.ceilingheight;
  mapObject.z = spawnZ === ONCEILINGZ ? (sector.ceilingheight - mapObject.height) | 0 : sector.floorheight;
  mapObject.angle = (((mapThing.angle / 45) | 0) * ANG45) >>> 0;
  mapObject.spawnpoint = {
    angle: mapThing.angle,
    options: mapThing.options,
    type: mapThing.type,
    x: mapThing.x,
    y: mapThing.y,
  };

  if ((mapThing.options & MTF_AMBUSH) !== 0) {
    mapObject.flags |= MF_AMBUSH;
  }

  return mapObject;
}

function validateSkill(skill: number): void {
  if (!Number.isInteger(skill) || skill < 1 || skill > 5) {
    throw new RangeError(`skill must be an integer from 1 to 5, got ${skill}`);
  }
}

function wallColorForLinedef(mapData: MapData, linedefIndex: number): number {
  const lineSectors = mapData.lineSectors[linedefIndex]!;

  if (lineSectors.backsector === -1) {
    return WALLCOLORS;
  }

  const frontsector = mapData.sectors[lineSectors.frontsector]!;
  const backsector = mapData.sectors[lineSectors.backsector]!;

  if (frontsector.floorheight !== backsector.floorheight) {
    return FDWALLCOLORS;
  }

  if (frontsector.ceilingheight !== backsector.ceilingheight) {
    return CDWALLCOLORS;
  }

  return TSWALLCOLORS;
}
