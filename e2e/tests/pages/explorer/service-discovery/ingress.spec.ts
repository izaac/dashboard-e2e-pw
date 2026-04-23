import { test, expect } from '@/support/fixtures';
import { IngressListPagePo } from '@/e2e/po/pages/explorer/ingress.po';
import { IngressCreateEditPo } from '@/e2e/po/pages/explorer/ingress-create-edit.po';
import {
  ingressesGetReponseEmpty,
  ingressesGetResponseSmallSet,
} from '@/e2e/blueprints/explorer/workloads/service-discovery/ingresses-get';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';
import { LONG } from '@/support/timeouts';

test.describe('Ingresses', { tag: ['@explorer', '@adminUser'] }, () => {
  test('does not show console warning due to lack of secondary schemas', async ({ page, login }) => {
    await login();

    const consoleWarnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    const ingressListPage = new IngressListPagePo(page);

    await ingressListPage.goTo();
    await ingressListPage.waitForPage();

    const warnMsg =
      "pathExistsInSchema requires schema networking.k8s.io.ingress to have resources fields via schema definition but none were found. has the schema 'fetchResourceFields' been called?";

    expect(consoleWarnings).not.toContain(warnMsg);
  });

  test('can open Edit as YAML', async ({ page, login }) => {
    await login();

    const ingressListPage = new IngressListPagePo(page);

    await ingressListPage.goTo();
    await ingressListPage.waitForPage();
    await ingressListPage.list().masthead().create();

    const ingressForm = new IngressCreateEditPo(page);

    await ingressForm.waitForPage(undefined, 'rules');
    await ingressForm.createEditView().editAsYaml();
    await expect(ingressForm.createEditView().yamlEditor()).toBeVisible();
  });

  test.describe('Create/Edit', { tag: ['@noVai'] }, () => {
    test('can select rules and certificates in Create mode', async ({ page, login, rancherApi }) => {
      await login();

      const ts = Date.now();
      const namespace = `e2e-ing-cr-${ts}`;
      const ingressName = `e2e-ingress-${ts}`;
      const secretNames: string[] = [];
      const serviceNames: string[] = [];

      await rancherApi.createNamespace(namespace);

      try {
        for (let i = 0; i < 2; i++) {
          const sName = `secret-${ts}-${i}`;
          const svcName = `service-${ts}-${i}`;

          await rancherApi.createSecret(namespace, sName);
          secretNames.push(sName);
          await rancherApi.createService(namespace, svcName);
          serviceNames.push(svcName);
        }

        const ingressListPage = new IngressListPagePo(page);

        await ingressListPage.goTo();
        await ingressListPage.waitForPage();
        await ingressListPage.list().resourceTable().sortableTable().checkVisible();
        await ingressListPage.list().masthead().create();

        const ingressForm = new IngressCreateEditPo(page);

        await ingressForm.waitForPage(undefined, 'rules');
        await ingressForm.createEditView().nameNsDescription().name().set(ingressName);

        // Set up response waiters BEFORE namespace selection triggers API calls
        const servicesLoaded = page.waitForResponse(
          (resp) => resp.url().includes(`/v1/services/${namespace}`) && resp.status() === 200,
        );
        const secretsLoaded = page.waitForResponse(
          (resp) => resp.url().includes(`/v1/secrets/${namespace}`) && resp.status() === 200,
        );

        await ingressForm.createEditView().nameNsDescription().namespace().toggle();
        await ingressForm.createEditView().nameNsDescription().namespace().clickOptionWithLabel(namespace);
        await ingressForm.createEditView().nameNsDescription().namespace().checkOptionSelected(namespace);
        await ingressForm.createEditView().nameNsDescription().description().set(`${ingressName} description`);

        // Wait for services/secrets to load (mirrors upstream cy.wait('@getsServices')/@getsSecrets)
        await Promise.all([servicesLoaded, secretsLoaded]);

        // Rule 1
        await ingressForm.setRuleRequestHostValue(0, 'example1.com');
        await ingressForm.setPathTypeByLabel(0, 'ImplementationSpecific');
        await ingressForm.setTargetServiceValueByLabel(0, serviceNames[0]);
        await ingressForm.setPortValue(0, '8080');

        // Rule 2
        await ingressForm.rulesList().clickAdd('Add Rule');
        await ingressForm.setRuleRequestHostValue(1, 'example2.com');
        await ingressForm.setPathTypeByLabel(1, 'ImplementationSpecific');
        await ingressForm.setTargetServiceValueByLabel(1, serviceNames[1]);
        await ingressForm.setPortValue(1, '8080');

        // Certificates tab
        await ingressForm.tabs().clickTabWithName('certificates');
        await ingressForm.waitForPage(undefined, 'certificates');
        await ingressForm.certificatesList().clickAdd('Add Certificate');
        await ingressForm.setSecretNameValueByLabel(0, secretNames[0]);
        await ingressForm.setHostValueByIndex(0, 'bar0');
        await ingressForm.certificatesList().clickAdd('Add Certificate');
        await ingressForm.setSecretNameValueByLabel(1, secretNames[1]);
        await ingressForm.setHostValueByIndex(1, 'bar1');

        // Save and validate response
        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes('v1/networking.k8s.io.ingresses') && resp.request().method() === 'POST',
        );

        await ingressForm.waitForRulePathDebounce();
        await ingressForm.createEditView().save();
        const resp = await responsePromise;
        const body = await resp.json();

        expect(resp.status()).toBe(201);
        expect(body.metadata.name).toBe(ingressName);
        expect(body.spec.rules).toHaveLength(2);
        expect(body.spec.rules[0].host).toBe('example1.com');
        expect(body.spec.rules[1].host).toBe('example2.com');
        expect(body.spec.tls).toHaveLength(2);
        expect(body.spec.tls[0].secretName).toBe(secretNames[0]);
        expect(body.spec.tls[1].secretName).toBe(secretNames[1]);

        await ingressListPage.waitForPage();
        await expect(
          ingressListPage.list().resourceTable().sortableTable().rowElementWithName(ingressName),
        ).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
      }
    });

    test('can select rules and certificates in Edit mode', async ({ page, login, rancherApi }) => {
      await login();

      const ts = Date.now();
      const namespace = `e2e-ing-ed-${ts}`;
      const ingressName = `e2e-ingress-ed-${ts}`;
      const secretNames: string[] = [];
      const serviceNames: string[] = [];

      await rancherApi.createNamespace(namespace);

      try {
        for (let i = 0; i < 4; i++) {
          const sName = `secret-${ts}-${i}`;
          const svcName = `service-${ts}-${i}`;

          await rancherApi.createSecret(namespace, sName);
          secretNames.push(sName);
          await rancherApi.createService(namespace, svcName);
          serviceNames.push(svcName);
        }

        // Create ingress with 2 rules + 2 certs via API
        await rancherApi.createRancherResource('v1', 'networking.k8s.io.ingresses', {
          apiVersion: 'networking.k8s.io/v1',
          kind: 'Ingress',
          metadata: { name: ingressName, namespace },
          spec: {
            rules: [0, 1].map((i) => ({
              host: `example${i + 1}.com`,
              http: {
                paths: [
                  {
                    pathType: 'ImplementationSpecific',
                    path: '/',
                    backend: { service: { name: serviceNames[i], port: { number: 8080 } } },
                  },
                ],
              },
            })),
            tls: [0, 1].map((i) => ({
              hosts: [`bar${i}`],
              secretName: secretNames[i],
            })),
          },
        });

        const ingressListPage = new IngressListPagePo(page);

        await ingressListPage.goTo();
        await ingressListPage.waitForPage();
        await expect(
          ingressListPage.list().resourceTable().sortableTable().rowElementWithName(ingressName),
        ).toBeVisible();

        // Open Edit Config via action menu
        const actionMenu = await ingressListPage.list().resourceTable().sortableTable().rowActionMenuOpen(ingressName);

        await actionMenu.getMenuItem('Edit Config').click();

        const ingressForm = new IngressCreateEditPo(page, 'local', namespace, ingressName);

        await ingressForm.waitForPage('mode=edit', 'rules');

        // Add 2 more rules
        await ingressForm.rulesList().clickAdd('Add Rule');
        await ingressForm.setRuleRequestHostValue(2, 'example3.com');
        await ingressForm.setPathTypeByLabel(2, 'ImplementationSpecific');
        await ingressForm.setTargetServiceValueByLabel(2, serviceNames[2]);
        await ingressForm.setPortValue(2, '8080');
        await ingressForm.rulesList().clickAdd('Add Rule');
        await ingressForm.setRuleRequestHostValue(3, 'example4.com');
        await ingressForm.setPathTypeByLabel(3, 'ImplementationSpecific');
        await ingressForm.setTargetServiceValueByLabel(3, serviceNames[3]);
        await ingressForm.setPortValue(3, '8080');

        // Add 2 more certificates
        await ingressForm.tabs().clickTabWithName('certificates');
        await ingressForm.waitForPage('mode=edit', 'certificates');
        await ingressForm.certificatesList().clickAdd('Add Certificate');
        await ingressForm.setSecretNameValueByLabel(2, secretNames[2]);
        await ingressForm.setHostValueByIndex(2, 'bar2');
        await ingressForm.certificatesList().clickAdd('Add Certificate');
        await ingressForm.setSecretNameValueByLabel(3, secretNames[3]);
        await ingressForm.setHostValueByIndex(3, 'bar3');

        // Save and validate response
        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`v1/networking.k8s.io.ingresses/${namespace}/${ingressName}`) &&
            resp.request().method() === 'PUT',
        );

        await ingressForm.waitForRulePathDebounce();
        await ingressForm.createEditView().save();
        const resp = await responsePromise;
        const body = await resp.json();

        expect(resp.status()).toBe(200);
        expect(body.metadata.name).toBe(ingressName);

        // Validate all four rules (upstream parity: host, pathType, backend.service deep check)
        expect(body.spec.rules).toHaveLength(4);
        body.spec.rules.forEach((rule: Record<string, unknown>, i: number) => {
          expect(rule).toMatchObject({ host: `example${i + 1}.com` });
          const paths = (rule as { http: { paths: Array<Record<string, unknown>> } }).http.paths;

          expect(paths).toHaveLength(1);
          expect(paths[0]).toMatchObject({ pathType: 'ImplementationSpecific' });
          expect((paths[0] as { backend: { service: Record<string, unknown> } }).backend.service).toMatchObject({
            name: serviceNames[i],
            port: { number: 8080 },
          });
        });

        // Validate all four certificates (upstream parity: hosts array + secretName)
        expect(body.spec.tls).toHaveLength(4);
        body.spec.tls.forEach((tlsEntry: Record<string, unknown>, i: number) => {
          expect(tlsEntry).toMatchObject({
            hosts: [`bar${i}`],
            secretName: secretNames[i],
          });
        });

        await ingressListPage.waitForPage();
        await expect(
          ingressListPage.list().resourceTable().sortableTable().rowElementWithName(ingressName),
        ).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
      }
    });
  });

  test('can create an Ingress targeting a headless service and wait for Active state', async ({
    page,
    login,
    rancherApi,
  }) => {
    await login();

    const ts = Date.now();
    const namespace = `e2e-ing-ns-${ts}`;
    const headlessServiceName = `headless-svc-${ts}`;
    const ingressHeadlessName = `ing-headless-${ts}`;

    await rancherApi.createNamespace(namespace);

    try {
      await rancherApi.createRancherResource('v1', 'services', {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: headlessServiceName, namespace },
        spec: {
          clusterIP: 'None',
          ports: [{ name: 'myport', port: 8080, protocol: 'TCP', targetPort: 80 }],
          type: 'ClusterIP',
        },
      });

      const ingressListPage = new IngressListPagePo(page);

      await ingressListPage.goTo();
      await ingressListPage.waitForPage();
      await ingressListPage.list().masthead().create();

      const ingressForm = new IngressCreateEditPo(page);

      await ingressForm.waitForPage(undefined, 'rules');
      await ingressForm.createEditView().nameNsDescription().name().set(ingressHeadlessName);

      // Set up response waiters BEFORE namespace selection triggers API calls
      const servicesLoaded = page.waitForResponse(
        (resp) => resp.url().includes(`/v1/services/${namespace}`) && resp.status() === 200,
      );

      await ingressForm.createEditView().nameNsDescription().namespace().toggle();
      await ingressForm.createEditView().nameNsDescription().namespace().clickOptionWithLabel(namespace);
      await ingressForm.createEditView().nameNsDescription().namespace().checkOptionSelected(namespace);

      // Wait for services to load (mirrors upstream cy.wait('@getsServices'))
      await servicesLoaded;

      await expect(ingressForm.rulesList().self()).toBeVisible();
      await ingressForm.setRuleRequestHostValue(0, 'example-headless.com');
      await ingressForm.setPathTypeByLabel(0, 'ImplementationSpecific');
      await ingressForm.setTargetServiceValueByLabel(0, headlessServiceName);
      await ingressForm.setPortValue(0, '8080');

      const createResponse = page.waitForResponse(
        (resp) => resp.url().includes('/v1/networking.k8s.io.ingresses') && resp.request().method() === 'POST',
      );

      await ingressForm.waitForRulePathDebounce();
      await ingressForm.createEditView().save();
      const resp = await createResponse;

      expect(resp.status()).toBe(201);
      const body = await resp.json();

      expect(body.metadata.name).toBe(ingressHeadlessName);
      expect(body.spec.rules[0].host).toBe('example-headless.com');

      const path = body.spec.rules[0].http.paths[0];

      expect(path).toMatchObject({ pathType: 'ImplementationSpecific' });
      expect(path.backend.service).toMatchObject({
        name: headlessServiceName,
        port: { number: 8080 },
      });

      await ingressListPage.waitForPage();

      const sortableTable = ingressListPage.list().resourceTable().sortableTable();

      await sortableTable.rowElementWithName(ingressHeadlessName).waitFor(SHORT_TIMEOUT_OPT);
      await expect(sortableTable.rowWithName(ingressHeadlessName).column(1)).toContainText('Active', {
        timeout: LONG,
      });
    } finally {
      await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
    }
  });

  test.describe('List', { tag: ['@noVai'] }, () => {
    test('validate ingresses table in empty state', async ({ page, login }) => {
      await login();

      await page.route('**/v1/networking.k8s.io.ingresses?*', (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ingressesGetReponseEmpty) });
      });

      const ingressListPage = new IngressListPagePo(page);

      await ingressListPage.goTo();
      await ingressListPage.waitForPage();

      const expectedHeaders = ['State', 'Name', 'Namespace', 'Target', 'Default', 'Ingress Class', 'Age'];
      const sortableTable = ingressListPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.checkRowCount(true, 1);
    });

    test('flat list: validate ingresses table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/networking.k8s.io.ingresses?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ingressesGetResponseSmallSet),
        });
      });

      const ingressListPage = new IngressListPagePo(page);

      await ingressListPage.goTo();
      await ingressListPage.waitForPage();

      const expectedHeaders = ['State', 'Name', 'Namespace', 'Target', 'Default', 'Ingress Class', 'Age'];
      const sortableTable = ingressListPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();
      await sortableTable.checkRowCount(false, 2);
    });

    test('group by namespace: validate ingresses table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/networking.k8s.io.ingresses?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ingressesGetResponseSmallSet),
        });
      });

      const ingressListPage = new IngressListPagePo(page);

      await ingressListPage.goTo();
      await ingressListPage.waitForPage();

      const sortableTable = ingressListPage.list().resourceTable().sortableTable();

      await sortableTable.groupByButtons(1).click();

      const expectedHeaders = ['State', 'Name', 'Target', 'Default', 'Ingress Class', 'Age'];

      await sortableTable.checkVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();

      const groupRow = sortableTable.groupElementWithName('Namespace: cattle-system');

      await expect(groupRow).toBeVisible();
      await sortableTable.checkRowCount(false, 2);
    });
  });
});
