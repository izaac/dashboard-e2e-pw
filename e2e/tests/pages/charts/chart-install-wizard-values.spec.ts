import type { Page, Request } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import { LONG, PROVISIONING } from '@/support/timeouts';

/**
 * Chart install wizard: YAML values editor null handling (rancher/dashboard#13164, port of #19721).
 *
 * The install POST is stubbed with a 500 so nothing is ever installed; the request payload is
 * captured and asserted instead.
 *
 * The one exception is the upgrade-flow test: the upgrade banner only renders for an already
 * installed release, so that test really installs `harvester-rbac` (older version, custom values) into
 * its own namespace, drives the upgrade wizard, and uninstalls everything in `finally`. Its upgrade POST
 * is still stubbed with a 500, so the release is never actually upgraded.
 */
const REPO = 'rancher-charts';
const CHART = 'harvester-rbac';
const NAMESPACE = 'qa-13164-ns';
const INSTALL_URL_GLOB = `**/v1/catalog.cattle.io.clusterrepos/${REPO}?action=install`;
const UPGRADE_URL_GLOB = `**/v1/catalog.cattle.io.clusterrepos/${REPO}?action=upgrade`;
const INSTALL_PARAMS = `repo-type=cluster&repo=${REPO}&chart=${CHART}`;

// Upgrade-flow fixtures. Both versions only coexist in the rancher-charts index on a Rancher whose
// catalog publishes them (109.0.0 for 2.14, 110.0.0 for 2.15); the test skips with a reason otherwise.
const UPGRADE_NAMESPACE = 'qa-13164-upgrade-ns';
const FROM_VERSION = '109.0.0+up0.1.1';
const TO_VERSION = '110.0.0+up0.1.1';
// Inert custom value: not part of the chart defaults and not used by any template, so the release
// has custom values without changing the RoleTemplates the chart creates.
const MARKER_KEY = 'qa13164Marker';
const MARKER_VALUE = 'upgrade-flow';
const UPGRADE_PARAMS = `${INSTALL_PARAMS}&namespace=${UPGRADE_NAMESPACE}&name=${CHART}`;

const NS_FILTER_PREF = 'ns-by-cluster';
const ALL_USER_NS_FILTER = JSON.stringify({ local: ['all://user'] });

const isInstallPost = (r: Request) => r.method() === 'POST' && r.url().includes('action=install');
const isUpgradePost = (r: Request) => r.method() === 'POST' && r.url().includes('action=upgrade');

