import { describe, expect, it } from 'bun:test';

import {
  OPL_CH_REG_FB_CONNECTION,
  OPL_CH_REG_FNUM_LOW,
  OPL_CH_REG_KEYON_BLOCK_FNUM_HIGH,
  OPL_NUM_CHANNELS,
  OPL_NUM_OPERATORS,
  OPL_NUM_OPERATORS_PER_CHANNEL,
  OPL_OPERATOR_CARRIER,
  OPL_OPERATOR_MODULATOR,
  OPL_OPERATOR_OFFSETS,
  OPL_OP_REG_AM_VIB_EG_KSR_MULT,
  OPL_OP_REG_AR_DR,
  OPL_OP_REG_KSL_TL,
  OPL_OP_REG_SL_RR,
  OPL_OP_REG_WAVEFORM,
  OPL_REGISTER_ADDRESS_MAX,
  OPL_REGISTER_FILE_SIZE,
  OPL_REGISTER_VALUE_MAX,
  OPL_REG_NOTE_SELECT,
  OPL_REG_RHYTHM,
  OPL_REG_TIMER1,
  OPL_REG_TIMER2,
  OPL_REG_TIMER_CTRL,
  channelRegisterAddress,
  createOplRegisterFile,
  decodeOplChannel,
  decodeOplOperator,
  decodeOplRhythm,
  operatorOffset,
  operatorRegisterAddress,
  readOplRegister,
  writeOplRegister,
} from '../../src/audio/oplRegisters.ts';
import type { OplRhythmParameters } from '../../src/audio/oplRegisters.ts';

describe('OPL register model constants', () => {
  it('OPL_NUM_CHANNELS is 9 (YM3812 channel count)', () => {
    expect(OPL_NUM_CHANNELS).toBe(9);
  });

  it('OPL_NUM_OPERATORS_PER_CHANNEL is 2 (modulator + carrier)', () => {
    expect(OPL_NUM_OPERATORS_PER_CHANNEL).toBe(2);
  });

  it('OPL_NUM_OPERATORS is 18 and equals OPL_NUM_CHANNELS * OPL_NUM_OPERATORS_PER_CHANNEL', () => {
    expect(OPL_NUM_OPERATORS).toBe(18);
    expect(OPL_NUM_OPERATORS).toBe(OPL_NUM_CHANNELS * OPL_NUM_OPERATORS_PER_CHANNEL);
  });

  it('OPL_OPERATOR_MODULATOR is 0 and OPL_OPERATOR_CARRIER is 1', () => {
    expect(OPL_OPERATOR_MODULATOR).toBe(0);
    expect(OPL_OPERATOR_CARRIER).toBe(1);
  });

  it('OPL_REGISTER_FILE_SIZE is 256 bytes (0x00..0xFF)', () => {
    expect(OPL_REGISTER_FILE_SIZE).toBe(0x100);
  });

  it('OPL_REGISTER_ADDRESS_MAX and OPL_REGISTER_VALUE_MAX are 0xFF', () => {
    expect(OPL_REGISTER_ADDRESS_MAX).toBe(0xff);
    expect(OPL_REGISTER_VALUE_MAX).toBe(0xff);
    expect(OPL_REGISTER_ADDRESS_MAX).toBe(OPL_REGISTER_FILE_SIZE - 1);
  });

  it('Timer / note-select / rhythm register addresses match the YM3812 spec', () => {
    expect(OPL_REG_TIMER1).toBe(0x02);
    expect(OPL_REG_TIMER2).toBe(0x03);
    expect(OPL_REG_TIMER_CTRL).toBe(0x04);
    expect(OPL_REG_NOTE_SELECT).toBe(0x08);
    expect(OPL_REG_RHYTHM).toBe(0xbd);
  });

  it('Per-operator register bases match the YM3812 spec', () => {
    expect(OPL_OP_REG_AM_VIB_EG_KSR_MULT).toBe(0x20);
    expect(OPL_OP_REG_KSL_TL).toBe(0x40);
    expect(OPL_OP_REG_AR_DR).toBe(0x60);
    expect(OPL_OP_REG_SL_RR).toBe(0x80);
    expect(OPL_OP_REG_WAVEFORM).toBe(0xe0);
  });

  it('Per-channel register bases match the YM3812 spec', () => {
    expect(OPL_CH_REG_FNUM_LOW).toBe(0xa0);
    expect(OPL_CH_REG_KEYON_BLOCK_FNUM_HIGH).toBe(0xb0);
    expect(OPL_CH_REG_FB_CONNECTION).toBe(0xc0);
  });
});

