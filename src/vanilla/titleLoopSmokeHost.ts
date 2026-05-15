import { FFIType, dlopen, ptr } from 'bun:ffi';

import type { GameMode } from '../bootstrap/gameMode.ts';
import type { DecodedPatch } from '../render/patchDraw.ts';
import type { MenuState } from '../ui/menus.ts';
import { TitleLoop } from '../bootstrap/titleLoop.ts';
import { parsePlaypal } from '../assets/playpal.ts';
import { computeClientDimensions, computePresentationRect, SCREENHEIGHT, SCREENWIDTH } from '../host/windowPolicy.ts';
import { EMPTY_LAUNCHER_INPUT, advanceLauncherSession, createLauncherSession, loadLauncherResources, renderLauncherFrame } from '../launcher/session.ts';
import type { LauncherResources, LauncherSession } from '../launcher/session.ts';
import { decodePatch, drawPatch } from '../render/patchDraw.ts';
import { createFrontEndSequence, handleFrontEndKey, setMenuActive } from '../ui/frontEndSequence.ts';
import { KEY_ENTER, KEY_ESCAPE, LINEHEIGHT, MENU_TREE, SKULLXOFF, MenuKind, createMenuState, handleMenuKey, openMenu, tickMenu } from '../ui/menus.ts';
import { parseWadDirectory } from '../wad/directory.ts';
import { parseWadHeader } from '../wad/header.ts';
import { LumpLookup } from '../wad/lumpLookup.ts';

const BI_RGB = 0;
const BLEND_COLOR_PERCENT_MAXIMUM = 100;
const BLEND_TABLE_SIZE = 256 * 256;
const CW_USEDEFAULT = -0x8000_0000;
const DEFAULT_SCALE = 2;
const DIB_RGB_COLORS = 0;
const EPISODE_MENU_TITLE_LUMP = 'M_EPISOD';
const EPISODE_MENU_TITLE_X = 54;
const EPISODE_MENU_TITLE_Y = 38;
const INTERNAL_STRETCH_GROUP_SCANLINES = 5;
const INITIAL_SKULL_ANIM_COUNTER = 10;
const MAIN_MENU_TITLE_LUMP = 'M_DOOM';
const MAIN_MENU_TITLE_X = 94;
const MAIN_MENU_TITLE_Y = 2;
const MAXIMUM_MESSAGES_PER_LOOP = 32;
const MESSAGE_BYTE_LENGTH = 48;
const MESSAGE_KIND_OFFSET = 8;
const MESSAGE_WORD_PARAMETER_OFFSET = 16;
const MENU_TIC_INTERVAL_MS = 1_000 / 35;
const PM_REMOVE = 0x0001;
const RECT_BOTTOM_OFFSET = 12;
const RECT_RIGHT_OFFSET = 8;
const RECT_SIZE = 16;
const RUNTIME_COMMAND = 'bun run doom.ts';
const SCALE_2X = 2;
const SCALED_STRETCH_GROUP_SCANLINES = 12;
const SCREENHEIGHT_2X_ASPECT_CORRECTED = (SCREENHEIGHT / INTERNAL_STRETCH_GROUP_SCANLINES) * SCALED_STRETCH_GROUP_SCANLINES;
const SCREENWIDTH_2X = SCREENWIDTH * SCALE_2X;
const SRCCOPY = 0x00cc_0020;
const SW_SHOW = 5;
const TITLE_MENU_SMOKE_DEFAULT_CONTROL_PATH = 'plan_final/final-gates/13-002-title-menu-control.txt';
const TITLE_LOOP_WINDOW_TITLE = 'DOOM Codex - TITLEPIC';
const TITLE_MENU_SMOKE_CONTROL_PATH_ENVIRONMENT_VARIABLE = 'DOOM_TITLE_MENU_SMOKE_CONTROL_PATH';
const TITLE_MENU_SMOKE_CONTROL_POLL_INTERVAL_MS = 10;
const WM_CLOSE = 0x0010;
const WM_KEYDOWN = 0x0100;
const WINDOW_STYLE = 0x10cf_0000;
const DEFAULT_GAMEPLAY_EPISODE = 1;
const DEFAULT_GAMEPLAY_MAP_NUMBER = 1;

const GDI32_SYMBOLS = {
  DeleteDC: {
    args: [FFIType.u64] as const,
    returns: FFIType.i32,
  },
  StretchDIBits: {
    args: [FFIType.u64, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.u32] as const,
    returns: FFIType.i32,
  },
};

