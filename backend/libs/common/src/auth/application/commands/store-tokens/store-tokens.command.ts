import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '../../../../cqrs/base.command';

export class StoreTokens_Command extends Base_Command implements ICommand {
  public readonly userId: string;
  public readonly accessToken: string;
  public readonly refreshToken: string;

  constructor(props: StoreTokens_Command) {
    super();
    Object.assign(this, props);
  }
}
