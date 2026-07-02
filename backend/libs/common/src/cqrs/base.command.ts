export interface BaseCommandProps {
  /** The user ID of the requester. Required for API calls, optional for internal system calls. */
  requesterUserId?: string;
}

export abstract class Base_Command {
  /** The user ID of the requester. Required for API calls, optional for internal system calls. */
  public readonly requesterUserId?: string;

  constructor(props?: BaseCommandProps) {
    this.requesterUserId = props?.requesterUserId;
  }
}