const USER32_SYMBOLS = {
  AdjustWindowRect: {
    args: [FFIType.ptr, FFIType.u32, FFIType.i32] as const,
    returns: FFIType.i32,
  },
  CreateWindowExW: {
    args: [FFIType.u32, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.u64, FFIType.u64, FFIType.u64, FFIType.ptr] as const,
    returns: FFIType.u64,
  },
  DestroyWindow: {
    args: [FFIType.u64] as const,
    returns: FFIType.i32,
  },
  GetAsyncKeyState: {
    args: [FFIType.i32] as const,
    returns: FFIType.i16,
  },
  GetClientRect: {
    args: [FFIType.u64, FFIType.ptr] as const,
    returns: FFIType.i32,
  },
  GetDC: {
    args: [FFIType.u64] as const,
    returns: FFIType.u64,
  },
  ReleaseDC: {
    args: [FFIType.u64, FFIType.u64] as const,
    returns: FFIType.i32,
  },
  PeekMessageW: {
    args: [FFIType.ptr, FFIType.u64, FFIType.u32, FFIType.u32, FFIType.u32] as const,
    returns: FFIType.i32,
  },
  ShowWindow: {
    args: [FFIType.u64, FFIType.i32] as const,
    returns: FFIType.i32,
  },
};

type Gdi32Symbols = ReturnType<typeof openGdi32>['symbols'];
type User32Symbols = ReturnType<typeof openUser32>['symbols'];

export interface TitleLoopSmokeHostOptions {
  readonly gameMode: GameMode;
  readonly iwadPath: string;
  readonly scale?: number;
}

interface TitleLoopSmokeFrame {
  readonly framebuffer: Uint8Array;
  readonly palette: Uint8Array;
  readonly patchCache: Map<string, DecodedPatch>;
  readonly wadBuffer: Buffer;
  readonly wadLookup: LumpLookup;
}

interface TitleLoopSmokeKeyboardState {
  enterDown: boolean;
  escapeDown: boolean;
}

interface TitleLoopSmokeGameplayState {
  nextTickAtMs: number;
  selectedEpisode: number;
  session: LauncherSession | null;
}

interface TitleLoopSmokeMenuTickState {
  nextTickAtMs: number;
}

interface TitleLoopSmokeControlState {
  lastCommand: string;
  nextPollAtMs: number;
  path: string | null;
}

interface SmokeHostMessageResult {
  readonly frameChanged: boolean;
  readonly shouldContinue: boolean;
}

interface StretchTables {
  readonly blend20: Uint8Array;
  readonly blend40: Uint8Array;
}

function openGdi32() {
  return dlopen('gdi32.dll', GDI32_SYMBOLS);
}

function openUser32() {
  return dlopen('user32.dll', USER32_SYMBOLS);
}

function buildBitmapInfoHeader(width: number, height: number): Buffer {
  const bitmapInfoHeader = Buffer.alloc(40);

  bitmapInfoHeader.writeUInt32LE(40, 0);
  bitmapInfoHeader.writeInt32LE(width, 4);
  bitmapInfoHeader.writeInt32LE(-height, 8);
  bitmapInfoHeader.writeUInt16LE(1, 12);
  bitmapInfoHeader.writeUInt16LE(32, 14);
  bitmapInfoHeader.writeUInt32LE(BI_RGB, 16);
  bitmapInfoHeader.writeUInt32LE(width * height * 4, 20);

  return bitmapInfoHeader;
}

function buildPaletteLookup(palette: Uint8Array): Uint32Array {
  const colors = new Uint32Array(256);

  for (let colorIndex = 0; colorIndex < 256; colorIndex += 1) {
    const paletteOffset = colorIndex * 3;
    const red = toChocolateDisplayPaletteChannel(palette[paletteOffset]!);
    const green = toChocolateDisplayPaletteChannel(palette[paletteOffset + 1]!);
    const blue = toChocolateDisplayPaletteChannel(palette[paletteOffset + 2]!);

    colors[colorIndex] = blue | (green << 8) | (red << 16);
  }

  return colors;
}

function toChocolateDisplayPaletteChannel(channel: number): number {
  const gammaCorrectedChannel = channel < 128 ? channel + 1 : channel;
  return gammaCorrectedChannel & ~3;
}

function convertIndexedFrame(source: Uint8Array, destination: Uint32Array, paletteLookup: Uint32Array): void {
  for (let pixelIndex = 0; pixelIndex < source.length; pixelIndex += 1) {
    destination[pixelIndex] = paletteLookup[source[pixelIndex]!]!;
  }
}

