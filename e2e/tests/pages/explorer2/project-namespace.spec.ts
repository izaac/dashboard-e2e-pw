import { test, expect } from '@/support/fixtures';
import { ProjectsNamespacesListPagePo } from '@/e2e/po/pages/explorer/projects-namespaces.po';

test.describe('Projects/Namespaces', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('flat list view should have create Namespace button', async ({ page }) => {
    const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

    await projectsNamespacesPage.goTo();
    await projectsNamespacesPage.waitForPage();

    const sortableTable = projectsNamespacesPage.list().resourceTable().sortableTable();

    await sortableTable.groupByButtons(0).click();

    await expect(projectsNamespacesPage.createNamespaceButton()).toBeAttached();

    const masthead = projectsNamespacesPage.masthead();

    await expect(masthead.createButton()).toContainText('Create Project');
  });

  test('create namespace screen should have a projects dropdown', async ({ page }) => {
    const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

    await projectsNamespacesPage.goTo();
    await projectsNamespacesPage.waitForPage();

    await projectsNamespacesPage.createNamespaceButton().click();

    await expect(projectsNamespacesPage.projectSelect()).toBeAttached();
  });

  test.describe('Project creation', () => {
    test('does not set a creator principal id annotation when creating a project if using local auth', async ({
      page,
      rancherApi,
    }) => {
      const projectName = `e2e-proj-${Date.now()}`;
      const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

      await projectsNamespacesPage.goTo();
      await projectsNamespacesPage.waitForPage();

      const masthead = projectsNamespacesPage.masthead();

      await masthead.create();

      const cruResource = projectsNamespacesPage.createEditView();

      await cruResource.nameNsDescription().name().set(projectName);

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v3/projects') && resp.request().method() === 'POST',
      );

      await cruResource.formSave().click();

      const response = await responsePromise;
      const body = await response.json();

      try {
        expect(body.annotations).not.toHaveProperty('field.cattle.io/creator-principal-name');
      } finally {
        await rancherApi.deleteRancherResource('v3', 'projects', body.id, false);
      }
    });
  });

  test.describe('Project Error Banner and Validation', () => {
    test('Create button becomes available if the name is filled in', async ({ page }) => {
      const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

      await projectsNamespacesPage.goTo();
      await projectsNamespacesPage.waitForPage();

      const masthead = projectsNamespacesPage.masthead();

      await masthead.create();

      const cruResource = projectsNamespacesPage.createEditView();

      await expect(cruResource.formSave().self()).toBeDisabled();
      await cruResource.nameNsDescription().name().set('test-1234');
      await expect(cruResource.formSave().self()).toBeEnabled();
    });

    test('displays an error message when submitting a form with errors', async ({ page }) => {
      const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

      await projectsNamespacesPage.goTo();
      await projectsNamespacesPage.waitForPage();

      const masthead = projectsNamespacesPage.masthead();

      await masthead.create();

      const cruResource = projectsNamespacesPage.createEditView();

      await cruResource.nameNsDescription().name().set('test-1234');

      await cruResource.tabResourceQuotas().click();
      await cruResource.btnAddResource().click();
      await cruResource.selectResourceType(1);
      await cruResource.inputProjectLimit().set('50');

      await cruResource.formSave().click();
      await expect(cruResource.errorBanner()).toBeVisible();
    });

    test('displays a single error message on repeat submissions of a form with errors', async ({ page }) => {
      const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

      await projectsNamespacesPage.goTo();
      await projectsNamespacesPage.waitForPage();

      const masthead = projectsNamespacesPage.masthead();

      await masthead.create();

      const cruResource = projectsNamespacesPage.createEditView();

      await cruResource.nameNsDescription().name().set('test-1234');

      await cruResource.tabResourceQuotas().click();
      await cruResource.btnAddResource().click();
      await cruResource.selectResourceType(1);
      await cruResource.inputProjectLimit().set('50');

      await cruResource.formSave().click();
      await expect(cruResource.errorBanner()).toBeVisible();
      await expect(cruResource.errorBanner()).toHaveCount(1);

      await cruResource.formSave().click();
      await expect(cruResource.errorBanner()).toBeVisible();
      await expect(cruResource.errorBanner()).toHaveCount(1);
    });

    test('displays the most recent error after resolving a single error in a form with multiple errors', async () => {
      test.skip(
        true,
        'Test for multiple error resolution requires complex form interaction with resource quotas and container limits',
      );
    });
  });

  test.describe('Filtering projects with same name in groupBy list view', () => {
    const projectName = `samename-${Date.now()}`;

    test('should show all projects with same name when filtering in Group by Project view', async ({
      page,
      rancherApi,
    }) => {
      const projectIds: string[] = [];
      const nsNames: string[] = [];

      try {
        for (let i = 0; i < 3; i++) {
          const resp = await rancherApi.createProject(projectName);

          projectIds.push(resp.body.id);

          if (i < 2) {
            const nsName = `e2e-sn-${Date.now()}-${i}`;

            nsNames.push(nsName);
            await rancherApi.createNamespaceInProject(nsName, resp.body.id);
          }
        }

        const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

        await projectsNamespacesPage.goTo();
        await projectsNamespacesPage.waitForPage();

        const sortableTable = projectsNamespacesPage.list().resourceTable().sortableTable();

        await sortableTable.groupByButtons(1).click();
        await sortableTable.filter(projectName);

        await expect(sortableTable.groupElementsWithName(projectName)).toHaveCount(3);
        await expect(sortableTable.rowElementWithName(nsNames[0])).toBeVisible();
        await expect(sortableTable.rowElementWithName(nsNames[1])).toBeVisible();
      } finally {
        for (const ns of nsNames) {
          await rancherApi.deleteRancherResource('v1', 'namespaces', ns, false);
          await rancherApi.waitForRancherResource('v1', 'namespaces', ns, (resp) => resp.status === 404, 15, 2000);
        }
        for (const id of projectIds) {
          await rancherApi.deleteRancherResource('v3', 'projects', id, false);
        }
      }
    });

    test('should show projects without namespaces when filtering in Group by Project view', async ({
      page,
      rancherApi,
    }) => {
      const projectIds: string[] = [];
      const nsNames: string[] = [];

      try {
        for (let i = 0; i < 3; i++) {
          const resp = await rancherApi.createProject(projectName);

          projectIds.push(resp.body.id);

          if (i < 2) {
            const nsName = `e2e-sn2-${Date.now()}-${i}`;

            nsNames.push(nsName);
            await rancherApi.createNamespaceInProject(nsName, resp.body.id);
          }
        }

        const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

        await projectsNamespacesPage.goTo();
        await projectsNamespacesPage.waitForPage();

        const sortableTable = projectsNamespacesPage.list().resourceTable().sortableTable();

        await sortableTable.groupByButtons(1).click();
        await sortableTable.filter(projectName);

        // 3rd project has no namespaces but should still appear as a group
        await expect(sortableTable.groupElementsWithName(projectName)).toHaveCount(3);
      } finally {
        for (const ns of nsNames) {
          await rancherApi.deleteRancherResource('v1', 'namespaces', ns, false);
          await rancherApi.waitForRancherResource('v1', 'namespaces', ns, (resp) => resp.status === 404, 15, 2000);
        }
        for (const id of projectIds) {
          await rancherApi.deleteRancherResource('v3', 'projects', id, false);
        }
      }
    });

    test('should show projects with namespaces when filtering in flat list view', async ({ page, rancherApi }) => {
      const projectIds: string[] = [];
      const nsNames: string[] = [];

      try {
        for (let i = 0; i < 3; i++) {
          const resp = await rancherApi.createProject(projectName);

          projectIds.push(resp.body.id);

          if (i < 2) {
            const nsName = `e2e-sn3-${Date.now()}-${i}`;

            nsNames.push(nsName);
            await rancherApi.createNamespaceInProject(nsName, resp.body.id);
          }
        }

        const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

        await projectsNamespacesPage.goTo();
        await projectsNamespacesPage.waitForPage();

        const sortableTable = projectsNamespacesPage.list().resourceTable().sortableTable();

        await sortableTable.checkLoadingIndicatorNotVisible();
        await sortableTable.groupByButtons(0).click();
        await sortableTable.filter(nsNames[0].slice(0, 6));

        await expect(sortableTable.rowElementWithName(nsNames[0])).toBeVisible();
        await expect(sortableTable.rowElementWithName(nsNames[1])).toBeVisible();
      } finally {
        for (const ns of nsNames) {
          await rancherApi.deleteRancherResource('v1', 'namespaces', ns, false);
          await rancherApi.waitForRancherResource('v1', 'namespaces', ns, (resp) => resp.status === 404, 15, 2000);
        }
        for (const id of projectIds) {
          await rancherApi.deleteRancherResource('v3', 'projects', id, false);
        }
      }
    });
  });

  test.describe('Project creation with third-party auth', () => {
    test('sets the creator principal id annotation when creating a project and using third-party auth', async () => {
      test.skip(true, 'Requires third-party auth provider');
    });
  });
});
