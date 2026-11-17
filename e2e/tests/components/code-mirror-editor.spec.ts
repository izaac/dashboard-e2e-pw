import { test, expect } from '@/support/fixtures';
import type { Page } from '@playwright/test';
import { ConfigMapsPagePo } from '@/e2e/po/pages/explorer/configmaps.po';
import ResourceYamlPo from '@/e2e/po/components/resource-yaml.po';
import ResourceConfigurationDrawerPo from '@/e2e/po/components/resource-configuration-drawer.po';

/**
 * Coverage for the shared CodeMirror 6 editor (rancher/dashboard#19236).
 *
 * Consumers driven here from one ConfigMap:
 * - the row-action "Edit YAML" dialog (editable: line-number gutter, fold gutter);
 * - the row-action "Show Configuration" drawer, YAML tab (read-only: no line
 *   numbers, `contenteditable=false`, `aria-readonly=true`, typing rejected).
 *
 * The keymap is a user preference (`keymap`: `sublime` default, `emacs`, `vim`);
 * the keymap test restores the original value in a finally.
 */

/** User preference holding the CodeMirror keymap */
const KEYMAP_PREF = 'keymap';

/**
 * YAML document for the fold test: 61 lines, with a single root key on line 1
 * owning every other line, so the first fold marker folds the whole document.
 * (The YAML fold service offers pair nodes; a multi-key root has no whole-document range.)
 */
function buildFoldDocument(): string {
  const lines = ['data:'];

  for (let i = 0; i < 60; i++) {
    lines.push(`  key${i}: value${i}`);
  }

  return lines.join('\n');
}

