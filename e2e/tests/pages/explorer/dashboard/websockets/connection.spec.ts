import { test, expect } from '@/support/fixtures';

const podImage = 'nginx:stable-alpine3.20-perl';

test.describe('Pod management and WebSocket interaction', { tag: ['@jenkins', '@adminUser'] }, () => {
  test('should create a new pod', async ({ rancherApi }) => {
    const selfUser = await rancherApi.getRancherResource('v1', 'ext.cattle.io.selfuser', undefined, 201);
    const userId = selfUser.body.status.userID;

    const nsName = `namespace${Date.now()}`;
    const projName = `project${Date.now()}`;

    const projResp = await rancherApi.createRancherResource('v3', 'projects', {
      type: 'project',
      name: projName,
      clusterId: 'local',
      members: [
        { type: 'projectRoleTemplateBinding', userPrincipalId: `local://${userId}`, roleTemplateId: 'project-owner' },
      ],
    });

    const projId = projResp.body.id;

    try {
      await rancherApi.createRancherResource('v1', 'namespaces', {
        type: 'namespace',
        metadata: {
          annotations: { 'field.cattle.io/projectId': projId },
          name: nsName,
        },
      });

      const podName = `e2e-ws-pod-${Date.now()}`;
      const podResp = await rancherApi.createPod(nsName, podName, podImage, false);

      expect(podResp.body.metadata.name).toBe(podName);

      const ready = await rancherApi.waitForRancherResource(
        'v1',
        'pods',
        '',
        (resp) => {
          const pod = resp.body?.data?.find((p: Record<string, string>) => p.id === `${nsName}/${podName}`);

          return pod?.status?.phase === 'Running';
        },
        15,
        2000,
      );

      expect(ready).toBe(true);
    } finally {
      await rancherApi.deleteRancherResource('v1', 'namespaces', nsName, false);
      await rancherApi.deleteRancherResource('v3', 'projects', projId, false);
    }
  });

  test.skip('should create a new folder via websocket', async () => {
    // WebSocket exec via page.evaluate does not reliably work with self-signed certs.
    // The upstream Cypress test uses a custom cy.setupWebSocket helper that bypasses TLS.
    // TODO: Implement a native WebSocket helper that handles TLS for Playwright.
  });

  test.skip('should validate the folder name', async () => {});

  test.skip('should delete the folder', async () => {});
});
