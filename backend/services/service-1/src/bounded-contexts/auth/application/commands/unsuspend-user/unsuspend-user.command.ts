import { Base_Command } from '@libs/nestjs-common';
import type { ICommand } from '@nestjs/cqrs';

export interface UnsuspendUser_CommandProps {
  userIdToUnsuspend: string;
  requesterUserId: string;
}

export class UnsuspendUser_Command extends Base_Command implements ICommand {
  public readonly userIdToUnsuspend: string;

  constructor(props: UnsuspendUser_CommandProps) {
    super({ requesterUserId: props.requesterUserId });
    this.userIdToUnsuspend = props.userIdToUnsuspend;
  }
}
