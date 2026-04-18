import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export class ServicesPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/service`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, ServicesPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, ':scope', this.self());
  }

  async clickCreate(): Promise<void> {
    await this.list().masthead().create();
  }

  mastheadTitle(): Locator {
    return this.page.locator('.primaryheader h1, .title h1');
  }

  nameInput(): Locator {
    return this.page.getByTestId('name-ns-description-name').locator('input');
  }

  descriptionInput(): Locator {
    return this.page.getByTestId('name-ns-description-description').locator('input');
  }

  formSave(): Locator {
    return this.page.getByTestId('form-save');
  }

  errorBanner(): Locator {
    return this.page.locator('.banner.error');
  }

  externalNameTab(): Locator {
    return this.page.getByRole('heading', { name: 'External Name' });
  }

  externalNameInput(): Locator {
    return this.page.getByRole('textbox', { name: 'DNS Name' });
  }
}
