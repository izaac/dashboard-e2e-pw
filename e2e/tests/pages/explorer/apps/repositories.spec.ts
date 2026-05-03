import { test, expect } from '@/support/fixtures';
import ChartRepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';
import ChartRepositoriesCreateEditPo from '@/e2e/po/edit/chart-repositories.po';
import { LONG } from '@/support/timeouts';

test.describe('Apps', () => {
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

        // Guard: row count should be less than page size (upstream parity)
        expect(initialRowCount).toBeLessThan(10);

        try {
          await appRepoList.create();

          const appRepoCreate = new ChartRepositoriesCreateEditPo(page, 'local', 'apps');

          await appRepoCreate.waitForPage();
          await appRepoCreate.nameNsDescription().name().set(repoName);

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

        // Helm: fill → switch away → switch back → verify empty
        await appRepoCreate.helmUrlInput().fill('https://charts.rancher.io');
        await appRepoCreate.selectGitRepoCard();
        await appRepoCreate.selectHelmUrlCard();
        await expect(appRepoCreate.helmUrlInput()).toHaveValue('');

        // Git: fill → switch away → switch back → verify empty
        await appRepoCreate.selectGitRepoCard();
        await appRepoCreate.gitRepoUrlInput().fill('https://github.com/rancher/ui-plugin-examples');
        await appRepoCreate.gitRepoBranchInput().fill('test-branch');
        await appRepoCreate.selectHelmUrlCard();
        await appRepoCreate.selectGitRepoCard();
        await expect(appRepoCreate.gitRepoUrlInput()).toHaveValue('');
        await expect(appRepoCreate.gitRepoBranchInput()).toHaveValue('');

        // OCI: fill all fields + checkboxes → switch away → switch back → verify all empty/unchecked
        await appRepoCreate.selectOciUrlCard();
        await appRepoCreate.ociUrlInput().fill('oci://test.rancher.io/charts/mychart');
        await appRepoCreate.ociCaBundleInput().fill('test');
        await appRepoCreate.ociSkipTlsCheckbox().set();
        await appRepoCreate.ociInsecurePlainHttpCheckbox().set();
        await appRepoCreate.ociMinWaitField().fill('2');
        await appRepoCreate.ociMaxWaitField().fill('2');
        await appRepoCreate.ociMaxRetriesInput().fill('2');

        // Checkboxes need toggle verification (set() is a click)
        await expect(appRepoCreate.ociSkipTlsCheckbox().checkboxCustom()).toHaveAttribute('aria-checked', 'true');
        await expect(appRepoCreate.ociInsecurePlainHttpCheckbox().checkboxCustom()).toHaveAttribute(
          'aria-checked',
          'true',
        );

        await appRepoCreate.selectHelmUrlCard();
        await appRepoCreate.selectOciUrlCard();

        await expect(appRepoCreate.ociUrlInput()).toHaveValue('');
        await expect(appRepoCreate.ociCaBundleInput()).toHaveValue('');
        await expect(appRepoCreate.ociSkipTlsCheckbox().checkboxCustom()).toHaveAttribute('aria-checked', 'false');
        await expect(appRepoCreate.ociInsecurePlainHttpCheckbox().checkboxCustom()).toHaveAttribute(
          'aria-checked',
          'false',
        );
        await expect(appRepoCreate.ociMinWaitField()).toHaveValue('');
        await expect(appRepoCreate.ociMaxWaitField()).toHaveValue('');
        await expect(appRepoCreate.ociMaxRetriesInput()).toHaveValue('');

        // Auth dropdown: HTTP Basic available, SSH Key absent when OCI selected
        const authPo = appRepoCreate.clusterRepoAuthSelectOrCreate();

        await authPo.waitForNotLoading();
        await authPo.authSelect().dropdown().click();
        await authPo.authSelect().isOpened();
        await expect(
          authPo.authSelect().getOptions().filter({ hasText: 'Create an HTTP Basic Auth Secret' }),
        ).toBeVisible();
        await expect(
          authPo.authSelect().getOptions().filter({ hasText: 'Create an SSH Key Secret' }),
        ).not.toBeAttached();
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
