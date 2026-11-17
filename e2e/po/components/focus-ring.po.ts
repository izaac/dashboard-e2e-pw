import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/** Computed outline of an element. The keyboard focus ring is painted with outline, never border */
export type OutlineState = {
  style: string;
  width: string;
  color: string;
};

/**
 * Generic reader for keyboard focus rings, design tokens and pointer state.
 *
 * The dashboard paints the focus ring with `outline: 2px solid
 * var(--primary-keyboard-focus)` under `:focus-visible`, so a ring must follow the
 * input modality that moved focus and nothing else. Everything here reads computed
 * values: no assertions and no screenshots, so a spec can assert on the paint itself.
 */
export default class FocusRingPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '.dashboard-root');
  }

  async outlineOf(locator: Locator): Promise<OutlineState> {
    return locator.evaluate((el) => {
      const { outlineStyle, outlineWidth, outlineColor } = window.getComputedStyle(el);

      return { style: outlineStyle, width: outlineWidth, color: outlineColor };
    });
  }

  /** Whether the browser is painting the keyboard ring on the element right now */
  async focusVisibleOf(locator: Locator): Promise<boolean> {
    return locator.evaluate((el) => el.matches(':focus-visible'));
  }

  /** Whether the element is `document.activeElement` */
  async isFocused(locator: Locator): Promise<boolean> {
    return locator.evaluate((el) => el === document.activeElement);
  }

  /** A plain mouse click, for targets nothing else steals focus from */
  async clickWithMouse(locator: Locator): Promise<void> {
    await locator.click();
  }

  /**
   * Hover and hold the mouse button down without releasing it. A pointer puts focus on the
   * element at mousedown, so the held press is the moment to read a target its own click
   * handler moves focus away from (a dropdown takes the first menu item) or removes from the
   * DOM (a menu item). The press is committed only once the element is what sits under the
   * cursor, so a settling layout or a closing overlay cannot send it somewhere else.
   */
  async mouseDownOn(locator: Locator): Promise<void> {
    await locator.hover();

    await expect
      .poll(async () => {
        if (await this.isUnderPointer(locator)) {
          return true;
        }

        await locator.hover();

        return false;
      })
      .toBe(true);

    await this.page.mouse.down();
  }

  /** Whether the element, or its own content, is what the browser would hit at its centre */
  async isUnderPointer(locator: Locator): Promise<boolean> {
    return locator.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);

      return hit !== null && (hit === el || el.contains(hit));
    });
  }

  /** Release a held mouse button where it is, completing the click */
  async releaseMouse(): Promise<void> {
    await this.page.mouse.up();
  }

  /**
   * Cancel a held press by releasing it on the top-left corner of the viewport. The press
   * never completes into a click, so a target the click would remove from the DOM (a menu
   * item) is still there to be read.
   */
  async releaseMouseAway(): Promise<void> {
    await this.page.mouse.move(0, 0);
    await this.page.mouse.up();
  }

  /**
   * Move focus to the target with the keyboard only: Tab until the target is
   * `document.activeElement`. Returns how many presses it took, which is how a spec shows the
   * target is a real tab stop rather than something only a script can focus. The walk resumes
   * from Chromium's sequential focus navigation starting point, where the last interaction left
   * it, and Tab wraps around the document, so any tab stop is reachable within the cap. Nothing
   * here focuses the target: keyboard modality is what the ring is keyed to.
   */
  async focusWithKeyboard(locator: Locator, maxPresses = 120): Promise<number> {
    await this.resetFocus();

    for (let presses = 1; presses <= maxPresses; presses += 1) {
      await this.page.keyboard.press('Tab');

      if (await this.isFocused(locator)) {
        return presses;
      }
    }

    throw new Error(`focusWithKeyboard: ${maxPresses} Tab presses never reached ${String(locator)}`);
  }

  /** Takes focus off the element the last phase left it on, so a Tab press cannot act on it */
  private async resetFocus(): Promise<void> {
    await this.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  }

  /** Computed value of a CSS property, in the canonical form the browser reports it */
  computedOf(locator: Locator, property: string): Promise<string> {
    return locator.evaluate((el, prop) => window.getComputedStyle(el).getPropertyValue(prop), property);
  }

  /**
   * Background the element actually shows: its own when it paints one, otherwise the first
   * ancestor that does. Unstyled nav groups are transparent and show the panel behind them.
   */
  paintedBackgroundOf(locator: Locator): Promise<string> {
    return locator.evaluate((el) => {
      const isPainted = (color: string) => color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)';

      let node: Element | null = el;

      while (node) {
        const color = window.getComputedStyle(node).backgroundColor;

        if (isPainted(color)) {
          return color;
        }

        node = node.parentElement;
      }

      return 'transparent';
    });
  }

  /**
   * Raw value of a custom property the app themes by. The dashboard puts its theme classes
   * on `body`, so that is where the tokens are declared rather than on the html element.
   */
  navToken(name: string): Promise<string> {
    return this.page.evaluate((token) => window.getComputedStyle(document.body).getPropertyValue(token).trim(), name);
  }

  /** Canonical colour a custom property resolves to, read the way the browser reads it */
  tokenColor(name: string): Promise<string> {
    return this.colorOf(`var(${name})`);
  }

  /** Canonical rgb() form of any CSS colour, so a token can be compared to a computed style */
  colorOf(value: string): Promise<string> {
    return this.page.evaluate((colour) => {
      const probe = document.createElement('span');

      probe.style.color = colour;
      document.body.append(probe);

      const resolved = window.getComputedStyle(probe).color;

      probe.remove();

      return resolved;
    }, value);
  }
}
