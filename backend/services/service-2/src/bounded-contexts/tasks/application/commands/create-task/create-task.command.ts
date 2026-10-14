import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export interface CreateTask_CommandProps {
  title: string;
  requesterUserId: string;
}

export class CreateTask_Command extends Base_Command implements ICommand {
  public readonly title: string;

  constructor(props: CreateTask_CommandProps) {
    super({ requesterUserId: props.requesterUserId });
    this.title = props.title;
  }
}
