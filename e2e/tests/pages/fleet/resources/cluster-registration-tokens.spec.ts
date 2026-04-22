import { test, expect } from '@/support/fixtures';
import {
  FleetClusterRegistrationTokenListPagePo,
  FleetTokensCreateEditPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.clusterregistrationtoken.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import * as jsyaml from 'js-yaml';
import * as fs from 'fs';
import {
  clusterRegistrationTokensEmptyResponse,
  clusterRegistrationTokensSmallResponse,
} from '@/e2e/blueprints/fleet/cluster-registration-tokens-get';

const defaultWorkspace = 'fleet-default';

test.describe('Cluster Registration Tokens', { tag: ['@fleet', '@adminUser'] }, () => {
  test.describe('CRUD', () => {
    test('can create a cluster registration token', async ({ page, login, rancherApi }) => {
      await login();
      const customTokenName = rancherApi.createE2EResourceName('token-create');
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
      const customTokenName = rancherApi.createE2EResourceName('token-clone');
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

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(defaultWorkspace);
        await expect(listPage.list().resourceTable().sortableTable().rowElementWithName(deleteName)).toBeVisible();

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

        // Fleet lists update via websocket — navigate fresh to ensure data after delete
        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(defaultWorkspace);

        await expect(listPage.list().resourceTable().sortableTable().rowElementWithName(deleteName)).not.toBeAttached();
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.clusterregistrationtokens/${defaultWorkspace}`,
          deleteName,
          false,
        );
      }
    });

    test('can Download YAML', async ({ page, login, rancherApi }) => {
      const defaultWorkspace = 'fleet-default';
      const tokenName = rancherApi.createE2EResourceName('token');

      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.clusterregistrationtokens', {
        metadata: { name: tokenName, namespace: defaultWorkspace },
        spec: { ttl: '720h0m0s' },
      });

      try {
        await login();
        const listPage = new FleetClusterRegistrationTokenListPagePo(page);
        const headerPo = new HeaderPo(page);

        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(defaultWorkspace);
        await listPage.list().resourceTable().sortableTable().noRowsShouldNotExist();

        const actionMenu = await listPage.list().actionMenu(tokenName);

        const [download] = await Promise.all([
          page.waitForEvent('download'),
          actionMenu.getMenuItem('Download YAML').click(),
        ]);

        expect(download.suggestedFilename()).toBe(`${tokenName}.yaml`);

        const downloadPath = await download.path();
        const yamlContent = fs.readFileSync(downloadPath!, 'utf-8');
        const parsed: any = jsyaml.load(yamlContent);

        expect(parsed.kind).toBe('ClusterRegistrationToken');
        expect(parsed.metadata.name).toBe(tokenName);
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.clusterregistrationtokens/${defaultWorkspace}`,
          tokenName,
          false,
        );
      }
    });
  });

  test.describe('List', { tag: ['@noVai'] }, () => {
    test('validate cluster registration tokens table in empty state', async ({ page, login }) => {
      await page.route('**/v1/fleet.cattle.io.clusterregistrationtokens?**', (route) => {
        route.fulfill({ json: clusterRegistrationTokensEmptyResponse() });
      });

      await login();
      const listPage = new FleetClusterRegistrationTokenListPagePo(page);
      const headerPo = new HeaderPo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(defaultWorkspace);

      const table = listPage.list().resourceTable().sortableTable();
      const expectedHeaders = ['State', 'Name', 'Namespace', 'Secret-Name'];

      expect(await table.headerNames()).toEqual(expectedHeaders);
      await table.checkRowCount(true, 1);
    });

    test('validate cluster registration tokens table', async ({ page, login }) => {
      await page.route('**/v1/fleet.cattle.io.clusterregistrationtokens?**', (route) => {
        route.fulfill({ json: clusterRegistrationTokensSmallResponse() });
      });

      await login();
      const listPage = new FleetClusterRegistrationTokenListPagePo(page);
      const headerPo = new HeaderPo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(defaultWorkspace);

      const table = listPage.list().resourceTable().sortableTable();
      const expectedHeaders = ['State', 'Name', 'Namespace', 'Secret-Name'];

      expect(await table.headerNames()).toEqual(expectedHeaders);
      await table.checkRowCount(false, 1);
    });

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
