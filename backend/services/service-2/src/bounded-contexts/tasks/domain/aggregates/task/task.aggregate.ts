import type { SharedAggregateProps } from '@libs/nestjs-common';
import { DateVO, Id, SharedAggregate, Timestamps } from '@libs/nestjs-common';
import { TaskTitle } from '@bc/tasks/domain/value-objects';
import type { TaskDTO } from './task.dto';

export interface CreateTaskProps {
  userId: Id;
  title: TaskTitle;
}

export interface TaskProps extends SharedAggregateProps {
  userId: Id;
  title: TaskTitle;
  completed: boolean;
}

/**
 * A single todo item owned by one user. The starter feature of this service:
 * small enough to read in one sitting, real enough to expand into whatever
 * your second service actually does.
 */
export class Task extends SharedAggregate {
  userId: Id;
  title: TaskTitle;
  completed: boolean;

  constructor(props: TaskProps) {
    super(props.id, props.timestamps);
    this.userId = props.userId;
    this.title = props.title;
    this.completed = props.completed;
  }

  static create(props: CreateTaskProps): Task {
    return new Task({
      id: Id.random(),
      userId: props.userId,
      title: props.title,
      completed: false,
      timestamps: Timestamps.create(),
    });
  }

  static random(props?: Partial<TaskProps>): Task {
    return new Task({
      id: props?.id ?? Id.random(),
      userId: props?.userId ?? Id.random(),
      title: props?.title ?? TaskTitle.random(),
      completed: props?.completed ?? false,
      timestamps: props?.timestamps ?? Timestamps.random(),
    });
  }

  static fromValue(value: TaskDTO): Task {
    return new Task({
      id: new Id(value.id),
      userId: new Id(value.userId),
      title: new TaskTitle(value.title),
      completed: value.completed,
      timestamps: new Timestamps(new DateVO(value.createdAt), new DateVO(value.updatedAt)),
    });
  }

  complete(): void {
    this.completed = true;
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  uncomplete(): void {
    this.completed = false;
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  isOwnedBy(userId: Id): boolean {
    return this.userId.equals(userId);
  }

  toValue(): TaskDTO {
    return {
      ...super.toValue(),
      userId: this.userId.toValue(),
      title: this.title.toValue(),
      completed: this.completed,
    };
  }
}
