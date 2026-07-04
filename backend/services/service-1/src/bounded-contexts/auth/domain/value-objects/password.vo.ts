import { StringValueObject, DomainValidationException } from '@libs/nestjs-common';
import * as bcrypt from 'bcrypt';

let _seq = 1;

export class Password extends StringValueObject {
  private static readonly SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 1 : 12;
  private static readonly MIN_LENGTH = 8;
  private static cachedTestPassword: Password | null = null;

  static async createFromPlainText(plainText: string) {
    Password.validatePlainText(plainText);
    const hashedPassword = await bcrypt.hash(plainText, Password.SALT_ROUNDS);
    return new Password(hashedPassword);
  }

  static createFromPlainTextSync(plainText: string) {
    Password.validatePlainText(plainText);
    const hashedPassword = bcrypt.hashSync(plainText, Password.SALT_ROUNDS);
    return new Password(hashedPassword);
  }

  static createFromHash(hash: string) {
    Password.validateHash(hash);
    return new Password(hash);
  }

  static random(): Password {
    if (process.env.NODE_ENV === 'test') {
      if (!Password.cachedTestPassword) {
        Password.cachedTestPassword = Password.createFromPlainTextSync('TestPassword123!');
      }
      return Password.cachedTestPassword;
    }
    return Password.createFromPlainTextSync('password' + _seq++);
  }

  async verify(plainText: string) {
    return await bcrypt.compare(plainText, this.toValue());
  }

  private static validatePlainText(password: string): void {
    if (!password || password.trim().length === 0) {
      throw new DomainValidationException('password', password, 'Password cannot be empty');
    }
    if (password.length < Password.MIN_LENGTH) {
      throw new DomainValidationException(
        'password',
        password,
        `Password must be at least ${Password.MIN_LENGTH} characters long`,
      );
    }
  }

  private static validateHash(hash: string): void {
    if (!hash || hash.trim().length === 0) {
      throw new DomainValidationException('password', hash, 'Password hash cannot be empty');
    }
  }
}
