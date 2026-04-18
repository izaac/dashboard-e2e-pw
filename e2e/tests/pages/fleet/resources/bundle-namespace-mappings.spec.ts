import { test, expect } from '@/support/fixtures';
import {
  FleetBundleNamespaceMappingListPagePo,
  FleetBundleNsMappingCreateEditPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.bundlenamespacemapping.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import * as jsyaml from 'js-yaml';

const defaultWorkspace = 'fleet-default';

test.describe('Bundle Namespace Mappings', { tag: ['@fleet', '@adminUser'] }, () => {
  test.describe('CRUD', () => {
    test('can create a bundle namespace mapping', async ({ page, login, rancherApi }) => {
      await login();
      const customMappingName = rancherApi.createE2EResourceName('fleet-mapping');
      const listPage = new FleetBundleNamespaceMappingListPagePo(page);
      const headerPo = new HeaderPo(page);
      const createPage = new FleetBundleNsMappingCreateEditPo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await expect(listPage.baseResourceList().masthead().title()).toContainText('BundleNamespaceMappings');
        await headerPo.selectWorkspace(defaultWorkspace);
        await listPage.baseResourceList().masthead().createYaml();
        await createPage.waitForPage('as=yaml');
        await expect(createPage.mastheadTitle()).toContainText('BundleNamespaceMapping: Create');

        const val = await createPage.resourceDetail().resourceYaml().codeMirror().value();
        const json: any = jsyaml.load(val);

        json.metadata.name = customMappingName;
        await createPage.resourceDetail().resourceYaml().codeMirror().set(jsyaml.dump(json));

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes('/v1/fleet.cattle.io.bundlenamespacemappings') && resp.request().method() === 'POST',
        );

        await createPage.resourceDetail().resourceYaml().saveOrCreate().click();
        const resp = await responsePromise;

        expect(resp.status()).toBe(201);
        await listPage.waitForPage();
        await listPage.list().rowWithName(customMappingName).checkVisible();
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.bundlenamespacemappings/${defaultWorkspace}`,
          customMappingName,
          false,
        );
      }
    });

    test('can clone a bundle namespace mapping', async ({ page, login, rancherApi }) => {
      await login();
      const customMappingName = rancherApi.createE2EResourceName('fleet-mapping');
      const cloneName = `${customMappingName}-clone`;

      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.bundlenamespacemappings', {
        metadata: { name: customMappingName, namespace: defaultWorkspace },
      });

      try {
        const listPage = new FleetBundleNamespaceMappingListPagePo(page);
        const headerPo = new HeaderPo(page);
        const createPage = new FleetBundleNsMappingCreateEditPo(page, defaultWorkspace, customMappingName);

        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(defaultWorkspace);

        const actionMenu = await listPage.list().actionMenu(customMappingName);

        await actionMenu.getMenuItem('Clone').click();
        await createPage.waitForPage('mode=clone&as=yaml');
        await expect(createPage.mastheadTitle()).toContainText(
          `BundleNamespaceMapping: Clone from ${customMappingName}`,
        );

        const val = await createPage.resourceDetail().resourceYaml().codeMirror().value();
        const json: any = jsyaml.load(val);

        json.metadata.name = cloneName;
        await createPage.resourceDetail().resourceYaml().codeMirror().set(jsyaml.dump(json));

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes('/v1/fleet.cattle.io.bundlenamespacemappings') && resp.request().method() === 'POST',
        );

        await createPage.resourceDetail().resourceYaml().saveOrCreate().click();
        const resp = await responsePromise;

        expect(resp.status()).toBe(201);
        await listPage.waitForPage();
        await listPage.list().rowWithName(cloneName).checkVisible();
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.bundlenamespacemappings/${defaultWorkspace}`,
          customMappingName,
          false,
        );
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.bundlenamespacemappings/${defaultWorkspace}`,
          cloneName,
          false,
        );
      }
    });

    test('can delete a bundle namespace mapping', async ({ page, login, rancherApi }) => {
      const deleteName = rancherApi.createE2EResourceName('fleet-mapping-del');

      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.bundlenamespacemappings', {
        metadata: { name: deleteName, namespace: defaultWorkspace },
      });

      await login();
      const listPage = new FleetBundleNamespaceMappingListPagePo(page);
      const headerPo = new HeaderPo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(defaultWorkspace);

      const actionMenu = await listPage.list().actionMenu(deleteName);

      await actionMenu.getMenuItem('Delete').click();

      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`/v1/fleet.cattle.io.bundlenamespacemappings/${defaultWorkspace}/${deleteName}`) &&
          resp.request().method() === 'DELETE',
      );

      const prompt = new PromptRemove(page);

      await prompt.remove();
      await responsePromise;
      await listPage.waitForPage();

      await expect(listPage.list().resourceTable().sortableTable().rowElementWithName(deleteName)).not.toBeAttached();
    });
  });
});
