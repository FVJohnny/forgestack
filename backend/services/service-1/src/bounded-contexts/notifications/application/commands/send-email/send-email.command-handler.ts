import { EMAIL_SERVICE, type Email_Service } from '@bc/notifications/domain/services/email.service';
import { EmailBody, EmailSubject } from '@bc/notifications/domain/value-objects';
import { Email } from '@bc/shared/domain/value-objects';
import { Base_CommandHandler } from '@libs/nestjs-common';
import { Inject } from '@nestjs/common';
import { SendEmail_Command } from './send-email.command';

export class SendEmail_CommandHandler extends Base_CommandHandler(SendEmail_Command) {
  constructor(
    @Inject(EMAIL_SERVICE)
    private readonly emailService: Email_Service,
  ) {
    super();
  }

  async handle(command: SendEmail_Command) {
    const email = new Email(command.email);
    const subject = new EmailSubject(command.subject);
    const body = new EmailBody(command.message);

    // this.logger.log(`📧 Sending email to: ${email.toValue()} with subject: "${subject.toValue()}"`);

    await this.emailService.send({
      to: email,
      subject,
      body,
    });

    // this.logger.log(`✅ Email sent successfully to: ${email.toValue()}`);
  }

  async authorize(_command: SendEmail_Command) {
    // Authorization logic here if needed
    // Example: check if user has permission to send emails
    return true;
  }

  async validate(_command: SendEmail_Command) {
    // Validation is now handled by value objects on construction
    // The Email, EmailSubject, and EmailBody VOs will throw DomainValidationException
    // if the data is invalid (empty, wrong format, too long, etc.)
  }
}
