import { createHash } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import { createFrontEndSequence, tickFrontEnd } from '../../../src/ui/frontEndSequence.ts';
import { createMenuState, MenuKind, openMenu } from '../../../src/ui/menus.ts';
import { PRESERVE_MENU_TIMING_IDLE_BEHAVIOR_RUNTIME_CONTRACT, preserveMenuTimingIdleBehavior } from '../../../src/playable/front-end-menus/preserveMenuTimingIdleBehavior.ts';

describe('preserveMenuTimingIdleBehavior', () => {
  test('exports the exact Bun-only runtime contract linked to audit 01-008', async () => {
    const auditManifest = JSON.parse(await Bun.file('plan_fps/manifests/01-008-audit-missing-launch-to-menu.json').text()) as {
      audit: { schemaVersion: number; stepId: string; title: string };
      commandContracts: {
        targetRuntime: {
          entryFile: string;
          program: string;
          subcommand: string;
          value: string;
        };
      };
    };

    expect(PRESERVE_MENU_TIMING_IDLE_BEHAVIOR_RUNTIME_CONTRACT).toEqual({
      audit: {
        schemaVersion: 1,
        stepId: '07-019',
        title: 'preserve-menu-timing-idle-behavior',
      },
      sourceAudit: {
        manifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
        stepId: '01-008',
        title: 'audit-missing-launch-to-menu',
      },
      targetRuntime: {
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
        value: 'bun run doom.ts',
      },
    });
    expect(auditManifest.audit.stepId).toBe(PRESERVE_MENU_TIMING_IDLE_BEHAVIOR_RUNTIME_CONTRACT.sourceAudit.stepId);
    expect(auditManifest.audit.title).toBe(PRESERVE_MENU_TIMING_IDLE_BEHAVIOR_RUNTIME_CONTRACT.sourceAudit.title);
    expect(auditManifest.commandContracts.targetRuntime).toEqual(PRESERVE_MENU_TIMING_IDLE_BEHAVIOR_RUNTIME_CONTRACT.targetRuntime);
    expect(auditManifest.audit.schemaVersion).toBe(1);
  });

  test('locks the source hash', async () => {
    const sourceText = await Bun.file('src/playable/front-end-menus/preserveMenuTimingIdleBehavior.ts').text();
    const sourceHash = createHash('sha256').update(sourceText).digest('hex');

    expect(sourceHash).toBe('6b8ce8a8dc8b6b69036a3c991a64acf36d8e7303f180528dd6677205278d3978');
  });

  test('keeps menu skull timing and front-end attract timing running during idle menu ticks', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const firstAction = tickFrontEnd(frontEndSequenceState);
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Main);

    expect(firstAction).toEqual({
      kind: 'showPage',
      lumpName: 'TITLEPIC',
      musicLump: 'D_INTRO',
      pagetic: 170,
    });

    let observedResult = preserveMenuTimingIdleBehavior({
      frontEndSequenceState,
      menuState,
      runtimeCommand: 'bun run doom.ts',
    });

    expect(observedResult).toEqual({
      frontEndAction: { kind: 'idle' },
      menuActive: true,
      skullAnimCounter: 7,
      whichSkull: 0,
    });

    for (let index = 1; index < 172; index++) {
      observedResult = preserveMenuTimingIdleBehavior({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run doom.ts',
      });
    }

    expect(observedResult).toEqual({
      frontEndAction: {
        demoLump: 'DEMO1',
        kind: 'playDemo',
      },
      menuActive: true,
      skullAnimCounter: 4,
      whichSkull: 1,
    });
    expect(frontEndSequenceState.inDemoPlayback).toBe(true);
  });

  test('rejects any runtime command other than bun run doom.ts', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    expect(() =>
      preserveMenuTimingIdleBehavior({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('Expected runtime command bun run doom.ts, received bun run src/main.ts');
  });
});