function findNearestPaletteIndex(palette: Uint8Array, red: number, green: number, blue: number): number {
  let bestDifference = Number.MAX_SAFE_INTEGER;
  let bestPaletteIndex = 0;

  for (let paletteIndex = 0; paletteIndex < 256; paletteIndex += 1) {
    const paletteOffset = paletteIndex * 3;
    const redDifference = red - palette[paletteOffset]!;
    const greenDifference = green - palette[paletteOffset + 1]!;
    const blueDifference = blue - palette[paletteOffset + 2]!;
    const difference = redDifference * redDifference + greenDifference * greenDifference + blueDifference * blueDifference;

    if (difference === 0) {
      return paletteIndex;
    }

    if (difference < bestDifference) {
      bestDifference = difference;
      bestPaletteIndex = paletteIndex;
    }
  }

  return bestPaletteIndex;
}

function buildBlendTable(palette: Uint8Array, firstColorPercent: number): Uint8Array {
  const table = new Uint8Array(BLEND_TABLE_SIZE);
  const secondColorPercent = BLEND_COLOR_PERCENT_MAXIMUM - firstColorPercent;

  for (let firstPaletteIndex = 0; firstPaletteIndex < 256; firstPaletteIndex += 1) {
    const firstPaletteOffset = firstPaletteIndex * 3;
    for (let secondPaletteIndex = 0; secondPaletteIndex < 256; secondPaletteIndex += 1) {
      const secondPaletteOffset = secondPaletteIndex * 3;
      const red = Math.trunc((palette[firstPaletteOffset]! * firstColorPercent + palette[secondPaletteOffset]! * secondColorPercent) / BLEND_COLOR_PERCENT_MAXIMUM);
      const green = Math.trunc((palette[firstPaletteOffset + 1]! * firstColorPercent + palette[secondPaletteOffset + 1]! * secondColorPercent) / BLEND_COLOR_PERCENT_MAXIMUM);
      const blue = Math.trunc((palette[firstPaletteOffset + 2]! * firstColorPercent + palette[secondPaletteOffset + 2]! * secondColorPercent) / BLEND_COLOR_PERCENT_MAXIMUM);
      table[firstPaletteIndex * 256 + secondPaletteIndex] = findNearestPaletteIndex(palette, red, green, blue);
    }
  }

  return table;
}

function buildStretchTables(palette: Uint8Array): StretchTables {
  return Object.freeze({
    blend20: buildBlendTable(palette, 20),
    blend40: buildBlendTable(palette, 40),
  });
}

function writeStretchedLine2x(destination: Uint8Array, destinationOffset: number, source: Uint8Array, sourceOffset: number): void {
  let outputOffset = destinationOffset;
  for (let sourceColumn = 0; sourceColumn < SCREENWIDTH; sourceColumn += 1) {
    const paletteIndex = source[sourceOffset + sourceColumn]!;
    destination[outputOffset] = paletteIndex;
    destination[outputOffset + 1] = paletteIndex;
    outputOffset += SCALE_2X;
  }
}

function writeBlendedStretchedLine2x(destination: Uint8Array, destinationOffset: number, source: Uint8Array, firstSourceOffset: number, secondSourceOffset: number, blendTable: Uint8Array): void {
  let outputOffset = destinationOffset;
  for (let sourceColumn = 0; sourceColumn < SCREENWIDTH; sourceColumn += 1) {
    const paletteIndex = blendTable[source[firstSourceOffset + sourceColumn]! * 256 + source[secondSourceOffset + sourceColumn]!]!;
    destination[outputOffset] = paletteIndex;
    destination[outputOffset + 1] = paletteIndex;
    outputOffset += SCALE_2X;
  }
}

function stretchIndexedFrameToChocolate2x(source: Uint8Array, destination: Uint8Array, stretchTables: StretchTables): void {
  let sourceOffset = 0;
  let destinationOffset = 0;
  const destinationPitch = SCREENWIDTH_2X;

  for (let sourceRowGroup = 0; sourceRowGroup < SCREENHEIGHT; sourceRowGroup += INTERNAL_STRETCH_GROUP_SCANLINES) {
    writeStretchedLine2x(destination, destinationOffset, source, sourceOffset);
    destinationOffset += destinationPitch;

    writeStretchedLine2x(destination, destinationOffset, source, sourceOffset);
    destinationOffset += destinationPitch;

    writeBlendedStretchedLine2x(destination, destinationOffset, source, sourceOffset, sourceOffset + SCREENWIDTH, stretchTables.blend40);
    destinationOffset += destinationPitch;
    sourceOffset += SCREENWIDTH;

    writeStretchedLine2x(destination, destinationOffset, source, sourceOffset);
    destinationOffset += destinationPitch;

    writeBlendedStretchedLine2x(destination, destinationOffset, source, sourceOffset + SCREENWIDTH, sourceOffset, stretchTables.blend20);
    destinationOffset += destinationPitch;
    sourceOffset += SCREENWIDTH;

    writeStretchedLine2x(destination, destinationOffset, source, sourceOffset);
    destinationOffset += destinationPitch;

    writeStretchedLine2x(destination, destinationOffset, source, sourceOffset);
    destinationOffset += destinationPitch;

    writeBlendedStretchedLine2x(destination, destinationOffset, source, sourceOffset, sourceOffset + SCREENWIDTH, stretchTables.blend20);
    destinationOffset += destinationPitch;
    sourceOffset += SCREENWIDTH;

    writeStretchedLine2x(destination, destinationOffset, source, sourceOffset);
    destinationOffset += destinationPitch;

    writeBlendedStretchedLine2x(destination, destinationOffset, source, sourceOffset + SCREENWIDTH, sourceOffset, stretchTables.blend40);
    destinationOffset += destinationPitch;
    sourceOffset += SCREENWIDTH;

    writeStretchedLine2x(destination, destinationOffset, source, sourceOffset);
    destinationOffset += destinationPitch;

    writeStretchedLine2x(destination, destinationOffset, source, sourceOffset);
    destinationOffset += destinationPitch;
    sourceOffset += SCREENWIDTH;
  }
}

