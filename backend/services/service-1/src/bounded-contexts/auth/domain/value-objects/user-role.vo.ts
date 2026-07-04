import { EnumValueObject, DomainValidationException } from '@libs/nestjs-common';

export enum UserRoleEnum {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

export class UserRole extends EnumValueObject<UserRoleEnum> {
  constructor(value: UserRoleEnum) {
    super(value, Object.values(UserRoleEnum));
  }

  protected throwErrorForInvalidValue(value: UserRoleEnum): void {
    throw new DomainValidationException('userRole', value, `Invalid user role: ${value}`);
  }

  // random user role
  static random(): UserRole {
    const roles = Object.values(UserRoleEnum);
    const randomValue = roles[Math.floor(Math.random() * roles.length)];
    return new UserRole(randomValue);
  }

  static admin(): UserRole {
    return new UserRole(UserRoleEnum.ADMIN);
  }

  static user(): UserRole {
    return new UserRole(UserRoleEnum.USER);
  }

  static moderator(): UserRole {
    return new UserRole(UserRoleEnum.MODERATOR);
  }

  equals(other: UserRole): boolean {
    return this.toValue() === other.toValue();
  }
}
