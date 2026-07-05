import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { type IQueryBus } from '@nestjs/cqrs';
import { JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { AuthenticatedRequest, JwtTokenPayload } from './jwt-auth.types';
import { GetUserTokenByToken_Query } from './application/queries/get-user-token-by-token/get-user-token-by-token.query';
import { QUERY_BUS } from '../cqrs';
import { ACCESS_TOKEN_COOKIE } from './auth-cookies';
import { IS_PUBLIC_KEY } from './public.decorator';
import { NotFoundException } from '../errors/application.exceptions';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @Inject(QUERY_BUS) private queryBus: IQueryBus,
    // Optional so existing per-route @UseGuards(JwtAuthGuard) usage keeps
    // working (Nest injects the Reflector there too, but Optional makes manual
    // construction in tests painless). When registered as a global APP_GUARD,
    // the Reflector lets @Public()/@PublicApi() routes bypass auth.
    @Optional() private reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector?.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      // Verify JWT signature and expiration
      const payload = await this.jwtService.verifyAsync<JwtTokenPayload>(token);

      // Check if token exists in the repository
      const query = new GetUserTokenByToken_Query(token);
      await this.queryBus.execute(query);

      request.tokenData = payload;
      return true;
    } catch (error) {
      // Only genuine auth failures become 401: a bad/expired/not-yet-valid JWT,
      // or the token not being in the store (NotFoundException). An
      // infrastructure failure here (e.g. the Redis-backed token query throwing
      // because Redis is down) must NOT masquerade as "unauthenticated" and log
      // every user out; let it propagate so it surfaces as a 5xx that
      // monitoring catches.
      if (
        error instanceof JsonWebTokenError ||
        error instanceof TokenExpiredError ||
        error instanceof NotBeforeError ||
        error instanceof NotFoundException
      ) {
        throw new UnauthorizedException();
      }
      throw error;
    }
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    // Browser clients authenticate via the httpOnly access-token cookie.
    const cookieToken = request.cookies?.[ACCESS_TOKEN_COOKIE];
    if (cookieToken) {
      return cookieToken;
    }
    // Fall back to the Authorization header for non-browser callers
    // (Swagger "Authorize", service-to-service, scripts).
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
