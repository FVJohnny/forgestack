import { DomainValidationException } from '../../../../errors';
import { FilterField } from './filter-field.vo';
import { FilterOperator, type Operator } from './filter-operator.vo';
import { FilterValue } from './filter-value.vo';

export class Filter {
  readonly field: FilterField;
  readonly operator: FilterOperator;
  readonly value: FilterValue;

  constructor(field: FilterField, operator: FilterOperator, value: FilterValue) {
    this.field = field;
    this.operator = operator;
    this.value = value;
  }

  static fromValues(values: Map<string, string>): Filter {
    const field = values.get('field');
    const operator = values.get('operator');
    const value = values.get('value');

    if (!field) {
      throw new DomainValidationException('Filter field', '', 'The filter is invalid');
    }

    if (!operator) {
      throw new DomainValidationException('Filter operator', '', 'The filter is invalid');
    }

    if (!value) {
      throw new DomainValidationException('Filter value', '', 'The filter is invalid');
    }

    return new Filter(
      new FilterField(field),
      new FilterOperator(operator as Operator),
      new FilterValue(value),
    );
  }
}
