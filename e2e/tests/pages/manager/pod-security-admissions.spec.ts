import { test, expect } from '@/support/fixtures';
import * as fs from 'fs';
import * as jsyaml from 'js-yaml';
import PodSecurityAdmissionsPagePo from '@/e2e/po/pages/cluster-manager/pod-security-admissions.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import { ensureLightTheme, mastheadMasks, visualSnapshot } from '@/support/utils/visual-snapshot';
import {
  createPayloadData,
  updatePayloadData,
} from '@/e2e/blueprints/cluster_management/pod-security-admissions-payload';

const PSA_RESOURCE = 'management.cattle.io.podsecurityadmissionconfigurationtemplates';

test.describe('Pod Security Admissions', { tag: ['@manager', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test('can open Edit as YAML', async ({ page, login }) => {
    await login();
    const psaPage = new PodSecurityAdmissionsPagePo(page);

    await psaPage.goTo();
    await psaPage.waitForPage();
    await psaPage.create();
    await psaPage.createPodSecurityAdmissionForm().editAsYaml().click();
    await expect(psaPage.createPodSecurityAdmissionForm().yamlEditor().self()).toBeAttached();
  });

  test('can create a pod security admission', async ({ page, login, rancherApi }) => {
    await login();
    const psaPage = new PodSecurityAdmissionsPagePo(page);
    const psaName = rancherApi.createE2EResourceName('psa-create');

    // Cleanup any pre-existing resource
    await rancherApi.deleteRancherResource('v1', PSA_RESOURCE, psaName, false);

    await psaPage.goTo();
    await psaPage.waitForPage();
    await psaPage.create();
    await psaPage.createPodSecurityAdmissionForm().waitForPage();
    await psaPage.createPodSecurityAdmissionForm().nameNsDescription().name().set(psaName);
    await psaPage.createPodSecurityAdmissionForm().nameNsDescription().description().set(`${psaName}-description`);
    await psaPage.createPodSecurityAdmissionForm().psaControlLevel(0, 1);
    await psaPage.createPodSecurityAdmissionForm().psaControlLevel(1, 2);
    await psaPage.createPodSecurityAdmissionForm().psaControlLevel(2, 3);
    await psaPage.createPodSecurityAdmissionForm().psaControlVersion(0, 'latest');
    await psaPage.createPodSecurityAdmissionForm().psaControlVersion(1, 'latest');
    await psaPage.createPodSecurityAdmissionForm().psaControlVersion(2, 'latest');
    await psaPage.createPodSecurityAdmissionForm().setExemptionsCheckbox(0);
    await psaPage.createPodSecurityAdmissionForm().setExemptionsInput(0, 'admin,user');
    await psaPage.createPodSecurityAdmissionForm().setExemptionsCheckbox(1);
    await psaPage.createPodSecurityAdmissionForm().setExemptionsInput(1, 'myclass1,myclass2');
    await psaPage.createPodSecurityAdmissionForm().setExemptionsCheckbox(2);
    await psaPage.createPodSecurityAdmissionForm().setExemptionsInput(2, 'ingress-nginx,kube-system');

    const createResp = page.waitForResponse((r) => r.url().includes(PSA_RESOURCE) && r.request().method() === 'POST');

    await psaPage.createPodSecurityAdmissionForm().resourceDetail().cruResource().saveOrCreate().click();
    const resp = await createResp;

    expect(resp.status()).toBe(201);
    const body = await resp.json();

    expect(body.configuration.defaults).toMatchObject(createPayloadData.configuration.defaults);
    expect(body.configuration.exemptions).toMatchObject(createPayloadData.configuration.exemptions);

    await psaPage.waitForPage();
    await expect(psaPage.list().details(psaName, 1)).toBeVisible();

    // Cleanup
    await rancherApi.deleteRancherResource('v1', PSA_RESOURCE, psaName, false);
  });

  test('can edit a pod security admission', async ({ page, login, rancherApi }) => {
    await login();
    const psaPage = new PodSecurityAdmissionsPagePo(page);
    const psaName = rancherApi.createE2EResourceName('psa-edit');

    // Create via API
    await rancherApi.createRancherResource('v1', PSA_RESOURCE, {
      type: 'management.cattle.io.podsecurityadmissionconfigurationtemplate',
      metadata: { name: psaName },
      description: `${psaName}-description`,
      configuration: createPayloadData.configuration,
    });

    await psaPage.goTo();
    await psaPage.waitForPage();

    const actionMenu = await psaPage.list().actionMenu(psaName);

    await actionMenu.getMenuItem('Edit Config').click();
    await psaPage.createPodSecurityAdmissionForm(psaName).waitForPage('mode=edit');
    await psaPage.createPodSecurityAdmissionForm().nameNsDescription().description().set(`${psaName}-description-edit`);
    await psaPage.createPodSecurityAdmissionForm().psaControlLevel(0, 1);
    await psaPage.createPodSecurityAdmissionForm().psaControlLevel(1, 2);
    await psaPage.createPodSecurityAdmissionForm().psaControlLevel(2, 3);
    await psaPage.createPodSecurityAdmissionForm().psaControlVersion(0, 'v1.25');
    await psaPage.createPodSecurityAdmissionForm().psaControlVersion(1, 'v1.25');
    await psaPage.createPodSecurityAdmissionForm().psaControlVersion(2, 'v1.25');
    await psaPage.createPodSecurityAdmissionForm().setExemptionsInput(0, 'admin1,user1');
    await psaPage.createPodSecurityAdmissionForm().setExemptionsInput(1, 'myclass3,myclass4');
    await psaPage.createPodSecurityAdmissionForm().setExemptionsInput(2, 'cattle-system,cattle-epinio-system');

    const updateResp = page.waitForResponse((r) => r.url().includes(PSA_RESOURCE) && r.request().method() === 'PUT');

    await psaPage.createPodSecurityAdmissionForm().resourceDetail().cruResource().saveOrCreate().click();
    const resp = await updateResp;

    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body.configuration.defaults).toMatchObject(updatePayloadData.configuration.defaults);
    expect(body.configuration.exemptions).toMatchObject(updatePayloadData.configuration.exemptions);

    await psaPage.waitForPage();

    // Cleanup
    await rancherApi.deleteRancherResource('v1', PSA_RESOURCE, psaName, false);
  });

  test('can clone a pod security admission', async ({ page, login, rancherApi }) => {
    await login();
    const psaPage = new PodSecurityAdmissionsPagePo(page);
    const psaName = rancherApi.createE2EResourceName('psa-clone');
    const cloneName = `${psaName}-clone`;

    await rancherApi.createRancherResource('v1', PSA_RESOURCE, {
      type: 'management.cattle.io.podsecurityadmissionconfigurationtemplate',
      metadata: { name: psaName },
      description: `${psaName}-description`,
      configuration: createPayloadData.configuration,
    });

    await psaPage.goTo();
    await psaPage.waitForPage();

    const actionMenu = await psaPage.list().actionMenu(psaName);

    await actionMenu.getMenuItem('Clone').click();
    await psaPage.createPodSecurityAdmissionForm(psaName).waitForPage('mode=clone');
    await psaPage.createPodSecurityAdmissionForm().nameNsDescription().name().set(cloneName);

    const cloneResp = page.waitForResponse((r) => r.url().includes(PSA_RESOURCE) && r.request().method() === 'POST');

    await psaPage.createPodSecurityAdmissionForm().resourceDetail().cruResource().saveOrCreate().click();
    await cloneResp;

    await psaPage.waitForPage();
    await expect(psaPage.list().details(cloneName, 1)).toBeVisible();

    // Cleanup
    await rancherApi.deleteRancherResource('v1', PSA_RESOURCE, psaName, false);
    await rancherApi.deleteRancherResource('v1', PSA_RESOURCE, cloneName, false);
  });

  test('can delete a pod security admission', async ({ page, login, rancherApi }) => {
    await login();
    const psaPage = new PodSecurityAdmissionsPagePo(page);
    const psaName = rancherApi.createE2EResourceName('psa-del');

    await rancherApi.createRancherResource('v1', PSA_RESOURCE, {
      type: 'management.cattle.io.podsecurityadmissionconfigurationtemplate',
      metadata: { name: psaName },
      description: `${psaName}-description`,
      configuration: createPayloadData.configuration,
    });

    await psaPage.goTo();
    await psaPage.waitForPage();

    const actionMenu = await psaPage.list().actionMenu(psaName);

    await actionMenu.getMenuItem('Delete').click();

    const promptRemove = new PromptRemove(page);
    const deleteResp = page.waitForResponse(
      (r) => r.url().includes(`${PSA_RESOURCE}/${psaName}`) && r.request().method() === 'DELETE',
    );

    await promptRemove.remove();
    const resp = await deleteResp;

    expect(resp.status()).toBe(204);
    await psaPage.waitForPage();
    await expect(psaPage.list().resourceTable().sortableTable().rowElementWithName(psaName)).not.toBeAttached();
  });

  test('can delete a pod security admission via bulk actions', async ({ page, login, rancherApi }) => {
    await login();
    const psaPage = new PodSecurityAdmissionsPagePo(page);
    const psaName = rancherApi.createE2EResourceName('psa-bulk');

    await rancherApi.createRancherResource('v1', PSA_RESOURCE, {
      type: 'management.cattle.io.podsecurityadmissionconfigurationtemplate',
      metadata: { name: psaName },
      description: `${psaName}-description`,
      configuration: createPayloadData.configuration,
    });

    await psaPage.goTo();
    await psaPage.waitForPage();

    await psaPage.list().resourceTable().sortableTable().rowSelectCtlWithName(psaName).set();
    await psaPage.list().resourceTable().sortableTable().deleteButton().click();

    const promptRemove = new PromptRemove(page);
    const deleteResp = page.waitForResponse(
      (r) => r.url().includes(`${PSA_RESOURCE}/${psaName}`) && r.request().method() === 'DELETE',
    );

    await promptRemove.remove();
    const resp = await deleteResp;

    expect(resp.status()).toBe(204);
    await psaPage.waitForPage();
    await expect(psaPage.list().resourceTable().sortableTable().rowElementWithName(psaName)).not.toBeAttached();
  });

  test('can download YAML for a pod security admission', async ({ page, login, rancherApi }) => {
    await login();
    const psaPage = new PodSecurityAdmissionsPagePo(page);
    const psaName = rancherApi.createE2EResourceName('psa-dl');

    await rancherApi.createRancherResource('v1', PSA_RESOURCE, {
      type: 'management.cattle.io.podsecurityadmissionconfigurationtemplate',
      metadata: { name: psaName },
      description: `${psaName}-description`,
      configuration: createPayloadData.configuration,
    });

    try {
      await psaPage.goTo();
      await psaPage.waitForPage();

      const actionMenu = await psaPage.list().actionMenu(psaName);

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        actionMenu.getMenuItem('Download YAML').click(),
      ]);

      expect(download.suggestedFilename()).toBe(`${psaName}.yaml`);

      const yamlContent = fs.readFileSync((await download.path()) as string, 'utf-8');
      const parsed: any = jsyaml.load(yamlContent);

      expect(parsed.kind).toBe('PodSecurityAdmissionConfigurationTemplate');
      expect(parsed.metadata.name).toBe(psaName);
    } finally {
      await rancherApi.deleteRancherResource('v1', PSA_RESOURCE, psaName, false);
    }
  });
});

test.describe('Visual snapshots', { tag: ['@visual', '@manager', '@adminUser'] }, () => {
  test('Pod Security Admissions list page matches snapshot', async ({ page, login, rancherApi, isPrime }) => {
    await login();
    const restoreTheme = await ensureLightTheme(rancherApi);

    try {
      const psaPage = new PodSecurityAdmissionsPagePo(page);

      await psaPage.goTo();
      await psaPage.waitForPage();
      await psaPage.list().resourceTable().sortableTable().waitForReady();

      await expect(page).toHaveScreenshot(visualSnapshot(isPrime, 'pod-security-admissions-list.png'), {
        fullPage: true,
        mask: [psaPage.list().resourceTable().sortableTable().ageColumn(), ...mastheadMasks(page)],
      });
    } finally {
      await restoreTheme();
    }
  });
});
