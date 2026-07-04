import { ApiProperty } from '@nestjs/swagger';

// Tokens are delivered as httpOnly cookies, not in the body, so the browser
// never has script access to them. Only the user id is returned.
export class LoginUser_ResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the authenticated user',
  })
  userId: string;
}
