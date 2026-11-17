import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify, isDeepStrictEqual } from 'node:util';
import type { Page } from '@playwright/test';
import { test as base, expect } from '@/support/fixtures';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import type { TestEnvMetadata } from '@/globals';
import { EXTENDED, LONG, PROVISIONING, EXTENSION_OPS, timeoutOpt } from '@/support/timeouts';

/**
 * rancher/dashboard#19025: the login page shows one provider's login at a time, banners are spaced
 * evenly, choosing a provider from the list is not a login, the choice can be remembered, a single
 * external provider alongside local is a link rather than a list, and the directory (LDAP) form has
 * the password show and hide control and opens focused on the username field.
 *
 * OPT-IN SPEC - IT CHANGES GLOBAL AUTH STATE. It enables an OpenLDAP and a generic SAML provider on
 * the Rancher under test, which changes the login page every other spec sees: `login()` cannot sign
 * in while several providers are enabled, so any spec running concurrently fails. Every test is
 * therefore skipped unless `LOGIN_PROVIDERS=1` is set, and a skipped describe runs no hooks at all,
 * so a default suite pass touches nothing.
 *
 * Run it against a DISPOSABLE cluster, alone (no other Playwright worker, no shared CI instance):
 *
 *   export KUBECONFIG=$HOME/.config/kubeconfig-e2e.yaml
 *   export LOGIN_PROVIDERS_FIXTURES=$HOME/Documents/ui-qa-plans/plans/qa-19027-adfs-saml-ldap-search-fixtures.sh
 *   GREP_TAGS=@usersAndAuths LOGIN_PROVIDERS=1 \
 *     npx playwright test e2e/tests/auth/login-providers.spec.ts --reporter=line
 *
 * `GREP_TAGS` is here because the repo's default filters `@needsInfra` out of every run, which would
 * select no tests at all from this file.
 *
 * `LOGIN_PROVIDERS_FIXTURES` is the shell script that deploys the in-cluster directory (namespace
 * `openldap`) and the mock identity provider (namespace `mock-saml`) the two providers point at. It
 * is called with `apply` before the tests and `delete` after them. `KUBECONFIG` is needed both for
 * that script and to verify the auth state before and after the run.
 *
 * The spec refuses to disturb state it does not own: beforeAll records the current authconfigs and
 * fails fast, creating nothing, if any non-local provider is already enabled or if either provider
 * name it wants is already taken. afterAll then works outwards from what was attempted, not from what
 * succeeded: each provider it tracked is disabled and deleted as two independent steps, the fixture
 * namespaces it tried to apply are deleted even when the apply itself failed part way through, and the
 * baseline is read back with kubectl and `/v1-public/authproviders`. Every error is collected and
 * raised AFTER that read-back, so a run reports the state it actually left instead of stopping at the
 * first teardown error and silently half-restoring. Playwright runs afterAll even when beforeAll
 * throws, so a failure after enabling - or between enabling and the tests - still cleans up.
 *
 * Environment notes (from a live run - do not re-derive):
 * - Provider CRs: `openldap` (norman type `openLdapConfig`) and `genericsaml` (`genericSAMLConfig`).
 *   Norman offers no POST on those collections, so the authconfig CR is created through the k8s API
 *   and then configured with a PUT on the norman config.
 * - Enabling generic SAML needs a service-provider key and certificate. Neither the host nor the
 *   mock identity provider image has openssl, but the openldap fixture image does.
 * - The mock identity provider binds the pod IP, and only answers `/api/saml/metadata`, so the
 *   metadata is fetched from inside the pod over that address.
 * - The login page renders a spinner until its settings and provider requests land, so `openLogin()`
 *   waits for the welcome heading before any test asserts on the panel.
 * - Banner spacing is 20px above and below the messages block once it has content.
 */
const LOGIN_PROVIDERS = process.env.LOGIN_PROVIDERS === '1';
const FIXTURES_SCRIPT = process.env.LOGIN_PROVIDERS_FIXTURES || '';
const KUBECONFIG = process.env.KUBECONFIG || '';

const LOCAL_ID = 'local';
const LDAP_ID = 'openldap';
const LDAP_TYPE = 'openLdapConfig';
const LDAP_COLLECTION = 'openLdapConfigs';
const SAML_ID = 'genericsaml';
const SAML_TYPE = 'genericSAMLConfig';
const SAML_COLLECTION = 'genericSAMLConfigs';

