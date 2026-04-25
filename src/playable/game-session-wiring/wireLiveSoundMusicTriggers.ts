import type { LauncherSession } from '../../launcher/session.ts';
import type { MainLoopPhase, PreLoopStep } from '../../mainLoop.ts';

import { MainLoop } from '../../mainLoop.ts';

export const WIRE_LIVE_SOUND_MUSIC_TRIGGERS_COMMAND_CONTRACT = Object.freeze({
  command: 'bun run doom.ts',
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
});

export interface LiveMusicTrigger {
  readonly kind: 'start-level-music';
  readonly lumpName: string;
  readonly mapName: string;
  readonly phase: 'updateSounds';
  readonly tic: number;
}

export interface LiveSoundMusicTriggerSession {
  readonly levelTime: LauncherSession['levelTime'];
  readonly mapName: LauncherSession['mapName'];
  readonly player: {
    readonly mo: null | {
      readonly angle: number;
      readonly x: number;
      readonly y: number;
    };
  };
  readonly showAutomap: LauncherSession['showAutomap'];
}

export interface LiveSoundTrigger {
  readonly angle: number | null;
  readonly kind: 'update-listener-sounds';
  readonly listenerActive: boolean;
  readonly listenerX: number | null;
  readonly listenerY: number | null;
  readonly phase: 'updateSounds';
  readonly tic: number;
  readonly view: 'automap' | 'gameplay';
}

export interface WireLiveSoundMusicTriggersOptions {
  readonly loop?: MainLoop;
  readonly runtimeCommand: string;
  readonly session: LiveSoundMusicTriggerSession;
}

export interface WireLiveSoundMusicTriggersResult {
  readonly command: string;
  readonly frameCountAfter: number;
  readonly frameCountBefore: number;
  readonly musicTrigger: LiveMusicTrigger;
  readonly phaseTrace: readonly MainLoopPhase[];
  readonly preLoopTrace: readonly PreLoopStep[];
  readonly soundTrigger: LiveSoundTrigger;
}

export function wireLiveSoundMusicTriggers(options: WireLiveSoundMusicTriggersOptions): WireLiveSoundMusicTriggersResult {
  validateRuntimeCommand(options.runtimeCommand);

  const loop = options.loop ?? new MainLoop();
  const phaseTrace: MainLoopPhase[] = [];
  const preLoopTrace: PreLoopStep[] = [];

  if (!loop.started) {
    loop.setup({
      executeSetViewSize() {
        preLoopTrace.push('executeSetViewSize');
      },
      initialTryRunTics() {
        preLoopTrace.push('initialTryRunTics');
      },
      restoreBuffer() {
        preLoopTrace.push('restoreBuffer');
      },
      startGameLoop() {
        preLoopTrace.push('startGameLoop');
      },
    });
  }

  const frameCountBefore = loop.frameCount;
  let musicTrigger: LiveMusicTrigger | null = null;
  let soundTrigger: LiveSoundTrigger | null = null;

  loop.runOneFrame({
    display() {
      phaseTrace.push('display');
    },
    startFrame() {
      phaseTrace.push('startFrame');
    },
    tryRunTics() {
      phaseTrace.push('tryRunTics');
    },
    updateSounds() {
      phaseTrace.push('updateSounds');
      musicTrigger = createMusicTrigger(options.session);
      soundTrigger = createSoundTrigger(options.session);
    },
  });

  if (musicTrigger === null || soundTrigger === null) {
    throw new Error('Live sound/music triggers were not emitted during updateSounds.');
  }

  return {
    command: WIRE_LIVE_SOUND_MUSIC_TRIGGERS_COMMAND_CONTRACT.command,
    frameCountAfter: loop.frameCount,
    frameCountBefore,
    musicTrigger,
    phaseTrace,
    preLoopTrace,
    soundTrigger,
  };
}

function createMusicTrigger(session: LiveSoundMusicTriggerSession): LiveMusicTrigger {
  const mapName = session.mapName.toUpperCase();

  if (!/^E\dM\d$/.test(mapName)) {
    throw new RangeError(`No episode-map music trigger is defined for ${session.mapName}.`);
  }

  return {
    kind: 'start-level-music',
    lumpName: `D_${mapName}`,
    mapName,
    phase: 'updateSounds',
    tic: session.levelTime,
  };
}

function createSoundTrigger(session: LiveSoundMusicTriggerSession): LiveSoundTrigger {
  const listenerMapObject = session.player.mo;

  return {
    angle: listenerMapObject?.angle ?? null,
    kind: 'update-listener-sounds',
    listenerActive: listenerMapObject !== null,
    listenerX: listenerMapObject?.x ?? null,
    listenerY: listenerMapObject?.y ?? null,
    phase: 'updateSounds',
    tic: session.levelTime,
    view: session.showAutomap ? 'automap' : 'gameplay',
  };
}

function validateRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== WIRE_LIVE_SOUND_MUSIC_TRIGGERS_COMMAND_CONTRACT.command) {
    throw new Error(`wireLiveSoundMusicTriggers requires bun run doom.ts, got ${runtimeCommand}`);
  }
}
