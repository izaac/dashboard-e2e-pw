import type { Locator, Page } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * A status summary card of the Cluster Dashboard resource status group (Nodes, Deployments): a stacked
 * status bar and one row per state with a label (link to the list filtered to that state) and a count badge.
 * The card root carries `aria-label="<Title>: <total> total"`.
 */
export default class StatusSummaryCardPo extends ComponentPo {
  /** @param title Card title as used in the aria-label prefix, e.g. "Nodes" or "Deployments" */
  constructor(page: Page, title: string, parent?: Locator) {
    super(page, `[data-testid="status-summary-card"][aria-label^="${title}:"]`, parent);
  }

  title(): Locator {
    return this.self().locator('.title');
  }

  /** One row per state present in the card */
  stateRows(): Locator {
    return this.self().locator('li.status-row');
  }

  /** The row of a state, matched on its exact label (e.g. "Active", "Error") */
  stateRow(label: string): Locator {
    return this.stateRows().filter({
      has: this.page.locator('.label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }),
    });
  }

  stateBadge(label: string): Locator {
    return this.stateRow(label).getByTestId('rc-counter-badge');
  }

  /** Link on the state label, opening the list filtered to that state */
  stateLink(label: string): Locator {
    return this.stateRow(label).locator('.label a');
  }

  async focusStateLink(label: string): Promise<void> {
    await this.stateLink(label).focus();
  }

  async clickTitle(): Promise<void> {
    await this.title().click();
  }
}
