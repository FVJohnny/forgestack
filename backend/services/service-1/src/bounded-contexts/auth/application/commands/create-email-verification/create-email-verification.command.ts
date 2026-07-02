import type { ICommand } from '@nestjs/cqrs';
import { Base_Command } from '@libs/nestjs-common';

export class CreateEmailVerification_Command extends Base_Command implements ICommand {
  public readonly userId: string;
  public readonly email: string;
  // When true (e.g. Google OAuth signups), the email is already verified: skip
  // creating the verification + "verify your email" email, and instead emit the
  // EmailVerified integration event so the welcome email is still sent.
  public readonly emailAlreadyVerified: boolean;

  constructor(props: { userId: string; email: string; emailAlreadyVerified?: boolean }) {
    super();
    this.userId = props.userId;
    this.email = props.email;
    this.emailAlreadyVerified = props.emailAlreadyVerified ?? false;
  }
}
