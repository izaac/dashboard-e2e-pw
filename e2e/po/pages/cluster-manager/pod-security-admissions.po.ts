import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import PodSecurityAdmissionsCreateEditPo from '@/e2e/po/edit/pod-security-admissions.po';

export default class PodSecurityAdmissionsPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/manager/management.cattle.io.podsecurityadmissionconfigurationtemplate`;
  }

  private clusterId: string;

  constructor(page: Page, clusterId = '_') {
    super(page, PodSecurityAdmissionsPagePo.createPath(clusterId));
    this.clusterId = clusterId;
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  async create(): Promise<void> {
    await this.list().masthead().actions().filter({ hasText: 'Create' }).click();
  }

  createPodSecurityAdmissionForm(id?: string): PodSecurityAdmissionsCreateEditPo {
    return new PodSecurityAdmissionsCreateEditPo(this.page, this.clusterId, id);
  }
}
