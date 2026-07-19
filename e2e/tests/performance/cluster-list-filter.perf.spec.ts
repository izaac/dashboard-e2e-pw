/*
 * Measurement probe, not a functional test. Selectors are kept as raw strings
 * because the settle observers run inside page.evaluate (browser context),
 * where a Playwright Locator cannot be used and only a CSS string works. The
 * fixed waitForTimeout delays let the list settle between trials so timings are
 * comparable. The Playwright locator/timeout lint rules therefore do not apply.
 */
/* eslint-disable playwright/no-raw-locators, playwright/no-wait-for-timeout */
import { test, expect } from '@/support/fixtures';
import * as fs from 'fs';
import * as path from 'path';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import HomePagePo from '@/e2e/po/pages/home.po';

/*
 * Performance probe for issue #11994 (cluster list churn at scale).
 *
 * The home / cluster-management cluster lists are slow at scale when
 * server-side pagination is OFF (the pre-#17234 client-side path): the UI
 * pulls every cluster into the store and the main thread blocks. With
 * server-side pagination ON it fetches one page and stays responsive.
 *
 * Two metrics are captured, each over PERF_REPEATS iterations:
 *
 *   load    time from a fresh document load of the list page until the DOM
 *           stops mutating (main thread quiet). An init-script observer is
 *           installed at document start so a blocked main thread is still
 *           timed correctly. Long tasks during load are summed as blocking.
 *
 *   filter  after the list is loaded, time from a filter keystroke until the
 *           table settles.
 *
 * Output: test-results/perf-<label>.json (label from PERF_LABEL env).
 * Measurement probe, not a threshold assertion.
 */

const LABEL = process.env.PERF_LABEL || 'unknown';
const REPEATS = Number(process.env.PERF_REPEATS || 3);
const QUIET_MS = Number(process.env.PERF_QUIET_MS || 750);
const HARD_CAP_MS = Number(process.env.PERF_CAP_MS || 120_000);
const LIST_SELECTOR = '[data-testid="cluster-list"]';
const HOME_LIST_SELECTOR = '[data-testid="sortable-table-list-container"]';
const FILTER_SELECTOR = '[data-testid="search-box-filter-row"] input';
const QUERIES = ['fake-0', 'fake-013'];

const INIT_SCRIPT = `(() => {
  const w = window;
  w.__L = { start: performance.now(), lastMut: performance.now(), muts: 0, lts: [] };
  const attach = () => {
    try {
      const o = new MutationObserver(() => { w.__L.muts++; w.__L.lastMut = performance.now(); });
      o.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    } catch (e) { /* noop */ }
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__L.lts.push(e.duration);
      });
      po.observe({ entryTypes: ['longtask'] });
    } catch (e) { /* noop */ }
  };
  if (document.documentElement) attach();
  else document.addEventListener('DOMContentLoaded', attach);
})();`;

type LoadTrial = {
  page: string;
  metric: 'load';
  iteration: number;
  loadMs: number;
  mutations: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
};

type FilterTrial = {
  page: string;
  metric: 'filter';
  query: string;
  iteration: number;
  wallMs: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
  visibleRows: number;
};

type Trial = LoadTrial | FilterTrial;

function median(nums: number[]): number {
  if (!nums.length) {
    return 0;
  }
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);

  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Poll the init-script observer until the DOM is quiet for quietMs, then report.
