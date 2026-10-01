import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { AlertsService } from './alerts.service'

@Injectable()
export class AlertsScheduler {
  private readonly logger = new Logger(AlertsScheduler.name)

  constructor(
    private prisma: PrismaService,
    private alertsService: AlertsService,
  ) {}

  /**
   * Tous les matins à 6 h — avant le rapport hebdomadaire du lundi 7 h, pour
   * que les alertes du jour soient déjà en base quand l'email part.
   */
  @Cron('0 6 * * *')
  async generateDailyAlerts() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    })

    let foodCost = 0
    let priceIncrease = 0
    let failed = 0

    for (const user of users) {
      try {
        const summary = await this.alertsService.refreshForUser(user.id)
        foodCost += summary.foodCostAlerts
        priceIncrease += summary.priceIncreaseAlerts
      } catch (err) {
        failed++
        this.logger.error(`Alertes en échec pour l'utilisateur ${user.id}`, err as Error)
      }
    }

    this.logger.log(
      `Alertes quotidiennes : ${users.length} utilisateur(s) traité(s), ` +
        `${foodCost} food cost, ${priceIncrease} hausse(s) de prix` +
        (failed > 0 ? `, ${failed} en échec` : ''),
    )
  }
}
