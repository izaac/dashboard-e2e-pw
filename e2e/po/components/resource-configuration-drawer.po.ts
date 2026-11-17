import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';

/**
 * Resource "Show Configuration" drawer (`aside.slide-in`), opened from a row or
 * masthead action menu. Its YAML tab hosts the read-only shared CodeMirror
 * consumer (rancher/dashboard#19236): no line-number gutter, `contenteditable=false`
 * and `aria-readonly=true` on the content.
 */
export default class ResourceConfigurationDrawerPo extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, 'aside.slide-in', parent);
  }

  /** The drawer's YAML tab */
  yamlTab(): Locator {
    return this.self().getByRole('tab', { name: 'YAML' });
  }

  /** The CodeMirror editor rendered by the YAML tab */
  codeMirror(): CodeMirrorPo {
    return CodeMirrorPo.bySelector(this.page, this.self(), '[data-testid="yaml-editor-code-mirror"]');
  }

  /**
   * The drawer's close control. Both the header X and the footer button carry the
   * same dynamic aria-label ("Close <resource> (<kind>) - Configuration drawer"),
   * so they are matched by that suffix and the first in DOM order (the header X) wins.
   */
  closeButton(): Locator {
    return this.self()
      .getByRole('button', { name: /Configuration drawer/ })
      .first();
  }

  /**
   * Dismiss the drawer with its close control. A closed drawer stays mounted and
   * becomes inert (`aria-hidden=true`, `slide-in-open` removed), so completion is
   * detected by the open class going away rather than detachment or visibility.
   */
  async close(): Promise<void> {
    await this.closeButton().click();
    await this.page.waitForFunction(() => document.querySelector('.slide-in-open') === null, null, {
      timeout: 10_000,
    });
  }
}
