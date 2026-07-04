import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '../../../../cqrs/base.command';

export class RevokeToken_Command extends Base_Command implements ICommand {
  public readonly token: string;

  constructor(props: RevokeToken_Command) {
    super();
    Object.assign(this, props);
  }
}
