import { test, expect } from '@/support/fixtures';
import { execInPod } from '@/support/utils/pod-exec';

const podImage = 'nginx:stable-alpine3.20-perl';

test.describe('Pod management and WebSocket interaction', { tag: ['@jenkins', '@adminUser'] }, () => {
  test('should create a pod and manage folders via WebSocket exec', async ({ rancherApi, envMeta }) => {
    const nsName = `e2e-ws-ns-${Date.now()}`;
    const podName = `e2e-ws-pod-${Date.now()}`;
    const tokenDesc = `e2e-ws-token-${Date.now()}`;
    let tokenId: string | undefined;

    await rancherApi.createNamespace(nsName);

    try {
      const tokenResp = await rancherApi.createToken(tokenDesc);
      const bearerToken = tokenResp.body.token;

      tokenId = tokenResp.body.id;

      await rancherApi.createPod(nsName, podName, podImage);

      // Wait for container ready — phase Running + container ready
      const ready = await rancherApi.waitForRancherResource(
        'v1',
        'pods',
        '',
        (resp) => {
          const pod = resp.body?.data?.find((p: any) => p.id === `${nsName}/${podName}`);

          return pod?.status?.phase === 'Running' && pod?.status?.containerStatuses?.[0]?.ready === true;
        },
        30,
        2000,
      );

      expect(ready).toBe(true);

      // Create a directory
      const mkdirOutput = await execInPod(
        envMeta.api,
        nsName,
        podName,
        'container-0',
        'mkdir test-directory && echo "Directory created successfully"',
        bearerToken,
      );

      expect(mkdirOutput.some((msg) => msg.includes('Directory created successfully'))).toBe(true);

      // Verify directory exists
      const lsOutput = await execInPod(envMeta.api, nsName, podName, 'container-0', 'ls', bearerToken);

      expect(lsOutput.some((msg) => msg.includes('test-directory'))).toBe(true);

      // Delete the directory
      const rmOutput = await execInPod(
        envMeta.api,
        nsName,
        podName,
        'container-0',
        'rm -rf test-directory && echo "Directory deleted successfully"',
        bearerToken,
      );

      expect(rmOutput.some((msg) => msg.includes('Directory deleted successfully'))).toBe(true);
    } finally {
      await Promise.allSettled([
        tokenId ? rancherApi.deleteRancherResource('v3', 'tokens', tokenId, false) : Promise.resolve(),
        rancherApi.deleteRancherResource('v1', 'namespaces', nsName, false),
      ]);
    }
  });
});
