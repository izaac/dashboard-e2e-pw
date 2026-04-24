import { test, expect } from '@/support/fixtures';
import {
  FleetBundleNamespaceMappingListPagePo,
  FleetBundleNsMappingCreateEditPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.bundlenamespacemapping.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import * as jsyaml from 'js-yaml';
import * as fs from 'fs';

const defaultWorkspace = 'fleet-default';

test.describe('Bundle Namespace Mappings', { tag: ['@fleet', '@adminUser'] }, () => {
  test.describe('CRUD', () => {
    test('can create a bundle namespace mapping', async ({ page, login, rancherApi }) => {
      await login();
      const customMappingName = rancherApi.createE2EResourceName('mapping-create');
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
        await expect(listPage.list().rowWithName(customMappingName).self()).toBeVisible();
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
      const customMappingName = rancherApi.createE2EResourceName('mapping-clone');
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
        await expect(listPage.list().rowWithName(cloneName).self()).toBeVisible();
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

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(defaultWorkspace);
        await expect(listPage.list().resourceTable().sortableTable().rowElementWithName(deleteName)).toBeVisible();

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

        // Fleet lists update via websocket — navigate fresh to ensure data after delete
        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(defaultWorkspace);

        await expect(listPage.list().resourceTable().sortableTable().rowElementWithName(deleteName)).not.toBeAttached();
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.bundlenamespacemappings/${defaultWorkspace}`,
          deleteName,
          false,
        );
      }
    });

    test('can Download YAML', async ({ page, login, rancherApi }) => {
      const defaultWorkspace = 'fleet-default';
      const mappingName = rancherApi.createE2EResourceName('mapping');

      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.bundlenamespacemappings', {
        metadata: { name: mappingName, namespace: defaultWorkspace },
        bundleSelector: {},
        namespaceSelector: {},
      });

      try {
        await login();
        const listPage = new FleetBundleNamespaceMappingListPagePo(page);
        const headerPo = new HeaderPo(page);

        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(defaultWorkspace);
        await expect(listPage.list().resourceTable().sortableTable().noRowsText()).not.toBeAttached();

        const actionMenu = await listPage.list().actionMenu(mappingName);

        const [download] = await Promise.all([
          page.waitForEvent('download'),
          actionMenu.getMenuItem('Download YAML').click(),
        ]);

        expect(download.suggestedFilename()).toBe(`${mappingName}.yaml`);

        const downloadPath = await download.path();
        const yamlContent = fs.readFileSync(downloadPath!, 'utf-8');
        const parsed: any = jsyaml.load(yamlContent);

        expect(parsed.kind).toBe('BundleNamespaceMapping');
        expect(parsed.metadata.name).toBe(mappingName);
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.bundlenamespacemappings/${defaultWorkspace}`,
          mappingName,
          false,
        );
      }
    });
  });
});
