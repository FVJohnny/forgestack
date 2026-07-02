import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export interface SetMotd_CommandProps {
  content: string;
  requesterUserId: string;
}

export class SetMotd_Command extends Base_Command implements ICommand {
  public readonly content: string;

  constructor(props: SetMotd_CommandProps) {
    super({ requesterUserId: props.requesterUserId });
    this.content = props.content;
  }
}
