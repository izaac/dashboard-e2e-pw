import { test, expect } from '@/support/fixtures';
import {
  FleetBundlesListPagePo,
  FleetBundlesCreateEditPo,
  FleetBundleDetailsPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.bundle.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import * as jsyaml from 'js-yaml';

const localWorkspace = 'fleet-local';
const defaultWorkspace = 'fleet-default';

test.describe('Bundles', { tag: ['@fleet', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai'] }, () => {
    test('validate bundles table in empty state', async ({ page, login }) => {
      await login();
      const listPage = new FleetBundlesListPagePo(page);
      const headerPo = new HeaderPo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(defaultWorkspace);

      const expectedHeaders = ['State', 'Name', 'Deployments', 'Age'];
      const actualHeaders = await listPage.list().resourceTable().sortableTable().headerNames();

      expect(actualHeaders).toEqual(expectedHeaders);
    });

    test('check table headers are available in list and details view', async ({ page, login }) => {
      await login();
      const listPage = new FleetBundlesListPagePo(page);
      const headerPo = new HeaderPo(page);
      const bundle = 'fleet-agent-local';

      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(localWorkspace);

      const expectedHeaders = ['State', 'Name', 'Deployments', 'Age'];
      const actualHeaders = await listPage.list().resourceTable().sortableTable().headerNames();

      expect(actualHeaders).toEqual(expectedHeaders);

      await listPage.goToDetailsPage(bundle);
      const detailsPage = new FleetBundleDetailsPo(page, localWorkspace, bundle);

      await detailsPage.waitForPage();
      await detailsPage.tabs().clickTabWithName('resources');

      const expectedResourceHeaders = ['State', 'Name', 'Kind', 'Cluster', 'Namespace', 'API Version'];
      const resourceHeaderNames = await detailsPage.resourcesList().sortableTable().headerNames();

      expect(resourceHeaderNames).toEqual(expectedResourceHeaders);
    });
  });

  test.describe('CRUD', () => {
    const bundleTargets = [
      {
        clusterName: 'local',
        clusterSelector: {
          matchExpressions: [{ key: 'fleet.cattle.io/non-managed-agent', operator: 'DoesNotExist' }],
        },
        ignore: {},
      },
    ];

    test('can create a bundle', async ({ page, login, rancherApi }) => {
      await login();
      const customBundleName = rancherApi.createE2EResourceName('fleet-bundle');
      const listPage = new FleetBundlesListPagePo(page);
      const headerPo = new HeaderPo(page);
      const createPage = new FleetBundlesCreateEditPo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await expect(listPage.baseResourceList().masthead().title()).toContainText('Bundles');
        await headerPo.selectWorkspace(localWorkspace);
        await listPage.baseResourceList().masthead().createYaml();
        await createPage.waitForPage('as=yaml');
        await expect(createPage.mastheadTitle()).toContainText('Bundle: Create');

        const val = await createPage.resourceDetail().resourceYaml().codeMirror().value();
        const json: any = jsyaml.load(val);

        json.metadata.name = customBundleName;
        json.spec = json.spec || {};
        json.spec.targets = bundleTargets;

        await createPage.resourceDetail().resourceYaml().codeMirror().set(jsyaml.dump(json));

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes('/v1/fleet.cattle.io.bundles') && resp.request().method() === 'POST',
        );

        await createPage.resourceDetail().resourceYaml().saveOrCreate().click();
        const resp = await responsePromise;

        expect(resp.status()).toBe(201);
        await listPage.waitForPage();
        await listPage.list().rowWithName(customBundleName).checkVisible();
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.bundles/${localWorkspace}`,
          customBundleName,
          false,
        );
      }
    });

    test('can clone a bundle', async ({ page, login, rancherApi }) => {
      await login();
      const customBundleName = rancherApi.createE2EResourceName('fleet-bundle');
      const cloneName = `${customBundleName}-clone`;

      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.bundles', {
        metadata: { name: customBundleName, namespace: localWorkspace },
        spec: { targets: bundleTargets },
      });

      try {
        const listPage = new FleetBundlesListPagePo(page);
        const headerPo = new HeaderPo(page);
        const createPage = new FleetBundlesCreateEditPo(page, localWorkspace, customBundleName);

        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(localWorkspace);

        const actionMenu = await listPage.list().actionMenu(customBundleName);

        await actionMenu.getMenuItem('Clone').click();
        await createPage.waitForPage('mode=clone&as=yaml');
        await expect(createPage.mastheadTitle()).toContainText(`Bundle: Clone from ${customBundleName}`);

        const val = await createPage.resourceDetail().resourceYaml().codeMirror().value();
        const json: any = jsyaml.load(val);

        json.metadata.name = cloneName;
        await createPage.resourceDetail().resourceYaml().codeMirror().set(jsyaml.dump(json));

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes('/v1/fleet.cattle.io.bundles') && resp.request().method() === 'POST',
        );

        await createPage.resourceDetail().resourceYaml().saveOrCreate().click();
        const resp = await responsePromise;

        expect(resp.status()).toBe(201);
        await listPage.waitForPage();
        await listPage.list().rowWithName(cloneName).checkVisible();
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.bundles/${localWorkspace}`,
          customBundleName,
          false,
        );
        await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.bundles/${localWorkspace}`, cloneName, false);
      }
    });

    test('can delete a bundle', async ({ page, login, rancherApi }) => {
      const deleteName = rancherApi.createE2EResourceName('fleet-bundle-del');

      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.bundles', {
        metadata: { name: deleteName, namespace: localWorkspace },
        spec: {
          targets: [
            {
              clusterName: 'local',
              clusterSelector: {
                matchExpressions: [{ key: 'fleet.cattle.io/non-managed-agent', operator: 'DoesNotExist' }],
              },
              ignore: {},
            },
          ],
        },
      });

      await login();
      const listPage = new FleetBundlesListPagePo(page);
      const headerPo = new HeaderPo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(localWorkspace);

        const actionMenu = await listPage.list().actionMenu(deleteName);

        await actionMenu.getMenuItem('Delete').click();

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/fleet.cattle.io.bundles/${localWorkspace}/${deleteName}`) &&
            resp.request().method() === 'DELETE',
        );

        const prompt = new PromptRemove(page);

        await prompt.remove();
        await responsePromise;
        await listPage.waitForPage();

        await expect(listPage.list().resourceTable().sortableTable().rowElementWithName(deleteName)).not.toBeAttached();
      } finally {
        await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.bundles/${localWorkspace}`, deleteName, false);
      }
    });

    test('can Download YAML', async ({ page, login, rancherApi }) => {
      test.skip(true, 'Download tests require file system access and cleanup — not suitable for CI');
    });
  });
});
