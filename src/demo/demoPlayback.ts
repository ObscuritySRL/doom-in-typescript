import type { DemoFormat, DemoTicCommand, ParsedDemo } from './demoParse.ts';

import { DEMO_VANILLA_VERSION_19, parseDemo } from './demoParse.ts';

/** Doom 1.9's expected version byte for vanilla demo playback. */
export const DEMO_PLAYBACK_DEFAULT_VERSION = DEMO_VANILLA_VERSION_19;

/** Follow-up action triggered once playback reaches the demo marker. */
export type DemoPlaybackCompletionAction = 'advance-demo' | 'none' | 'quit';

/** Options that mirror `G_DoPlayDemo`'s version and net-demo gates. */
export interface DemoPlaybackOptions {
  /** Allow pre-v1.4 demos that omit the version byte. Defaults to `false`. */
  readonly allowOldFormat?: boolean;
  /** Allow non-vanilla longtics playback. Defaults to `true`. */
  readonly allowLongTics?: boolean;
  /** Expected version byte for vanilla versioned demos. Defaults to `109`. */
  readonly expectedVersionByte?: number;
  /** Mirror `-netdemo`, forcing network-demo mode even for single-player demos. */
  readonly netDemo?: boolean;
  /** Mirror `-solo-net`, forcing network-demo mode for local playback. */
  readonly soloNet?: boolean;
  /** Mirror `singledemo`, quitting instead of advancing the attract loop on finish. */
  readonly singleDemo?: boolean;
}

/** Mutable playback flags surfaced as an immutable snapshot. */
export interface DemoPlaybackSnapshot {
  /** `G_CheckDemoStatus` result after the end marker has been reached. */
  readonly completionAction: DemoPlaybackCompletionAction;
  /** `consoleplayer` from the demo header, reset to `0` on completion. */
  readonly consolePlayer: number;
  /** `deathmatch` from the demo header, reset to `0` on completion. */
  readonly deathmatch: number;
  /** `true` until the marker is consumed on a read boundary. */
  readonly demoplayback: boolean;
  /** `fastparm` from the demo header, reset to `0` on completion. */
  readonly fastMonsters: number;
  /** Doom's `netdemo` flag derived from slot 1 or explicit playback options. */
  readonly netDemo: boolean;
  /** Doom's `netgame` flag mirrors `netdemo` during demo playback. */
  readonly netGame: boolean;
  /** `nomonsters` from the demo header, reset to `0` on completion. */
  readonly noMonsters: number;
  /** Current mutable `playeringame[]` bitmap. */
  readonly playersInGame: readonly boolean[];
  /** `respawnparm` from the demo header, reset to `0` on completion. */
  readonly respawnMonsters: number;
  /** `true` when the caller requested single-demo behavior. */
  readonly singleDemo: boolean;
  /** Number of tics already returned to the caller. */
  readonly ticIndex: number;
}

/**
 * Streaming Doom demo playback wrapper around the parsed demo buffer.
 *
 * `readNextTic()` preserves the marker timing from `G_ReadDemoTiccmd`:
 * the final real tic is returned normally, and playback only transitions
 * to its finished state on the *next* read that hits the marker boundary.
 *
 * @example
 * ```ts
 * import { DemoPlayback } from '../src/demo/demoPlayback.ts';
 *
 * const playback = new DemoPlayback(await Bun.file('DEMO1.lmp').bytes().then(Buffer.from));
 * while (playback.readNextTic() !== null) {
 *   // consume one tic at a time
 * }
 * playback.snapshot().completionAction; // 'advance-demo'
 * ```
 */
export class DemoPlayback {
  #completionAction: DemoPlaybackCompletionAction = 'none';
  #consolePlayer: number;
  #deathmatch: number;
  #demoplayback = true;
  #fastMonsters: number;
  #netDemo: boolean;
  #netGame: boolean;
  #noMonsters: number;
  #parsedDemo: Readonly<ParsedDemo>;
  #playersInGame: boolean[];
  #respawnMonsters: number;
  #singleDemo: boolean;
  #ticIndex = 0;

