import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegisterUser_Command } from '@bc/auth/application/commands';
import { RegisterUser_ControllerParams } from './register-user.params';
import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import { COMMAND_BUS, StrictRateLimit, PublicApi } from '@libs/nestjs-common';

@ApiTags('users')
@Controller('users')
export class RegisterUser_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Post()
  @StrictRateLimit()
  @HttpCode(HttpStatus.CREATED)
  @PublicApi()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully created',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or user already exists',
  })
  async registerUser(@Body() body: RegisterUser_ControllerParams) {
    const command = new RegisterUser_Command(body);

    await this.commandBus.execute(command);
  }
}
