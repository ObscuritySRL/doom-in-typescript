import { computeClientDimensions, SCREENHEIGHT, SCREENWIDTH } from '../../host/windowPolicy.ts';

const DEFAULT_PRESENTATION_CLIENT_DIMENSIONS = computeClientDimensions(2, true);

export interface PreventHostFilteringOptions {
  readonly runtimeCommand: string;
}

export const PREVENT_HOST_FILTERING_CONTRACT = Object.freeze({
  auditStepId: '01-006',
  deterministicReplayCompatibility: 'Presentation-only stretch-mode policy; no gameplay timing, input, or simulation state changes.',
  filterPolicy: Object.freeze({
    applyToBlits: Object.freeze(['background-fill', 'gameplay-frame']),
    filteredStretchingAllowed: false,
    liveStretchApi: 'StretchDIBits',
    stretchMode: 'COLORONCOLOR',
  }),
  hostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  launcherSourcePath: 'src/launcher/win32.ts',
  liveSourceRequirements: Object.freeze({
    forbiddenFilterTokens: Object.freeze(['HALFTONE', 'SetStretchBltMode']),
    requiredBlitTokens: Object.freeze([
      'void gdi32.StretchDIBits(deviceContext, 0, 0, clientWidth, clientHeight, 0, 0, 1, 1, backgroundFillBytes.ptr, backgroundFillHeader.ptr, DIB_RGB_COLORS, SRCCOPY);',
      'void gdi32.StretchDIBits(deviceContext, presentationRect.x, presentationRect.y, presentationRect.width, presentationRect.height, 0, 0, SCREENWIDTH, SCREENHEIGHT, indexedFrameBytes.ptr, indexedFrameHeader.ptr, DIB_RGB_COLORS, SRCCOPY);',
    ]),
  }),
  presentation: Object.freeze({
    defaultClientHeight: DEFAULT_PRESENTATION_CLIENT_DIMENSIONS.height,
    defaultClientWidth: DEFAULT_PRESENTATION_CLIENT_DIMENSIONS.width,
    framebufferHeight: SCREENHEIGHT,
    framebufferWidth: SCREENWIDTH,
  }),
  runtimeCommand: 'bun run doom.ts',
  stepId: '04-013',
  stepTitle: 'prevent-host-filtering',
  windowPolicySourcePath: 'src/host/windowPolicy.ts',
} as const);

export type PreventHostFilteringPlan = typeof PREVENT_HOST_FILTERING_CONTRACT;

/**
 * Return the Bun-runtime-only host filtering contract for windowed presentation.
 *
 * @param options - Runtime command to validate.
 * @returns Frozen prevent-host-filtering contract.
 *
 * @example
 * ```ts
 * const contract = preventHostFiltering({ runtimeCommand: 'bun run doom.ts' });
 * console.log(contract.filterPolicy.stretchMode);
 * ```
 */
export function preventHostFiltering(options: PreventHostFilteringOptions): PreventHostFilteringPlan {
  if (options.runtimeCommand !== PREVENT_HOST_FILTERING_CONTRACT.runtimeCommand) {
    throw new Error(`preventHostFiltering requires runtime command \`${PREVENT_HOST_FILTERING_CONTRACT.runtimeCommand}\`.`);
  }

  return PREVENT_HOST_FILTERING_CONTRACT;
}
