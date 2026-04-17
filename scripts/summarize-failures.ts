#!/usr/bin/env npx tsx
/**
 * Summarize Playwright test failures into a single concise report.
 *
 * Reads the test-results/ directory and for each failed test:
 *   1. Parses error-context.md for spec file + line + error message
 *   2. Classifies the failure type (timeout, selector, API, assertion, crash)
 *   3. Cross-references network errors with the failure (e.g. timeout + 500 = API root cause)
 *   4. Checks DOM snapshot for loading spinners / incomplete page state
 *   5. Extracts only the user-land stack frame (skips Playwright internals)
 *
 * Output: one compact block per failure, printed to stdout + written to FAILURE-SUMMARY.md
 *
 * Usage:
 *   npx tsx scripts/summarize-failures.ts [test-results-dir]
 */

import * as fs from 'fs';
import * as path from 'path';

const RESULTS_DIR = process.argv[2] || 'test-results';
const MAX_CONSOLE_LINES = 10;
const MAX_NETWORK_LINES = 15;

// --- Failure classification ---

type FailureType = 'timeout' | 'selector' | 'api-error' | 'assertion' | 'crash' | 'navigation' | 'unknown';

interface DiagnosticHints {
  failureType: FailureType;
  rootCause: string;
  specLocation: string | null;
  flags: string[];
}

const FAILURE_PATTERNS: { type: FailureType; pattern: RegExp; label: string }[] = [
  {
    type: 'timeout',
    pattern: /timed?\s*out|timeout|waiting for (locator|selector|response|navigation)/i,
    label: 'Timeout — element or response never arrived',
  },
  {
    type: 'selector',
    pattern: /locator\.(click|fill|check|select).*strict mode|resolved to \d+ elements|no element found/i,
    label: 'Selector — locator matched 0 or 2+ elements',
  },
  {
    type: 'api-error',
    pattern:
      /\b(5\d{2}|4\d{2})\b.*\b(POST|PUT|DELETE|GET|PATCH)\b|\b(POST|PUT|DELETE|GET|PATCH)\b.*\b(5\d{2}|4\d{2})\b/i,
    label: 'API error — server returned error status',
  },
  {
    type: 'assertion',
    pattern: /expect\(.*\)\.(toBe|toEqual|toHaveText|toContainText|toHaveValue|toBeVisible|toHaveURL|toHaveCount)/i,
    label: 'Assertion — expected value did not match',
  },
  {
    type: 'navigation',
    pattern: /ERR_CONNECTION_REFUSED|ERR_NAME_NOT_RESOLVED|net::|navigating to|page\.goto/i,
    label: 'Navigation — page failed to load',
  },
  {
    type: 'crash',
    pattern: /page (closed|crashed)|target closed|browser.*disconnected/i,
    label: 'Crash — browser or page died',
  },
];

function classifyFailure(errorText: string): { type: FailureType; label: string } {
  for (const p of FAILURE_PATTERNS) {
    if (p.pattern.test(errorText)) {
      return { type: p.type, label: p.label };
    }
  }

  return { type: 'unknown', label: 'Unknown — could not classify automatically' };
}

function extractSpecLocation(errorText: string): string | null {
  // Match lines like "at /path/to/spec.ts:123:45" or "spec.ts:123"
  const specMatch = errorText.match(/(?:at\s+)?(\S*\.spec\.ts:\d+(?::\d+)?)/);

  if (specMatch) {
    return specMatch[1];
  }

  // Fallback: any .ts file that's not in node_modules or playwright internals
  const tsMatch = errorText.match(/(?:at\s+)?((?:e2e|support)\S*\.ts:\d+(?::\d+)?)/);

  return tsMatch ? tsMatch[1] : null;
}

function extractUserStackFrames(stack: string | null): string[] {
  if (!stack) {
    return [];
  }

  return stack
    .split('\n')
    .filter((line) => /\.ts:\d+/.test(line))
    .filter((line) => !/(node_modules|playwright|internal)/.test(line))
    .map((line) => line.trim())
    .slice(0, 5);
}

