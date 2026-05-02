import { defineConfig, devices } from '@playwright/test';
import path from 'path';

require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * Parse Cypress-style GREP_TAGS into Playwright grep/grepInvert regexes.
 *
 * Syntax: "@adminUser+-@prime+-@noVai"
 *   +  splits tokens
 *   -@ means exclude (grepInvert)
 *   @  means include (grep, AND via lookaheads)
 *
 * Boundary-aware: @adminUser won't match @adminUserSetup
 */
const parseGrepTags = (tags?: string): { grep?: RegExp; grepInvert?: RegExp } => {
  if (!tags) {
    return {};
  }

  const tokens = tags
    .split('+')
    .map((t) => t.trim())
    .filter(Boolean);
  const include = tokens.filter((t) => !t.startsWith('-'));
  const exclude = tokens.filter((t) => t.startsWith('-')).map((t) => t.slice(1));

  const boundary = (tag: string) => `${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z])`;

  return {
    grep: include.length ? new RegExp(include.map((t) => `(?=.*${boundary(t)})`).join('')) : undefined,
    grepInvert: exclude.length ? new RegExp(exclude.map((t) => boundary(t)).join('|')) : undefined,
  };
};

/**
 * Environment Variables (matching Cypress convention)
 */
const skipSetup = process.env.TEST_SKIP?.includes('setup');
// Strip trailing slash for clean display/API derivation, add back for baseURL (Playwright needs it for relative path resolution)
const rawBaseUrl = (process.env.TEST_BASE_URL || 'https://localhost:8005').replace(/\/+$/, '');
const baseURL = `${rawBaseUrl}/`;
const username = process.env.TEST_USERNAME || 'admin';
const apiUrl =
  process.env.API || (rawBaseUrl.endsWith('/dashboard') ? rawBaseUrl.split('/').slice(0, -1).join('/') : rawBaseUrl);

// Unique auth file per Rancher instance — prevents storageState collisions when sharding
const authPort = (() => {
  try {
    return new URL(rawBaseUrl).port || '443';
  } catch {
    return '8005';
  }
})();
const adminAuthFile = `.auth/admin-${authPort}.json`;

/**
 * Test directories - mirrors Cypress specPattern
 */
const testDirs = ['priority', 'components', 'setup', 'pages', 'navigation', 'global-ui', 'features', 'extensions'];

const getTestMatch = (): string[] => {
  const only = process.env.TEST_ONLY?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const skip = process.env.TEST_SKIP?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let dirs = testDirs;

  if (only?.length) {
    dirs = dirs.filter((d) => only.includes(d));
  } else if (skip?.length) {
    dirs = dirs.filter((d) => !skip.includes(d));
  }

  if (process.env.TEST_A11Y) {
    dirs = ['accessibility'];
  }

  return dirs.map((d) => `e2e/tests/${d}/**/*.spec.ts`);
};

/**
 * Logging (matches Cypress config output)
 * Guard: Playwright loads config twice (discovery + run), only log once.
 */
if (!process.env._PW_CONFIG_LOGGED) {
  process.env._PW_CONFIG_LOGGED = '1';

  console.log('E2E Test Configuration (Playwright)');
  console.log('');
  console.log(`    Username: ${username}`);

  if (!process.env.CATTLE_BOOTSTRAP_PASSWORD && !process.env.TEST_PASSWORD) {
    console.log(' ❌ You must provide either CATTLE_BOOTSTRAP_PASSWORD or TEST_PASSWORD');
  }
  if (process.env.CATTLE_BOOTSTRAP_PASSWORD && process.env.TEST_PASSWORD) {
    console.log(' ❗ If both CATTLE_BOOTSTRAP_PASSWORD and TEST_PASSWORD are provided, the first will be used');
  }
  if (!skipSetup && !process.env.CATTLE_BOOTSTRAP_PASSWORD) {
    console.log(' ❌ You must provide CATTLE_BOOTSTRAP_PASSWORD when running setup tests');
  }
  if (skipSetup && !process.env.TEST_PASSWORD) {
    console.log(' ❌ You must provide TEST_PASSWORD when running the tests without the setup tests');
  }

  console.log(`    Setup tests will ${skipSetup ? 'NOT' : ''} be run`);
  console.log(`    Dashboard URL: ${rawBaseUrl}`);
  console.log(`    Rancher API URL: ${apiUrl}`);
  if (process.env.GREP_TAGS) {
    console.log(`    GREP_TAGS: ${process.env.GREP_TAGS}`);
  }

  if (apiUrl && !rawBaseUrl.startsWith(apiUrl)) {
    console.log('\n ❗ API variable is different to TEST_BASE_URL - tests may fail due to authentication issues');
  }
  console.log('');
} // end config log guard

