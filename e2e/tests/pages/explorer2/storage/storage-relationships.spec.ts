import { test, expect } from '@/support/fixtures';
import type { Page } from '@playwright/test';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import { PersistentVolumesPagePo, PersistentVolumeDetailPagePo } from '@/e2e/po/pages/explorer/persistent-volumes.po';
import { PersistentVolumeClaimDetailPagePo } from '@/e2e/po/pages/explorer/persistent-volume-claims.po';
import {
  WorkloadsDeploymentsListPagePo,
  WorkloadsDeploymentsDetailsPagePo,
} from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import {
  WorkloadsStatefulSetsListPagePo,
  WorkloadsStatefulSetsDetailsPagePo,
} from '@/e2e/po/pages/explorer/workloads-statefulsets.po';
import { SMALL_CONTAINER } from '@/e2e/tests/pages/explorer2/workloads/workload.utils';
import {
  setTablePreferences,
  restoreTablePreferences,
  type SavedPrefs,
} from '@/e2e/tests/pages/explorer2/workloads/pagination.utils';
import { EXTRA_LONG, LONG } from '@/support/timeouts';

const localCluster = 'local';

// No StorageClass objects back these, so claims only bind to a PV that is created for them
const BOUND_STORAGE_CLASS = 'e2e-manual';
const UNBOUND_STORAGE_CLASS = 'e2e-unbound';
const PENDING_STORAGE_CLASS = 'e2e-pending';

const container = (mountPath?: string, volumeName?: string) => ({
  name: 'container-0',
  image: SMALL_CONTAINER.image,
  volumeMounts: volumeName ? [{ name: volumeName, mountPath }] : [],
});

const persistentVolume = (name: string, storageClassName: string, claimRef?: { namespace: string; name: string }) => ({
  apiVersion: 'v1',
  kind: 'PersistentVolume',
  metadata: { name },
  spec: {
    capacity: { storage: '1Gi' },
    accessModes: ['ReadWriteOnce'],
    persistentVolumeReclaimPolicy: 'Retain',
    storageClassName,
    hostPath: { path: `/tmp/${name}`, type: 'DirectoryOrCreate' },
    ...(claimRef ? { claimRef } : {}),
  },
});

const claimSpec = (storageClassName: string, volumeName?: string) => ({
  accessModes: ['ReadWriteOnce'],
  resources: { requests: { storage: '1Gi' } },
  storageClassName,
  ...(volumeName ? { volumeName } : {}),
});

const persistentVolumeClaim = (namespace: string, name: string, storageClassName: string, volumeName?: string) => ({
  apiVersion: 'v1',
  kind: 'PersistentVolumeClaim',
  metadata: { name, namespace },
  spec: claimSpec(storageClassName, volumeName),
});

const deployment = (namespace: string, name: string, claimName?: string) => ({
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: { name, namespace },
  spec: {
    replicas: 1,
    selector: { matchLabels: { app: name } },
    template: {
      metadata: { labels: { app: name } },
      spec: {
        terminationGracePeriodSeconds: 0,
        containers: [claimName ? container('/data', 'data') : container()],
        volumes: claimName ? [{ name: 'data', persistentVolumeClaim: { claimName } }] : [],
      },
    },
  },
});

const pod = (namespace: string, name: string, claimName: string) => ({
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { name, namespace },
  spec: {
    terminationGracePeriodSeconds: 0,
    containers: [container('/data', 'data')],
    volumes: [{ name: 'data', persistentVolumeClaim: { claimName } }],
  },
});

const statefulSet = (namespace: string, name: string) => ({
  apiVersion: 'apps/v1',
  kind: 'StatefulSet',
  metadata: { name, namespace },
  spec: {
    replicas: 2,
    serviceName: name,
    podManagementPolicy: 'Parallel',
    selector: { matchLabels: { app: name } },
    template: {
      metadata: { labels: { app: name } },
      spec: {
        terminationGracePeriodSeconds: 0,
        containers: [container('/data', 'data')],
      },
    },
    volumeClaimTemplates: [{ metadata: { name: 'data' }, spec: claimSpec(PENDING_STORAGE_CLASS) }],
  },
});

