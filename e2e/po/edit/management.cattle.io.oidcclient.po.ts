import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import ArrayListPo from '@/e2e/po/components/array-list.po';
import UnitInputPo from '@/e2e/po/components/unit-input.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';

export default class OidcClientCreateEditPo extends PagePo {
  private static createPath(clusterId: string, oidcClientId?: string, isEdit?: boolean) {
    const root = `/c/${clusterId}/auth/management.cattle.io.oidcclient`;

    return oidcClientId ? `${root}/${oidcClientId}${isEdit ? '?mode=edit' : ''}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', oidcClientId = '', isEdit = false) {
    super(page, OidcClientCreateEditPo.createPath(clusterId, oidcClientId, isEdit));
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  callbackUrls(): ArrayListPo {
    return new ArrayListPo(this.page, '[data-testid="oidc-client-cb-urls-list"]');
  }

  refreshTokenExpiration(): UnitInputPo {
    return new UnitInputPo(this.page, '[data-testid="oidc-client-ref-token-exp-input"]');
  }

  tokenExpiration(): UnitInputPo {
    return new UnitInputPo(this.page, '[data-testid="oidc-client-token-exp-input"]');
  }

  saveCreateForm(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
