import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExecutePasswordReset_ControllerParams {
  @ApiProperty({
    description: 'Password reset token ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  passwordResetId!: string;

  @ApiProperty({
    description: 'New password for the user account',
    example: 'NewSecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
