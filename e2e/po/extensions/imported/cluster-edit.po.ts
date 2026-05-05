import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

export default class ClusterManagerEditImportedPagePo extends PagePo {
  private static createPath(clusterId: string, ns: string, clusterName: string): string {
    return `/c/${clusterId}/manager/provisioning.cattle.io.cluster/${ns}/${clusterName}`;
  }

  constructor(page: Page, clusterId = '_', ns = 'fleet-default', clusterName: string) {
    super(page, ClusterManagerEditImportedPagePo.createPath(clusterId, ns, clusterName));
  }

  accordionByLabel(label: string): Locator {
    return this.self().locator('.accordion-container').filter({ hasText: label });
  }

  networkingAccordion(): Locator {
    return this.self().getByTestId('network-accordion');
  }

  registriesAccordion(): Locator {
    return this.self().getByTestId('registries-accordion');
  }

  versionManagementBanner(): Locator {
    return this.self().getByTestId('version-management-banner');
  }

  aceEnabledRadio(): Locator {
    return this.self().getByTestId('ace-enabled-radio-input');
  }
}
