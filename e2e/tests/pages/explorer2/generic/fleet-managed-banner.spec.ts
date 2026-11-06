import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import { ConfigMapDetailPagePo } from '@/e2e/po/pages/explorer/configmaps.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { gitRepoTargetAllClustersRequest } from '@/e2e/blueprints/fleet/gitrepos';

const CLUSTER = 'local';
const FLEET_NAMESPACE = 'fleet-default';
const SWEEP_LABEL = 'e2e-suite';
const SWEEP_LABEL_VALUE = 'fleet-managed-banner';
const LABEL_KIND = 'fleet.cattle.io/managed-by-kind';
const LABEL_NAMESPACE = 'fleet.cattle.io/managed-by-namespace';
const LABEL_NAME = 'fleet.cattle.io/managed-by-name';

const GITREPO_CM = 'gitrepo-cm';
const HELMOP_CM = 'helmop-cm';
const BUNDLE_CM = 'bundle-cm';
const FALLBACK_CM = 'fallback-cm';
const UNMANAGED_CM = 'unmanaged-cm';

test.describe('Fleet managed resource banner', { tag: ['@generic', '@adminUser'] }, () => {
  let testNamespace: string;
  let gitRepoName: string;

  async function openDetail(page: Page, name: string) {
    const detail = new ConfigMapDetailPagePo(page, CLUSTER, testNamespace, name);

    await detail.goTo();
    await detail.waitForPage();
    await new WelcomeDialogPo(page).dismissIfVisible();

    return detail;
  }

  test.beforeAll(async ({ rancherApi }) => {
    testNamespace = rancherApi.createE2EResourceName('fleet-managed-banner');
    gitRepoName = rancherApi.createE2EResourceName('fleet-managed-gitrepo');

    await rancherApi.createRancherResource('v1', 'namespaces', {
      type: 'namespace',
      metadata: { name: testNamespace, labels: { [SWEEP_LABEL]: SWEEP_LABEL_VALUE } },
    });

    await rancherApi.createRancherResource(
      'v1',
      'fleet.cattle.io.gitrepos',
      gitRepoTargetAllClustersRequest(
        FLEET_NAMESPACE,
        gitRepoName,
        'https://github.com/rancher/fleet-test-data.git',
        'master',
        'simple',
      ),
    );

    const configMaps: Array<{ name: string; labels: Record<string, string> }> = [
      {
        name: GITREPO_CM,
        labels: { [LABEL_KIND]: 'gitrepo', [LABEL_NAMESPACE]: FLEET_NAMESPACE, [LABEL_NAME]: gitRepoName },
      },
      {
        name: HELMOP_CM,
        labels: { [LABEL_KIND]: 'helmop', [LABEL_NAMESPACE]: FLEET_NAMESPACE, [LABEL_NAME]: 'demo-helmop' },
      },
      {
        name: BUNDLE_CM,
        labels: { [LABEL_KIND]: 'bundle', [LABEL_NAMESPACE]: FLEET_NAMESPACE, [LABEL_NAME]: 'demo-bundle' },
      },
      { name: FALLBACK_CM, labels: { [LABEL_KIND]: 'gitrepo' } },
      { name: UNMANAGED_CM, labels: {} },
    ];

    for (const { name, labels } of configMaps) {
      await rancherApi.createConfigMap(testNamespace, name, { metadata: { labels } });
    }
  });

  test.afterAll(async ({ rancherApi }) => {
    await rancherApi.deleteRancherResource(
      'v1',
      'fleet.cattle.io.gitrepos',
      `${FLEET_NAMESPACE}/${gitRepoName}`,
      false,
    );
    await rancherApi.deleteRancherResource('v1', 'namespaces', testNamespace, false);
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('GitRepo managed resource displays Managed badge, Continuous Delivery banner, and deep link to GitRepo', async ({
    page,
  }) => {
    const fleetManaged = (await openDetail(page, GITREPO_CM)).fleetManaged();

    await expect(fleetManaged.badge()).toBeVisible();
    await expect(fleetManaged.badge()).toContainText('Managed');
    await expect(fleetManaged.badgeIcon().first()).toHaveClass(/icon-fleet-alt/);

    await expect(fleetManaged.banner()).toBeVisible();
    await expect(fleetManaged.banner()).toContainText('This resource is managed by Continuous Delivery');

    await expect(fleetManaged.bannerLink()).toBeVisible();
    await expect(fleetManaged.bannerLink()).toContainText('View in Continuous Delivery');
    await expect(fleetManaged.bannerLink()).toHaveAttribute(
      'href',
      new RegExp(`/fleet/application/fleet\\.cattle\\.io\\.gitrepo/${FLEET_NAMESPACE}/`),
    );

    await fleetManaged.bannerLink().click();

    await expect(page).toHaveURL(
      new RegExp(`/c/(_|local)/fleet/application/fleet\\.cattle\\.io\\.gitrepo/${FLEET_NAMESPACE}/${gitRepoName}`),
    );
  });

  test('HelmOp managed resource displays Managed badge and link to HelmOp application route', async ({ page }) => {
    const fleetManaged = (await openDetail(page, HELMOP_CM)).fleetManaged();

    await expect(fleetManaged.badge()).toBeVisible();
    await expect(fleetManaged.banner()).toBeVisible();
    await expect(fleetManaged.bannerLink()).toHaveAttribute(
      'href',
      new RegExp(`/fleet/application/fleet\\.cattle\\.io\\.helmop/${FLEET_NAMESPACE}/demo-helmop`),
    );
  });

  test('Bundle managed resource displays Managed badge and link to Bundle product route', async ({ page }) => {
    const fleetManaged = (await openDetail(page, BUNDLE_CM)).fleetManaged();

    await expect(fleetManaged.badge()).toBeVisible();
    await expect(fleetManaged.banner()).toBeVisible();
    await expect(fleetManaged.bannerLink()).toHaveAttribute(
      'href',
      new RegExp(`/fleet/fleet\\.cattle\\.io\\.bundle/${FLEET_NAMESPACE}/demo-bundle`),
    );
  });

  test('Resource with missing target labels renders banner without broken link', async ({ page }) => {
    const fleetManaged = (await openDetail(page, FALLBACK_CM)).fleetManaged();

    await expect(fleetManaged.badge()).toBeVisible();
    await expect(fleetManaged.banner()).toBeVisible();
    await expect(fleetManaged.bannerLink()).toHaveCount(0);
  });

  test('Unmanaged resource renders neither Managed badge nor banner', async ({ page }) => {
    const detail = await openDetail(page, UNMANAGED_CM);
    const fleetManaged = detail.fleetManaged();

    await expect(detail.resourceName()).toBeVisible();
    await expect(fleetManaged.badge()).toHaveCount(0);
    await expect(fleetManaged.banner()).toHaveCount(0);
  });

  test('Banner link has text-no-break styling', async ({ page }) => {
    const fleetManaged = (await openDetail(page, GITREPO_CM)).fleetManaged();

    await expect(fleetManaged.bannerLink()).toHaveClass(/\bsecondary\b/);
    await expect(fleetManaged.bannerLink()).toHaveClass(/\btext-no-break\b/);
  });
});
