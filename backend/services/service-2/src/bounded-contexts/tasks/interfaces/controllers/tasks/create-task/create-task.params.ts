import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateTask_ControllerParams {
  @ApiProperty({
    example: 'Write the launch announcement',
    description: 'What needs doing',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
}
