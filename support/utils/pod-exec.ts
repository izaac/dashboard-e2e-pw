import * as https from 'https';
import WebSocket from 'ws';

/**
 * Decode a Kubernetes exec WebSocket frame.
 * The base64.channel.k8s.io subprotocol prefixes each message with a stream
 * byte (0 = stdin, 1 = stdout, 2 = stderr, 3 = status/error) followed by
 * base64-encoded payload.
 */
function decodeFrame(data: WebSocket.Data): { channel: number; text: string } {
  // K8s base64.channel.k8s.io sends text frames: first char is channel digit (ASCII),
  // rest is base64-encoded payload
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
 * @returns Array of stdout messages received
 */
export async function execInPod(
  apiUrl: string,
  namespace: string,
  podName: string,
  container: string,
  command: string,
  bearerToken: string,
): Promise<string[]> {
  const wsUrl = apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
  const commands = ['/bin/sh', '-c', command];
  const url = buildExecUrl(wsUrl, namespace, podName, container, commands);

  const agent = new https.Agent({ rejectUnauthorized: false });

  return new Promise((resolve, reject) => {
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

    ws.on('message', (data) => {
      const frame = decodeFrame(data);

      if (frame.channel === 1) {
        stdout.push(frame.text);
      } else if (frame.channel === 2) {
        stderr.push(frame.text);
      }
    });

    ws.on('close', () => {
      resolve(stdout);
    });

    ws.on('error', (err) => {
      reject(new Error(`WebSocket exec error: ${err.message}`));
    });
  });
}
