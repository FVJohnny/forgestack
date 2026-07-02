import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenPayload, TokenPayload } from './jwt-auth.types';
import { v4 as uuid } from 'uuid';
import type { StringValue } from 'ms';

@Injectable()
export class JwtTokenService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenExpiry: StringValue | number;
  private readonly refreshTokenSecret: string;
  private readonly refreshTokenExpiry: StringValue | number;

  constructor(private readonly jwtService: JwtService) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
    if (!process.env.JWT_REFRESH_SECRET)
      throw new Error('JWT_REFRESH_SECRET environment variable is required');

    this.accessTokenSecret = process.env.JWT_SECRET;
    this.accessTokenExpiry = (process.env.JWT_EXPIRES_IN ?? '5m') as StringValue;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET;
    this.refreshTokenExpiry = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as StringValue;
  }

  generateAccessToken(payload: TokenPayload): string {
    return this.jwtService.sign(
      { ...payload, uniqueId: uuid() },
      {
        secret: this.accessTokenSecret,
        expiresIn: this.accessTokenExpiry,
      },
    );
  }

  generateRefreshToken(payload: TokenPayload): string {
    return this.jwtService.sign(
      { ...payload, uniqueId: uuid() },
      {
        secret: this.refreshTokenSecret,
        expiresIn: this.refreshTokenExpiry,
      },
    );
  }

  verifyAccessToken(token: string): JwtTokenPayload {
    return this.jwtService.verify<JwtTokenPayload>(token, {
      secret: this.accessTokenSecret,
    });
  }

  verifyRefreshToken(token: string): JwtTokenPayload {
    return this.jwtService.verify<JwtTokenPayload>(token, {
      secret: this.refreshTokenSecret,
    });
  }

  /**
   * Generate an impersonation access token with shorter expiry (1h)
   */
  generateImpersonationAccessToken(payload: TokenPayload): string {
    return this.jwtService.sign(
      { ...payload, uniqueId: uuid() },
      {
        secret: this.accessTokenSecret,
        expiresIn: '1h',
      },
    );
  }

  /**
   * Generate an impersonation refresh token with shorter expiry (4h)
   */
  generateImpersonationRefreshToken(payload: TokenPayload): string {
    return this.jwtService.sign(
      { ...payload, uniqueId: uuid() },
      {
        secret: this.refreshTokenSecret,
        expiresIn: '4h',
      },
    );
  }
}
