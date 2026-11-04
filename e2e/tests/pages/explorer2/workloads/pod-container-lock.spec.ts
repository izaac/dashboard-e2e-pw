import path from 'path';
import { type Locator, type Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import { EXTRA_LONG, LONG } from '@/support/timeouts';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-12212-pod-container-name-edit-lock-evidence';

const PAUSE_IMAGE = 'registry.k8s.io/pause:3.10';
const STANDALONE_POD = 'qa-standalone-pod';
const MULTI_POD = 'qa-multi-pod';
const TEST_DEPLOYMENT = 'qa-test-deployment';

/** Page PO for a workload edit/clone form addressed by explorer resource type, namespace and name */
function workloadFormPage(page: Page, type: string, namespace: string, name: string): PagePo {
  return new PagePo(page, `/c/local/explorer/${type}/${namespace}/${name}`);
}

/** Open the workload form in the given mode and wait for the container tabs to render */
async function openForm(page: Page, formPage: PagePo, mode: 'edit' | 'clone'): Promise<void> {
  await formPage.goTo(`mode=${mode}`);
  await expect(page.getByTestId('workload-horizontal-tabs')).toBeVisible({ timeout: LONG });
}

/** Dismiss any informational modal (e.g. "What's New") that would intercept pointer events */
async function dismissModalIfPresent(page: Page): Promise<void> {
  const modal = page.getByRole('dialog').first();

  if (!(await modal.isVisible())) {
    return;
  }

  await page.keyboard.press('Escape');

  if (await modal.isVisible()) {
    await modal.getByRole('button', { name: /close|cancel|dismiss/i }).first().click();
  }

  await expect(modal).toBeHidden();
}

/** The side-tabs panel of the nth container (inactive panels stay in the DOM, so always scope by index) */
function containerPanel(page: Page, index: number): Locator {
  return page.getByTestId(`workload-container-tabs-${index}`);
}

function containerNameInput(page: Page, index: number): Locator {
  return LabeledInputPo.byLabel(page, containerPanel(page, index), 'Container Name').input();
}

/** The panel also holds the PostStart/PreStop radiogroups, so target the Init Containers one by accessible name */
class InitRadioGroupPo extends RadioGroupInputPo {
  constructor(page: Page, private readonly panel: Locator) {
    super(page, '[role="radiogroup"]', panel);
  }

  self(): Locator {
    return this.panel.getByRole('radiogroup', { name: 'Init Containers' });
  }
}

function initRadioGroup(page: Page, index: number): RadioGroupInputPo {
  return new InitRadioGroupPo(page, containerPanel(page, index));
}

function addContainerButton(page: Page): Locator {
  return page.getByTestId('workload-button-add-container');
}

function removeContainerButton(page: Page, index: number): Locator {
  return containerPanel(page, index).getByRole('button', { name: 'Remove Container' });
}

async function expectRadioGroupLocked(page: Page, index: number): Promise<void> {
  const radioGroup = initRadioGroup(page, index);
  const radios = radioGroup.self().getByRole('radio');

  await expect(radioGroup.self()).toHaveAttribute('aria-disabled', 'true');
  await expect(radios).toHaveCount(2);
  for (const radio of await radios.all()) {
    await expect(radio).toBeDisabled();
  }
}

test.describe('Workload Pod Container Lock (#12212)', { tag: ['@explorer2', '@adminUser'] }, () => {
  let testNamespace = '';

  test.beforeAll(async ({ rancherApi }) => {
    test.setTimeout(EXTRA_LONG);

    testNamespace = rancherApi.createE2EResourceName('qa-12212-pod');
    await rancherApi.createNamespace(testNamespace);

    await rancherApi.createRancherResource('v1', 'pods', {
      type: 'pod',
      metadata: { name: STANDALONE_POD, namespace: testNamespace },
      spec: {
        containers: [{ name: 'main-container', image: PAUSE_IMAGE }],
      },
    });

    await rancherApi.createRancherResource('v1', 'pods', {
      type: 'pod',
      metadata: { name: MULTI_POD, namespace: testNamespace },
      spec: {
        containers: [
          { name: 'container-alpha', image: PAUSE_IMAGE },
          { name: 'container-beta', image: PAUSE_IMAGE },
        ],
      },
    });

    await rancherApi.createRancherResource('v1', 'apps.deployments', {
      type: 'apps.deployment',
      metadata: { name: TEST_DEPLOYMENT, namespace: testNamespace },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: TEST_DEPLOYMENT } },
        template: {
          metadata: { labels: { app: TEST_DEPLOYMENT } },
          spec: {
            containers: [{ name: 'deploy-container', image: PAUSE_IMAGE }],
          },
        },
      },
    });
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      if (testNamespace) {
        await rancherApi.deleteNamespace([testNamespace]);
      }
    } finally {
      testNamespace = '';
    }
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('should lock container name and init radio and hide add/remove buttons when editing a standalone pod', async ({
    page,
  }) => {
    await openForm(page, workloadFormPage(page, 'pod', testNamespace, STANDALONE_POD), 'edit');

    const nameInput = containerNameInput(page, 0);

    await expect(nameInput).toHaveValue('main-container');
    await expect(nameInput).toBeDisabled();
    await expectRadioGroupLocked(page, 0);
    await expect(addContainerButton(page)).toBeHidden();
    await expect(removeContainerButton(page, 0)).toBeHidden();

    await dismissModalIfPresent(page);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-01-pod-edit-container-locked.png'),
      fullPage: true,
    });
  });

  test('should lock container controls on every container tab when editing a multi-container pod', async ({ page }) => {
    await openForm(page, workloadFormPage(page, 'pod', testNamespace, MULTI_POD), 'edit');

    const tabs = page.getByTestId('workload-horizontal-tabs');

    await dismissModalIfPresent(page);

    await expect(tabs.getByRole('tab', { name: 'container-alpha' })).toBeVisible();
    await expect(tabs.getByRole('tab', { name: 'container-beta' })).toBeVisible();

    // First container tab
    await expect(containerNameInput(page, 0)).toHaveValue('container-alpha');
    await expect(containerNameInput(page, 0)).toBeDisabled();
    await expectRadioGroupLocked(page, 0);
    await expect(removeContainerButton(page, 0)).toBeHidden();
    await expect(addContainerButton(page)).toBeHidden();

    // Second container tab
    await dismissModalIfPresent(page);
    await tabs.getByRole('tab', { name: 'container-beta' }).click();
    await expect(containerNameInput(page, 1)).toBeVisible();
    await expect(containerNameInput(page, 1)).toHaveValue('container-beta');
    await expect(containerNameInput(page, 1)).toBeDisabled();
    await expectRadioGroupLocked(page, 1);
    await expect(removeContainerButton(page, 1)).toBeHidden();
    await expect(addContainerButton(page)).toBeHidden();

    await dismissModalIfPresent(page);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-02-multi-container-pod-tabs-locked.png'),
      fullPage: true,
    });
  });

  test('should keep container controls unlocked when cloning a pod', async ({ page }) => {
    await openForm(page, workloadFormPage(page, 'pod', testNamespace, STANDALONE_POD), 'clone');

    const nameInput = containerNameInput(page, 0);

    await expect(nameInput).toBeVisible();
    await expect(nameInput).toBeEnabled();
    await expect(addContainerButton(page)).toBeVisible();

    await dismissModalIfPresent(page);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-04-pod-clone-container-unlocked.png'),
      fullPage: true,
    });
  });

  test('should keep container controls unlocked when editing a deployment', async ({ page }) => {
    await openForm(page, workloadFormPage(page, 'apps.deployment', testNamespace, TEST_DEPLOYMENT), 'edit');

    const nameInput = containerNameInput(page, 0);

    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('deploy-container');
    await expect(nameInput).toBeEnabled();
    await expect(addContainerButton(page)).toBeVisible();

    await dismissModalIfPresent(page);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-06-deployment-edit-container-unlocked.png'),
      fullPage: true,
    });
  });
});
