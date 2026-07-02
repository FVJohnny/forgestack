import type { IUserUniquenessChecker } from '@bc/auth/domain/services/user-uniqueness-checker/user-uniqueness-checker.interface';
import { UserRoleEnum } from '@bc/auth/domain/value-objects';
import type { UserStatusEnum } from '@bc/auth/domain/value-objects';
import { Email, LastLogin, Password, UserRole, UserStatus } from '@bc/auth/domain/value-objects';
import {
  AlreadyExistsException,
  DateVO,
  Id,
  InvalidOperationException,
  SharedAggregate,
  Timestamps,
  UnauthorizedException,
} from '@libs/nestjs-common';
import { UserPasswordChanged_DomainEvent } from './events/password-changed.domain-event';
import { UserDeleted_DomainEvent } from './events/user-deleted.domain-event';
import { UserLogout_DomainEvent } from './events/user-logout.domain-event';
import { UserRegistered_DomainEvent } from './events/user-registered.domain-event';
import type { UserDTO } from './user.dto';

export interface CreateUserProps {
  email: Email;
  password: Password;
}

export interface CreateUserFromGoogleProps {
  email: Email;
  googleId: string;
}

export enum AuthProviderEnum {
  EMAIL = 'email',
  GOOGLE = 'google',
}

export type AuthProvider = `${AuthProviderEnum}`;

export interface IdentityEntry {
  value: string;
  firstSeen: Date;
  lastSeen: Date;
  seenCount: number;
}

export interface UserAttributes {
  id: Id;
  email: Email;
  password: Password;
  status: UserStatus;
  role: UserRole;
  lastLogin: LastLogin;
  googleId?: string;
  authProvider: AuthProvider;
  ips: IdentityEntry[];
  userAgents: IdentityEntry[];
  timestamps: Timestamps;
}
export class User extends SharedAggregate implements UserAttributes {
  email: Email;
  password: Password;
  status: UserStatus;
  role: UserRole;
  lastLogin: LastLogin;
  googleId?: string;
  authProvider: AuthProvider;
  ips: IdentityEntry[];
  userAgents: IdentityEntry[];

  constructor(props: UserAttributes) {
    super(props.id, props.timestamps);
    this.email = props.email;
    this.password = props.password;
    this.status = props.status;
    this.role = props.role;
    this.lastLogin = props.lastLogin;
    this.googleId = props.googleId;
    this.authProvider = props.authProvider;
    this.ips = props.ips;
    this.userAgents = props.userAgents;
  }

  static async create(
    props: CreateUserProps,
    uniquenessChecker: IUserUniquenessChecker,
  ): Promise<User> {
    // Enforce business rule: email must be unique
    const isEmailUnique = await uniquenessChecker.isEmailUnique(props.email);
    if (!isEmailUnique) {
      throw new AlreadyExistsException('email', props.email.toValue());
    }

    const role = UserRole.user();
    // This example template ships WITHOUT email verification: new users are
    // active immediately and can log in right after registering. To require
    // email verification instead, set the status to EMAIL_VERIFICATION_PENDING
    // and pass emailVerified=false in the UserRegistered_DomainEvent below.
    const user = new User({
      id: Id.random(),
      email: props.email,
      password: props.password,
      status: UserStatus.active(),
      role,
      lastLogin: LastLogin.never(),
      authProvider: 'email',
      ips: [],
      userAgents: [],
      timestamps: Timestamps.create(),
    });

    user.apply(new UserRegistered_DomainEvent(user.id, user.email, user.role, 'email', true));

    return user;
  }

  /**
   * Creates a new user from Google OAuth.
   * The user is immediately ACTIVE since Google has already verified their email.
   */
  static async createFromGoogle(
    props: CreateUserFromGoogleProps,
    uniquenessChecker: IUserUniquenessChecker,
  ): Promise<User> {
    // Enforce business rule: email must be unique
    const isEmailUnique = await uniquenessChecker.isEmailUnique(props.email);
    if (!isEmailUnique) {
      throw new AlreadyExistsException('email', props.email.toValue());
    }

    const role = UserRole.user();
    // Generate a random secure password - user can set one later if they want email/password access
    const randomPassword = Password.random();

    const user = new User({
      id: Id.random(),
      email: props.email,
      password: randomPassword,
      status: UserStatus.active(), // Google already verified email
      role,
      lastLogin: LastLogin.never(),
      googleId: props.googleId,
      authProvider: 'google',
      ips: [],
      userAgents: [],
      timestamps: Timestamps.create(),
    });

    user.apply(new UserRegistered_DomainEvent(user.id, user.email, user.role, 'google', true));

    return user;
  }

