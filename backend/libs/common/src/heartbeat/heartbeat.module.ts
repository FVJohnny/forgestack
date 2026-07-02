import { Global, Module } from '@nestjs/common';

import { HeartbeatController } from './heartbeat.controller';
import { ReadinessService } from './readiness.service';

@Global()
@Module({
  controllers: [HeartbeatController],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class HeartbeatModule {}
