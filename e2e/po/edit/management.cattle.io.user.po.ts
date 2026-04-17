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

  async saveCreateWithErrorRetry(attempt = 1): Promise<void> {
    if (attempt > 3) {
      return;
    }

    const userCreationPromise = this.page.waitForResponse(
      (resp) => resp.url().includes('v1/management.cattle.io.users') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    await this.resourceDetail().cruResource().saveOrCreate().click();

    const userResp = await userCreationPromise;

    if (userResp.status() !== 201) {
      await this.page.waitForTimeout(1500);
      await this.saveCreateWithErrorRetry(attempt + 1);

      return;
    }

    const userBody = await userResp.json();
    const userId = userBody?.id;

    const bindingPromise = this.page.waitForResponse(
      (resp) => resp.url().includes('v3/globalrolebindings') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    const bindingResp = await bindingPromise;

    if (bindingResp.status() !== 201 && userId) {
      await this.page.request.delete(`v1/management.cattle.io.users/${userId}`);
      await this.page.waitForTimeout(2000);
      await this.saveCreateWithErrorRetry(attempt + 1);
    }
  }

  globalRoleBindings(): GlobalRoleBindingsPo {
    return new GlobalRoleBindingsPo(this.page);
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
