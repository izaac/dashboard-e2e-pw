import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

const CARD = '.popover-card';
const CARD_ID = '#popover-card';
const POPPER = '.v-popper__popper';
const PROJECT_ROW = "[data-testid='masthead-subheader-project']";
const CARD_MARKER = 'p18178';
const CARD_MARKER_ATTR = 'data-qa-probe';

/** Counts accumulated by the card mount observer, see installCardMountCounter() */
export interface CardMountCounts {
  added: number;
  removed: number;
}

/** Intersection transitions recorded by installVisibilityWatch() */
export interface CardVisibilityStates {
  hidden: number;
  shown: number;
  callbacks: number;
}

/**
 * A lazy resource popover. The card renders in a page-level popper portal,
 * so card content is always resolved from the page rather than the trigger.
 */
export default class ResourcePopoverPo extends ComponentPo {
  private updateFrames: string[] = [];

  constructor(page: Page, parent?: Locator, selector = '.resource-popover') {
    super(page, selector, parent);
  }

  /**
   * Project row of the namespace detail masthead sub-header (#18178). Scoped by
   * the stable test id rather than the row value id, which follows the project
   * display name and therefore changes while a test updates it.
   */
  static forProjectRow(page: Page): ResourcePopoverPo {
    return new ResourcePopoverPo(page, page.locator(PROJECT_ROW), ':scope');
  }

  /** Hoverable/clickable trigger wrapping the resource name. */
  target(): Locator {
    return this.self().locator('.popover-card-target');
  }

  /** Resource name inside the trigger, e.g. the project display name. */
  display(): Locator {
    return this.self().locator('.display').first();
  }

  /** Keyboard-focusable chevron that opens the card. */
  focusButton(): Locator {
    return this.self().locator('.focus-button');
  }

  card(): Locator {
    return this.page.locator(CARD).first();
  }

  /** The card the test tagged with markCard(), i.e. the same DOM node */
  markedCard(): Locator {
    return this.page.locator(`${CARD}[${CARD_MARKER_ATTR}="${CARD_MARKER}"]`).first();
  }

  /** Popper that wraps the mounted card, so menu lookups cannot hit a stale popper */
  cardPopper(): Locator {
    return this.card().locator('xpath=ancestor::div[contains(@class, "v-popper__popper")][1]');
  }

  /** Title line of the card, e.g. the project display name. */
  cardTitle(): Locator {
    return this.card().locator('.title').first();
  }

  readyIndicator(): Locator {
    return this.card().locator('.ready-indicator');
  }

  /** A labelled glance row, e.g. "Pod IP" or "Internal IP". */
  row(label: string): Locator {
    return this.card().locator('.row').filter({ hasText: label }).first();
  }

  usage(): Locator {
    return this.card().getByTestId('resource-popover-usage');
  }

  usageItem(name: 'cpu' | 'memory' | 'pods'): Locator {
    return this.card().getByTestId(`resource-popover-usage-${name}`);
  }

  loading(): Locator {
    return this.card().getByTestId('resource-popover-loading');
  }

  error(): Locator {
    return this.card().getByTestId('resource-popover-error');
  }

  /** Actions kebab in the card heading. */
  actionsButton(): Locator {
    return this.card().getByTestId('resource-popover-action-menu');
  }

  /**
   * Actions menu of the active card only. Two poppers match "Edit Config" while
   * the menu is open, because the menu popper renders inside the card popper:
   * anchor on the card's own popper and keep the nested one without the card.
   */
  actionsMenu(): Locator {
    return this.cardPopper()
      .locator(POPPER)
      .filter({ hasNot: this.page.locator(CARD_ID) })
      .filter({ hasText: 'Edit Config' })
      .first();
  }

  async hover(): Promise<void> {
    const size = this.page.viewportSize();

    // Park the pointer first so a later hover fires a fresh pointerenter, which
    // is what re-opens the card after Escape.
    await this.page.mouse.move(size ? size.width - 2 : 1, size ? size.height - 2 : 1);
    await this.display().hover();
  }

  async waitForCard(): Promise<void> {
    await this.card().waitFor({ state: 'visible' });
  }

  /** Tag the mounted card so a replacement node can be told apart later */
  async markCard(): Promise<void> {
    await this.card().evaluate((el, marker) => el.setAttribute('data-qa-probe', marker), CARD_MARKER);
  }

  async openActionsMenu(): Promise<void> {
    await this.actionsButton().click();
  }

