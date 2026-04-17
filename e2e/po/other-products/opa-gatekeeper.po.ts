import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export default class OpaGatekeeperPo extends PagePo {
  constructor(page: Page, clusterId = 'local') {
    super(page, `/c/${clusterId}/gatekeeper`);
  }

  create(): Locator {
    return this.self().locator('[data-testid="masthead-create"]');
  }

  selectConstraintSubtype(subtype: string): Locator {
    return this.page.getByTestId(`subtype-banner-item-${subtype}`);
  }

  createFromYaml(): Locator {
    return this.self().locator('[data-testid="masthead-create-yaml"]');
  }

  saveCreateForm(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]');
  }
}
