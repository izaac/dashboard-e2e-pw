import type { Page, Locator } from '@playwright/test';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import BasicsRke2 from '@/e2e/po/edit/provisioning.cattle.io.cluster/tabs/basics-tab-rke2.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import AzureCloudCredentialsCreateEditPo from '@/e2e/po/edit/cloud-credentials-azure.po';

export default class ClusterManagerCreateRke2AzurePagePo extends ClusterManagerCreatePagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, clusterId);
  }

  basicsTab(): BasicsRke2 {
    return new BasicsRke2(this.page);
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  /**
   * Inline cloud-credentials form, rendered on the cluster-create page when
   * no Azure credential exists yet. Mirrors the AKS provisioning flow.
   */
  cloudCredentialsForm(): AzureCloudCredentialsCreateEditPo {
    return new AzureCloudCredentialsCreateEditPo(this.page);
  }

  azureDropdownOption(text: string): Locator {
    return this.page.locator('.vs__dropdown-option').filter({ hasText: text });
  }

  poolNameInput(): Locator {
    return this.page.getByTestId('machine-pool-name-input');
  }

  poolQuantityInput(): Locator {
    return this.page.getByTestId('machine-pool-quantity-input');
  }

  errorBanner(): Locator {
    return this.page.getByTestId('error-banner0');
  }

  locationSelect(): Locator {
    return this.page.locator('[data-testid="machineConfig-azure-location"]');
  }

  locationSelectedValue(): Locator {
    return this.locationSelect().locator('.vs__selected-options > span');
  }

  environmentDisplay(): Locator {
    return this.page.locator('[data-testid="machineConfig-azure-environment-value"] span');
  }

  saveButton(): Locator {
    return this.page.getByTestId('form-save');
  }

  createButton(): Locator {
    return this.page.getByRole('button', { name: /create/i });
  }
}
