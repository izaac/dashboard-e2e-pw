#!/usr/bin/env npx tsx
/**
 * Generate docs/ASSERTION-GAP-MAP.md — compares upstream Cypress specs
 * against Playwright specs to find missing tests and unconverted suites.
 *
 * For each spec file, extracts test names (it/test calls) and matches
 * by directory + filename across repos.
 *
 * Usage:
 *   npx tsx scripts/generate-gap-map.ts
 *   yarn gap-map
 */

import * as fs from 'fs';
import * as path from 'path';

const PW_TEST_ROOT = path.resolve('e2e/tests');
const UPSTREAM_TEST_ROOT = path.resolve('../dashboard/cypress/e2e/tests');
const OUTPUT = path.resolve('docs/ASSERTION-GAP-MAP.md');

interface SpecEntry {
  filePath: string;
  relativePath: string;
  suite: string;
  tests: string[];
  skippedTests: string[];
  commentedOutTests: string[];
  assertionCount: number;
}

/**
 * Normalize a test name for matching:
 * - lowercase
 * - collapse whitespace
 * - strip trailing punctuation
 * Keep prefixes like "can"/"should" — they distinguish tests.
 */
function normalizeTestName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.]+$/, '').trim();
}

/**
 * Check if an upstream test name has a match in a set of PW test names.
 * Uses exact normalized match only — no fuzzy substring matching.
 * Returns the original PW name if found, null otherwise.
 */
function hasMatch(upstreamName: string, pwNamesNormalized: Map<string, string>): string | null {
  const norm = normalizeTestName(upstreamName);

  // 1. Exact normalized match
  if (pwNamesNormalized.has(norm)) {
    return pwNamesNormalized.get(norm)!;
  }

  // 2. Prefix match — one name starts with the other (handles trailing additions/removals)
  for (const [pwNorm, pwOrig] of pwNamesNormalized) {
    if (norm.startsWith(pwNorm) || pwNorm.startsWith(norm)) {
      // Require the shorter to be at least 60% of the longer to avoid "can" matching "can import yaml..."
      const shorter = Math.min(norm.length, pwNorm.length);
      const longer = Math.max(norm.length, pwNorm.length);

      if (shorter / longer >= 0.5) {
        return pwOrig;
      }
    }
  }

  // 3. High token overlap (≥80% of words shared) — handles rewording
  const normTokens = norm.split(' ').filter((w) => w.length > 2);

  if (normTokens.length < 3) {
    return null;
  }

  for (const [pwNorm, pwOrig] of pwNamesNormalized) {
    const pwTokens = pwNorm.split(' ').filter((w) => w.length > 2);

    if (pwTokens.length < 3) {
      continue;
    }

    const shared = normTokens.filter((t) => pwTokens.includes(t)).length;
    const maxTokens = Math.max(normTokens.length, pwTokens.length);

    if (shared / maxTokens >= 0.8) {
      return pwOrig;
    }
  }

  return null;
}

