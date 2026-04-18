import { test, expect } from '@/support/fixtures';
import {
  FleetClusterRegistrationTokenListPagePo,
  FleetTokensCreateEditPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.clusterregistrationtoken.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import * as jsyaml from 'js-yaml';

const defaultWorkspace = 'fleet-default';

test.describe('Cluster Registration Tokens', { tag: ['@fleet', '@adminUser'] }, () => {
  test.describe('CRUD', () => {
    test('can create a cluster registration token', async ({ page, login, rancherApi }) => {
      await login();
      const customTokenName = rancherApi.createE2EResourceName('fleet-token');
      const listPage = new FleetClusterRegistrationTokenListPagePo(page);
      const headerPo = new HeaderPo(page);
      const createPage = new FleetTokensCreateEditPo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await expect(listPage.baseResourceList().masthead().title()).toContainText('Cluster Registration Tokens');
        await headerPo.selectWorkspace(defaultWorkspace);
        await listPage.baseResourceList().masthead().createYaml();
        await createPage.waitForPage('as=yaml');
        await expect(createPage.mastheadTitle()).toContainText('Cluster Registration Token: Create');

        const val = await createPage.resourceDetail().resourceYaml().codeMirror().value();
        const json: any = jsyaml.load(val);

        json.metadata.name = customTokenName;
        await createPage.resourceDetail().resourceYaml().codeMirror().set(jsyaml.dump(json));

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes('/v1/fleet.cattle.io.clusterregistrationtokens') && resp.request().method() === 'POST',
        );

        await createPage.resourceDetail().resourceYaml().saveOrCreate().click();
        const resp = await responsePromise;

        expect(resp.status()).toBe(201);
        await listPage.waitForPage();
        await listPage.list().rowWithName(customTokenName).checkVisible();
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.clusterregistrationtokens/${defaultWorkspace}`,
          customTokenName,
          false,
        );
      }
    });

    test('can clone a cluster registration token', async ({ page, login, rancherApi }) => {
      await login();
      const customTokenName = rancherApi.createE2EResourceName('fleet-token');
      const cloneName = `${customTokenName}-clone`;

      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.clusterregistrationtokens', {
        metadata: { name: customTokenName, namespace: defaultWorkspace },
        spec: {},
      });

      try {
        const listPage = new FleetClusterRegistrationTokenListPagePo(page);
        const headerPo = new HeaderPo(page);
        const createPage = new FleetTokensCreateEditPo(page, defaultWorkspace, customTokenName);

        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(defaultWorkspace);

        const actionMenu = await listPage.list().actionMenu(customTokenName);

        await actionMenu.getMenuItem('Clone').click();
        await createPage.waitForPage('mode=clone&as=yaml');
        await expect(createPage.mastheadTitle()).toContainText(
          `Cluster Registration Token: Clone from ${customTokenName}`,
        );

        const val = await createPage.resourceDetail().resourceYaml().codeMirror().value();
        const json: any = jsyaml.load(val);

        json.metadata.name = cloneName;
        await createPage.resourceDetail().resourceYaml().codeMirror().set(jsyaml.dump(json));

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes('/v1/fleet.cattle.io.clusterregistrationtokens') && resp.request().method() === 'POST',
        );

        await createPage.resourceDetail().resourceYaml().saveOrCreate().click();
        const resp = await responsePromise;

        expect(resp.status()).toBe(201);
        await listPage.waitForPage();
        await listPage.list().rowWithName(cloneName).checkVisible();
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.clusterregistrationtokens/${defaultWorkspace}`,
          customTokenName,
          false,
        );
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.clusterregistrationtokens/${defaultWorkspace}`,
          cloneName,
          false,
        );
      }
    });

    test('can delete a cluster registration token', async ({ page, login, rancherApi }) => {
      const deleteName = rancherApi.createE2EResourceName('fleet-token-del');

      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.clusterregistrationtokens', {
        metadata: { name: deleteName, namespace: defaultWorkspace },
        spec: {},
      });

      await login();
      const listPage = new FleetClusterRegistrationTokenListPagePo(page);
      const headerPo = new HeaderPo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(defaultWorkspace);

      const actionMenu = await listPage.list().actionMenu(deleteName);

      await actionMenu.getMenuItem('Delete').click();

      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`/v1/fleet.cattle.io.clusterregistrationtokens/${defaultWorkspace}/${deleteName}`) &&
          resp.request().method() === 'DELETE',
      );

      const prompt = new PromptRemove(page);

      await prompt.remove();
      await responsePromise;
      await listPage.waitForPage();

      await expect(listPage.list().resourceTable().sortableTable().rowElementWithName(deleteName)).not.toBeAttached();
    });
  });

  test.describe('List', { tag: ['@noVai'] }, () => {
    test('validate cluster registration tokens table headers', async ({ page, login }) => {
      await login();
      const listPage = new FleetClusterRegistrationTokenListPagePo(page);
      const headerPo = new HeaderPo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(defaultWorkspace);

      const expectedHeaders = ['State', 'Name', 'Namespace', 'Secret-Name'];
      const actualHeaders = await listPage.list().resourceTable().sortableTable().headerNames();

      expect(actualHeaders).toEqual(expectedHeaders);
    });
  });
});
