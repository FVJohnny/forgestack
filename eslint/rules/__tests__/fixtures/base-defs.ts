// Minimal stand-ins so the typed rules can resolve the base type/interface.
export interface IValueObject {
  equals(other: unknown): boolean;
}
export class SharedAggregate {
  id!: string;
}
