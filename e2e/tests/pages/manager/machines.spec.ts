import { test, expect } from '@/support/fixtures';
import MachinesPagePo from '@/e2e/po/pages/cluster-manager/machines.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import * as jsyaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

const nsName = 'default';
const blueprintPath = path.resolve('e2e/blueprints/cluster_management/machines.yml');
const blueprintEditPath = path.resolve('e2e/blueprints/cluster_management/machines-edit.yml');

test.describe('Machines', { tag: ['@manager', '@adminUser'] }, () => {
  test('can create a Machine', async ({ page, login, rancherApi }) => {
    await login();
    const machinesPage = new MachinesPagePo(page);
    const machineName = rancherApi.createE2EResourceName('machines');

    await machinesPage.goTo();
    await machinesPage.waitForPage();
    await machinesPage.create();
    await machinesPage.createEditMachines().waitForPage('as=yaml');

    const machineDoc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: any = jsyaml.load(machineDoc);

    json.metadata.name = machineName;
    json.metadata.namespace = nsName;
    json.spec.bootstrap.clusterName = 'local';
    json.spec.bootstrap.dataSecretName = 'secretName';
    await machinesPage.yamlEditor().set(jsyaml.dump(json));

    const createResp = page.waitForResponse(
      (r) => r.url().includes('/v1/cluster.x-k8s.io.machines') && r.request().method() === 'POST',
    );

    await machinesPage.createEditMachines().saveCreateForm().resourceYaml().saveOrCreate().click();
    const resp = await createResp;

    expect(resp.status()).toBe(201);

    await machinesPage.waitForPage();
    await expect(machinesPage.list().details(machineName, 1)).toBeVisible();

    // Cleanup
    try {
      const resource = await rancherApi.getRancherResource(
        'v1',
        'cluster.x-k8s.io.machines',
        `${nsName}/${machineName}`,
        0,
      );

      if (resource.status === 200) {
        await rancherApi.deleteRancherResource('v1', 'cluster.x-k8s.io.machines', `${nsName}/${machineName}`, false);
        const updated = await rancherApi.getRancherResource(
          'v1',
          'cluster.x-k8s.io.machines',
          `${nsName}/${machineName}`,
          0,
        );

        if (updated.status === 200 && updated.body.metadata?.finalizers) {
          delete updated.body.metadata.finalizers;
          await rancherApi.setRancherResource(
            'v1',
            'cluster.x-k8s.io.machines',
            `${nsName}/${machineName}`,
            updated.body,
          );
        }
      }
    } catch {
      // resource may already be gone
    }
  });

  test('can edit a Machine', async ({ page, login, rancherApi }) => {
    await login();
    const machinesPage = new MachinesPagePo(page);
    const machineName = rancherApi.createE2EResourceName('machines');

    // Create via YAML
    const machineDoc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: any = jsyaml.load(machineDoc);

    json.metadata.name = machineName;
    json.metadata.namespace = nsName;
    json.spec.bootstrap.clusterName = 'local';
    json.spec.bootstrap.dataSecretName = 'secretName';
    const created = await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machines', json);

    await machinesPage.goTo();
    await machinesPage.waitForPage();

    const actionMenu = await machinesPage.list().actionMenu(machineName);

    await actionMenu.getMenuItem('Edit YAML').click();
    await machinesPage.createEditMachines(nsName, machineName).waitForPage('mode=edit&as=yaml');

    const freshResource = await rancherApi.getRancherResource(
      'v1',
      'cluster.x-k8s.io.machines',
      `${nsName}/${machineName}`,
    );

    const editDoc = fs.readFileSync(blueprintEditPath, 'utf-8');
    const editJson: any = jsyaml.load(editDoc);

    editJson.spec.bootstrap.dataSecretName = 'secretName2';
    editJson.metadata.creationTimestamp = created.body.metadata.creationTimestamp;
    editJson.metadata.uid = created.body.metadata.uid;
    editJson.metadata.name = machineName;
    editJson.metadata.resourceVersion = freshResource.body.metadata.resourceVersion;
    await machinesPage.yamlEditor().set(jsyaml.dump(editJson));

    const updateResp = page.waitForResponse(
      (r) =>
        r.url().includes(`/v1/cluster.x-k8s.io.machines/${nsName}/${machineName}`) && r.request().method() === 'PUT',
    );

    await machinesPage.createEditMachines().saveCreateForm().resourceYaml().saveOrCreate().click();
    const resp = await updateResp;

    expect(resp.status()).toBe(200);
    await machinesPage.waitForPage();

    // Cleanup
    try {
      await rancherApi.deleteRancherResource('v1', 'cluster.x-k8s.io.machines', `${nsName}/${machineName}`, false);
      const updated = await rancherApi.getRancherResource(
        'v1',
        'cluster.x-k8s.io.machines',
        `${nsName}/${machineName}`,
        0,
      );

      if (updated.status === 200 && updated.body.metadata?.finalizers) {
        delete updated.body.metadata.finalizers;
        await rancherApi.setRancherResource(
          'v1',
          'cluster.x-k8s.io.machines',
          `${nsName}/${machineName}`,
          updated.body,
        );
      }
    } catch {
      // resource may already be gone
    }
  });

  test('can delete a Machine', async ({ page, login, rancherApi }) => {
    await login();
    const machinesPage = new MachinesPagePo(page);
    const machineName = rancherApi.createE2EResourceName('machines');

    // Create resource via API
    const machineDoc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: any = jsyaml.load(machineDoc);

    json.metadata.name = machineName;
    json.metadata.namespace = nsName;
    json.spec.bootstrap.clusterName = 'local';
    json.spec.bootstrap.dataSecretName = 'secretName';
    await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machines', json);

    await machinesPage.goTo();
    await machinesPage.waitForPage();

    const actionMenu = await machinesPage.list().actionMenu(machineName);

    await actionMenu.getMenuItem('Delete').click();

    const promptRemove = new PromptRemove(page);
    const deleteResp = page.waitForResponse(
      (r) =>
        r.url().includes(`cluster.x-k8s.io.machines/${nsName}/${machineName}`) && r.request().method() === 'DELETE',
    );

    await promptRemove.remove();
    await deleteResp;
    await machinesPage.waitForPage();

    // Clear finalizers so resource actually deletes
    try {
      const resource = await rancherApi.getRancherResource(
        'v1',
        'cluster.x-k8s.io.machines',
        `${nsName}/${machineName}`,
        0,
      );

      if (resource.status === 200 && resource.body.metadata?.finalizers) {
        delete resource.body.metadata.finalizers;
        await rancherApi.setRancherResource(
          'v1',
          'cluster.x-k8s.io.machines',
          `${nsName}/${machineName}`,
          resource.body,
        );
      }
    } catch {
      // resource may already be gone
    }

    await expect(machinesPage.body()).not.toContainText(machineName);
  });
});
