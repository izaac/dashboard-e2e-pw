import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ArrayListPo from '@/e2e/po/components/array-list.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import BasicsRke2 from '@/e2e/po/edit/provisioning.cattle.io.cluster/tabs/basics-tab-rke2.po';

export default class ClusterManagerEditGenericPagePo extends PagePo {
  private static createPath(clusterId: string, clusterName: string): string {
    return `/c/${clusterId}/manager/provisioning.cattle.io.cluster/fleet-default/${clusterName}`;
  }

  constructor(page: Page, clusterId = '_', clusterName: string) {
    super(page, ClusterManagerEditGenericPagePo.createPath(clusterId, clusterName));
  }

  async clickRegistryTab(): Promise<void> {
    await this.page.locator('li#registry').click();
  }

  documentationLink(): Locator {
    return this.page.getByTestId('edit-cluster-reprovisioning-documentation').locator('a');
  }

  registryAuthenticationItems(): ArrayListPo {
    return new ArrayListPo(this.page, '[data-testid="registry-authentication"]');
  }

  registryAuthenticationField(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="registry-auth-select-or-create-0"]');
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  basicsTab(): BasicsRke2 {
    return new BasicsRke2(this.page);
  }

  cloudCredentialSelect(): Locator {
    return this.page.getByTestId('cloud-credentials-select');
  }

  dropdownOption(text: string): Locator {
    return this.page.locator(`.vs__dropdown-menu li:has-text("${text}")`);
  }
}
