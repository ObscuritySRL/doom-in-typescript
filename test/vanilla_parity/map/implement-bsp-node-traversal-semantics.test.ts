import { describe, expect, test } from 'bun:test';

import type { NodeLump } from '../../../src/map/parse-seg-ssector-node-reject-blockmap-lumps.ts';
import { traverseBspFrontToBack } from '../../../src/map/implement-bsp-node-traversal-semantics.ts';

function makeNode(props: Partial<NodeLump>): NodeLump {
  return Object.freeze({
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    boundingBoxes: Object.freeze([Object.freeze([0, 0, 0, 0] as const), Object.freeze([0, 0, 0, 0] as const)] as const),
    children: Object.freeze([0x8000, 0x8001] as const),
    ...props,
  });
}

describe('traverseBspFrontToBack', () => {
  test('empty node array yields no visits', () => {
    expect(traverseBspFrontToBack({ nodes: [], viewerX: 0, viewerY: 0 })).toEqual([]);
  });

  test('one-node tree visits front subsector before back subsector', () => {
    const node = makeNode({ x: 0, y: 0, dx: -1, dy: 0, children: Object.freeze([0x8000, 0x8001] as const) });
    const visits = traverseBspFrontToBack({ nodes: [node], viewerX: 0, viewerY: 10 });
    expect(visits[0]).toEqual({ kind: 'node-enter', index: 0 });
    expect(visits[1]).toEqual({ kind: 'subsector', index: 0 });
    expect(visits[2]).toEqual({ kind: 'subsector', index: 1 });
    expect(visits[3]).toEqual({ kind: 'node-leave', index: 0 });
  });

  test('viewer on back side flips order: back subsector first', () => {
    const node = makeNode({ x: 0, y: 0, dx: -1, dy: 0, children: Object.freeze([0x8000, 0x8001] as const) });
    const visits = traverseBspFrontToBack({ nodes: [node], viewerX: 0, viewerY: -10 });
    expect(visits[1]).toEqual({ kind: 'subsector', index: 1 });
    expect(visits[2]).toEqual({ kind: 'subsector', index: 0 });
  });
});
