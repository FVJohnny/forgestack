import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  GOOGLE_OAUTH_SERVICE,
  type GoogleUserInfo,
  type IGoogleOAuthService,
} from '@bc/auth/domain/services/google-oauth.interface';

export { GOOGLE_OAUTH_SERVICE, type GoogleUserInfo, type IGoogleOAuthService };

interface GoogleUserInfoResponse {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleOAuthService implements IGoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly clientId: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID ?? '';

    if (!this.clientId) {
      this.logger.warn('GOOGLE_CLIENT_ID not configured - Google OAuth will be disabled');
    }
  }

  async verifyAccessToken(accessToken: string): Promise<GoogleUserInfo> {
    if (!this.clientId) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    try {
      // Use Google's userinfo endpoint with the access token
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new BadRequestException('Invalid Google access token');
      }

      const payload: GoogleUserInfoResponse = await response.json();

      if (!payload.email) {
        throw new BadRequestException('Google account does not have an email address');
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified ?? false,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Google OAuth verification error', error);
      throw new BadRequestException('Failed to verify Google credentials. Please try again.');
    }
  }
}
