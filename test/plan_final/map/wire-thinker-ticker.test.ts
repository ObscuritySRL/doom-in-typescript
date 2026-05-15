import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ThinkerList, ThinkerNode } from '../../../src/world/thinkers.ts';
import { runVanillaPTicker } from '../../../src/vanilla/wireThinkerTicker.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_THINKER_TICKER_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireThinkerTicker.ts');

describe('plan_final map: wire-thinker-ticker', () => {
  test('src/vanilla/wireThinkerTicker.ts exists and cites plan_final step 08-002', () => {
    expect(existsSync(WIRE_THINKER_TICKER_PATH)).toBe(true);
    expect(statSync(WIRE_THINKER_TICKER_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_THINKER_TICKER_PATH, 'utf8');
    expect(fileText).toContain('08-002');
    expect(fileText).toContain('runVanillaPTicker');
    expect(fileText).toContain("from '../world/thinkers.ts'");
  });

  test('runVanillaPTicker is exported as a function accepting (thinkerList)', () => {
    expect(typeof runVanillaPTicker).toBe('function');
    expect(runVanillaPTicker.length).toBe(1);
  });

  test('runVanillaPTicker invokes every live thinker action once per pass', () => {
    const list = new ThinkerList();
    list.init();
    const callCounts = [0, 0, 0];
    for (let nodeIndex = 0; nodeIndex < 3; nodeIndex += 1) {
      const node = new ThinkerNode();
      node.action = () => {
        callCounts[nodeIndex] += 1;
      };
      list.add(node);
    }
    runVanillaPTicker(list);
    expect(callCounts).toEqual([1, 1, 1]);
    runVanillaPTicker(list);
    expect(callCounts).toEqual([2, 2, 2]);
  });

  test('runVanillaPTicker does not invoke the action of a deferred-removed thinker, and unlinks it', () => {
    const list = new ThinkerList();
    list.init();
    let removedActionCalls = 0;
    const survivingNode = new ThinkerNode();
    let survivingCalls = 0;
    survivingNode.action = () => {
      survivingCalls += 1;
    };
    const doomedNode = new ThinkerNode();
    doomedNode.action = () => {
      removedActionCalls += 1;
    };
    list.add(survivingNode);
    list.add(doomedNode);
    list.remove(doomedNode);
    runVanillaPTicker(list);
    expect(removedActionCalls).toBe(0);
    expect(survivingCalls).toBe(1);
    runVanillaPTicker(list);
    expect(survivingCalls).toBe(2);
    expect(removedActionCalls).toBe(0);
  });

  test('runVanillaPTicker visits a thinker added during another thinker action in the same pass (vanilla same-tic insertion)', () => {
    const list = new ThinkerList();
    list.init();
    let lateNodeCalls = 0;
    const lateNode = new ThinkerNode();
    lateNode.action = () => {
      lateNodeCalls += 1;
    };
    const spawningNode = new ThinkerNode();
    let spawned = false;
    spawningNode.action = () => {
      if (!spawned) {
        spawned = true;
        list.add(lateNode);
      }
    };
    list.add(spawningNode);
    runVanillaPTicker(list);
    expect(lateNodeCalls).toBe(1);
  });

  test('runVanillaPTicker allows a thinker to remove itself from inside its own action (deferred unlink, no re-entrancy crash)', () => {
    const list = new ThinkerList();
    list.init();
    let selfRemovingCalls = 0;
    const selfRemovingNode = new ThinkerNode();
    selfRemovingNode.action = () => {
      selfRemovingCalls += 1;
      list.remove(selfRemovingNode);
    };
    list.add(selfRemovingNode);
    runVanillaPTicker(list);
    expect(selfRemovingCalls).toBe(1);
    runVanillaPTicker(list);
    expect(selfRemovingCalls).toBe(1);
    expect(list.isEmpty).toBe(true);
  });

  test('runVanillaPTicker on an empty thinker list is a no-op (no throw)', () => {
    const list = new ThinkerList();
    list.init();
    expect(() => runVanillaPTicker(list)).not.toThrow();
    expect(list.isEmpty).toBe(true);
  });
});
