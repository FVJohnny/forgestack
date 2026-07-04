import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtTokenService } from './jwt-token.service';
import { InternalApiKeyGuard } from './internal-api-key.guard';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  // Never let the app boot in production without an explicit secret — a known
  // default would let anyone forge tokens.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'dev-jwt-secret-change-in-production';
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: resolveJwtSecret(),
    }),
  ],
  providers: [JwtAuthGuard, JwtTokenService, InternalApiKeyGuard],
  exports: [JwtModule, JwtAuthGuard, JwtTokenService, InternalApiKeyGuard],
})
export class JwtAuthModule {}
