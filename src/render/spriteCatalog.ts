/**
 * Sprite-frame catalog — Chocolate Doom 2.2.1 r_things.c
 * `R_InstallSpriteLump` + `R_InitSpriteDefs` over the vanilla
 * `info.c` `sprnames[]` table.
 *
 * `R_InitSpriteDefs` walks the WAD sprite namespace (the
 * `firstspritelump..lastspritelump` span the codebase exposes as
 * {@link SpriteNamespace}) and, for each of the
 * {@link VANILLA_SPRNAMES} 4-character sprite prefixes, collects the
 * `A1`/`A2A8`-style frame+rotation lumps into the
 * {@link SpriteDef}[] table {@link projectSprite} consumes.  The
 * frame letter is `name[4]-'A'`, the rotation digit `name[5]-'0'`;
 * an 8-character lump (`name[6]` set) additionally installs the
 * mirrored second view (`name[6]`/`name[7]`, `flipped = true`).
 *
 * Verbatim parity contract (Chocolate Doom 2.2.1 r_things.c):
 *
 *   typedef struct { short lump[8]; byte flip[8]; byte rotate; } spriteframe_t;
 *   typedef struct { int numframes; spriteframe_t* spriteframes; } spritedef_t;
 *   spriteframe_t sprtemp[29];  int maxframe;
 *
 *   void R_InstallSpriteLump(int lump, unsigned frame, unsigned rotation, boolean flipped) {
 *     if (frame >= 29 || rotation > 8) I_Error("...Bad frame characters...");
 *     if ((int)frame > maxframe) maxframe = frame;
 *     if (rotation == 0) {
 *       if (sprtemp[frame].rotate == false) I_Error("...multip rot=0 lump");
 *       if (sprtemp[frame].rotate == true)  I_Error("...rotations and a rot=0 lump");
 *       sprtemp[frame].rotate = false;
 *       for (r=0;r<8;r++){ sprtemp[frame].lump[r]=lump-firstspritelump; sprtemp[frame].flip[r]=(byte)flipped; }
 *       return;
 *     }
 *     if (sprtemp[frame].rotate == false) I_Error("...rotations and a rot=0 lump");
 *     sprtemp[frame].rotate = true;
 *     rotation--;
 *     if (sprtemp[frame].lump[rotation] != -1) I_Error("...two lumps mapped to it");
 *     sprtemp[frame].lump[rotation]=lump-firstspritelump; sprtemp[frame].flip[rotation]=(byte)flipped;
 *   }
 *
 *   void R_InitSpriteDefs(char** namelist) {
 *     numsprites = <count of namelist>;  if(!numsprites) return;
 *     for (i=0;i<numsprites;i++) {
 *       spritename = namelist[i];  memset(sprtemp,-1,sizeof(sprtemp));  maxframe=-1;
 *       for (l=firstspritelump..lastspritelump)
 *         if (!strncasecmp(lumpinfo[l].name, spritename, 4)) {
 *           frame=name[4]-'A'; rotation=name[5]-'0';
 *           R_InstallSpriteLump(l, frame, rotation, false);
 *           if (name[6]) { frame=name[6]-'A'; rotation=name[7]-'0'; R_InstallSpriteLump(l, frame, rotation, true); }
 *         }
 *       if (maxframe == -1) { sprites[i].numframes = 0; continue; }
 *       maxframe++;
 *       for (frame=0;frame<maxframe;frame++) switch((int)sprtemp[frame].rotate){
 *         case -1: I_Error("...No patches found...");
 *         case 0:  break;
 *         case 1:  for(rotation=0;rotation<8;rotation++) if(sprtemp[frame].lump[rotation]==-1) I_Error("...missing rotations"); break;
 *       }
 *       sprites[i].numframes = maxframe;  memcpy(sprites[i].spriteframes, sprtemp, maxframe*sizeof(spriteframe_t));
 *     }
 *   }
 *
 * Parity notes:
 *   - `spriteframe_t.rotate` is a `byte`; `memset(sprtemp,-1,…)` makes
 *     an untouched frame's `rotate` 0xFF (255), NOT signed -1.  So the
 *     `== false`/`== true` tests compare against 0/1 and the
 *     validation `switch ((int)rotate)` `case -1` is unreachable for
 *     the byte (a gap frame in `0..maxframe` is silently left with
 *     `lump = -1` and no `I_Error`) — a faithful Chocolate Doom 2.2.1
 *     quirk that real IWAD sprites never exercise.  Modelled exactly.
 *   - `patched`/`DEH_String`/`modifiedgame` collapse to the identity
 *     path for the unmodified IWAD target (no Dehacked, no PWAD): the
 *     installed lump is the namespace-relative `spriteNumber`
 *     (`lump - firstspritelump`).
 *   - Sprites whose name never appears in the namespace (DOOM2-only
 *     prefixes absent from shareware DOOM1.WAD) get
 *     `numFrames = 0` — vanilla's `maxframe == -1 → continue`.
 *
 * Pure: reads the supplied namespace + name table, no Win32/WAD I/O.
 */

