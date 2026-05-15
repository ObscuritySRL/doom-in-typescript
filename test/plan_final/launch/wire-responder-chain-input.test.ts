import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { VANILLA_RESPONDER_COUNT, VANILLA_RESPONDER_ORDER, routeEventThroughResponderChain } from '../../../src/vanilla/responderChain.ts';
import type { VanillaResponder } from '../../../src/vanilla/responderChain.ts';
import type { VanillaEvent } from '../../../src/vanilla/eventQueue.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const RESPONDER_CHAIN_RELATIVE_PATH = 'src/vanilla/responderChain.ts';
const RESPONDER_CHAIN_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, RESPONDER_CHAIN_RELATIVE_PATH);

const SAMPLE_EVENT: VanillaEvent = Object.freeze({ data1: 27, data2: 0, data3: 0, type: 'ev_keydown' });

function makeRecordingResponder(label: string, consume: boolean, invocations: string[]): VanillaResponder {
  return (event: VanillaEvent): boolean => {
    invocations.push(label);
    void event;
    return consume;
  };
}

describe('plan_final launch: wire-responder-chain-input', () => {
  test('src/vanilla/responderChain.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(RESPONDER_CHAIN_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(RESPONDER_CHAIN_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/responderChain.ts cites plan_final step 03-007 in the top-of-file comment', () => {
    const fileText = readFileSync(RESPONDER_CHAIN_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('03-007');
    expect(fileText).toContain('routeEventThroughResponderChain');
  });

  test('VANILLA_RESPONDER_ORDER pins the canonical four-position chain (M_Responder, AM_Responder, F_Responder, G_Responder)', () => {
    expect(VANILLA_RESPONDER_ORDER).toEqual(['M_Responder', 'AM_Responder', 'F_Responder', 'G_Responder']);
    expect(VANILLA_RESPONDER_COUNT).toBe(4);
  });

  test('routeEventThroughResponderChain invokes every responder in canonical order when none consume the event', () => {
    const invocations: string[] = [];
    const responders = VANILLA_RESPONDER_ORDER.map((label) => makeRecordingResponder(label, false, invocations));
    const result = routeEventThroughResponderChain(SAMPLE_EVENT, responders);
    expect(result.consumedByIndex).toBeNull();
    expect(result.consumedByName).toBeNull();
    expect(result.callOrder).toEqual(['M_Responder', 'AM_Responder', 'F_Responder', 'G_Responder']);
    expect(invocations).toEqual(['M_Responder', 'AM_Responder', 'F_Responder', 'G_Responder']);
  });

  test('routeEventThroughResponderChain stops at M_Responder when it consumes the event', () => {
    const invocations: string[] = [];
    const responders: readonly VanillaResponder[] = [
      makeRecordingResponder('M_Responder', true, invocations),
      makeRecordingResponder('AM_Responder', false, invocations),
      makeRecordingResponder('F_Responder', false, invocations),
      makeRecordingResponder('G_Responder', false, invocations),
    ];
    const result = routeEventThroughResponderChain(SAMPLE_EVENT, responders);
    expect(result.consumedByIndex).toBe(0);
    expect(result.consumedByName).toBe('M_Responder');
    expect(result.callOrder).toEqual(['M_Responder']);
    expect(invocations).toEqual(['M_Responder']);
  });

  test('routeEventThroughResponderChain stops at AM_Responder when M_Responder declines and AM_Responder consumes', () => {
    const invocations: string[] = [];
    const responders: readonly VanillaResponder[] = [
      makeRecordingResponder('M_Responder', false, invocations),
      makeRecordingResponder('AM_Responder', true, invocations),
      makeRecordingResponder('F_Responder', false, invocations),
      makeRecordingResponder('G_Responder', false, invocations),
    ];
    const result = routeEventThroughResponderChain(SAMPLE_EVENT, responders);
    expect(result.consumedByIndex).toBe(1);
    expect(result.consumedByName).toBe('AM_Responder');
    expect(result.callOrder).toEqual(['M_Responder', 'AM_Responder']);
    expect(invocations).toEqual(['M_Responder', 'AM_Responder']);
  });

  test('routeEventThroughResponderChain stops at F_Responder when M and AM decline and F consumes', () => {
    const invocations: string[] = [];
    const responders: readonly VanillaResponder[] = [
      makeRecordingResponder('M_Responder', false, invocations),
      makeRecordingResponder('AM_Responder', false, invocations),
      makeRecordingResponder('F_Responder', true, invocations),
      makeRecordingResponder('G_Responder', false, invocations),
    ];
    const result = routeEventThroughResponderChain(SAMPLE_EVENT, responders);
    expect(result.consumedByIndex).toBe(2);
    expect(result.consumedByName).toBe('F_Responder');
    expect(result.callOrder).toEqual(['M_Responder', 'AM_Responder', 'F_Responder']);
  });

  test('routeEventThroughResponderChain stops at G_Responder when M, AM, and F decline and G consumes', () => {
    const invocations: string[] = [];
    const responders: readonly VanillaResponder[] = [
      makeRecordingResponder('M_Responder', false, invocations),
      makeRecordingResponder('AM_Responder', false, invocations),
      makeRecordingResponder('F_Responder', false, invocations),
      makeRecordingResponder('G_Responder', true, invocations),
    ];
    const result = routeEventThroughResponderChain(SAMPLE_EVENT, responders);
    expect(result.consumedByIndex).toBe(3);
    expect(result.consumedByName).toBe('G_Responder');
    expect(result.callOrder).toEqual(['M_Responder', 'AM_Responder', 'F_Responder', 'G_Responder']);
  });

  test('routeEventThroughResponderChain returns frozen result with frozen callOrder', () => {
    const invocations: string[] = [];
    const responders = VANILLA_RESPONDER_ORDER.map((label) => makeRecordingResponder(label, false, invocations));
    const result = routeEventThroughResponderChain(SAMPLE_EVENT, responders);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.callOrder)).toBe(true);
  });

  test('routeEventThroughResponderChain throws when responders array length is not exactly 4', () => {
    const invocations: string[] = [];
    const tooFew: readonly VanillaResponder[] = [makeRecordingResponder('M_Responder', false, invocations), makeRecordingResponder('AM_Responder', false, invocations), makeRecordingResponder('F_Responder', false, invocations)];
    let caughtError: unknown;
    try {
      routeEventThroughResponderChain(SAMPLE_EVENT, tooFew);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(Error);
  });

  test('routeEventThroughResponderChain passes the same event reference to every invoked responder', () => {
    const observedEvents: VanillaEvent[] = [];
    const sentinelEvent: VanillaEvent = Object.freeze({ data1: 1, data2: 0, data3: 0, type: 'ev_keyup' });
    const responders: readonly VanillaResponder[] = VANILLA_RESPONDER_ORDER.map(
      (): VanillaResponder => (incomingEvent) => {
        observedEvents.push(incomingEvent);
        return false;
      },
    );
    routeEventThroughResponderChain(sentinelEvent, responders);
    expect(observedEvents.length).toBe(VANILLA_RESPONDER_COUNT);
    for (let observationIndex = 0; observationIndex < observedEvents.length; observationIndex += 1) {
      expect(observedEvents[observationIndex]).toBe(sentinelEvent);
    }
  });
});
