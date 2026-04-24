/**
 * OPL2 register model.
 *
 * Models the byte-addressable register file of the Yamaha YM3812
 * (OPL2) FM synthesis chip used by Chocolate Doom 2.2.1's
 * `i_oplmusic.c` music device when fluidsynth is disabled (the
 * vanilla Doom default, `snd_musicdevice = 3`).  The OPL2 exposes 9
 * two-operator FM channels and a flat 256-byte register address space
 * (0x00..0xFF) of which the active subset covers 0x00..0xF5.  Every
 * chocolate-doom register write surfaces as `OPL_WriteRegister` →
 * `opl_queue` → the Java OPL3 port running in OPL2-compatibility mode,
 * which is the behaviour this module mirrors.
 *
 * The module exposes:
 *
 *  - {@link createOplRegisterFile} — allocate a zero-initialized
 *    register file.  The file is the only mutable state; every
 *    decoder below is referentially transparent.
 *  - {@link writeOplRegister} / {@link readOplRegister} — address-
 *    validated accessors over the raw byte file.  The chip silently
 *    discards writes to undocumented addresses and returns the last
 *    value written to any addressable byte; this model follows the
 *    same lenient contract.
 *  - Static address arithmetic: {@link operatorOffset},
 *    {@link operatorRegisterAddress}, {@link channelRegisterAddress}.
 *    The load-bearing table is {@link OPL_OPERATOR_OFFSETS}, the
 *    canonical 9x2 YM3812 mapping of `(channel, operator)` to the
 *    byte offset added to the per-operator register bases.  The
 *    layout is non-contiguous — channels 0-2 use offsets 0x00..0x05,
 *    channels 3-5 use 0x08..0x0D, channels 6-8 use 0x10..0x15 — and
 *    matches `op1_offsets` / `op2_offsets` in chocolate-doom's
 *    `i_oplmusic.c`.
 *  - Typed decoders: {@link decodeOplOperator},
 *    {@link decodeOplChannel}, {@link decodeOplRhythm}.  Each takes
 *    the register file plus the relevant index and returns a frozen
 *    struct of named bit-fields so the future synthesis core
 *    (15-010 opl-synthesis-core) can drive the FM math without
 *    re-deriving the bit-level layout.
 *
 * Parity-critical details preserved here:
 *
 *  - The YM3812 multiplier field is 4 bits (0..15).  The chip maps
 *    those values to 0.5, 1, 2, ..., 15 multiplicatively but this
 *    module preserves the raw 4-bit value — the synthesis core owns
 *    the lookup.
 *  - Register 0xB0 + channel packs key-on (bit 5), block (bits 2-4),
 *    and the upper 2 bits of the 10-bit FNum (bits 0-1).  The low 8
 *    bits of FNum live in 0xA0 + channel.  {@link decodeOplChannel}
 *    reassembles the 10-bit FNum as `(regB0 & 0x03) << 8 | regA0`.
 *  - Register 0xC0 + channel packs feedback (bits 1-3) and algorithm
 *    (bit 0, 0 = FM / serial, 1 = additive / parallel).  Bits 4-7 are
 *    reserved on OPL2 and ignored by the decoder.
 *  - Register 0xBD packs modulation depth (bits 6-7), rhythm mode
 *    enable (bit 5), and the five rhythm key-on bits (0-4).
 *    {@link decodeOplRhythm} exposes every flag individually so the
 *    rhythm path can dispatch the five dedicated operators without
 *    re-masking the byte.
 *  - Register 0xE0 + operator_offset carries the waveform index.
 *    OPL2 honours bits 0-1 (four waveforms: sine, half-sine, full-
 *    rectified sine, quarter-rectified sine); OPL3 extends to bits
 *    0-2 (eight waveforms).  {@link decodeOplOperator} masks to 0x03
 *    because vanilla Doom always runs the chip in OPL2 compatibility
 *    mode and writes waveforms in `[0, 3]`.
 *  - Writes to any byte in `[0, 0xFF]` are accepted.  Out-of-range
 *    addresses throw `RangeError` so a caller that tries to treat
 *    OPL3 port-2 registers (`0x100..0x1FF`) as OPL2 registers gets a
 *    loud error rather than a silent wraparound.
 *
 * The module is pure: mutations only affect the caller-supplied
 * {@link OplRegisterFile.registers} byte array, and every decoder
 * returns a fresh frozen object per call.  Zero Win32 bindings, zero
 * audio I/O, zero global mutable state.  OPL3 register space (port
 * 0x105 mode enable, 0x100..0x1FF high page) is intentionally out of
 * scope: vanilla Doom's `i_oplmusic.c` only writes the OPL2 subset.
 *
 * @example
 * ```ts
 * import {
 *   OPL_CH_REG_FB_CONNECTION,
 *   OPL_OPERATOR_CARRIER,
 *   OPL_OP_REG_KSL_TL,
 *   channelRegisterAddress,
 *   createOplRegisterFile,
 *   decodeOplChannel,
 *   decodeOplOperator,
 *   operatorRegisterAddress,
 *   writeOplRegister,
 * } from '../src/audio/oplRegisters.ts';
 *
 * const state = createOplRegisterFile();
 * // Set channel 0 carrier to KSL=2, TL=10.
 * writeOplRegister(state, operatorRegisterAddress(0, OPL_OPERATOR_CARRIER, OPL_OP_REG_KSL_TL), (2 << 6) | 10);
 * // Enable feedback=5, algorithm=additive for channel 0.
 * writeOplRegister(state, channelRegisterAddress(0, OPL_CH_REG_FB_CONNECTION), (5 << 1) | 1);
 * const carrier = decodeOplOperator(state, 0, OPL_OPERATOR_CARRIER);
 * const channel = decodeOplChannel(state, 0);
 * // carrier.keyScaleLevel === 2; carrier.totalLevel === 10
 * // channel.feedback === 5; channel.algorithm === 1
 * ```
 */

