import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  IntegrationEventHandler,
  PasswordResetRequested_IntegrationEvent,
  CorrelationLogger,
} from '@libs/nestjs-common';
import { SendEmail_Command } from '@bc/notifications/application/commands';

@IntegrationEventHandler(PasswordResetRequested_IntegrationEvent)
export class PasswordResetRequested_IntegrationEventHandler {
  private readonly logger = new CorrelationLogger(
    PasswordResetRequested_IntegrationEventHandler.name,
  );

  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  async handleEvent(event: PasswordResetRequested_IntegrationEvent) {
    this.logger.log(
      `📧 Password reset requested - sending reset email to ${event.email} (Reset ID: ${event.passwordResetId}, Expires: ${event.expiresAt})`,
    );

    const appName = process.env.APP_NAME ?? 'ForgeStack';
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3002';
    const resetLink = `${frontendUrl}/reset-password?id=${event.passwordResetId}`;

    const subject = 'Reset your password';
    const expirationTime = new Date(event.expiresAt).toLocaleString();
    const message = `We received a request to reset your password.

Click the link below to create a new password:

${resetLink}

This link will expire at ${expirationTime}.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

For security reasons, never share this link with anyone.

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
