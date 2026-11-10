import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Resource Quotas tab content of the namespace create/edit form.
 */
export default class ResourceQuotaPo extends ComponentPo {
  constructor(page: Page, selector = '[data-testid="tab-panel-container-resource-quotas"]', parent?: Locator) {
    super(page, selector, parent);
  }

  /** Error banner shown when the namespace resource quota annotation cannot be parsed. */
  invalidAnnotationBanner(): Locator {
    return this.self().getByTestId('resource-quota-invalid-annotation');
  }

  /** Text content of the invalid annotation banner. */
  bannerContent(): Locator {
    return this.invalidAnnotationBanner().getByTestId('banner-content');
  }

  /** Quota limit input fields of the quota form. */
  quotaInputs(): Locator {
    return this.self().locator('input:not([disabled])');
  }
}
