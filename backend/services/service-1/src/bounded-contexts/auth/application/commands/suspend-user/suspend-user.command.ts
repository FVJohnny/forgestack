import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export interface SuspendUser_CommandProps {
  userIdToSuspend: string;
  requesterUserId: string;
}

export class SuspendUser_Command extends Base_Command implements ICommand {
  public readonly userIdToSuspend: string;

  constructor(props: SuspendUser_CommandProps) {
    super({ requesterUserId: props.requesterUserId });
    this.userIdToSuspend = props.userIdToSuspend;
  }
}
