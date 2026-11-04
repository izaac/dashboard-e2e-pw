import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

/**
 * Installed App (Helm release) detail page:
 * `/c/<cluster>/apps/catalog.cattle.io.app/<namespace>/<name>`
 */
export default class InstalledAppDetailPagePo extends PagePo {
  constructor(page: Page, clusterId: string, namespace: string, name: string) {
    super(page, `/c/${clusterId}/apps/catalog.cattle.io.app/${namespace}/${name}`);
  }

  detail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  /** State badge next to the title (e.g. Deployed) */
  stateBadge(): Locator {
    return this.detail().stateBadge();
  }

  /** The Resources tab body: the helm resources created by the release */
  resourcesPanel(): Locator {
    return this.detail().tabs().panel('resources');
  }

  valuesTab(): Locator {
    return this.detail().tabs().tab('values-yaml');
  }

  valuesPanel(): Locator {
    return this.detail().tabs().panel('values-yaml');
  }
}
