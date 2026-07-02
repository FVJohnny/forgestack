import { RuntimeAutoDiscovery } from '@libs/nestjs-common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ACTIVITY_REPOSITORY } from './domain/aggregates/activity/activity.repository';
import { Activity_MongodbRepository } from './infrastructure/repositories/mongodb/activity.mongodb-repository';

// 🚀 RUNTIME AUTO-DISCOVERY
const { controllers, handlers } = RuntimeAutoDiscovery.discoverAllComponents(__dirname);

@Module({
  imports: [ConfigModule],
  controllers: [...controllers],
  providers: [
    ...handlers,
    {
      provide: ACTIVITY_REPOSITORY,
      useClass: Activity_MongodbRepository,
    },
  ],
})
export class AnalyticsBoundedContextModule {}
