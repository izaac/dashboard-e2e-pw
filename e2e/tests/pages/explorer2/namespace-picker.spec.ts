import { test, expect } from '@/support/fixtures';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { NamespaceFilterPo } from '@/e2e/po/components/namespace-filter.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';

test.describe('Namespace picker', { tag: ['@explorer2'] }, () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();

    // Reset namespace picker to default state (like upstream beforeEach)
    const namespacePicker = new NamespaceFilterPo(page);

    await namespacePicker.toggle();
    await namespacePicker.clickOptionByLabel('Only User Namespaces');
    await namespacePicker.isChecked('Only User Namespaces');
    await namespacePicker.closeDropdown();
  });

  test(
    'can select only one of the top 5 resource filters at a time',
    { tag: ['@adminUser', '@standardUser'] },
    async ({ page }) => {
      const namespacePicker = new NamespaceFilterPo(page);

      await namespacePicker.toggle();

      await namespacePicker.clickOptionByLabel('All Namespaces');
      await namespacePicker.isChecked('All Namespaces');

      await namespacePicker.clickOptionByLabel('Only User Namespaces');
      await namespacePicker.isChecked('Only User Namespaces');

      await namespacePicker.clickOptionByLabel('Only System Namespaces');
      await namespacePicker.isChecked('Only System Namespaces');
    },
  );

  test('can select multiple projects/namespaces', { tag: ['@adminUser'] }, async ({ page }) => {
    const namespacePicker = new NamespaceFilterPo(page);

    await namespacePicker.toggle();

    await namespacePicker.clickOptionByLabel('Project: Default');
    await namespacePicker.isChecked('Project: Default');

    await namespacePicker.clickOptionByLabel('default');
    await namespacePicker.isChecked('default');

    await namespacePicker.clickOptionByLabel('Project: System');
    await namespacePicker.isChecked('Project: System');
  });

  test('can deselect options', { tag: ['@adminUser', '@standardUser'] }, async ({ page }) => {
    const namespacePicker = new NamespaceFilterPo(page);

    await namespacePicker.toggle();

    await namespacePicker.clickOptionByLabel('default');
    await namespacePicker.isChecked('default');

    const clearBtn = namespacePicker.clearIcon();

    await clearBtn.click();

    await namespacePicker.isChecked('Only User Namespaces');
  });

  test('can filter after making a selection', { tag: ['@adminUser', '@standardUser'] }, async ({ page }) => {
    const namespacePicker = new NamespaceFilterPo(page);

    await namespacePicker.toggle();

    await namespacePicker.clickOptionByLabel('Project: Default');
    await namespacePicker.isChecked('Project: Default');

    await namespacePicker.searchByName('default');
    const options = namespacePicker.namespaceOptions();

    await expect(options).not.toHaveCount(0);
  });

  test('can filter options by name', { tag: ['@adminUser', '@standardUser'] }, async ({ page }) => {
    const namespacePicker = new NamespaceFilterPo(page);

    await namespacePicker.toggle();

    await namespacePicker.searchByName('default');
    const options = namespacePicker.namespaceOptions();

    await expect(options).not.toHaveCount(0);

    await namespacePicker.clickOptionByLabel('Project: Default');
    await namespacePicker.isChecked('Project: Default');

    await namespacePicker.clearSearchFilter();
    await namespacePicker.isChecked('Project: Default');
  });

  test(
    'newly created project/namespace appears in namespace picker',
    { tag: ['@adminUser'] },
    async ({ page, rancherApi }) => {
      const projName = `e2e-project-${Date.now()}`;
      const nsName = `e2e-ns-${Date.now()}`;

      const selfUser = await rancherApi.getRancherResource('v1', 'ext.cattle.io.selfuser', undefined, 201);
      const userId = selfUser.body.status.userID;

      const projResp = await rancherApi.createRancherResource('v3', 'projects', {
        type: 'project',
        name: projName,
        clusterId: 'local',
        annotations: { 'field.cattle.io/creatorId': userId },
      });

      const projectId = projResp.body.id;

      await rancherApi.createRancherResource('v1', 'namespaces', {
        type: 'namespace',
        metadata: {
          name: nsName,
          annotations: { 'field.cattle.io/projectId': projectId },
        },
      });

      try {
        const namespacePicker = new NamespaceFilterPo(page);

        await namespacePicker.toggle();
        await expect(namespacePicker.optionByText(projName)).toBeVisible(SHORT_TIMEOUT_OPT);
        await expect(namespacePicker.optionByText(nsName)).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'namespaces', nsName, false);
        await rancherApi.deleteRancherResource('v3', 'projects', projectId, false);
      }
    },
  );

  test(
    'deleted project/namespace gets removed from namespace picker',
    { tag: ['@adminUser'] },
    async ({ page, rancherApi }) => {
      const projName = `e2e-project-del-${Date.now()}`;
      const nsName = `e2e-ns-del-${Date.now()}`;

      const selfUser = await rancherApi.getRancherResource('v1', 'ext.cattle.io.selfuser', undefined, 201);
      const userId = selfUser.body.status.userID;

      const projResp = await rancherApi.createRancherResource('v3', 'projects', {
        type: 'project',
        name: projName,
        clusterId: 'local',
        annotations: { 'field.cattle.io/creatorId': userId },
      });

      const projectId = projResp.body.id;

      await rancherApi.createRancherResource('v1', 'namespaces', {
        type: 'namespace',
        metadata: {
          name: nsName,
          annotations: { 'field.cattle.io/projectId': projectId },
        },
      });

      const namespacePicker = new NamespaceFilterPo(page);

      await namespacePicker.toggle();
      await expect(namespacePicker.optionByText(projName)).toBeVisible(SHORT_TIMEOUT_OPT);

      await rancherApi.deleteRancherResource('v1', 'namespaces', nsName, false);
      await rancherApi.deleteRancherResource('v3', 'projects', projectId, false);

      await namespacePicker.closeDropdown();
      await namespacePicker.toggle();
      await expect(namespacePicker.optionByText(projName)).not.toBeAttached({ timeout: 20000 });
    },
  );

  test(
    'can filter workloads by project/namespace from the picker dropdown',
    { tag: ['@adminUser'] },
    async ({ page, rancherApi }) => {
      await rancherApi.updateNamespaceFilter('local', 'metadata.namespace', '{"local":["all://user"]}');

      try {
        // Navigate to pods list (upstream uses WorkloadsPodsListPagePo)
        await page.goto('./c/local/explorer/pod');
        await page.waitForURL(/\/pod$/);

        const sortableTable = new SortableTablePo(page, '.sortable-table');

        await sortableTable.groupByButtons(1).click();

        const namespacePicker = new NamespaceFilterPo(page);

        await namespacePicker.toggle();
        await expect(namespacePicker.optionById('ns_cattle-fleet-system')).toBeVisible();
        await namespacePicker.clickOptionByLabel('cattle-fleet-system');
        await namespacePicker.isChecked('cattle-fleet-system');
        await namespacePicker.closeDropdown();

        await expect(sortableTable.groupTab('cattle-fleet-system')).toHaveCount(1);

        await namespacePicker.toggle();
        await namespacePicker.clearIcon().click();
        await namespacePicker.isChecked('Only User Namespaces');

        await namespacePicker.clickOptionByLabel('Project: System');
        await namespacePicker.isChecked('Project: System');
        await namespacePicker.closeDropdown();

        await expect(sortableTable.groupTab('kube-system')).toBeVisible();
        await expect(sortableTable.groupTab('cattle-fleet-system')).toBeVisible();
      } finally {
        await rancherApi.updateNamespaceFilter('local', 'none', '{"local":["all://user"]}');
      }
    },
  );
});