  /** True while the actions menu of the active card is on screen. */
  async isActionsMenuOpen(): Promise<boolean> {
    return this.actionsMenu().isVisible();
  }

  /** Escape closes the menu and the card, then the pointer is parked for the next hover. */
  async close(): Promise<void> {
    const size = this.page.viewportSize();

    await this.page.keyboard.press('Escape');
    await this.page.mouse.move(size ? size.width - 2 : 1, size ? size.height - 2 : 1);
  }

  /**
   * Count card mounts and unmounts from now on. A MutationObserver on body
   * records every added or removed subtree that is, or contains, the popover
   * card, so a card re-created by a resource update shows up as removed > 0.
   */
  async installCardMountCounter(): Promise<void> {
    await this.page.evaluate(() => {
      const isCard = (node: Node): boolean => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return false;
        }

        const el = node as Element;

        return el.id === 'popover-card' || el.matches('.popover-card') || !!el.querySelector('#popover-card');
      };

      const counts = { added: 0, removed: 0 };

      (window as any).__popoverProbe = counts;

      const observer = new MutationObserver((records) => {
        for (const record of records) {
          record.addedNodes.forEach((node) => {
            if (isCard(node)) {
              counts.added += 1;
            }
          });
          record.removedNodes.forEach((node) => {
            if (isCard(node)) {
              counts.removed += 1;
            }
          });
        }
      });

      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      (window as any).__popoverProbeObserver = observer;
    });
  }

  /** Counts recorded since installCardMountCounter(). */
  async cardMountCounts(): Promise<CardMountCounts> {
    return this.page.evaluate(() => (window as any).__popoverProbe ?? { added: 0, removed: 0 });
  }

  /**
   * Record visible/hidden transitions of the mounted card. A card that only
   * blinks (display:none then back) is never removed, so the mount counter
   * cannot see it; the intersection observer can. Must run with the card up.
   */
  async installVisibilityWatch(): Promise<void> {
    await this.page.evaluate(() => {
      const card = document.querySelector('#popover-card');

      if (!card) {
        throw new Error('popover card is not mounted');
      }

      const states = { hidden: 0, shown: 0, callbacks: 0 };
      let wasVisible = false;

      (window as any).__popoverVisibility = states;

      const observer = new IntersectionObserver((entries) => {
        states.callbacks += entries.length;
        for (const entry of entries) {
          if (entry.isIntersecting && !wasVisible) {
            states.shown += 1;
          }
          if (!entry.isIntersecting && wasVisible) {
            states.hidden += 1;
          }
          wasVisible = entry.isIntersecting;
        }
      });

      observer.observe(card);
      (window as any).__popoverVisibilityObserver = observer;
    });
  }

  /** Transitions recorded since installVisibilityWatch(). */
  async visibilityStates(): Promise<CardVisibilityStates> {
    return this.page.evaluate(() => (window as any).__popoverVisibility ?? { hidden: 0, shown: 0, callbacks: 0 });
  }

  /** Stop both observers and drop the globals, so a failed test leaves nothing running */
  async disposeProbes(): Promise<void> {
    await this.page
      .evaluate(() => {
        (window as any).__popoverProbeObserver?.disconnect();
        (window as any).__popoverVisibilityObserver?.disconnect();
        delete (window as any).__popoverProbe;
        delete (window as any).__popoverProbeObserver;
        delete (window as any).__popoverVisibility;
        delete (window as any).__popoverVisibilityObserver;
      })
      .catch(() => {
        // Page may already be gone; there is nothing left to disconnect
      });
  }

  /**
   * Record live subscription frames that mention marker. Must run before the
   * page navigates: the dashboard opens its subscriptions on load and
   * Playwright only reports sockets created after the listener is attached.
   */
  observeResourceUpdates(marker: string): void {
    this.page.on('websocket', (socket) => {
      socket.on('framereceived', (frame) => {
        const payload = typeof frame.payload === 'string' ? frame.payload : '';

        if (payload.includes('resource.change') && payload.includes(marker)) {
          this.updateFrames.push(payload);
        }
      });
    });
  }

  /** Annotation values parsed out of the captured update frames, newest last */
  frameAnnotationValues(annotationKey: string): string[] {
    const pattern = new RegExp(`"${annotationKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}":"([^"]*)"`, 'g');

    return this.updateFrames.flatMap((payload) => [...payload.matchAll(pattern)].map((match) => match[1]));
  }
}
