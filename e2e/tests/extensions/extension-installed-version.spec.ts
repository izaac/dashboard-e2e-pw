import { test, expect } from '@/support/fixtures';
import ExtensionsPagePo from '@/e2e/po/pages/extensions.po';
import { EXTENDED, EXTENSION_OPS, LONG, PROVISIONING, STANDARD, VERY_LONG } from '@/support/timeouts';

/**
 * rancher/dashboard#17258: the Installed-tab card and the slide-in panel showed the NEWEST version
 * from the repo index instead of the version actually installed. Fixed on dashboard master (300e0de).
 *
 * Scenario: Kubewarden is installed at the older chart version (3.1.3) while the repo offers a
 * newer one (4.1.0). The Installed card must label 3.1.3, the panel must mark 3.1.3 as
 * "(current)" below the newest entry, and the card must carry the upgrade marker pointing at 4.1.0.
 *
 * OPT-IN spec: the install is global and serial mode does not extend across files, so this spec
 * shares the `cattle-ui-plugin-system/kubewarden` helm release with
 * e2e/tests/pages/extensions/kubewarden.spec.ts and must NEVER run while any other Kubewarden
 * spec runs against the same Rancher. Every test is therefore skipped unless the flag below is
 * set — a default suite pass reports the tests as skipped and runs no hooks, touching nothing.
 * How to run (needs a DISPOSABLE cluster with network egress to raw.githubusercontent.com and
 * github.com release downloads):
 *
 *   EXTENSION_LIFECYCLE=1 npx playwright test e2e/tests/extensions/extension-installed-version.spec.ts
 *
 * Mutable-index dependency: the pinned versions below are read from the live ui-plugin-charts
 * index on raw.githubusercontent.com. If upstream adds a newer release or prunes 3.1.3, beforeAll
 * fails with a message naming the missing version — update the constants in that case; it is not
 * a product regression.
 *
 * The spec refuses to disturb pre-existing state: a Kubewarden UIPlugin, a kubewarden helm app,
 * or a ClusterRepo carrying its name with a different URL makes beforeAll fail fast with a clear
 * message instead of uninstalling or overwriting. afterAll only removes (and only verifies) the
 * resources this run created.
 *
 * Environment notes (from a live run — do not re-derive):
 * - A git-mode ClusterRepo for rancher/ui-plugin-charts downloads but its chart fetches 404 here;
 *   an HTTP-index ClusterRepo against the raw gh-pages index is what works.
 * - appVersion equals chartVersion for every kubewarden entry, so version labels render as a bare
 *   version, not "appVersion (chartVersion)".
 * - After an API install the card keeps saying "Installing ..." until the page is reloaded, which
 *   beforeEach absorbs.
 * - The extension resource on 2.16 is `uiplugins.catalog.cattle.io`.
 */
const EXTENSION_LIFECYCLE = process.env.EXTENSION_LIFECYCLE === '1';

