import { test, expect } from '@/support/fixtures';
import ChartRepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';

const gitRepoUrl = 'https://github.com/rancher/charts';
const CLUSTER_REPOS_BASE_URL = 'v1/catalog.cattle.io.clusterrepos';

test.describe('Cluster Management Helm Repositories', { tag: ['@manager', '@adminUser'] }, () => {
  test('can create a repository', async ({ page, login, rancherApi }) => {
    await login();
    const repoName = rancherApi.createE2EResourceName('repo');
    const repositoriesPage = new ChartRepositoriesPagePo(page);

    await repositoriesPage.goTo();
    await repositoriesPage.waitForPage();
    await repositoriesPage.create();
    await repositoriesPage.createEditRepositories().waitForPage();
    await repositoriesPage.createEditRepositories().nameNsDescription().name().set(repoName);
    await repositoriesPage.createEditRepositories().nameNsDescription().description().set(`${repoName}-description`);
    await repositoriesPage.createEditRepositories().selectGitRepoCard();
    await repositoriesPage.createEditRepositories().gitRepoUrl().set(gitRepoUrl);
    await repositoriesPage.createEditRepositories().gitBranch().set('release-v2.11');

    const resp = await repositoriesPage.createEditRepositories().saveAndWaitForRequests('POST', CLUSTER_REPOS_BASE_URL);

    expect(resp.status()).toBe(201);

    await repositoriesPage.waitForPage();
    await expect(repositoriesPage.list().details(repoName, 2)).toBeVisible();

    // Wait for repo to become active
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', repoName);
    await expect(repositoriesPage.list().details(repoName, 1)).toContainText('Active', { timeout: 120000 });

    // Cleanup
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repoName, false);
  });

  test('can edit a repository', async ({ page, login, rancherApi }) => {
    await login();
    const repoName = rancherApi.createE2EResourceName('repo');
    const repositoriesPage = new ChartRepositoriesPagePo(page);

    await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
      type: 'catalog.cattle.io.clusterrepo',
      metadata: { name: repoName },
      spec: { gitRepo: gitRepoUrl, gitBranch: 'release-v2.11' },
    });
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', repoName);

    await repositoriesPage.goTo();
    await repositoriesPage.waitForPage();

    const actionMenu = await repositoriesPage.list().actionMenu(repoName);

    await actionMenu.getMenuItem('Edit Config').click();
    await repositoriesPage.createEditRepositories(repoName).waitForPage('mode=edit');
    await repositoriesPage.createEditRepositories().nameNsDescription().description().set(`${repoName}-desc-edit`);

    const resp = await repositoriesPage
      .createEditRepositories()
      .saveAndWaitForRequests('PUT', `${CLUSTER_REPOS_BASE_URL}/${repoName}`);

    expect(resp.status()).toBe(200);
    await repositoriesPage.waitForPage();

    // Verify edit persisted
    await repositoriesPage.list().details(repoName, 2).locator('a').click();
    await expect(repositoriesPage.body()).toContainText(`${repoName}-desc-edit`);

    // Cleanup
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repoName, false);
  });

  test('can clone a repository', async ({ page, login, rancherApi }) => {
    await login();
    const repoName = rancherApi.createE2EResourceName('repo');
    const cloneName = `${repoName}-clone`;
    const repositoriesPage = new ChartRepositoriesPagePo(page);

    await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
      type: 'catalog.cattle.io.clusterrepo',
      metadata: { name: repoName },
      spec: { gitRepo: gitRepoUrl, gitBranch: 'release-v2.11' },
    });
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', repoName);

    await repositoriesPage.goTo();
    await repositoriesPage.waitForPage();

    const actionMenu = await repositoriesPage.list().actionMenu(repoName);

    await actionMenu.getMenuItem('Clone').click();
    await repositoriesPage.createEditRepositories(repoName).waitForPage('mode=clone');
    await repositoriesPage.createEditRepositories().nameNsDescription().name().set(cloneName);
    await repositoriesPage.createEditRepositories().nameNsDescription().description().set(`${repoName}-desc-clone`);

    const resp = await repositoriesPage.createEditRepositories().saveAndWaitForRequests('POST', CLUSTER_REPOS_BASE_URL);

    expect(resp.status()).toBe(201);
    await repositoriesPage.waitForPage();
    await expect(repositoriesPage.list().details(cloneName, 2)).toBeVisible();

    // Cleanup
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repoName, false);
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', cloneName, false);
  });

  test('can refresh a repository', async ({ page, login, rancherApi }) => {
    await login();
    const repoName = rancherApi.createE2EResourceName('repo');
    const repositoriesPage = new ChartRepositoriesPagePo(page);

    await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
      type: 'catalog.cattle.io.clusterrepo',
      metadata: { name: repoName },
      spec: { gitRepo: gitRepoUrl, gitBranch: 'release-v2.11' },
    });
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', repoName);

    await repositoriesPage.goTo();
    await repositoriesPage.waitForPage();

    const refreshResp = page.waitForResponse(
      (r) => r.url().includes(`${CLUSTER_REPOS_BASE_URL}/${repoName}`) && r.request().method() === 'PUT',
    );

    const actionMenu = await repositoriesPage.list().actionMenu(repoName);

    await actionMenu.getMenuItem('Refresh').click({ force: true });
    const resp = await refreshResp;

    expect(resp.status()).toBe(200);
    await expect(repositoriesPage.list().details(repoName, 1)).toContainText('Active', { timeout: 120000 });

    // Cleanup
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repoName, false);
  });

  test('can delete a repository', async ({ page, login, rancherApi }) => {
    await login();
    const repoName = rancherApi.createE2EResourceName('repo');
    const repositoriesPage = new ChartRepositoriesPagePo(page);

    await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
      type: 'catalog.cattle.io.clusterrepo',
      metadata: { name: repoName },
      spec: { gitRepo: gitRepoUrl, gitBranch: 'release-v2.11' },
    });
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', repoName);

    await repositoriesPage.goTo();
    await repositoriesPage.waitForPage();

    const actionMenu = await repositoriesPage.list().actionMenu(repoName);

    await actionMenu.getMenuItem('Delete').click();

    const promptRemove = new PromptRemove(page);
    const deleteResp = page.waitForResponse(
      (r) => r.url().includes(`catalog.cattle.io.clusterrepos/${repoName}`) && r.request().method() === 'DELETE',
    );

    await promptRemove.remove();
    await deleteResp;
    await repositoriesPage.waitForPage();
    await expect(repositoriesPage.body()).not.toContainText(repoName);
  });

  test('can delete repositories via bulk actions', async ({ page, login, rancherApi }) => {
    await login();
    const repoName = rancherApi.createE2EResourceName('repo');
    const repositoriesPage = new ChartRepositoriesPagePo(page);

    // Create two repos for bulk delete
    for (const suffix of ['', 'basic']) {
      await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
        type: 'catalog.cattle.io.clusterrepo',
        metadata: { name: `${repoName}${suffix}` },
        spec: { gitRepo: gitRepoUrl, gitBranch: 'release-v2.11' },
      });
    }

    await repositoriesPage.goTo();
    await repositoriesPage.waitForPage();

    await repositoriesPage.list().resourceTable().sortableTable().rowSelectCtlWithName(repoName).set();
    await repositoriesPage.list().resourceTable().sortableTable().rowSelectCtlWithName(`${repoName}basic`).set();

    const promptRemove = new PromptRemove(page);

    // Set up response watchers just before the action that triggers the DELETE requests
    const deleteResp1 = page.waitForResponse(
      (r) => r.url().includes(`catalog.cattle.io.clusterrepos/${repoName}`) && r.request().method() === 'DELETE',
    );
    const deleteResp2 = page.waitForResponse(
      (r) => r.url().includes(`catalog.cattle.io.clusterrepos/${repoName}basic`) && r.request().method() === 'DELETE',
    );

    // In 2.13 the Delete action may be direct button or inside bulk-action dropdown
    const directDeleteBtn = repositoriesPage.list().resourceTable().sortableTable().bulkActionButton('Delete');
    const directVisible = await directDeleteBtn.isVisible().catch(() => false);

    if (directVisible) {
      await directDeleteBtn.click();
    } else {
      await repositoriesPage.list().openBulkActionDropdown();
      await repositoriesPage.list().bulkActionButton('Delete').click();
    }

    await promptRemove.remove();
    await Promise.all([deleteResp1, deleteResp2]);
    await repositoriesPage.waitForPage();
    await expect(repositoriesPage.body()).not.toContainText(repoName);
  });

  test('can create a repository with basic auth', async ({ page, login, rancherApi }) => {
    await login();
    const repoName = rancherApi.createE2EResourceName('repo-basic');
    const repositoriesPage = new ChartRepositoriesPagePo(page);

    await repositoriesPage.goTo();
    await repositoriesPage.waitForPage();
    await repositoriesPage.create();
    await repositoriesPage.createEditRepositories().waitForPage();
    await repositoriesPage.createEditRepositories().nameNsDescription().name().set(repoName);
    await repositoriesPage.createEditRepositories().nameNsDescription().description().set(`${repoName}-description`);
    await repositoriesPage.createEditRepositories().selectGitRepoCard();
    await repositoriesPage.createEditRepositories().gitRepoUrl().set(gitRepoUrl);
    await repositoriesPage.createEditRepositories().gitBranch().set('release-v2.11');

    // Select "Create an HTTP Basic Auth Secret"
    await repositoriesPage.createEditRepositories().clusterRepoAuthSelectOrCreate().toggle();
    await repositoriesPage
      .createEditRepositories()
      .clusterRepoAuthSelectOrCreate()
      .clickOptionWithLabel('Create an HTTP Basic Auth Secret');
    await repositoriesPage.createEditRepositories().authSecretUsername().set('test');
    await repositoriesPage.createEditRepositories().authSecretPassword().set('test');

    const resp = await repositoriesPage.createEditRepositories().saveAndWaitForRequests('POST', CLUSTER_REPOS_BASE_URL);

    expect(resp.status()).toBe(201);
    await repositoriesPage.waitForPage();
    await expect(repositoriesPage.list().details(repoName, 2)).toBeVisible();

    // Cleanup
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repoName, false);
  });

  test('can create a repository with SSH key', async ({ page, login, rancherApi }) => {
    await login();
    const repoName = rancherApi.createE2EResourceName('repo-ssh');
    const repositoriesPage = new ChartRepositoriesPagePo(page);

    await repositoriesPage.goTo();
    await repositoriesPage.waitForPage();
    await repositoriesPage.create();
    await repositoriesPage.createEditRepositories().waitForPage();
    await repositoriesPage.createEditRepositories().nameNsDescription().name().set(repoName);
    await repositoriesPage.createEditRepositories().nameNsDescription().description().set(`${repoName}-description`);
    await repositoriesPage.createEditRepositories().selectGitRepoCard();
    await repositoriesPage.createEditRepositories().gitRepoUrl().set(gitRepoUrl);
    await repositoriesPage.createEditRepositories().gitBranch().set('release-v2.11');

    // Select "Create an SSH Key Secret"
    await repositoriesPage.createEditRepositories().clusterRepoAuthSelectOrCreate().toggle();
    await repositoriesPage
      .createEditRepositories()
      .clusterRepoAuthSelectOrCreate()
      .clickOptionWithLabel('Create an SSH Key Secret');
    await repositoriesPage.createEditRepositories().authSecretSshPrivateKey().fill('privateKey');
    await repositoriesPage.createEditRepositories().authSecretSshPublicKey().fill('publicKey');

    const resp = await repositoriesPage.createEditRepositories().saveAndWaitForRequests('POST', CLUSTER_REPOS_BASE_URL);

    expect(resp.status()).toBe(201);
    await repositoriesPage.waitForPage();
    await expect(repositoriesPage.list().details(repoName, 2)).toBeVisible();

    // Cleanup
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repoName, false);
  });

  test('can create an OCI repository with basic auth', async ({ page, login, rancherApi }) => {
    await login();
    const repoName = rancherApi.createE2EResourceName('repo-oci');
    const repositoriesPage = new ChartRepositoriesPagePo(page);
    const ociUrl = 'oci://test.rancher.io/charts/mychart';

    await repositoriesPage.goTo();
    await repositoriesPage.waitForPage();
    await repositoriesPage.create();
    await repositoriesPage.createEditRepositories().waitForPage();
    await repositoriesPage.createEditRepositories().nameNsDescription().name().set(repoName);
    await repositoriesPage.createEditRepositories().nameNsDescription().description().set(`${repoName}-description`);
    await repositoriesPage.createEditRepositories().selectOciUrlCard();
    await repositoriesPage.createEditRepositories().ociUrl().set(ociUrl);

    // Set auth
    await repositoriesPage.createEditRepositories().clusterRepoAuthSelectOrCreate().toggle();
    await repositoriesPage
      .createEditRepositories()
      .clusterRepoAuthSelectOrCreate()
      .clickOptionWithLabel('Create an HTTP Basic Auth Secret');
    await repositoriesPage.createEditRepositories().authSecretUsername().set('test');
    await repositoriesPage.createEditRepositories().authSecretPassword().set('test');

    const createResp = page.waitForResponse(
      (r) => r.url().includes(CLUSTER_REPOS_BASE_URL) && r.request().method() === 'POST',
    );

    await repositoriesPage.createEditRepositories().saveCreateForm().click();
    const resp = await createResp;

    expect(resp.status()).toBe(201);
    const reqBody = JSON.parse(resp.request().postData() || '{}');

    expect(reqBody.spec?.url).toBe(ociUrl);

    await repositoriesPage.waitForPage();
    await expect(repositoriesPage.list().details(repoName, 2)).toBeVisible();

    // Cleanup
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repoName, false);
  });
});

