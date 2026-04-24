import type { DemoFormat, DemoTicCommand } from './demoParse.ts';

import { DEMO_END_MARKER, DEMO_LONG_TICS_COMMAND_SIZE, DEMO_LONG_TICS_VERSION, DEMO_MAX_PLAYERS, DEMO_VANILLA_COMMAND_SIZE, DEMO_VANILLA_VERSION_19 } from './demoParse.ts';

/** Default `-maxdemo` size used by Doom when recording starts. */
export const DEMO_RECORD_DEFAULT_MAXIMUM_SIZE = 0x20_000;

/** Doom stops recording before a tic when fewer than 16 bytes remain. */
export const DEMO_RECORD_WRITE_HEADROOM = 16;

/** One tic command supplied to the recorder before serialization. */
export interface DemoRecordCommand {
  /** Signed 16-bit player turn delta before demo-format quantization. */
  readonly angleTurn: number;
  /** Raw button bitfield byte. */
  readonly buttons: number;
  /** Savegame-only field intentionally ignored by demo recording. */
  readonly chatCharacter?: number;
  /** Savegame-only field intentionally ignored by demo recording. */
  readonly consistency?: number;
  /** Signed forward/backward movement byte. */
  readonly forwardMove: number;
  /** Signed strafe movement byte. */
  readonly sideMove: number;
}

/** Header fields needed to begin demo recording. */
export interface DemoRecorderOptions {
  /** `consoleplayer` in versioned headers; omitted from old demos. */
  readonly consolePlayer?: number;
  /** `deathmatch` flag byte in versioned headers. */
  readonly deathmatch?: number;
  /** Episode number written into the demo header. */
  readonly episode: number;
  /** `fastparm` flag byte in versioned headers. */
  readonly fastMonsters?: number;
  /** Recording format chosen by `G_BeginRecording`. Defaults to `vanilla`. */
  readonly format?: DemoFormat;
  /** Map number written into the demo header. */
  readonly map: number;
  /** Initial backing-buffer size in bytes. Defaults to `0x20000`. */
  readonly maximumSize?: number;
  /** `nomonsters` flag byte in versioned headers. */
  readonly noMonsters?: number;
  /** Frozen `playeringame[]` bitmap written into the header. */
  readonly playersInGame: readonly boolean[];
  /** `respawnparm` flag byte in versioned headers. */
  readonly respawnMonsters?: number;
  /** Skill byte written into the demo header. */
  readonly skill: number;
  /** Enforce Doom's vanilla fixed-size buffer rule. Defaults to `true`. */
  readonly vanillaDemoLimit?: boolean;
  /** Version byte for non-longtics versioned demos. Defaults to `109`. */
  readonly versionByte?: number;
}

/**
 * Stateful Doom demo recorder matching `G_BeginRecording`,
 * `G_BuildTiccmd`, `G_WriteDemoTiccmd`, and `G_CheckDemoStatus`.
 *
 * @example
 * ```ts
 * import { DemoRecorder } from '../src/demo/demoRecord.ts'
 * const recorder = new DemoRecorder({
 *   episode: 1,
 *   map: 1,
 *   playersInGame: [true, false, false, false],
 *   skill: 2,
 * })
 * recorder.recordCommand({ angleTurn: 0, buttons: 0, forwardMove: 0x19, sideMove: 0 })
 * const demoBuffer = recorder.finish()
 * ```
 */
export class DemoRecorder {
  #buffer: Buffer;
  #finished = false;
  #format: DemoFormat;
  #headerByteLength: number;
  #playersInGame: readonly boolean[];
  #ticCount = 0;
  #turnCarry = 0;
  #vanillaDemoLimit: boolean;
  #versionByte: number | null;
  #writeOffset: number;

