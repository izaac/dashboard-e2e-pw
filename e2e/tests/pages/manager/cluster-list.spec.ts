import * as jsyaml from 'js-yaml';
import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreateRke2CustomPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-custom.po';
import { promptModal } from '@/e2e/po/prompts/modalInstances.po';
import { SHORT_TIMEOUT_OPT } from '@/support/timeouts';

test.describe('Cluster List', { tag: ['@manager', '@adminUser'] }, () => {
  test('can group clusters by namespace', async ({ login, page, rancherApi }) => {
    const nsName = rancherApi.createE2EResourceName('namespace');
    const customClusterName = rancherApi.createE2EResourceName('generic-cluster');
    let nsCreated = false;

    await login();

    await rancherApi.createNamespace(nsName);
    nsCreated = true;

    const clusterList = new ClusterManagerListPagePo(page);
    const createPage = new ClusterManagerCreateRke2CustomPagePo(page);

    try {
      await clusterList.goTo();
      await clusterList.waitForPage();

      await expect(clusterList.sortableTable().groupByButtons(0)).not.toBeAttached();

      await clusterList.createCluster();
      await expect(page).toHaveURL(/provisioning\.cattle\.io\.cluster\/create/);
      await createPage.selectCustom(0);

      await expect(createPage.title()).toContainText('Cluster: Create Custom');
      await expect(createPage.nameNsDescription().name().self()).toBeVisible();

      await createPage.resourceDetail().createEditView().editClusterAsYaml();
      const modal = promptModal(page);

      await expect(modal.self()).toBeVisible();
      await modal.clickActionButton('Save and Continue');
      await expect(page).toHaveURL(/type=custom/);

      const clusterCreateResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
        SHORT_TIMEOUT_OPT,
      );

      const yamlVal = await createPage.resourceDetail().resourceYaml().codeMirror().value();
      const json: any = jsyaml.load(yamlVal);

      json.metadata.name = customClusterName;
      json.metadata.namespace = nsName;

      await createPage.resourceDetail().resourceYaml().codeMirror().set(jsyaml.dump(json));
      await createPage.resourceDetail().createEditView().saveClusterAsYaml();

      const clusterResponse = await clusterCreateResponsePromise;

      expect(clusterResponse.status()).toBe(201);
      const respBody = await clusterResponse.json();

      expect(respBody.metadata.namespace).toBe(nsName);

      await clusterList.waitForPage();
      await clusterList.goTo();

      await expect(clusterList.list().state(customClusterName)).toContainText(/Updating|Reconciling/);

      await expect(clusterList.sortableTable().groupByButtons(1)).toBeVisible();
      await clusterList.sortableTable().groupByButtons(1).click();

      const groupRow = clusterList.sortableTable().groupElementWithName(`Namespace: ${nsName}`);

      await groupRow.scrollIntoViewIfNeeded();
      await expect(groupRow).toBeVisible();
    } finally {
      if (nsCreated) {
        await rancherApi.deleteRancherResource('v1', 'namespaces', nsName, false);
      }
    }
  });
});
