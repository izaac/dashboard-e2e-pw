import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * CodeMirror page object supporting both CM5 (`.CodeMirror`) and CM6 (`.cm-editor`).
 *
 * `self()` may resolve to a wrapper (e.g. a data-testid element), the CM6 `.cm-editor`
 * root, or the CM5 `.CodeMirror` root; the editor instance is resolved from it in-page.
 */
export default class CodeMirrorPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  static byLabel(_page: Page, _parent: Locator, _label: string): CodeMirrorPo {
    throw new Error('Not implemented');
  }

  static bySelector(page: Page, parent: Locator, selector: string): CodeMirrorPo {
    return new CodeMirrorPo(page, `${selector} .cm-editor, ${selector} .CodeMirror`, parent);
  }

  async set(value: string): Promise<void> {
    const cm = this.self();

    await cm.waitFor({ state: 'visible' });

    const isCM5 = await cm.evaluate((el: any) => !!(el.CodeMirror || el.querySelector?.('.CodeMirror')));

    if (isCM5) {
      await cm.evaluate((el: any, val: string) => {
        (el.CodeMirror ? el : el.querySelector('.CodeMirror')).CodeMirror.setValue(val);
      }, value);

      return;
    }

    // Real-user path (CM6): focus the content area, select all, and paste. `insertText` avoids
    // CodeMirror's auto-indent on typed newlines, and drives the app's own input pipeline
    // (dispatch on a captured `cmTile.view` can hit a stale view and never syncs the app).
    await this.focus();
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.keyboard.insertText(value);
  }

  async value(): Promise<string> {
    return this.self().evaluate((el: any) => {
      // CM6 attaches the EditorView to the `.cm-content` element (`cmTile.view`)
      const cm6 =
        (el.matches?.('.cm-content') && el) ||
        el.querySelector?.('.cm-content') ||
        (el.matches?.('.cm-editor') ? el.querySelector('.cm-content') : null);

      if (cm6?.cmTile?.view) {
        return cm6.cmTile.view.state.doc.toString();
      }

      const cm5 = el.CodeMirror ? el : el.querySelector('.CodeMirror');

      return cm5.CodeMirror.getValue();
    });
  }

  async clear(): Promise<void> {
    await this.set('');
  }

  /** CM6 editable content area (`.cm-content`) */
  content(): Locator {
    return this.self().locator('.cm-content').first();
  }

  /**
   * CM6 scroll container (`.cm-scroller`): the element that actually owns the
   * horizontal/vertical scroll and meaningful `scrollWidth`/`clientWidth` values.
   *
   * `.or(...).last()` prefers the scroller whenever it exists and falls back to
   * the component root ONLY when it does not — CM5 wrappers (`.CodeMirror`) have
   * no `.cm-scroller`. Do not express this as `locator('.cm-scroller, .cm-editor')
   * .first()`: the editor root is an ANCESTOR of the scroller, so document order
   * resolves to the root, which is `overflow: hidden` — scroll-width checks would
   * be vacuous and below-content geometry would read from the wrong box.
   */
  scroller(): Locator {
    return this.self().or(this.self().locator('.cm-scroller')).last();
  }

  /**
   * Click in the blank area BELOW the document text, inside the scroller.
   *
   * With a short document the `.cm-content` element only covers the written lines, so a real user
   * click in the empty space under it lands on the scroller. That click used to be swallowed (no
   * caret, typing went nowhere) - see rancher/dashboard#19800.
   *
   * Throws when the content already reaches the bottom of the scroller, because there is no blank
   * area to click and the call would silently degrade into a normal in-content click, hiding a
   * regression of rancher/dashboard#19800 behind a green test. Use a shorter document or a
   * smaller `offsetPx` in that case.
   */
  async clickBelowContent(offsetPx = 24): Promise<void> {
    const contentBox = await this.content().boundingBox();
    const scrollerBox = await this.scroller().boundingBox();

    if (!contentBox || !scrollerBox) {
      throw new Error('CodeMirror content or scroller is not visible');
    }

    // Stay horizontally inside the text columns, vertically below the content but inside the scroller
    const x = contentBox.x + Math.min(contentBox.width / 2, 100);
    const contentBottom = contentBox.y + contentBox.height;
    const scrollerBottom = scrollerBox.y + scrollerBox.height;
    const y = Math.min(contentBottom + offsetPx, scrollerBottom - 2);

    if (y <= contentBottom + 1) {
      throw new Error(
        `clickBelowContent found no blank area below the document (rancher/dashboard#19800): ` +
          `contentBox=${JSON.stringify(contentBox)} scrollerBox=${JSON.stringify(scrollerBox)} ` +
          `offsetPx=${offsetPx}`,
      );
    }

    await this.page.mouse.click(x, y);
  }

  /** Click into the CM6 content area so the editor receives focus */
  async focus(): Promise<void> {
    await this.content().click();
  }

  /** CM6 line-number gutter (`.cm-lineNumbers`); absent on read-only consumers */
  lineNumbers(): Locator {
    return this.self().locator('.cm-lineNumbers');
  }

  /** CM6 fold gutter (`.cm-foldGutter`) */
  foldGutter(): Locator {
    return this.self().locator('.cm-foldGutter');
  }

  /**
   * Fold markers inside the fold gutter, in document order. The dashboard renders
   * them with the `.rc-cm-fold-marker` class; clicking one folds/unfolds the node
   * that starts on that line.
   *
   * `:visible` skips the zero-height measurement/placeholder gutter copies that
   * CodeMirror keeps hidden in the DOM.
   *
   * Note: the YAML fold service offers ranges for multi-line block pairs, so the
   * first marker folds the WHOLE document only when the root has a single key on
   * line 1 owning all other lines.
   */
  foldMarkers(): Locator {
    return this.self().locator('.cm-foldGutter .rc-cm-fold-marker:visible');
  }

  /**
   * Number of rendered document lines. Folded regions collapse into their start
   * line, so a fully folded document counts as 1.
   */
  async lineCount(): Promise<number> {
    return this.content().locator('> .cm-line').count();
  }

  /**
   * Visual rows a single document line occupies once soft-wrapped. Line wrapping
   * (`.cm-lineWrapping`) keeps one `.cm-line` element, so this counts the distinct
   * client-rect rows of that element's content instead of DOM nodes.
   */
  async visualRowCount(lineIndex = 0): Promise<number> {
    return this.content().evaluate((el: any, index: number) => {
      const line = el.querySelectorAll(':scope > .cm-line')[index];

      if (!line) {
        return 0;
      }

      const range = document.createRange();

      range.selectNodeContents(line);

      const tops = new Set(
        Array.from(range.getClientRects())
          .filter((rect) => rect.height > 0)
          .map((rect) => Math.round(rect.top)),
      );

      return tops.size;
    }, lineIndex);
  }

  /** True when the scroller shows horizontal overflow (content wider than the viewport) */
  async hasHorizontalOverflow(): Promise<boolean> {
    return this.scroller().evaluate((el) => el.scrollWidth > el.clientWidth);
  }

  /**
   * True when the content area declares itself non-editable: `contenteditable=false`
   * and `aria-readonly=true`, the read-only CodeMirror consumer contract.
   */
  async isReadOnly(): Promise<boolean> {
    return this.content().evaluate(
      (el) => el.getAttribute('contenteditable') === 'false' && el.getAttribute('aria-readonly') === 'true',
    );
  }

  /**
   * True when this editor owns the current focus: the CM6 `cm-focused` class on the
   * editor root, or the document's active element inside it. Guards typing tests:
   * when focus went elsewhere the keystrokes land nowhere, and a value-unchanged
   * assertion would falsely pass the read-only rejection it is supposed to prove.
   */
  async isFocused(): Promise<boolean> {
    return this.self().evaluate(
      (el) =>
        el.classList.contains('cm-focused') || (document.activeElement !== null && el.contains(document.activeElement)),
    );
  }

  /**
   * Move real focus away from this editor so the app's `@focusout` sync fires.
   * The `@focusout` handler is bound on the surrounding `.values-pane` div, so the
   * reliable way to trigger it is to focus a real target outside the pane.
   */
  async blur(): Promise<void> {
    await this.focus();

    const body = this.page.locator('body');

    if (await body.evaluate((el) => el.classList.contains('overflow-hidden'))) {
      // Modal locks the page: dispatching focusout still reaches the pane handler
      await this.content().evaluate((el) => {
        el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      });

      return;
    }

    // Real focus move: click the first heading (or body corner) outside the editor
    const outside = this.page.locator('h1:visible, h4:visible, header:visible').first();

    if (await outside.count()) {
      await outside.click({ position: { x: 5, y: 5 } }).catch(async () => {
        await body.click({ position: { x: 1, y: 1 } });
      });
    } else {
      await body.click({ position: { x: 1, y: 1 } });
    }
  }
}
