import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { EmailService } from './email.service'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class WeeklyScheduler {
  private readonly logger = new Logger(WeeklyScheduler.name)

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  @Cron('0 7 * * 1') // Every Monday at 7:00
  async sendWeeklyEmails() {
    this.logger.log('Running weekly email job...')

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, firstName: true },
    })

    let sent = 0
    for (const user of users) {
      try {
        const result = await this.emailService.sendWeeklyReport(user.id)
        if (result.sent) {
          sent++
          await this.notificationsService.create(
            user.id,
            'weekly',
            '📧 Rapport hebdomadaire envoyé',
            'Votre rapport de rentabilité de la semaine a été envoyé par email.',
          )
        }
      } catch (err: any) {
        this.logger.error(`Failed for user ${user.id}: ${err.message}`)
      }
    }

    this.logger.log(`Weekly emails sent: ${sent}/${users.length}`)
  }
}
