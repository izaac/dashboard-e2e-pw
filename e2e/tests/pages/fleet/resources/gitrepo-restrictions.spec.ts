import { test, expect } from '@/support/fixtures';
import {
  FleetGitRepoRestrictionListPagePo,
  FleetRestrictionCreateEditPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.gitreporestriction.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import * as jsyaml from 'js-yaml';

const defaultWorkspace = 'fleet-default';

test.describe('GitRepo Restrictions', { tag: ['@fleet', '@adminUser'] }, () => {
  test.describe('CRUD', () => {
    test('can create a gitrepo restriction', async ({ page, login, rancherApi }) => {
      await login();
      const customRestrictionName = rancherApi.createE2EResourceName('fleet-restriction');
      const listPage = new FleetGitRepoRestrictionListPagePo(page);
      const headerPo = new HeaderPo(page);
      const createPage = new FleetRestrictionCreateEditPo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await expect(listPage.baseResourceList().masthead().title()).toContainText('GitRepoRestrictions');
        await headerPo.selectWorkspace(defaultWorkspace);
        await listPage.baseResourceList().masthead().createYaml();
        await createPage.waitForPage('as=yaml');
        await expect(createPage.mastheadTitle()).toContainText('GitRepoRestriction: Create');

        const val = await createPage.resourceDetail().resourceYaml().codeMirror().value();
        const json: any = jsyaml.load(val);

        json.metadata.name = customRestrictionName;
        await createPage.resourceDetail().resourceYaml().codeMirror().set(jsyaml.dump(json));

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes('/v1/fleet.cattle.io.gitreporestrictions') && resp.request().method() === 'POST',
        );

        await createPage.resourceDetail().resourceYaml().saveOrCreate().click();
        const resp = await responsePromise;

        expect(resp.status()).toBe(201);
        await listPage.waitForPage();
        await listPage.list().rowWithName(customRestrictionName).checkVisible();
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.gitreporestrictions/${defaultWorkspace}`,
          customRestrictionName,
          false,
        );
      }
    });

    test('can clone a gitrepo restriction', async ({ page, login, rancherApi }) => {
      await login();
      const customRestrictionName = rancherApi.createE2EResourceName('fleet-restriction');
      const cloneName = `${customRestrictionName}-clone`;

      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.gitreporestrictions', {
        metadata: { name: customRestrictionName, namespace: defaultWorkspace },
      });

      try {
        const listPage = new FleetGitRepoRestrictionListPagePo(page);
        const headerPo = new HeaderPo(page);
        const createPage = new FleetRestrictionCreateEditPo(page, defaultWorkspace, customRestrictionName);

        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(defaultWorkspace);

        const actionMenu = await listPage.list().actionMenu(customRestrictionName);

        await actionMenu.getMenuItem('Clone').click();
        await createPage.waitForPage('mode=clone&as=yaml');
        await expect(createPage.mastheadTitle()).toContainText(
          `GitRepoRestriction: Clone from ${customRestrictionName}`,
        );

        const val = await createPage.resourceDetail().resourceYaml().codeMirror().value();
        const json: any = jsyaml.load(val);

        json.metadata.name = cloneName;
        await createPage.resourceDetail().resourceYaml().codeMirror().set(jsyaml.dump(json));

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes('/v1/fleet.cattle.io.gitreporestrictions') && resp.request().method() === 'POST',
        );

        await createPage.resourceDetail().resourceYaml().saveOrCreate().click();
        const resp = await responsePromise;

        expect(resp.status()).toBe(201);
        await listPage.waitForPage();
        await listPage.list().rowWithName(cloneName).checkVisible();
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.gitreporestrictions/${defaultWorkspace}`,
          customRestrictionName,
          false,
        );
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.gitreporestrictions/${defaultWorkspace}`,
          cloneName,
          false,
        );
      }
    });

    test('can delete a gitrepo restriction', async ({ page, login, rancherApi }) => {
      const deleteName = rancherApi.createE2EResourceName('fleet-restrict-del');

      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.gitreporestrictions', {
        metadata: { name: deleteName, namespace: defaultWorkspace },
      });

      await login();
      const listPage = new FleetGitRepoRestrictionListPagePo(page);
      const headerPo = new HeaderPo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(defaultWorkspace);

        const actionMenu = await listPage.list().actionMenu(deleteName);

        await actionMenu.getMenuItem('Delete').click();

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/fleet.cattle.io.gitreporestrictions/${defaultWorkspace}/${deleteName}`) &&
            resp.request().method() === 'DELETE',
        );

        const prompt = new PromptRemove(page);

        await prompt.remove();
        await responsePromise;
        await listPage.waitForPage();

        await expect(listPage.list().resourceTable().sortableTable().rowElementWithName(deleteName)).not.toBeAttached();
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.gitreporestrictions/${defaultWorkspace}`,
          deleteName,
          false,
        );
      }
    });

    test('can Download YAML', async ({ page, login, rancherApi }) => {
      const defaultWorkspace = 'fleet-default';
      const restrictionName = rancherApi.createE2EResourceName('restriction');

      await rancherApi.createRancherResource('v1', 'fleet.cattle.io.gitreporestrictions', {
        metadata: { name: restrictionName, namespace: defaultWorkspace },
        allowedTargetNamespaces: [],
      });

      try {
        await login();
        const listPage = new FleetGitRepoRestrictionListPagePo(page);
        const headerPo = new HeaderPo(page);

        await listPage.goTo();
        await listPage.waitForPage();
        await headerPo.selectWorkspace(defaultWorkspace);
        await listPage.list().resourceTable().sortableTable().noRowsShouldNotExist();

        const actionMenu = await listPage.list().actionMenu(restrictionName);

        const [download] = await Promise.all([
          page.waitForEvent('download'),
          actionMenu.getMenuItem('Download YAML').click(),
        ]);

        expect(download.suggestedFilename()).toBe(`${restrictionName}.yaml`);
      } finally {
        await rancherApi.deleteRancherResource(
          'v1',
          `fleet.cattle.io.gitreporestrictions/${defaultWorkspace}`,
          restrictionName,
          false,
        );
      }
    });
  });
});