describe('OPL_OPERATOR_OFFSETS table', () => {
  it('contains exactly OPL_NUM_CHANNELS entries', () => {
    expect(OPL_OPERATOR_OFFSETS).toHaveLength(OPL_NUM_CHANNELS);
  });

  it('matches the canonical YM3812 modulator/carrier mapping', () => {
    expect(OPL_OPERATOR_OFFSETS[0]).toEqual([0x00, 0x03]);
    expect(OPL_OPERATOR_OFFSETS[1]).toEqual([0x01, 0x04]);
    expect(OPL_OPERATOR_OFFSETS[2]).toEqual([0x02, 0x05]);
    expect(OPL_OPERATOR_OFFSETS[3]).toEqual([0x08, 0x0b]);
    expect(OPL_OPERATOR_OFFSETS[4]).toEqual([0x09, 0x0c]);
    expect(OPL_OPERATOR_OFFSETS[5]).toEqual([0x0a, 0x0d]);
    expect(OPL_OPERATOR_OFFSETS[6]).toEqual([0x10, 0x13]);
    expect(OPL_OPERATOR_OFFSETS[7]).toEqual([0x11, 0x14]);
    expect(OPL_OPERATOR_OFFSETS[8]).toEqual([0x12, 0x15]);
  });

  it('top-level array is frozen — push throws', () => {
    expect(() => (OPL_OPERATOR_OFFSETS as unknown as number[]).push(0)).toThrow();
  });

  it('every entry is frozen — element write throws', () => {
    expect(() => {
      (OPL_OPERATOR_OFFSETS[0] as unknown as number[])[0] = 0xff;
    }).toThrow();
  });

  it('every (channel, operator) offset is unique across the 18 pairs', () => {
    const offsets = OPL_OPERATOR_OFFSETS.flatMap((pair) => [pair[0], pair[1]]);
    expect(offsets.length).toBe(OPL_NUM_OPERATORS);
    expect(new Set(offsets).size).toBe(OPL_NUM_OPERATORS);
  });

  it('carrier offset is exactly 3 above the modulator offset for every channel', () => {
    for (const [mod, car] of OPL_OPERATOR_OFFSETS) {
      expect(car - mod).toBe(3);
    }
  });

  it('channel 8 carrier offset is 0x15 (the highest valid operator offset)', () => {
    expect(OPL_OPERATOR_OFFSETS[8]![1]).toBe(0x15);
  });

  it('all offsets keep the highest per-operator register address inside the file (0xE0 + 0x15 == 0xF5)', () => {
    for (const pair of OPL_OPERATOR_OFFSETS) {
      for (const off of pair) {
        expect(OPL_OP_REG_WAVEFORM + off).toBeLessThanOrEqual(OPL_REGISTER_ADDRESS_MAX);
      }
    }
    expect(OPL_OP_REG_WAVEFORM + 0x15).toBe(0xf5);
  });
});

