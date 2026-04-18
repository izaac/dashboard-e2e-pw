import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import CopyToClipboardTextPo from '@/e2e/po/components/copy-to-clipboard-text.po';
import ActionMenuPo from '@/e2e/po/components/action-menu.po';

export default class OIDCClientDetailPo extends PagePo {
  private static createPath(clusterId: string, id: string): string {
    return `/c/${clusterId}/auth/management.cattle.io.oidcclient/${id}`;
  }

  constructor(page: Page, clusterId = '_', id: string) {
    super(page, OIDCClientDetailPo.createPath(clusterId, id));
  }

  clientID(): CopyToClipboardTextPo {
    return new CopyToClipboardTextPo(this.page, '[data-testid="oidc-clients-copy-clipboard-client-id"]');
  }

  clientFullSecretCopy(index: number): CopyToClipboardTextPo {
    return new CopyToClipboardTextPo(this.page, `[data-testid="oidc-client-secret-${index}-copy-full-secret"]`);
  }

  async addNewSecretBtnClick(): Promise<void> {
    await this.page.getByTestId('oidc-client-add-new-secret').click();
  }

  async secretCardActionMenuToggle(index: number): Promise<void> {
    await this.page.getByTestId(`oidc-client-secret-${index}-action-menu`).click();
  }

  secretCardMenu(): ActionMenuPo {
    return new ActionMenuPo(this.page);
  }

  clientSecretCard(index: number): Locator {
    return this.page.getByTestId(`item-card-client-secret-${index}`);
  }
}
