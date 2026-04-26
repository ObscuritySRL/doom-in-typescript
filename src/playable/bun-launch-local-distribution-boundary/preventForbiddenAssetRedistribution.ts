export const FORBIDDEN_ASSET_REDISTRIBUTION_RULE = 'Do not embed, copy, package, or redistribute proprietary IWAD data or reference executable bytes.';
export const PRELAUNCH_DISTRIBUTION_POLICY_TRANSITION = 'prelaunch-distribution-policy-check';
export const PRODUCT_RUNTIME_COMMAND = 'bun run doom.ts';
export const STEP_IDENTIFIER = '14-005';

export type AssetRedistributionDisposition = 'blocked-forbidden-redistribution' | 'local-reference-only' | 'redistributable-product-code';

export type AssetRedistributionKind = 'engine-code' | 'proprietary-iwad' | 'reference-executable' | 'user-local-iwad';

export interface AssetRedistributionAssessment {
  disposition: AssetRedistributionDisposition;
  kind: AssetRedistributionKind;
  path: string;
  redistributesBytes: boolean;
  source: string;
}

export interface AssetRedistributionCandidate {
  kind: AssetRedistributionKind;
  path: string;
  redistributesBytes: boolean;
  source: string;
}

export interface PreventForbiddenAssetRedistributionEvidence {
  assetAssessments: ReadonlyArray<AssetRedistributionAssessment>;
  assetPolicyHash: string;
  blockedAssetPaths: ReadonlyArray<string>;
  command: typeof PRODUCT_RUNTIME_COMMAND;
  deterministicReplayCompatible: true;
  firstSimulationTic: 0;
  inputStreamMutation: 'none';
  randomSeedMutation: 'none';
  redistributionAllowed: true;
  runtime: 'Bun';
  stepIdentifier: typeof STEP_IDENTIFIER;
  transition: typeof PRELAUNCH_DISTRIBUTION_POLICY_TRANSITION;
}

export interface PreventForbiddenAssetRedistributionOptions {
  assetCandidates?: ReadonlyArray<AssetRedistributionCandidate>;
  runtimeCommand?: string;
}

export const LOCAL_DISTRIBUTION_ASSET_CANDIDATES: ReadonlyArray<AssetRedistributionCandidate> = Object.freeze([
  Object.freeze({
    kind: 'engine-code',
    path: 'doom.ts',
    redistributesBytes: true,
    source: 'workspace-product-entrypoint',
  }),
  Object.freeze({
    kind: 'user-local-iwad',
    path: 'doom\\DOOM1.WAD',
    redistributesBytes: false,
    source: 'user-local-reference',
  }),
  Object.freeze({
    kind: 'reference-executable',
    path: 'doom\\DOOM.EXE',
    redistributesBytes: false,
    source: 'local-reference-only',
  }),
]);

const FORBIDDEN_REDISTRIBUTABLE_ASSET_KINDS: ReadonlySet<AssetRedistributionKind> = new Set(['proprietary-iwad', 'reference-executable', 'user-local-iwad']);

/**
 * Verifies that the Bun product launch path does not redistribute forbidden local DOOM assets.
 *
 * @param options Optional command and asset candidates for focused launch-boundary checks.
 * @returns Frozen deterministic evidence for the prelaunch redistribution policy check.
 * @example
 * ```ts
 * const evidence = preventForbiddenAssetRedistribution();
 * console.log(evidence.command);
 * ```
 */
export function preventForbiddenAssetRedistribution(options: PreventForbiddenAssetRedistributionOptions = {}): PreventForbiddenAssetRedistributionEvidence {
  const runtimeCommand = options.runtimeCommand ?? PRODUCT_RUNTIME_COMMAND;

  if (runtimeCommand !== PRODUCT_RUNTIME_COMMAND) {
    throw new Error(`Expected ${PRODUCT_RUNTIME_COMMAND}, got ${runtimeCommand}.`);
  }

  const assetCandidates = options.assetCandidates ?? LOCAL_DISTRIBUTION_ASSET_CANDIDATES;
  const assetAssessments = Object.freeze(assetCandidates.map(assessAssetCandidate));
  const blockedAssetPaths = Object.freeze(assetAssessments.filter((assetAssessment) => assetAssessment.disposition === 'blocked-forbidden-redistribution').map((assetAssessment) => assetAssessment.path));

  if (blockedAssetPaths.length > 0) {
    throw new Error(`Forbidden asset redistribution detected: ${blockedAssetPaths.join(', ')}.`);
  }

  const assetPolicyHash = sha256Hex(
    JSON.stringify({
      assetAssessments,
      command: PRODUCT_RUNTIME_COMMAND,
      rule: FORBIDDEN_ASSET_REDISTRIBUTION_RULE,
      stepIdentifier: STEP_IDENTIFIER,
      transition: PRELAUNCH_DISTRIBUTION_POLICY_TRANSITION,
    }),
  );

  return Object.freeze({
    assetAssessments,
    assetPolicyHash,
    blockedAssetPaths,
    command: PRODUCT_RUNTIME_COMMAND,
    deterministicReplayCompatible: true,
    firstSimulationTic: 0,
    inputStreamMutation: 'none',
    randomSeedMutation: 'none',
    redistributionAllowed: true,
    runtime: 'Bun',
    stepIdentifier: STEP_IDENTIFIER,
    transition: PRELAUNCH_DISTRIBUTION_POLICY_TRANSITION,
  });
}

function assessAssetCandidate(assetCandidate: AssetRedistributionCandidate): AssetRedistributionAssessment {
  const disposition =
    assetCandidate.redistributesBytes && FORBIDDEN_REDISTRIBUTABLE_ASSET_KINDS.has(assetCandidate.kind) ? 'blocked-forbidden-redistribution' : assetCandidate.redistributesBytes ? 'redistributable-product-code' : 'local-reference-only';

  return Object.freeze({
    disposition,
    kind: assetCandidate.kind,
    path: assetCandidate.path,
    redistributesBytes: assetCandidate.redistributesBytes,
    source: assetCandidate.source,
  });
}

function sha256Hex(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}