async function loadTitleLoopSmokeFrame(options: TitleLoopSmokeHostOptions): Promise<TitleLoopSmokeFrame> {
  const iwadFile = Bun.file(options.iwadPath);
  if (!(await iwadFile.exists())) {
    throw new Error(`IWAD not found: ${options.iwadPath}`);
  }

  const wadBuffer = Buffer.from(await iwadFile.arrayBuffer());
  const wadDirectory = parseWadDirectory(wadBuffer, parseWadHeader(wadBuffer));
  const wadLookup = new LumpLookup(wadDirectory);
  const titleLoop = new TitleLoop(options.gameMode);
  const titleAction = titleLoop.doAdvanceDemo();

  if (titleAction === null || titleAction.kind !== 'page' || titleAction.lumpName !== 'TITLEPIC') {
    throw new Error('Title loop did not begin on the TITLEPIC page.');
  }

  const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
  const titlePatch = decodePatch(wadLookup.getLumpData(titleAction.lumpName, wadBuffer));
  drawPatch(titlePatch, 0, 0, framebuffer);

  if (!framebuffer.some((paletteIndex) => paletteIndex !== 0)) {
    throw new Error('TITLEPIC rendered an all-zero framebuffer.');
  }

  return Object.freeze({
    framebuffer,
    palette: parsePlaypal(wadLookup.getLumpData('PLAYPAL', wadBuffer))[0]!,
    patchCache: new Map<string, DecodedPatch>([[titleAction.lumpName, titlePatch]]),
    wadBuffer,
    wadLookup,
  });
}

function drawPatchByName(frame: TitleLoopSmokeFrame, lumpName: string, coordinateX: number, coordinateY: number, framebuffer: Uint8Array): void {
  let patch = frame.patchCache.get(lumpName);
  if (patch === undefined) {
    patch = decodePatch(frame.wadLookup.getLumpData(lumpName, frame.wadBuffer));
    frame.patchCache.set(lumpName, patch);
  }

  drawPatch(patch, coordinateX, coordinateY, framebuffer);
}

function drawMenuTitle(frame: TitleLoopSmokeFrame, menuState: MenuState, framebuffer: Uint8Array): void {
  switch (menuState.currentMenu) {
    case MenuKind.Main:
      drawPatchByName(frame, MAIN_MENU_TITLE_LUMP, MAIN_MENU_TITLE_X, MAIN_MENU_TITLE_Y, framebuffer);
      return;
    case MenuKind.Episode:
      drawPatchByName(frame, EPISODE_MENU_TITLE_LUMP, EPISODE_MENU_TITLE_X, EPISODE_MENU_TITLE_Y, framebuffer);
      return;
    case MenuKind.Load:
    case MenuKind.Options:
    case MenuKind.ReadThis1:
    case MenuKind.ReadThis2:
    case MenuKind.Save:
    case MenuKind.Skill:
    case MenuKind.SoundVolume:
      return;
  }
}

function getEpisodeMenuItemCount(gameMode: GameMode): number {
  switch (gameMode) {
    case 'registered':
    case 'shareware':
      return 3;
    case 'retail':
      return 4;
    case 'commercial':
    case 'indetermined':
      return 0;
  }
}

function getVisibleMenuItemCount(gameMode: GameMode, menuState: MenuState): number {
  const menuDefinition = MENU_TREE[menuState.currentMenu];
  if (menuState.currentMenu === MenuKind.Episode) {
    return getEpisodeMenuItemCount(gameMode);
  }

  return menuDefinition.items.length;
}

