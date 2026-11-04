import fs from 'fs';
import path from 'path';
import { type Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { ProjectsNamespacesListPagePo } from '@/e2e/po/pages/explorer/projects-namespaces.po';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-9067-project-namespace-filter-evidence';

/** Select a group-by option through the table View menu (skips the click when already selected) */
async function setGroupBy(page: Page, label: string): Promise<void> {
  const viewMenu = page.getByTestId('table-views-view-menu');

  await viewMenu.click();
  await page.getByTestId('table-views-view-group').click();

  const option = page.getByTestId(/^table-views-group-/).filter({ hasText: label });

  if ((await option.getAttribute('aria-checked')) !== 'true') {
    await option.click();
  }

  await viewMenu.click(); // close
}

/** Filter input: new-UX query box, falling back to the legacy search row */
const filterInput = (page: Page) =>
  page.getByTestId('table-views-query').or(page.getByTestId('search-box-filter-row').getByRole('textbox')).first();

async function setFilter(page: Page, text: string): Promise<void> {
  const input = filterInput(page);

  await input.focus();
  await input.clear();
  if (text) {
    await input.fill(text);
  }
}

test.describe('Project and Namespace List Filter (#9067)', { tag: ['@generic', '@adminUser'] }, () => {
  let project1Name = '';
  let project2Name = '';
  let sameName = '';
  const projectIds: string[] = [];
  const namespaceNames: string[] = [];
  let ns1 = '';
  let ns2 = '';
  let nsSame = '';

  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.beforeAll(async ({ rancherApi }) => {
    const prefix = rancherApi.createE2EResourceName('qa-9067');

    project1Name = `${prefix}-project1`;
    project2Name = `${prefix}-project2`;
    sameName = `${prefix}-samename`;
    ns1 = `${prefix}-ns-p1`;
    ns2 = `${prefix}-ns-p2`;
    nsSame = `${prefix}-ns-same`;

    const project1 = await rancherApi.createProject(project1Name);
    const project2 = await rancherApi.createProject(project2Name);
    // Two projects sharing one display name (API allows it): one with a namespace, one empty
    const sameA = await rancherApi.createProject(sameName);
    const sameB = await rancherApi.createProject(sameName);

    for (const resp of [project1, project2, sameA, sameB]) {
      projectIds.push(String(resp.body.id).trim());
    }

    await rancherApi.createNamespaceInProject(ns1, String(project1.body.id).trim());
    namespaceNames.push(ns1);
    await rancherApi.createNamespaceInProject(ns2, String(project2.body.id).trim());
    namespaceNames.push(ns2);
    await rancherApi.createNamespaceInProject(nsSame, String(sameA.body.id).trim());
    namespaceNames.push(nsSame);
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      if (namespaceNames.length) {
        await rancherApi.deleteNamespace(namespaceNames);
      }
    } finally {
      for (const id of projectIds) {
        await rancherApi.deleteRancherResource('v3', 'projects', id, false).catch(() => undefined);
      }
    }
  });

  test.beforeEach(async ({ login, page }) => {
    await login();

    const listPage = new ProjectsNamespacesListPagePo(page, 'local');

    await listPage.goTo();
    await new WelcomeDialogPo(page).dismissIfVisible();
    await listPage.waitForPage();
    await expect(listPage.list().resourceTable().sortableTable().self()).toBeVisible();
  });

  const table = (page: Page) => new ProjectsNamespacesListPagePo(page, 'local').list().resourceTable().sortableTable();

  const shot = (page: Page, name: string) => page.screenshot({ path: path.join(EVIDENCE_DIR, name) });

  test('filter by project name in grouped view shows empty and non-empty matching projects', async ({ page }) => {
    const sortable = table(page);

    await setGroupBy(page, 'Project');
    await setFilter(page, 'project');

    await expect(sortable.groupElementsWithName(sameName)).toHaveCount(0);
    await expect(sortable.groupElementsWithName(project1Name)).toHaveCount(1);
    await expect(sortable.groupElementsWithName(project2Name)).toHaveCount(1);
    await expect(sortable.rowElementWithName(ns1)).toBeVisible();

    await shot(page, 'scenario-01-grouped-filter-empty-and-nonempty-projects.png');
  });

  test('filter by project name shows namespaces under matching projects', async ({ page }) => {
    const sortable = table(page);

    await setGroupBy(page, 'Project');
    await setFilter(page, '');
    await setFilter(page, project1Name);

    await expect(sortable.groupElementsWithName(project2Name)).toHaveCount(0);
    await expect(sortable.rowElementWithName(ns2)).toHaveCount(0);
    await expect(sortable.groupElementsWithName(project1Name)).toHaveCount(1);
    await expect(sortable.rowElementWithName(ns1)).toBeVisible();

    await shot(page, 'scenario-02-grouped-filter-shows-namespaces.png');
  });

  test('filter by namespace name shows the namespace and its project group', async ({ page }) => {
    const sortable = table(page);

    await setGroupBy(page, 'Project');
    await setFilter(page, '');
    await setFilter(page, 'ns-p1');

    await expect(sortable.rowElementWithName(ns2)).toHaveCount(0);
    await expect(sortable.groupElementsWithName(project2Name)).toHaveCount(0);
    await expect(sortable.groupElementsWithName(project1Name)).toHaveCount(1);
    await expect(sortable.rowElementWithName(ns1)).toBeVisible();

    await shot(page, 'scenario-03-namespace-name-filter.png');
  });

  test('flat list view filter works correctly', async ({ page }) => {
    const sortable = table(page);

    await setGroupBy(page, 'None');
    await setFilter(page, '');
    await setFilter(page, 'ns-p1');

    await expect(sortable.rowElementWithName(ns1)).toBeVisible();
    await expect(sortable.rowElementWithName(ns2)).toHaveCount(0);

    await shot(page, 'scenario-04-flat-list-filter.png');
  });

  test('two projects with the same display name both appear when filtered', async ({ page }) => {
    test.skip(!sameName || projectIds.length < 4, 'Same-name projects were not created in setup');

    const sortable = table(page);

    await setGroupBy(page, 'Project');
    await setFilter(page, '');
    await setFilter(page, sameName);

    // Wait until the filter has actually been applied: unrelated project groups must be gone
    await expect(sortable.groupElementsWithName(project1Name)).toHaveCount(0);
    await expect(sortable.groupElementsWithName(project2Name)).toHaveCount(0);
    await expect(sortable.groupElementsWithName(sameName)).toHaveCount(2);
    await expect(sortable.groupElementsWithName('')).toHaveCount(2);
    await expect(sortable.rowElementWithName(nsSame)).toBeVisible();

    await shot(page, 'scenario-05-same-name-projects-filter.png');
  });
});
