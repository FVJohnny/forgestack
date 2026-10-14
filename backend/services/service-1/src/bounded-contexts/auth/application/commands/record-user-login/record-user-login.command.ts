import { Base_Command } from '@libs/nestjs-common';
import type { ICommand } from '@nestjs/cqrs';

// Records everything a login touches on the User aggregate in one command:
// last-login time plus the login IP and User-Agent. Folding these into a single
// command means one read-modify-write of the user document per login. Two
// separate commands each did a full-document overwrite, so whichever saved last
// clobbered the other's field (the last-login update or the identity append).
export class RecordUserLogin_Command extends Base_Command implements ICommand {
  public readonly userId!: string;
  // Optional so callers that cannot resolve the request (for example a flow with
  // no HTTP context) can still record the login time.
  public readonly ip?: string;
  public readonly userAgent?: string;

  constructor(props: { userId: string; ip?: string; userAgent?: string }) {
    super();
    Object.assign(this, props);
  }
}