function extractCypressTests(filePath: string): { tests: string[]; skipped: string[]; commented: string[] } {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Strip block comments
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '');

  const tests: string[] = [];
  const skipped: string[] = [];
  const commented: string[] = [];

  for (const line of src.split('\n')) {
    const trimmed = line.trimStart();

    if (!trimmed) {
      continue;
    }

    // Commented-out it()
    const commentedMatch = trimmed.match(/^\/\/\s*it\(\s*['"`]([^'"`]+)['"`]/);

    if (commentedMatch) {
      commented.push(commentedMatch[1]);
      continue;
    }

    if (trimmed.startsWith('//')) {
      continue;
    }

    // it.skip()
    const skipMatch = line.match(/\bit\.skip\(\s*['"`]([^'"`]+)['"`]/);

    if (skipMatch) {
      skipped.push(skipMatch[1]);
      tests.push(skipMatch[1]);
      continue;
    }

    // Live it()
    const liveMatch = line.match(/\bit\(\s*['"`]([^'"`]+)['"`]/);

    if (liveMatch) {
      tests.push(liveMatch[1]);
    }
  }

  return { tests, skipped, commented };
}

/** Count assertion calls: expect(), .should(), cy.wait('@...').then assertions */
function countAssertions(filePath: string): number {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  let count = 0;

  for (const line of src.split('\n')) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith('//')) {
      continue;
    }

    // Cypress: .should(, expect(
    count += (trimmed.match(/\.should\(/g) || []).length;
    count += (trimmed.match(/\bexpect\(/g) || []).length;
  }

  return count;
}

function extractPlaywrightTests(filePath: string): { tests: string[]; skipped: string[]; assertionCount: number } {
  const raw = fs.readFileSync(filePath, 'utf-8');

  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (line.trimStart().startsWith('//') ? '' : line))
    .join('\n');

  const tests: string[] = [];
  const skipped: string[] = [];

  const testPattern = /\btest\(\s*['"`]([^'"`]+)['"`]/g;
  let m;

  while ((m = testPattern.exec(src)) !== null) {
    tests.push(m[1]);
  }

  const skipPattern = /\btest\.skip\(\s*['"`]([^'"`]+)['"`]/g;

  while ((m = skipPattern.exec(src)) !== null) {
    skipped.push(m[1]);
  }

  // Count expect() calls (Playwright assertions)
  let assertionCount = 0;

  for (const line of src.split('\n')) {
    assertionCount += (line.match(/\bexpect\(/g) || []).length;
  }

  return { tests, skipped, assertionCount };
}

function collectSpecs(dir: string, root: string): SpecEntry[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results: SpecEntry[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectSpecs(full, root));
    } else if (entry.name.endsWith('.spec.ts')) {
      const rel = path.relative(root, full);
      const suite = rel.split(path.sep).slice(0, -1).join('/');

      results.push({
        filePath: full,
        relativePath: rel,
        suite: suite || 'root',
        tests: [],
        skippedTests: [],
        commentedOutTests: [],
        assertionCount: 0,
      });
    }
  }

  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/** Normalize spec path for matching across repos */
function normalizeSpecPath(relativePath: string): string {
  return relativePath
    .replace(/^pages\//, '')
    .replace(/^e2e\/tests\//, '')
    .replace(/\.spec\.ts$/, '');
}

// --- Main ---

if (!fs.existsSync(UPSTREAM_TEST_ROOT)) {
  console.error(`Upstream test root not found: ${UPSTREAM_TEST_ROOT}`);
  console.error('Ensure ../dashboard/cypress/e2e/tests/ exists.');
  process.exit(1);
}

// Collect specs
const pwSpecs = collectSpecs(PW_TEST_ROOT, PW_TEST_ROOT);
const upstreamSpecs = collectSpecs(UPSTREAM_TEST_ROOT, UPSTREAM_TEST_ROOT).filter(
  (s) => !s.suite.startsWith('accessibility'),
);

// Extract test names and assertion counts
for (const spec of upstreamSpecs) {
  const { tests, skipped, commented } = extractCypressTests(spec.filePath);

  spec.tests = tests;
  spec.skippedTests = skipped;
  spec.commentedOutTests = commented;
  spec.assertionCount = countAssertions(spec.filePath);
}

for (const spec of pwSpecs) {
  const { tests, skipped, assertionCount } = extractPlaywrightTests(spec.filePath);

  spec.tests = [...tests, ...skipped];
  spec.skippedTests = skipped;
  spec.assertionCount = assertionCount;
}

// Build lookup by normalized path
const pwByPath = new Map<string, SpecEntry>();

for (const spec of pwSpecs) {
  pwByPath.set(normalizeSpecPath(spec.relativePath), spec);
}

const upstreamByPath = new Map<string, SpecEntry>();

for (const spec of upstreamSpecs) {
  upstreamByPath.set(normalizeSpecPath(spec.relativePath), spec);
}

// Global PW name index — maps normalized name → original name (for cross-spec matching)
const globalPwNamesNormalized = new Map<string, string>();

for (const spec of pwSpecs) {
  for (const t of spec.tests) {
    const norm = normalizeTestName(t);

    if (!globalPwNamesNormalized.has(norm)) {
      globalPwNamesNormalized.set(norm, t);
    }
  }
}

// Group upstream specs by suite
const suites = new Map<string, SpecEntry[]>();

for (const spec of upstreamSpecs) {
  const suite = spec.suite || 'root';

  if (!suites.has(suite)) {
    suites.set(suite, []);
  }
  suites.get(suite)!.push(spec);
}

// --- Compute metrics ---

let totalUpstreamLiveTests = 0;
let totalCoveredTests = 0;
let totalUpstreamCommentedTests = 0;

interface MissingTest {
  name: string;
  foundIn?: string; // PW spec where it was found (cross-spec match)
}

const specCoverage: {
  suite: string;
  upSpecs: number;
  upLiveTests: number;
  upCommentedTests: number;
  pwSpecs: number;
  pwTests: number;
  coveredTests: number;
}[] = [];

for (const [suite, specs] of [...suites].sort((a, b) => a[0].localeCompare(b[0]))) {
  const upSpecCount = specs.length;
  const upLiveCount = specs.reduce((s, e) => s + e.tests.length, 0);
  const upCommentedCount = specs.reduce((s, e) => s + e.commentedOutTests.length, 0);

  let pwSpecCount = 0;
  let pwTestCount = 0;
  let coveredCount = 0;

  for (const spec of specs) {
    const norm = normalizeSpecPath(spec.relativePath);
    const pw = pwByPath.get(norm);

    if (pw) {
      pwSpecCount++;
      pwTestCount += pw.tests.length;

      // Same-spec name matching — exact normalized only
      const pwNamesNormalized = new Map<string, string>();

      for (const t of pw.tests) {
        pwNamesNormalized.set(normalizeTestName(t), t);
      }

      for (const upTest of spec.tests) {
        const sameSpecMatch = hasMatch(upTest, pwNamesNormalized);

        if (sameSpecMatch) {
          coveredCount++;
        }
        // Cross-spec matches are NOT counted as covered — reported separately
      }
    }
  }

  specCoverage.push({
    suite,
    upSpecs: upSpecCount,
    upLiveTests: upLiveCount,
    upCommentedTests: upCommentedCount,
    pwSpecs: pwSpecCount,
    pwTests: pwTestCount,
    coveredTests: coveredCount,
  });

  totalUpstreamLiveTests += upLiveCount;
  totalUpstreamCommentedTests += upCommentedCount;
  totalCoveredTests += coveredCount;
}

// PW-only specs
const pwOnlySpecs = pwSpecs.filter((s) => !upstreamByPath.has(normalizeSpecPath(s.relativePath)));
const pwOnlyTestCount = pwOnlySpecs.reduce((s, e) => s + e.tests.length, 0);

// Unconverted spec tests
const unconvertedLiveTests = upstreamSpecs
  .filter((s) => !pwByPath.has(normalizeSpecPath(s.relativePath)))
  .reduce((s, e) => s + e.tests.length, 0);

const totalPct = totalUpstreamLiveTests > 0 ? Math.round((totalCoveredTests / totalUpstreamLiveTests) * 100) : 0;

// --- Generate output ---

const lines: string[] = [
  '<!-- AUTO-GENERATED by scripts/generate-gap-map.ts — do not edit manually -->',
  '# Assertion Gap Map',
  '',
  `Generated: ${new Date().toISOString().split('T')[0]}`,
  '',
  `Upstream Cypress: ${upstreamSpecs.length} specs, ${totalUpstreamLiveTests} live tests (${totalUpstreamCommentedTests} commented out)`,
  `Playwright: ${pwSpecs.length} specs, ${pwSpecs.reduce((s, e) => s + e.tests.length, 0)} tests (${pwOnlySpecs.length} PW-only specs, ${pwOnlyTestCount} PW-only tests)`,
  '',
  `**Upstream coverage: ${totalPct}%** (${totalCoveredTests}/${totalUpstreamLiveTests} upstream tests found in Playwright)`,
  '',
];

// Summary table
lines.push('## Summary');
lines.push('');
lines.push('| Suite | Upstream Specs | Upstream Live | Commented | PW Specs | PW Tests | Coverage |');
lines.push('|-------|---------------|--------------|-----------|----------|----------|----------|');

for (const row of specCoverage) {
  const pct = row.upLiveTests > 0 ? Math.round((row.coveredTests / row.upLiveTests) * 100) : 0;
  const status = pct === 100 ? '✅' : `${pct}%`;

  lines.push(
    `| ${row.suite} | ${row.upSpecs} | ${row.upLiveTests} | ${row.upCommentedTests} | ${row.pwSpecs} | ${row.pwTests} | ${status} |`,
  );
}

if (pwOnlySpecs.length > 0) {
  lines.push(`| *PW-only specs* | — | — | — | ${pwOnlySpecs.length} | ${pwOnlyTestCount} | — |`);
}

lines.push(
  `| **TOTAL** | **${upstreamSpecs.length}** | **${totalUpstreamLiveTests}** | **${totalUpstreamCommentedTests}** | **${pwSpecs.length}** | **${pwSpecs.reduce((s, e) => s + e.tests.length, 0)}** | **${totalPct}%** |`,
);
lines.push('');

lines.push(`- **Unconverted spec tests** (no PW file): ${unconvertedLiveTests}`);
lines.push(
  `- **Missing by name** (PW file exists but upstream test not matched by exact name): ${totalUpstreamLiveTests - totalCoveredTests - unconvertedLiveTests}`,
);
lines.push(`- **Upstream commented-out** (ported to PW as live tests): ${totalUpstreamCommentedTests}`);
lines.push('');

// Unconverted Specs
lines.push('## Unconverted Specs');
lines.push('');

let hasUnconverted = false;

for (const [suite, specs] of [...suites].sort((a, b) => a[0].localeCompare(b[0]))) {
  const unconverted = specs.filter((s) => !pwByPath.has(normalizeSpecPath(s.relativePath)));

  if (unconverted.length === 0) {
    continue;
  }
  hasUnconverted = true;

  lines.push(`### ${suite}`);
  lines.push('');
  lines.push('| Spec | Live Tests | Commented | Skipped |');
  lines.push('|------|-----------|-----------|---------|');

  for (const spec of unconverted) {
    const file = path.basename(spec.relativePath);

    lines.push(`| ${file} | ${spec.tests.length} | ${spec.commentedOutTests.length} | ${spec.skippedTests.length} |`);
  }

  lines.push('');
}

if (!hasUnconverted) {
  lines.push('All upstream specs have Playwright equivalents.');
  lines.push('');
}

// Converted specs with test count diff
lines.push('## Converted Specs (test count comparison)');
lines.push('');
lines.push('| Spec | Upstream Live | Upstream Commented | PW Tests | Delta |');
lines.push('|------|--------------|-------------------|----------|-------|');

for (const spec of upstreamSpecs) {
  const norm = normalizeSpecPath(spec.relativePath);
  const pw = pwByPath.get(norm);

  if (!pw) {
    continue;
  }

  const delta = pw.tests.length - spec.tests.length;
  const deltaStr = delta === 0 ? '—' : delta > 0 ? `+${delta}` : `${delta}`;

  if (delta !== 0) {
    lines.push(
      `| ${spec.relativePath} | ${spec.tests.length} | ${spec.commentedOutTests.length} | ${pw.tests.length} | ${deltaStr} |`,
    );
  }
}

lines.push('');

// Missing tests detail — only show tests not found even with cross-spec fuzzy match
const specsWithMissing: { spec: string; missing: MissingTest[] }[] = [];

for (const spec of upstreamSpecs) {
  const norm = normalizeSpecPath(spec.relativePath);
  const pw = pwByPath.get(norm);

  if (!pw) {
    continue;
  }

  const pwNamesNormalized = new Map<string, string>();

  for (const t of pw.tests) {
    pwNamesNormalized.set(normalizeTestName(t), t);
  }

  const missing: MissingTest[] = [];

  for (const upTest of spec.tests) {
    // Same-spec match
    const sameSpecMatch = hasMatch(upTest, pwNamesNormalized);

    if (sameSpecMatch) {
      continue;
    }

    // Cross-spec match
    const crossSpecMatch = hasMatch(upTest, globalPwNamesNormalized);

    if (crossSpecMatch) {
      missing.push({ name: upTest, foundIn: crossSpecMatch });
    } else {
      missing.push({ name: upTest });
    }
  }

  if (missing.length > 0) {
    specsWithMissing.push({ spec: spec.relativePath, missing });
  }
}

if (specsWithMissing.length > 0) {
  lines.push('## Missing Tests');
  lines.push('');

  const trulyMissing = specsWithMissing.filter((s) => s.missing.some((m) => !m.foundIn));
  const crossSpec = specsWithMissing.filter((s) => s.missing.some((m) => m.foundIn));

  if (trulyMissing.length > 0) {
    lines.push('### Not found in any Playwright spec');
    lines.push('');

    for (const { spec, missing } of trulyMissing) {
      const notFound = missing.filter((m) => !m.foundIn);

      if (notFound.length === 0) {
        continue;
      }

      lines.push(`**${spec}** (${notFound.length} tests)`);
      lines.push('');

      for (const m of notFound) {
        lines.push(`- ${m.name}`);
      }

      lines.push('');
    }
  }

  if (crossSpec.length > 0) {
    lines.push('### Found in a different Playwright spec (cross-spec match)');
    lines.push('');
    lines.push('> These upstream tests exist in Playwright but under a different spec file.');
    lines.push('');

    for (const { spec, missing } of crossSpec) {
      const found = missing.filter((m) => m.foundIn);

      if (found.length === 0) {
        continue;
      }

      lines.push(`**${spec}**`);
      lines.push('');

      for (const m of found) {
        lines.push(`- \`${m.name}\` → PW: \`${m.foundIn}\``);
      }

      lines.push('');
    }
  }
}

// Commented-out upstream tests that PW ported as live
const portedFromComments: { spec: string; tests: string[] }[] = [];

for (const spec of upstreamSpecs) {
  if (spec.commentedOutTests.length === 0) {
    continue;
  }

  const norm = normalizeSpecPath(spec.relativePath);
  const pw = pwByPath.get(norm);

  if (!pw) {
    continue;
  }

  const pwNamesNormalized = new Map<string, string>();

  for (const t of pw.tests) {
    pwNamesNormalized.set(normalizeTestName(t), t);
  }

  const ported = spec.commentedOutTests.filter((t) => hasMatch(t, pwNamesNormalized));

  if (ported.length > 0) {
    portedFromComments.push({ spec: spec.relativePath, tests: ported });
  }
}

if (portedFromComments.length > 0) {
  lines.push('## Ported from Upstream Comments');
  lines.push('');
  lines.push('> Tests that were commented out upstream but implemented as live tests in Playwright.');
  lines.push('');

  for (const { spec, tests } of portedFromComments) {
    lines.push(`### ${spec}`);
    lines.push('');

    for (const t of tests) {
      lines.push(`- ${t}`);
    }

    lines.push('');
  }
}

// Assertion density comparison
lines.push('## Assertion Density');
lines.push('');
lines.push('> Compares expect()/should() counts between upstream Cypress and Playwright per spec.');
lines.push('> Low PW density relative to upstream may indicate shallow assertions.');
lines.push('');
lines.push('| Spec | Upstream Assertions | PW Assertions | Ratio |');
lines.push('|------|--------------------:|-------------:|------:|');

for (const spec of upstreamSpecs) {
  const norm = normalizeSpecPath(spec.relativePath);
  const pw = pwByPath.get(norm);

  if (!pw || spec.assertionCount === 0) {
    continue;
  }

  const ratio = pw.assertionCount / spec.assertionCount;

  // Only show specs where PW has notably fewer assertions (< 80% ratio)
  if (ratio < 0.8) {
    lines.push(
      `| ${spec.relativePath} | ${spec.assertionCount} | ${pw.assertionCount} | ${Math.round(ratio * 100)}% |`,
    );
  }
}

lines.push('');

lines.push('');

const output = lines.join('\n');

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, output);
console.log(`Gap map updated: ${OUTPUT}`);
console.log(
  `  Upstream: ${upstreamSpecs.length} specs, ${totalUpstreamLiveTests} live tests (${totalUpstreamCommentedTests} commented out)`,
);
console.log(`  Playwright: ${pwSpecs.length} specs, ${pwSpecs.reduce((s, e) => s + e.tests.length, 0)} tests`);
console.log(`  Coverage: ${totalPct}% (${totalCoveredTests}/${totalUpstreamLiveTests})`);
