import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { TracingMiddleware } from './tracing.middleware';
import { TracingService } from './tracing.service';

@Module({
  providers: [TracingService],
  exports: [TracingService],
})
export class TracingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TracingMiddleware).forRoutes('*'); // Apply to all routes
  }
}
