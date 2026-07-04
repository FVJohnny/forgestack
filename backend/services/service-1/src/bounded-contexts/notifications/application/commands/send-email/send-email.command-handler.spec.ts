import { SendEmailError } from '@bc/notifications/domain/errors';
import { Email_InMemoryService } from '@bc/notifications/infrastructure/services/email.in-memory-service';
import { DomainValidationException } from '@libs/nestjs-common';
import { SendEmail_Command } from './send-email.command';
import { SendEmail_CommandHandler } from './send-email.command-handler';

describe('SendEmail_CommandHandler', () => {
  const createCommand = (
    params: {
      email?: string;
      subject?: string;
      message?: string;
    } = {},
  ) =>
    new SendEmail_Command({
      email: params.email ?? 'test@example.com',
      subject: params.subject ?? 'Test Subject',
      message: params.message ?? 'Test message body',
    });

  const setup = (params: { shouldFailEmailService?: boolean } = {}) => {
    const { shouldFailEmailService = false } = params;

    // Use the actual Email_InMemoryService (which is designed for testing)
    const emailService = new Email_InMemoryService(shouldFailEmailService);

    const handler = new SendEmail_CommandHandler(emailService);

    return { emailService, handler };
  };

  describe('Happy Path', () => {
    it('should send email with valid email, subject, and body', async () => {
      // Arrange
      const { handler, emailService } = setup();
      const command = createCommand({
        email: 'user@example.com',
        subject: 'Welcome!',
        message: 'Welcome to our platform!',
      });

      // Act
      await handler.execute(command);

      // Assert
      expect(emailService.sentEmails).toHaveLength(1);
      const sentEmail = emailService.sentEmails[0];
      expect(sentEmail.to.toValue()).toBe('user@example.com');
      expect(sentEmail.subject.toValue()).toBe('Welcome!');
      expect(sentEmail.body.toValue()).toBe('Welcome to our platform!');
    });

    it('should normalize email to lowercase', async () => {
      // Arrange
      const { handler, emailService } = setup();
      const command = createCommand({
        email: 'User@EXAMPLE.COM',
        subject: 'Test',
        message: 'Test message',
      });

      // Act
      await handler.execute(command);

      // Assert
      expect(emailService.sentEmails[0].to.toValue()).toBe('user@example.com');
    });

    it('should trim whitespace from subject and body', async () => {
      // Arrange
      const { handler, emailService } = setup();
      const command = createCommand({
        email: 'test@example.com',
        subject: '  Test Subject  ',
        message: '  Test message  ',
      });

      // Act
      await handler.execute(command);

      // Assert
      expect(emailService.sentEmails[0].subject.toValue()).toBe('Test Subject');
      expect(emailService.sentEmails[0].body.toValue()).toBe('Test message');
    });
  });

  describe('Validation - Email Value Object', () => {
    it('should throw DomainValidationException for invalid email format', async () => {
      // Arrange
      const { handler } = setup();
      const command = createCommand({ email: 'invalid-email' });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should throw DomainValidationException for email without @', async () => {
      // Arrange
      const { handler } = setup();
      const command = createCommand({ email: 'notanemail.com' });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should throw DomainValidationException for email without domain', async () => {
      // Arrange
      const { handler } = setup();
      const command = createCommand({ email: 'user@' });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });
  });

  describe('Validation - EmailSubject Value Object', () => {
    it('should throw DomainValidationException for empty subject', async () => {
      // Arrange
      const { handler } = setup();
      const command = createCommand({ subject: '' });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should throw DomainValidationException for whitespace-only subject', async () => {
      // Arrange
      const { handler } = setup();
      const command = createCommand({ subject: '   ' });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should throw DomainValidationException for subject exceeding max length', async () => {
      // Arrange
      const { handler } = setup();
      const longSubject = 'a'.repeat(101); // Max is 100 characters
      const command = createCommand({ subject: longSubject });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should accept subject at max length (100 characters)', async () => {
      // Arrange
      const { handler, emailService } = setup();
      const maxLengthSubject = 'a'.repeat(100);
      const command = createCommand({ subject: maxLengthSubject });

      // Act
      await handler.execute(command);

      // Assert
      expect(emailService.sentEmails[0].subject.toValue()).toBe(maxLengthSubject);
    });
  });

  describe('Validation - EmailBody Value Object', () => {
    it('should throw DomainValidationException for empty body', async () => {
      // Arrange
      const { handler } = setup();
      const command = createCommand({ message: '' });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should throw DomainValidationException for whitespace-only body', async () => {
      // Arrange
      const { handler } = setup();
      const command = createCommand({ message: '   ' });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should throw DomainValidationException for body exceeding max length', async () => {
      // Arrange
      const { handler } = setup();
      const longBody = 'a'.repeat(100001); // Max is 100,000 characters
      const command = createCommand({ message: longBody });

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(DomainValidationException);
    });

    it('should accept body at max length (100,000 characters)', async () => {
      // Arrange
      const { handler, emailService } = setup();
      const maxLengthBody = 'a'.repeat(100000);
      const command = createCommand({ message: maxLengthBody });

      // Act
      await handler.execute(command);

      // Assert
      expect(emailService.sentEmails[0].body.toValue()).toBe(maxLengthBody);
    });

    it('should accept long body with newlines and special characters', async () => {
      // Arrange
      const { handler, emailService } = setup();
      const complexBody = 'Hello!\n\nThis is a test.\n\n<html>Special chars: @#$%</html>';
      const command = createCommand({ message: complexBody });

      // Act
      await handler.execute(command);

      // Assert
      expect(emailService.sentEmails[0].body.toValue()).toBe(complexBody.trim());
    });
  });

  describe('Error Cases - Email Service Failures', () => {
    it('should throw SendEmailError when email service fails', async () => {
      // Arrange
      const { handler } = setup({ shouldFailEmailService: true });
      const command = createCommand();

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(SendEmailError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle email with plus addressing', async () => {
      // Arrange
      const { handler, emailService } = setup();
      const command = createCommand({ email: 'user+tag@example.com' });

      // Act
      await handler.execute(command);

      // Assert
      expect(emailService.sentEmails[0].to.toValue()).toBe('user+tag@example.com');
    });

    it('should handle email with subdomains', async () => {
      // Arrange
      const { handler, emailService } = setup();
      const command = createCommand({ email: 'user@mail.example.co.uk' });

      // Act
      await handler.execute(command);

      // Assert
      expect(emailService.sentEmails[0].to.toValue()).toBe('user@mail.example.co.uk');
    });

    it('should handle unicode characters in body', async () => {
      // Arrange
      const { handler, emailService } = setup();
      const command = createCommand({ message: 'Hello 世界! 🌍' });

      // Act
      await handler.execute(command);

      // Assert
      expect(emailService.sentEmails[0].body.toValue()).toBe('Hello 世界! 🌍');
    });

    it('should handle single character body', async () => {
      // Arrange
      const { handler, emailService } = setup();
      const command = createCommand({ message: 'x' });

      // Act
      await handler.execute(command);

      // Assert
      expect(emailService.sentEmails[0].body.toValue()).toBe('x');
    });

    it('should handle single character subject', async () => {
      // Arrange
      const { handler, emailService } = setup();
      const command = createCommand({ subject: 'A' });

      // Act
      await handler.execute(command);

      // Assert
      expect(emailService.sentEmails[0].subject.toValue()).toBe('A');
    });
  });
});
