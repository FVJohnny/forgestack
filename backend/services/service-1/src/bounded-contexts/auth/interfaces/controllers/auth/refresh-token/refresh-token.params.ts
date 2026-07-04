import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshToken_ControllerParams {
  // Browser clients send the refresh token as an httpOnly cookie, so the body
  // is empty. Non-browser clients (scripts, tests) may still pass it here.
  @ApiPropertyOptional({
    description: 'The refresh token to exchange for new tokens (browsers use the cookie instead)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
