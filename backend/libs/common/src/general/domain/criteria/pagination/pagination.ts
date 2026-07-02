export enum PaginationType {
  Cursor = 'cursor',
  Offset = 'offset',
}

export class Pagination {
  readonly type: PaginationType;

  constructor(type: PaginationType) {
    this.type = type;
  }
}
