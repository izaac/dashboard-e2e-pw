import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

export class ImportYamlPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="import-yaml"]');
  }

  importYamlEditor(): CodeMirrorPo {
    return CodeMirrorPo.bySelector(this.page, this.self(), '[data-testid="yaml-editor-code-mirror"]');
  }

  async importYamlSuccessTitleCheck(): Promise<void> {
    await expect(this.self().locator('[data-testid="import-yaml-success"]')).toBeVisible();
  }

  async importYamlImportClick(): Promise<void> {
    await this.self().locator('[data-testid="import-yaml-import-action"]').click();
  }

  async importYamlCloseClick(): Promise<void> {
    await this.self().locator('[data-testid="import-yaml-close"]').click();
  }

  async importYamlCancelClick(): Promise<void> {
    await this.self().locator('[data-testid="import-yaml-cancel"]').click();
  }

  importYamlSortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, ':scope', this.self());
  }
}
