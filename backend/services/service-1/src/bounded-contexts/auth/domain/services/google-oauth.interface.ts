export const GOOGLE_OAUTH_SERVICE = Symbol('GOOGLE_OAUTH_SERVICE');

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface IGoogleOAuthService {
  verifyAccessToken(accessToken: string): Promise<GoogleUserInfo>;
}
