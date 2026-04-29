import type { Page, Locator } from '@playwright/test';
import ClusterManagerCreateRke2AmazonPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-amazon.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import CloudCredentialsCreateEditPo from '@/e2e/po/edit/cloud-credentials-amazon.po';

export default class ClusterManagerCreateEKSPagePo extends ClusterManagerCreateRke2AmazonPagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, clusterId);
  }

  cloudCredentialsForm(): CloudCredentialsCreateEditPo {
    return new CloudCredentialsCreateEditPo(this.page);
  }

  /** The credential select section */
  credentialSelect(): Locator {
    return this.page.getByTestId('crueks-select-credential');
  }

  /** Cancel the inline credential create form — triggers auto-select of existing credential */
  credentialFormCancel(): Locator {
    return this.credentialSelect().getByRole('button', { name: 'Select Existing' });
  }

  /** Select an existing credential from the dropdown after clicking "Select Existing" */
  async selectExistingCredential(name: string): Promise<void> {
    const dropdown = new LabeledSelectPo(this.page, '[data-testid="cluster-prov-select-credential"]');

    await dropdown.toggle();
    await dropdown.clickOptionWithLabel(name);
  }

  /** A dropdown list option with matching text (vue-select .vs__dropdown-menu) */
  dropdownOption(text: string): Locator {
    return this.page.locator(`.vs__dropdown-menu li:has-text("${text}")`);
  }

  serviceRoleRadioGroup(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[data-testid="eks-service-role-radio"]');
  }

  vpcRadioGroup(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[aria-label="VPCs and Subnets"]');
  }

  getClusterName(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="eks-name-input"]');
  }

  getClusterDescription(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[placeholder*="better describes this resource"]');
  }

  getRegion(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="eks_region"]');
  }

  getVersion(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="eks-version-dropdown"]');
  }

  getNodeGroup(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="eks-nodegroup-name"]');
  }

  getNodeRole(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="eks-noderole"]');
  }

  getLaunchTemplate(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="eks-launch-template-dropdown"]');
  }

  getDesiredASGSize(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Desired ASG Size');
  }

  getMinASGSize(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Minimum ASG Size');
  }

  getMaxASGSize(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Maximum ASG Size');
  }

  getInstanceType(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="eks-instance-type-dropdown"]');
  }

  getDiskSize(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="eks-disksize-input"]');
  }

  getPublicAccess(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Public Access');
  }

  getPrivateAccess(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Private Access');
  }

  /** Returns the highest version from the eks-version dropdown options */
  async getLatestEKSversion(): Promise<string> {
    const versionSelect = this.getVersion();

    await versionSelect.toggle();

    // vue-select renders dropdown-menu as a portal appended to <body>,
    // not inside the component — must use page-level locator
    const options = versionSelect.getOptions();
    const texts = await options.allInnerTexts();

    await versionSelect.toggle();

    let latestVersion = 0;

    for (const text of texts) {
      const num = parseFloat(text.trim());

      if (!isNaN(num) && num > latestVersion) {
        latestVersion = num;
      }
    }

    return String(latestVersion);
  }
}
