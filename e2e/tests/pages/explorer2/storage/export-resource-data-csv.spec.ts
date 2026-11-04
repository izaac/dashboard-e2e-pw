import fs from 'fs';
import path from 'path';
import { test, expect } from '@/support/fixtures';
import { ConfigMapsPagePo } from '@/e2e/po/pages/explorer/configmaps.po';
import {
  setTablePreferences,
  restoreTablePreferences,
  type SavedPrefs,
} from '@/e2e/tests/pages/explorer2/workloads/pagination.utils';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-16429-export-resource-data-csv-evidence';
const TMP_DIR = '/tmp/opencode';
const TAB_CSV = path.join(TMP_DIR, 'downloaded-tab-configmap.csv');
const SELECTION_CSV = path.join(TMP_DIR, 'downloaded-selection-configmap.csv');
const FINDINGS_TXT = path.join(TMP_DIR, 'qa-16429-formula-findings.txt');

/** ConfigMaps seeded by this spec. The tab export must return exactly these four. */
const CONFIG_MAPS = {
  standard: 'qa-standard-config',
  quoted: 'qa-quoted-config',
  formula: 'qa-formula-injection-config',
  unicode: 'qa-unicode-config',
};

/** The root CA publisher injects this ConfigMap into every namespace, so an all-rows export includes it. */
const INJECTED_CONFIG_MAP = 'kube-root-ca.crt';

/** Split CSV text into records, honouring quoted fields that contain commas or newlines. */
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
      if (ch === '\r') {
        i++;
      }
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  return records.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Count CSV records, honouring quoted fields that contain commas or newlines. */
function countCsvRecords(text: string): number {
  return parseCsvRecords(text).length;
}

/** Render raw file text into a standalone page so it can be captured as evidence. */
async function renderTextToPage(page: import('@playwright/test').Page, text: string, heading: string) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  await page.setContent(
    `<html><body style="font-family:monospace;font-size:13px;margin:16px;background:#fff">` +
      `<h3>${heading}</h3><pre style="white-space:pre-wrap">${escaped}</pre></body></html>`,
  );
}

