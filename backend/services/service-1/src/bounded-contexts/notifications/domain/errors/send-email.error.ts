import { BaseException } from '@libs/nestjs-common';
import { HttpStatus } from '@nestjs/common';

/**
 * Domain Error: Email Sending Failed
 *
 * This is a DOMAIN error because sending an email is a domain operation.
 * Infrastructure failures (SMTP, network) are caught and mapped to this error.
 *
 * Why domain and not infrastructure?
 * - From the domain perspective, "email sending failed" is a business failure
 * - The application layer doesn't care WHY it failed (SMTP, network, etc.)
 * - The application layer only cares THAT it failed
 * - This allows infrastructure to change (SMTP → SendGrid → AWS SES) without
 *   affecting the domain or application layers
 */
export class SendEmailError extends BaseException {
  constructor(
    public readonly recipient: string,
    public readonly originalError: Error,
  ) {
    super(
      `Failed to send email to '${recipient}': ${originalError.message}`,
      'SEND_EMAIL_FAILED',
      HttpStatus.INTERNAL_SERVER_ERROR,
      originalError,
    );
  }
}
