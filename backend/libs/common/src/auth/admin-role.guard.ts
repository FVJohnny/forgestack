import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.types';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.tokenData || request.tokenData.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
