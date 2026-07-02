import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleOAuth_ControllerParams {
  @ApiProperty({ description: 'Google access token from frontend' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
