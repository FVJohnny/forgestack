import { ApplicationException } from '../../errors';
import { Id } from '../../general';
import { Base_IntegrationEvent, type Base_IntegrationEventProps } from './base.integration-event';
import { Topics } from './topics';

interface PasswordResetCompleted_IntegrationEventProps extends Base_IntegrationEventProps {
  userId: string;
  email: string;
}

export class PasswordResetCompleted_IntegrationEvent extends Base_IntegrationEvent {
  public readonly userId: string;
  public readonly email: string;

  constructor(props: PasswordResetCompleted_IntegrationEventProps) {
    super(props, Topics.USERS.topic, Topics.USERS.events.PASSWORD_RESET_COMPLETED, '1.0');

    this.userId = props.userId;
    this.email = props.email;

    this.validate();
  }

  static random(): PasswordResetCompleted_IntegrationEvent {
    return new PasswordResetCompleted_IntegrationEvent({
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

  static fromJSON(json: Record<string, unknown>): PasswordResetCompleted_IntegrationEvent {
    Base_IntegrationEvent.validateJson(json);

    const event = new PasswordResetCompleted_IntegrationEvent({
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
