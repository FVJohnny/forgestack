import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  IntegrationEventHandler,
  EmailVerificationCreated_IntegrationEvent,
  CorrelationLogger,
} from '@libs/nestjs-common';
import { SendEmail_Command } from '@bc/notifications/application/commands';

@IntegrationEventHandler(EmailVerificationCreated_IntegrationEvent)
export class EmailVerificationCreated_IntegrationEventHandler {
  private readonly logger = new CorrelationLogger(
    EmailVerificationCreated_IntegrationEventHandler.name,
  );

  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  async handleEvent(event: EmailVerificationCreated_IntegrationEvent) {
    this.logger.log(
      `📧 Email verification created - sending verification email to ${event.email} (User ID: ${event.userId}, Verification ID: ${event.emailVerificationId}, Expires: ${event.expiresAt})`,
    );

    const appName = process.env.APP_NAME ?? 'ForgeStack';
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3002';
    const verificationLink = `${frontendUrl}/verify-email?id=${event.emailVerificationId}`;

    const subject = 'Verify your email address';
    const expirationTime = new Date(event.expiresAt).toLocaleString();
    const message = `Welcome to ${appName}!

You're just one step away from getting started. Please verify your email address by clicking the link below:

${verificationLink}

This link will expire at ${expirationTime}.

If you didn't create an account with us, you can safely ignore this email.

Best regards,
The ${appName} Team`;

    const command = new SendEmail_Command({
      email: event.email,
      subject,
      message,
    });

    await this.commandBus.execute(command);
  }
}
