import { describe, expect, test } from 'bun:test';

import type { TextureDefinition } from '../../src/assets/texture1.ts';
import { makeTextureNumberResolver } from '../../src/render/textureNumberResolver.ts';

function texture(name: string): TextureDefinition {
  return { name, masked: false, width: 64, height: 128, patchCount: 0, patches: [] };
}

// Combined TEXTURE1 (0..2) then TEXTURE2 (3..4) order — index = vanilla texture number.
const ORDERED: readonly TextureDefinition[] = [texture('AASHITTY'), texture('STARTAN3'), texture('BROWN1'), texture('SUPPORT2'), texture('COMPSPAN')];

describe('textureNumberResolver: R_TextureNumForName / R_CheckTextureNumForName parity', () => {
  test('resolves each name to its combined-order index', () => {
    const textureNumber = makeTextureNumberResolver(ORDERED);
    expect(textureNumber('AASHITTY')).toBe(0);
    expect(textureNumber('STARTAN3')).toBe(1);
    expect(textureNumber('BROWN1')).toBe(2);
    expect(textureNumber('SUPPORT2')).toBe(3);
    expect(textureNumber('COMPSPAN')).toBe(4);
  });

  test('the "-" NoTexture marker resolves to 0 (name[0] == \'-\')', () => {
    const textureNumber = makeTextureNumberResolver(ORDERED);
    expect(textureNumber('-')).toBe(0);
    // R_CheckTextureNumForName only tests name[0], so any leading-dash name is NoTexture.
    expect(textureNumber('-ANY')).toBe(0);
  });

  test('match is case-insensitive over 8 characters', () => {
    const textureNumber = makeTextureNumberResolver([texture('startan3'.toUpperCase()), texture('LONGNAME8X')]);
    expect(textureNumber('startan3')).toBe(0);
    expect(textureNumber('StArTaN3')).toBe(0);
    // strncasecmp(...,8): only the first 8 chars participate.
    expect(textureNumber('LONGNAME')).toBe(1);
    expect(textureNumber('LONGNAMEZZZZ')).toBe(1);
  });

  test('a missing texture throws R_TextureNumForName I_Error parity', () => {
    const textureNumber = makeTextureNumberResolver(ORDERED);
    expect(() => textureNumber('NOSUCHTX')).toThrow('R_TextureNumForName: NOSUCHTX not found');
  });

  test('a duplicate name resolves to its highest (last) index — LIFO hashtable head parity', () => {
    const textureNumber = makeTextureNumberResolver([texture('STARTAN3'), texture('BROWN1'), texture('STARTAN3')]);
    expect(textureNumber('STARTAN3')).toBe(2);
    expect(textureNumber('BROWN1')).toBe(1);
  });

  test('is deterministic across rebuilds', () => {
    expect(makeTextureNumberResolver(ORDERED)('SUPPORT2')).toBe(makeTextureNumberResolver(ORDERED)('SUPPORT2'));
  });
});
