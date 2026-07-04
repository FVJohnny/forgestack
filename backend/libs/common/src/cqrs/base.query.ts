export interface BaseQueryProps {
  /** The user ID of the requester. Required for API calls, optional for internal system calls. */
  requesterUserId?: string;
}

export abstract class Base_Query {
  /** The user ID of the requester. Required for API calls, optional for internal system calls. */
  public readonly requesterUserId?: string;

  constructor(props?: BaseQueryProps) {
    this.requesterUserId = props?.requesterUserId;
  }
}
