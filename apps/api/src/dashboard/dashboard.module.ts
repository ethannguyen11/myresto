import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { RecipesModule } from '../recipes/recipes.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [RecipesModule, NotificationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
