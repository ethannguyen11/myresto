import { Module } from '@nestjs/common'
import { EmailService } from './email.service'
import { EmailController } from './email.controller'
import { WeeklyScheduler } from './weekly.scheduler'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [EmailController],
  providers: [EmailService, WeeklyScheduler],
  exports: [EmailService],
})
export class EmailModule {}
