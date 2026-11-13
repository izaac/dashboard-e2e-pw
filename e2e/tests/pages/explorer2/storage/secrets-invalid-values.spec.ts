import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import { SecretsCreateEditPo } from '@/e2e/po/pages/explorer/secrets.po';
import { SecretEditPagePo } from '@/e2e/po/edit/secret-edit.po';
import TooltipPo from '@/e2e/po/components/tooltip.po';
import type LabeledInputPo from '@/e2e/po/components/labeled-input.po';

const CLUSTER = 'local';

/** Wrap DER bytes in a PEM envelope, 64 columns per line */
const toPem = (label: string, der: Buffer): string =>
  `-----BEGIN ${label}-----\n${der.toString('base64').replace(/.{1,64}/g, '$&\n')}-----END ${label}-----\n`;

/** SSH wire format "string": 4 byte big-endian length followed by the bytes */
const sshString = (bytes: Buffer): Buffer => {
  const length = Buffer.alloc(4);

  length.writeUInt32BE(bytes.length);

  return Buffer.concat([length, bytes]);
};

/**
 * All key material is generated at runtime so no key or certificate is ever committed to git.
 * The Dashboard only checks the PEM / SSH envelope client side, so the certificate body is the
 * DER encoded public half of a throwaway RSA key wrapped in a CERTIFICATE envelope.
 */
const generateMaterial = () => {
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const ed25519 = generateKeyPairSync('ed25519');
  const edSpki = ed25519.publicKey.export({ type: 'spki', format: 'der' });
  // The raw 32 byte Ed25519 public key is the tail of its SPKI encoding
  const edRaw = edSpki.subarray(edSpki.length - 32);
  const sshBlob = Buffer.concat([sshString(Buffer.from('ssh-ed25519')), sshString(edRaw)]);

  return {
    cert: toPem('CERTIFICATE', rsa.publicKey.export({ type: 'spki', format: 'der' })),
    privateKey: rsa.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
    sshPublicKey: `ssh-ed25519 ${sshBlob.toString('base64')} qa-${randomBytes(3).toString('hex')}@example.com`,
  };
};

const b64 = (value: string): string => Buffer.from(value).toString('base64');

/** The validation icon is shown on the field and its tooltip carries the expected message */
async function expectValidationError(page: Page, input: LabeledInputPo, message: string | RegExp): Promise<void> {
  const icon = input.validationMessage();

  await expect(icon).toBeVisible();

  const tooltip = new TooltipPo(page, icon);

  await tooltip.show();
  await expect(tooltip.content().filter({ hasText: message }).first()).toBeVisible();
}

