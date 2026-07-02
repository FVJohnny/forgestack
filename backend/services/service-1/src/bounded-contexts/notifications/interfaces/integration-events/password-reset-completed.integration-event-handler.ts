import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  IntegrationEventHandler,
  PasswordResetCompleted_IntegrationEvent,
  CorrelationLogger,
} from '@libs/nestjs-common';
import { SendEmail_Command } from '@bc/notifications/application/commands';

@IntegrationEventHandler(PasswordResetCompleted_IntegrationEvent)
export class PasswordResetCompleted_IntegrationEventHandler {
  private readonly logger = new CorrelationLogger(
    PasswordResetCompleted_IntegrationEventHandler.name,
  );

  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  async handleEvent(event: PasswordResetCompleted_IntegrationEvent) {
    this.logger.log(
      `📧 Password reset completed - sending confirmation email to ${event.email} (User ID: ${event.userId})`,
    );

    const appName = process.env.APP_NAME ?? 'ForgeStack';
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3002';
    const loginUrl = `${frontendUrl}/login`;

    const subject = 'Your password has been changed';
    const message = `Your password has been successfully changed.

You can now log in to your account using your new password: ${loginUrl}

If you did not make this change, please contact our support team immediately to secure your account. We recommend:
• Resetting your password again
• Checking your account activity
• Enabling two-factor authentication if available

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
