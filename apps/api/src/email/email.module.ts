import { Module } from '@nestjs/common'
import { EmailService } from './email.service'
import { EmailController } from './email.controller'
import { WeeklyScheduler } from './weekly.scheduler'
import { NotificationsModule } from '../notifications/notifications.module'
import { RecipesModule } from '../recipes/recipes.module'

@Module({
  imports: [NotificationsModule, RecipesModule],
  controllers: [EmailController],
  providers: [EmailService, WeeklyScheduler],
  exports: [EmailService],
})
export class EmailModule {}
