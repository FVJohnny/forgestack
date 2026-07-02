import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Thrown when domain business rules are violated
 */
export class DomainValidationException extends BaseException {
  constructor(field: string, value: unknown, rule: string) {
    super(
      `Domain validation failed for field '${field}' and value '${value}'. Rule: ${rule}`,
      'DOMAIN_VALIDATION_FAILED',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when an operation is not allowed in the current state
 */
export class InvalidOperationException extends BaseException {
  constructor(operation: string, currentState: string) {
    super(
      `Operation '${operation}' is not allowed in current state '${currentState}'`,
      'INVALID_OPERATION',
      HttpStatus.BAD_REQUEST,
    );
  }
}
