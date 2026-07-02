export class RecordIdentity_Command {
  constructor(
    public readonly userId: string,
    public readonly ip: string,
    public readonly userAgent?: string,
    public readonly fingerprint?: string,
    public readonly deviceId?: string,
  ) {}
}
