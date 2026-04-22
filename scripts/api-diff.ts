#!/usr/bin/env npx tsx
/**
 * Compare Rancher API responses between two instances to find differences.
 * Useful before backporting tests to a release branch.
 *
 * Usage:
 *   npx tsx scripts/api-diff.ts https://rancher-a.example.com https://rancher-b.example.com
 *
 * Environment:
 *   RANCHER_PASSWORD  — password for both instances (default: password1234)
 *   RANCHER_USERNAME  — username for both instances (default: admin)
 */

const ENDPOINTS = [
  // Core
  'v1/management.cattle.io.settings',
  'v1/management.cattle.io.features',
  'v3/settings',

  // Auth
  'v3/authconfigs',
  'v3/globalroles',
  'v3/roletemplates',

  // Provisioning
  'v3/kontainerdrivers',
  'v3/nodedrivers',
  'v1/provisioning.cattle.io.clusters',

  // Fleet
  'v1/fleet.cattle.io.clustergroups',
  'v1/fleet.cattle.io.gitrepos',

  // Explorer
  'v1/apiextensions.k8s.io.customresourcedefinitions',
  'v1/catalog.cattle.io.clusterrepos',
];

interface ApiResponse {
  count?: number;
  data?: any[];
  [key: string]: any;
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const resp = await fetch(`${baseUrl}/v3-public/localProviders/local?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, responseType: 'json' }),
  });
  const body = await resp.json();

  if (!body.token) {
    throw new Error(`Login failed for ${baseUrl}: ${resp.status}`);
  }

  return body.token;
}

async function fetchEndpoint(baseUrl: string, token: string, endpoint: string): Promise<ApiResponse | null> {
  try {
    const resp = await fetch(`${baseUrl}/${endpoint}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!resp.ok) {
      return { _status: resp.status, _error: `HTTP ${resp.status}` };
    }

    return await resp.json();
  } catch (e: any) {
    return { _error: e.message };
  }
}

function extractSchema(data: any[]): Set<string> {
  const keys = new Set<string>();

  for (const item of data.slice(0, 5)) {
    collectKeys(item, '', keys);
  }

  return keys;
}

function collectKeys(obj: any, prefix: string, keys: Set<string>): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    keys.add(path);

    if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null) {
      collectKeys(obj[key], path, keys);
    }
  }
}

