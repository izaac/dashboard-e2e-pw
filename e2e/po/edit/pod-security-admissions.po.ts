import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export default class PodSecurityAdmissionsCreateEditPo extends PagePo {
  private static createPath(clusterId: string, id?: string) {
    const root = `/c/${clusterId}/manager/management.cattle.io.podsecurityadmissionconfigurationtemplate`;

    return id ? `${root}/${id}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', id?: string) {
    super(page, PodSecurityAdmissionsCreateEditPo.createPath(clusterId, id));
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  async psaControlLevel(itemRow: number, optionIndex: number): Promise<void> {
    const selectMode = new LabeledSelectPo(
      this.page,
      `[data-testid="pod-security-admission--psaControl-${itemRow}-level"]`,
      this.self(),
    );

    await selectMode.toggle();
    await selectMode.clickOption(optionIndex);
  }

  async psaControlVersion(itemRow: number, text: string): Promise<void> {
    // The data-testid is on the input element itself, not a parent wrapper
    const input = this.page.locator(`input[data-testid="pod-security-admission--psaControl-${itemRow}-version"]`);

    await input.scrollIntoViewIfNeeded();
    await input.clear();
    await input.fill(text);
  }

  async setExemptionsCheckbox(optionIndex: number): Promise<void> {
    const checkbox = new CheckboxInputPo(
      this.page,
      `[data-testid="pod-security-admission--psaExemptionsControl-${optionIndex}-active"]`,
    );

    await checkbox.set();
  }

  async setExemptionsInput(optionIndex: number, text: string): Promise<void> {
    // The data-testid is on the input element itself
    const input = this.page.locator(
      `input[data-testid="pod-security-admission--psaExemptionsControl-${optionIndex}-value"]`,
    );

    await input.scrollIntoViewIfNeeded();
    await input.clear();
    await input.fill(text);
  }

  editAsYaml(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-yaml"]', this.self());
  }

  yamlEditor(): CodeMirrorPo {
    return CodeMirrorPo.bySelector(this.page, this.self(), '[data-testid="yaml-editor-code-mirror"]');
  }
}
