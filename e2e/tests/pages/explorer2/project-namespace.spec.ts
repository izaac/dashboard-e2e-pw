import { test, expect } from '@/support/fixtures';
import { ProjectsNamespacesListPagePo, ProjectCreateEditPagePo } from '@/e2e/po/pages/explorer/projects-namespaces.po';

test.describe('Projects/Namespaces', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('flat list view should have create Namespace button', async ({ page }) => {
    const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

    await projectsNamespacesPage.goTo();
    await projectsNamespacesPage.waitForPage();

    await projectsNamespacesPage.flatListButton().click();

    await expect(projectsNamespacesPage.createNamespaceButton()).toBeAttached();
    await expect(projectsNamespacesPage.masthead().createButton()).toContainText('Create Project');
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

      await projectsNamespacesPage.masthead().create();

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

      await projectsNamespacesPage.masthead().create();

      const cruResource = projectsNamespacesPage.createEditView();

      await cruResource.formSave().expectToBeDisabled();
      await cruResource.nameNsDescription().name().set('test-1234');
      await cruResource.formSave().expectToBeEnabled();
    });

    test('displays an error message when submitting a form with errors', async ({ page }) => {
      const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

      await projectsNamespacesPage.goTo();
      await projectsNamespacesPage.waitForPage();

      await projectsNamespacesPage.masthead().create();

      const cruResource = projectsNamespacesPage.createEditView();

      await cruResource.nameNsDescription().name().set('test-1234');

      await cruResource.tabResourceQuotas().click();
      await cruResource.btnAddResource().click();
      await cruResource.inputProjectLimit().fill('50');

      await cruResource.formSave().click();
      await expect(cruResource.errorBanner()).toBeVisible();
    });

    test('displays a single error message on repeat submissions of a form with errors', async ({ page }) => {
      const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

      await projectsNamespacesPage.goTo();
      await projectsNamespacesPage.waitForPage();

      await projectsNamespacesPage.masthead().create();

      const cruResource = projectsNamespacesPage.createEditView();

      await cruResource.nameNsDescription().name().set('test-1234');

      await cruResource.tabResourceQuotas().click();
      await cruResource.btnAddResource().click();
      await cruResource.inputProjectLimit().fill('50');

      await cruResource.formSave().click();
      await expect(cruResource.errorBanner()).toBeVisible();
      await expect(cruResource.errorBanner()).toHaveCount(1);

      await cruResource.formSave().click();
      await expect(cruResource.errorBanner()).toBeVisible();
      await expect(cruResource.errorBanner()).toHaveCount(1);
    });

    test('displays the most recent error after resolving a single error in a form with multiple errors', async ({
      page,
    }) => {
      const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);
      const projectCreatePage = new ProjectCreateEditPagePo(page);

      await projectsNamespacesPage.goTo();
      await projectsNamespacesPage.waitForPage();

      await projectsNamespacesPage.masthead().create();

      const cruResource = projectsNamespacesPage.createEditView();

      await cruResource.nameNsDescription().name().set('test-multi-error');

      // First error: resource quota with project limit but no namespace default limit
      await cruResource.tabResourceQuotas().click();
      await cruResource.btnAddResource().click();
      await cruResource.inputProjectLimit().fill('50');
      await cruResource.formSave().click();
      await expect(projectCreatePage.bannerError(0)).toBeVisible();

      // Set container limits where reservation EXCEEDS limit — triggers webhook rejection
      await projectCreatePage.tabContainerDefaultResourceLimit().click();
      await projectCreatePage.inputCpuReservation().set('1000');
      await projectCreatePage.inputMemoryReservation().set('128');
      await projectCreatePage.inputCpuLimit().set('200');
      await projectCreatePage.inputMemoryLimit().set('64');
      await cruResource.formSave().click();
      await expect(projectCreatePage.bannerError(0)).toBeVisible();

      // Resolve first error by adding namespace default limit
      await cruResource.tabResourceQuotas().click();
      await projectCreatePage.inputNamespaceDefaultLimit().set('50');
      await cruResource.formSave().click();

      // Only the most recent error should remain — not a stale accumulation
      await expect(projectCreatePage.bannerError(0)).toBeVisible();
      await expect(projectCreatePage.bannerError(1)).not.toBeAttached();
    });
  });

  test.describe('Filtering', () => {
    const uniqueSuffix = Date.now();
    const projectName = `e2e-filter-proj-${uniqueSuffix}`;
    const projectIds: string[] = [];
    const nsNames: string[] = [];

    test.beforeAll(async ({ rancherApi }) => {
      for (let i = 0; i < 3; i++) {
        const resp = await rancherApi.createRancherResource('v3', 'projects', {
          name: projectName,
          clusterId: 'local',
        });

        projectIds.push(resp.body.id);
      }

      for (let i = 0; i < 2; i++) {
        const nsName = `e2e-ns-${uniqueSuffix}-${i}`;

        await rancherApi.createRancherResource('v1', 'namespaces', {
          metadata: {
            name: nsName,
            annotations: { 'field.cattle.io/projectId': projectIds[i] },
          },
        });
        nsNames.push(nsName);
      }
    });

    test.afterAll(async ({ rancherApi }) => {
      for (const ns of nsNames) {
        await rancherApi.deleteRancherResource('v1', 'namespaces', ns, false).catch(() => {});
      }

      for (const id of projectIds) {
        await rancherApi.deleteRancherResource('v3', 'projects', id, false).catch(() => {});
      }
    });

    test('should show all projects with same name when filtering in Group by Project view', async ({ page }) => {
      const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

      await projectsNamespacesPage.goTo();
      await projectsNamespacesPage.waitForPage();

      const table = projectsNamespacesPage.list().resourceTable().sortableTable();

      await table.groupByButtons(1).click();
      await table.filter(projectName);

      await expect(table.groupElementsWithName(projectName)).toHaveCount(3);
      await expect(table.rowElementWithName(nsNames[0])).toBeVisible();
      await expect(table.rowElementWithName(nsNames[1])).toBeVisible();
    });

    test('should show projects without namespaces when filtering in Group by Project view', async ({ page }) => {
      const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

      await projectsNamespacesPage.goTo();
      await projectsNamespacesPage.waitForPage();

      const table = projectsNamespacesPage.list().resourceTable().sortableTable();

      await table.groupByButtons(1).click();
      await table.filter(projectName);

      // All 3 project groups visible — including the one with no namespaces
      await expect(table.groupElementsWithName(projectName)).toHaveCount(3);
    });

    test('should show projects with namespaces when filtering in flat list view', async ({ page }) => {
      const projectsNamespacesPage = new ProjectsNamespacesListPagePo(page);

      await projectsNamespacesPage.goTo();
      await projectsNamespacesPage.waitForPage();

      await projectsNamespacesPage.flatListButton().click();

      const table = projectsNamespacesPage.list().resourceTable().sortableTable();

      await table.filter(projectName);

      await expect(table.rowElementWithName(nsNames[0])).toBeVisible();
      await expect(table.rowElementWithName(nsNames[1])).toBeVisible();
    });
  });
});
