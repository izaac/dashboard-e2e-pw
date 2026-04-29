import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreateGKEPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-gke.po';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';
import { LONG } from '@/support/timeouts';

/**
 * Running this test will delete all GKE cloud credentials from the target cluster.
 * Requires: GKE_SERVICE_ACCOUNT (base64-encoded JSON service account key)
 */
test.describe(
  'Deploy GKE cluster with default settings',
  { tag: ['@manager', '@adminUser', '@jenkins', '@provisioning', '@needsInfra'] },
  () => {
    test('Successfully create GKE cluster with default settings', async ({ page, login, rancherApi, envMeta }) => {
      test.skip(
        !envMeta.gkeServiceAccount,
        'Requires GKE service account (GKE_SERVICE_ACCOUNT env var — base64-encoded JSON)',
      );

      await login();

      const clusterName = rancherApi.createE2EResourceName('gkecluster');
      const credName = rancherApi.createE2EResourceName('gkecloudcredential');
      const gkeDefaultZone = 'us-central1-c';

      // Decode service account to get project ID
      const decodedJson = Buffer.from(envMeta.gkeServiceAccount!, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(decodedJson);
      const gkeProjectId: string = serviceAccount.project_id;
      const serviceAccountJsonString = JSON.stringify(serviceAccount);

      let cloudCredId = '';
      let clusterId = '';

      // Clean up existing e2e GKE cloud credentials
      const creds = await rancherApi.getRancherResource('v3', 'cloudcredentials');

      for (const item of creds.body.data ?? []) {
        if (item.googlecredentialConfig && item.name?.startsWith('e2e-test-')) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
        }
      }

      const clusterList = new ClusterManagerListPagePo(page);
      const createGKEClusterPage = new ClusterManagerCreateGKEPagePo(page);

      try {
        // Navigate to GKE create page
        await clusterList.goTo();
        await clusterList.waitForPage();
        await clusterList.createCluster();
        await createGKEClusterPage.selectKubeProvider(2);
        await expect(createGKEClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
        await expect(createGKEClusterPage.rke2PageTitle()).toContainText('Create Google GKE');
        await createGKEClusterPage.waitForPage('type=gke&rkeType=rke2');

        // Create GKE cloud credential inline
        const cloudCredForm = createGKEClusterPage.cloudCredentialsForm();

        await expect(cloudCredForm.saveButton().self()).toBeDisabled();
        await cloudCredForm.nameNsDescription().name().set(credName);
        await cloudCredForm.serviceAccount().set(serviceAccountJsonString);
        await expect(cloudCredForm.saveButton().self()).toBeEnabled();

        const credCreatePromise = page.waitForResponse(
          (resp) => resp.url().includes('/v3/cloudcredentials') && resp.request().method() === 'POST',
          { timeout: LONG },
        );

        await cloudCredForm.saveCreateForm().cruResource().saveOrCreate().click();
        const credResp = await credCreatePromise;

        expect(credResp.status()).toBe(201);
        const credBody = await credResp.json();

        cloudCredId = credBody.id;
        const encodedCredId = credBody.id?.replace(':', '%3A') ?? '';

        // Authenticate GKE credential by providing the Project ID
        await createGKEClusterPage.waitForPage('type=gke&rkeType=rke2');
        await createGKEClusterPage.authProjectId().set(gkeProjectId);

        const gkeVersionsPromise = page.waitForResponse(
          (resp) =>
            resp.url().includes('/meta/gkeVersions') &&
            resp.url().includes(`cloudCredentialId=${encodedCredId}`) &&
            resp.url().includes(`projectId=${gkeProjectId}`) &&
            resp.url().includes(`zone=${gkeDefaultZone}`),
          { timeout: LONG },
        );
        const pageLoadPromise = page.waitForResponse(
          (resp) => resp.url().includes('/v1/management.cattle.io.users') && resp.request().method() === 'GET',
          { timeout: LONG },
        );

        await cloudCredForm.authenticateButton().click();
        await pageLoadPromise;
        await expect(createGKEClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);

        const versionsResp = await gkeVersionsPromise;

        expect(versionsResp.status()).toBe(200);
        const versionsBody = await versionsResp.json();
        const gkeVersion: string = versionsBody.validMasterVersions[0];

        expect(gkeVersion).toBeTruthy();

        await expect(createGKEClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
        await createGKEClusterPage.waitForPage('type=gke&rkeType=rke2');

        // Verify default zone is selected
        await expect(createGKEClusterPage.gkeZoneSelectPo().selectedOption()).toHaveText(gkeDefaultZone, {
          useInnerText: true,
        });

        // Verify latest GKE version is selected
        await expect(createGKEClusterPage.gkeVersionSelect().selectedOption()).toContainText(gkeVersion);

        // Set cluster name and description
        await createGKEClusterPage.getClusterName().set(clusterName);
        await createGKEClusterPage.getClusterDescription().set(`${clusterName}-description`);

        // Create GKE cluster
        const clusterCreatePromise = page.waitForResponse(
          (resp) => resp.url().includes('v3/clusters') && resp.request().method() === 'POST',
          SHORT_TIMEOUT_OPT,
        );

        await createGKEClusterPage.saveCreateGkeCluster().click();
        const clusterResp = await clusterCreatePromise;

        expect(clusterResp.status()).toBe(201);
        const clusterBody = await clusterResp.json();

        expect(clusterBody).toHaveProperty('baseType', 'cluster');
        expect(clusterBody.gkeConfig).toHaveProperty('clusterName', clusterName);
        expect(clusterBody).toHaveProperty('description', `${clusterName}-description`);
        expect(clusterBody.gkeConfig.kubernetesVersion).toContain(gkeVersion);
        clusterId = clusterBody.id;

        // Verify cluster shows Provisioning state
        await clusterList.waitForPage();
        await expect(clusterList.list().state(clusterName)).toContainText(/Waiting|Provisioning/);
      } finally {
        if (clusterId) {
          await rancherApi.deleteRancherResource('v3', 'clusters', clusterId, false);
        }
        if (cloudCredId) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', cloudCredId, false);
        }
      }
    });
  },
);