  public constructor(options: DemoRecorderOptions) {
    const format = options.format ?? 'vanilla';
    const headerByteLength = format === 'old' ? 7 : 13;
    const maximumSize = options.maximumSize ?? DEMO_RECORD_DEFAULT_MAXIMUM_SIZE;

    if (!Number.isInteger(maximumSize) || maximumSize < headerByteLength + 1) {
      throw new RangeError(`Demo buffer size must be an integer >= ${headerByteLength + 1}, got ${maximumSize}`);
    }

    const playersInGame = [...options.playersInGame];
    if (playersInGame.length !== DEMO_MAX_PLAYERS) {
      throw new RangeError(`Demo header must encode exactly ${DEMO_MAX_PLAYERS} player slots, got ${playersInGame.length}`);
    }
    if (!playersInGame.some((isInGame) => isInGame)) {
      throw new RangeError('Demo recorder requires at least one active player');
    }

    const versionByte = determineVersionByte(format, options.versionByte);

    this.#buffer = Buffer.alloc(maximumSize);
    this.#format = format;
    this.#headerByteLength = headerByteLength;
    this.#playersInGame = Object.freeze(playersInGame);
    this.#vanillaDemoLimit = options.vanillaDemoLimit ?? true;
    this.#versionByte = versionByte;
    this.#writeOffset = 0;

    this.#writeHeader({
      consolePlayer: options.consolePlayer ?? 0,
      deathmatch: options.deathmatch ?? 0,
      episode: options.episode,
      fastMonsters: options.fastMonsters ?? 0,
      map: options.map,
      noMonsters: options.noMonsters ?? 0,
      playersInGame: this.#playersInGame,
      respawnMonsters: options.respawnMonsters ?? 0,
      skill: options.skill,
      versionByte,
    });
  }

  public get commandByteLength(): number {
    return this.#format === 'longtics' ? DEMO_LONG_TICS_COMMAND_SIZE : DEMO_VANILLA_COMMAND_SIZE;
  }

  public get format(): DemoFormat {
    return this.#format;
  }

  public get headerByteLength(): number {
    return this.#headerByteLength;
  }

  public get maximumSize(): number {
    return this.#buffer.length;
  }

  public get playersInGame(): readonly boolean[] {
    return this.#playersInGame;
  }

  public get ticCount(): number {
    return this.#ticCount;
  }

  public get vanillaDemoLimit(): boolean {
    return this.#vanillaDemoLimit;
  }

  public get versionByte(): number | null {
    return this.#versionByte;
  }

  /**
   * Record one tic command into the demo stream.
   *
   * @param command - Input tic command before demo-format serialization.
   * @returns The exact command bytes Doom will later read back, or `null`
   * if the fixed vanilla demo limit stopped recording before this tic.
   */
  public recordCommand(command: DemoRecordCommand): Readonly<DemoTicCommand> | null {
    if (this.#finished) {
      throw new Error('Cannot record more commands after finish()');
    }

    while (this.#writeOffset > this.#buffer.length - DEMO_RECORD_WRITE_HEADROOM) {
      if (this.#vanillaDemoLimit) {
        return null;
      }

      this.#increaseBuffer();
    }

    const commandOffset = this.#writeOffset;
    const normalizedCommand = this.#normalizeCommand(command);

    this.#buffer.writeInt8(normalizedCommand.forwardMove, this.#writeOffset++);
    this.#buffer.writeInt8(normalizedCommand.sideMove, this.#writeOffset++);

    if (this.#format === 'longtics') {
      this.#buffer.writeInt16LE(normalizedCommand.angleTurn, this.#writeOffset);
      this.#writeOffset += 2;
    } else {
      this.#buffer.writeUInt8((normalizedCommand.angleTurn >> 8) & 0xff, this.#writeOffset++);
    }

    this.#buffer.writeUInt8(normalizedCommand.buttons, this.#writeOffset++);

    const readBackCommand = this.#readRecordedCommand(commandOffset);
    this.#ticCount += 1;
    return readBackCommand;
  }

  /**
   * Append Doom's `0x80` end marker and return the finalized demo bytes.
   *
   * @returns A copy of the finalized demo buffer.
   */
  public finish(): Buffer {
    if (!this.#finished) {
      this.#ensureCapacityFor(1);
      this.#buffer.writeUInt8(DEMO_END_MARKER, this.#writeOffset++);
      this.#finished = true;
    }

    return Buffer.from(this.#buffer.subarray(0, this.#writeOffset));
  }

  #ensureCapacityFor(additionalBytes: number): void {
    while (this.#writeOffset + additionalBytes > this.#buffer.length) {
      if (this.#vanillaDemoLimit) {
        throw new RangeError(`Demo buffer cannot fit ${additionalBytes} more byte(s) within ${this.#buffer.length} bytes`);
      }

      this.#increaseBuffer();
    }
  }

  #increaseBuffer(): void {
    const expandedBuffer = Buffer.alloc(this.#buffer.length * 2);
    this.#buffer.copy(expandedBuffer, 0, 0, this.#writeOffset);
    this.#buffer = expandedBuffer;
  }

  #normalizeCommand(command: DemoRecordCommand): DemoTicCommand {
    const forwardMove = toSignedInt8(command.forwardMove, 'forwardMove');
    const sideMove = toSignedInt8(command.sideMove, 'sideMove');
    const buttons = toUnsignedByte(command.buttons, 'buttons');

    let angleTurn = toSignedInt16(command.angleTurn, 'angleTurn');

    if (this.#format !== 'longtics') {
      const desiredAngleTurn = toSignedInt16(angleTurn + this.#turnCarry, 'angleTurn');
      const roundedAngleTurn = fromUnsigned16((desiredAngleTurn + 0x80) & 0xff00);
      this.#turnCarry = toSignedInt16(desiredAngleTurn - roundedAngleTurn, 'angleTurn');
      angleTurn = roundedAngleTurn;
    }

    return Object.freeze({
      angleTurn,
      buttons,
      forwardMove,
      sideMove,
    });
  }

  #readRecordedCommand(offset: number): Readonly<DemoTicCommand> {
    const forwardMove = this.#buffer.readInt8(offset);
    const sideMove = this.#buffer.readInt8(offset + 1);
    let angleTurnOffset = offset + 2;
    let angleTurn = 0;

    if (this.#format === 'longtics') {
      angleTurn = this.#buffer.readInt16LE(angleTurnOffset);
      angleTurnOffset += 2;
    } else {
      angleTurn = fromUnsigned16(this.#buffer.readUInt8(angleTurnOffset) << 8);
      angleTurnOffset += 1;
    }

    const buttons = this.#buffer.readUInt8(angleTurnOffset);

    return Object.freeze({
      angleTurn,
      buttons,
      forwardMove,
      sideMove,
    });
  }

  #writeHeader(options: {
    readonly consolePlayer: number;
    readonly deathmatch: number;
    readonly episode: number;
    readonly fastMonsters: number;
    readonly map: number;
    readonly noMonsters: number;
    readonly playersInGame: readonly boolean[];
    readonly respawnMonsters: number;
    readonly skill: number;
    readonly versionByte: number | null;
  }): void {
    if (options.versionByte !== null) {
      this.#buffer.writeUInt8(options.versionByte, this.#writeOffset++);
    }

    this.#buffer.writeUInt8(toUnsignedByte(options.skill, 'skill'), this.#writeOffset++);
    this.#buffer.writeUInt8(toUnsignedByte(options.episode, 'episode'), this.#writeOffset++);
    this.#buffer.writeUInt8(toUnsignedByte(options.map, 'map'), this.#writeOffset++);

    if (this.#format !== 'old') {
      this.#buffer.writeUInt8(toUnsignedByte(options.deathmatch, 'deathmatch'), this.#writeOffset++);
      this.#buffer.writeUInt8(toUnsignedByte(options.respawnMonsters, 'respawnMonsters'), this.#writeOffset++);
      this.#buffer.writeUInt8(toUnsignedByte(options.fastMonsters, 'fastMonsters'), this.#writeOffset++);
      this.#buffer.writeUInt8(toUnsignedByte(options.noMonsters, 'noMonsters'), this.#writeOffset++);
      this.#buffer.writeUInt8(toUnsignedByte(options.consolePlayer, 'consolePlayer'), this.#writeOffset++);
    }

    for (const isInGame of options.playersInGame) {
      this.#buffer.writeUInt8(isInGame ? 1 : 0, this.#writeOffset++);
    }
  }
}

