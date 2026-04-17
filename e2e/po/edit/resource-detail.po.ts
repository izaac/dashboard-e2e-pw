import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CruResourcePo from '@/e2e/po/components/cru-resource.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import ResourceYamlPo from '@/e2e/po/components/resource-yaml.po';
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

  title(): Locator {
    return this.self().locator('.title-bar h1.title, .primaryheader h1');
  }
}
