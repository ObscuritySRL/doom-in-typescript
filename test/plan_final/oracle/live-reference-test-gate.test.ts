import { describe, expect, test } from 'bun:test';

import { LIVE_REFERENCE_TEST_ENVIRONMENT_VARIABLE, LIVE_REFERENCE_TEST_PATHS, liveReferenceTestsEnabled } from '../../../plan_final/liveReferenceTestConfig.ts';

describe('plan_final oracle live reference test gate', () => {
  test('live reference capture tests are disabled by default for ordinary bun test runs', () => {
    expect(liveReferenceTestsEnabled({})).toBe(false);
    expect(liveReferenceTestsEnabled({ [LIVE_REFERENCE_TEST_ENVIRONMENT_VARIABLE]: '0' })).toBe(false);
  });

  test('explicit environment opt-in enables live reference capture tests', () => {
    expect(liveReferenceTestsEnabled({ [LIVE_REFERENCE_TEST_ENVIRONMENT_VARIABLE]: '1' })).toBe(true);
    expect(liveReferenceTestsEnabled({ [LIVE_REFERENCE_TEST_ENVIRONMENT_VARIABLE]: 'true' })).toBe(true);
    expect(liveReferenceTestsEnabled({ [LIVE_REFERENCE_TEST_ENVIRONMENT_VARIABLE]: 'yes' })).toBe(true);
  });

  test('dedicated live test path list pins every OS-window reference capture suite', () => {
    expect(LIVE_REFERENCE_TEST_PATHS).toEqual([
      'test/plan_final/oracle/capture-reference-audio-windows.test.ts',
      'test/plan_final/oracle/capture-reference-demo-sync.test.ts',
      'test/plan_final/oracle/capture-reference-e1m1-actions.test.ts',
      'test/plan_final/oracle/capture-reference-intermission-finale.test.ts',
      'test/plan_final/oracle/capture-reference-menu-route.test.ts',
      'test/plan_final/oracle/capture-reference-save-load.test.ts',
      'test/plan_final/oracle/capture-reference-title-frame.test.ts',
      'test/plan_final/oracle/launch-reference-cleanly.test.ts',
    ]);
  });

  test('each live reference suite opts its OS-window assertions into the live gate helper', async () => {
    for (const testPath of LIVE_REFERENCE_TEST_PATHS) {
      const sourceText = await Bun.file(testPath).text();

      expect(sourceText).toContain("from './live-reference-test-gate.ts'");
      expect(sourceText).toContain('liveReferenceTest(');
    }
  });
});
