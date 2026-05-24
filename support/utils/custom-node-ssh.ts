import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Custom-node SSH provisioning helper — Playwright equivalent of Cypress upstream's
 * `cy.writeFile('custom_node.key', key)` + `cy.exec('chmod 600 ...')` + `cy.exec(cmd)`
 * sequence used by the RKE2 Custom + Imported Generic create-cluster tests.
 *
 * Reads the SSH key from `process.env.CUSTOM_NODE_KEY`. The value may be:
 *   - raw PEM ("-----BEGIN ...")
 *   - base64-encoded PEM (legacy Cypress env var format)
 *
 * Environment expected:
 *   CUSTOM_NODE_KEY    — required, SSH private key
 *   CUSTOM_NODE_IP     — required, IPv4 of the target node
 *   CUSTOM_NODE_USER   — optional, defaults to `ec2-user`
 */

const KEY_FILENAME = 'custom_node.key';

export interface CustomNodeSshOptions {
  /** Directory the key file is written into. Defaults to `process.cwd()`. */
  keyDir?: string;
  /** Shell command timeout in ms. Defaults to 5 min (matches upstream RESTART_TIMEOUT_OPT). */
  timeoutMs?: number;
}

/** Decode env-supplied key — accepts raw PEM or base64. */
function decodeKey(raw: string): string {
  if (raw.includes('BEGIN')) {
    return raw;
  }

  return Buffer.from(raw, 'base64').toString('utf8');
}

/** Write `custom_node.key` to disk with 0600 perms. Returns the absolute path. */
export async function writeCustomNodeKey(options: CustomNodeSshOptions = {}): Promise<string> {
  const key = process.env.CUSTOM_NODE_KEY;

  if (!key) {
    throw new Error('CUSTOM_NODE_KEY is not set');
  }

  const dir = options.keyDir ?? process.cwd();
  const keyPath = path.join(dir, KEY_FILENAME);

  await fs.writeFile(keyPath, decodeKey(key), { mode: 0o600 });

  return keyPath;
}

/**
 * Wrap a remote registration command into an `ssh ...` invocation that joins the
 * custom node to the cluster. Mirrors `ClusterManagerCreatePagePo.customClusterRegistrationCmd`.
 */
export function buildCustomClusterRegistrationCmd(remoteCmd: string): string {
  const sshUser = process.env.CUSTOM_NODE_USER || 'ec2-user';
  const customNodeIp = process.env.CUSTOM_NODE_IP;

  if (!customNodeIp) {
    throw new Error('CUSTOM_NODE_IP is not set');
  }

  return [
    'ssh',
    `-i ${KEY_FILENAME}`,
    '-o "StrictHostKeyChecking=no"',
    '-o "UserKnownHostsFile=/dev/null"',
    `${sshUser}@${customNodeIp}`,
    `"nohup ${remoteCmd}"`,
  ].join(' ');
}

/**
 * Provision a custom node: write the key + exec the registration command over SSH.
 * Throws on non-zero exit. Returns stdout/stderr for logging.
 */
export async function registerCustomNode(
  remoteCmd: string,
  options: CustomNodeSshOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  await writeCustomNodeKey(options);
  const wrapped = buildCustomClusterRegistrationCmd(remoteCmd);

  return execAsync(wrapped, { timeout: options.timeoutMs ?? 300_000 });
}

/**
 * Imported-cluster registration: just exec the kubectl-apply command directly.
 * The command is fully self-contained (`kubectl apply -f <url> --insecure`)
 * and runs on whichever host the spec is executing on.
 */
export async function applyImportedKubectlCommand(
  kubectlCmd: string,
  options: { timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return execAsync(kubectlCmd, { timeout: options.timeoutMs ?? 120_000 });
}
