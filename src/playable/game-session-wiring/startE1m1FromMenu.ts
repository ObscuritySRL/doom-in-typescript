import type { LauncherResources, LauncherSession } from '../../launcher/session.ts';

import { createLauncherSession } from '../../launcher/session.ts';
import { MainLoop } from '../../mainLoop.ts';

export const START_E1M1_FROM_MENU_TRANSITION_ROUTE = ['main:new-game', 'episode:e1', 'skill-select'] as const;

export const START_E1M1_FROM_MENU_RUNTIME = Object.freeze({
  command: 'bun run doom.ts',
  entryFile: 'doom.ts',
  expectedEpisode: 1,
  expectedMapName: 'E1M1',
  transitionRoute: START_E1M1_FROM_MENU_TRANSITION_ROUTE,
});

export interface StartE1m1FromMenuRequest {
  readonly command: string;
  readonly selectedEpisode: number;
  readonly selectedSkill: number;
  readonly transitionRoute: readonly string[];
}

export interface StartE1m1FromMenuResult {
  readonly command: typeof START_E1M1_FROM_MENU_RUNTIME.command;
  readonly launcherSession: LauncherSession;
  readonly mainLoop: MainLoop;
  readonly mapName: typeof START_E1M1_FROM_MENU_RUNTIME.expectedMapName;
  readonly selectedSkill: number;
  readonly transitionRoute: typeof START_E1M1_FROM_MENU_TRANSITION_ROUTE;
}

export function startE1m1FromMenu(resources: LauncherResources, request: StartE1m1FromMenuRequest): StartE1m1FromMenuResult {
  validateRuntimeCommand(request.command);
  validateSelectedEpisode(request.selectedEpisode);
  validateSelectedSkill(request.selectedSkill);
  validateTransitionRoute(request.transitionRoute);

  return {
    command: START_E1M1_FROM_MENU_RUNTIME.command,
    launcherSession: createLauncherSession(resources, {
      mapName: START_E1M1_FROM_MENU_RUNTIME.expectedMapName,
      skill: request.selectedSkill,
    }),
    mainLoop: new MainLoop(),
    mapName: START_E1M1_FROM_MENU_RUNTIME.expectedMapName,
    selectedSkill: request.selectedSkill,
    transitionRoute: START_E1M1_FROM_MENU_RUNTIME.transitionRoute,
  };
}

function validateRuntimeCommand(command: string): void {
  if (command !== START_E1M1_FROM_MENU_RUNTIME.command) {
    throw new Error(`startE1m1FromMenu requires ${START_E1M1_FROM_MENU_RUNTIME.command}, got ${command}`);
  }
}

function validateSelectedEpisode(selectedEpisode: number): void {
  if (selectedEpisode !== START_E1M1_FROM_MENU_RUNTIME.expectedEpisode) {
    throw new Error(`startE1m1FromMenu requires episode ${START_E1M1_FROM_MENU_RUNTIME.expectedEpisode}, got ${selectedEpisode}`);
  }
}

function validateSelectedSkill(selectedSkill: number): void {
  if (!Number.isInteger(selectedSkill) || selectedSkill < 1 || selectedSkill > 5) {
    throw new RangeError(`selectedSkill must be an integer from 1 to 5, got ${selectedSkill}`);
  }
}

function validateTransitionRoute(transitionRoute: readonly string[]): void {
  if (transitionRoute.length !== START_E1M1_FROM_MENU_TRANSITION_ROUTE.length) {
    throw new Error(`startE1m1FromMenu requires transition route ${START_E1M1_FROM_MENU_TRANSITION_ROUTE.join(' -> ')}`);
  }

  for (let routeIndex = 0; routeIndex < START_E1M1_FROM_MENU_TRANSITION_ROUTE.length; routeIndex += 1) {
    if (transitionRoute[routeIndex] !== START_E1M1_FROM_MENU_TRANSITION_ROUTE[routeIndex]) {
      throw new Error(`startE1m1FromMenu requires transition route ${START_E1M1_FROM_MENU_TRANSITION_ROUTE.join(' -> ')}`);
    }
  }
}
