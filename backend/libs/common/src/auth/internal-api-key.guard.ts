import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.INTERNAL_API_KEY;
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.apiKey) {
      throw new UnauthorizedException('Internal API key not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = this.extractApiKey(request);

    if (!providedKey || !this.keysMatch(providedKey, this.apiKey)) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    return true;
  }

  /**
   * Constant-time comparison so response timing cannot be used to guess the
   * key byte by byte. Hashing first gives equal-length buffers, which
   * timingSafeEqual requires, without leaking the key length.
   */
  private keysMatch(provided: string, expected: string): boolean {
    const providedHash = createHash('sha256').update(provided).digest();
    const expectedHash = createHash('sha256').update(expected).digest();
    return timingSafeEqual(providedHash, expectedHash);
  }

  private extractApiKey(request: Request): string | undefined {
    // Check X-Internal-Api-Key header first
    const headerKey = request.headers['x-internal-api-key'];
    if (headerKey && typeof headerKey === 'string') {
      return headerKey;
    }

    // Check Authorization header with ApiKey type (for Prometheus compatibility)
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const [type, key] = authHeader.split(' ');
      if (type === 'ApiKey' && key) {
        return key;
      }
    }

    return undefined;
  }
}
