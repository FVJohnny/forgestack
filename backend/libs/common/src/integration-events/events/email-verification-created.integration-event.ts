import { ApplicationException } from '../../errors';
import { Id } from '../../general';
import { Base_IntegrationEvent, type Base_IntegrationEventProps } from './base.integration-event';
import { Topics } from './topics';

interface EmailVerificationCreated_IntegrationEventProps extends Base_IntegrationEventProps {
  userId: string;
  email: string;
  emailVerificationId: string;
  expiresAt: Date;
}

export class EmailVerificationCreated_IntegrationEvent extends Base_IntegrationEvent {
  public readonly userId: string;
  public readonly email: string;
  public readonly emailVerificationId: string;
  public readonly expiresAt: Date;

  constructor(props: EmailVerificationCreated_IntegrationEventProps) {
    super(props, Topics.USERS.topic, Topics.USERS.events.EMAIL_VERIFICATION_CREATED, '1.0');

    this.userId = props.userId;
    this.email = props.email;
    this.emailVerificationId = props.emailVerificationId;
    this.expiresAt = props.expiresAt;

    this.validate();
  }

  static random(): EmailVerificationCreated_IntegrationEvent {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    return new EmailVerificationCreated_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: now,
      userId: Id.random().toValue(),
      email: 'random-email@random-domain.com',
      emailVerificationId: Id.random().toValue(),
      expiresAt,
    });
  }

  protected toEventJSON(): Record<string, unknown> {
    return {
      userId: this.userId,
      email: this.email,
      emailVerificationId: this.emailVerificationId,
      expiresAt: this.expiresAt.toISOString(),
    };
  }

  static fromJSON(json: Record<string, unknown>): EmailVerificationCreated_IntegrationEvent {
    Base_IntegrationEvent.validateJson(json);

    const event = new EmailVerificationCreated_IntegrationEvent({
      id: json.id as string,
      occurredOn: new Date(json.occurredOn as string),

      userId: json.userId as string,
      email: json.email as string,
      emailVerificationId: json.emailVerificationId as string,
      expiresAt: new Date(json.expiresAt as string),
    });

    return event;
  }

  protected validate(): void {
    super.validate();
    if (!this.userId) throw new ApplicationException('userId is required');
    if (!this.email) throw new ApplicationException('email is required');
    if (!this.emailVerificationId)
      throw new ApplicationException('emailVerificationId is required');
    if (!this.expiresAt) throw new ApplicationException('expiresAt is required');
  }
}
