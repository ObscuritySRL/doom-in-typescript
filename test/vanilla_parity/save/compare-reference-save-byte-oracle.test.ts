import { describe, expect, test } from 'bun:test';

import { compareVanillaSaveBytes, describeVanillaSaveDiffSection } from '../../../src/save/compare-reference-save-byte-oracle.ts';

describe('vanilla DOOM 1.9 reference savegame byte oracle comparator', () => {
  test('reports a match for identical buffers', () => {
    const buffer = new Uint8Array([0x10, 0x20, 0x30, 0x40]);
    const diff = compareVanillaSaveBytes(buffer, buffer);
    expect(diff.matches).toBe(true);
    expect(diff.firstDivergentOffset).toBe(-1);
    expect(diff.expectedLength).toBe(diff.actualLength);
  });

  test('reports the first byte that differs', () => {
    const expected = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
    const actual = new Uint8Array([0x01, 0x02, 0xff, 0x04, 0x05]);
    const diff = compareVanillaSaveBytes(expected, actual);
    expect(diff.matches).toBe(false);
    expect(diff.firstDivergentOffset).toBe(2);
    expect(diff.expectedByte).toBe(0x03);
    expect(diff.actualByte).toBe(0xff);
  });

  test('reports trailing-byte length mismatches', () => {
    const expected = new Uint8Array([0x01, 0x02]);
    const actual = new Uint8Array([0x01, 0x02, 0x03]);
    const diff = compareVanillaSaveBytes(expected, actual);
    expect(diff.matches).toBe(false);
    expect(diff.firstDivergentOffset).toBe(2);
    expect(diff.expectedByte).toBe(null);
    expect(diff.actualByte).toBe(0x03);
    expect(diff.expectedLength).toBe(2);
    expect(diff.actualLength).toBe(3);
  });

  test('reports truncated-actual length mismatches', () => {
    const expected = new Uint8Array([0x01, 0x02, 0x03]);
    const actual = new Uint8Array([0x01, 0x02]);
    const diff = compareVanillaSaveBytes(expected, actual);
    expect(diff.matches).toBe(false);
    expect(diff.firstDivergentOffset).toBe(2);
    expect(diff.expectedByte).toBe(0x03);
    expect(diff.actualByte).toBe(null);
  });

  test('describeVanillaSaveDiffSection labels header byte offsets 0..49', () => {
    expect(describeVanillaSaveDiffSection(0)).toBe('header[+0]');
    expect(describeVanillaSaveDiffSection(23)).toBe('header[+23]');
    expect(describeVanillaSaveDiffSection(49)).toBe('header[+49]');
  });

  test('describeVanillaSaveDiffSection labels body byte offsets >= 50', () => {
    expect(describeVanillaSaveDiffSection(50)).toBe('body[+50]');
    expect(describeVanillaSaveDiffSection(1500)).toBe('body[+1500]');
  });

  test('describeVanillaSaveDiffSection returns no-divergence when offset is -1', () => {
    expect(describeVanillaSaveDiffSection(-1)).toBe('no-divergence');
  });

  test('handles two empty buffers as matching', () => {
    const diff = compareVanillaSaveBytes(new Uint8Array(0), new Uint8Array(0));
    expect(diff.matches).toBe(true);
    expect(diff.firstDivergentOffset).toBe(-1);
  });
});
