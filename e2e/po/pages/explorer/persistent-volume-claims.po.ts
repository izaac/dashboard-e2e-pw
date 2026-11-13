import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';

export class PersistentVolumeClaimsPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/persistentvolumeclaim`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, PersistentVolumeClaimsPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }
}

export class PersistentVolumeClaimDetailPagePo extends PagePo {
  private static createPath(clusterId: string, namespace: string, name: string) {
    return `/c/${clusterId}/explorer/persistentvolumeclaim/${namespace}/${name}`;
  }

  constructor(page: Page, namespace: string, name: string, clusterId = 'local') {
    super(page, PersistentVolumeClaimDetailPagePo.createPath(clusterId, namespace, name));
  }

  private tabs(): TabbedPo {
    return new TabbedPo(this.page);
  }

  /** Link to the bound PersistentVolume in the detail masthead's identifying information */
  mastheadVolumeLink(volumeName: string): Locator {
    return this.self().locator('.identifying-information').getByRole('link', { name: volumeName, exact: true });
  }

  /** The Related tab, which `ResourceTabs` always renders in view mode, whatever the user can list */
  relatedTab(): Locator {
    return this.tabs().tab('related');
  }

  /** The Pods tab, which only renders when the user can list Pods */
  podsTab(): Locator {
    return this.tabs().tab('mounted-pods');
  }

  async clickPodsTab(): Promise<void> {
    await this.tabs().tab('mounted-pods').click();
  }

  podsTabPanel(): Locator {
    return this.tabs().panel('mounted-pods');
  }

  podsList(): ResourceTablePo {
    return this.tabs().tabbedList('mounted-pods');
  }

  podsEmptyCaption(): Locator {
    return this.podsTabPanel().locator('p.caption');
  }
}
