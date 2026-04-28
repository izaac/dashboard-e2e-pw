import { defineConfig } from '@playwright/test';
import baseConfig, { baseURL } from './playwright.config';

/**
 * Qase integration
 */
const qaseEnabled =
  (process.env.QASE_REPORT === 'true' || process.env.qase_report === 'true') &&
  !!(process.env.QASE_AUTOMATION_TOKEN || process.env.qase_automation_token);

if (qaseEnabled) {
  console.log('Qase: Reporting enabled. Automation token is defined.');
}

/**
 * Jenkins-specific reporters
 */
const reporters: any[] = [
  ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ['junit', { outputFile: 'e2e/jenkins/reports/junit/results.xml' }],
];

if (qaseEnabled) {
  reporters.push([
    'playwright-qase-reporter',
    {
      mode: 'testops',
      debug: process.env.QASE_DEBUG === 'true',
      testops: {
        api: { token: process.env.QASE_AUTOMATION_TOKEN || process.env.qase_automation_token },
        project: process.env.QASE_PROJECT || process.env.qase_project || 'SANDBOX',
        uploadAttachments: true,
        run: {
          title: `UI E2E - ${process.env.RANCHER_IMAGE_TAG || 'unknown'} - ${process.env.GREP_TAGS || 'none'} - ${new Date()
            .toISOString()
            .replace('T', ' ')
            .replace(/\.\d+Z$/, ' UTC')}`,
          description: `Rancher Version: ${process.env.RANCHER_VERSION || 'unknown'} | Tags: ${process.env.GREP_TAGS || 'none'}`,
          complete: true,
        },
      },
    },
  ]);
}

/**
 * Jenkins Playwright Configuration
 * Extends base config with CI-specific settings
 */
export default defineConfig({
  ...baseConfig,

  /* Always retry in CI */
  retries: 2,

  /* CI reporters */
  reporter: reporters,

  use: {
    ...baseConfig.use,
    /* No screenshots/video overhead unless needed */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
});
