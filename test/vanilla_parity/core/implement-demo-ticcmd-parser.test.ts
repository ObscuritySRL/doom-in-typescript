import { describe, expect, test } from 'bun:test';

import {
  VANILLA_ANGLETURN_BYTE_TO_INTERNAL_SCALE,
  VANILLA_BUTTONS_MASK,
  VANILLA_CHATCHAR_MASK,
  VANILLA_CHATCHAR_SHIFT,
  VANILLA_DEMO_TERMINATOR_BYTE,
  VANILLA_DEMO_TICCMD_RECORD_BYTES,
  parseDemoTiccmdStream,
} from '../../../src/core/implement-demo-ticcmd-parser.ts';

describe('vanilla demo ticcmd constants', () => {
  test('4-byte record, terminator 0x80, angleturn scale 256, button/chatchar masks', () => {
    expect(VANILLA_DEMO_TICCMD_RECORD_BYTES).toBe(4);
    expect(VANILLA_DEMO_TERMINATOR_BYTE).toBe(0x80);
    expect(VANILLA_ANGLETURN_BYTE_TO_INTERNAL_SCALE).toBe(256);
    expect(VANILLA_BUTTONS_MASK).toBe(0x0f);
    expect(VANILLA_CHATCHAR_MASK).toBe(0xf0);
    expect(VANILLA_CHATCHAR_SHIFT).toBe(4);
  });
});

describe('parseDemoTiccmdStream', () => {
  test('parses zero ticcmds when only a terminator follows the header', () => {
    const bytes = new Uint8Array([0x80, 0, 0, 0]);
    const result = parseDemoTiccmdStream(bytes, 0);
    expect(result.ticcmds).toEqual([]);
    expect(result.endedAtTerminator).toBe(true);
    expect(result.bytesConsumed).toBe(1);
  });

  test('parses one ticcmd and stops at terminator', () => {
    const bytes = new Uint8Array([10, 5, 1, 0x05, 0x80, 0, 0, 0]);
    const result = parseDemoTiccmdStream(bytes, 0);
    expect(result.ticcmds).toHaveLength(1);
    expect(result.ticcmds[0]?.forwardMove).toBe(10);
    expect(result.ticcmds[0]?.sideMove).toBe(5);
    expect(result.ticcmds[0]?.angleTurn).toBe(256);
    expect(result.ticcmds[0]?.buttons).toBe(0x05);
    expect(result.ticcmds[0]?.chatChar).toBe(0);
    expect(result.endedAtTerminator).toBe(true);
  });

  test('decodes signed-8-bit forward, side, angle', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0xff, 0, 0x80, 0, 0, 0]);
    const result = parseDemoTiccmdStream(bytes, 0);
    expect(result.ticcmds[0]?.forwardMove).toBe(-1);
    expect(result.ticcmds[0]?.sideMove).toBe(-2);
    expect(result.ticcmds[0]?.angleTurn).toBe(-256);
  });

  test('splits chatchar and buttons from byte 3', () => {
    const bytes = new Uint8Array([0, 0, 0, 0xa5, 0x80, 0, 0, 0]);
    const result = parseDemoTiccmdStream(bytes, 0);
    expect(result.ticcmds[0]?.buttons).toBe(0x05);
    expect(result.ticcmds[0]?.chatChar).toBe(0x0a);
  });

  test('stops at the end of the buffer when no terminator is present', () => {
    const bytes = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const result = parseDemoTiccmdStream(bytes, 0);
    expect(result.ticcmds).toHaveLength(2);
    expect(result.endedAtTerminator).toBe(false);
  });
});