function drawMenuOverlay(frame: TitleLoopSmokeFrame, gameMode: GameMode, menuState: MenuState, framebuffer: Uint8Array): void {
  if (!menuState.active) {
    return;
  }

  const menuDefinition = MENU_TREE[menuState.currentMenu];
  const visibleMenuItemCount = getVisibleMenuItemCount(gameMode, menuState);

  drawMenuTitle(frame, menuState, framebuffer);

  for (let itemIndex = 0; itemIndex < visibleMenuItemCount; itemIndex += 1) {
    const item = menuDefinition.items[itemIndex];
    if (item === undefined || item.lump.length === 0 || !frame.wadLookup.hasLump(item.lump)) {
      continue;
    }

    drawPatchByName(frame, item.lump, menuDefinition.x, menuDefinition.y + itemIndex * LINEHEIGHT, framebuffer);
  }

  const skullLumpName = menuState.whichSkull === 0 ? 'M_SKULL1' : 'M_SKULL2';
  drawPatchByName(frame, skullLumpName, menuDefinition.x + SKULLXOFF, menuDefinition.y - 5 + menuState.itemOn * LINEHEIGHT, framebuffer);
}

function composeIndexedFrame(frame: TitleLoopSmokeFrame, gameMode: GameMode, menuState: MenuState, gameplayState: TitleLoopSmokeGameplayState, framebuffer: Uint8Array): void {
  if (gameplayState.session !== null) {
    framebuffer.set(renderLauncherFrame(gameplayState.session));
    drawMenuOverlay(frame, gameMode, menuState, framebuffer);
    return;
  }

  framebuffer.set(frame.framebuffer);
  drawMenuOverlay(frame, gameMode, menuState, framebuffer);
}

function createControlState(): TitleLoopSmokeControlState {
  const path = Bun.env[TITLE_MENU_SMOKE_CONTROL_PATH_ENVIRONMENT_VARIABLE]?.trim() ?? TITLE_MENU_SMOKE_DEFAULT_CONTROL_PATH;
  return {
    lastCommand: '',
    nextPollAtMs: 0,
    path: path === undefined || path.length === 0 ? null : path,
  };
}

function createSmokeHostGameplaySession(resources: LauncherResources, episode: number, skill: number): LauncherSession {
  return createLauncherSession(resources, {
    mapName: `E${episode}M${DEFAULT_GAMEPLAY_MAP_NUMBER}`,
    skill: normalizeMenuSkill(skill),
  });
}

function normalizeMenuSkill(skill: number): number {
  return Math.max(1, skill);
}

function handleSmokeHostKey(gameMode: GameMode, menuState: MenuState, gameplayResources: LauncherResources, gameplayState: TitleLoopSmokeGameplayState, key: number): boolean {
  if (!menuState.active) {
    if (key === KEY_ESCAPE) {
      const frontEndState = createFrontEndSequence(gameMode);
      const frontEndAction = handleFrontEndKey(frontEndState, key);
      if (frontEndAction.kind === 'openMenu') {
        handleMenuKey(menuState, key);
        setMenuActive(frontEndState, menuState.active);
        return true;
      }
    }
    return false;
  }

  const previousActive = menuState.active;
  const previousCurrentMenu = menuState.currentMenu;
  const previousItemOn = menuState.itemOn;
  const action = handleMenuKey(menuState, key);

  switch (action.kind) {
    case 'selectEpisode':
      gameplayState.selectedEpisode = action.episode;
      openMenu(menuState, MenuKind.Skill);
      return true;
    case 'selectSkill':
      gameplayState.session = createSmokeHostGameplaySession(gameplayResources, gameplayState.selectedEpisode, action.skill);
      gameplayState.nextTickAtMs = performance.now() + MENU_TIC_INTERVAL_MS;
      menuState.active = false;
      return true;
    case 'adjustMusicVolume':
    case 'adjustScreenSize':
    case 'adjustSensitivity':
    case 'adjustSfxVolume':
    case 'beginSaveStringEntry':
    case 'cancelSaveStringEntry':
    case 'closeMenu':
    case 'commitSaveStringEntry':
    case 'endGame':
    case 'none':
    case 'openMenu':
    case 'openMessage':
    case 'quitGame':
    case 'readThisAdvance':
    case 'selectLoadSlot':
    case 'selectSaveSlot':
    case 'toggleDetail':
    case 'toggleMessages':
      break;
  }

  return action.kind !== 'none' || previousActive !== menuState.active || previousCurrentMenu !== menuState.currentMenu || previousItemOn !== menuState.itemOn;
}

