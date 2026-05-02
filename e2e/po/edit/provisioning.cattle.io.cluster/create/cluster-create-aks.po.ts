import type { Locator, Page } from '@playwright/test';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import AzureCloudCredentialsCreateEditPo from '@/e2e/po/edit/cloud-credentials-azure.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';

export default class ClusterManagerCreateAKSPagePo extends ClusterManagerCreatePagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, clusterId, 'type=aks&rkeType=rke2');
  }

  private poolLocator(): Locator {
    return this.page.locator('.pool');
  }

  private formLocator(): Locator {
    return this.page.locator('[data-testid="cruaks-form"]');
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  cloudCredentialsForm(): AzureCloudCredentialsCreateEditPo {
    return new AzureCloudCredentialsCreateEditPo(this.page);
  }

  /** The credential select section */
  credentialSelect(): Locator {
    return this.page.getByTestId('cruaks-select-credential');
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

  // --- Node pool fields ---

  getNodeGroup(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.poolLocator(), 'Name');
  }

  getVMsize(): LabeledSelectPo {
    return LabeledSelectPo.byLabel(this.page, this.poolLocator(), 'VM Size');
  }

  getAvailabilityZones(): LabeledSelectPo {
    return LabeledSelectPo.byLabel(this.page, this.poolLocator(), 'Availability Zones');
  }

  getOSdiskType(): LabeledSelectPo {
    return LabeledSelectPo.byLabel(this.page, this.formLocator(), 'OS Disk Type');
  }

  getOSdiskSize(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.poolLocator(), 'OS Disk Size');
  }

  getNodeCount(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.poolLocator(), 'Count');
  }

  getMaxPods(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.formLocator(), 'Max Pods per Node');
  }

  getMaxSurge(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.formLocator(), 'Max Surge');
  }

  // --- Cluster-level checkboxes ---

  // The aks-*-checkbox testids dropped out of the AKS Vue component in newer
  // Rancher releases. Match upstream cypress and look up checkboxes by label.
  getAutoScaling(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.formLocator(), 'Enable Auto Scaling');
  }

  getContainerMonitoring(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.formLocator(), 'Configure Container Monitoring');
  }

  getProjNetworkIsolation(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.formLocator(), 'Project Network Isolation');
  }

  getHTTProuting(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.formLocator(), 'HTTP Application Routing');
  }

  getEnablePrivateCluster(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.formLocator(), 'Enable Private Cluster');
  }

  getAuthIPranges(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.formLocator(), 'Set Authorized IP Ranges');
  }

  // --- Cluster-level labeled inputs ---

  getLinuxAdmin(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.formLocator(), 'Linux Admin Username');
  }

  getNodeResourceGroup(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.formLocator(), 'Node Resource Group');
  }

  getLogResourceGroup(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.formLocator(), 'Log Analytics Workspace Resource Group');
  }

  getLogWorkspaceName(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.formLocator(), 'Log Analytics Workspace Name');
  }

  getSSHkey(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.formLocator(), 'SSH Public Key');
  }

  getKubernetesSAR(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.formLocator(), 'Kubernetes Service Address Range');
  }

  getKubernetesDNS(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.formLocator(), 'Kubernetes DNS Service IP Address');
  }

  getDockerBridge(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.formLocator(), 'Docker Bridge Address');
  }

  // --- Cluster-level labeled selects ---

  getLoadBalancerSKU(): LabeledSelectPo {
    return LabeledSelectPo.byLabel(this.page, this.formLocator(), 'Load Balancer SKU');
  }

  getOutboundType(): LabeledSelectPo {
    return LabeledSelectPo.byLabel(this.page, this.formLocator(), 'Outbound Type');
  }

  getNetworkPlugin(): LabeledSelectPo {
    return LabeledSelectPo.byLabel(this.page, this.formLocator(), 'Network Plugin');
  }

  getNetworkPolicy(): LabeledSelectPo {
    return LabeledSelectPo.byLabel(this.page, this.formLocator(), 'Network Policy');
  }

  getVirtualNetwork(): LabeledSelectPo {
    return LabeledSelectPo.byLabel(this.page, this.formLocator(), 'Virtual Network');
  }

  // --- Radio groups ---

  getPoolModeRadio(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '.radio-group', this.poolLocator());
  }

  getAuthModeRadio(): RadioGroupInputPo {
    return new RadioGroupInputPo(
      this.page,
      '.radio-group:has(.radio-label:has-text("Service Principal"))',
      this.formLocator(),
    );
  }
}