test.describe('Repository Disable/Enable', { tag: ['@manager', '@adminUser'] }, () => {
  test('can disable/enable a repository', async ({ page, login, rancherApi }) => {
    await login();
    const repoName = rancherApi.createE2EResourceName('repo-dis-en');
    const repositoriesPage = new ChartRepositoriesPagePo(page);

    await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
      type: 'catalog.cattle.io.clusterrepo',
      metadata: { name: repoName },
      spec: { gitRepo: gitRepoUrl, gitBranch: 'release-v2.11' },
    });
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', repoName);
    await rancherApi.waitForResourceState('v1', 'catalog.cattle.io.clusterrepos', repoName);

    try {
      await repositoriesPage.goTo();
      await repositoriesPage.waitForPage();

      const disableMenu = await repositoriesPage.list().actionMenu(repoName);

      await disableMenu.getMenuItem('Disable').click();
      await expect(repositoriesPage.list().details(repoName, 1)).toContainText('Disabled');

      const disabledActionMenu = await repositoriesPage.list().actionMenu(repoName);

      await expect(disabledActionMenu.getMenuItem('Refresh')).not.toBeAttached();
      await repositoriesPage.list().actionMenuClose(repoName);

      // Reload to get fresh resource version before Enable (avoids 409 conflict on PUT)
      await repositoriesPage.goTo();
      await repositoriesPage.waitForPage();

      const enableMenu = await repositoriesPage.list().actionMenu(repoName);

      await enableMenu.getMenuItem('Enable').click();
      await expect(repositoriesPage.list().details(repoName, 1)).toContainText('Active', { timeout: 60000 });
    } finally {
      await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repoName, false);
    }
  });
});
