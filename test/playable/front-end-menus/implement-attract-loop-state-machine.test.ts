import { expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import {
  completeAttractLoopDemo,
  IMPLEMENT_ATTRACT_LOOP_STATE_MACHINE_CONTRACT,
  implementAttractLoopStateMachine,
  syncAttractLoopMenuState,
  tickAttractLoopStateMachine,
} from '../../../src/playable/front-end-menus/implementAttractLoopStateMachine.ts';

interface LaunchAuditManifest {
  readonly audit: {
    readonly stepId: string;
  };
  readonly currentLauncher: {
    readonly launchMode: string;
    readonly menuStartImplemented: boolean;
  };
  readonly explicitNullSurfaces: ReadonlyArray<{
    readonly reason: string;
    readonly surface: string;
  }>;
}

function isLaunchAuditManifest(value: unknown): value is LaunchAuditManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    audit?: unknown;
    currentLauncher?: unknown;
    explicitNullSurfaces?: unknown;
  };

  if (typeof candidate.audit !== 'object' || candidate.audit === null) {
    return false;
  }

  if (typeof candidate.currentLauncher !== 'object' || candidate.currentLauncher === null) {
    return false;
  }

  if (!Array.isArray(candidate.explicitNullSurfaces)) {
    return false;
  }

  const audit = candidate.audit as { stepId?: unknown };
  const currentLauncher = candidate.currentLauncher as {
    launchMode?: unknown;
    menuStartImplemented?: unknown;
  };

  return (
    typeof audit.stepId === 'string' &&
    typeof currentLauncher.launchMode === 'string' &&
    typeof currentLauncher.menuStartImplemented === 'boolean' &&
    candidate.explicitNullSurfaces.every((surface) => {
      if (typeof surface !== 'object' || surface === null) {
        return false;
      }

      const typedSurface = surface as {
        reason?: unknown;
        surface?: unknown;
      };

      return typeof typedSurface.reason === 'string' && typeof typedSurface.surface === 'string';
    })
  );
}

test('locks the exact Bun-only attract-loop contract', () => {
  expect(IMPLEMENT_ATTRACT_LOOP_STATE_MACHINE_CONTRACT).toEqual({
    auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
    demoCompletionRequiresNextTick: true,
    initialPageLump: 'TITLEPIC',
    menuStartsInactive: true,
    pageTickerRunsWhileMenuActive: true,
    runtimeCommand: 'bun run doom.ts',
    sequenceDriverPath: 'src/ui/frontEndSequence.ts',
    transitionKinds: ['idle', 'playDemo', 'showPage'],
  });
  expect(Object.isFrozen(IMPLEMENT_ATTRACT_LOOP_STATE_MACHINE_CONTRACT)).toBe(true);
  expect(Object.isFrozen(IMPLEMENT_ATTRACT_LOOP_STATE_MACHINE_CONTRACT.transitionKinds)).toBe(true);

  const contractHash = createHash('sha256').update(JSON.stringify(IMPLEMENT_ATTRACT_LOOP_STATE_MACHINE_CONTRACT)).digest('hex');

  expect(contractHash).toBe('a33a2dcca33de17f867f49420709100d52cb3668840752671220f1939ed3e525');
});

test('turns the 01-008 gameplay-first audit gap into a clean-launch TITLEPIC attract state', async () => {
  const parsedAuditManifest: unknown = JSON.parse(await Bun.file('plan_fps/manifests/01-008-audit-missing-launch-to-menu.json').text());

  expect(isLaunchAuditManifest(parsedAuditManifest)).toBe(true);
  if (!isLaunchAuditManifest(parsedAuditManifest)) {
    throw new Error('Expected a valid 01-008 launch audit manifest.');
  }

  expect(parsedAuditManifest.audit.stepId).toBe('01-008');
  expect(parsedAuditManifest.currentLauncher.launchMode).toBe('gameplay-first');
  expect(parsedAuditManifest.currentLauncher.menuStartImplemented).toBe(false);
  expect(parsedAuditManifest.explicitNullSurfaces.map(({ surface }) => surface)).toContain('launch-to-menu-transition');
  expect(parsedAuditManifest.explicitNullSurfaces.map(({ surface }) => surface)).toContain('first-visible-main-menu-state');

  const { initialTransition, stateMachine } = implementAttractLoopStateMachine({
    gameMode: 'shareware',
    runtimeCommand: 'bun run doom.ts',
  });

  expect(initialTransition).toEqual({
    kind: 'showPage',
    snapshot: {
      inDemoPlayback: false,
      menuActive: false,
      presentation: {
        kind: 'page',
        lumpName: 'TITLEPIC',
        musicLump: 'D_INTRO',
        pagetic: 170,
      },
    },
  });
  expect(stateMachine.menuState.active).toBe(false);
});

test('keeps the attract loop advancing while the menu overlay is active', () => {
  const { stateMachine } = implementAttractLoopStateMachine({
    gameMode: 'shareware',
    runtimeCommand: 'bun run doom.ts',
  });

  syncAttractLoopMenuState(stateMachine, true);

  let transition: ReturnType<typeof tickAttractLoopStateMachine> | null = null;

  for (let tickIndex = 0; tickIndex < 172; tickIndex++) {
    const currentTransition = tickAttractLoopStateMachine(stateMachine);
    if (currentTransition.kind !== 'idle') {
      transition = currentTransition;
    }
  }

  expect(transition).not.toBeNull();
  if (transition === null) {
    throw new Error('Expected the attract loop to reach DEMO1 while the menu is active.');
  }

  expect(transition).toEqual({
    kind: 'playDemo',
    snapshot: {
      inDemoPlayback: true,
      menuActive: true,
      presentation: {
        demoLump: 'DEMO1',
        kind: 'demo',
      },
    },
  });
});

test('waits for the next tick to advance after demo completion', () => {
  const { stateMachine } = implementAttractLoopStateMachine({
    gameMode: 'shareware',
    runtimeCommand: 'bun run doom.ts',
  });

  for (let tickIndex = 0; tickIndex < 172; tickIndex++) {
    void tickAttractLoopStateMachine(stateMachine);
  }

  completeAttractLoopDemo(stateMachine);

  expect(tickAttractLoopStateMachine(stateMachine)).toEqual({
    kind: 'showPage',
    snapshot: {
      inDemoPlayback: false,
      menuActive: false,
      presentation: {
        kind: 'page',
        lumpName: 'CREDIT',
        musicLump: null,
        pagetic: 200,
      },
    },
  });
});

test('rejects the wrong Bun runtime command', () => {
  expect(() =>
    implementAttractLoopStateMachine({
      gameMode: 'shareware',
      runtimeCommand: 'bun run src/main.ts',
    }),
  ).toThrow('Expected runtime command "bun run doom.ts", received "bun run src/main.ts".');
});

test('rejects demo completion when no attract-loop demo is active', () => {
  const { stateMachine } = implementAttractLoopStateMachine({
    gameMode: 'shareware',
    runtimeCommand: 'bun run doom.ts',
  });

  expect(() => completeAttractLoopDemo(stateMachine)).toThrow('Cannot complete an attract-loop demo when no demo is active.');
});
