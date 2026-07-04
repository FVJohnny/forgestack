import type { INestApplication } from '@nestjs/common';
export interface SwaggerConfig {
  title: string;
  description: string;
  version?: string;
  path?: string;
  enabled?: boolean;
  customSiteTitle?: string;
}

export interface SwaggerSetupOptions {
  app: INestApplication;
  config: SwaggerConfig;
  basePath?: string;
}
