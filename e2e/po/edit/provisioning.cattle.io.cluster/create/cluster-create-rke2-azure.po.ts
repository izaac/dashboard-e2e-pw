import type { Page, Locator } from '@playwright/test';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';

export default class ClusterManagerCreateRke2AzurePagePo extends ClusterManagerCreatePagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, clusterId);
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  azureEnvironmentSelect(): Locator {
    return this.page.getByTestId('azure-environment');
  }

  azureDropdownOption(text: string): Locator {
    return this.page.locator('.vs__dropdown-option').filter({ hasText: text });
  }

  subscriptionIdInput(): Locator {
    return this.page.getByTestId('subscriptionId');
  }

  clientIdInput(): Locator {
    return this.page.getByTestId('clientId');
  }

  clientSecretInput(): Locator {
    return this.page.getByTestId('clientSecret');
  }

  poolNameInput(): Locator {
    return this.page.locator('[data-testid="pool-name-input"]');
  }

  poolQuantityInput(): Locator {
    return this.page.locator('[data-testid="pool-quantity-input"]');
  }

  kubernetesVersionSelect(): Locator {
    return this.page.locator('[data-testid="kubernetes-version-select"]');
  }

  kubernetesVersionOption(version: string): Locator {
    return this.page.locator('.vs__dropdown-option').filter({ hasText: version });
  }

  errorBanner(): Locator {
    return this.page.locator('.banner.banner-danger');
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
