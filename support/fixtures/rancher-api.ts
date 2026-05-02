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
  private chartPresenceCache = new Map<string, 'available' | 'filtered' | 'catalog-error'>();
  private credentials?: { username: string; password: string };

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
    this.credentials = { username, password };

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

  /**
   * Pre-login health gate: verify Rancher API is responsive.
   * Retries with backoff to ride out transient instability from controller churn.
   */
  async waitForReady(): Promise<void> {
    if (!this.credentials) {
      return;
    }

    const { username, password } = this.credentials;
    const maxRetries = 5;
    const backoffMs = 10_000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const loginResp = await fetch(`${this.apiUrl}/v3-public/localProviders/local?action=login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, responseType: 'cookie' }),
          signal: AbortSignal.timeout(5_000),
        });

        if (!loginResp.ok) {
          throw new Error(`Login returned ${loginResp.status}`);
        }

        const cookie = loginResp.headers.getSetCookie?.().find((c) => c.startsWith('R_SESS='));

        if (!cookie) {
          throw new Error('No R_SESS cookie in login response');
        }

        const countsResp = await fetch(`${this.apiUrl}/v1/counts`, {
          headers: { Cookie: cookie.split(';')[0] },
          signal: AbortSignal.timeout(5_000),
        });

        if (!countsResp.ok) {
          throw new Error(`/v1/counts returned ${countsResp.status}`);
        }

        return;
      } catch (err) {
        if (attempt === maxRetries) {
          throw new Error(
            `Rancher API unresponsive after ${maxRetries} attempts (${(maxRetries * backoffMs) / 1000}s). ` +
              `Last error: ${err instanceof Error ? err.message : err}. ` +
              'Likely cause: controller churn from feature flag toggles or helm operations.',
          );
        }

        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  /**
   * Ensure standard_user exists with global 'user' role and project-member on local/Default.
   * Idempotent: skips if user already exists.
   */
  async ensureStandardUser(password: string): Promise<void> {
    try {
      const usersResp = await this.getRancherResource('v1', 'management.cattle.io.users');
      const existing = usersResp.body.data?.find((u: { username?: string }) => u.username === 'standard_user');

      if (existing) {
        return;
      }
    } catch {
      console.warn('[RancherApi] Could not list users, skipping standard_user ensure');

      return;
    }

    console.log('[RancherApi] Creating standard_user...');

    const userResp = await this.createRancherResource('v1', 'management.cattle.io.users', {
      type: 'user',
      enabled: true,
      mustChangePassword: false,
      username: 'standard_user',
    });

    const userId = userResp.body.id;

    await new Promise((r) => setTimeout(r, MEDIUM_API_DELAY));

    // Set password
    await this.createRancherResource('v1', 'secrets', {
      type: 'secret',
      metadata: { namespace: 'cattle-local-user-passwords', name: userId },
      data: { password: Buffer.from(password).toString('base64') },
    });

    // Global role binding: 'user'
    await this.request.post(`${this.apiUrl}/v3/globalrolebindings`, {
      ...this.opts({ data: { type: 'globalRoleBinding', globalRoleId: 'user', userId } }),
    });

    // Project role binding: project-member on local/Default
    const userData = await this.getRancherResource('v1', 'management.cattle.io.users', userId);
    const principalId = userData.body.principalIds?.[0];

    if (principalId) {
      try {
        const project = await this.getProjectByName('local', 'Default');

        await this.request.post(`${this.apiUrl}/v3/projectroletemplatebindings`, {
          ...this.opts({
            data: {
              type: 'projectroletemplatebinding',
              roleTemplateId: 'project-member',
              userPrincipalId: principalId,
              projectId: project.id,
            },
          }),
        });
      } catch {
        console.warn('[RancherApi] Could not set project role — Default project may not exist');
      }
    }

    console.log('[RancherApi] standard_user created');
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

  /**
   * Execute an API request with automatic re-auth on 401.
   * Worker-scoped tokens can expire mid-suite; this transparently refreshes once.
   */
  private async fetchWithReauth(fn: () => Promise<import('@playwright/test').APIResponse>) {
    const resp = await fn();

    if (resp.status() === 401 && this.credentials) {
      console.warn('[RancherApi] 401 received — re-authenticating...');
      await this.login(this.credentials.username, this.credentials.password);

      return fn();
    }

    return resp;
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

    const resp = await this.fetchWithReauth(() => this.request.fetch(url, { method, ...this.opts({ data: body }) }));

    if (expectedStatusCode) {
      expect(resp.status()).toBe(expectedStatusCode);
    }

    const json = await resp.json().catch(() => ({}));

    return { status: resp.status(), body: json };
  }

  async createRancherResource(
    prefix: string,
    resourceType: string,
    body: any,
    failOnStatusCode = true,
    timeout?: number,
  ) {
    const extra: Record<string, any> = { data: body };

    if (timeout) {
      extra.timeout = timeout;
    }

    const resp = await this.fetchWithReauth(() =>
      this.request.post(`${this.apiUrl}/${prefix}/${resourceType}`, { ...this.opts(extra) }),
    );

    if (failOnStatusCode) {
      expect([200, 201]).toContain(resp.status());
    }

    return { status: resp.status(), body: await resp.json().catch(() => ({})) };
  }

  async setRancherResource(
    prefix: string,
    resourceType: string,
    resourceId: string,
    body: any,
    failOnStatusCode = true,
  ) {
    const resp = await this.fetchWithReauth(() =>
      this.request.put(`${this.apiUrl}/${prefix}/${resourceType}/${resourceId}`, { ...this.opts({ data: body }) }),
    );

    if (failOnStatusCode) {
      expect(resp.status()).toBe(200);
    }

    return { status: resp.status(), body: await resp.json().catch(() => ({})) };
  }

  async deleteRancherResource(prefix: string, resourceType: string, resourceId: string, failOnStatusCode = true) {
    const resp = await this.fetchWithReauth(() =>
      this.request.delete(`${this.apiUrl}/${prefix}/${resourceType}/${resourceId}`, { ...this.opts() }),
    );

    if (failOnStatusCode) {
      expect([200, 204]).toContain(resp.status());
    }
  }

  /**
   * Poll until a resource returns 404 (fully removed from the API).
   * Use after deleteRancherResource to ensure the controller has finished cleanup
   * before subsequent tests interact with the same resource type.
   */
  async waitForResourceGone(prefix: string, resourceType: string, resourceId: string, retries = 20, delayMs = 1500) {
    for (let i = 0; i < retries; i++) {
      const resp = await this.fetchWithReauth(() =>
        this.request.fetch(`${this.apiUrl}/${prefix}/${resourceType}/${resourceId}`, { method: 'GET', ...this.opts() }),
      );

      if (resp.status() === 404) {
        return true;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }

    return false;
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

  /**
   * Poll a newly-created cluster and fail early if it enters a sustained error state.
   *
   * During provisioning, clusters can briefly hiccup into an error state before recovering.
   * This method only throws if the error persists for `sustainedErrorMs` consecutive milliseconds,
   * avoiding false positives from transient blips.
   *
   * @param api - 'v3' for EKS/AKS/GKE clusters (uses transitioning field),
   *              'v1' for RKE2/K3s provisioning clusters (uses metadata.state)
   * @param clusterId - For v3: management cluster ID (e.g. 'c-xxxxx').
   *                    For v1: 'namespace/name' (e.g. 'fleet-default/my-cluster').
   * @param pollIntervalMs - How often to poll (default 10s)
   * @param maxPollMs - Total polling window (default 5 min)
   * @param sustainedErrorMs - How long error must persist before failing (default 2 min)
   */
  async assertClusterProvisioningNotStuck(
    api: 'v1' | 'v3',
    clusterId: string,
    {
      pollIntervalMs = 10_000,
      maxPollMs = 300_000,
      sustainedErrorMs = 120_000,
    }: { pollIntervalMs?: number; maxPollMs?: number; sustainedErrorMs?: number } = {},
  ): Promise<void> {
    const start = Date.now();
    let errorSince: number | null = null;
    let lastErrorMsg = '';

    while (Date.now() - start < maxPollMs) {
      try {
        const isError =
          api === 'v3' ? await this.isV3ClusterErrored(clusterId) : await this.isV1ClusterErrored(clusterId);

        if (isError.errored) {
          lastErrorMsg = isError.message;

          if (!errorSince) {
            errorSince = Date.now();
          } else if (Date.now() - errorSince >= sustainedErrorMs) {
            throw new Error(
              `Cluster ${clusterId} stuck in error state for ${Math.round((Date.now() - errorSince) / 1000)}s: ${lastErrorMsg}`,
            );
          }
        } else {
          // Error cleared — reset counter (transient hiccup)
          errorSince = null;
          lastErrorMsg = '';
        }
      } catch (e) {
        // Re-throw our own assertion errors, ignore fetch failures
        if (e instanceof Error && e.message.startsWith('Cluster ')) {
          throw e;
        }
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }

  private async isV3ClusterErrored(clusterId: string): Promise<{ errored: boolean; message: string }> {
    const result = await this.getRancherResource('v3', 'clusters', clusterId, 0);

    if (result.status !== 200) {
      return { errored: false, message: '' };
    }

    const { transitioning, transitioningMessage, state } = result.body;

    if (transitioning === 'error' || state === 'error') {
      return { errored: true, message: transitioningMessage || state || 'unknown error' };
    }

    return { errored: false, message: '' };
  }

  private async isV1ClusterErrored(clusterId: string): Promise<{ errored: boolean; message: string }> {
    const result = await this.getRancherResource('v1', 'provisioning.cattle.io.clusters', clusterId, 0);

    if (result.status !== 200) {
      return { errored: false, message: '' };
    }

    const metaState = result.body.metadata?.state;
    const stalled = (result.body.status?.conditions || []).find(
      (c: any) => c.type === 'Stalled' && c.status === 'True',
    );

    if (metaState?.error === true || stalled) {
      return { errored: true, message: metaState?.message || stalled?.message || 'unknown error' };
    }

    return { errored: false, message: '' };
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

  /**
   * Create a custom GlobalRole with the given rules.
   * Returns the v3 API response body (includes `id` for cleanup).
   */
  async createGlobalRole(name: string, rules: Array<{ apiGroups: string[]; resources: string[]; verbs: string[] }>) {
    const resp = await this.fetchWithReauth(() =>
      this.request.post(`${this.apiUrl}/v3/globalRoles`, {
        ...this.opts({
          data: {
            type: 'globalRole',
            name,
            displayName: name,
            rules,
          },
        }),
      }),
    );

    expect([200, 201]).toContain(resp.status());

    return { status: resp.status(), body: await resp.json() };
  }

  /** Delete a GlobalRole by ID (v3 API). */
  async deleteGlobalRole(roleId: string, failOnStatusCode = false) {
    await this.deleteRancherResource('v3', 'globalRoles', roleId, failOnStatusCode);
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

  /**
   * Update namespace filter — sets groupBy and namespace filter via user preferences.
   * Mirrors upstream cy.updateNamespaceFilter().
   */
  async updateNamespaceFilter(clusterName: string, groupBy: string, namespaceFilter: string) {
    const selfUser = await this.getRancherResource('v1', 'ext.cattle.io.selfuser', undefined, 201);
    const userId = selfUser.body.status.userID;

    const payload = {
      id: userId,
      type: 'userpreference',
      data: {
        cluster: clusterName,
        'group-by': groupBy,
        'ns-by-cluster': namespaceFilter,
      },
    };

    return this.setRancherResource('v1', 'userpreferences', userId, payload);
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

    if (result.body?.status?.lockedValue !== null) {
      return result.body.status.lockedValue;
    }

    return result.body?.spec?.value ?? result.body?.status?.default;
  }

  async createProject(name: string, clusterId = 'local') {
    return this.createRancherResource('v3', 'projects', {
      type: 'project',
      name,
      clusterId,
    });
  }

  async createNamespaceInProject(nsName: string, projectId: string) {
    return this.createRancherResource('v1', 'namespaces', {
      type: 'namespace',
      metadata: {
        annotations: {
          'field.cattle.io/projectId': projectId,
          'field.cattle.io/containerDefaultResourceLimit': '{}',
        },
        name: nsName,
      },
    });
  }

  /**
   * Check whether a chart is present in the catalog index.
   *
   * Uses the filtered index (`?link=index`) which applies server-side version constraints —
   * the same index the Charts UI renders. Results are cached per worker since the catalog
   * doesn't change mid-run.
   *
   * Returns:
   * - `'available'` — chart exists in the filtered index, test can run
   * - `'filtered'` — catalog has entries but this chart is absent (version constraints or not in repo)
   * - `'catalog-error'` — index is empty or fetch failed (repo not synced / broken)
   */
  async checkChartPresence(repo: string, chartId: string): Promise<'available' | 'filtered' | 'catalog-error'> {
    const key = `${repo}/${chartId}`;

    if (this.chartPresenceCache.has(key)) {
      return this.chartPresenceCache.get(key)!;
    }

    const resp = await this.request.fetch(
      `${this.apiUrl}/v1/catalog.cattle.io.clusterrepos/${repo}?link=index`,
      this.opts(),
    );

    if (!resp.ok()) {
      this.chartPresenceCache.set(key, 'catalog-error');

      return 'catalog-error';
    }

    const json = await resp.json().catch(() => ({}));
    const entries = json?.entries;

    if (!entries || Object.keys(entries).length === 0) {
      this.chartPresenceCache.set(key, 'catalog-error');

      return 'catalog-error';
    }

    const result = entries[chartId] ? ('available' as const) : ('filtered' as const);

    this.chartPresenceCache.set(key, result);

    return result;
  }

  /**
   * Resolve the latest chart version from a cluster repo's index. The
   * `?action=install` endpoint requires `version` in each chart entry — without
   * it the helm command gets `chart-.tgz` (empty version) and fails with exit 123.
   * Index entries are pre-sorted by Rancher with the newest version at index 0.
   */
  async getLatestChartVersion(repo: string, chartName: string): Promise<string> {
    const idxResp = await this.getRancherResource('v1', `catalog.cattle.io.clusterrepos/${repo}?link=index`);
    const versions = idxResp.body?.entries?.[chartName];

    if (!versions || versions.length === 0) {
      throw new Error(`No versions found for chart '${chartName}' in repo '${repo}'`);
    }

    return versions[0].version;
  }

  /**
   * Uninstall a Helm chart via API. Safe to call when the chart is not installed.
   * When crdName is provided, uninstalls the app first, then the CRD (order matters).
   */
  async uninstallChart(namespace: string, name: string, crdName?: string): Promise<void> {
    const base = `catalog.cattle.io.apps/${namespace}`;

    const appResp = await this.getRancherResource('v1', 'catalog.cattle.io.apps', `${namespace}/${name}`, 0);

    if (appResp.status === 200) {
      await this.createRancherResource('v1', `${base}/${name}?action=uninstall`, {}, false, 30000);
    }

    if (crdName) {
      const crdResp = await this.getRancherResource('v1', 'catalog.cattle.io.apps', `${namespace}/${crdName}`, 0);

      if (crdResp.status === 200) {
        await this.createRancherResource('v1', `${base}/${crdName}?action=uninstall`, {}, false, 30000);
      }
    }
  }

  /**
   * Uninstall and wait for full cleanup of the chart and its CRD chart (if any).
   * Polls until the catalog.cattle.io.apps resources return 404 — confirming
   * helm finished and any k8s CRDs from the CRD chart were removed.
   */
  async ensureChartUninstalled(
    namespace: string,
    name: string,
    crdName?: string,
    retries = 30,
    delayMs = 2000,
  ): Promise<void> {
    await this.uninstallChart(namespace, name, crdName);
    await this.waitForRancherResource(
      'v1',
      'catalog.cattle.io.apps',
      `${namespace}/${name}`,
      (resp) => resp.status === 404,
      retries,
      delayMs,
    );
    if (crdName) {
      await this.waitForRancherResource(
        'v1',
        'catalog.cattle.io.apps',
        `${namespace}/${crdName}`,
        (resp) => resp.status === 404,
        retries,
        delayMs,
      );
    }
  }

  /**
   * Install a chart (and its CRD chart, if any) at the latest version via the
   * cluster-repo install action. No-ops if already deployed; uninstalls and
   * reinstalls if the chart exists in a non-deployed state. Throws if the chart
   * does not reach `deployed` within the polling window.
   */
  async ensureChartInstalled(
    repo: string,
    namespace: string,
    name: string,
    crdName?: string,
    retries = 60,
    delayMs = 5000,
  ): Promise<void> {
    const appResp = await this.getRancherResource('v1', 'catalog.cattle.io.apps', `${namespace}/${name}`, 0);

    if (appResp.status === 200 && appResp.body?.metadata?.state?.name === 'deployed') {
      return;
    }

    if (appResp.status === 200) {
      await this.ensureChartUninstalled(namespace, name, crdName);
    }

    const charts = [];

    if (crdName) {
      const crdVersion = await this.getLatestChartVersion(repo, crdName);

      charts.push({ chartName: crdName, version: crdVersion, namespace, releaseName: crdName });
    }

    const appVersion = await this.getLatestChartVersion(repo, name);

    charts.push({ chartName: name, version: appVersion, namespace, releaseName: name });

    await this.createRancherResource(
      'v1',
      `catalog.cattle.io.clusterrepos/${repo}?action=install`,
      {
        charts,
        noHooks: false,
        timeout: '600s',
        // wait: true is required for multi-chart installs (CRD + app): without it, helm runs
        // both `helm upgrade --install` commands back-to-back and the second fails because
        // the first chart's CRDs haven't been registered with the k8s API server yet.
        wait: true,
        namespace,
        projectId: '',
      },
      false,
    );

    const deployed = await this.waitForRancherResource(
      'v1',
      'catalog.cattle.io.apps',
      `${namespace}/${name}`,
      (resp) => resp.body?.metadata?.state?.name === 'deployed',
      retries,
      delayMs,
    );

    if (!deployed) {
      throw new Error(`Chart '${name}' did not reach deployed state within polling window`);
    }
  }

  /**
   * Poll Rancher API health via /v1/counts.
   * Useful after operations that can restart embedded k3s (driver activation, extension installs).
   */
  async waitForHealthy(maxAttempts = 8, intervalMs = 5_000): Promise<void> {
    for (let i = 1; i <= maxAttempts; i++) {
      try {
        const resp = await this.getRancherResource('v1', 'counts');

        if (resp.status === 200) {
          return;
        }
      } catch (err: unknown) {
        console.warn(`[RancherApi] health probe ${i}/${maxAttempts} failed:`, err);
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(
      `Rancher did not recover after ${(maxAttempts * intervalMs) / 1000}s — aborting to prevent cascade`,
    );
  }

  /**
   * Delete a provisioning cluster and poll until Rancher fully removes it (404).
   * Use in afterAll hooks to ensure clean teardown before credential deletion.
   */
  async deleteClusterAndWait(
    clusterName: string,
    namespace = 'fleet-default',
    maxRetries = 20,
    intervalMs = 15_000,
  ): Promise<void> {
    const resourceId = `${namespace}/${clusterName}`;

    await this.deleteRancherResource('v1', 'provisioning.cattle.io.clusters', resourceId, false);
    await this.waitForRancherResource(
      'v1',
      'provisioning.cattle.io.clusters',
      resourceId,
      (resp) => resp.status === 404,
      maxRetries,
      intervalMs,
    );
  }

  /**
   * Delete a cloud credential by display name.
   * Looks up the credential ID from the v3 API, then deletes it.
   */
  async deleteCloudCredentialByName(credentialName: string): Promise<void> {
    const credsResp = await this.getRancherResource('v3', 'cloudcredentials', undefined, 0);
    const cred = credsResp.body?.data?.find((c: { name: string }) => c.name === credentialName);

    if (cred) {
      await this.deleteRancherResource('v3', 'cloudcredentials', cred.id, false);
    }
  }
}
