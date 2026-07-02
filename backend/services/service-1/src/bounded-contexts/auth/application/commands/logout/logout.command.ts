import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export class Logout_Command extends Base_Command implements ICommand {
  public readonly userId: string;

  constructor(userId: string) {
    super();
    this.userId = userId;
  }
}
