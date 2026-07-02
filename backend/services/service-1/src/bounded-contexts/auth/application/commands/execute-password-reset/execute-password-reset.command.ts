export class ExecutePasswordReset_Command {
  constructor(
    public readonly passwordResetId: string,
    public readonly newPassword: string,
  ) {}
}
