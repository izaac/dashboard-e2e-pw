import type { Page, ConsoleMessage } from '@playwright/test';

/**
 * Watches for "resourceversion too old" console warnings and reloads the page once.
 *
 * Steve watches can enter a backoff loop when the resource version is stale,
 * causing tables to never populate. A single reload resets the watches.
 *
 * Debounces 2s to let in-flight route handlers complete before reloading.
 *
 * Returns a cleanup function to remove the listener.
 */
export function guardStaleResourceWatch(page: Page): () => void {
  let reloaded = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const handler = (msg: ConsoleMessage) => {
    if (!reloaded && msg.type() === 'warning' && msg.text().includes('resourceversion too old')) {
      // Debounce: wait for in-flight route handlers to complete
      if (!timer) {
        timer = setTimeout(async () => {
          if (!reloaded) {
            reloaded = true;
            await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
          }
        }, 2000);
      }
    }
  };

  page.on('console', handler);

  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    page.off('console', handler);
  };
}
