import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreateRke2CustomPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-custom.po';

/**
 * Regression coverage for rancher/dashboard issue 17267.
 *
 * On the RKE2 cluster creation form, changing the Kubernetes version must not
 * clear the default Ingress Controller (Traefik) port values. Selecting a
 * version invalidates and refetches the addon chart cache that the port
 * defaults are read from; after the refetch the ports must repopulate rather
 * than stay blank.
 *
 * This is a form-only check: it never submits the create request, so it
 * provisions nothing and needs no cleanup or cloud credentials.
 */
test.describe(
  'RKE2 ingress default ports survive a Kubernetes version switch',
  { tag: ['@manager', '@adminUser'] },
  () => {
    test.beforeEach(async ({ login }) => {
      await login();
    });

    test('Traefik default ports stay populated when changing the RKE2 Kubernetes version', async ({ page }) => {
      const clusterList = new ClusterManagerListPagePo(page);
      const createPage = new ClusterManagerCreateRke2CustomPagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();

      await expect(page).toHaveURL(/provisioning\.cattle\.io\.cluster\/create/);
      await createPage.selectCustom(0);

      const basics = createPage.basicsTab();
      const versions = basics.kubernetesVersions();

      // Baseline: the default RKE2 version shows non-empty Traefik ports.
      await expect(basics.traefikHttpInput()).toBeVisible();
      await expect(basics.traefikHttpInput()).not.toHaveValue('');
      await expect(basics.traefikHttpsInput()).not.toHaveValue('');

      // Collect the RKE2 versions on offer. The '+rke2' suffix excludes the group
      // header and any k3s entries. Two are needed to exercise a version switch.
      await versions.dropdown().click();
      await expect(versions.getOptions().first()).toBeVisible();
      const rke2Versions = (await versions.getOptions().allInnerTexts())
        .map((t) => t.trim())
        .filter((t) => t.includes('+rke2'));

      test.skip(rke2Versions.length < 2, 'Need at least two RKE2 Kubernetes versions to switch between');

      const [newest, older] = rke2Versions;

      // Switch to an older RKE2 version; ports must repopulate after the refetch.
      await versions.clickOptionWithLabel(older);
      await expect(basics.traefikHttpInput()).not.toHaveValue('');
      await expect(basics.traefikHttpsInput()).not.toHaveValue('');

      // Switch back to the newest RKE2 version; ports must again be present.
      await versions.dropdown().click();
      await versions.clickOptionWithLabel(newest);
      await expect(basics.traefikHttpInput()).not.toHaveValue('');
      await expect(basics.traefikHttpsInput()).not.toHaveValue('');
    });
  },
);
