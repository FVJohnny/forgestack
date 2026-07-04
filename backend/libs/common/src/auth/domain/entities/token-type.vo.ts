import { EnumValueObject } from '../../../general/domain/value-objects/enum.vo';
import { DomainValidationException } from '../../../errors';

const TOKEN_TYPE_VALUES = ['access', 'refresh'] as const;

type TokenTypeEnum = (typeof TOKEN_TYPE_VALUES)[number];

export class TokenType extends EnumValueObject<TokenTypeEnum> {
  constructor(value: string) {
    super(value as TokenTypeEnum, TOKEN_TYPE_VALUES);
  }

  protected throwErrorForInvalidValue(value: string): void {
    throw new DomainValidationException(
      'TokenType',
      value,
      `Invalid token type: ${value}. Must be either 'access' or 'refresh'.`,
    );
  }

  static readonly ACCESS = new TokenType('access');
  static readonly REFRESH = new TokenType('refresh');
}
