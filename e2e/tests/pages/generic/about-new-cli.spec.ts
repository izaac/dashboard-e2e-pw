import fs from 'fs';
import path from 'path';
import { test, expect } from '@/support/fixtures';
import AboutPagePo from '@/e2e/po/pages/about.po';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-19704-about-page-new-cli-info-evidence';

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

test.describe('About Page New CLI Section (#19704)', { tag: ['@generic', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('shows New CLI section with New badge and legacy rename', async ({ page }) => {
    const aboutPage = new AboutPagePo(page);

    await aboutPage.goTo();
    await aboutPage.waitForPage();

    await expect(page.getByText('Rancher CLI (legacy)')).toBeVisible();
    await expect(page.getByText(/deprecat/i).first()).toBeVisible();

    const newHeading = page.getByText('New Rancher CLI (AI & Agent Edition)');

    await expect(newHeading).toBeVisible();
    await expect(aboutPage.newBadge()).toBeVisible();
    await expect(
      page.getByText('The intelligent CLI built for AI, AI agents and autonomous Kubernetes.'),
    ).toBeVisible();

    await aboutPage.newBadge().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-01-about-page-new-cli-section.png'),
      fullPage: true,
    });
  });

  test('GitHub link targets rancher/rancher-cli and opens in a new tab', async ({ page }) => {
    const aboutPage = new AboutPagePo(page);

    await aboutPage.goTo();
    await aboutPage.waitForPage();

    const link = page.getByTestId('about__new_cli_github_link');

    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://github.com/rancher/rancher-cli');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toContainText('View on GitHub (rancher/rancher-cli)');

    await link.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-02-new-cli-github-link.png'),
      fullPage: true,
    });
  });
});
