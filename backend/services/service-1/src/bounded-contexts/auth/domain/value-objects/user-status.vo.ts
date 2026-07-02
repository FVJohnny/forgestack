import { EnumValueObject, DomainValidationException } from '@libs/nestjs-common';

export enum UserStatusEnum {
  EMAIL_VERIFICATION_PENDING = 'email-verification-pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export class UserStatus extends EnumValueObject<UserStatusEnum> {
  constructor(value: UserStatusEnum) {
    super(value, Object.values(UserStatusEnum));
  }

  protected throwErrorForInvalidValue(value: UserStatusEnum): void {
    throw new DomainValidationException('userStatus', value, `Invalid user status: ${value}`);
  }

  static random(): UserStatus {
    const values = Object.values(UserStatusEnum);
    const randomValue = values[Math.floor(Math.random() * values.length)];
    return new UserStatus(randomValue);
  }

  static active(): UserStatus {
    return new UserStatus(UserStatusEnum.ACTIVE);
  }

  static inactive(): UserStatus {
    return new UserStatus(UserStatusEnum.INACTIVE);
  }

  static suspended(): UserStatus {
    return new UserStatus(UserStatusEnum.SUSPENDED);
  }

  static emailVerificationPending(): UserStatus {
    return new UserStatus(UserStatusEnum.EMAIL_VERIFICATION_PENDING);
  }
}