/** Number of FM channels in the YM3812 (OPL2). */
export const OPL_NUM_CHANNELS = 9;

/** Operators per channel (one modulator + one carrier). */
export const OPL_NUM_OPERATORS_PER_CHANNEL = 2;

/** Total operators in the OPL2 register file (9 channels * 2 operators). */
export const OPL_NUM_OPERATORS = OPL_NUM_CHANNELS * OPL_NUM_OPERATORS_PER_CHANNEL;

/** Operator index 0 — modulator.  Output feeds the carrier as FM input. */
export const OPL_OPERATOR_MODULATOR = 0;

/** Operator index 1 — carrier.  Output is the audible voice signal. */
export const OPL_OPERATOR_CARRIER = 1;

/** Size of the OPL2 register file in bytes (addresses 0x00..0xFF). */
export const OPL_REGISTER_FILE_SIZE = 0x100;

/** Inclusive upper bound of a valid OPL2 register address. */
export const OPL_REGISTER_ADDRESS_MAX = 0xff;

/** Inclusive upper bound of a valid OPL2 register value (one byte per register). */
export const OPL_REGISTER_VALUE_MAX = 0xff;

/** Timer 1 count register (0x02). */
export const OPL_REG_TIMER1 = 0x02;

/** Timer 2 count register (0x03). */
export const OPL_REG_TIMER2 = 0x03;

/** Timer control / IRQ-reset register (0x04). */
export const OPL_REG_TIMER_CTRL = 0x04;

/** Note-select / CSM-mode register (0x08).  Bit 6 selects composite-sine waveform split points. */
export const OPL_REG_NOTE_SELECT = 0x08;

/** Modulation-depth + rhythm-mode register (0xBD). */
export const OPL_REG_RHYTHM = 0xbd;

/** Per-operator base for Tremolo / Vibrato / EG-type / KSR / Multiplier (0x20 + offset). */
export const OPL_OP_REG_AM_VIB_EG_KSR_MULT = 0x20;

/** Per-operator base for Key Scale Level + Total Level (0x40 + offset). */
export const OPL_OP_REG_KSL_TL = 0x40;

/** Per-operator base for Attack Rate + Decay Rate (0x60 + offset). */
export const OPL_OP_REG_AR_DR = 0x60;

/** Per-operator base for Sustain Level + Release Rate (0x80 + offset). */
export const OPL_OP_REG_SL_RR = 0x80;

/** Per-operator base for Waveform Select (0xE0 + offset). */
export const OPL_OP_REG_WAVEFORM = 0xe0;

