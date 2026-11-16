import { test, expect } from '@/support/fixtures';
import type { Page } from '@playwright/test';
import { WorkloadsDeploymentsListPagePo } from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import ResourceYamlPo from '@/e2e/po/components/resource-yaml.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import type { ImportYamlPo } from '@/e2e/po/components/import-yaml.po';

const namespace = 'default';

test.describe('Yaml Editor', { tag: ['@components', '@adminUser', '@standardUser'] }, () => {
  let name: string;

  test.beforeEach(async ({ login, rancherApi }) => {
    await login();

    name = rancherApi.createE2EResourceName('yaml-editor');

    // Create deployment via API for reliable setup
    await rancherApi.createRancherResource('v1', 'apps.deployments', {
      metadata: { name, namespace },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: { containers: [{ name: 'nginx', image: 'nginx' }] },
        },
      },
    });
  });

  test.describe('Edit mode', () => {
    test(
      'Check if body and footer are visible to human eye',
      { tag: ['@components', '@adminUser'] },
      async ({ page }) => {
        const deploymentsListPage = new WorkloadsDeploymentsListPagePo(page, 'local', { q: name });

        await deploymentsListPage.goTo();
        await expect(deploymentsListPage.listElementWithName(name)).toBeAttached();
        await deploymentsListPage.goToEditYamlPage(name);

        const resourceYaml = new ResourceYamlPo(page);

        await expect(resourceYaml.body()).toBeVisible();
        await expect(resourceYaml.footer()).toBeVisible();
      },
    );
  });

  test.describe('Click below the document', () => {
    /** Navigate to the cluster dashboard and open the header Import YAML dialog */
    const openImportYaml = async (page: Page) => {
      const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

      await clusterDashboard.goTo();
      await clusterDashboard.waitForPage();

      const header = new HeaderPo(page);

      await header.importYamlHeaderAction().click();

      const editor = header.importYaml().importYamlEditor();

      await editor.content().waitFor({ state: 'visible' });

      return editor;
    };

    /** Close the Import YAML dialog without creating anything, even if the test already failed */
    const closeImportYaml = async (page: Page, importYaml: ImportYamlPo): Promise<void> => {
      await importYaml
        .cancelButton()
        .click({ timeout: 2000 })
        .catch(() => {});

      if (
        await importYaml
          .self()
          .isVisible()
          .catch(() => false)
      ) {
        await page.keyboard.press('Escape').catch(() => {});
      }

      await importYaml
        .self()
        .waitFor({ state: 'hidden', timeout: 5000 })
        .catch(() => {});
    };

    test(
      'typing works after clicking below the document in an empty import YAML editor',
      { tag: ['@components', '@adminUser'] },
      async ({ page }) => {
        const importYaml = new HeaderPo(page).importYaml();

        try {
          const editor = await openImportYaml(page);

          await expect.poll(() => editor.value()).toBe('');

          // 150px below the single empty line is roughly midway down the wizard editor
          await editor.clickBelowContent(150);
          await page.keyboard.type('clicked: true');

          // Editor value, not focus: Chromium focuses the editor even without the fix
          await expect.poll(() => editor.value()).toContain('clicked: true');
        } finally {
          await closeImportYaml(page, importYaml);
        }

        await expect(importYaml.self()).toBeHidden();
      },
    );

    test(
      'typing appends at the end of the document after clicking well below the last line',
      { tag: ['@components', '@adminUser'] },
      async ({ page }) => {
        const importYaml = new HeaderPo(page).importYaml();

        try {
          const editor = await openImportYaml(page);

          await editor.set('apiVersion: v1\nkind: ConfigMap\n');
          await expect.poll(() => editor.value()).toBe('apiVersion: v1\nkind: ConfigMap\n');

          // Move the caret to the start of the document, so only the below-content click can
          // bring it to the end. A swallowed click then types at the start and fails the assertion.
          await page.keyboard.press('ControlOrMeta+Home');
          await expect.poll(() => editor.value()).toBe('apiVersion: v1\nkind: ConfigMap\n');

          // Far below the two written lines, inside the scroller but outside the document
          await editor.clickBelowContent(80);
          await page.keyboard.type('clicked: here');

          // Exact value: the text must land after the document, not before the trailing newline
          await expect.poll(() => editor.value()).toBe('apiVersion: v1\nkind: ConfigMap\nclicked: here');
        } finally {
          await closeImportYaml(page, importYaml);
        }

        await expect(importYaml.self()).toBeHidden();
      },
    );
  });

  test.afterEach(async ({ rancherApi }) => {
    // Cleanup via API
    await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${namespace}/${name}`, false);
  });
});