test.describe('Secret forms block invalid values', { tag: ['@explorer2', '@adminUser'] }, () => {
  let namespace: string;

  test.beforeAll(async ({ rancherApi }) => {
    namespace = rancherApi.createE2EResourceName('secret-invalid');

    await rancherApi.createNamespace(namespace);
  });

  test.afterAll(async ({ rancherApi }) => {
    if (namespace) {
      await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
    }
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('TLS create is blocked until the certificate and private key are PEM encoded', async ({ page, rancherApi }) => {
    const secretName = rancherApi.createE2EResourceName('tls-create');
    const material = generateMaterial();

    try {
      const createPage = new SecretsCreateEditPo(page, CLUSTER);

      await createPage.goTo();
      await createPage.selectSecretSubtype('kubernetes.io/tls').click();

      await createPage.selectNamespace(namespace);
      await createPage.nameNsDescription().name().set(secretName);

      await createPage.tlsCertInput().set('not-a-cert');
      await createPage.tlsCertInput().input().blur();
      await createPage.tlsKeyInput().set('not-a-key');
      await createPage.tlsKeyInput().input().blur();

      await expectValidationError(page, createPage.tlsCertInput(), '"Certificate" must be a PEM encoded certificate');
      await expectValidationError(page, createPage.tlsKeyInput(), '"Private Key" must be a PEM encoded private key');
      await expect(createPage.saveOrCreate().self()).toBeDisabled();

      await createPage.tlsCertInput().set(material.cert);
      await createPage.tlsKeyInput().set(material.privateKey);
      await createPage.tlsKeyInput().input().blur();

      await expect(createPage.tlsCertInput().validationMessage()).toBeHidden();
      await expect(createPage.tlsKeyInput().validationMessage()).toBeHidden();
      await expect(createPage.saveOrCreate().self()).toBeEnabled();

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/secrets') && resp.request().method() === 'POST',
      );

      await createPage.saveOrCreate().click();

      expect((await responsePromise).status()).toBe(201);
    } finally {
      await rancherApi.deleteRancherResource('v1', 'secrets', `${namespace}/${secretName}`, false);
    }
  });

  test('SSH create is blocked until the public and private keys are valid', async ({ page, rancherApi }) => {
    const secretName = rancherApi.createE2EResourceName('ssh-create');
    const material = generateMaterial();

    try {
      const createPage = new SecretsCreateEditPo(page, CLUSTER);

      await createPage.goTo();
      await createPage.selectSecretSubtype('kubernetes.io/ssh-auth').click();

      await createPage.selectNamespace(namespace);
      await createPage.nameNsDescription().name().set(secretName);

      await createPage.sshPublicKeyInput().set('opa');
      await createPage.sshPublicKeyInput().input().blur();
      await createPage.sshPrivateKeyInput().set('op');
      await createPage.sshPrivateKeyInput().input().blur();

      await expectValidationError(page, createPage.sshPublicKeyInput(), /must be an SSH public key/);
      await expectValidationError(page, createPage.sshPrivateKeyInput(), /must be a PEM encoded private key/);
      await expect(createPage.saveOrCreate().self()).toBeDisabled();

      await createPage.sshPublicKeyInput().set(material.sshPublicKey);
      await createPage.sshPrivateKeyInput().set(material.privateKey);
      await createPage.sshPrivateKeyInput().input().blur();

      await expect(createPage.sshPublicKeyInput().validationMessage()).toBeHidden();
      await expect(createPage.sshPrivateKeyInput().validationMessage()).toBeHidden();
      await expect(createPage.saveOrCreate().self()).toBeEnabled();

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/secrets') && resp.request().method() === 'POST',
      );

      await createPage.saveOrCreate().click();

      expect((await responsePromise).status()).toBe(201);
    } finally {
      await rancherApi.deleteRancherResource('v1', 'secrets', `${namespace}/${secretName}`, false);
    }
  });

  test('Opaque create is blocked by an invalid name, data key or uppercase namespace', async ({ page, rancherApi }) => {
    const secretName = rancherApi.createE2EResourceName('opaque-create');
    const newNamespace = rancherApi.createE2EResourceName('secret-opaque-ns');

    try {
      const createPage = new SecretsCreateEditPo(page, CLUSTER);
      const nameInput = createPage.nameNsDescription().name();

      await createPage.goTo();
      await createPage.selectSecretSubtype('Opaque').click();

      // Invalid name
      await nameInput.set('##^#%');
      await nameInput.input().blur();

      await expectValidationError(page, nameInput, /invalid character/);
      await expect(createPage.saveOrCreate().self()).toBeDisabled();

      await nameInput.set(secretName);
      await expect(nameInput.validationMessage()).toBeHidden();

      // Invalid data keys, including the ones Kubernetes rejects outright
      for (const invalidKey of ['@##$', '.', '..a']) {
        await createPage.dataKeyInput().set(invalidKey);
        await createPage.dataKeyInput().input().blur();

        await expectValidationError(page, createPage.dataKeyInput(), /must consist of alphanumeric characters/);
        await expect(createPage.saveOrCreate().self()).toBeDisabled();
      }

      // Valid data first, so the namespace is the only thing left blocking the save
      await createPage.dataKeyInput().set('my-key');
      await createPage.dataValueInput().fill('my-val');
      await expect(createPage.dataKeyInput().validationMessage()).toBeHidden();

      // Uppercase namespace
      await createPage.selectNamespace('Create a New Namespace');
      await createPage.createNamespaceInput().set('QA-Upper-NS');
      await createPage.createNamespaceInput().input().blur();

      await expectValidationError(page, createPage.createNamespaceInput(), /must be lowercase/);
      await expect(createPage.saveOrCreate().self()).toBeDisabled();

      // Lowercase namespace
      await createPage.createNamespaceInput().set(newNamespace);
      await expect(createPage.createNamespaceInput().validationMessage()).toBeHidden();
      await expect(createPage.saveOrCreate().self()).toBeEnabled();

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/secrets') && resp.request().method() === 'POST',
      );

      await createPage.saveOrCreate().click();

      expect((await responsePromise).status()).toBe(201);
    } finally {
      await rancherApi.deleteRancherResource('v1', 'secrets', `${newNamespace}/${secretName}`, false);
      await rancherApi.deleteRancherResource('v1', 'namespaces', newNamespace, false);
    }
  });

  test('TLS edit allows a blank private key but blocks a non PEM one', async ({ page, rancherApi }) => {
    const secretName = rancherApi.createE2EResourceName('tls-edit');
    const material = generateMaterial();

    try {
      await rancherApi.createSecret(namespace, secretName, {
        type: 'kubernetes.io/tls',
        data: { 'tls.crt': b64(material.cert), 'tls.key': b64(material.privateKey) },
      });

      const editPage = new SecretEditPagePo(page, CLUSTER, namespace, secretName);

      // A blank private key keeps the stored one
      await editPage.goToEdit();
      await expect(editPage.tlsCertInput().self()).toBeVisible();
      await expect(editPage.tlsKeyInput().self()).toBeVisible();

      expect(await editPage.tlsKeyInput().value()).toBe('');
      await expect(editPage.saveOrCreate().self()).toBeEnabled();

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes(`v1/secrets/${namespace}/${secretName}`) && resp.request().method() === 'PUT',
      );

      await editPage.saveOrCreate().click();

      expect((await responsePromise).status()).toBe(200);

      const stored = await rancherApi.getRancherResource('v1', 'secrets', `${namespace}/${secretName}`);

      expect(stored.body.data['tls.key']).toBe(b64(material.privateKey));
      expect(stored.body.data['tls.crt']).toBe(b64(material.cert));

      // A non PEM private key is blocked
      await editPage.goToEdit();
      await expect(editPage.tlsKeyInput().self()).toBeVisible();

      await editPage.tlsKeyInput().set('not-a-key');
      await editPage.tlsKeyInput().input().blur();

      await expectValidationError(page, editPage.tlsKeyInput(), '"Private Key" must be a PEM encoded private key');
      await expect(editPage.saveOrCreate().self()).toBeDisabled();

      // Clearing it goes back to "keep the existing key"
      await editPage.tlsKeyInput().clear();
      await expect(editPage.tlsKeyInput().validationMessage()).toBeHidden();
      await expect(editPage.saveOrCreate().self()).toBeEnabled();

      // The certificate stays required
      await editPage.tlsCertInput().clear();
      await editPage.tlsCertInput().input().blur();

      await expect(editPage.tlsCertInput().validationMessage()).toBeVisible();
      await expect(editPage.saveOrCreate().self()).toBeDisabled();
    } finally {
      await rancherApi.deleteRancherResource('v1', 'secrets', `${namespace}/${secretName}`, false);
    }
  });

  test('Read from File validates the certificate without focusing the field', async ({
    page,
    rancherApi,
  }, testInfo) => {
    const secretName = rancherApi.createE2EResourceName('tls-file');
    const material = generateMaterial();
    const badCertFile = testInfo.outputPath('bad-cert.txt');

    writeFileSync(badCertFile, 'not-a-cert');

    try {
      const createPage = new SecretsCreateEditPo(page, CLUSTER);

      await createPage.goTo();
      await createPage.selectSecretSubtype('kubernetes.io/tls').click();

      await createPage.selectNamespace(namespace);
      await createPage.nameNsDescription().name().set(secretName);
      await createPage.tlsKeyInput().set(material.privateKey);

      // Neither focus nor blur the certificate text area, the file selection alone must surface the error
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        createPage.certReadFromFileButton().click(),
      ]);

      await fileChooser.setFiles(badCertFile);

      await expect(createPage.tlsCertInput().validationMessage()).toBeVisible();
      await expect(createPage.tlsKeyInput().validationMessage()).toBeHidden();
      await expect(createPage.saveOrCreate().self()).toBeDisabled();
    } finally {
      await rancherApi.deleteRancherResource('v1', 'secrets', `${namespace}/${secretName}`, false);
    }
  });
});
