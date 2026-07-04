import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtTokenService } from './jwt-token.service';
import { InternalApiKeyGuard } from './internal-api-key.guard';
import { requiredEnv } from './env.util';

@Global()
@Module({
  imports: [
    // registerAsync so the secret is read lazily, after ConfigModule has
    // loaded .env. A static register() would run at import time, before env
    // loading, and could register the guard with a different secret than the
    // one JwtTokenService signs with. No fallback in any environment: a
    // published default would let anyone forge tokens.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: requiredEnv('JWT_SECRET'),
      }),
    }),
  ],
  providers: [JwtAuthGuard, JwtTokenService, InternalApiKeyGuard],
  exports: [JwtModule, JwtAuthGuard, JwtTokenService, InternalApiKeyGuard],
})
export class JwtAuthModule {}