import type { SpriteDef, SpriteFrame } from './spriteProjection.ts';

/** Maximum frame slots (`spriteframe_t sprtemp[29]`; `frame >= 29 → I_Error`). */
export const MAX_SPRITE_FRAMES = 29;

/**
 * Chocolate Doom 2.2.1 `info.c` `char *sprnames[]` (138 entries, the
 * trailing `NULL` terminator omitted — the array length is the count).
 * Transcribed verbatim, in order, so the resulting `SpriteDef[]`
 * indices match the vanilla `SPR_*` enum.
 */
export const VANILLA_SPRNAMES: readonly string[] = Object.freeze([
  'TROO',
  'SHTG',
  'PUNG',
  'PISG',
  'PISF',
  'SHTF',
  'SHT2',
  'CHGG',
  'CHGF',
  'MISG',
  'MISF',
  'SAWG',
  'PLSG',
  'PLSF',
  'BFGG',
  'BFGF',
  'BLUD',
  'PUFF',
  'BAL1',
  'BAL2',
  'PLSS',
  'PLSE',
  'MISL',
  'BFS1',
  'BFE1',
  'BFE2',
  'TFOG',
  'IFOG',
  'PLAY',
  'POSS',
  'SPOS',
  'VILE',
  'FIRE',
  'FATB',
  'FBXP',
  'SKEL',
  'MANF',
  'FATT',
  'CPOS',
  'SARG',
  'HEAD',
  'BAL7',
  'BOSS',
  'BOS2',
  'SKUL',
  'SPID',
  'BSPI',
  'APLS',
  'APBX',
  'CYBR',
  'PAIN',
  'SSWV',
  'KEEN',
  'BBRN',
  'BOSF',
  'ARM1',
  'ARM2',
  'BAR1',
  'BEXP',
  'FCAN',
  'BON1',
  'BON2',
  'BKEY',
  'RKEY',
  'YKEY',
  'BSKU',
  'RSKU',
  'YSKU',
  'STIM',
  'MEDI',
  'SOUL',
  'PINV',
  'PSTR',
  'PINS',
  'MEGA',
  'SUIT',
  'PMAP',
  'PVIS',
  'CLIP',
  'AMMO',
  'ROCK',
  'BROK',
  'CELL',
  'CELP',
  'SHEL',
  'SBOX',
  'BPAK',
  'BFUG',
  'MGUN',
  'CSAW',
  'LAUN',
  'PLAS',
  'SHOT',
  'SGN2',
  'COLU',
  'SMT2',
  'GOR1',
  'POL2',
  'POL5',
  'POL4',
  'POL3',
  'POL1',
  'POL6',
  'GOR2',
  'GOR3',
  'GOR4',
  'GOR5',
  'SMIT',
  'COL1',
  'COL2',
  'COL3',
  'COL4',
  'CAND',
  'CBRA',
  'COL6',
  'TRE1',
  'TRE2',
  'ELEC',
  'CEYE',
  'FSKU',
  'COL5',
  'TBLU',
  'TGRN',
  'TRED',
  'SMBT',
  'SMGT',
  'SMRT',
  'HDB1',
  'HDB2',
  'HDB3',
  'HDB4',
  'HDB5',
  'HDB6',
  'POB1',
  'POB2',
  'BRS1',
  'TLMP',
  'TLP2',
]);

/** One entry of the WAD sprite namespace (the `R_InitSpriteDefs` lump scan input). */
export interface SpriteCatalogLump {
  /** Lump name (e.g. `"TROOA1"` / `"TROOA2A8"`), uppercase. */
  readonly name: string;
  /** `lump - firstspritelump` — namespace-relative lump index. */
  readonly spriteNumber: number;
}

const ROTATE_UNSET = 0xff; // byte memset(-1); never equals false(0)/true(1)/-1.
const CHAR_A = 'A'.charCodeAt(0);
const CHAR_0 = '0'.charCodeAt(0);

interface SprTemp {
  readonly lump: Int16Array; // 8, -1 = unset
  readonly flip: Uint8Array; // 8, byte(flipped)
  rotate: number; // byte: ROTATE_UNSET / 0 (false) / 1 (true)
}

function freshSprTemp(): SprTemp[] {
  const t: SprTemp[] = new Array(MAX_SPRITE_FRAMES);
  for (let f = 0; f < MAX_SPRITE_FRAMES; f += 1) {
    const lump = new Int16Array(8);
    lump.fill(-1);
    t[f] = { lump, flip: new Uint8Array(8), rotate: ROTATE_UNSET };
  }
  return t;
}

/**
 * r_things.c `R_InstallSpriteLump`.  `lump` is already
 * namespace-relative (`lump - firstspritelump`); `I_Error` is a thrown
 * `Error` carrying the vanilla message identity.
 */
