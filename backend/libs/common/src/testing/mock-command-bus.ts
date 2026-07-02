import type { ICommand, ICommandBus } from '@nestjs/cqrs';

import { ApplicationException } from '../errors';

export interface MockCommandBusOptions {
  shouldFail?: boolean;
}

/**
 * Lightweight CommandBus test double that only records executed commands.
 */
export class MockCommandBus implements ICommandBus {
  public readonly commands: ICommand[] = [];
  public shouldFail: boolean;

  constructor(options: MockCommandBusOptions = {}) {
    this.shouldFail = options.shouldFail ?? false;
  }

  async execute<T extends ICommand>(command: T, ..._args: unknown[]): Promise<void> {
    if (this.shouldFail) {
      throw new ApplicationException('CommandBus execute failed');
    }

    this.commands.push(command);
  }
}
