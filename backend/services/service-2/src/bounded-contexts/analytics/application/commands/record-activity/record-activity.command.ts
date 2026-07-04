export class RecordActivity_Command {
  constructor(
    public readonly userId: string,
    public readonly eventType: string,
    public readonly occurredOn: Date,
  ) {}
}
