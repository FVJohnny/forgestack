import type { IQuery } from '@nestjs/cqrs';

export interface GetSigninActivity_QueryProps {
  // Always the requester's own id, taken from the JWT in the controller, so a
  // user can only ever read their own sign-in activity.
  userId: string;
}

export class GetSigninActivity_Query implements IQuery {
  public readonly userId: string;

  constructor(props: GetSigninActivity_QueryProps) {
    this.userId = props.userId;
  }
}
