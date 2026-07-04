import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { SwaggerUtility } from '../swagger';

export interface AppConfigOptions {
  /** Swagger title/site title. Defaults to "<SERVICE_NAME> API". */
  apiTitle?: string;
  /** Swagger description. Defaults to the title. */
  apiDescription?: string;
  enableCors?: boolean;
  enableHelmet?: boolean;
  enableSwagger?: boolean;
  enableShutdownHooks?: boolean;
  requestSizeLimit?: string;
}

/**
 * The standard HTTP configuration every service in the monorepo uses: body
 * parsers (with rawBody support), the /api prefix + URI versioning, the global
 * validation pipe, CORS from CORS_ORIGINS, helmet and Swagger. Services call
 * this from main.ts; options exist for the rare service that needs to deviate.
 */
export function configureApp(app: NestExpressApplication, options: AppConfigOptions = {}): void {
  const {
    enableCors = true,
    enableHelmet = true,
    enableSwagger = true,
    enableShutdownHooks = true,
    requestSizeLimit = '2mb',
  } = options;

  // Use Nest's built-in body parsers so `rawBody` is populated for webhook
  // signature verification (installing body-parser via app.use() bypasses
  // Nest's raw-body capture).
  app.useBodyParser('json', { limit: requestSizeLimit });
  app.useBodyParser('urlencoded', { limit: requestSizeLimit, extended: true });

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Enable API versioning with default version
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Always apply validation pipe with consistent settings
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Allow extra properties for flexibility
      transform: true,
      forbidUnknownValues: false, // Allow unknown values for flexibility
    }),
  );

  // Enable CORS with allowed origins from env
  if (enableCors) {
    const origins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
    app.enableCors({
      origin: origins,
      credentials: true,
    });
  }

  // Security
  if (enableShutdownHooks) {
    app.enableShutdownHooks();
  }

  if (enableHelmet) {
    const isProduction = process.env.NODE_ENV === 'production';
    app.use(
      helmet({
        hsts: isProduction
          ? {
              maxAge: 31536000, // 1 year
              includeSubDomains: true,
              preload: true,
            }
          : false, // Disable HSTS in development
        referrerPolicy: {
          policy: ['strict-origin-when-cross-origin'],
        },
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Swagger UI
            scriptSrc: ["'self'"], // Strict script policy
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
      }),
    );
  }

  // Setup Swagger
  if (enableSwagger) {
    const title = options.apiTitle ?? `${process.env.SERVICE_NAME ?? 'service'} API`;
    SwaggerUtility.setupSwagger({
      app,
      config: {
        title,
        description: options.apiDescription ?? title,
        version: '1.0',
        path: 'docs',
        customSiteTitle: title,
      },
      basePath: process.env.PROXY_BASE_PATH,
    });
  }
}