describe('operatorOffset', () => {
  it('returns the modulator offset for operator=0 across every channel', () => {
    for (let c = 0; c < OPL_NUM_CHANNELS; c++) {
      expect(operatorOffset(c, OPL_OPERATOR_MODULATOR)).toBe(OPL_OPERATOR_OFFSETS[c]![0]);
    }
  });

  it('returns the carrier offset for operator=1 across every channel', () => {
    for (let c = 0; c < OPL_NUM_CHANNELS; c++) {
      expect(operatorOffset(c, OPL_OPERATOR_CARRIER)).toBe(OPL_OPERATOR_OFFSETS[c]![1]);
    }
  });

  it('throws RangeError on negative channel', () => {
    expect(() => operatorOffset(-1, 0)).toThrow(RangeError);
  });

  it('throws RangeError on channel >= OPL_NUM_CHANNELS', () => {
    expect(() => operatorOffset(OPL_NUM_CHANNELS, 0)).toThrow(RangeError);
  });

  it('throws RangeError on non-integer channel', () => {
    expect(() => operatorOffset(1.5, 0)).toThrow(RangeError);
    expect(() => operatorOffset(NaN, 0)).toThrow(RangeError);
  });

  it('throws RangeError on operator outside [0, 1]', () => {
    expect(() => operatorOffset(0, -1)).toThrow(RangeError);
    expect(() => operatorOffset(0, OPL_NUM_OPERATORS_PER_CHANNEL)).toThrow(RangeError);
  });

  it('throws RangeError on non-integer operator', () => {
    expect(() => operatorOffset(0, 0.5)).toThrow(RangeError);
    expect(() => operatorOffset(0, NaN)).toThrow(RangeError);
  });
});

describe('operatorRegisterAddress', () => {
  it('combines per-operator base with the operator offset', () => {
    expect(operatorRegisterAddress(0, OPL_OPERATOR_MODULATOR, OPL_OP_REG_KSL_TL)).toBe(0x40);
    expect(operatorRegisterAddress(0, OPL_OPERATOR_CARRIER, OPL_OP_REG_KSL_TL)).toBe(0x43);
    expect(operatorRegisterAddress(8, OPL_OPERATOR_CARRIER, OPL_OP_REG_WAVEFORM)).toBe(0xf5);
  });

  it('produces 18 distinct addresses for the same per-operator base', () => {
    const addresses = new Set<number>();
    for (let c = 0; c < OPL_NUM_CHANNELS; c++) {
      for (let op = 0; op < OPL_NUM_OPERATORS_PER_CHANNEL; op++) {
        addresses.add(operatorRegisterAddress(c, op, OPL_OP_REG_AM_VIB_EG_KSR_MULT));
      }
    }
    expect(addresses.size).toBe(OPL_NUM_OPERATORS);
  });

  it('throws RangeError on invalid base address', () => {
    expect(() => operatorRegisterAddress(0, 0, -1)).toThrow(RangeError);
    expect(() => operatorRegisterAddress(0, 0, 0x100)).toThrow(RangeError);
    expect(() => operatorRegisterAddress(0, 0, 1.5)).toThrow(RangeError);
  });

  it('delegates channel/operator validation to operatorOffset', () => {
    expect(() => operatorRegisterAddress(-1, 0, OPL_OP_REG_KSL_TL)).toThrow(RangeError);
    expect(() => operatorRegisterAddress(0, 2, OPL_OP_REG_KSL_TL)).toThrow(RangeError);
  });
});

describe('channelRegisterAddress', () => {
  it('combines per-channel base with the channel index', () => {
    expect(channelRegisterAddress(0, OPL_CH_REG_FNUM_LOW)).toBe(0xa0);
    expect(channelRegisterAddress(8, OPL_CH_REG_KEYON_BLOCK_FNUM_HIGH)).toBe(0xb8);
    expect(channelRegisterAddress(8, OPL_CH_REG_FB_CONNECTION)).toBe(0xc8);
  });

  it('throws RangeError on invalid channel', () => {
    expect(() => channelRegisterAddress(-1, OPL_CH_REG_FNUM_LOW)).toThrow(RangeError);
    expect(() => channelRegisterAddress(OPL_NUM_CHANNELS, OPL_CH_REG_FNUM_LOW)).toThrow(RangeError);
    expect(() => channelRegisterAddress(1.5, OPL_CH_REG_FNUM_LOW)).toThrow(RangeError);
  });

  it('throws RangeError on invalid base', () => {
    expect(() => channelRegisterAddress(0, -1)).toThrow(RangeError);
    expect(() => channelRegisterAddress(0, 0x100)).toThrow(RangeError);
    expect(() => channelRegisterAddress(0, 1.5)).toThrow(RangeError);
  });
});

