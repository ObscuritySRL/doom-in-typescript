import { LIVE_REFERENCE_TEST_ENVIRONMENT_VARIABLE, LIVE_REFERENCE_TEST_PATHS } from './liveReferenceTestConfig.ts';

const requestedTestPaths = Bun.argv.slice(2);
const testPaths = requestedTestPaths.length === 0 ? LIVE_REFERENCE_TEST_PATHS : requestedTestPaths;

const child = Bun.spawn({
  cmd: ['bun', 'test', '--max-concurrency=1', ...testPaths],
  env: {
    ...Bun.env,
    [LIVE_REFERENCE_TEST_ENVIRONMENT_VARIABLE]: '1',
  },
  stderr: 'inherit',
  stdout: 'inherit',
});

const exitCode = await child.exited;
process.exit(exitCode);
