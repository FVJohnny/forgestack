import { DateVO } from '../value-objects/date.vo';
import { Id } from '../value-objects/id.vo';
import { Timestamps } from '../value-objects/timestamps.vo';
import { SharedAggregate } from '../base.aggregate';
import type { EntityExampleDTO } from './example.dto';

interface EntityExampleCreateProps {
  value: string;
}

interface EntityExampleAttributes {
  id: Id;
  timestamps: Timestamps;
  value: string;
}

export class EntityExample extends SharedAggregate {
  value: string;

  private constructor(props: EntityExampleAttributes) {
    super();
    this.value = props.value;
  }

  static create(props: EntityExampleCreateProps): EntityExample {
    return new EntityExample({
      id: Id.random(),
      timestamps: Timestamps.create(),
      value: props.value,
    });
  }

  static fromValue(dto: EntityExampleDTO): EntityExample {
    return new EntityExample({
      id: new Id(dto.id),
      timestamps: new Timestamps(new DateVO(dto.createdAt), new DateVO(dto.updatedAt)),
      value: dto.value,
    });
  }

  toValue(): EntityExampleDTO {
    return {
      ...super.toValue(),
      value: this.value,
    };
  }
}
