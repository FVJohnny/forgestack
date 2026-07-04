export class TokenPayload {
  userId: string;
  email: string;
  role: string;
  // Impersonation fields
  isImpersonating?: boolean;
  originalUserId?: string;
  originalEmail?: string;
}

class JwtPayload {
  uniqueId: string;
  iat: number;
  exp: number;
}

export type JwtTokenPayload = JwtPayload & TokenPayload;

/**
 * Authenticated request with token data
 * Use as intersection type with your framework's request type
 * Example: context.switchToHttp().getRequest<Request & AuthenticatedRequest>()
 */
export interface AuthenticatedRequest {
  tokenData: JwtTokenPayload;
  headers: {
    authorization?: string;
    'user-agent'?: string;
    'x-forwarded-for'?: string | string[];
    'x-real-ip'?: string | string[];
  };
}
