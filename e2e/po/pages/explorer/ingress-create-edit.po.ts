import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ArrayListPo from '@/e2e/po/components/array-list.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';

export class IngressCreateEditPo extends PagePo {
  private static createPath(clusterId: string, namespace?: string, id?: string) {
    const root = `/c/${clusterId}/explorer/networking.k8s.io.ingress`;

    return id ? `${root}/${namespace}/${id}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = 'local', namespace?: string, id?: string) {
    super(page, IngressCreateEditPo.createPath(clusterId, namespace, id));
  }

  createEditView(): CreateEditViewPo {
    return new CreateEditViewPo(this.page, '.dashboard-root');
  }

  tabs(): TabbedPo {
    return new TabbedPo(this.page);
  }

  // --- Rules ---
  // Each rule has a host input and multiple path rows.
  // Within each path row (.rule-path): pathType select, path input, service select, port input.

  rulesList(): ArrayListPo {
    return new ArrayListPo(this.page, 'section#rules .array-list-grouped');
  }

  private ruleBox(ruleIndex: number) {
    return this.rulesList().arrayListItem(ruleIndex);
  }

  private rulePath(ruleIndex: number, pathIndex = 0) {
    return this.ruleBox(ruleIndex).locator('.rule-path').nth(pathIndex);
  }

  async setRuleRequestHostValue(ruleIndex: number, value: string): Promise<void> {
    await this.ruleBox(ruleIndex).locator('#host input').fill(value);
  }

  async setPathTypeByLabel(ruleIndex: number, value: string, pathIndex = 0): Promise<void> {
    const path = this.rulePath(ruleIndex, pathIndex);
    const select = new LabeledSelectPo(this.page, '.input-container .unlabeled-select', path);

    await this.selectWithRetry(select, value);
  }

  async setTargetServiceValueByLabel(ruleIndex: number, value: string, pathIndex = 0): Promise<void> {
    const path = this.rulePath(ruleIndex, pathIndex);
    const select = new LabeledSelectPo(this.page, '.col.span-3 .unlabeled-select', path);

    await this.selectWithRetry(select, value);
    await select.checkOptionSelected(value);
  }

  async setPortValue(ruleIndex: number, value: string, pathIndex = 0): Promise<void> {
    const path = this.rulePath(ruleIndex, pathIndex);
    const portCol = path.locator('.col.span-2');
    const hasVueSelect = (await portCol.locator('.v-select').count()) > 0;

    if (hasVueSelect) {
      const select = new LabeledSelectPo(this.page, '.unlabeled-select', portCol);

      await this.selectWithRetry(select, value);
    } else {
      const input = portCol.locator('input');

      await input.click();
      await input.fill(value);
    }
  }

  /**
   * RulePath.vue debounces update emissions by 500ms.
   * Call this after the last rule-path field change and before save().
   */
  async waitForRulePathDebounce(): Promise<void> {
    await this.page.waitForTimeout(600);
  }

  // --- Certificates ---

  certificatesList(): ArrayListPo {
    return new ArrayListPo(this.page, 'section#certificates .array-list-grouped');
  }

  async setSecretNameValueByLabel(index: number, value: string, parentIndex?: number): Promise<void> {
    const item = this.certificatesList().arrayListItem(index, parentIndex);
    const select = new LabeledSelectPo(this.page, '.labeled-select', item);

    await select.toggle();
    await select.clickOptionWithLabel(value);
  }

  async setHostValueByIndex(index: number, value: string, parentIndex?: number): Promise<void> {
    const item = this.certificatesList().arrayListItem(index, parentIndex);

    await item.locator('.labeled-input input').fill(value);
  }

  // Vue-Select dropdowns in the ingress form can detach during re-renders
  // (e.g. after namespace change triggers service loading). Retry the full toggle+click sequence.
  private async selectWithRetry(select: LabeledSelectPo, label: string): Promise<void> {
    await expect(async () => {
      await select.toggle();
      const option = select.getOptions().filter({ hasText: label }).first();

      await expect(option).toBeVisible({ timeout: 3000 });
      await option.click({ timeout: 3000 });
    }).toPass({ timeout: 15000, intervals: [500, 1000, 2000] });
  }
}
