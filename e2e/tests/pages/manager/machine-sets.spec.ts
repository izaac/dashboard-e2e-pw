import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import MachineSetsPagePo from '@/e2e/po/pages/cluster-manager/machine-sets.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import * as jsyaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

const nsName = 'default';
const blueprintPath = path.resolve('e2e/blueprints/cluster_management/machine-sets.yml');
const blueprintEditPath = path.resolve('e2e/blueprints/cluster_management/machine-sets-edit.yml');

async function cleanupMachineSet(rancherApi: RancherApi, fullName: string) {
  try {
    await rancherApi.deleteRancherResource('v1', 'cluster.x-k8s.io.machinesets', fullName, false);
    const resource = await rancherApi.getRancherResource('v1', 'cluster.x-k8s.io.machinesets', fullName, 0);

    if (resource.status === 200 && resource.body.metadata?.finalizers) {
      delete resource.body.metadata.finalizers;
      await rancherApi.setRancherResource('v1', 'cluster.x-k8s.io.machinesets', fullName, resource.body);
    }
  } catch {
    // resource may already be gone
  }
}

test.describe('MachineSets', { tag: ['@manager', '@adminUser'] }, () => {
  test('can create a MachineSet', async ({ page, login, rancherApi }) => {
    await login();
    const machineSetsPage = new MachineSetsPagePo(page);
    const machineSetName = rancherApi.createE2EResourceName('ms-create');

    try {
      await machineSetsPage.goTo();
      await machineSetsPage.waitForPage();
      await machineSetsPage.create();
      await machineSetsPage.createEditMachineSet().waitForPage('as=yaml');

      const doc = fs.readFileSync(blueprintPath, 'utf-8');
      const json: Record<string, unknown> = jsyaml.load(doc);

      json.metadata.name = machineSetName;
      await machineSetsPage.yamlEditor().set(jsyaml.dump(json));

      const createResp = page.waitForResponse(
        (r) => r.url().includes('/v1/cluster.x-k8s.io.machinesets') && r.request().method() === 'POST',
      );

      await machineSetsPage.createEditMachineSet().saveCreateForm().resourceYaml().saveOrCreate().click();
      const resp = await createResp;

      expect(resp.status()).toBe(201);
      await machineSetsPage.waitForPage();
      await expect(machineSetsPage.list().details(machineSetName, 1)).toBeVisible();
    } finally {
      await cleanupMachineSet(rancherApi, `${nsName}/${machineSetName}`);
    }
  });

  test('can edit a MachineSet', async ({ page, login, rancherApi }) => {
    await login();
    const machineSetsPage = new MachineSetsPagePo(page);
    const machineSetName = rancherApi.createE2EResourceName('ms-edit');

    const doc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: Record<string, unknown> = jsyaml.load(doc);

    json.metadata.name = machineSetName;
    const created = await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machinesets', json);

    try {
      await machineSetsPage.goTo();
      await machineSetsPage.waitForPage();

      const actionMenu = await machineSetsPage.list().actionMenu(machineSetName);

      await actionMenu.getMenuItem('Edit YAML').click();
      await machineSetsPage.createEditMachineSet(nsName, machineSetName).waitForPage('mode=edit&as=yaml');

      const freshResource = await rancherApi.getRancherResource(
        'v1',
        'cluster.x-k8s.io.machinesets',
        `${nsName}/${machineSetName}`,
      );
      const editDoc = fs.readFileSync(blueprintEditPath, 'utf-8');
      const editJson: Record<string, unknown> = jsyaml.load(editDoc);

      editJson.spec.template.spec.bootstrap.dataSecretName = 'secretName2';
      editJson.metadata.creationTimestamp = created.body.metadata.creationTimestamp;
      editJson.metadata.uid = created.body.metadata.uid;
      editJson.metadata.name = machineSetName;
      editJson.metadata.resourceVersion = freshResource.body.metadata.resourceVersion;
      await machineSetsPage.yamlEditor().set(jsyaml.dump(editJson));

      const updateResp = page.waitForResponse(
        (r) =>
          r.url().includes(`/v1/cluster.x-k8s.io.machinesets/${nsName}/${machineSetName}`) &&
          r.request().method() === 'PUT',
      );

      await machineSetsPage.createEditMachineSet().saveCreateForm().resourceYaml().saveOrCreate().click();
      const resp = await updateResp;

      expect(resp.status()).toBe(200);
      await machineSetsPage.waitForPage();
    } finally {
      await cleanupMachineSet(rancherApi, `${nsName}/${machineSetName}`);
    }
  });

  test('can clone a MachineSet', async ({ page, login, rancherApi }) => {
    await login();
    const machineSetsPage = new MachineSetsPagePo(page);
    const machineSetName = rancherApi.createE2EResourceName('ms-clone');
    const cloneName = `${machineSetName}-clone`;

    const doc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: Record<string, unknown> = jsyaml.load(doc);

    json.metadata.name = machineSetName;
    await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machinesets', json);

    try {
      await machineSetsPage.goTo();
      await machineSetsPage.waitForPage();

      const actionMenu = await machineSetsPage.list().actionMenu(machineSetName);

      await actionMenu.getMenuItem('Clone').click();
      await machineSetsPage.createEditMachineSet(nsName, machineSetName).waitForPage('mode=clone&as=yaml');

      const cloneDoc = fs.readFileSync(blueprintPath, 'utf-8');
      const cloneJson: Record<string, unknown> = jsyaml.load(cloneDoc);

      cloneJson.metadata.name = cloneName;
      cloneJson.metadata.namespace = nsName;
      await machineSetsPage.yamlEditor().set(jsyaml.dump(cloneJson));

      const cloneResp = page.waitForResponse(
        (r) => r.url().includes('/v1/cluster.x-k8s.io.machinesets') && r.request().method() === 'POST',
      );

      await machineSetsPage.createEditMachineSet().saveCreateForm().resourceYaml().saveOrCreate().click();
      const resp = await cloneResp;

      expect(resp.status()).toBe(201);
      await machineSetsPage.waitForPage();
      await expect(machineSetsPage.list().details(cloneName, 2)).toBeVisible();
    } finally {
      await cleanupMachineSet(rancherApi, `${nsName}/${machineSetName}`);
      await cleanupMachineSet(rancherApi, `${nsName}/${cloneName}`);
    }
  });

  test('can delete a MachineSet', async ({ page, login, rancherApi }) => {
    await login();
    const machineSetsPage = new MachineSetsPagePo(page);
    const machineSetName = rancherApi.createE2EResourceName('ms-del');

    const doc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: Record<string, unknown> = jsyaml.load(doc);

    json.metadata.name = machineSetName;
    await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machinesets', json);

    try {
      await machineSetsPage.goTo();
      await machineSetsPage.waitForPage();

      const actionMenu = await machineSetsPage.list().actionMenu(machineSetName);

      await actionMenu.getMenuItem('Delete').click();

      const promptRemove = new PromptRemove(page);
      const deleteResp = page.waitForResponse(
        (r) =>
          r.url().includes(`cluster.x-k8s.io.machinesets/${nsName}/${machineSetName}`) &&
          r.request().method() === 'DELETE',
      );

      await promptRemove.remove();
      await deleteResp;
      await machineSetsPage.waitForPage();

      // Remove finalizers so resource actually disappears from the list
      await cleanupMachineSet(rancherApi, `${nsName}/${machineSetName}`);
      await expect(machineSetsPage.body()).not.toContainText(machineSetName);
    } finally {
      await cleanupMachineSet(rancherApi, `${nsName}/${machineSetName}`);
    }
  });

  test('can delete MachineSet via bulk actions', async ({ page, login, rancherApi }) => {
    await login();
    const machineSetsPage = new MachineSetsPagePo(page);
    const machineSetName = rancherApi.createE2EResourceName('ms-bulk');

    const doc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: Record<string, unknown> = jsyaml.load(doc);

    json.metadata.name = machineSetName;
    await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machinesets', json);

    try {
      await machineSetsPage.goTo();
      await machineSetsPage.waitForPage();

      await machineSetsPage.list().resourceTable().sortableTable().rowSelectCtlWithName(machineSetName).set();

      const deleteResp = page.waitForResponse(
        (r) =>
          r.url().includes(`cluster.x-k8s.io.machinesets/${nsName}/${machineSetName}`) &&
          r.request().method() === 'DELETE',
      );

      await machineSetsPage.list().resourceTable().sortableTable().bulkActionButton('Delete').click();

      const promptRemove = new PromptRemove(page);

      await promptRemove.remove();
      await deleteResp;
      await machineSetsPage.waitForPage();

      // Remove finalizers so resource actually disappears from the list
      await cleanupMachineSet(rancherApi, `${nsName}/${machineSetName}`);
      await expect(machineSetsPage.body()).not.toContainText(machineSetName);
    } finally {
      await cleanupMachineSet(rancherApi, `${nsName}/${machineSetName}`);
    }
  });
});
