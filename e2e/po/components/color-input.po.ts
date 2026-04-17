import ComponentPo from '@/e2e/po/components/component.po';

export default class ColorInputPo extends ComponentPo {
  async value(): Promise<string> {
    const text = await this.self().locator('.color-value').textContent();

    return (text || '').trim().toLowerCase();
  }

  async previewColor(): Promise<string> {
    return this.self()
      .locator('.color-display')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  }

  async set(color: string): Promise<void> {
    await this.self()
      .locator('input')
      .evaluate((el, c) => {
        (el as HTMLInputElement).value = c;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, color);
  }
}
