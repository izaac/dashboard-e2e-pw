import { test, expect } from '@/support/fixtures';
import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourcePopoverPo from '@/e2e/po/components/resource-popover.po';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import { STANDARD } from '@/support/timeouts';

const CLUSTER = 'local';
const PROJECT_PREFIX = 'project-popover';
const NAMESPACE_PREFIX = 'project-popover-ns';
const PROBE_ANNOTATION = 'qa18178/probe';
const UPDATE_VALUES = ['qa18178-1', 'qa18178-2', 'qa18178-3'];
const MENU_ATTEMPTS = 5;
const PROJECTS_TYPE = 'management.cattle.io.projects';

/**
 * #18178: the project name popover on the namespace detail page used to flicker
 * on every project update and its actions menu was unusable, because the card
 * was destroyed and re-created while mounted. Fixed by dashboard 300e0de.
 */
test.describe('Project popover', { tag: ['@components', '@adminUser'] }, () => {
  let projectId: string;
  let projectName: string;
  let projectResourceName: string;
  let namespaceName: string;
  let testIndex = 0;

  const projectPath = () => `${CLUSTER}/${projectResourceName}`;

  /** Namespace detail page of the namespace owned by the test project */
  async function goToNamespaceDetail(page: Page): Promise<PagePo> {
    const namespaceDetail = new PagePo(page, `/c/${CLUSTER}/explorer/namespace/${namespaceName}`);

    await namespaceDetail.goTo();
    await namespaceDetail.waitForPage();

    return namespaceDetail;
  }

  /** Patch the project once: annotations drive the live subscription update */
  async function updateProject(rancherApi: RancherApi, value: string): Promise<void> {
    const { body } = await rancherApi.getRancherResource('v1', PROJECTS_TYPE, projectPath());

    await rancherApi.updateRancherResource('v1', PROJECTS_TYPE, projectPath(), {
      ...body,
      metadata: {
        ...body.metadata,
        annotations: { ...(body.metadata?.annotations ?? {}), [PROBE_ANNOTATION]: value },
      },
    });
  }

  test.beforeEach(async ({ login, rancherApi }) => {
    await login();

    // Own resources per test: the worker reuses one name root, and cleanup of
    // the previous test may still be settling when this one starts.
    testIndex += 1;

    namespaceName = rancherApi.createE2EResourceName(`${NAMESPACE_PREFIX}-${testIndex}`);
    projectName = rancherApi.createE2EResourceName(`${PROJECT_PREFIX}-${testIndex}`);

    const { body } = await rancherApi.createProject(projectName, CLUSTER);

    projectId = body.id;
    projectResourceName = projectId.split(':')[1];

    await rancherApi.createNamespaceInProject(namespaceName, projectId);
  });

  test.afterEach(async ({ rancherApi }) => {
    // Fire and forget: a namespace owned by the project sits in Terminating for
    // a while, and every test owns uniquely named resources, so nothing here is
    // needed to make the next test start clean.
    await rancherApi.deleteRancherResource('v1', 'namespaces', namespaceName, false);
    await rancherApi.deleteRancherResource('v3', 'projects', projectId, false);
  });

  test('popover stays mounted while the project updates', async ({ page, rancherApi }) => {
    const popover = ResourcePopoverPo.forProjectRow(page);

    // Attach before navigating so the live subscriptions opened on load are recorded
    popover.observeResourceUpdates(PROBE_ANNOTATION);

    await goToNamespaceDetail(page);

    await expect(popover.display()).toBeVisible();

    try {
      await popover.installCardMountCounter();
      await popover.hover();
      await popover.waitForCard();
      await expect(popover.cardTitle()).toHaveText(projectName);

      // Nothing the card renders changes with these three updates: its glance
      // items are State, Type and Age, and annotations are not displayed. The
      // proof is therefore the card identity (dataset marker, so a re-created
      // node is caught) plus the subscription payload carrying each new value.
      await popover.markCard();
      await popover.installVisibilityWatch();

      for (const value of UPDATE_VALUES) {
        await updateProject(rancherApi, value);

        await expect
          .poll(() => popover.frameAnnotationValues(PROBE_ANNOTATION), {
            message: `dashboard subscription frame carries ${value}`,
            timeout: STANDARD,
          })
          .toContain(value);

        await expect(popover.markedCard(), `same card node after ${value}`).toBeVisible();
      }

      const counts = await popover.cardMountCounts();
      const visibility = await popover.visibilityStates();

      expect(counts.added, 'card mounted once while observed').toBeGreaterThan(0);
      expect(counts.removed, 'card must not be re-created by project updates').toBe(0);
      expect(visibility.shown, 'visibility observer saw the card').toBeGreaterThan(0);
      expect(visibility.hidden, 'card must not hide during project updates').toBe(0);
      await expect(popover.markedCard()).toBeVisible();

      const { body: patched } = await rancherApi.getRancherResource('v1', PROJECTS_TYPE, projectPath());

      expect(patched.metadata.annotations[PROBE_ANNOTATION]).toBe(UPDATE_VALUES[UPDATE_VALUES.length - 1]);
    } finally {
      await popover.disposeProbes();
    }
  });

  test('actions menu opens on every attempt', async ({ page }) => {
    await goToNamespaceDetail(page);

    const popover = ResourcePopoverPo.forProjectRow(page);

    await expect(popover.display()).toBeVisible();

    for (let attempt = 1; attempt <= MENU_ATTEMPTS; attempt++) {
      await popover.hover();
      await popover.waitForCard();

      await popover.openActionsMenu();
      await expect
        .poll(() => popover.isActionsMenuOpen(), {
          message: `actions menu opens on attempt ${attempt} of ${MENU_ATTEMPTS}`,
          timeout: STANDARD,
        })
        .toBe(true);

      await popover.close();
      await expect(popover.card()).toBeHidden();
      await expect(popover.actionsMenu(), `menu closed after Escape on attempt ${attempt}`).toBeHidden();
    }
  });
});
