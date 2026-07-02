import { RuntimeAutoDiscovery } from '@libs/nestjs-common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EMAIL_SERVICE } from './domain/services/email.service';
import { Email_SmtpService } from './infrastructure/services/email.smtp-service';
import { Email_InMemoryService } from './infrastructure/services/email.in-memory-service';
import { USER_REPOSITORY } from './domain/aggregates/user/user.repository';
import { User_MongodbRepository } from './infrastructure/repositories/mongodb/user.mongodb-repository';

// 🚀 RUNTIME AUTO-DISCOVERY
const { controllers, handlers } = RuntimeAutoDiscovery.discoverAllComponents(__dirname);

@Module({
  imports: [ConfigModule],
  controllers: [...controllers],
  providers: [
    ...handlers,
    {
      // Use real SMTP only when an SMTP host is configured; otherwise fall back
      // to the in-memory adapter that logs emails to the console. This keeps
      // local dev working without a mail server.
      provide: EMAIL_SERVICE,
      useClass: process.env.SMTP_HOST ? Email_SmtpService : Email_InMemoryService,
    },
    {
      provide: USER_REPOSITORY,
      useClass: User_MongodbRepository,
    },
  ],
})
export class NotificationsBoundedContextModule {}