describe('createOplRegisterFile', () => {
  it('allocates a Uint8Array of size OPL_REGISTER_FILE_SIZE', () => {
    const state = createOplRegisterFile();
    expect(state.registers).toBeInstanceOf(Uint8Array);
    expect(state.registers.length).toBe(OPL_REGISTER_FILE_SIZE);
  });

  it('zero-initializes every register (post-reset state)', () => {
    const state = createOplRegisterFile();
    for (let i = 0; i < OPL_REGISTER_FILE_SIZE; i++) {
      expect(state.registers[i]).toBe(0);
    }
  });

  it('returns independent register files per call', () => {
    const a = createOplRegisterFile();
    const b = createOplRegisterFile();
    a.registers[0x40] = 0xff;
    expect(b.registers[0x40]).toBe(0);
  });
});

describe('writeOplRegister and readOplRegister', () => {
  it('round-trips a written value', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, 0x40, 0x3f);
    expect(readOplRegister(state, 0x40)).toBe(0x3f);
  });

  it('writes the full [0, 0xFF] address range and reads back', () => {
    const state = createOplRegisterFile();
    for (let addr = 0; addr <= OPL_REGISTER_ADDRESS_MAX; addr++) {
      writeOplRegister(state, addr, addr & 0xff);
    }
    for (let addr = 0; addr <= OPL_REGISTER_ADDRESS_MAX; addr++) {
      expect(readOplRegister(state, addr)).toBe(addr & 0xff);
    }
  });

  it('overwrites an existing value', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, 0x20, 0x0f);
    writeOplRegister(state, 0x20, 0x55);
    expect(readOplRegister(state, 0x20)).toBe(0x55);
  });

  it('throws RangeError on non-integer address (write)', () => {
    const state = createOplRegisterFile();
    expect(() => writeOplRegister(state, 1.5, 0)).toThrow(RangeError);
    expect(() => writeOplRegister(state, NaN, 0)).toThrow(RangeError);
  });

  it('throws RangeError on address outside [0, 0xFF] (write)', () => {
    const state = createOplRegisterFile();
    expect(() => writeOplRegister(state, -1, 0)).toThrow(RangeError);
    expect(() => writeOplRegister(state, 0x100, 0)).toThrow(RangeError);
  });

  it('throws RangeError on non-integer / out-of-range value (write)', () => {
    const state = createOplRegisterFile();
    expect(() => writeOplRegister(state, 0, 1.5)).toThrow(RangeError);
    expect(() => writeOplRegister(state, 0, -1)).toThrow(RangeError);
    expect(() => writeOplRegister(state, 0, 0x100)).toThrow(RangeError);
    expect(() => writeOplRegister(state, 0, NaN)).toThrow(RangeError);
  });

  it('throws RangeError on invalid address (read)', () => {
    const state = createOplRegisterFile();
    expect(() => readOplRegister(state, -1)).toThrow(RangeError);
    expect(() => readOplRegister(state, 0x100)).toThrow(RangeError);
    expect(() => readOplRegister(state, 1.5)).toThrow(RangeError);
  });

  it('reads zero from a fresh file at every address', () => {
    const state = createOplRegisterFile();
    for (let addr = 0; addr <= OPL_REGISTER_ADDRESS_MAX; addr++) {
      expect(readOplRegister(state, addr)).toBe(0);
    }
  });
});

