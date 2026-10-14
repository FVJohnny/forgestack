import type { SharedAggregateProps } from '@libs/nestjs-common';
import { DateVO, Id, SharedAggregate, Timestamps } from '@libs/nestjs-common';
import { Email } from '@bc/tasks/domain/value-objects';
import type { UserDTO } from './user.dto';

export interface CreateUserProps {
  id: Id;
  email: Email;
}

export interface UserProps extends SharedAggregateProps {
  email: Email;
}

/**
 * Minimal local projection of a user, maintained in the tasks context from the
 * UserCreated/UserDeleted integration events that the auth context publishes.
 * It is load-bearing: creating a task first checks the user exists here, so
 * tasks can only belong to accounts this context knows about, without ever
 * calling back into auth.
 */
export class User extends SharedAggregate {
  email: Email;

  constructor(props: UserProps) {
    super(props.id, props.timestamps);
    this.email = props.email;
  }

  static create(props: CreateUserProps): User {
    return new User({
      id: props.id,
      email: props.email,
      timestamps: Timestamps.create(),
    });
  }

  static random(props?: Partial<UserProps>): User {
    return new User({
      id: props?.id ?? Id.random(),
      email: props?.email ?? Email.random(),
      timestamps: props?.timestamps ?? Timestamps.random(),
    });
  }

  static fromValue(value: UserDTO): User {
    return new User({
      id: new Id(value.id),
      email: new Email(value.email),
      timestamps: new Timestamps(new DateVO(value.createdAt), new DateVO(value.updatedAt)),
    });
  }

  toValue(): UserDTO {
    return {
      ...super.toValue(),
      email: this.email.toValue(),
    };
  }
}