/** Auth configs are only stored on the management cluster, and only Steve blocks writes here. */
const AUTH_CONFIG_API_PREFIX = 'k8s/clusters/local/apis/management.cattle.io/v3';
/** kubectl resource name for the same kind (group-suffixed, unlike the Steve type). */
const AUTH_CONFIG_KIND = 'authconfigs.management.cattle.io';

const LDAP_SERVER = 'openldap.openldap.svc.cluster.local';
const LDAP_PORT = 389;
const LDAP_SERVICE_ACCOUNT_DN = 'cn=admin,dc=example,dc=org';
const LDAP_SERVICE_ACCOUNT_PASSWORD = '***';
const LDAP_SEARCH_BASE = 'dc=example,dc=org';
const SAML_SIGNATURE_METHOD = 'RSA-SHA256';
const IDP_METADATA_URL = 'http://$(hostname -i):4000/api/saml/metadata';

/** Even spacing the fix gives the login banners, in px, above and below the messages block. */
const BANNER_GAP_PX = 20;
const EXPECTED_SINGLE_BANNER = 1;
const EXPECTED_PROVIDER_COUNT = 3;
const WRONG_USERNAME = 'e2e-no-such-user';
const WRONG_PASSWORD = '***';

/** Any endpoint that would carry a real login, so "picking did not log in" can be asserted. */
const LOGIN_ENDPOINT = /(\/v3-public\/|\/v1-public\/|\/v1-saml\/).*login/;

const execFileAsync = promisify(execFile);

interface AuthConfigEntry {
  enabled: boolean;
  type: string;
}

/** Authconfig name -> what the cluster reports for it, sorted so two states compare directly. */
type AuthConfigState = Record<string, AuthConfigEntry>;

interface Provider {
  id: string;
  normanType: string;
  normanCollection: string;
}

const LDAP_PROVIDER: Provider = { id: LDAP_ID, normanType: LDAP_TYPE, normanCollection: LDAP_COLLECTION };
const SAML_PROVIDER: Provider = { id: SAML_ID, normanType: SAML_TYPE, normanCollection: SAML_COLLECTION };

interface LoggedOutPage {
  page: Page;
  loginPage: LoginPagePo;
  /** POSTs to a login endpoint the page made, in the order they happened. */
  loginRequests: string[];
}

async function kubectl(args: string[], timeoutMs = EXTENDED): Promise<string> {
  const { stdout } = await execFileAsync('kubectl', args, {
    env: { ...process.env, KUBECONFIG },
    timeout: timeoutMs,
  });

  return stdout;
}

async function readAuthConfigs(): Promise<AuthConfigState> {
  const raw = await kubectl(['get', AUTH_CONFIG_KIND, '-o', 'json'], LONG);

  return Object.fromEntries(
    (JSON.parse(raw).items as any[]).map((item) => [
      item.metadata.name as string,
      { enabled: item.enabled === true, type: (item.type ?? item.kind) as string },
    ]),
  );
}

/** Provider ids an unauthenticated visitor can see - exactly what the login page builds itself from. */
async function publicProviderIds(api: RancherApi): Promise<string[]> {
  const resp = await api.getRancherResource('v1-public', 'authproviders', undefined, 0);

  if (resp.status !== 200) {
    throw new Error(`Reading /v1-public/authproviders returned ${resp.status}`);
  }

  return (resp.body?.data ?? []).map((p: any) => p.id as string).sort();
}

async function runFixtureScript(action: 'apply' | 'delete'): Promise<void> {
  await execFileAsync('sh', [FIXTURES_SCRIPT, action], {
    env: { ...process.env, KUBECONFIG },
    timeout: action === 'apply' ? PROVISIONING : EXTENSION_OPS,
  });
}

async function fetchIdpMetadata(): Promise<string> {
  const xml = await kubectl(
    ['exec', '-n', 'mock-saml', 'deploy/mock-saml', '--', 'sh', '-c', `wget -qO- "${IDP_METADATA_URL}"`],
    EXTENDED,
  );

  if (!xml.includes('EntityDescriptor')) {
    throw new Error('The mock identity provider returned no SAML metadata - is the mock-saml fixture running?');
  }

  return xml;
}

/**
 * The service-provider key and certificate SAML config requires. Generated with the openssl in the
 * directory fixture image, which is the only container in this environment that has it.
 */
