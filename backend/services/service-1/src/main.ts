// Initialize OpenTelemetry first, before any other imports
import './otel-instrumentation';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from '@libs/nestjs-common';

// Process-level safety net. Schedulers and background work should catch their
// own errors (see inbox/outbox services, @Cron jobs), but any rogue promise
// rejection — a bad event, a transient DB blip, a library bug — should log
// loudly and keep the service alive rather than aborting the whole process.
// A crash here breaks WebSocket connections, scheduled jobs, in-flight
// requests, and triggers a full Kafka consumer rebalance.
process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));

  console.error('[unhandledRejection] stay-alive:', err.stack || err.message);
});

process.on('uncaughtException', (err: Error) => {
  console.error('[uncaughtException] stay-alive:', err.stack || err.message);
});

async function bootstrap() {
  // Capture the raw request body so webhook handlers can verify signatures
  // (e.g. payment providers, GitHub) against the exact bytes received.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  configureApp(app);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
