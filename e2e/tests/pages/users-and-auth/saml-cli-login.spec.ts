import { test, expect } from '@/support/fixtures';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';

const TEST_REQUEST_ID = 'cli-test-request-id-12345';
const TEST_PUBLIC_KEY = 'cli-test-public-key-67890';
const INVALID_PARAMS_ERROR_TEXT = 'Invalid login parameters - can not login';
const EXPECTED_ZERO_COUNT = 0;

const buildCliQuery = (params: Record<string, string>): string => {
  const query = new URLSearchParams(params);

  return `/auth/login?${query.toString()}`;
};

// Requires an active SAML authentication provider (e.g. ADFS, Shibboleth, or Mock SAML) enabled on the cluster.
// Verified locally on v2.16-head (all 6 tests passing); skipped in standard CI runs that lack a configured SAML auth provider.
test.describe.skip(
  'SAML CLI Authentication Response Type Validation',
  { tag: ['@adminUser', '@usersAndAuths'] },
  () => {
    test.describe.configure({ mode: 'parallel' });

    test('should accept cluster-scoped responseType naming a downstream cluster', async ({ page }) => {
      const loginPage = new LoginPagePo(page);
      const targetUrl = buildCliQuery({
        cli: 'true',
        requestId: TEST_REQUEST_ID,
        publicKey: TEST_PUBLIC_KEY,
        responseType: 'kubeconfig_c-m-zx8p4nvt',
      });

      await page.goto(targetUrl);

      await expect(loginPage.cliLoginContainer()).toBeVisible();
      await expect(loginPage.cliLoginError()).toHaveCount(EXPECTED_ZERO_COUNT);
      await expect(loginPage.cliLoginCode()).toHaveText(TEST_REQUEST_ID);
      await expect(loginPage.providerSubmitButton()).toBeVisible();
    });

    test('should accept unscoped responseType for local or default cluster', async ({ page }) => {
      const loginPage = new LoginPagePo(page);
      const targetUrl = buildCliQuery({
        cli: 'true',
        requestId: TEST_REQUEST_ID,
        publicKey: TEST_PUBLIC_KEY,
        responseType: 'kubeconfig',
      });

      await page.goto(targetUrl);

      await expect(loginPage.cliLoginContainer()).toBeVisible();
      await expect(loginPage.cliLoginError()).toHaveCount(EXPECTED_ZERO_COUNT);
      await expect(loginPage.cliLoginCode()).toHaveText(TEST_REQUEST_ID);
      await expect(loginPage.providerSubmitButton()).toBeVisible();
    });

    test('should accept cluster id containing an underscore', async ({ page }) => {
      const loginPage = new LoginPagePo(page);
      const targetUrl = buildCliQuery({
        cli: 'true',
        requestId: TEST_REQUEST_ID,
        publicKey: TEST_PUBLIC_KEY,
        responseType: 'kubeconfig_c-m-zx8p_4nvt',
      });

      await page.goto(targetUrl);

      await expect(loginPage.cliLoginContainer()).toBeVisible();
      await expect(loginPage.cliLoginError()).toHaveCount(EXPECTED_ZERO_COUNT);
      await expect(loginPage.cliLoginCode()).toHaveText(TEST_REQUEST_ID);
      await expect(loginPage.providerSubmitButton()).toBeVisible();
    });

    test('should reject invalid responseType with error banner and hide submit button', async ({ page }) => {
      const loginPage = new LoginPagePo(page);
      const targetUrl = buildCliQuery({
        cli: 'true',
        requestId: TEST_REQUEST_ID,
        publicKey: TEST_PUBLIC_KEY,
        responseType: 'json',
      });

      await page.goto(targetUrl);

      await expect(loginPage.cliLoginContainer()).toBeVisible();
      await expect(loginPage.cliLoginError()).toBeVisible();
      await expect(loginPage.cliLoginError()).toHaveText(INVALID_PARAMS_ERROR_TEXT);
      await expect(loginPage.providerSubmitButton()).toHaveCount(EXPECTED_ZERO_COUNT);
    });

    test('should reject trailing underscore without cluster id', async ({ page }) => {
      const loginPage = new LoginPagePo(page);
      const targetUrl = buildCliQuery({
        cli: 'true',
        requestId: TEST_REQUEST_ID,
        publicKey: TEST_PUBLIC_KEY,
        responseType: 'kubeconfig_',
      });

      await page.goto(targetUrl);

      await expect(loginPage.cliLoginContainer()).toBeVisible();
      await expect(loginPage.cliLoginError()).toBeVisible();
      await expect(loginPage.cliLoginError()).toHaveText(INVALID_PARAMS_ERROR_TEXT);
      await expect(loginPage.providerSubmitButton()).toHaveCount(EXPECTED_ZERO_COUNT);
    });

    test('should reject CLI login missing requestId or publicKey', async ({ page }) => {
      const loginPage = new LoginPagePo(page);
      const targetUrl = buildCliQuery({
        cli: 'true',
        responseType: 'kubeconfig',
      });

      await page.goto(targetUrl);

      await expect(loginPage.cliLoginContainer()).toBeVisible();
      await expect(loginPage.cliLoginError()).toBeVisible();
      await expect(loginPage.cliLoginError()).toHaveText(INVALID_PARAMS_ERROR_TEXT);
      await expect(loginPage.providerSubmitButton()).toHaveCount(EXPECTED_ZERO_COUNT);
    });
  },
);