/** Per-channel base for FNum Low byte (0xA0 + channel). */
export const OPL_CH_REG_FNUM_LOW = 0xa0;

/** Per-channel base for Key-On + Block + FNum High (0xB0 + channel). */
export const OPL_CH_REG_KEYON_BLOCK_FNUM_HIGH = 0xb0;

/** Per-channel base for Feedback + Algorithm / Connection (0xC0 + channel). */
export const OPL_CH_REG_FB_CONNECTION = 0xc0;

/**
 * Canonical YM3812 operator-offset table for OPL2 channels 0..8.
 *
 * Each entry is `[modulatorOffset, carrierOffset]` — the byte offset
 * added to a per-operator register base (for example,
 * {@link OPL_OP_REG_KSL_TL}) to land on the byte controlling that
 * channel's modulator or carrier operator.  The non-contiguous
 * layout reflects how the chip packs 18 operators into three groups
 * of six to share addressing infrastructure and matches
 * `op1_offsets` / `op2_offsets` in chocolate-doom 2.2.1's
 * `i_oplmusic.c`.
 */
export const OPL_OPERATOR_OFFSETS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([0x00, 0x03] as const),
  Object.freeze([0x01, 0x04] as const),
  Object.freeze([0x02, 0x05] as const),
  Object.freeze([0x08, 0x0b] as const),
  Object.freeze([0x09, 0x0c] as const),
  Object.freeze([0x0a, 0x0d] as const),
  Object.freeze([0x10, 0x13] as const),
  Object.freeze([0x11, 0x14] as const),
  Object.freeze([0x12, 0x15] as const),
]);

/** Mutable OPL2 register-file state. */
export interface OplRegisterFile {
  /** 256-byte register file, zero-initialized.  Index equals the register address. */
  readonly registers: Uint8Array;
}

/**
 * Allocate a fresh OPL2 register file with every register zeroed.
 * Matches the chip's post-reset state.
 */
export function createOplRegisterFile(): OplRegisterFile {
  return { registers: new Uint8Array(OPL_REGISTER_FILE_SIZE) };
}

/**
 * Return the byte offset for `(channel, operator)` from the canonical
 * {@link OPL_OPERATOR_OFFSETS} table.
 *
 * @throws {RangeError} If `channel` is outside `[0, OPL_NUM_CHANNELS - 1]`
 *   or `operator` is outside `[0, OPL_NUM_OPERATORS_PER_CHANNEL - 1]`.
 */
export function operatorOffset(channel: number, operator: number): number {
  if (!Number.isInteger(channel) || channel < 0 || channel >= OPL_NUM_CHANNELS) {
    throw new RangeError(`OPL channel must be an integer in [0, ${OPL_NUM_CHANNELS - 1}], got ${channel}`);
  }
  if (!Number.isInteger(operator) || operator < 0 || operator >= OPL_NUM_OPERATORS_PER_CHANNEL) {
    throw new RangeError(`OPL operator must be an integer in [0, ${OPL_NUM_OPERATORS_PER_CHANNEL - 1}], got ${operator}`);
  }
  return OPL_OPERATOR_OFFSETS[channel]![operator]!;
}

/**
 * Combine a per-operator register `base` (one of `OPL_OP_REG_*`) with
 * the canonical operator offset for `(channel, operator)`.  The
 * returned address is always a valid OPL2 register byte.
 *
 * @throws {RangeError} If `base` is not an integer in `[0, OPL_REGISTER_ADDRESS_MAX]`
 *   or the addressing arguments are invalid (delegated to {@link operatorOffset}).
 */
export function operatorRegisterAddress(channel: number, operator: number, base: number): number {
  validateRegisterAddress(base, 'operator-register base');
  return base + operatorOffset(channel, operator);
}

/**
 * Combine a per-channel register `base` (one of `OPL_CH_REG_*`) with
 * the channel index.
 *
 * @throws {RangeError} If `channel` is outside `[0, OPL_NUM_CHANNELS - 1]`
 *   or `base` is not an integer in `[0, OPL_REGISTER_ADDRESS_MAX]`.
 */
export function channelRegisterAddress(channel: number, base: number): number {
  if (!Number.isInteger(channel) || channel < 0 || channel >= OPL_NUM_CHANNELS) {
    throw new RangeError(`OPL channel must be an integer in [0, ${OPL_NUM_CHANNELS - 1}], got ${channel}`);
  }
  validateRegisterAddress(base, 'channel-register base');
  return base + channel;
}

