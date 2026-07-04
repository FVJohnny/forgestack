import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RecordIdentity_ControllerParams {
  @ApiPropertyOptional({ description: 'Browser fingerprint hash' })
  @IsOptional()
  @IsString()
  fingerprint?: string;

  @ApiPropertyOptional({ description: 'Device identifier' })
  @IsOptional()
  @IsString()
  deviceId?: string;
}
