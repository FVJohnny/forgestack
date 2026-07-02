import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

import { OrderTypes } from '../domain/criteria/order/order-type.vo';

export class ControllerPaginationParams {
  @ApiProperty({ required: false, description: 'Sort by field' })
  @IsOptional()
  @IsString()
  orderBy?: string;

  @ApiProperty({
    required: false,
    description: 'Sort direction',
  })
  @IsOptional()
  @IsString()
  orderType?: OrderTypes;

  @ApiProperty({ required: false, description: 'Maximum number of results' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @ApiProperty({ required: false, description: 'Number of results to skip' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number;

  @ApiProperty({ required: false, description: 'Whether to include total count in response' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  withTotal?: boolean;
}