describe('decodeOplOperator', () => {
  it('returns all-zero parameters for a freshly created file', () => {
    const state = createOplRegisterFile();
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.tremolo).toBe(false);
    expect(op.vibrato).toBe(false);
    expect(op.sustain).toBe(false);
    expect(op.keyScaleRate).toBe(false);
    expect(op.multiplier).toBe(0);
    expect(op.keyScaleLevel).toBe(0);
    expect(op.totalLevel).toBe(0);
    expect(op.attackRate).toBe(0);
    expect(op.decayRate).toBe(0);
    expect(op.sustainLevel).toBe(0);
    expect(op.releaseRate).toBe(0);
    expect(op.waveform).toBe(0);
  });

  it('returns a frozen object', () => {
    const state = createOplRegisterFile();
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(Object.isFrozen(op)).toBe(true);
  });

  it('decodes 0x20 bit-fields (tremolo / vibrato / sustain / KSR / multiplier=15) when register is 0xFF', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_OP_REG_AM_VIB_EG_KSR_MULT, 0xff);
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.tremolo).toBe(true);
    expect(op.vibrato).toBe(true);
    expect(op.sustain).toBe(true);
    expect(op.keyScaleRate).toBe(true);
    expect(op.multiplier).toBe(0x0f);
  });

  it('decodes only the multiplier bits when 0x20 has bits 0-3 set', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_OP_REG_AM_VIB_EG_KSR_MULT, 0x05);
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.multiplier).toBe(5);
    expect(op.tremolo).toBe(false);
    expect(op.vibrato).toBe(false);
    expect(op.sustain).toBe(false);
    expect(op.keyScaleRate).toBe(false);
  });

  it('isolates the four high bits of 0x20 individually', () => {
    const cases: Array<[number, 'tremolo' | 'vibrato' | 'sustain' | 'keyScaleRate']> = [
      [0x80, 'tremolo'],
      [0x40, 'vibrato'],
      [0x20, 'sustain'],
      [0x10, 'keyScaleRate'],
    ];
    for (const [mask, key] of cases) {
      const state = createOplRegisterFile();
      writeOplRegister(state, OPL_OP_REG_AM_VIB_EG_KSR_MULT, mask);
      const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
      expect(op[key]).toBe(true);
      expect(op.multiplier).toBe(0);
    }
  });

  it('decodes 0x40 KSL (bits 6-7) and Total Level (bits 0-5)', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_OP_REG_KSL_TL, (2 << 6) | 0x2a);
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.keyScaleLevel).toBe(2);
    expect(op.totalLevel).toBe(0x2a);
  });

  it('decodes 0x40 maxima (KSL=3, TL=63) when register is 0xFF', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_OP_REG_KSL_TL, 0xff);
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.keyScaleLevel).toBe(3);
    expect(op.totalLevel).toBe(63);
  });

  it('decodes 0x60 Attack Rate (bits 4-7) and Decay Rate (bits 0-3)', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_OP_REG_AR_DR, (0x0a << 4) | 0x05);
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.attackRate).toBe(0x0a);
    expect(op.decayRate).toBe(0x05);
  });

  it('decodes 0x60 maxima (AR=15, DR=15) when register is 0xFF', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_OP_REG_AR_DR, 0xff);
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.attackRate).toBe(15);
    expect(op.decayRate).toBe(15);
  });

  it('decodes 0x80 Sustain Level (bits 4-7) and Release Rate (bits 0-3)', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_OP_REG_SL_RR, (0x0c << 4) | 0x07);
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.sustainLevel).toBe(0x0c);
    expect(op.releaseRate).toBe(0x07);
  });

  it('decodes 0xE0 waveform (bits 0-1; OPL2 honors 0..3)', () => {
    for (const wf of [0, 1, 2, 3]) {
      const state = createOplRegisterFile();
      writeOplRegister(state, OPL_OP_REG_WAVEFORM, wf);
      const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
      expect(op.waveform).toBe(wf);
    }
  });

  it('masks 0xE0 to 2 bits (OPL3 waveforms 4-7 collapse to 0..3 on OPL2)', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_OP_REG_WAVEFORM, 0xff);
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.waveform).toBe(0x03);
  });

  it('uses the correct operator offset for each (channel, operator) pair', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_OP_REG_KSL_TL + operatorOffset(8, OPL_OPERATOR_CARRIER), 0x3f);
    expect(decodeOplOperator(state, 8, OPL_OPERATOR_CARRIER).totalLevel).toBe(0x3f);
    expect(decodeOplOperator(state, 8, OPL_OPERATOR_MODULATOR).totalLevel).toBe(0);
  });

  it('decodes each (channel, operator) pair from independent registers', () => {
    const state = createOplRegisterFile();
    for (let ch = 0; ch < OPL_NUM_CHANNELS; ch++) {
      for (let op = 0; op < OPL_NUM_OPERATORS_PER_CHANNEL; op++) {
        const addr = OPL_OP_REG_KSL_TL + operatorOffset(ch, op);
        writeOplRegister(state, addr, (ch * OPL_NUM_OPERATORS_PER_CHANNEL + op) & 0x3f);
      }
    }
    for (let ch = 0; ch < OPL_NUM_CHANNELS; ch++) {
      for (let op = 0; op < OPL_NUM_OPERATORS_PER_CHANNEL; op++) {
        expect(decodeOplOperator(state, ch, op).totalLevel).toBe((ch * OPL_NUM_OPERATORS_PER_CHANNEL + op) & 0x3f);
      }
    }
  });

  it('throws RangeError on invalid channel/operator', () => {
    const state = createOplRegisterFile();
    expect(() => decodeOplOperator(state, -1, 0)).toThrow(RangeError);
    expect(() => decodeOplOperator(state, OPL_NUM_CHANNELS, 0)).toThrow(RangeError);
    expect(() => decodeOplOperator(state, 0, -1)).toThrow(RangeError);
    expect(() => decodeOplOperator(state, 0, OPL_NUM_OPERATORS_PER_CHANNEL)).toThrow(RangeError);
  });
});

