import { describe, expect, it } from 'bun:test';

import { REMOVED, ThinkerList, ThinkerNode } from '../../src/world/thinkers.ts';

import type { ThinkFunction } from '../../src/world/thinkers.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(action: ThinkFunction | null = null): ThinkerNode {
  const node = new ThinkerNode();
  node.action = action;
  return node;
}

function collectNodes(list: ThinkerList): ThinkerNode[] {
  const result: ThinkerNode[] = [];
  list.forEach((thinker) => result.push(thinker));
  return result;
}

// ---------------------------------------------------------------------------
// REMOVED sentinel
// ---------------------------------------------------------------------------

describe('REMOVED', () => {
  it('is a symbol', () => {
    expect(typeof REMOVED).toBe('symbol');
  });

  it('has a descriptive toString', () => {
    expect(REMOVED.toString()).toContain('REMOVED');
  });
});

// ---------------------------------------------------------------------------
// ThinkerNode
// ---------------------------------------------------------------------------

describe('ThinkerNode', () => {
  it('defaults to self-referencing prev and next', () => {
    const node = new ThinkerNode();
    expect(node.prev).toBe(node);
    expect(node.next).toBe(node);
  });

  it('defaults to null action', () => {
    const node = new ThinkerNode();
    expect(node.action).toBeNull();
  });

  it('accepts a ThinkFunction as action', () => {
    const node = new ThinkerNode();
    const fn: ThinkFunction = () => {};
    node.action = fn;
    expect(node.action).toBe(fn);
  });

  it('accepts REMOVED as action', () => {
    const node = new ThinkerNode();
    node.action = REMOVED;
    expect(node.action).toBe(REMOVED);
  });
});

// ---------------------------------------------------------------------------
// ThinkerList — construction and init
// ---------------------------------------------------------------------------

