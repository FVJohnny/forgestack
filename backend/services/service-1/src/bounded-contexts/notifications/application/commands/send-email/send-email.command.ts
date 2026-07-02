import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export interface SendEmailCommandProps {
  email: string;
  subject: string;
  message: string;
}

export class SendEmail_Command extends Base_Command implements ICommand {
  public readonly email: string;
  public readonly subject: string;
  public readonly message: string;

  constructor(props: SendEmailCommandProps) {
    super();
    this.email = props.email;
    this.subject = props.subject;
    this.message = props.message;
  }
}
