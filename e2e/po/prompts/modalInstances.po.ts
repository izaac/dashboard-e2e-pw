import type { Page } from '@playwright/test';
import GenericPrompt from '@/e2e/po/prompts/genericPrompt.po';
import GenericDialog from '@/e2e/po/prompts/genericDialog.po';

export function promptModal(page: Page): GenericPrompt {
  return new GenericPrompt(page, '.modal-container');
}

export function dialogModal(page: Page): GenericDialog {
  return new GenericDialog(page);
}
