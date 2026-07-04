import { ApiProperty } from '@nestjs/swagger';

// New tokens are delivered as httpOnly cookies, not in the body.
export class RefreshToken_ResponseDto {
  @ApiProperty({ description: 'ID of the authenticated user' })
  userId!: string;
}
