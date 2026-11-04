import path from 'path';
import { type Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import { ProjectsNamespacesListPagePo } from '@/e2e/po/pages/explorer/projects-namespaces.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-14451-delete-dialog-single-click-select-evidence';

/** Open the Delete confirmation dialog for the given namespace from the Projects/Namespaces list */
async function openDeleteDialog(page: Page, namespace: string): Promise<PromptRemove> {
  const listPage = new ProjectsNamespacesListPagePo(page, 'local');

  await listPage.goTo();
  await listPage.waitForPage();

  const actionMenu = await listPage.list().actionMenu(namespace);

  await actionMenu.getMenuItem('Delete').click();

  const promptRemove = new PromptRemove(page);

  await expect(promptRemove.self()).toBeVisible();

  return promptRemove;
}

test.describe('Delete Confirmation Dialog Single-Click Select (#14451)', { tag: ['@explorer2', '@adminUser'] }, () => {
  let testNamespace = '';

  test.beforeAll(async ({ rancherApi }) => {
    testNamespace = rancherApi.createE2EResourceName('qa-14451-hyphen-ns');

    await rancherApi.createNamespace(testNamespace);
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      if (testNamespace) {
        await rancherApi.deleteNamespace([testNamespace]);
      }
    } finally {
      testNamespace = '';
    }
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('single click on the hyphenated name selects it fully and pasting enables the Delete button', async ({ page }) => {
    const promptRemove = await openDeleteDialog(page, testNamespace);
    const confirmButton = promptRemove.confirmButton();
    const nameEl = promptRemove.confirmName();

    await expect(nameEl).toBeVisible();
    await expect(nameEl).toHaveText(testNamespace);
    await expect(nameEl).toHaveCSS('user-select', 'all');

    await nameEl.click();

    const selectedText = await page.evaluate(() => window.getSelection()?.toString().trim());

    expect(selectedText).toBe(testNamespace);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-01-hyphenated-name-single-click-selected.png') });

    await expect(confirmButton).toBeDisabled();

    await promptRemove.confirm(testNamespace);

    await expect(confirmButton).toBeEnabled();

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-02-pasted-name-enables-delete-button.png') });

    await promptRemove.cancelButton().click();
    await expect(promptRemove.self()).toBeHidden();
  });

  test('dialog does not render a redundant copy button or copy box', async ({ page }) => {
    const promptRemove = await openDeleteDialog(page, testNamespace);

    await expect(promptRemove.copyControls()).toHaveCount(0);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-05-no-redundant-copy-button-box.png') });

    await promptRemove.cancelButton().click();
    await expect(promptRemove.self()).toBeHidden();
  });
});
