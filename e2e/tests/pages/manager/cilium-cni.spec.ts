import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreateRke2CustomPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-custom.po';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';

const cloudCredentialsResponse = {
  type: 'collection',
  resourceType: 'cloudCredential',
  data: [
    {
      annotations: { 'provisioning.cattle.io/driver': 'digitalocean' },
      baseType: 'cloudCredential',
      created: '2023-05-17T12:03:44Z',
      createdTS: 1684325024000,
      creatorId: 'user-8ajxt',
      digitaloceancredentialConfig: {},
      id: 'cattle-global-data:cc-zzz2l',
      labels: { 'cattle.io/creator': 'norman' },
      name: 'pw-do',
      type: 'cloudCredential',
      uuid: 'abc6bb3f-0876-4e0f-8057-04d2cc8bdd17',
    },
  ],
};

test.describe('RKE2 Cilium CNI', () => {
  test(
    'bandwidth manager configuration is sent correctly on cluster create',
    { tag: ['@manager', '@adminUser', '@clusterConfig'] },
    async ({ login, page }) => {
      await page.route('**/v3/cloudcredentials', (route) => route.fulfill({ json: cloudCredentialsResponse }));
      await page.route('**/v1/rke-machine-config.cattle.io.digitaloceanconfigs/fleet-default', (route) =>
        route.fulfill({ status: 201, json: {} }),
      );

      let capturedClusterBody: any = null;

      await page.route('**/v1/provisioning.cattle.io.clusters', (route) => {
        if (route.request().method() === 'POST') {
          capturedClusterBody = route.request().postDataJSON();

          return route.fulfill({ status: 201, json: {} });
        }

        return route.fallback();
      });

      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const createPage = new ClusterManagerCreateRke2CustomPagePo(page);

      await clusterList.goTo();
      await clusterList.checkIsCurrentPage();
      await clusterList.createCluster();

      await createPage.goToDigitalOceanCreation('_');
      await expect(page).toHaveURL(/type=digitalocean/);
      await createPage.nameNsDescription().name().set('test-do-cilium');

      const cniSelect = createPage.cniSelect();

      await expect(cniSelect.self()).toBeAttached();
      await cniSelect.self().scrollIntoViewIfNeeded();
      await cniSelect.checkOptionSelected('calico');

      const bandwidthManager = createPage.ciliumBandwidthManagerCheckbox();

      await expect(bandwidthManager.self()).not.toBeAttached();

      await cniSelect.toggle();
      await cniSelect.clickLabel('cilium');
      await cniSelect.checkOptionSelected('cilium');
      await cniSelect.isClosed();

      await expect(bandwidthManager.self()).toBeAttached();
      await bandwidthManager.self().scrollIntoViewIfNeeded();
      await bandwidthManager.isUnchecked();

      await bandwidthManager.set();
      await bandwidthManager.isChecked();

      const clusterSavePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
        SHORT_TIMEOUT_OPT,
      );

      await createPage.create();
      await clusterSavePromise;

      expect(capturedClusterBody).not.toBeNull();
      expect(capturedClusterBody.spec.rkeConfig.chartValues['rke2-cilium'].bandwidthManager.enabled).toBe(true);
    },
  );
});
