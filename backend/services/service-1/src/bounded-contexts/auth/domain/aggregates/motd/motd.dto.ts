import { SharedAggregateDTO } from '@libs/nestjs-common';

export class MotdDTO extends SharedAggregateDTO {
  content: string;

  static random(): MotdDTO {
    return {
      id: '86586c15-3a09-427d-99ba-0c1a8b6fc2a1',
      createdAt: new Date(),
      updatedAt: new Date(),
      content: 'Welcome to the platform! Check out our new features.',
    };
  }
}