test.describe.serial('ConfigMap CSV export (#16429)', { tag: ['@explorer2', '@adminUser'] }, () => {
  let testNamespace: string;
  let savedPrefs: SavedPrefs;

  test.beforeAll(async ({ rancherApi }) => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.mkdirSync(TMP_DIR, { recursive: true });

    testNamespace = rancherApi.createE2EResourceName('qa-16429-csv');

    await rancherApi.createNamespace(testNamespace);

    await rancherApi.createConfigMap(testNamespace, CONFIG_MAPS.standard, {
      data: {
        'app.name': 'qa-demo',
        'app.replicas': '3',
        'app.tier': 'backend',
      },
    });

    await rancherApi.createConfigMap(testNamespace, CONFIG_MAPS.quoted, {
      data: {
        'app.name': 'hello, world',
        'app.quotes': 'she said "hello"',
        'app.newline': 'line1\nline2',
      },
    });

    await rancherApi.createConfigMap(testNamespace, CONFIG_MAPS.formula, {
      data: {
        'formula-eq': '=1+1',
        'formula-calc': '+cmd',
        '-minus': '-cmd',
        'at-sign': '@cmd',
      },
    });

    await rancherApi.createConfigMap(testNamespace, CONFIG_MAPS.unicode, {
      data: {
        'test.accented': 'test-üñîçødè',
        greeting: '你好世界',
        emoji: '🚀',
      },
    });

    // Pin the namespace table preference so the ConfigMaps list, and therefore the
    // tab export, only ever contains the four ConfigMaps seeded above.
    savedPrefs = await setTablePreferences(rancherApi, [testNamespace]);
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      // Guard so a failed beforeAll does not mask its own error
      if (savedPrefs) {
        await restoreTablePreferences(rancherApi, savedPrefs);
      }
    } finally {
      // Namespace cleanup must run even when preference restoration throws
      if (testNamespace) {
        await rancherApi.deleteNamespace([testNamespace]);
      }
    }
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('exports all matching resources as CSV and validates escaping and formula audit', async ({ page }) => {
    const configMapsPage = new ConfigMapsPagePo(page);
    let csvText = '';

    await test.step('1: Export All View Contents downloads configmap.csv', async () => {
      await configMapsPage.goTo();
      await configMapsPage.waitForPage();

      const table = configMapsPage.list().resourceTable().sortableTable();

      // The pinned namespace preference means all four seeded ConfigMaps are listed
      for (const name of Object.values(CONFIG_MAPS)) {
        await expect(table.rowWithName(name).self()).toBeVisible();
      }

      await page.getByTestId('table-views-tab-menu-all').click();
      await page.getByTestId('table-views-export-all').click();

      const modal = page.getByTestId('table-views-export-modal');

      await expect(modal).toBeVisible();
      await expect(modal.getByRole('radio', { name: 'CSV' })).toBeChecked();

      // Capture while the modal is still open with CSV selected and Download visible
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, 'scenario-01-tab-export-csv-download.png'),
        fullPage: false,
      });

      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('table-views-export-download').click();

      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe('configmap.csv');
      await download.saveAs(TAB_CSV);

      await expect(page.getByTestId('table-views-export-modal')).toBeHidden();

      // Read the download once here so the later steps share the same artifact
      csvText = fs.readFileSync(TAB_CSV, 'utf8');

      expect(csvText.length, 'downloaded tab CSV is not empty').toBeGreaterThan(0);
    });

    await test.step('2: column headers and row count match the seeded ConfigMaps', async () => {
      const records = parseCsvRecords(csvText);
      const header = records[0];

      expect(header.length, 'tab CSV header column count').toBeGreaterThan(1);
      // The Data column header is the comma-joined key list, so it must be quoted
      expect(csvText, 'tab CSV quoted key-list header').toContain('"app.name, app.replicas, app.tier"');

      // One header record plus all four seeded ConfigMaps, ignoring the injected root CA entry
      const dataRecords = records.slice(1).filter((r) => r[0] !== INJECTED_CONFIG_MAP);

      expect(dataRecords.length, 'tab CSV seeded record count (excluding kube-root-ca.crt)').toBe(
        Object.keys(CONFIG_MAPS).length,
      );

      for (const name of Object.values(CONFIG_MAPS)) {
        expect(csvText, `tab CSV contains ${name}`).toContain(name);
      }
    });

    await test.step('3: escaped commas, quotes, and newlines in the tab CSV', async () => {
      const records = parseCsvRecords(csvText);

      expect(csvText.length).toBeGreaterThan(0);
      expect(records.length).toBeGreaterThan(1);
      expect(csvText, 'tab CSV contains the standard ConfigMap').toContain(CONFIG_MAPS.standard);

      const quotedRow = csvText.split(/\r?\n/).find((l) => l.includes(CONFIG_MAPS.quoted)) ?? '';

      console.warn(`[step 3] quoted row (first line segment): ${quotedRow.slice(0, 300)}`);
      console.warn(`[step 3] contains quoted comma cell: ${csvText.includes('"hello, world"')}`);
      console.warn(`[step 3] contains doubled-quote cell: ${csvText.includes('""hello""')}`);

      await renderTextToPage(page, csvText, 'configmap.csv (step 3: escaping)');
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, 'scenario-03-escaped-csv-content-view.png'),
        fullPage: true,
      });
    });

    await test.step('4: formula injection characters in the tab CSV', async () => {
      const lines = csvText.split(/\r?\n/);
      const formulaLines = lines.filter((l) => l.includes(CONFIG_MAPS.formula));

      // Cells beginning with a formula trigger, after a separator or quote
      const hits = lines.filter((l) => /(^|,|")[=+\-@]/.test(l));
      const report = [
        'qa-16429 step 4: lines with a cell beginning = + - @',
        ...(hits.length ? hits : ['(none found)']),
        '',
        'formula-injection fixture lines:',
        ...formulaLines,
      ].join('\n');

      fs.writeFileSync(FINDINGS_TXT, `${report}\n`);
      expect(formulaLines.length, 'formula fixture rows present in the tab CSV').toBeGreaterThan(0);
      expect(fs.existsSync(FINDINGS_TXT), 'formula findings report written').toBe(true);
      console.warn(report);

      await renderTextToPage(page, report, 'configmap.csv (step 4: formula injection)');
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, 'scenario-04-formula-injection-csv-content.png'),
        fullPage: true,
      });
    });
  });

  test('scenario 2: selection Export As... CSV exports exactly two rows', async ({ page }) => {
    const configMapsPage = new ConfigMapsPagePo(page);

    await configMapsPage.goTo();
    await configMapsPage.waitForPage();

    const table = configMapsPage.list().resourceTable().sortableTable();

    await expect(table.rowWithName(CONFIG_MAPS.standard).self()).toBeVisible();
    await table.rowWithName(CONFIG_MAPS.standard).checkbox().check();
    await table.rowWithName(CONFIG_MAPS.quoted).checkbox().check();

    // Selection bar: the "N Selected" button opens the actions menu that holds Export As...
    await page.getByRole('button', { name: /\d+ Selected/ }).click();

    const exportItem = page.getByRole('menuitem', { name: 'Export As...' });

    await expect(exportItem).toBeVisible();
    await exportItem.click();

    const modal = page.getByTestId('table-views-export-modal');

    await expect(modal).toBeVisible();
    await modal.getByRole('radio', { name: 'CSV' }).check();
    await expect(modal.getByRole('radio', { name: 'CSV' })).toBeChecked();

    // Capture while the modal is still open with CSV selected and Download visible
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-02-selection-export-csv-download.png'),
      fullPage: false,
    });

    const downloadPromise = page.waitForEvent('download');

    await page.getByTestId('table-views-export-download').click();

    const download = await downloadPromise;

    await download.saveAs(SELECTION_CSV);

    const text = fs.readFileSync(SELECTION_CSV, 'utf8');
    const records = countCsvRecords(text);

    // One header record plus exactly the two selected data rows
    expect(records, 'selection CSV record count (header + data)').toBe(3);
    expect(text, 'selection CSV contains the standard ConfigMap').toContain(CONFIG_MAPS.standard);
    expect(text, 'selection CSV contains the quoted ConfigMap').toContain(CONFIG_MAPS.quoted);
    expect(text, 'selection CSV excludes the formula ConfigMap').not.toContain(CONFIG_MAPS.formula);
    expect(text, 'selection CSV excludes the unicode ConfigMap').not.toContain(CONFIG_MAPS.unicode);
  });
});
