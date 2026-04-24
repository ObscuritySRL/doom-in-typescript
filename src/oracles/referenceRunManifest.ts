/**
 * Reference run manifest for Chocolate Doom 2.2.1 oracle captures.
 *
 * Describes exactly how to invoke the reference executable, what
 * initial state it produces, and the available run modes for oracle
 * capture.  This is the manifest definition only; actual sandbox
 * creation and process management are later steps.
 *
 * @example
 * ```ts
 * import { REFERENCE_RUN_MANIFEST } from "../src/oracles/referenceRunManifest.ts";
 * console.log(REFERENCE_RUN_MANIFEST.ticRateHz); // 35
 * ```
 */

/** Mode of reference run for oracle capture. */
export type RunMode = 'demo-playback' | 'title-loop';

/** Configuration for a specific oracle capture run mode. */
export interface RunModeConfig {
  /** Discriminant for the run mode. */
  readonly mode: RunMode;
  /** Human-readable description of what this mode captures. */
  readonly description: string;
  /** Additional command-line arguments appended for this mode. */
  readonly additionalArgs: readonly string[];
}

/** Internal framebuffer and display output parameters. */
export interface ScreenParameters {
  /** Doom's fixed internal framebuffer width in pixels. */
  readonly internalWidth: number;
  /** Doom's fixed internal framebuffer height in pixels. */
  readonly internalHeight: number;
  /** Chocolate Doom display output width from chocolate-doom.cfg. */
  readonly displayWidth: number;
  /** Chocolate Doom display output height from chocolate-doom.cfg. */
  readonly displayHeight: number;
  /** Bits per pixel for display output from chocolate-doom.cfg. */
  readonly bitsPerPixel: number;
  /** Whether aspect ratio correction is enabled from chocolate-doom.cfg. */
  readonly aspectRatioCorrect: boolean;
  /** Status bar / viewport size from default.cfg (1-11). */
  readonly screenblocks: number;
  /** Detail level from default.cfg (0 = high, 1 = low). */
  readonly detailLevel: number;
  /** Gamma correction level from default.cfg (0-4). */
  readonly gammaLevel: number;
}

/** Sound and music device parameters. */
export interface AudioParameters {
  /** Output sample rate in Hz from chocolate-doom.cfg. */
  readonly sampleRate: number;
  /** Maximum simultaneous sound channels from default.cfg. */
  readonly maxChannels: number;
  /** Sound effects device identifier from default.cfg. */
  readonly sfxDevice: number;
  /** Music device identifier from default.cfg. */
  readonly musicDevice: number;
  /** Sound effects volume from default.cfg (0-15). */
  readonly sfxVolume: number;
  /** Music volume from default.cfg (0-15). */
  readonly musicVolume: number;
  /** OPL I/O port address from chocolate-doom.cfg. */
  readonly oplIoPort: number;
}

/** Initial game state at startup, as observed in reference stdout. */
export interface StartupParameters {
  /** Starting skill level (0-4; 2 = "Hurt me plenty"). */
  readonly skill: number;
  /** Starting episode number (1-based). */
  readonly episode: number;
  /** Starting map number (1-based). */
  readonly map: number;
  /** Deathmatch mode (0 = off). */
  readonly deathmatch: number;
  /** Number of active players. */
  readonly playerCount: number;
  /** Total network nodes including this player. */
  readonly totalNodes: number;
}

/** Vanilla Doom compatibility enforcement flags from chocolate-doom.cfg. */
export interface VanillaCompatibility {
  /** Enforce vanilla demo size limit. */
  readonly demoLimit: boolean;
  /** Use vanilla keyboard scan code mapping. */
  readonly keyboardMapping: boolean;
  /** Enforce vanilla savegame size limit. */
  readonly savegameLimit: boolean;
}

/** A single step in the engine initialization sequence. */
export interface InitStep {
  /** Function or subsystem label (e.g. "Z_Init"). */
  readonly label: string;
  /** Description of what this step initializes. */
  readonly description: string;
}

