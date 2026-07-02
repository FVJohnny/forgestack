import { Module } from '@nestjs/common';
import { EventTrackerModule } from '@libs/nestjs-common';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [EventTrackerModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
