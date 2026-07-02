import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export interface RequestPasswordResetCommandProps {
  email: string;
}

export class RequestPasswordReset_Command extends Base_Command implements ICommand {
  public readonly email: string;

  constructor(props: RequestPasswordResetCommandProps) {
    super();
    this.email = props.email;
  }
}
