import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';

export class WorkloadsDaemonsetsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/apps.daemonset`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, WorkloadsDaemonsetsListPagePo.createPath(clusterId));
  }

  baseResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }

  masthead(): ResourceListMastheadPo {
    return new ResourceListMastheadPo(this.page, ':scope');
  }

  sortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, '.sortable-table');
  }

  createEditView(): CreateEditViewPo {
    return new CreateEditViewPo(this.page, '.dashboard-root');
  }

  redeployDialog(): Locator {
    return this.page
      .locator('[data-testid="redeploy-dialog"]')
      .or(this.page.getByRole('alertdialog').filter({ hasText: 'Redeploy' }));
  }

  redeployDialogConfirmButton(): Locator {
    return this.redeployDialog().locator('button').filter({ hasText: 'Redeploy' });
  }

  redeployDialogCancelButton(): Locator {
    return this.redeployDialog().locator('button').filter({ hasText: 'Cancel' });
  }

  redeployDialogErrorBanner(): Locator {
    return this.redeployDialog().locator('.banner.error');
  }
}

export class WorkLoadsDaemonsetsCreatePagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/apps.daemonset/create`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, WorkLoadsDaemonsetsCreatePagePo.createPath(clusterId));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}

export class WorkLoadsDaemonsetsEditPagePo extends PagePo {
  private static createPath(daemonsetId: string, clusterId: string, namespaceId: string) {
    return `/c/${clusterId}/explorer/apps.daemonset/${namespaceId}/${daemonsetId}`;
  }

  constructor(page: Page, daemonsetId: string, clusterId = 'local', namespaceId = 'default') {
    super(page, WorkLoadsDaemonsetsEditPagePo.createPath(daemonsetId, clusterId, namespaceId));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  containerImageInput(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Container Image');
  }

  async clickTab(selector: string): Promise<void> {
    const tabbed = new TabbedPo(this.page);

    await tabbed.clickTabWithSelector(selector);
  }

  daemonSetTab(): Locator {
    return this.page.getByTestId('btn-DaemonSet');
  }

  upgradingTab(): Locator {
    // Two tab sets exist (workload-general-tabs and workload-pod-tabs) — use the general one
    return this.page.getByTestId('workload-general-tabs').getByTestId('btn-upgrading');
  }

  ScalingUpgradePolicyRadioBtn(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[data-testid="input-policy-strategy"]');
  }

  scalingUpgradePolicyRadioBtn(): RadioGroupInputPo {
    return this.ScalingUpgradePolicyRadioBtn();
  }
}