  public constructor(demoBuffer: Buffer, options: DemoPlaybackOptions = {}) {
    const allowLongTics = options.allowLongTics ?? true;
    const allowOldFormat = options.allowOldFormat ?? false;
    const expectedVersionByte = toUnsignedByte(options.expectedVersionByte ?? DEMO_PLAYBACK_DEFAULT_VERSION, 'expectedVersionByte');
    const parsedDemo = parseDemo(demoBuffer);

    validateDemoVersion(parsedDemo, {
      allowLongTics,
      allowOldFormat,
      expectedVersionByte,
    });

    this.#consolePlayer = parsedDemo.consolePlayer;
    this.#deathmatch = parsedDemo.deathmatch;
    this.#fastMonsters = parsedDemo.fastMonsters;
    this.#noMonsters = parsedDemo.noMonsters;
    this.#parsedDemo = parsedDemo;
    this.#playersInGame = [...parsedDemo.playersInGame];
    this.#respawnMonsters = parsedDemo.respawnMonsters;
    this.#singleDemo = options.singleDemo ?? false;

    const netDemo = parsedDemo.playersInGame[1] === true || options.netDemo === true || options.soloNet === true;
    this.#netDemo = netDemo;
    this.#netGame = netDemo;
  }

  public get parsedDemo(): Readonly<ParsedDemo> {
    return this.#parsedDemo;
  }

  /**
   * Return the next tic's active-player command array, or `null` once
   * playback has reached the demo marker and run the completion logic.
   *
   * @returns Frozen tic command array, or `null` once the marker is consumed.
   */
  public readNextTic(): readonly DemoTicCommand[] | null {
    if (!this.#demoplayback) {
      return null;
    }

    if (this.#ticIndex >= this.#parsedDemo.ticCount) {
      this.#finishPlayback();
      return null;
    }

    const ticCommands = this.#parsedDemo.commandsByTic[this.#ticIndex];
    this.#ticIndex += 1;
    return ticCommands ?? null;
  }

  /**
   * Capture the mutable playback flags in a frozen value object.
   *
   * @returns Immutable view of the current playback state.
   */
  public snapshot(): Readonly<DemoPlaybackSnapshot> {
    return Object.freeze({
      completionAction: this.#completionAction,
      consolePlayer: this.#consolePlayer,
      deathmatch: this.#deathmatch,
      demoplayback: this.#demoplayback,
      fastMonsters: this.#fastMonsters,
      netDemo: this.#netDemo,
      netGame: this.#netGame,
      noMonsters: this.#noMonsters,
      playersInGame: Object.freeze([...this.#playersInGame]),
      respawnMonsters: this.#respawnMonsters,
      singleDemo: this.#singleDemo,
      ticIndex: this.#ticIndex,
    });
  }

  #finishPlayback(): void {
    this.#completionAction = this.#singleDemo ? 'quit' : 'advance-demo';
    this.#consolePlayer = 0;
    this.#deathmatch = 0;
    this.#demoplayback = false;
    this.#fastMonsters = 0;
    this.#netDemo = false;
    this.#netGame = false;
    this.#noMonsters = 0;
    this.#playersInGame[1] = false;
    this.#playersInGame[2] = false;
    this.#playersInGame[3] = false;
    this.#respawnMonsters = 0;
  }
}

function validateDemoVersion(
  parsedDemo: Readonly<ParsedDemo>,
  options: {
    readonly allowLongTics: boolean;
    readonly allowOldFormat: boolean;
    readonly expectedVersionByte: number;
  },
): void {
  if (parsedDemo.format === 'longtics') {
    if (!options.allowLongTics) {
      throw new RangeError('Demo requires longtics playback support');
    }

    return;
  }

  if (parsedDemo.format === 'old') {
    if (!options.allowOldFormat) {
      throw new RangeError(`Demo version ${parsedDemo.skill} does not match expected ${options.expectedVersionByte}`);
    }

    return;
  }

  if (parsedDemo.versionByte !== options.expectedVersionByte) {
    throw new RangeError(`Demo version ${parsedDemo.versionByte} does not match expected ${options.expectedVersionByte}`);
  }
}

function toUnsignedByte(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${fieldName} must be an integer in 0..255, got ${value}`);
  }

  return value;
}
