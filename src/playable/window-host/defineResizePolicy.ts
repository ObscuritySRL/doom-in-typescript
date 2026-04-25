import { computeClientDimensions, computeScaleMultiplier } from '../../host/windowPolicy.ts';

const DEFAULT_CLIENT_AREA = Object.freeze({
  height: 480,
  width: 640,
});

const MINIMUM_CLIENT_AREA = Object.freeze({
  height: 240,
  width: 320,
});

export const DEFINE_RESIZE_POLICY_CONTRACT = {
  auditedHostTransition: {
    call: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
    liveClientAreaSource: 'GetClientRect(windowHandle, clientRectBuffer.ptr)',
    sourceWindowStyleHex: '0x10cf0000',
  },
  commandContracts: {
    currentLauncherCommand: 'bun run src/main.ts',
    targetRuntimeCommand: 'bun run doom.ts',
  },
  deterministicReplayCompatibility: {
    affectsGameplayState: false,
    affectsInputStream: false,
    affectsTickScheduling: false,
    scope: 'presentation-only',
  },
  resizePolicy: {
    aspectRatioCorrect: true,
    centersIntegerPresentationWithinClientArea: true,
    defaultClientArea: DEFAULT_CLIENT_AREA,
    minimumClientArea: MINIMUM_CLIENT_AREA,
    resizeSource: 'live-client-rect',
    scalingMode: 'integer-nearest-fit',
  },
  sourceEvidencePaths: ['plan_fps/manifests/01-006-audit-playable-host-surface.json', 'src/host/windowPolicy.ts', 'src/launcher/win32.ts'],
} as const;

export interface ResizePolicyDefinition {
  readonly appliedPresentationArea: Readonly<{ height: number; width: number }>;
  readonly appliedScaleMultiplier: number;
  readonly aspectRatioCorrect: true;
  readonly centeredOffset: Readonly<{ x: number; y: number }>;
  readonly deterministicReplayCompatible: true;
  readonly effectiveClientArea: Readonly<{ height: number; width: number }>;
  readonly requestedClientArea: Readonly<{ height: number; width: number }>;
  readonly runtimeCommand: string;
  readonly windowStyleHex: string;
}

export function defineResizePolicy(runtimeCommand: string, requestedClientWidth: number, requestedClientHeight: number): ResizePolicyDefinition {
  if (runtimeCommand !== DEFINE_RESIZE_POLICY_CONTRACT.commandContracts.targetRuntimeCommand) {
    throw new Error(`defineResizePolicy requires ${DEFINE_RESIZE_POLICY_CONTRACT.commandContracts.targetRuntimeCommand}; received ${runtimeCommand}`);
  }

  if (!Number.isFinite(requestedClientWidth) || !Number.isFinite(requestedClientHeight)) {
    throw new TypeError('requested client area must be finite pixel dimensions');
  }

  const requestedClientArea = Object.freeze({
    height: Math.trunc(requestedClientHeight),
    width: Math.trunc(requestedClientWidth),
  });

  const effectiveClientArea = Object.freeze({
    height: Math.max(requestedClientArea.height, DEFINE_RESIZE_POLICY_CONTRACT.resizePolicy.minimumClientArea.height),
    width: Math.max(requestedClientArea.width, DEFINE_RESIZE_POLICY_CONTRACT.resizePolicy.minimumClientArea.width),
  });

  const appliedScaleMultiplier = computeScaleMultiplier(effectiveClientArea.width, effectiveClientArea.height, DEFINE_RESIZE_POLICY_CONTRACT.resizePolicy.aspectRatioCorrect);
  const appliedPresentationArea = computeClientDimensions(appliedScaleMultiplier, DEFINE_RESIZE_POLICY_CONTRACT.resizePolicy.aspectRatioCorrect);
  const centeredOffset = Object.freeze({
    x: Math.max(0, Math.floor((effectiveClientArea.width - appliedPresentationArea.width) / 2)),
    y: Math.max(0, Math.floor((effectiveClientArea.height - appliedPresentationArea.height) / 2)),
  });

  return Object.freeze({
    appliedPresentationArea,
    appliedScaleMultiplier,
    aspectRatioCorrect: DEFINE_RESIZE_POLICY_CONTRACT.resizePolicy.aspectRatioCorrect,
    centeredOffset,
    deterministicReplayCompatible: true,
    effectiveClientArea,
    requestedClientArea,
    runtimeCommand,
    windowStyleHex: DEFINE_RESIZE_POLICY_CONTRACT.auditedHostTransition.sourceWindowStyleHex,
  });
}
