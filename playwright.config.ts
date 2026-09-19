import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
  /*
   * Pinned without `{-projectName}`, which the default template inserts. The Atlas baselines
   * (tests/e2e/atlas-baseline.spec.ts-snapshots/*-linux.png) were taken before this file had named projects and
   * are never regenerated — naming them after a project would make all seven look missing at once.
   */
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-snapshotSuffix}{ext}',
  projects: [
    { name: 'app', testIgnore: /perf-smoke\.spec\.ts/ },
    /*
     * The performance bounds are wall-clock milliseconds measured under a ×4 CPU throttle, so they measure the
     * machine as much as the code. Run inside the main pool they were measuring the other five workers: two full
     * runs of the suite failed two *different* bounds, one by 11 % (a close-up pan at 83.3 ms against 75) and one
     * by 96 % (Satellite's first draw at 7 248 ms against 3 700), while each passed on its own — 1 748 ms for that
     * same first draw. Raising the bounds to cover that would have raised them past the regressions they exist to
     * catch. So this project waits for `app` to finish and then runs its three tests one at a time, on an
     * otherwise idle machine, which is the condition the numbers in that file's table were taken under.
     *
     * The dependency runs in full even when the command line names only the perf file, so to run these three on
     * their own use `npx playwright test --project=perf --no-deps` rather than passing the path.
     */
    { name: 'perf', testMatch: /perf-smoke\.spec\.ts/, fullyParallel: false, dependencies: ['app'] },
  ],
});
