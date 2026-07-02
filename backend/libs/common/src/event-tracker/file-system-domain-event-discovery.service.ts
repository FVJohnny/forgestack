import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CorrelationLogger } from '../logger';

@Injectable()
export class FileSystemDomainEventDiscoveryService {
  private readonly logger = new CorrelationLogger(FileSystemDomainEventDiscoveryService.name);

  async discoverDomainEvents(): Promise<Set<string>> {
    const eventNames = new Set<string>();
    const serviceRoot = this.findServiceRoot();

    // Try multiple possible paths for bounded contexts
    const possiblePaths = [
      path.join(serviceRoot, 'src', 'bounded-contexts'), // Development
      path.join(serviceRoot, 'dist', 'bounded-contexts'), // Simple build
      path.join(
        serviceRoot,
        'dist',
        'services',
        path.basename(serviceRoot),
        'src',
        'bounded-contexts',
      ), // NX monorepo build
    ];

    let boundedContextsPath: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        boundedContextsPath = possiblePath;
        break;
      }
    }

    if (!boundedContextsPath) {
      this.logger.warn(
        `Bounded contexts directory not found. Checked paths: ${possiblePaths.join(', ')} (cwd: ${process.cwd()}, serviceRoot: ${serviceRoot})`,
      );
      return eventNames;
    }

    this.logger.debug(`Using bounded contexts path: ${boundedContextsPath}`);

    // Recursively scan for domain event files
    this.scanDirectoryRecursively(boundedContextsPath, eventNames);

    this.logger.log(
      `✅ Discovered ${eventNames.size} domain events: ${Array.from(eventNames).join(', ')}`,
    );
    return eventNames;
  }

  private findServiceRoot(): string {
    // In production (Docker), the app is typically in /app/backend/services/service-1
    // In development, it's in the workspace root
    let dir = process.cwd();

    // First, try to find package.json by going up the directory tree
    while (dir !== '/' && !fs.existsSync(path.join(dir, 'package.json'))) {
      dir = path.dirname(dir);
    }

    // If we're in a build output directory (dist), go up one level
    if (path.basename(dir) === 'dist') {
      dir = path.dirname(dir);
    }

    return dir;
  }

  private scanDirectoryRecursively(directory: string, eventNames: Set<string>): void {
    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          this.scanDirectoryRecursively(fullPath, eventNames);
        } else if (entry.isFile()) {
          // Check if it's a domain event file
          if (entry.name.endsWith('.domain-event.ts') || entry.name.endsWith('.domain-event.js')) {
            const eventName = this.toPascalCase(
              entry.name.replace('.domain-event.ts', '').replace('.domain-event.js', ''),
            );
            if (eventName) {
              eventNames.add(`${eventName}_DomainEvent`);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Could not scan ${directory}:`, error as Error);
    }
  }

  private toPascalCase(kebabCase: string): string {
    return kebabCase
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}
