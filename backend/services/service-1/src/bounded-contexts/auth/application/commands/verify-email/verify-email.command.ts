import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export class VerifyEmail_Command extends Base_Command implements ICommand {
  public readonly emailVerificationId: string;

  constructor(props: VerifyEmail_Command) {
    super();
    this.emailVerificationId = props.emailVerificationId;
  }
}
