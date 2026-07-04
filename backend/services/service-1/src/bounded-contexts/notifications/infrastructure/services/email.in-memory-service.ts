import { SendEmailError } from '@bc/notifications/domain/errors';
import type { Email_Service, EmailOptions } from '@bc/notifications/domain/services/email.service';
import { CorrelationLogger } from '@libs/nestjs-common';
import { Injectable, Optional } from '@nestjs/common';

/**
 * In-Memory Email Service Adapter
 *
 * This is an adapter in hexagonal architecture - it implements the Email_Service port
 * for development/testing purposes by logging emails to the console instead of
 * actually sending them.
 *
 * Use this in development environments or for testing.
 */
@Injectable()
export class Email_InMemoryService implements Email_Service {
  private readonly logger = new CorrelationLogger(Email_InMemoryService.name);

  /**
   * Track sent emails for testing purposes
   * Only populated when used in tests
   */
  public sentEmails: EmailOptions[] = [];

  constructor(@Optional() private readonly shouldFail: boolean = false) {}

  async send(options: EmailOptions): Promise<void> {
    try {
      this.logger.log('📧 ===== EMAIL SENT (Console) =====');
      this.logger.log(`📬 To: ${options.to.toValue()}`);
      this.logger.log(`📋 Subject: ${options.subject.toValue()}`);
      this.logger.log(`📝 Body: ${options.body.toValue()}`);
      this.logger.log('📧 ================================');

      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate failure for testing error handling
      if (this.shouldFail) {
        throw new Error('Simulated email service failure');
      }

      // Track sent emails for testing
      this.sentEmails.push(options);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to.toValue()}:`, error);
      throw new SendEmailError(options.to.toValue(), error);
    }
  }
}