async function pollSmokeHostControl(gameMode: GameMode, menuState: MenuState, gameplayResources: LauncherResources, gameplayState: TitleLoopSmokeGameplayState, controlState: TitleLoopSmokeControlState): Promise<boolean> {
  if (controlState.path === null) {
    return false;
  }

  const now = performance.now();
  if (now < controlState.nextPollAtMs) {
    return false;
  }
  controlState.nextPollAtMs = now + TITLE_MENU_SMOKE_CONTROL_POLL_INTERVAL_MS;

  const controlFile = Bun.file(controlState.path);
  if (!(await controlFile.exists())) {
    return false;
  }

  const command = (await controlFile.text()).trim().toLowerCase();
  if (command.length === 0 || command === controlState.lastCommand) {
    return false;
  }
  controlState.lastCommand = command;

  switch (command) {
    case 'enter':
      return handleSmokeHostKey(gameMode, menuState, gameplayResources, gameplayState, KEY_ENTER);
    case 'escape':
      return handleSmokeHostKey(gameMode, menuState, gameplayResources, gameplayState, KEY_ESCAPE);
    default:
      return false;
  }
}

function drainSmokeHostMessages(
  user32: User32Symbols,
  windowHandle: bigint,
  gameMode: GameMode,
  menuState: MenuState,
  gameplayResources: LauncherResources,
  gameplayState: TitleLoopSmokeGameplayState,
  messageBuffer: Buffer,
): SmokeHostMessageResult {
  let frameChanged = false;

  for (let messageIndex = 0; messageIndex < MAXIMUM_MESSAGES_PER_LOOP; messageIndex += 1) {
    const peekMessageResult = user32.PeekMessageW(ptr(messageBuffer), windowHandle, 0, 0, PM_REMOVE);

    if (typeof peekMessageResult !== 'number') {
      throw new TypeError(`PeekMessageW returned ${typeof peekMessageResult} instead of number`);
    }

    if (peekMessageResult === 0) {
      return { frameChanged, shouldContinue: true };
    }

    const messageKind = messageBuffer.readUInt32LE(MESSAGE_KIND_OFFSET);
    if (messageKind === WM_CLOSE) {
      return { frameChanged, shouldContinue: false };
    }

    if (messageKind === WM_KEYDOWN) {
      const key = Number(messageBuffer.readBigUInt64LE(MESSAGE_WORD_PARAMETER_OFFSET));
      frameChanged = handleSmokeHostKey(gameMode, menuState, gameplayResources, gameplayState, key) || frameChanged;
    }
  }

  return { frameChanged, shouldContinue: true };
}

function isVirtualKeyDown(user32: User32Symbols, key: number): boolean {
  const asyncKeyStateResult = user32.GetAsyncKeyState(key);

  if (typeof asyncKeyStateResult !== 'number') {
    throw new TypeError(`GetAsyncKeyState returned ${typeof asyncKeyStateResult} instead of number`);
  }

  return (asyncKeyStateResult & 0x8000) !== 0;
}

function pollSmokeHostKeyboard(user32: User32Symbols, gameMode: GameMode, menuState: MenuState, gameplayResources: LauncherResources, gameplayState: TitleLoopSmokeGameplayState, keyboardState: TitleLoopSmokeKeyboardState): boolean {
  let frameChanged = false;
  const escapeDown = isVirtualKeyDown(user32, KEY_ESCAPE);
  if (escapeDown && !keyboardState.escapeDown) {
    frameChanged = handleSmokeHostKey(gameMode, menuState, gameplayResources, gameplayState, KEY_ESCAPE) || frameChanged;
  }
  keyboardState.escapeDown = escapeDown;

  const enterDown = isVirtualKeyDown(user32, KEY_ENTER);
  if (enterDown && !keyboardState.enterDown) {
    frameChanged = handleSmokeHostKey(gameMode, menuState, gameplayResources, gameplayState, KEY_ENTER) || frameChanged;
  }
  keyboardState.enterDown = enterDown;

  return frameChanged;
}

function tickSmokeHostMenu(menuState: MenuState, tickState: TitleLoopSmokeMenuTickState): boolean {
  const now = performance.now();
  let frameChanged = false;

  while (now >= tickState.nextTickAtMs) {
    const previousWhichSkull = menuState.whichSkull;
    tickMenu(menuState);
    frameChanged = (menuState.active && previousWhichSkull !== menuState.whichSkull) || frameChanged;
    tickState.nextTickAtMs += MENU_TIC_INTERVAL_MS;
  }

  return frameChanged;
}

function tickSmokeHostGameplay(gameplayState: TitleLoopSmokeGameplayState): boolean {
  if (gameplayState.session === null) {
    return false;
  }

  const now = performance.now();
  let frameChanged = false;

  while (now >= gameplayState.nextTickAtMs) {
    advanceLauncherSession(gameplayState.session, EMPTY_LAUNCHER_INPUT);
    gameplayState.nextTickAtMs += MENU_TIC_INTERVAL_MS;
    frameChanged = true;
  }

  return frameChanged;
}

