import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export interface CompleteTask_CommandProps {
  taskId: string;
  requesterUserId: string;
}

export class CompleteTask_Command extends Base_Command implements ICommand {
  public readonly taskId: string;

  constructor(props: CompleteTask_CommandProps) {
    super({ requesterUserId: props.requesterUserId });
    this.taskId = props.taskId;
  }
}
