/**
 * Vanilla DOOM 1.9 shared runtime context.
 *
 * Plan_final step `04-001` (lane: runtime-core) creates the single
 * frozen artifact every downstream subsystem (asset loaders, render
 * init, audio init, save format, demo player, intermission, HUD,
 * automap) reads to derive its own per-tic state.  The runtime
 * context wires together:
 *
 *   - The {@link LaunchContext} from `03-004` (IWAD path, default.cfg
 *     path, chocolate-doom.cfg path, save directory).
 *   - The {@link IwadResourceCache} from `05-001` (parsed WAD header,
 *     directory, lump lookup, and final {@link GameIdentification}).
 *   - Flattened game-mode fields (`gameMode`, `gameMission`,
 *     `gameDescription`, `episodeCount`) for ergonomic access.
 *   - A fixed-size `playerSlots` array of length `MAXPLAYERS = 4`.
 *     Each slot starts unoccupied; single-player wires slot 0 via a
 *     later step.
 *   - An initially-empty `mapState` (no map loaded yet).
 *   - An initially-silent `audioState` (no music, no SFX channels).
 *   - A vanilla initial `uiState` (HUD visible, automap and menu
 *     closed, no intermission).
 *   - Two 320×200 indexed framebuffers matching vanilla `screens[0]`
 *     and `screens[1]` from `r_main.c` — the primary draw target
 *     and a back buffer for double-buffered fades / wipes.
 *
 * The top-level object is frozen so downstream subsystems cannot
 * mutate the shape; nested mutable state (framebuffer pixels, audio
 * channels, UI flags) follows the vanilla d_main.c pattern of
 * in-place buffer fills with stable object identity.
 *
 * @example
 * ```ts
 * import { createVanillaRuntimeContext } from './runtimeContext.ts';
 * import { buildIwadResourceCache } from './iwadResourceCache.ts';
 * import { resolveLaunchContext } from './launchContext.ts';
 * import { parseCommandLineConfiguration } from './commandLineConfiguration.ts';
 *
 * const configuration = parseCommandLineConfiguration(['doom_codex', '-iwad', 'doom/DOOM1.WAD']);
 * const context = resolveLaunchContext(configuration, {
 *   doomWadDirectoryEnvironmentValue: null,
 *   doesBasenameExistInWadDirectory: () => false,
 * });
 * const cache = buildIwadResourceCache(context, { readFile: (path) => Buffer.from(Bun.file(path).arrayBufferSync()) });
 * const runtime = createVanillaRuntimeContext(context, cache);
 * runtime.gameMode;                                  // 'shareware'
 * runtime.framebuffers.primary.length;               // 64000
 * runtime.playerSlots.length;                        // 4
 * runtime.playerSlots[0]!.present;                   // false
 * ```
 */

import type { GameIdentification, GameMission, GameMode } from '../bootstrap/gameMode.ts';
import type { IwadResourceCache } from './iwadResourceCache.ts';
import type { LaunchContext } from './launchContext.ts';
import { VANILLA_FRAMEBUFFER_BYTE_LENGTH, createIndexedFramebuffer } from './win32WindowHost.ts';

/**
 * Vanilla `MAXPLAYERS` from `doomdef.h` and `src/world/mobj.ts:1283`.
 * The runtime context pre-allocates this many player slots; the
 * launch-host-input lane wires single-player by setting slot 0's
 * `present` to true.
 */
export const VANILLA_PLAYER_SLOT_COUNT = 4;

/**
 * One slot in the runtime player roster.  `present` is `false` when
 * the slot is unoccupied (single-player default for slots 1..3).
 * `player` is the bound player primitive when the slot is occupied,
 * or `null` while the slot is empty.  The `player` type is
 * intentionally `unknown` here: the runtime context module does not
 * yet depend on `src/player/playerSpawn.ts`'s concrete `Player`
 * shape so that this step's read-only paths remain minimal; a later
 * runtime-core step will narrow this slot to the concrete `Player`
 * type.
 */
export interface PlayerSlot {
  readonly index: number;
  readonly present: boolean;
  readonly player: unknown | null;
}

/**
 * Map-load state slot.  `current` is `null` while no map is loaded;
 * the runtime gets populated by a later step that calls `setupLevel`
 * against the IWAD resource cache.  Carrying the slot here lets
 * every subsystem share a single mutable map-load reference rather
 * than pass the `MapData` snapshot through dozens of constructor
 * call sites.
 */
export interface RuntimeMapState {
  current: unknown | null;
}