/**
 * Write `value` to `address` in the register file.  Both arguments
 * are validated to fit the OPL2 8-bit address / value space.
 *
 * @throws {RangeError} If `address` or `value` are not integers in
 *   `[0, 0xFF]`.
 */
export function writeOplRegister(state: OplRegisterFile, address: number, value: number): void {
  validateRegisterAddress(address, 'register address');
  if (!Number.isInteger(value) || value < 0 || value > OPL_REGISTER_VALUE_MAX) {
    throw new RangeError(`OPL register value must be an integer in [0, ${OPL_REGISTER_VALUE_MAX}], got ${value}`);
  }
  state.registers[address] = value;
}

/**
 * Read the byte stored at `address` in the register file.  Fresh
 * register files return `0` for every address.
 *
 * @throws {RangeError} If `address` is not an integer in `[0, 0xFF]`.
 */
export function readOplRegister(state: OplRegisterFile, address: number): number {
  validateRegisterAddress(address, 'register address');
  return state.registers[address]!;
}

/** Decoded operator parameters extracted from the five per-operator registers. */
export interface OplOperatorParameters {
  /** Tremolo (AM) enable, bit 7 of register 0x20 + offset. */
  readonly tremolo: boolean;
  /** Vibrato (FM) enable, bit 6 of register 0x20 + offset. */
  readonly vibrato: boolean;
  /** Sustain envelope enable, bit 5 of register 0x20 + offset. */
  readonly sustain: boolean;
  /** Key-Scale-Rate enable, bit 4 of register 0x20 + offset. */
  readonly keyScaleRate: boolean;
  /** Frequency multiplier code (0..15), bits 0-3 of register 0x20 + offset. */
  readonly multiplier: number;
  /** Key-Scale-Level attenuation code (0..3), bits 6-7 of register 0x40 + offset. */
  readonly keyScaleLevel: number;
  /** Total Level attenuation (0..63), bits 0-5 of register 0x40 + offset. */
  readonly totalLevel: number;
  /** Attack Rate (0..15), bits 4-7 of register 0x60 + offset. */
  readonly attackRate: number;
  /** Decay Rate (0..15), bits 0-3 of register 0x60 + offset. */
  readonly decayRate: number;
  /** Sustain Level (0..15), bits 4-7 of register 0x80 + offset. */
  readonly sustainLevel: number;
  /** Release Rate (0..15), bits 0-3 of register 0x80 + offset. */
  readonly releaseRate: number;
  /** Waveform index (0..3 on OPL2), bits 0-1 of register 0xE0 + offset. */
  readonly waveform: number;
}

/**
 * Decode the per-operator parameters for `(channel, operator)` from
 * the register file.  Reads exactly five registers (0x20, 0x40, 0x60,
 * 0x80, 0xE0 offset by the canonical operator offset) and returns a
 * frozen struct.
 *
 * @throws {RangeError} If `channel` or `operator` are invalid
 *   (delegated to {@link operatorOffset}).
 */
export function decodeOplOperator(state: OplRegisterFile, channel: number, operator: number): Readonly<OplOperatorParameters> {
  const offset = operatorOffset(channel, operator);
  const reg20 = state.registers[OPL_OP_REG_AM_VIB_EG_KSR_MULT + offset]!;
  const reg40 = state.registers[OPL_OP_REG_KSL_TL + offset]!;
  const reg60 = state.registers[OPL_OP_REG_AR_DR + offset]!;
  const reg80 = state.registers[OPL_OP_REG_SL_RR + offset]!;
  const regE0 = state.registers[OPL_OP_REG_WAVEFORM + offset]!;
  return Object.freeze<OplOperatorParameters>({
    tremolo: (reg20 & 0x80) !== 0,
    vibrato: (reg20 & 0x40) !== 0,
    sustain: (reg20 & 0x20) !== 0,
    keyScaleRate: (reg20 & 0x10) !== 0,
    multiplier: reg20 & 0x0f,
    keyScaleLevel: (reg40 >> 6) & 0x03,
    totalLevel: reg40 & 0x3f,
    attackRate: (reg60 >> 4) & 0x0f,
    decayRate: reg60 & 0x0f,
    sustainLevel: (reg80 >> 4) & 0x0f,
    releaseRate: reg80 & 0x0f,
    waveform: regE0 & 0x03,
  });
}

