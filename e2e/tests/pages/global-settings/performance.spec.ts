import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import { PerformancePagePo } from '@/e2e/po/pages/global-settings/performance.po';

test.describe('Performance', { tag: ['@globalSettings', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  let performanceSettingsOriginal: any;
  let perfPage: PerformancePagePo;

  test.beforeEach(async ({ login, page, rancherApi }) => {
    await login();
    const homePage = new HomePagePo(page);

    await homePage.goTo();

    perfPage = new PerformancePagePo(page);

    // Save original performance settings
    const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-performance');

    performanceSettingsOriginal = resp.body;
  });

  test.afterEach(async ({ rancherApi }) => {
    // Restore original performance settings
    if (performanceSettingsOriginal) {
      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-performance');

      performanceSettingsOriginal.metadata.resourceVersion = resp.body.metadata.resourceVersion;
      await rancherApi.setRancherResource(
        'v1',
        'management.cattle.io.settings',
        'ui-performance',
        performanceSettingsOriginal,
      );
    }
  });

  async function navToPerformance(page: any) {
    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);

    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Performance');
  }

  async function applyAndWait(page: any) {
    const responsePromise = page.waitForResponse(
      (resp: any) => resp.url().includes('ui-performance') && resp.request().method() === 'PUT',
    );

    await perfPage.saveButton().click();

    return responsePromise;
  }

  test('can toggle websocket notifications', async ({ page }) => {
    await navToPerformance(page);

    // Enable websocket notifications (default is checked/true meaning notifications are disabled)
    const websocketCheckbox = perfPage.websocketCheckbox();

    await expect(websocketCheckbox).toBeVisible();

    // Toggle off
    await websocketCheckbox.click();
    let resp = await applyAndWait(page);

    expect(resp.status()).toBe(200);
    const reqBody = resp.request().postDataJSON();

    expect(reqBody.value).toContain('"disableWebsocketNotification":false');
    const respBody = await resp.json();

    expect(respBody.value).toContain('"disableWebsocketNotification":false');

    // Toggle on
    await websocketCheckbox.click();
    resp = await applyAndWait(page);
    expect(resp.status()).toBe(200);
    const reqBody2 = resp.request().postDataJSON();

    expect(reqBody2.value).toContain('"disableWebsocketNotification":true');
    const respBody2 = await resp.json();

    expect(respBody2.value).toContain('"disableWebsocketNotification":true');
  });

  test('can toggle incremental loading', async ({ page }) => {
    await navToPerformance(page);

    const incrementalCheckbox = perfPage.incrementalLoadingCheckbox();

    // Disable incremental loading
    await incrementalCheckbox.click();
    let resp = await applyAndWait(page);

    expect(resp.status()).toBe(200);
    let reqBody = resp.request().postDataJSON();

    expect(reqBody.value).toContain('"incrementalLoading":{"enabled":false');
    let respBody = await resp.json();

    expect(respBody.value).toContain('"incrementalLoading":{"enabled":false');

    // Enable incremental loading
    await incrementalCheckbox.click();
    resp = await applyAndWait(page);
    expect(resp.status()).toBe(200);
    reqBody = resp.request().postDataJSON();
    expect(reqBody.value).toContain('"incrementalLoading":{"enabled":true');
    respBody = await resp.json();
    expect(respBody.value).toContain('"incrementalLoading":{"enabled":true');
  });

  test('can toggle manual refresh', async ({ page }) => {
    await navToPerformance(page);

    const manualRefreshCheckbox = perfPage.manualRefreshCheckbox();

    // Enable manual refresh
    await manualRefreshCheckbox.click();
    let resp = await applyAndWait(page);

    expect(resp.status()).toBe(200);
    let reqBody = resp.request().postDataJSON();

    expect(reqBody.value).toContain('"manualRefresh":{"enabled":true');
    let respBody = await resp.json();

    expect(respBody.value).toContain('"manualRefresh":{"enabled":true');

    // Disable manual refresh
    await manualRefreshCheckbox.click();
    resp = await applyAndWait(page);
    expect(resp.status()).toBe(200);
    reqBody = resp.request().postDataJSON();
    expect(reqBody.value).toContain('"manualRefresh":{"enabled":false');
    respBody = await resp.json();
    expect(respBody.value).toContain('"manualRefresh":{"enabled":false');
  });

  test('can toggle resource garbage collection', async ({ page }) => {
    await navToPerformance(page);

    const gcCheckbox = perfPage.garbageCollectionCheckbox();

    // Enable garbage collection
    await gcCheckbox.click();

    // Set resource count to 600
    const gcInput = perfPage.garbageCollectionThresholdInput();

    await gcInput.clear();
    await gcInput.fill('600');

    let resp = await applyAndWait(page);

    expect(resp.status()).toBe(200);
    let reqBody = resp.request().postDataJSON();

    expect(reqBody.value).toContain('"garbageCollection":{"enabled":true');
    let respBody = await resp.json();

    expect(respBody.value).toContain('"garbageCollection":{"enabled":true');
    expect(respBody.value).toContain('"countThreshold":600');

    // Check element value
    await expect(gcInput).toHaveValue('600');

    // Disable garbage collection
    await gcCheckbox.click();
    resp = await applyAndWait(page);
    expect(resp.status()).toBe(200);
    reqBody = resp.request().postDataJSON();
    expect(reqBody.value).toContain('"garbageCollection":{"enabled":false');
    respBody = await resp.json();
    expect(respBody.value).toContain('"garbageCollection":{"enabled":false');
  });

  test('can toggle require namespace filtering', async ({ page }) => {
    await navToPerformance(page);

    const nsFilterCheckbox = perfPage.nsFilterCheckbox();

    // Enable require namespace filtering
    await nsFilterCheckbox.click();

    // Prompt modal should appear
    const modal = perfPage.confirmationModal();

    await expect(modal.getBody()).toContainText(
      'Required Namespace / Project Filtering is incompatible with Manual Refresh and Incremental Loading',
    );
    await modal.getActionButton().getByText('Continue').click();

    let resp = await applyAndWait(page);

    expect(resp.status()).toBe(200);
    let reqBody = resp.request().postDataJSON();

    expect(reqBody.value).toContain('"forceNsFilterV2":{"enabled":true');
    let respBody = await resp.json();

    expect(respBody.value).toContain('"forceNsFilterV2":{"enabled":true');

    // Disable require namespace filtering
    await nsFilterCheckbox.click();
    resp = await applyAndWait(page);
    expect(resp.status()).toBe(200);
    reqBody = resp.request().postDataJSON();
    expect(reqBody.value).toContain('"forceNsFilterV2":{"enabled":false');
    respBody = await resp.json();
    expect(respBody.value).toContain('"forceNsFilterV2":{"enabled":false');

    // Reenable incremental loading (disabled when we enable 'require namespace filtering')
    const incrementalCheckbox = perfPage.incrementalLoadingCheckbox();

    await incrementalCheckbox.click();
    resp = await applyAndWait(page);
    expect(resp.status()).toBe(200);
    reqBody = resp.request().postDataJSON();
    expect(reqBody.value).toContain('"incrementalLoading":{"enabled":true');
    respBody = await resp.json();
    expect(respBody.value).toContain('"incrementalLoading":{"enabled":true');
  });

  test('can toggle websocket web worker', async ({ page }) => {
    await navToPerformance(page);

    const workerCheckbox = perfPage.advancedWorkerCheckbox();

    // Enable websocket web worker
    await workerCheckbox.click();
    let resp = await applyAndWait(page);

    expect(resp.status()).toBe(200);
    let reqBody = resp.request().postDataJSON();

    expect(reqBody.value).toContain('"advancedWorker":{"enabled":true');
    let respBody = await resp.json();

    expect(respBody.value).toContain('"advancedWorker":{"enabled":true');

    // Disable websocket web worker
    await workerCheckbox.click();
    resp = await applyAndWait(page);
    expect(resp.status()).toBe(200);
    reqBody = resp.request().postDataJSON();
    expect(reqBody.value).toContain('"advancedWorker":{"enabled":false');
    respBody = await resp.json();
    expect(respBody.value).toContain('"advancedWorker":{"enabled":false');
  });
});
