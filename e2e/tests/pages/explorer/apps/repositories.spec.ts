import { test, expect } from '@/support/fixtures';
import ChartRepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';
import ChartRepositoriesCreateEditPo from '@/e2e/po/edit/chart-repositories.po';
import { LONG } from '@/support/timeouts';

test.describe('Apps', () => {
  test.describe.configure({ mode: 'serial' });
  test.describe('Repositories', { tag: ['@explorer', '@adminUser'] }, () => {
    test.describe('Add', () => {
      test('after add, repo list should not contain multiple entries', async ({ page, login, rancherApi }) => {
        await login();
        const repoName = `helm-repo-dupe-test-${Date.now()}`;
        const appRepoList = new ChartRepositoriesPagePo(page, 'local', 'apps');

        await appRepoList.goTo();
        await appRepoList.waitForPage();

        await appRepoList.sortableTable().checkLoadingIndicatorNotVisible();

        await expect(appRepoList.sortableTable().rowElementWithName('Partners')).toBeVisible();
        await expect(appRepoList.sortableTable().rowElementWithName('Rancher')).toBeVisible();
        await expect(appRepoList.sortableTable().rowElementWithName('RKE2')).toBeVisible();

        const initialRowCount = await appRepoList.sortableTable().rowCount();

        try {
          await appRepoList.create();

          const appRepoCreate = new ChartRepositoriesCreateEditPo(page, 'local', 'apps');

          await appRepoCreate.waitForPage();
          await appRepoCreate.nameNsDescription().name().self().scrollIntoViewIfNeeded();
          await expect(appRepoCreate.nameNsDescription().name().self()).toBeVisible();
          await appRepoCreate.nameNsDescription().name().set(repoName);
          await appRepoCreate.saveCreateForm().self().scrollIntoViewIfNeeded();

          const createResp = page.waitForResponse(
            (r) => r.url().includes('catalog.cattle.io.clusterrepo') && r.request().method() === 'POST',
          );

          await appRepoCreate.saveCreateForm().click();
          await createResp;

          await appRepoList.waitForPage();
          await appRepoList.sortableTable().checkLoadingIndicatorNotVisible();

          const newRowCount = await appRepoList.sortableTable().rowCount();

          expect(newRowCount).toBe(initialRowCount + 1);
        } finally {
          await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repoName, false);
        }
      });

      test('should reset input values when switching cluster repo type', async ({ page, login }) => {
        await login();
        const appRepoList = new ChartRepositoriesPagePo(page, 'local', 'apps');

        await appRepoList.goTo();
        await appRepoList.waitForPage();
        await appRepoList.create();

        const appRepoCreate = new ChartRepositoriesCreateEditPo(page, 'local', 'apps');

        await appRepoCreate.waitForPage();

        const helmIndexUrl = 'https://charts.rancher.io';
        const gitRepoName = 'https://github.com/rancher/ui-plugin-examples';
        const gitRepoBranchName = 'test-branch';

        await appRepoCreate.nameNsDescription().name().self().scrollIntoViewIfNeeded();
        await expect(appRepoCreate.nameNsDescription().name().self()).toBeVisible();

        await expect(appRepoCreate.helmUrlInput()).toBeVisible();
        await appRepoCreate.helmUrlInput().fill(helmIndexUrl);
        await expect(appRepoCreate.helmUrlInput()).toHaveValue(helmIndexUrl);

        await appRepoCreate.selectGitRepoCard();
        await appRepoCreate.selectHelmUrlCard();
        await expect(appRepoCreate.helmUrlInput()).toHaveValue('');

        await appRepoCreate.selectGitRepoCard();

        await appRepoCreate.gitRepoUrlInput().fill(gitRepoName);
        await appRepoCreate.gitRepoBranchInput().fill(gitRepoBranchName);
        await expect(appRepoCreate.gitRepoUrlInput()).toHaveValue(gitRepoName);
        await expect(appRepoCreate.gitRepoBranchInput()).toHaveValue(gitRepoBranchName);

        await appRepoCreate.selectHelmUrlCard();
        await appRepoCreate.selectGitRepoCard();
        await expect(appRepoCreate.gitRepoUrlInput()).toHaveValue('');
        await expect(appRepoCreate.gitRepoBranchInput()).toHaveValue('');

        await appRepoCreate.selectOciUrlCard();

        await appRepoCreate.ociUrlInput().fill('oci://test.rancher.io/charts/mychart');
        await appRepoCreate.ociCaBundleInput().fill('test');
        await appRepoCreate.ociMinWaitField().fill('2');
        await appRepoCreate.ociMaxWaitField().fill('2');
        await appRepoCreate.ociMaxRetriesInput().fill('2');

        await expect(appRepoCreate.ociUrlInput()).toHaveValue('oci://test.rancher.io/charts/mychart');
        await expect(appRepoCreate.ociCaBundleInput()).toHaveValue('test');

        await appRepoCreate.selectHelmUrlCard();
        await appRepoCreate.selectOciUrlCard();

        await expect(appRepoCreate.ociUrlInput()).toHaveValue('');
        await expect(appRepoCreate.ociCaBundleInput()).toHaveValue('');
        await expect(appRepoCreate.ociMinWaitField()).toHaveValue('');
        await expect(appRepoCreate.ociMaxWaitField()).toHaveValue('');
        await expect(appRepoCreate.ociMaxRetriesInput()).toHaveValue('');
      });
    });

    test.describe('Refresh', () => {
      test('repo refresh results in correct api requests', async ({ page, login }) => {
        await login();

        const appRepoList = new ChartRepositoriesPagePo(page, 'local', 'apps');

        await appRepoList.goTo();
        await appRepoList.waitForPage();

        await appRepoList.sortableTable().checkLoadingIndicatorNotVisible();
        await expect(appRepoList.sortableTable().rowElementWithName('Rancher')).toBeVisible();
        await expect(appRepoList.list().state('Rancher')).toContainText('Active', { timeout: LONG });
      });
    });
  });
});
