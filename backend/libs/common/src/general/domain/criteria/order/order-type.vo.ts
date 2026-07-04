import { EnumValueObject } from '../../value-objects/enum.vo';
import { DomainValidationException } from '../../../../errors';

export enum OrderTypes {
  ASC = 'asc',
  DESC = 'desc',
  NONE = 'none',
}

export class OrderType extends EnumValueObject<OrderTypes> {
  constructor(value: OrderTypes) {
    super(value, Object.values(OrderTypes));
  }

  protected throwErrorForInvalidValue(value: OrderTypes): void {
    throw new DomainValidationException(`OrderType`, value, 'Invalid order type');
  }

  public isNone(): boolean {
    return this.toValue() === OrderTypes.NONE;
  }

  public isAsc(): boolean {
    return this.toValue() === OrderTypes.ASC;
  }

  public isDesc(): boolean {
    return this.toValue() === OrderTypes.DESC;
  }
}
