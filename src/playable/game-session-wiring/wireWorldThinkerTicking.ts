import type { LauncherInputState, LauncherSession } from '../../launcher/session.ts';
import type { MainLoop } from '../../mainLoop.ts';

import { advanceLauncherSession, EMPTY_LAUNCHER_INPUT } from '../../launcher/session.ts';

export const WIRE_WORLD_THINKER_TICKING_RUNTIME_CONTRACT = Object.freeze({
  auditStepId: '01-009',
  command: 'bun run doom.ts',
  entryFile: 'doom.ts',
  manifestPath: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
  schemaVersion: 1,
  targetRuntimeImplementedInReadScope: false,
} as const);

export interface WireWorldThinkerTickingOptions {
  readonly command: string;
  readonly inputState?: LauncherInputState;
  readonly mainLoop: MainLoop;
  readonly session: LauncherSession;
}

export interface WireWorldThinkerTickingResult {
  readonly command: string;
  readonly frameCountAfter: number;
  readonly frameCountBefore: number;
  readonly levelTimeAfter: number;
  readonly levelTimeBefore: number;
  readonly playerThinkerStillLinked: boolean;
  readonly thinkerCountAfter: number;
  readonly thinkerCountBefore: number;
  readonly tickedDuringPhase: 'tryRunTics';
}

/**
 * Advance one playable world thinker tic through the Bun runtime command path.
 *
 * @param options Started main loop, launcher session, runtime command, and optional input state.
 * @returns Replay-relevant evidence for the world thinker tic transition.
 *
 * @example
 * ```ts
 * const result = wireWorldThinkerTicking({
 *   command: 'bun run doom.ts',
 *   mainLoop,
 *   session,
 * });
 * console.log(result.levelTimeAfter);
 * ```
 */
export function wireWorldThinkerTicking(options: WireWorldThinkerTickingOptions): WireWorldThinkerTickingResult {
  validateRuntimeCommand(options.command);

  const frameCountBefore = options.mainLoop.frameCount;
  const levelTimeBefore = options.session.levelTime;
  const thinkerCountBefore = countThinkers(options.session);
  let tickedDuringPhase: WireWorldThinkerTickingResult['tickedDuringPhase'] | null = null;

  options.mainLoop.runOneFrame({
    display() {},
    startFrame() {},
    tryRunTics() {
      advanceLauncherSession(options.session, options.inputState ?? EMPTY_LAUNCHER_INPUT);
      tickedDuringPhase = 'tryRunTics';
    },
    updateSounds() {},
  });

  if (tickedDuringPhase === null) {
    throw new Error('world thinker ticking did not run during tryRunTics');
  }

  return Object.freeze({
    command: options.command,
    frameCountAfter: options.mainLoop.frameCount,
    frameCountBefore,
    levelTimeAfter: options.session.levelTime,
    levelTimeBefore,
    playerThinkerStillLinked: isPlayerThinkerLinked(options.session),
    thinkerCountAfter: countThinkers(options.session),
    thinkerCountBefore,
    tickedDuringPhase,
  });
}

function countThinkers(session: LauncherSession): number {
  let thinkerCount = 0;

  session.thinkerList.forEach(() => {
    thinkerCount += 1;
  });

  return thinkerCount;
}

function isPlayerThinkerLinked(session: LauncherSession): boolean {
  if (session.player.mo === null) {
    return false;
  }

  let playerThinkerLinked = false;

  session.thinkerList.forEach((thinker) => {
    if (thinker === session.player.mo) {
      playerThinkerLinked = true;
    }
  });

  return playerThinkerLinked;
}

function validateRuntimeCommand(command: string): void {
  if (command !== WIRE_WORLD_THINKER_TICKING_RUNTIME_CONTRACT.command) {
    throw new Error(`wireWorldThinkerTicking requires bun run doom.ts, got ${command}`);
  }
}
