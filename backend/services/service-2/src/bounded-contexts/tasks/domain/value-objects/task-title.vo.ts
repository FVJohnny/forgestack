import { StringValueObject, DomainValidationException } from '@libs/nestjs-common';

export const TASK_TITLE_MAX_LENGTH = 200;

let _seq = 0;
export class TaskTitle extends StringValueObject {
  validate(): void {
    super.validate();
    if (this.value.trim().length === 0) {
      throw new DomainValidationException('title', this.value, 'Task title cannot be empty');
    }
    if (this.value.length > TASK_TITLE_MAX_LENGTH) {
      throw new DomainValidationException(
        'title',
        this.value,
        `Task title cannot exceed ${TASK_TITLE_MAX_LENGTH} characters`,
      );
    }
  }

  static random(): TaskTitle {
    return new TaskTitle(`Random task ${_seq++}`);
  }
}
