import { EMPTY_TICCMD, TICCMD_SIZE } from '../../input/ticcmd.ts';
import { extractScanCode, isExtendedKey, translateScanCode } from '../../input/keyboard.ts';

const BUN_RUNTIME_COMMAND = 'bun run doom.ts';
const MAXIMUM_CONFIGURED_SCAN_CODE = 0x7f;

export const PRESERVE_SCAN_CODE_CONFIG_RELATIONSHIP_CONTRACT = Object.freeze({
  auditManifest: Object.freeze({
    path: 'plan_fps/manifests/01-010-audit-missing-live-input.json',
    stepId: '01-010',
    surface: 'key-translation-table',
  }),
  configBindingAuthority: Object.freeze({
    bindingUnit: 'hardware-scan-code',
    eventScanCodeSource: 'extractScanCode(lparam)',
    extendedKeyBehavior: 'Ignore the Win32 extended flag when matching configured scan codes.',
    translationSource: 'translateScanCode(lparam)',
  }),
  deterministicReplayAuthority: Object.freeze({
    neutralTicCommand: EMPTY_TICCMD,
    ticCommandSize: TICCMD_SIZE,
    ticMutation: 'none',
  }),
  runtimeCommand: BUN_RUNTIME_COMMAND,
  stepId: '06-003',
  stepTitle: 'preserve-scan-code-config-relationship',
} as const);

export interface PreserveScanCodeConfigRelationshipInput {
  readonly configuredScanCode: number;
  readonly lparam: number;
  readonly runtimeCommand: string;
}

export interface PreserveScanCodeConfigRelationshipResult {
  readonly configuredScanCode: number;
  readonly doomKey: number;
  readonly eventScanCode: number;
  readonly extendedKey: boolean;
  readonly matchesConfiguredScanCode: boolean;
  readonly neutralTicCommand: typeof EMPTY_TICCMD;
}

export function preserveScanCodeConfigRelationship(input: PreserveScanCodeConfigRelationshipInput): PreserveScanCodeConfigRelationshipResult {
  if (input.runtimeCommand !== BUN_RUNTIME_COMMAND) {
    throw new Error('preserveScanCodeConfigRelationship requires bun run doom.ts');
  }

  if (!Number.isInteger(input.configuredScanCode) || input.configuredScanCode < 0 || input.configuredScanCode > MAXIMUM_CONFIGURED_SCAN_CODE) {
    throw new RangeError('Configured scan code must be an integer between 0 and 127.');
  }

  const eventScanCode = extractScanCode(input.lparam);

  return Object.freeze({
    configuredScanCode: input.configuredScanCode,
    doomKey: translateScanCode(input.lparam),
    eventScanCode,
    extendedKey: isExtendedKey(input.lparam),
    matchesConfiguredScanCode: eventScanCode === input.configuredScanCode,
    neutralTicCommand: EMPTY_TICCMD,
  });
}
