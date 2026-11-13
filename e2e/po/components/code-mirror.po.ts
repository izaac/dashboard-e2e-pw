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

  /** Click into the CM6 content area so the editor receives focus */
  async focus(): Promise<void> {
    await this.content().click();
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
