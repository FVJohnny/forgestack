import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export interface DeleteUser_CommandProps {
  userIdToDelete: string;
  requesterUserId: string;
}

export class DeleteUser_Command extends Base_Command implements ICommand {
  public readonly userIdToDelete: string;

  constructor(props: DeleteUser_CommandProps) {
    super({ requesterUserId: props.requesterUserId });
    this.userIdToDelete = props.userIdToDelete;
  }
}
