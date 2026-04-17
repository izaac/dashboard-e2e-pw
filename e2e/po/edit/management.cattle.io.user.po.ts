import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export default class MgmtUserEditPo extends PagePo {
  private static createPath(clusterId: string, userId?: string) {
    const root = `/c/${clusterId}/auth/management.cattle.io.user`;

    return userId ? `${root}/${userId}?mode=edit` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', userId?: string) {
    super(page, MgmtUserEditPo.createPath(clusterId, userId));
  }

  name(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Name');
  }

  username(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Username');
  }

  description(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Description');
  }

  newPass(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'New Password');
  }

  confirmNewPass(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Confirm Password');
  }

  selectCheckbox(label: string): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), label);
  }

  async saveAndWaitForRequests(method: string, url: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(url) && resp.request().method() === method,
      { timeout: 10000 },
    );

    await this.resourceDetail().cruResource().saveOrCreate().click();
    await responsePromise;
  }

  globalRoleBindings(): import('@playwright/test').Locator {
    return this.page.locator('.global-permissions');
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
