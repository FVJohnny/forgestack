import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenPayload, TokenPayload } from './jwt-auth.types';
import { v4 as uuid } from 'uuid';
import type { StringValue } from 'ms';
import { requiredEnv } from './env.util';

// The stack signs with a symmetric secret (HS256). Pinning the algorithm on
// both sign and verify is defense-in-depth: it stops an attacker from
// presenting a token signed with a different (e.g. asymmetric) algorithm, the
// classic key-substitution / algorithm-confusion attack, if a forker later
// introduces a public key.
export const JWT_ALGORITHM = 'HS256';

@Injectable()
export class JwtTokenService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenExpiry: StringValue | number;
  private readonly refreshTokenSecret: string;
  private readonly refreshTokenExpiry: StringValue | number;

  constructor(private readonly jwtService: JwtService) {
    this.accessTokenSecret = requiredEnv('JWT_SECRET');
    this.accessTokenExpiry = (process.env.JWT_EXPIRES_IN ?? '5m') as StringValue;
    this.refreshTokenSecret = requiredEnv('JWT_REFRESH_SECRET');
    this.refreshTokenExpiry = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as StringValue;
  }

  generateAccessToken(payload: TokenPayload): string {
    return this.jwtService.sign(
      { ...payload, uniqueId: uuid() },
      {
        secret: this.accessTokenSecret,
        expiresIn: this.accessTokenExpiry,
        algorithm: JWT_ALGORITHM,
      },
    );
  }

  generateRefreshToken(payload: TokenPayload): string {
    return this.jwtService.sign(
      { ...payload, uniqueId: uuid() },
      {
        secret: this.refreshTokenSecret,
        expiresIn: this.refreshTokenExpiry,
        algorithm: JWT_ALGORITHM,
      },
    );
  }

  verifyAccessToken(token: string): JwtTokenPayload {
    return this.jwtService.verify<JwtTokenPayload>(token, {
      secret: this.accessTokenSecret,
      algorithms: [JWT_ALGORITHM],
    });
  }

  verifyRefreshToken(token: string): JwtTokenPayload {
    return this.jwtService.verify<JwtTokenPayload>(token, {
      secret: this.refreshTokenSecret,
      algorithms: [JWT_ALGORITHM],
    });
  }
}
