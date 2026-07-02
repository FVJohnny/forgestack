import { RuntimeAutoDiscovery } from '@libs/nestjs-common';
import { Module } from '@nestjs/common';

// Infrastructure - Repositories
import {
  GetUserTokenByToken_QueryHandler,
  StoreTokens_CommandHandler,
  USER_TOKEN_REPOSITORY,
} from '@libs/nestjs-common';
import { UserToken_RedisRepository } from '@libs/nestjs-redis';
import { EMAIL_VERIFICATION_REPOSITORY } from './domain/aggregates/email-verification/email-verification.repository';
import { PASSWORD_RESET_REPOSITORY } from './domain/aggregates/password-reset/password-reset.repository';
import { USER_REPOSITORY } from './domain/aggregates/user/user.repository';
import { USER_IDENTITY_MARKER_REPOSITORY } from './domain/aggregates/user-identity-marker/user-identity-marker.repository';
import { MOTD_REPOSITORY } from './domain/aggregates/motd/motd.repository';
import { EmailVerification_MongodbRepository } from './infrastructure/repositories/mongodb/email-verification.mongodb-repository';
import { PasswordReset_MongodbRepository } from './infrastructure/repositories/mongodb/password-reset.mongodb-repository';
import { User_MongodbRepository } from './infrastructure/repositories/mongodb/user.mongodb-repository';
import { UserIdentityMarker_MongodbRepository } from './infrastructure/repositories/mongodb/user-identity-marker.mongodb-repository';
import { Motd_MongodbRepository } from './infrastructure/repositories/mongodb/motd.mongodb-repository';

// Domain Services
import { USER_UNIQUENESS_CHECKER } from './domain/services/user-uniqueness-checker/user-uniqueness-checker.interface';
import { UserUniquenessChecker } from './domain/services/user-uniqueness-checker/user-uniqueness-checker.service';
import { PASSWORD_RESET_UNIQUENESS_CHECKER } from './domain/services/password-reset-uniqueness-checker.interface';
import { PasswordResetUniquenessChecker } from './domain/services/password-reset-uniqueness-checker.service';

// Infrastructure Services
import {
  GOOGLE_OAUTH_SERVICE,
  GoogleOAuthService,
} from './infrastructure/services/google-oauth/google-oauth.service';

// Bootstrap Services
import { DefaultUserBootstrapService } from './application/bootstrap/default-user-bootstrap.service';

// 🚀 RUNTIME AUTO-DISCOVERY
const { controllers, handlers } = RuntimeAutoDiscovery.discoverAllComponents(__dirname);

@Module({
  controllers: [...controllers],
  providers: [
    ...handlers,
    StoreTokens_CommandHandler,
    GetUserTokenByToken_QueryHandler,
    // Repositories (Secondary Ports)
    {
      provide: USER_REPOSITORY,
      useClass: User_MongodbRepository,
    },
    {
      provide: EMAIL_VERIFICATION_REPOSITORY,
      useClass: EmailVerification_MongodbRepository,
    },
    {
      provide: PASSWORD_RESET_REPOSITORY,
      useClass: PasswordReset_MongodbRepository,
    },
    {
      provide: USER_IDENTITY_MARKER_REPOSITORY,
      useClass: UserIdentityMarker_MongodbRepository,
    },
    {
      provide: USER_TOKEN_REPOSITORY,
      useClass: UserToken_RedisRepository,
    },
    {
      provide: MOTD_REPOSITORY,
      useClass: Motd_MongodbRepository,
    },
    // Domain Services
    {
      provide: USER_UNIQUENESS_CHECKER,
      useClass: UserUniquenessChecker,
    },
    {
      provide: PASSWORD_RESET_UNIQUENESS_CHECKER,
      useClass: PasswordResetUniquenessChecker,
    },
    // Infrastructure Services
    {
      provide: GOOGLE_OAUTH_SERVICE,
      useClass: GoogleOAuthService,
    },
    DefaultUserBootstrapService,
  ],
})
export class AuthBoundedContextModule {}
