import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';

/**
 * Running this test will delete all GKE cloud credentials from the target cluster.
 * Requires: GKE_SERVICE_ACCOUNT (base64-encoded JSON service account key)
 */
test.describe(
  'Deploy GKE cluster with default settings',
  { tag: ['@manager', '@adminUser', '@jenkins', '@provisioning', '@needsInfra'] },
  () => {
    test.beforeEach(async ({ envMeta }) => {
      test.skip(
        !envMeta.gkeServiceAccount,
        'Requires GKE service account (GKE_SERVICE_ACCOUNT env var — base64-encoded JSON)',
      );
    });

    test('Successfully create GKE cluster with default settings', async ({ page, login, rancherApi, envMeta }) => {
      const clusterName = rancherApi.createE2EResourceName('gkecluster');
      const cloudCredentialName = rancherApi.createE2EResourceName('gkecloudcredential');
      const gkeDefaultZone = 'us-central1-c';
      let clusterId = '';
      let cloudcredentialId = '';

      // Decode base64 service account to extract project ID
      const decodedJson = Buffer.from(envMeta.gkeServiceAccount!, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(decodedJson);
      const gkeProjectId: string = serviceAccount.project_id;
      const serviceAccountJsonString = JSON.stringify(serviceAccount);

      await login();

      // Clean up any existing GKE cloud credentials
      const creds = await rancherApi.getRancherResource('v3', 'cloudcredentials');

      for (const item of creds.body.data ?? []) {
        if (item.googlecredentialConfig) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
        }
      }

      const clusterList = new ClusterManagerListPagePo(page);
      const createPage = new ClusterManagerCreatePagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createPage.waitForPage();

      await createPage.selectKubeProvider(2);
      await expect(page).toHaveURL(/type=gke&rkeType=rke2/);

      try {
        // Create GKE cloud credential via API (avoids UI form dependencies)
        const credResp = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
          type: 'cloudcredential',
          metadata: { name: cloudCredentialName, namespace: 'fleet-default' },
          googlecredentialConfig: { authEncodedJson: serviceAccountJsonString },
        });

        expect(credResp.status).toBe(201);
        cloudcredentialId = credResp.body.id?.replace(':', '%3A') ?? '';

        const gkeVersionsResponse = page.waitForResponse(
          (resp) =>
            resp.url().includes('/meta/gkeVersions') &&
            resp.url().includes(`projectId=${gkeProjectId}`) &&
            resp.url().includes(`zone=${gkeDefaultZone}`),
        );
        const versionsResp = await gkeVersionsResponse;

        expect(versionsResp.status()).toBe(200);
        const versionsBody = await versionsResp.json();
        const gkeVersion: string = versionsBody.validMasterVersions[0];

        expect(gkeVersion).toBeTruthy();

        await expect(createPage.gkeZoneSelect()).toBeVisible();

        const createClusterResponse = page.waitForResponse(
          (resp) => resp.url().includes('v3/clusters') && resp.request().method() === 'POST',
        );
        const response = await createClusterResponse;

        expect(response.status()).toBe(201);
        const body = await response.json();

        expect(body.baseType).toBe('cluster');
        expect(body.gkeConfig.clusterName).toBe(clusterName);
        expect(body.gkeConfig.kubernetesVersion).toContain(gkeVersion);
        clusterId = body.id;

        await clusterList.waitForPage();
        await expect(clusterList.sortableTable().self()).toBeVisible();
      } finally {
        if (clusterId) {
          await rancherApi.deleteRancherResource(
            'v1',
            'provisioning.cattle.io.clusters',
            `fleet-default/${clusterId}`,
            false,
          );
        }
        if (cloudcredentialId) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', cloudcredentialId, false);
        } else {
          // Fallback: clean up all GKE credentials
          const credsAfter = await rancherApi.getRancherResource('v3', 'cloudcredentials');

          for (const item of credsAfter.body.data ?? []) {
            if (item.googlecredentialConfig) {
              await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
            }
          }
        }
      }
    });
  },
);
