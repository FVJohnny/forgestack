import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export class VerifyUserEmail_Command extends Base_Command implements ICommand {
  constructor(public readonly userId: string) {
    super();
  }
}