/** Complete description of a reference Chocolate Doom run for oracle capture. */
export interface ReferenceRunManifest {
  /** Executable filename within the sandbox. */
  readonly executableFilename: string;
  /** IWAD filename within the sandbox. */
  readonly iwadFilename: string;
  /** Base command-line arguments (empty when IWAD is auto-detected). */
  readonly baseCommandLine: readonly string[];
  /** Screen and display configuration. */
  readonly screen: ScreenParameters;
  /** Audio and music configuration. */
  readonly audio: AudioParameters;
  /** Game startup parameters observed in reference stdout. */
  readonly startup: StartupParameters;
  /** Vanilla compatibility flags from chocolate-doom.cfg. */
  readonly vanillaCompatibility: VanillaCompatibility;
  /** Engine tic rate in Hz. */
  readonly ticRateHz: number;
  /** Vanilla Doom version string the engine emulates. */
  readonly emulatedVersion: string;
  /** Ordered initialization sequence from reference stdout. */
  readonly initSequence: readonly InitStep[];
  /** Available run modes for oracle capture, ASCIIbetically sorted. */
  readonly runModes: readonly RunModeConfig[];
}

/** Total number of steps in the observed reference initialization sequence. */
export const INIT_SEQUENCE_LENGTH = 15;

/**
 * Frozen reference run manifest for Chocolate Doom 2.2.1 shareware
 * oracle captures.  All values are derived from the reference bundle's
 * default.cfg, chocolate-doom.cfg, and observed stdout.txt output.
 */
export const REFERENCE_RUN_MANIFEST: ReferenceRunManifest = Object.freeze({
  executableFilename: 'DOOM.EXE',
  iwadFilename: 'DOOM1.WAD',
  baseCommandLine: Object.freeze([]),
  screen: Object.freeze({
    internalWidth: 320,
    internalHeight: 200,
    displayWidth: 640,
    displayHeight: 480,
    bitsPerPixel: 32,
    aspectRatioCorrect: true,
    screenblocks: 9,
    detailLevel: 0,
    gammaLevel: 0,
  } satisfies ScreenParameters),
  audio: Object.freeze({
    sampleRate: 44_100,
    maxChannels: 8,
    sfxDevice: 3,
    musicDevice: 3,
    sfxVolume: 8,
    musicVolume: 8,
    oplIoPort: 0x388,
  } satisfies AudioParameters),
  startup: Object.freeze({
    skill: 2,
    episode: 1,
    map: 1,
    deathmatch: 0,
    playerCount: 1,
    totalNodes: 1,
  } satisfies StartupParameters),
  vanillaCompatibility: Object.freeze({
    demoLimit: true,
    keyboardMapping: true,
    savegameLimit: true,
  } satisfies VanillaCompatibility),
  ticRateHz: 35,
  emulatedVersion: '1.9',
  initSequence: Object.freeze([
    Object.freeze({ label: 'Z_Init', description: 'Init zone memory allocation daemon' } satisfies InitStep),
    Object.freeze({ label: 'V_Init', description: 'allocate screens' } satisfies InitStep),
    Object.freeze({ label: 'M_LoadDefaults', description: 'Load system defaults' } satisfies InitStep),
    Object.freeze({ label: 'W_Init', description: 'Init WADfiles' } satisfies InitStep),
    Object.freeze({ label: 'I_Init', description: 'Setting up machine state' } satisfies InitStep),
    Object.freeze({ label: 'OPL_Init', description: "Using driver 'SDL'" } satisfies InitStep),
    Object.freeze({ label: 'NET_Init', description: 'Init network subsystem' } satisfies InitStep),
    Object.freeze({ label: 'M_Init', description: 'Init miscellaneous info' } satisfies InitStep),
    Object.freeze({ label: 'R_Init', description: 'Init DOOM refresh daemon' } satisfies InitStep),
    Object.freeze({ label: 'P_Init', description: 'Init Playloop state' } satisfies InitStep),
    Object.freeze({ label: 'S_Init', description: 'Setting up sound' } satisfies InitStep),
    Object.freeze({ label: 'D_CheckNetGame', description: 'Checking network game status' } satisfies InitStep),
    Object.freeze({ label: 'HU_Init', description: 'Setting up heads up display' } satisfies InitStep),
    Object.freeze({ label: 'ST_Init', description: 'Init status bar' } satisfies InitStep),
    Object.freeze({ label: 'I_InitStretchTables', description: 'Generating lookup tables' } satisfies InitStep),
  ]),
  runModes: Object.freeze([
    Object.freeze({
      mode: 'demo-playback',
      description: 'Replay a recorded demo for deterministic frame-by-frame capture',
      additionalArgs: Object.freeze([]),
    } satisfies RunModeConfig),
    Object.freeze({
      mode: 'title-loop',
      description: 'Run the title/demo attract loop for full-cycle capture',
      additionalArgs: Object.freeze([]),
    } satisfies RunModeConfig),
  ]),
} satisfies ReferenceRunManifest);
