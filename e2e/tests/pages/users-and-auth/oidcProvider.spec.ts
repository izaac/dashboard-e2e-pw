import { test, expect } from '@/support/fixtures';
import OidcClientsPagePo from '@/e2e/po/pages/users-and-auth/oidc-client.po';
import OidcClientCreateEditPo from '@/e2e/po/edit/management.cattle.io.oidcclient.po';
import OIDCClientDetailPo from '@/e2e/po/detail/management.cattle.io.oidcclient.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import GenericPrompt from '@/e2e/po/prompts/genericPrompt.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import { LONG } from '@/support/timeouts';

const OIDC_CREATE_DATA = {
  APP_NAME: 'some-app-name',
  APP_DESC: 'some-app-desc',
  CB_URLS: ['https://some-dummy-url-1.com', 'https://some-dummy-url-2.com'],
  REF_TOKEN_EXP: 3800,
  TOKEN_EXP: 800,
};

const OIDC_EDIT_DATA = {
  APP_DESC: 'some-app-desc1',
  CB_URLS: ['https://some-dummy-url-11.com', 'https://some-dummy-url-21.com'],
  REF_TOKEN_EXP: 3801,
  TOKEN_EXP: 801,
};

const CLUSTER_ID = '_';

async function isOidcProviderEnabled(rancherApi: RancherApi): Promise<boolean> {
  try {
    const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.features', 'oidc-provider', 0);

    if (resp.status !== 200) {
      return false;
    }

    const spec = resp.body.spec || {};

    if (spec.value !== undefined && spec.value !== null) {
      return spec.value;
    }

    return resp.body.status?.default ?? false;
  } catch {
    return false;
  }
}

async function ensureOidcClientExists(rancherApi: RancherApi): Promise<void> {
  const existing = await rancherApi.getRancherResource(
    'v1',
    'management.cattle.io.oidcclients',
    OIDC_CREATE_DATA.APP_NAME,
    0,
  );

  if (existing.status === 200) {
    return;
  }

  await rancherApi.createRancherResource('v1', 'management.cattle.io.oidcclients', {
    metadata: { name: OIDC_CREATE_DATA.APP_NAME },
    spec: {
      description: OIDC_CREATE_DATA.APP_DESC,
      redirectURIs: OIDC_CREATE_DATA.CB_URLS,
      refreshTokenExpirationSeconds: OIDC_CREATE_DATA.REF_TOKEN_EXP,
      tokenExpirationSeconds: OIDC_CREATE_DATA.TOKEN_EXP,
    },
  });
}

async function deleteOidcClientIfExists(rancherApi: RancherApi): Promise<void> {
  const existing = await rancherApi.getRancherResource(
    'v1',
    'management.cattle.io.oidcclients',
    OIDC_CREATE_DATA.APP_NAME,
    0,
  );

  if (existing.status === 200) {
    await rancherApi.deleteRancherResource('v1', 'management.cattle.io.oidcclients', OIDC_CREATE_DATA.APP_NAME, false);
  }
}

