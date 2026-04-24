import { test, expect } from '@/support/fixtures';
import AuthProviderPo, { AuthProvider } from '@/e2e/po/pages/users-and-auth/auth-provider.po';
import AmazonCognitoPo from '@/e2e/po/edit/auth/cognito.po';

const authClusterId = '_';

const clientId = 'test-client-id';
const clientSecret = 'test-client-secret';
const issuerUrl = 'test-issuer-url';

test.describe('Amazon Cognito', { tag: ['@adminUser', '@usersAndAuths'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page, login }) => {
    await login();

    const authProviderPo = new AuthProviderPo(page, authClusterId);

    await authProviderPo.goTo();
    await authProviderPo.waitForUrlPathWithoutContext();
    await authProviderPo.selectProvider(AuthProvider.AMAZON_COGNITO);

    const cognitoPo = new AmazonCognitoPo(page, authClusterId);

    await cognitoPo.waitForUrlPathWithoutContext();
  });

  test('can navigate Auth Provider and select Amazon Cognito', async ({ page }) => {
    const cognitoPo = new AmazonCognitoPo(page, authClusterId);

    await expect(cognitoPo.mastheadTitle()).toContainText('Amazon Cognito');
    await expect(cognitoPo.cognitoBanner()).toBeVisible();
    await expect(cognitoPo.permissionsWarningBanner()).toBeVisible();
  });

  test('sends correct request to create Amazon Cognito auth provider', async ({ page }) => {
    const cognitoPo = new AmazonCognitoPo(page, authClusterId);

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('v3/cognitoConfigs/cognito?action=configureTest') && req.method() === 'POST',
    );

    await page.route('**/v3/cognitoConfigs/cognito?action=configureTest', (route) => {
      route.fulfill({ status: 200, body: JSON.stringify({}) });
    });

    await expect(cognitoPo.saveButton().self()).toBeDisabled();
    await cognitoPo.enterClientId(clientId);
    await cognitoPo.enterClientSecret(clientSecret);
    await cognitoPo.enterIssuerUrl(issuerUrl);

    await expect(cognitoPo.saveButton().self()).toBeEnabled();
    await cognitoPo.save();

    const request = await requestPromise;
    const body = request.postDataJSON();

    expect(body.enabled).toBe(false);
    expect(body.id).toBe('cognito');
    expect(body.type).toBe('cognitoConfig');
    expect(body.clientId).toBe(clientId);
    expect(body.clientSecret).toBe(clientSecret);
    expect(body.issuer).toBe(issuerUrl);
    expect(body.scope).toBe('openid email');
  });
});
