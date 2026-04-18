import ComponentPo from '@/e2e/po/components/component.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import SelectOrCreateAuthPo from '@/e2e/po/components/select-or-create-auth.po';

export default class RegistryConfigsPo extends ComponentPo {
  registryAuthHost(index: number): LabeledInputPo {
    return new LabeledInputPo(this.page, `[data-testid="registry-auth-host-input-${index}"]`);
  }

  async addRegistryAuthHost(index: number, host: string): Promise<void> {
    await this.registryAuthHost(index).set(host);
  }

  registryAuthSelectOrCreate(index: number): SelectOrCreateAuthPo {
    return new SelectOrCreateAuthPo(this.page, `[data-testid="registry-auth-select-or-create-${index}"]`);
  }
}