async function readLoadSettle(page: any, quietMs: number, capMs: number): Promise<any> {
  return page.evaluate(
    async ({ quiet, cap }: { quiet: number; cap: number }) => {
      const w = window as any;
      const t0 = w.__L.start;

      while (true) {
        const now = performance.now();

        if (w.__L.muts > 0 && now - w.__L.lastMut > quiet) {
          break;
        }
        if (now - t0 > cap) {
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      const lts: number[] = w.__L.lts;

      return {
        loadMs: w.__L.lastMut - t0,
        mutations: w.__L.muts,
        longTaskCount: lts.length,
        longTaskTotalMs: lts.reduce((a: number, b: number) => a + b, 0),
        longTaskMaxMs: lts.length ? Math.max(...lts) : 0,
      };
    },
    { quiet: quietMs, cap: capMs },
  );
}

// Arm a fresh observer scoped to the list container for the filter measurement.
async function armFilter(page: any, containerSel: string): Promise<void> {
  await page.evaluate((sel: string) => {
    const w = window as any;
    const container = document.querySelector(sel) || document.body;

    if (w.__fObs) {
      w.__fObs.disconnect();
    }
    if (w.__fLt) {
      w.__fLt.disconnect();
    }
    w.__f = { mutations: 0, lastMut: performance.now(), start: performance.now(), lts: [] as number[] };
    w.__fObs = new MutationObserver(() => {
      w.__f.mutations++;
      w.__f.lastMut = performance.now();
    });
    w.__fObs.observe(container, { childList: true, subtree: true, characterData: true });
    try {
      w.__fLt = new PerformanceObserver((list: any) => {
        for (const e of list.getEntries()) {
          w.__f.lts.push(e.duration);
        }
      });
      w.__fLt.observe({ entryTypes: ['longtask'] });
    } catch {
      /* noop */
    }
    w.__f.start = performance.now();
    w.__f.lastMut = performance.now();
  }, containerSel);
}

async function readFilterSettle(page: any, quietMs: number, capMs: number): Promise<any> {
  return page.evaluate(
    async ({ quiet, cap }: { quiet: number; cap: number }) => {
      const w = window as any;
      const t0 = w.__f.start;

      while (true) {
        const now = performance.now();

        if (w.__f.mutations > 0 && now - w.__f.lastMut > quiet) {
          break;
        }
        if (now - t0 > cap) {
          break;
        }
        await new Promise((r) => setTimeout(r, 40));
      }
      if (w.__fObs) {
        w.__fObs.disconnect();
      }
      if (w.__fLt) {
        w.__fLt.disconnect();
      }
      const lts: number[] = w.__f.lts;

      return {
        wallMs: w.__f.lastMut - t0,
        longTaskCount: lts.length,
        longTaskTotalMs: lts.reduce((a: number, b: number) => a + b, 0),
        longTaskMaxMs: lts.length ? Math.max(...lts) : 0,
      };
    },
    { quiet: quietMs, cap: capMs },
  );
}

test.describe('#11994 cluster list performance', { tag: ['@performance'] }, () => {
  test('measure load and filter at scale', async ({ page, login }) => {
    test.setTimeout(20 * 60_000);
    await login();
    await page.addInitScript(INIT_SCRIPT);

    const trials: Trial[] = [];

    const goList = async (pageLabel: string) => {
      if (pageLabel === 'home') {
        await new HomePagePo(page).goTo();
      } else {
        await new ClusterManagerListPagePo(page).goTo();
      }
    };

    const measureLoad = async (pageLabel: string, containerSel: string) => {
      for (let i = 0; i < REPEATS; i++) {
        await goList(pageLabel); // fresh document load
        await page
          .locator(containerSel)
          .waitFor({ state: 'attached', timeout: HARD_CAP_MS })
          .catch(() => undefined);
        const s = await readLoadSettle(page, QUIET_MS, HARD_CAP_MS);

        trials.push({
          page: pageLabel,
          metric: 'load',
          iteration: i,
          loadMs: Math.round(s.loadMs),
          mutations: s.mutations,
          longTaskCount: s.longTaskCount,
          longTaskTotalMs: Math.round(s.longTaskTotalMs),
          longTaskMaxMs: Math.round(s.longTaskMaxMs),
        });
      }
    };

    const measureFilter = async (pageLabel: string, containerSel: string) => {
      await goList(pageLabel);
      const filter = page.locator(FILTER_SELECTOR).first();

      await expect(filter).toBeVisible({ timeout: HARD_CAP_MS });
      // Let the initial load fully settle before filtering.
      await readLoadSettle(page, QUIET_MS, HARD_CAP_MS);
      await page.waitForTimeout(1_000);

      for (const query of QUERIES) {
        for (let i = 0; i < REPEATS; i++) {
          await filter.click();
          await filter.fill('');
          await page.waitForTimeout(800);
          await armFilter(page, containerSel);
          await filter.fill(query);
          const s = await readFilterSettle(page, QUIET_MS, HARD_CAP_MS);
          const visibleRows = await page.locator(`${containerSel} tbody tr`).count();

          trials.push({
            page: pageLabel,
            metric: 'filter',
            query,
            iteration: i,
            wallMs: Math.round(s.wallMs),
            longTaskCount: s.longTaskCount,
            longTaskTotalMs: Math.round(s.longTaskTotalMs),
            longTaskMaxMs: Math.round(s.longTaskMaxMs),
            visibleRows,
          });
        }
      }
    };

    for (const [pageLabel, sel] of [
      ['home', HOME_LIST_SELECTOR],
      ['cluster-management', LIST_SELECTOR],
    ] as const) {
      await measureLoad(pageLabel, sel);
      await measureFilter(pageLabel, sel);
    }

    // Summaries.
    const loadTrials = trials.filter((t): t is LoadTrial => t.metric === 'load');
    const filterTrials = trials.filter((t): t is FilterTrial => t.metric === 'filter');

    const loadSummary = [...new Set(loadTrials.map((t) => t.page))].map((pg) => {
      const ts = loadTrials.filter((t) => t.page === pg);

      return {
        page: pg,
        metric: 'load',
        medianLoadMs: Math.round(median(ts.map((t) => t.loadMs))),
        medianBlockingMs: Math.round(median(ts.map((t) => t.longTaskTotalMs))),
        maxTaskMs: Math.round(Math.max(...ts.map((t) => t.longTaskMaxMs))),
      };
    });

    const filterKeys = [...new Set(filterTrials.map((t) => `${t.page}::${t.query}`))];
    const filterSummary = filterKeys.map((k) => {
      const [pg, query] = k.split('::');
      const ts = filterTrials.filter((t) => `${t.page}::${t.query}` === k);

      return {
        page: pg,
        metric: 'filter',
        query,
        medianWallMs: Math.round(median(ts.map((t) => t.wallMs))),
        medianBlockingMs: Math.round(median(ts.map((t) => t.longTaskTotalMs))),
        medianVisibleRows: Math.round(median(ts.map((t) => t.visibleRows))),
      };
    });

    const report = {
      label: LABEL,
      serverVersion: process.env.PERF_SERVER_VERSION || '',
      sspMode: process.env.PERF_SSP_MODE || '',
      clusterCount: process.env.PERF_CLUSTER_COUNT || '',
      repeats: REPEATS,
      quietMs: QUIET_MS,
      queries: QUERIES,
      generatedAt: new Date().toISOString(),
      loadSummary,
      filterSummary,
      trials,
    };

    const outDir = path.join(process.cwd(), 'perf-out');

    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `perf-${LABEL}.json`);

    fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

    // eslint-disable-next-line no-console
    console.log(`\n[perf] wrote ${outFile}`);
    // eslint-disable-next-line no-console
    console.table(loadSummary);
    // eslint-disable-next-line no-console
    console.table(filterSummary);

    await test.info().attach(`perf-${LABEL}.json`, { path: outFile, contentType: 'application/json' });
    expect(trials.length).toBeGreaterThan(0);
  });
});
