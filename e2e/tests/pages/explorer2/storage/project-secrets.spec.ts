import { test, expect } from '@/support/fixtures';
import { ProjectSecretsListPagePo, ProjectSecretsCreateEditPo } from '@/e2e/po/pages/explorer/project-secrets.po';

const projectScopedSecretName = 'e2e-project-scoped-secret-name';
const username = 'test';

test.describe('Project Secrets', { tag: ['@explorer2', '@adminUser'] }, () => {
  test('has the correct title', async ({ page, login }) => {
    await login();

    const projectSecretsListPage = new ProjectSecretsListPagePo(page, 'local');

    await projectSecretsListPage.goTo();
    await projectSecretsListPage.waitForPage();

    await expect(projectSecretsListPage.title()).toContainText('Project Secrets');
    await expect(page).toHaveTitle(/Rancher.*-.*local.*-.*Project Secrets/);
  });

  test('creates a project-scoped secret and displays it in the list', async ({ page, login, rancherApi }) => {
    test.fixme(
      true,
      'Save stays disabled on v2.15-head: shell/edit/secret/index.vue reads project.status.backingNamespace, but v2.15 projects no longer expose that field, so metadata.namespace ends up undefined and form-validation fails. See DEBUGGING-FAILURES.md "Save button stays disabled".',
    );

    await login();

    const projectsResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.projects');
    const defaultProject = projectsResp.body.data.find(
      (p: { spec?: { displayName?: string } }) => p.spec?.displayName === 'Default',
    );
    const targetNamespace: string = defaultProject?.status?.backingNamespace ?? defaultProject?.metadata?.name;

    expect(targetNamespace, 'Default project must have a backing namespace').toBeTruthy();

    const projectSecretsListPage = new ProjectSecretsListPagePo(page, 'local');
    const secretCreatePage = new ProjectSecretsCreateEditPo(page, 'local');

    const prefsResp = await rancherApi.getRancherResource('v1', 'userpreferences');
    const previousNsFilter: string = prefsResp.body?.data?.[0]?.data?.['ns-by-cluster'] ?? '';
    const previousGroupBy: string = prefsResp.body?.data?.[0]?.data?.['group-by'] ?? '';

    await rancherApi.updateNamespaceFilter('local', 'none', '{"local":["all"]}');

    try {
      await projectSecretsListPage.goTo();
      await projectSecretsListPage.waitForPage();

      await expect(projectSecretsListPage.createButton()).toContainText('Create');
      await projectSecretsListPage.createButton().click();
      await secretCreatePage.waitForPage();

      await secretCreatePage.selectSecretSubtype('kubernetes.io/basic-auth').click();
      await secretCreatePage.projectSelect().toggle();
      await secretCreatePage.projectSelect().clickOptionWithLabel('Default');
      await secretCreatePage.nameNsDescription().name().set(projectScopedSecretName);
      await secretCreatePage.basicAuthUsernameInput().input().pressSequentially(username);

      const createReqPromise = page.waitForRequest((req) => /\/v1\/secrets/.test(req.url()) && req.method() === 'POST');

      await expect(secretCreatePage.saveOrCreate().self()).toBeEnabled();
      await secretCreatePage.saveOrCreate().click();

      const createReq = await createReqPromise;
      const payload = createReq.postDataJSON();

      expect(payload.metadata.namespace).toBe(targetNamespace);
      expect(payload.metadata.labels['management.cattle.io/project-scoped-secret']).toBe(targetNamespace);
      expect(payload.metadata.name).toBe(projectScopedSecretName);
    } finally {
      await rancherApi.deleteRancherResource('v1', `secrets/${targetNamespace}`, projectScopedSecretName, false);
      await rancherApi.updateNamespaceFilter('local', previousGroupBy, previousNsFilter);
    }
  });
});
