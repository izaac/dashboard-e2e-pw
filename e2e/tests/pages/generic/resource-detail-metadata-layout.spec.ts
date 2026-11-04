import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailMetadataPo from '@/e2e/po/detail/resource-detail-metadata.po';

test.describe('Resource detail metadata layout (#16735)', { tag: ['@adminUser', '@generic'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  // The `server-url` setting is a cluster-scoped management resource with
  // `showAge: false`, so its identifying information is empty and the
  // identifying-info column must not render (fix in PR #19001).
  test('does not render the identifying information column when there is no identifying information', async ({
    page,
  }) => {
    const detailPage = new PagePo(page, '/c/local/settings/management.cattle.io.setting/server-url');
    const metadata = new ResourceDetailMetadataPo(page);

    await detailPage.goTo();
    await detailPage.waitForPage();

    await expect(metadata.self()).toBeVisible();
    await expect(metadata.identifyingInfo()).not.toBeAttached();
  });

  // With the empty column removed, the labels and annotations block occupies
  // the first grid column, starting at the left edge of the grid.
  test('renders the labels and annotations block as the first column when there is no identifying information', async ({
    page,
  }) => {
    const detailPage = new PagePo(page, '/c/local/settings/management.cattle.io.setting/server-url');
    const metadata = new ResourceDetailMetadataPo(page);

    await detailPage.goTo();
    await detailPage.waitForPage();

    await expect(metadata.self()).toBeVisible();
    await expect(metadata.firstColumn()).toHaveClass(/labels-and-annotations-empty/);

    const rowBox = await metadata.self().boundingBox();
    const firstBox = await metadata.firstColumn().boundingBox();

    expect(rowBox).not.toBeNull();
    expect(firstBox).not.toBeNull();
    expect(firstBox!.x - rowBox!.x).toBeLessThanOrEqual(1);
  });
});
