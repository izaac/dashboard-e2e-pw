import type { Page } from '@playwright/test';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import GKECloudCredentialsCreateEditPo from '@/e2e/po/edit/cloud-credentials-gke.po';

export default class ClusterManagerCreateGKEPagePo extends ClusterManagerCreatePagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, clusterId);
  }

  cloudCredentialsForm(): GKECloudCredentialsCreateEditPo {
    return new GKECloudCredentialsCreateEditPo(this.page);
  }

  authProjectId(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Google Project ID');
  }

  getClusterName(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="gke-cluster-name"]', this.self());
  }

  getClusterDescription(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="gke-cluster-description"]', this.self());
  }

  gkeVersionSelect(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="gke-version-select"]', this.self());
  }

  gkeZoneSelectPo(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="gke-zone-select"]', this.self());
  }

  saveCreateGkeCluster(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }
}
