import type { GameplayRenderContext } from '../../launcher/gameplayRenderer.ts';
import { renderGameplayFrame } from '../../launcher/gameplayRenderer.ts';
import { DetailMode, SCREENHEIGHT, SCREENWIDTH, computeViewport } from '../../render/projection.ts';

export const RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-012-audit-missing-live-rendering.json';
export const RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_RUNTIME_COMMAND = 'bun run doom.ts';

export interface FullFrameViewportEvidence {
  readonly scaledViewWidth: number;
  readonly viewHeight: number;
  readonly viewWidth: number;
  readonly viewWindowX: number;
  readonly viewWindowY: number;
}

export interface RenderFullFrameEveryVisibleTicContext {
  readonly framebuffer: Uint8Array;
  readonly renderFullFrame: (framebuffer: Uint8Array) => Uint8Array;
  readonly runtimeCommand: string;
  readonly visibleTic: number;
}

export interface RenderFullFrameEveryVisibleTicEvidence {
  readonly auditManifestPath: string;
  readonly framebufferLength: number;
  readonly firstPixel: number;
  readonly lastPixel: number;
  readonly middlePixel: number;
  readonly renderedVisibleTic: number;
  readonly rendererInvocationCount: number;
  readonly runtimeCommand: string;
  readonly viewport: FullFrameViewportEvidence;
}

export interface RenderGameplayFullFrameEveryVisibleTicContext extends GameplayRenderContext {
  readonly runtimeCommand: string;
  readonly visibleTic: number;
}

export function renderFullFrameEveryVisibleTic(context: RenderFullFrameEveryVisibleTicContext): RenderFullFrameEveryVisibleTicEvidence {
  assertRuntimeCommand(context.runtimeCommand);
  assertVisibleTic(context.visibleTic);
  assertFullFrameFramebuffer(context.framebuffer);

  const viewport = computeViewport(11, DetailMode.high);
  let rendererInvocationCount = 0;

  const renderedFramebuffer = context.renderFullFrame(context.framebuffer);
  rendererInvocationCount += 1;

  if (renderedFramebuffer !== context.framebuffer) {
    throw new Error('render full frame every visible tic must reuse the provided framebuffer');
  }

  assertFullFrameFramebuffer(renderedFramebuffer);

  return {
    auditManifestPath: RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_AUDIT_MANIFEST_PATH,
    framebufferLength: renderedFramebuffer.length,
    firstPixel: renderedFramebuffer[0]!,
    lastPixel: renderedFramebuffer[renderedFramebuffer.length - 1]!,
    middlePixel: renderedFramebuffer[(renderedFramebuffer.length / 2) | 0]!,
    renderedVisibleTic: context.visibleTic,
    rendererInvocationCount,
    runtimeCommand: RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_RUNTIME_COMMAND,
    viewport: {
      scaledViewWidth: viewport.scaledViewWidth,
      viewHeight: viewport.viewHeight,
      viewWidth: viewport.viewWidth,
      viewWindowX: viewport.viewWindowX,
      viewWindowY: viewport.viewWindowY,
    },
  };
}

export function renderGameplayFullFrameEveryVisibleTic(context: RenderGameplayFullFrameEveryVisibleTicContext): RenderFullFrameEveryVisibleTicEvidence {
  return renderFullFrameEveryVisibleTic({
    framebuffer: context.framebuffer,
    renderFullFrame: () => renderGameplayFrame(context),
    runtimeCommand: context.runtimeCommand,
    visibleTic: context.visibleTic,
  });
}

function assertFullFrameFramebuffer(framebuffer: Uint8Array): void {
  const expectedLength = SCREENWIDTH * SCREENHEIGHT;

  if (framebuffer.length !== expectedLength) {
    throw new RangeError(`full-frame rendering requires a ${expectedLength}-byte framebuffer`);
  }
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_RUNTIME_COMMAND) {
    throw new Error(`render full frame every visible tic requires ${RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_RUNTIME_COMMAND}`);
  }
}

function assertVisibleTic(visibleTic: number): void {
  if (!Number.isSafeInteger(visibleTic) || visibleTic < 0) {
    throw new RangeError('visible tic must be a non-negative safe integer');
  }
}
