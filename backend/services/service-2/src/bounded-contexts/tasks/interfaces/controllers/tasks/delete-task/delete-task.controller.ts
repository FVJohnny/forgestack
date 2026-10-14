import {
  Controller,
  Delete,
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
  StrictRateLimit,
  type AuthenticatedRequest,
} from '@libs/nestjs-common';
import { DeleteTask_Command } from '@bc/tasks/application/commands';

@ApiTags('tasks')
@Controller('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class DeleteTask_Controller {
  constructor(@Inject(COMMAND_BUS) private readonly commandBus: ICommandBus) {}

  @Delete(':taskId')
  @StrictRateLimit()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of your tasks' })
  @ApiParam({ name: 'taskId', description: 'ID of the task to delete' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Task deleted' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not your task' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Task not found' })
  async deleteTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const command = new DeleteTask_Command({
      taskId,
      requesterUserId: req.tokenData.userId,
    });

    await this.commandBus.execute(command);
  }
}