const { grep, grepInvert } = parseGrepTags(process.env.GREP_TAGS);

/**
 * Playwright Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: '.',
  testMatch: getTestMatch(),

  /* Tag filtering (parsed from GREP_TAGS env var) */
  grep,
  grepInvert,

  /* Timeouts */
  timeout: 60_000,
  expect: {
    timeout: process.env.TEST_TIMEOUT ? +process.env.TEST_TIMEOUT : 10_000,
    /* Visual snapshot tolerance. threshold (0.2) and animations ('disabled')
     * are already Playwright defaults. maxDiffPixelRatio scales with image
     * size — 1% is generous enough to absorb anti-aliasing churn but tight
     * enough to catch genuine UI regressions. */
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },

  /* Centralize visual baselines under snapshots/ at repo root instead of next
   * to specs. Mirrors the spec path so a screenshot for
   * e2e/tests/pages/manager/repositories.spec.ts ends up under
   * snapshots/e2e/tests/pages/manager/repositories.spec.ts/. */
  snapshotPathTemplate: 'snapshots/{testFilePath}/{arg}{ext}',

  /* Sequential execution — single shared Rancher instance */
  fullyParallel: false,
  workers: 1,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Reporter */
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }], ['line']],

  /* Shared settings for all the projects below */
  use: {
    baseURL,
    ignoreHTTPSErrors: true,

    /* Debugging artifacts — all retained on failure for full post-mortem */
    screenshot: process.env.TEST_NO_SCREENSHOTS === 'true' ? 'off' : { mode: 'only-on-failure', fullPage: true },
    video: process.env.TEST_NO_VIDEOS === 'true' ? 'off' : 'retain-on-failure',
    trace: 'on-first-retry',

    actionTimeout: process.env.TEST_TIMEOUT ? +process.env.TEST_TIMEOUT : 10_000,
    storageState: undefined,
  },

  /* Metadata exposed to tests via testInfo.project.metadata */
  metadata: {
    baseUrl: baseURL,
    api: apiUrl,
    username,
    password: process.env.CATTLE_BOOTSTRAP_PASSWORD || process.env.TEST_PASSWORD,
    bootstrapPassword: process.env.CATTLE_BOOTSTRAP_PASSWORD,
    grepTags: process.env.GREP_TAGS,
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    azureSubscriptionId: process.env.AZURE_AKS_SUBSCRIPTION_ID,
    azureClientId: process.env.AZURE_CLIENT_ID,
    azureClientSecret: process.env.AZURE_CLIENT_SECRET,
    customNodeIp: process.env.CUSTOM_NODE_IP,
    customNodeKey: process.env.CUSTOM_NODE_KEY,
    customNodeUser: process.env.CUSTOM_NODE_USER || 'ec2-user',
    accessibility: !!process.env.TEST_A11Y,
    a11yFolder: path.join('.', 'e2e', 'accessibility'),
    gkeServiceAccount: process.env.GKE_SERVICE_ACCOUNT,
  },

  projects: [
    // Setup project — runs first on fresh Rancher (when CATTLE_BOOTSTRAP_PASSWORD is set)
    // grep: /.*/ ensures setup always runs regardless of GREP_TAGS filtering
    ...(process.env.CATTLE_BOOTSTRAP_PASSWORD
      ? [
          {
            name: 'setup',
            grep: /.*/,
            grepInvert: undefined as RegExp | undefined,
            testMatch: 'e2e/tests/setup/**/*.spec.ts',
            use: {
              ...devices['Desktop Chrome'],
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
              },
            },
          },
        ]
      : []),

    // Auth project — logs in once and saves session to .auth/admin.json
    {
      name: 'auth',
      grep: /.*/,
      grepInvert: undefined as RegExp | undefined,
      testMatch: 'e2e/tests/auth.setup.ts',
      dependencies: process.env.CATTLE_BOOTSTRAP_PASSWORD ? ['setup'] : [],
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      },
    },

    {
      name: 'chromium',
      dependencies: ['auth'],
      testIgnore: ['e2e/tests/setup/**', 'e2e/tests/auth.setup.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminAuthFile,
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        },
      },
    },
  ],

  /* Output directory for test artifacts */
  outputDir: 'test-results',
});

export { baseURL, apiUrl, username };
