export class Topics {
  static readonly USERS = {
    topic: 'users',
    events: {
      USER_CREATED: 'user.created',
      USER_EXAMPLE: 'user.example',
      USER_DELETED: 'user.deleted',
      EMAIL_VERIFICATION_CREATED: 'email-verification.created',
      EMAIL_VERIFIED: 'email.verified',
      PASSWORD_RESET_REQUESTED: 'password-reset.requested',
      PASSWORD_RESET_COMPLETED: 'password-reset.completed',
    },
  };
}