/** Decoded per-channel parameters extracted from registers 0xA0, 0xB0, and 0xC0 offset by the channel index. */
export interface OplChannelParameters {
  /** Reconstructed 10-bit FNum (0..1023) from 0xA0 + channel (low) and 0xB0 + channel (high 2 bits). */
  readonly fNumber: number;
  /** Block (octave code, 0..7), bits 2-4 of register 0xB0 + channel. */
  readonly block: number;
  /** Key-On flag, bit 5 of register 0xB0 + channel. */
  readonly keyOn: boolean;
  /** Feedback level (0..7), bits 1-3 of register 0xC0 + channel. */
  readonly feedback: number;
  /** Algorithm / Connection bit (0 = FM / serial, 1 = additive / parallel), bit 0 of register 0xC0 + channel. */
  readonly algorithm: number;
}

/**
 * Decode the per-channel parameters from the three channel registers.
 *
 * @throws {RangeError} If `channel` is outside `[0, OPL_NUM_CHANNELS - 1]`.
 */
export function decodeOplChannel(state: OplRegisterFile, channel: number): Readonly<OplChannelParameters> {
  if (!Number.isInteger(channel) || channel < 0 || channel >= OPL_NUM_CHANNELS) {
    throw new RangeError(`OPL channel must be an integer in [0, ${OPL_NUM_CHANNELS - 1}], got ${channel}`);
  }
  const regA0 = state.registers[OPL_CH_REG_FNUM_LOW + channel]!;
  const regB0 = state.registers[OPL_CH_REG_KEYON_BLOCK_FNUM_HIGH + channel]!;
  const regC0 = state.registers[OPL_CH_REG_FB_CONNECTION + channel]!;
  return Object.freeze<OplChannelParameters>({
    fNumber: regA0 | ((regB0 & 0x03) << 8),
    block: (regB0 >> 2) & 0x07,
    keyOn: (regB0 & 0x20) !== 0,
    feedback: (regC0 >> 1) & 0x07,
    algorithm: regC0 & 0x01,
  });
}

/** Decoded global rhythm + modulation-depth register state (0xBD). */
export interface OplRhythmParameters {
  /** AM depth flag (bit 7): false = 1.0 dB, true = 4.8 dB. */
  readonly amDepth: boolean;
  /** Vibrato depth flag (bit 6): false = 7%, true = 14%. */
  readonly vibratoDepth: boolean;
  /** Rhythm-mode enable (bit 5); when false the five rhythm operators act as ordinary channels. */
  readonly rhythmEnabled: boolean;
  /** Bass-drum key-on (bit 4). */
  readonly bassDrum: boolean;
  /** Snare-drum key-on (bit 3). */
  readonly snareDrum: boolean;
  /** Tom-tom key-on (bit 2). */
  readonly tomTom: boolean;
  /** Top-cymbal key-on (bit 1). */
  readonly cymbal: boolean;
  /** Hi-hat key-on (bit 0). */
  readonly hiHat: boolean;
}

/** Decode the global rhythm + modulation-depth state from register 0xBD. */
export function decodeOplRhythm(state: OplRegisterFile): Readonly<OplRhythmParameters> {
  const regBD = state.registers[OPL_REG_RHYTHM]!;
  return Object.freeze<OplRhythmParameters>({
    amDepth: (regBD & 0x80) !== 0,
    vibratoDepth: (regBD & 0x40) !== 0,
    rhythmEnabled: (regBD & 0x20) !== 0,
    bassDrum: (regBD & 0x10) !== 0,
    snareDrum: (regBD & 0x08) !== 0,
    tomTom: (regBD & 0x04) !== 0,
    cymbal: (regBD & 0x02) !== 0,
    hiHat: (regBD & 0x01) !== 0,
  });
}

function validateRegisterAddress(address: number, label: string): void {
  if (!Number.isInteger(address) || address < 0 || address > OPL_REGISTER_ADDRESS_MAX) {
    throw new RangeError(`OPL ${label} must be an integer in [0, ${OPL_REGISTER_ADDRESS_MAX}], got ${address}`);
  }
}
