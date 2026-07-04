import { ApplicationException } from '../../errors';
import { Id } from '../../general';
import { Base_IntegrationEvent, type Base_IntegrationEventProps } from './base.integration-event';
import { Topics } from './topics';

interface EmailVerified_IntegrationEventProps extends Base_IntegrationEventProps {
  userId: string;
  email: string;
  emailVerificationId: string;
}

export class EmailVerified_IntegrationEvent extends Base_IntegrationEvent {
  public readonly userId: string;
  public readonly email: string;
  public readonly emailVerificationId: string;

  constructor(props: EmailVerified_IntegrationEventProps) {
    super(props, Topics.USERS.topic, Topics.USERS.events.EMAIL_VERIFIED, '1.0');

    this.userId = props.userId;
    this.email = props.email;
    this.emailVerificationId = props.emailVerificationId;

    this.validate();
  }

  static random(): EmailVerified_IntegrationEvent {
    return new EmailVerified_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      userId: Id.random().toValue(),
      email: 'random-email@random-domain.com',
      emailVerificationId: Id.random().toValue(),
    });
  }

  protected toEventJSON(): Record<string, unknown> {
    return {
      userId: this.userId,
      email: this.email,
      emailVerificationId: this.emailVerificationId,
    };
  }

  static fromJSON(json: Record<string, unknown>): EmailVerified_IntegrationEvent {
    Base_IntegrationEvent.validateJson(json);

    const event = new EmailVerified_IntegrationEvent({
      id: json.id as string,
      occurredOn: new Date(json.occurredOn as string),

      userId: json.userId as string,
      email: json.email as string,
      emailVerificationId: json.emailVerificationId as string,
    });

    return event;
  }

  protected validate(): void {
    super.validate();
    if (!this.userId) throw new ApplicationException('userId is required');
    if (!this.email) throw new ApplicationException('email is required');
    if (!this.emailVerificationId)
      throw new ApplicationException('emailVerificationId is required');
  }
}