test.describe('Chart install wizard: YAML values', { tag: ['@charts', '@adminUser', '@noVai'] }, () => {
  // Serial: every test drives the same chart/namespace name through the same wizard.
  // playwright.config.ts already runs fullyParallel: false / workers: 1, so no other @charts file runs
  // concurrently, but the namespace-filter user preference is global state, so it is saved once
  // (beforeAll) and restored once (afterAll) around the whole serial block. Test order matters:
  // sync, compare, deleted-default, explicit-null, invalid-YAML, upgrade-flow. The release name is pinned by the
  // chart (catalog.cattle.io/release-name), so it is never customized; only some tests POST (stubbed 500), so no
  // test depends on another's state. The upgrade-flow test is the only one that really installs a release (in its
  // own namespace) and it removes the release and namespace in `finally`.
  test.describe.configure({ mode: 'serial' });

  let savedNsFilter: string | undefined;

  test.beforeAll(async ({ rancherApi }) => {
    const prefs = await rancherApi.getRancherResource('v1', 'userpreferences');

    savedNsFilter = prefs.body?.data?.[0]?.data?.[NS_FILTER_PREF];

    // Show all namespaces so the wizard namespace dropdown is not narrowed by a leaked filter
    await rancherApi.setUserPreference({ [NS_FILTER_PREF]: ALL_USER_NS_FILTER });
  });

  test.beforeEach(async ({ login, chartGuard }) => {
    await chartGuard(REPO, CHART);
    await login();
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      await rancherApi.deleteRancherResource('v1', 'namespaces', NAMESPACE, false);
    } finally {
      // Restore the saved preference value if it existed; otherwise reset to the default
      // (all user namespaces) so the preference is never left narrowed by this suite.
      await rancherApi.setUserPreference({
        [NS_FILTER_PREF]: savedNsFilter !== undefined ? savedNsFilter : ALL_USER_NS_FILTER,
      });
    }
  });

  /** Stub the install (or, with `urlGlob`, upgrade) POST with a 500 and record every request seen */
  async function stubInstall(page: Page, urlGlob = INSTALL_URL_GLOB): Promise<Request[]> {
    const seen: Request[] = [];

    await page.route(urlGlob, async (route) => {
      seen.push(route.request());
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ type: 'error', message: 'Install/upgrade stubbed by e2e test' }),
      });
    });

    return seen;
  }

  /**
   * Open the wizard, create the namespace, check the pinned release name and move to the Edit YAML values step.
   * rancher-charts pins `catalog.cattle.io/release-name`, so the Name input is prefilled and disabled (not fillable).
   */
  async function openValuesYaml(page: Page): Promise<InstallChartPage> {
    const installChartPage = new InstallChartPage(page);

    await installChartPage.goTo(INSTALL_PARAMS);
    await installChartPage.waitForChartPage(REPO, CHART);
    await installChartPage.createNamespaceOption(NAMESPACE);
    await expect(installChartPage.chartName()).toBeDisabled();
    await expect(installChartPage.chartName()).toHaveValue(CHART);
    await installChartPage.nextPage();
    await installChartPage.editYaml();
    await expect(installChartPage.overridesPane()).toBeVisible({ timeout: LONG });
    await expect(installChartPage.defaultsEditorContent()).toBeVisible();

    return installChartPage;
  }

  test('Defaults and overrides panes are editable and stay in sync', async ({ page }) => {
    const installChartPage = await openValuesYaml(page);

    await expect(installChartPage.defaultsPane()).toBeVisible();
    await expect(installChartPage.defaultsPane()).toContainText('Chart values');
    await expect(installChartPage.overridesPane()).toContainText('Your values');

    // Both panes are editable
    await expect(installChartPage.defaultsEditor().content()).toBeVisible();
    await expect(installChartPage.defaultsEditor().content()).toBeEditable();
    await expect(installChartPage.overridesEditor().content()).toBeVisible();
    await expect(installChartPage.overridesEditor().content()).toBeEditable();

    const defaultsBefore = await installChartPage.defaultsEditor().value();

    expect(defaultsBefore).not.toContain('customKey');

    // An override typed into the overrides pane is merged on top of the defaults pane
    await installChartPage.overridesEditor().set('customKey: customValue\n');
    await installChartPage.overridesEditor().blur();

    await expect.poll(() => installChartPage.defaultsEditor().value()).toContain('customKey: customValue');

    // The overrides pane keeps only the user values, not the merged document
    const overrides = await installChartPage.overridesEditor().value();

    expect(overrides).toContain('customKey: customValue');
    expect(overrides).not.toMatch(/^clusterRole:/m);
    expect(overrides.trim()).toBe('customKey: customValue');

    // The defaults pane accepts edits too
    const merged = await installChartPage.defaultsEditor().value();

    await installChartPage.defaultsEditor().set(`${merged}# defaults-edited\n`);
    expect(await installChartPage.defaultsEditor().value()).toContain('# defaults-edited');
    await installChartPage.defaultsEditor().blur();

    // The user override survives a defaults edit
    await expect.poll(() => installChartPage.defaultsEditor().value()).toContain('customKey: customValue');
    expect(await installChartPage.overridesEditor().value()).toContain('customKey: customValue');
  });

  test('Compare Changes shows a single full-document diff', async ({ page }) => {
    const installChartPage = await openValuesYaml(page);
    const editYaml = page.getByTestId('btn-group-options-view').getByText('Edit YAML');

    await installChartPage.overridesEditor().set('customKey: customValue\n');
    await installChartPage.overridesEditor().blur();
    await expect.poll(() => installChartPage.defaultsEditor().value()).toContain('customKey: customValue');

    await installChartPage.compareChanges();
    await expect(installChartPage.diffView()).toBeVisible({ timeout: LONG });

    // The two-pane layout must not leak into diff mode
    await expect(installChartPage.overridesPane()).toHaveCount(0);
    await expect(installChartPage.defaultsPane()).toHaveCount(0);

    // The override is one added line, shown once
    await expect(installChartPage.diffAddedLines().first()).toContainText('customKey: customValue');
    await expect(installChartPage.diffView().getByText('customKey')).toHaveCount(1);
    // Unchanged context comes from the chart defaults (full-document diff), and adding a key removes nothing
    await expect(installChartPage.diffContextLines().first()).toBeVisible();
    await expect(installChartPage.diffRemovedLines()).toHaveCount(0);

    // Explicit null override: one added `anotherKey: null` line and no removal line for it
    await editYaml.click();
    await expect(installChartPage.overridesPane()).toBeVisible({ timeout: LONG });
    await installChartPage.overridesEditor().set('customKey: customValue\nanotherKey: null\n');
    await installChartPage.overridesEditor().blur();
    await expect.poll(() => installChartPage.overridesEditor().value()).toContain('anotherKey: null');

    await installChartPage.compareChanges();
    await expect(installChartPage.diffView()).toBeVisible({ timeout: LONG });

    await expect(installChartPage.diffView().getByText('anotherKey: null')).toHaveCount(1);
    await expect(installChartPage.diffAddedLines().filter({ hasText: 'anotherKey: null' }).first()).toBeVisible();
    await expect(installChartPage.diffRemovedLines().filter({ hasText: 'anotherKey' })).toHaveCount(0);
    await expect(installChartPage.diffView().getByText('customKey')).toHaveCount(1);
  });

  test('Deleted default is not sent as null', async ({ page }) => {
    try {
      const installChartPage = await openValuesYaml(page);

      const defaults = await installChartPage.defaultsEditor().value();

      // The first defaults document is `clusterRole:\n  virtClusterManage:\n ... projectRole:\n ...`;
      // delete whichever top-level block leads the document (verified live: clusterRole, then projectRole)
      const topLevelBlock = /^([a-zA-Z][\w]*):[^\n]*\n(?:(?:[ \t]+[^\n]*)\n)*/m;
      const blockName: string | undefined = defaults.match(topLevelBlock)?.[1];

      if (!blockName) {
        throw new Error('chart defaults must contain a deletable top-level block');
      }

      const withoutBlock = defaults.replace(topLevelBlock, '');

      expect(withoutBlock).not.toContain(`${blockName}:`);
      await installChartPage.defaultsEditor().set(withoutBlock);

      // focusout on the editor triggers the app to re-sync defaults:
      // the deleted default must re-appear in the defaults pane (redrawn from chart defaults)
      // and must NOT leak into the overrides pane.
      await installChartPage.defaultsEditor().blur();

      await expect.poll(() => installChartPage.defaultsEditor().value()).toContain(`${blockName}:`);
      expect(await installChartPage.overridesEditor().value()).not.toContain(blockName);

      const seen = await stubInstall(page);
      // Await the response (not the request): Playwright emits `request` before it invokes the
      // route handler, so `seen` may still be empty when waitForRequest resolves.
      const responsePromise = page.waitForResponse((r) => isInstallPost(r.request()));

      await installChartPage.nextPage();
      await expect(installChartPage.installButton()).toBeEnabled();
      await installChartPage.installChart();

      const request = (await responsePromise).request();
      const body = request.postDataJSON();
      const values = body.charts[0].values ?? {};

      // The wizard may retry the install POST after the 500 stub (operation retry loop).
      // Assert on the first captured install request only; what matters is the payload.
      const first = seen[0];

      expect(first).toBeDefined();
      expect(first!.postDataJSON().charts[0].releaseName).toBe(CHART);
      expect(values).not.toHaveProperty(blockName);
      expect(JSON.stringify(values)).not.toContain('null');
    } finally {
      await page.unroute(INSTALL_URL_GLOB);
    }
  });

  test('Sends only user values including explicit null', async ({ page }) => {
    try {
      const installChartPage = await openValuesYaml(page);

      await installChartPage
        .overridesEditor()
        .set(
          'image:\n  pullSecrets:\n    - qa-13164-secret\nclusterRole:\n  virtClusterManage:\n    additionalRules: null\n  virtClusterView:\n    additionalRules: true\n',
        );

      // Let the app register the edit before moving on
      await installChartPage.overridesEditor().blur();
      await expect.poll(() => installChartPage.overridesEditor().value()).toContain('additionalRules: null');

      await stubInstall(page);
      const responsePromise = page.waitForResponse((r) => isInstallPost(r.request()));

      await installChartPage.nextPage();
      await expect(installChartPage.installButton()).toBeEnabled();
      await installChartPage.installChart();

      const request = (await responsePromise).request();
      const values = { ...(request.postDataJSON().charts[0].values ?? {}) };

      delete values.global;

      // `clusterRole.virtClusterManage.additionalRules` is already `null` in the chart defaults,
      // so `diff()` treats that null leaf as unchanged and omits it from the payload (diff drops
      // equal values). This is intentional: an explicit null that equals the default is not an
      // override. The #13164 regression is that a DELETED default is not sent as null; a null the
      // user types that DIFFERS from the default IS sent. We pin `virtClusterView.additionalRules`
      // to `true` to force a real override, and assert the payload shape.
      expect(values.image, 'image.pullSecrets override must be present').toEqual({ pullSecrets: ['qa-13164-secret'] });
      expect(values.clusterRole?.virtClusterView, 'pinned non-default override must be present').toEqual({
        additionalRules: true,
      });
      // No unrelated keys and no null-valued leaves should appear anywhere in the values payload.
      expect(JSON.stringify(values), 'payload must not contain any null-valued leaves').not.toContain('null');
    } finally {
      await page.unroute(INSTALL_URL_GLOB);
    }
  });

  test('Invalid YAML blocks the install POST', async ({ page }) => {
    try {
      const installChartPage = await openValuesYaml(page);
      const seen = await stubInstall(page);

      await installChartPage.overridesEditor().set('foo:\n  bar:\n baz: yes\n');
      await installChartPage.overridesEditor().blur();

      // Either Next is blocked by the invalid doc, or advancing surfaces an error; never an install POST
      const next = installChartPage.nextButton();

      if (await next.isEnabled()) {
        await next.click();

        const install = installChartPage.installButton();

        if (await install.isVisible()) {
          await install.click();
        }
      }

      const blocked =
        ((await next.isVisible()) && (await next.isDisabled())) || (await installChartPage.errorBanner().isVisible());

      expect(blocked).toBe(true);
      // Negative check must not pass just because the route handler ran late; give the app a
      // settle window before asserting no install request was ever recorded.
      // eslint-disable-next-line playwright/no-wait-for-timeout -- deliberate negative check: allow a late install POST to surface before asserting none was sent
      await page.waitForTimeout(3000);
      expect(seen).toHaveLength(0);
    } finally {
      await page.unroute(INSTALL_URL_GLOB);
    }
  });

  test('Upgrade flow shows the values banner and sends only overrides', async ({ page, rancherApi }) => {
    // Real helm install + wait for `deployed` + cleanup is far slower than the stubbed tests
    test.setTimeout(PROVISIONING);

    // Skip (with a visible reason, never silently) when the catalog cannot serve both versions
    const index = await rancherApi.getRancherResource('v1', `catalog.cattle.io.clusterrepos/${REPO}?link=index`);
    const published: string[] = (index.body?.entries?.[CHART] ?? []).map((v: { version: string }) => v.version);

    test.skip(
      !published.includes(FROM_VERSION) || !published.includes(TO_VERSION),
      `${CHART} ${FROM_VERSION} and ${TO_VERSION} must both be published in ${REPO} (found: ${published.join(', ') || 'none'})`,
    );

    // harvester-rbac creates cluster-scoped RoleTemplates and pins its release name, so a release of the
    // same name in another namespace would collide with ours. Do not touch someone else's install.
    const apps = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.apps');
    const foreign = (apps.body?.data ?? []).filter(
      (a: { metadata?: { name?: string; namespace?: string } }) =>
        a.metadata?.name === CHART && a.metadata?.namespace !== UPGRADE_NAMESPACE,
    );

    test.skip(
      foreign.length > 0,
      `A '${CHART}' release already exists outside ${UPGRADE_NAMESPACE}; refusing to collide`,
    );

    const releaseId = `${UPGRADE_NAMESPACE}/${CHART}`;
    const cleanup = async () => {
      await rancherApi.ensureChartUninstalled(UPGRADE_NAMESPACE, CHART);
      await rancherApi.deleteRancherResource('v1', 'namespaces', UPGRADE_NAMESPACE, false);
      await rancherApi.waitForResourceGone('v1', 'namespaces', UPGRADE_NAMESPACE);
    };

    try {
      // Clear leftovers from an aborted earlier run, then create the fresh namespace
      await cleanup();
      await rancherApi.createNamespace(UPGRADE_NAMESPACE);

      // Real install of the OLDER version with custom values. The UI would send these source-repo
      // annotations; mirror them so the app resolves back to its chart in the upgrade wizard.
      await rancherApi.createRancherResource('v1', `catalog.cattle.io.clusterrepos/${REPO}?action=install`, {
        charts: [
          {
            chartName: CHART,
            version: FROM_VERSION,
            releaseName: CHART,
            namespace: UPGRADE_NAMESPACE,
            annotations: {
              'catalog.cattle.io/ui-source-repo-type': 'cluster',
              'catalog.cattle.io/ui-source-repo': REPO,
            },
            values: { [MARKER_KEY]: MARKER_VALUE },
          },
        ],
        noHooks: false,
        timeout: '600s',
        wait: true,
        namespace: UPGRADE_NAMESPACE,
        projectId: '',
      });

      await rancherApi.expectResourceState(
        'v1',
        'catalog.cattle.io.apps',
        releaseId,
        (resp) => resp.body?.metadata?.state?.name === 'deployed',
        60,
        5000,
      );

      const installChartPage = new InstallChartPage(page);
      const fromQuery = `${UPGRADE_PARAMS}&version=${encodeURIComponent(FROM_VERSION)}`;

      // Control: same version as installed, so there is nothing to carry over and no banner
      await installChartPage.goTo(fromQuery);
      await installChartPage.waitForChartPage(REPO, CHART);
      await expect(installChartPage.chartVersionSelector().self()).toBeVisible({ timeout: LONG });
      await installChartPage.nextPage();
      await installChartPage.editYaml();
      await expect(installChartPage.overridesPane()).toBeVisible({ timeout: LONG });
      await expect(installChartPage.upgradeBanner()).toHaveCount(0);

      // Upgrade: reopen the wizard for the installed app and switch the target version on step 1
      await installChartPage.goTo(fromQuery);
      await installChartPage.waitForChartPage(REPO, CHART);

      const versionSelector = installChartPage.chartVersionSelector();

      await expect(versionSelector.self()).toBeVisible({ timeout: LONG });
      await expect(versionSelector.selectedOption()).toContainText(FROM_VERSION);

      await versionSelector.dropdown().click();
      await versionSelector.clickOptionWithLabel(TO_VERSION);
      await expect(versionSelector.selectedOption()).toContainText(TO_VERSION);

      await installChartPage.nextPage();
      await installChartPage.editYaml();
      await expect(installChartPage.overridesPane()).toBeVisible({ timeout: LONG });
      await expect(installChartPage.defaultsEditorContent()).toBeVisible();

      // The banner only renders when currentVersion !== targetVersion
      await expect(installChartPage.upgradeBanner()).toBeVisible();
      await expect(installChartPage.upgradeBanner()).toContainText(`Your values from ${FROM_VERSION}`);
      await expect(installChartPage.upgradeBanner()).toContainText(TO_VERSION);

      // "Your values" holds only what the user customised at install time, not the chart defaults
      await expect(installChartPage.overridesPane()).toContainText('Your values');
      await expect.poll(() => installChartPage.overridesEditor().value()).toContain(`${MARKER_KEY}: ${MARKER_VALUE}`);

      const overrides = await installChartPage.overridesEditor().value();

      expect(overrides.trim()).toBe(`${MARKER_KEY}: ${MARKER_VALUE}`);
      expect(overrides).not.toMatch(/^clusterRole:/m);
      expect(overrides).not.toMatch(/^projectRole:/m);
      expect(overrides).not.toContain('virtClusterManage');

      // The defaults pane holds the full chart defaults with the user's value merged on top
      const defaults = await installChartPage.defaultsEditor().value();

      expect(defaults).toMatch(/^clusterRole:/m);
      expect(defaults).toContain(`${MARKER_KEY}: ${MARKER_VALUE}`);

      // Stub the upgrade POST so the release is never really upgraded; only its payload matters
      const seen = await stubInstall(page, UPGRADE_URL_GLOB);
      const responsePromise = page.waitForResponse((r) => isUpgradePost(r.request()));

      await installChartPage.nextPage();
      await expect(installChartPage.installButton()).toBeEnabled();
      await installChartPage.installChart();

      await responsePromise;

      // The wizard may retry the POST after the 500 stub; the first captured request is the payload under test
      const first = seen[0];

      expect(first).toBeDefined();

      const chart = first!.postDataJSON().charts[0];
      const values = chart.values ?? {};

      expect(chart.releaseName).toBe(CHART);
      expect(chart.version).toBe(TO_VERSION);
      // Only the install-time override plus the injected `global.cattle`: no chart defaults
      expect(Object.keys(values).sort()).toEqual(['global', MARKER_KEY].sort());
      expect(values[MARKER_KEY]).toBe(MARKER_VALUE);
      expect(values.global).toHaveProperty('cattle');
      // No `null` tombstones for deleted defaults
      expect(JSON.stringify(values)).not.toContain('null');
    } finally {
      await page.unroute(UPGRADE_URL_GLOB);
      await cleanup();
    }
  });
});
