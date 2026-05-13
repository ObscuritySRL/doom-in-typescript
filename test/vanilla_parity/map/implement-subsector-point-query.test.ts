import { describe, expect, test } from 'bun:test';

import type { NodeLump } from '../../../src/map/parse-seg-ssector-node-reject-blockmap-lumps.ts';
import { isPointOnFrontOfPartition, queryPointSubsector } from '../../../src/map/implement-subsector-point-query.ts';

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

describe('isPointOnFrontOfPartition', () => {
  test('vertical partition (dx=0): point left of x with dy<0 is on front', () => {
    const node = makeNode({ x: 0, y: 0, dx: 0, dy: -1 });
    expect(isPointOnFrontOfPartition(node, -10, 0)).toBe(true);
    expect(isPointOnFrontOfPartition(node, 10, 0)).toBe(false);
  });

  test('horizontal partition (dy=0): point above y with dx<0 is on front', () => {
    const node = makeNode({ x: 0, y: 0, dx: -1, dy: 0 });
    expect(isPointOnFrontOfPartition(node, 0, 10)).toBe(true);
    expect(isPointOnFrontOfPartition(node, 0, -10)).toBe(false);
  });
});

describe('queryPointSubsector', () => {
  test('returns subsector 0 when nodes array is empty', () => {
    expect(queryPointSubsector({ nodes: [], pointX: 0, pointY: 0 })).toBe(0);
  });

  test('a one-node tree with subsector children routes by partition side', () => {
    const node = makeNode({ x: 0, y: 0, dx: -1, dy: 0, children: Object.freeze([0x8000, 0x8001] as const) });
    expect(queryPointSubsector({ nodes: [node], pointX: 0, pointY: 10 })).toBe(0);
    expect(queryPointSubsector({ nodes: [node], pointX: 0, pointY: -10 })).toBe(1);
  });
});