test.describe('Shared CodeMirror 6 editor', { tag: ['@components', '@adminUser'] }, () => {
  let namespace: string;
  let configMapName: string;

  test.beforeEach(async ({ login, rancherApi }) => {
    await login();

    // Unique per test: `createE2EResourceName` is worker-stable, and the previous
    // test's namespace cascade can still be finalising when the next beforeEach runs
    const stamp = Date.now();

    namespace = rancherApi.createE2EResourceName(`cm-editor-ns-${stamp}`);
    configMapName = rancherApi.createE2EResourceName(`cm-editor-${stamp}`);

    await rancherApi.createNamespace(namespace);
    await rancherApi.createConfigMap(namespace, configMapName, { data: { foo: 'bar' } });
  });

  test.afterEach(async ({ rancherApi }) => {
    await rancherApi.deleteRancherResource('v1', 'configmaps', `${namespace}/${configMapName}`, false);
    await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
  });

  /** Opens the ConfigMaps list and waits until this spec's ConfigMap row is actionable */
  async function openConfigMapsList(page: Page): Promise<ConfigMapsPagePo> {
    const configMaps = new ConfigMapsPagePo(page);

    await configMaps.goTo();
    await configMaps.waitForPage();

    const table = configMaps.list().resourceTable().sortableTable();

    await table.checkLoadingIndicatorNotVisible();
    await expect(table.rowWithName(configMapName).self()).toBeVisible({ timeout: 60_000 });

    return configMaps;
  }

  /** Opens the row-action "Edit YAML" dialog and waits for its CodeMirror editor */
  async function openEditYaml(page: Page, configMaps: ConfigMapsPagePo): Promise<ResourceYamlPo> {
    const menu = await configMaps.list().actionMenu(configMapName);

    await menu.getMenuItem('Edit YAML').click();

    const yaml = new ResourceYamlPo(page);

    await expect(yaml.codeMirror().self()).toBeVisible({ timeout: 30_000 });

    return yaml;
  }

  /** Abandons the "Edit YAML" dialog (Cancel) without saving */
  async function closeEditYaml(yaml: ResourceYamlPo): Promise<void> {
    await yaml.cancelButton().click();
    await expect(yaml.self()).toBeHidden();
  }

  /** Opens the row-action "Show Configuration" drawer with the YAML tab active */
  async function openShowConfiguration(
    page: Page,
    configMaps: ConfigMapsPagePo,
  ): Promise<ResourceConfigurationDrawerPo> {
    const menu = await configMaps.list().actionMenu(configMapName);

    await menu.getMenuItem('Show Configuration').click();

    const drawer = new ResourceConfigurationDrawerPo(page);

    await expect(drawer.self()).toBeVisible({ timeout: 30_000 });
    await drawer.yamlTab().click();
    await expect(drawer.codeMirror().self()).toBeVisible({ timeout: 30_000 });

    return drawer;
  }

  test('editable dialog and read-only drawer tab honour the shared editor contract', async ({ page }) => {
    const configMaps = await openConfigMapsList(page);

    const yaml = await openEditYaml(page, configMaps);
    const editable = yaml.codeMirror();

    try {
      // The editable consumer renders the full gutter set
      await expect(editable.self()).toBeVisible();
      await expect(editable.lineNumbers()).toHaveCount(1);
      await expect(editable.foldGutter()).toHaveCount(1);
      await expect(editable.content()).toHaveAttribute('contenteditable', 'true');

      // Typing at the caret appends to the document
      const before = await editable.value();

      await editable.focus();
      await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.type('typed-append');

      await expect.poll(() => editable.value()).toBe(`${before}typed-append`);
    } finally {
      await closeEditYaml(yaml);
    }

    const drawer = await openShowConfiguration(page, configMaps);
    const readOnly = drawer.codeMirror();

    try {
      // The read-only consumer: editor present, no line numbers, readonly flags
      await expect(readOnly.self()).toBeVisible();
      await expect(readOnly.lineNumbers()).toHaveCount(0);
      await expect(readOnly.content()).toHaveAttribute('contenteditable', 'false');
      await expect(readOnly.content()).toHaveAttribute('aria-readonly', 'true');
      await expect.poll(() => readOnly.isReadOnly()).toBe(true);

      // Typing is rejected: the value stays byte-for-byte identical
      const beforeReadOnly = await readOnly.value();

      await readOnly.focus();

      // The keystrokes must actually reach the editor. Without this, typing into a
      // lost or never-acquired focus also leaves the value untouched, and the check
      // below would prove nothing about the read-only contract.
      await expect.poll(() => readOnly.isFocused()).toBe(true);

      await page.keyboard.type('should-not-land');

      await expect.poll(() => readOnly.value()).toBe(beforeReadOnly);
    } finally {
      await drawer.close();
    }
  });

  test('the keymap user preference drives editor behaviour (vim deletes, emacs types)', async ({
    page,
    rancherApi,
  }) => {
    const prefs = (await rancherApi.getRancherResource('v1', 'userpreferences')).body.data[0]?.data ?? {};
    const originalKeymap: string = prefs[KEYMAP_PREF] ?? 'sublime';

    let configMaps = await openConfigMapsList(page);
    let yaml: ResourceYamlPo | undefined;

    try {
      // ── vim: a bare `x` must delete under the caret, not insert the letter ──
      await rancherApi.setUserPreference({ [KEYMAP_PREF]: 'vim' });

      // Full reload so the SPA store re-reads the preference before the editor is built
      configMaps = await openConfigMapsList(page);

      yaml = await openEditYaml(page, configMaps);
      const vimEditor = yaml.codeMirror();

      const beforeVim = await vimEditor.value();

      // Sanity: the document must not already contain the letter x, otherwise an
      // inserted x could hide behind an existing one
      expect(beforeVim).not.toContain('x');

      await vimEditor.focus();

      // Position the caret deterministically in normal mode before deleting:
      // `gg` to document start, `x` deletes the character under the cursor.
      await page.keyboard.press('g');
      await page.keyboard.press('g');
      await page.keyboard.press('x');

      // Deletion, not insertion: the first character is gone and no x was added
      await expect.poll(() => vimEditor.value()).toBe(beforeVim.slice(1));
      expect(await vimEditor.value()).not.toContain('x');

      // Insert mode: a marker typed after `i` lands in the document
      await page.keyboard.press('i');
      await page.keyboard.type('VIMINSERTED');

      await expect.poll(() => vimEditor.value()).toContain('VIMINSERTED');

      // Back to normal mode
      await page.keyboard.press('Escape');

      await closeEditYaml(yaml);
      yaml = undefined;

      // ── emacs: plain typing inserts ──
      await rancherApi.setUserPreference({ [KEYMAP_PREF]: 'emacs' });

      configMaps = await openConfigMapsList(page);

      yaml = await openEditYaml(page, configMaps);
      const emacsEditor = yaml.codeMirror();

      await emacsEditor.focus();
      await page.keyboard.type('emacs-typed');

      await expect.poll(() => emacsEditor.value()).toContain('emacs-typed');
    } finally {
      if (yaml) {
        await closeEditYaml(yaml).catch(() => {});
      }

      await rancherApi.setUserPreference({ [KEYMAP_PREF]: originalKeymap });
    }
  });

  test('fold markers collapse the whole document to one line and back', async ({ page }) => {
    const configMaps = await openConfigMapsList(page);
    const yaml = await openEditYaml(page, configMaps);
    const editor = yaml.codeMirror();

    try {
      const doc = buildFoldDocument();

      await editor.set(doc);
      await expect.poll(() => editor.value()).toBe(doc);

      // Every line renders while unfolded, and the fold gutter offers markers
      const rendered = await editor.lineCount();

      expect(rendered).toBeGreaterThan(60);
      await expect(editor.foldMarkers()).not.toHaveCount(0);

      // The first marker folds the root node: the entire document on one rendered line.
      // The value must stay byte-identical while folded, so an editor that reset or
      // emptied itself could not show "1 line" and still pass.
      await editor.foldMarkers().first().click();
      await expect.poll(() => editor.lineCount()).toBe(1);
      await expect.poll(() => editor.value()).toBe(doc);

      // Clicking the open marker unfolds everything again: original line count and
      // the same byte-identical document
      await editor.foldMarkers().first().click();
      await expect.poll(() => editor.lineCount()).toBe(rendered);
      await expect.poll(() => editor.value()).toBe(doc);
    } finally {
      await closeEditYaml(yaml);
    }
  });

  test('soft wrap renders a long line as multiple rows without horizontal overflow', async ({ page }) => {
    const configMaps = await openConfigMapsList(page);
    const yaml = await openEditYaml(page, configMaps);
    const editor = yaml.codeMirror();

    try {
      const longLine = `note: ${'a'.repeat(200)}`;

      await editor.set(longLine);
      await expect.poll(() => editor.value()).toBe(longLine);

      // The wrapping class is what makes this the soft-wrap (not overflow) contract
      await expect(editor.content()).toHaveClass(/cm-lineWrapping/);

      // One document line, several visual rows
      await expect.poll(() => editor.visualRowCount()).toBeGreaterThan(1);

      // No horizontal scrollbar: measured on the REAL scroll container
      // (`.cm-scroller`), not the ancestor root, which never overflows
      await expect.poll(() => editor.hasHorizontalOverflow()).toBe(false);

      const geometry = await editor.scroller().evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));

      expect(geometry.scrollWidth).toBe(geometry.clientWidth);
    } finally {
      await closeEditYaml(yaml);
    }
  });
});
