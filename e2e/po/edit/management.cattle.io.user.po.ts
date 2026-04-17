import type { Page, Response } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import ComponentPo from '@/e2e/po/components/component.po';

class GlobalRoleBindingsPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '.global-permissions');
  }

  async globalOptions(): Promise<string[]> {
    const labels = this.self().locator('.checkbox-section--global .checkbox-label-slot .checkbox-label');
    const count = await labels.count();
    const options: string[] = [];

    for (let i = 0; i < count; i++) {
      options.push(await labels.nth(i).innerText());
    }

    return options;
  }
}

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

  async saveAndWaitForRequests(method: string, url: string): Promise<Response> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(url) && resp.request().method() === method,
      { timeout: 10000 },
    );

    await this.resourceDetail().cruResource().saveOrCreate().click();

    return responsePromise;
  }

  globalRoleBindings(): GlobalRoleBindingsPo {
    return new GlobalRoleBindingsPo(this.page);
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
