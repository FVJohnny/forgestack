export class RecordIdentity_Command {
  constructor(
    public readonly userId: string,
    public readonly ip: string,
    public readonly userAgent?: string,
  ) {}
}
