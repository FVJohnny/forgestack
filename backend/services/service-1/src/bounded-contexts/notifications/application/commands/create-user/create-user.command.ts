export class CreateUser_Command {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}
