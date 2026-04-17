import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CruResourcePo from '@/e2e/po/components/cru-resource.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import ResourceYamlPo from '@/e2e/po/components/resource-yaml.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';

export default class ResourceDetailPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  cruResource(): CruResourcePo {
    return new CruResourcePo(this.page, ':scope', this.self());
  }

  createEditView(): CreateEditViewPo {
    return new CreateEditViewPo(this.page, ':scope', this.self());
  }

  resourceYaml(): ResourceYamlPo {
    return new ResourceYamlPo(this.page, this.self());
  }

  tabs(): TabbedPo {
    return new TabbedPo(this.page, '[data-testid="tabbed"]');
  }

  tabbedList(tabId: string, index?: number): ResourceTablePo {
    const baseSelector = `#${tabId} [data-testid="sortable-table-list-container"]`;
    const selector = tabId === 'related' ? `${baseSelector}:nth-of-type(${index})` : baseSelector;

    return new ResourceTablePo(this.page, selector);
  }

  title(): Locator {
    return this.self().locator('.title-bar h1.title, .primaryheader h1');
  }

  masthead(): Locator {
    return this.self().locator('.resource-detail-masthead');
  }

  resourceGauges(): Locator {
    return this.self().locator('.status-row');
  }
}
