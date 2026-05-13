/**
 * Vanilla DOOM 1.9 M_NewGame routing contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c M_NewGame:
 *
 *   void M_NewGame(int choice)
 *   {
 *       if (netgame && !demoplayback)
 *       {
 *           M_StartMessage(DEH_String(NEWGAME), NULL, false);
 *           return;
 *       }
 *       if (gamemode == commercial)
 *           M_SetupNextMenu(&NewDef);    // skill menu
 *       else
 *           M_SetupNextMenu(&EpiDef);    // episode menu
 *   }
 *
 * Notes for parity:
 *   - Pressing "New Game" while in a netgame (and not during demo playback) shows
 *     the NEWGAME warning popup ("you can't start a new game over a net link!")
 *     and stops. The next menu is NOT advanced in this case.
 *   - Demo playback bypasses the netgame check (you can start a new game from a
 *     watched demo even in a netgame context).
 *   - Commercial (Doom II) jumps directly to the skill menu (NewDef).
 *   - Non-commercial (shareware/registered/retail) advances to the episode menu
 *     (EpiDef), which then routes the chosen episode through M_Episode into the
 *     skill menu.
 *   - The Chex Quest branch in upstream (`gameversion == exe_chex`) is out of
 *     scope for the vanilla DOOM 1.9 parity target and is NOT mirrored here.
 */

export type VanillaNewGameRouteGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

export type VanillaNewGameRoute = 'netgame-warning' | 'episode-menu' | 'skill-menu';

export interface NewGameRouteInput {
  readonly gameMode: VanillaNewGameRouteGameMode;
  readonly isNetgame: boolean;
  readonly isDemoPlayback: boolean;
}

export function resolveVanillaNewGameRoute(input: NewGameRouteInput): VanillaNewGameRoute {
  if (input.isNetgame && !input.isDemoPlayback) {
    return 'netgame-warning';
  }
  if (input.gameMode === 'commercial') {
    return 'skill-menu';
  }
  return 'episode-menu';
}

export const VANILLA_NEWGAME_NETGAME_MESSAGE_KEY = 'NEWGAME';
