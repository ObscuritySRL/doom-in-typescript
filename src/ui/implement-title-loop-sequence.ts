/**
 * Vanilla DOOM 1.9 D_DoAdvanceDemo title-loop sequence contract.
 *
 * From Chocolate Doom 2.2.1 d_main.c D_DoAdvanceDemo:
 *   demosequence = (demosequence + 1) % 6;
 *   switch (demosequence)
 *   {
 *     case 0: pagetic = (gamemode == commercial) ? TICRATE*11 : 170;
 *             pagename = "TITLEPIC";
 *             if (gamemode == commercial) S_StartMusic(mus_dm2ttl);
 *             else S_StartMusic(mus_intro);
 *             break;
 *     case 1: G_DeferedPlayDemo("demo1"); break;
 *     case 2: pagetic = 200; gamestate = GS_DEMOSCREEN; pagename = "CREDIT"; break;
 *     case 3: G_DeferedPlayDemo("demo2"); break;
 *     case 4: gamestate = GS_DEMOSCREEN;
 *             if (gamemode == commercial)
 *             { pagetic = TICRATE*11; pagename = "TITLEPIC"; S_StartMusic(mus_dm2ttl); }
 *             else
 *             { pagetic = 200;
 *               pagename = (gamemode == retail) ? "CREDIT" : "HELP2"; }
 *             break;
 *     case 5: G_DeferedPlayDemo("demo3"); break;
 *   }
 *
 * Notes for parity:
 *   - The cycle length is constant 6 across all game modes.
 *   - TICRATE = 35 (defined in doomdef.h), so TICRATE*11 = 385.
 *   - The non-commercial TITLEPIC pagetic is the literal `170`, not derived from TICRATE.
 *   - The interlude pagetic for CREDIT and HELP2 (and the commercial state-4 TITLEPIC) is `200`.
 *   - Music is only started on case 0 and (commercial) case 4; the other page states preserve the current music.
 *   - The "ultimate" game mode in this contract maps to Chocolate Doom's `retail` enum, which is what the
 *     shipped src/bootstrap/gameMode.ts module uses.
 */

export const VANILLA_TITLE_CYCLE_LENGTH = 6;
export const VANILLA_TITLEPIC_PAGETIC_NON_COMMERCIAL = 170;
export const VANILLA_TITLEPIC_PAGETIC_COMMERCIAL = 385;
export const VANILLA_INTERLUDE_PAGETIC = 200;

export type VanillaTitleGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

export interface VanillaTitlePageStep {
  readonly kind: 'page';
  readonly demosequence: number;
  readonly lumpName: string;
  readonly pagetic: number;
  readonly musicLump: string | null;
}

export interface VanillaTitleDemoStep {
  readonly kind: 'demo';
  readonly demosequence: number;
  readonly demoLump: string;
}

export type VanillaTitleStep = VanillaTitlePageStep | VanillaTitleDemoStep;

function commercialTitlepicStep(demosequence: number): VanillaTitlePageStep {
  return Object.freeze({
    kind: 'page',
    demosequence,
    lumpName: 'TITLEPIC',
    pagetic: VANILLA_TITLEPIC_PAGETIC_COMMERCIAL,
    musicLump: 'D_DM2TTL',
  });
}

export function computeVanillaTitleStep(gameMode: VanillaTitleGameMode, demosequence: number): VanillaTitleStep {
  const wrapped = ((demosequence % VANILLA_TITLE_CYCLE_LENGTH) + VANILLA_TITLE_CYCLE_LENGTH) % VANILLA_TITLE_CYCLE_LENGTH;
  switch (wrapped) {
    case 0:
      if (gameMode === 'commercial') {
        return commercialTitlepicStep(0);
      }
      return Object.freeze({
        kind: 'page',
        demosequence: 0,
        lumpName: 'TITLEPIC',
        pagetic: VANILLA_TITLEPIC_PAGETIC_NON_COMMERCIAL,
        musicLump: 'D_INTRO',
      });
    case 1:
      return Object.freeze({ kind: 'demo', demosequence: 1, demoLump: 'DEMO1' });
    case 2:
      return Object.freeze({
        kind: 'page',
        demosequence: 2,
        lumpName: 'CREDIT',
        pagetic: VANILLA_INTERLUDE_PAGETIC,
        musicLump: null,
      });
    case 3:
      return Object.freeze({ kind: 'demo', demosequence: 3, demoLump: 'DEMO2' });
    case 4:
      if (gameMode === 'commercial') {
        return Object.freeze({
          kind: 'page',
          demosequence: 4,
          lumpName: 'TITLEPIC',
          pagetic: VANILLA_INTERLUDE_PAGETIC,
          musicLump: 'D_DM2TTL',
        });
      }
      return Object.freeze({
        kind: 'page',
        demosequence: 4,
        lumpName: gameMode === 'retail' ? 'CREDIT' : 'HELP2',
        pagetic: VANILLA_INTERLUDE_PAGETIC,
        musicLump: null,
      });
    case 5:
      return Object.freeze({ kind: 'demo', demosequence: 5, demoLump: 'DEMO3' });
    default:
      throw new Error(`unreachable demosequence ${wrapped}`);
  }
}

export function advanceVanillaTitleSequence(previousDemosequence: number): number {
  return (previousDemosequence + 1) % VANILLA_TITLE_CYCLE_LENGTH;
}
