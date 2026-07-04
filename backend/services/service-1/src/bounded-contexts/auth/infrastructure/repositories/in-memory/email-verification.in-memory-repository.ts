import { Injectable } from '@nestjs/common';
import { EmailVerification } from '@bc/auth/domain/aggregates/email-verification/email-verification.aggregate';
import { EmailVerificationDTO } from '@bc/auth/domain/aggregates/email-verification/email-verification.dto';
import { EmailVerification_Repository } from '@bc/auth/domain/aggregates/email-verification/email-verification.repository';
import { Email } from '@bc/auth/domain/value-objects';
import {
  AlreadyExistsException,
  Id,
  Base_InMemoryRepository,
  type RepositoryContext,
} from '@libs/nestjs-common';

@Injectable()
export class EmailVerification_InMemoryRepository
  extends Base_InMemoryRepository<EmailVerification, EmailVerificationDTO>
  implements EmailVerification_Repository
{
  constructor(shouldFail: boolean = false) {
    super(shouldFail);
  }

  protected toEntity(dto: EmailVerificationDTO): EmailVerification {
    return EmailVerification.fromValue(dto);
  }

  async save(emailVerification: EmailVerification, context?: RepositoryContext) {
    // Check if user already has an email verification
    const existingByUserID = await this.findByUserId(emailVerification.userId);
    if (existingByUserID && !existingByUserID.id.equals(emailVerification.id)) {
      throw new AlreadyExistsException('userId', emailVerification.userId.toValue());
    }

    // Check if email is already used by another verification
    const existingByEmail = await this.findByEmail(emailVerification.email);
    if (existingByEmail && !existingByEmail.id.equals(emailVerification.id)) {
      throw new AlreadyExistsException('email', emailVerification.email.toValue());
    }

    super.save(emailVerification, context);
  }

  async findByUserId(userId: Id) {
    this.validate('findByUserId');

    const values = await this.findAll();
    return values.find((em) => em.userId.equals(userId)) || null;
  }

  async findByEmail(email: Email) {
    this.validate('findByEmail');

    const values = await this.findAll();
    return values.find((em) => em.email.equals(email)) || null;
  }

  async findPendingByUserId(userId: Id) {
    this.validate('findPendingByUserId');

    const values = await this.findAll();
    return values.find((em) => em.userId.equals(userId) && em.isPending()) || null;
  }
}