async function generateSpIdentity(): Promise<{ spKey: string; spCert: string }> {
  const command =
    'openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/e2e-sp.key -out /tmp/e2e-sp.crt ' +
    '-days 365 -subj "/CN=e2e-login-providers" 2>/dev/null; cat /tmp/e2e-sp.key /tmp/e2e-sp.crt';
  const pem = await kubectl(['exec', '-n', 'openldap', 'deploy/openldap', '--', 'sh', '-c', command], LONG);
  const spKey = (pem.match(/-----BEGIN [A-Z ]*KEY-----[\s\S]*?-----END [A-Z ]*KEY-----/) ?? [''])[0].trim();
  const spCert = (pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/) ?? [''])[0].trim();

  if (!spKey || !spCert) {
    throw new Error(
      `openssl in the openldap fixture produced no service provider identity (key=${Boolean(spKey)}, cert=${Boolean(spCert)})`,
    );
  }

  return { spKey, spCert };
}

async function createAuthConfig(api: RancherApi, provider: Provider): Promise<void> {
  const resp = await api.createRancherResource(
    AUTH_CONFIG_API_PREFIX,
    'authconfigs',
    {
      apiVersion: 'management.cattle.io/v3',
      kind: 'AuthConfig',
      metadata: { name: provider.id },
      type: provider.normanType,
      enabled: false,
    },
    true,
  );

  if (resp.status !== 200 && resp.status !== 201) {
    throw new Error(`Creating the '${provider.id}' authconfig returned ${resp.status}: ${JSON.stringify(resp.body)}`);
  }
}

async function writeAuthConfig(api: RancherApi, provider: Provider, config: Record<string, any>): Promise<void> {
  const resp = await api.setRancherResource(
    'v3',
    provider.normanCollection,
    provider.id,
    { type: provider.normanType, ...config },
    false,
  );

  if (resp.status !== 200) {
    throw new Error(`Writing the '${provider.id}' config returned ${resp.status}: ${JSON.stringify(resp.body)}`);
  }
}

async function enableOpenLdap(api: RancherApi): Promise<void> {
  await createAuthConfig(api, LDAP_PROVIDER);
  await writeAuthConfig(api, LDAP_PROVIDER, {
    enabled: true,
    accessMode: 'unrestricted',
    servers: [LDAP_SERVER],
    port: LDAP_PORT,
    tls: false,
    starttls: false,
    connectionTimeout: 5000,
    serviceAccountDistinguishedName: LDAP_SERVICE_ACCOUNT_DN,
    serviceAccountPassword: LDAP_SERVICE_ACCOUNT_PASSWORD,
    userSearchBase: LDAP_SEARCH_BASE,
    groupSearchBase: LDAP_SEARCH_BASE,
    userNameAttribute: 'cn',
    userObjectClass: 'inetOrgPerson',
    userLoginAttribute: 'uid',
    userSearchAttribute: 'cn|uid',
    groupObjectClass: 'posixGroup',
    groupNameAttribute: 'cn',
    groupMemberUserAttribute: 'memberUid',
    groupSearchAttribute: 'cn',
  });
}

async function enableGenericSaml(api: RancherApi, apiHost: string): Promise<void> {
  const idpMetadataContent = await fetchIdpMetadata();
  const { spKey, spCert } = await generateSpIdentity();

  await createAuthConfig(api, SAML_PROVIDER);
  await writeAuthConfig(api, SAML_PROVIDER, {
    enabled: true,
    accessMode: 'unrestricted',
    displayNameField: 'displayName',
    userNameField: 'userName',
    uidField: 'uid',
    groupsField: 'groups',
    rancherApiHost: apiHost,
    idpMetadataContent,
    spKey,
    spCert,
    signatureMethod: SAML_SIGNATURE_METHOD,
    allowIdpInitiated: false,
    forceAuthn: false,
    allowedPrincipalIds: [],
  });
}

interface RemovalResult {
  /** Anything that went wrong on the way out, for the teardown to aggregate. */
  errors: string[];
  /** Whether the authconfig is gone from the cluster. */
  gone: boolean;
}

/**
 * Takes a provider out again. Every step stands on its own, because the failure that matters is a
 * provider left enabled: a disable that cannot be reached must not skip the delete, and the delete
 * must not skip the read-back. Idempotent - an authconfig that is already gone counts as removed.
 */