function installSpriteLump(sprtemp: SprTemp[], state: { maxframe: number }, spritename: string, lump: number, frame: number, rotation: number, flipped: boolean): void {
  if (frame >= MAX_SPRITE_FRAMES || rotation > 8) {
    throw new Error(`R_InstallSpriteLump: Bad frame characters in lump ${lump}`);
  }
  if (frame > state.maxframe) {
    state.maxframe = frame;
  }

  const sf = sprtemp[frame]!;
  const flipByte = flipped ? 1 : 0;

  if (rotation === 0) {
    // the lump should be used for all rotations
    if (sf.rotate === 0 /* false */) {
      throw new Error(`R_InitSprites: Sprite ${spritename} frame ${String.fromCharCode(CHAR_A + frame)} has multip rot=0 lump`);
    }
    if (sf.rotate === 1 /* true */) {
      throw new Error(`R_InitSprites: Sprite ${spritename} frame ${String.fromCharCode(CHAR_A + frame)} has rotations and a rot=0 lump`);
    }
    sf.rotate = 0; // false
    for (let r = 0; r < 8; r += 1) {
      sf.lump[r] = lump;
      sf.flip[r] = flipByte;
    }
    return;
  }

  // the lump is only used for one rotation
  if (sf.rotate === 0 /* false */) {
    throw new Error(`R_InitSprites: Sprite ${spritename} frame ${String.fromCharCode(CHAR_A + frame)} has rotations and a rot=0 lump`);
  }
  sf.rotate = 1; // true

  const r = rotation - 1; // make 0 based
  if (sf.lump[r] !== -1) {
    throw new Error(`R_InitSprites: Sprite ${spritename} : ${String.fromCharCode(CHAR_A + frame)} : ${String.fromCharCode(CHAR_0 + 1 + r)} has two lumps mapped to it`);
  }
  sf.lump[r] = lump;
  sf.flip[r] = flipByte;
}

function toSpriteFrame(sf: SprTemp): SpriteFrame {
  return {
    rotate: sf.rotate === 1,
    lump: Array.from(sf.lump, (v) => v),
    flip: Array.from(sf.flip, (v) => v !== 0),
  };
}

/**
 * r_things.c `R_InitSpriteDefs` — build the per-sprite frame table.
 *
 * `lumps` is the WAD sprite namespace (`firstspritelump..lastspritelump`,
 * each `{ name, spriteNumber }` with `spriteNumber = lump -
 * firstspritelump`).  `names` is {@link VANILLA_SPRNAMES} (or a slice
 * for tests).  Returns one {@link SpriteDef} per name, in order;
 * unmatched names get `numFrames = 0` (vanilla `maxframe == -1`).
 * Throws (vanilla `I_Error`) on malformed sprite lumps.
 */
export function buildSpriteCatalog(lumps: readonly SpriteCatalogLump[], names: readonly string[] = VANILLA_SPRNAMES): SpriteDef[] {
  const sprites: SpriteDef[] = new Array(names.length);

  for (let i = 0; i < names.length; i += 1) {
    const spritename = names[i]!;
    const prefix = spritename.toUpperCase();
    const sprtemp = freshSprTemp();
    const state = { maxframe: -1 };

    for (const lump of lumps) {
      // strncasecmp(lumpinfo[l].name, spritename, 4)
      if (lump.name.length < 4 || lump.name.slice(0, 4).toUpperCase() !== prefix) {
        continue;
      }
      const upper = lump.name.toUpperCase();
      const frame = upper.charCodeAt(4) - CHAR_A;
      const rotation = upper.charCodeAt(5) - CHAR_0;
      installSpriteLump(sprtemp, state, spritename, lump.spriteNumber, frame, rotation, false);

      // if (lumpinfo[l].name[6]) — an 8-char "A2A8" mirrored second view
      if (upper.length > 6 && upper.charCodeAt(6) !== 0) {
        const frame2 = upper.charCodeAt(6) - CHAR_A;
        const rotation2 = upper.charCodeAt(7) - CHAR_0;
        installSpriteLump(sprtemp, state, spritename, lump.spriteNumber, frame2, rotation2, true);
      }
    }

    if (state.maxframe === -1) {
      sprites[i] = { numFrames: 0, frames: [] };
      continue;
    }

    const maxframe = state.maxframe + 1;

    for (let frame = 0; frame < maxframe; frame += 1) {
      const rotate = sprtemp[frame]!.rotate;
      // switch ((int)sprtemp[frame].rotate)
      if (rotate === 0) {
        // only the first rotation is needed
      } else if (rotate === 1) {
        // must have all 8 frames
        for (let rotation = 0; rotation < 8; rotation += 1) {
          if (sprtemp[frame]!.lump[rotation] === -1) {
            throw new Error(`R_InitSprites: Sprite ${spritename} frame ${String.fromCharCode(CHAR_A + frame)} is missing rotations`);
          }
        }
      }
      // case -1 ("No patches found"): unreachable for the `byte rotate`
      // (an untouched frame is 0xFF, not -1) — faithful vanilla quirk;
      // a gap frame is left with lump = -1 and no I_Error.
    }

    const frames: SpriteFrame[] = new Array(maxframe);
    for (let frame = 0; frame < maxframe; frame += 1) {
      frames[frame] = toSpriteFrame(sprtemp[frame]!);
    }
    sprites[i] = { numFrames: maxframe, frames };
  }

  return sprites;
}