function determineVersionByte(format: DemoFormat, versionByte: number | undefined): number | null {
  if (format === 'old') {
    if (versionByte !== undefined) {
      throw new RangeError('Old-format demos cannot include a version byte');
    }

    return null;
  }

  if (format === 'longtics') {
    if (versionByte !== undefined && versionByte !== DEMO_LONG_TICS_VERSION) {
      throw new RangeError(`Longtics demos must use version byte ${DEMO_LONG_TICS_VERSION}, got ${versionByte}`);
    }

    return DEMO_LONG_TICS_VERSION;
  }

  const resolvedVersionByte = versionByte ?? DEMO_VANILLA_VERSION_19;
  if (!Number.isInteger(resolvedVersionByte) || resolvedVersionByte < 0 || resolvedVersionByte > 0xff) {
    throw new RangeError(`Version byte must be an integer in 0..255, got ${resolvedVersionByte}`);
  }
  if (resolvedVersionByte <= 4) {
    throw new RangeError(`Versioned demos must use a version byte > 4, got ${resolvedVersionByte}`);
  }

  return resolvedVersionByte;
}

function fromUnsigned16(value: number): number {
  return value >= 0x8000 ? value - 0x1_0000 : value;
}

function toSignedInt8(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < -0x80 || value > 0x7f) {
    throw new RangeError(`${fieldName} must be an integer in -128..127, got ${value}`);
  }

  return value;
}

function toSignedInt16(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < -0x8000 || value > 0x7fff) {
    throw new RangeError(`${fieldName} must be an integer in -32768..32767, got ${value}`);
  }

  return value;
}

function toUnsignedByte(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${fieldName} must be an integer in 0..255, got ${value}`);
  }

  return value;
}
