import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export class RegisterOrLinkGoogleUser_Command extends Base_Command implements ICommand {
  public readonly accessToken: string;

  constructor(props: { accessToken: string }) {
    super();
    this.accessToken = props.accessToken;
  }
}
