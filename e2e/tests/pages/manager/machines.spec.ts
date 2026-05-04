import { test, expect } from '@/support/fixtures';
import MachinesPagePo from '@/e2e/po/pages/cluster-manager/machines.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import * as jsyaml from 'js-yaml';
import * as fs from 'fs';
import { ensureLightTheme, mastheadMasks, visualSnapshot } from '@/support/utils/visual-snapshot';
import * as path from 'path';

const nsName = 'default';
const blueprintPath = path.resolve('e2e/blueprints/cluster_management/machines.yml');
const blueprintEditPath = path.resolve('e2e/blueprints/cluster_management/machines-edit.yml');

async function cleanupMachine(rancherApi: any, fullName: string) {
  try {
    await rancherApi.deleteRancherResource('v1', 'cluster.x-k8s.io.machines', fullName, false);
    const resource = await rancherApi.getRancherResource('v1', 'cluster.x-k8s.io.machines', fullName, 0);

    if (resource.status === 200 && resource.body.metadata?.finalizers) {
      delete resource.body.metadata.finalizers;
      await rancherApi.setRancherResource('v1', 'cluster.x-k8s.io.machines', fullName, resource.body);
    }
    // Wait for the resource to actually disappear — the dashboard list keeps
    // a "Removing…" row visible until the steve cache catches up, which can
    // bleed into peer tests and visual snapshots.
    await rancherApi.waitForRancherResource(
      'v1',
      'cluster.x-k8s.io.machines',
      fullName,
      (resp: any) => resp.status === 404,
      30,
      1000,
    );
  } catch (err) {
    // Resource may already be gone — log to surface unexpected failures (auth, network) in CI
    console.warn(`[machines cleanup] ${fullName}: ${(err as Error)?.message ?? err}`);
  }
}

test.describe('Machines', { tag: ['@manager', '@adminUser'] }, () => {
  test('can create a Machine', async ({ page, login, rancherApi }) => {
    await login();
    const machinesPage = new MachinesPagePo(page);
    const machineName = rancherApi.createE2EResourceName('mach-create');

    try {
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
    } finally {
      await cleanupMachine(rancherApi, `${nsName}/${machineName}`);
    }
  });

  test('can edit a Machine', async ({ page, login, rancherApi }) => {
    await login();
    const machinesPage = new MachinesPagePo(page);
    const machineName = rancherApi.createE2EResourceName('mach-edit');

    // Create via YAML
    const machineDoc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: any = jsyaml.load(machineDoc);

    json.metadata.name = machineName;
    json.metadata.namespace = nsName;
    json.spec.bootstrap.clusterName = 'local';
    json.spec.bootstrap.dataSecretName = 'secretName';
    const created = await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machines', json);

    try {
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
    } finally {
      await cleanupMachine(rancherApi, `${nsName}/${machineName}`);
    }
  });

  test('can delete a Machine', async ({ page, login, rancherApi }) => {
    await login();
    const machinesPage = new MachinesPagePo(page);
    const machineName = rancherApi.createE2EResourceName('mach-del');

    // Create resource via API
    const machineDoc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: any = jsyaml.load(machineDoc);

    json.metadata.name = machineName;
    json.metadata.namespace = nsName;
    json.spec.bootstrap.clusterName = 'local';
    json.spec.bootstrap.dataSecretName = 'secretName';
    await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machines', json);

    try {
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

      // Strip finalizers eagerly — without them the row sticks in the list as
      // "Removing… N secs" and the body assertion below times out before the
      // cluster.x-k8s.io controller reconciles.
      await cleanupMachine(rancherApi, `${nsName}/${machineName}`);
      await page.reload();
      await machinesPage.waitForPage();

      await expect(
        machinesPage.list().resourceTable().sortableTable().rowElementWithName(machineName),
      ).not.toBeAttached();
    } finally {
      await cleanupMachine(rancherApi, `${nsName}/${machineName}`);
    }
  });

  test('can download YAML', async ({ page, login, rancherApi }) => {
    await login();
    const machinesPage = new MachinesPagePo(page);
    const machineName = rancherApi.createE2EResourceName('mach-dl');

    const doc = fs.readFileSync(blueprintPath, 'utf-8');
    const json: any = jsyaml.load(doc);

    json.metadata.name = machineName;
    json.metadata.namespace = nsName;
    await rancherApi.createRancherResource('v1', 'cluster.x-k8s.io.machines', json);

    try {
      await machinesPage.goTo();
      await machinesPage.waitForPage();

      const actionMenu = await machinesPage.list().actionMenu(machineName);
      const downloadPromise = page.waitForEvent('download');

      await actionMenu.getMenuItem('Download YAML').click();
      const download = await downloadPromise;
      const downloadPath = await download.path();
      const obj: any = jsyaml.load(fs.readFileSync(downloadPath, 'utf-8'));

      expect(obj.apiVersion).toBe('cluster.x-k8s.io/v1beta2');
      expect(obj.kind).toBe('Machine');
      expect(obj.metadata.name).toBe(machineName);
    } finally {
      await cleanupMachine(rancherApi, `${nsName}/${machineName}`);
    }
  });
});

test.describe('Visual snapshots', { tag: ['@visual', '@manager', '@adminUser'] }, () => {
  test('machines list page matches snapshot', async ({ page, login, rancherApi, isPrime }) => {
    await login();
    const restoreTheme = await ensureLightTheme(rancherApi);

    try {
      const machinesPage = new MachinesPagePo(page);

      await machinesPage.goTo();
      await machinesPage.waitForPage();
      await machinesPage.list().resourceTable().sortableTable().waitForReady();

      // Empty-state guard: snapshot baseline expects "There are no rows to show."
      // If a peer test left an orphan Machine, fail loudly instead of producing a misleading visual diff.
      await expect(machinesPage.list().resourceTable().sortableTable().noRowsText()).toBeVisible();

      await expect(page).toHaveScreenshot(visualSnapshot(isPrime, 'machines-list.png'), {
        fullPage: true,
        mask: mastheadMasks(page),
      });
    } finally {
      await restoreTheme();
    }
  });
});
