import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import ArrayListPo from '@/e2e/po/components/array-list.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';

export default class ClusterManagerEditGenericPagePo extends PagePo {
  private static createPath(clusterId: string, clusterName: string): string {
    return `/c/${clusterId}/manager/provisioning.cattle.io.cluster/fleet-default/${clusterName}`;
  }

  constructor(page: Page, clusterId = '_', clusterName: string) {
    super(page, ClusterManagerEditGenericPagePo.createPath(clusterId, clusterName));
  }

  async clickTab(selector: string): Promise<void> {
    const tabs = new TabbedPo(this.page);

    await tabs.clickTabWithSelector(selector);
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
}
