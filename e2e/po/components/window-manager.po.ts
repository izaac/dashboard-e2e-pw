import type { Locator, Page } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Window manager (bottom dock hosting kubectl shell, pod logs, etc.).
 * Exposes the tab strip structure so specs can assert ARIA tab semantics.
 */
export default class WindowManagerPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '#horizontal-window-manager');
  }

  tabLists(): Locator {
    return this.self().locator('[role="tablist"]');
  }

  tabs(): Locator {
    return this.self().locator('[role="tab"]');
  }

  /** Buttons that are direct children of a tablist but do not carry role="tab" */
  nonTabButtonsInTabLists(): Locator {
    return this.self().locator('[role="tablist"] button:not([role="tab"])');
  }

  /** Interactive descendants nested inside a tab (violates nested-interactive) */
  interactiveInsideTabs(): Locator {
    return this.self().locator(
      '[role="tab"] button, [role="tab"] a, [role="tab"] input, [role="tab"] select, [role="tab"] textarea, [role="tab"] [tabindex]',
    );
  }

  closeButtons(): Locator {
    return this.self().getByTestId('wm-tab-close-button');
  }

  closeButtonsInsideTabs(): Locator {
    return this.self().locator('[role="tab"] [data-testid="wm-tab-close-button"]');
  }

  /**
   * For every tablist, the aria-owns ids and the subset that resolve to an existing role="tab" element.
   */
  async tabListOwnership(): Promise<Array<{ owned: string[]; missing: string[] }>> {
    return this.tabLists().evaluateAll((lists) =>
      lists.map((list) => {
        const owned = (list.getAttribute('aria-owns') || '').split(/\s+/).filter(Boolean);
        const missing = owned.filter((id) => document.getElementById(id)?.getAttribute('role') !== 'tab');

        return { owned, missing };
      }),
    );
  }
}