describe('decodeOplChannel', () => {
  it('returns all-zero parameters for a freshly created file', () => {
    const state = createOplRegisterFile();
    const ch = decodeOplChannel(state, 0);
    expect(ch.fNumber).toBe(0);
    expect(ch.block).toBe(0);
    expect(ch.keyOn).toBe(false);
    expect(ch.feedback).toBe(0);
    expect(ch.algorithm).toBe(0);
  });

  it('returns a frozen object', () => {
    const state = createOplRegisterFile();
    expect(Object.isFrozen(decodeOplChannel(state, 0))).toBe(true);
  });

  it('reconstructs the 10-bit FNum from the low byte and bits 0-1 of 0xB0', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_CH_REG_FNUM_LOW, 0xab);
    writeOplRegister(state, OPL_CH_REG_KEYON_BLOCK_FNUM_HIGH, 0x02);
    const ch = decodeOplChannel(state, 0);
    expect(ch.fNumber).toBe((0x02 << 8) | 0xab);
  });

  it('reconstructs the maximum 10-bit FNum (1023) at low=0xFF, high bits=0b11', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_CH_REG_FNUM_LOW, 0xff);
    writeOplRegister(state, OPL_CH_REG_KEYON_BLOCK_FNUM_HIGH, 0x03);
    const ch = decodeOplChannel(state, 0);
    expect(ch.fNumber).toBe(1023);
  });

  it('decodes block (bits 2-4) and key-on (bit 5) independently', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_CH_REG_KEYON_BLOCK_FNUM_HIGH, (0x05 << 2) | 0x20);
    const ch = decodeOplChannel(state, 0);
    expect(ch.block).toBe(0x05);
    expect(ch.keyOn).toBe(true);
    expect(ch.fNumber).toBe(0);
  });

  it('decodes block range 0..7 (3 bits)', () => {
    for (let block = 0; block < 8; block++) {
      const state = createOplRegisterFile();
      writeOplRegister(state, OPL_CH_REG_KEYON_BLOCK_FNUM_HIGH, block << 2);
      expect(decodeOplChannel(state, 0).block).toBe(block);
    }
  });

  it('decodes feedback (bits 1-3) and algorithm (bit 0) from 0xC0', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_CH_REG_FB_CONNECTION, (0x07 << 1) | 0x01);
    const ch = decodeOplChannel(state, 0);
    expect(ch.feedback).toBe(0x07);
    expect(ch.algorithm).toBe(1);
  });

  it('decodes algorithm bit independently (FM=0 vs additive=1)', () => {
    const fmState = createOplRegisterFile();
    writeOplRegister(fmState, OPL_CH_REG_FB_CONNECTION, 0x00);
    expect(decodeOplChannel(fmState, 0).algorithm).toBe(0);
    const addState = createOplRegisterFile();
    writeOplRegister(addState, OPL_CH_REG_FB_CONNECTION, 0x01);
    expect(decodeOplChannel(addState, 0).algorithm).toBe(1);
  });

  it('ignores OPL3-only stereo bits (bits 4-7) in 0xC0 on OPL2 decode', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_CH_REG_FB_CONNECTION, 0xff);
    const ch = decodeOplChannel(state, 0);
    expect(ch.feedback).toBe(7);
    expect(ch.algorithm).toBe(1);
  });

  it('throws RangeError on invalid channel', () => {
    const state = createOplRegisterFile();
    expect(() => decodeOplChannel(state, -1)).toThrow(RangeError);
    expect(() => decodeOplChannel(state, OPL_NUM_CHANNELS)).toThrow(RangeError);
    expect(() => decodeOplChannel(state, 1.5)).toThrow(RangeError);
  });

  it('decodes channels independently from one another', () => {
    const state = createOplRegisterFile();
    for (let c = 0; c < OPL_NUM_CHANNELS; c++) {
      writeOplRegister(state, OPL_CH_REG_FNUM_LOW + c, c & 0xff);
    }
    for (let c = 0; c < OPL_NUM_CHANNELS; c++) {
      expect(decodeOplChannel(state, c).fNumber).toBe(c);
    }
  });
});