function presentFrame(user32: User32Symbols, gdi32: Gdi32Symbols, windowHandle: bigint, displayFrameBytes: Buffer, displayFrameHeader: Buffer, backgroundFillBytes: Buffer, backgroundFillHeader: Buffer): void {
  const clientRectBuffer = Buffer.alloc(RECT_SIZE);
  const clientRectView = new DataView(clientRectBuffer.buffer, clientRectBuffer.byteOffset, RECT_SIZE);

  const getClientRectResult = user32.GetClientRect(windowHandle, clientRectBuffer);

  if (typeof getClientRectResult !== 'number') {
    throw new TypeError(`GetClientRect returned ${typeof getClientRectResult} instead of number`);
  }

  if (getClientRectResult === 0) {
    throw new Error('GetClientRect failed');
  }

  const clientWidth = clientRectView.getInt32(RECT_RIGHT_OFFSET, true);
  const clientHeight = clientRectView.getInt32(RECT_BOTTOM_OFFSET, true);

  if (clientWidth <= 0 || clientHeight <= 0) {
    return;
  }

  const presentationRect = computePresentationRect(clientWidth, clientHeight, true);
  const deviceContextResult = user32.GetDC(windowHandle);

  if (typeof deviceContextResult !== 'bigint') {
    throw new TypeError(`GetDC returned ${typeof deviceContextResult} instead of bigint`);
  }

  const deviceContext = deviceContextResult;

  if (deviceContext === 0n) {
    throw new Error('GetDC failed');
  }

  try {
    void gdi32.StretchDIBits(deviceContext, 0, 0, clientWidth, clientHeight, 0, 0, 1, 1, backgroundFillBytes, backgroundFillHeader, DIB_RGB_COLORS, SRCCOPY);

    if (presentationRect.width === 0 || presentationRect.height === 0) {
      return;
    }

    void gdi32.StretchDIBits(
      deviceContext,
      presentationRect.x,
      presentationRect.y,
      presentationRect.width,
      presentationRect.height,
      0,
      0,
      SCREENWIDTH_2X,
      SCREENHEIGHT_2X_ASPECT_CORRECTED,
      displayFrameBytes,
      displayFrameHeader,
      DIB_RGB_COLORS,
      SRCCOPY,
    );
  } finally {
    void user32.ReleaseDC(windowHandle, deviceContext);
  }
}