describe('ThinkerList', () => {
  describe('construction', () => {
    it('starts empty', () => {
      const list = new ThinkerList();
      expect(list.isEmpty).toBe(true);
    });
  });

  describe('init', () => {
    it('resets a populated list to empty', () => {
      const list = new ThinkerList();
      list.add(makeNode());
      list.add(makeNode());
      expect(list.isEmpty).toBe(false);
      list.init();
      expect(list.isEmpty).toBe(true);
    });

    it('orphans existing thinkers (they no longer appear in forEach)', () => {
      const list = new ThinkerList();
      const nodeA = makeNode();
      const nodeB = makeNode();
      list.add(nodeA);
      list.add(nodeB);
      list.init();
      expect(collectNodes(list)).toEqual([]);
    });

    it('allows new additions after reset', () => {
      const list = new ThinkerList();
      list.add(makeNode());
      list.init();
      const fresh = makeNode();
      list.add(fresh);
      expect(collectNodes(list)).toEqual([fresh]);
    });
  });

  // -------------------------------------------------------------------------
  // add
  // -------------------------------------------------------------------------

  describe('add', () => {
    it('makes the list non-empty', () => {
      const list = new ThinkerList();
      list.add(makeNode());
      expect(list.isEmpty).toBe(false);
    });

    it('inserts at the tail (FIFO order via forEach)', () => {
      const list = new ThinkerList();
      const nodeA = makeNode();
      const nodeB = makeNode();
      const nodeC = makeNode();
      list.add(nodeA);
      list.add(nodeB);
      list.add(nodeC);
      expect(collectNodes(list)).toEqual([nodeA, nodeB, nodeC]);
    });

    it('maintains circular links (last.next walks back to first)', () => {
      const list = new ThinkerList();
      const nodeA = makeNode();
      const nodeB = makeNode();
      list.add(nodeA);
      list.add(nodeB);
      // nodeA.prev is the sentinel, nodeB.next is the sentinel
      // So nodeA.prev === nodeB.next (both are the hidden sentinel)
      expect(nodeA.prev).toBe(nodeB.next);
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------

  describe('remove', () => {
    it('marks the thinker action as REMOVED', () => {
      const list = new ThinkerList();
      const node = makeNode(() => {});
      list.add(node);
      list.remove(node);
      expect(node.action).toBe(REMOVED);
    });

    it('does not unlink the node immediately', () => {
      const list = new ThinkerList();
      const nodeA = makeNode();
      const nodeB = makeNode();
      list.add(nodeA);
      list.add(nodeB);
      list.remove(nodeA);
      // nodeA is still linked — forEach still sees it
      expect(collectNodes(list).length).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // run — active thinkers
  // -------------------------------------------------------------------------

  describe('run', () => {
    it('calls actions in insertion order', () => {
      const list = new ThinkerList();
      const order: string[] = [];
      list.add(makeNode(() => order.push('A')));
      list.add(makeNode(() => order.push('B')));
      list.add(makeNode(() => order.push('C')));
      list.run();
      expect(order).toEqual(['A', 'B', 'C']);
    });

    it('passes the thinker node to its action', () => {
      const list = new ThinkerList();
      let received: ThinkerNode | null = null;
      const node = makeNode((thinker) => {
        received = thinker;
      });
      list.add(node);
      list.run();
      expect(received).not.toBeNull();
      expect(received === node).toBe(true);
    });

    it('skips null-action nodes without removing them', () => {
      const list = new ThinkerList();
      const nullNode = makeNode(null);
      const order: string[] = [];
      list.add(makeNode(() => order.push('before')));
      list.add(nullNode);
      list.add(makeNode(() => order.push('after')));
      list.run();
      expect(order).toEqual(['before', 'after']);
      // null-action node is still in the list
      expect(collectNodes(list)).toContain(nullNode);
    });

    it('unlinks REMOVED thinkers during run', () => {
      const list = new ThinkerList();
      const nodeA = makeNode(() => {});
      const nodeB = makeNode(() => {});
      list.add(nodeA);
      list.add(nodeB);
      list.remove(nodeA);
      list.run();
      expect(collectNodes(list)).toEqual([nodeB]);
    });

    it('does not call the action of a REMOVED thinker', () => {
      const list = new ThinkerList();
      let called = false;
      const node = makeNode(() => {
        called = true;
      });
      list.add(node);
      list.remove(node);
      list.run();
      expect(called).toBe(false);
    });

    it('handles an empty list without error', () => {
      const list = new ThinkerList();
      expect(() => list.run()).not.toThrow();
    });

    it('handles all thinkers removed', () => {
      const list = new ThinkerList();
      const nodeA = makeNode();
      const nodeB = makeNode();
      list.add(nodeA);
      list.add(nodeB);
      list.remove(nodeA);
      list.remove(nodeB);
      list.run();
      expect(list.isEmpty).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // parity: add during run is visited in the same tic
  // -------------------------------------------------------------------------

  describe('parity: add during run', () => {
    it("a thinker added by another's action IS visited in the same tic", () => {
      const list = new ThinkerList();
      const order: string[] = [];
      const spawned = makeNode(() => order.push('spawned'));

      list.add(
        makeNode(() => {
          order.push('spawner');
          list.add(spawned);
        }),
      );
      list.run();
      expect(order).toEqual(['spawner', 'spawned']);
    });

    it("a thinker added by the last node's action IS still visited", () => {
      const list = new ThinkerList();
      const order: string[] = [];
      const late = makeNode(() => order.push('late'));

      list.add(makeNode(() => order.push('first')));
      list.add(
        makeNode(() => {
          order.push('last');
          list.add(late);
        }),
      );
      list.run();
      expect(order).toEqual(['first', 'last', 'late']);
    });
  });

  // -------------------------------------------------------------------------
  // parity: self-removal during run
  // -------------------------------------------------------------------------

  describe('parity: self-removal during run', () => {
    it('a thinker that removes itself is not unlinked until the next run', () => {
      const list = new ThinkerList();
      const order: string[] = [];

      const selfRemover = makeNode((thinker) => {
        order.push('self');
        list.remove(thinker);
      });
      list.add(selfRemover);
      list.add(makeNode(() => order.push('after')));
      list.run();
      // Both actions ran this tic
      expect(order).toEqual(['self', 'after']);
      // selfRemover is still linked (marked REMOVED but not yet unlinked)
      expect(collectNodes(list).length).toBe(2);
      // Second run unlinks it
      list.run();
      expect(collectNodes(list).length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // parity: removing the next thinker during run
  // -------------------------------------------------------------------------

  describe('parity: removing next thinker during run', () => {
    it('a thinker that marks the next node REMOVED causes it to be unlinked when reached', () => {
      const list = new ThinkerList();
      const order: string[] = [];
      let victim: ThinkerNode;

      const killer = makeNode(() => {
        order.push('killer');
        list.remove(victim);
      });
      victim = makeNode(() => {
        order.push('victim');
      });

      list.add(killer);
      list.add(victim);
      list.add(makeNode(() => order.push('survivor')));
      list.run();
      // victim's action was NOT called (it was REMOVED before being reached)
      expect(order).toEqual(['killer', 'survivor']);
      expect(collectNodes(list)).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // forEach
  // -------------------------------------------------------------------------

  describe('forEach', () => {
    it('visits nodes in insertion order', () => {
      const list = new ThinkerList();
      const nodeA = makeNode();
      const nodeB = makeNode();
      list.add(nodeA);
      list.add(nodeB);
      const visited: ThinkerNode[] = [];
      list.forEach((thinker) => visited.push(thinker));
      expect(visited).toEqual([nodeA, nodeB]);
    });

    it('visits zero nodes on an empty list', () => {
      const list = new ThinkerList();
      let count = 0;
      list.forEach(() => count++);
      expect(count).toBe(0);
    });

    it('does not invoke actions', () => {
      const list = new ThinkerList();
      let called = false;
      list.add(
        makeNode(() => {
          called = true;
        }),
      );
      list.forEach(() => {});
      expect(called).toBe(false);
    });
  });
});
