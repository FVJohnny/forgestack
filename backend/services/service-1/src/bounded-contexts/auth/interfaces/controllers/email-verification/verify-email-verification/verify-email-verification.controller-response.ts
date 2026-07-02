import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmail_ResponseDto {
  @ApiProperty({
    description: 'The ID of the user whose email was verified',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
  })
  userId: string;

  @ApiProperty({
    description: 'JWT access token for auto-login',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    type: String,
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token for auto-login',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    type: String,
  })
  refreshToken: string;
}
