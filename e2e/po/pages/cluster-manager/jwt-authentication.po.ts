import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export default class JWTAuthenticationPagePo extends PagePo {
  private static createPath(clusterId: string): string {
    return `/c/${clusterId}/manager/jwt.authentication`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, JWTAuthenticationPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="jwt-authentication-list"]');
  }
}
