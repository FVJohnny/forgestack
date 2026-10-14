const { createTreeWithEmptyWorkspace } = require('@nx/devkit/testing');
const boundedContextGenerator = require('./generator');

/**
 * Regression tests for the bounded-context generator: assert the scaffold
 * lands and app.module.ts is wired (import + imports-array entry). If the
 * app.module conventions these tests rely on change, update BOTH the generator
 * and these fixtures.
 */
describe('bounded-context generator', () => {
  // Minimal app.module that already has one bounded-context module, so the
  // generator's "insert after the last BC" logic has an anchor.
  const appModule = [
    "import { Module } from '@nestjs/common';",
    "import { TasksBoundedContextModule } from './bounded-contexts/tasks/tasks.module';",
    '',
    '@Module({',
    '  imports: [',
    '    // BOUNDED CONTEXTS',
    '    TasksBoundedContextModule,',
    '  ],',
    '})',
    'export class AppModule {}',
    '',
  ].join('\n');

  const setup = () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('backend/services/service-2/src/app.module.ts', appModule);
    return tree;
  };

  it('scaffolds the context skeleton with a starter command and controller', async () => {
    const tree = setup();
    await boundedContextGenerator(tree, { name: 'billing', service: 'service-2' });

    const root = 'backend/services/service-2/src/bounded-contexts/billing';
    for (const file of [
      `${root}/billing.module.ts`,
      `${root}/application/commands/do-billing/do-billing.command.ts`,
      `${root}/application/commands/do-billing/do-billing.command-handler.ts`,
      `${root}/interfaces/controllers/do-billing.controller.ts`,
      `${root}/interfaces/controllers/do-billing.params.ts`,
    ]) {
      expect(tree.exists(file)).toBe(true);
    }

    // Name substitutions resolved to PascalCase class names.
    const moduleSrc = tree.read(`${root}/billing.module.ts`, 'utf-8');
    expect(moduleSrc).toContain('export class BillingBoundedContextModule');

    const handlerSrc = tree.read(
      `${root}/application/commands/do-billing/do-billing.command-handler.ts`,
      'utf-8',
    );
    expect(handlerSrc).toContain('class DoBilling_CommandHandler');
    expect(handlerSrc).toContain('Base_CommandHandler(DoBilling_Command)');
  });

  it('wires the module into app.module.ts (import + imports array)', async () => {
    const tree = setup();
    await boundedContextGenerator(tree, { name: 'billing', service: 'service-2' });

    const src = tree.read('backend/services/service-2/src/app.module.ts', 'utf-8');
    expect(src).toContain(
      "import { BillingBoundedContextModule } from './bounded-contexts/billing/billing.module';",
    );
    // Added to the imports array right after the existing BC entry.
    expect(src).toMatch(/TasksBoundedContextModule,\n\s*BillingBoundedContextModule,/);
  });

  it('honours a custom command name', async () => {
    const tree = setup();
    await boundedContextGenerator(tree, {
      name: 'billing',
      service: 'service-2',
      command: 'charge-card',
    });

    const root = 'backend/services/service-2/src/bounded-contexts/billing';
    expect(tree.exists(`${root}/application/commands/charge-card/charge-card.command.ts`)).toBe(
      true,
    );
    expect(
      tree.read(`${root}/application/commands/charge-card/charge-card.command.ts`, 'utf-8'),
    ).toContain('class ChargeCard_Command');
  });

  it('rejects a non-kebab-case name', async () => {
    const tree = setup();
    await expect(
      boundedContextGenerator(tree, { name: 'Billing', service: 'service-2' }),
    ).rejects.toThrow(/kebab-case/);
  });

  it('fails when the target service does not exist', async () => {
    const tree = setup();
    await expect(
      boundedContextGenerator(tree, { name: 'billing', service: 'nope' }),
    ).rejects.toThrow(/not found/);
  });
});
