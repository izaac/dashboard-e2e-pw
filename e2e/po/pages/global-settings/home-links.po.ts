import type { Page, Locator } from '@playwright/test';
import RootClusterPage from '@/e2e/po/pages/root-cluster-page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export class HomeLinksPagePo extends RootClusterPage {
  static url = '/c/_/settings/links';

  constructor(page: Page) {
    super(page, HomeLinksPagePo.url);
  }

  addLinkButton(): Locator {
    return this.page.getByTestId('add_row_item_button');
  }

  displayTextInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '.kv-item.key input', this.self());
  }

  urlInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="value-multiline"]');
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]');
  }

  defaultLinkCheckboxes(): Locator {
    return this.page.locator('div.link-show-hide-checkbox');
  }

  supportLinks(): Locator {
    return this.page.locator('.support-link a');
  }

  removeItemButton(): Locator {
    return this.page.getByTestId('remove-column-0');
  }
}
