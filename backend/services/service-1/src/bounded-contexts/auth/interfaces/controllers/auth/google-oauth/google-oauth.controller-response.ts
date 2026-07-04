import { ApiProperty } from '@nestjs/swagger';

// Tokens are delivered as httpOnly cookies, not in the body.
export class GoogleOAuth_ResponseDto {
  @ApiProperty({ description: 'ID of the authenticated user' })
  userId!: string;
}
