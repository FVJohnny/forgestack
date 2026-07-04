import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { RuntimeAutoDiscovery } from './runtime-auto-discovery.util';

/**
 * Item 48: discovery must FAIL LOUD. A handler file that throws when required
 * (bad import, runtime error) must propagate instead of being silently
 * dropped, and a suffix-matching file that exports no matching class must warn.
 *
 * These use real files under a temp bounded-context tree and require .ts via
 * ts-jest (NODE_ENV=test → the util loads .ts).
 */
describe('RuntimeAutoDiscovery (item 48)', () => {
  let root: string;

  const cmdDir = () => path.join(root, 'application/commands/sample');

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-'));
    fs.mkdirSync(cmdDir(), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('discovers a well-formed handler', () => {
    fs.writeFileSync(
      path.join(cmdDir(), 'good.command-handler.ts'),
      'export class Good_CommandHandler {}\n',
    );

    const result = RuntimeAutoDiscovery.discoverAllComponents(root);
    expect(result.handlers.map((h) => h.name)).toContain('Good_CommandHandler');
  });

  it('throws when a matched handler file fails to load (does not swallow)', () => {
    fs.writeFileSync(
      path.join(cmdDir(), 'broken.command-handler.ts'),
      "throw new Error('boom at require time');\n",
    );

    expect(() => RuntimeAutoDiscovery.discoverAllComponents(root)).toThrow(/boom at require time/);
  });

  it('warns (not throws) when a matched file exports no *Handler class', () => {
    fs.writeFileSync(
      path.join(cmdDir(), 'mistyped.command-handler.ts'),
      // Note the wrong suffix on the class name — a typical rename typo.
      'export class Mistyped_CommandHandlr {}\n',
    );

    const warnSpy = jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn((RuntimeAutoDiscovery as any).logger, 'warn')
      .mockImplementation(() => {});

    const result = RuntimeAutoDiscovery.discoverAllComponents(root);

    expect(result.handlers).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exports no *Handler class'));
    warnSpy.mockRestore();
  });
});