/**
 * Audio runtime state.  At creation time nothing is playing and no
 * SFX channels are allocated.  The audio init step replaces these
 * fields with the active music player and the SFX-channel mixer.
 */
export interface RuntimeAudioState {
  musicPlaying: boolean;
  readonly sfxChannels: unknown[];
}

/**
 * UI runtime state.  At creation time the HUD is visible, the
 * automap and menu are closed, and no intermission phase is active
 * (the title-loop step transitions through the canonical title /
 * demo / wipeoff phases later).
 */
export interface RuntimeUiState {
  hudVisible: boolean;
  automapOpen: boolean;
  menuOpen: boolean;
  intermissionPhase: string | null;
}

/**
 * Pair of 320×200 indexed framebuffers matching vanilla `screens[0]`
 * (the draw target the render lane fills) and `screens[1]` (the
 * back buffer used by `R_SetupFrame` for melt/wipe transitions).
 * Both are 64 000 bytes — one byte per pixel — and zero-filled at
 * creation (palette index 0).  The buffers are pre-allocated here
 * so the render init step can wire them directly without
 * re-allocating per frame.
 */
export interface RuntimeFramebuffers {
  readonly primary: Uint8Array;
  readonly back: Uint8Array;
}

/**
 * The single frozen runtime artifact every downstream subsystem
 * reads.  Top-level fields are frozen; nested mutable state
 * (`framebuffers.primary[i]`, `mapState.current`, `audioState.*`,
 * `uiState.*`, `playerSlots[i].player` — although the slot
 * objects themselves are frozen, the slot's `player` reference is
 * replaced wholesale by re-creating the slot object during single-
 * player wire-up) follows the vanilla d_main.c in-place-fill
 * convention.
 */
export interface VanillaRuntimeContext {
  readonly launchContext: LaunchContext;
  readonly resourceCache: IwadResourceCache;
  readonly gameIdentification: GameIdentification;
  readonly gameMode: GameMode;
  readonly gameMission: GameMission;
  readonly gameDescription: string;
  readonly episodeCount: number;
  readonly playerSlots: readonly PlayerSlot[];
  readonly mapState: RuntimeMapState;
  readonly audioState: RuntimeAudioState;
  readonly uiState: RuntimeUiState;
  readonly framebuffers: RuntimeFramebuffers;
}

/**
 * Build a fresh frozen {@link VanillaRuntimeContext} from a resolved
 * {@link LaunchContext} (03-004) and a built {@link IwadResourceCache}
 * (05-001).  The runtime context exposes the game identification
 * fields flattened from `resourceCache.gameIdentification`, an empty
 * `playerSlots` roster, an empty `mapState`, a silent `audioState`,
 * a vanilla initial `uiState`, and two zero-filled 320×200 indexed
 * framebuffers.
 *
 * @param launchContext  The resolved launch context.
 * @param resourceCache  The built IWAD resource cache.
 * @returns A frozen runtime context ready to be wired into the rest
 *   of the engine init order.
 */
export function createVanillaRuntimeContext(launchContext: LaunchContext, resourceCache: IwadResourceCache): VanillaRuntimeContext {
  const playerSlots: PlayerSlot[] = [];
  for (let slotIndex = 0; slotIndex < VANILLA_PLAYER_SLOT_COUNT; slotIndex += 1) {
    playerSlots.push(
      Object.freeze({
        index: slotIndex,
        player: null,
        present: false,
      }) satisfies PlayerSlot,
    );
  }

  return Object.freeze({
    audioState: {
      musicPlaying: false,
      sfxChannels: [],
    } satisfies RuntimeAudioState,
    episodeCount: resourceCache.gameIdentification.episodeCount,
    framebuffers: Object.freeze({
      back: createIndexedFramebuffer(),
      primary: createIndexedFramebuffer(),
    }) satisfies RuntimeFramebuffers,
    gameDescription: resourceCache.gameIdentification.gameDescription,
    gameIdentification: resourceCache.gameIdentification,
    gameMission: resourceCache.gameIdentification.gameMission,
    gameMode: resourceCache.gameIdentification.gameMode,
    launchContext,
    mapState: { current: null } satisfies RuntimeMapState,
    playerSlots: Object.freeze(playerSlots),
    resourceCache,
    uiState: {
      automapOpen: false,
      hudVisible: true,
      intermissionPhase: null,
      menuOpen: false,
    } satisfies RuntimeUiState,
  });
}

void VANILLA_FRAMEBUFFER_BYTE_LENGTH;
