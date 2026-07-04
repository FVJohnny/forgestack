// EXAMPLE / PRODUCT CODE (not framework): a concrete integration-event
// contract for the demo app. Replace with your own events. See
// backend/libs/common/README.md.
import { ApplicationException } from '../../errors';
import { Id } from '../../general';
import { Base_IntegrationEvent, type Base_IntegrationEventProps } from './base.integration-event';
import { Topics } from './topics';

export interface UserExample_IntegrationEventProps extends Base_IntegrationEventProps {
  example: string;
}

export class UserExample_IntegrationEvent extends Base_IntegrationEvent {
  static readonly metadata = {
    topic: Topics.USERS.topic,
    name: Topics.USERS.events.USER_EXAMPLE,
    version: '1.0',
  };

  public readonly example: string;

  constructor(props: UserExample_IntegrationEventProps) {
    super(
      props,
      UserExample_IntegrationEvent.metadata.topic,
      UserExample_IntegrationEvent.metadata.name,
      UserExample_IntegrationEvent.metadata.version,
    );
    this.example = props.example;

    this.validate();
  }

  static random(): UserExample_IntegrationEvent {
    return new UserExample_IntegrationEvent({
      id: Id.random().toValue(),
      occurredOn: new Date(),
      example: 'random-example',
    });
  }

  protected toEventJSON(): Record<string, unknown> {
    return {
      example: this.example,
    };
  }

  static fromJSON(json: Record<string, unknown>): UserExample_IntegrationEvent {
    Base_IntegrationEvent.validateJson(json);

    const event = new UserExample_IntegrationEvent({
      id: json.id as string,
      occurredOn: new Date(json.occurredOn as string),

      example: json.example as string,
    });

    return event;
  }

  protected validate(): void {
    super.validate();
    if (!this.example) throw new ApplicationException('example is required');
  }
}
