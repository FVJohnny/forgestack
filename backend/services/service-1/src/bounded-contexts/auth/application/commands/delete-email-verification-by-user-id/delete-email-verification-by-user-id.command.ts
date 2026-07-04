import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export class DeleteEmailVerificationByUserId_Command extends Base_Command implements ICommand {
  public readonly userId: string;

  constructor(props: DeleteEmailVerificationByUserId_Command) {
    super();
    this.userId = props.userId;
  }
}
