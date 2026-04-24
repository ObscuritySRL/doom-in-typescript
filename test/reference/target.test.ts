import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import type { ReferenceTarget } from '../../src/reference/target.ts';

describe('PRIMARY_TARGET', () => {
  it('pins the engine to Chocolate Doom 2.2.1', () => {
    expect(PRIMARY_TARGET.engine).toBe('Chocolate Doom');
    expect(PRIMARY_TARGET.engineVersion).toBe('2.2.1');
  });

  it('emulates Doom 1.9', () => {
    expect(PRIMARY_TARGET.emulatedVersion).toBe('1.9');
  });

  it('targets shareware game mode', () => {
    expect(PRIMARY_TARGET.gameMode).toBe('shareware');
  });

  it('pins the merged executable hash', () => {
    expect(PRIMARY_TARGET.executableHash).toBe('5CA97717FD79F833B248AE5985FFFADBEE39533F5E0529BC9D7B439E08B8F1D2');
  });

  it('pins the DOS executable hash', () => {
    expect(PRIMARY_TARGET.dosExecutableHash).toBe('9D3216605417888D5A699FA3794E46638EB4CB8634501AE748D74F9C2CFAE37B');
  });

  it('pins the shareware WAD hash', () => {
    expect(PRIMARY_TARGET.wadHash).toBe('1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771');
  });

  it('pins the WAD filename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
  });

  it('records 1264 lumps in the shareware WAD', () => {
    expect(PRIMARY_TARGET.wadLumpCount).toBe(1264);
  });

  it('pins the tic rate at 35 Hz', () => {
    expect(PRIMARY_TARGET.ticRateHz).toBe(35);
  });

  it('is frozen and cannot be mutated', () => {
    expect(Object.isFrozen(PRIMARY_TARGET)).toBe(true);
    expect(Object.getOwnPropertyDescriptor(PRIMARY_TARGET, 'engine')?.writable).toBe(false);
  });

  it('has all SHA-256 hashes as 64-character uppercase hex strings', () => {
    const hexPattern = /^[0-9A-F]{64}$/;
    expect(PRIMARY_TARGET.executableHash).toMatch(hexPattern);
    expect(PRIMARY_TARGET.dosExecutableHash).toMatch(hexPattern);
    expect(PRIMARY_TARGET.wadHash).toMatch(hexPattern);
  });

  it('satisfies the ReferenceTarget interface at compile time', () => {
    const target: ReferenceTarget = PRIMARY_TARGET;
    expect(target).toBe(PRIMARY_TARGET);
  });
});
