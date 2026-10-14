import { Controller, Get, HttpCode, HttpStatus, Req, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { type IQueryBus } from '@nestjs/cqrs';
import {
  QUERY_BUS,
  JwtAuthGuard,
  RelaxedRateLimit,
  type AuthenticatedRequest,
} from '@libs/nestjs-common';
import { ListTasks_Query } from '@bc/tasks/application/queries/list-tasks/list-tasks.query';
import type { ListTasks_QueryResponse } from '@bc/tasks/application/queries/list-tasks/list-tasks.query-response';

@ApiTags('tasks')
@Controller('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ListTasks_Controller {
  constructor(@Inject(QUERY_BUS) private readonly queryBus: IQueryBus) {}

  @Get()
  @RelaxedRateLimit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "The signed-in user's tasks, newest first" })
  @ApiResponse({ status: HttpStatus.OK, description: 'The tasks and a total count' })
  async listTasks(@Req() req: AuthenticatedRequest): Promise<ListTasks_QueryResponse> {
    const query = new ListTasks_Query({ userId: req.tokenData.userId });
    return this.queryBus.execute(query);
  }
}