async function removeProvider(api: RancherApi, provider: Provider): Promise<RemovalResult> {
  const errors: string[] = [];
  const note = (step: string) => (err: unknown) => {
    errors.push(`${step} '${provider.id}' threw: ${(err as Error)?.message ?? err}`);
  };

  await api
    .createRancherResource('v3', `${provider.normanCollection}/${provider.id}?action=disable`, {}, false)
    .then((resp) => {
      // 404: the config is not there, which is the outcome being asked for anyway.
      if (resp.status !== 200 && resp.status !== 404) {
        errors.push(`disabling '${provider.id}' returned ${resp.status}: ${JSON.stringify(resp.body)}`);
      }
    })
    .catch(note('disabling'));

  await api.deleteRancherResource(AUTH_CONFIG_API_PREFIX, 'authconfigs', provider.id, false).catch(note('deleting'));

  const gone = await api
    .waitForResourceGone(AUTH_CONFIG_API_PREFIX, 'authconfigs', provider.id, 20, 2000)
    .catch((err) => {
      note('waiting for the authconfig of')(err);

      return false;
    });

  return { errors, gone };
}

/** Navigates to the login page and waits out its spinner. */
async function openLogin({ loginPage }: LoggedOutPage, query?: string): Promise<void> {
  await loginPage.goTo(query);
  await expect(loginPage.welcomeHeading()).toBeVisible(timeoutOpt(LONG));
}

/** The provider list, with nothing but the list on the panel. */
async function openProviderList({ loginPage }: LoggedOutPage): Promise<void> {
  await loginPage.openProviderList();
  await expect(loginPage.providerList()).toBeVisible(timeoutOpt(EXTENDED));
}

