import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import RootClusterPage from '@/e2e/po/pages/root-cluster-page.po';
import MgmtFeatureFlagListPo from '@/e2e/po/lists/management.cattle.io.feature.po';
import CardPo from '@/e2e/po/components/card.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/components/product-nav.po';

const RESTART_TIMEOUT = 120000;
const MEDIUM_TIMEOUT = 30000;

export class FeatureFlagsPagePo extends RootClusterPage {
  private clusterId: string;

  private static createPath(clusterId: string): string {
    return `/c/${clusterId}/settings/management.cattle.io.feature`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, FeatureFlagsPagePo.createPath(clusterId));
    this.clusterId = clusterId;
  }

  async goTo(): Promise<void> {
    await super.goTo();
  }

  async goToAndWait(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('v1/management.cattle.io.features') && resp.status() === 200,
      { timeout: MEDIUM_TIMEOUT },
    );

    await this.goTo();
    await responsePromise;
  }

  async navTo(): Promise<void> {
    const burgerMenu = new BurgerMenuPo(this.page);
    const sideNav = new ProductNavPo(this.page);

    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await this.page.locator('.side-nav').filter({ hasText: 'Feature Flags' }).waitFor();
    await sideNav.navToSideMenuEntryByLabel('Feature Flags');
  }

  list(): MgmtFeatureFlagListPo {
    return new MgmtFeatureFlagListPo(this.page, this.self());
  }

  cardActionButton(label: string): Locator {
    const card = new CardPo(this.page);

    return card.getActionButton().locator('button', { hasText: label });
  }

  cardActionBody(label: string): Locator {
    const card = new CardPo(this.page);

    return card.getBody().locator(':scope', { hasText: label });
  }

  /** Click Activate/Deactivate; returns the PUT response so callers can assert. */
  async clickCardActionButtonAndWait(
    label: 'Activate' | 'Deactivate',
    endpoint: string,
    config: { waitForModal?: boolean; waitForRequest?: boolean } = { waitForModal: false, waitForRequest: true },
  ): Promise<import('@playwright/test').Response | undefined> {
    // Set up response listener BEFORE the click
    let responsePromise: Promise<import('@playwright/test').Response> | undefined;

    if (config.waitForRequest) {
      responsePromise = this.page.waitForResponse(
        (resp) =>
          resp.url().includes(`/v1/management.cattle.io.features/${endpoint}`) && resp.request().method() === 'PUT',
        { timeout: MEDIUM_TIMEOUT },
      );
    }

    await this.cardActionButton(label).click();

    const resp = responsePromise ? await responsePromise : undefined;

    if (config.waitForModal) {
      const card = new CardPo(this.page);

      await card.self().waitFor({ state: 'detached', timeout: RESTART_TIMEOUT });
    }

    return resp;
  }

  /** Click Activate/Deactivate and assert PUT 200 + `spec.value === value` on both bodies. */
  async clickCardActionButtonAndExpectFlagSet(
    label: 'Activate' | 'Deactivate',
    endpoint: string,
    value: boolean,
    config: { waitForModal?: boolean } = { waitForModal: false },
  ): Promise<void> {
    const resp = await this.clickCardActionButtonAndWait(label, endpoint, {
      waitForRequest: true,
      waitForModal: config.waitForModal,
    });

    if (!resp) {
      throw new Error(
        '[FeatureFlagsPagePo] clickCardActionButtonAndExpectFlagSet expected a PUT response — clickCardActionButtonAndWait returned undefined',
      );
    }

    expect(resp.status()).toBe(200);

    const reqBody = resp.request().postDataJSON();

    expect(reqBody.spec).toHaveProperty('value', value);

    const respBody = await resp.json();

    expect(respBody.spec).toHaveProperty('value', value);
  }

  cardActionError(error: string): Locator {
    const card = new CardPo(this.page);

    return card.self().locator('.banner.error').filter({ hasText: error });
  }

  async getFeatureFlag(featureFlag: string): Promise<any> {
    // Absolute path bypasses the /dashboard/ baseURL — see extensions.po.ts for context.
    const response = await this.page.request.get(`/v1/management.cattle.io.features/${featureFlag}`);

    return response.json();
  }

  async setFeatureFlag(featureFlag: string, value: boolean): Promise<void> {
    const res = await this.getFeatureFlag(featureFlag);
    const obj = { ...res, spec: { value } };

    await this.page.request.put(`/v1/management.cattle.io.features/${featureFlag}`, { data: obj });
  }
}
