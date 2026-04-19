import { test, expect } from '@/support/fixtures';
import AuthProviderPo, { AuthProvider } from '@/e2e/po/pages/users-and-auth/auth-provider.po';
import AzureadPo from '@/e2e/po/edit/auth/azuread.po';

const authClusterId = '_';

const tenantId = '564b6f53-ebf4-43c3-8077-44c56a44990a';
const applicationId = '18cca356-170e-4bd9-a4a4-2e349855f96b';
const appSecret = 'test';
const groupMembershipFilter = 'test';
const endpoint = 'https://login.test.com/';
const authEndpoint = 'https://login.test.com/564b6f53-ebf4-43c3-8077-44c56a44990a/oauth2/v2.0/authorize';
const tokenEndpoint = 'https://login.test.com/564b6f53-ebf4-43c3-8077-44c56a44990a/oauth2/v2.0/token';
const graphEndpoint = 'https://graph.test.com';

test.describe('AzureAD', { tag: ['@adminUser', '@usersAndAuths'] }, () => {
  test.beforeEach(async ({ page, login }) => {
    await login();

    const authProviderPo = new AuthProviderPo(page, authClusterId);

    await authProviderPo.goTo();
    await authProviderPo.waitForUrlPathWithoutContext();
    await authProviderPo.selectProvider(AuthProvider.AZURE);

    const azureadPo = new AzureadPo(page, authClusterId);

    await azureadPo.waitForUrlPathWithoutContext();
  });

  test('can navigate Auth Provider and select AzureAD', async ({ page }) => {
    const azureadPo = new AzureadPo(page, authClusterId);

    await expect(azureadPo.mastheadTitle()).toContainText('AzureAD');
  });

  test('sends correct request to create custom Azure AD', async ({ page }) => {
    const azureadPo = new AzureadPo(page, authClusterId);

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('v3/azureADConfigs/azuread?action=configureTest') && req.method() === 'POST',
    );

    await page.route('**/v3/azureADConfigs/azuread?action=configureTest', (route) => {
      route.fulfill({ status: 200, body: JSON.stringify({}) });
    });

    await azureadPo.saveButton().expectToBeDisabled();
    await azureadPo.enterTenantId(tenantId);
    await azureadPo.enterApplicationId(applicationId);
    await azureadPo.enterApplicationSecret(appSecret);

    await azureadPo.groupMembershipFilterCheckbox().set();
    await azureadPo.enterGroupMembershipFilter(groupMembershipFilter);

    await azureadPo.selectEndpointsOption(2);

    await azureadPo.enterEndpoint(endpoint);
    await azureadPo.enterTokenEndpoint(tokenEndpoint);
    await azureadPo.enterGraphEndpoint(graphEndpoint);
    await azureadPo.enterAuthEndpoint(authEndpoint);

    await azureadPo.saveButton().expectToBeEnabled();
    await azureadPo.save();

    const request = await requestPromise;
    const body = request.postDataJSON();

    expect(body.tenantId).toBe(tenantId);
    expect(body.applicationId).toBe(applicationId);
    expect(body.applicationSecret).toBe(appSecret);
    expect(body.groupMembershipFilter).toBe(groupMembershipFilter);
    expect(body.endpoint).toBe(endpoint);
    expect(body.authEndpoint).toBe(authEndpoint);
    expect(body.tokenEndpoint).toBe(tokenEndpoint);
    expect(body.graphEndpoint).toBe(graphEndpoint);
  });
});
