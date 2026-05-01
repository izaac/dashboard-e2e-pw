#!/usr/bin/env npx tsx
/**
 * Classify test.skip() calls across the E2E suite.
 *
 * Scans all spec files for test.skip() patterns and categorizes them:
 *   - INFRA: Missing credentials or infrastructure (AWS, Azure, GKE, etc.)
 *   - BLOCKED: Known upstream bug or issue reference
 *   - FLAKY: Known flaky test
 *   - ENV: Feature flag or environment requirement
 *   - UNCATEGORIZED: No standard prefix in the skip reason
 *
 * Usage:
 *   npx tsx scripts/classify-skips.ts
 *   yarn classify-skips
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TESTS_DIR = join(ROOT, 'e2e', 'tests');

interface SkipEntry {
  file: string;
  line: number;
  reason: string;
  category: string;
}

function categorize(reason: string): string {
  const lower = reason.toLowerCase();

  if (
    /aws|azure|gke|aks|eks|credential|cred|node.*ip|node.*key|subscription|secret.*key|service.*account/.test(lower)
  ) {
    return 'INFRA';
  }
  if (/blocked|issue|bug|#\d+|rancher\/|github\.com/.test(lower)) {
    return 'BLOCKED';
  }
  if (/flaky|race|intermittent|unstable/.test(lower)) {
    return 'FLAKY';
  }
  if (/feature.*flag|env|flag.*not|requires.*flag|prime|no.*vai|harvester|vue3.*skip/.test(lower)) {
    return 'ENV';
  }
  if (/snapshot test|tohavescreenshot/.test(lower)) {
    return 'VISUAL';
  }
  if (/downstream|provisioned cluster|cluster.*machine|fleet.*multi|custom node/.test(lower)) {
    return 'INFRA';
  }
  if (/operator.*not|extension.*not|crd.*not|chart.*not|not installed|not available|not deployed/.test(lower)) {
    return 'PREREQ';
  }
  if (/bootstrap|already exist|already bootstrap/.test(lower)) {
    return 'CONDITIONAL';
  }

  return 'UNCATEGORIZED';
}

function walkDir(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.endsWith('.spec.ts')) {
      results.push(full);
    }
  }

  return results;
}

function extractSkips(filePath: string): SkipEntry[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries: SkipEntry[] = [];
  const rel = relative(ROOT, filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match test.skip(...) patterns
    const match = line.match(/test\.skip\s*\(([^)]*)\)/);

    if (match) {
      // Extract the reason string (second argument or first if boolean skip)
      const args = match[1];
      let reason = '';

      // test.skip(condition, 'reason')
      const reasonMatch = args.match(/,\s*['"`]([^'"`]+)['"`]/);

      if (reasonMatch) {
        reason = reasonMatch[1];
      } else {
        // test.skip(true, 'reason') or test.skip('reason') on next lines
        const fullReason = args.match(/['"`]([^'"`]+)['"`]/);

        if (fullReason) {
          reason = fullReason[1];
        } else {
          reason = args.trim();
        }
      }

      entries.push({
        file: rel,
        line: i + 1,
        reason: reason || '(no reason given)',
        category: reason ? categorize(reason) : 'UNCATEGORIZED',
      });
    }
  }

  return entries;
}

// Main
const specs = walkDir(TESTS_DIR);
const allSkips: SkipEntry[] = [];

for (const spec of specs) {
  allSkips.push(...extractSkips(spec));
}

// Group by category
const grouped = new Map<string, SkipEntry[]>();

for (const skip of allSkips) {
  const list = grouped.get(skip.category) || [];

  list.push(skip);
  grouped.set(skip.category, list);
}

// Output
const categories = ['INFRA', 'BLOCKED', 'FLAKY', 'ENV', 'VISUAL', 'PREREQ', 'CONDITIONAL', 'UNCATEGORIZED'];

console.log(`\n# Skip Classification Report\n`);
console.log(`Total skips: ${allSkips.length} across ${new Set(allSkips.map((s) => s.file)).size} files\n`);
console.log(`| Category | Count |`);
console.log(`|----------|-------|`);

for (const cat of categories) {
  const count = grouped.get(cat)?.length || 0;

  if (count > 0) {
    console.log(`| ${cat} | ${count} |`);
  }
}

console.log('');

for (const cat of categories) {
  const entries = grouped.get(cat);

  if (!entries?.length) {
    continue;
  }

  console.log(`## ${cat} (${entries.length})\n`);

  for (const entry of entries) {
    console.log(`- \`${entry.file}:${entry.line}\` — ${entry.reason}`);
  }

  console.log('');
}
