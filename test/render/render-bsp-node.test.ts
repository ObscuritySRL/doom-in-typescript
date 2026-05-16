/**
 * Increment parity tests for the assembled-renderer faithful
 * `R_RenderBSPNode` walk (recursion + `rCheckBBox` back-side cull).
 *
 * Rigor bar mirrors I1-I4: the visit sequence is checked against a
 * STRUCTURALLY DISTINCT in-test re-transcription of r_bsp.c
 * `R_RenderBSPNode` over constructed BSP trees and clip states, plus
 * the degenerate empty-tree case and the defining cull property
 * (occluding the view prunes far subtrees — visited ⊆ the no-cull
 * visit set, never a superset, order-preserving).
 */

import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { NF_SUBSECTOR } from '../../src/map/bspStructs.ts';
import type { MapNode } from '../../src/map/bspStructs.ts';
import { pointOnSide } from '../../src/map/nodeTraversal.ts';
import { DetailMode, computeViewport } from '../../src/render/projection.ts';
import { buildProjectionAngleTables } from '../../src/render/renderInitTables.ts';
import { clearClipSegs, clipSolidWallSegment } from '../../src/render/solidSegs.ts';
import type { ClipState } from '../../src/render/solidSegs.ts';
import { rCheckBBox } from '../../src/render/checkBBox.ts';
import type { CheckBBoxView } from '../../src/render/checkBBox.ts';
import { renderBspNode } from '../../src/render/renderBspNode.ts';
import type { RenderBspScene } from '../../src/render/renderBspNode.ts';

const viewport = computeViewport(11, DetailMode.high);
const angleTables = buildProjectionAngleTables(viewport);
const view: CheckBBoxView = { viewx: 0, viewy: 0, viewangle: 0, clipangle: angleTables.clipangle, viewangletox: angleTables.viewangletox };

const leaf = (subIndex: number): number => (subIndex | NF_SUBSECTOR) >>> 0;
type Box4 = readonly [number, number, number, number]; // [top, bottom, left, right]
// Boxes placed ahead (+x) within the frustum so rCheckBBox passes when
// the clip list is empty.
const aheadBox = (centerX: number): Box4 => [64 * FRACUNIT, -64 * FRACUNIT, centerX - 16 * FRACUNIT, centerX + 16 * FRACUNIT];

function node(x: number, dy: number, child0: number, child1: number, bbox0: Box4, bbox1: Box4): MapNode {
  return { x: x * FRACUNIT, y: 0, dx: 0, dy, bbox: [bbox0, bbox1], children: [child0, child1] };
}

// nodes[0]: vertical partition at x=64; viewpoint (0,0): x<=64 & dy>0 → side 1.
// nodes[1] (root): vertical partition at x=-32; viewpoint (0,0): x>-32 & dy>0 → side 0 → near child = nodes[0].
const nodes: MapNode[] = [node(64, FRACUNIT, leaf(0), leaf(1), aheadBox(160 * FRACUNIT), aheadBox(176 * FRACUNIT)), node(-32, FRACUNIT, 0, leaf(2), aheadBox(144 * FRACUNIT), aheadBox(208 * FRACUNIT))];
const scene: RenderBspScene = { nodes, subsectorCount: 3 };

// Structurally distinct re-transcription of r_bsp.c R_RenderBSPNode.
function oracle(s: RenderBspScene, v: CheckBBoxView, state: ClipState): number[] {
  const out: number[] = [];
  const walk = (bspnum: number): void => {
    if ((bspnum & NF_SUBSECTOR) !== 0) {
      out.push(bspnum === -1 ? 0 : bspnum & ~NF_SUBSECTOR);
      return;
    }
    const bsp = s.nodes[bspnum]!;
    const sd = pointOnSide(v.viewx, v.viewy, bsp);
    const fd = sd === 0 ? 1 : 0;
    walk(bsp.children[sd]!);
    if (rCheckBBox(bsp.bbox[fd] as Box4, v, state)) {
      walk(bsp.children[fd]!);
    }
  };
  if (s.nodes.length === 0) {
    if (s.subsectorCount > 0) out.push(0);
    return out;
  }
  walk(s.nodes.length - 1);
  return out;
}

function visit(s: RenderBspScene, v: CheckBBoxView, state: ClipState): number[] {
  const got: number[] = [];
  renderBspNode(s, v, state, (i) => got.push(i));
  return got;
}

describe('R_RenderBSPNode', () => {
  test('empty nodes visits subsector 0 when one exists, nothing otherwise', () => {
    expect(visit({ nodes: [], subsectorCount: 1 }, view, clearClipSegs(viewport.viewWidth))).toEqual([0]);
    expect(visit({ nodes: [], subsectorCount: 0 }, view, clearClipSegs(viewport.viewWidth))).toEqual([]);
  });

  test('no-cull walk (empty clip list) matches the independent re-transcription and is full front-to-back', () => {
    const state = clearClipSegs(viewport.viewWidth);
    const got = visit(scene, view, state);
    // Independent oracle uses a FRESH clip state (renderBspNode does
    // not mutate it itself; the visitor would).
    expect(got).toEqual(oracle(scene, view, clearClipSegs(viewport.viewWidth)));
    // Front-to-back: root side 0 → recurse nodes[0] first; nodes[0]
    // side 1 → leaf(1) then leaf(0); then root far → leaf(2).
    expect(got).toEqual([1, 0, 2]);
  });

  test('occluding the whole view culls every far subtree (visited is a prefix-subset)', () => {
    const open = visit(scene, view, clearClipSegs(viewport.viewWidth));
    const occluded = clearClipSegs(viewport.viewWidth);
    clipSolidWallSegment(occluded, 0, viewport.viewWidth - 1, () => {});
    const culled = visit(scene, view, occluded);
    // Cull only ever removes far children — the survivors are a subset
    // of the open walk, in the same relative order, and strictly
    // fewer once the view is fully occluded.
    expect(culled.length).toBeLessThan(open.length);
    for (const s of culled) {
      expect(open).toContain(s);
    }
    expect(culled).toEqual(
      oracle(
        scene,
        view,
        (() => {
          const st = clearClipSegs(viewport.viewWidth);
          clipSolidWallSegment(st, 0, viewport.viewWidth - 1, () => {});
          return st;
        })(),
      ),
    );
  });

  test('matches the re-transcription over varied viewpoints and partial occlusion', () => {
    for (const vx of [-128 * FRACUNIT, 0, 96 * FRACUNIT]) {
      for (const occl of [null, [0, 100] as const, [120, 220] as const]) {
        const v: CheckBBoxView = { ...view, viewx: vx };
        const mkState = (): ClipState => {
          const st = clearClipSegs(viewport.viewWidth);
          if (occl) clipSolidWallSegment(st, occl[0], occl[1], () => {});
          return st;
        };
        expect(visit(scene, v, mkState())).toEqual(oracle(scene, v, mkState()));
      }
    }
  });
});
