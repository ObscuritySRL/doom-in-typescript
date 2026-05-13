/**
 * Vanilla DOOM 1.9 sky-rendering semantics contract.
 *
 * From Chocolate Doom 2.2.1 r_main.c R_InitSkyMap and r_plane.c R_DrawPlanes
 * (sky branch) and g_game.c G_InitNew:
 *
 *   void R_InitSkyMap(void)
 *   {
 *       skyflatnum = R_FlatNumForName(DEH_String(SKYFLATNAME));
 *       skytexturemid = 100 * FRACUNIT;
 *   }
 *
 *   // G_InitNew sky-lump selection (per game mode):
 *   if (gamemode == commercial)
 *   {
 *       skytexture = R_TextureNumForName("SKY3");
 *       if (gamemap < 12) skytexture = R_TextureNumForName("SKY1");
 *       else if (gamemap < 21) skytexture = R_TextureNumForName("SKY2");
 *   }
 *   else
 *   {
 *       switch (gameepisode)
 *       {
 *         default:
 *         case 1: skytexture = R_TextureNumForName("SKY1"); break;
 *         case 2: skytexture = R_TextureNumForName("SKY2"); break;
 *         case 3: skytexture = R_TextureNumForName("SKY3"); break;
 *         case 4: skytexture = R_TextureNumForName("SKY4"); break;
 *       }
 *   }
 *
 * Notes for parity:
 *   - SKYFLATNAME = "F_SKY1" — the sky-flat sentinel name in WAD lumps.
 *   - skytexturemid = 100 * FRACUNIT (vanilla); ports may differ.
 *   - Sky texture height is 128 pixels in vanilla (handled by the same column
 *     mask `& 127` as wall textures).
 *   - Commercial (Doom II) episode mapping by gamemap (1-based):
 *     maps 1..11   -> SKY1
 *     maps 12..20  -> SKY2
 *     maps 21+     -> SKY3
 *   - Non-commercial (Doom 1) episode mapping by gameepisode (1-based):
 *     episode 1 -> SKY1, 2 -> SKY2, 3 -> SKY3, 4 -> SKY4 (Ultimate Doom only)
 *   - SKY4 only exists in retail/Ultimate Doom WADs; selecting episode 4 in
 *     non-retail crashes.
 */

export const VANILLA_SKYFLATNAME = 'F_SKY1';
export const VANILLA_SKYTEXTUREMID_FIXED = 100 * 0x10000;

export type VanillaSkyGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

export interface SkyTextureSelectInput {
  readonly gameMode: VanillaSkyGameMode;
  readonly gameEpisode: number;
  readonly gameMap: number;
}

export function selectVanillaSkyTextureLumpName(input: SkyTextureSelectInput): string {
  if (input.gameMode === 'commercial') {
    if (input.gameMap < 12) {
      return 'SKY1';
    }
    if (input.gameMap < 21) {
      return 'SKY2';
    }
    return 'SKY3';
  }
  switch (input.gameEpisode) {
    case 1:
      return 'SKY1';
    case 2:
      return 'SKY2';
    case 3:
      return 'SKY3';
    case 4:
      return 'SKY4';
    default:
      return 'SKY1';
  }
}

export function vanillaSkyTextureExistsInGameMode(textureName: string, gameMode: VanillaSkyGameMode): boolean {
  if (textureName === 'SKY4') {
    return gameMode === 'retail';
  }
  return true;
}
