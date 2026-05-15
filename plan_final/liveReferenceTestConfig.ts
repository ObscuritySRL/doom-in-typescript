export const LIVE_REFERENCE_TEST_ENVIRONMENT_VARIABLE = 'DOOM_RUN_LIVE_REFERENCE_TESTS';

export const LIVE_REFERENCE_TEST_PATHS: readonly string[] = Object.freeze([
  'test/plan_final/oracle/capture-reference-audio-windows.test.ts',
  'test/plan_final/oracle/capture-reference-demo-sync.test.ts',
  'test/plan_final/oracle/capture-reference-e1m1-actions.test.ts',
  'test/plan_final/oracle/capture-reference-intermission-finale.test.ts',
  'test/plan_final/oracle/capture-reference-menu-route.test.ts',
  'test/plan_final/oracle/capture-reference-save-load.test.ts',
  'test/plan_final/oracle/capture-reference-title-frame.test.ts',
  'test/plan_final/oracle/launch-reference-cleanly.test.ts',
]);

const ENABLED_VALUES: ReadonlySet<string> = new Set(['1', 'on', 'true', 'yes']);

export function liveReferenceTestsEnabled(environment: Record<string, string | undefined> = Bun.env): boolean {
  const rawValue = environment[LIVE_REFERENCE_TEST_ENVIRONMENT_VARIABLE];
  if (rawValue === undefined) {
    return false;
  }

  return ENABLED_VALUES.has(rawValue.trim().toLowerCase());
}
