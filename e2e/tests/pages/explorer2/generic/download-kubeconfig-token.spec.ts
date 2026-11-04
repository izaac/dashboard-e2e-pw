import fs from 'fs';
import path from 'path';
import { type Page, type Response } from '@playwright/test';
import yamlLib from 'js-yaml';
import { test, expect } from '@/support/fixtures';
import { HeaderPo } from '@/e2e/po/components/header.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-19289-download-kubeconfig-single-token-evidence';
const DOWNLOAD_DIR = '/tmp/opencode';
const DOWNLOADED_KUBECONFIG = path.join(DOWNLOAD_DIR, 'downloaded-kubeconfig.yaml');
const KUBECONFIG_ENDPOINT = '/v1/ext.cattle.io.kubeconfigs';

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

/** Open the local cluster explorer and clear the Prime welcome dialog that can overlay the header */
async function openExplorer(page: Page): Promise<void> {
  await page.goto('./c/local/explorer');
  await expect(new HeaderPo(page).downloadKubeconfig()).toBeVisible();
  await new WelcomeDialogPo(page).dismissIfVisible();
}

/** Click the header "Download Kubeconfig" button and wait for both the kubeconfig POST and the file download */
async function downloadKubeconfig(page: Page): Promise<Response> {
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes(KUBECONFIG_ENDPOINT) && resp.request().method() === 'POST',
  );
  const downloadPromise = page.waitForEvent('download');

  await new HeaderPo(page).downloadKubeconfig().click();

  const response = await responsePromise;
  const download = await downloadPromise;

  await download.saveAs(DOWNLOADED_KUBECONFIG);

  return response;
}

test.describe('Download Kubeconfig Generates Single Token (#19289)', { tag: ['@generic', '@adminUser'] }, () => {
  // Ids of tokens minted by a test, removed afterwards so the run is idempotent
  let createdTokenIds: string[] = [];
  let baselineTokenIds: string[] = [];

  test.beforeEach(async ({ login, rancherApi }) => {
    await login();

    const tokens = await rancherApi.getRancherResource('v1', 'ext.cattle.io.tokens');

    baselineTokenIds = tokens.body.data.map((t: { id: string }) => t.id);
    createdTokenIds = [];
  });

  test.afterEach(async ({ rancherApi }) => {
    const tokens = await rancherApi.getRancherResource('v1', 'ext.cattle.io.tokens');
    const leftovers = tokens.body.data.map((t: { id: string }) => t.id).filter((id: string) => !baselineTokenIds.includes(id));

    for (const id of [...createdTokenIds, ...leftovers]) {
      await rancherApi.deleteRancherResource('v1', 'ext.cattle.io.tokens', id, false);
    }
  });

  test('Download Kubeconfig dispatches includeDefaultEntry false and mints a single token', async ({ page, rancherApi }) => {
    await openExplorer(page);

    const response = await downloadKubeconfig(page);

    expect(response.status()).toBe(201);

    const postData = response.request().postDataJSON();

    expect(postData?.spec?.includeDefaultEntry).toBe(false);

    const tokensAfter = await rancherApi.getRancherResource('v1', 'ext.cattle.io.tokens');
    const newIds = tokensAfter.body.data.map((t: { id: string }) => t.id).filter((id: string) => !baselineTokenIds.includes(id));

    createdTokenIds.push(...newIds);

    expect(tokensAfter.body.data.length - baselineTokenIds.length).toBe(1);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-01-single-token-generation.png') });
  });

  test('Downloaded kubeconfig contains no default rancher cluster or user', async ({ page }) => {
    await openExplorer(page);

    const response = await downloadKubeconfig(page);

    expect(response.status()).toBe(201);

    const yaml = fs.readFileSync(DOWNLOADED_KUBECONFIG, 'utf8');

    // Literal forms requested by the plan (Rancher emits quoted values, so these only guard the unquoted shape)
    expect(yaml).not.toContain('name: rancher');
    expect(yaml).not.toContain('cluster: rancher');
    expect(yaml).not.toContain('user: rancher');

    // Structural checks: the only cluster entry is the target cluster, no default 'rancher' cluster entry
    const parsed = yamlLib.load(yaml) as { clusters: { name: string }[]; contexts: { name: string; context: { cluster: string } }[]; users: unknown[] };
    const clusterNames = parsed.clusters.map((c) => c.name);

    expect(clusterNames).toEqual(['local']);
    expect(clusterNames).not.toContain('rancher');
    expect(parsed.contexts.map((c) => c.context.cluster)).not.toContain('rancher');
    expect(parsed.users).toHaveLength(1);
    expect(yaml).toContain('/k8s/clusters/local');

    // Render the YAML content in the page so the evidence screenshot shows what was downloaded
    await page.evaluate((content) => {
      const pre = document.createElement('pre');

      pre.id = 'qa-kubeconfig-evidence';
      pre.style.cssText = 'position:fixed;inset:40px;z-index:99999;background:#fff;color:#000;padding:16px;overflow:auto;font-size:12px;';
      pre.textContent = content.replace(/(token:\s*).+/g, '$1<redacted>').replace(/(certificate-authority-data:\s*).+/g, '$1<redacted>');
      document.body.appendChild(pre);
    }, yaml);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-02-downloaded-kubeconfig-yaml-content.png') });
  });

  test('Copy Kubeconfig sends the same includeDefaultEntry false payload', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openExplorer(page);

    const header = new HeaderPo(page);

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes(KUBECONFIG_ENDPOINT) && resp.request().method() === 'POST',
    );

    await header.copyKubeconfig().click();

    const response = await responsePromise;

    expect(response.status()).toBe(201);
    expect(response.request().postDataJSON()?.spec?.includeDefaultEntry).toBe(false);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-03-copy-kubeconfig-payload.png') });
  });
});
