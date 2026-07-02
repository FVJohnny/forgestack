import { SendEmailError } from '@bc/notifications/domain/errors';
import { EmailBody, EmailSubject } from '@bc/notifications/domain/value-objects';
import { Email } from '@bc/shared/domain/value-objects';
import type { Email_Service, EmailOptions } from './email.service';

/**
 * Basic validation test to prevent Jest "no tests found" error
 */
describe('EmailService Contract Test Suite', () => {
  it('exports testEmailServiceContract function', () => {
    expect(typeof testEmailServiceContract).toBe('function');
  });
});

export function testEmailServiceContract(
  description: string,
  createService: (shouldFail?: boolean) => Promise<Email_Service> | Email_Service,
  setupTeardown?: {
    beforeAll?: () => Promise<void>;
    afterAll?: () => Promise<void>;
    beforeEach?: () => Promise<void>;
    afterEach?: () => Promise<void>;
  },
) {
  const createEmailOptions = (
    overrides?: Partial<{
      to: Email;
      subject: EmailSubject;
      body: EmailBody;
    }>,
  ): EmailOptions => ({
    to: overrides?.to ?? Email.random(),
    subject: overrides?.subject ?? new EmailSubject('Test Subject'),
    body: overrides?.body ?? new EmailBody('Test email body'),
  });

  describe(`EmailService Contract: ${description}`, () => {
    if (setupTeardown?.beforeAll) {
      beforeAll(setupTeardown.beforeAll, 30000);
    }

    if (setupTeardown?.afterAll) {
      afterAll(setupTeardown.afterAll, 30000);
    }

    if (setupTeardown?.beforeEach) {
      beforeEach(setupTeardown.beforeEach);
    }

    if (setupTeardown?.afterEach) {
      afterEach(setupTeardown.afterEach);
    }

    describe('send', () => {
      it('should send email without throwing exceptions', async () => {
        // Arrange
        const service = await createService();
        const options = createEmailOptions();

        // Act & Assert
        await expect(service.send(options)).resolves.not.toThrow();
      });
    });

    describe('error handling', () => {
      it('should wrap infrastructure errors in SendEmailError if they occur', async () => {
        const service = await createService(true);
        const options = createEmailOptions();

        await expect(service.send(options)).rejects.toThrow(SendEmailError);
      });
    });
  });
}
