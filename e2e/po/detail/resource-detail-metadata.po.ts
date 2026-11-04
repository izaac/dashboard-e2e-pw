import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * The Metadata grid in the resource detail masthead
 * (shell/components/Resource/Detail/Metadata/index.vue): an optional
 * identifying-info column followed by the labels and annotations blocks.
 */
export default class ResourceDetailMetadataPo extends ComponentPo {
  constructor(page: Page, selector = '.spaced-row.metadata') {
    super(page, selector);
  }

  identifyingInfo(): Locator {
    return this.self().locator('.identifying-info');
  }

  firstColumn(): Locator {
    return this.self().locator('> :first-child');
  }
}
