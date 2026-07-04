import { type Type } from '@nestjs/common';

import * as fs from 'fs';
import * as path from 'path';
import { CorrelationLogger } from '../logger';

interface RuntimeDiscoveryResult {
  handlers: Type<unknown>[];
  controllers: Type<unknown>[];
}

/**
 * Runtime auto-discovery that eliminates the need for generated import files
 * This scans and requires files at module initialization time
 */
export class RuntimeAutoDiscovery {
  private static readonly logger = new CorrelationLogger(RuntimeAutoDiscovery.name);

  static discoverAllComponents(boundedContextPath: string): RuntimeDiscoveryResult {
    const result: RuntimeDiscoveryResult = {
      handlers: [],
      controllers: [],
    };

    try {
      // Resolve the correct path based on environment (src vs dist)
      const resolvedPath = this.resolveBoundedContextPath(boundedContextPath);
      this.logger.log(`🔍 Starting runtime auto-discovery from: ${resolvedPath}`);

      // Determine file extension based on environment
      const isTestEnv = process.env.NODE_ENV === 'test' || __filename.endsWith('.ts');
      const fileExtension = isTestEnv ? '.ts' : '.js';
      const controllerSuffix = `.controller${fileExtension}`;

      // Discover handlers
      result.handlers = [
        ...this.discoverHandlers(
          resolvedPath,
          'application/commands',
          `.command-handler${fileExtension}`,
        ),
        ...this.discoverHandlers(
          resolvedPath,
          'application/queries',
          `.query-handler${fileExtension}`,
        ),
        ...this.discoverHandlers(
          resolvedPath,
          'application/domain-event-handlers',
          `.domain-event-handler${fileExtension}`,
        ),
        ...this.discoverHandlers(
          resolvedPath,
          'interfaces/integration-events',
          `.integration-event-handler${fileExtension}`,
        ),
      ];

      // Discover controllers
      result.controllers = this.discoverControllers(
        resolvedPath,
        'interfaces/controllers',
        controllerSuffix,
      );

      this.logger.log(
        `✅ Runtime auto-discovery complete: handlers=${result.handlers.length}, controllers=${result.controllers.length}`,
      );

      this.logger.log(`📋 Discovered handlers: ${result.handlers.map((h) => h.name).join(', ')}`);
      this.logger.log(
        `📋 Discovered controllers: ${result.controllers.map((c) => c.name).join(', ')}`,
      );

      return result;
    } catch (error) {
      this.logger.error('❌ Runtime auto-discovery failed:', error as Error);
      return result;
    }
  }

  private static discoverHandlers(
    basePath: string,
    subPath: string,
    suffix: string,
  ): Type<unknown>[] {
    const handlers: Type<unknown>[] = [];
    const fullPath = path.join(basePath, subPath);

    // this.logger.debug(`🔍 Looking for handlers in: ${fullPath} with suffix: ${suffix}`);

    if (!fs.existsSync(fullPath)) {
      this.logger.debug(`⚠️  Path does not exist: ${fullPath}`);
      return handlers;
    }

    try {
      const files = this.getAllFilesRecursively(fullPath, suffix);
      // this.logger.debug(
      //   `📁 Found ${files.length} files with suffix ${suffix}: ${files.join(', ')}`,
      // );

      for (const filePath of files) {
        // this.logger.debug(`🔍 Processing file: ${filePath}`);
        try {
          // Clear require cache to ensure fresh load
          delete require.cache[require.resolve(filePath)];

          // Use require for both .js and .ts files (ts-node handles .ts in test env)
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const module = require(filePath);
          // this.logger.debug(`📦 Module exports: ${Object.keys(module).join(', ')}`);

          const handlerClass = this.extractComponentFromModule(module, 'Handler');
          // this.logger.debug(`🎯 Extracted handler class: ${handlerClass?.name || 'null'}`);

          if (handlerClass) {
            handlers.push(handlerClass);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to load handler from ${filePath}:`, (error as Error).message);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to scan handlers in ${fullPath}:`, (error as Error).message);
    }

    return handlers;
  }

  private static discoverControllers(
    basePath: string,
    subPath: string,
    suffix: string,
  ): Type<unknown>[] {
    const controllers: Type<unknown>[] = [];
    const fullPath = path.join(basePath, subPath);

    if (!fs.existsSync(fullPath)) {
      return controllers;
    }

    try {
      const files = this.getAllFilesRecursively(fullPath, suffix);

      for (const filePath of files) {
        try {
          // Clear require cache to ensure fresh load
          delete require.cache[require.resolve(filePath)];

          // Use require for both .js and .ts files (ts-node handles .ts in test env)
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const module = require(filePath);
          const controllerClass = this.extractComponentFromModule(module, 'Controller');

          if (controllerClass) {
            controllers.push(controllerClass);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to load controller from ${filePath}:`, (error as Error).message);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to scan controllers in ${fullPath}:`, (error as Error).message);
    }

    return controllers;
  }

  private static getAllFilesRecursively(dir: string, suffix: string): string[] {
    const files: string[] = [];

    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          files.push(...this.getAllFilesRecursively(fullPath, suffix));
        } else if (item.isFile() && item.name.endsWith(suffix)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to read directory ${dir}:`, (error as Error).message);
    }

    return files;
  }

  private static extractComponentFromModule(
    module: Record<string, unknown>,
    typeSuffix: string,
  ): Type<unknown> | null {
    // Look for exports that are classes ending with the specified suffix
    const exports = Object.keys(module);

    for (const exportName of exports) {
      const exportValue = module[exportName];

      if (
        typeof exportValue === 'function' &&
        exportValue.prototype &&
        exportName.endsWith(typeSuffix)
      ) {
        return exportValue as Type<unknown>;
      }
    }

    // Check default export
    const defaultExport = module.default;
    if (
      defaultExport &&
      typeof defaultExport === 'function' &&
      defaultExport.prototype &&
      defaultExport.name &&
      defaultExport.name.endsWith(typeSuffix)
    ) {
      return defaultExport as Type<unknown>;
    }

    return null;
  }

  private static resolveBoundedContextPath(boundedContextPath: string): string {
    // Check if the provided path exists (for development/src environment)
    if (fs.existsSync(boundedContextPath)) {
      return boundedContextPath;
    }

    // In production, __dirname points to compiled JS location, we need to find the actual bounded context
    // Extract service name and construct the correct path
    const pathParts = boundedContextPath.split(path.sep);
    const distIndex = pathParts.findIndex((part) => part === 'dist');

    if (distIndex !== -1) {
      // We're in a dist directory, find the service root and bounded context name
      const serviceRoot = pathParts.slice(0, distIndex).join(path.sep);
      const remainingPath = pathParts.slice(distIndex + 1);

      // For paths like: /app/backend/services/service-1/dist/services/service-1/src/bounded-contexts/auth
      // We want: /app/backend/services/service-1/dist/services/service-1/src/bounded-contexts/auth
      const reconstructedPath = path.join(serviceRoot, 'dist', ...remainingPath);

      if (fs.existsSync(reconstructedPath)) {
        return reconstructedPath;
      }
    }

    // Return original path if we can't resolve it
    return boundedContextPath;
  }
}
