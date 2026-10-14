import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export interface DeleteTask_CommandProps {
  taskId: string;
  requesterUserId: string;
}

export class DeleteTask_Command extends Base_Command implements ICommand {
  public readonly taskId: string;

  constructor(props: DeleteTask_CommandProps) {
    super({ requesterUserId: props.requesterUserId });
    this.taskId = props.taskId;
  }
}
