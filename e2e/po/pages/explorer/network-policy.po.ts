import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import BannersPo from '@/e2e/po/components/banners.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';

export class NetworkPolicyListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/networking.k8s.io.networkpolicy`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, NetworkPolicyListPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, ':scope', this.self());
  }

  baseResourceList(): BaseResourceList {
    return this.list();
  }

  promptRemove(): PromptRemove {
    return new PromptRemove(this.page);
  }
}

export class NetworkPolicyCreateEditPagePo extends PagePo {
  private static createPath(clusterId: string, namespace?: string, id?: string) {
    const root = `/c/${clusterId}/explorer/networking.k8s.io.networkpolicy`;

    return id ? `${root}/${namespace}/${id}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = 'local', namespace?: string, id?: string) {
    super(page, NetworkPolicyCreateEditPagePo.createPath(clusterId, namespace, id));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  nameInput(): Locator {
    return this.page.getByTestId('name-ns-description-name').locator('input');
  }

  descriptionInput(): Locator {
    return this.page.getByTestId('name-ns-description-description').locator('input');
  }

  formSave(): Locator {
    return this.page.getByTestId('form-save');
  }

  enableIngressCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="network-policy-ingress-enable-checkbox"]');
  }

  newNetworkPolicyRuleAddBtn(): Locator {
    return this.page.getByTestId('tab-list-add');
  }

  addAllowedTrafficSourceButton(): Locator {
    return this.page.getByTestId('array-list-button').filter({ hasText: 'Add allowed traffic source' });
  }

  addAllowedPortButton(): Locator {
    return this.page.getByTestId('array-list-button').filter({ hasText: 'Add allowed port' });
  }

  ingressRuleItemPortInput(index: number): Locator {
    return this.page.locator(`section #rule-ingress0 .box:nth-of-type(${index + 1}) .col:nth-of-type(1) input`);
  }

  policyRuleTargetSelect(index: number): LabeledSelectPo {
    return new LabeledSelectPo(
      this.page,
      `[data-testid="policy-rule-target-${index}"] [data-testid="policy-rule-target-type-labeled-select"]`,
    );
  }

  matchingNamespacesMessage(index: number): BannersPo {
    return new BannersPo(
      this.page,
      `[data-testid="policy-rule-target-${index}"] [data-testid="matching-namespaces-message"]`,
    );
  }

  policyRuleKeyInput(index: number): Locator {
    return this.page.locator(
      `[data-testid="policy-rule-target-${index}"] [data-testid="input-match-expression-key-control-0"]`,
    );
  }

  editAsYamlButton(): Locator {
    return this.page.getByRole('button', { name: 'Edit as YAML' });
  }

  yamlEditor(): Locator {
    return this.page.getByTestId('yaml-editor-code-mirror');
  }
}
