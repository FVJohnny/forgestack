import { SharedAggregateDTO } from '@libs/nestjs-common';
import { Email, Password, UserStatus, UserRole, LastLogin } from '../../value-objects';
import type { IdentityEntry } from '@bc/auth/domain/identity-entry.type';

export type { IdentityEntry };

export class UserDTO extends SharedAggregateDTO {
  email!: string;
  password!: string;
  status!: string;
  role!: string;
  lastLogin!: Date;
  googleId?: string;
  authProvider!: string;
  ips!: IdentityEntry[];
  userAgents!: IdentityEntry[];

  static random(): UserDTO {
    return {
      ...super.random(),

      email: Email.random().toValue(),
      password: Password.random().toValue(),
      status: UserStatus.random().toValue(),
      role: UserRole.random().toValue(),
      lastLogin: LastLogin.random().toValue(),
      authProvider: 'email',
      ips: [],
      userAgents: [],
    };
  }
}
