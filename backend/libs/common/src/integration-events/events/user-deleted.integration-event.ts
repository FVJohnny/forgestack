// EXAMPLE / PRODUCT CODE (not framework): a concrete integration-event
// contract for the demo app. Replace with your own events. See
// backend/libs/common/README.md.
import { ApplicationException } from '../../errors';
import { Id } from '../../general';
import { Base_IntegrationEvent, type Base_IntegrationEventProps } from './base.integration-event';
import { Topics } from './topics';

interface UserDeleted_IntegrationEventProps extends Base_IntegrationEventProps {
  userId: string;
  email: string;
}

export class UserDeleted_IntegrationEvent extends Base_IntegrationEvent {
  static readonly metadata = {
    topic: Topics.USERS.topic,
    name: Topics.USERS.events.USER_DELETED,
    version: '1.0',
  };

  public readonly userId: string;
  public readonly email: string;

  constructor(props: UserDeleted_IntegrationEventProps) {
    super(
      props,
      UserDeleted_IntegrationEvent.metadata.topic,
      UserDeleted_IntegrationEvent.metadata.name,
      UserDeleted_IntegrationEvent.metadata.version,
    );

    this.userId = props.userId;
    this.email = props.email;

    this.validate();
  }

  static random(): UserDeleted_IntegrationEvent {
    return new UserDeleted_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      userId: Id.random().toValue(),
      email: 'random-email@random-domain.com',
    });
  }

  protected toEventJSON(): Record<string, unknown> {
    return {
      userId: this.userId,
      email: this.email,
    };
  }

  static fromJSON(json: Record<string, unknown>): UserDeleted_IntegrationEvent {
    Base_IntegrationEvent.validateJson(json);

    const event = new UserDeleted_IntegrationEvent({
      id: json.id as string,
      occurredOn: new Date(json.occurredOn as string),

      userId: json.userId as string,
      email: json.email as string,
    });

    return event;
  }

  protected validate(): void {
    super.validate();
    if (!this.userId) throw new ApplicationException('userId is required');
    if (!this.email) throw new ApplicationException('email is required');
  }
}