test.describe('Rancher as an OIDC Provider', { tag: ['@globalSettings', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test('should be able to create an OIDC client application', async ({ page, login, rancherApi }) => {
    test.skip(!(await isOidcProviderEnabled(rancherApi)), 'OIDC Provider feature flag is not enabled');

    // Cleanup any leftover from previous runs
    await deleteOidcClientIfExists(rancherApi);

    await login();

    const homePage = new HomePagePo(page);
    const oidcClientsPage = new OidcClientsPagePo(page, CLUSTER_ID);
    const oidcClientCreatePage = new OidcClientCreateEditPo(page, CLUSTER_ID);
    const oidcClientDetailPage = new OIDCClientDetailPo(page, CLUSTER_ID, OIDC_CREATE_DATA.APP_NAME);

    await homePage.goTo();

    // goTo() can cause flaky full-secret copy behavior; burger menu nav is more reliable
    await oidcClientsPage.navToMenuEntry('Users & Authentication');
    await oidcClientsPage.navToSideMenuEntryByLabel('OIDC Apps');
    await oidcClientsPage.waitForUrlPathWithoutContext();

    await expect(oidcClientsPage.list().title()).toContainText('OIDC Apps');
    await expect(oidcClientsPage.list().resourceTable().sortableTable().self()).toBeVisible();
    await oidcClientsPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    await oidcClientsPage.list().issuerURL().copyToClipboard();
    await oidcClientsPage.list().discoveryDocument().copyToClipboard();
    await oidcClientsPage.list().jwksURI().copyToClipboard();

    await oidcClientsPage.createOidcClient();
    await oidcClientCreatePage.waitForUrlPathWithoutContext();

    await oidcClientCreatePage.nameNsDescription().name().set(OIDC_CREATE_DATA.APP_NAME);
    await oidcClientCreatePage.nameNsDescription().description().set(OIDC_CREATE_DATA.APP_DESC);
    await oidcClientCreatePage.callbackUrls().setValueAtIndex(OIDC_CREATE_DATA.CB_URLS[0], 0, 'Add Callback URL');
    await oidcClientCreatePage.callbackUrls().setValueAtIndex(OIDC_CREATE_DATA.CB_URLS[1], 1, 'Add Callback URL');
    await oidcClientCreatePage.refreshTokenExpiration().setValue(OIDC_CREATE_DATA.REF_TOKEN_EXP);
    await oidcClientCreatePage.tokenExpiration().setValue(OIDC_CREATE_DATA.TOKEN_EXP);

    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/v1/management.cattle.io.oidcclients') && resp.request().method() === 'POST',
    );

    await oidcClientCreatePage.saveCreateForm().createEditView().createButton().click();

    const resp = await createResponse;
    const body = await resp.json();

    expect(resp.status()).toBe(201);
    expect(body.metadata.name).toBe(OIDC_CREATE_DATA.APP_NAME);
    expect(body.spec.description).toBe(OIDC_CREATE_DATA.APP_DESC);
    expect(body.spec.redirectURIs).toContain(OIDC_CREATE_DATA.CB_URLS[0]);
    expect(body.spec.redirectURIs).toContain(OIDC_CREATE_DATA.CB_URLS[1]);
    expect(body.spec.refreshTokenExpirationSeconds).toBe(OIDC_CREATE_DATA.REF_TOKEN_EXP);
    expect(body.spec.tokenExpirationSeconds).toBe(OIDC_CREATE_DATA.TOKEN_EXP);

    await oidcClientDetailPage.waitForUrlPathWithoutContext();
    await expect(oidcClientDetailPage.clientID().self()).toBeVisible();
    await expect(oidcClientDetailPage.clientFullSecretCopy(0).self()).toBeVisible();
    await oidcClientDetailPage.clientID().copyToClipboard();
    await oidcClientDetailPage.clientFullSecretCopy(0).copyToClipboard();

    // Cleanup
    await deleteOidcClientIfExists(rancherApi);
  });

  test('should be able to edit an OIDC client application', async ({ page, login, rancherApi }) => {
    test.skip(!(await isOidcProviderEnabled(rancherApi)), 'OIDC Provider feature flag is not enabled');

    await ensureOidcClientExists(rancherApi);

    await login();

    const oidcClientsPage = new OidcClientsPagePo(page, CLUSTER_ID);
    const oidcClientEditPage = new OidcClientCreateEditPo(page, CLUSTER_ID, OIDC_CREATE_DATA.APP_NAME, true);

    await oidcClientsPage.goTo();
    await oidcClientsPage.waitForPage();

    const actionMenu = await oidcClientsPage.list().actionMenu(OIDC_CREATE_DATA.APP_NAME);

    await actionMenu.getMenuItem('Edit Config').click();

    await oidcClientEditPage.nameNsDescription().description().set(OIDC_EDIT_DATA.APP_DESC);
    await oidcClientEditPage.callbackUrls().clearListItem(0);
    await oidcClientEditPage.callbackUrls().clearListItem(1);
    await oidcClientEditPage
      .callbackUrls()
      .setValueAtIndex(OIDC_EDIT_DATA.CB_URLS[0], 0, 'Add Callback URL', undefined, false);
    await oidcClientEditPage
      .callbackUrls()
      .setValueAtIndex(OIDC_EDIT_DATA.CB_URLS[1], 1, 'Add Callback URL', undefined, false);
    await oidcClientEditPage.refreshTokenExpiration().setValue(OIDC_EDIT_DATA.REF_TOKEN_EXP);
    await oidcClientEditPage.tokenExpiration().setValue(OIDC_EDIT_DATA.TOKEN_EXP);

    const editResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/v1/management.cattle.io.oidcclients/${OIDC_CREATE_DATA.APP_NAME}`) &&
        resp.request().method() === 'PUT',
    );

    await oidcClientEditPage.saveCreateForm().createEditView().saveButtonPo().click();

    const resp = await editResponse;
    const body = await resp.json();

    expect(resp.status()).toBe(200);
    expect(body.metadata.name).toBe(OIDC_CREATE_DATA.APP_NAME);
    expect(body.spec.description).toBe(OIDC_EDIT_DATA.APP_DESC);
    expect(body.spec.redirectURIs).toContain(OIDC_EDIT_DATA.CB_URLS[0]);
    expect(body.spec.redirectURIs).toContain(OIDC_EDIT_DATA.CB_URLS[1]);
    expect(body.spec.refreshTokenExpirationSeconds).toBe(OIDC_EDIT_DATA.REF_TOKEN_EXP);
    expect(body.spec.tokenExpirationSeconds).toBe(OIDC_EDIT_DATA.TOKEN_EXP);

    // Cleanup
    await deleteOidcClientIfExists(rancherApi);
  });

  test('should be able to add a new secret for an OIDC provider', async ({ page, login, rancherApi }) => {
    test.skip(!(await isOidcProviderEnabled(rancherApi)), 'OIDC Provider feature flag is not enabled');

    await ensureOidcClientExists(rancherApi);

    await login();

    const homePage = new HomePagePo(page);
    const oidcClientsPage = new OidcClientsPagePo(page, CLUSTER_ID);
    const oidcClientDetailPage = new OIDCClientDetailPo(page, CLUSTER_ID, OIDC_CREATE_DATA.APP_NAME);

    await homePage.goTo();

    await oidcClientsPage.navToMenuEntry('Users & Authentication');
    await oidcClientsPage.navToSideMenuEntryByLabel('OIDC Apps');
    await oidcClientsPage.waitForUrlPathWithoutContext();
    await oidcClientsPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
    await expect(oidcClientsPage.list().resourceTable().sortableTable().noRowsText()).not.toBeAttached();
    await oidcClientsPage.list().resourceTable().goToDetailsPage(OIDC_CREATE_DATA.APP_NAME);
    await oidcClientDetailPage.waitForUrlPathWithoutContext();

    const addSecretResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/v1/management.cattle.io.oidcclients/${OIDC_CREATE_DATA.APP_NAME}`) &&
        resp.request().method() === 'PUT',
      { timeout: LONG },
    );

    await oidcClientDetailPage.addNewSecretBtnClick();

    const resp = await addSecretResponse;
    const reqBody = JSON.parse(await resp.request().postData()!);

    expect(resp.status()).toBe(200);
    expect(reqBody.metadata.annotations['cattle.io/oidc-client-secret-create']).toBe('true');

    await oidcClientDetailPage.waitForUrlPathWithoutContext();
    await expect(oidcClientDetailPage.clientFullSecretCopy(1).self()).toBeVisible();
    await expect(oidcClientDetailPage.clientFullSecretCopy(1).self()).toBeVisible();
    await oidcClientDetailPage.clientFullSecretCopy(1).copyToClipboard();

    // Cleanup
    await deleteOidcClientIfExists(rancherApi);
  });

  test('should be able to regenerate a secret for an OIDC provider', async ({ page, login, rancherApi }) => {
    test.skip(!(await isOidcProviderEnabled(rancherApi)), 'OIDC Provider feature flag is not enabled');

    await ensureOidcClientExists(rancherApi);

    // Add a second secret via API annotation
    const existing = await rancherApi.getRancherResource(
      'v1',
      'management.cattle.io.oidcclients',
      OIDC_CREATE_DATA.APP_NAME,
    );
    const clientBody = existing.body;

    clientBody.metadata.annotations = clientBody.metadata.annotations || {};
    clientBody.metadata.annotations['cattle.io/oidc-client-secret-create'] = 'true';
    await rancherApi.setRancherResource(
      'v1',
      'management.cattle.io.oidcclients',
      OIDC_CREATE_DATA.APP_NAME,
      clientBody,
    );

    await login();

    const homePage = new HomePagePo(page);
    const oidcClientsPage = new OidcClientsPagePo(page, CLUSTER_ID);
    const oidcClientDetailPage = new OIDCClientDetailPo(page, CLUSTER_ID, OIDC_CREATE_DATA.APP_NAME);

    await homePage.goTo();
    await oidcClientsPage.navToMenuEntry('Users & Authentication');
    await oidcClientsPage.navToSideMenuEntryByLabel('OIDC Apps');
    await oidcClientsPage.waitForUrlPathWithoutContext();
    await oidcClientsPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
    await expect(oidcClientsPage.list().resourceTable().sortableTable().noRowsText()).not.toBeAttached();
    await oidcClientsPage.list().resourceTable().goToDetailsPage(OIDC_CREATE_DATA.APP_NAME);
    await oidcClientDetailPage.waitForUrlPathWithoutContext();

    await oidcClientDetailPage.secretCardActionMenuToggle(1);
    await oidcClientDetailPage.secretCardMenu().getMenuItem('Regenerate').click();

    const promptModal = new GenericPrompt(page);

    await expect(promptModal.getBody()).toBeVisible();

    const regenResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/v1/management.cattle.io.oidcclients/${OIDC_CREATE_DATA.APP_NAME}`) &&
        resp.request().method() === 'PUT',
    );

    await promptModal.clickActionButton('Regenerate Secret');

    const resp = await regenResponse;
    const reqBody = JSON.parse(await resp.request().postData()!);

    expect(resp.status()).toBe(200);
    expect(reqBody.metadata.annotations['cattle.io/oidc-client-secret-regenerate']).toBe('client-secret-2');

    await expect(oidcClientDetailPage.clientFullSecretCopy(1).self()).toBeVisible();
    await oidcClientDetailPage.clientFullSecretCopy(1).copyToClipboard();

    // Cleanup
    await deleteOidcClientIfExists(rancherApi);
  });

  test('should be able to delete a secret for an OIDC provider', async ({ page, login, rancherApi }) => {
    test.skip(!(await isOidcProviderEnabled(rancherApi)), 'OIDC Provider feature flag is not enabled');

    await ensureOidcClientExists(rancherApi);

    const existing = await rancherApi.getRancherResource(
      'v1',
      'management.cattle.io.oidcclients',
      OIDC_CREATE_DATA.APP_NAME,
    );
    const clientBody = existing.body;

    clientBody.metadata.annotations = clientBody.metadata.annotations || {};
    clientBody.metadata.annotations['cattle.io/oidc-client-secret-create'] = 'true';
    await rancherApi.setRancherResource(
      'v1',
      'management.cattle.io.oidcclients',
      OIDC_CREATE_DATA.APP_NAME,
      clientBody,
    );

    await login();

    const oidcClientDetailPage = new OIDCClientDetailPo(page, CLUSTER_ID, OIDC_CREATE_DATA.APP_NAME);

    await oidcClientDetailPage.goTo();
    await oidcClientDetailPage.waitForPage();

    await oidcClientDetailPage.secretCardActionMenuToggle(1);
    await oidcClientDetailPage.secretCardMenu().getMenuItem('Delete').click();

    const promptModal = new GenericPrompt(page);

    await expect(promptModal.getBody()).toBeVisible();

    const deleteSecretResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/v1/management.cattle.io.oidcclients/${OIDC_CREATE_DATA.APP_NAME}`) &&
        resp.request().method() === 'PUT',
    );

    await promptModal.clickActionButton('Delete Secret');

    const resp = await deleteSecretResponse;
    const reqBody = JSON.parse(await resp.request().postData()!);

    expect(resp.status()).toBe(200);
    expect(reqBody.metadata.annotations['cattle.io/oidc-client-secret-remove']).toBe('client-secret-2');

    await expect(oidcClientDetailPage.clientSecretCard(2)).not.toBeAttached();

    // Cleanup
    await deleteOidcClientIfExists(rancherApi);
  });

  test('should be able to delete an OIDC client application', async ({ page, login, rancherApi }) => {
    test.skip(!(await isOidcProviderEnabled(rancherApi)), 'OIDC Provider feature flag is not enabled');

    await ensureOidcClientExists(rancherApi);

    await login();

    const oidcClientsPage = new OidcClientsPagePo(page, CLUSTER_ID);

    await oidcClientsPage.goTo();
    await oidcClientsPage.waitForPage();

    const actionMenu = await oidcClientsPage.list().actionMenu(OIDC_CREATE_DATA.APP_NAME);

    await actionMenu.getMenuItem('Delete').click();

    const promptRemove = new PromptRemove(page);

    const deleteResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/v1/management.cattle.io.oidcclients/${OIDC_CREATE_DATA.APP_NAME}`) &&
        resp.request().method() === 'DELETE',
    );

    await promptRemove.remove();
    await deleteResponse;

    await oidcClientsPage.waitForPage();
    await expect(
      oidcClientsPage.list().resourceTable().sortableTable().rowWithName(OIDC_CREATE_DATA.APP_NAME).self(),
    ).not.toBeAttached();
  });
});