export async function runTitleLoopSmokeHost(options: TitleLoopSmokeHostOptions): Promise<void> {
  const frame = await loadTitleLoopSmokeFrame(options);
  const gameplayResources = await loadLauncherResources(options.iwadPath);
  const initialClientSize = computeClientDimensions(options.scale ?? DEFAULT_SCALE, true);
  const user32 = openUser32();
  const gdi32 = openGdi32();
  const windowRect = Buffer.alloc(RECT_SIZE);
  const windowRectView = new DataView(windowRect.buffer, windowRect.byteOffset, RECT_SIZE);
  const composedIndexedFrame = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
  const stretchedIndexedFrame = new Uint8Array(SCREENWIDTH_2X * SCREENHEIGHT_2X_ASPECT_CORRECTED);
  const displayFrameBuffer = new Uint32Array(SCREENWIDTH_2X * SCREENHEIGHT_2X_ASPECT_CORRECTED);
  const displayFrameBytes = Buffer.from(displayFrameBuffer.buffer);
  const displayFrameHeader = buildBitmapInfoHeader(SCREENWIDTH_2X, SCREENHEIGHT_2X_ASPECT_CORRECTED);
  const backgroundFillBuffer = new Uint32Array([0x0000_0000]);
  const backgroundFillBytes = Buffer.from(backgroundFillBuffer.buffer);
  const backgroundFillHeader = buildBitmapInfoHeader(1, 1);
  const controlState = createControlState();
  const gameplayState: TitleLoopSmokeGameplayState = { nextTickAtMs: performance.now() + MENU_TIC_INTERVAL_MS, selectedEpisode: DEFAULT_GAMEPLAY_EPISODE, session: null };
  const keyboardState: TitleLoopSmokeKeyboardState = { enterDown: false, escapeDown: false };
  const menuState = createMenuState();
  menuState.skullAnimCounter = INITIAL_SKULL_ANIM_COUNTER;
  const menuTickState: TitleLoopSmokeMenuTickState = { nextTickAtMs: performance.now() + MENU_TIC_INTERVAL_MS };
  const messageBuffer = Buffer.alloc(MESSAGE_BYTE_LENGTH);
  const paletteLookup = buildPaletteLookup(frame.palette);
  const stretchTables = buildStretchTables(frame.palette);
  const windowClassName = Buffer.from('STATIC\0', 'utf16le');
  const windowTitle = Buffer.from(`${TITLE_LOOP_WINDOW_TITLE}\0`, 'utf16le');

  windowRectView.setInt32(0, 0, true);
  windowRectView.setInt32(4, 0, true);
  windowRectView.setInt32(8, initialClientSize.width, true);
  windowRectView.setInt32(12, initialClientSize.height, true);

  const adjustWindowRectResult = user32.symbols.AdjustWindowRect(windowRect, WINDOW_STYLE, 0);

  if (typeof adjustWindowRectResult !== 'number') {
    throw new TypeError(`AdjustWindowRect returned ${typeof adjustWindowRectResult} instead of number`);
  }

  if (adjustWindowRectResult === 0) {
    throw new Error('AdjustWindowRect failed');
  }

  const outerWidth = windowRectView.getInt32(RECT_RIGHT_OFFSET, true) - windowRectView.getInt32(0, true);
  const outerHeight = windowRectView.getInt32(RECT_BOTTOM_OFFSET, true) - windowRectView.getInt32(4, true);
  const windowHandleResult = user32.symbols.CreateWindowExW(0, windowClassName, windowTitle, WINDOW_STYLE, CW_USEDEFAULT, CW_USEDEFAULT, outerWidth, outerHeight, 0n, 0n, 0n, null);

  if (typeof windowHandleResult !== 'bigint') {
    throw new TypeError(`CreateWindowExW returned ${typeof windowHandleResult} instead of bigint`);
  }

  const windowHandle = windowHandleResult;

  if (windowHandle === 0n) {
    throw new Error('CreateWindowExW failed');
  }

  void user32.symbols.ShowWindow(windowHandle, SW_SHOW);

  let windowDestroyed = false;
  let frameDirty = true;

  try {
    while (true) {
      frameDirty = (await pollSmokeHostControl(options.gameMode, menuState, gameplayResources, gameplayState, controlState)) || frameDirty;

      const messageResult = drainSmokeHostMessages(user32.symbols, windowHandle, options.gameMode, menuState, gameplayResources, gameplayState, messageBuffer);

      if (!messageResult.shouldContinue) {
        void user32.symbols.DestroyWindow(windowHandle);
        windowDestroyed = true;
        return;
      }

      frameDirty =
        messageResult.frameChanged ||
        pollSmokeHostKeyboard(user32.symbols, options.gameMode, menuState, gameplayResources, gameplayState, keyboardState) ||
        tickSmokeHostMenu(menuState, menuTickState) ||
        tickSmokeHostGameplay(gameplayState) ||
        frameDirty;

      if (frameDirty) {
        composeIndexedFrame(frame, options.gameMode, menuState, gameplayState, composedIndexedFrame);
        stretchIndexedFrameToChocolate2x(composedIndexedFrame, stretchedIndexedFrame, stretchTables);
        convertIndexedFrame(stretchedIndexedFrame, displayFrameBuffer, paletteLookup);
        presentFrame(user32.symbols, gdi32.symbols, windowHandle, displayFrameBytes, displayFrameHeader, backgroundFillBytes, backgroundFillHeader);
        frameDirty = false;
      }

      await Bun.sleep(1);
    }
  } finally {
    if (!windowDestroyed) {
      void user32.symbols.DestroyWindow(windowHandle);
    }
    gdi32.close();
    user32.close();
  }
}

export const TITLE_LOOP_SMOKE_HOST_CONTRACT = Object.freeze({
  pageLumpName: 'TITLEPIC',
  runtimeCommand: RUNTIME_COMMAND,
  windowTitle: TITLE_LOOP_WINDOW_TITLE,
});

/** Runtime gameplay route exposed by the root title-loop smoke host. */
export const TITLE_LOOP_SMOKE_GAMEPLAY_CONTRACT = Object.freeze({
  defaultEpisode: DEFAULT_GAMEPLAY_EPISODE,
  defaultMapNumber: DEFAULT_GAMEPLAY_MAP_NUMBER,
  runtimeCommand: RUNTIME_COMMAND,
});

/**
 * Create the E1M1 gameplay session used after the title/menu route starts a new game.
 *
 * @param iwadPath - Path to the local IWAD file consumed by the smoke host.
 * @param skill - Menu skill number to use for the launcher session.
 * @returns A launcher gameplay session positioned at the E1M1 start.
 *
 * @example
 * ```ts
 * const session = await createTitleLoopSmokeHostGameplaySession('doom/DOOM1.WAD', 2);
 * console.log(session.mapName); // "E1M1"
 * ```
 */
export async function createTitleLoopSmokeHostGameplaySession(iwadPath: string, skill: number = 2): Promise<LauncherSession> {
  const resources = await loadLauncherResources(iwadPath);
  return createSmokeHostGameplaySession(resources, DEFAULT_GAMEPLAY_EPISODE, skill);
}
