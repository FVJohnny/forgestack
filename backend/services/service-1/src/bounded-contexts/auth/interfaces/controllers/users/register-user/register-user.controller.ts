import { Controller, Post, Body, HttpCode, HttpStatus, ConflictException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegisterUser_Command } from '@bc/auth/application/commands';
import { RegisterUser_ControllerParams } from './register-user.params';
import { Inject } from '@nestjs/common';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  StrictRateLimit,
  PublicApi,
  AlreadyExistsException,
} from '@libs/nestjs-common';

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

    try {
      await this.commandBus.execute(command);
    } catch (error) {
      // Don't echo the email back on a duplicate: the default message
      // ("Entity already exists with email: <email>") lets an attacker confirm
      // which addresses have accounts by probing this endpoint. Return a
      // generic conflict instead. (A status code still differs from success, so
      // for full anti-enumeration switch to an email-confirmation flow where
      // register always 201s and the "you already have an account" notice is
      // delivered out-of-band by email, like the password-reset flow.)
      if (error instanceof AlreadyExistsException) {
        throw new ConflictException('Registration could not be completed.');
      }
      throw error;
    }
  }
}
