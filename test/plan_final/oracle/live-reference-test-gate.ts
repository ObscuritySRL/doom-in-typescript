import { test } from 'bun:test';

import { liveReferenceTestsEnabled } from '../../../plan_final/liveReferenceTestConfig.ts';

export const liveReferenceTest = liveReferenceTestsEnabled() ? test : test.skip;
