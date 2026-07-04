import { ApplicationException } from '../../errors';
import { Id } from '../../general';
import { Base_IntegrationEvent, type Base_IntegrationEventProps } from './base.integration-event';
import { Topics } from './topics';

interface PasswordResetRequested_IntegrationEventProps extends Base_IntegrationEventProps {
  email: string;
  passwordResetId: string;
  expiresAt: Date;
}

export class PasswordResetRequested_IntegrationEvent extends Base_IntegrationEvent {
  public readonly email: string;
  public readonly passwordResetId: string;
  public readonly expiresAt: Date;

  constructor(props: PasswordResetRequested_IntegrationEventProps) {
    super(props, Topics.USERS.topic, Topics.USERS.events.PASSWORD_RESET_REQUESTED, '1.0');

    this.email = props.email;
    this.passwordResetId = props.passwordResetId;
    this.expiresAt = props.expiresAt;

    this.validate();
  }

  static random(): PasswordResetRequested_IntegrationEvent {
    return new PasswordResetRequested_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      email: 'random-email@random-domain.com',
      passwordResetId: Id.random().toValue(),
      expiresAt: new Date(),
    });
  }

  protected toEventJSON(): Record<string, unknown> {
    return {
      email: this.email,
      passwordResetId: this.passwordResetId,
      expiresAt: this.expiresAt.toISOString(),
    };
  }

  static fromJSON(json: Record<string, unknown>): PasswordResetRequested_IntegrationEvent {
    Base_IntegrationEvent.validateJson(json);

    const event = new PasswordResetRequested_IntegrationEvent({
      id: json.id as string,
      occurredOn: new Date(json.occurredOn as string),

      email: json.email as string,
      passwordResetId: json.passwordResetId as string,
      expiresAt: new Date(json.expiresAt as string),
    });

    return event;
  }

  protected validate(): void {
    super.validate();
    if (!this.email) throw new ApplicationException('email is required');
    if (!this.passwordResetId) throw new ApplicationException('passwordResetId is required');
    if (!this.expiresAt) throw new ApplicationException('expiresAt is required');
  }
}
