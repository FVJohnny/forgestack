import type { IPasswordResetUniquenessChecker } from '@bc/auth/domain/services/password-reset-uniqueness-checker.interface';
import { Email, Expiration, Used } from '@bc/auth/domain/value-objects';
import {
  AlreadyExistsException,
  DateVO,
  Id,
  InvalidOperationException,
  SharedAggregate,
  Timestamps,
} from '@libs/nestjs-common';
import { PasswordResetRequested_DomainEvent } from './events/password-reset-requested.domain-event';
import type { PasswordResetDTO } from './password-reset.dto';

export interface PasswordResetAttributes {
  id: Id;
  email: Email;
  expiration: Expiration;
  used: Used;
  timestamps: Timestamps;
}

export interface CreatePasswordResetProps {
  email: Email;
}

export class PasswordReset extends SharedAggregate {
  email: Email;
  expiration: Expiration;
  used: Used;

  constructor(props: PasswordResetAttributes) {
    super(props.id, props.timestamps);
    this.email = props.email;
    this.expiration = props.expiration;
    this.used = props.used;
  }

  static async create(
    props: CreatePasswordResetProps,
    uniquenessChecker: IPasswordResetUniquenessChecker,
  ): Promise<PasswordReset> {
    // Enforce business rule: Don't create duplicate usable password resets
    const canCreate = await uniquenessChecker.canCreateNew(props.email);
    if (!canCreate) {
      throw new AlreadyExistsException(
        'password reset',
        `An active password reset already exists for ${props.email.toValue()}`,
      );
    }

    const passwordReset = new PasswordReset({
      id: Id.random(),
      email: props.email,
      expiration: Expiration.atHoursFromNow(1), // Password reset expires in 1 hour
      used: Used.no(),
      timestamps: Timestamps.create(),
    });

    passwordReset.apply(
      new PasswordResetRequested_DomainEvent(
        passwordReset.id,
        passwordReset.email,
        passwordReset.expiration,
      ),
    );

    return passwordReset;
  }

  static random(props?: Partial<PasswordResetAttributes>): PasswordReset {
    return new PasswordReset({
      id: Id.random(),
      email: props?.email || Email.random(),
      expiration: props?.expiration || Expiration.atHoursFromNow(1),
      used: props?.used || Used.no(),
      timestamps: props?.timestamps || Timestamps.create(),
    });
  }

  isUsed(): boolean {
    return this.used.isUsed();
  }

  isExpired(): boolean {
    return this.expiration.isExpired();
  }

  canBeUsed(): boolean {
    return !this.isExpired() && !this.isUsed();
  }

  use(): void {
    if (!this.canBeUsed()) {
      throw new InvalidOperationException('use', 'already used or expired');
    }

    this.used = Used.yes();
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  static fromValue(value: PasswordResetDTO): PasswordReset {
    return new PasswordReset({
      id: new Id(value.id),
      email: new Email(value.email),
      expiration: new Expiration(value.expiration),
      used: new Used(value.used),
      timestamps: new Timestamps(new DateVO(value.createdAt), new DateVO(value.updatedAt)),
    });
  }

  toValue(): PasswordResetDTO {
    return {
      ...super.toValue(),

      email: this.email.toValue(),
      expiration: this.expiration.toValue(),
      used: this.used.toValue(),
    };
  }
}
