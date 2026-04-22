import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';

export default class AddonConfigPo extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '.dashboard-root', parent);
  }

  yamlEditor(): CodeMirrorPo {
    return CodeMirrorPo.bySelector(this.page, this.self(), '[data-testid="addon-yaml-editor"]');
  }
}
