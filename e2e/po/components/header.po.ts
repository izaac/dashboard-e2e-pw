import type { Page, Locator, Response } from '@playwright/test';
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

  /** Select one namespace filter option and return the response of the user-preferences PUT that persists it */
  async selectNamespaceFilterOption(singleOption: string): Promise<Response> {
    const filter = this.projectNamespaceFilter();

    await filter.toggle();

    const response = await filter.clickOptionByLabelAndWaitForRequest(singleOption);

    await filter.optionCheckmark(singleOption).waitFor({ state: 'attached' });
    await filter.toggle();

    return response;
  }

  async selectWorkspace(name: string): Promise<void> {
    const ws = this.page.locator('[data-testid="workspace-switcher"]');

    await ws.click();
    await this.page.locator(`.vs__dropdown-menu .vs__dropdown-option`).filter({ hasText: name }).click();
  }

  /** Locator for the workspace switcher */
  workspaceSwitcher(): Locator {
    return this.page.locator('[data-testid="workspace-switcher"]');
  }

  importYamlHeaderAction(): Locator {
    return this.self().locator('[data-testid="header-action-import-yaml"]');
  }

  /** Clicks an inert corner of the header, which moves focus off whatever field had it */
  async clickInertCorner(): Promise<void> {
    await this.self().click({ position: { x: 2, y: 2 } });
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
