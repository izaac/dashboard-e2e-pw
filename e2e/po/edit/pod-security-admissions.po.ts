import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
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
}