test.describe(
  'Installed extension card shows the installed version (#17258)',
  { tag: ['@extensions', '@adminUser'] },
  () => {
    test.describe.configure({ mode: 'serial' });

    // Describe-level conditional skip: without the flag all tests report as skipped and NO hook
    // (beforeAll included) runs, so a default suite pass never touches the cluster.
    test.skip(
      !EXTENSION_LIFECYCLE,
      'Opt-in extension lifecycle spec: it shares the Kubewarden helm release with other specs; set EXTENSION_LIFECYCLE=1 to run',
    );

    const REPO_NAME = 'e2e-17258-ui-plugin-charts';
    const REPO_URL = 'https://raw.githubusercontent.com/rancher/ui-plugin-charts/gh-pages/';
    const CHART_NAME = 'kubewarden';
    const EXTENSION_TITLE = 'Kubewarden';
    const EXTENSION_NS = 'cattle-ui-plugin-system';
    const INSTALLED_VERSION = '3.1.3';
    const NEWEST_VERSION = '4.1.0';

    // What this run created — teardown cleans and verifies only these
    let managedRepo = false;
    let installedExtension = false;

    /** True when the list response includes a kubewarden UIPlugin in the extension namespace. */
    function hasKubewardenUiPlugin(resp: any): boolean {
      const plugins = (resp.body?.data ?? []) as Array<{
        metadata?: { name?: string; namespace?: string };
        spec?: { plugin?: { name?: string } };
      }>;

      return plugins.some(
        (p) =>
          p.metadata?.namespace === EXTENSION_NS &&
          (p.spec?.plugin?.name === CHART_NAME || p.metadata?.name === CHART_NAME),
      );
    }

    test.beforeAll(async ({ rancherApi }) => {
      test.setTimeout(PROVISIONING);

      // 1. Fail fast rather than disturb state this run does not own
      const existingRepo = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.clusterrepos', REPO_NAME, 0);

      if (existingRepo.status === 200 && existingRepo.body?.spec?.url !== REPO_URL) {
        expect(
          existingRepo.body?.spec?.url,
          `Precondition: ClusterRepo '${REPO_NAME}' already exists but points at '${existingRepo.body?.spec?.url}', not the ui-plugin-charts index this spec owns — remove it or rename`,
        ).toBe(REPO_URL);
      }

      const existingApp = await rancherApi.getRancherResource(
        'v1',
        'catalog.cattle.io.apps',
        `${EXTENSION_NS}/${CHART_NAME}`,
        0,
      );

      expect(
        existingApp.status,
        `Precondition: a '${CHART_NAME}' helm app already exists in '${EXTENSION_NS}' (status ${existingApp.status}) — refusing to uninstall pre-existing state; remove it first (another Kubewarden spec may be running)`,
      ).not.toBe(200);

      const existingPlugins = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.uiplugins', undefined, 0);

      expect(
        hasKubewardenUiPlugin(existingPlugins),
        `Precondition: a '${CHART_NAME}' UIPlugin already exists in '${EXTENSION_NS}' — refusing to take over a pre-existing install`,
      ).toBe(false);

      // 2. HTTP-index ClusterRepo; a leftover with our exact name+URL is treated as ours and cleaned
      if (existingRepo.status !== 200) {
        await rancherApi.createRancherResource(
          'v1',
          'catalog.cattle.io.clusterrepos',
          {
            apiVersion: 'catalog.cattle.io/v1',
            kind: 'ClusterRepo',
            metadata: { name: REPO_NAME },
            spec: { url: REPO_URL },
          },
          false,
        );
      }

      managedRepo = true;

      // 3. Bounded waits — fail loudly naming what is missing rather than proceeding
      const downloaded = await rancherApi.waitForRepositoryDownload(
        'v1',
        'catalog.cattle.io.clusterrepos',
        REPO_NAME,
        30,
      );

      expect(
        downloaded,
        `Precondition: ClusterRepo '${REPO_NAME}' (${REPO_URL}) never reached the Downloaded condition — no network access to raw.githubusercontent.com?`,
      ).toBe(true);

      // ?link=index returns the full chart index; waitForRancherResource skips appending an empty id
      let missingVersions = '(unknown)';
      const indexReady = await rancherApi.waitForRancherResource(
        'v1',
        `catalog.cattle.io.clusterrepos/${REPO_NAME}?link=index`,
        '',
        (resp) => {
          const versions = resp.body?.entries?.[CHART_NAME] ?? [];
          const absent = [INSTALLED_VERSION, NEWEST_VERSION].filter((w) => !versions.some((v: any) => v.version === w));

          missingVersions = absent.length ? absent.join(' and ') : '';

          return absent.length === 0;
        },
        30,
        3000,
      );

      expect(
        indexReady,
        `The ui-plugin-charts index changed or did not sync: '${CHART_NAME}' is missing ${missingVersions || 'its entries'} ` +
          `(this spec pins installed=${INSTALLED_VERSION} + newest=${NEWEST_VERSION} from a mutable upstream index) — update the constants if upstream moved`,
      ).toBe(true);

      // 4. Install the OLDER version through the same catalog install action the UI uses
      installedExtension = true;

      await rancherApi.createRancherResource(
        'v1',
        `catalog.cattle.io.clusterrepos/${REPO_NAME}?action=install`,
        {
          charts: [
            { chartName: CHART_NAME, version: INSTALLED_VERSION, namespace: EXTENSION_NS, releaseName: CHART_NAME },
          ],
          noHooks: false,
          timeout: '600s',
          wait: true,
          namespace: EXTENSION_NS,
          projectId: '',
        },
        false,
      );

      const deployed = await rancherApi.waitForRancherResource(
        'v1',
        'catalog.cattle.io.apps',
        `${EXTENSION_NS}/${CHART_NAME}`,
        (resp) => resp.body?.metadata?.state?.name === 'deployed',
        40,
        2000,
      );

      expect(
        deployed,
        `Helm app '${CHART_NAME}' did not reach deployed state in '${EXTENSION_NS}' at ${INSTALLED_VERSION}`,
      ).toBe(true);

      const pluginReady = await rancherApi.waitForRancherResource(
        'v1',
        'catalog.cattle.io.uiplugins',
        '',
        (resp) => hasKubewardenUiPlugin(resp),
        30,
        2000,
      );

      expect(
        pluginReady,
        `Precondition: UIPlugin for '${CHART_NAME}' did not appear in '${EXTENSION_NS}' after installing ${INSTALLED_VERSION}`,
      ).toBe(true);
    });

    test.afterAll(async ({ rancherApi }) => {
      test.setTimeout(PROVISIONING);

      const leftovers: string[] = [];
      const warn = (what: string) => (err: unknown) =>
        console.warn(`[extension-installed-version afterAll] ${what} failed: ${(err as Error)?.message ?? err}`);

      // Only what this run created; failOnStatusCode=false everywhere so an early beforeAll failure
      // still leaves the cluster exactly as it was found.
      if (installedExtension) {
        await rancherApi.ensureChartUninstalled(EXTENSION_NS, CHART_NAME).catch(warn('extension uninstall'));
      }

      if (managedRepo) {
        await rancherApi
          .deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', REPO_NAME, false)
          .catch(warn('repo delete'));
      }

      if (installedExtension) {
        const appGone = await rancherApi.waitForResourceGone(
          'v1',
          'catalog.cattle.io.apps',
          `${EXTENSION_NS}/${CHART_NAME}`,
          30,
          2000,
        );

        // The UIPlugin CR is a chart resource — once the helm release is gone it goes with it.
        const pluginGone = await rancherApi.waitForRancherResource(
          'v1',
          'catalog.cattle.io.uiplugins',
          '',
          (resp) => !hasKubewardenUiPlugin(resp),
          30,
          2000,
        );

        if (!appGone) {
          leftovers.push(`helm app ${EXTENSION_NS}/${CHART_NAME}`);
        }

        if (!pluginGone) {
          leftovers.push(`uiplugins.catalog.cattle.io/${CHART_NAME} in ${EXTENSION_NS}`);
        }
      }

      if (managedRepo) {
        const repoGone = await rancherApi.waitForResourceGone(
          'v1',
          'catalog.cattle.io.clusterrepos',
          REPO_NAME,
          30,
          2000,
        );

        if (!repoGone) {
          leftovers.push(`clusterrepo ${REPO_NAME}`);
        }
      }

      expect(leftovers, `Teardown verification failed — leftovers from this run: ${leftovers.join(', ')}`).toHaveLength(
        0,
      );
    });

    test.beforeEach(async ({ page, login }) => {
      test.setTimeout(EXTENSION_OPS);

      await login();

      const extensions = new ExtensionsPagePo(page);

      await extensions.goTo();
      await extensions.waitForTitle();
      await extensions.extensionTabInstalledClick();

      // After an API install the card can keep saying "Installing ..." until a reload; keep
      // reloading (bounded) until the card settles on the installed version.
      await expect
        .poll(
          async () => {
            const label = extensions.extensionCardVersion(EXTENSION_TITLE);
            const visible = await label.isVisible({ timeout: EXTENDED }).catch(() => false);
            const text = visible ? (await label.innerText().catch(() => '')).trim() : '';

            if (text === INSTALLED_VERSION) {
              return 'ready';
            }

            await page.reload();
            await extensions.waitForTitle();
            await extensions.extensionTabInstalledClick();

            return `card version label was '${text || '(absent)'}'`;
          },
          {
            timeout: VERY_LONG,
            message: `Kubewarden Installed card never settled showing '${INSTALLED_VERSION}' — the extension may still be installing or the card is missing`,
          },
        )
        .toBe('ready');
    });

    test('the Installed card labels the installed version, not the newest one', async ({ page }) => {
      const extensions = new ExtensionsPagePo(page);
      const cardVersion = extensions.extensionCardVersion(EXTENSION_TITLE);

      // The fix: the card must show what is installed (3.1.3)...
      await expect(cardVersion).toHaveText(INSTALLED_VERSION, { timeout: LONG });
      // ...and not what the repo offers as newest (4.1.0) — the pre-fix behavior.
      await expect(cardVersion).not.toHaveText(NEWEST_VERSION);
    });

    test('the panel marks the installed version as (current) below the newest one', async ({ page }) => {
      const extensions = new ExtensionsPagePo(page);

      await extensions.extensionCardClick(EXTENSION_TITLE);
      await expect(extensions.extensionDetails()).toBeVisible({ timeout: STANDARD });

      const active = extensions.extensionDetailsVersionActive();

      await expect(active).toBeVisible({ timeout: EXTENDED });
      await expect(active).toHaveText(new RegExp(`^${INSTALLED_VERSION} \\(current\\)$`));

      const versions = extensions.extensionDetailsVersionList();

      await expect(versions.first()).toBeVisible({ timeout: EXTENDED });
      const texts = (await versions.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      const newestIndex = texts.findIndex((t) => t.includes(NEWEST_VERSION));
      const currentIndex = texts.findIndex((t) => t.includes(`${INSTALLED_VERSION} (current)`));

      expect(
        newestIndex,
        `newest version ${NEWEST_VERSION} missing from the panel list: ${JSON.stringify(texts)}`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        currentIndex,
        `installed version ${INSTALLED_VERSION} (current) missing from the panel list: ${JSON.stringify(texts)}`,
      ).toBeGreaterThan(newestIndex);
    });

    test('the card carries an upgrade marker naming the newest version', async ({ page }) => {
      const extensions = new ExtensionsPagePo(page);
      const upgradeIcon = extensions.extensionCardUpgradeStatusIcon(EXTENSION_TITLE);

      await expect(upgradeIcon).toBeVisible({ timeout: LONG });

      await upgradeIcon.hover();
      await expect(extensions.extensionCardUpgradeStatusTooltip()).toContainText(`Upgradeable to ${NEWEST_VERSION}`, {
        timeout: EXTENDED,
      });
    });
  },
);
