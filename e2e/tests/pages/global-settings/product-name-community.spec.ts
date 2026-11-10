import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import AboutPagePo from '@/e2e/po/pages/about.po';
import { FeatureFlagsPagePo } from '@/e2e/po/pages/global-settings/feature-flags.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { NodesPagePo } from '@/e2e/po/pages/explorer/nodes.po';
import { WorkloadsPodsListPagePo } from '@/e2e/po/pages/explorer/workloads-pods.po';
import { SecretsListPagePo } from '@/e2e/po/pages/explorer/secrets.po';

const COMMUNITY_VENDOR = 'Rancher Community';
const PRIME_VENDOR = 'Rancher Prime';
const COMMUNITY_BRAND = '';
const PRIME_BRAND = 'suse';
const BRAND_SETTING = 'ui-brand';

/** Set the ui-brand setting via API; a no-op when it already holds the requested value. */
async function setUiBrand(rancherApi: RancherApi, value: string): Promise<void> {
  await rancherApi.setRancherResource('v3', 'settings', BRAND_SETTING, { value }, false);
}

/** Escape a string for literal use inside a RegExp. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Browser tab title must start with `<vendor> - `, optionally followed by the given segment. */
function titleStartingWith(vendor: string, segment = ''): RegExp {
  return new RegExp(`^${escapeRegExp(vendor)} - ${escapeRegExp(segment)}`);
}

test.describe('Product name in Rancher Community mode', () => {
  test.beforeEach(async ({ rancherApi, login }) => {
    await setUiBrand(rancherApi, COMMUNITY_BRAND);
    await login();
  });

  test.afterAll(async ({ rancherApi }) => {
    await setUiBrand(rancherApi, COMMUNITY_BRAND);
  });

  test(
    'should display Rancher Community in login page title and welcome heading',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page }) => {
      const loginPage = new LoginPagePo(page);

      // Drop the authenticated session so the login page is rendered
      await page.context().clearCookies();
      await loginPage.goTo();

      await expect(loginPage.welcomeHeading()).toHaveText(`Welcome to ${COMMUNITY_VENDOR}`);
      await expect(page).toHaveTitle(titleStartingWith(COMMUNITY_VENDOR));
    },
  );

  test(
    'should display Welcome to Rancher Community banner on home page',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      await expect(homePage.title()).toHaveText(`Welcome to ${COMMUNITY_VENDOR}`);
      await expect(page).toHaveTitle(titleStartingWith(COMMUNITY_VENDOR));
    },
  );

  test(
    'should display Rancher Community in about page title and label CLI as Rancher CLI',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page }) => {
      const aboutPage = new AboutPagePo(page);

      await aboutPage.goTo();
      await aboutPage.waitForPage();

      await expect(page).toHaveTitle(titleStartingWith(COMMUNITY_VENDOR));
      await expect(aboutPage.links('Rancher CLI')).toBeVisible();
    },
  );

  test(
    'should display Restart Rancher Community column header on feature flags page',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);

      await featureFlagsPage.goToAndWait();
      await featureFlagsPage.waitForPage();

      await expect(featureFlagsPage.columnHeader(`Restart ${COMMUNITY_VENDOR}`)).toBeVisible();
      await expect(page).toHaveTitle(titleStartingWith(COMMUNITY_VENDOR));
    },
  );

  test(
    'should prefix browser tab title with Rancher Community across explorer pages',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page }) => {
      const explorerPages: Array<{ po: { goTo(): Promise<void>; waitForPage(): Promise<void> }; name: string }> = [
        { po: new ClusterDashboardPagePo(page, 'local'), name: 'Cluster Dashboard' },
        { po: new NodesPagePo(page, 'local'), name: 'Nodes' },
        { po: new WorkloadsPodsListPagePo(page, 'local'), name: 'Pods' },
        { po: new SecretsListPagePo(page, 'local'), name: 'Secrets' },
      ];

      for (const { po, name } of explorerPages) {
        await po.goTo();
        await po.waitForPage();

        await expect(page).toHaveTitle(titleStartingWith(COMMUNITY_VENDOR, `local - ${name}`));
      }
    },
  );

  test(
    'should switch vendor to Rancher Prime when ui-brand is set to suse',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const homePage = new HomePagePo(page);

      await setUiBrand(rancherApi, PRIME_BRAND);

      await homePage.goTo();
      await homePage.waitForPage();

      await expect(homePage.title()).toHaveText(`Welcome to ${PRIME_VENDOR}`);
      await expect(page).toHaveTitle(titleStartingWith(PRIME_VENDOR));
    },
  );
});