function detectDomFlags(html: string | null): string[] {
  if (!html) {
    return [];
  }

  const flags: string[] = [];

  // Loading indicators still present = page wasn't ready
  if (/class="[^"]*loading[^"]*"|data-testid="[^"]*loading[^"]*"|class="[^"]*spinner[^"]*"/i.test(html)) {
    flags.push('PAGE-STILL-LOADING: spinner/loading indicator in DOM at failure time');
  }

  // Login page still showing = auth failed or redirect loop
  if (/data-testid="login-submit"|data-testid="local-login-username"/i.test(html)) {
    flags.push('LOGIN-PAGE-VISIBLE: still on login page — auth may have failed');
  }

  // Error banners in the UI
  if (/class="[^"]*growl[^"]*error|class="[^"]*banner[^"]*error|class="[^"]*alert[^"]*danger/i.test(html)) {
    flags.push('UI-ERROR-BANNER: error banner/growl visible in the DOM');
  }

  // Empty state — the main content area is basically empty
  if (/class="[^"]*no-rows[^"]*"|class="[^"]*empty[^"]*"/i.test(html)) {
    flags.push('EMPTY-STATE: table/list shows no rows — data may not have loaded');
  }

  // Modal/dialog open — might be blocking interaction
  if (/class="[^"]*modal[^"]*show|data-testid="[^"]*prompt|data-testid="[^"]*dialog/i.test(html)) {
    flags.push('MODAL-OPEN: a dialog/modal was visible — may be blocking target element');
  }

  return flags;
}

function crossReferenceNetworkAndError(
  errorText: string | null,
  networkErrors: string | null,
  failureType: FailureType,
): string | null {
  if (!networkErrors || !errorText) {
    return null;
  }

  const has5xx = /\[5\d{2}\]/.test(networkErrors);
  const has4xx = /\[4\d{2}\]/.test(networkErrors);

  // Timeout + 5xx = the server is the likely root cause, not a slow selector
  if (failureType === 'timeout' && has5xx) {
    return 'LIKELY ROOT CAUSE: timeout coincides with 5xx API errors — server-side failure, not a UI timing issue';
  }

  // Timeout + 403/401 = auth problem
  if (failureType === 'timeout' && /\[40[13]\]/.test(networkErrors)) {
    return 'LIKELY ROOT CAUSE: timeout coincides with 401/403 — authentication or permission issue';
  }

  // Assertion failure + 5xx = data didn't load correctly
  if (failureType === 'assertion' && has5xx) {
    return 'NOTE: assertion failed AND 5xx errors present — UI may have shown stale/empty data due to API failure';
  }

  // Any failure + many 4xx = something systemic
  if (has4xx) {
    const count4xx = (networkErrors.match(/\[4\d{2}\]/g) || []).length;

    if (count4xx >= 5) {
      return `NOTE: ${count4xx} client errors (4xx) during test — possible session/CSRF issue`;
    }
  }

  return null;
}

// --- Artifact reading ---

interface FailureSummary {
  testDir: string;
  errorContext: string | null;
  consoleLogs: string | null;
  networkErrors: string | null;
  domHtml: string | null;
  screenshot: string | null;
  diagnostics: DiagnosticHints;
}

function findAttachment(dir: string, pattern: string): string | null {
  const attachDir = path.join(dir, 'attachments');
  const searchDirs = [attachDir, dir];

  for (const searchDir of searchDirs) {
    if (!fs.existsSync(searchDir)) {
      continue;
    }

    const files = fs.readdirSync(searchDir);
    const match = files.find((f) => f.includes(pattern));

    if (match) {
      return path.join(searchDir, match);
    }
  }

  return null;
}

function readFileOrNull(filePath: string | null, maxChars?: number): string | null {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  return maxChars ? content.substring(0, maxChars) : content;
}

function tailLines(content: string | null, maxLines: number): string | null {
  if (!content) {
    return null;
  }

  const lines = content.trim().split('\n');

  if (lines.length <= maxLines) {
    return content.trim();
  }

  return `... (${lines.length - maxLines} lines omitted)\n${lines.slice(-maxLines).join('\n')}`;
}

function extractDomSnippet(html: string | null): string | null {
  if (!html) {
    return null;
  }

  const patterns = [
    /class="[^"]*error[^"]*"[^>]*>([^<]{1,200})/gi,
    /class="[^"]*banner[^"]*"[^>]*>([^<]{1,200})/gi,
    /class="[^"]*alert[^"]*"[^>]*>([^<]{1,200})/gi,
  ];

  const snippets: string[] = [];

  for (const re of patterns) {
    let m;

    while ((m = re.exec(html)) !== null && snippets.length < 8) {
      const text = m[1].trim();

      if (text.length > 5) {
        snippets.push(text);
      }
    }
  }

  return snippets.length > 0 ? snippets.join('\n') : null;
}

function diagnose(errorCtx: string | null, networkErrors: string | null, domHtml: string | null): DiagnosticHints {
  const errorText = errorCtx || '';

  const classification = classifyFailure(errorText);
  const specLocation = extractSpecLocation(errorText);
  const flags: string[] = [];

  // DOM-based flags
  flags.push(...detectDomFlags(domHtml));

  // Cross-reference network + error
  const networkHint = crossReferenceNetworkAndError(errorText, networkErrors, classification.type);

  if (networkHint) {
    flags.push(networkHint);
  }

  // Stack frame hint
  const userFrames = extractUserStackFrames(errorText);

  return {
    failureType: classification.type,
    rootCause: classification.label,
    specLocation: specLocation || (userFrames.length > 0 ? userFrames[0] : null),
    flags,
  };
}

function collectFailures(resultsDir: string): FailureSummary[] {
  if (!fs.existsSync(resultsDir)) {
    console.error(`No test-results directory found at: ${resultsDir}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(resultsDir, { withFileTypes: true });
  const failures: FailureSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dir = path.join(resultsDir, entry.name);
    const errorCtxPath = findAttachment(dir, 'error-context');
    const screenshotPath = findAttachment(dir, 'test-failed');

    if (!errorCtxPath && !screenshotPath) {
      continue;
    }

    const errorContext = readFileOrNull(errorCtxPath);
    const networkErrors = tailLines(readFileOrNull(findAttachment(dir, 'network-errors')), MAX_NETWORK_LINES);
    const domHtml = readFileOrNull(findAttachment(dir, 'dom-snapshot'), 50_000);

    failures.push({
      testDir: entry.name,
      errorContext,
      consoleLogs: tailLines(readFileOrNull(findAttachment(dir, 'console-logs')), MAX_CONSOLE_LINES),
      networkErrors,
      domHtml,
      screenshot: screenshotPath,
      diagnostics: diagnose(errorContext, networkErrors, domHtml),
    });
  }

  return failures;
}

// --- Output formatting ---

function formatSummary(failures: FailureSummary[]): string {
  if (failures.length === 0) {
    return 'No failures found in test-results/';
  }

  // Group by failure type for the overview
  const byType = new Map<FailureType, string[]>();

  for (const f of failures) {
    const t = f.diagnostics.failureType;

    if (!byType.has(t)) {
      byType.set(t, []);
    }
    byType.get(t)!.push(f.testDir);
  }

  const lines: string[] = [
    `# Test Failure Summary — ${failures.length} failure(s)`,
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Overview by Type',
  ];

  for (const [type, dirs] of byType) {
    lines.push(`- **${type}** (${dirs.length}): ${dirs.map((d) => d.replace(/-chromium$/, '')).join(', ')}`);
  }

  lines.push('');

  // Detailed per-failure
  for (const f of failures) {
    const d = f.diagnostics;

    lines.push('─'.repeat(70));
    lines.push(`## ${f.testDir}`);
    lines.push(`Type: **${d.failureType}** — ${d.rootCause}`);

    if (d.specLocation) {
      lines.push(`Location: ${d.specLocation}`);
    }

    // Flags (the smart stuff)
    if (d.flags.length > 0) {
      lines.push('');
      lines.push('### Diagnostic Flags');

      for (const flag of d.flags) {
        lines.push(`  ! ${flag}`);
      }
    }

    // Error context — trimmed
    if (f.errorContext) {
      lines.push('');
      lines.push('### Error');
      const ctxLines = f.errorContext.split('\n');

      for (const line of ctxLines) {
        if (line.startsWith('---')) {
          continue;
        }
        // Skip the redundant "Last 30 Console Lines" section — we show our own tail
        if (line.includes('Last 30 Console Lines')) {
          break;
        }
        lines.push(line);
      }
    }

    if (f.networkErrors) {
      lines.push('');
      lines.push('### Network Errors');
      lines.push(f.networkErrors);
    }

    if (f.consoleLogs) {
      lines.push('');
      lines.push('### Console (tail)');
      lines.push(f.consoleLogs);
    }

    // DOM snippet — only the extracted text, not raw HTML
    const domSnippet = extractDomSnippet(f.domHtml);

    if (domSnippet) {
      lines.push('');
      lines.push('### DOM Hints');
      lines.push(domSnippet);
    }

    if (f.screenshot) {
      lines.push('');
      lines.push(`Screenshot: ${f.screenshot}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

// --- Main ---
const failures = collectFailures(RESULTS_DIR);
const output = formatSummary(failures);

console.log(output);

// Also write to file for agents to read
const outputPath = path.join(RESULTS_DIR, 'FAILURE-SUMMARY.md');

fs.writeFileSync(outputPath, output);
console.error(`\nWritten to ${outputPath}`);