async function discoverEndpoints(baseUrl: string, token: string): Promise<string[]> {
  const endpoints: string[] = [];

  // /v1 returns { data: [{ links: { resourceType: url, ... } }] }
  const v1Resp = await fetchEndpoint(baseUrl, token, 'v1');
  const v1Data = (v1Resp as any)?.data || [];

  for (const item of v1Data) {
    const links = item?.links || {};

    for (const [, url] of Object.entries(links)) {
      if (typeof url === 'string' && url.startsWith(`${baseUrl}/v1/`)) {
        endpoints.push(url.replace(`${baseUrl}/`, ''));
      }
    }
  }

  // /v3/ returns { links: { resourceType: url, ... } } directly on root
  const v3Resp = await fetchEndpoint(baseUrl, token, 'v3/');
  const v3Links = (v3Resp as any)?.links || {};

  for (const [, url] of Object.entries(v3Links)) {
    if (typeof url === 'string' && url.startsWith(`${baseUrl}/v3/`)) {
      endpoints.push(url.replace(`${baseUrl}/`, ''));
    }
  }

  return endpoints;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const discover = args.includes('--discover');
  const filteredArgs = args.filter((a) => a !== '--discover');

  if (filteredArgs.length < 2) {
    console.error('Usage: npx tsx scripts/api-diff.ts <url-a> <url-b> [--discover]');
    console.error('  --discover  Auto-discover endpoints from /v1 and /v3 indexes');
    process.exit(1);
  }

  const [urlA, urlB] = filteredArgs.map((u) => u.replace(/\/+$/, ''));
  const username = process.env.RANCHER_USERNAME || 'admin';
  const password = process.env.RANCHER_PASSWORD || 'password1234';

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  console.log(`# API Diff: ${urlA} vs ${urlB}\n`);

  const tokenA = await login(urlA, username, password);
  const tokenB = await login(urlB, username, password);

  const versionA = await fetchEndpoint(urlA, tokenA, 'rancherversion');
  const versionB = await fetchEndpoint(urlB, tokenB, 'rancherversion');

  console.log(`Instance A: ${(versionA as any)?.Version || 'unknown'}`);
  console.log(`Instance B: ${(versionB as any)?.Version || 'unknown'}\n`);

  let endpoints = ENDPOINTS;

  if (discover) {
    console.log('Discovering endpoints...');
    const [endpointsA, endpointsB] = await Promise.all([
      discoverEndpoints(urlA, tokenA),
      discoverEndpoints(urlB, tokenB),
    ]);
    const allEndpoints = new Set([...endpointsA, ...endpointsB]);

    endpoints = [...allEndpoints].sort();

    const aOnlyEndpoints = endpointsA.filter((e) => !endpointsB.includes(e));
    const bOnlyEndpoints = endpointsB.filter((e) => !endpointsA.includes(e));

    if (aOnlyEndpoints.length > 0) {
      console.log(`\n## Endpoints only in A (${aOnlyEndpoints.length}):`);
      aOnlyEndpoints.forEach((e) => console.log(`  ${e}`));
    }

    if (bOnlyEndpoints.length > 0) {
      console.log(`\n## Endpoints only in B (${bOnlyEndpoints.length}):`);
      bOnlyEndpoints.forEach((e) => console.log(`  ${e}`));
    }

    console.log(`\nComparing ${endpoints.length} shared endpoints...\n`);
  }

  console.log('| Endpoint | A count | B count | A-only fields | B-only fields | Status |');
  console.log('|----------|---------|---------|---------------|---------------|--------|');

  for (const endpoint of endpoints) {
    const [respA, respB] = await Promise.all([
      fetchEndpoint(urlA, tokenA, endpoint),
      fetchEndpoint(urlB, tokenB, endpoint),
    ]);

    if (!respA || !respB) {
      console.log(`| ${endpoint} | — | — | — | — | FETCH ERROR |`);
      continue;
    }

    if ((respA as any)._error || (respB as any)._error) {
      const statusA = (respA as any)._status || (respA as any)._error || '?';
      const statusB = (respB as any)._status || (respB as any)._error || '?';

      console.log(`| ${endpoint} | ${statusA} | ${statusB} | — | — | ERROR |`);
      continue;
    }

    const countA = respA.count ?? respA.data?.length ?? '?';
    const countB = respB.count ?? respB.data?.length ?? '?';

    const dataA = respA.data || [];
    const dataB = respB.data || [];

    if (dataA.length === 0 && dataB.length === 0) {
      console.log(`| ${endpoint} | ${countA} | ${countB} | — | — | EMPTY |`);
      continue;
    }

    const schemaA = extractSchema(dataA);
    const schemaB = extractSchema(dataB);

    const aOnly = [...schemaA].filter((k) => !schemaB.has(k));
    const bOnly = [...schemaB].filter((k) => !schemaA.has(k));

    const aOnlyStr =
      aOnly.length > 3 ? `${aOnly.slice(0, 3).join(', ')} +${aOnly.length - 3}` : aOnly.join(', ') || '—';
    const bOnlyStr =
      bOnly.length > 3 ? `${bOnly.slice(0, 3).join(', ')} +${bOnly.length - 3}` : bOnly.join(', ') || '—';

    const status = aOnly.length === 0 && bOnly.length === 0 ? 'MATCH' : 'DRIFT';

    console.log(`| ${endpoint} | ${countA} | ${countB} | ${aOnlyStr} | ${bOnlyStr} | ${status} |`);
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
