import { test, expect } from '@/support/fixtures';
import MachineDeploymentsPagePo from '@/e2e/po/pages/cluster-manager/machine-deployments.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import * as jsyaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

const nsName = 'default';
const blueprintPath = path.resolve('e2e/blueprints/cluster_management/machine-deployments.yml');
const blueprintEditPath = path.resolve('e2e/blueprints/cluster_management/machine-deployments-edit.yml');

async function cleanupMachineDeployment(rancherApi: any, fullName: string) {
  try {
    await rancherApi.deleteRancherResource('v1', 'cluster.x-k8s.io.machinedeployments', fullName, false);
    const resource = await rancherApi.getRancherResource('v1', 'cluster.x-k8s.io.machinedeployments', fullName, 0);

    if (resource.status === 200 && resource.body.metadata?.finalizers) {
      delete resource.body.metadata.finalizers;
      await rancherApi.setRancherResource('v1', 'cluster.x-k8s.io.machinedeployments', fullName, resource.body);
    }
  } catch {
    // resource may already be gone
  }
}

test.describe('MachineDeployments', { tag: ['@manager', '@adminUser'] }, () => {
  test('can create a MachineDeployment', async ({ page, login, rancherApi }) => {
    await login();
    const mdPage = new MachineDeploymentsPagePo(page);
    const mdName = rancherApi.createE2EResourceName('md-create');

    try {
      await mdPage.goTo();
      await mdPage.waitForPage();
      await mdPage.create();
      await mdPage.createEditMachineDeployment().waitForPage('as=yaml');

      const doc = fs.readFileSync(blueprintPath, 'utf-8');
      const json: any = jsyaml.load(doc);

      json.metadata.name = mdName;
      json.metadata.namespace = nsName;
      await mdPage.yamlEditor().set(jsyaml.dump(json));

      const createResp = page.waitForResponse(
        (r) => r.url().includes('/v1/cluster.x-k8s.io.machinedeployments') && r.request().method() === 'POST',
      );

      await mdPage.createEditMachineDeployment().saveCreateForm().resourceYaml().saveOrCreate().click();
      const resp = await createResp;

      expect(resp.status()).toBe(201);
      await mdPage.waitForPage();
      await expect(mdPage.list().details(mdName, 1)).toBeVisible();
    } finally {
      await cleanupMachineDeployment(rancherApi, `${nsName}/${mdName}`);
    }
  });

  test('can edit a MachineDeployment', async ({ page, login, rancherApi }) => {
    await login();
    const mdPage = new MachineDeploymentsPagePo(page);
    const mdName = rancherApi.createE2EResourceName('md-edit');

    const doc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: any = jsyaml.load(doc);

    json.metadata.name = mdName;
    json.metadata.namespace = nsName;
    const created = await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machinedeployments', json);

    try {
      await mdPage.goTo();
      await mdPage.waitForPage();

      const actionMenu = await mdPage.list().actionMenu(mdName);

      await actionMenu.getMenuItem('Edit YAML').click();
      await mdPage.createEditMachineDeployment(nsName, mdName).waitForPage('mode=edit&as=yaml');

      const freshResource = await rancherApi.getRancherResource(
        'v1',
        'cluster.x-k8s.io.machinedeployments',
        `${nsName}/${mdName}`,
      );
      const editDoc = fs.readFileSync(blueprintEditPath, 'utf-8');
      const editJson: any = jsyaml.load(editDoc);

      editJson.spec.template.spec.bootstrap.dataSecretName = 'secretName2';
      editJson.metadata.creationTimestamp = created.body.metadata.creationTimestamp;
      editJson.metadata.uid = created.body.metadata.uid;
      editJson.metadata.name = mdName;
      editJson.metadata.resourceVersion = freshResource.body.metadata.resourceVersion;
      await mdPage.yamlEditor().set(jsyaml.dump(editJson));

      const updateResp = page.waitForResponse(
        (r) =>
          r.url().includes(`/v1/cluster.x-k8s.io.machinedeployments/${nsName}/${mdName}`) &&
          r.request().method() === 'PUT',
      );

      await mdPage.createEditMachineDeployment().saveCreateForm().resourceYaml().saveOrCreate().click();
      const resp = await updateResp;

      expect(resp.status()).toBe(200);
      await mdPage.waitForPage();
    } finally {
      await cleanupMachineDeployment(rancherApi, `${nsName}/${mdName}`);
    }
  });

  test('can clone a MachineDeployment', async ({ page, login, rancherApi }) => {
    await login();
    const mdPage = new MachineDeploymentsPagePo(page);
    const mdName = rancherApi.createE2EResourceName('md-clone');
    const cloneName = `${mdName}-clone`;

    const doc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: any = jsyaml.load(doc);

    json.metadata.name = mdName;
    json.metadata.namespace = nsName;
    await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machinedeployments', json);

    try {
      await mdPage.goTo();
      await mdPage.waitForPage();

      const actionMenu = await mdPage.list().actionMenu(mdName);

      await actionMenu.getMenuItem('Clone').click();
      await mdPage.createEditMachineDeployment(nsName, mdName).waitForPage('mode=clone&as=yaml');

      const cloneDoc = fs.readFileSync(blueprintPath, 'utf-8');
      const cloneJson: any = jsyaml.load(cloneDoc);

      cloneJson.metadata.name = cloneName;
      cloneJson.metadata.namespace = nsName;
      await mdPage.yamlEditor().set(jsyaml.dump(cloneJson));

      const cloneResp = page.waitForResponse(
        (r) => r.url().includes('/v1/cluster.x-k8s.io.machinedeployments') && r.request().method() === 'POST',
      );

      await mdPage.createEditMachineDeployment().saveCreateForm().resourceYaml().saveOrCreate().click();
      const resp = await cloneResp;

      expect(resp.status()).toBe(201);
      await mdPage.waitForPage();
      await expect(mdPage.list().details(cloneName, 2)).toBeVisible();
    } finally {
      await cleanupMachineDeployment(rancherApi, `${nsName}/${mdName}`);
      await cleanupMachineDeployment(rancherApi, `${nsName}/${cloneName}`);
    }
  });

  test('can delete a MachineDeployment', async ({ page, login, rancherApi }) => {
    await login();
    const mdPage = new MachineDeploymentsPagePo(page);
    const mdName = rancherApi.createE2EResourceName('md-del');

    const doc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: any = jsyaml.load(doc);

    json.metadata.name = mdName;
    json.metadata.namespace = nsName;
    await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machinedeployments', json);

    await mdPage.goTo();
    await mdPage.waitForPage();

    const actionMenu = await mdPage.list().actionMenu(mdName);

    await actionMenu.getMenuItem('Delete').click();

    const promptRemove = new PromptRemove(page);
    const deleteResp = page.waitForResponse(
      (r) =>
        r.url().includes(`cluster.x-k8s.io.machinedeployments/${nsName}/${mdName}`) &&
        r.request().method() === 'DELETE',
    );

    await promptRemove.remove();
    await deleteResp;
    await mdPage.waitForPage();

    await cleanupMachineDeployment(rancherApi, `${nsName}/${mdName}`);
    await expect(mdPage.body()).not.toContainText(mdName);
  });

  test('can delete MachineDeployments via bulk actions', async ({ page, login, rancherApi }) => {
    await login();
    const mdPage = new MachineDeploymentsPagePo(page);
    const mdName = rancherApi.createE2EResourceName('md-bulk');

    const doc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: any = jsyaml.load(doc);

    json.metadata.name = mdName;
    json.metadata.namespace = nsName;
    await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machinedeployments', json);

    await mdPage.goTo();
    await mdPage.waitForPage();

    await mdPage.list().resourceTable().sortableTable().rowSelectCtlWithName(mdName).set();

    const deleteResp = page.waitForResponse(
      (r) =>
        r.url().includes(`cluster.x-k8s.io.machinedeployments/${nsName}/${mdName}`) &&
        r.request().method() === 'DELETE',
    );

    await mdPage.list().resourceTable().sortableTable().bulkActionButton('Delete').click();

    const promptRemove = new PromptRemove(page);

    await promptRemove.remove();
    await deleteResp;
    await mdPage.waitForPage();

    await cleanupMachineDeployment(rancherApi, `${nsName}/${mdName}`);
    await expect(mdPage.body()).not.toContainText(mdName);
  });

  test.skip(true, 'Percy snapshot test');
  // eslint-disable-next-line playwright/expect-expect -- stub body never runs
  test('validating machine deployments page with percy', async () => {
    // Upstream Percy snapshot test
  });

  test.skip(true, 'Requires provisioned cluster with machine deployments');
  // eslint-disable-next-line playwright/expect-expect -- stub body never runs
  test('can download YAML', async () => {
    // Upstream test downloads YAML file for a MachineDeployment
    // Needs actual provisioned cluster with machine deployment resources
  });
});
