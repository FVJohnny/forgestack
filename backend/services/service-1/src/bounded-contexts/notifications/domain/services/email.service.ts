/**
 * Email Service Port (Interface)
 *
 * This is a port in hexagonal architecture - it defines WHAT we need,
 * not HOW it's implemented. The infrastructure layer will provide
 * the adapter (concrete implementation).
 */

import type { EmailBody, EmailSubject } from '@bc/notifications/domain/value-objects';
import type { Email } from '@bc/shared/domain/value-objects';

export interface EmailOptions {
  to: Email;
  subject: EmailSubject;
  body: EmailBody;
}

export const EMAIL_SERVICE = Symbol('EmailService');
export interface Email_Service {
  send(options: EmailOptions): Promise<void>;
}
