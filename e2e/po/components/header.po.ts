import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import { ImportYamlPo } from '@/e2e/po/components/import-yaml.po';
import KubectlPo from '@/e2e/po/components/kubectl.po';
import { NamespaceFilterPo } from '@/e2e/po/components/namespace-filter.po';

export class HeaderPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="header"]');
  }

  projectNamespaceFilter(): NamespaceFilterPo {
    return new NamespaceFilterPo(this.page);
  }

  async selectNamespaceFilterOption(singleOption: string): Promise<void> {
    const filter = this.projectNamespaceFilter();

    await filter.toggle();
    await filter.clickOptionByLabel(singleOption);
    await filter.isChecked(singleOption);
    await filter.toggle();
  }

  async selectWorkspace(name: string): Promise<void> {
    const ws = this.page.locator('[data-testid="workspace-switcher"]');

    await ws.click();
    await this.page.locator(`.vs__dropdown-menu .vs__dropdown-option`).filter({ hasText: name }).click();
  }

  async checkCurrentWorkspace(name: string): Promise<void> {
    const wsFilter = this.page.locator('[data-testid="workspace-switcher"]');

    await expect(wsFilter).toContainText(name);
  }

  importYamlHeaderAction(): Locator {
    return this.self().locator('[data-testid="header-action-import-yaml"]');
  }

  importYaml(): ImportYamlPo {
    return new ImportYamlPo(this.page);
  }

  kubectlShell(): KubectlPo {
    return new KubectlPo(this.page);
  }

  kubectlExplain(): Locator {
    return this.self().locator('[data-testid="extension-header-action-kubectl-explain.action"]');
  }

  clusterIcon(): Locator {
    return this.self().locator('.cluster-icon');
  }

  clusterName(): Locator {
    return this.self().locator('.cluster-name');
  }

  customBadge(): Locator {
    return this.self().locator('.cluster-badge');
  }

  downloadKubeconfig(): Locator {
    return this.page.locator('[data-testid="btn-download-kubeconfig"]');
  }

  copyKubeconfig(): Locator {
    return this.page.locator('[data-testid="btn-copy-kubeconfig"]');
  }

  copyKubeConfigCheckmark(): Locator {
    return this.page.locator('.header-btn-active');
  }

  /** Hover over kubectl explain to show tooltip */
  async showKubectlExplainTooltip(): Promise<void> {
    await this.kubectlExplain().hover();
  }

  /** Get the kubectl explain tooltip content */
  getKubectlExplainTooltipContent(): Locator {
    return this.page.locator('.v-popper--theme-tooltip .v-popper__inner');
  }

  resourceSearchButton(): Locator {
    return this.page.locator('[data-testid="header-resource-search"]');
  }
}
