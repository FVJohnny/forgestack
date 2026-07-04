import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type IQueryBus } from '@nestjs/cqrs';
import { AuthenticatedRequest, JwtTokenPayload } from './jwt-auth.types';
import { GetUserTokenByToken_Query } from './application/queries/get-user-token-by-token/get-user-token-by-token.query';
import { QUERY_BUS } from '../cqrs';
import { ACCESS_TOKEN_COOKIE } from './auth-cookies';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @Inject(QUERY_BUS) private queryBus: IQueryBus,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    } catch {
      throw new UnauthorizedException();
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
