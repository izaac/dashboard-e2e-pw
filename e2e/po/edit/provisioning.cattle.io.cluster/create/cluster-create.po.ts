import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import BannersPo from '@/e2e/po/components/banners.po';
import { STANDARD } from '@/support/timeouts';

export default class ClusterManagerCreatePagePo extends PagePo {
  private static createPath(clusterId: string, queryParams?: string) {
    const base = `/c/${clusterId}/manager/provisioning.cattle.io.cluster/create`;

    return queryParams ? `${base}?${queryParams}` : base;
  }

  static url(clusterId: string): string {
    return `/c/${clusterId}/manager/provisioning.cattle.io.cluster/create`;
  }

  constructor(page: Page, clusterId = '_', queryParams?: string) {
    super(page, ClusterManagerCreatePagePo.createPath(clusterId, queryParams));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  rke2PageTitle(): Locator {
    return this.self().locator('.title-bar h1.title, .primaryheader h1');
  }

  async gridElementExistanceByName(
    name: string,
    assertion: 'toBeVisible' | 'not.toBeVisible' = 'toBeVisible',
  ): Promise<void> {
    const el = this.self().locator('.grid .name').filter({ hasText: name });

    if (assertion === 'toBeVisible') {
      await el.waitFor({ state: 'visible', timeout: STANDARD });
    } else {
      await el.waitFor({ state: 'hidden', timeout: STANDARD });
    }
  }

  gridElementGroupTitles(): Locator {
    return this.self().locator('.subtypes-container > div > h4');
  }

  async selectKubeProvider(index: number): Promise<void> {
    await this.resourceDetail().cruResource().selectSubType(0, index).click();
  }

  async selectCreate(index: number): Promise<void> {
    await this.resourceDetail().cruResource().selectSubType(1, index).click();
  }

  async selectCustom(index: number): Promise<void> {
    await this.resourceDetail().cruResource().selectSubType(2, index).click();
  }

  commandFromCustomClusterUI(): Locator {
    return this.self().locator('code').filter({ hasText: '--insecure' });
  }

  activateInsecureRegistrationCommandFromUI(): Locator {
    return this.self().locator('.checkbox-label').filter({ hasText: 'Insecure:' });
  }

  customClusterRegistrationCmd(cmd: string, customNodeIp: string): string {
    return `ssh -i custom_node.key -o "StrictHostKeyChecking=no" -o "UserKnownHostsFile=/dev/null" root@${customNodeIp} "nohup ${cmd}"`;
  }

  loadingIndicator(): Locator {
    return this.page.locator('.loading-indicator').first();
  }

  gridProviderByName(name: string): Locator {
    return this.self().locator('.grid .name').filter({ hasText: name });
  }

  cloudCredentialSelect(): Locator {
    return this.page.getByTestId('cloud-credentials-select');
  }

  dropdownOption(text: string): Locator {
    return this.page.locator(`.vs__dropdown-menu li:has-text("${text}")`);
  }

  gkeZoneSelect(): Locator {
    return this.page.getByTestId('gke-zone-select');
  }

  credentialsBanner(): BannersPo {
    return new BannersPo(this.page, '.banner:has-text("Ok, Let\'s create a new credential")');
  }

  errorsBanner(): BannersPo {
    return new BannersPo(this.page, '.banner.error', this.self());
  }

  credentialsBannerLocator(): Locator {
    return this.self().locator('.banner:has-text("Ok, Let\'s create a new credential")');
  }
}
