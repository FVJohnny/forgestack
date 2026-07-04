import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export interface DeleteMotd_CommandProps {
  requesterUserId: string;
}

export class DeleteMotd_Command extends Base_Command implements ICommand {
  constructor(props: DeleteMotd_CommandProps) {
    super({ requesterUserId: props.requesterUserId });
  }
}