describe('decodeOplRhythm', () => {
  it('returns all-false flags for a freshly created file', () => {
    const state = createOplRegisterFile();
    const r = decodeOplRhythm(state);
    expect(r.amDepth).toBe(false);
    expect(r.vibratoDepth).toBe(false);
    expect(r.rhythmEnabled).toBe(false);
    expect(r.bassDrum).toBe(false);
    expect(r.snareDrum).toBe(false);
    expect(r.tomTom).toBe(false);
    expect(r.cymbal).toBe(false);
    expect(r.hiHat).toBe(false);
  });

  it('returns a frozen object', () => {
    const state = createOplRegisterFile();
    expect(Object.isFrozen(decodeOplRhythm(state))).toBe(true);
  });

  it('decodes every bit of the 0xBD register', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_REG_RHYTHM, 0xff);
    const r = decodeOplRhythm(state);
    expect(r.amDepth).toBe(true);
    expect(r.vibratoDepth).toBe(true);
    expect(r.rhythmEnabled).toBe(true);
    expect(r.bassDrum).toBe(true);
    expect(r.snareDrum).toBe(true);
    expect(r.tomTom).toBe(true);
    expect(r.cymbal).toBe(true);
    expect(r.hiHat).toBe(true);
  });

  it('isolates each rhythm bit', () => {
    const cases: Array<[number, keyof OplRhythmParameters]> = [
      [0x80, 'amDepth'],
      [0x40, 'vibratoDepth'],
      [0x20, 'rhythmEnabled'],
      [0x10, 'bassDrum'],
      [0x08, 'snareDrum'],
      [0x04, 'tomTom'],
      [0x02, 'cymbal'],
      [0x01, 'hiHat'],
    ];
    for (const [mask, key] of cases) {
      const state = createOplRegisterFile();
      writeOplRegister(state, OPL_REG_RHYTHM, mask);
      const r = decodeOplRhythm(state);
      expect(r[key]).toBe(true);
      for (const [otherMask, otherKey] of cases) {
        if (otherMask !== mask) {
          expect(r[otherKey]).toBe(false);
        }
      }
    }
  });
});

