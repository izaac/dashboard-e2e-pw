import type { Locator, Page } from '@playwright/test';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import AzureCloudCredentialsCreateEditPo from '@/e2e/po/edit/cloud-credentials-azure.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

export default class ClusterManagerCreateAKSPagePo extends ClusterManagerCreatePagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, clusterId, 'type=aks&rkeType=rke2');
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  cloudCredentialsForm(): AzureCloudCredentialsCreateEditPo {
    return new AzureCloudCredentialsCreateEditPo(this.page);
  }

  clusterNameInput(): Locator {
    return this.page.locator('.col.span-4 input').first();
  }

  getClusterName(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.page.locator('.col.span-4'), 'Name');
  }

  getClusterDescription(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[placeholder*="better describes this resource"]');
  }

  clusterResourceGroup(): Locator {
    return this.page.locator('input[placeholder*="aks-resource-group"]');
  }

  dnsPrefixInput(): Locator {
    return this.page.locator('[data-testid="cruaks-form"] input[placeholder*="aks-dns"]');
  }

  regionSelect(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="cruaks-resourcelocation"]');
  }

  kubernetesVersionSelect(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="cruaks-kubernetesversion"]');
  }

  create(): Locator {
    return this.resourceDetail().cruResource().saveOrCreate().self();
  }
}
