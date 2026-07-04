import type { SharedAggregateProps } from '@libs/nestjs-common';
import { DateVO, Id, SharedAggregate, Timestamps } from '@libs/nestjs-common';
import type { ActivityDTO } from './activity.dto';

export interface CreateActivityProps {
  userId: Id;
  eventType: string;
  occurredOn: DateVO;
}

export interface ActivityProps extends SharedAggregateProps {
  userId: Id;
  eventType: string;
  occurredOn: DateVO;
}

/**
 * One user-activity record, derived from an integration event published by
 * another service (e.g. auth's user.created). The analytics context only
 * appends and aggregates these — it owns no user data of its own.
 */
export class Activity extends SharedAggregate {
  userId: Id;
  eventType: string;
  occurredOn: DateVO;

  constructor(props: ActivityProps) {
    super(props.id, props.timestamps);
    this.userId = props.userId;
    this.eventType = props.eventType;
    this.occurredOn = props.occurredOn;
  }

  static create(props: CreateActivityProps): Activity {
    return new Activity({
      id: Id.random(),
      userId: props.userId,
      eventType: props.eventType,
      occurredOn: props.occurredOn,
      timestamps: Timestamps.create(),
    });
  }

  static random(props?: Partial<ActivityProps>): Activity {
    return new Activity({
      id: props?.id ?? Id.random(),
      userId: props?.userId ?? Id.random(),
      eventType: props?.eventType ?? 'user.created',
      occurredOn: props?.occurredOn ?? DateVO.now(),
      timestamps: props?.timestamps ?? Timestamps.random(),
    });
  }

  static fromValue(value: ActivityDTO): Activity {
    return new Activity({
      id: new Id(value.id),
      userId: new Id(value.userId),
      eventType: value.eventType,
      occurredOn: new DateVO(value.occurredOn),
      timestamps: new Timestamps(new DateVO(value.createdAt), new DateVO(value.updatedAt)),
    });
  }

  toValue(): ActivityDTO {
    return {
      ...super.toValue(),
      userId: this.userId.toValue(),
      eventType: this.eventType,
      occurredOn: this.occurredOn.toValue(),
    };
  }
}
