import type { IQuery } from '@nestjs/cqrs';

export type ListUsers_FilterField = 'email' | 'ip';

export interface ListUsers_QueryProps {
  page: number;
  limit: number;
  filterValue?: string;
  filterField?: ListUsers_FilterField;
}

export class ListUsers_Query implements IQuery {
  public readonly page: number;
  public readonly limit: number;
  public readonly filterValue?: string;
  public readonly filterField?: ListUsers_FilterField;

  constructor(props: ListUsers_QueryProps) {
    this.page = props.page;
    this.limit = props.limit;
    this.filterValue = props.filterValue;
    this.filterField = props.filterField;
  }
}
