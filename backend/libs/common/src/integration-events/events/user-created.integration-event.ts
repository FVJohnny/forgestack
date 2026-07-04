import { ApplicationException } from '../../errors';
import { Id } from '../../general';
import { Base_IntegrationEvent, type Base_IntegrationEventProps } from './base.integration-event';
import { Topics } from './topics';

interface UserCreated_IntegrationEventProps extends Base_IntegrationEventProps {
  userId: string;
  email: string;
  role: string;
}

export class UserCreated_IntegrationEvent extends Base_IntegrationEvent {
  public readonly userId: string;
  public readonly email: string;
  public readonly role: string;

  constructor(props: UserCreated_IntegrationEventProps) {
    super(props, Topics.USERS.topic, Topics.USERS.events.USER_CREATED, '1.0');

    this.userId = props.userId;
    this.email = props.email;
    this.role = props.role;

    this.validate();
  }
  static random(): UserCreated_IntegrationEvent {
    return new UserCreated_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      userId: Id.random().toValue(),
      email: 'random-email@random-domain.com',
      role: 'random-role',
    });
  }

  protected toEventJSON(): Record<string, unknown> {
    return {
      userId: this.userId,
      email: this.email,
      role: this.role,
    };
  }

  static fromJSON(json: Record<string, unknown>): UserCreated_IntegrationEvent {
    Base_IntegrationEvent.validateJson(json);

    const event = new UserCreated_IntegrationEvent({
      id: json.id as string,
      occurredOn: new Date(json.occurredOn as string),

      userId: json.userId as string,
      email: json.email as string,
      role: json.role as string,
    });

    return event;
  }

  protected validate(): void {
    super.validate();
    if (!this.userId) throw new ApplicationException('userId is required');
    if (!this.email) throw new ApplicationException('email is required');
    if (!this.role) throw new ApplicationException('role is required');
  }
}
