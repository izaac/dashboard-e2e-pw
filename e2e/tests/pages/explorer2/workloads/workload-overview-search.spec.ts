import { test, expect } from '@/support/fixtures';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import WorkloadSearchPo from '@/e2e/po/components/workload-search.po';

const SEARCH_PREFIX = 'qa-search';
const DEPLOYMENT_COUNT = 8;
const DAEMONSET_NAME = 'qa-search-daemonset';
const DEPLOYMENTS = Array.from(
  { length: DEPLOYMENT_COUNT },
  (_, i) => `qa-search-deploy-${String(i + 1).padStart(2, '0')}`,
);

function podTemplate(name: string) {
  return {
    metadata: { labels: { app: name } },
    spec: {
      containers: [{ name: 'pause', image: 'registry.k8s.io/pause:3.10' }],
      terminationGracePeriodSeconds: 0,
    },
  };
}

test.describe('Workload Overview Search (#18232)', { tag: ['@explorer2', '@adminUser'] }, () => {
  let testNamespace = '';

  test.beforeAll(async ({ rancherApi }) => {
    testNamespace = rancherApi.createE2EResourceName('qa-18232-ws');
    await rancherApi.createNamespace(testNamespace);

    for (const name of DEPLOYMENTS) {
      await rancherApi.createRancherResource('v1', 'apps.deployments', {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name, namespace: testNamespace },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: name } },
          template: podTemplate(name),
        },
      });
    }

    // A second workload type, to verify results are grouped by type
    await rancherApi.createRancherResource('v1', 'apps.daemonsets', {
      apiVersion: 'apps/v1',
      kind: 'DaemonSet',
      metadata: { name: DAEMONSET_NAME, namespace: testNamespace },
      spec: {
        selector: { matchLabels: { app: DAEMONSET_NAME } },
        template: podTemplate(DAEMONSET_NAME),
      },
    });
  });

  test.afterAll(async ({ rancherApi }) => {
    // Deleting the namespace removes every seeded workload with it
    if (testNamespace) {
      await rancherApi.deleteNamespace([testNamespace]);
    }
  });

  test.beforeEach(async ({ page, login, rancherApi }) => {
    await login();
    await rancherApi.updateNamespaceFilter('local', 'none', JSON.stringify({ local: [`ns://${testNamespace}`] }));
    await page.goto('./c/local/explorer/workload-dashboard');

    const welcome = new WelcomeDialogPo(page);

    await welcome
      .self()
      .waitFor({ state: 'visible', timeout: 3000 })
      .catch(() => {});
    await welcome.dismissIfVisible();
  });

  test.afterEach(async ({ rancherApi }) => {
    await rancherApi.updateNamespaceFilter('local', 'none', '{"local":["all://user"]}');
  });

  test('shows the minimum characters message when typing 1 or 2 characters', async ({ page }) => {
    const search = new WorkloadSearchPo(page);

    await expect(search.input()).toBeVisible();

    await search.search('q');
    await expect(search.noOptions()).toContainText('Type at least 3 characters to search');
    await expect(search.options()).toHaveCount(0);

    await search.search('qa');
    await expect(search.noOptions()).toContainText('Type at least 3 characters to search');
    await expect(search.options()).toHaveCount(0);
  });

  test('does not allow whitespace in the search input', async ({ page }) => {
    const search = new WorkloadSearchPo(page);

    await expect(search.input()).toBeVisible();
    await search.input().click();

    // Typed whitespace is dropped, the other characters are kept
    await search.input().pressSequentially('qa search');
    await expect(search.input()).toHaveValue('qasearch');

    await search.input().press('Space');
    await expect(search.input()).toHaveValue('qasearch');
  });

  test('shows a no matching workloads message when nothing matches', async ({ page }) => {
    const search = new WorkloadSearchPo(page);

    await expect(search.input()).toBeVisible();
    await search.search('qa-18232-does-not-exist');

    await expect(search.noOptions()).toContainText('No matching workloads');
    await expect(search.options()).toHaveCount(0);
    await expect(search.groupLabels()).toHaveCount(0);
  });

  test('groups results by type and shows a "more" link when a type has more than 7 matches', async ({ page }) => {
    const search = new WorkloadSearchPo(page);

    await expect(search.input()).toBeVisible();
    await search.search(SEARCH_PREFIX);

    await expect(search.dropdown()).toBeVisible();
    await expect(search.groupLabels().filter({ hasText: `Deployments (${DEPLOYMENT_COUNT})` })).toBeVisible();
    await expect(search.groupLabels().filter({ hasText: 'DaemonSets (1)' })).toBeVisible();
    await expect(search.errorLabels()).toHaveCount(0);

    // Only 7 of the 8 deployments are listed, the rest sit behind the "more" row
    await expect(search.moreLinks().filter({ hasText: /^\+ 1 more Deployments?$/ })).toBeVisible();
    await expect(search.options().filter({ hasText: DAEMONSET_NAME }).first()).toBeVisible();
  });

  test('navigates to the resource detail page when a result is clicked', async ({ page }) => {
    const search = new WorkloadSearchPo(page);
    const target = DEPLOYMENTS[0];

    await expect(search.input()).toBeVisible();
    await search.search(target);

    await expect(search.groupLabels().filter({ hasText: 'Deployments (1)' })).toBeVisible();
    await search.options().filter({ hasText: target }).first().getByText(target, { exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/c/local/explorer/apps\\.deployment/${testNamespace}/${target}$`));
  });

  test('navigates to the filtered resource list when the "more" link is clicked', async ({ page }) => {
    const search = new WorkloadSearchPo(page);
    const term = 'qa-search-deploy';

    await expect(search.input()).toBeVisible();
    await search.search(term);

    const moreLink = search.moreLinks().filter({ hasText: /^\+ 1 more Deployments?$/ });

    await expect(moreLink).toBeVisible();
    await moreLink.click();

    await expect(page).toHaveURL(/\/c\/local\/explorer\/apps\.deployment\?/);
    expect(new URL(page.url()).searchParams.get('nameFilter')).toBe(term);
  });
});
