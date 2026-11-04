import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import KeyValuePo from '@/e2e/po/components/key-value.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';

/**
 * Edit page for an existing secret: `/c/<cluster>/explorer/secret/<namespace>/<name>?mode=edit`
 */
export class SecretEditPagePo extends PagePo {
  constructor(page: Page, clusterId: string, namespace: string, name: string) {
    super(page, `/c/${clusterId}/explorer/secret/${namespace}/${name}`);
  }

  async goToEdit(): Promise<void> {
    await this.goTo('mode=edit');
  }

  createEditView(): CreateEditViewPo {
    return new CreateEditViewPo(this.page, ':scope', this.self());
  }

  tabs(): TabbedPo {
    return new TabbedPo(this.page, '[data-testid="tabbed"]');
  }

  /** Info banner shown instead of the data editor for helm release secrets */
  helmReleaseBanner(): Locator {
    return this.page.getByTestId('secret-helm-release-banner');
  }

  dataPanel(): Locator {
    return this.tabs().panel('data');
  }

  /** Add/remove buttons of the data key/value editor, scoped to the Data tab */
  dataEditorAddButton(): Locator {
    return this.dataPanel().getByTestId('add_row_item_button');
  }

  labelsTab(): Locator {
    return this.tabs().tab('labels');
  }

  labelsEditor(): KeyValuePo {
    return new KeyValuePo(this.page, '[data-testid="labels-keyvalue"]', this.tabs().panel('labels'));
  }

  /** Add one label row after the existing ones and fill it in */
  async addLabel(key: string, value: string): Promise<void> {
    await this.labelsTab().click();

    const editor = this.labelsEditor();

    await editor.addButton('Add Label').click();
    const keyInput = editor.self().locator('[data-testid^="input-kv-item-key-"]').last();
    const valueInput = editor
      .self()
      .locator('[data-testid^="kv-item-value-"]')
      .last()
      .locator('input, textarea')
      .first();

    await keyInput.fill(key);
    await valueInput.fill(value);
    // The key/value editor debounces model updates by 500ms, let it settle before the caller saves
    // eslint-disable-next-line playwright/no-wait-for-timeout -- no DOM signal exists for the debounce flush
    await this.page.waitForTimeout(750);
  }
}
