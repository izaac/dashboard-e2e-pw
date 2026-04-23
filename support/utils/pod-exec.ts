import * as https from 'https';
import WebSocket from 'ws';

const DEFAULT_EXEC_TIMEOUT_MS = 30_000;

/**
 * Decode a Kubernetes exec WebSocket frame.
 * The base64.channel.k8s.io subprotocol prefixes each message with a stream
 * byte (0 = stdin, 1 = stdout, 2 = stderr, 3 = status/error) followed by
 * base64-encoded payload.
 */
function decodeFrame(data: WebSocket.Data): { channel: number; text: string } {
  const raw = typeof data === 'string' ? data : Buffer.from(data as ArrayBuffer).toString('utf-8');
  const channel = parseInt(raw[0], 10);
  const text = Buffer.from(raw.slice(1), 'base64').toString('utf-8');

  return { channel, text };
}

function buildExecUrl(
  baseUrl: string,
  namespace: string,
  podName: string,
  container: string,
  commands: string[],
): string {
  const urlBase = `${baseUrl}/api/v1/namespaces/${namespace}/pods/${podName}/exec`;
  const params = new URLSearchParams({
    container,
    stdout: '1',
    stdin: '1',
    stderr: '1',
    tty: '1',
  });

  for (const cmd of commands) {
    params.append('command', cmd);
  }

  return `${urlBase}?${params.toString()}`;
}

/**
 * Execute a shell command inside a running pod via the Kubernetes exec WebSocket API.
 *
 * @param apiUrl - Rancher API origin (e.g. https://localhost:8005), NOT the dashboard baseURL
 * @param namespace - Pod namespace
 * @param podName - Pod name
 * @param container - Container name (typically 'container-0')
 * @param command - Shell command to execute
 * @param bearerToken - Rancher API bearer token
 * @param timeoutMs - Timeout in ms (default 30s). Rejects + closes socket if exceeded.
 * @returns Array of stdout messages received
 */
export async function execInPod(
  apiUrl: string,
  namespace: string,
  podName: string,
  container: string,
  command: string,
  bearerToken: string,
  timeoutMs = DEFAULT_EXEC_TIMEOUT_MS,
): Promise<string[]> {
  const wsUrl = apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
  const commands = ['/bin/sh', '-c', command];
  const url = buildExecUrl(wsUrl, namespace, podName, container, commands);

  const agent = new https.Agent({ rejectUnauthorized: false });

  return new Promise((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(url, 'base64.channel.k8s.io', {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Origin: apiUrl,
        'User-Agent': 'Mozilla/5.0',
        Connection: 'Upgrade',
        Upgrade: 'websocket',
      },
      agent,
      perMessageDeflate: false,
    });

    const stdout: string[] = [];
    const stderr: string[] = [];

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error(`WebSocket exec timed out after ${timeoutMs}ms: ${command}`));
      }
    }, timeoutMs);

    function finish(error?: Error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);

      if (error) {
        reject(error);
      } else if (stderr.length > 0) {
        reject(new Error(`WebSocket exec stderr: ${stderr.join('')}`));
      } else {
        resolve(stdout);
      }
    }

    ws.on('message', (data) => {
      const frame = decodeFrame(data);

      if (frame.channel === 1) {
        stdout.push(frame.text);
      } else if (frame.channel === 2) {
        stderr.push(frame.text);
      } else if (frame.channel === 3 && frame.text.trim()) {
        // Channel 3 = K8s exec status. Non-empty means error.
        try {
          const status = JSON.parse(frame.text);

          if (status.status !== 'Success') {
            finish(new Error(`K8s exec failed: ${status.message || frame.text}`));
          }
        } catch {
          finish(new Error(`K8s exec status: ${frame.text}`));
        }
      }
    });

    ws.on('close', () => finish());
    ws.on('error', (err) => finish(new Error(`WebSocket exec error: ${err.message}`)));
  });
}
