import { RuntimeAutoDiscovery } from '@libs/nestjs-common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TASK_REPOSITORY } from './domain/aggregates/task/task.repository';
import { Task_MongodbRepository } from './infrastructure/repositories/mongodb/task.mongodb-repository';
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
      provide: TASK_REPOSITORY,
      useClass: Task_MongodbRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: User_MongodbRepository,
    },
  ],
})
export class TasksBoundedContextModule {}
