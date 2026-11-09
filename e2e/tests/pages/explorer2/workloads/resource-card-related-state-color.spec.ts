import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceCardPo from '@/e2e/po/components/resource-card.po';
import StateBadgePo from '@/e2e/po/components/state-badge.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { hexDistance, sampleElementPixel } from '@/support/utils/pixel-sampler';
import { LONG } from '@/support/timeouts';

// Deployment that exists on every Rancher install (also: cattle-cluster-agent, rancher-webhook)
const NAMESPACE = 'cattle-system';
const DEPLOYMENT = 'rancher';

test.describe('Resource card related state color', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('should render the card state dot and the related resource state badge in the same color', async ({ page }) => {
    const detailPage = new PagePo(page, `/c/local/explorer/apps.deployment/${NAMESPACE}/${DEPLOYMENT}`);

    await detailPage.goTo();
    await new WelcomeDialogPo(page).dismissIfVisible();

    // State dot in the resource card
    const stateDot = new ResourceCardPo(page).firstStateDot();

    await expect(stateDot).toBeVisible({ timeout: LONG });

    // Related resources: Services tab
    const tabbed = new TabbedPo(page);

    await tabbed.tab('services').click();

    const stateBadge = new StateBadgePo(page, tabbed.panel('services')).firstBadge();

    await expect(stateBadge).toBeVisible({ timeout: LONG });

    // Sample the real rendered pixels (both are expected to be present, non-transparent)
    const dotSample = await sampleElementPixel(stateDot);
    const badgeSample = await sampleElementPixel(stateBadge);

    expect(dotSample.center.alpha).toBeGreaterThan(0);
    expect(badgeSample.accent.alpha).toBeGreaterThan(0);

    // The card dot is a solid fill, so its colour is the centre pixel. The related
    // resource badge paints the state colour as text over a 10% tint, so its colour
    // is the accent (text) pixel. Accent-sampling the dot would pick the anti-aliased
    // rim instead of the fill and compare white against green.
    const delta = hexDistance(dotSample.center.hex, badgeSample.accent.hex);
    const colors =
      `dot fill ${dotSample.center.hex} (css ${dotSample.cssBackgroundColor}) ` +
      `vs services badge text ${badgeSample.accent.hex} (css ${badgeSample.cssColor}), delta ${delta}`;

    test.info().annotations.push({ type: 'state-colors', description: colors });

    expect(delta, `state dot ${dotSample.center.hex} vs state badge ${badgeSample.accent.hex}`).toBe(0);
  });
});
