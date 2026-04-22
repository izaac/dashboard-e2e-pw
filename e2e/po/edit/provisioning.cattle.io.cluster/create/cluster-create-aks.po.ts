import type { Locator, Page } from '@playwright/test';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export default class ClusterManagerCreateAKSPagePo extends ClusterManagerCreatePagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, clusterId, 'type=aks&rkeType=rke2');
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  clusterNameInput(): Locator {
    return this.page.locator('.col.span-4 input').first();
  }

  clusterResourceGroup(): Locator {
    return this.page.locator('input[placeholder*="aks-resource-group"]');
  }

  dnsPrefixInput(): Locator {
    return this.page.locator('[data-testid="cruaks-form"] input[placeholder*="aks-dns"]');
  }

  regionSelect(): Locator {
    return this.page.getByTestId('cruaks-resourcelocation');
  }

  kubernetesVersionSelect(): Locator {
    return this.page.getByTestId('cruaks-kubernetesversion');
  }

  cloudCredentialSelect(): Locator {
    return this.page.getByTestId('cloud-credentials-select');
  }

  create(): Locator {
    return this.resourceDetail().cruResource().saveOrCreate().self();
  }
}
