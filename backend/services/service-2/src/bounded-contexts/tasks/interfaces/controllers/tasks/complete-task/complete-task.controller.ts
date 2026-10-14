import {
  Controller,
  Patch,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { type ICommandBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  JwtAuthGuard,
  StandardRateLimit,
  type AuthenticatedRequest,
} from '@libs/nestjs-common';
import { CompleteTask_Command } from '@bc/tasks/application/commands';

@ApiTags('tasks')
@Controller('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class CompleteTask_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Patch(':taskId/complete')
  @StandardRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one of your tasks as completed' })
  @ApiParam({ name: 'taskId', description: 'ID of the task to complete' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Task completed' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not your task' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  async completeTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const command = new CompleteTask_Command({
      taskId,
      requesterUserId: req.tokenData.userId,
    });

    await this.commandBus.execute(command);
  }
}
