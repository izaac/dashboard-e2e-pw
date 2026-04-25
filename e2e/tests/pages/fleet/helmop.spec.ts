import { test, expect } from '@/support/fixtures';
import {
  FleetApplicationCreatePo,
  FleetApplicationListPagePo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.application.po';
import { FleetHelmOpCreateEditPo } from '@/e2e/po/pages/fleet/fleet.cattle.io.helmop.po';
import { HeaderPo } from '@/e2e/po/components/header.po';

const workspace = 'fleet-default';

/**
 * These tests require a downstream cluster registered in fleet-default workspace.
 * Without one, the target cluster selector has no options and creation fails.
 * We check for provisioning clusters at test time and skip if none exist.
 */
test.describe('Fleet HelmOps', { tag: ['@fleet', '@adminUser'] }, () => {
  test.describe('Create and Edit HelmOp with Secrets and ConfigMaps', () => {
    let hasDownstreamCluster = false;
    let downstreamClusterName: string;

    test.beforeEach(async ({ login, rancherApi }) => {
      await login();

      // Check for a real downstream cluster in fleet-default
      const clusters = await rancherApi.getRancherResource('v1', 'fleet.cattle.io.clusters', undefined, 200);
      const fleetDefaultClusters = (clusters.body.data || []).filter((c: any) => c.metadata?.namespace === workspace);

      hasDownstreamCluster = fleetDefaultClusters.length > 0;
      if (hasDownstreamCluster) {
        downstreamClusterName = fleetDefaultClusters[0].metadata.name;
      }
    });

    test('Can create a HelmOp with Secrets and ConfigMaps', async ({ page, rancherApi }) => {
      test.skip(!hasDownstreamCluster, 'Requires a downstream cluster in fleet-default workspace');

      const helmOpName = rancherApi.createE2EResourceName('helmop-create');
      const ts = Date.now();
      const secret1Name = `helmop-secret-${ts}-1`;
      const secret2Name = `helmop-secret-${ts}-2`;
      const configMap1Name = `helmop-cm-${ts}-1`;
      const configMap2Name = `helmop-cm-${ts}-2`;

      await rancherApi.createRancherResource('v1', 'secrets', {
        type: 'Opaque',
        metadata: { name: secret1Name, namespace: workspace },
        data: { key1: btoa('value1') },
      });
      await rancherApi.createRancherResource('v1', 'secrets', {
        type: 'Opaque',
        metadata: { name: secret2Name, namespace: workspace },
        data: { key2: btoa('value2') },
      });
      await rancherApi.createRancherResource('v1', 'configmaps', {
        metadata: { name: configMap1Name, namespace: workspace },
        data: { key1: 'value1' },
      });
      await rancherApi.createRancherResource('v1', 'configmaps', {
        metadata: { name: configMap2Name, namespace: workspace },
        data: { key2: 'value2' },
      });

      try {
        const appBundleCreatePage = new FleetApplicationCreatePo(page);
        const headerPo = new HeaderPo(page);

        const createResponsePromise = page.waitForResponse(
          (resp) => resp.url().includes('/v1/fleet.cattle.io.helmops') && resp.request().method() === 'POST',
        );

        await appBundleCreatePage.goTo();
        await appBundleCreatePage.waitForPage();
        await headerPo.selectWorkspace(workspace);
        await appBundleCreatePage.createHelmOp();

        const helmOpCreatePage = new FleetHelmOpCreateEditPo(page);

        await helmOpCreatePage.waitForPage();

        await helmOpCreatePage.resourceDetail().createEditView().nameNsDescription().name().set(helmOpName);
        await helmOpCreatePage.resourceDetail().createEditView().nextPage();

        await helmOpCreatePage.setChart('redis');
        await helmOpCreatePage.setRepository('https://charts.bitnami.com/bitnami');
        await helmOpCreatePage.setVersion('24.0.0');
        await helmOpCreatePage.resourceDetail().createEditView().nextPage();

        // Values step
        await helmOpCreatePage.resourceDetail().createEditView().nextPage();

        // Target step
        await helmOpCreatePage.setTargetNamespace('default');
        await helmOpCreatePage.targetClusterOptions().set(2);
        await helmOpCreatePage.targetCluster().toggle();
        await helmOpCreatePage.targetCluster().clickLabel(downstreamClusterName);
        await helmOpCreatePage.resourceDetail().createEditView().nextPage();

        // Advanced step - wait for secrets/configmaps to load
        await page.waitForResponse((resp) => resp.url().includes('/v1/secrets') && resp.status() === 200);

        await expect(helmOpCreatePage.secretsSelector().self()).toBeAttached();
        await helmOpCreatePage.secretsSelector().toggle();
        await helmOpCreatePage.secretsSelector().clickLabel(secret1Name);
        await helmOpCreatePage.secretsSelector().isClosed();
        await helmOpCreatePage.secretsSelector().toggle();
        await helmOpCreatePage.secretsSelector().clickLabel(secret2Name);

        await expect(helmOpCreatePage.configMapsSelector().self()).toBeAttached();
        await helmOpCreatePage.configMapsSelector().toggle();
        await helmOpCreatePage.configMapsSelector().clickLabel(configMap1Name);
        await helmOpCreatePage.configMapsSelector().isClosed();
        await helmOpCreatePage.configMapsSelector().toggle();
        await helmOpCreatePage.configMapsSelector().clickLabel(configMap2Name);

        await helmOpCreatePage.resourceDetail().createEditView().create();

        const response = await createResponsePromise;
        const responseBody = await response.json();
        const requestBody = JSON.parse(response.request().postData() || '{}');

        expect(response.status()).toBe(201);

        // Verify downstreamResources in spec (not spec.helm) per #15921
        expect(requestBody.spec.downstreamResources).toBeInstanceOf(Array);
        expect(requestBody.spec.downstreamResources).toHaveLength(4);

        const reqSecrets = requestBody.spec.downstreamResources.filter((r: any) => r.kind === 'Secret');

        expect(reqSecrets).toHaveLength(2);
        expect(reqSecrets.map((s: any) => s.name)).toEqual(expect.arrayContaining([secret1Name, secret2Name]));

        const reqConfigMaps = requestBody.spec.downstreamResources.filter((r: any) => r.kind === 'ConfigMap');

        expect(reqConfigMaps).toHaveLength(2);
        expect(reqConfigMaps.map((cm: any) => cm.name)).toEqual(
          expect.arrayContaining([configMap1Name, configMap2Name]),
        );

        expect(responseBody.spec.downstreamResources).toBeInstanceOf(Array);
        expect(responseBody.spec.downstreamResources).toHaveLength(4);
      } finally {
        await rancherApi.deleteRancherResource('v1', 'fleet.cattle.io.helmops', `${workspace}/${helmOpName}`, false);
        await rancherApi.deleteRancherResource('v1', 'secrets', `${workspace}/${secret1Name}`, false);
        await rancherApi.deleteRancherResource('v1', 'secrets', `${workspace}/${secret2Name}`, false);
        await rancherApi.deleteRancherResource('v1', 'configmaps', `${workspace}/${configMap1Name}`, false);
        await rancherApi.deleteRancherResource('v1', 'configmaps', `${workspace}/${configMap2Name}`, false);
      }
    });

    test('Can edit a HelmOp to remove and add Secrets and ConfigMaps', async ({ page, rancherApi }) => {
      test.skip(!hasDownstreamCluster, 'Requires a downstream cluster in fleet-default workspace');

      const helmOpName = rancherApi.createE2EResourceName('helmop-edit');
      const ts = Date.now();
      const oldSecret1 = `helmop-old-secret-${ts}-1`;
      const oldSecret2 = `helmop-old-secret-${ts}-2`;
      const oldCm1 = `helmop-old-cm-${ts}-1`;
      const oldCm2 = `helmop-old-cm-${ts}-2`;
      const newSecret = `helmop-edit-secret-${ts}`;
      const newCm = `helmop-edit-cm-${ts}`;

      // Create old resources
      await rancherApi.createRancherResource('v1', 'secrets', {
        type: 'Opaque',
        metadata: { name: oldSecret1, namespace: workspace },
        data: { key1: btoa('value1') },
      });
      await rancherApi.createRancherResource('v1', 'secrets', {
        type: 'Opaque',
        metadata: { name: oldSecret2, namespace: workspace },
        data: { key2: btoa('value2') },
      });
      await rancherApi.createRancherResource('v1', 'configmaps', {
        metadata: { name: oldCm1, namespace: workspace },
        data: { key1: 'value1' },
      });
      await rancherApi.createRancherResource('v1', 'configmaps', {
        metadata: { name: oldCm2, namespace: workspace },
        data: { key2: 'value2' },
      });

      // Create new resources for edit
      await rancherApi.createRancherResource('v1', 'secrets', {
        type: 'Opaque',
        metadata: { name: newSecret, namespace: workspace },
        data: { key: btoa('value') },
      });
      await rancherApi.createRancherResource('v1', 'configmaps', {
        metadata: { name: newCm, namespace: workspace },
        data: { key: 'value' },
      });

      // Create the HelmOp via API with old resources as downstreamResources
      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.helmops', {
        type: 'fleet.cattle.io.helmop',
        metadata: { namespace: workspace, name: helmOpName },
        spec: {
          helm: {
            chart: 'redis',
            repo: 'https://charts.bitnami.com/bitnami',
            version: '24.0.0',
          },
          targets: [{ clusterName: downstreamClusterName }],
          downstreamResources: [
            { kind: 'Secret', name: oldSecret1, namespace: workspace },
            { kind: 'Secret', name: oldSecret2, namespace: workspace },
            { kind: 'ConfigMap', name: oldCm1, namespace: workspace },
            { kind: 'ConfigMap', name: oldCm2, namespace: workspace },
          ],
        },
      });

      try {
        const appBundleListPage = new FleetApplicationListPagePo(page);
        const headerPo = new HeaderPo(page);

        await appBundleListPage.goTo();
        await appBundleListPage.waitForPage();
        await headerPo.selectWorkspace(workspace);

        const actionMenu = await appBundleListPage.list().actionMenu(helmOpName);

        await actionMenu.getMenuItem('Edit Config').click();

        const helmOpEditPage = new FleetHelmOpCreateEditPo(page, workspace, helmOpName);

        await helmOpEditPage.waitForPage('mode=edit');

        // Navigate through steps to advanced
        await helmOpEditPage.resourceDetail().createEditView().nextPage();
        await helmOpEditPage.resourceDetail().createEditView().nextPage();
        await helmOpEditPage.resourceDetail().createEditView().nextPage();
        await helmOpEditPage.resourceDetail().createEditView().nextPage();

        // Wait for secrets/configmaps to load
        await page.waitForResponse((resp) => resp.url().includes('/v1/secrets') && resp.status() === 200);

        // Remove old secrets
        await expect(helmOpEditPage.secretsSelector().self()).toBeAttached();
        await helmOpEditPage.secretsSelector().clickDeselectButton(oldSecret1);
        await helmOpEditPage.secretsSelector().clickDeselectButton(oldSecret2);

        // Add new secret
        await helmOpEditPage.secretsSelector().toggle();
        await helmOpEditPage.secretsSelector().clickLabel(newSecret);

        // Remove old configmaps
        await expect(helmOpEditPage.configMapsSelector().self()).toBeAttached();
        await helmOpEditPage.configMapsSelector().clickDeselectButton(oldCm1);
        await helmOpEditPage.configMapsSelector().clickDeselectButton(oldCm2);

        // Add new configmap
        await helmOpEditPage.configMapsSelector().toggle();
        await helmOpEditPage.configMapsSelector().clickLabel(newCm);

        const updateResponsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/fleet.cattle.io.helmops/${workspace}/${helmOpName}`) &&
            resp.request().method() === 'PUT' &&
            resp.status() === 200,
        );

        await helmOpEditPage.resourceDetail().createEditView().save();

        const response = await updateResponsePromise;
        const responseBody = await response.json();
        const requestBody = JSON.parse(response.request().postData() || '{}');

        expect(response.status()).toBe(200);

        // Verify downstreamResources in spec per #15921
        expect(requestBody.spec.downstreamResources).toBeInstanceOf(Array);
        expect(requestBody.spec.downstreamResources).toHaveLength(2);

        const reqSecrets = requestBody.spec.downstreamResources.filter((r: any) => r.kind === 'Secret');

        expect(reqSecrets).toHaveLength(1);
        expect(reqSecrets[0].name).toBe(newSecret);

        const reqConfigMaps = requestBody.spec.downstreamResources.filter((r: any) => r.kind === 'ConfigMap');

        expect(reqConfigMaps).toHaveLength(1);
        expect(reqConfigMaps[0].name).toBe(newCm);

        expect(responseBody.spec.downstreamResources).toBeInstanceOf(Array);
        expect(responseBody.spec.downstreamResources).toHaveLength(2);
      } finally {
        await rancherApi.deleteRancherResource('v1', 'fleet.cattle.io.helmops', `${workspace}/${helmOpName}`, false);
        await rancherApi.deleteRancherResource('v1', 'secrets', `${workspace}/${oldSecret1}`, false);
        await rancherApi.deleteRancherResource('v1', 'secrets', `${workspace}/${oldSecret2}`, false);
        await rancherApi.deleteRancherResource('v1', 'configmaps', `${workspace}/${oldCm1}`, false);
        await rancherApi.deleteRancherResource('v1', 'configmaps', `${workspace}/${oldCm2}`, false);
        await rancherApi.deleteRancherResource('v1', 'secrets', `${workspace}/${newSecret}`, false);
        await rancherApi.deleteRancherResource('v1', 'configmaps', `${workspace}/${newCm}`, false);
      }
    });
  });
});
