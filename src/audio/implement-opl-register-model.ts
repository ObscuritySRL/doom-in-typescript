/**
 * Vanilla DOOM 1.9 OPL2/OPL3 register model contract.
 *
 * From Chocolate Doom 2.2.1 opl/opl.c and the OPL2 (Yamaha YM3812) /
 * OPL3 (YMF262) datasheets, the synth exposes a 256-entry register
 * file accessed through two I/O ports:
 *
 *   opl_io_port + 0  — address register (write index to register file)
 *   opl_io_port + 1  — data register    (write value at last-set index)
 *
 * The vanilla `opl_io_port` cvar (chocolate-doom.cfg) defaults to
 * 0x388 — the SoundBlaster/AdLib standard address.
 *
 * Register banks:
 *   0x01            — test register / waveform select enable
 *   0x02            — timer 1 count
 *   0x03            — timer 2 count
 *   0x04            — IRQ reset / timer mask / OPL3 4-op mode
 *   0x05            — OPL3 mode enable (NEW=1)
 *   0x20..0x35      — operator 1 settings (tremolo, vibrato, sustain,
 *                     KSR, multiplier)
 *   0x40..0x55      — operator KSL / total level
 *   0x60..0x75      — operator attack / decay
 *   0x80..0x95      — operator sustain / release
 *   0xA0..0xA8      — channel frequency low byte
 *   0xB0..0xB8      — channel frequency high bits + key-on + block
 *   0xC0..0xC8      — channel feedback / connection / panning (OPL3)
 *   0xE0..0xF5      — operator waveform select (OPL2: 0..3, OPL3: 0..7)
 *
 * Parity-critical details:
 *   - 18 operators total (9 channels × 2 ops) in OPL2; OPL3 doubles
 *     to 36 operators across 18 channels via the secondary bank.
 *   - Genmidi (DOOM's instrument file) supplies a 36-byte record per
 *     instrument that maps directly to operator registers 0x20..0x95
 *     with a 4-operator pair pattern.
 *   - The 9-channel mapping uses operator indices [0,3], [1,4], [2,5],
 *     [6,9], [7,10], [8,11], [12,15], [13,16], [14,17] —
 *     NOT sequential. This is a hardware-pinout artifact preserved by
 *     vanilla.
 *   - Register writes must respect the YM3812's ~3.3 microsecond
 *     address-to-data settling time. Software-emulated OPL ports
 *     can ignore this; physical OPL2/OPL3 hardware requires it.
 */

export const VANILLA_OPL_REGISTER_FILE_SIZE = 256;

export const VANILLA_OPL_DEFAULT_IO_PORT = 0x388;

export const VANILLA_OPL2_CHANNEL_COUNT = 9;
export const VANILLA_OPL2_OPERATOR_COUNT = 18;
export const VANILLA_OPL3_CHANNEL_COUNT = 18;
export const VANILLA_OPL3_OPERATOR_COUNT = 36;

export const VANILLA_OPL_CHANNEL_OPERATOR_PAIRS: ReadonlyArray<readonly [number, number]> = Object.freeze([
  Object.freeze([0, 3] as const),
  Object.freeze([1, 4] as const),
  Object.freeze([2, 5] as const),
  Object.freeze([6, 9] as const),
  Object.freeze([7, 10] as const),
  Object.freeze([8, 11] as const),
  Object.freeze([12, 15] as const),
  Object.freeze([13, 16] as const),
  Object.freeze([14, 17] as const),
]);

export const VANILLA_OPL_REGISTER_BANK_BASES = Object.freeze({
  TEST: 0x01,
  TIMER1_COUNT: 0x02,
  TIMER2_COUNT: 0x03,
  IRQ_TIMER_MASK: 0x04,
  OPL3_MODE_ENABLE: 0x05,
  OP_TREMOLO_VIBRATO_SUSTAIN_KSR_MULT: 0x20,
  OP_KSL_TOTAL_LEVEL: 0x40,
  OP_ATTACK_DECAY: 0x60,
  OP_SUSTAIN_RELEASE: 0x80,
  CHANNEL_FREQ_LOW: 0xa0,
  CHANNEL_FREQ_HIGH_KEYON_BLOCK: 0xb0,
  CHANNEL_FEEDBACK_CONNECTION_PAN: 0xc0,
  OP_WAVEFORM_SELECT: 0xe0,
});

export function vanillaOplChannelOperators(channel: number): readonly [number, number] {
  if (!Number.isInteger(channel) || channel < 0 || channel >= VANILLA_OPL2_CHANNEL_COUNT) {
    throw new RangeError(`OPL2 channel must be in [0, ${VANILLA_OPL2_CHANNEL_COUNT}) (got ${channel})`);
  }
  return VANILLA_OPL_CHANNEL_OPERATOR_PAIRS[channel]!;
}

export function isVanillaOplValidRegisterIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < VANILLA_OPL_REGISTER_FILE_SIZE;
}
