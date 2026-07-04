import { Injectable } from '@nestjs/common';

export type ReadinessCheck = () => boolean;

/**
 * Tracks per-component readiness so the HTTP server can accept traffic before
 * every background subsystem (e.g. Kafka consumer) has finished joining its
 * group. Consumers register a named check; /api/ready returns 200 only when
 * every registered check reports ready.
 */
@Injectable()
export class ReadinessService {
  private readonly checks = new Map<string, ReadinessCheck>();

  register(name: string, check: ReadinessCheck): void {
    this.checks.set(name, check);
  }

  isReady(): boolean {
    for (const check of this.checks.values()) {
      if (!check()) return false;
    }
    return true;
  }

  status(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [name, check] of this.checks) {
      result[name] = check();
    }
    return result;
  }
}
