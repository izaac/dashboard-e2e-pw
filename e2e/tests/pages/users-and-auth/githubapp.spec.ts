import { test, expect } from '@/support/fixtures';
import AuthProviderPo, { AuthProvider } from '@/e2e/po/pages/users-and-auth/auth-provider.po';
import GithubAppPo from '@/e2e/po/edit/auth/githubapp.po';

const authClusterId = '_';

const clientId = 'test-client-id';
const clientSecret = 'test-client-secret';
const appId = 'test-app-id';
const privateKey = 'test-private-key';

test.describe('GitHub App', { tag: ['@adminUser', '@usersAndAuths'] }, () => {
  test.beforeEach(async ({ page, login }) => {
    await login();

    const authProviderPo = new AuthProviderPo(page, authClusterId);

    await authProviderPo.goTo();
    await authProviderPo.waitForUrlPathWithoutContext();
    await authProviderPo.selectProvider(AuthProvider.GITHUB_APP);

    const githubAppPo = new GithubAppPo(page, authClusterId);

    await githubAppPo.waitForUrlPathWithoutContext();
  });

  test('can navigate to Auth Provider and select GitHub App', async ({ page }) => {
    const githubAppPo = new GithubAppPo(page, authClusterId);

    await expect(githubAppPo.mastheadTitle()).toContainText('GitHub App');
    await expect(githubAppPo.gitHubAppBanner()).toBeVisible();
    await expect(githubAppPo.permissionsWarningBanner()).toBeVisible();
  });

  test('sends correct request to create GitHub App auth provider', async ({ page }) => {
    const githubAppPo = new GithubAppPo(page, authClusterId);

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('v3/githubAppConfigs/githubapp?action=configureTest') && req.method() === 'POST',
    );

    await page.route('**/v3/githubAppConfigs/githubapp?action=configureTest', (route) => {
      route.fulfill({ status: 200, body: JSON.stringify({}) });
    });

    await expect(githubAppPo.saveButton().self()).toBeDisabled();
    await githubAppPo.enterClientId(clientId);
    await githubAppPo.enterClientSecret(clientSecret);
    await githubAppPo.enterGitHubAppId(appId);
    await githubAppPo.enterPrivateKey(privateKey);

    await expect(githubAppPo.saveButton().self()).toBeEnabled();
    await githubAppPo.save();

    const request = await requestPromise;
    const body = request.postDataJSON();

    expect(body.enabled).toBe(false);
    expect(body.id).toBe('githubapp');
    expect(body.type).toBe('githubAppConfig');
    expect(body.clientId).toBe(clientId);
    expect(body.clientSecret).toBe(clientSecret);
    expect(body.appId).toBe(appId);
    expect(body.privateKey).toBe(privateKey);
  });
});
