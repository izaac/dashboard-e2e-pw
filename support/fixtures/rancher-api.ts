import { expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import type { CreateUserParams, CreateResourceNameOptions } from '@/globals';

const MEDIUM_API_DELAY = 500;

/**
 * Rancher API helper — replaces all Cypress custom commands that do cy.request().
 * Injected into tests via Playwright fixture.
 */
export class RancherApi {
  private request: APIRequestContext;
  private apiUrl: string;
  private csrfToken: string;
  private csrfCookie: string;
  private runTimestamp: number;

  constructor(request: APIRequestContext, apiUrl: string, csrfToken = '') {
    this.request = request;
    this.apiUrl = apiUrl;
    this.csrfToken = csrfToken;
    this.csrfCookie = '';
    this.runTimestamp = Date.now();
  }

  setCsrfToken(token: string) {
    this.csrfToken = token;
  }

  /** Authenticate via API and store the token for subsequent requests */
  async login(username: string, password: string): Promise<void> {
    // Step 1: Native fetch for login — avoids CSRF cookie conflicts from Playwright's cookie jar
    const resp = await fetch(`${this.apiUrl}/v3-public/localProviders/local?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password, responseType: 'json' }),
    });

    const body = await resp.json().catch(() => ({}));

    if (!body.token) {
      console.error(`[RancherApi] Login failed: status=${resp.status} body=${JSON.stringify(body).substring(0, 200)}`);

      return;
    }

    this.csrfToken = body.token;

    // Step 2: Make a GET via the Playwright request context to pick up the CSRF cookie
    await this.request.get(`${this.apiUrl}/v3/settings/server-version`, {
      headers: { Authorization: `Bearer ${this.csrfToken}`, Accept: 'application/json' },
      ignoreHTTPSErrors: true,
    });

    const state = await this.request.storageState();
    const csrf = state.cookies?.find((c: any) => c.name === 'CSRF');

    if (csrf) {
      this.csrfCookie = csrf.value;
    }
  }

  private headers() {
    const h: Record<string, string> = { Accept: 'application/json' };

    if (this.csrfToken) {
      h['Authorization'] = `Bearer ${this.csrfToken}`;
    }
    if (this.csrfCookie) {
      h['x-api-csrf'] = this.csrfCookie;
    }

    return h;
  }

  /** Common request options — headers + ignoreHTTPSErrors */
  private opts(extra: Record<string, any> = {}) {
    return { headers: this.headers(), ignoreHTTPSErrors: true, ...extra };
  }

  /** Generate a unique E2E resource name */
  rootE2EResourceName(): string {
    return `e2e-test-${this.runTimestamp}`;
  }

  createE2EResourceName(context: string, options?: CreateResourceNameOptions): string {
    if (options?.onlyContext) {
      return context;
    }

    const root = this.rootE2EResourceName();

    return options?.prefixContext ? `${context}-${root}` : `${root}-${context}`;
  }

  /** Generic CRUD operations */
  async getRancherResource(prefix: string, resourceType: string, resourceId?: string, expectedStatusCode = 200) {
    let url = `${this.apiUrl}/${prefix}/${resourceType}`;

    if (resourceId) {
      url += `/${resourceId}`;
    }

    let method: 'GET' | 'POST' = 'GET';
    let body: any;

    if (resourceType === 'ext.cattle.io.selfuser') {
      method = 'POST';
      body = {};
      expectedStatusCode = 201;
    }

    const resp = await this.request.fetch(url, {
      method,
      ...this.opts({ data: body }),
    });

    if (expectedStatusCode) {
      expect(resp.status()).toBe(expectedStatusCode);
    }

    const json = await resp.json().catch(() => ({}));

    return { status: resp.status(), body: json };
  }

  async createRancherResource(prefix: string, resourceType: string, body: any, failOnStatusCode = true) {
    const resp = await this.request.post(`${this.apiUrl}/${prefix}/${resourceType}`, {
      ...this.opts({ data: body }),
    });

    if (failOnStatusCode) {
      expect([200, 201]).toContain(resp.status());
    }

    return { status: resp.status(), body: await resp.json() };
  }

  async setRancherResource(prefix: string, resourceType: string, resourceId: string, body: any) {
    const resp = await this.request.put(`${this.apiUrl}/${prefix}/${resourceType}/${resourceId}`, {
      ...this.opts({ data: body }),
    });

    expect(resp.status()).toBe(200);

    return { status: resp.status(), body: await resp.json() };
  }

  async deleteRancherResource(prefix: string, resourceType: string, resourceId: string, failOnStatusCode = true) {
    const resp = await this.request.delete(`${this.apiUrl}/${prefix}/${resourceType}/${resourceId}`, {
      ...this.opts(),
    });

    if (failOnStatusCode) {
      expect([200, 204]).toContain(resp.status());
    }
  }

  /** Wait for a resource to match a condition (polling) */
  async waitForRancherResource(
    prefix: string,
    resourceType: string,
    resourceId: string,
    testFn: (resp: any) => boolean,
    retries = 20,
    delayMs = 1500,
  ): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.getRancherResource(prefix, resourceType, resourceId, 0);

        if (testFn(result)) {
          return true;
        }
      } catch {
        // ignore fetch errors during polling
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }

    return false;
  }

  async waitForRancherResources(prefix: string, resourceType: string, expectedTotal: number, greaterThan = false) {
    for (let i = 0; i < 20; i++) {
      const result = await this.getRancherResource(prefix, resourceType);

      if (greaterThan ? result.body.count > expectedTotal : result.body.count === expectedTotal) {
        return result;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    return null;
  }

  async waitForRepositoryDownload(prefix: string, resourceType: string, resourceId: string, retries = 20) {
    return this.waitForRancherResource(
      prefix,
      resourceType,
      resourceId,
      (resp) => {
        const conditions = resp.body.status?.conditions || [];

        return conditions.some((c: any) => c.type === 'Downloaded' && c.status === 'True');
      },
      retries,
    );
  }

  async waitForResourceState(prefix: string, resourceType: string, resourceId: string, state = 'active', retries = 20) {
    return this.waitForRancherResource(
      prefix,
      resourceType,
      resourceId,
      (resp) => {
        const s = resp.body.metadata?.state;

        return s && s.transitioning === false && s.name === state;
      },
      retries,
    );
  }

  /** User management */
  async createUser(params: CreateUserParams, options?: { createNameOptions?: CreateResourceNameOptions }) {
    const { username, globalRole, clusterRole, projectRole, password } = params;
    const e2eName = this.createE2EResourceName(username, options?.createNameOptions);

    const userResp = await this.createRancherResource('v1', 'management.cattle.io.users', {
      type: 'user',
      enabled: true,
      mustChangePassword: false,
      username: e2eName,
    });

    expect(userResp.status).toBe(201);

    await new Promise((r) => setTimeout(r, 200));

    const userData = await this.getRancherResource('v1', 'management.cattle.io.users', userResp.body.id);
    const userPrincipalId = userData.body.principalIds[0];

    await this.createUserPasswordAsSecret(userResp.body.id, password || '');

    if (globalRole) {
      await this.setGlobalRoleBinding(userResp.body.id, globalRole.role);
    }
    if (clusterRole) {
      await this.setClusterRoleBinding(clusterRole.clusterId, userPrincipalId, clusterRole.role);
    }
    if (projectRole) {
      await this.setProjectRoleBinding(
        projectRole.clusterId,
        userPrincipalId,
        projectRole.projectName,
        projectRole.role,
      );
    }

    return userResp;
  }

  async createUserPasswordAsSecret(userId: string, password: string) {
    const resp = await this.request.post(`${this.apiUrl}/v1/secrets`, {
      headers: this.headers(),
      data: {
        type: 'secret',
        metadata: { namespace: 'cattle-local-user-passwords', name: userId },
        data: { password: Buffer.from(password).toString('base64') },
      },
    });

    expect(resp.status()).toBe(201);
  }

  async setGlobalRoleBinding(userId: string, role: string) {
    const resp = await this.request.post(`${this.apiUrl}/v3/globalrolebindings`, {
      headers: this.headers(),
      data: { type: 'globalRoleBinding', globalRoleId: role, userId },
    });

    expect(resp.status()).toBe(201);
  }

  async setClusterRoleBinding(clusterId: string, userPrincipalId: string, role: string) {
    const resp = await this.request.post(`${this.apiUrl}/v3/clusterroletemplatebindings`, {
      headers: this.headers(),
      data: {
        type: 'clusterRoleTemplateBinding',
        clusterId,
        roleTemplateId: role,
        userPrincipalId,
      },
    });

    expect(resp.status()).toBe(201);
  }

  async setProjectRoleBinding(clusterId: string, userPrincipalId: string, projectName: string, role: string) {
    const project = await this.getProjectByName(clusterId, projectName);

    const resp = await this.request.post(`${this.apiUrl}/v3/projectroletemplatebindings`, {
      headers: this.headers(),
      data: {
        type: 'projectroletemplatebinding',
        roleTemplateId: role,
        userPrincipalId,
        projectId: project.id,
      },
    });

    expect(resp.status()).toBe(201);
  }

  async getProjectByName(clusterId: string, projectName: string) {
    const resp = await this.request.get(`${this.apiUrl}/v3/projects?name=${projectName}&clusterId=${clusterId}`, {
      headers: this.headers(),
    });

    expect(resp.status()).toBe(200);
    const body = await resp.json();

    expect(body.data.length).toBe(1);

    return body.data[0];
  }

  /** Namespace / Pod / Resource shortcuts */
  async createNamespace(nsName: string) {
    return this.createRancherResource('v1', 'namespaces', {
      type: 'namespace',
      metadata: {
        annotations: { 'field.cattle.io/containerDefaultResourceLimit': '{}' },
        name: nsName,
      },
      disableOpenApiValidation: false,
    });
  }

  async createPod(nsName: string, podName: string, image: string, failOnStatusCode = true) {
    return this.createRancherResource(
      'v1',
      'pods',
      {
        type: 'pod',
        metadata: {
          namespace: nsName,
          labels: { 'workload.user.cattle.io/workloadselector': podName },
          name: podName,
        },
        spec: {
          containers: [
            {
              imagePullPolicy: 'Always',
              name: 'container-0',
              image,
            },
          ],
        },
      },
      failOnStatusCode,
    );
  }

  async createToken(description: string, ttl = 3600000, failOnStatusCode = true, clusterId?: string) {
    return this.createRancherResource(
      'v3',
      'tokens',
      {
        type: 'token',
        metadata: {},
        description,
        clusterId,
        ttl,
      },
      failOnStatusCode,
    );
  }

  async deleteNamespace(namespaces: string[]) {
    for (const ns of namespaces) {
      await this.deleteRancherResource('v1', 'namespaces', ns);
      await this.waitForRancherResource('v1', 'namespaces', ns, (resp) => resp.status === 404, 20, 1000);
    }
  }

  async getClusterIdByName(clusterName: string): Promise<string> {
    const result = await this.getRancherResource('v3', 'clusters');
    const cluster = result.body.data.find((item: any) => item.name === clusterName);

    if (!cluster) {
      throw new Error(`Cluster '${clusterName}' not found`);
    }

    return cluster.id;
  }

  async getRancherVersion() {
    const resp = await this.request.get(`${this.apiUrl}/rancherversion`, {
      ...this.opts(),
    });

    expect(resp.status()).toBe(200);

    return resp.json();
  }

  async getKubernetesReleases(rkeType: 'rke2' | 'k3s') {
    return this.getRancherResource(`v1-${rkeType}-release`, 'releases');
  }

  /** User preferences */
  async setUserPreference(prefs: Record<string, any>) {
    const result = await this.getRancherResource('v1', 'userpreferences');
    const update = result.body.data[0];

    update.data = { ...update.data, ...prefs };
    delete update.links;

    return this.setRancherResource('v1', 'userpreferences', update.id, update);
  }

  async applyDefaultTestTheme() {
    await this.setRancherResource('v3', 'settings', 'ui-brand', { value: 'modern' });
    await this.setUserPreference({ theme: 'ui-light' });
  }

  async restoreProductDefaultTestTheme() {
    const version = await this.getRancherVersion();
    const uiBrand = version.RancherPrime === 'true' ? 'suse' : 'modern';

    await this.setRancherResource('v3', 'settings', 'ui-brand', { value: uiBrand });
    await this.setUserPreference({ theme: '' });
  }

  async createSecret(namespace: string, name: string, options: { type?: string; metadata?: any; data?: any } = {}) {
    const defaultData = {
      'tls.crt': Buffer.from('MOCKCERT').toString('base64'),
      'tls.key': Buffer.from('MOCKPRIVATEKEY').toString('base64'),
    };

    return this.createRancherResource('v1', 'secrets', {
      type: options.type || 'kubernetes.io/tls',
      metadata: { namespace, name, ...(options.metadata || {}) },
      data: options.data || defaultData,
    });
  }

  async createConfigMap(namespace: string, name: string, options: { metadata?: any; data?: any } = {}) {
    return this.createRancherResource('v1', 'configmaps', {
      metadata: { namespace, name, ...(options.metadata || {}) },
      data: options.data || { foo: 'bar' },
    });
  }

  async createService(
    namespace: string,
    name: string,
    options: { type?: string; ports?: any[]; spec?: any; metadata?: any } = {},
  ) {
    const defaultSpec = {
      ports: options.ports || [{ name: 'myport', port: 8080, protocol: 'TCP', targetPort: 80 }],
      sessionAffinity: 'None',
      type: options.type || 'ClusterIP',
    };

    return this.createRancherResource('v1', 'services', {
      type: 'service',
      metadata: { namespace, name, ...(options.metadata || {}) },
      spec: options.spec || defaultSpec,
    });
  }

  async fetchRevision(): Promise<string> {
    const result = await this.getRancherResource('v1', 'management.cattle.io.settings');

    return result.body.revision;
  }

  async isVaiCacheEnabled(): Promise<boolean> {
    const result = await this.getRancherResource('v1', 'management.cattle.io.features', 'ui-sql-cache');

    if (result.body?.status?.lockedValue != null) {
      return result.body.status.lockedValue;
    }

    return result.body?.spec?.value ?? result.body?.status?.default;
  }
}
