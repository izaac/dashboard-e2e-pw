import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';

export default class ResourceYamlPo extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '.resource-yaml', parent);
  }

  body(): Locator {
    return this.self().locator('.codemirror-container');
  }

  footer(): Locator {
    return this.self().locator('.footer');
  }

  codeMirror(): CodeMirrorPo {
    return CodeMirrorPo.bySelector(this.page, this.self(), '[data-testid="yaml-editor-code-mirror"]');
  }

  cancel(): Locator {
    return this.self().locator('button.role-secondary');
  }

  saveOrCreate(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]', this.self());
  }
}
