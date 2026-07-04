import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export interface RegisterUserCommandProps {
  email: string;
  password: string;
  /** Optional role override; only the bootstrap seeder sets this (to 'admin'). */
  role?: string;
}

export class RegisterUser_Command extends Base_Command implements ICommand {
  public readonly email: string;
  public readonly password: string;
  public readonly role?: string;

  constructor(props: RegisterUserCommandProps) {
    super();
    this.email = props.email;
    this.password = props.password;
    this.role = props.role;
  }
}
