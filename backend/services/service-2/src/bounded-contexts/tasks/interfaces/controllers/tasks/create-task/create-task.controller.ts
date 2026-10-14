import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  JwtAuthGuard,
  StrictRateLimit,
  type AuthenticatedRequest,
} from '@libs/nestjs-common';
import { CreateTask_Command } from '@bc/tasks/application/commands';
import { CreateTask_ControllerParams } from './create-task.params';

@ApiTags('tasks')
@Controller('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class CreateTask_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Post()
  @StrictRateLimit()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a task for the signed-in user' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Task created' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid title' })
  async createTask(
    @Body() body: CreateTask_ControllerParams,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const command = new CreateTask_Command({
      title: body.title,
      requesterUserId: req.tokenData.userId,
    });

    await this.commandBus.execute(command);
  }
}
