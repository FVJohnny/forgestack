// EXAMPLE / PRODUCT CODE (not framework). This is the demo app's Kafka
// topic/event-name registry. Replace it with your own topics when you build
// on the template. See backend/libs/common/README.md ("Framework vs example").
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
