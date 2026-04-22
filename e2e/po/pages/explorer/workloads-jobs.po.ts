import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

export class WorkloadsJobsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/batch.job`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, WorkloadsJobsListPagePo.createPath(clusterId));
  }

  baseResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }
}

export class WorkLoadsJobDetailsPagePo extends PagePo {
  private static createPath(jobId: string, clusterId: string, namespaceId: string) {
    return `/c/${clusterId}/explorer/batch.job/${namespaceId}/${jobId}`;
  }

  constructor(page: Page, jobId: string, clusterId = 'local', namespaceId = 'default') {
    super(page, WorkLoadsJobDetailsPagePo.createPath(jobId, clusterId, namespaceId));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  selectNamespaceOption(index: number): void {
    // Upstream pattern: toggle + clickOption by index
  }

  async selectNamespace(label: string): Promise<void> {
    const nsSelect = new LabeledSelectPo(this.page, '[data-testid="name-ns-description-namespace"]');

    await nsSelect.toggle();
    await nsSelect.clickOptionWithLabel(label);
  }

  namespaceInput(): Locator {
    return this.page.getByTestId('name-ns-description-namespace-create').locator('input[type="text"]');
  }

  namespace(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Namespace');
  }

  containerImage(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Container Image');
  }

  errorBanner(): Locator {
    return this.page.locator('#cru-errors');
  }
}
