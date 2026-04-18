import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export class CustomResourceDefinitionsPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/apiextensions.k8s.io.customresourcedefinition`;
  }

  constructor(
    page: Page,
    private clusterId = 'local',
  ) {
    super(page, CustomResourceDefinitionsPagePo.createPath(clusterId));
  }

  async create(): Promise<void> {
    await this.list().masthead().actions().filter({ hasText: 'Create from YAML' }).click();
  }

  crdCreateEditPo(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }

  sortableTable(): SortableTablePo {
    return this.list().resourceTable().sortableTable();
  }

  yamlEditor(): CodeMirrorPo {
    return CodeMirrorPo.bySelector(this.page, this.self(), '[data-testid="yaml-editor-code-mirror"]');
  }

  saveYamlButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]', this.self());
  }
}
