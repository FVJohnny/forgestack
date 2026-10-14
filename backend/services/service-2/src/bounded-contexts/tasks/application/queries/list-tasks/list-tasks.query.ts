import type { IQuery } from '@nestjs/cqrs';

export interface ListTasks_QueryProps {
  // Always the requester's own id, taken from the JWT in the controller, so
  // ownership is enforced by construction: there is no way to ask for someone
  // else's tasks.
  userId: string;
}

export class ListTasks_Query implements IQuery {
  public readonly userId: string;

  constructor(props: ListTasks_QueryProps) {
    this.userId = props.userId;
  }
}