const test = base.extend<{ loggedOut: LoggedOutPage }>({
  // The suite's own session lives in `page`; the login page under test needs to be signed out, so
  // it gets its own context - fresh cookies and an empty localStorage - that nothing else touches.
  loggedOut: async ({ browser, envMeta }, use) => {
    const context = await browser.newContext({ baseURL: envMeta.baseUrl, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const loginRequests: string[] = [];

    page.on('request', (request) => {
      if (request.method() === 'POST' && LOGIN_ENDPOINT.test(request.url())) {
        loginRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    await use({ page, loginPage: new LoginPagePo(page), loginRequests });

    await context.close();
  },
});

test.describe(
  'Login page provider selection (#19025)',
  { tag: ['@usersAndAuths', '@adminUser', '@needsInfra'] },
  () => {
    // The providers are shared by every test here, and one block changes them, so nothing may run
    // out of order.
    test.describe.configure({ mode: 'serial' });

    // Without the flag every test is skipped and no hook runs, so the cluster keeps its auth state.
    test.skip(
      !LOGIN_PROVIDERS,
      'Opt-in auth spec: it enables external providers for the whole instance; needs a disposable cluster ' +
        'running nothing else. Set LOGIN_PROVIDERS=1 with LOGIN_PROVIDERS_FIXTURES and KUBECONFIG to run',
    );

    let baseline: AuthConfigState = {};
    let baselineProviderIds: string[] = [];
    /**
     * Set before the fixtures are awaited, so a run that died half way through the install still
     * takes the namespaces down again - the script's delete is `--ignore-not-found` safe.
     */
    let fixturesAttempted = false;
    /** Only these are removed again; anything found in the baseline is left exactly as it was. */
    const created: Provider[] = [];

    test.beforeAll(async ({ rancherApi }, testInfo) => {
      test.setTimeout(PROVISIONING);

      expect(
        FIXTURES_SCRIPT.length,
        'Precondition: LOGIN_PROVIDERS_FIXTURES must point at the script that deploys the directory and ' +
          'mock identity provider fixtures',
      ).toBeGreaterThan(0);
      expect(existsSync(FIXTURES_SCRIPT), `Precondition: the fixtures script '${FIXTURES_SCRIPT}' does not exist`).toBe(
        true,
      );
      expect(
        KUBECONFIG.length,
        'Precondition: KUBECONFIG must be set - this spec applies fixtures and reads authconfigs from the cluster',
      ).toBeGreaterThan(0);

      // What the instance looked like before us: the only state teardown is allowed to hand back.
      baseline = await readAuthConfigs();
      baselineProviderIds = await publicProviderIds(rancherApi);

      const alreadyEnabled = Object.entries(baseline)
        .filter(([name, entry]) => name !== LOCAL_ID && entry.enabled)
        .map(([name]) => name);

      expect(
        alreadyEnabled,
        'Precondition: this spec enables its own OpenLDAP and generic SAML providers and would overwrite ' +
          `them - non-local providers are already enabled: ${alreadyEnabled.join(', ')}. ` +
          `Delete them (kubectl delete ${AUTH_CONFIG_KIND} <name>) or point at a disposable instance`,
      ).toHaveLength(0);

      const takenNames = [LDAP_PROVIDER, SAML_PROVIDER]
        .map((provider) => provider.id)
        .filter((id) => Object.keys(baseline).includes(id));

      expect(
        takenNames,
        'Precondition: authconfigs this spec did not create already hold its provider names, so teardown ' +
          `could delete state it does not own: ${takenNames.join(', ')}. ` +
          `Delete them (kubectl delete ${AUTH_CONFIG_KIND} <name>) first`,
      ).toHaveLength(0);

      fixturesAttempted = true;
      await runFixtureScript('apply');

      // Tracked before the enable, so a config that was written but never enabled - or an enable that
      // died half way - is still taken down by the teardown.
      created.push(LDAP_PROVIDER);
      await enableOpenLdap(rancherApi);

      created.push(SAML_PROVIDER);
      await enableGenericSaml(rancherApi, (testInfo.project.metadata as TestEnvMetadata).api);

      // The login page builds itself from this endpoint, so it is what has to settle before testing.
      const allProvidersVisible = await rancherApi.waitForRancherResource(
        'v1-public',
        'authproviders',
        '',
        (resp: any) => {
          const ids = ((resp.body?.data ?? []) as any[]).map((p) => p.id);

          return [LOCAL_ID, LDAP_ID, SAML_ID].every((id) => ids.includes(id));
        },
        30,
        2000,
      );

      expect(
        allProvidersVisible,
        `Precondition: /v1-public/authproviders never reported ${LDAP_ID} and ${SAML_ID} enabled alongside ` +
          `${LOCAL_ID} - the directory or identity provider fixtures may not be reachable from Rancher`,
      ).toBe(true);
    });

    test.afterAll(async ({ rancherApi }) => {
      test.setTimeout(EXTENSION_OPS);

      const problems: string[] = [];

      for (const provider of created) {
        const removal = await removeProvider(rancherApi, provider);

        problems.push(...removal.errors);

        if (!removal.gone) {
          problems.push(`authconfig '${provider.id}' is still in the cluster`);
        }
      }

      if (fixturesAttempted) {
        await runFixtureScript('delete').catch((err) =>
          problems.push(`fixture delete failed: ${(err as Error)?.message ?? err}`),
        );
      }

      // Two independent reads of what the instance was handed back: the cluster objects themselves,
      // and the unauthenticated endpoint the login page builds itself from.
      const after = await readAuthConfigs().catch((err) => {
        problems.push(`kubectl could not read authconfigs: ${(err as Error)?.message ?? err}`);

        return null;
      });

      if (after && !isDeepStrictEqual(after, baseline)) {
        problems.push(
          `authconfigs after the run (${JSON.stringify(after)}) do not match the baseline (${JSON.stringify(baseline)})`,
        );
      }

      const providersAfter = await publicProviderIds(rancherApi).catch((err) => {
        problems.push(`/v1-public/authproviders could not be read: ${(err as Error)?.message ?? err}`);

        return null;
      });

      if (providersAfter && providersAfter.join(',') !== baselineProviderIds.join(',')) {
        problems.push(
          `a provider was left enabled: /v1-public/authproviders reports ${providersAfter.join(', ')} ` +
            `but the run started from ${baselineProviderIds.join(', ')}`,
        );
      }

      await testInfoAttach({ baseline, after, providersAfter, problems });

      // Carried in the message, not just the attachment, so a teardown that half-worked reads as
      // what the cluster actually holds rather than as an opaque expectation failure.
      const state = `authconfigs=${JSON.stringify(after)} providers=${JSON.stringify(providersAfter)}`;

      expect(problems, `Teardown verification failed with ${state}:\n${problems.join('\n')}`).toHaveLength(0);
    });

    /** Keeps the auth state the run handed back in the report next to the failures. */
    async function testInfoAttach(summary: unknown): Promise<void> {
      await test.info().attach('auth-state-restored', {
        body: JSON.stringify(summary, null, 2),
        contentType: 'application/json',
      });
    }

    test('the signed-out banner is spaced evenly above and below', async ({ loggedOut }) => {
      await openLogin(loggedOut, 'logged-out');

      await expect(loggedOut.loginPage.messageBanners()).toHaveCount(EXPECTED_SINGLE_BANNER);
      await expect(loggedOut.loginPage.messageBanners()).toContainText('You have been logged out');
      await expect(loggedOut.loginPage.gapAboveMessages()).resolves.toBeCloseTo(BANNER_GAP_PX, 0);
      await expect(loggedOut.loginPage.gapBelowMessages()).resolves.toBeCloseTo(BANNER_GAP_PX, 0);
    });

    test('the failed login banner is spaced evenly above and below', async ({ loggedOut }) => {
      const { page, loginPage } = loggedOut;

      // `?local` opens straight on the local form, whichever provider the page picked first.
      await openLogin(loggedOut, 'local');
      await expect(loginPage.username().self()).toBeVisible(timeoutOpt(EXTENDED));
      await loginPage.username().set(WRONG_USERNAME);
      await loginPage.password().set(WRONG_PASSWORD);
      await loginPage.submit();

      await expect(loginPage.messageBanners()).toContainText('Invalid username or password', timeoutOpt(LONG));
      await expect(loginPage.gapAboveMessages()).resolves.toBeCloseTo(BANNER_GAP_PX, 0);
      await expect(loginPage.gapBelowMessages()).resolves.toBeCloseTo(BANNER_GAP_PX, 0);
      // A wrong password must not have signed the context in.
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('the page opens on one provider login, with the OR divider and the provider link', async ({ loggedOut }) => {
      const { loginPage } = loggedOut;

      await openLogin(loggedOut);

      await expect(loginPage.providerSubmitButton()).toBeVisible(timeoutOpt(EXTENDED));
      await expect(loginPage.providerSubmitButton()).toContainText('Log in with');
      await expect(loginPage.orDivider()).toBeVisible();
      await expect(loginPage.chooseDifferentProvider()).toHaveText('Choose a different provider');
      // The list stays hidden until it is asked for, and the local form is not on screen either.
      await expect(loginPage.providerList()).toHaveCount(0);
      await expect(loginPage.rememberProviderCheckbox().self()).toHaveCount(0);
      await expect(loginPage.username().self()).toHaveCount(0);
    });

    test('the provider list holds every enabled provider with local last, and takes focus', async ({ loggedOut }) => {
      const { loginPage } = loggedOut;

      await openLogin(loggedOut);
      await openProviderList(loggedOut);

      await expect(loginPage.providerOptions()).toHaveCount(EXPECTED_PROVIDER_COUNT);
      for (const id of [LOCAL_ID, LDAP_ID, SAML_ID]) {
        await expect(loginPage.providerOption(id)).toHaveCount(1);
      }
      await expect(loginPage.providerOptions().last()).toHaveAttribute(
        'data-testid',
        `login-provider-option-${LOCAL_ID}`,
      );

      // The list stands in for the login: no form, no button, no divider.
      await expect(loginPage.providerSubmitButton()).toHaveCount(0);
      await expect(loginPage.submitButton().self()).toHaveCount(0);
      await expect(loginPage.ldapUsername()).toHaveCount(0);
      await expect(loginPage.orDivider()).toHaveCount(0);
      // Focus is handed to the first row of the list.
      await expect(loginPage.providerOptions().first()).toBeFocused();
    });

    test('picking a provider replaces the list without logging in or changing the remembered provider', async ({
      loggedOut,
    }) => {
      const { page, loginPage, loginRequests } = loggedOut;

      await openLogin(loggedOut);
      await openProviderList(loggedOut);
      await loginPage.selectProvider(LDAP_ID);

      await expect(loginPage.ldapUsername()).toBeVisible(timeoutOpt(EXTENDED));
      await expect(loginPage.providerList()).toHaveCount(0);
      await expect(loginPage.chooseDifferentProvider()).toBeVisible();
      // Picking only changes what is on offer: no login request, and no bounce to the provider.
      expect(loginRequests).toHaveLength(0);
      await expect(page).toHaveURL(/\/auth\/login/);
      expect(await loginPage.rememberedProviderId()).toBeNull();
    });

    test('remembering the choice shows that provider on the next visit', async ({ loggedOut }) => {
      const { page, loginPage } = loggedOut;

      await openLogin(loggedOut);
      await openProviderList(loggedOut);
      await loginPage.rememberProviderCheckbox().set();
      await loginPage.selectProvider(LDAP_ID);

      await expect(loginPage.ldapUsername()).toBeVisible(timeoutOpt(EXTENDED));
      expect(await loginPage.rememberedProviderId()).toBe(LDAP_ID);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(loginPage.welcomeHeading()).toBeVisible(timeoutOpt(LONG));
      await expect(loginPage.ldapUsername()).toBeVisible(timeoutOpt(EXTENDED));
      await expect(loginPage.providerSubmitButton()).toContainText('OpenLDAP');
      await expect(loginPage.providerList()).toHaveCount(0);
    });

    test('the directory form opens focused on the username field', async ({ loggedOut }) => {
      const { loginPage } = loggedOut;

      await openLogin(loggedOut);
      await openProviderList(loggedOut);
      await loginPage.selectProvider(LDAP_ID);

      await expect(loginPage.ldapUsername()).toBeFocused({ timeout: EXTENDED });
    });

    test('the directory form shows and hides the password', async ({ loggedOut }) => {
      const { loginPage } = loggedOut;
      const password = loginPage.ldapPassword();

      await openLogin(loggedOut);
      await openProviderList(loggedOut);
      await loginPage.selectProvider(LDAP_ID);

      await expect(loginPage.ldapUsername()).toBeVisible(timeoutOpt(EXTENDED));
      await password.set('password123');
      await expect(password.input()).toHaveAttribute('type', 'password');

      await password.showBtn().click();
      await expect(password.input()).toHaveAttribute('type', 'text');

      await password.showBtn().click();
      await expect(password.input()).toHaveAttribute('type', 'password');
    });

    test.describe('with one external provider and local', () => {
      test.beforeAll(async ({ rancherApi }) => {
        test.setTimeout(EXTENSION_OPS);

        // Two ways in is a straight swap, which the page offers as a link instead of a list. The
        // outer teardown runs the same removal again, so doing it here is safe.
        const { errors, gone } = await removeProvider(rancherApi, SAML_PROVIDER);

        expect(
          [...errors, ...(gone ? [] : [`authconfig '${SAML_ID}' is still in the cluster`])],
          `Precondition: '${SAML_ID}' could not be removed, so the single-provider case cannot be shown`,
        ).toHaveLength(0);

        const ready = await rancherApi.waitForRancherResource(
          'v1-public',
          'authproviders',
          '',
          (resp: any) => {
            const ids = ((resp.body?.data ?? []) as any[]).map((p) => p.id);

            return ids.length === 2 && ids.includes(LDAP_ID) && ids.includes(LOCAL_ID);
          },
          30,
          2000,
        );

        expect(ready, `Precondition: /v1-public/authproviders never settled on ${LDAP_ID} and ${LOCAL_ID} only`).toBe(
          true,
        );
      });

      test('the page opens on that provider with a link to the local user and no list', async ({ loggedOut }) => {
        const { loginPage } = loggedOut;

        await openLogin(loggedOut);

        await expect(loginPage.providerSubmitButton()).toContainText('Log in with OpenLDAP', timeoutOpt(EXTENDED));
        await expect(loginPage.useLocal()).toHaveText('Log in as a local user');
        await expect(loginPage.chooseDifferentProvider()).toHaveCount(0);
        await expect(loginPage.providerList()).toHaveCount(0);
        await expect(loginPage.rememberProviderCheckbox().self()).toHaveCount(0);
      });

      test('the local form links back to that provider', async ({ loggedOut }) => {
        const { loginPage } = loggedOut;

        await openLogin(loggedOut);
        await loginPage.useLocal().click();

        await expect(loginPage.username().self()).toBeVisible(timeoutOpt(EXTENDED));
        await expect(loginPage.providerSubmitButton()).toHaveCount(0);
        await expect(loginPage.chooseDifferentProvider()).toHaveText('Choose a different provider');

        await loginPage.chooseDifferentProvider().click();

        await expect(loginPage.providerSubmitButton()).toBeVisible(timeoutOpt(EXTENDED));
        await expect(loginPage.useLocal()).toHaveText('Log in as a local user');
      });
    });
  },
);
