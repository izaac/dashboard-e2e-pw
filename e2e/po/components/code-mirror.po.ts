import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class CodeMirrorPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  static byLabel(_page: Page, _parent: Locator, _label: string): CodeMirrorPo {
    throw new Error('Not implemented');
  }

  static bySelector(page: Page, parent: Locator, selector: string): CodeMirrorPo {
    return new CodeMirrorPo(page, `${selector} .CodeMirror`, parent);
  }

  async set(value: string): Promise<void> {
    const cm = this.self();

    await cm.waitFor({ state: 'visible' });
    await cm.evaluate((el: any, val: string) => {
      el.CodeMirror.setValue(val);
    }, value);
  }

  async value(): Promise<string> {
    return this.self().evaluate((el: any) => {
      return el.CodeMirror.getValue();
    });
  }

  async clear(): Promise<void> {
    await this.set('');
  }
}
