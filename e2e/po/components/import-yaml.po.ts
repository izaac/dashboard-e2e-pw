import type { Page, Locator } from '@playwright/test';
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

  /** Locator for the success indicator */
  successIndicator(): Locator {
    return this.self().locator('[data-testid="import-yaml-success"]');
  }

  importButton(): Locator {
    return this.self().locator('[data-testid="import-yaml-import-action"]');
  }

  closeButton(): Locator {
    return this.self().locator('[data-testid="import-yaml-close"]');
  }

  cancelButton(): Locator {
    return this.self().locator('[data-testid="import-yaml-cancel"]');
  }

  importYamlSortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, ':scope', this.self());
  }
}