  /**
   * Links a Google account to this user.
   */
  linkGoogleAccount(googleId: string): void {
    if (this.googleId) {
      throw new InvalidOperationException('linkGoogleAccount', 'Google account already linked');
    }
    this.googleId = googleId;
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  static random(props?: Partial<UserAttributes>): User {
    const timestamps = props?.timestamps
      ? Timestamps.random({
          createdAt: props.timestamps.createdAt,
          updatedAt: props.timestamps.updatedAt,
        })
      : Timestamps.random();

    return new User({
      id: props?.id || Id.random(),
      email: props?.email || Email.random(),
      password: props?.password || Password.random(),
      status: props?.status || UserStatus.random(),
      role: props?.role || UserRole.random(),
      lastLogin: props?.lastLogin || LastLogin.random(),
      googleId: props?.googleId,
      authProvider: props?.authProvider || 'email',
      ips: props?.ips || [],
      userAgents: props?.userAgents || [],
      timestamps,
    });
  }

  activate(): void {
    if (!this.isInactive()) {
      throw new InvalidOperationException('activate', this.status.toValue());
    }
    this.status = UserStatus.active();
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  deactivate(): void {
    if (!this.isActive()) {
      throw new InvalidOperationException('deactivate', this.status.toValue());
    }
    this.status = UserStatus.inactive();
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  verifyEmail(): void {
    if (!this.isEmailVerificationPending()) {
      throw new InvalidOperationException('verifyEmail', this.status.toValue());
    }
    this.status = UserStatus.active();
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  hasRole(role: UserRole): boolean {
    return this.role.equals(role);
  }

  changeRole(role: UserRole): void {
    if (!this.hasRole(role)) {
      this.role = role;
      this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
    }
  }

  changePassword(newPassword: Password): void {
    this.password = newPassword;
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
    this.apply(new UserPasswordChanged_DomainEvent(this.id, this.email));
    this.logout();
  }

  logout(): void {
    this.apply(new UserLogout_DomainEvent(this.id));
  }

  canAuthenticate(): void {
    if (!this.isActive()) {
      throw new UnauthorizedException();
    }
  }

  isActive(): boolean {
    return this.status.equals(UserStatus.active());
  }

  isEmailVerificationPending(): boolean {
    return this.status.equals(UserStatus.emailVerificationPending());
  }

  isInactive(): boolean {
    return this.status.equals(UserStatus.inactive());
  }

  recordLogin(): void {
    this.lastLogin = LastLogin.now();
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  delete(): void {
    this.apply(new UserDeleted_DomainEvent(this.id));
  }

  suspend(): void {
    this.status = UserStatus.suspended();
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  unsuspend(): void {
    this.status = UserStatus.active();
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  recordIdentity(props: { ip?: string; userAgent?: string }): void {
    const now = new Date();

    if (props.ip) {
      this.upsertIdentityEntry(this.ips, props.ip, now);
    }
    if (props.userAgent) {
      this.upsertIdentityEntry(this.userAgents, props.userAgent, now);
    }

    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  private upsertIdentityEntry(list: IdentityEntry[], value: string, now: Date): void {
    const existing = list.find((entry) => entry.value === value);
    if (existing) {
      existing.lastSeen = now;
      existing.seenCount += 1;
    } else {
      list.push({
        value,
        firstSeen: now,
        lastSeen: now,
        seenCount: 1,
      });
    }
  }

  static fromValue(value: UserDTO): User {
    return new User({
      id: new Id(value.id),
      email: new Email(value.email),
      password: Password.createFromHash(value.password),
      status: new UserStatus(value.status as UserStatusEnum),
      role: new UserRole((value.role || UserRoleEnum.USER) as UserRoleEnum),
      lastLogin: new LastLogin(value.lastLogin),
      googleId: value.googleId,
      authProvider: (value.authProvider as AuthProvider) || 'email',
      ips: value.ips || [],
      userAgents: value.userAgents || [],
      timestamps: new Timestamps(new DateVO(value.createdAt), new DateVO(value.updatedAt)),
    });
  }

  toValue(): UserDTO {
    return {
      ...super.toValue(),

      email: this.email.toValue(),
      password: this.password.toValue(),
      status: this.status.toValue(),
      role: this.role.toValue(),
      lastLogin: this.lastLogin.toValue(),
      // Only include googleId if it exists (omit from document for sparse index to work)
      ...(this.googleId && { googleId: this.googleId }),
      authProvider: this.authProvider,
      ips: this.ips,
      userAgents: this.userAgents,
    };
  }
}
