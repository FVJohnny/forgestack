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

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @Inject(QUERY_BUS) private queryBus: IQueryBus,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

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

  private extractTokenFromHeader(request: AuthenticatedRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
