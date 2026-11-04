import fs from 'fs';
import path from 'path';
import type { Page, Request } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { SecretsListPagePo } from '@/e2e/po/pages/explorer/secrets.po';
import { SecretEditPagePo } from '@/e2e/po/edit/secret-edit.po';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-12397-helm-release-secret-edit-evidence';

const CLUSTER = 'local';
const HELM_SECRET = 'sh.helm.release.v1.qa-12397.v1';
const OPAQUE_SECRET = 'qa-12397-opaque';
const HELM_RELEASE_DATA = 'dGVzdA==';
const OPAQUE_DATA_KEY = 'qa-key';
const OPAQUE_DATA_VALUE = Buffer.from('qa-value').toString('base64');

test.describe('Helm Release Secret Edit Protects Data (#12397)', { tag: ['@generic', '@adminUser'] }, () => {
  let testNamespace = '';

  /** The welcome modal mounts late, so wait for it briefly (isVisible does not wait) before dismissing */
  async function dismissWelcome(page: Page): Promise<void> {
    const welcome = new WelcomeDialogPo(page);

    await welcome
      .self()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {});
    await welcome.dismissIfVisible();
  }

  /** Open the edit page of a secret and make sure it is rendered */
  async function openEditPage(page: Page, name: string): Promise<SecretEditPagePo> {
    const editPage = new SecretEditPagePo(page, CLUSTER, testNamespace, name);

    await editPage.goToEdit();
    await editPage.waitForPage('mode=edit');
    await dismissWelcome(page);
    await expect(editPage.createEditView().saveButtonPo().self()).toBeVisible();

    return editPage;
  }

  /** Click Save and capture the resulting write request to the secret */
  async function saveAndCaptureRequest(page: Page, editPage: SecretEditPagePo, name: string): Promise<Request> {
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes(`/v1/secrets/${testNamespace}/${name}`) && ['PATCH', 'PUT'].includes(req.method()),
    );

    await editPage.createEditView().saveButtonPo().click();

    return requestPromise;
  }

  test.beforeAll(async ({ rancherApi }) => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    testNamespace = rancherApi.createE2EResourceName('qa-12397');

    await rancherApi.createNamespace(testNamespace);

    await rancherApi.createRancherResource('v1', 'secrets', {
      type: 'secret',
      _type: 'helm.sh/release.v1',
      metadata: {
        name: HELM_SECRET,
        namespace: testNamespace,
        labels: {
          owner: 'helm',
          name: 'qa-12397',
          status: 'deployed',
          version: '1',
        },
      },
      data: { release: HELM_RELEASE_DATA },
    });

    await rancherApi.createRancherResource('v1', 'secrets', {
      type: 'secret',
      _type: 'Opaque',
      metadata: { name: OPAQUE_SECRET, namespace: testNamespace },
      data: { [OPAQUE_DATA_KEY]: OPAQUE_DATA_VALUE },
    });
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      if (testNamespace) {
        await rancherApi.deleteRancherResource('v1', 'secrets', `${testNamespace}/${HELM_SECRET}`, false);
        await rancherApi.deleteRancherResource('v1', 'secrets', `${testNamespace}/${OPAQUE_SECRET}`, false);
        await rancherApi.deleteNamespace([testNamespace]);
      }
    } finally {
      testNamespace = '';
    }
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('helm release secret edit page shows banner and no data editor', async ({ page }) => {
    const editPage = await openEditPage(page, HELM_SECRET);

    await expect(editPage.helmReleaseBanner()).toBeVisible();
    await expect(editPage.dataEditorAddButton()).toHaveCount(0);
    await expect(editPage.createEditView().editYamlButton().self()).toHaveCount(0);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-01-helm-secret-data-banner.png') });
  });

  test('Edit YAML is not offered in the row action menu for a helm release secret', async ({ page }) => {
    const listPage = new SecretsListPagePo(page, CLUSTER);

    await listPage.goTo();
    await listPage.waitForPage();
    await dismissWelcome(page);

    const table = listPage.list().resourceTable().sortableTable();

    await table.checkLoadingIndicatorNotVisible();

    // new-UX query box, falling back to the legacy search row
    const filterInput = page
      .getByTestId('table-views-query')
      .or(page.getByTestId('search-box-filter-row').getByRole('textbox'))
      .first();

    await filterInput.focus();
    await filterInput.clear();
    await filterInput.fill(HELM_SECRET);
    await expect(table.rowWithName(HELM_SECRET).self()).toBeVisible();

    const actionMenu = await listPage.list().actionMenu(HELM_SECRET);

    await expect(actionMenu.getMenuItem('Edit Config')).toBeVisible();
    await expect(actionMenu.getMenuItem('Edit YAML')).toHaveCount(0);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-02-edit-yaml-disabled.png') });
  });

  test('saving a helm release secret sends a PATCH with only labels and annotations', async ({ page }) => {
    const editPage = await openEditPage(page, HELM_SECRET);

    await editPage.addLabel('qa-12397-patch', 'test');

    // Evidence: the edit form with the label added, captured before Save. The PATCH body (labels and
    // annotations only, no data) is verified by the request interceptor assertions below.
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-03-patch-request-body.png') });

    const request = await saveAndCaptureRequest(page, editPage, HELM_SECRET);
    const body = request.postData() ?? '';
    const ops: Array<{ op: string; path: string }> = JSON.parse(body);

    expect(request.method()).toBe('PATCH');
    expect(request.headers()['content-type']).toContain('application/json-patch+json');
    expect(ops.map((o) => o.path)).toEqual(['/metadata/labels', '/metadata/annotations']);
    expect(body).toContain('/metadata/labels');
    expect(body).toContain('/metadata/annotations');
    expect(body).not.toContain('"data"');
    expect(body).not.toContain('release');
  });

  test('helm release data survives after editing labels', async ({ page, rancherApi }) => {
    const editPage = await openEditPage(page, HELM_SECRET);

    await editPage.addLabel('qa-12397-survive', 'test');
    await saveAndCaptureRequest(page, editPage, HELM_SECRET);

    // Steve strips data.release for helm secrets, so read the secret straight from the kube API
    await expect
      .poll(
        async () => {
          const { body } = await rancherApi.getRancherResource(
            `k8s/clusters/${CLUSTER}/api/v1/namespaces/${testNamespace}`,
            'secrets',
            HELM_SECRET,
          );

          return {
            release: body.data?.release,
            label: body.metadata?.labels?.['qa-12397-survive'],
          };
        },
        { message: 'label saved and data.release preserved' },
      )
      .toEqual({ release: HELM_RELEASE_DATA, label: 'test' });

    // Evidence: reopen the edit page and show the saved label on the Labels tab
    const reopened = await openEditPage(page, HELM_SECRET);

    await reopened.labelsTab().click();
    // 4 helm owned labels plus at least the one added by this test (other tests may add more on the same secret)
    await expect
      .poll(
        async () =>
          await reopened
            .labelsEditor()
            .self()
            .getByTestId(/^input-kv-item-key-/)
            .count(),
      )
      .toBeGreaterThanOrEqual(5);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-04-release-data-survives.png') });
  });

  test('non-helm secrets keep the data editor, Edit as YAML and save with PUT', async ({ page }) => {
    const editPage = await openEditPage(page, OPAQUE_SECRET);

    await expect(editPage.helmReleaseBanner()).toHaveCount(0);
    await expect(editPage.dataEditorAddButton().first()).toBeVisible();
    await expect(editPage.createEditView().editYamlButton().self()).toBeVisible();

    await editPage.addLabel('qa-12397-opaque', 'test');

    // Evidence: the Data tab still hosts the data editor for non-helm secrets
    await editPage.tabs().tab('data').click();
    await expect(editPage.dataEditorAddButton().first()).toBeVisible();

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-06-opaque-secret-unaffected.png') });

    const request = await saveAndCaptureRequest(page, editPage, OPAQUE_SECRET);

    expect(request.method()).toBe('PUT');
  });
});