/** Name of the first Pod in the namespace carrying the `app` label, or '' when there is none */
async function findPodNameWithApp(rancherApi: RancherApi, namespace: string, app: string): Promise<string> {
  const { body } = await rancherApi.getRancherResource('v1', 'pods', namespace, 0);
  const match = (body.data || []).find((p: any) => p.metadata?.labels?.app === app);

  return match?.metadata?.name ?? '';
}

async function scaleWorkload(rancherApi: RancherApi, resourceType: string, id: string, replicas: number) {
  const { body } = await rancherApi.getRancherResource('v1', resourceType, id);

  await rancherApi.updateRancherResource('v1', resourceType, id, { ...body, spec: { ...body.spec, replicas } });
}

test.describe('Storage relationships', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });

  let namespace: string;
  let otherNamespace: string;
  let boundVolumeName: string;
  let unboundVolumeName: string;
  let claimName: string;
  let deploymentName: string;
  let deploymentPodName: string;
  let noClaimDeploymentName: string;
  let otherNamespacePodName: string;
  let statefulSetName: string;
  let statefulSetClaimNames: string[];
  let savedPrefs: SavedPrefs | undefined;

  test.beforeAll(async ({ rancherApi }) => {
    test.setTimeout(EXTRA_LONG);

    namespace = rancherApi.createE2EResourceName('storage');
    otherNamespace = rancherApi.createE2EResourceName('storage-other');
    boundVolumeName = rancherApi.createE2EResourceName('bound-pv');
    unboundVolumeName = rancherApi.createE2EResourceName('unbound-pv');
    claimName = rancherApi.createE2EResourceName('claim');
    deploymentName = rancherApi.createE2EResourceName('pvc-deploy');
    noClaimDeploymentName = rancherApi.createE2EResourceName('no-pvc-deploy');
    otherNamespacePodName = rancherApi.createE2EResourceName('other-pod');
    statefulSetName = rancherApi.createE2EResourceName('sts');
    statefulSetClaimNames = [`data-${statefulSetName}-0`, `data-${statefulSetName}-1`];

    savedPrefs = await setTablePreferences(rancherApi, [namespace, otherNamespace]);

    await rancherApi.createNamespace(namespace);
    await rancherApi.createNamespace(otherNamespace);

    // Pre-bind the volume and claim to each other so binding doesn't depend on the PV controller's matching
    await rancherApi.createRancherResource(
      'v1',
      'persistentvolumes',
      persistentVolume(boundVolumeName, BOUND_STORAGE_CLASS, { namespace, name: claimName }),
    );
    await rancherApi.createRancherResource(
      'v1',
      'persistentvolumes',
      persistentVolume(unboundVolumeName, UNBOUND_STORAGE_CLASS),
    );
    await rancherApi.createRancherResource(
      'v1',
      'persistentvolumeclaims',
      persistentVolumeClaim(namespace, claimName, BOUND_STORAGE_CLASS, boundVolumeName),
    );
    // Same claim name in another namespace, which the claim's Pods tab must not pick up
    await rancherApi.createRancherResource(
      'v1',
      'persistentvolumeclaims',
      persistentVolumeClaim(otherNamespace, claimName, PENDING_STORAGE_CLASS),
    );

    await rancherApi.createRancherResource('v1', 'apps.deployments', deployment(namespace, deploymentName, claimName));
    await rancherApi.createRancherResource('v1', 'apps.deployments', deployment(namespace, noClaimDeploymentName));
    await rancherApi.createRancherResource('v1', 'pods', pod(otherNamespace, otherNamespacePodName, claimName));
    await rancherApi.createRancherResource('v1', 'apps.statefulsets', statefulSet(namespace, statefulSetName));

    await rancherApi.expectResourceState(
      'v1',
      'persistentvolumes',
      boundVolumeName,
      (resp) => resp.body?.status?.phase === 'Bound',
      30,
    );

    await expect
      .poll(
        async () => {
          deploymentPodName = await findPodNameWithApp(rancherApi, namespace, deploymentName);

          return deploymentPodName;
        },
        { timeout: EXTRA_LONG },
      )
      .toContain(deploymentName);

    await rancherApi.expectResourceState(
      'v1',
      'pods',
      `${otherNamespace}/${otherNamespacePodName}`,
      (resp) => resp.status === 200,
      30,
    );

    for (const name of statefulSetClaimNames) {
      await rancherApi.expectResourceState(
        'v1',
        'persistentvolumeclaims',
        `${namespace}/${name}`,
        (resp) => resp.status === 200,
        30,
      );
    }
  });

  test.afterAll(async ({ rancherApi }) => {
    test.setTimeout(EXTRA_LONG);

    try {
      if (namespace && otherNamespace) {
        await rancherApi.deleteNamespace([namespace, otherNamespace]);
      }
    } finally {
      try {
        // Cluster-scoped, so they outlive the namespaces and must be removed explicitly
        for (const volume of [boundVolumeName, unboundVolumeName]) {
          if (volume) {
            await rancherApi.deleteRancherResource('v1', 'persistentvolumes', volume, false);
          }
        }
      } finally {
        if (savedPrefs) {
          await restoreTablePreferences(rancherApi, savedPrefs);
        }
      }
    }
  });

  const navToVolumeDetail = async (page: Page, name: string) => {
    const volumesPage = new PersistentVolumesPagePo(page, localCluster);
    const volumeDetailPage = new PersistentVolumeDetailPagePo(page, name, localCluster);

    await volumesPage.goTo();
    await volumesPage.waitForPage();
    await volumesPage.goToDetailsPage(name);
    await volumeDetailPage.waitForPage();
    await expect(volumeDetailPage.mastheadTitle()).toContainText(name);

    return volumeDetailPage;
  };

  // The claim name is shared with a claim in another namespace, so reach it through the bound volume
  const navToClaimDetail = async (page: Page) => {
    const volumeDetailPage = await navToVolumeDetail(page, boundVolumeName);
    const claimDetailPage = new PersistentVolumeClaimDetailPagePo(page, namespace, claimName, localCluster);

    await volumeDetailPage.clickClaimsTab();
    await volumeDetailPage.claimsList().goToDetailsPage(claimName);
    await claimDetailPage.waitForPage();
    await expect(claimDetailPage.mastheadTitle()).toContainText(claimName);
    await claimDetailPage.clickPodsTab();

    return claimDetailPage;
  };

  const navToDeploymentDetail = async (page: Page, name: string) => {
    const deploymentsPage = new WorkloadsDeploymentsListPagePo(page, localCluster);
    const deploymentDetailPage = new WorkloadsDeploymentsDetailsPagePo(page, name, localCluster, namespace);

    await deploymentsPage.goTo();
    await deploymentsPage.waitForPage();
    await deploymentsPage.goToDetailsPage(name);
    await deploymentDetailPage.waitForPage();
    await expect(deploymentDetailPage.mastheadTitle()).toContainText(name);
    await deploymentDetailPage.clickStorageTab();

    return deploymentDetailPage;
  };

  const navToStatefulSetDetail = async (page: Page) => {
    const statefulSetsPage = new WorkloadsStatefulSetsListPagePo(page, localCluster);
    const statefulSetDetailPage = new WorkloadsStatefulSetsDetailsPagePo(
      page,
      statefulSetName,
      localCluster,
      namespace,
    );

    await statefulSetsPage.goTo();
    await statefulSetsPage.waitForPage();
    await statefulSetsPage.goToDetailsPage(statefulSetName);
    await statefulSetDetailPage.waitForPage();
    await expect(statefulSetDetailPage.mastheadTitle()).toContainText(statefulSetName);
    await statefulSetDetailPage.clickStorageTab();

    return statefulSetDetailPage;
  };

  test.describe('PersistentVolume detail', () => {
    test('shows the volume details in the masthead', async ({ page, login }) => {
      await login();
      const volumeDetailPage = await navToVolumeDetail(page, boundVolumeName);

      await expect(volumeDetailPage.mastheadDetail('source')).toContainText('HostPath');
      await expect(volumeDetailPage.mastheadDetail('capacity')).toContainText('1Gi');
      await expect(volumeDetailPage.mastheadDetail('reclaim-policy')).toContainText('Retain');
      await expect(volumeDetailPage.mastheadDetail('storage-class')).toContainText(BOUND_STORAGE_CLASS);
      await expect(volumeDetailPage.mastheadDetail('access-modes')).toContainText('ReadWriteOnce');
    });

    test('lists the bound claim in the Claims tab', async ({ page, login }) => {
      await login();
      const volumeDetailPage = await navToVolumeDetail(page, boundVolumeName);

      await volumeDetailPage.clickClaimsTab();

      const claimsTable = volumeDetailPage.claimsList().sortableTable();

      await expect(claimsTable.rowElements()).toHaveCount(1);
      await expect(claimsTable.rowElementWithName(claimName)).toBeVisible();
    });

    test('shows the empty state for a volume that is not bound', async ({ page, login }) => {
      await login();
      const volumeDetailPage = await navToVolumeDetail(page, unboundVolumeName);

      await volumeDetailPage.clickClaimsTab();
      await expect(volumeDetailPage.claimsEmptyCaption()).toHaveText(
        'This volume is not bound to a PersistentVolumeClaim.',
      );
    });
  });

  test.describe('PersistentVolumeClaim detail', () => {
    test('lists the pods that mount the claim, only from its own namespace', async ({ page, login }) => {
      await login();
      const claimDetailPage = await navToClaimDetail(page);
      const podsTable = claimDetailPage.podsList().sortableTable();

      await expect(podsTable.rowElements()).toHaveCount(1);
      await expect(podsTable.rowElementWithName(deploymentPodName)).toBeVisible();
      await expect(claimDetailPage.podsTabPanel()).not.toContainText(otherNamespacePodName);
    });

    test('shows the empty state once the deployment is scaled to 0', async ({ page, login, rancherApi }) => {
      await scaleWorkload(rancherApi, 'apps.deployments', `${namespace}/${deploymentName}`, 0);
      await expect
        .poll(() => findPodNameWithApp(rancherApi, namespace, deploymentName), { timeout: EXTRA_LONG })
        .toBe('');

      await login();
      const claimDetailPage = await navToClaimDetail(page);

      await expect(claimDetailPage.podsEmptyCaption()).toHaveText(
        'Could not find any Pods that mount this PersistentVolumeClaim.',
        { timeout: LONG },
      );
    });
  });

  test.describe('Workload Storage tab', () => {
    test('lists the claim mounted by a deployment and links to its detail page', async ({ page, login }) => {
      await login();
      const deploymentDetailPage = await navToDeploymentDetail(page, deploymentName);
      const claimDetailPage = new PersistentVolumeClaimDetailPagePo(page, namespace, claimName, localCluster);

      await expect(deploymentDetailPage.storageList().sortableTable().rowElements()).toHaveCount(1);
      await deploymentDetailPage.storageList().goToDetailsPage(claimName);
      await claimDetailPage.waitForPage();
      await expect(claimDetailPage.mastheadTitle()).toContainText(claimName);
    });

    test('shows the empty state for a deployment that mounts no claims', async ({ page, login }) => {
      await login();
      const deploymentDetailPage = await navToDeploymentDetail(page, noClaimDeploymentName);

      await expect(deploymentDetailPage.storageEmptyCaption()).toHaveText(
        'Could not find any PersistentVolumeClaims mounted by this workload.',
      );
    });

    test('lists the claims created from StatefulSet volumeClaimTemplates', async ({ page, login }) => {
      await login();
      const statefulSetDetailPage = await navToStatefulSetDetail(page);
      const storageTable = statefulSetDetailPage.storageList().sortableTable();

      await expect(storageTable.rowElements()).toHaveCount(statefulSetClaimNames.length);
      for (const name of statefulSetClaimNames) {
        await expect(storageTable.rowElementWithName(name)).toBeVisible();
      }
    });

    test('still lists the template claims after the StatefulSet is scaled to 0', async ({
      page,
      login,
      rancherApi,
    }) => {
      await scaleWorkload(rancherApi, 'apps.statefulsets', `${namespace}/${statefulSetName}`, 0);
      await expect
        .poll(() => findPodNameWithApp(rancherApi, namespace, statefulSetName), { timeout: EXTRA_LONG })
        .toBe('');

      await login();
      const statefulSetDetailPage = await navToStatefulSetDetail(page);
      const storageTable = statefulSetDetailPage.storageList().sortableTable();

      await expect(storageTable.rowElements()).toHaveCount(statefulSetClaimNames.length);
      for (const name of statefulSetClaimNames) {
        await expect(storageTable.rowElementWithName(name)).toBeVisible();
      }
    });
  });
});
