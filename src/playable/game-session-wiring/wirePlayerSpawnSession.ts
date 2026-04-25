import type { LauncherResources, LauncherSession } from '../../launcher/session.ts';

import { createLauncherSession } from '../../launcher/session.ts';
import { MainLoop } from '../../mainLoop.ts';

export const WIRE_PLAYER_SPAWN_SESSION_CONTRACT = Object.freeze({
  audit: Object.freeze({
    manifestPath: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
    schemaVersion: 1,
    surfaceIdentifier: 'menu-to-e1m1-transition',
  }),
  runtimeCommand: 'bun run doom.ts',
  stepIdentifier: '08-003',
  stepTitle: 'wire-player-spawn-session',
});

export interface PlayerSpawnSnapshot {
  readonly angle: number;
  readonly health: number;
  readonly mapName: string;
  readonly spawnOptions: number;
  readonly spawnType: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ReplayStateSnapshot {
  readonly levelTime: number;
  readonly loopFrameCount: number;
  readonly loopStarted: boolean;
}

export interface WirePlayerSpawnSessionOptions {
  readonly mapName: string;
  readonly runtimeCommand: string;
  readonly skill: number;
}

export interface WirePlayerSpawnSessionResult {
  readonly mainLoop: MainLoop;
  readonly playerSpawn: PlayerSpawnSnapshot;
  readonly replayState: ReplayStateSnapshot;
  readonly runtimeCommand: string;
  readonly session: LauncherSession;
}

export function wirePlayerSpawnSession(resources: LauncherResources, options: WirePlayerSpawnSessionOptions): WirePlayerSpawnSessionResult {
  validateRuntimeCommand(options.runtimeCommand);

  const session = createLauncherSession(resources, {
    mapName: options.mapName,
    skill: options.skill,
  });
  const playerMapObject = session.player.mo;

  if (playerMapObject === null) {
    throw new Error(`Player 1 start was not spawned for ${session.mapName}.`);
  }

  const spawnpoint = playerMapObject.spawnpoint;

  if (spawnpoint === null) {
    throw new Error(`Player 1 spawnpoint was not recorded for ${session.mapName}.`);
  }

  const mainLoop = new MainLoop();

  return Object.freeze({
    mainLoop,
    playerSpawn: Object.freeze({
      angle: spawnpoint.angle,
      health: playerMapObject.health,
      mapName: session.mapName,
      spawnOptions: spawnpoint.options,
      spawnType: spawnpoint.type,
      x: spawnpoint.x,
      y: spawnpoint.y,
      z: playerMapObject.z,
    }),
    replayState: Object.freeze({
      levelTime: session.levelTime,
      loopFrameCount: mainLoop.frameCount,
      loopStarted: mainLoop.started,
    }),
    runtimeCommand: options.runtimeCommand,
    session,
  });
}

function validateRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== WIRE_PLAYER_SPAWN_SESSION_CONTRACT.runtimeCommand) {
    throw new Error(`wire-player-spawn-session requires bun run doom.ts, got ${runtimeCommand}`);
  }
}
