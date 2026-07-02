import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  IntegrationEventHandler,
  EmailVerified_IntegrationEvent,
  CorrelationLogger,
} from '@libs/nestjs-common';
import { SendEmail_Command } from '@bc/notifications/application/commands';

@IntegrationEventHandler(EmailVerified_IntegrationEvent)
export class EmailVerified_IntegrationEventHandler {
  private readonly logger = new CorrelationLogger(EmailVerified_IntegrationEventHandler.name);

  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  async handleEvent(event: EmailVerified_IntegrationEvent) {
    this.logger.log(
      `📧 Email verified - sending welcome email to ${event.email} (User ID: ${event.userId}, Verification ID: ${event.emailVerificationId})`,
    );

    const appName = process.env.APP_NAME ?? 'ForgeStack';
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3002';
    const loginUrl = `${frontendUrl}/login`;

    const subject = `Welcome to ${appName}!`;
    const message = `Your email has been verified successfully!

Thank you for joining ${appName}. Your account is now fully activated and ready to use.

Log in to get started: ${loginUrl}

If you have any questions or need help getting started, our support team is here to assist you.

We're excited to have you on board!

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
