import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

/**
 * Page object for Cluster and Project Members page.
 */
export default class ClusterProjectMembersPo extends PagePo {
  private static createPath(clusterId: string, tabId: string) {
    return `/c/${clusterId}/explorer/members#${tabId}`;
  }

  constructor(page: Page, clusterId = 'local', tabId = 'cluster-membership') {
    super(page, ClusterProjectMembersPo.createPath(clusterId, tabId));
  }
}
