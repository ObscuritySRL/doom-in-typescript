import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import * as quitEndoomFacade from '../../../src/vanilla/wireQuitAndEndoomUi.ts';
import { CANONICAL_QUIT_ORDER, CANONICAL_REGISTRATION_ORDER, CLEANUP_STEP_COUNT, QuitFlow, VANILLA_CLEAN_QUIT_INVARIANTS, parseEndoom, resolveQuitPlan, runQuitPlan } from '../../../src/vanilla/cleanQuitAndEndoom.ts';

import type { CleanupStepName, QuitTrigger } from '../../../src/vanilla/cleanQuitAndEndoom.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/cleanQuitAndEndoom.ts');
const CLEAN_TRIGGERS: readonly QuitTrigger[] = ['menuQuitConfirmed', 'normalQuit', 'windowClose'];

function populatedFlow(): QuitFlow {
  const flow = new QuitFlow();
  for (const registration of CANONICAL_REGISTRATION_ORDER) {
    flow.register(registration.name, registration.runOnError);
  }
  return flow;
}

describe('plan_final launch: wire-clean-quit-and-endoom', () => {
  test('src/vanilla/cleanQuitAndEndoom.ts exists, is a regular file, and cites plan_final step 03-009', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('03-009');
    expect(fileText).toContain('VANILLA_CLEAN_QUIT_INVARIANTS');
  });

  test('the facade routes its quit/ENDOOM surface only through the 07-010 facade, not the read-only modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]!);
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)]).toEqual(['./wireQuitAndEndoomUi.ts']);
  });

  test('VANILLA_CLEAN_QUIT_INVARIANTS pins the four launch-host quit/ENDOOM rules and is frozen', () => {
    expect(VANILLA_CLEAN_QUIT_INVARIANTS.length).toBe(4);
    expect(Object.isFrozen(VANILLA_CLEAN_QUIT_INVARIANTS)).toBe(true);
    const ids = VANILLA_CLEAN_QUIT_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['CLOSE_BUTTON_MAPS_TO_CLEAN_I_QUIT', 'ENDOOM_PRESENTED_ONLY_ON_CLEAN_QUIT', 'FATAL_ERROR_USES_ERROR_QUIT_AND_NONZERO_EXIT', 'MENU_QUIT_CONFIRMATION_ROUTES_TO_I_QUIT']);
    for (const invariant of VANILLA_CLEAN_QUIT_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('resolveQuitPlan collapses every clean-quit trigger onto the I_Quit path and diverges only for fatalError', () => {
    for (const trigger of CLEAN_TRIGGERS) {
      const plan = resolveQuitPlan(trigger);
      expect(plan).toEqual({ exitCode: 0, path: 'normal', showEndoom: true, usesErrorQuit: false });
      expect(Object.isFrozen(plan)).toBe(true);
    }
    const errorPlan = resolveQuitPlan('fatalError');
    expect(errorPlan).toEqual({ exitCode: 1, path: 'error', showEndoom: false, usesErrorQuit: true });
    expect(Object.isFrozen(errorPlan)).toBe(true);
  });

  test('runQuitPlan drains the full LIFO stack for clean triggers and the error drain for fatalError', () => {
    for (const trigger of CLEAN_TRIGGERS) {
      const executed: CleanupStepName[] = [];
      const { plan, executed: returned } = runQuitPlan(populatedFlow(), trigger, (name) => executed.push(name));
      expect(plan.path).toBe('normal');
      expect(executed).toEqual([...CANONICAL_QUIT_ORDER]);
      expect([...returned]).toEqual([...CANONICAL_QUIT_ORDER]);
      expect(executed.length).toBe(CLEANUP_STEP_COUNT);
    }

    const errorExecuted: CleanupStepName[] = [];
    const { plan: errorPlan, executed: errorReturned } = runQuitPlan(populatedFlow(), 'fatalError', (name) => errorExecuted.push(name));
    expect(errorPlan.usesErrorQuit).toBe(true);
    expect(errorPlan.showEndoom).toBe(false);
    // Every canonical registration sets runOnError true, so the error
    // drain still yields the full LIFO order per the read-only model.
    expect(errorExecuted).toEqual([...CANONICAL_QUIT_ORDER]);
    expect([...errorReturned]).toEqual([...CANONICAL_QUIT_ORDER]);
  });

  test('the re-exported quit/ENDOOM symbols are the SAME references as the 07-010 facade exports', () => {
    expect(QuitFlow).toBe(quitEndoomFacade.QuitFlow);
    expect(parseEndoom).toBe(quitEndoomFacade.parseEndoom);
    expect(CANONICAL_QUIT_ORDER).toBe(quitEndoomFacade.CANONICAL_QUIT_ORDER);
    expect(CANONICAL_REGISTRATION_ORDER).toBe(quitEndoomFacade.CANONICAL_REGISTRATION_ORDER);
    expect(CLEANUP_STEP_COUNT).toBe(quitEndoomFacade.CLEANUP_STEP_COUNT);
  });
});
