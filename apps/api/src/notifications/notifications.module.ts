import { Module } from '@nestjs/common'
import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'
import { AlertsService } from './alerts.service'
import { AlertsScheduler } from './alerts.scheduler'
import { RecipesModule } from '../recipes/recipes.module'

@Module({
  imports: [RecipesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, AlertsService, AlertsScheduler],
  exports: [NotificationsService, AlertsService],
})
export class NotificationsModule {}
