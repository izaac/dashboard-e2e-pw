import type { Page } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import DialogPo from '@/e2e/po/components/dialog.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

export default class GenericDialog extends ComponentPo {
  private dialog: DialogPo;

  constructor(page: Page, selector = '#modal-container-element') {
    super(page, selector);
    this.dialog = new DialogPo(page, selector);
  }

  labeledSelect(selector = '.labeled-select'): LabeledSelectPo {
    return new LabeledSelectPo(this.page, selector);
  }

  async clickActionButton(text: string): Promise<void> {
    await this.dialog.getActionButton().getByText(text).click();
  }
}