describe('parity-sensitive edge cases', () => {
  it('register address 0xF5 is reachable as channel 8 carrier waveform', () => {
    expect(operatorRegisterAddress(8, OPL_OPERATOR_CARRIER, OPL_OP_REG_WAVEFORM)).toBe(0xf5);
  });

  it('writing 0xFF to all five operator registers yields max-everything decode', () => {
    const state = createOplRegisterFile();
    const offset = operatorOffset(0, OPL_OPERATOR_MODULATOR);
    for (const base of [OPL_OP_REG_AM_VIB_EG_KSR_MULT, OPL_OP_REG_KSL_TL, OPL_OP_REG_AR_DR, OPL_OP_REG_SL_RR, OPL_OP_REG_WAVEFORM]) {
      writeOplRegister(state, base + offset, 0xff);
    }
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.tremolo).toBe(true);
    expect(op.vibrato).toBe(true);
    expect(op.sustain).toBe(true);
    expect(op.keyScaleRate).toBe(true);
    expect(op.multiplier).toBe(15);
    expect(op.keyScaleLevel).toBe(3);
    expect(op.totalLevel).toBe(63);
    expect(op.attackRate).toBe(15);
    expect(op.decayRate).toBe(15);
    expect(op.sustainLevel).toBe(15);
    expect(op.releaseRate).toBe(15);
    expect(op.waveform).toBe(3);
  });

  it('every operator register stays in addressable range for every (channel, operator)', () => {
    for (const base of [OPL_OP_REG_AM_VIB_EG_KSR_MULT, OPL_OP_REG_KSL_TL, OPL_OP_REG_AR_DR, OPL_OP_REG_SL_RR, OPL_OP_REG_WAVEFORM]) {
      for (let ch = 0; ch < OPL_NUM_CHANNELS; ch++) {
        for (let op = 0; op < OPL_NUM_OPERATORS_PER_CHANNEL; op++) {
          const addr = operatorRegisterAddress(ch, op, base);
          expect(addr).toBeGreaterThanOrEqual(0);
          expect(addr).toBeLessThanOrEqual(OPL_REGISTER_ADDRESS_MAX);
        }
      }
    }
  });

  it('every channel register stays in addressable range for every channel', () => {
    for (const base of [OPL_CH_REG_FNUM_LOW, OPL_CH_REG_KEYON_BLOCK_FNUM_HIGH, OPL_CH_REG_FB_CONNECTION]) {
      for (let ch = 0; ch < OPL_NUM_CHANNELS; ch++) {
        const addr = channelRegisterAddress(ch, base);
        expect(addr).toBeGreaterThanOrEqual(0);
        expect(addr).toBeLessThanOrEqual(OPL_REGISTER_ADDRESS_MAX);
      }
    }
  });

  it('FNum reconstruction ignores blocks/key-on bits in 0xB0', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_CH_REG_FNUM_LOW, 0x55);
    writeOplRegister(state, OPL_CH_REG_KEYON_BLOCK_FNUM_HIGH, (0x07 << 2) | 0x20 | 0x03);
    const ch = decodeOplChannel(state, 0);
    expect(ch.fNumber).toBe((0x03 << 8) | 0x55);
    expect(ch.block).toBe(7);
    expect(ch.keyOn).toBe(true);
  });

  it('multiplier field never bleeds into KSR (0x10 vs 0x0F bit-mask boundary)', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_OP_REG_AM_VIB_EG_KSR_MULT, 0x1f);
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.multiplier).toBe(0x0f);
    expect(op.keyScaleRate).toBe(true);
  });

  it('total-level field never bleeds into KSL (0x40 vs 0x3F bit-mask boundary)', () => {
    const state = createOplRegisterFile();
    writeOplRegister(state, OPL_OP_REG_KSL_TL, 0x7f);
    const op = decodeOplOperator(state, 0, OPL_OPERATOR_MODULATOR);
    expect(op.totalLevel).toBe(0x3f);
    expect(op.keyScaleLevel).toBe(1);
  });
});
