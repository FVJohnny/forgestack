import { testEmailServiceContract } from '@bc/notifications/domain/services/email.service.spec';
import type { Transporter } from 'nodemailer';
import { Email_SmtpService } from './email.smtp-service';

describe('Email_SmtpService', () => {
  testEmailServiceContract('SMTP Implementation', (shouldFail) => {
    const mockTransporter = createMockTransporter(shouldFail);
    return new Email_SmtpService(mockTransporter);
  });
});

const createMockTransporter = (shouldFail: boolean = false): Transporter => {
  return {
    sendMail: jest.fn().mockImplementation(async () => {
      if (shouldFail) {
        throw new Error('SMTP connection failed');
      }
      return { messageId: 'mock-message-id-123' };
    }),
  } as unknown as Transporter;
};
