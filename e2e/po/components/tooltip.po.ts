import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

const TOOLTIP_CONTENT = '.v-popper__popper.v-popper--theme-tooltip .v-popper__inner';

/**
 * Wraps a tooltip trigger element. Hovering the trigger reveals the tooltip,
 * whose content renders in a page-level v-popper portal.
 */
export default class TooltipPo extends ComponentPo {
  constructor(page: Page, trigger: Locator) {
    super(page, ':scope', trigger);
  }

  /** Reveal the tooltip by hovering its trigger element. */
  async show(): Promise<void> {
    await this.self().hover();
  }

  /** The tooltip content node (rendered in the page-level popper portal). */
  content(): Locator {
    return this.page.locator(TOOLTIP_CONTENT);
  }
}
