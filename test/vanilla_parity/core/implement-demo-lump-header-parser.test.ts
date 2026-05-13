import { describe, expect, test } from 'bun:test';

import { VANILLA_DEMO_HEADER_BYTES, VANILLA_DEMO_PLAYER_COUNT, VANILLA_DEMO_TERMINATOR_BYTE, VANILLA_DEMO_TICCMD_BYTES, VANILLA_DEMO_VERSION_109, parseDemoHeader } from '../../../src/core/implement-demo-lump-header-parser.ts';

const CANONICAL_HEADER = new Uint8Array([
  109, // version
  2, // skill
  1, // episode
  1, // map
  0, // deathmatch
  0, // respawn parm
  0, // fast parm
  0, // nomonsters
  0, // consoleplayer
  1,
  0,
  0,
  0, // player flags
]);

describe('vanilla demo header constants', () => {
  test('header is 13 bytes, version 109, ticcmd 4 bytes, terminator 0x80, 4 players', () => {
    expect(VANILLA_DEMO_HEADER_BYTES).toBe(13);
    expect(VANILLA_DEMO_VERSION_109).toBe(109);
    expect(VANILLA_DEMO_TICCMD_BYTES).toBe(4);
    expect(VANILLA_DEMO_TERMINATOR_BYTE).toBe(0x80);
    expect(VANILLA_DEMO_PLAYER_COUNT).toBe(4);
  });
});

describe('parseDemoHeader', () => {
  test('parses a canonical E1M1 skill-2 single-player header without violations', () => {
    const result = parseDemoHeader(CANONICAL_HEADER);
    expect(result.violations).toEqual([]);
    expect(result.header).not.toBeNull();
    expect(result.header!.version).toBe(109);
    expect(result.header!.skill).toBe(2);
    expect(result.header!.episode).toBe(1);
    expect(result.header!.map).toBe(1);
    expect(result.header!.playerInGame).toEqual([1, 0, 0, 0]);
  });

  test('flags insufficient_bytes when fewer than 13 bytes', () => {
    const result = parseDemoHeader(new Uint8Array(12));
    expect(result.violations).toContain('insufficient_bytes');
    expect(result.header).toBeNull();
  });

  test('flags unsupported_version when first byte is not 109', () => {
    const buffer = new Uint8Array(CANONICAL_HEADER);
    buffer[0] = 110;
    const result = parseDemoHeader(buffer);
    expect(result.violations).toContain('unsupported_version');
  });

  test('flags skill_out_of_range when skill > 4', () => {
    const buffer = new Uint8Array(CANONICAL_HEADER);
    buffer[1] = 5;
    const result = parseDemoHeader(buffer);
    expect(result.violations).toContain('skill_out_of_range');
  });

  test('flags invalid_episode when episode is 0 or > 4', () => {
    const buffer = new Uint8Array(CANONICAL_HEADER);
    buffer[2] = 0;
    expect(parseDemoHeader(buffer).violations).toContain('invalid_episode');
    buffer[2] = 5;
    expect(parseDemoHeader(buffer).violations).toContain('invalid_episode');
  });

  test('flags invalid_map when map is 0 or > 9', () => {
    const buffer = new Uint8Array(CANONICAL_HEADER);
    buffer[3] = 0;
    expect(parseDemoHeader(buffer).violations).toContain('invalid_map');
    buffer[3] = 10;
    expect(parseDemoHeader(buffer).violations).toContain('invalid_map');
  });

  test('flags invalid_console_player when consoleplayer >= 4', () => {
    const buffer = new Uint8Array(CANONICAL_HEADER);
    buffer[8] = 4;
    expect(parseDemoHeader(buffer).violations).toContain('invalid_console_player');
  });
});
