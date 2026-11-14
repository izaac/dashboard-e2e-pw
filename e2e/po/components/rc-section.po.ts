import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * RcSection (shell/rancher-components/RcSection): a collapsible section located by the visible text of its own
 * header title. The header is matched through a direct child, so a section is never matched by the titles of the
 * sections nested in its content.
 */
export default class RcSectionPo extends ComponentPo {
  constructor(page: Page, title: string, parent?: Locator) {
    super(page, `.rc-section:has(> .section-header .title:text-is(${JSON.stringify(title)}))`, parent);
  }

  header(): Locator {
    return this.self().locator('> .section-header');
  }

  /** Expand/collapse chevron, carries `aria-expanded` */
  toggleButton(): Locator {
    return this.header().locator('.toggle-button');
  }

  /** Red icon rendered in the header while the section holds invalid fields */
  invalidFieldsIcon(): Locator {
    return this.header().getByTestId('rc-section-invalid-fields');
  }

  content(): Locator {
    return this.self().locator('> .section-content');
  }

  async toggle(): Promise<void> {
    await this.toggleButton().click();
  }

  async hoverInvalidFieldsIcon(): Promise<void> {
    await this.invalidFieldsIcon().hover();
  }
}
