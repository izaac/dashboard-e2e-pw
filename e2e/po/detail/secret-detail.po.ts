import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ActionMenuPo from '@/e2e/po/components/action-menu.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

/**
 * Detail page of a secret: `/c/<cluster>/explorer/secret/<namespace>/<name>`
 */
export default class SecretDetailPagePo extends PagePo {
  constructor(page: Page, clusterId: string, namespace: string, name: string) {
    super(page, `/c/${clusterId}/explorer/secret/${namespace}/${name}`);
  }

  detail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  mastheadActionMenuButton(): Locator {
    return this.page.getByTestId('masthead-action-menu');
  }

  async openMastheadActionMenu(): Promise<ActionMenuPo> {
    await this.mastheadActionMenuButton().click();

    return new ActionMenuPo(this.page);
  }
}
