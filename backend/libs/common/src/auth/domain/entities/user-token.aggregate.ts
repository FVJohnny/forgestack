import { DateVO } from '../../../general/domain/value-objects/date.vo';
import { Id } from '../../../general/domain/value-objects/id.vo';
import { Timestamps } from '../../../general/domain/value-objects/timestamps.vo';
import { SharedAggregate } from '../../../general/domain/base.aggregate';
import type { UserTokenDTO } from './user-token.dto';
import { TokenType } from './token-type.vo';
import { Token } from './token.vo';

export interface UserTokenAttributes {
  id: Id;
  userId: Id;
  token: Token;
  type: TokenType;
  timestamps: Timestamps;
}

export interface CreateUserTokenProps {
  userId: Id;
  token: Token;
  type: 'access' | 'refresh';
}

export class UserToken extends SharedAggregate {
  userId: Id;
  token: Token;
  type: TokenType;

  constructor(props: UserTokenAttributes) {
    super(props.id, props.timestamps);
    this.userId = props.userId;
    this.token = props.token;
    this.type = props.type;
  }

  static create(props: CreateUserTokenProps): UserToken {
    const token = new UserToken({
      id: Id.random(),
      userId: props.userId,
      token: props.token,
      type: new TokenType(props.type),
      timestamps: Timestamps.create(),
    });

    return token;
  }

  static fromValue(value: UserTokenDTO): UserToken {
    return new UserToken({
      id: new Id(value.id),
      userId: new Id(value.userId),
      token: new Token(value.token),
      type: new TokenType(value.type),
      timestamps: new Timestamps(new DateVO(value.createdAt), new DateVO(value.updatedAt)),
    });
  }

  toValue(): UserTokenDTO {
    return {
      ...super.toValue(),
      token: this.token.toValue(),
      userId: this.userId.toValue(),
      type: this.type.toValue(),
    };
  }
}
