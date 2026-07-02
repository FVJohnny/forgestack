import type { SharedAggregateProps } from '@libs/nestjs-common';
import { DateVO, Id, SharedAggregate, Timestamps } from '@libs/nestjs-common';
import type { MotdDTO } from './motd.dto';

export interface CreateMotdProps {
  content: string;
}

export interface MotdProps extends SharedAggregateProps {
  content: string;
}

export class Motd extends SharedAggregate {
  content: string;

  private constructor(props: MotdProps) {
    super(props.id, props.timestamps);
    this.content = props.content;
  }

  static create(props: CreateMotdProps): Motd {
    return new Motd({
      id: Motd.getSingletonId(),
      timestamps: Timestamps.create(),
      content: props.content,
    });
  }

  updateContent(content: string): void {
    this.content = content;
    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  static getSingletonId(): Id {
    // Using a fixed UUID for the singleton MOTD instance
    return new Id('86586c15-3a09-427d-99ba-0c1a8b6fc2a1');
  }

  static fromValue(value: MotdDTO): Motd {
    return new Motd({
      id: new Id(value.id),
      timestamps: new Timestamps(new DateVO(value.createdAt), new DateVO(value.updatedAt)),
      content: value.content,
    });
  }

  toValue(): MotdDTO {
    return {
      ...super.toValue(),
      content: this.content,
    };
  }
}
